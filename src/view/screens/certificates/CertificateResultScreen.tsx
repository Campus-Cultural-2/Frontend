import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getEvent, getValidAuthSession, isAuthSessionError } from '@/src/lib/api/campus';
import type { CampusEvent } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';

import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificatePrimaryButton,
  CertificateScreenHeading,
  CertificateSecondaryButton,
  CertificateStatusPill,
} from './CertificateUi';

export default function CertificateResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = readId(params.eventId);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) {
      setError('Evento inválido. Volte e selecione um evento.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)/certificados' as never);
        return;
      }
      // A tela de revisão utiliza a quantidade já retornada por GET /events.
      // Não depende da lista nominal de inscritos nem bloqueia a navegação por ela.
      const eventData = await getEvent(eventId);
      setEvent(eventData);
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o resumo.');
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
          title="Revisão da emissão"
          subtitle="Confira o resumo antes de concluir a emissão"
          onBack={() => router.back()}
        />

        {error || !event ? (
          <CertificateInfoBanner title="Não foi possível carregar o resumo" message={error ?? 'Evento não encontrado.'} tone="warning" />
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusIcon}>
                <MaterialIcons name="workspace-premium" size={27} color="#916B0C" />
              </View>
              <CertificateStatusPill label="Aguardando emissão" tone="warning" />
              <Text style={styles.statusTitle}>Configuração revisada</Text>
              <Text style={styles.statusDescription}>
                Os dados do evento estão prontos para a etapa de emissão. Nenhum certificado foi gerado ainda.
              </Text>
            </View>

            <View style={styles.eventSummaryCard}>
              <View style={styles.eventSummaryTop}>
                <Text style={styles.eventName}>{event.name}</Text>
                <MaterialIcons name="card-membership" size={20} color="#7C838B" />
              </View>
              <View style={styles.eventSummaryBottom}>
                <Text style={styles.summaryItem}>{event.workload_hours ?? '—'} horas</Text>
                <Text style={styles.summaryItem}>{formatHoursGroup(event.hours_group)}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <Metric value={String(event.subscribers_count ?? '—')} label="inscritos" />
              <Metric value="—" label="elegíveis" />
              <Metric value="0" label="emitidos" />
            </View>

            <CertificateInfoBanner
              title="Falta a operação de emissão no backend"
              message="A API atual não gera os documentos nem registra uma emissão. Por isso, esta tela confirma somente a revisão dos dados; publicação e envio por e-mail continuam indisponíveis."
              tone="warning"
            />

            <View style={styles.actions}>
              <CertificatePrimaryButton label="Publicar certificados" onPress={() => undefined} disabled icon="publish" />
              <CertificateSecondaryButton label="Enviar por e-mail" onPress={() => undefined} disabled icon="mail-outline" />
            </View>
          </>
        )}

        <CertificateSecondaryButton
          label="Voltar aos participantes"
          onPress={() => router.replace({ pathname: '/certificados-participantes', params: { eventId: String(eventId ?? '') } } as never)}
          icon="arrow-back"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function formatHoursGroup(value: CampusEvent['hours_group']) {
  if (value === 'group_1') return 'Grupo 1 · Formação social e humana';
  if (value === 'group_2') return 'Grupo 2 · Interesse coletivo';
  if (value === 'group_3') return 'Grupo 3 · Formação profissional';
  return 'Grupo não informado';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CERTIFICATE_COLORS.background, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 32, paddingHorizontal: 18, paddingTop: 15 },
  statusCard: { alignItems: 'center', backgroundColor: '#EAF5EF', borderRadius: 12, marginBottom: 13, paddingHorizontal: 20, paddingVertical: 22 },
  statusIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 23, height: 46, justifyContent: 'center', marginBottom: 10, width: 46 },
  statusTitle: { color: '#24734F', fontSize: 17, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  statusDescription: { color: '#4F7663', fontSize: 10, lineHeight: 16, marginTop: 6, textAlign: 'center' },
  eventSummaryCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 10, borderWidth: 1, marginBottom: 12, padding: 13 },
  eventSummaryTop: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  eventName: { color: '#333940', flex: 1, fontSize: 12, fontWeight: '900' },
  eventSummaryBottom: { borderTopColor: '#ECEDEF', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 11, paddingTop: 9 },
  summaryItem: { color: '#757D86', fontSize: 9 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metricCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 9, borderWidth: 1, flex: 1, paddingVertical: 12 },
  metricValue: { color: '#30343A', fontSize: 18, fontWeight: '900' },
  metricLabel: { color: '#7B838C', fontSize: 9, marginTop: 3 },
  actions: { gap: 8, marginBottom: 12 },
});
