import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export const unstable_settings = {
  anchor: 'index',
};

export default function GestaoLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'slide_from_right' }} />;
}
