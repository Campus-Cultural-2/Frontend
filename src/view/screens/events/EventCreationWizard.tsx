import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import type { DateType } from 'react-native-ui-datepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppButton, AppFieldLabel, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import { AppToast } from '@/components/ui/app-toast';
import { CampusDatePicker } from '@/components/ui/campus-date-picker';
import { createEvent, getValidAuthSession, isAuthSessionError } from '@/src/lib/api/campus';
import type { AttendanceMode, HoursGroup } from '@/src/lib/api/schemas';
import { clearAuthToken } from '@/src/lib/auth/token';
import {
  CAMPUS_TIME_ZONE,
  formatCampusDateTimeLabel,
  toCampusDateTimeIso,
} from '@/src/lib/datetime/campusTime';
import { useAppToast } from '@/src/view/hooks/useAppToast';

const PRIMARY = colors.brand.primary;
const INK = colors.text.primary;
const MUTED = '#737982';
const DESCRIPTION_LIMIT = 500;

const HOURS_GROUPS: { value: HoursGroup; label: string }[] = [
  { value: 'group_1', label: 'Grupo 1 · Formação social, humana e cultural' },
  { value: 'group_2', label: 'Grupo 2 · Atividades comunitárias e coletivas' },
  { value: 'group_3', label: 'Grupo 3 · Iniciação científica e formação profissional' },
];

type EventWizardForm = {
  name: string;
  dateTime: string;
  endDateTime: string;
  attendanceMode: AttendanceMode;
  place: string;
  description: string;
  workload: string;
  hoursGroup: HoursGroup;
  capacity: string;
  issueCertificate: boolean;
};

type WizardStep = 1 | 2 | 3 | 4;

const ATTENDANCE_OPTIONS: { description: string; label: string; value: AttendanceMode }[] = [
  {
    description: 'Todos os inscritos contam como presentes.',
    label: 'Sem confirmação',
    value: 'none',
  },
  {
    description: 'Você confirma na lista ou lendo o QR code de cada aluno.',
    label: 'Pelo professor',
    value: 'professor',
  },
  {
    description: 'O aluno lê o código (QR code) do evento para confirmar.',
    label: 'Pelo aluno',
    value: 'student',
  },
];

const INITIAL_FORM: EventWizardForm = {
  name: '',
  dateTime: '',
  endDateTime: '',
  attendanceMode: 'none',
  place: '',
  description: '',
  workload: '20',
  hoursGroup: 'group_1',
  capacity: '120',
  issueCertificate: true,
};

