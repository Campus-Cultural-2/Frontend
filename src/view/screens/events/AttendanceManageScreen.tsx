import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppButton, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import { AppToast } from '@/components/ui/app-toast';
import { QrCode } from '@/components/ui/qr-code';
import { QrScannerModal } from '@/components/ui/qr-scanner-modal';
import {
  CampusEvent,
  getEvent,
  getEventCode,
  isAuthSessionError,
  listParticipants,
  Participant,
  scanStudentCode,
  setParticipantAttendance,
} from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';
import { useAppToast } from '@/src/view/hooks/useAppToast';

// Tela do professor responsavel (ou admin): confirma a presenca dos inscritos.
export default function AttendanceManageScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const id = Number(eventId);
  const { showToast, toast } = useAppToast();
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventCode, setEventCode] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleError = useCallback(
    async (error: unknown, fallback: string) => {
      if (isAuthSessionError(error)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      showToast({ message: error instanceof Error ? error.message : fallback, type: 'error' });
    },
    [router, showToast],
  );

  const load = useCallback(async () => {
    try {
      const loadedEvent = await getEvent(id);
      const [loadedParticipants, loadedCode] = await Promise.all([
        listParticipants(id),
        loadedEvent.attendance_mode === 'student' ? getEventCode(id) : Promise.resolve(null),
      ]);

      setEvent(loadedEvent);
      setParticipants(loadedParticipants);
      setEventCode(loadedCode?.code ?? '');
    } catch (error) {
      await handleError(error, 'Não foi possível carregar a lista de presença.');
    } finally {
      setIsLoading(false);
    }
  }, [handleError, id]);

  useEffect(() => {
    if (Number.isFinite(id)) {
      void load();
    }
  }, [id, load]);

  const presentCount = useMemo(
    () => participants.filter((participant) => participant.attended).length,
    [participants],
  );

  function replaceParticipant(updated: Participant) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.user_id === updated.user_id ? updated : participant,
      ),
    );
  }

  async function toggleAttendance(participant: Participant) {
    setBusyUserId(participant.user_id);

    try {
      replaceParticipant(
        await setParticipantAttendance(id, participant.user_id, !participant.attended),
      );
    } catch (error) {
      await handleError(error, 'Não foi possível atualizar a presença.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function confirmStudentCode(scanned?: string) {
    const code = (scanned ?? studentCode).trim();

    if (!code) {
      return;
    }

    try {
      const confirmed = await scanStudentCode(id, code);

      replaceParticipant(confirmed);
      setStudentCode('');
      showToast({ message: `Presença de ${confirmed.name} confirmada.`, type: 'success' });
    } catch (error) {
      await handleError(error, 'Código inválido.');
    }
  }

  const mode = event?.attendance_mode ?? 'none';

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppPageHeader
        title={event ? `Presença · ${event.name}` : 'Presença'}
        leading={(
          <Pressable
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(main)/calendario' as never))}
            style={appSurfaceStyles.iconButton}>
            <MaterialIcons name="arrow-back" size={20} color={colors.text.primary} />
          </Pressable>
        )}
        style={styles.header}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.text.primary} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.summary}>
            {presentCount} de {participants.length} presentes
          </Text>

          {mode === 'none' ? (
            <Text style={styles.hint}>
              Este evento não tem confirmação de presença: todos os inscritos contam como
              presentes. Para confirmar presença, altere o evento.
            </Text>
          ) : null}

          {mode === 'student' ? (
            <View style={styles.codeBox}>
              <Text style={styles.hint}>
                Mostre este código aos alunos. Cada um confirma a própria presença durante o
                evento.
              </Text>
              {eventCode ? <QrCode size={220} value={eventCode} /> : null}
              <Text selectable style={styles.eventCode}>
                {eventCode}
              </Text>
            </View>
          ) : null}

          {mode === 'professor' ? (
            <View style={styles.codeBox}>
              <Text style={styles.hint}>
                Marque os alunos na lista, leia o QR code do ingresso do aluno ou digite o código.
              </Text>
              <AppButton
                label="Ler QR code do aluno"
                variant="primary"
                fullWidth
                onPress={() => setIsScannerOpen(true)}
                style={styles.actionButton}
              />
              <View style={styles.codeRow}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setStudentCode}
                  onSubmitEditing={() => void confirmStudentCode()}
                  placeholder="Código do aluno"
                  placeholderTextColor="#9B9EA5"
                  style={styles.codeInput}
                  value={studentCode}
                />
                <AppButton
                  label="Confirmar"
                  variant="primary"
                  onPress={() => void confirmStudentCode()}
                  style={styles.inlineActionButton}
                />
              </View>
            </View>
          ) : null}

          {participants.length === 0 ? (
            <Text style={styles.hint}>Nenhum aluno inscrito ainda.</Text>
          ) : (
            participants.map((participant) => (
              <Pressable
                accessibilityRole={mode === 'professor' ? 'checkbox' : 'text'}
                accessibilityState={{ checked: participant.attended }}
                disabled={mode !== 'professor' || busyUserId === participant.user_id}
                key={participant.user_id}
                onPress={() => void toggleAttendance(participant)}
                style={styles.row}>
                <MaterialIcons
                  color={participant.attended ? '#1E7B3A' : '#9B9EA5'}
                  name={participant.attended ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>
                    {participant.name} {participant.last_name}
                  </Text>
                  {participant.ra ? <Text style={styles.rowMeta}>RA {participant.ra}</Text> : null}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <QrScannerModal
        onClose={() => setIsScannerOpen(false)}
        onScanned={(code) => {
          setIsScannerOpen(false);
          void confirmStudentCode(code);
        }}
        title="Aponte para o QR code do aluno"
        visible={isScannerOpen}
      />
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen, flex: 1 },
  header: { ...appLayoutStyles.content, paddingBottom: 0, paddingTop: 20, marginBottom: 8 },
  actionButton: { alignSelf: 'stretch' },
  inlineActionButton: { minWidth: 108 },
  loading: { marginTop: 40 },
  content: {
    ...appLayoutStyles.content, gap: 16, paddingBottom: 40 },
  summary: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.text.secondary, fontSize: 13, lineHeight: 19 },
  codeBox: { ...appSurfaceStyles.card, gap: 10, padding: 16 },
  eventCode: {
    color: colors.text.primary,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInput: {
    backgroundColor: colors.surface.subtle,
    borderRadius: 6,
    color: colors.text.primary,
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  rowText: { flex: 1 },
  rowName: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.text.secondary, fontSize: 12 },
});
