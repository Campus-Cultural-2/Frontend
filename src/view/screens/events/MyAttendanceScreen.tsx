import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#111111" />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {event?.name ?? 'Presença'}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#111111" style={styles.loading} />
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
                color={confirmedAt ? '#1E7B3A' : '#6F7782'}
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
              <Pressable
                accessibilityRole="button"
                disabled={isSending}
                onPress={() => setIsScannerOpen(true)}
                style={styles.confirmButton}>
                <Text style={styles.confirmText}>Ler QR code do evento</Text>
              </Pressable>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setCode}
                placeholder="Código do evento"
                placeholderTextColor="#9B9EA5"
                style={styles.input}
                value={code}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isSending}
                onPress={() => void confirmPresence()}
                style={styles.confirmButton}>
                <Text style={styles.confirmText}>Confirmar presença</Text>
              </Pressable>
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
  safeArea: { backgroundColor: '#FAFAFA', flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 16 },
  headerTitle: { color: '#111111', flex: 1, fontSize: 18, fontWeight: '700' },
  loading: { marginTop: 40 },
  content: { gap: 12, padding: 16 },
  hint: { color: '#5F6670', fontSize: 13, lineHeight: 19 },
  status: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  statusOk: { backgroundColor: '#E8F5EC' },
  statusText: { color: '#111111', flex: 1, fontSize: 14, fontWeight: '600' },
  box: { backgroundColor: '#FFFFFF', borderRadius: 8, gap: 12, padding: 14 },
  myCode: { color: '#111111', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  input: {
    backgroundColor: '#F3F3F4',
    borderRadius: 6,
    color: '#111111',
    fontSize: 18,
    height: 48,
    letterSpacing: 4,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 6,
    height: 46,
    justifyContent: 'center',
  },
  confirmText: { color: '#111111', fontWeight: '700' },
});
