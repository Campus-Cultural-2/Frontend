import { type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import type { MutableRefObject } from 'react';
import { StyleSheet } from 'react-native';

import { runWithUnsavedChangesGuard } from '@/src/lib/navigation/unsavedChangesGuard';

type HapticTabProps = BottomTabBarButtonProps & {
  suppressClickRef?: MutableRefObject<boolean>;
};

export function HapticTab({ suppressClickRef, ...props }: HapticTabProps) {
  return (
    <PlatformPressable
      {...props}
      hitSlop={{ bottom: 18, left: 24, right: 24, top: 18 }}
      onPress={(event) => {
        if (suppressClickRef?.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          return;
        }
        runWithUnsavedChangesGuard(() => props.onPress?.(event));
      }}
      onPressIn={(event) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(event);
      }}
      style={[props.style, styles.button]}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    minHeight: 62,
    minWidth: 0,
    width: '100%',
  },
});
