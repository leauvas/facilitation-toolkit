import React, { useRef } from 'react';

interface UseLongPressOptions {
  enabled: boolean;
  delayMs?: number;
  moveThresholdPx?: number;
  onLongPress: () => void;
}

export function useLongPress({
  enabled,
  delayMs = 900,
  moveThresholdPx = 8,
  onLongPress,
}: UseLongPressOptions) {
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled) return;
    if ((e.target as HTMLElement).closest('input, button')) return;

    clear();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      startPosRef.current = null;
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(30);
      }
      onLongPress();
    }, delayMs);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!startPosRef.current || timerRef.current === null) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) >= moveThresholdPx) {
      clear();
    }
  };

  const onPointerUp = () => clear();
  const onPointerCancel = () => clear();

  const onContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (enabled) {
      e.preventDefault();
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
  };
}
