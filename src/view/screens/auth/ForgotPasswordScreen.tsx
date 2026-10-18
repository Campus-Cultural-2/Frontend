import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
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

type FeedbackModalState = {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
};

const initialModal: FeedbackModalState = {
  visible: false,
  type: 'success',
  title: '',
  message: '',
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [modal, setModal] = useState<FeedbackModalState>(initialModal);

  function validateEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setEmailError('O e-mail é obrigatório.');
      return false;
    }

    if (!/^[a-z0-9._%+\-]+@(alunos\.)?utfpr\.edu\.br$/.test(normalizedEmail)) {
      setEmailError('Use seu e-mail institucional da UTFPR.');
      return false;
    }

    setEmailError(null);
    return true;
  }

  function handleSend() {
    if (!validateEmail()) {
      return;
    }

    setModal({
      visible: true,
      type: 'success',
      title: 'E-mail enviado',
      message: 'Se esse e-mail estiver cadastrado, você receberá as instruções em breve.',
    });
  }

  function closeModal() {
    setModal(initialModal);
    router.replace('/login' as never);
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
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/login' as never))}
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

          <Animatable.Text
            animation="fadeInUp"
            delay={140}
            duration={420}
            style={styles.title}
            useNativeDriver>
            Esqueceu{'\n'}sua senha?
          </Animatable.Text>

          <Animatable.Text
            animation="fadeInUp"
            delay={200}
            duration={420}
            style={styles.description}
            useNativeDriver>
            Insira o e-mail cadastrado para receber as instruções de recuperação.
          </Animatable.Text>

          <Animatable.View
            animation="fadeInUp"
            delay={260}
            duration={420}
            style={styles.inputWrapper}
            useNativeDriver>
            <Text style={styles.inputLabel}>
              E-mail <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View
              style={[
                styles.inputContainer,
                isEmailFocused ? styles.inputFocused : null,
                emailError ? styles.inputError : null,
              ]}>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onBlur={() => setIsEmailFocused(false)}
                onChangeText={(value) => {
                  setEmail(value);

                  if (emailError) {
                    setEmailError(null);
                  }
                }}
                onFocus={() => setIsEmailFocused(true)}
                placeholder="usuario@utfpr.edu.br"
                placeholderTextColor="#9E9E9E"
                style={styles.textInput}
                value={email}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={320} duration={420} useNativeDriver>
            <Pressable accessibilityRole="button" onPress={handleSend} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Enviar</Text>
              <Ionicons name="arrow-forward" size={20} color="#000000" />
            </Pressable>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FeedbackModal modal={modal} onClose={closeModal} />
    </SafeAreaView>
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
