import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  Platform,
  ActivityIndicator,
  Animated as NativeAnimated,
  FlatList,
  ListRenderItem,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/ui/app-text';
import { AppToast } from '@/components/ui/app-toast';
import { useAppToast } from '@/src/view/hooks/useAppToast';
import { AppButton, AppEmptyState, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import {
  CampusEvent,
  isAuthSessionError,
  listEvents,
  listSubscribedEvents,
  subscribeToEvent,
  unsubscribeFromEvent,
} from '@/src/lib/api/campus';
import { formatCampusDayMonth } from '@/src/lib/datetime/campusTime';
import { getEventImageUri } from '@/src/lib/events/eventImage';


type EventViewMode = 'featured' | 'grid' | 'list';
type EventViewIcon = 'view-agenda' | 'grid-view' | 'view-list';
type EventPresentationRow = { key: string; events: CampusEvent[]; startIndex: number; isGridRow: boolean };
const EVENT_VIEW_MODES: EventViewMode[] = ['featured', 'grid', 'list'];

export default function HomeScreen() {
  const router = useRouter();
  const { showToast, toast } = useAppToast();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [subscribedIds, setSubscribedIds] = useState<Set<number>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<EventViewMode>('featured');

  const handleToggleSubscription = useCallback(
    async (eventId: number) => {
      const wasSubscribed = subscribedIds.has(eventId);

      setPendingIds((current) => new Set(current).add(eventId));
      setSubscribedIds((current) => toggleId(current, eventId, !wasSubscribed));

      try {
        if (wasSubscribed) {
          await unsubscribeFromEvent(eventId);
        } else {
          await subscribeToEvent(eventId);
        }
      } catch (toggleError) {
        if (isAuthSessionError(toggleError)) {
          router.replace('/login' as never);
          return;
        }

        // Rollback the optimistic change on failure.
        setSubscribedIds((current) => toggleId(current, eventId, wasSubscribed));
        showToast({
          message: toggleError instanceof Error
            ? toggleError.message
            : 'Não foi possível atualizar sua inscrição.',
          type: 'error',
        });
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(eventId);
          return next;
        });
      }
    },
    [router, showToast, subscribedIds],
  );

  const presentationRows = useMemo<EventPresentationRow[]>(() => {
    if (viewMode === 'grid') {
      const rows: EventPresentationRow[] = [];
      for (let index = 0; index < events.length; index += 2) {
        const rowEvents = events.slice(index, index + 2);
        rows.push({
          key: `grid-${rowEvents.map((event) => event.id).join('-')}`,
          events: rowEvents,
          startIndex: index,
          isGridRow: true,
        });
      }
      return rows;
    }

    return events.map((event, index) => ({
      key: `${viewMode}-${event.id}`,
      events: [event],
      startIndex: index,
      isGridRow: false,
    }));
  }, [events, viewMode]);

  const renderPresentationRow = useCallback<ListRenderItem<EventPresentationRow>>(
    ({ item }) => {
      const cards = item.events.map((event, offset) => (
        <EventCard
          key={event.id}
          event={event}
          index={item.startIndex + offset}
          isPending={pendingIds.has(event.id)}
          isSubscribed={subscribedIds.has(event.id)}
          onToggleSubscription={handleToggleSubscription}
          viewMode={viewMode}
        />
      ));

      return item.isGridRow ? <View style={styles.gridRow}>{cards}</View> : cards[0] ?? null;
    },
    [handleToggleSubscription, pendingIds, subscribedIds, viewMode],
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadHome() {
        setIsLoading(true);

        try {
          const [apiEvents, subscribedEvents] = await Promise.all([
            listEvents(),
            listSubscribedEvents(),
          ]);

          if (!isMounted) {
            return;
          }

          setEvents(apiEvents);
          setSubscribedIds(new Set(subscribedEvents.map((event) => event.id)));
        } catch (homeError) {
          if (isAuthSessionError(homeError)) {
            router.replace('/login' as never);
            return;
          }

          if (isMounted) {
            setEvents([]);
            setSubscribedIds(new Set());
            showToast({
              message: homeError instanceof Error
                ? homeError.message
                : 'Não foi possível carregar os eventos. Tente novamente.',
              type: 'error',
            });
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      void loadHome();

      return () => {
        isMounted = false;
      };
    }, [router, showToast]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={[styles.content, viewMode === 'grid' ? styles.gridContent : null]}
        data={presentationRows}
        initialNumToRender={4}
        keyExtractor={(row) => row.key}
        ListEmptyComponent={!isLoading ? EmptyEvents : null}
        ListHeaderComponent={
          <HomeHeader isLoading={isLoading} viewMode={viewMode} onChangeViewMode={setViewMode} />
        }
        maxToRenderPerBatch={5}
        renderItem={renderPresentationRow}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
      <AppToast visible={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} />
    </SafeAreaView>
  );
}

function HomeHeader({
  isLoading,
  viewMode,
  onChangeViewMode,
}: {
  isLoading: boolean;
  viewMode: EventViewMode;
  onChangeViewMode: (mode: EventViewMode) => void;
}) {
  return (
    <>
      {/* Native FlatList can re-render its header when the presentation mode changes.
          Keep the title static on native so its entrance animation never replays. */}
      {Platform.OS === 'web' ? (
        <Animatable.View animation="fadeInDown" duration={420} useNativeDriver={false}>
          <AppPageHeader title="Eventos Culturais UTFPR" style={styles.homePageHeader} />
        </Animatable.View>
      ) : (
        <View>
          <AppPageHeader title="Eventos Culturais UTFPR" style={styles.homePageHeader} />
        </View>
      )}

      <ViewModeSelector viewMode={viewMode} onChangeViewMode={onChangeViewMode} />

      {isLoading ? (
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          style={styles.loadingRow}
          useNativeDriver={Platform.OS !== 'web'}>
          <ActivityIndicator color={colors.text.primary} />
          <Text style={styles.loadingText}>Atualizando eventos...</Text>
        </Animatable.View>
      ) : null}
    </>
  );
}

function ViewModeSelector({
  viewMode,
  onChangeViewMode,
}: {
  viewMode: EventViewMode;
  onChangeViewMode: (mode: EventViewMode) => void;
}) {
  const selectorRef = useRef<View>(null);
  const [selectorWidth, setSelectorWidth] = useState(0);
  const indicatorX = useRef(new NativeAnimated.Value(0)).current;
  const suppressPressRef = useRef(false);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const activeModeIndex = EVENT_VIEW_MODES.indexOf(viewMode);
  const segmentWidth = Math.max(0, (selectorWidth - 16) / EVENT_VIEW_MODES.length);
  const maxIndicatorX = Math.max(0, segmentWidth * (EVENT_VIEW_MODES.length - 1));

  const onLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    setSelectorWidth(event.nativeEvent.layout.width);
  };

  const animateIndicatorTo = useCallback((index: number) => {
    NativeAnimated.spring(indicatorX, {
      toValue: Math.max(0, Math.min(EVENT_VIEW_MODES.length - 1, index)) * segmentWidth,
      damping: 19,
      stiffness: 230,
      mass: 0.72,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [indicatorX, segmentWidth]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      Platform.OS !== 'web'
      && Math.abs(gesture.dx) >= 14
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2
    ),
    onPanResponderGrant: () => {
      suppressPressRef.current = true;
      indicatorX.setValue(Math.max(0, Math.min(maxIndicatorX, activeModeIndex * segmentWidth)));
    },
    onPanResponderMove: (_event, gesture) => {
      // The indicator follows the finger, but the selector can advance only
      // one adjacent option per gesture.
      const boundedDx = Math.max(-segmentWidth, Math.min(segmentWidth, gesture.dx));
      const nextX = Math.max(0, Math.min(maxIndicatorX, activeModeIndex * segmentWidth + boundedDx));
      indicatorX.setValue(nextX);
    },
    onPanResponderRelease: (_event, gesture) => {
      const halfSegment = segmentWidth / 2;
      const direction = gesture.dx > halfSegment ? 1 : gesture.dx < -halfSegment ? -1 : 0;
      const nextIndex = Math.max(0, Math.min(EVENT_VIEW_MODES.length - 1, activeModeIndex + direction));
      if (nextIndex !== activeModeIndex) {
        onChangeViewMode(EVENT_VIEW_MODES[nextIndex]);
      } else {
        animateIndicatorTo(activeModeIndex);
      }
      setTimeout(() => { suppressPressRef.current = false; }, 300);
    },
    onPanResponderTerminate: () => {
      animateIndicatorTo(activeModeIndex);
      setTimeout(() => { suppressPressRef.current = false; }, 300);
    },
    onPanResponderTerminationRequest: () => false,
  }), [activeModeIndex, animateIndicatorTo, indicatorX, maxIndicatorX, onChangeViewMode, segmentWidth]);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const animation = NativeAnimated.spring(indicatorX, {
      toValue: activeModeIndex * segmentWidth,
      damping: 19,
      stiffness: 230,
      mass: 0.72,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [activeModeIndex, indicatorX, segmentWidth]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = selectorRef.current as unknown as HTMLElement | null;
    if (!element) return;
    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = 'pan-y';

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      if (!pointer.dragging) {
        if (Math.abs(dx) < 14 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
        pointer.dragging = true;
        suppressPressRef.current = true;
      }
      event.preventDefault();
      const boundedDx = Math.max(-segmentWidth, Math.min(segmentWidth, dx));
      const nextX = Math.max(0, Math.min(maxIndicatorX, activeModeIndex * segmentWidth + boundedDx));
      indicatorX.setValue(nextX);
    };

    const finishPointer = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointerRef.current = null;
      if (!pointer.dragging) {
        suppressPressRef.current = false;
        return;
      }
      const dx = event.clientX - pointer.startX;
      const halfSegment = segmentWidth / 2;
      const direction = dx > halfSegment ? 1 : dx < -halfSegment ? -1 : 0;
      const nextIndex = Math.max(0, Math.min(EVENT_VIEW_MODES.length - 1, activeModeIndex + direction));
      if (nextIndex !== activeModeIndex) {
        onChangeViewMode(EVENT_VIEW_MODES[nextIndex]);
      } else {
        animateIndicatorTo(activeModeIndex);
      }
      // Keep the press suppressed until the browser emits the synthetic click.
      window.setTimeout(() => { suppressPressRef.current = false; }, 350);
    };

    const cancelPointer = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointerRef.current = null;
      animateIndicatorTo(activeModeIndex);
      suppressPressRef.current = false;
    };

    element.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', finishPointer);
    document.addEventListener('pointercancel', cancelPointer);
    return () => {
      element.style.touchAction = previousTouchAction;
      element.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', finishPointer);
      document.removeEventListener('pointercancel', cancelPointer);
    };
  }, [activeModeIndex, animateIndicatorTo, indicatorX, maxIndicatorX, onChangeViewMode, segmentWidth]);

  const selectMode = (mode: EventViewMode) => {
    if (suppressPressRef.current) return;
    onChangeViewMode(mode);
  };

  return (
    <View style={styles.viewModeContainer}>
      <View
        ref={selectorRef}
        collapsable={false}
        onLayout={onLayout}
        accessibilityRole="radiogroup"
        style={styles.viewModeSelector}
        {...panResponder.panHandlers}>
        {segmentWidth > 0 ? (
          <NativeAnimated.View
            style={[
              styles.viewModeIndicator,
              { pointerEvents: 'none' },
              { width: segmentWidth, transform: [{ translateX: indicatorX }] },
            ]}
          />
        ) : null}
        <ViewModeButton
          accessibilityLabel="Cartões grandes"
          icon="view-agenda"
          isSelected={viewMode === 'featured'}
          label="Destaques"
          onPress={() => selectMode('featured')}
        />
        <ViewModeButton
          accessibilityLabel="Grade com duas colunas"
          icon="grid-view"
          isSelected={viewMode === 'grid'}
          label="Grade"
          onPress={() => selectMode('grid')}
        />
        <ViewModeButton
          accessibilityLabel="Lista compacta"
          icon="view-list"
          isSelected={viewMode === 'list'}
          label="Lista"
          onPress={() => selectMode('list')}
        />
      </View>
    </View>
  );
}

