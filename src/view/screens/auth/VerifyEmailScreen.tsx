import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as Animatable from 'react-native-animatable';
import { Pressable, Text } from 'react-native';

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
import { confirmEmailVerification, requestEmailVerification } from '@/src/lib/api/campus';
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
} from '@/src/lib/auth/pendingEmailVerification';
import { isInstitutionalEmail } from '@/src/lib/validation/user';

// O backend aceita um envio por e-mail a cada minuto.
const RESEND_COOLDOWN_MS = 60_000;

// O codigo enviado por e-mail tem 8 caracteres e vale por 15 minutos.
const CODE_LENGTH = 8;

type FormErrors = {
  email?: string;
  code?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível concluir a solicitação. Tente novamente.';
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  // Quem chega aqui pelo cadastro ou por um login bloqueado ja teve um codigo
  // enviado agora ha pouco. Se o app recarregou, o e-mail se perdeu e a tela
  // pede de novo; nesse caso nao ha envio recente para esperar.
  const [email, setEmail] = useState(() => getPendingEmailVerification() ?? '');
  const [lastSentAt, setLastSentAt] = useState<number | null>(() =>
    getPendingEmailVerification() ? Date.now() : null,
  );
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<AuthFeedbackModalState>(initialAuthFeedbackModal);

  function validateEmail(nextErrors: FormErrors) {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'O e-mail é obrigatório.';
    } else if (!isInstitutionalEmail(normalizedEmail)) {
      nextErrors.email = 'Use seu e-mail institucional da UTFPR.';
    }

    return normalizedEmail;
  }

  async function handleConfirm() {
    const nextErrors: FormErrors = {};
    const normalizedEmail = validateEmail(nextErrors);
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length !== CODE_LENGTH) {
      nextErrors.code = `O código tem ${CODE_LENGTH} caracteres.`;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmEmailVerification({ email: normalizedEmail, code: normalizedCode });
      clearPendingEmailVerification();
      setModal({
        visible: true,
        type: 'success',
        title: 'E-mail confirmado',
        message: 'Sua conta está ativa. Entre com seu e-mail e senha.',
      });
    } catch (error) {
      setModal({
        visible: true,
        type: 'error',
        title: 'Não foi possível confirmar',
        message: getErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    const elapsed = lastSentAt === null ? Infinity : Date.now() - lastSentAt;

    if (elapsed < RESEND_COOLDOWN_MS) {
      const seconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      setResendNotice(`Aguarde ${seconds}s para pedir outro código.`);
      return;
    }

    const nextErrors: FormErrors = {};
    const normalizedEmail = validateEmail(nextErrors);

    if (nextErrors.email) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await requestEmailVerification({ email: normalizedEmail });
      setLastSentAt(Date.now());
      setResendNotice('Se o e-mail estiver cadastrado, enviamos um novo código.');
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

  function closeModal() {
    const succeeded = modal.type === 'success';
    setModal(hideAuthFeedbackModal);

    if (succeeded) {
      router.replace('/login' as never);
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login' as never);
    }
  }

  function clearError(field: keyof FormErrors) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  return (
    <AuthScreen
      badge="Confirmação"
      onBack={handleBack}
      footer={<AuthFeedbackModal modal={modal} onClose={closeModal} />}>
      <Animatable.View animation="fadeInUp" duration={420} useNativeDriver>
        <Text style={authTextStyles.title}>Confirme seu{'\n'}e-mail</Text>
        <Text style={authTextStyles.description}>
          Enviamos um código de {CODE_LENGTH} caracteres para o e-mail do cadastro. Ele vale por
          15 minutos. Confira também a caixa de spam.
        </Text>

        <AuthField
          autoComplete="email"
          error={errors.email}
          focused={focusedField === 'email'}
          keyboardType="email-address"
          label="E-mail"
          onBlur={() => setFocusedField(null)}
          onChangeText={(value) => {
            setEmail(value);
            clearError('email');
          }}
          onFocus={() => setFocusedField('email')}
          placeholder="usuario@utfpr.edu.br"
          value={email}
        />

        <AuthField
          autoCapitalize="characters"
          error={errors.code}
          focused={focusedField === 'code'}
          label="Código"
          maxLength={CODE_LENGTH}
          onBlur={() => setFocusedField(null)}
          onChangeText={(value) => {
            setCode(value);
            clearError('code');
          }}
          onFocus={() => setFocusedField('code')}
          placeholder="ABCD2345"
          value={code}
        />

        <AuthPrimaryButton
          disabled={isSubmitting}
          label="Confirmar e-mail"
          loading={isSubmitting}
          onPress={() => void handleConfirm()}
        />

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleResend()}
          style={authTextStyles.secondaryAction}>
          <Text style={authTextStyles.secondaryActionText}>Não recebeu? Enviar outro código</Text>
        </Pressable>
        {resendNotice ? <Text style={authTextStyles.noticeText}>{resendNotice}</Text> : null}
      </Animatable.View>
    </AuthScreen>
  );
}
