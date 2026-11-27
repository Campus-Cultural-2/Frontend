import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/ui/app-text';
import { AppToast } from '@/components/ui/app-toast';
import { useAppToast } from '@/src/view/hooks/useAppToast';
import { AppButton, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import {
  CampusEvent,
  isAuthSessionError,
  listEvents,
  listSubscribedEvents,
  subscribeToEvent,
  unsubscribeFromEvent,
  getValidAuthSession,
} from '@/src/lib/api/campus';
import type { UserRole } from '@/src/lib/api/schemas';
import { formatCampusTimeRange, getCampusDateKey } from '@/src/lib/datetime/campusTime';

const AnimatedText = Animatable.createAnimatableComponent(Text);

const PRIMARY_COLOR = colors.brand.primary;
const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

type EventFilter = 'all' | 'subscribed' | 'mine';

export default function CalendarScreen() {
  const router = useRouter();
  const { showToast, toast } = useAppToast();
  const { newEventDate } = useLocalSearchParams<{ newEventDate?: string }>();
  const { width } = useWindowDimensions();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [enrolledEventIds, setEnrolledEventIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compactMode = width < 360;
  const monthDays = useMemo(() => getVisibleMonthDays(monthDate), [monthDate]);
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const filteredEventsByDay = useMemo(() => {
    if (filter === 'all') {
      return eventsByDay;
    }

    if (filter === 'subscribed') {
      return groupEventsByDay(events.filter((event) => enrolledEventIds.has(event.id)));
    }

    return groupEventsByDay(
      events.filter((event) => currentUserId !== null && event.user_id === currentUserId),
    );
  }, [currentUserId, enrolledEventIds, events, eventsByDay, filter]);
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return filteredEventsByDay.get(getDateKey(selectedDate)) ?? [];
  }, [filteredEventsByDay, selectedDate]);

  const loadEvents = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const session = await getValidAuthSession();
        setRole(session.payload.role);
        setCurrentUserId(Number(session.payload.sub));

        const [apiEvents, subscribedEvents] = await Promise.all([
          listEvents(),
          listSubscribedEvents(),
        ]);
        const sortedEvents = [...apiEvents].sort(
          (left, right) =>
            new Date(left.event_datetime).getTime() - new Date(right.event_datetime).getTime(),
        );
        const initialEvent = sortedEvents.find((event) => !isEventInPast(event));
        const initialDate = initialEvent ? new Date(initialEvent.event_datetime) : new Date();

        setEvents(sortedEvents);
        setEnrolledEventIds(new Set(subscribedEvents.map((event) => event.id)));
        setMonthDate(startOfMonth(initialDate));
        setSelectedDate((currentSelectedDate) => currentSelectedDate ?? initialDate);
      } catch (calendarError) {
        if (isAuthSessionError(calendarError)) {
          router.replace('/login' as never);
          return;
        }

        setEvents([]);
        setRole(null);
        setCurrentUserId(null);
        setError(
          calendarError instanceof Error
            ? calendarError.message
            : 'Não foi possível carregar os eventos.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents]),
  );

  useEffect(() => {
    if (typeof newEventDate !== 'string') return;

    const createdDate = new Date(newEventDate);
    if (Number.isNaN(createdDate.getTime())) return;

    setMonthDate(startOfMonth(createdDate));
    setSelectedDate(createdDate);
    setFilter('all');
  }, [newEventDate]);

  function goToPreviousMonth() {
    setMonthDate((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setMonthDate((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)));
    setSelectedDate(null);
  }

  const toggleEnrollment = useCallback(
    async (eventId: number) => {
      const wasEnrolled = enrolledEventIds.has(eventId);

      setEnrolledEventIds((current) => toggleId(current, eventId, !wasEnrolled));

      try {
        if (wasEnrolled) {
          await unsubscribeFromEvent(eventId);
        } else {
          await subscribeToEvent(eventId);
        }
      } catch (enrollError) {
        if (isAuthSessionError(enrollError)) {
          router.replace('/login' as never);
          return;
        }

        // Rollback the optimistic change on failure.
        setEnrolledEventIds((current) => toggleId(current, eventId, wasEnrolled));
        showToast({
          message: enrollError instanceof Error
            ? enrollError.message
            : 'Não foi possível atualizar sua inscrição.',
          type: 'error',
        });
      }
    },
    [enrolledEventIds, router, showToast],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, compactMode ? styles.contentCompact : null]}
        refreshControl={
          <RefreshControl
            colors={[PRIMARY_COLOR]}
            onRefresh={() => void loadEvents({ refreshing: true })}
            refreshing={isRefreshing}
            tintColor={PRIMARY_COLOR}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={360} useNativeDriver={Platform.OS !== 'web'}>
          <AppPageHeader title="Calendário de Eventos" />
        </Animatable.View>

        <Animatable.View
          animation="fadeInLeft"
          delay={80}
          duration={360}
          style={styles.monthRow}
          useNativeDriver={Platform.OS !== 'web'}>
          <Text style={styles.monthTitle}>{formatMonthTitle(monthDate)}</Text>
          <View style={styles.monthActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mês anterior"
              hitSlop={12}
              onPress={goToPreviousMonth}
              style={styles.monthButton}>
              <MaterialIcons name="chevron-left" size={20} color="#505761" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Próximo mês"
              hitSlop={12}
              onPress={goToNextMonth}
              style={styles.monthButton}>
              <MaterialIcons name="chevron-right" size={20} color="#505761" />
            </Pressable>
          </View>
        </Animatable.View>

        <Animatable.View
          animation="fadeIn"
          delay={140}
          duration={360}
          style={styles.filters}
          useNativeDriver={Platform.OS !== 'web'}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'all' }}
            onPress={() => setFilter('all')}
            style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Todos
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'subscribed' }}
            onPress={() => setFilter('subscribed')}
            style={[styles.filterPill, filter === 'subscribed' && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === 'subscribed' && styles.filterTextActive]}>
              Inscritos
            </Text>
          </Pressable>
          {role === 'professor' && events.some((event) => typeof event.user_id === 'number') ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === 'mine' }}
              onPress={() => setFilter('mine')}
              style={[styles.filterPill, filter === 'mine' && styles.filterPillActive]}>
              <Text style={[styles.filterText, filter === 'mine' && styles.filterTextActive]}>
                Meus eventos
              </Text>
            </Pressable>
          ) : null}
        </Animatable.View>

        {isLoading ? (
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            style={styles.loadingRow}
            useNativeDriver={Platform.OS !== 'web'}>
            <ActivityIndicator color={colors.text.primary} />
            <Text style={styles.loadingText}>Atualizando eventos...</Text>
          </Animatable.View>
        ) : null}

        {error ? (
          <AnimatedText animation="fadeIn" duration={320} style={styles.errorText} useNativeDriver={Platform.OS !== 'web'}>
            {error}
          </AnimatedText>
        ) : null}

        <Animatable.View
          animation="fadeInUp"
          delay={180}
          duration={420}
          style={styles.calendarCard}
          useNativeDriver={Platform.OS !== 'web'}>
          <View style={styles.weekRow}>
            {weekDays.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {monthDays.map((calendarDay) => {
              if (!calendarDay.day) {
                return <View key={calendarDay.key} style={styles.dayCell} />;
              }

              const dayDate = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth(),
                calendarDay.day,
              );
              const dateKey = getDateKey(dayDate);
              const isSelected = selectedDate ? getDateKey(selectedDate) === dateKey : false;
              const hasEvent = filteredEventsByDay.has(dateKey);

              return (
                <View key={calendarDay.key} style={styles.dayCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar dia ${calendarDay.day}`}
                    onPress={() => setSelectedDate(dayDate)}
                    style={[styles.dayCircle, isSelected ? styles.dayCircleActive : null]}>
                    <Text style={[styles.dayText, isSelected ? styles.dayTextActive : null]}>
                      {calendarDay.day}
                    </Text>
                  </Pressable>
                  {hasEvent && !isSelected ? <View style={styles.eventDot} /> : null}
                </View>
              );
            })}
          </View>
        </Animatable.View>

        {role === 'professor' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cadastrar evento"
            onPress={() => router.push('/novo-evento' as never)}
            style={styles.createEventButton}>
            <MaterialIcons name="add-circle-outline" size={19} color={colors.text.primary} />
            <Text style={styles.createEventButtonText}>Cadastrar evento</Text>
          </Pressable>
        ) : null}

        <AnimatedText
          animation="fadeIn"
          delay={260}
          duration={360}
          style={styles.dayTitle}
          useNativeDriver={Platform.OS !== 'web'}>
          {selectedDate ? formatSelectedDayTitle(selectedDate) : 'Selecione um dia'}
        </AnimatedText>

        <View style={styles.eventList}>
          {selectedDayEvents.map((event, index) => (
            <AgendaCard
              enrolled={enrolledEventIds.has(event.id)}
              event={event}
              index={index}
              key={event.id}
              onToggleEnrollment={() => void toggleEnrollment(event.id)}
              onEdit={
                role === 'professor' && currentUserId !== null && event.user_id === currentUserId
                  ? () => router.push({ pathname: '/novo-evento', params: { eventId: String(event.id) } } as never)
                  : undefined
              }
              onAttendance={
                role === 'admin' ||
                (role === 'professor' && currentUserId !== null && event.user_id === currentUserId)
                  ? () => router.push({ pathname: '/presenca', params: { eventId: String(event.id) } } as never)
                  : undefined
              }
              onDetails={
                role === 'student'
                  ? () => router.push({ pathname: '/evento-detalhe', params: { eventId: String(event.id) } } as never)
                  : undefined
              }
            />
          ))}

          {!isLoading && selectedDate && selectedDayEvents.length === 0 ? (
            <AnimatedText
              animation="fadeIn"
              duration={320}
              style={styles.emptyText}
              useNativeDriver={Platform.OS !== 'web'}>
              {filter === 'subscribed'
                ? 'Nenhum evento inscrito para este dia.'
                : 'Nenhum evento para este dia.'}
            </AnimatedText>
          ) : null}
        </View>
      </ScrollView>
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

function AgendaCard({
  enrolled,
  event,
  index,
  onToggleEnrollment,
  onEdit,
  onAttendance,
  onDetails,
}: {
  enrolled: boolean;
  event: CampusEvent;
  index: number;
  onToggleEnrollment: () => void;
  onEdit?: () => void;
  onAttendance?: () => void;
  onDetails?: () => void;
}) {
  const router = useRouter();

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={320 + index * 90}
      duration={420}
      style={styles.agendaCard}
      useNativeDriver={Platform.OS !== 'web'}>
      <View style={styles.agendaAccent} />
      <View style={styles.agendaContent}>
        <View style={styles.agendaTop}>
          <Text numberOfLines={2} style={styles.agendaTitle}>
            {event.name}
          </Text>
          <View style={styles.agendaActions}>
            {onEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar evento ${event.name}`}
                onPress={onEdit}
                style={styles.editEventButton}>
                <MaterialIcons name="edit" size={15} color="#555B64" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={enrolled ? 'Cancelar inscrição' : 'Inscrever-se no evento'}
              onPress={onToggleEnrollment}
              style={[styles.statusPill, enrolled ? styles.statusPillEnrolled : null]}>
              <Text style={[styles.statusText, enrolled ? styles.statusTextEnrolled : null]}>
                {enrolled ? 'Inscrito' : 'Inscrever-se'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.agendaMeta}>
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={13} color={colors.text.secondary} />
            <Text style={styles.agendaMetaText}>{formatCampusTimeRange(event.event_datetime, event.event_end_datetime)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="place" size={13} color={colors.text.secondary} />
            <Text numberOfLines={1} style={styles.agendaMetaText}>
              {event.event_location}
            </Text>
          </View>
        </View>
        {onDetails || onAttendance || (enrolled && event.attendance_mode !== 'none') ? (
          <View style={styles.agendaFooterActions}>
            {onDetails ? (
              <AppButton
                label="Detalhes"
                variant="outline"
                size="sm"
                equalWidth
                icon={<MaterialIcons name="arrow-forward" size={15} color={colors.text.heading} />}
                onPress={onDetails}
              />
            ) : null}
            {onAttendance ? (
              <AppButton
                label="Gerenciar presença"
                variant="outline"
                size="sm"
                equalWidth
                icon={<MaterialIcons name="how-to-reg" size={15} color={colors.text.heading} />}
                onPress={onAttendance}
              />
            ) : null}
            {enrolled && event.attendance_mode !== 'none' ? (
              <AppButton
                label="Confirmar presença"
                variant="primary"
                size="sm"
                equalWidth
                icon={<MaterialIcons name="qr-code-scanner" size={15} color={colors.text.primary} />}
                onPress={() => router.push({ pathname: '/meu-ingresso', params: { eventId: String(event.id) } } as never)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Animatable.View>
  );
}

function toggleId(current: Set<number>, eventId: number, shouldContain: boolean) {
  const next = new Set(current);

  if (shouldContain) {
    next.add(eventId);
  } else {
    next.delete(eventId);
  }

  return next;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function getVisibleMonthDays(monthDate: Date) {
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstWeekDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const totalCalendarCells = Math.ceil((firstWeekDay + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCalendarCells }, (_, index) => {
    const day = index - firstWeekDay + 1;

    if (day < 1 || day > daysInMonth) {
      return { key: `empty-${monthDate.getFullYear()}-${monthDate.getMonth()}-${index}`, day: null };
    }

    return { key: `day-${monthDate.getFullYear()}-${monthDate.getMonth()}-${day}`, day };
  });
}

function groupEventsByDay(events: CampusEvent[]) {
  return events.reduce((groupedEvents, event) => {
    const dateKey = getCampusDateKey(event.event_datetime);
    const currentEvents = groupedEvents.get(dateKey) ?? [];
    groupedEvents.set(dateKey, [...currentEvents, event]);
    return groupedEvents;
  }, new Map<string, CampusEvent[]>());
}

function getDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

function formatMonthTitle(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
    .format(value)
    .replace(/^[\p{L}]/u, (letter) => letter.toUpperCase());
}

function formatSelectedDayTitle(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(value)
    .replace(/^[\p{L}]/u, (letter) => letter.toUpperCase());
}

function isEventInPast(event: CampusEvent) {
  return new Date(event.event_datetime).getTime() < Date.now();
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen,
    flex: 1,
  },
  content: {
    ...appLayoutStyles.content,
    paddingBottom: 112,
    paddingHorizontal: 16,
  },
  contentCompact: {
    paddingHorizontal: 14,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  monthTitle: {
    color: colors.text.heading,
    fontSize: 18,
    fontWeight: '900',
  },
  monthActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  monthButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  filters: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  filterPill: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: 16,
    height: 28,
    justifyContent: 'center',
    minWidth: 58,
    paddingHorizontal: 14,
  },
  filterPillActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterText: {
    color: '#5D6470',
    fontSize: 10,
    fontWeight: '800',
  },
  filterTextActive: {
    color: colors.text.primary,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    color: colors.status.danger,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  calendarCard: {
    ...appSurfaceStyles.card,
    borderRadius: 16,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    boxShadow: '0px 6px 14px rgba(17, 17, 17, 0.03)',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekDay: {
    color: '#3E444C',
    flex: 1,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    rowGap: 10,
  },
  dayCell: {
    alignItems: 'center',
    height: 34,
    width: `${100 / 7}%`,
  },
  dayCircle: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dayCircleActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  dayText: {
    color: colors.text.heading,
    fontSize: 12,
    fontWeight: '700',
  },
  dayTextActive: {
    color: colors.neutral.white,
    fontWeight: '900',
  },
  eventDot: {
    backgroundColor: '#1684A5',
    borderRadius: 2,
    height: 3,
    marginTop: -2,
    width: 3,
  },
  createEventButton: {
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  createEventButtonText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  dayTitle: {
    color: '#2A2E35',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 26,
  },
  eventList: {
    gap: 12,
    marginTop: 14,
  },
  emptyText: {
    color: '#7A7F87',
    fontSize: 12,
    fontWeight: '800',
    paddingTop: 12,
    textAlign: 'center',
  },
  agendaCard: {
    ...appSurfaceStyles.card,
    borderRadius: 16,
    flexDirection: 'row',
    minHeight: 84,
    overflow: 'hidden',
    boxShadow: '0px 5px 14px rgba(17, 17, 17, 0.03)',
  },
  agendaAccent: {
    backgroundColor: PRIMARY_COLOR,
    width: 4,
  },
  agendaContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  agendaActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  editEventButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.subtle,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  agendaTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  agendaTitle: {
    color: colors.text.heading,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  statusPill: {
    backgroundColor: '#ECEEF1',
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillEnrolled: {
    backgroundColor: '#FFF1B7',
  },
  statusText: {
    color: '#333333',
    fontSize: 9,
    fontWeight: '900',
  },
  statusTextEnrolled: {
    color: '#3A3100',
    textTransform: 'uppercase',
  },
  agendaMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 10,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    maxWidth: '100%',
  },
  detailsLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
  },
  detailsLinkText: {
    color: '#454B53',
    fontSize: 10,
    fontWeight: '800',
  },
  agendaMetaText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  agendaFooterActions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 12,
  },
});
