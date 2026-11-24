import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function HomeScreen() {
  const router = useRouter();
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
        Alert.alert(
          'Ops',
          toggleError instanceof Error
            ? toggleError.message
            : 'Não foi possível atualizar sua inscrição.',
        );
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(eventId);
          return next;
        });
      }
    },
    [router, subscribedIds],
  );

  const renderEvent = useCallback<ListRenderItem<CampusEvent>>(
    ({ item, index }) => (
      <EventCard
        event={item}
        index={index}
        isPending={pendingIds.has(item.id)}
        isSubscribed={subscribedIds.has(item.id)}
        onToggleSubscription={handleToggleSubscription}
        viewMode={viewMode}
      />
    ),
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
    }, [router]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        key={`events-${viewMode}`}
        contentContainerStyle={[styles.content, viewMode === 'grid' ? styles.gridContent : null]}
        data={events}
        initialNumToRender={4}
        keyExtractor={keyExtractor}
        ListEmptyComponent={!isLoading ? EmptyEvents : null}
        ListHeaderComponent={
          <HomeHeader isLoading={isLoading} viewMode={viewMode} onChangeViewMode={setViewMode} />
        }
        maxToRenderPerBatch={5}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        renderItem={renderEvent}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
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
      <Animatable.Text
        animation="fadeInDown"
        duration={420}
        style={styles.headerTitle}
        useNativeDriver>
        Eventos Culturais UTFPR
      </Animatable.Text>

      <View style={styles.viewModeContainer}>
        <Text style={styles.viewModeLabel}>Visualização</Text>
        <View accessibilityRole="radiogroup" style={styles.viewModeSelector}>
          <ViewModeButton
            accessibilityLabel="Cartões grandes"
            icon="view-agenda"
            isSelected={viewMode === 'featured'}
            label="Destaques"
            onPress={() => onChangeViewMode('featured')}
          />
          <ViewModeButton
            accessibilityLabel="Grade com duas colunas"
            icon="grid-view"
            isSelected={viewMode === 'grid'}
            label="Grade"
            onPress={() => onChangeViewMode('grid')}
          />
          <ViewModeButton
            accessibilityLabel="Lista compacta"
            icon="view-list"
            isSelected={viewMode === 'list'}
            label="Lista"
            onPress={() => onChangeViewMode('list')}
          />
        </View>
      </View>

      {isLoading ? (
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          style={styles.loadingRow}
          useNativeDriver>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Atualizando eventos...</Text>
        </Animatable.View>
      ) : null}
    </>
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
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={[styles.viewModeButton, isSelected ? styles.viewModeButtonSelected : null]}>
      <MaterialIcons color={isSelected ? '#171717' : '#777777'} name={icon} size={17} />
      <Text style={[styles.viewModeButtonText, isSelected ? styles.viewModeButtonTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyEvents() {
  return (
    <Animatable.Text animation="fadeIn" duration={360} style={styles.emptyText} useNativeDriver>
      Nenhum evento disponível no momento.
    </Animatable.Text>
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
      useNativeDriver>
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
        <Animatable.View animation="fadeIn" delay={index * 90 + 180} useNativeDriver>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending, selected: isSubscribed }}
            disabled={isPending}
            onPress={() => onToggleSubscription(event.id)}
            style={[
              styles.eventButton,
              viewMode !== 'featured' ? styles.compactEventButton : null,
              isSubscribed && styles.eventButtonSubscribed,
              isPending && styles.eventButtonPending,
            ]}>
            {isPending ? (
              <ActivityIndicator color="#111111" size="small" />
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  styles.eventButtonText,
                  viewMode !== 'featured' ? styles.compactEventButtonText : null,
                  isSubscribed && styles.eventButtonTextSubscribed,
                ]}>
                {isSubscribed ? 'Cancelar inscrição' : 'Inscrever-se'}
              </Text>
            )}
          </Pressable>
        </Animatable.View>
      </View>
    </Animatable.View>
  );
}

function keyExtractor(event: CampusEvent) {
  return String(event.id);
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
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  content: {
    gap: 18,
    paddingBottom: 108,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  gridContent: {
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },
  headerTitle: {
    color: '#1E1E1E',
    fontSize: 19,
    fontWeight: '900',
    paddingBottom: 12,
    paddingTop: 10,
    textAlign: 'center',
  },
  viewModeContainer: {
    marginBottom: 4,
  },
  viewModeLabel: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  viewModeSelector: {
    backgroundColor: '#EEEEF0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
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
  viewModeButtonSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  viewModeButtonText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
  },
  viewModeButtonTextSelected: {
    color: '#171717',
    fontWeight: '900',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  gridCard: {
    flex: 1,
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
    backgroundColor: '#2F3338',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  authorName: {
    color: '#2F3338',
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
    color: '#202124',
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
    backgroundColor: '#FFCC00',
    borderRadius: 3,
    height: 46,
    justifyContent: 'center',
    marginTop: 16,
  },
  eventButtonSubscribed: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111111',
    borderWidth: 1.5,
  },
  eventButtonPending: {
    opacity: 0.7,
  },
  eventButtonText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  eventButtonTextSubscribed: {
    color: '#111111',
  },
});
