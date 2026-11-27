import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import {
  Platform,
  StyleSheet,
} from 'react-native';

import { AppText as Text } from '@/components/ui/app-text';
import { colors } from '@/src/view/theme/tokens';

export type AppToastType = 'error' | 'success' | 'warning';

type AppToastProps = {
  bottom?: number;
  message: string;
  type?: AppToastType;
  visible: boolean;
};

const iconByType: Record<AppToastType, keyof typeof MaterialIcons.glyphMap> = {
  error: 'error',
  success: 'check-circle',
  warning: 'warning',
};

export function AppToast({ bottom = 112, message, type = 'success', visible }: AppToastProps) {
  if (!visible) {
    return null;
  }

  return (
    <Animatable.View
      animation="fadeInUp"
      duration={240}
      style={[styles.toast, styles[type], { bottom, pointerEvents: 'none' }]}
      useNativeDriver={Platform.OS !== 'web'}>
      <MaterialIcons name={iconByType[type]} size={18} color={colors.text.primary} />
      <Text style={styles.text}>{message}</Text>
    </Animatable.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '88%',
    minHeight: 44,
    paddingHorizontal: 18,
    position: 'absolute',
    boxShadow: '0px 8px 16px rgba(17, 17, 17, 0.14)',
    elevation: 6,
  },
  success: {
    backgroundColor: colors.brand.primary,
  },
  warning: {
    backgroundColor: colors.status.warningSoft,
  },
  error: {
    backgroundColor: colors.status.dangerSoft,
  },
  text: {
    color: colors.text.primary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
  },
});
