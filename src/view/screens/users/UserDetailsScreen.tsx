import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUser, getValidAuthSession, isAuthSessionError, updateUser } from '@/src/lib/api/campus';
import type { CampusUser, UserRole } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';

export default function UserDetailsScreen() {
  const router = useRouter();
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
        router.replace('/(tabs)' as never);
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
    Alert.alert('Tipo de conta', 'Selecione o novo tipo de conta.', [
      { text: 'Aluno', onPress: () => setRole('student') },
      { text: 'Professor', onPress: () => setRole('professor') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;

    if (!name.trim() || !lastName.trim()) {
      Alert.alert('Nome incompleto', 'Informe o nome e o sobrenome do usuário.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('E-mail obrigatório', 'Informe o e-mail institucional.');
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
      Alert.alert('Alterações salvas', 'Os dados do usuário foram atualizados.', [
        { text: 'OK', onPress: () => router.replace('/gestao' as never) },
      ]);
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      Alert.alert(
        'Não foi possível salvar',
        requestError instanceof Error
          ? `${requestError.message}\n\nA API atual exige uma senha para atualizar usuários. A equipe do backend precisa permitir atualização sem alterar a senha para concluir esta operação.`
          : 'A API não conseguiu salvar as alterações. Verifique o contrato de atualização de usuários.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [email, lastName, name, role, router, user]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/gestao' as never);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a lista" onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={21} color="#202124" />
          </Pressable>

          <Text style={styles.title}>Detalhes do usuário</Text>
          <Text style={styles.subtitle}>Cadastro e permissões institucionais</Text>

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
                <View style={[styles.statusBadge, user.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                  <Text style={[styles.statusText, user.is_active ? styles.activeText : styles.inactiveText]}>{user.is_active ? 'ATIVO' : 'INATIVO'}</Text>
                </View>
              </View>

              <Field label="Nome" value={name} onChangeText={setName} />
              <Field label="Sobrenome" value={lastName} onChangeText={setLastName} />
              <Field label="E-mail institucional" value={email} onChangeText={setEmail} keyboardType="email-address" />

              <Text style={styles.fieldLabel}>Conta</Text>
              <Pressable accessibilityRole="button" onPress={chooseRole} style={styles.selectField}>
                <Text style={styles.selectText}>{roleLabel(role)}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#555B64" />
              </Pressable>

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusField}>
                <Text style={styles.selectText}>{user.is_active ? 'Ativo' : 'Inativo'}</Text>
                <View style={[styles.statusDot, user.is_active ? styles.activeDot : styles.inactiveDot]} />
              </View>

              <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void handleSave()} style={[styles.saveButton, isSaving && styles.disabled]}>
                {isSaving ? <ActivityIndicator color="#111111" /> : <MaterialIcons name="check" size={18} color="#111111" />}
                <Text style={styles.saveText}>{isSaving ? 'Salvando...' : 'Salvar alterações'}</Text>
              </Pressable>

              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/gestao/status/[userId]', params: { userId: String(user.id) } } as never)} style={styles.statusAction}>
                <MaterialIcons name={user.is_active ? 'person-off' : 'person-add-alt-1'} size={18} color="#34373D" />
                <Text style={styles.statusActionText}>{user.is_active ? 'Inativar usuário' : 'Reativar usuário'}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  safeArea: { flex: 1, backgroundColor: '#F3F4F4' },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E9EAEB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#191919', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#777B83', fontSize: 12, marginTop: 3, marginBottom: 18 },
  loading: { marginTop: 40 },
  errorText: { color: '#B42318', fontSize: 13, marginTop: 16 },
  summaryCard: { alignItems: 'center', flexDirection: 'row', gap: 11, padding: 13, backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 18, borderWidth: 1, borderColor: '#E5E6E8' },
  avatar: { height: 42, width: 42, borderRadius: 21, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#171717', fontSize: 12, fontWeight: '800' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 21 },
  summaryInfo: { flex: 1, gap: 3 },
  summaryName: { color: '#202124', fontSize: 13, fontWeight: '800' },
  summaryRole: { color: '#777B83', fontSize: 10 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  activeBadge: { backgroundColor: '#E4F5EB' },
  inactiveBadge: { backgroundColor: '#FDE9E7' },
  statusText: { fontSize: 9, fontWeight: '800' },
  activeText: { color: '#21834A' },
  inactiveText: { color: '#B42318' },
  fieldGroup: { gap: 7, marginBottom: 14 },
  fieldLabel: { color: '#303239', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 7, marginTop: 3 },
  input: { height: 46, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E0E2E4', backgroundColor: '#FFFFFF', color: '#202124', fontSize: 13 },
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E2E4', borderRadius: 8, marginBottom: 13 },
  selectText: { color: '#303239', fontSize: 13 },
  statusField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E2E4', borderRadius: 8, marginBottom: 18 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  activeDot: { backgroundColor: '#21834A' },
  inactiveDot: { backgroundColor: '#B42318' },
  saveButton: { height: 48, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFCC00' },
  saveText: { color: '#111111', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  statusAction: { minHeight: 45, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusActionText: { color: '#303239', fontSize: 12, fontWeight: '700' },
});
