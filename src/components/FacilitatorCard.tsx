import React from 'react';
import { ArrowLeftRight, GripVertical, Mic } from 'lucide-react';
import { BalanceMode, FacilitatorSeat, SessionStatus } from '../types/facilitation';
import { formatClockMMSS } from '../lib/exportUtils';
import { useSeatDrag } from '../hooks/useSeatDrag';

interface FacilitatorCardProps {
  seat: FacilitatorSeat;
  totalSec: number;
  isSpeaking: boolean;
  mode: BalanceMode;
  sessionStatus: SessionStatus;
  isCompactCount: boolean;
  isSwapTarget: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  getAllSeatPositions: () => Record<string, { x: number; y: number }>;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onSwapTargetChange: (targetId: string | null) => void;
  onSwapSeats: (
    idA: string,
    idB: string,
    posA: { x: number; y: number },
    posB: { x: number; y: number }
  ) => void;
}

export const FacilitatorCard: React.FC<FacilitatorCardProps> = ({
  seat,
  totalSec,
  isSpeaking,
  mode,
  sessionStatus,
  isCompactCount,
  isSwapTarget,
  canvasRef,
  getAllSeatPositions,
  onSelect,
  onMove,
  onSwapTargetChange,
  onSwapSeats,
}) => {
  const { isDragging, handlePointerDown } = useSeatDrag({
    seatId: 'facilitator',
    mode,
    canvasRef,
    getAllSeatPositions,
    onMove,
    onSwapTargetChange,
    onSwapSeats,
  });

  const isLive = sessionStatus === 'running' || sessionStatus === 'paused';
  const activeRing =
    isLive && isSpeaking
      ? sessionStatus === 'running'
        ? 'ring-2 ring-lime-600/60 ring-offset-1'
        : 'ring-2 ring-orange-500/50'
      : '';

  const sizeClasses = isCompactCount
    ? 'min-w-[84px] sm:min-w-[100px] px-2 py-1 rounded-xl [@media(max-height:450px)]:min-w-[82px] [@media(max-height:450px)]:py-0.5'
    : 'min-w-[96px] sm:min-w-[114px] px-2.5 py-1.5 rounded-2xl [@media(max-height:450px)]:min-w-[92px] [@media(max-height:450px)]:py-1';

  const baseSurface = isSwapTarget
    ? 'border-2 border-lime-600 bg-lime-50/90 text-stone-900 ring-2 ring-lime-600 scale-105 z-20 shadow-md'
    : 'border-2 border-stone-400 bg-stone-200/90 text-stone-800 shadow-sm';

  return (
    <div
      data-seat-id="facilitator"
      style={{
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={handlePointerDown}
      onClick={() => {
        if (mode === 'discuss') {
          onSelect();
        }
      }}
      role={mode === 'discuss' ? 'button' : undefined}
      tabIndex={mode === 'discuss' ? 0 : undefined}
      onKeyDown={(e) => {
        if (mode === 'discuss' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      title={
        mode === 'layout'
          ? '드래그하여 진행자 좌석 이동 또는 다른 좌석과 자리 바꾸기'
          : '터치하여 진행자 발언 구간으로 복귀'
      }
      className={`absolute select-none transition-all duration-150 ${sizeClasses} ${baseSurface} ${activeRing} ${
        mode === 'layout'
          ? `touch-none cursor-grab ${isDragging ? 'z-30 scale-105 cursor-grabbing shadow-lg' : 'z-10 hover:shadow-md'}`
          : 'z-10 cursor-pointer hover:border-stone-500 active:scale-95'
      }`}
    >
      {isSwapTarget && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lime-700 text-white shadow-sm">
          <ArrowLeftRight className="h-2.5 w-2.5" />
        </span>
      )}

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          <Mic
            className={`h-3 w-3 shrink-0 ${
              isLive && isSpeaking ? 'text-lime-700' : 'text-stone-600'
            }`}
          />
          <span
            className={`whitespace-nowrap font-bold leading-tight text-stone-800 ${
              isCompactCount ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
            }`}
          >
            진행자
          </span>
        </div>

        {mode === 'layout' ? (
          <GripVertical className="h-3 w-3 shrink-0 text-stone-500" />
        ) : (
          isLive &&
          isSpeaking && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-lime-700 animate-pulse" />
          )
        )}
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-1.5 whitespace-nowrap text-[10px] font-semibold tabular-nums text-stone-600 sm:text-[11px]">
        <span>누적</span>
        <span>{formatClockMMSS(totalSec)}</span>
      </div>
    </div>
  );
};
