import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { TextInput as NativeTextInputInstance } from 'react-native';
import { DateType } from 'react-native-ui-datepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppFieldLabel, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import EventCreationWizard from '@/src/view/screens/events/EventCreationWizard';
import { AppToast } from '@/components/ui/app-toast';
import { UnsavedChangesDialog } from '@/components/ui/unsaved-changes-dialog';
import {
  createEvent,
  deleteEvent,
  AttendanceMode,
  EventCreateIn,
  EventUpdateIn,
  type HoursGroup,
  getEvent,
  getValidAuthSession,
  isAuthSessionError,
  updateEvent,
} from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';
import { CampusDatePicker } from '@/components/ui/campus-date-picker';
import {
  CAMPUS_TIME_ZONE,
  formatCampusDateTimeLabel,
  toCampusDateTimeIso,
} from '@/src/lib/datetime/campusTime';
import { getEventImageBase64, getEventImageUri } from '@/src/lib/events/eventImage';
import {
  runWithUnsavedChangesGuard,
  setUnsavedChangesHandler,
} from '@/src/lib/navigation/unsavedChangesGuard';
import { useAppToast } from '@/src/view/hooks/useAppToast';

const DESCRIPTION_LIMIT = 500;

const attendanceOptions: { description: string; label: string; value: AttendanceMode }[] = [
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
    description: 'O aluno lê o código do evento para confirmar.',
    label: 'Pelo aluno',
    value: 'student',
  },
];

const certificateGroups: { description: string; label: string; value: HoursGroup }[] = [
  {
    description: 'Formação social, humana e cultural',
    label: 'Grupo 1',
    value: 'group_1',
  },
  {
    description: 'Atividades comunitárias e coletivas',
    label: 'Grupo 2',
    value: 'group_2',
  },
  {
    description: 'Iniciação científica e formação profissional',
    label: 'Grupo 3',
    value: 'group_3',
  },
];

type EventForm = {
  imageName: string;
  imageUri: string;
  imageMimeType: string;
  imageBase64: string;
  name: string;
  dateTime: string;
  endDateTime: string;
  place: string;
  description: string;
};

const initialForm: EventForm = {
  imageName: '',
  imageUri: '',
  imageMimeType: '',
  imageBase64: '',
  name: '',
  dateTime: '',
  endDateTime: '',
  place: '',
  description: '',
};

const requiredFields: (keyof Pick<EventForm, 'name' | 'dateTime' | 'endDateTime' | 'place' | 'description'>)[] = [
  'name',
  'dateTime',
  'endDateTime',
  'place',
  'description',
];

export default function NewEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  if (!eventId) {
    return <EventCreationWizard />;
  }

  return <ExistingEventEditorScreen />;
}

function ExistingEventEditorScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const editingEventId = eventId ? Number(eventId) : null;
  const [form, setForm] = useState<EventForm>(initialForm);
  const [savedForm, setSavedForm] = useState<EventForm>(initialForm);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [savedSelectedDate, setSavedSelectedDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [savedSelectedEndDate, setSavedSelectedEndDate] = useState<Date | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('none');
  const [savedAttendanceMode, setSavedAttendanceMode] = useState<AttendanceMode>('none');
  const [hasCertificate, setHasCertificate] = useState(false);
  const [savedHasCertificate, setSavedHasCertificate] = useState(false);
  const [workloadHours, setWorkloadHours] = useState('20');
  const [savedWorkloadHours, setSavedWorkloadHours] = useState('20');
  const [hoursGroup, setHoursGroup] = useState<HoursGroup>('group_1');
  const [savedHoursGroup, setSavedHoursGroup] = useState<HoursGroup>('group_1');
  const [draftDate, setDraftDate] = useState<Date>(new Date());
  const [minimumSelectableDate, setMinimumSelectableDate] = useState<Date>(() => new Date());
  const [isDatePopoverVisible, setIsDatePopoverVisible] = useState(false);
  const { showToast, toast } = useAppToast();
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof EventForm, string>>>({});
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [hasEventPermission, setHasEventPermission] = useState(false);

  const isEditing = Number.isFinite(editingEventId);
  const descriptionReachedLimit = form.description.length >= DESCRIPTION_LIMIT;
  const hasDraft = useMemo(
    () => Object.values(form).some((value) => value.trim().length > 0),
    [form],
  );
  const hasUnsavedChanges = useMemo(
    () =>
      !isLoadingEvent &&
      (!areEventFormsEqual(form, savedForm) ||
        attendanceMode !== savedAttendanceMode ||
        hasCertificate !== savedHasCertificate ||
        (hasCertificate && (workloadHours !== savedWorkloadHours || hoursGroup !== savedHoursGroup)) ||
        (selectedDate?.getTime() ?? null) !== (savedSelectedDate?.getTime() ?? null) ||
        (selectedEndDate?.getTime() ?? null) !== (savedSelectedEndDate?.getTime() ?? null)),
    [
      attendanceMode,
      form,
      hasCertificate,
      hoursGroup,
      isLoadingEvent,
      savedAttendanceMode,
      savedHasCertificate,
      savedHoursGroup,
      savedWorkloadHours,
      savedForm,
      savedSelectedDate,
      savedSelectedEndDate,
      selectedDate,
      selectedEndDate,
      workloadHours,
    ],
  );

  useEffect(() => {
    let isMounted = true;

    async function checkPermission() {
      try {
        const session = await getValidAuthSession();
        if (!isMounted) return;

        if (session.payload.role !== 'professor') {
          router.replace('/(tabs)/(main)/calendario' as never);
          return;
        }

        setHasEventPermission(true);
      } catch (permissionError) {
        if (isAuthSessionError(permissionError)) {
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
        if (isMounted) setIsCheckingPermission(false);
      }
    }

    void checkPermission();
    return () => {
      isMounted = false;
    };
  }, [router, showToast]);

  useEffect(() => {
    async function loadEventForEditing() {
      if (!isEditing || editingEventId === null) {
        discardDraft();
        return;
      }

      setIsLoadingEvent(true);

      try {
        const event = await getEvent(editingEventId);
        const nextDate = new Date(event.event_datetime);
        const nextEndDate = new Date(event.event_end_datetime);
        const nextForm = {
          imageName: event.image ? 'banner-atual.jpg' : '',
          imageUri: getEventImageUri(event.image) ?? '',
          imageMimeType: event.image ? 'image/jpeg' : '',
          imageBase64: getEventImageBase64(event.image),
          name: event.name,
          dateTime: formatDateTime(nextDate),
          endDateTime: formatDateTime(nextEndDate),
          place: event.event_location,
          description: event.description,
        };

        setSelectedDate(nextDate);
        setSavedSelectedDate(nextDate);
        setSelectedEndDate(nextEndDate);
        setSavedSelectedEndDate(nextEndDate);
        setAttendanceMode(event.attendance_mode);
        setSavedAttendanceMode(event.attendance_mode);
        const eventHasCertificate = event.has_certificate === true;
        const eventWorkloadHours = String(event.workload_hours ?? 20);
        const eventHoursGroup = event.hours_group ?? 'group_1';
        setHasCertificate(eventHasCertificate);
        setSavedHasCertificate(eventHasCertificate);
        setWorkloadHours(eventWorkloadHours);
        setSavedWorkloadHours(eventWorkloadHours);
        setHoursGroup(eventHoursGroup);
        setSavedHoursGroup(eventHoursGroup);
        setForm(nextForm);
        setSavedForm(nextForm);
      } catch (error) {
        if (isAuthSessionError(error)) {
          await clearAuthToken();
          router.replace('/login' as never);
          return;
        }

        showToast({
          message: error instanceof Error ? error.message : 'Tente novamente em instantes.',
          type: 'error',
        });
      } finally {
        setIsLoadingEvent(false);
      }
    }

    void loadEventForEditing();
  }, [editingEventId, isEditing, router, showToast]);

  useFocusEffect(
    useCallback(() => {
      if (!hasUnsavedChanges) {
        return undefined;
      }

      return setUnsavedChangesHandler((continueNavigation) => {
        setPendingNavigation(() => continueNavigation);
        return true;
      });
    }, [hasUnsavedChanges]),
  );

  function updateField(field: keyof EventForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function openImagePicker() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showToast({
        message: 'Permita o acesso à galeria para escolher o banner.',
        type: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1920, 820],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    setForm((current) => ({
      ...current,
      imageName: asset.fileName ?? 'banner-evento.jpg',
      imageUri: asset.uri,
      imageMimeType: asset.mimeType ?? 'image/jpeg',
      imageBase64: asset.base64 ?? '',
    }));
  }

  // Ao salvar, o evento fica sem imagem e o backend apaga a antiga da nuvem.
  function removeImage() {
    setForm((current) => ({
      ...current,
      imageName: '',
      imageUri: '',
      imageMimeType: '',
      imageBase64: '',
    }));
  }

  function openDatePicker() {
    const now = new Date();
    setPickerTarget('start');
    setMinimumSelectableDate(now);
    setDraftDate(selectedDate && !isDateInPast(selectedDate) ? selectedDate : now);
    setIsDatePopoverVisible(true);
  }

  function openEndDatePicker() {
    // O fim nao pode ser antes do inicio (ou de agora, se o inicio ainda nao foi escolhido).
    const minimum = selectedDate ?? new Date();
    setPickerTarget('end');
    setMinimumSelectableDate(minimum);
    setDraftDate(
      selectedEndDate && selectedEndDate.getTime() > minimum.getTime()
        ? selectedEndDate
        : new Date(minimum.getTime() + 60 * 60 * 1000),
    );
    setIsDatePopoverVisible(true);
  }

  function applyDateTimeSelection() {
    if (pickerTarget === 'end') {
      if (selectedDate && draftDate.getTime() <= selectedDate.getTime()) {
        setErrors((current) => ({
          ...current,
          endDateTime: 'O encerramento precisa ser depois do início',
        }));
        showToast({
          message: 'O horário de encerramento precisa ser depois do início.',
          type: 'warning',
        });
        return;
      }

      setSelectedEndDate(draftDate);
      updateField('endDateTime', formatDateTime(draftDate));
      setIsDatePopoverVisible(false);
      return;
    }

    if (isDateInPast(draftDate)) {
      setErrors((current) => ({
        ...current,
        dateTime: 'Escolha uma data e horário futuros',
      }));
      showToast({
        message: 'O evento precisa ter data e horário futuros.',
        type: 'warning',
      });
      return;
    }

    setSelectedDate(draftDate);
    updateField('dateTime', formatDateTime(draftDate));
    if (selectedEndDate && selectedEndDate.getTime() <= draftDate.getTime()) {
      // O inicio passou do fim antigo: o fim precisa ser escolhido de novo.
      setSelectedEndDate(null);
      updateField('endDateTime', '');
    }
    setIsDatePopoverVisible(false);
  }

  function validateForm() {
    const nextErrors: Partial<Record<keyof EventForm, string>> = {};

    requiredFields.forEach((field) => {
      if (!form[field].trim()) {
        nextErrors[field] = 'Campo obrigatório';
      }
    });

    if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
      nextErrors.dateTime = 'Escolha uma data e horário válidos';
    } else if (isDateInPast(selectedDate)) {
      nextErrors.dateTime = 'Escolha uma data e horário futuros';
    }

    if (!selectedEndDate || Number.isNaN(selectedEndDate.getTime())) {
      nextErrors.endDateTime = 'Escolha o horário de encerramento';
    } else if (selectedDate && selectedEndDate.getTime() <= selectedDate.getTime()) {
      nextErrors.endDateTime = 'O encerramento precisa ser depois do início';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveEvent() {
    if (!validateForm()) {
      showToast({
        message: 'Preencha todos os campos obrigatórios antes de salvar.',
        type: 'warning',
      });
      return;
    }

    const parsedWorkloadHours = Number(workloadHours);
    if (hasCertificate && (!Number.isInteger(parsedWorkloadHours) || parsedWorkloadHours <= 0)) {
      showToast({
        message: 'Informe uma carga horária inteira maior que zero para o certificado.',
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (!selectedDate || !selectedEndDate) {
        return;
      }

      const payload: EventCreateIn = {
        image: form.imageBase64 || null,
        name: form.name.trim(),
        event_datetime: toCampusDateTimeIso(selectedDate),
        event_end_datetime: toCampusDateTimeIso(selectedEndDate),
        attendance_mode: attendanceMode,
        event_location: form.place.trim(),
        description: form.description.trim(),
      };

      if (isEditing && editingEventId !== null) {
        const updatePayload: EventUpdateIn = {
          ...payload,
          has_certificate: hasCertificate,
          workload_hours: hasCertificate ? parsedWorkloadHours : null,
          hours_group: hasCertificate ? hoursGroup : null,
        };

        if (!hasImageChanged(form, savedForm)) {
          delete updatePayload.image;
        }

        await updateEvent(editingEventId, updatePayload);
        setSavedForm(form);
        setSavedSelectedDate(selectedDate);
        setSavedSelectedEndDate(selectedEndDate);
        setSavedAttendanceMode(attendanceMode);
        setSavedHasCertificate(hasCertificate);
        setSavedWorkloadHours(hasCertificate ? workloadHours : '20');
        setSavedHoursGroup(hasCertificate ? hoursGroup : 'group_1');
        if (!hasCertificate) {
          setWorkloadHours('20');
          setHoursGroup('group_1');
        }
        showToast({
          message: 'As alterações foram salvas.',
          type: 'success',
        });
        setTimeout(
          () => router.replace({ pathname: '/calendario', params: { newEventDate: payload.event_datetime } } as never),
          1100,
        );
      } else {
        await createEvent(payload);
        discardDraft();
        showToast({
          message: 'O novo evento foi criado como ativo.',
          type: 'success',
        });
        setTimeout(
          () => router.replace({ pathname: '/calendario', params: { newEventDate: payload.event_datetime } } as never),
          1100,
        );
      }
    } catch (error) {
      if (isAuthSessionError(error)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      showToast({
        message:
          error instanceof Error ? error.message : 'Não foi possível salvar o evento. Verifique sua conexão e tente novamente.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEvent() {
    if (!isEditing || editingEventId === null) {
      return;
    }

    setIsDeleteDialogVisible(false);
    setIsSaving(true);

    try {
      await deleteEvent(editingEventId);
      setSavedForm(form);
      setSavedSelectedDate(selectedDate);
      setSavedSelectedEndDate(selectedEndDate);
      setSavedAttendanceMode(attendanceMode);
      showToast({
        message: 'Evento excluído com sucesso.',
        type: 'success',
      });
      setTimeout(
        () => router.replace({ pathname: '/calendario', params: selectedDate ? { newEventDate: selectedDate.toISOString() } : {} } as never),
        900,
      );
    } catch (error) {
      if (isAuthSessionError(error)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      showToast({
        message:
          error instanceof Error ? error.message : 'Não foi possível excluir o evento.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function discardDraft() {
    setForm(initialForm);
    setSavedForm(initialForm);
    setSelectedDate(null);
    setSavedSelectedDate(null);
    setSelectedEndDate(null);
    setSavedSelectedEndDate(null);
    setAttendanceMode('none');
    setSavedAttendanceMode('none');
    setHasCertificate(false);
    setSavedHasCertificate(false);
    setWorkloadHours('20');
    setSavedWorkloadHours('20');
    setHoursGroup('group_1');
    setSavedHoursGroup('group_1');
    setDraftDate(new Date());
    setIsDatePopoverVisible(false);
    setErrors({});
  }

  function restoreSavedDraft() {
    setForm(savedForm);
    setSelectedDate(savedSelectedDate);
    setSelectedEndDate(savedSelectedEndDate);
    setAttendanceMode(savedAttendanceMode);
    setHasCertificate(savedHasCertificate);
    setWorkloadHours(savedWorkloadHours);
    setHoursGroup(savedHoursGroup);
    setDraftDate(savedSelectedDate ?? new Date());
    setIsDatePopoverVisible(false);
    setErrors({});
  }

  const requestLeave = useCallback(
    (continueNavigation: () => void) => {
      runWithUnsavedChangesGuard(continueNavigation);
    },
    [],
  );

  function cancelPendingNavigation() {
    setPendingNavigation(null);
  }

  function discardChangesAndLeave() {
    const continueNavigation = pendingNavigation;

    restoreSavedDraft();
    setPendingNavigation(null);
    continueNavigation?.();
  }

  function handlePickerChange(date: DateType) {
    if (date) {
      setDraftDate(toNativeDate(date));
    }
  }

  if (isCheckingPermission || !hasEventPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionLoading}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loadingEventText}>Verificando permissões...</Text>
        </View>
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
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInLeft" duration={360} useNativeDriver={Platform.OS !== 'web'}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() =>
                requestLeave(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(main)/calendario' as never)))
              }
              style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={20} color={colors.brand.primary} />
              <Text style={styles.backText}>Voltar</Text>
            </Pressable>
          </Animatable.View>

          <AppPageHeader
            title="Editar evento"
            subtitle="Atualize as informações e as regras de participação."
            style={styles.editorPageHeader}
          />

          {isLoadingEvent ? (
            <Animatable.View
              animation="pulse"
              iterationCount="infinite"
              style={styles.loadingEventBox}
              useNativeDriver={Platform.OS !== 'web'}>
              <ActivityIndicator color={colors.text.primary} />
              <Text style={styles.loadingEventText}>Carregando evento...</Text>
            </Animatable.View>
          ) : null}

          <Animatable.View animation="fadeInUp" delay={80} duration={420} useNativeDriver={Platform.OS !== 'web'}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selecionar imagem do evento"
              onPress={openImagePicker}
              style={styles.uploadCard}>
              {form.imageUri ? (
                <Image source={{ uri: form.imageUri }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <MaterialIcons name="image" size={36} color="#A6A6A6" />
                  <Text style={styles.uploadTitle}>Banner do evento</Text>
                  <Text style={styles.uploadHint}>Recomendado: 1920x820px</Text>
                  <View style={styles.uploadButton}>
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  </View>
                </View>
              )}
            </Pressable>
          </Animatable.View>

          {form.imageUri ? (
            <View style={styles.imageInfoRow}>
              <Text numberOfLines={1} style={styles.imageName}>
                {form.imageName}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remover imagem do evento"
                disabled={isSaving}
                onPress={removeImage}
                style={styles.removeImageButton}>
                <MaterialIcons name="delete-outline" size={15} color={colors.status.danger} />
                <Text style={styles.removeImageText}>Remover imagem</Text>
              </Pressable>
            </View>
          ) : null}

          <Animatable.View
            animation="fadeInUp"
            delay={140}
            duration={420}
            style={styles.form}
            useNativeDriver={Platform.OS !== 'web'}>
            <LabeledInput
              error={errors.name}
              label="Nome do evento"
              onChangeText={(value) => updateField('name', value)}
              placeholder="Ex: Workshop de Produto Digital"
              value={form.name}
            />

            <LabeledInput
              active={isDatePopoverVisible}
              editable={false}
              error={errors.dateTime}
              label="Início do evento"
              onPress={openDatePicker}
              onPressIcon={openDatePicker}
              onChangeText={(value) => updateField('dateTime', value)}
              placeholder="15 AGO · 09:00"
              rightIcon="calendar-today"
              value={form.dateTime}
            />

            <LabeledInput
              active={isDatePopoverVisible && pickerTarget === 'end'}
              editable={false}
              error={errors.endDateTime}
              label="Encerramento do evento"
              onPress={openEndDatePicker}
              onPressIcon={openEndDatePicker}
              onChangeText={(value) => updateField('endDateTime', value)}
              placeholder="15 AGO · 11:00"
              rightIcon="schedule"
              value={form.endDateTime}
            />

            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Confirmação de presença</Text>
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Confirmação de presença" style={styles.attendanceOptions}>
                {attendanceOptions.map((option) => {
                  const selected = option.value === attendanceMode;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={option.value}
                      onPress={() => setAttendanceMode(option.value)}
                      style={[styles.attendanceOption, selected ? styles.attendanceOptionSelected : null]}>
                      <View style={styles.attendanceOptionCopy}>
                        <Text style={styles.attendanceOptionLabel}>{option.label}</Text>
                        <Text style={styles.attendanceOptionDescription}>{option.description}</Text>
                      </View>
                      <MaterialIcons
                        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={selected ? colors.brand.emphasis : colors.text.muted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.certificateSettings}>
              <View>
                <Text style={styles.certificateSectionTitle}>Certificado do evento</Text>
                <Text style={styles.certificateSectionDescription}>
                  Defina se este evento oferecerá certificado aos participantes.
                </Text>
              </View>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Disponibilidade de certificado"
                style={styles.certificateToggleOptions}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: hasCertificate }}
                  onPress={() => setHasCertificate(true)}
                  style={[styles.certificateToggleOption, hasCertificate && styles.certificateToggleOptionSelected]}>
                  <Text style={[styles.certificateToggleLabel, hasCertificate && styles.certificateToggleLabelSelected]}>
                    Oferecer certificado
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !hasCertificate }}
                  onPress={() => setHasCertificate(false)}
                  style={[styles.certificateToggleOption, !hasCertificate && styles.certificateToggleOptionSelected]}>
                  <Text style={[styles.certificateToggleLabel, !hasCertificate && styles.certificateToggleLabelSelected]}>
                    Não oferecer
                  </Text>
                </Pressable>
              </View>

              {hasCertificate ? (
                <>
                  <View>
                    <Text style={styles.certificateFieldLabel}>CARGA HORÁRIA</Text>
                    <View style={styles.certificateWorkloadInput}>
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={(value) => setWorkloadHours(value.replace(/[^0-9]/g, ''))}
                        placeholder="20"
                        placeholderTextColor="#A0A5AB"
                        style={styles.certificateWorkloadTextInput}
                        value={workloadHours}
                      />
                      <Text style={styles.certificateWorkloadSuffix}>horas</Text>
                    </View>
                  </View>
                  <View>
                    <Text style={styles.certificateFieldLabel}>GRUPO DE ATIVIDADES COMPLEMENTARES</Text>
                    <View style={styles.certificateGroupOptions}>
                      {certificateGroups.map((group) => {
                        const selected = hoursGroup === group.value;
                        return (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            key={group.value}
                            onPress={() => setHoursGroup(group.value)}
                            style={[styles.certificateGroupOption, selected && styles.certificateGroupOptionSelected]}>
                            <Text style={[styles.certificateGroupLabel, selected && styles.certificateGroupLabelSelected]}>
                              {group.label}
                            </Text>
                            <Text style={[styles.certificateGroupDescription, selected && styles.certificateGroupDescriptionSelected]}>
                              {group.description}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.certificateDisabledHint}>
                  Ao salvar, a configuração de certificado, a carga horária e o grupo serão removidos deste evento.
                </Text>
              )}
            </View>

            <LabeledInput
              error={errors.place}
              label="Local"
              onChangeText={(value) => updateField('place', value)}
              placeholder="Centro de Convenções"
              rightIcon="place"
              value={form.place}
            />

            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Descrição</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <TextInput
                multiline
                maxLength={DESCRIPTION_LIMIT}
                onBlur={() => setIsDescriptionFocused(false)}
                onChangeText={(value) => updateField('description', value)}
                onFocus={() => setIsDescriptionFocused(true)}
                placeholder="Informe agenda, público-alvo, responsáveis e requisitos..."
                placeholderTextColor="#B9BDC4"
                style={[
                  styles.descriptionInput,
                  isDescriptionFocused ? styles.inputFocused : null,
                  errors.description ? styles.inputError : null,
                ]}
                textAlignVertical="top"
                value={form.description}
              />
              <View style={styles.descriptionFooter}>
                <Text style={[styles.errorText, !errors.description && styles.hiddenText]}>
                  {errors.description ?? ' '}
                </Text>
                <Text
                  style={[
                    styles.counterText,
                    descriptionReachedLimit ? styles.counterLimit : null,
                  ]}>
                  {form.description.length}/{DESCRIPTION_LIMIT}
                </Text>
              </View>
              {descriptionReachedLimit ? (
                <Text style={styles.limitWarning}>Limite máximo de caracteres atingido.</Text>
              ) : null}
            </View>
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            delay={220}
            duration={420}
            style={styles.actions}
            useNativeDriver={Platform.OS !== 'web'}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || isLoadingEvent}
              onPress={saveEvent}
              style={[styles.saveButton, isSaving || isLoadingEvent ? styles.saveButtonDisabled : null]}>
              {isSaving ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <MaterialIcons name="event-available" size={18} color={colors.text.primary} />
              )}
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Atualizar Evento' : 'Salvar Evento'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={!hasDraft || isSaving || isEditing}
              onPress={discardDraft}
              style={[
                styles.discardButton,
                !hasDraft || isSaving || isEditing ? styles.discardButtonDisabled : null,
              ]}>
              <Text
                style={[
                  styles.discardText,
                  !hasDraft || isSaving || isEditing ? styles.discardTextDisabled : null,
                ]}>
                Descartar Rascunho
              </Text>
            </Pressable>

            {isEditing ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving || isLoadingEvent}
                onPress={() => setIsDeleteDialogVisible(true)}
                style={[styles.deleteButton, isSaving || isLoadingEvent ? styles.discardButtonDisabled : null]}>
                <MaterialIcons name="delete-outline" size={16} color={colors.status.danger} />
                <Text style={styles.deleteText}>Excluir Evento</Text>
              </Pressable>
            ) : null}
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={isDatePopoverVisible}
        onRequestClose={() => setIsDatePopoverVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation="zoomIn"
            duration={220}
            style={styles.datePopover}
            useNativeDriver={Platform.OS !== 'web'}>
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>
                {pickerTarget === 'end' ? 'Encerramento' : 'Data e horário'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar seletor"
                onPress={() => setIsDatePopoverVisible(false)}
                hitSlop={10}>
                <MaterialIcons name="close" size={22} color={colors.text.secondary} />
              </Pressable>
            </View>
            <CampusDatePicker
              date={draftDate}
              endYear={new Date().getFullYear() + 5}
              firstDayOfWeek={0}
              locale="pt-br"
              minDate={minimumSelectableDate}
              onChange={(params) => handlePickerChange(params.date)}
              startYear={new Date().getFullYear()}
              timePicker
              timeZone={CAMPUS_TIME_ZONE}
              use12Hours={false}
            />
            <View style={styles.popoverActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsDatePopoverVisible(false)}
                style={styles.popoverCancelButton}>
                <Text style={styles.popoverCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={applyDateTimeSelection}
                style={styles.popoverConfirmButton}>
                <Text style={styles.popoverConfirmText}>Aplicar</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </View>
      </Modal>

      <UnsavedChangesDialog
        visible={Boolean(pendingNavigation)}
        onCancel={cancelPendingNavigation}
        onDiscard={discardChangesAndLeave}
      />
      <UnsavedChangesDialog
        cancelLabel="Manter evento"
        confirmLabel="Excluir evento"
        message="Esta ação exclui o evento permanentemente e não pode ser desfeita."
        title="Excluir evento?"
        visible={isDeleteDialogVisible}
        onCancel={() => setIsDeleteDialogVisible(false)}
        onDiscard={handleDeleteEvent}
      />
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

type LabeledInputProps = {
  active?: boolean;
  editable?: boolean;
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  onPress?: () => void;
  onPressIcon?: () => void;
  placeholder: string;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  value: string;
};

function LabeledInput({
  active = false,
  editable = true,
  error,
  label,
  onChangeText,
  onPress,
  onPressIcon,
  placeholder,
  rightIcon,
  value,
}: LabeledInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<NativeTextInputInstance>(null);
  const isActive = active || isFocused;

  return (
    <View>
      <AppFieldLabel label={label} required style={styles.sharedFieldLabel} />
      <Pressable
        onPress={onPress ?? (() => inputRef.current?.focus())}
        style={[
          styles.inputShell,
          isActive ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}>
        <TextInput
          ref={inputRef}
          editable={editable}
          onChangeText={onChangeText}
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor="#C7C9CE"
          style={[styles.textInput, { pointerEvents: editable ? 'auto' : 'none' }]}
          value={value}
        />
        {rightIcon ? (
          <Pressable accessibilityRole="button" onPress={onPressIcon} hitSlop={10}>
            <MaterialIcons name={rightIcon} size={20} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </Pressable>
      <Text style={[styles.errorText, !error && styles.hiddenText]}>{error ?? ' '}</Text>
    </View>
  );
}

function formatDateTime(value: Date) {
  return formatCampusDateTimeLabel(value);
}

function hasImageChanged(form: EventForm, savedForm: EventForm) {
  return (
    form.imageBase64 !== savedForm.imageBase64 ||
    form.imageMimeType !== savedForm.imageMimeType ||
    form.imageName !== savedForm.imageName ||
    form.imageUri !== savedForm.imageUri
  );
}

function toNativeDate(value: DateType) {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const nextDate = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(nextDate.getTime()) ? new Date() : nextDate;
  }

  if (value && typeof value === 'object' && '$d' in value) {
    const nextDate = new Date((value as { $d: Date }).$d);
    return Number.isNaN(nextDate.getTime()) ? new Date() : nextDate;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const timestamp = typeof value === 'number' && value > 0 && value < 10_000_000_000
      ? value * 1000
      : value;
    const nextDate = new Date(timestamp);
    return Number.isNaN(nextDate.getTime()) ? new Date() : nextDate;
  }

  return new Date();
}

function isDateInPast(value: Date) {
  return value.getTime() <= Date.now();
}

function areEventFormsEqual(left: EventForm, right: EventForm) {
  return (
    left.imageName === right.imageName &&
    left.imageUri === right.imageUri &&
    left.imageMimeType === right.imageMimeType &&
    left.imageBase64 === right.imageBase64 &&
    left.name === right.name &&
    left.dateTime === right.dateTime &&
    left.endDateTime === right.endDateTime &&
    left.place === right.place &&
    left.description === right.description
  );
}

const styles = StyleSheet.create({
  permissionLoading: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
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
    paddingBottom: 32,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: 32,
    marginBottom: 12,
  },
  backText: {
    color: '#161616',
    fontSize: 14,
    fontWeight: '800',
  },
  uploadCard: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderColor: '#D6D6D6',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 168,
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 3,
  },
  uploadTitle: {
    color: '#565656',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  uploadHint: {
    color: '#A0A0A0',
    fontSize: 10,
    marginBottom: 8,
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: 18,
    height: 28,
    justifyContent: 'center',
    minWidth: 108,
    paddingHorizontal: 22,
  },
  uploadButtonText: {
    color: '#2A2A2A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  imageInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  imageName: {
    color: '#7A7F87',
    flex: 1,
    fontSize: 11,
  },
  removeImageButton: {
    alignItems: 'center',
    backgroundColor: '#FEE4E2',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
  },
  removeImageText: {
    color: colors.status.danger,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  loadingEventBox: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
    padding: 14,
  },
  loadingEventText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 17, 17, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  datePopover: {
    backgroundColor: colors.neutral.white,
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
    color: colors.text.heading,
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
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  popoverConfirmButton: {
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    minWidth: 104,
    paddingHorizontal: 16,
  },
  popoverConfirmText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  editorPageHeader: { marginTop: 4, marginBottom: 14 },
  form: {
    gap: 8,
    marginTop: 16,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  attendanceOptions: {
    gap: 8,
  },
  certificateSettings: {
    backgroundColor: colors.neutral.white,
    borderColor: '#E0E2E5',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 4,
    padding: 14,
  },
  certificateSectionTitle: {
    color: colors.text.heading,
    fontSize: 14,
    fontWeight: '800',
  },
  certificateSectionDescription: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  certificateToggleOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  certificateToggleOption: {
    alignItems: 'center',
    backgroundColor: colors.surface.subtle,
    borderColor: 'transparent',
    borderRadius: 6,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  certificateToggleOptionSelected: {
    backgroundColor: '#FFF8D6',
    borderColor: '#D7A900',
  },
  certificateToggleLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  certificateToggleLabelSelected: {
    color: '#242424',
  },
  certificateFieldLabel: {
    color: '#535B64',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 7,
  },
  certificateWorkloadInput: {
    ...appSurfaceStyles.input,
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  certificateWorkloadTextInput: {
    color: colors.text.heading,
    flex: 1,
    fontSize: 13,
    height: 44,
  },
  certificateWorkloadSuffix: {
    color: colors.text.muted,
    fontSize: 11,
  },
  certificateGroupOptions: {
    gap: 7,
  },
  certificateGroupOption: {
    borderColor: colors.border.default,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  certificateGroupOptionSelected: {
    backgroundColor: '#FFF8D6',
    borderColor: '#D7A900',
  },
  certificateGroupLabel: {
    color: '#565E67',
    fontSize: 11,
    fontWeight: '900',
  },
  certificateGroupLabelSelected: {
    color: colors.text.primary,
  },
  certificateGroupDescription: {
    color: colors.text.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  certificateGroupDescriptionSelected: {
    color: '#655311',
  },
  certificateDisabledHint: {
    color: '#747D87',
    fontSize: 11,
    lineHeight: 16,
  },
  attendanceOption: {
    alignItems: 'center',
    backgroundColor: colors.surface.subtle,
    borderColor: colors.border.default,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  attendanceOptionSelected: {
    backgroundColor: colors.brand.soft,
    borderColor: colors.brand.primary,
    borderWidth: 1.5,
  },
  attendanceOptionCopy: { flex: 1, gap: 3 },
  attendanceOptionLabel: {
    color: colors.text.heading,
    fontSize: 13,
    fontWeight: '600',
  },
  attendanceOptionDescription: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  sharedFieldLabel: { marginBottom: 8 },
  label: {
    color: '#2B2B2B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  required: {
    color: colors.status.dangerStrong,
    fontSize: 11,
    fontWeight: '900',
  },
  inputShell: {
    ...appSurfaceStyles.input,
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: colors.brand.soft,
    borderColor: colors.brand.primary,
  },
  textInput: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  descriptionInput: {
    ...appSurfaceStyles.input,
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 146,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  descriptionFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 22,
  },
  inputError: {
    borderColor: colors.status.dangerStrong,
    borderBottomColor: colors.status.dangerStrong,
  },
  errorText: {
    color: colors.status.dangerStrong,
    fontSize: 11,
    marginTop: 4,
  },
  hiddenText: {
    opacity: 0,
  },
  counterText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  counterLimit: {
    color: colors.status.dangerStrong,
    fontWeight: '700',
  },
  limitWarning: {
    color: colors.status.dangerStrong,
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    gap: 14,
    marginTop: 46,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: 7,
    flexDirection: 'row',
    gap: 12,
    height: 64,
    justifyContent: 'center',
    boxShadow: '0px 8px 14px rgba(198, 143, 0, 0.18)',
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  discardButton: {
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    height: 34,
    justifyContent: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FEE4E2',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    height: 42,
    justifyContent: 'center',
  },
  discardButtonDisabled: {
    opacity: 0.52,
  },
  discardText: {
    color: '#8D929A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  discardTextDisabled: {
    color: '#B8BCC3',
  },
  deleteText: {
    color: colors.status.danger,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
