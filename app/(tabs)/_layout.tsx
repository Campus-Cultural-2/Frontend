import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { BackSwipeBoundary } from '@/components/navigation/back-swipe-boundary';

/**
 * Keep the tab navigator and pushed workflows in the same stack. This gives
 * router.back() a real previous route instead of returning to the initial tab.
 */
export const unstable_settings = {
  anchor: '(main)',
};

export default function TabsStackLayout() {
  const clearWebFocus = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
    }
  }, []);

  return (
    <BackSwipeBoundary>
      <Stack
        screenListeners={() => ({ blur: clearWebFocus, beforeRemove: clearWebFocus })}
        screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: false }}>
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="novo-evento" options={{ headerShown: false }} />
      <Stack.Screen name="presenca" options={{ headerShown: false }} />
      <Stack.Screen name="meu-ingresso" options={{ headerShown: false }} />
      <Stack.Screen name="evento-detalhe" options={{ headerShown: false }} />
      <Stack.Screen name="certificado-detalhe" options={{ headerShown: false }} />
      <Stack.Screen name="certificados-participantes" options={{ headerShown: false }} />
      <Stack.Screen name="certificados-configurar" options={{ headerShown: false }} />
      <Stack.Screen name="certificados-resultado" options={{ headerShown: false }} />
      </Stack>
    </BackSwipeBoundary>
  );
}
