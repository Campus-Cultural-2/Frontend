import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DateType } from 'react-native-ui-datepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppToast } from '@/components/ui/app-toast';
import { CampusDatePicker } from '@/components/ui/campus-date-picker';
import { createEvent, getValidAuthSession, isAuthSessionError } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';
import {
  CAMPUS_TIME_ZONE,
  formatCampusDateTimeLabel,
  toCampusDateTimeIso,
} from '@/src/lib/datetime/campusTime';
import { useAppToast } from '@/src/view/hooks/useAppToast';

const PRIMARY = '#FFCC00';
const INK = '#171717';
const MUTED = '#737982';
const BACKGROUND = '#FAFAFA';
const DESCRIPTION_LIMIT = 500;

const CATEGORIES = [
  'Atividades acadêmicas',
  'Palestra',
  'Oficina',
  'Workshop',
  'Evento cultural',
  'Outros',
];

type EventWizardForm = {
  name: string;
  dateTime: string;
  place: string;
  description: string;
  workload: string;
  category: string;
  capacity: string;
  issueCertificate: boolean;
};

type WizardStep = 1 | 2 | 3 | 4;

const INITIAL_FORM: EventWizardForm = {
  name: '',
  dateTime: '',
  place: '',
  description: '',
  workload: '20',
  category: 'Atividades acadêmicas',
  capacity: '120',
  issueCertificate: true,
};

