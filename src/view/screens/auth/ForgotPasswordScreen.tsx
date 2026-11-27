import {
  useRouter } from 'expo-router';
import { useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  Platform,
  Pressable,
} from 'react-native';

import { AppText as Text } from '@/components/ui/app-text';
import {
  AuthFeedbackModal,
  type AuthFeedbackModalState,
  AuthField,
  AuthPrimaryButton,
  AuthScreen,
  authTextStyles,
  hideAuthFeedbackModal,
  initialAuthFeedbackModal,
} from '@/components/ui/auth-form';
import { confirmPasswordReset, requestPasswordReset } from '@/src/lib/api/campus';
import { getPasswordError, isInstitutionalEmail } from '@/src/lib/validation/user';

// O backend aceita um envio por e-mail a cada minuto. O app espera o mesmo
// tempo antes de deixar pedir outro, para nao prometer um e-mail que nao vai.
const RESEND_COOLDOWN_MS = 60_000;

// O codigo enviado por e-mail tem 8 caracteres e vale por 15 minutos.
const CODE_LENGTH = 8;

type Step = 'email' | 'code';

type CodeFormErrors = {
  code?: string;
  password?: string;
  confirmPassword?: string;
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
  const [modal, setModal] = useState<AuthFeedbackModalState>(initialAuthFeedbackModal);

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
    setModal(hideAuthFeedbackModal);

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
    <AuthScreen
      badge="Segurança"
      onBack={handleBack}
      footer={<AuthFeedbackModal modal={modal} onClose={closeModal} />}>
      {step === 'email' ? (
        <Animatable.View key="email" animation="fadeInUp" duration={420} useNativeDriver={Platform.OS !== 'web'}>
          <Text style={authTextStyles.title}>Esqueceu{'\n'}sua senha?</Text>
          <Text style={authTextStyles.description}>
            Insira o e-mail cadastrado. Vamos enviar um código para você criar uma nova senha.
          </Text>

          <AuthField
            autoComplete="email"
            error={emailError}
            focused={focusedField === 'email'}
            keyboardType="email-address"
            label="E-mail"
            onBlur={() => setFocusedField(null)}
            onChangeText={(value) => {
              setEmail(value);

              if (emailError) {
                setEmailError(null);
              }
            }}
            onFocus={() => setFocusedField('email')}
            placeholder="usuario@utfpr.edu.br"
            value={email}
          />

          <AuthPrimaryButton
            disabled={isSubmitting}
            label="Enviar código"
            loading={isSubmitting}
            onPress={handleSendCode}
          />
        </Animatable.View>
      ) : (
        <Animatable.View key="code" animation="fadeInUp" duration={420} useNativeDriver={Platform.OS !== 'web'}>
          <Text style={authTextStyles.title}>Digite o{'\n'}código</Text>
          <Text style={authTextStyles.description}>
            Se <Text style={authTextStyles.descriptionEmphasis}>{email.trim()}</Text> estiver
            cadastrado, enviamos um código de {CODE_LENGTH} caracteres. Ele vale por 15 minutos.
            Confira também a caixa de spam.
          </Text>

          <AuthField
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

          <AuthField
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

          <AuthField
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

          <AuthPrimaryButton
            disabled={isSubmitting}
            label="Redefinir senha"
            loading={isSubmitting}
            onPress={() => void handleResetPassword()}
          />

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleResend}
            style={authTextStyles.secondaryAction}>
            <Text style={authTextStyles.secondaryActionText}>Não recebeu? Enviar outro código</Text>
          </Pressable>
          {resendNotice ? <Text style={authTextStyles.noticeText}>{resendNotice}</Text> : null}
        </Animatable.View>
      )}
    </AuthScreen>
  );
}
