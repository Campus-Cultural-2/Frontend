import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        router.replace('/(tabs)' as never);
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
    else router.replace('/gestao' as never);
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
      Alert.alert(
        'Status atualizado',
        `${user.name} ${user.last_name} foi ${user.is_active ? 'inativado' : 'reativado'} com sucesso.`,
        [{ text: 'OK', onPress: () => router.replace('/gestao' as never) }],
      );
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      Alert.alert(
        'Não foi possível alterar o status',
        `${requestError instanceof Error ? requestError.message : 'A API não conseguiu atualizar o usuário.'}\n\nA API atual exige uma senha para atualizar usuários. O backend precisa permitir atualização do status sem redefinir a senha.`,
      );
    } finally {
      setIsSaving(false);
    }
  }, [router, user]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar para os detalhes" onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={21} color="#202124" />
        </Pressable>

        <Text style={styles.title}>Alterar status</Text>
        <Text style={styles.subtitle}>Revise a ação antes de confirmar.</Text>

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
                <MaterialIcons name={willDeactivate ? 'person-off' : 'person-add-alt-1'} size={28} color={willDeactivate ? '#C83B32' : '#21834A'} />
              </View>

              <Text style={styles.question}>
                {willDeactivate ? 'Inativar' : 'Reativar'} {user.name} {user.last_name}?
              </Text>
              <Text style={styles.explanation}>
                {willDeactivate
                  ? 'Esta alteração entra em vigor imediatamente.'
                  : 'O usuário poderá voltar a acessar o aplicativo.'}
              </Text>

              <View style={[styles.transitionBadge, willDeactivate ? styles.transitionDeactivate : styles.transitionActivate]}>
                <Text style={[styles.transitionText, willDeactivate ? styles.transitionDeactivateText : styles.transitionActivateText]}>
                  {willDeactivate ? 'ATIVO → INATIVO' : 'INATIVO → ATIVO'}
                </Text>
              </View>

              <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void confirmStatusChange()} style={[styles.confirmButton, !willDeactivate && styles.reactivateButton, isSaving && styles.disabled]}>
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="person-outline" size={17} color="#FFFFFF" />}
                <Text style={styles.confirmText}>{isSaving ? 'Confirmando...' : willDeactivate ? 'Confirmar inativação' : 'Confirmar reativação'}</Text>
              </Pressable>

              <Pressable accessibilityRole="button" disabled={isSaving} onPress={goBack} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
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
  safeArea: { flex: 1, backgroundColor: '#F3F4F4' },
  content: { flex: 1, padding: 18 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E9EAEB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#191919', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#777B83', fontSize: 12, marginTop: 3, marginBottom: 18 },
  loading: { marginTop: 40 },
  errorText: { color: '#B42318', fontSize: 13, marginTop: 16 },
  warningCard: { backgroundColor: '#FFF0D0', borderRadius: 11, padding: 14, marginBottom: 14 },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  warningTitle: { color: '#995000', fontSize: 12, fontWeight: '900' },
  warningText: { color: '#5F5A50', fontSize: 11, lineHeight: 17, marginTop: 7 },
  confirmCard: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#E5E6E8' },
  personIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  deactivateIcon: { backgroundColor: '#FDE9E7' },
  activateIcon: { backgroundColor: '#E4F5EB' },
  question: { color: '#202124', fontSize: 19, fontWeight: '700', textAlign: 'center' },
  explanation: { color: '#777B83', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  transitionBadge: { marginTop: 13, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  transitionDeactivate: { backgroundColor: '#FDE9E7' },
  transitionActivate: { backgroundColor: '#E4F5EB' },
  transitionText: { fontSize: 9, fontWeight: '900' },
  transitionDeactivateText: { color: '#B42318' },
  transitionActivateText: { color: '#21834A' },
  confirmButton: { minHeight: 46, alignSelf: 'stretch', borderRadius: 9, backgroundColor: '#B42318', marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reactivateButton: { backgroundColor: '#21834A' },
  confirmText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cancelButton: { minHeight: 44, alignSelf: 'stretch', borderRadius: 9, borderColor: '#333333', borderWidth: 1, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#222222', fontSize: 12, fontWeight: '800' },
  noteCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 13, marginTop: 14, borderWidth: 1, borderColor: '#E5E6E8' },
  noteTitle: { color: '#202124', fontSize: 11, fontWeight: '800' },
  noteText: { color: '#777B83', fontSize: 11, lineHeight: 16, marginTop: 5 },
  disabled: { opacity: 0.6 },
});
