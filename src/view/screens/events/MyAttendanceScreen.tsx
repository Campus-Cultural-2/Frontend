import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  checkInToEvent,
  getEvent,
  getMySubscription,
  isAuthSessionError,
  SubscriptionOut,
} from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';
import { formatCampusDateTimeLabel } from '@/src/lib/datetime/campusTime';
import { useAppToast } from '@/src/view/hooks/useAppToast';

// Tela do aluno inscrito: mostra o codigo para o professor ler, ou recebe o
// codigo do evento para ele mesmo confirmar a presenca.
export default function MyAttendanceScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const id = Number(eventId);
  const { showToast, toast } = useAppToast();
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionOut | null>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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
      const [loadedEvent, loadedSubscription] = await Promise.all([
        getEvent(id),
        getMySubscription(id),
      ]);

      setEvent(loadedEvent);
      setSubscription(loadedSubscription);
    } catch (error) {
      await handleError(error, 'Não foi possível carregar sua inscrição.');
    } finally {
      setIsLoading(false);
    }
  }, [handleError, id]);

  useEffect(() => {
    if (Number.isFinite(id)) {
      void load();
    }
  }, [id, load]);

  async function confirmPresence(scanned?: string) {
    const value = (scanned ?? code).trim();

    if (!value) {
      return;
    }

    setIsSending(true);

    try {
      const result = await checkInToEvent(id, value);

      setSubscription((current) =>
        current ? { ...current, checked_in_at: result.checked_in_at } : current,
      );
      setCode('');
      showToast({ message: 'Presença confirmada!', type: 'success' });
    } catch (error) {
      await handleError(error, 'Não foi possível confirmar a presença.');
    } finally {
      setIsSending(false);
    }
  }

  const mode = event?.attendance_mode ?? 'none';
  const confirmedAt = subscription?.checked_in_at;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppPageHeader
        title={event?.name ?? 'Presença'}
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
          {mode === 'none' ? (
            <Text style={styles.hint}>
              Este evento não pede confirmação: você conta como presente por estar inscrito.
            </Text>
          ) : null}

          {mode !== 'none' ? (
            <View style={[styles.status, confirmedAt ? styles.statusOk : null]}>
              <MaterialIcons
                color={confirmedAt ? '#1E7B3A' : colors.text.secondary}
                name={confirmedAt ? 'check-circle' : 'schedule'}
                size={22}
              />
              <Text style={styles.statusText}>
                {confirmedAt
                  ? `Presença confirmada em ${formatCampusDateTimeLabel(new Date(`${confirmedAt}Z`))}`
                  : 'Presença ainda não confirmada'}
              </Text>
            </View>
          ) : null}

          {mode === 'professor' && subscription?.attendance_code ? (
            <View style={styles.box}>
              <Text style={styles.hint}>
                Mostre este código ao professor para ele confirmar a sua presença.
              </Text>
              <QrCode size={220} value={subscription.attendance_code} />
              <Text selectable style={styles.myCode}>
                {subscription.attendance_code}
              </Text>
            </View>
          ) : null}

          {mode === 'student' && !confirmedAt ? (
            <View style={styles.box}>
              <Text style={styles.hint}>
                Leia o QR code mostrado pelo professor ou digite o código durante o evento.
              </Text>
              <AppButton
                label="Ler QR code do evento"
                variant="primary"
                fullWidth
                disabled={isSending}
                onPress={() => setIsScannerOpen(true)}
                style={styles.actionButton}
              />
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setCode}
                placeholder="Código do evento"
                placeholderTextColor="#9B9EA5"
                style={styles.input}
                value={code}
              />
              <AppButton
                label="Confirmar presença"
                variant="primary"
                fullWidth
                loading={isSending}
                disabled={isSending}
                onPress={() => void confirmPresence()}
                style={styles.actionButton}
              />
            </View>
          ) : null}
        </ScrollView>
      )}

      <QrScannerModal
        onClose={() => setIsScannerOpen(false)}
        onScanned={(scanned) => {
          setIsScannerOpen(false);
          void confirmPresence(scanned);
        }}
        title="Aponte para o QR code do evento"
        visible={isScannerOpen}
      />
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen, flex: 1 },
  header: { ...appLayoutStyles.content, paddingBottom: 0, paddingTop: 0, marginBottom: 8 },
  actionButton: { alignSelf: 'stretch' },
  loading: { marginTop: 40 },
  content: {
    ...appLayoutStyles.content, gap: 16 },
  hint: { color: colors.text.secondary, fontSize: 13, lineHeight: 19 },
  status: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  statusOk: { backgroundColor: '#E8F5EC' },
  statusText: { color: colors.text.primary, flex: 1, fontSize: 14, fontWeight: '600' },
  box: { ...appSurfaceStyles.card, gap: 12, padding: 16 },
  myCode: { color: colors.text.primary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  input: {
    backgroundColor: colors.surface.subtle,
    borderRadius: 6,
    color: colors.text.primary,
    fontSize: 18,
    height: 48,
    letterSpacing: 4,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
});
