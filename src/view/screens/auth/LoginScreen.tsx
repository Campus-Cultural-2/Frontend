import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppButton, AppFieldLabel, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import { AppToast } from '@/components/ui/app-toast';
import {
  hasAuthToken,
  isEmailNotVerifiedError,
  login,
  requestEmailVerification,
} from '@/src/lib/api/campus';
import { setPendingEmailVerification } from '@/src/lib/auth/pendingEmailVerification';
import { useAppToast } from '@/src/view/hooks/useAppToast';

const logoUtf = require('@/assets/logoUTF.png');

type FocusedField = 'email' | 'password' | null;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPressingPasswordEye = useRef(false);
  const passwordVisibilityTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast, toast } = useAppToast();

  useEffect(() => {
    async function redirectAuthenticatedUser() {
      if (await hasAuthToken()) {
        router.replace('/(tabs)/(main)' as never);
      }
    }

    void redirectAuthenticatedUser();
  }, [router]);

  useEffect(
    () => () => {
      if (passwordVisibilityTimeout.current !== null) {
        clearTimeout(passwordVisibilityTimeout.current);
      }
    },
    [],
  );

  async function handleLogin() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      showToast({ message: 'Informe e-mail e senha para entrar.', type: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await login({ email: normalizedEmail, password });
      router.replace('/(tabs)/(main)' as never);
    } catch (error) {
      if (isEmailNotVerifiedError(error)) {
        // Senha certa, e-mail ainda nao confirmado. Pede um codigo novo, ja
        // que o do cadastro pode ter vencido, e leva para a tela do codigo.
        setPendingEmailVerification(normalizedEmail);
        await requestEmailVerification({ email: normalizedEmail }).catch(() => undefined);
        router.push('/verificar-email' as never);
        return;
      }

      showToast({
        message: error instanceof Error ? error.message : 'Verifique seus dados e tente novamente.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}>
        <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}>
          <Animatable.View
            animation="zoomIn"
            duration={460}
            style={styles.logoBlock}
            useNativeDriver={Platform.OS !== 'web'}>
            <Image source={logoUtf} resizeMode="contain" style={styles.logoImage} />
            <Text style={styles.brand}>UTFPR CULTURAL</Text>
            <Text style={styles.subtitle}>ACESSO INSTITUCIONAL</Text>
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            delay={140}
            duration={460}
            style={styles.card}
            useNativeDriver={Platform.OS !== 'web'}>
            <View>
              <AppFieldLabel label="E-mail" required style={styles.sharedFieldLabel} />
              <View style={[styles.inputLine, focusedField === 'email' ? styles.inputLineFocused : null]}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  placeholder="usuario@utfpr.edu.br"
                  placeholderTextColor="#B9B9B9"
                  style={styles.input}
                  value={email}
                />
                <MaterialIcons name="alternate-email" size={24} color="#C8C8C8" />
              </View>
            </View>

            <View>
              <AppFieldLabel label="Senha" required style={styles.sharedFieldLabel} />
              <View style={[styles.inputLine, focusedField === 'password' ? styles.inputLineFocused : null]}>
                <TextInput
                  autoCapitalize="none"
                  onBlur={() => {
                    setFocusedField(null);
                    // Pressionar o olho pode tirar o foco do TextInput em alguns
                    // aparelhos. Nesse caso, mantemos a senha visível durante o prazo de ocultação.
                    if (
                      !isPressingPasswordEye.current &&
                      passwordVisibilityTimeout.current === null
                    ) {
                      setIsPasswordVisible(false);
                    }
                  }}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#B9B9B9"
                  secureTextEntry={!isPasswordVisible}
                  style={styles.input}
                  value={password}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isPasswordVisible
                      ? 'Senha visível. Ela será ocultada dois segundos após soltar.'
                      : 'Segure para visualizar a senha.'
                  }
                  accessibilityState={{ selected: isPasswordVisible }}
                  disabled={isLoading}
                  hitSlop={10}
                  onPressIn={() => {
                    if (passwordVisibilityTimeout.current !== null) {
                      clearTimeout(passwordVisibilityTimeout.current);
                      passwordVisibilityTimeout.current = null;
                    }
                    isPressingPasswordEye.current = true;
                    setIsPasswordVisible(true);
                  }}
                  onPressOut={() => {
                    isPressingPasswordEye.current = false;
                    if (passwordVisibilityTimeout.current !== null) {
                      clearTimeout(passwordVisibilityTimeout.current);
                    }
                    passwordVisibilityTimeout.current = setTimeout(() => {
                      passwordVisibilityTimeout.current = null;
                      setIsPasswordVisible(false);
                    }, 2000);
                  }}
                  style={styles.passwordVisibilityButton}>
                  <MaterialIcons
                    name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                    size={22}
                    color={password.length > 0 ? '#777777' : '#C8C8C8'}
                  />
                </Pressable>
              </View>
            </View>

            <Animatable.View animation="fadeIn" delay={300} useNativeDriver={Platform.OS !== 'web'}>
              <AppButton
                label="Entrar"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
                onPress={handleLogin}
                style={styles.loginAction}
              />
            </Animatable.View>

            <View style={styles.cardActions}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/cadastro' as never)}>
                <Text style={styles.cardActionText}>Cadastrar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/esqueceu-senha' as never)}>
                <Text style={styles.cardActionText}>Esqueceu a senha</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { ...appLayoutStyles.screen },
  container: {
    flex: 1,
  },
  content: {
    ...appLayoutStyles.authContent,
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 28,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 34,
  },
  logoImage: {
    height: 96,
    width: 260,
  },
  brand: {
    color: colors.text.primary,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 28,
  },
  subtitle: {
    color: '#4F4F4F',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  card: {
    ...appSurfaceStyles.card,
    borderRadius: 16,
    gap: 28,
    paddingHorizontal: 30,
    paddingVertical: 32,
    boxShadow: '0px 8px 18px rgba(17, 17, 17, 0.03)',
    elevation: 2,
  },
  sharedFieldLabel: { marginBottom: 14 },
  inputLine: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderBottomColor: '#E3E3E3',
    borderBottomWidth: 2,
    flexDirection: 'row',
    height: 42,
  },
  inputLineFocused: {
    backgroundColor: colors.brand.soft,
    borderBottomColor: colors.brand.primary,
  },
  passwordVisibilityButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  input: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingHorizontal: 0,
  },
  loginAction: { marginTop: 10 },
  cardActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cardActionText: {
    color: '#4F4A45',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
