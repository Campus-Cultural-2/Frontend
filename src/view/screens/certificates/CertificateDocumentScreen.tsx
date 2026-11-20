import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUser, getEvent, isAuthSessionError } from '@/src/lib/api/campus';
import type { CampusEvent, CurrentUser } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';

import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificateScreenHeading,
  CertificateSecondaryButton,
  CertificateStatusPill,
} from './CertificateUi';

export default function CertificateDocumentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = readId(params.eventId);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [student, setStudent] = useState<CurrentUser | null>(null);
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
      const eventData = await getEvent(eventId);
      setEvent(eventData);
      try {
        const currentStudent = await getCurrentUser();
        setStudent(currentStudent);
      } catch {
        setStudent(null);
      }
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o certificado.');
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

  const studentName = student ? `${student.name} ${student.last_name}`.trim() : 'Nome do participante';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CertificateScreenHeading title="Meu certificado" subtitle="Acompanhe a liberação do seu certificado" onBack={() => router.back()} />

        {error || !event ? (
          <CertificateInfoBanner title="Não foi possível abrir o documento" message={error ?? 'Evento não encontrado.'} tone="warning" />
        ) : (
          <>
            <View style={styles.documentPreview}>
              <View style={styles.documentHeader}>
                <View style={styles.brandRow}>
                  <View style={styles.brandStripe} />
                  <Text style={styles.brand}>CAMPUS CULTURAL</Text>
                </View>
                <CertificateStatusPill label="Pendente" tone="warning" />
              </View>
              <View style={styles.documentCenter}>
                <Text style={styles.documentEyebrow}>CERTIFICADO DE PARTICIPAÇÃO</Text>
                <Text style={styles.studentName}>{studentName.toLocaleUpperCase('pt-BR')}</Text>
                <Text style={styles.documentText}>Participação no evento</Text>
                <Text style={styles.eventName}>{event.name}</Text>
                <Text style={styles.workload}>{event.workload_hours ?? '—'} horas</Text>
              </View>
              <View style={styles.notIssuedStamp}>
                <MaterialIcons name="schedule" size={18} color="#95610A" />
                <Text style={styles.notIssuedText}>DOCUMENTO AINDA NÃO EMITIDO</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsTitle}>Detalhes</Text>
                <CertificateStatusPill label="Pendente" tone="warning" />
              </View>
              <Text style={styles.detailDescription}>{formatHoursGroup(event.hours_group)}</Text>
              <Text style={styles.detailDate}>{formatDate(event.event_datetime)}</Text>
            </View>

            <CertificateInfoBanner
              title="Certificado ainda não publicado"
              message="O backend atual não disponibiliza o documento PDF nem as operações de envio por e-mail. Assim que o responsável emitir e publicar o certificado, essas ações poderão ser habilitadas."
              tone="warning"
            />

            <View style={styles.buttonRow}>
              <View style={styles.buttonFlex}>
                <CertificateSecondaryButton label="Baixar PDF" onPress={() => undefined} disabled icon="download" />
              </View>
              <View style={styles.buttonFlex}>
                <CertificateSecondaryButton label="Enviar por e-mail" onPress={() => undefined} disabled icon="mail-outline" />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function formatHoursGroup(value: CampusEvent['hours_group']) {
  if (value === 'group_1') return 'Atividades de formação social, humana e cultural';
  if (value === 'group_2') return 'Atividades comunitárias e de interesse coletivo';
  if (value === 'group_3') return 'Iniciação científica e formação profissional';
  return 'Atividades acadêmicas';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '');
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CERTIFICATE_COLORS.background, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 32, paddingHorizontal: 18, paddingTop: 15 },
  documentPreview: { backgroundColor: '#FFFFFF', borderColor: CERTIFICATE_COLORS.primary, borderRadius: 10, borderWidth: 2, marginBottom: 13, minHeight: 300, padding: 14 },
  documentHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  brandStripe: { backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 2, height: 15, width: 4 },
  brand: { color: '#22262B', fontSize: 9, fontWeight: '900' },
  documentCenter: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 38 },
  documentEyebrow: { color: '#9298A0', fontSize: 8, letterSpacing: 1.1 },
  studentName: { color: '#262B30', fontSize: 15, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  documentText: { color: '#666E77', fontSize: 9, marginTop: 10 },
  eventName: { color: '#30343A', fontSize: 12, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  workload: { color: '#777F88', fontSize: 9, marginTop: 7 },
  notIssuedStamp: { alignItems: 'center', backgroundColor: '#FFF1D1', borderRadius: 7, flexDirection: 'row', gap: 7, justifyContent: 'center', padding: 9 },
  notIssuedText: { color: '#8B6512', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  detailsCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 10, borderWidth: 1, marginBottom: 13, padding: 13 },
  detailsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  detailsTitle: { color: '#343A40', fontSize: 12, fontWeight: '900' },
  detailDescription: { color: '#7B838C', fontSize: 9, marginTop: 10 },
  detailDate: { color: '#7B838C', fontSize: 9, marginTop: 5 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  buttonFlex: { flex: 1 },
});
