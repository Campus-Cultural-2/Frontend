import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';

import { TabTransitionContext } from '@/components/navigation/tab-transition-context';

const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 0.48;

/** A screen-level responder keeps content swipes separate from the tab bar and Home view selector. */
export function TabScreenTransition({ children }: { children: ReactNode }) {
  const transition = useContext(TabTransitionContext);
  const onSwipeTab = transition?.onSwipeTab;

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => (
      Math.abs(gesture.dx) > 22 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2
    ),
    onPanResponderRelease: (_event, gesture) => {
      const enoughDistance = Math.abs(gesture.dx) >= SWIPE_DISTANCE;
      const enoughVelocity = Math.abs(gesture.vx) >= SWIPE_VELOCITY;
      if (!enoughDistance && !enoughVelocity) return;
      onSwipeTab?.(gesture.dx < 0 ? 1 : -1);
    },
    onPanResponderTerminationRequest: () => true,
  }), [onSwipeTab]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {Platform.OS === 'web' && transition ? (
        <WebTabScreenContent direction={transition.direction} version={transition.version}>
          {children}
        </WebTabScreenContent>
      ) : children}
    </View>
  );
}

function WebTabScreenContent({
  children,
  direction,
  version,
}: {
  children: ReactNode;
  direction: -1 | 1;
  version: number;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (version === 0) return;

    opacity.setValue(0.9);
    translateX.setValue(direction * 18);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [direction, opacity, translateX, version]);

  return (
    <Animated.View style={[styles.webContent, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  webContent: { flex: 1, minHeight: 0 },
});