export default function EventCreationWizard() {
  const router = useRouter();
  const { showToast, toast } = useAppToast();
  const [form, setForm] = useState<EventWizardForm>(INITIAL_FORM);
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draftDate, setDraftDate] = useState<Date>(() => getDefaultDate());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedEventId, setPublishedEventId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof EventWizardForm, string>>>({});

  const descriptionReachedLimit = form.description.length >= DESCRIPTION_LIMIT;
  const eventDateSummary = useMemo(() => {
    if (!selectedDate) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: CAMPUS_TIME_ZONE,
    }).format(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    let active = true;

    async function checkPermission() {
      try {
        const session = await getValidAuthSession();
        if (!active) return;

        if (session.payload.role !== 'professor') {
          router.replace('/calendario' as never);
          return;
        }
        setHasPermission(true);
      } catch (error) {
        if (!active) return;
        if (isAuthSessionError(error)) {
          await clearAuthToken();
          router.replace('/login' as never);
        } else {
          showToast({
            message: 'Não foi possível verificar suas permissões para gerenciar eventos.',
            type: 'error',
          });
          router.replace('/calendario' as never);
        }
      } finally {
        if (active) setIsCheckingPermission(false);
      }
    }

    void checkPermission();
    return () => {
      active = false;
    };
  }, [router, showToast]);

  function updateField<K extends keyof EventWizardForm>(field: K, value: EventWizardForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openDatePicker() {
    setDraftDate(selectedDate ?? getDefaultDate());
    setIsDatePickerVisible(true);
  }

  function handleDatePickerChange(value: DateType) {
    const date = toNativeDate(value);
    if (date) setDraftDate(date);
  }

  function confirmDate() {
    if (draftDate.getTime() <= Date.now()) {
      setErrors((current) => ({ ...current, dateTime: 'Escolha uma data e horário futuros.' }));
      showToast({ message: 'O evento precisa ter data e horário futuros.', type: 'warning' });
      return;
    }

    setSelectedDate(draftDate);
    updateField('dateTime', formatCampusDateTimeLabel(draftDate));
    setIsDatePickerVisible(false);
  }

  function validateInformation() {
    const nextErrors: Partial<Record<keyof EventWizardForm, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Informe o nome do evento.';
    if (!selectedDate || selectedDate.getTime() <= Date.now()) {
      nextErrors.dateTime = 'Escolha uma data e horário futuros.';
    }
    if (!form.place.trim()) nextErrors.place = 'Informe o local do evento.';
    if (!form.description.trim()) nextErrors.description = 'Informe uma descrição.';
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      showToast({ message: 'Preencha os campos obrigatórios para continuar.', type: 'warning' });
      return false;
    }
    return true;
  }

  function validateCertificateDetails() {
    const nextErrors: Partial<Record<keyof EventWizardForm, string>> = {};
    const workload = Number(form.workload);
    const capacity = Number(form.capacity);
    if (!Number.isFinite(workload) || workload <= 0) {
      nextErrors.workload = 'Informe uma carga horária válida.';
    }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      nextErrors.capacity = 'Informe uma capacidade válida.';
    }
    setErrors((current) => ({ ...current, ...nextErrors }));
    if (Object.keys(nextErrors).length) {
      showToast({ message: 'Confira a carga horária e o limite de participantes.', type: 'warning' });
      return false;
    }
    return true;
  }

  async function publishEvent() {
    if (!selectedDate) return;
    setIsPublishing(true);
    try {
      // A API presente neste projeto aceita somente os campos básicos do evento.
      // Certificado, categoria, carga horária e capacidade ainda não fazem parte do contrato atual.
      const createdEvent = await createEvent({
        name: form.name.trim(),
        event_datetime: toCampusDateTimeIso(selectedDate),
        event_location: form.place.trim(),
        description: form.description.trim(),
        image: null,
      });
      setPublishedEventId(createdEvent.id);
      setStep(4);
    } catch (error) {
      if (isAuthSessionError(error)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }
      showToast({
        message: error instanceof Error ? error.message : 'Não foi possível publicar o evento. Tente novamente.',
        type: 'error',
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function shareEvent() {
    const message = `${form.name}\n${eventDateSummary} · ${selectedDate ? formatCampusDateTimeLabel(selectedDate).split('·').pop()?.trim() : ''}\n${form.place}`;
    try {
      await Share.share({ message });
    } catch {
      showToast({ message: 'Não foi possível abrir o compartilhamento neste dispositivo.', type: 'warning' });
    }
  }

  if (isCheckingPermission || !hasPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Verificando permissões...</Text>
        </View>
        <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step < 4 ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                onPress={() => {
                  if (step === 1) {
                    router.replace('/calendario' as never);
                  } else {
                    setStep((current) => (current - 1) as WizardStep);
                  }
                }}
                style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={20} color={PRIMARY} />
                <Text style={styles.backText}>Voltar</Text>
              </Pressable>

              <View style={styles.titleBlock}>
                <Text style={styles.pageTitle}>
                  {step === 1 ? 'Novo evento' : step === 2 ? 'Certificado e vagas' : 'Revisar evento'}
                </Text>
                <Text style={styles.pageSubtitle}>
                  {step === 1
                    ? 'Etapa 1 de 3 · Informações principais'
                    : step === 2
                      ? 'Etapa 2 de 3 · Regras de participação'
                      : 'Etapa 3 de 3 · Confirme antes de publicar'}
                </Text>
              </View>

              <View style={styles.progressRow}>
                {[1, 2, 3].map((item) => (
                  <View
                    key={item}
                    style={[styles.progressSegment, item <= step ? styles.progressSegmentActive : null]}
                  />
                ))}
              </View>

              {step === 1 ? (
                <View style={styles.formSection}>
                  <WizardInput
                    label="Nome do evento"
                    required
                    placeholder="Ex.: Semana Acadêmica de Tecnologia"
                    value={form.name}
                    onChangeText={(value) => updateField('name', value)}
                    error={errors.name}
                    icon="auto-awesome"
                  />

                  <View style={styles.twoColumnRow}>
                    <View style={styles.flexField}>
                      <WizardInput
                        label="Data e horário"
                        required
                        placeholder="Selecione a data"
                        value={form.dateTime}
                        onPress={openDatePicker}
                        error={errors.dateTime}
                        icon="calendar-today"
                      />
                    </View>
                    <View style={styles.timeHintField}>
                      <Text style={styles.fieldLabel}>HORÁRIO</Text>
                      <Pressable onPress={openDatePicker} style={styles.inputShell}>
                        <MaterialIcons name="schedule" size={17} color="#777E87" />
                        <Text style={[styles.inputValue, !selectedDate ? styles.placeholder : null]}>
                          {selectedDate
                            ? new Intl.DateTimeFormat('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: CAMPUS_TIME_ZONE,
                              }).format(selectedDate)
                            : '09:00'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <WizardInput
                    label="Local"
                    required
                    placeholder="Ex.: Centro de Convenções · UTFPR"
                    value={form.place}
                    onChangeText={(value) => updateField('place', value)}
                    error={errors.place}
                    icon="place"
                  />

                  <View>
                    <Text style={styles.fieldLabel}>DESCRIÇÃO <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      multiline
                      maxLength={DESCRIPTION_LIMIT}
                      onChangeText={(value) => updateField('description', value)}
                      placeholder="Informe agenda, público-alvo e requisitos."
                      placeholderTextColor="#A4A9B0"
                      style={[styles.descriptionInput, errors.description ? styles.inputError : null]}
                      textAlignVertical="top"
                      value={form.description}
                    />
                    <View style={styles.descriptionFooter}>
                      <Text style={errors.description ? styles.errorText : styles.descriptionHint}>{errors.description ?? 'Inclua agenda, público-alvo e requisitos.'}</Text>
                      <Text style={[styles.counterText, descriptionReachedLimit ? styles.counterLimit : null]}>
                        {form.description.length}/{DESCRIPTION_LIMIT}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.savedNotice}>
                    <MaterialIcons name="check-circle" size={17} color="#24734F" />
                    <View style={styles.noticeTextWrap}>
                      <Text style={styles.noticeTitle}>Dados principais salvos</Text>
                      <Text style={styles.noticeSubtitle}>Você poderá revisar tudo antes de publicar.</Text>
                    </View>
                  </View>

                  <PrimaryButton
                    label="Continuar"
                    icon="arrow-forward"
                    onPress={() => {
                      if (validateInformation()) setStep(2);
                    }}
                  />
                </View>
              ) : null}

              {step === 2 ? (
                <View style={styles.formSection}>
                  <View style={styles.certificateCard}>
                    <View style={styles.certificateCopy}>
                      <Text style={styles.cardTitle}>Emitir certificado</Text>
                      <Text style={styles.cardDescription}>
                        Disponível aos participantes elegíveis após o evento.
                      </Text>
                    </View>
                    <Switch
                      accessibilityLabel="Emitir certificado"
                      value={form.issueCertificate}
                      onValueChange={(value) => updateField('issueCertificate', value)}
                      trackColor={{ false: '#D5D8DC', true: PRIMARY }}
                      thumbColor={form.issueCertificate ? INK : '#FFFFFF'}
                    />
                  </View>

                  <View style={styles.twoColumnRow}>
                    <View style={styles.flexField}>
                      <WizardInput
                        label="Carga horária"
                        required
                        value={form.workload}
                        onChangeText={(value) => updateField('workload', value.replace(/[^0-9]/g, ''))}
                        error={errors.workload}
                        icon="schedule"
                        suffix="horas"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.flexField}>
                      <Text style={styles.fieldLabel}>GRUPO / CATEGORIA <Text style={styles.required}>*</Text></Text>
                      <Pressable
                        onPress={() => setIsCategoryPickerVisible(true)}
                        style={styles.inputShell}>
                        <MaterialIcons name="layers" size={17} color="#777E87" />
                        <Text numberOfLines={1} style={styles.inputValue}>{form.category}</Text>
                        <MaterialIcons name="expand-more" size={18} color="#737982" />
                      </Pressable>
                    </View>
                  </View>

                  <WizardInput
                    label="Limite máximo de participantes"
                    required
                    placeholder="120 participantes"
                    value={form.capacity}
                    onChangeText={(value) => updateField('capacity', value.replace(/[^0-9]/g, ''))}
                    error={errors.capacity}
                    icon="people-outline"
                    suffix="participantes"
                    keyboardType="numeric"
                  />

                  <View style={styles.integrationCard}>
                    <MaterialIcons name="extension" size={19} color="#4E535B" />
                    <View style={styles.noticeTextWrap}>
                      <Text style={styles.cardTitleSmall}>Integração acadêmica</Text>
                      <Text style={styles.cardDescriptionSmall}>
                        O envio oficial das horas ao sistema institucional será disponibilizado futuramente.
                      </Text>
                    </View>
                  </View>

                  <PrimaryButton
                    label="Revisar evento"
                    icon="arrow-forward"
                    onPress={() => {
                      if (validateCertificateDetails()) setStep(3);
                    }}
                  />
                </View>
              ) : null}

              {step === 3 ? (
                <View style={styles.reviewSection}>
                  <View style={styles.reviewCard}>
                    <View style={styles.reviewTopLine}>
                      <Text style={styles.reviewEventName}>{form.name.trim()}</Text>
                      <View style={styles.draftBadge}><Text style={styles.draftBadgeText}>RASCUNHO</Text></View>
                    </View>
                    <View style={styles.horizontalRule} />
                    <ReviewLine icon="event" label="DATA E HORÁRIO" value={selectedDate ? `${eventDateSummary} · ${formatCampusDateTimeLabel(selectedDate).split('·').pop()?.trim()}` : ''} />
                    <ReviewLine icon="place" label="LOCAL" value={form.place.trim()} />
                    <Text style={styles.reviewDescription}>{form.description.trim()}</Text>
                  </View>

                  <View style={styles.reviewCard}>
                    <View style={styles.reviewTopLine}>
                      <Text style={styles.cardTitle}>Certificação</Text>
                      <View style={[styles.statusBadge, !form.issueCertificate ? styles.statusBadgeOff : null]}>
                        <Text style={[styles.statusBadgeText, !form.issueCertificate ? styles.statusBadgeTextOff : null]}>
                          {form.issueCertificate ? 'HABILITADA' : 'DESABILITADA'}
                        </Text>
                      </View>
                    </View>
                    <ReviewLine icon="schedule" label="CARGA HORÁRIA" value={`${form.workload} horas`} />
                    <ReviewLine icon="layers" label="CATEGORIA" value={form.category} />
                    <ReviewLine icon="people-outline" label="CAPACIDADE" value={`${form.capacity} pessoas`} />
                  </View>

                  <PrimaryButton
                    label={isPublishing ? 'Publicando...' : 'Publicar evento'}
                    icon="send"
                    disabled={isPublishing}
                    onPress={() => void publishEvent()}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={isPublishing}
                    onPress={() => setStep(2)}
                    style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Voltar e editar</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.successSection}>
              <Text style={styles.pageTitle}>Evento publicado</Text>
              <Text style={styles.pageSubtitle}>A programação já está disponível.</Text>
              <View style={styles.successCard}>
                <View style={styles.successIconCircle}>
                  <MaterialIcons name="check" size={34} color="#23764F" />
                </View>
                <Text style={styles.successTitle}>Tudo certo!</Text>
                <Text style={styles.successText}>
                  {form.name.trim()} foi publicado com sucesso.
                </Text>
                <View style={styles.openRegistrationsBadge}>
                  <Text style={styles.openRegistrationsText}>INSCRIÇÕES ABERTAS</Text>
                </View>
              </View>

              <View style={styles.successEventCard}>
                <Text style={styles.successEventName}>{form.name.trim()}</Text>
                <View style={styles.successDetailsRow}>
                  <View style={styles.successDetailCell}>
                    <Text style={styles.successDetailLabel}>DATA</Text>
                    <Text style={styles.successDetailValue}>
                      {selectedDate
                        ? `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: CAMPUS_TIME_ZONE }).format(selectedDate).replace('.', '').toUpperCase()} · ${formatCampusDateTimeLabel(selectedDate).split('·').pop()?.trim()}`
                        : ''}
                    </Text>
                  </View>
                  <View style={styles.successDetailCell}>
                    <Text style={styles.successDetailLabel}>CAPACIDADE</Text>
                    <Text style={styles.successDetailValue}>{form.capacity} pessoas</Text>
                  </View>
                </View>
              </View>

              <PrimaryButton
                label="Ver evento"
                icon="arrow-forward"
                onPress={() => router.replace({ pathname: '/calendario', params: selectedDate ? { newEventDate: toCampusDateTimeIso(selectedDate) } : {} } as never)}
              />
              <Pressable accessibilityRole="button" onPress={() => void shareEvent()} style={styles.secondaryButton}>
                <MaterialIcons name="share" size={17} color={INK} />
                <Text style={styles.secondaryButtonText}>Compartilhar</Text>
              </Pressable>
              {publishedEventId !== null ? (
                <Text style={styles.eventIdHint}>Código do evento: {publishedEventId}</Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        transparent
        visible={isDatePickerVisible}
        onRequestClose={() => setIsDatePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dateModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Data e horário</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsDatePickerVisible(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color="#5F6670" />
              </Pressable>
            </View>
            <CampusDatePicker
              date={draftDate}
              endYear={new Date().getFullYear() + 5}
              firstDayOfWeek={0}
              locale="pt-br"
              minDate={new Date()}
              onChange={(params) => handleDatePickerChange(params.date)}
              startYear={new Date().getFullYear()}
              timePicker
              timeZone={CAMPUS_TIME_ZONE}
              use12Hours={false}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setIsDatePickerVisible(false)} style={styles.modalCancelButton}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmDate} style={styles.modalConfirmButton}>
                <Text style={styles.modalConfirmText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isCategoryPickerVisible}
        onRequestClose={() => setIsCategoryPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsCategoryPickerVisible(false)}>
          <Pressable style={styles.categoryModalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Selecionar categoria</Text>
            {CATEGORIES.map((category) => (
              <Pressable
                accessibilityRole="button"
                key={category}
                onPress={() => {
                  updateField('category', category);
                  setIsCategoryPickerVisible(false);
                }}
                style={styles.categoryOption}>
                <Text style={styles.categoryOptionText}>{category}</Text>
                {form.category === category ? <MaterialIcons name="check" size={19} color={INK} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

function WizardInput({
  label,
  required,
  placeholder,
  value,
  onChangeText,
  error,
  icon,
  suffix,
  keyboardType,
  onPress,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChangeText?: (value: string) => void;
  error?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  suffix?: string;
  keyboardType?: 'default' | 'numeric';
  onPress?: () => void;
}) {
  const shell = (
    <View style={[styles.inputShell, error ? styles.inputError : null]}>
      {icon ? <MaterialIcons name={icon} size={17} color="#777E87" /> : null}
      <TextInput
        editable={!onPress}
        keyboardType={keyboardType ?? 'default'}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A4A9B0"
        style={styles.inputValue}
        value={value}
      />
      {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      {onPress ? <MaterialIcons name="expand-more" size={18} color="#737982" /> : null}
    </View>
  );

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()} {required ? <Text style={styles.required}>*</Text> : null}</Text>
      {onPress ? <Pressable onPress={onPress}>{shell}</Pressable> : shell}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function ReviewLine({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.reviewLine}>
      <MaterialIcons name={icon} size={16} color="#7C828A" />
      <View style={styles.reviewLineCopy}>
        <Text style={styles.reviewLineLabel}>{label}</Text>
        <Text style={styles.reviewLineValue}>{value}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled ? styles.primaryButtonDisabled : null]}>
      {disabled ? <ActivityIndicator size="small" color={INK} /> : <MaterialIcons name={icon} size={17} color={INK} />}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function getDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function toNativeDate(value: DateType): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === 'object' && '$d' in value) {
    const date = new Date((value as { $d: Date }).$d);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 42,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: 36,
    marginBottom: 14,
  },
  backText: {
    color: '#161616',
    fontSize: 14,
    fontWeight: '800',
  },
  titleBlock: {
    paddingBottom: 18,
  },
  pageTitle: {
    color: INK,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  pageSubtitle: {
    color: '#737982',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  progressSegment: {
    backgroundColor: '#DDE0E1',
    borderRadius: 5,
    flex: 1,
    height: 5,
  },
  progressSegmentActive: {
    backgroundColor: PRIMARY,
  },
  formSection: {
    gap: 15,
  },
  fieldWrap: {
    marginBottom: 2,
  },
  fieldLabel: {
    color: '#2B2E32',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  required: {
    color: '#F04438',
    fontWeight: '900',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9DDE2',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 13,
  },
  inputValue: {
    color: '#202020',
    flex: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  placeholder: {
    color: '#A4A9B0',
  },
  inputSuffix: {
    color: '#656B73',
    fontSize: 12,
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#F04438',
  },
  errorText: {
    color: '#D92D20',
    fontSize: 12,
    marginTop: 5,
  },
  descriptionHint: {
    color: '#858B92',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
    minWidth: 0,
  },
  timeHintField: {
    flex: 0.65,
    minWidth: 105,
    paddingTop: 0,
  },
  descriptionInput: {
    backgroundColor: '#F3F3F4',
    borderColor: '#E0E2E5',
    borderRadius: 6,
    borderWidth: 1,
    color: '#202020',
    fontSize: 15,
    lineHeight: 21,
    minHeight: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  descriptionFooter: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 22,
  },
  counterText: {
    color: '#8B9097',
    fontSize: 10,
    marginTop: 5,
  },
  counterLimit: {
    color: '#D92D20',
    fontWeight: '800',
  },
  savedNotice: {
    alignItems: 'center',
    backgroundColor: '#E8F2F9',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 11,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noticeTextWrap: {
    flex: 1,
  },
  noticeTitle: {
    color: '#25557C',
    fontSize: 12,
    fontWeight: '900',
  },
  noticeSubtitle: {
    color: '#677786',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 7,
    flexDirection: 'row',
    gap: 10,
    height: 60,
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
    shadowColor: '#C68F00',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#101010',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  certificateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E3E6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  certificateCopy: {
    flex: 1,
  },
  cardTitle: {
    color: '#26292D',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardDescription: {
    color: '#6D737B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  integrationCard: {
    alignItems: 'flex-start',
    backgroundColor: '#F3F3F4',
    borderColor: '#E0E2E3',
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
    padding: 15,
  },
  cardTitleSmall: {
    color: '#34383D',
    fontSize: 12,
    fontWeight: '800',
  },
  cardDescriptionSmall: {
    color: '#6D737B',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  reviewSection: {
    gap: 14,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E3E6',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    padding: 16,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  reviewTopLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  reviewEventName: {
    color: '#202124',
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  draftBadge: {
    backgroundColor: '#FFF0D9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  draftBadgeText: {
    color: '#A75D0B',
    fontSize: 9,
    fontWeight: '800',
  },
  horizontalRule: {
    backgroundColor: '#ECEEEF',
    height: 1,
    marginVertical: 12,
  },
  reviewLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  reviewLineCopy: {
    flex: 1,
  },
  reviewLineLabel: {
    color: '#7B8087',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reviewLineValue: {
    color: '#30343A',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  reviewDescription: {
    color: '#5E646B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  statusBadge: {
    backgroundColor: '#E5F5EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeOff: {
    backgroundColor: '#ECEDEF',
  },
  statusBadgeText: {
    color: '#278253',
    fontSize: 9,
    fontWeight: '800',
  },
  statusBadgeTextOff: {
    color: '#686E75',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#111111',
    borderRadius: 7,
    borderWidth: 1.25,
    flexDirection: 'row',
    gap: 9,
    height: 52,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#171717',
    fontSize: 13,
    fontWeight: '800',
  },
  successSection: {
    gap: 14,
    paddingTop: 8,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E3E6',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 9,
    elevation: 2,
  },
  successIconCircle: {
    alignItems: 'center',
    backgroundColor: '#E6F6ED',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  successTitle: {
    color: '#1D2023',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },
  successText: {
    color: '#6D737B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  openRegistrationsBadge: {
    backgroundColor: '#E4F5EB',
    borderRadius: 12,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openRegistrationsText: {
    color: '#278253',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  successEventCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E3E6',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 1,
  },
  successEventName: {
    color: '#202124',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 12,
  },
  successDetailsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  successDetailCell: {
    backgroundColor: '#F3F3F4',
    borderRadius: 6,
    flex: 1,
    padding: 11,
  },
  successDetailLabel: {
    color: '#7B8087',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  successDetailValue: {
    color: '#30343A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  eventIdHint: {
    color: '#7B8087',
    fontSize: 11,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,17,19,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  dateModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    maxWidth: 450,
    padding: 18,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#25292D',
    fontSize: 18,
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalCancelButton: {
    alignItems: 'center',
    backgroundColor: '#ECEDEF',
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    minWidth: 100,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: '#565B62',
    fontSize: 12,
    fontWeight: '800',
  },
  modalConfirmButton: {
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    minWidth: 100,
    paddingHorizontal: 14,
  },
  modalConfirmText: {
    color: INK,
    fontSize: 12,
    fontWeight: '900',
  },
  categoryModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    maxWidth: 400,
    padding: 18,
    width: '100%',
  },
  categoryOption: {
    alignItems: 'center',
    borderBottomColor: '#E9EBEC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  categoryOptionText: {
    color: '#363A3E',
    fontSize: 14,
  },
});
