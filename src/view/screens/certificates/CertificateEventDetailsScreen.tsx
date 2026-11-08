import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getEvent, getValidAuthSession, isAuthSessionError, listSubscribedEvents } from '@/src/lib/api/campus';
import type { CampusEvent } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';

import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificateScreenHeading,
  CertificateSecondaryButton,
  CertificateStatusPill,
} from './CertificateUi';

export default function CertificateEventDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = readId(params.eventId);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) {
      setError('Evento inválido.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const session = await getValidAuthSession();
      const eventData = await getEvent(eventId);
      setEvent(eventData);

      if (session.payload.role === 'student') {
        try {
          const subscribedEvents = await listSubscribedEvents();
          setIsSubscribed(subscribedEvents.some((item) => item.id === eventId));
        } catch {
          // A falha ao consultar inscrições não deve impedir a leitura do evento.
          setIsSubscribed(false);
        }
      }
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o evento.');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={CERTIFICATE_COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CertificateScreenHeading
          title="Detalhe do evento"
          subtitle="Acompanhe sua inscrição e certificado"
          onBack={() => router.back()}
        />

        {error || !event ? (
          <CertificateInfoBanner title="Não foi possível abrir o evento" message={error ?? 'Evento não encontrado.'} tone="warning" />
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <CertificateStatusPill label={isSubscribed ? 'Inscrição confirmada' : 'Não inscrito'} tone={isSubscribed ? 'success' : 'neutral'} />
                <Text style={styles.heroDate}>{formatDate(event.event_datetime)}</Text>
              </View>
              <Text style={styles.heroTitle}>{event.name}</Text>
              <View style={styles.heroAccent} />
              {event.description ? <Text numberOfLines={4} style={styles.heroDescription}>{event.description}</Text> : null}
            </View>

            <View style={styles.detailsCard}>
              <DetailRow icon="schedule" label="Data e horário" value={`${formatDate(event.event_datetime)} · ${formatTime(event.event_datetime)}`} />
              {typeof event.workload_hours === 'number' ? (
                <DetailRow icon="timer" label="Carga horária" value={`${event.workload_hours} horas`} />
              ) : null}
              <DetailRow icon="place" label="Local" value={event.event_location} />
            </View>

            <View style={styles.certificateCard}>
              <View style={styles.certificateCardTop}>
                <View style={styles.certificateIcon}>
                  <MaterialIcons name="card-membership" size={20} color="#171717" />
                </View>
                <CertificateStatusPill label={event.has_certificate ? 'Previsto' : 'Não oferece'} tone={event.has_certificate ? 'warning' : 'neutral'} />
              </View>
              <Text style={styles.certificateTitle}>Seu certificado</Text>
              <Text style={styles.certificateDescription}>
                {event.has_certificate
                  ? 'O documento será disponibilizado depois que o responsável concluir a validação e a publicação dos certificados.'
                  : 'Este evento não foi cadastrado com emissão de certificado.'}
              </Text>
              {event.has_certificate ? (
                <Text style={styles.certificateFootnote}>A consulta de emissão e presença ainda não está disponível na API.</Text>
              ) : null}
            </View>

            <CertificateInfoBanner
              title={isSubscribed ? 'Inscrição confirmada' : 'Acompanhe sua inscrição pela Agenda'}
              message={isSubscribed
                ? 'Sua inscrição está registrada. As informações de presença e liberação do certificado serão exibidas quando o Campus Cultural disponibilizar essas funções.'
                : 'Este evento não aparece na sua lista de inscrições. Consulte a Agenda para verificar a disponibilidade de inscrição.'}
              tone={isSubscribed ? 'success' : 'info'}
            />
            {event.has_certificate === true ? (
              <CertificateSecondaryButton
                label="Acompanhar certificado"
                onPress={() => router.push({ pathname: '/certificado-detalhe', params: { eventId: String(event.id) } } as never)}
                icon="card-membership"
              />
            ) : null}
            <CertificateSecondaryButton
              label="Ver programação"
              onPress={() =>
                router.push({ pathname: '/calendario', params: { newEventDate: event.event_datetime } } as never)
              }
              icon="calendar-today"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <MaterialIcons name={icon} size={18} color="#737B84" />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '');
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CERTIFICATE_COLORS.background, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 30, paddingHorizontal: 18, paddingTop: 15 },
  heroCard: { backgroundColor: '#202124', borderRadius: 12, marginBottom: 12, padding: 16 },
  heroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroDate: { color: CERTIFICATE_COLORS.primary, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 24, marginTop: 28 },
  heroAccent: { backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 3, height: 4, marginTop: 9, width: 42 },
  heroDescription: { color: '#D0D2D4', fontSize: 10, lineHeight: 16, marginTop: 12 },
  detailsCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 10, borderWidth: 1, marginBottom: 12, paddingHorizontal: 13 },
  detailRow: { alignItems: 'center', borderBottomColor: '#EEF0F1', borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 13 },
  detailCopy: { flex: 1, gap: 3 },
  detailLabel: { color: '#8B929A', fontSize: 8 },
  detailValue: { color: '#343A40', fontSize: 10, fontWeight: '700' },
  certificateCard: { backgroundColor: '#FFF1D1', borderRadius: 10, marginBottom: 13, padding: 14 },
  certificateCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  certificateIcon: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
  certificateTitle: { color: '#493916', fontSize: 13, fontWeight: '900', marginTop: 10 },
  certificateDescription: { color: '#6F5B32', fontSize: 10, lineHeight: 15, marginTop: 5 },
  certificateFootnote: { color: '#927A4C', fontSize: 8, lineHeight: 12, marginTop: 7 },
});