function ViewModeButton({
  accessibilityLabel,
  icon,
  isSelected,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  icon: EventViewIcon;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Você também pode deslizar para alternar a visualização"
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={styles.viewModeButtonPressable}>
      <View style={styles.viewModeButton}>
        <MaterialIcons color={isSelected ? colors.text.primary : '#777777'} name={icon} size={17} />
        <Text style={[styles.viewModeButtonText, isSelected ? styles.viewModeButtonTextSelected : null]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyEvents() {
  return (
    <AppEmptyState
      title="Nenhum evento disponível"
      description="Quando novos eventos forem publicados, eles aparecerão aqui."
      icon={<MaterialIcons name="event-available" size={24} color={colors.text.muted} />}
      style={styles.emptyState}
    />
  );
}

function EventCard({
  event,
  index,
  isPending,
  isSubscribed,
  onToggleSubscription,
  viewMode,
}: {
  event: CampusEvent;
  index: number;
  isPending: boolean;
  isSubscribed: boolean;
  onToggleSubscription: (eventId: number) => void;
  viewMode: EventViewMode;
}) {
  const imageUri = getEventImageUri(event.image);

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={index * 90}
      duration={420}
      style={[
        styles.card,
        viewMode === 'grid' ? styles.gridCard : null,
        viewMode === 'list' ? styles.listCard : null,
      ]}
      useNativeDriver={Platform.OS !== 'web'}>
      <View
        style={[
          styles.eventVisual,
          viewMode === 'grid' ? styles.gridEventVisual : null,
          viewMode === 'list' ? styles.listEventVisual : null,
          index % 2 ? styles.artVisual : styles.musicVisual,
        ]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} contentFit="cover" style={styles.eventImage} />
        ) : index % 2 ? (
          <>
            <View style={styles.artShapeLarge} />
            <View style={styles.artShapeMedium} />
            <View style={styles.artShapeSmall} />
          </>
        ) : (
          <>
            <View style={styles.stageLight} />
            <MaterialIcons
              name="mic"
              size={viewMode === 'featured' ? 88 : 42}
              color="#1A1A1A"
            />
          </>
        )}
      </View>

      <View
        style={[
          styles.cardBody,
          viewMode === 'grid' ? styles.gridCardBody : null,
          viewMode === 'list' ? styles.listCardBody : null,
        ]}>
        <Text numberOfLines={viewMode === 'featured' ? 1 : 2} style={styles.meta}>
          <Text style={styles.metaDate}>{formatCampusDayMonth(event.event_datetime)}</Text>
          {'  •  '}
          {event.event_location}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.eventTitle, viewMode !== 'featured' ? styles.compactEventTitle : null]}>
          {event.name}
        </Text>
        <Text numberOfLines={2} style={styles.eventDescription}>
          {event.description}
        </Text>
        <Animatable.View animation="fadeIn" delay={index * 90 + 180} useNativeDriver={Platform.OS !== 'web'}>
          <AppButton
            label={isSubscribed ? 'Cancelar inscrição' : 'Inscrever-se'}
            variant={isSubscribed ? 'secondary' : 'primary'}
            size={viewMode === 'featured' ? 'lg' : 'md'}
            fullWidth
            loading={isPending}
            disabled={isPending}
            onPress={() => onToggleSubscription(event.id)}
            style={styles.sharedEventButton}
          />
        </Animatable.View>
      </View>
    </Animatable.View>
  );
}


