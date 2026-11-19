import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  View,
} from 'react-native';
import { DateType } from 'react-native-ui-datepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppToast } from '@/components/ui/app-toast';
import { login, registerUser, UserRole } from '@/src/lib/api/campus';
import { CampusDatePicker } from '@/components/ui/campus-date-picker';
import { useAppToast } from '@/src/view/hooks/useAppToast';

type RegisterRole = Exclude<UserRole, 'admin'>;

type RegisterForm = {
  role: RegisterRole;
  fullName: string;
  name: string;
  lastName: string;
  email: string;
  birthDate: Date | null;
  password: string;
  confirmPassword: string;
};

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const initialForm: RegisterForm = {
  role: 'student',
  fullName: '',
  name: '',
  lastName: '',
  email: '',
  birthDate: null,
  password: '',
  confirmPassword: '',
};

export default function RegisterScreen() {
  const router = useRouter();
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [draftBirthDate, setDraftBirthDate] = useState<Date>(new Date(2000, 0, 1));
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast, toast } = useAppToast();

  const isStudent = form.role === 'student';
  const birthDateLabel = useMemo(
    () => (form.birthDate ? formatDisplayDate(form.birthDate) : '31/01/1998'),
    [form.birthDate],
  );

  function updateField<Key extends keyof RegisterForm>(field: Key, value: RegisterForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  function openBirthDatePicker() {
    setDraftBirthDate(form.birthDate ?? new Date(2000, 0, 1));
    setShowBirthPicker(true);
  }

  function applyBirthDate() {
    updateField('birthDate', draftBirthDate);
    setShowBirthPicker(false);
  }

  function handleBirthPickerChange(date: DateType) {
    if (date) {
      setDraftBirthDate(toNativeDate(date));
    }
  }

  function validateForm() {
    const nextErrors: RegisterErrors = {};
    const normalizedEmail = form.email.trim();
    const fullNameParts = form.fullName.trim().split(/\s+/).filter(Boolean);

    if (isStudent) {
      if (fullNameParts.length < 2) {
        nextErrors.fullName = 'Informe nome e sobrenome';
      } else if (!hasOnlyLetters(form.fullName)) {
        nextErrors.fullName = 'Use apenas letras';
      }
    } else {
      if (!form.name.trim()) {
        nextErrors.name = 'Campo obrigatório';
      } else if (!hasOnlyLetters(form.name)) {
        nextErrors.name = 'Use apenas letras';
      }

      if (!form.lastName.trim()) {
        nextErrors.lastName = 'Campo obrigatório';
      } else if (!hasOnlyLetters(form.lastName)) {
        nextErrors.lastName = 'Use apenas letras';
      }
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Campo obrigatório';
    } else if (!isInstitutionalEmail(normalizedEmail)) {
      nextErrors.email = 'Use e-mail institucional da UTFPR';
    }

    if (!form.birthDate) {
      nextErrors.birthDate = 'Campo obrigatório';
    }

    if (!form.password) {
      nextErrors.password = 'Campo obrigatório';
    } else {
      const passwordError = getPasswordError(form.password);

      if (passwordError) {
        nextErrors.password = passwordError;
      }
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Campo obrigatório';
    } else if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não conferem';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function getNameParts() {
    if (!isStudent) {
      return {
        name: form.name.trim(),
        lastName: form.lastName.trim(),
      };
    }

    const [name, ...lastNameParts] = form.fullName.trim().split(/\s+/);

    return {
      name,
      lastName: lastNameParts.join(' '),
    };
  }

  async function handleRegister() {
    if (!validateForm() || !form.birthDate) {
      showToast({
        message: 'Preencha todos os campos obrigatórios para cadastrar.',
        type: 'warning',
      });
      return;
    }

    const nameParts = getNameParts();
    const normalizedEmail = form.email.trim();

    setIsSaving(true);

    try {
      await registerUser({
        role: form.role,
        email: normalizedEmail,
        name: nameParts.name,
        last_name: nameParts.lastName,
        birth_date: formatApiDate(form.birthDate),
        is_active: true,
        ra: null,
        password: form.password,
      });

      await login({
        email: normalizedEmail,
        password: form.password,
      });

      showToast({ message: 'Sua conta foi criada com sucesso.', type: 'success' });
      navigationTimerRef.current = setTimeout(() => {
        router.replace('/(tabs)' as never);
      }, 700);
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Verifique seus dados e tente novamente.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInLeft" duration={360} useNativeDriver>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/login' as never))}
              style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={22} color="#FFCC00" />
              <Text style={styles.backText}>Voltar</Text>
            </Pressable>
          </Animatable.View>

          <Animatable.View
            animation="fadeInDown"
            delay={80}
            duration={360}
            style={styles.roleSelector}
            useNativeDriver>
            <RoleButton
              isActive={form.role === 'student'}
              label="Aluno"
              onPress={() => {
                updateField('role', 'student');
                setErrors({});
              }}
            />
            <RoleButton
              isActive={form.role === 'professor'}
              label="Professor"
              onPress={() => {
                updateField('role', 'professor');
                setErrors({});
              }}
            />
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            delay={140}
            duration={420}
            style={styles.form}
            useNativeDriver>
            {isStudent ? (
              <FormInput
                error={errors.fullName}
                icon="person-outline"
                label="Nome e Sobrenome"
                onChangeText={(value) => updateField('fullName', value)}
                placeholder="Ex: Mariana Costa"
                value={form.fullName}
              />
            ) : (
              <>
                <FormInput
                  error={errors.name}
                  icon="person-outline"
                  label="Nome"
                  onChangeText={(value) => updateField('name', value)}
                  placeholder="Ex: Mariana"
                  value={form.name}
                />
                <FormInput
                  error={errors.lastName}
                  icon="person-outline"
                  label="Sobrenome"
                  onChangeText={(value) => updateField('lastName', value)}
                  placeholder="Ex: Costa"
                  value={form.lastName}
                />
              </>
            )}

            <FormInput
              autoCapitalize="none"
              error={errors.email}
              icon="mail-outline"
              keyboardType="email-address"
              label={isStudent ? 'E-mail' : 'E-mail Institucional'}
              onChangeText={(value) => updateField('email', value)}
              placeholder="usuario@utfpr.edu.br"
              value={form.email}
            />

            <View>
              <Text style={styles.label}>Data de Nascimento *</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Selecionar data de nascimento"
                onPress={openBirthDatePicker}
                style={[
                  styles.inputCard,
                  showBirthPicker ? styles.inputFocused : null,
                  errors.birthDate ? styles.inputError : null,
                ]}>
                <MaterialIcons name="calendar-today" size={20} color="#7C8794" />
                <Text style={[styles.dateText, form.birthDate ? styles.dateTextFilled : null]}>
                  {birthDateLabel}
                </Text>
              </Pressable>
              <Text style={[styles.errorText, !errors.birthDate && styles.hiddenText]}>
                {errors.birthDate ?? ' '}
              </Text>
            </View>

            <FormInput
              error={errors.password}
              icon="lock-outline"
              label="Senha"
              onChangeText={(value) => updateField('password', value)}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
              value={form.password}
            />

            <FormInput
              error={errors.confirmPassword}
              icon="shield"
              label="Confirmar Senha"
              onChangeText={(value) => updateField('confirmPassword', value)}
              placeholder="Repita sua senha"
              secureTextEntry
              value={form.confirmPassword}
            />
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={220} duration={420} useNativeDriver>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={handleRegister}
              style={[styles.submitButton, isSaving ? styles.submitButtonDisabled : null]}>
              {isSaving ? <ActivityIndicator color="#111111" /> : null}
              <Text style={styles.submitButtonText}>Cadastrar</Text>
            </Pressable>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={showBirthPicker}
        onRequestClose={() => setShowBirthPicker(false)}>
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation="zoomIn"
            duration={220}
            style={styles.datePopover}
            useNativeDriver>
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>Data de nascimento</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar seletor"
                onPress={() => setShowBirthPicker(false)}
                hitSlop={10}>
                <MaterialIcons name="close" size={22} color="#5F6670" />
              </Pressable>
            </View>
            <CampusDatePicker
              date={draftBirthDate}
              endYear={new Date().getFullYear()}
              firstDayOfWeek={0}
              locale="pt-br"
              maxDate={new Date()}
              onChange={(params) => handleBirthPickerChange(params.date)}
              startYear={1940}
            />
            <View style={styles.popoverActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowBirthPicker(false)}
                style={styles.popoverCancelButton}>
                <Text style={styles.popoverCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={applyBirthDate}
                style={styles.popoverConfirmButton}>
                <Text style={styles.popoverConfirmText}>Aplicar</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </View>
      </Modal>
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

type RoleButtonProps = {
  isActive: boolean;
  label: string;
  onPress: () => void;
};

function RoleButton({ isActive, label, onPress }: RoleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.roleButton, isActive ? styles.roleButtonActive : null]}>
      <Text style={[styles.roleButtonText, isActive ? styles.roleButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

type FormInputProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  keyboardType?: 'default' | 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

function FormInput({
  autoCapitalize,
  error,
  icon,
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label} *</Text>
      <View
        style={[
          styles.inputCard,
          isFocused ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}>
        <MaterialIcons name={icon} size={20} color="#7C8794" />
        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onBlur={() => setIsFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor="#7C8794"
          secureTextEntry={secureTextEntry}
          style={styles.input}
          value={value}
        />
      </View>
      <Text style={[styles.errorText, !error && styles.hiddenText]}>{error ?? ' '}</Text>
    </View>
  );
}

function formatDisplayDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(value);
}

function toNativeDate(value: DateType) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date(2000, 0, 1);
}

function formatApiDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function hasOnlyLetters(value: string) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(value.trim());
}

function isInstitutionalEmail(value: string) {
  return /^[a-z0-9._%+\-]+@(alunos\.)?utfpr\.edu\.br$/i.test(value.trim());
}

function getPasswordError(value: string) {
  if (value.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres';
  }

  if (!/[0-9]/.test(value)) {
    return 'A senha deve conter pelo menos um número';
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'A senha deve conter pelo menos um caractere especial';
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 18,
    minHeight: 38,
  },
  backText: {
    color: '#1D1D1F',
    fontSize: 17,
    fontWeight: '900',
  },
  roleSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 8,
    marginTop: 44,
    padding: 6,
  },
  roleButton: {
    alignItems: 'center',
    borderRadius: 5,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#FFCC00',
  },
  roleButtonText: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  roleButtonTextActive: {
    color: '#111111',
  },
  form: {
    gap: 3,
    marginTop: 34,
  },
  label: {
    color: '#1F1F1F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.03,
    shadowRadius: 18,
    elevation: 1,
  },
  inputError: {
    borderColor: '#F04438',
  },
  inputFocused: {
    backgroundColor: '#FFFBEA',
    borderColor: '#FFCC00',
  },
  input: {
    color: '#1F2937',
    flex: 1,
    fontSize: 15,
    minHeight: 54,
    paddingHorizontal: 0,
  },
  dateText: {
    color: '#7C8794',
    flex: 1,
    fontSize: 15,
  },
  dateTextFilled: {
    color: '#1F2937',
  },
  errorText: {
    color: '#F04438',
    fontSize: 11,
    minHeight: 18,
    paddingTop: 4,
  },
  hiddenText: {
    opacity: 0,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 3,
    flexDirection: 'row',
    gap: 10,
    height: 60,
    justifyContent: 'center',
    marginTop: 28,
    shadowColor: '#C68F00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitButtonText: {
    color: '#3F3300',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 17, 17, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  datePopover: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxWidth: 430,
    padding: 16,
    width: '100%',
  },
  popoverHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  popoverTitle: {
    color: '#20242A',
    fontSize: 17,
    fontWeight: '900',
  },
  popoverActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  popoverCancelButton: {
    alignItems: 'center',
    backgroundColor: '#ECEDEF',
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    minWidth: 104,
    paddingHorizontal: 16,
  },
  popoverCancelText: {
    color: '#5F6670',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  popoverConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    minWidth: 104,
    paddingHorizontal: 16,
  },
  popoverConfirmText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
