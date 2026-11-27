import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/ui/app-text';
import { AppBadge, AppButton, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import { getUser, getValidAuthSession, isAuthSessionError, updateUser } from '@/src/lib/api/campus';
import type { CampusUser } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';

export default function UserStatusConfirmationScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const id = Number(userId);
  const [user, setUser] = useState<CampusUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const willDeactivate = user?.is_active ?? false;

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador de usuário inválido.');
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)/(main)' as never);
        return;
      }
      setUser(await getUser(id));
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o usuário.');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void loadUser(); }, [loadUser]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/(main)/gestao' as never);
  };

  const confirmStatusChange = useCallback(async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUser(user.id, {
        birth_date: user.birth_date,
        email: user.email,
        is_active: !user.is_active,
        last_name: user.last_name,
        name: user.name,
        ra: user.role === 'student' ? user.ra : null,
        role: user.role,
      });
      router.replace('/(tabs)/(main)/gestao' as never);
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível atualizar o status do usuário. Tente novamente mais tarde.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [router, user]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.content}>
        <AppPageHeader
          title="Alterar status"
          subtitle="Revise a ação antes de confirmar."
          leading={(
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar para os detalhes"
              onPress={goBack}
              style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={20} color={colors.text.heading} />
            </Pressable>
          )}
          style={styles.pageHeader}
        />

        {isLoading ? <ActivityIndicator size="large" color="#D0A900" style={styles.loading} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {user ? (
          <>
            <View style={styles.warningCard}>
              <View style={styles.warningHeading}>
                <MaterialIcons name="warning-amber" size={19} color="#A85A00" />
                <Text style={styles.warningTitle}>Ação administrativa</Text>
              </View>
              <Text style={styles.warningText}>
                {willDeactivate
                  ? 'O usuário perderá acesso às áreas restritas, mas seu histórico de eventos e certificados será preservado.'
                  : 'O usuário voltará a ter acesso às áreas restritas da plataforma.'}
              </Text>
            </View>

            <View style={styles.confirmCard}>
              <View style={[styles.personIcon, willDeactivate ? styles.deactivateIcon : styles.activateIcon]}>
                <MaterialIcons name={willDeactivate ? 'person-off' : 'person-add-alt-1'} size={28} color={willDeactivate ? '#C83B32' : colors.status.success} />
              </View>

              <Text style={styles.question}>
                {willDeactivate ? 'Inativar' : 'Reativar'} {user.name} {user.last_name}?
              </Text>
              <Text style={styles.explanation}>
                {willDeactivate
                  ? 'Esta alteração entra em vigor imediatamente.'
                  : 'O usuário poderá voltar a acessar o aplicativo.'}
              </Text>

              <AppBadge variant={willDeactivate ? 'danger' : 'success'} style={styles.transitionBadge}>
                {willDeactivate ? 'Ativo → Inativo' : 'Inativo → Ativo'}
              </AppBadge>

              <AppButton
                label={isSaving ? 'Confirmando...' : willDeactivate ? 'Confirmar inativação' : 'Confirmar reativação'}
                variant={willDeactivate ? 'danger' : 'primary'}
                size="lg"
                fullWidth
                loading={isSaving}
                disabled={isSaving}
                icon={!isSaving ? <MaterialIcons name="person-outline" size={17} color={willDeactivate ? colors.status.danger : colors.text.primary} /> : undefined}
                onPress={() => void confirmStatusChange()}
                style={styles.confirmAction}
              />

              <AppButton label="Cancelar" variant="outline" fullWidth disabled={isSaving} onPress={goBack} />
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>{willDeactivate ? 'Reativação disponível' : 'Status restaurado'}</Text>
              <Text style={styles.noteText}>
                {willDeactivate
                  ? 'O status poderá ser alterado novamente na tela de detalhes do usuário.'
                  : 'Você poderá inativar esta conta novamente quando necessário.'}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen, flex: 1 },
  content: {
    ...appLayoutStyles.content, flex: 1, paddingBottom: 28 },
  pageHeader: { marginBottom: 16 },
  backButton: appSurfaceStyles.iconButton,
  loading: { marginTop: 40 },
  errorText: { color: colors.status.danger, fontSize: 13, marginTop: 16 },
  warningCard: { backgroundColor: colors.status.warningSoft, borderRadius: 12, padding: 14, marginBottom: 14 },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  warningTitle: { color: colors.status.warning, fontSize: 12, fontWeight: '700' },
  warningText: { color: colors.text.secondary, fontSize: 12, lineHeight: 18, marginTop: 7 },
  confirmCard: { ...appSurfaceStyles.card, padding: 20, alignItems: 'center' },
  personIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  deactivateIcon: { backgroundColor: colors.status.dangerSoft },
  activateIcon: { backgroundColor: colors.status.successSoft },
  question: { color: colors.text.heading, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  explanation: { color: colors.text.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  transitionBadge: { marginTop: 13, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  confirmAction: { marginTop: 18 },
  noteCard: { ...appSurfaceStyles.card, padding: 14, marginTop: 14 },
  noteTitle: { color: colors.text.heading, fontSize: 11, fontWeight: '800' },
  noteText: { color: colors.text.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
});
