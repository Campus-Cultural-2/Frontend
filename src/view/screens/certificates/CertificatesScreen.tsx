import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppButton, AppCard, AppEmptyState, AppFilterChip, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import {
  getValidAuthSession,
  isAuthSessionError,
  isPermissionDeniedError,
  listEvents,
  listParticipants,
  listSubscribedEvents,
} from '@/src/lib/api/campus';
import type { CampusEvent, Participant, UserRole } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';
import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificateSectionTitle,
  CertificateStatusPill,
  getPersonInitials,
} from './CertificateUi';

type StudentFilter = 'all' | 'available' | 'pending';

export default function CertificatesScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
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
      const authenticatedUserId = Number(session.payload.sub);
      setCurrentUserId(Number.isFinite(authenticatedUserId) ? authenticatedUserId : null);

      if (session.payload.role === 'student') {
        const subscribedEvents = await listSubscribedEvents();
        // Mostra os eventos em que o aluno está inscrito e que oferecem certificado.
        const certificateEvents = subscribedEvents
          .filter((event) => event.has_certificate !== false)
          .sort((left, right) =>
            new Date(right.event_datetime).getTime() - new Date(left.event_datetime).getTime(),
          );
        setEvents(certificateEvents);
        return;
      }

      // O painel lista os eventos; a API valida a permissão ao consultar participantes.
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

      // A emissão ainda não está disponível; nenhum evento deve aparecer como certificado publicado.
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
          <AppPageHeader title="Meus certificados" subtitle="Comprovantes de participação e certificados" />

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#8B9199" />
            <TextInput
              onChangeText={setStudentSearch}
              placeholder="Buscar certificado"
              placeholderTextColor="#9AA0A8"
              style={styles.searchInput}
              value={studentSearch}
            />
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

  const certificateEvents = events.filter((event) => event.has_certificate === true);
  const configuredCertificateEventCount = certificateEvents.length;
  const certificateRegistrations = certificateEvents.reduce(
    (total, event) => total + (typeof event.subscribers_count === 'number' ? event.subscribers_count : 0),
    0,
  );

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
        <AppPageHeader title="Certificados por evento" subtitle="Comprovantes de participação e certificados" />

        <View style={styles.metricsRow}>
          <MetricCard value={String(configuredCertificateEventCount)} label="eventos com certificado" />
          <MetricCard value={String(certificateRegistrations)} label="inscrições nesses eventos" />
        </View>
        <Text style={styles.emissionNote}>
          A emissão e o download dos certificados ainda não estão disponíveis.
        </Text>

        <CertificateSectionTitle
          title="Eventos cadastrados"
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
            canViewParticipants={role === 'admin'
              ? true
              : currentUserId !== null && typeof event.user_id === 'number'
                ? currentUserId === event.user_id
                : null}
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
    <AppCard padding={14} style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </AppCard>
  );
}

