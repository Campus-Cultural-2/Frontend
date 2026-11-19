import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmPasswordReset, requestPasswordReset } from '@/src/lib/api/campus';
import { getPasswordError, isInstitutionalEmail } from '@/src/lib/validation/user';

// O backend aceita um envio por e-mail a cada minuto. O app espera o mesmo
// tempo antes de deixar pedir outro, para nao prometer um e-mail que nao vai.
const RESEND_COOLDOWN_MS = 60_000;

// O codigo enviado por e-mail tem 8 caracteres e vale por 15 minutos.
const CODE_LENGTH = 8;

type Step = 'email' | 'code';

type FeedbackModalState = {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
};

type CodeFormErrors = {
  code?: string;
  password?: string;
  confirmPassword?: string;
};

const initialModal: FeedbackModalState = {
  visible: false,
  type: 'success',
  title: '',
  message: '',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível concluir a solicitação. Tente novamente.';
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeErrors, setCodeErrors] = useState<CodeFormErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<FeedbackModalState>(initialModal);

  function validateEmail() {
    // So trim, sem minusculas: o login e o cadastro tratam o e-mail do mesmo
    // jeito, e a busca no backend diferencia maiusculas.
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setEmailError('O e-mail é obrigatório.');
      return null;
    }

    if (!isInstitutionalEmail(normalizedEmail)) {
      setEmailError('Use seu e-mail institucional da UTFPR.');
      return null;
    }

    setEmailError(null);
    return normalizedEmail;
  }

  async function sendCode(normalizedEmail: string) {
    setIsSubmitting(true);

    try {
      await requestPasswordReset({ email: normalizedEmail });
      setLastSentAt(Date.now());
      setResendNotice(null);
      setStep('code');
    } catch (error) {
      setModal({
        visible: true,
        type: 'error',
        title: 'Não foi possível enviar',
        message: getErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSendCode() {
    const normalizedEmail = validateEmail();

    if (normalizedEmail) {
      void sendCode(normalizedEmail);
    }
  }

  function handleResend() {
    const elapsed = lastSentAt === null ? Infinity : Date.now() - lastSentAt;

    if (elapsed < RESEND_COOLDOWN_MS) {
      const seconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      setResendNotice(`Aguarde ${seconds}s para pedir outro código.`);
      return;
    }

    void sendCode(email.trim());
  }

  function validateCodeForm() {
    const nextErrors: CodeFormErrors = {};
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length !== CODE_LENGTH) {
      nextErrors.code = `O código tem ${CODE_LENGTH} caracteres.`;
    }

    const passwordError = getPasswordError(password);

    if (passwordError) {
      nextErrors.password = passwordError;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirme a nova senha.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não conferem';
    }

    setCodeErrors(nextErrors);
    return Object.keys(nextErrors).length === 0 ? normalizedCode : null;
  }

  async function handleResetPassword() {
    const normalizedCode = validateCodeForm();

    if (!normalizedCode) {
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset({
        email: email.trim(),
        code: normalizedCode,
        new_password: password,
      });
      setModal({
        visible: true,
        type: 'success',
        title: 'Senha redefinida',
        message: 'Sua senha foi alterada. Entre com a nova senha.',
      });
    } catch (error) {
      setModal({
        visible: true,
        type: 'error',
        title: 'Não foi possível redefinir',
        message: getErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeModal() {
    const succeeded = modal.type === 'success';
    // So esconde, mantendo titulo, mensagem e cor. Voltar para o estado
    // inicial aqui trocaria o conteudo antes do fade de saida terminar, e o
    // modal vermelho de erro piscaria como um modal verde vazio ao fechar.
    setModal((current) => ({ ...current, visible: false }));

    if (succeeded) {
      router.replace('/login' as never);
    }
  }

  function handleBack() {
    if (step === 'code') {
      setStep('email');
      setCodeErrors({});
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login' as never);
    }
  }

  function clearCodeError(field: keyof CodeFormErrors) {
    if (codeErrors[field]) {
      setCodeErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInLeft" duration={360} useNativeDriver>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              style={styles.header}>
              <Ionicons name="arrow-back" size={20} color="#FFC107" />
              <Text style={styles.headerText}>Voltar</Text>
            </Pressable>
          </Animatable.View>

          <Animatable.View
            animation="fadeIn"
            delay={100}
            duration={360}
            style={styles.badgeContainer}
            useNativeDriver>
            <Text style={styles.badgeText}>Segurança</Text>
          </Animatable.View>

          {step === 'email' ? (
            <Animatable.View key="email" animation="fadeInUp" duration={420} useNativeDriver>
              <Text style={styles.title}>Esqueceu{'\n'}sua senha?</Text>
              <Text style={styles.description}>
                Insira o e-mail cadastrado. Vamos enviar um código para você criar uma nova senha.
              </Text>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>
                  E-mail <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'email' ? styles.inputFocused : null,
                    emailError ? styles.inputError : null,
                  ]}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={(value) => {
                      setEmail(value);

                      if (emailError) {
                        setEmailError(null);
                      }
                    }}
                    onFocus={() => setFocusedField('email')}
                    placeholder="usuario@utfpr.edu.br"
                    placeholderTextColor="#9E9E9E"
                    style={styles.textInput}
                    value={email}
                  />
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>

              <PrimaryButton
                disabled={isSubmitting}
                label="Enviar código"
                loading={isSubmitting}
                onPress={handleSendCode}
              />
            </Animatable.View>
          ) : (
            <Animatable.View key="code" animation="fadeInUp" duration={420} useNativeDriver>
              <Text style={styles.title}>Digite o{'\n'}código</Text>
              <Text style={styles.description}>
                Se <Text style={styles.descriptionEmphasis}>{email.trim()}</Text> estiver
                cadastrado, enviamos um código de {CODE_LENGTH} caracteres. Ele vale por 15
                minutos. Confira também a caixa de spam.
              </Text>

              <Field
                autoCapitalize="characters"
                error={codeErrors.code}
                focused={focusedField === 'code'}
                label="Código"
                maxLength={CODE_LENGTH}
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => {
                  setCode(value);
                  clearCodeError('code');
                }}
                onFocus={() => setFocusedField('code')}
                placeholder="ABCD2345"
                value={code}
              />

              <Field
                error={codeErrors.password}
                focused={focusedField === 'password'}
                label="Nova senha"
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => {
                  setPassword(value);
                  clearCodeError('password');
                }}
                onFocus={() => setFocusedField('password')}
                placeholder="Mínimo de 8 caracteres"
                secureTextEntry
                value={password}
              />

              <Field
                error={codeErrors.confirmPassword}
                focused={focusedField === 'confirmPassword'}
                label="Confirmar nova senha"
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  clearCodeError('confirmPassword');
                }}
                onFocus={() => setFocusedField('confirmPassword')}
                placeholder="Repita a nova senha"
                secureTextEntry
                value={confirmPassword}
              />

              <PrimaryButton
                disabled={isSubmitting}
                label="Redefinir senha"
                loading={isSubmitting}
                onPress={() => void handleResetPassword()}
              />

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleResend}
                style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Não recebeu? Enviar outro código</Text>
              </Pressable>
              {resendNotice ? <Text style={styles.noticeText}>{resendNotice}</Text> : null}
            </Animatable.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <FeedbackModal modal={modal} onClose={closeModal} />
    </SafeAreaView>
  );
}

type FieldProps = {
  autoCapitalize?: 'none' | 'characters';
  error?: string;
  focused: boolean;
  label: string;
  maxLength?: number;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

function Field({
  autoCapitalize = 'none',
  error,
  focused,
  label,
  maxLength,
  onBlur,
  onChangeText,
  onFocus,
  placeholder,
  secureTextEntry,
  value,
}: FieldProps) {
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>
        {label} <Text style={styles.requiredAsterisk}>*</Text>
      </Text>
      <View
        style={[
          styles.inputContainer,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}>
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor="#9E9E9E"
          secureTextEntry={secureTextEntry}
          style={styles.textInput}
          value={value}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

type PrimaryButtonProps = {
  disabled: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
};

function PrimaryButton({ disabled, label, loading, onPress }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled ? styles.primaryButtonDisabled : null]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      {loading ? (
        <ActivityIndicator color="#000000" />
      ) : (
        <Ionicons name="arrow-forward" size={20} color="#000000" />
      )}
    </Pressable>
  );
}

type FeedbackModalProps = {
  modal: FeedbackModalState;
  onClose: () => void;
};

function FeedbackModal({ modal, onClose }: FeedbackModalProps) {
  return (
    <Modal transparent animationType="fade" visible={modal.visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animatable.View
          animation="zoomIn"
          duration={220}
          style={styles.modalCard}
          useNativeDriver>
          <View
            style={[
              styles.modalIconBox,
              modal.type === 'success' ? styles.modalIconSuccess : styles.modalIconError,
            ]}>
            <Ionicons name={modal.type === 'success' ? 'checkmark' : 'close'} size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.modalTitle}>{modal.title}</Text>
          <Text style={styles.modalMessage}>{modal.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[
              styles.modalButton,
              modal.type === 'success' ? styles.modalButtonSuccess : styles.modalButtonError,
            ]}>
            <Text style={styles.modalButtonText}>OK</Text>
          </Pressable>
        </Animatable.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 72,
  },
  headerText: {
    color: '#1D1D1F',
    fontSize: 16,
    fontWeight: '700',
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFC107',
    borderRadius: 3,
    marginBottom: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1A1A1A',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
    marginBottom: 24,
  },
  description: {
    color: '#555555',
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 44,
  },
  inputWrapper: {
    marginBottom: 42,
  },
  inputLabel: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  requiredAsterisk: {
    color: '#8A6D00',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#D7D7D7',
    borderBottomWidth: 2,
    paddingHorizontal: 8,
    paddingBottom: 12,
    paddingTop: 8,
  },
  inputFocused: {
    backgroundColor: '#FFFBEA',
    borderBottomColor: '#FFCC00',
  },
  inputError: {
    borderBottomColor: '#F04438',
  },
  textInput: {
    color: '#1A1A1A',
    fontSize: 17,
    paddingVertical: 0,
  },
  errorText: {
    color: '#F04438',
    fontSize: 11,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFC107',
    borderRadius: 7,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  descriptionEmphasis: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryAction: {
    alignSelf: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  secondaryActionText: {
    color: '#8A6D00',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  noticeText: {
    color: '#555555',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    width: '100%',
    elevation: 10,
  },
  modalIconBox: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 16,
    width: 56,
  },
  modalIconSuccess: {
    backgroundColor: '#22C55E',
  },
  modalIconError: {
    backgroundColor: '#F04438',
  },
  modalTitle: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#555555',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    alignItems: 'center',
    borderRadius: 6,
    height: 48,
    justifyContent: 'center',
    width: '100%',
  },
  modalButtonSuccess: {
    backgroundColor: '#FFC107',
  },
  modalButtonError: {
    backgroundColor: '#F04438',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
