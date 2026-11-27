import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { colors } from '@/src/view/theme/tokens';

const HORIZONTAL_THRESHOLD = 12;
const HORIZONTAL_RATIO = 1.2;
const SIDE_INSET = 12;
const SNAP_TOLERANCE = 0.5;

type Props = BottomTabBarProps & {
  activeIndex: number;
  tabCount: number;
  onSelectIndex: (index: number) => void;
  onPreviewIndex: (index: number) => void;
  suppressClickRef: { current: boolean };
};

/** Wraps the native tab bar with a drag-only track; normal tab presses remain untouched. */
export function DraggableBottomTabBar({
  activeIndex,
  tabCount,
  onSelectIndex,
  onPreviewIndex,
  suppressClickRef,
  ...tabBarProps
}: Props) {
  const barRef = useRef<View>(null);
  const barPageXRef = useRef(0);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const draggingRef = useRef(false);
  const previewIndexRef = useRef(activeIndex);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const segmentWidth = Math.max(0, (barWidth - SIDE_INSET * 2) / Math.max(tabCount, 1));
  const maxIndicatorX = Math.max(0, segmentWidth * Math.max(tabCount - 1, 0));

  const animateIndicatorTo = useCallback((index: number) => {
    if (segmentWidth <= 0) return;
    Animated.spring(indicatorX, {
      toValue: Math.max(0, Math.min(tabCount - 1, index)) * segmentWidth,
      damping: 20,
      stiffness: 240,
      mass: 0.72,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [indicatorX, segmentWidth, tabCount]);

  const onLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
    // PanResponder coordinates are screen-relative; convert them to the bar's
    // local coordinate space before calculating the selected tab.
    requestAnimationFrame(() => {
      barRef.current?.measureInWindow((x) => {
        barPageXRef.current = x;
      });
    });
  };

  const getIndex = useCallback((localX: number, fallbackIndex: number) => {
    if (barWidth <= 0 || tabCount <= 0 || segmentWidth <= 0) return fallbackIndex;

    // Each tab is represented by its center. The decision boundary is exactly
    // halfway between centers; at the exact 50% point we keep the prior tab.
    const centeredPosition = (localX - SIDE_INSET) / segmentWidth - 0.5;
    const lowerIndex = Math.floor(centeredPosition);
    const fraction = centeredPosition - lowerIndex;
    const tolerance = SNAP_TOLERANCE / Math.max(segmentWidth, 1);
    if (Math.abs(fraction - 0.5) <= tolerance) return fallbackIndex;

    const nearestIndex = fraction > 0.5 ? lowerIndex + 1 : lowerIndex;
    return Math.max(0, Math.min(tabCount - 1, nearestIndex));
  }, [barWidth, segmentWidth, tabCount]);

  const resolveStableIndex = useCallback((localX: number) => {
    const candidate = getIndex(localX, previewIndexRef.current);
    previewIndexRef.current = candidate;
    return candidate;
  }, [getIndex]);

  const updateIndicator = useCallback((localX: number) => {
    const nextX = Math.max(0, Math.min(maxIndicatorX, localX - SIDE_INSET - segmentWidth / 2));
    indicatorX.setValue(nextX);
    onPreviewIndex(resolveStableIndex(localX));
  }, [indicatorX, maxIndicatorX, onPreviewIndex, resolveStableIndex, segmentWidth]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      Platform.OS !== 'web'
      && Math.abs(gesture.dx) >= HORIZONTAL_THRESHOLD
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * HORIZONTAL_RATIO
    ),
    onPanResponderGrant: (_event, gesture) => {
      draggingRef.current = true;
      previewIndexRef.current = activeIndex;
      suppressClickRef.current = true;
      updateIndicator(gesture.x0 - barPageXRef.current);
    },
    onPanResponderMove: (_event, gesture) => {
      updateIndicator(gesture.moveX - barPageXRef.current);
    },
    onPanResponderRelease: (_event, gesture) => {
      const finalX = gesture.moveX - barPageXRef.current;
      updateIndicator(finalX);
      const selectedIndex = resolveStableIndex(finalX);
      draggingRef.current = false;
      onPreviewIndex(-1);
      animateIndicatorTo(selectedIndex);
      if (selectedIndex !== activeIndex) onSelectIndex(selectedIndex);
      setTimeout(() => { suppressClickRef.current = false; }, 350);
    },
    onPanResponderTerminate: () => {
      draggingRef.current = false;
      previewIndexRef.current = activeIndex;
      onPreviewIndex(-1);
      animateIndicatorTo(activeIndex);
      setTimeout(() => { suppressClickRef.current = false; }, 350);
    },
    onPanResponderTerminationRequest: () => false,
  }), [activeIndex, animateIndicatorTo, getIndex, onPreviewIndex, onSelectIndex, resolveStableIndex, suppressClickRef, updateIndicator]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = barRef.current as unknown as HTMLElement | null;
    if (!element) return;

    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = 'pan-y';

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      previewIndexRef.current = activeIndex;
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
        if (Math.abs(dx) < HORIZONTAL_THRESHOLD || Math.abs(dx) <= Math.abs(dy) * HORIZONTAL_RATIO) return;
        pointer.dragging = true;
        draggingRef.current = true;
        suppressClickRef.current = true;
      }
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      updateIndicator(event.clientX - rect.left);
    };

    const finishPointer = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointerRef.current = null;
      if (pointer.dragging) {
        const rect = element.getBoundingClientRect();
        const finalX = event.clientX - rect.left;
        updateIndicator(finalX);
        const selectedIndex = resolveStableIndex(finalX);
        draggingRef.current = false;
        onPreviewIndex(-1);
        animateIndicatorTo(selectedIndex);
        if (selectedIndex !== activeIndex) onSelectIndex(selectedIndex);
        window.setTimeout(() => { suppressClickRef.current = false; }, 350);
      }
    };

    const cancelPointer = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointerRef.current = null;
      draggingRef.current = false;
      previewIndexRef.current = activeIndex;
      onPreviewIndex(-1);
      animateIndicatorTo(activeIndex);
      suppressClickRef.current = false;
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
  }, [activeIndex, animateIndicatorTo, getIndex, onPreviewIndex, onSelectIndex, resolveStableIndex, segmentWidth, suppressClickRef, updateIndicator]);

  useEffect(() => {
    if (draggingRef.current || segmentWidth <= 0) return;
    previewIndexRef.current = activeIndex;
    const animation = Animated.spring(indicatorX, {
      toValue: Math.max(0, activeIndex) * segmentWidth,
      damping: 20,
      stiffness: 240,
      mass: 0.72,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, indicatorX, segmentWidth]);

  return (
    <View
      ref={barRef}
      collapsable={false}
      onLayout={onLayout}
      style={styles.container}
      {...panResponder.panHandlers}>
      {segmentWidth > 0 ? (
        <Animated.View
          style={[styles.indicator, { pointerEvents: 'none' },
            {
              left: SIDE_INSET,
              width: segmentWidth,
              transform: [{ translateX: indicatorX }],
            },
          ]}
        />
      ) : null}
      <View style={styles.tabBarContent}>
        <BottomTabBar {...tabBarProps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopColor: colors.border.default,
    borderTopWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px -6px 18px rgba(17, 17, 17, 0.08)',
  },
  indicator: {
    position: 'absolute',
    top: 10,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.brand.primary,
    zIndex: 0,
  },
  tabBarContent: { position: 'relative', zIndex: 1 },
});
