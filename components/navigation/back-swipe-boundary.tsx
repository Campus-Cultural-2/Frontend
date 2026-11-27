import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { runWithUnsavedChangesGuard } from '@/src/lib/navigation/unsavedChangesGuard';

const EDGE_WIDTH = 28;
const SWIPE_DISTANCE = 72;
const SWIPE_VELOCITY = 0.5;
const HORIZONTAL_RATIO = 1.25;

const SECONDARY_ROUTE_PREFIXES = [
  '/novo-evento',
  '/presenca',
  '/meu-ingresso',
  '/evento-detalhe',
  '/certificado-detalhe',
  '/certificados-participantes',
  '/certificados-configurar',
  '/certificados-resultado',
];

function isSecondaryRoute(pathname: string) {
  return SECONDARY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || /\/gestao\/(detalhes|status)\//.test(pathname);
}

/** Edge-only back gesture for Android and web; iOS keeps native-stack's interactive gesture. */
export function BackSwipeBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const viewRef = useRef<View>(null);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const enabled = isSecondaryRoute(pathname);

  const goBack = useCallback(() => {
    if (!router.canGoBack()) return;
    runWithUnsavedChangesGuard(() => router.back());
  }, [router]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      Platform.OS === 'android'
      && enabled
      && router.canGoBack()
      && gesture.x0 <= EDGE_WIDTH
      && gesture.dx >= 20
      && gesture.dx > Math.abs(gesture.dy) * HORIZONTAL_RATIO
    ),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx >= SWIPE_DISTANCE || gesture.vx >= SWIPE_VELOCITY) goBack();
    },
    onPanResponderTerminationRequest: () => false,
  }), [enabled, goBack, router]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || !router.canGoBack()) return;
    const element = viewRef.current as unknown as HTMLElement | null;
    if (!element) return;

    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = 'pan-y';

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const rect = element.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      if (localX > EDGE_WIDTH) return;
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
        if (dx < 20 || dx <= Math.abs(dy) * HORIZONTAL_RATIO) return;
        pointer.dragging = true;
      }
      event.preventDefault();
    };

    const finishPointer = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointerRef.current = null;
      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      if (pointer.dragging && dx >= SWIPE_DISTANCE && dx > Math.abs(dy) * HORIZONTAL_RATIO) {
        event.preventDefault();
        goBack();
      }
    };

    const cancelPointer = (event: PointerEvent) => {
      if (pointerRef.current?.pointerId === event.pointerId) pointerRef.current = null;
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
  }, [enabled, goBack, pathname, router]);

  return (
    <View ref={viewRef} collapsable={false} style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, minHeight: 0 } });
