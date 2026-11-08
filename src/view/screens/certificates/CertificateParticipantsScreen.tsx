import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
  getEvent,
  getValidAuthSession,
  isAuthSessionError,
  listEventSubscribers,
} from '@/src/lib/api/campus';
import type { CampusEvent, EventSubscriber } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';

import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificatePrimaryButton,
  CertificateScreenHeading,
  CertificateStatusPill,
  formatSubscriptionDate,
  getPersonInitials,
} from './CertificateUi';

export default function CertificateParticipantsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = readId(params.eventId);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [participants, setParticipants] = useState<EventSubscriber[]>([]);
  const [search, setSearch] = useState('');
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    if (!eventId) return;
    setIsLoadingParticipants(true);
    setParticipantsError(null);
    try {
      const data = await listEventSubscribers(eventId);
      setParticipants(data.filter((item) => item.role === 'student'));
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      setParticipants([]);
      setParticipantsError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os participantes deste evento.',
      );
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
        router.replace('/(tabs)/certificados' as never);
        return;
      }

      // Carrega os dados do evento independentemente da disponibilidade da rota
      // de inscritos. Assim, uma falha na lista não bloqueia a configuração.
      const eventData = await getEvent(eventId);
      setEvent(eventData);
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
          : 'Não foi possível carregar os dados do evento.',
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

  const permissionDenied = participantsError?.startsWith('403:') ?? false;

  const filteredParticipants = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return participants;
    return participants.filter((participant) => {
      const fullName = `${participant.name} ${participant.last_name ?? ''}`.toLocaleLowerCase('pt-BR');
      return (
        fullName.includes(normalized) ||
        (participant.ra ?? '').toLocaleLowerCase('pt-BR').includes(normalized) ||
        participant.email.toLocaleLowerCase('pt-BR').includes(normalized)
      );
    });
  }, [participants, search]);

  if (isLoadingEvent && !event) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={CERTIFICATE_COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

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

        {eventError ? (
          <CertificateInfoBanner title="Não foi possível carregar o evento" message={eventError} tone="error" />
        ) : null}

        {event ? (
          <>
            <View style={styles.eventSummary}>
              <Text style={styles.eventName}>{event.name}</Text>
              <View style={styles.eventSummaryMeta}>
                <Text style={styles.eventMetaText}>{event.subscribers_count ?? participants.length} inscritos</Text>
                {typeof event.workload_hours === 'number' ? <Text style={styles.eventMetaText}>{event.workload_hours} horas</Text> : null}
              </View>
            </View>

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={19} color="#89919A" />
              <TextInput
                onChangeText={setSearch}
                placeholder="Buscar participante"
                placeholderTextColor="#9AA0A8"
                style={styles.searchInput}
                value={search}
              />
              <MaterialIcons name="tune" size={18} color="#89919A" />
            </View>

            <View style={styles.filterRow}>
              <FilterChip label="Todos" selected disabled={false} />
              <FilterChip label="Presentes" disabled selected={false} />
              <FilterChip label="Elegíveis" disabled selected={false} />
            </View>

            <View style={styles.countBanner}>
              <Text style={styles.countBannerText}>
                {participantsError ? `${event.subscribers_count ?? '—'} inscritos registrados` : `${participants.length} alunos encontrados`}
              </Text>
              <MaterialIcons name="groups" size={17} color="#7F6A1A" />
            </View>

            {participantsError ? (
              <CertificateInfoBanner
                title="Não foi possível obter os nomes dos inscritos"
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

            {!isLoadingParticipants && !participantsError && filteredParticipants.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="person-search" size={25} color="#9298A0" />
                <Text style={styles.emptyTitle}>{search ? 'Nenhum resultado encontrado' : 'Nenhum aluno inscrito'}</Text>
                <Text style={styles.emptyDescription}>{search ? 'Tente pesquisar por outro nome, RA ou e-mail.' : 'Os alunos inscritos neste evento aparecerão aqui.'}</Text>
              </View>
            ) : null}

            {!participantsError
              ? filteredParticipants.map((participant) => (
                  <ParticipantCard key={participant.user_id} participant={participant} />
                ))
              : null}

            <CertificateInfoBanner
              title="Presença e elegibilidade"
              message="A API atual fornece a lista de inscritos, mas ainda não registra presença nem a elegibilidade individual. Por isso, esses dados aparecem como pendentes e não podem ser alterados ou salvos ainda."
              tone="info"
            />

            {!permissionDenied ? (
              <CertificatePrimaryButton
                label={event.has_certificate === true ? 'Configurar certificado' : 'Habilitar certificado'}
                onPress={() => router.push({ pathname: '/certificados-configurar', params: { eventId: String(event.id) } } as never)}
                icon="arrow-forward"
              />
            ) : null}
            {participantsError && !permissionDenied ? (
              <Pressable accessibilityRole="button" onPress={() => void loadParticipants()} style={styles.retryLink}>
                <Text style={styles.retryText}>Tentar carregar os participantes novamente</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ParticipantCard({ participant }: { participant: EventSubscriber }) {
  const fullName = `${participant.name} ${participant.last_name ?? ''}`.trim();
  return (
    <View style={styles.participantCard}>
      <View style={styles.participantTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getPersonInitials(participant.name, participant.last_name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.participantName}>{fullName}</Text>
          <Text style={styles.participantRa}>{participant.ra ? `RA ${participant.ra}` : 'RA não informado'}</Text>
        </View>
        <CertificateStatusPill label="Inscrito" tone="success" />
      </View>
      <View style={styles.participantMeta}>
        <Text style={styles.email}>{participant.email}</Text>
        <Text style={styles.subscribedDate}>Inscrito em {formatSubscriptionDate(participant.subscribed_at)}</Text>
      </View>
    </View>
  );
}

function FilterChip({ label, selected, disabled }: { label: string; selected: boolean; disabled: boolean }) {
  return (
    <View style={[styles.filterChip, selected && styles.filterChipSelected, disabled && styles.filterChipDisabled]}>
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </View>
  );
}

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CERTIFICATE_COLORS.background, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 35, paddingHorizontal: 18, paddingTop: 15 },
  eventSummary: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 9, borderWidth: 1, marginBottom: 12, padding: 12 },
  eventName: { color: '#343A40', fontSize: 12, fontWeight: '900' },
  eventSummaryMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  eventMetaText: { color: '#7B838C', fontSize: 9 },
  searchBox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 8, height: 42, paddingHorizontal: 11 },
  searchInput: { color: '#343A40', flex: 1, fontSize: 10, height: '100%' },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 12, marginTop: 10 },
  filterChip: { backgroundColor: '#FFFFFF', borderColor: '#E1E3E5', borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 },
  filterChipSelected: { backgroundColor: CERTIFICATE_COLORS.primary, borderColor: CERTIFICATE_COLORS.primary },
  filterChipDisabled: { opacity: 0.48 },
  filterText: { color: '#59616A', fontSize: 9, fontWeight: '700' },
  filterTextSelected: { color: '#171717', fontWeight: '900' },
  countBanner: { alignItems: 'center', backgroundColor: '#FFF2A6', borderRadius: 7, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 11, paddingVertical: 9 },
  countBannerText: { color: '#5D511F', fontSize: 9, fontWeight: '800' },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 22 },
  loadingText: { color: '#727A84', fontSize: 9 },
  participantCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 10, borderWidth: 1, marginBottom: 9, padding: 11 },
  participantTop: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  avatar: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: '#171717', fontSize: 10, fontWeight: '900' },
  identity: { flex: 1, gap: 3 },
  participantName: { color: '#343A40', fontSize: 10, fontWeight: '900' },
  participantRa: { color: '#858C94', fontSize: 8 },
  participantMeta: { borderTopColor: '#EEF0F1', borderTopWidth: 1, gap: 4, marginTop: 9, paddingLeft: 45, paddingTop: 8 },
  email: { color: '#707982', fontSize: 8 },
  subscribedDate: { color: '#9AA0A7', fontSize: 8 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 11, borderWidth: 1, marginTop: 10, padding: 25 },
  emptyTitle: { color: '#343A40', fontSize: 11, fontWeight: '900', marginTop: 9 },
  emptyDescription: { color: '#858C94', fontSize: 9, lineHeight: 14, marginTop: 5, textAlign: 'center' },
  retryLink: { alignSelf: 'center', padding: 12 },
  retryText: { color: '#6C5600', fontSize: 9, fontWeight: '800' },
});