function TeacherEventCard({
  event,
  canViewParticipants,
  onManage,
  onConfigure,
}: {
  event: CampusEvent;
  canViewParticipants: boolean | null;
  onManage: () => void;
  onConfigure: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [hasLoadedParticipants, setHasLoadedParticipants] = useState(false);
  const participantCount = event.subscribers_count;

  const loadParticipants = useCallback(async () => {
    setIsLoadingParticipants(true);
    setParticipantsError(null);
    setPermissionDenied(false);
    try {
      const result = await listParticipants(event.id);
      setParticipants(result);
      setHasLoadedParticipants(true);
    } catch (loadError) {
      setParticipants([]);
      setHasLoadedParticipants(false);
      if (isPermissionDeniedError(loadError)) {
        setPermissionDenied(true);
        setParticipantsError('Somente o professor responsável pelo evento ou um administrador pode consultar os participantes.');
      } else {
        setParticipantsError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível consultar os participantes deste evento. Tente novamente.',
        );
      }
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [event.id]);

  const handleExpand = useCallback(() => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (!nextExpanded || hasLoadedParticipants || isLoadingParticipants) return;
    if (canViewParticipants === false) {
      setPermissionDenied(true);
      return;
    }
    void loadParticipants();
  }, [canViewParticipants, expanded, hasLoadedParticipants, isLoadingParticipants, loadParticipants]);

  const progress = event.max_participants && typeof participantCount === 'number'
    ? Math.min(participantCount / event.max_participants, 1)
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
            label={event.has_certificate === true ? 'Configurado' : 'Não configurado'}
            tone={event.has_certificate === true ? 'success' : 'neutral'}
          />
        </View>
        <View style={styles.eventMetadata}>
          <MetaItem icon="schedule" label={formatTime(event.event_datetime)} />
          <MetaItem icon="groups" label={`${participantCount ?? '—'} inscritos`} />
          {typeof event.workload_hours === 'number' ? (
            <MetaItem icon="timer" label={`${event.workload_hours} horas`} />
          ) : null}
        </View>
        {progress !== null ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Inscrições registradas</Text>
              <Text style={styles.progressValue}>{participantCount} de {event.max_participants}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        ) : null}
        <View style={styles.expandHintRow}>
          <Text style={styles.expandHint}>{expanded ? 'Ocultar participantes' : 'Ver participantes'}</Text>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#616873" />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedPanel}>
          <View style={styles.panelDivider} />
          <CertificateSectionTitle
            title="Participantes inscritos"
            subtitle={hasLoadedParticipants ? `${participants.length} alunos` : `${participantCount ?? 0} inscrições registradas`}
          />
          {isLoadingParticipants ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#B08D00" />
              <Text style={styles.inlineLoadingText}>Consultando participantes...</Text>
            </View>
          ) : null}
          {permissionDenied || canViewParticipants === false ? (
            <CertificateInfoBanner
              title="Lista de participantes restrita"
              message="A lista completa fica disponível para o professor responsável pelo evento e para a administração."
              tone="info"
            />
          ) : participantsError ? (
            <CertificateInfoBanner
              title="Não foi possível carregar os participantes"
              message={participantsError}
              tone="warning"
            />
          ) : null}
          {!isLoadingParticipants && !participantsError && hasLoadedParticipants && participants.length === 0 ? (
            <Text style={styles.noSubscribers}>Nenhum aluno inscrito neste evento.</Text>
          ) : null}
          {!isLoadingParticipants && !participantsError
            ? participants.map((participant) => (
                <ParticipantPreview key={participant.user_id} participant={participant} />
              ))
            : null}
          {!permissionDenied && canViewParticipants !== false ? (
            <View style={styles.eventActions}>
              <AppButton
                label="Ver inscritos"
                accessibilityLabel="Gerenciar participantes inscritos"
                variant="primary"
                size="sm"
                equalWidth
                icon={<MaterialIcons name="groups" size={15} color={colors.text.primary} />}
                onPress={onManage}
              />
              <AppButton
                label={event.has_certificate === true ? 'Configurar' : 'Habilitar'}
                variant="outline"
                size="sm"
                equalWidth
                icon={<MaterialIcons name="card-membership" size={15} color={colors.text.heading} />}
                onPress={onConfigure}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ParticipantPreview({ participant }: { participant: Participant }) {
  const fullName = `${participant.name} ${participant.last_name}`.trim();
  return (
    <View style={styles.subscriberPreview}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getPersonInitials(participant.name, participant.last_name)}</Text>
      </View>
      <View style={styles.subscriberIdentity}>
        <Text numberOfLines={1} style={styles.subscriberName}>{fullName}</Text>
        <Text style={styles.subscriberRa}>{participant.ra ? `RA ${participant.ra}` : 'RA não informado'}</Text>
      </View>
      <CertificateStatusPill label={participant.attended ? 'Presente' : 'Pendente'} tone={participant.attended ? 'success' : 'warning'} />
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
          <MaterialIcons name="workspace-premium" size={19} color={colors.text.primary} />
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
          <MaterialIcons name="arrow-forward" size={15} color={colors.text.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <AppFilterChip label={label} selected={selected} onPress={onPress} />;
}

function MetaItem({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.eventMetaItem}>
      <MaterialIcons name={icon} size={14} color={colors.text.muted} />
      <Text numberOfLines={1} style={styles.eventMetaText}>{label}</Text>
    </View>
  );
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorNotice}>
      <MaterialIcons name="error-outline" size={21} color={colors.status.danger} />
      <Text style={styles.errorText}>{message}</Text>
      <AppButton label="Tentar novamente" variant="outline" size="md" onPress={onRetry} style={styles.retryButton} />
    </View>
  );
}

