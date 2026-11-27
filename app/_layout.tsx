import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { useFonts } from '@expo-google-fonts/inter/useFonts';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppText as Text } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';

export const unstable_settings = {
  anchor: '(auth)',
};

void SplashScreen.preventAutoHideAsync();

const CampusTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand.primary,
    background: colors.surface.page,
    card: colors.surface.card,
    text: colors.text.primary,
    border: colors.border.default,
    notification: colors.status.danger,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <ThemeProvider value={CampusTheme}>
        <Stack initialRouteName="index" screenOptions={{ animation: Platform.OS === 'web' ? 'none' : 'slide_from_right' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Algo saiu do esperado.</Text>
      <Text style={styles.errorMessage}>
        {__DEV__ ? error.message : 'Feche esta tela e tente novamente em instantes.'}
      </Text>
      <AppButton label="Tentar novamente" variant="primary" size="lg" onPress={retry} style={styles.retryButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface.page,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorMessage: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.text.heading,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  retryButton: { marginTop: 22 },
});
