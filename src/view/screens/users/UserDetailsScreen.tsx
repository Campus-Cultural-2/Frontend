import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppToast } from '@/components/ui/app-toast';
import { useAppToast } from '@/src/view/hooks/useAppToast';
import { AppBadge, AppButton, AppFieldLabel, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import { getUser, getValidAuthSession, isAuthSessionError, updateUser } from '@/src/lib/api/campus';
import type { CampusUser, UserRole } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';

export default function UserDetailsScreen() {
  const router = useRouter();
  const { showToast, toast } = useAppToast();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const id = Number(userId);

  const [user, setUser] = useState<CampusUser | null>(null);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRolePickerVisible, setIsRolePickerVisible] = useState(false);

  const loadUser = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError('Identificador de usuário inválido.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)/(main)' as never);
        return;
      }
      const result = await getUser(id);
      setUser(result);
      setName(result.name);
      setLastName(result.last_name);
      setEmail(result.email);
      setRole(result.role);
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

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const chooseRole = useCallback(() => {
    setIsRolePickerVisible(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;

    if (!name.trim() || !lastName.trim()) {
      showToast({ message: 'Informe o nome e o sobrenome do usuário.', type: 'warning' });
      return;
    }
    if (!email.trim()) {
      showToast({ message: 'Informe o e-mail institucional.', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateUser(user.id, {
        birth_date: user.birth_date,
        email: email.trim(),
        is_active: user.is_active,
        last_name: lastName.trim(),
        name: name.trim(),
        ra: role === 'student' ? user.ra : null,
        role,
      });
      setUser(updated);
      setName(updated.name);
      setLastName(updated.last_name);
      setEmail(updated.email);
      setRole(updated.role);
      showToast({ message: 'Dados do usuário atualizados com sucesso.', type: 'success' });
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      showToast({
        message: requestError instanceof Error
          ? requestError.message
          : 'Não foi possível atualizar os dados do usuário. Revise as informações e tente novamente.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [email, lastName, name, role, router, showToast, user]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/(main)/gestao' as never);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          <AppPageHeader
            title="Detalhes do usuário"
            subtitle="Cadastro e permissões institucionais"
            leading={
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a lista" onPress={goBack} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={21} color={colors.text.heading} />
              </Pressable>
            }
            style={styles.pageHeader}
          />

          {isLoading ? <ActivityIndicator size="large" color="#D0A900" style={styles.loading} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {user ? (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.avatar}>
                  {user.profile_picture_url ? (
                    <Image source={{ uri: user.profile_picture_url }} contentFit="cover" style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.initials}>{`${user.name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryName}>{user.name} {user.last_name}</Text>
                  <Text style={styles.summaryRole}>{roleLabel(user.role)}</Text>
                </View>
                <AppBadge variant={user.is_active ? 'success' : 'danger'}>
                  {user.is_active ? 'Ativo' : 'Inativo'}
                </AppBadge>
              </View>

              <Field label="Nome" value={name} onChangeText={setName} />
              <Field label="Sobrenome" value={lastName} onChangeText={setLastName} />
              <Field label="E-mail institucional" value={email} onChangeText={setEmail} keyboardType="email-address" />

              <AppFieldLabel label="Conta" style={styles.sharedFieldLabel} />
              <Pressable accessibilityRole="button" onPress={chooseRole} style={styles.selectField}>
                <Text style={styles.selectText}>{roleLabel(role)}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#555B64" />
              </Pressable>

              <AppFieldLabel label="Status" style={styles.sharedFieldLabel} />
              <View style={styles.statusField}>
                <Text style={styles.selectText}>{user.is_active ? 'Ativo' : 'Inativo'}</Text>
                <View style={[styles.statusDot, user.is_active ? styles.activeDot : styles.inactiveDot]} />
              </View>

              <AppButton
                label={isSaving ? 'Salvando...' : 'Salvar alterações'}
                variant="primary"
                size="lg"
                fullWidth
                loading={isSaving}
                disabled={isSaving}
                icon={!isSaving ? <MaterialIcons name="check" size={18} color={colors.text.primary} /> : undefined}
                onPress={() => void handleSave()}
              />

              <AppButton
                label={user.is_active ? 'Inativar usuário' : 'Reativar usuário'}
                variant={user.is_active ? 'danger' : 'outline'}
                fullWidth
                icon={<MaterialIcons name={user.is_active ? 'person-off' : 'person-add-alt-1'} size={18} color={user.is_active ? colors.status.danger : colors.text.heading} />}
                onPress={() => router.push({ pathname: '/gestao/status/[userId]', params: { userId: String(user.id) } } as never)}
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        transparent
        visible={isRolePickerVisible}
        onRequestClose={() => setIsRolePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsRolePickerVisible(false)} />
          <View style={styles.roleModal}>
            <Text style={styles.roleModalTitle}>Tipo de conta</Text>
            <Text style={styles.roleModalDescription}>Selecione o tipo de acesso deste usuário.</Text>
            {([
              { value: 'student' as const, label: 'Aluno', icon: 'school' as const },
              { value: 'professor' as const, label: 'Professor', icon: 'person' as const },
            ]).map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === option.value }}
                onPress={() => { setRole(option.value); setIsRolePickerVisible(false); }}
                style={[styles.roleOption, role === option.value && styles.roleOptionSelected]}>
                <MaterialIcons name={option.icon} size={19} color={colors.text.secondary} />
                <Text style={styles.roleOptionText}>{option.label}</Text>
                {role === option.value ? <MaterialIcons name="check-circle" size={19} color={colors.brand.emphasis} /> : null}
              </Pressable>
            ))}
            <AppButton label="Cancelar" variant="outline" fullWidth onPress={() => setIsRolePickerVisible(false)} />
          </View>
        </View>
      </Modal>
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'email-address' }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'} autoCorrect={false} style={styles.input} />
    </View>
  );
}

function roleLabel(role: UserRole) {
  if (role === 'admin') return 'Administrador';
  if (role === 'professor') return 'Professor';
  return 'Aluno';
}

const styles = StyleSheet.create({
  safeArea: { ...appLayoutStyles.screen },
  keyboard: { flex: 1 },
  content: { ...appLayoutStyles.content, paddingBottom: 40 },
  pageHeader: { marginBottom: 16 },
  sharedFieldLabel: { marginBottom: 7 },
  backButton: { ...appSurfaceStyles.iconButton, width: 40, height: 40, marginBottom: 0 },
  loading: { marginTop: 40 },
  errorText: { color: colors.status.danger, fontSize: 13, marginTop: 16 },
  summaryCard: { ...appSurfaceStyles.card, alignItems: 'center', flexDirection: 'row', gap: 11, padding: 13, marginBottom: 18 },
  avatar: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.text.primary, fontSize: 12, fontWeight: '800' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 21 },
  summaryInfo: { flex: 1, gap: 3 },
  summaryName: { color: colors.text.heading, fontSize: 13, fontWeight: '800' },
  summaryRole: { color: colors.text.muted, fontSize: 10 },
  fieldLabel: { color: colors.text.heading, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 3 },
  input: { ...appSurfaceStyles.input, height: 48 },
  selectField: { ...appSurfaceStyles.input, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, marginBottom: 13 },
  selectText: { color: colors.text.heading, fontSize: 14 },
  statusField: { ...appSurfaceStyles.input, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, marginBottom: 18 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  activeDot: { backgroundColor: colors.status.success },
  inactiveDot: { backgroundColor: colors.status.danger },
  fieldGroup: { gap: 7, marginBottom: 14 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  roleModal: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: colors.surface.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border.default, padding: 20, gap: 10 },
  roleModalTitle: { color: colors.text.heading, fontSize: 18, fontWeight: '700' },
  roleModalDescription: { color: colors.text.secondary, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  roleOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, paddingHorizontal: 14 },
  roleOptionSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary },
  roleOptionText: { color: colors.text.heading, fontSize: 14, fontWeight: '600', flex: 1 },
});