function EmptyState({ icon, title, message }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; message: string }) {
  return (
    <AppEmptyState
      icon={<MaterialIcons name={icon} size={23} color={colors.text.muted} />}
      title={title}
      description={message}
      style={styles.emptyState}
    />
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
  safeArea: { ...appLayoutStyles.screen, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', paddingVertical: 20 },
  loadingText: { color: CERTIFICATE_COLORS.muted, fontSize: 12 },
  content: { ...appLayoutStyles.content, paddingBottom: 40 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 10, marginTop: 8 },
  metricCard: { ...appSurfaceStyles.card, flex: 1, minHeight: 82, padding: 14 },
  metricValue: { color: colors.text.heading, fontSize: 22, fontWeight: '700' },
  metricLabel: { color: colors.text.secondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  metricHelper: { color: colors.text.muted, fontSize: 11, marginTop: 3 },
  emissionNote: { color: colors.text.muted, fontSize: 11, lineHeight: 16, marginBottom: 18 },
  eventCard: { ...appSurfaceStyles.card, marginBottom: 12, overflow: 'hidden' },
  eventCardHeader: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13 },
  eventTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  eventTitleWrap: { flex: 1, gap: 4 },
  eventTitle: { color: colors.text.heading, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  eventDate: { color: colors.text.muted, fontSize: 11, lineHeight: 16 },
  eventMetadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  eventMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: '48%' },
  eventMetaText: { color: colors.text.secondary, fontSize: 11 },
  progressBlock: { marginTop: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: colors.text.secondary, fontSize: 11 },
  progressValue: { color: colors.brand.emphasis, fontSize: 11, fontWeight: '600' },
  progressTrack: { backgroundColor: colors.surface.subtle, borderRadius: 5, height: 6, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.brand.primary, borderRadius: 5, height: 6 },
  expandHintRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  expandHint: { color: colors.text.secondary, fontSize: 11, fontWeight: '600' },
  expandedPanel: { paddingHorizontal: 16, paddingBottom: 16 },
  panelDivider: { backgroundColor: colors.border.default, height: 1, marginBottom: 14 },
  inlineLoading: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 14 },
  inlineLoadingText: { color: colors.text.secondary, fontSize: 11 },
  noSubscribers: { color: colors.text.muted, fontSize: 12, paddingVertical: 12 },
  subscriberPreview: { alignItems: 'center', borderBottomColor: colors.border.default, borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 10 },
  avatar: { alignItems: 'center', backgroundColor: colors.brand.primary, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: colors.text.primary, fontSize: 11, fontWeight: '700' },
  subscriberIdentity: { flex: 1, gap: 3 },
  subscriberName: { color: colors.text.heading, fontSize: 12, fontWeight: '600' },
  subscriberRa: { color: colors.text.muted, fontSize: 11 },
  eventActions: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginTop: 16 },
  pressed: { opacity: 0.82 },
  errorNotice: { alignItems: 'center', backgroundColor: colors.status.warningSoft, borderColor: colors.border.default, borderRadius: 12, borderWidth: 1, marginBottom: 14, padding: 16 },
  errorText: { color: colors.status.warning, fontSize: 11, lineHeight: 16, marginTop: 8, textAlign: 'center' },
  retryButton: { alignSelf: 'center', marginTop: 12 },
  emptyState: { ...appSurfaceStyles.card, marginTop: 12 },
  searchBox: { ...appSurfaceStyles.input, alignItems: 'center', flexDirection: 'row', gap: 8, height: 48, minHeight: 48, marginTop: 16 },
  searchInput: { color: colors.text.heading, flex: 1, fontSize: 14, height: '100%' },
  filterRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: 12 },
  studentCard: { ...appSurfaceStyles.card, marginBottom: 12, padding: 16 },
  studentCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  studentCardIcon: { alignItems: 'center', backgroundColor: colors.brand.soft, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  studentEventName: { color: colors.text.heading, fontSize: 14, fontWeight: '600', marginTop: 12 },
  studentMetadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  studentMetadataText: { color: colors.text.secondary, fontSize: 11 },
  studentCardFooter: { alignItems: 'center', borderTopColor: colors.border.default, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10 },
  studentDate: { color: colors.text.muted, fontSize: 11 },
  studentCardLinkRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  studentCardLink: { color: colors.text.heading, fontSize: 12, fontWeight: '600' },
});
