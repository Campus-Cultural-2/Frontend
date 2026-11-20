// Pecas das telas de autenticacao que mostram formulario em passos: recuperar
// a senha e confirmar o e-mail. Ficam aqui porque mais de uma tela usa, como
// pede o docs/CODE_STYLE.md.

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- moldura da tela ---------------------------------------------------------

type AuthScreenProps = {
  badge: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack: () => void;
};

export function AuthScreen({ badge, children, footer, onBack }: AuthScreenProps) {
  return (
    <SafeAreaView style={frameStyles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={frameStyles.keyboardView}>
        <ScrollView
          contentContainerStyle={frameStyles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInLeft" duration={360} useNativeDriver>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={onBack}
              style={frameStyles.header}>
              <Ionicons name="arrow-back" size={20} color="#FFC107" />
              <Text style={frameStyles.headerText}>Voltar</Text>
            </Pressable>
          </Animatable.View>

          <Animatable.View
            animation="fadeIn"
            delay={100}
            duration={360}
            style={frameStyles.badgeContainer}
            useNativeDriver>
            <Text style={frameStyles.badgeText}>{badge}</Text>
          </Animatable.View>

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {footer}
    </SafeAreaView>
  );
}

// --- campo -------------------------------------------------------------------

type AuthFieldProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  error?: string | null;
  focused: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  label: string;
  maxLength?: number;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

export function AuthField({
  autoCapitalize = 'none',
  autoComplete,
  error,
  focused,
  keyboardType,
  label,
  maxLength,
  onBlur,
  onChangeText,
  onFocus,
  placeholder,
  secureTextEntry,
  value,
}: AuthFieldProps) {
  return (
    <View style={componentStyles.inputWrapper}>
      <Text style={componentStyles.inputLabel}>
        {label} <Text style={componentStyles.requiredAsterisk}>*</Text>
      </Text>
      <View
        style={[
          componentStyles.inputContainer,
          focused ? componentStyles.inputFocused : null,
          error ? componentStyles.inputError : null,
        ]}>
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor="#9E9E9E"
          secureTextEntry={secureTextEntry}
          style={componentStyles.textInput}
          value={value}
        />
      </View>
      {error ? <Text style={componentStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

// --- botao principal ---------------------------------------------------------

type AuthPrimaryButtonProps = {
  disabled: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
};

export function AuthPrimaryButton({ disabled, label, loading, onPress }: AuthPrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[componentStyles.primaryButton, disabled ? componentStyles.primaryButtonDisabled : null]}>
      <Text style={componentStyles.primaryButtonText}>{label}</Text>
      {loading ? (
        <ActivityIndicator color="#000000" />
      ) : (
        <Ionicons name="arrow-forward" size={20} color="#000000" />
      )}
    </Pressable>
  );
}

// --- modal de retorno --------------------------------------------------------

export type AuthFeedbackModalState = {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
};

export const initialAuthFeedbackModal: AuthFeedbackModalState = {
  visible: false,
  type: 'success',
  title: '',
  message: '',
};

// Para fechar, so esconda (visible: false) mantendo titulo, mensagem e cor.
// Voltar para o estado inicial trocaria o conteudo antes do fade de saida
// terminar, e um modal vermelho de erro piscaria como um verde vazio.
export function hideAuthFeedbackModal(current: AuthFeedbackModalState): AuthFeedbackModalState {
  return { ...current, visible: false };
}

type AuthFeedbackModalProps = {
  modal: AuthFeedbackModalState;
  onClose: () => void;
};

export function AuthFeedbackModal({ modal, onClose }: AuthFeedbackModalProps) {
  return (
    <Modal transparent animationType="fade" visible={modal.visible} onRequestClose={onClose}>
      <View style={componentStyles.modalOverlay}>
        <Animatable.View
          animation="zoomIn"
          duration={220}
          style={componentStyles.modalCard}
          useNativeDriver>
          <View
            style={[
              componentStyles.modalIconBox,
              modal.type === 'success'
                ? componentStyles.modalIconSuccess
                : componentStyles.modalIconError,
            ]}>
            <Ionicons
              name={modal.type === 'success' ? 'checkmark' : 'close'}
              size={28}
              color="#FFFFFF"
            />
          </View>
          <Text style={componentStyles.modalTitle}>{modal.title}</Text>
          <Text style={componentStyles.modalMessage}>{modal.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[
              componentStyles.modalButton,
              modal.type === 'success'
                ? componentStyles.modalButtonSuccess
                : componentStyles.modalButtonError,
            ]}>
            <Text style={componentStyles.modalButtonText}>OK</Text>
          </Pressable>
        </Animatable.View>
      </View>
    </Modal>
  );
}

// --- textos das telas --------------------------------------------------------

// Titulo, descricao e o link secundario, para as telas manterem o mesmo
// visual sem repetir os estilos.
export const authTextStyles = StyleSheet.create({
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
  descriptionEmphasis: {
    color: '#1A1A1A',
    fontWeight: '700',
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
});

const frameStyles = StyleSheet.create({
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
});

const componentStyles = StyleSheet.create({
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
  primaryButtonDisabled: {
    opacity: 0.6,
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
