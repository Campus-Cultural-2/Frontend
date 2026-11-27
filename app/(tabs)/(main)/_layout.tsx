import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs, useFocusEffect, useNavigation, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { DraggableBottomTabBar } from '@/components/navigation/draggable-bottom-tab-bar';
import { TabTransitionContext } from '@/components/navigation/tab-transition-context';
import { AppText as Text } from '@/components/ui/app-text';
import { getValidAuthSession } from '@/src/lib/api/campus';
import type { UserRole } from '@/src/lib/api/schemas';
import { runWithUnsavedChangesGuard } from '@/src/lib/navigation/unsavedChangesGuard';
import { colors } from '@/src/view/theme/tokens';

const TAB_ICON_SIZE = 20;
const TAB_BAR_HEIGHT = 92;
type MainTabName = 'index' | 'calendario' | 'certificados' | 'perfil' | 'gestao';

export default function TabsLayout() {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const [dragPreviewIndex, setDragPreviewIndex] = useState(-1);
  const suppressTabClickRef = useRef(false);
  const [tabTransition, setTabTransition] = useState<{ direction: -1 | 1; version: number }>({ direction: 1, version: 0 });
  const previousTabIndex = useRef(-1);

  const clearWebFocus = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
    }
  }, []);

  useEffect(() => {
    const removeBlurListener = navigation.addListener('blur', clearWebFocus);
    const removeStateListener = navigation.addListener('state', clearWebFocus);
    return () => {
      removeBlurListener();
      removeStateListener();
    };
  }, [clearWebFocus, navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadRole() {
        try {
          const session = await getValidAuthSession();
          if (!cancelled) setRole(session.payload.role);
        } catch {
          if (!cancelled) router.replace('/login' as never);
        }
      }

      void loadRole();
      return () => { cancelled = true; };
    }, [router]),
  );

  const canManageUsers = role === 'professor' || role === 'admin';
  const tabNames = useMemo<MainTabName[]>(() => [
    'index', 'calendario', 'certificados', canManageUsers ? 'gestao' : 'perfil',
  ], [canManageUsers]);
  const activeTabIndex = getActiveTabIndex(pathname, tabNames);

  const selectTab = useCallback((index: number) => {
    const name = tabNames[index];
    if (!name) return;

    // Expo Router resolves the index route at the group root, not at /index.
    const href = name === 'index'
      ? '/(tabs)/(main)'
      : `/(tabs)/(main)/${name}`;

    runWithUnsavedChangesGuard(() => router.navigate(href as never));
  }, [router, tabNames]);

  const onSwipeTab = useCallback((direction: -1 | 1) => {
    const nextIndex = activeTabIndex + direction;
    if (activeTabIndex < 0 || nextIndex < 0 || nextIndex >= tabNames.length) return;
    selectTab(nextIndex);
  }, [activeTabIndex, selectTab, tabNames.length]);

  const tabTransitionValues = useMemo(() => ({
    direction: tabTransition.direction,
    version: tabTransition.version,
    onSwipeTab,
  }), [onSwipeTab, tabTransition.direction, tabTransition.version]);

  useEffect(() => {
    const previousIndex = previousTabIndex.current;
    if (Platform.OS === 'web' && previousIndex >= 0 && activeTabIndex >= 0 && previousIndex !== activeTabIndex) {
      const direction: -1 | 1 = activeTabIndex > previousIndex ? 1 : -1;
      setTabTransition((current) => ({ direction, version: current.version + 1 }));
    }
    previousTabIndex.current = activeTabIndex;
  }, [activeTabIndex]);



  if (role === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <TabTransitionContext.Provider value={tabTransitionValues}>
      <View style={styles.navigatorRoot}>
        <Tabs
          screenListeners={() => ({ blur: clearWebFocus, beforeRemove: clearWebFocus })}
          backBehavior="history"
          initialRouteName="index"
          tabBar={(props) => (
            <DraggableBottomTabBar
              {...props}
              activeIndex={Math.max(0, activeTabIndex)}
              tabCount={tabNames.length}
              onSelectIndex={selectTab}
              onPreviewIndex={setDragPreviewIndex}
              suppressClickRef={suppressTabClickRef}
            />
          )}
          screenOptions={{
            tabBarActiveTintColor: colors.text.primary,
            tabBarInactiveTintColor: colors.text.muted,
            headerShown: false,
            tabBarButton: (props) => <HapticTab {...props} suppressClickRef={suppressTabClickRef} />,
            tabBarShowLabel: false,
            tabBarHideOnKeyboard: true,
            tabBarIconStyle: styles.tabBarIcon,
            tabBarStyle: styles.tabBar,
            tabBarItemStyle: styles.tabBarItem,
            animation: Platform.OS === 'web' ? 'none' : 'shift',
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Início',
              tabBarIcon: ({ focused }) => <TabItem dragPreviewIndex={dragPreviewIndex} index={0} focused={focused} icon="home" label="Início" />,
            }}
          />
          <Tabs.Screen
            name="calendario"
            options={{
              title: 'Eventos',
              tabBarIcon: ({ focused }) => <TabItem dragPreviewIndex={dragPreviewIndex} index={1} focused={focused} icon="calendar-today" label="Eventos" />,
            }}
          />
          <Tabs.Screen
            name="certificados"
            options={{
              title: 'Certificados',
              tabBarIcon: ({ focused }) => <TabItem dragPreviewIndex={dragPreviewIndex} index={2} focused={focused} icon="card-membership" label="Certificados" />,
            }}
          />
          <Tabs.Screen
            name="perfil"
            options={{
              title: 'Perfil',
              href: canManageUsers ? null : undefined,
              tabBarIcon: ({ focused }) => <TabItem dragPreviewIndex={dragPreviewIndex} index={3} focused={focused} icon="person" label="Perfil" />,
            }}
          />
          <Tabs.Screen
            name="gestao"
            options={{
              title: 'Gestão',
              href: canManageUsers ? undefined : null,
              tabBarIcon: ({ focused }) => <TabItem dragPreviewIndex={dragPreviewIndex} index={3} focused={focused} icon="people" label="Gestão" />,
            }}
          />
        </Tabs>
      </View>
    </TabTransitionContext.Provider>
  );
}

