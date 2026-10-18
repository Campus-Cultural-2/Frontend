import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppToast } from '@/components/ui/app-toast';
import { UnsavedChangesDialog } from '@/components/ui/unsaved-changes-dialog';
import {
  CurrentUser,
  deleteProfilePicture,
  getCurrentUser,
  hasAuthToken,
  isAuthSessionError,
  login,
  updateUser,
  updateProfilePicture,
} from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';
import {
  runWithUnsavedChangesGuard,
  setUnsavedChangesHandler,
} from '@/src/lib/navigation/unsavedChangesGuard';
import { useAppToast } from '@/src/view/hooks/useAppToast';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [savedUser, setSavedUser] = useState<CurrentUser | null>(null);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [savedProfileImageUri, setSavedProfileImageUri] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const { showToast, toast } = useAppToast();
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageEvents = user?.role === 'professor' || user?.role === 'admin';
  const hasUnsavedProfileImage = profileImageUri !== savedProfileImageUri;
  const hasUnsavedProfileData =
    Boolean(user && savedUser) &&
    (user?.name !== savedUser?.name ||
      user?.last_name !== savedUser?.last_name ||
      user?.email !== savedUser?.email);
  const hasUnsavedProfileChanges = hasUnsavedProfileImage || hasUnsavedProfileData;

  const loadProfile = useCallback(async () => {
    if (!(await hasAuthToken())) {
      await clearAuthToken();
      router.replace('/login' as never);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentUser = await getCurrentUser();
      // A foto fica no Cloudinary; o usuário já vem com o link dela.
      const savedAvatarUri = currentUser.profile_picture_url ?? null;
      setUser(currentUser);
      setSavedUser(currentUser);
      setProfileImageUri(savedAvatarUri);
      setSavedProfileImageUri(savedAvatarUri);
      setCurrentPassword('');
    } catch (profileError) {
      if (isAuthSessionError(profileError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      setError(
        profileError instanceof Error
          ? profileError.message
          : 'Não foi possível carregar o perfil.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasUnsavedProfileChanges) {
        return undefined;
      }

      return setUnsavedChangesHandler((continueNavigation) => {
        setPendingNavigation(() => continueNavigation);
        return true;
      });
    }, [hasUnsavedProfileChanges]),
  );

  function updateUserField(field: 'email' | 'last_name' | 'name', value: string) {
    setUser((current) => (current ? { ...current, [field]: value } : current));
  }

  const requestLeave = useCallback(
    (continueNavigation: () => void) => {
      runWithUnsavedChangesGuard(continueNavigation);
    },
    [],
  );

  async function handleSignOut() {
    await clearAuthToken();
    router.replace('/login' as never);
  }

  async function handleUpdateProfile() {
    if (!user || !savedUser) {
      return;
    }

    const profileValidationMessage = hasUnsavedProfileData ? validateProfileData(user) : null;

    if (profileValidationMessage) {
      showToast({
        message: profileValidationMessage,
        type: 'warning',
      });
      return;
    }

    if (hasUnsavedProfileData && !currentPassword.trim()) {
      showToast({
        message: 'Informe sua senha atual para salvar os dados do perfil.',
        type: 'warning',
      });
      return;
    }

    const shouldClearPassword = hasUnsavedProfileData;
    setIsSavingProfile(true);

    try {
      let updatedUser = user;

      if (hasUnsavedProfileData) {
        await login({ email: savedUser.email, password: currentPassword });
        updatedUser = await updateUser(user.id, {
          birth_date: user.birth_date,
          email: user.email.trim(),
          is_active: user.is_active,
          last_name: user.last_name.trim(),
          name: user.name.trim(),
          password: currentPassword,
          ra: user.role === 'student' ? user.ra : null,
          role: user.role,
        });
        setUser(updatedUser);
      }

      if (profileImageUri && profileImageUri !== savedProfileImageUri) {
        await updateProfilePicture(user.id, profileImageUri);
        setSavedProfileImageUri(profileImageUri);
      } else if (!profileImageUri && savedProfileImageUri) {
        await deleteProfilePicture(user.id);
        setSavedProfileImageUri(null);
      }

      setSavedUser(updatedUser);
      setCurrentPassword('');
      showToast({ message: 'Perfil salvo com sucesso.', type: 'success' });
    } catch (profileError) {
      if (isAuthSessionError(profileError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      showToast({
        message:
          profileError instanceof Error
            ? profileError.message
            : 'Não foi possível salvar o perfil.',
        type: 'error',
      });
    } finally {
      if (shouldClearPassword) {
        setCurrentPassword('');
      }

      setIsSavingProfile(false);
    }
  }

  async function handleChangeProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showToast({
        message: 'Permita o acesso à galeria para escolher a foto.',
        type: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (!result.canceled) {
      setProfileImageUri(result.assets[0].uri);
    }
  }

  function cancelPendingNavigation() {
    setPendingNavigation(null);
  }

  function discardChangesAndLeave() {
    const continueNavigation = pendingNavigation;

    if (savedUser) {
      setUser(savedUser);
    }

    setCurrentPassword('');
    setProfileImageUri(savedProfileImageUri);
    setPendingNavigation(null);
    continueNavigation?.();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadProfile}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
        >
        {canManageEvents ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar para Gestão"
            onPress={() =>
              requestLeave(() =>
                router.canGoBack() ? router.back() : router.replace('/gestao' as never),
              )
            }
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={20} color="#30343A" />
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        ) : null}

        <Animatable.View
          animation="zoomIn"
          duration={440}
          style={styles.profileHeader}
          useNativeDriver
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
            onPress={handleChangeProfileImage}
            style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              {profileImageUri ? (
                <Image
                  source={{ uri: profileImageUri }}
                  contentFit="cover"
                  style={styles.profileImage}
                />
              ) : (
                <MaterialIcons name="person" size={76} color="#3A281D" />
              )}
            </View>
            <View style={styles.editBadge}>
              <MaterialIcons name="edit" size={16} color="#111111" />
            </View>
          </Pressable>
          {profileImageUri ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remover foto de perfil"
              disabled={isSavingProfile}
              onPress={() => setProfileImageUri(null)}
              style={styles.removePhotoButton}>
              <MaterialIcons name="delete-outline" size={15} color="#B42318" />
              <Text style={styles.removePhotoText}>Remover foto</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>Meu Perfil</Text>
        </Animatable.View>

        {isLoading ? (
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            style={styles.feedbackBox}
            useNativeDriver>
            <ActivityIndicator color="#111111" />
            <Text style={styles.feedbackText}>Carregando perfil...</Text>
          </Animatable.View>
        ) : null}

        {!isLoading && error ? (
          <Animatable.View animation="fadeIn" duration={320} style={styles.feedbackBox} useNativeDriver>
            <MaterialIcons name="warning" size={22} color="#B45309" />
            <Text style={styles.feedbackText}>{error}</Text>
          </Animatable.View>
        ) : null}

        {user ? (
          <View style={styles.profileBody}>
            <ProfileField
              editable
              delay={80}
              label="Nome"
              onChangeText={(value) => updateUserField('name', value)}
              value={user.name}
            />
            <ProfileField
              editable
              delay={140}
              label="Sobrenome"
              onChangeText={(value) => updateUserField('last_name', value)}
              value={user.last_name}
            />
            <ProfileField
              editable
              delay={200}
              label="E-mail institucional"
              onChangeText={(value) => updateUserField('email', value)}
              value={user.email}
            />
            <ProfileField delay={260} label="Conta" value={roleLabel(user.role).toUpperCase()} />
            {user.role === 'student' && user.ra ? (
              <ProfileField delay={320} label="RA" value={user.ra} />
            ) : null}

            {hasUnsavedProfileData ? (
              <ProfileField
                editable
                delay={340}
                label="Senha atual"
                onChangeText={setCurrentPassword}
                placeholder="Digite sua senha atual"
                secureTextEntry
                value={currentPassword}
              />
            ) : null}

            <Animatable.View animation="fadeInUp" delay={320} duration={360} useNativeDriver>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Atualizar dados"
                disabled={isSavingProfile}
                onPress={handleUpdateProfile}
                style={[styles.primaryButton, isSavingProfile ? styles.buttonDisabled : null]}>
                {isSavingProfile ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <MaterialIcons name="save" size={15} color="#111111" />
                )}
                <Text style={styles.primaryButtonText}>Atualizar dados</Text>
              </Pressable>
            </Animatable.View>

            {!canManageEvents ? (
              <Animatable.View animation="fadeInUp" delay={440} duration={360} useNativeDriver>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sair da conta"
                  onPress={() => requestLeave(() => void handleSignOut())}
                  style={styles.signOutButton}>
                  <MaterialIcons name="logout" size={15} color="#676C74" />
                  <Text style={styles.signOutText}>Sair da conta</Text>
                </Pressable>
              </Animatable.View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      <UnsavedChangesDialog
        visible={Boolean(pendingNavigation)}
        onCancel={cancelPendingNavigation}
        onDiscard={discardChangesAndLeave}
      />
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

function ProfileField({
  delay = 0,
  editable,
  label,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: {
  delay?: number;
  editable?: boolean;
  label: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  value: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={delay}
      duration={360}
      style={styles.fieldGroup}
      useNativeDriver>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        disabled={!editable}
        onPress={() => inputRef.current?.focus()}
        style={[styles.fieldBox, isFocused ? styles.fieldBoxFocused : null]}>
        <TextInput
          ref={inputRef}
          editable={Boolean(editable)}
          onBlur={() => setIsFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor="#9EA3AB"
          secureTextEntry={secureTextEntry}
          style={[styles.fieldValue, !editable ? styles.fieldValueDisabled : null]}
          value={value}
        />
        {editable ? <MaterialIcons name="edit" size={14} color="#8A8D94" /> : null}
      </Pressable>
    </Animatable.View>
  );
}

function roleLabel(role: CurrentUser['role']) {
  const labels = {
    admin: 'Administrador',
    professor: 'Professor',
    student: 'Aluno',
  };

  return labels[role];
}

function validateProfileData(user: CurrentUser) {
  if (!user.name.trim() || !user.last_name.trim()) {
    return 'Informe nome e sobrenome antes de salvar.';
  }

  if (!isInstitutionalEmail(user.email.trim())) {
    return 'Use um e-mail institucional da UTFPR.';
  }

  return null;
}

function isInstitutionalEmail(email: string) {
  return /^[^\s@]+@(alunos\.)?utfpr\.edu\.br$/i.test(email);
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    minHeight: 36,
    paddingHorizontal: 2,
  },
  backButtonText: {
    color: '#30343A',
    fontSize: 13,
    fontWeight: '700',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F9',
  },
  keyboardView: {
  flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 102,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 2,
  },
  avatarOuter: {
    alignItems: 'center',
    borderColor: '#FFCC00',
    borderRadius: 18,
    borderWidth: 3,
    height: 122,
    justifyContent: 'center',
    width: 122,
  },
  avatarInner: {
    alignItems: 'center',
    backgroundColor: '#C59A70',
    borderColor: '#222222',
    borderRadius: 14,
    borderWidth: 2,
    height: 106,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 106,
  },
  profileImage: {
    height: '100%',
    width: '100%',
  },
  editBadge: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 15,
    bottom: 8,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 30,
  },
  removePhotoButton: {
    alignItems: 'center',
    backgroundColor: '#FEE4E2',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    height: 30,
    marginTop: 12,
    paddingHorizontal: 10,
  },
  removePhotoText: {
    color: '#B42318',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#242424',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },
  feedbackBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 10,
    marginBottom: 18,
    padding: 18,
  },
  feedbackText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  profileBody: {
    gap: 17,
  },
  eventsArea: {
    gap: 14,
    marginTop: 2,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8D9DD',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
  },
  searchBoxFocused: {
    backgroundColor: '#FFFBEA',
    borderColor: '#FFCC00',
  },
  searchInput: {
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    height: '100%',
  },
  editableEventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minHeight: 78,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 1,
  },
  editableEventButton: {
    flex: 1,
    flexDirection: 'row',
  },
  eventAccent: {
    backgroundColor: '#FFCC00',
    width: 4,
  },
  editableEventContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editableEventTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  editableEventTitle: {
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 9,
  },
  eventMetaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
  },
  eventMetaText: {
    color: '#5F6670',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyEventsText: {
    color: '#7A7F87',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    color: '#303239',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  fieldBox: {
    alignItems: 'center',
    backgroundColor: '#F0F0F1',
    borderColor: '#F0F0F1',
    borderBottomColor: '#D7D7D9',
    borderBottomWidth: 1,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 12,
  },
  fieldBoxFocused: {
    backgroundColor: '#FFFBEA',
    borderBottomColor: '#FFCC00',
    borderColor: '#FFCC00',
  },
  fieldValue: {
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    height: '100%',
    paddingHorizontal: 0,
  },
  fieldValueDisabled: {
    color: '#20242A',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 16,
  },
  createEventButton: {
    marginTop: -5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#E5E5E6',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#4C535C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#E5E5E6',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
  },
  signOutText: {
    color: '#676C74',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
