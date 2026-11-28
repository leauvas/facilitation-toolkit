import React, { useRef, useState } from 'react';
import { BalanceMode } from '../types/facilitation';

interface SeatPositionMap {
  [seatId: string]: { x: number; y: number };
}

interface BoxRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function getOverlapArea(a: BoxRect, b: BoxRect): number {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

interface UseSeatDragOptions {
  seatId: string;
  mode: BalanceMode;
  isBlocked?: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  getAllSeatPositions: () => SeatPositionMap;
  onMove: (x: number, y: number) => void;
  onSwapTargetChange: (targetId: string | null) => void;
  onSwapSeats: (
    idA: string,
    idB: string,
    posA: { x: number; y: number },
    posB: { x: number; y: number }
  ) => void;
  onLongPress?: () => void;
}

export function useSeatDrag({
  seatId,
  mode,
  isBlocked = false,
  canvasRef,
  getAllSeatPositions,
  onMove,
  onSwapTargetChange,
  onSwapSeats,
  onLongPress,
}: UseSeatDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const swapTargetRef = useRef<string | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'layout' || isBlocked) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

    // 1. Snapshot all seat logical (%) coordinates at drag start
    const dragStartPositions = getAllSeatPositions();
    const startPosA = dragStartPositions[seatId];
    if (!startPosA) return;

    // 2. Snapshot DOM bounding boxes of all seats at drag start (prevents scale-105 flicker)
    const seatEls = canvas.querySelectorAll<HTMLElement>('[data-seat-id]');
    const initialRects: Record<string, BoxRect> = {};
    seatEls.forEach((el) => {
      const id = el.dataset.seatId;
      if (!id) return;
      const r = el.getBoundingClientRect();
      initialRects[id] = {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    });

    const initialRectA = initialRects[seatId];
    if (!initialRectA) return;

    // 3. Record seats already overlapping A at start so separating them never swaps
    const initiallyOverlappingIds = new Set<string>();
    for (const [otherId, rectB] of Object.entries(initialRects)) {
      if (otherId === seatId) continue;
      if (getOverlapArea(initialRectA, rectB) > 0) {
        initiallyOverlappingIds.add(otherId);
      }
    }

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const areaA = initialRectA.width * initialRectA.height;

    setIsDragging(true);
    swapTargetRef.current = null;
    onSwapTargetChange(null);

    let longPressTimer: number | null = null;
    const clearLongPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      setIsLongPressing(false);
    };

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startClientX;
      const dy = moveEv.clientY - startClientY;

      if (Math.hypot(dx, dy) >= 8) {
        clearLongPress();
      }

      const pctX = ((moveEv.clientX - canvasRect.left) / canvasRect.width) * 100;
      const pctY = ((moveEv.clientY - canvasRect.top) / canvasRect.height) * 100;
      onMove(pctX, pctY);

      const currentRectA: BoxRect = {
        left: initialRectA.left + dx,
        top: initialRectA.top + dy,
        right: initialRectA.right + dx,
        bottom: initialRectA.bottom + dy,
        width: initialRectA.width,
        height: initialRectA.height,
      };

      let bestTarget: string | null = null;
      let bestRatio = 0;

      for (const [otherId, rectB] of Object.entries(initialRects)) {
        if (otherId === seatId) continue;
        const overlap = getOverlapArea(currentRectA, rectB);

        // Must fully separate before an initially-overlapping seat can become a swap target
        if (initiallyOverlappingIds.has(otherId)) {
          if (overlap === 0) {
            initiallyOverlappingIds.delete(otherId);
          }
          continue;
        }

        const areaB = rectB.width * rectB.height;
        const minArea = Math.min(areaA, areaB);
        if (minArea <= 0) continue;

        const ratio = overlap / minArea;
        if (ratio >= 0.4 && ratio > bestRatio) {
          bestRatio = ratio;
          bestTarget = otherId;
        }
      }

      if (swapTargetRef.current !== bestTarget) {
        swapTargetRef.current = bestTarget;
        onSwapTargetChange(bestTarget);
      }
    };

    const cleanup = () => {
      clearLongPress();
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    if (onLongPress) {
      setIsLongPressing(true);
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        setIsLongPressing(false);
        swapTargetRef.current = null;
        onSwapTargetChange(null);
        cleanup();
        onMove(startPosA.x, startPosA.y);
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(30);
        }
        onLongPress();
      }, 900);
    }

    const onPointerUp = () => {
      const targetId = swapTargetRef.current;
      swapTargetRef.current = null;
      onSwapTargetChange(null);
      cleanup();

      if (targetId && dragStartPositions[targetId]) {
        onSwapSeats(seatId, targetId, startPosA, dragStartPositions[targetId]);
      }
    };

    const onPointerCancel = () => {
      swapTargetRef.current = null;
      onSwapTargetChange(null);
      cleanup();
      onMove(startPosA.x, startPosA.y);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  };

  return { isDragging, isLongPressing, handlePointerDown };
}