function toggleId(current: Set<number>, eventId: number, shouldContain: boolean) {
  const next = new Set(current);

  if (shouldContain) {
    next.add(eventId);
  } else {
    next.delete(eventId);
  }

  return next;
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen,
    flex: 1,
  },
  content: {
    ...appLayoutStyles.content,
    gap: 18,
    paddingBottom: 108,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  gridContent: {
    gap: 12,
  },
  gridRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  homePageHeader: { marginBottom: 16, paddingTop: 6 },
  emptyState: { ...appSurfaceStyles.card, marginTop: 12 },
  sharedEventButton: { marginTop: 12 },
  viewModeContainer: {
    marginBottom: 4,
  },
  viewModeSelector: {
    position: 'relative',
    backgroundColor: '#EEEEF0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  viewModeIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 6,
    backgroundColor: colors.neutral.white,
  },
  viewModeButtonPressable: { flex: 1, minWidth: 0, borderRadius: 6, zIndex: 1 },
  viewModeButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 5,
  },
  viewModeButtonText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '500',
  },
  viewModeButtonTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: '#7A7F87',
    fontSize: 13,
    fontWeight: '800',
    paddingTop: 32,
    textAlign: 'center',
  },
  card: {
    ...appSurfaceStyles.card,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 3px 8px rgba(17, 17, 17, 0.14)',
    elevation: 3,
  },
  gridCard: {
    flex: 1,
    minWidth: 0,
  },
  listCard: {
    flexDirection: 'row',
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 34,
    paddingHorizontal: 12,
  },
  authorAvatar: {
    alignItems: 'center',
    backgroundColor: colors.text.heading,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  authorName: {
    color: colors.text.heading,
    fontSize: 10,
    fontWeight: '800',
  },
  eventVisual: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridEventVisual: {
    height: 116,
  },
  listEventVisual: {
    alignSelf: 'stretch',
    minHeight: 170,
    flexShrink: 0,
    width: 112,
  },
  eventImage: {
    height: '100%',
    width: '100%',
  },
  musicVisual: {
    backgroundColor: '#A66605',
  },
  artVisual: {
    backgroundColor: '#0F7190',
  },
  stageLight: {
    backgroundColor: '#FFD45A',
    borderRadius: 58,
    height: 116,
    opacity: 0.85,
    position: 'absolute',
    right: 28,
    top: 24,
    width: 116,
  },
  artShapeLarge: {
    backgroundColor: '#F9CE38',
    height: 320,
    left: -76,
    position: 'absolute',
    top: -30,
    transform: [{ rotate: '-28deg' }],
    width: 116,
  },
  artShapeMedium: {
    backgroundColor: '#3CB4AE',
    height: 260,
    left: 74,
    position: 'absolute',
    top: -20,
    transform: [{ rotate: '38deg' }],
    width: 138,
  },
  artShapeSmall: {
    backgroundColor: '#203D5E',
    height: 260,
    position: 'absolute',
    right: -28,
    top: 10,
    transform: [{ rotate: '28deg' }],
    width: 130,
  },
  cardBody: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  gridCardBody: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 11,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  listCardBody: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 10,
    paddingHorizontal: 11,
    paddingTop: 10,
  },
  meta: {
    color: '#686868',
    fontSize: 10,
    fontWeight: '800',
  },
  metaDate: {
    color: '#9A7A00',
    fontWeight: '900',
  },
  eventTitle: {
    color: colors.text.heading,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: 8,
  },
  compactEventTitle: {
    fontSize: 15,
    lineHeight: 19,
  },
  eventDescription: {
    color: '#555A61',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
  },
  compactEventButton: {
    height: 40,
    marginTop: 11,
  },
  compactEventButtonText: {
    fontSize: 10,
  },
  eventButton: {
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: 3,
    height: 46,
    justifyContent: 'center',
    marginTop: 16,
  },
  eventButtonSubscribed: {
    backgroundColor: colors.neutral.white,
    borderColor: colors.text.primary,
    borderWidth: 1.5,
  },
  eventButtonPending: {
    opacity: 0.7,
  },
  eventButtonText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  eventButtonTextSubscribed: {
    color: colors.text.primary,
  },
});
