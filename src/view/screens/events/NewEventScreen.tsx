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
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateType } from 'react-native-ui-datepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppToast } from '@/components/ui/app-toast';
import { UnsavedChangesDialog } from '@/components/ui/unsaved-changes-dialog';
import {
  createEvent,
  deleteEvent,
  EventCreateIn,
  EventUpdateIn,
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

type EventForm = {
  imageName: string;
  imageUri: string;
  imageMimeType: string;
  imageBase64: string;
  name: string;
  dateTime: string;
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
  place: '',
  description: '',
};

const requiredFields: (keyof Pick<EventForm, 'name' | 'dateTime' | 'place' | 'description'>)[] = [
  'name',
  'dateTime',
  'place',
  'description',
];

export default function NewEventScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const editingEventId = eventId ? Number(eventId) : null;
  const [form, setForm] = useState<EventForm>(initialForm);
  const [savedForm, setSavedForm] = useState<EventForm>(initialForm);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [savedSelectedDate, setSavedSelectedDate] = useState<Date | null>(null);
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
        (selectedDate?.getTime() ?? null) !== (savedSelectedDate?.getTime() ?? null)),
    [form, isLoadingEvent, savedForm, savedSelectedDate, selectedDate],
  );

  useEffect(() => {
    let isMounted = true;

    async function checkPermission() {
      try {
        const session = await getValidAuthSession();
        if (!isMounted) return;

        if (session.payload.role !== 'professor') {
          router.replace('/calendario' as never);
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
          router.replace('/calendario' as never);
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
        const nextForm = {
          imageName: event.image ? 'banner-atual.jpg' : '',
          imageUri: getEventImageUri(event.image) ?? '',
          imageMimeType: event.image ? 'image/jpeg' : '',
          imageBase64: getEventImageBase64(event.image),
          name: event.name,
          dateTime: formatDateTime(nextDate),
          place: event.event_location,
          description: event.description,
        };

        setSelectedDate(nextDate);
        setSavedSelectedDate(nextDate);
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
    setMinimumSelectableDate(now);
    setDraftDate(selectedDate && !isDateInPast(selectedDate) ? selectedDate : now);
    setIsDatePopoverVisible(true);
  }

  function openTimePicker() {
    openDatePicker();
  }

  function applyDateTimeSelection() {
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

    setIsSaving(true);

    try {
      if (!selectedDate) {
        return;
      }

      const payload: EventCreateIn = {
        image: form.imageBase64 || null,
        name: form.name.trim(),
        event_datetime: toCampusDateTimeIso(selectedDate),
        event_location: form.place.trim(),
        description: form.description.trim(),
      };

      if (isEditing && editingEventId !== null) {
        const updatePayload: EventUpdateIn = { ...payload };

        if (!hasImageChanged(form, savedForm)) {
          delete updatePayload.image;
        }

        await updateEvent(editingEventId, updatePayload);
        setSavedForm(form);
        setSavedSelectedDate(selectedDate);
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
          error instanceof Error ? error.message : 'Verifique se a API está rodando e tente novamente.',
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
    setDraftDate(new Date());
    setIsDatePopoverVisible(false);
    setErrors({});
  }

  function restoreSavedDraft() {
    setForm(savedForm);
    setSelectedDate(savedSelectedDate);
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
          <ActivityIndicator size="large" color="#FFCC00" />
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
          <Animatable.View animation="fadeInLeft" duration={360} useNativeDriver>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() =>
                requestLeave(() => (router.canGoBack() ? router.back() : router.replace('/')))
              }
              style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={20} color="#FFCC00" />
              <Text style={styles.backText}>Voltar</Text>
            </Pressable>
          </Animatable.View>

          {isLoadingEvent ? (
            <Animatable.View
              animation="pulse"
              iterationCount="infinite"
              style={styles.loadingEventBox}
              useNativeDriver>
              <ActivityIndicator color="#111111" />
              <Text style={styles.loadingEventText}>Carregando evento...</Text>
            </Animatable.View>
          ) : null}

          <Animatable.View animation="fadeInUp" delay={80} duration={420} useNativeDriver>
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
                <MaterialIcons name="delete-outline" size={15} color="#B42318" />
                <Text style={styles.removeImageText}>Remover imagem</Text>
              </Pressable>
            </View>
          ) : null}

          <Animatable.View
            animation="fadeInUp"
            delay={140}
            duration={420}
            style={styles.form}
            useNativeDriver>
            <LabeledInput
              error={errors.name}
              label="Nome do Evento"
              onChangeText={(value) => updateField('name', value)}
              placeholder="Ex: Workshop de Produto Digital"
              value={form.name}
            />

            <LabeledInput
              active={isDatePopoverVisible}
              editable={false}
              error={errors.dateTime}
              label="Data e Horário"
              onPress={openDatePicker}
              onPressIcon={openDatePicker}
              onChangeText={(value) => updateField('dateTime', value)}
              placeholder="15 AGO · 09:00"
              rightIcon="calendar-today"
              value={form.dateTime}
            />

            <View style={styles.dateTimeActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Selecionar data do evento"
                onPress={openDatePicker}
                style={styles.dateTimeButton}>
                <MaterialIcons name="event" size={16} color="#111111" />
                <Text style={styles.dateTimeButtonText}>Data</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Selecionar horário do evento"
                onPress={openTimePicker}
                style={styles.dateTimeButton}>
                <MaterialIcons name="schedule" size={16} color="#111111" />
                <Text style={styles.dateTimeButtonText}>Horário</Text>
              </Pressable>
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
            useNativeDriver>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || isLoadingEvent}
              onPress={saveEvent}
              style={[styles.saveButton, isSaving || isLoadingEvent ? styles.saveButtonDisabled : null]}>
              {isSaving ? (
                <ActivityIndicator color="#111111" />
              ) : (
                <MaterialIcons name="event-available" size={18} color="#111111" />
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
                <MaterialIcons name="delete-outline" size={16} color="#B42318" />
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
            useNativeDriver>
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>Data e horário</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar seletor"
                onPress={() => setIsDatePopoverVisible(false)}
                hitSlop={10}>
                <MaterialIcons name="close" size={22} color="#5F6670" />
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
        message="Esta ação remove o evento do backend e não pode ser desfeita."
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
  const inputRef = useRef<TextInput>(null);
  const isActive = active || isFocused;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.required}>*</Text>
      </View>
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
          pointerEvents={editable ? 'auto' : 'none'}
          style={styles.textInput}
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
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
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
    backgroundColor: '#FFFFFF',
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
    color: '#B42318',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  loadingEventBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
    padding: 14,
  },
  loadingEventText: {
    color: '#5F6670',
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
  form: {
    gap: 8,
    marginTop: 16,
  },
  dateTimeActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -4,
    marginBottom: 8,
  },
  dateTimeButton: {
    alignItems: 'center',
    backgroundColor: '#F3F3F4',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 7,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dateTimeButtonText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  label: {
    color: '#2B2B2B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  required: {
    color: '#F04438',
    fontSize: 11,
    fontWeight: '900',
  },
  inputShell: {
    alignItems: 'center',
    borderBottomColor: '#DADDE2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
  },
  inputFocused: {
    backgroundColor: '#FFFBEA',
    borderBottomColor: '#FFCC00',
  },
  textInput: {
    color: '#202020',
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  descriptionInput: {
    backgroundColor: '#F3F3F4',
    borderColor: '#F3F3F4',
    borderRadius: 2,
    borderWidth: 1,
    color: '#202020',
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
    borderColor: '#F04438',
    borderBottomColor: '#F04438',
  },
  errorText: {
    color: '#F04438',
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
    color: '#F04438',
    fontWeight: '700',
  },
  limitWarning: {
    color: '#F04438',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    gap: 14,
    marginTop: 46,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 12,
    height: 64,
    justifyContent: 'center',
    shadowColor: '#C68F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  discardButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    color: '#B42318',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
