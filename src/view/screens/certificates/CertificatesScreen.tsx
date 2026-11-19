import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getValidAuthSession,
  isAuthSessionError,
  listEvents,
  listEventSubscribers,
  listSubscribedEvents,
} from '@/src/lib/api/campus';
import type { CampusEvent, EventSubscriber, UserRole } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';

import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificatePrimaryButton,
  CertificateSectionTitle,
  CertificateStatusPill,
  getPersonInitials,
} from './CertificateUi';

type StudentFilter = 'all' | 'available' | 'pending';

export default function CertificatesScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');

  const loadScreen = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const session = await getValidAuthSession();
      setRole(session.payload.role);

      if (session.payload.role === 'student') {
        const subscribedEvents = await listSubscribedEvents();
        // A API atual ainda não informa emissão/publicação. Mostramos os eventos
        // com certificado habilitado (ou sem o campo em servidores antigos).
        const certificateEvents = subscribedEvents
          .filter((event) => event.has_certificate !== false)
          .sort((left, right) =>
            new Date(right.event_datetime).getTime() - new Date(left.event_datetime).getTime(),
          );
        setEvents(certificateEvents);
        return;
      }

      // O painel mostra todos os eventos. A autorização para abrir os inscritos
      // é aplicada pelo backend na rota /events/{id}/subscribers.
      const apiEvents = await listEvents();
      apiEvents.sort(
        (left, right) =>
          new Date(left.event_datetime).getTime() - new Date(right.event_datetime).getTime(),
      );
      setEvents(apiEvents);
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os certificados.',
      );
      setEvents([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadScreen();
    }, [loadScreen]),
  );

  const filteredStudentEvents = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLocaleLowerCase('pt-BR');

    return events.filter((event) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        event.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch);

      // Ainda não existe endpoint de certificados emitidos. Por isso, nenhum
      // evento pode ser apresentado como disponível antes da confirmação da API.
      const matchesFilter = studentFilter !== 'available';
      return matchesSearch && matchesFilter;
    });
  }, [events, studentFilter, studentSearch]);

  if (isLoading && role === null) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={CERTIFICATE_COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (role === 'student') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              colors={[CERTIFICATE_COLORS.primary]}
              onRefresh={() => void loadScreen(true)}
              refreshing={isRefreshing}
              tintColor={CERTIFICATE_COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Meus certificados</Text>
          <Text style={styles.pageSubtitle}>Comprovantes de participação e carga horária.</Text>

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#8B9199" />
            <TextInput
              onChangeText={setStudentSearch}
              placeholder="Buscar certificado"
              placeholderTextColor="#9AA0A8"
              style={styles.searchInput}
              value={studentSearch}
            />
            <MaterialIcons name="tune" size={19} color="#8B9199" />
          </View>

          <View style={styles.filterRow}>
            <FilterChip label="Todos" selected={studentFilter === 'all'} onPress={() => setStudentFilter('all')} />
            <FilterChip label="Disponíveis" selected={studentFilter === 'available'} onPress={() => setStudentFilter('available')} />
            <FilterChip label="Pendentes" selected={studentFilter === 'pending'} onPress={() => setStudentFilter('pending')} />
          </View>

          {error ? <ErrorNotice message={error} onRetry={() => void loadScreen()} /> : null}

          {studentFilter === 'available' ? (
            <EmptyState
              icon="hourglass-empty"
              title="Nenhum certificado publicado"
              message="Quando um certificado for emitido e publicado, ele ficará disponível para visualização e download nesta área."
            />
          ) : null}

          {studentFilter !== 'available' && filteredStudentEvents.length === 0 && !isLoading ? (
            <EmptyState
              icon="card-membership"
              title="Nenhum certificado pendente"
              message="Os eventos em que você se inscreveu e que oferecem certificado aparecerão aqui."
            />
          ) : null}

          {studentFilter !== 'available'
            ? filteredStudentEvents.map((event) => (
                <StudentCertificateCard
                  key={event.id}
                  event={event}
                  onPress={() =>
                    router.push({ pathname: '/certificado-detalhe', params: { eventId: String(event.id) } } as never)
                  }
                />
              ))
            : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeEvents = events.filter(
    (event) => new Date(event.event_datetime).getTime() >= Date.now(),
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[CERTIFICATE_COLORS.primary]}
            onRefresh={() => void loadScreen(true)}
            refreshing={isRefreshing}
            tintColor={CERTIFICATE_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Certificados por evento</Text>
        <Text style={styles.pageSubtitle}>Acompanhe presença, emissão e publicação.</Text>

        <View style={styles.metricsRow}>
          <MetricCard value={String(activeEvents)} label="eventos ativos" />
          <MetricCard value="—" label="elegíveis" helper="presença não registrada" />
          <MetricCard value="—" label="publicados" helper="status não fornecido" />
        </View>

        <CertificateSectionTitle
          title="Em andamento"
          subtitle={`${events.length} ${events.length === 1 ? 'evento listado' : 'eventos listados'}`}
        />

        {error ? <ErrorNotice message={error} onRetry={() => void loadScreen()} /> : null}

        {isLoading && events.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={CERTIFICATE_COLORS.primary} />
            <Text style={styles.loadingText}>Carregando eventos...</Text>
          </View>
        ) : null}

        {!isLoading && !error && events.length === 0 ? (
          <EmptyState
            icon="event-note"
            title="Nenhum evento encontrado"
            message="Os eventos cadastrados no Campus Cultural aparecerão aqui."
          />
        ) : null}

        {events.map((event) => (
          <TeacherEventCard
            key={event.id}
            event={event}
            onManage={() =>
              router.push({ pathname: '/certificados-participantes', params: { eventId: String(event.id) } } as never)
            }
            onConfigure={() =>
              router.push({ pathname: '/certificados-configurar', params: { eventId: String(event.id) } } as never)
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ value, label, helper }: { value: string; label: string; helper?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

function TeacherEventCard({
  event,
  onManage,
  onConfigure,
}: {
  event: CampusEvent;
  onManage: () => void;
  onConfigure: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subscribers, setSubscribers] = useState<EventSubscriber[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [subscriberError, setSubscriberError] = useState<string | null>(null);
  const [hasLoadedSubscribers, setHasLoadedSubscribers] = useState(false);
  const subscriberCount = event.subscribers_count;

  const loadSubscribers = useCallback(async () => {
    setIsLoadingSubscribers(true);
    setSubscriberError(null);
    try {
      const result = await listEventSubscribers(event.id);
      setSubscribers(result.filter((subscriber) => subscriber.role === 'student'));
      setHasLoadedSubscribers(true);
    } catch (loadError) {
      setHasLoadedSubscribers(false);
      setSubscriberError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível consultar os participantes deste evento.',
      );
    } finally {
      setIsLoadingSubscribers(false);
    }
  }, [event.id]);

  const handleExpand = useCallback(() => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !hasLoadedSubscribers && !isLoadingSubscribers) {
      void loadSubscribers();
    }
  }, [expanded, hasLoadedSubscribers, isLoadingSubscribers, loadSubscribers]);

  const progress = event.max_participants && typeof subscriberCount === 'number'
    ? Math.min(subscriberCount / event.max_participants, 1)
    : null;

  return (
    <View style={styles.eventCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={handleExpand}
        style={({ pressed }) => [styles.eventCardHeader, pressed && styles.pressed]}>
        <View style={styles.eventTopRow}>
          <View style={styles.eventTitleWrap}>
            <Text numberOfLines={2} style={styles.eventTitle}>{event.name}</Text>
            <Text style={styles.eventDate}>{formatEventDate(event.event_datetime)}</Text>
          </View>
          <CertificateStatusPill
            label={event.has_certificate === true ? 'Pendente' : 'Sem certificado'}
            tone={event.has_certificate === true ? 'warning' : 'neutral'}
          />
        </View>
        <View style={styles.eventMetadata}>
          <MetaItem icon="schedule" label={formatTime(event.event_datetime)} />
          <MetaItem icon="groups" label={`${subscriberCount ?? '—'} inscritos`} />
          {typeof event.workload_hours === 'number' ? (
            <MetaItem icon="timer" label={`${event.workload_hours} horas`} />
          ) : null}
        </View>
        {progress !== null ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Inscrições registradas</Text>
              <Text style={styles.progressValue}>{subscriberCount} de {event.max_participants}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        ) : null}
        <View style={styles.expandHintRow}>
          <Text style={styles.expandHint}>{expanded ? 'Ocultar participantes' : 'Toque para ver os participantes'}</Text>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#616873" />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedPanel}>
          <View style={styles.panelDivider} />
          <CertificateSectionTitle
            title="Participantes inscritos"
            subtitle={hasLoadedSubscribers ? `${subscribers.length} alunos` : `${subscriberCount ?? 0} inscrições registradas`}
          />
          {isLoadingSubscribers ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#B08D00" />
              <Text style={styles.inlineLoadingText}>Consultando inscritos...</Text>
            </View>
          ) : null}
          {subscriberError ? (
            <CertificateInfoBanner
              title="Não foi possível carregar os nomes"
              message={subscriberError}
              tone="warning"
            />
          ) : null}
          {!isLoadingSubscribers && !subscriberError && hasLoadedSubscribers && subscribers.length === 0 ? (
            <Text style={styles.noSubscribers}>Nenhum aluno inscrito neste evento.</Text>
          ) : null}
          {!isLoadingSubscribers && !subscriberError
            ? subscribers.map((subscriber) => (
                <SubscriberPreview key={subscriber.user_id} subscriber={subscriber} />
              ))
            : null}
          {subscriberError?.startsWith('403:') ? (
            <CertificateInfoBanner
              title="Evento organizado por outro professor"
              message="Você pode visualizar este evento no painel, mas somente o responsável pela organização ou um administrador pode gerenciar participantes e certificados."
              tone="info"
            />
          ) : (
            <View style={styles.eventActions}>
              <View style={styles.eventActionFlex}>
                <CertificatePrimaryButton label="Gerenciar participantes" onPress={onManage} icon="arrow-forward" />
              </View>
              <Pressable accessibilityRole="button" onPress={onConfigure} style={styles.configureShortcut}>
                <MaterialIcons name="card-membership" size={17} color="#343A40" />
                <Text style={styles.configureShortcutText}>
                  {event.has_certificate === true ? 'Configurar' : 'Habilitar certificado'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SubscriberPreview({ subscriber }: { subscriber: EventSubscriber }) {
  const fullName = `${subscriber.name} ${subscriber.last_name ?? ''}`.trim();
  return (
    <View style={styles.subscriberPreview}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getPersonInitials(subscriber.name, subscriber.last_name)}</Text>
      </View>
      <View style={styles.subscriberIdentity}>
        <Text numberOfLines={1} style={styles.subscriberName}>{fullName}</Text>
        <Text style={styles.subscriberRa}>{subscriber.ra ? `RA ${subscriber.ra}` : 'RA não informado'}</Text>
      </View>
      <CertificateStatusPill label="Inscrito" tone="success" />
    </View>
  );
}

function StudentCertificateCard({ event, onPress }: { event: CampusEvent; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.studentCard, pressed && styles.pressed]}>
      <View style={styles.studentCardTop}>
        <View style={styles.studentCardIcon}>
          <MaterialIcons name="workspace-premium" size={19} color="#171717" />
        </View>
        <CertificateStatusPill label="Pendente" tone="warning" />
      </View>
      <Text style={styles.studentEventName}>{event.name}</Text>
      <View style={styles.studentMetadata}>
        <Text style={styles.studentMetadataText}>{typeof event.workload_hours === 'number' ? `${event.workload_hours} horas` : 'Carga horária a confirmar'}</Text>
        <Text style={styles.studentMetadataText}>{formatHoursGroup(event.hours_group)}</Text>
      </View>
      <View style={styles.studentCardFooter}>
        <Text style={styles.studentDate}>{formatEventDate(event.event_datetime)}</Text>
        <View style={styles.studentCardLinkRow}>
          <Text style={styles.studentCardLink}>Ver detalhes</Text>
          <MaterialIcons name="arrow-forward" size={15} color="#222222" />
        </View>
      </View>
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function MetaItem({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.eventMetaItem}>
      <MaterialIcons name={icon} size={14} color="#777F88" />
      <Text numberOfLines={1} style={styles.eventMetaText}>{label}</Text>
    </View>
  );
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorNotice}>
      <MaterialIcons name="error-outline" size={21} color="#B42318" />
      <Text style={styles.errorText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ icon, title, message }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name={icon} size={23} color="#9298A0" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '');
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatHoursGroup(value: CampusEvent['hours_group']) {
  if (value === 'group_1') return 'Grupo 1';
  if (value === 'group_2') return 'Grupo 2';
  if (value === 'group_3') return 'Grupo 3';
  return 'Grupo não informado';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CERTIFICATE_COLORS.background, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', paddingVertical: 18 },
  loadingText: { color: CERTIFICATE_COLORS.muted, fontSize: 10 },
  content: { paddingBottom: 34, paddingHorizontal: 18, paddingTop: 16 },
  pageTitle: { color: CERTIFICATE_COLORS.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.5 },
  pageSubtitle: { color: CERTIFICATE_COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 22, marginTop: 18 },
  metricCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 9, borderWidth: 1, flex: 1, minHeight: 66, paddingHorizontal: 10, paddingVertical: 9 },
  metricValue: { color: '#272B30', fontSize: 20, fontWeight: '900' },
  metricLabel: { color: '#737B84', fontSize: 9, marginTop: 2 },
  metricHelper: { color: '#A1A6AC', fontSize: 7, marginTop: 3 },
  eventCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 11, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  eventCardHeader: { paddingHorizontal: 13, paddingTop: 13, paddingBottom: 11 },
  eventTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  eventTitleWrap: { flex: 1, gap: 3 },
  eventTitle: { color: '#343A40', fontSize: 13, fontWeight: '900', lineHeight: 17 },
  eventDate: { color: '#8A9199', fontSize: 9 },
  eventMetadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  eventMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 4, maxWidth: '48%' },
  eventMetaText: { color: '#7B838C', fontSize: 9 },
  progressBlock: { marginTop: 11 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { color: '#6E7680', fontSize: 8 },
  progressValue: { color: '#9A7100', fontSize: 8, fontWeight: '800' },
  progressTrack: { backgroundColor: '#ECEDEF', borderRadius: 5, height: 5, overflow: 'hidden' },
  progressFill: { backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 5, height: 5 },
  expandHintRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  expandHint: { color: '#6E7680', fontSize: 9, fontWeight: '700' },
  expandedPanel: { paddingHorizontal: 13, paddingBottom: 13 },
  panelDivider: { backgroundColor: '#ECEDEF', height: 1, marginBottom: 12 },
  inlineLoading: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 12 },
  inlineLoadingText: { color: '#747C85', fontSize: 9 },
  noSubscribers: { color: '#777F88', fontSize: 10, paddingVertical: 10 },
  subscriberPreview: { alignItems: 'center', borderBottomColor: '#F0F1F2', borderBottomWidth: 1, flexDirection: 'row', gap: 9, paddingVertical: 8 },
  avatar: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  avatarText: { color: '#171717', fontSize: 10, fontWeight: '900' },
  subscriberIdentity: { flex: 1, gap: 2 },
  subscriberName: { color: '#343A40', fontSize: 10, fontWeight: '800' },
  subscriberRa: { color: '#858C94', fontSize: 8 },
  eventActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  eventActionFlex: { flex: 1 },
  configureShortcut: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#C9CDD1', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 5, justifyContent: 'center', paddingHorizontal: 10 },
  configureShortcutText: { color: '#343A40', fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.83 },
  errorNotice: { alignItems: 'center', backgroundColor: '#FFF4E5', borderColor: '#F0D8A8', borderRadius: 10, borderWidth: 1, marginBottom: 12, padding: 14 },
  errorText: { color: '#6F5421', fontSize: 10, lineHeight: 15, marginTop: 7, textAlign: 'center' },
  retryButton: { backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 7, marginTop: 10, paddingHorizontal: 14, paddingVertical: 8 },
  retryButtonText: { color: '#171717', fontSize: 9, fontWeight: '900' },
  emptyState: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 11, borderWidth: 1, marginTop: 12, paddingHorizontal: 22, paddingVertical: 28 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#F1F2F3', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  emptyTitle: { color: '#343A40', fontSize: 11, fontWeight: '900', marginTop: 10 },
  emptyMessage: { color: '#858C94', fontSize: 9, lineHeight: 14, marginTop: 5, textAlign: 'center' },
  searchBox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 8, height: 42, marginTop: 17, paddingHorizontal: 11 },
  searchInput: { color: '#343A40', flex: 1, fontSize: 10, height: '100%' },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 14, marginTop: 10 },
  filterChip: { backgroundColor: '#FFFFFF', borderColor: '#E1E3E5', borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 },
  filterChipSelected: { backgroundColor: CERTIFICATE_COLORS.primary, borderColor: CERTIFICATE_COLORS.primary },
  filterChipText: { color: '#59616A', fontSize: 9, fontWeight: '700' },
  filterChipTextSelected: { color: '#171717', fontWeight: '900' },
  studentCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 10, borderWidth: 1, marginBottom: 10, padding: 13 },
  studentCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  studentCardIcon: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
  studentEventName: { color: '#343A40', fontSize: 12, fontWeight: '900', marginTop: 10 },
  studentMetadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 7 },
  studentMetadataText: { color: '#858C94', fontSize: 9 },
  studentCardFooter: { alignItems: 'center', borderTopColor: '#EEF0F1', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 11, paddingTop: 9 },
  studentDate: { color: '#8C939B', fontSize: 8 },
  studentCardLinkRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  studentCardLink: { color: '#24282D', fontSize: 9, fontWeight: '900' },
});
