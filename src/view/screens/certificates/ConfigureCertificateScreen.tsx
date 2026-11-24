import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCurrentUser,
  getEvent,
  getValidAuthSession,
  isAuthSessionError,
  isPermissionDeniedError,
  updateEvent,
} from '@/src/lib/api/campus';
import type { CampusEvent, CurrentUser, HoursGroup } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';

import {
  CERTIFICATE_COLORS,
  CertificateInfoBanner,
  CertificatePrimaryButton,
  CertificateScreenHeading,
  CertificateStatusPill,
} from './CertificateUi';

const HOURS_GROUPS: { value: HoursGroup; label: string; shortLabel: string }[] = [
  { value: 'group_1', label: 'Formação social, humana e cultural', shortLabel: 'Grupo 1' },
  { value: 'group_2', label: 'Atividades comunitárias e coletivas', shortLabel: 'Grupo 2' },
  { value: 'group_3', label: 'Iniciação científica e formação profissional', shortLabel: 'Grupo 3' },
];

export default function ConfigureCertificateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = readId(params.eventId);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [responsible, setResponsible] = useState<CurrentUser | null>(null);
  const [workload, setWorkload] = useState('20');
  const [hoursGroup, setHoursGroup] = useState<HoursGroup>('group_1');
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) {
      setError('Evento inválido. Volte ao painel e selecione um evento.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPermissionDenied(false);
    try {
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)/certificados' as never);
        return;
      }

      const eventData = await getEvent(eventId);
      setEvent(eventData);
      setWorkload(String(eventData.workload_hours ?? 20));
      setHoursGroup(eventData.hours_group ?? 'group_1');

      // O nome do responsável é complementar. Se a consulta de perfil falhar,
      // a configuração e a navegação continuam disponíveis usando o nome alternativo.
      try {
        const currentUser = await getCurrentUser();
        setResponsible(currentUser);
      } catch {
        setResponsible(null);
      }
    } catch (loadError) {
      if (isAuthSessionError(loadError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      if (isPermissionDeniedError(loadError)) {
        setPermissionDenied(true);
        setError('Somente o professor responsável pelo evento ou um administrador pode consultar as configurações do certificado.');
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a configuração.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  async function enableCertificate() {
    if (!event) return;
    const hours = Number(workload);
    if (!Number.isInteger(hours) || hours <= 0) {
      setError('Informe uma carga horária inteira maior que zero.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setPermissionDenied(false);
    setSuccess(null);
    try {
      const updated = await updateEvent(event.id, {
        has_certificate: true,
        workload_hours: hours,
        hours_group: hoursGroup,
      });
      setEvent(updated);
      setConfirmed(false);
      setSuccess(event.has_certificate === true
        ? 'Carga horária e grupo de atividades atualizados com sucesso.'
        : 'Certificado habilitado e informações salvas no evento.');
    } catch (saveError) {
      if (isAuthSessionError(saveError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      if (isPermissionDeniedError(saveError)) {
        setPermissionDenied(true);
        setError('Somente o professor responsável pelo evento ou um administrador pode alterar as configurações do certificado.');
      } else {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível salvar as informações do certificado. Tente novamente.',
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  function continueToReview() {
    if (!event || !confirmed || event.has_certificate !== true) return;
    router.push({ pathname: '/certificados-resultado', params: { eventId: String(event.id) } } as never);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={CERTIFICATE_COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  const responsibleName = responsible
    ? `${responsible.name} ${responsible.last_name ?? ''}`.trim()
    : 'Responsável não identificado';
  const certificateEnabled = event?.has_certificate === true;
  const hoursGroupLabel = HOURS_GROUPS.find((group) => group.value === (event?.hours_group ?? hoursGroup))?.label ?? 'Atividades acadêmicas';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CertificateScreenHeading
          title="Configurar certificado"
          subtitle="Revise as informações do evento"
          onBack={() => router.back()}
        />

        {permissionDenied ? (
          <CertificateInfoBanner title="Acesso restrito" message={error ?? 'Somente o professor responsável pelo evento ou um administrador pode alterar as configurações do certificado.'} tone="info" />
        ) : (
          <>
            {error ? <CertificateInfoBanner title="Não foi possível concluir a configuração" message={error} tone="error" /> : null}
            {success ? <CertificateInfoBanner title="Dados salvos" message={success} tone="success" /> : null}

            {!event ? (
              <CertificateInfoBanner title="Evento não encontrado" message="Volte ao painel e selecione outro evento." tone="warning" />
            ) : (
          <>
            {!certificateEnabled ? (
              <View style={styles.enableCard}>
                <Text style={styles.enableTitle}>Habilitar certificado neste evento</Text>
                <Text style={styles.enableDescription}>
                  Este evento ainda não está configurado para emitir certificados. Defina a carga horária e o grupo de atividades para continuar.
                </Text>
                <Text style={styles.fieldLabel}>CARGA HORÁRIA</Text>
                <View style={styles.inputShell}>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(value) => setWorkload(value.replace(/[^0-9]/g, ''))}
                    placeholder="20"
                    placeholderTextColor="#A0A5AB"
                    style={styles.input}
                    value={workload}
                  />
                  <Text style={styles.inputSuffix}>horas</Text>
                </View>
                <Text style={styles.fieldLabel}>GRUPO DE ATIVIDADES COMPLEMENTARES</Text>
                <View style={styles.groupOptions}>
                  {HOURS_GROUPS.map((group) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: hoursGroup === group.value }}
                      key={group.value}
                      onPress={() => setHoursGroup(group.value)}
                      style={[styles.groupOption, hoursGroup === group.value && styles.groupOptionSelected]}>
                      <Text style={[styles.groupOptionTitle, hoursGroup === group.value && styles.groupOptionTitleSelected]}>{group.shortLabel}</Text>
                      <Text style={[styles.groupOptionDescription, hoursGroup === group.value && styles.groupOptionDescriptionSelected]}>{group.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <CertificatePrimaryButton
                  label={isSaving ? 'Salvando...' : 'Salvar e habilitar certificado'}
                  onPress={() => void enableCertificate()}
                  disabled={isSaving}
                  icon="save"
                />
              </View>
            ) : (
              <>
                <View style={styles.certificatePreview}>
                  <View style={styles.previewHeader}>
                    <View style={styles.brandMark}>
                      <View style={styles.brandStripe} />
                      <Text style={styles.brandText}>CAMPUS CULTURAL</Text>
                    </View>
                    <CertificateStatusPill label={`${event.workload_hours ?? '—'} horas`} tone="warning" />
                  </View>
                  <View style={styles.previewCenter}>
                    <Text style={styles.previewEyebrow}>CERTIFICADO DE PARTICIPAÇÃO</Text>
                    <Text style={styles.previewPerson}>NOME DO PARTICIPANTE</Text>
                    <Text style={styles.previewBody}>Certificamos a participação no evento</Text>
                    <Text style={styles.previewEvent}>{event.name}</Text>
                    <Text style={styles.previewWorkload}>{event.workload_hours ?? '—'} horas · {hoursGroupLabel}</Text>
                  </View>
                  <View style={styles.signatureRow}>
                    <View style={styles.signatureLine}>
                      <Text style={styles.signatureLabel}>Coordenação</Text>
                    </View>
                    <View style={styles.signatureLine}>
                      <Text style={styles.signatureLabel}>{responsibleName}</Text>
                      <Text style={styles.signatureRole}>Responsável</Text>
                    </View>
                  </View>
                  <Text style={styles.previewDisclaimer}>PRÉ-VISUALIZAÇÃO · DOCUMENTO NÃO EMITIDO</Text>
                </View>

                <View style={styles.configInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.fieldLabel}>MODELO</Text>
                    <Text style={styles.fieldValue}>Institucional claro</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.fieldLabel}>RESPONSÁVEL</Text>
                    <Text numberOfLines={1} style={styles.fieldValue}>{responsibleName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.fieldLabel}>PARTICIPANTES INSCRITOS</Text>
                    <Text style={styles.fieldValue}>{event.subscribers_count ?? '—'}</Text>
                  </View>
                </View>

                <View style={styles.enableCard}>
                  <Text style={styles.enableTitle}>Editar informações do certificado</Text>
                  <Text style={styles.enableDescription}>
                    Você pode alterar a carga horária e o grupo de atividades sempre que precisar.
                  </Text>
                  <Text style={styles.fieldLabel}>CARGA HORÁRIA</Text>
                  <View style={styles.inputShell}>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) => setWorkload(value.replace(/[^0-9]/g, ''))}
                      placeholder="20"
                      placeholderTextColor="#A0A5AB"
                      style={styles.input}
                      value={workload}
                    />
                    <Text style={styles.inputSuffix}>horas</Text>
                  </View>
                  <Text style={styles.fieldLabel}>GRUPO DE ATIVIDADES COMPLEMENTARES</Text>
                  <View style={styles.groupOptions}>
                    {HOURS_GROUPS.map((group) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: hoursGroup === group.value }}
                        key={group.value}
                        onPress={() => setHoursGroup(group.value)}
                        style={[styles.groupOption, hoursGroup === group.value && styles.groupOptionSelected]}>
                        <Text style={[styles.groupOptionTitle, hoursGroup === group.value && styles.groupOptionTitleSelected]}>{group.shortLabel}</Text>
                        <Text style={[styles.groupOptionDescription, hoursGroup === group.value && styles.groupOptionDescriptionSelected]}>{group.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <CertificatePrimaryButton
                    label={isSaving ? 'Salvando...' : 'Salvar alterações'}
                    onPress={() => void enableCertificate()}
                    disabled={isSaving}
                    icon="save"
                  />
                </View>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: confirmed }}
                  onPress={() => setConfirmed((current) => !current)}
                  style={styles.confirmRow}>
                  <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                    {confirmed ? <MaterialIcons name="check" size={15} color="#111111" /> : null}
                  </View>
                  <Text style={styles.confirmText}>Confirmo que revisei as informações e a pré-visualização do certificado.</Text>
                </Pressable>

                <CertificateInfoBanner
                  title="Certificado ainda não emitido"
                  message="A configuração foi salva, mas o certificado ainda não foi gerado. A emissão, publicação e envio do documento não estão disponíveis no momento."
                  tone="warning"
                />
                <CertificatePrimaryButton
                  label="Continuar para revisão"
                  onPress={continueToReview}
                  disabled={!confirmed}
                  icon="arrow-forward"
                />
              </>
            )}
          </>
        )}
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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CERTIFICATE_COLORS.background, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: CERTIFICATE_COLORS.background, flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 38, paddingHorizontal: 20, paddingTop: 18 },
  enableCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 14, borderWidth: 1, marginBottom: 15, padding: 18 },
  enableTitle: { color: '#343A40', fontSize: 17, fontWeight: '900' },
  enableDescription: { color: '#727A84', fontSize: 13, lineHeight: 19, marginBottom: 16, marginTop: 7 },
  fieldLabel: { color: '#535B64', fontSize: 11, fontWeight: '900', marginBottom: 7, marginTop: 13 },
  inputShell: { alignItems: 'center', borderColor: '#E2E5E7', borderRadius: 10, borderWidth: 1, flexDirection: 'row', minHeight: 50, paddingHorizontal: 13 },
  input: { color: '#343A40', flex: 1, fontSize: 14, height: 50 },
  inputSuffix: { color: '#7B838C', fontSize: 12 },
  groupOptions: { gap: 9, marginBottom: 17 },
  groupOption: { borderColor: '#E1E3E5', borderRadius: 10, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12 },
  groupOptionSelected: { backgroundColor: '#FFF8D6', borderColor: CERTIFICATE_COLORS.primary },
  groupOptionTitle: { color: '#565E67', fontSize: 12, fontWeight: '900' },
  groupOptionTitleSelected: { color: '#171717' },
  groupOptionDescription: { color: '#89919A', fontSize: 11, lineHeight: 16, marginTop: 4 },
  groupOptionDescriptionSelected: { color: '#655311' },
  certificatePreview: { backgroundColor: '#FFFFFF', borderColor: CERTIFICATE_COLORS.primary, borderRadius: 13, borderWidth: 2, marginBottom: 16, minHeight: 330, padding: 18 },
  previewHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brandMark: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  brandStripe: { backgroundColor: CERTIFICATE_COLORS.primary, borderRadius: 2, height: 15, width: 4 },
  brandText: { color: '#1B1D20', fontSize: 11, fontWeight: '900' },
  previewCenter: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 34 },
  previewEyebrow: { color: '#8A9097', fontSize: 10, letterSpacing: 1.1 },
  previewPerson: { color: '#24282D', fontSize: 20, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  previewBody: { color: '#606872', fontSize: 12, marginTop: 9 },
  previewEvent: { color: '#25292E', fontSize: 15, fontWeight: '800', lineHeight: 21, marginTop: 5, textAlign: 'center' },
  previewWorkload: { color: '#777F88', fontSize: 10, marginTop: 6, textAlign: 'center' },
  signatureRow: { flexDirection: 'row', gap: 22, justifyContent: 'space-around' },
  signatureLine: { alignItems: 'center', borderTopColor: '#D5D8DB', borderTopWidth: 1, flex: 1, paddingTop: 5 },
  signatureLabel: { color: '#686F77', fontSize: 10, textAlign: 'center' },
  signatureRole: { color: '#9299A0', fontSize: 9, marginTop: 3 },
  previewDisclaimer: { color: '#A0A5AB', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, textAlign: 'center' },
  configInfo: { backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 12, borderWidth: 1, marginBottom: 14, paddingHorizontal: 15 },
  infoRow: { borderBottomColor: '#EEF0F1', borderBottomWidth: 1, paddingVertical: 12 },
  fieldValue: { color: '#343A40', fontSize: 13, fontWeight: '700' },
  confirmRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7E9', borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 14, padding: 14 },
  checkbox: { alignItems: 'center', borderColor: '#BCC2C8', borderRadius: 5, borderWidth: 1, height: 21, justifyContent: 'center', width: 21 },
  checkboxChecked: { backgroundColor: CERTIFICATE_COLORS.primary, borderColor: CERTIFICATE_COLORS.primary },
  confirmText: { color: '#414850', flex: 1, fontSize: 12, lineHeight: 18 },
});