function getActiveTabIndex(pathname: string, tabs: MainTabName[]) {
  const normalizedPath = pathname.replace(/\/index$/, '') || '/';
  if (normalizedPath === '/' || normalizedPath.endsWith('/(main)')) return tabs.indexOf('index');
  const match = tabs.find((name) => name !== 'index' && (normalizedPath === `/${name}` || normalizedPath.endsWith(`/${name}`)));
  return match ? tabs.indexOf(match) : -1;
}

function TabItem({
  dragPreviewIndex,
  index,
  focused,
  icon,
  label,
}: {
  dragPreviewIndex: number;
  index: number;
  focused: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}) {
  const selected = dragPreviewIndex >= 0 ? dragPreviewIndex === index : focused;

  return (
    <View style={styles.tabItemContent}>
      <View style={styles.tabPillClip}>
        <View style={styles.tabPill}>
          <MaterialIcons name={icon} size={TAB_ICON_SIZE} color={selected ? colors.text.primary : colors.text.muted} />
          <Text adjustsFontSizeToFit minimumFontScale={0.9} numberOfLines={1} style={[styles.tabLabel, selected ? styles.tabLabelActive : null]}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigatorRoot: { flex: 1, backgroundColor: colors.surface.page },
  loadingContainer: {
    alignItems: 'center', backgroundColor: colors.surface.page, flex: 1, justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    height: TAB_BAR_HEIGHT,
    paddingBottom: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  tabBarItem: { alignItems: 'center', flex: 1, height: 62, justifyContent: 'center', minWidth: 0 },
  tabBarIcon: { alignItems: 'center', height: 62, justifyContent: 'center', width: '100%' },
  tabItemContent: { alignItems: 'center', height: 56, justifyContent: 'center', width: '100%' },
  tabPillClip: { borderRadius: 20, height: 56, maxWidth: 118, minWidth: 60, overflow: 'hidden', width: '100%' },
  tabPill: {
    alignItems: 'center', borderRadius: 20, gap: 4, height: 56, justifyContent: 'center',
    paddingHorizontal: 4, width: '100%',
  },
  tabLabel: {
    color: colors.text.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.25,
    lineHeight: 15, textTransform: 'none',
  },
  tabLabelActive: { color: colors.text.primary },
});
