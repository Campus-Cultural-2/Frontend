import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { AppButton, AppEmptyState, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import {
  getEvent,
  getValidAuthSession,
  isAuthSessionError,
  isPermissionDeniedError,
  listParticipants,
} from '@/src/lib/api/campus';
import type { CampusEvent, Participant } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';
import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificateScreenHeading,
  CertificateStatusPill,
  formatSubscriptionDate,
  getPersonInitials,
} from './CertificateUi';

type ParticipantFilter = 'all' | 'present' | 'pending';

export default function CertificateParticipantsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = readId(params.eventId);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ParticipantFilter>('all');
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedParticipants, setHasLoadedParticipants] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    if (!eventId) return;

    setIsLoadingParticipants(true);
    setParticipantsError(null);
    setPermissionDenied(false);

    try {
      const data = await listParticipants(eventId);
      setParticipants(data);
      setHasLoadedParticipants(true);
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      setParticipants([]);
      setHasLoadedParticipants(false);
      if (isPermissionDeniedError(loadError)) {
        setPermissionDenied(true);
        setParticipantsError(
          'Somente o professor responsável pelo evento ou um administrador pode consultar os participantes.',
        );
      } else {
        setParticipantsError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os participantes deste evento. Tente novamente.',
        );
      }
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [eventId, router]);

  const loadData = useCallback(async (refreshing = false) => {
    if (!eventId) {
      setEventError('Evento inválido. Volte ao painel e selecione um evento.');
      setIsLoadingEvent(false);
      return;
    }

    if (refreshing) setIsRefreshing(true);
    else setIsLoadingEvent(true);
    setEventError(null);

    try {
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)/(main)/certificados' as never);
        return;
      }

      const eventData = await getEvent(eventId);
      setEvent(eventData);

      // Evita iniciar uma consulta que a API recusará para professores de outros eventos.
      const currentUserId = Number(session.payload.sub);
      if (
        session.payload.role === 'professor' &&
        Number.isFinite(currentUserId) &&
        typeof eventData.user_id === 'number' &&
        eventData.user_id !== currentUserId
      ) {
        setPermissionDenied(true);
        setParticipantsError(
          'Somente o professor responsável pelo evento ou um administrador pode consultar os participantes.',
        );
        setParticipants([]);
        setHasLoadedParticipants(false);
        return;
      }

      await loadParticipants();
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      setEventError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os dados deste evento. Tente novamente.',
      );
    } finally {
      setIsLoadingEvent(false);
      setIsRefreshing(false);
    }
  }, [eventId, loadParticipants, router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const filteredParticipants = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');

    return participants.filter((participant) => {
      const fullName = `${participant.name} ${participant.last_name}`.toLocaleLowerCase('pt-BR');
      const matchesSearch =
        normalized.length === 0 ||
        fullName.includes(normalized) ||
        (participant.ra ?? '').toLocaleLowerCase('pt-BR').includes(normalized);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'present' && participant.attended) ||
        (filter === 'pending' && !participant.attended);

      return matchesSearch && matchesFilter;
    });
  }, [filter, participants, search]);

  const presentCount = participants.filter((participant) => participant.attended).length;
  const attendanceMode = event?.attendance_mode ?? 'none';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[CERTIFICATE_COLORS.primary]}
            onRefresh={() => void loadData(true)}
            refreshing={isRefreshing}
            tintColor={CERTIFICATE_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        <CertificateScreenHeading
          title="Participantes"
          subtitle={event ? `${event.name} · ${event.subscribers_count ?? participants.length} inscritos` : 'Consulte os alunos inscritos'}
          onBack={() => router.back()}
        />

        {isLoadingEvent && !event ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={CERTIFICATE_COLORS.primary} size="small" />
            <Text style={styles.loadingText}>Verificando acesso ao evento...</Text>
          </View>
        ) : null}

        {eventError ? (
          <CertificateInfoBanner title="Não foi possível carregar o evento" message={eventError} tone="error" />
        ) : null}

        {event ? (
          <>
            <View style={styles.eventSummary}>
              <Text style={styles.eventName}>{event.name}</Text>
              <View style={styles.eventSummaryMeta}>
                <Text style={styles.eventMetaText}>{event.subscribers_count ?? participants.length} inscritos</Text>
                {typeof event.workload_hours === 'number' ? (
                  <Text style={styles.eventMetaText}>{event.workload_hours} horas</Text>
                ) : null}
              </View>
            </View>

            {permissionDenied ? (
              <CertificateInfoBanner
                title="Acesso restrito"
                message="Somente o professor responsável pelo evento ou um administrador pode consultar os participantes."
                tone="info"
              />
            ) : (
              <>
                <View style={styles.searchBox}>
                  <MaterialIcons name="search" size={20} color={colors.text.muted} />
                  <TextInput
                    onChangeText={setSearch}
                    placeholder="Buscar por nome ou RA"
                    placeholderTextColor="#9AA0A8"
                    style={styles.searchInput}
                    value={search}
                  />
                  {search.length > 0 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearch('')}>
                      <MaterialIcons name="close" size={18} color={colors.text.muted} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.filterRow}>
                  <FilterChip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
                  <FilterChip label="Presentes" selected={filter === 'present'} onPress={() => setFilter('present')} />
                  <FilterChip label="Pendentes" selected={filter === 'pending'} onPress={() => setFilter('pending')} />
                </View>

                {!isLoadingParticipants && hasLoadedParticipants ? (
                  <View style={styles.countBanner}>
                    <View>
                      <Text style={styles.countBannerText}>{participants.length} participantes inscritos</Text>
                      <Text style={styles.countBannerDetail}>{presentCount} presentes · {participants.length - presentCount} pendentes</Text>
                    </View>
                    <MaterialIcons name="groups" size={20} color="#7F6A1A" />
                  </View>
                ) : null}

                {participantsError ? (
                  <CertificateInfoBanner
                    title="Não foi possível carregar os participantes"
                    message={participantsError}
                    tone="warning"
                  />
                ) : null}

                {isLoadingParticipants ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={CERTIFICATE_COLORS.primary} />
                    <Text style={styles.loadingText}>Carregando participantes...</Text>
                  </View>
                ) : null}

                {!isLoadingParticipants && !participantsError && hasLoadedParticipants && filteredParticipants.length === 0 ? (
                  <AppEmptyState
                    icon={<MaterialIcons name="person-search" size={27} color={colors.text.muted} />}
                    title={search
                      ? 'Nenhum resultado encontrado'
                      : filter === 'present'
                        ? 'Nenhum participante presente'
                        : filter === 'pending'
                          ? 'Nenhum participante pendente'
                          : 'Nenhum aluno inscrito'}
                    description={search
                      ? 'Tente pesquisar por outro nome ou RA.'
                      : 'Os alunos inscritos neste evento aparecerão aqui.'}
                    style={styles.emptyCard}
                  />
                ) : null}

                {!participantsError
                  ? filteredParticipants.map((participant) => (
                      <ParticipantCard
                        attendanceMode={attendanceMode}
                        key={participant.user_id}
                        participant={participant}
                      />
                    ))
                  : null}

                {hasLoadedParticipants ? (
                  <CertificateInfoBanner
                    title="Registro de presença"
                    message={getAttendanceModeDescription(attendanceMode)}
                    tone="info"
                  />
                ) : null}

                <AppButton
                  label={event.has_certificate === true ? 'Configurar certificado' : 'Habilitar certificado'}
                  variant="primary"
                  size="md"
                  fullWidth
                  icon={<MaterialIcons name="arrow-forward" size={17} color={colors.text.primary} />}
                  onPress={() => router.push({ pathname: '/certificados-configurar', params: { eventId: String(event.id) } } as never)}
                />

                {participantsError ? (
                  <AppButton
                    label="Tentar carregar os participantes novamente"
                    variant="outline"
                    size="md"
                    onPress={() => void loadParticipants()}
                    style={styles.retryLink}
                  />
                ) : null}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ParticipantCard({
  participant,
  attendanceMode,
}: {
  participant: Participant;
  attendanceMode: CampusEvent['attendance_mode'];
}) {
  const fullName = `${participant.name} ${participant.last_name}`.trim();
  const automaticPresence = attendanceMode === 'none' && participant.attended;
  const statusLabel = participant.attended
    ? automaticPresence
      ? 'Presença automática'
      : 'Presente'
    : 'Pendente';

  return (
    <View style={styles.participantCard}>
      <View style={styles.participantTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getPersonInitials(participant.name, participant.last_name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text numberOfLines={2} style={styles.participantName}>{fullName}</Text>
          <Text style={styles.participantRa}>{participant.ra ? `RA ${participant.ra}` : 'RA não informado'}</Text>
        </View>
        <CertificateStatusPill
          label={statusLabel}
          tone={participant.attended ? 'success' : 'warning'}
        />
      </View>
      <View style={styles.participantMeta}>
        <Text style={styles.presenceDetail}>
          {participant.checked_in_at
            ? `Presença confirmada em ${formatSubscriptionDate(participant.checked_in_at)}`
            : automaticPresence
              ? 'Todos os inscritos são considerados presentes neste evento.'
              : 'A presença ainda não foi confirmada.'}
        </Text>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.filterChipPressed,
      ]}>
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function getAttendanceModeDescription(mode: CampusEvent['attendance_mode']) {
  if (mode === 'professor') {
    return 'O professor responsável registra a presença durante o evento, manualmente ou lendo o QR Code do aluno.';
  }
  if (mode === 'student') {
    return 'Cada aluno confirma a própria presença usando o código ou QR Code apresentado pelo professor.';
  }
  return 'Este evento não exige confirmação individual: todos os alunos inscritos são considerados presentes.';
}

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen, flex: 1 },
  content: {
    ...appLayoutStyles.content, paddingBottom: 36 },
  eventSummary: { ...appSurfaceStyles.card, marginBottom: 14, padding: 16 },
  eventName: { color: colors.text.heading, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  eventSummaryMeta: { flexDirection: 'row', gap: 13, marginTop: 8 },
  eventMetaText: { color: colors.text.muted, fontSize: 11 },
  searchBox: { ...appSurfaceStyles.input, alignItems: 'center', flexDirection: 'row', gap: 9, height: 48, minHeight: 48 },
  searchInput: { color: colors.text.heading, flex: 1, fontSize: 13, height: '100%' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: 12 },
  filterChip: { backgroundColor: colors.neutral.white, borderColor: colors.border.default, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  filterChipSelected: { backgroundColor: CERTIFICATE_COLORS.primary, borderColor: CERTIFICATE_COLORS.primary },
  filterChipPressed: { opacity: 0.75 },
  filterText: { color: '#59616A', fontSize: 11, fontWeight: '700' },
  filterTextSelected: { color: colors.text.primary, fontWeight: '700' },
  countBanner: { alignItems: 'center', backgroundColor: '#FFF5C7', borderRadius: 9, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 13, paddingVertical: 11 },
  countBannerText: { color: '#5D511F', fontSize: 12, fontWeight: '700' },
  countBannerDetail: { color: '#77672A', fontSize: 10, marginTop: 3 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', paddingVertical: 24 },
  loadingText: { color: '#727A84', fontSize: 12 },
  participantCard: { ...appSurfaceStyles.card, marginBottom: 10, padding: 14 },
  participantTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  avatar: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  avatarText: { color: colors.text.primary, fontSize: 12, fontWeight: '900' },
  identity: { flex: 1, gap: 4 },
  participantName: { color: colors.text.heading, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  participantRa: { color: colors.text.muted, fontSize: 11 },
  participantMeta: { borderTopColor: colors.border.default, borderTopWidth: 1, marginTop: 11, paddingTop: 9 },
  presenceDetail: { color: '#707982', fontSize: 11, lineHeight: 16 },
  emptyCard: { ...appSurfaceStyles.card, marginTop: 8 },
  retryLink: { alignSelf: 'center', marginTop: 8 },
  retryText: { color: '#6C5600', fontSize: 11, fontWeight: '800' },
});