export default function EventCreationWizard() {
  const router = useRouter();
  const { showToast, toast } = useAppToast();
  const [form, setForm] = useState<EventWizardForm>(INITIAL_FORM);
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
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
          router.replace('/(tabs)/(main)/calendario' as never);
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
          router.replace('/(tabs)/(main)/calendario' as never);
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

  // A tela fica montada nas tabs. Depois de publicar, ao sair o wizard volta ao
  // inicio para que o proximo evento nao reabra a tela de "Evento publicado".
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (step !== 4) return;
        setForm(INITIAL_FORM);
        setStep(1);
        setSelectedDate(null);
        setSelectedEndDate(null);
        setPickerTarget('start');
        setDraftDate(getDefaultDate());
        setIsDatePickerVisible(false);
        setIsCategoryPickerVisible(false);
        setPublishedEventId(null);
        setErrors({});
      };
    }, [step]),
  );

  function updateField<K extends keyof EventWizardForm>(field: K, value: EventWizardForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openDatePicker() {
    setPickerTarget('start');
    setDraftDate(selectedDate ?? getDefaultDate());
    setIsDatePickerVisible(true);
  }

  function openEndDatePicker() {
    // Sugere uma hora depois do inicio.
    const start = selectedDate ?? getDefaultDate();
    setPickerTarget('end');
    setDraftDate(
      selectedEndDate && selectedEndDate.getTime() > start.getTime()
        ? selectedEndDate
        : new Date(start.getTime() + 60 * 60 * 1000),
    );
    setIsDatePickerVisible(true);
  }

  function handleDatePickerChange(value: DateType) {
    const date = toNativeDate(value);
    if (date) setDraftDate(date);
  }

  function confirmDate() {
    if (pickerTarget === 'end') {
      if (selectedDate && draftDate.getTime() <= selectedDate.getTime()) {
        setErrors((current) => ({
          ...current,
          endDateTime: 'O encerramento precisa ser depois do início.',
        }));
        showToast({
          message: 'O horário de encerramento precisa ser depois do início.',
          type: 'warning',
        });
        return;
      }

      setSelectedEndDate(draftDate);
      updateField('endDateTime', formatCampusDateTimeLabel(draftDate));
      setIsDatePickerVisible(false);
      return;
    }

    if (draftDate.getTime() <= Date.now()) {
      setErrors((current) => ({ ...current, dateTime: 'Escolha uma data e horário futuros.' }));
      showToast({ message: 'O evento precisa ter data e horário futuros.', type: 'warning' });
      return;
    }

    setSelectedDate(draftDate);
    updateField('dateTime', formatCampusDateTimeLabel(draftDate));
    if (selectedEndDate && selectedEndDate.getTime() <= draftDate.getTime()) {
      // O inicio passou do fim antigo: o fim precisa ser escolhido de novo.
      setSelectedEndDate(null);
      updateField('endDateTime', '');
    }
    setIsDatePickerVisible(false);
  }

  function validateInformation() {
    const nextErrors: Partial<Record<keyof EventWizardForm, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Informe o nome do evento.';
    if (!selectedDate || selectedDate.getTime() <= Date.now()) {
      nextErrors.dateTime = 'Escolha uma data e horário futuros.';
    }
    if (!selectedEndDate) {
      nextErrors.endDateTime = 'Escolha o horário de encerramento.';
    } else if (selectedDate && selectedEndDate.getTime() <= selectedDate.getTime()) {
      nextErrors.endDateTime = 'O encerramento precisa ser depois do início.';
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
    if (form.issueCertificate && (!Number.isFinite(workload) || workload <= 0)) {
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
    if (!selectedDate || !selectedEndDate) return;
    setIsPublishing(true);
    try {
      const createdEvent = await createEvent({
        name: form.name.trim(),
        event_datetime: toCampusDateTimeIso(selectedDate),
        event_end_datetime: toCampusDateTimeIso(selectedEndDate),
        attendance_mode: form.attendanceMode,
        event_location: form.place.trim(),
        description: form.description.trim(),
        image: null,
        has_certificate: form.issueCertificate,
        workload_hours: form.issueCertificate ? Number(form.workload) : null,
        hours_group: form.issueCertificate ? form.hoursGroup : null,
        max_participants: Number(form.capacity),
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
                    if (router.canGoBack()) router.back();
                    else router.replace('/(tabs)/(main)/calendario' as never);
                  } else {
                    setStep((current) => (current - 1) as WizardStep);
                  }
                }}
                style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={20} color={PRIMARY} />
                <Text style={styles.backText}>Voltar</Text>
              </Pressable>

              <AppPageHeader
                title={step === 1 ? 'Novo evento' : step === 2 ? 'Certificado e vagas' : 'Revisar evento'}
                subtitle={step === 1
                  ? 'Etapa 1 de 3 · Informações principais'
                  : step === 2
                    ? 'Etapa 2 de 3 · Regras de participação'
                    : 'Etapa 3 de 3 · Confirme antes de publicar'}
                style={styles.wizardPageHeader}
              />

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

                  <WizardInput
                    label="Início do evento"
                    required
                    placeholder="Selecione a data e o horário"
                    value={form.dateTime}
                    onPress={openDatePicker}
                    error={errors.dateTime}
                    icon="event"
                  />

                  <WizardInput
                    label="Encerramento do evento"
                    required
                    placeholder="Selecione a data e o horário de encerramento"
                    value={form.endDateTime}
                    onPress={openEndDatePicker}
                    error={errors.endDateTime}
                    icon="event-available"
                  />

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
                    <AppFieldLabel label="Descrição" required style={styles.sharedFieldLabel} />
                    <TextInput
                      multiline
                      maxLength={DESCRIPTION_LIMIT}
                      onChangeText={(value) => updateField('description', value)}
                      placeholder="Descreva o objetivo e a programação do evento."
                      placeholderTextColor="#A4A9B0"
                      style={[styles.descriptionInput, errors.description ? styles.inputError : null]}
                      textAlignVertical="top"
                      value={form.description}
                    />
                    <View style={styles.descriptionFooter}>
                      {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
                      <Text style={[styles.counterText, descriptionReachedLimit ? styles.counterLimit : null]}>
                        {form.description.length}/{DESCRIPTION_LIMIT}
                      </Text>
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
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityLabel="Emitir certificado"
                      accessibilityState={{ checked: form.issueCertificate }}
                      onPress={() => updateField('issueCertificate', !form.issueCertificate)}
                      style={[
                        styles.certificateToggleTrack,
                        form.issueCertificate ? styles.certificateToggleTrackActive : null,
                      ]}>
                      <View
                        style={[
                          styles.certificateToggleThumb,
                          form.issueCertificate ? styles.certificateToggleThumbActive : null,
                        ]}
                      />
                    </Pressable>
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
                      <AppFieldLabel label="Grupo / categoria" required style={styles.sharedFieldLabel} />
                      <Pressable
                        onPress={() => setIsCategoryPickerVisible(true)}
                        style={styles.inputShell}>
                        <MaterialIcons name="layers" size={17} color="#777E87" />
                        <Text numberOfLines={1} style={styles.inputValue}>{getHoursGroupLabel(form.hoursGroup)}</Text>
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

                  <View>
                    <AppFieldLabel label="Confirmação de presença" style={styles.sharedFieldLabel} />
                    <View accessibilityRole="radiogroup" accessibilityLabel="Confirmação de presença" style={{ gap: 8, marginTop: 8 }}>
                      {ATTENDANCE_OPTIONS.map((option) => {
                        const selected = option.value === form.attendanceMode;

                        return (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            key={option.value}
                            onPress={() => updateField('attendanceMode', option.value)}
                            style={[
                              styles.certificateCard,
                              { gap: 4, paddingVertical: 12 },
                              selected ? styles.attendanceOptionSelected : null,
                            ]}>
                            <View style={styles.certificateCopy}>
                              <Text style={styles.cardTitleSmall}>{option.label}</Text>
                              <Text style={styles.cardDescriptionSmall}>{option.description}</Text>
                            </View>
                            <MaterialIcons
                              color={selected ? INK : '#B8BCC2'}
                              name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                              size={20}
                            />
                          </Pressable>
                        );
                      })}
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
                    <ReviewLine icon="schedule" label="ENCERRAMENTO" value={selectedEndDate ? formatCampusDateTimeLabel(selectedEndDate) : ''} />
                    <ReviewLine icon="how-to-reg" label="PRESENÇA" value={ATTENDANCE_OPTIONS.find((option) => option.value === form.attendanceMode)?.label ?? ''} />
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
                    <ReviewLine icon="schedule" label="CARGA HORÁRIA" value={form.issueCertificate ? `${form.workload} horas` : 'Não se aplica'} />
                    <ReviewLine icon="layers" label="GRUPO DE ATIVIDADES" value={form.issueCertificate ? getHoursGroupLabel(form.hoursGroup) : 'Não se aplica'} />
                    <ReviewLine icon="people-outline" label="CAPACIDADE" value={`${form.capacity} pessoas`} />
                  </View>

                  <PrimaryButton
                    label={isPublishing ? 'Publicando...' : 'Publicar evento'}
                    icon="send"
                    disabled={isPublishing}
                    onPress={() => void publishEvent()}
                  />
                  <AppButton
                    label="Voltar e editar"
                    variant="outline"
                    fullWidth
                    disabled={isPublishing}
                    onPress={() => setStep(2)}
                    style={styles.secondaryAction}
                  />
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
              <AppButton
                label="Compartilhar"
                variant="outline"
                fullWidth
                icon={<MaterialIcons name="share" size={17} color={INK} />}
                onPress={() => void shareEvent()}
                style={styles.secondaryAction}
              />
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
              <Text style={styles.modalTitle}>{pickerTarget === 'end' ? 'Encerramento do evento' : 'Início do evento'}</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsDatePickerVisible(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={colors.text.secondary} />
              </Pressable>
            </View>
            <CampusDatePicker
              date={draftDate}
              endYear={new Date().getFullYear() + 5}
              firstDayOfWeek={0}
              locale="pt-br"
              minDate={pickerTarget === 'end' && selectedDate ? selectedDate : new Date()}
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
            <Text style={styles.modalTitle}>Grupo de atividades complementares</Text>
            {HOURS_GROUPS.map((group) => (
              <Pressable
                accessibilityRole="button"
                key={group.value}
                onPress={() => {
                  updateField('hoursGroup', group.value);
                  setIsCategoryPickerVisible(false);
                }}
                style={styles.categoryOption}>
                <Text style={styles.categoryOptionText}>{group.label}</Text>
                {form.hoursGroup === group.value ? <MaterialIcons name="check" size={19} color={INK} /> : null}
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
      <AppFieldLabel label={label} required={required} style={styles.sharedFieldLabel} />
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
    <AppButton
      label={label}
      variant="primary"
      size="lg"
      fullWidth
      disabled={disabled}
      loading={disabled}
      icon={!disabled ? <MaterialIcons name={icon} size={17} color={INK} /> : undefined}
      onPress={onPress}
      style={styles.primaryAction}
    />
  );
}

function getHoursGroupLabel(value: HoursGroup) {
  return HOURS_GROUPS.find((group) => group.value === value)?.label ?? 'Grupo 1';
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
    ...appLayoutStyles.screen,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    ...appLayoutStyles.content,
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
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
  wizardPageHeader: { marginBottom: 18 },
  pageTitle: {
    color: INK,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.25,
    lineHeight: 30,
  },
  pageSubtitle: { color: '#737982', fontSize: 12, lineHeight: 18, marginTop: 4 },
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
  sharedFieldLabel: { marginBottom: 7 },
  required: {
    color: colors.status.dangerStrong,
    fontWeight: '900',
  },
  inputShell: {
    ...appSurfaceStyles.input,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  inputValue: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
    minHeight: 46,
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
    borderColor: colors.status.dangerStrong,
  },
  errorText: {
    color: '#D92D20',
    fontSize: 12,
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
  descriptionInput: {
    ...appSurfaceStyles.input,
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 116,
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
  primaryAction: { alignSelf: 'stretch' },
  secondaryAction: { alignSelf: 'stretch' },
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
    boxShadow: '0px 5px 10px rgba(198, 143, 0, 0.16)',
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
    backgroundColor: colors.neutral.white,
    borderColor: '#E1E3E6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    boxShadow: '0px 2px 7px rgba(17, 17, 17, 0.06)',
    elevation: 2,
  },
  certificateCopy: {
    flex: 1,
  },
  certificateToggleTrack: {
    alignItems: 'center',
    backgroundColor: colors.border.strong,
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 46,
  },
  certificateToggleTrackActive: {
    alignItems: 'flex-end',
    backgroundColor: colors.brand.primary,
  },
  certificateToggleThumb: {
    backgroundColor: colors.neutral.white,
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  certificateToggleThumbActive: {
    backgroundColor: colors.text.primary,
  },
  attendanceOptionSelected: {
    backgroundColor: colors.brand.soft,
    borderColor: colors.brand.primary,
    borderWidth: 1.5,
  },
  cardTitle: {
    color: '#26292D',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardDescription: {
    color: '#6D737B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
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
    backgroundColor: colors.neutral.white,
    borderColor: '#E1E3E6',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(17, 17, 17, 0.07)',
  },
  reviewTopLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  reviewEventName: {
    color: colors.text.heading,
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
    color: colors.text.heading,
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
    backgroundColor: colors.neutral.white,
    borderColor: colors.text.primary,
    borderRadius: 7,
    borderWidth: 1.25,
    flexDirection: 'row',
    gap: 9,
    height: 52,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  successSection: {
    gap: 14,
    paddingTop: 8,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderColor: '#E1E3E6',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 30,
    boxShadow: '0px 3px 9px rgba(17, 17, 17, 0.06)',
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
    backgroundColor: colors.status.successSoft,
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
    backgroundColor: colors.neutral.white,
    borderColor: '#E1E3E6',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    boxShadow: '0px 2px 7px rgba(17, 17, 17, 0.05)',
    elevation: 1,
  },
  successEventName: {
    color: colors.text.heading,
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
    backgroundColor: colors.surface.subtle,
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
    color: colors.text.heading,
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
    backgroundColor: colors.neutral.white,
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
    backgroundColor: colors.neutral.white,
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
