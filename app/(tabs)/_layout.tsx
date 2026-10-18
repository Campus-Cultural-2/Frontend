import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { hasAuthToken } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';

const TAB_ICON_SIZE = 20;

export default function TabsLayout() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      async function redirectUnauthenticatedUser() {
        if (!(await hasAuthToken())) {
          await clearAuthToken();
          router.replace('/login' as never);
        }
      }

      void redirectUnauthenticatedUser();
    }, [router]),
  );

  return (
    <Tabs
      initialRouteName="perfil"
      screenOptions={{
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#9B9EA5',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => <TabItem focused={focused} icon="home" label="Início" />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendário',
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} icon="calendar-today" label="Calendário" />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabItem focused={focused} icon="person" label="Perfil" />,
        }}
      />
      <Tabs.Screen name="novo-evento" options={{ href: null }} />
    </Tabs>
  );
}

function TabItem({
  focused,
  icon,
  label,
}: {
  focused: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}) {
  return (
    <View style={[styles.tabPill, focused ? styles.tabPillActive : null]}>
      <MaterialIcons name={icon} size={TAB_ICON_SIZE} color={focused ? '#111111' : '#A0A3AB'} />
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.9}
        numberOfLines={1}
        style={[styles.tabLabel, focused ? styles.tabLabelActive : null]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EFEFEF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    elevation: 10,
    height: 92,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  tabBarItem: {
    alignItems: 'center',
    flex: 1,
    height: 62,
    justifyContent: 'center',
    minWidth: 96,
  },
  tabBarIcon: {
    alignItems: 'center',
    height: 62,
    justifyContent: 'center',
    width: '100%',
  },
  tabPill: {
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
    height: 56,
    justifyContent: 'center',
    maxWidth: 118,
    minWidth: 98,
    paddingHorizontal: 10,
    width: '100%',
  },
  tabPillActive: {
    backgroundColor: '#FFCC00',
  },
  tabLabel: {
    color: '#9B9EA5',
    fontFamily: 'Space Grotesk',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: '#111111',
  },
});
