import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  ActivityIndicator,
  Image,
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

import { AppToast } from '@/components/ui/app-toast';
import { hasAuthToken, login } from '@/src/lib/api/campus';
import { useAppToast } from '@/src/view/hooks/useAppToast';

const logoUtf = require('@/assets/logoUTF.png');

type FocusedField = 'email' | 'password' | null;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast, toast } = useAppToast();

  useEffect(() => {
    async function redirectAuthenticatedUser() {
      if (await hasAuthToken()) {
        router.replace('/(tabs)' as never);
      }
    }

    void redirectAuthenticatedUser();
  }, [router]);

  async function handleLogin() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      showToast({ message: 'Informe e-mail e senha para entrar.', type: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await login({ email: normalizedEmail, password });
      router.replace('/(tabs)' as never);
    } catch (error) {
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
            useNativeDriver>
            <Image source={logoUtf} resizeMode="contain" style={styles.logoImage} />
            <Text style={styles.brand}>UTFPR CULTURAL</Text>
            <Text style={styles.subtitle}>ACESSO INSTITUCIONAL</Text>
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            delay={140}
            duration={460}
            style={styles.card}
            useNativeDriver>
            <View>
              <Text style={styles.label}>Email *</Text>
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
              <Text style={styles.label}>Senha *</Text>
              <View style={[styles.inputLine, focusedField === 'password' ? styles.inputLineFocused : null]}>
                <TextInput
                  autoCapitalize="none"
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#B9B9B9"
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
                <MaterialIcons name="lock-outline" size={24} color="#C8C8C8" />
              </View>
            </View>

            <Animatable.View animation="fadeIn" delay={300} useNativeDriver>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={handleLogin}
                style={[styles.loginButton, isLoading ? styles.loginButtonDisabled : null]}>
                {isLoading ? <ActivityIndicator color="#111111" /> : null}
                <Text style={styles.loginButtonText}>Entrar</Text>
              </Pressable>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
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
    color: '#202020',
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
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F0F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 28,
    paddingHorizontal: 30,
    paddingVertical: 32,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 18,
    elevation: 2,
  },
  label: {
    color: '#222222',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  inputLine: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E3E3E3',
    borderBottomWidth: 2,
    flexDirection: 'row',
    height: 42,
  },
  inputLineFocused: {
    backgroundColor: '#FFFBEA',
    borderBottomColor: '#FFCC00',
  },
  input: {
    color: '#222222',
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingHorizontal: 0,
  },
  loginButton: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 3,
    flexDirection: 'row',
    gap: 10,
    height: 58,
    justifyContent: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
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
