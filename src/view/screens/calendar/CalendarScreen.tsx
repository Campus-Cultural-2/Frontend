import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const PRIMARY_COLOR = '#FFCC00';
const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

type EventFilter = 'all' | 'subscribed' | 'mine';

export default function CalendarScreen() {
  const router = useRouter();
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
            : 'Não foi possível carregar a agenda.',
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
        Alert.alert(
          'Ops',
          enrollError instanceof Error
            ? enrollError.message
            : 'Não foi possível atualizar sua inscrição.',
        );
      }
    },
    [enrolledEventIds, router],
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
        <Animatable.View
          animation="fadeInDown"
          duration={360}
          style={styles.header}
          useNativeDriver>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Agenda</Text>
          <Pressable accessibilityRole="button" hitSlop={10}>
            <MaterialIcons name="search" size={22} color="#111111" />
          </Pressable>
        </Animatable.View>

        <Animatable.View
          animation="fadeInLeft"
          delay={80}
          duration={360}
          style={styles.monthRow}
          useNativeDriver>
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
          useNativeDriver>
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
            useNativeDriver>
            <ActivityIndicator color="#111111" />
            <Text style={styles.loadingText}>Atualizando agenda...</Text>
          </Animatable.View>
        ) : null}

        {error ? (
          <Animatable.Text animation="fadeIn" duration={320} style={styles.errorText} useNativeDriver>
            {error}
          </Animatable.Text>
        ) : null}

        <Animatable.View
          animation="fadeInUp"
          delay={180}
          duration={420}
          style={styles.calendarCard}
          useNativeDriver>
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
            <MaterialIcons name="add-circle-outline" size={19} color="#111111" />
            <Text style={styles.createEventButtonText}>Cadastrar evento</Text>
          </Pressable>
        ) : null}

        <Animatable.Text
          animation="fadeIn"
          delay={260}
          duration={360}
          style={styles.dayTitle}
          useNativeDriver>
          {selectedDate ? formatSelectedDayTitle(selectedDate) : 'Selecione um dia'}
        </Animatable.Text>

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
            />
          ))}

          {!isLoading && selectedDate && selectedDayEvents.length === 0 ? (
            <Animatable.Text
              animation="fadeIn"
              duration={320}
              style={styles.emptyText}
              useNativeDriver>
              {filter === 'subscribed'
                ? 'Nenhum evento inscrito para este dia.'
                : 'Nenhum evento para este dia.'}
            </Animatable.Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AgendaCard({
  enrolled,
  event,
  index,
  onToggleEnrollment,
  onEdit,
}: {
  enrolled: boolean;
  event: CampusEvent;
  index: number;
  onToggleEnrollment: () => void;
  onEdit?: () => void;
}) {
  return (
    <Animatable.View
      animation="fadeInUp"
      delay={320 + index * 90}
      duration={420}
      style={styles.agendaCard}
      useNativeDriver>
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
            <MaterialIcons name="schedule" size={13} color="#6F7782" />
            <Text style={styles.agendaMetaText}>{formatCampusTimeRange(event.event_datetime)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="place" size={13} color="#6F7782" />
            <Text numberOfLines={1} style={styles.agendaMetaText}>
              {event.event_location}
            </Text>
          </View>
        </View>
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
    flex: 1,
    backgroundColor: '#F7F7FA',
  },
  content: {
    paddingBottom: 112,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  contentCompact: {
    paddingHorizontal: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerSpacer: {
    width: 22,
  },
  headerTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  monthTitle: {
    color: '#20242A',
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
    backgroundColor: '#FFFFFF',
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
    color: '#111111',
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
    color: '#B42318',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 14,
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
    color: '#2F3338',
    fontSize: 12,
    fontWeight: '700',
  },
  dayTextActive: {
    color: '#FFFFFF',
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
    color: '#111111',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    flexDirection: 'row',
    minHeight: 84,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.03,
    shadowRadius: 14,
  },
  agendaAccent: {
    backgroundColor: PRIMARY_COLOR,
    width: 3,
  },
  agendaContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  agendaActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  editEventButton: {
    alignItems: 'center',
    backgroundColor: '#F0F1F2',
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
    color: '#2F3338',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    maxWidth: '100%',
  },
  agendaMetaText: {
    color: '#5F6670',
    fontSize: 12,
    fontWeight: '700',
  },
});
