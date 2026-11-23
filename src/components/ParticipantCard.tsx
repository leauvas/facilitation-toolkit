import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Pencil, X } from 'lucide-react';
import { BalanceMode, Participant, SessionStatus } from '../types/facilitation';
import { LiveParticipantMetrics } from '../context/SessionContext';
import { formatClockMMSS } from '../lib/exportUtils';

interface ParticipantCardProps {
  participant: Participant;
  metrics: LiveParticipantMetrics;
  mode: BalanceMode;
  sessionStatus: SessionStatus;
  recommendedTurnSec: number;
  participantCount: number;
  canDelete: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  metrics,
  mode,
  sessionStatus,
  recommendedTurnSec,
  participantCount,
  canDelete,
  canvasRef,
  onSelect,
  onMove,
  onRename,
  onRemove,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(participant.name);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftName(participant.name);
  }, [participant.name]);

  useEffect(() => {
    if (isEditingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingName]);

  const isCompactCount = participantCount >= 9;
  const isMediumCount = participantCount >= 7 && participantCount < 9;

  const isSpeaking = metrics.balanceState === 'speaking';
  const turnRemainingRatio = isSpeaking
    ? Math.max(0, 1 - metrics.currentTurnElapsedSec / recommendedTurnSec)
    : 1;
  const isTurnOvertime = isSpeaking && metrics.currentTurnElapsedSec > recommendedTurnSec;

  // 4-stage balance color classes strictly using built-in Tailwind palette
  let cardStyle = 'border border-stone-200 bg-white shadow-sm';
  let gaugeBg = 'bg-stone-200';
  let gaugeFill = 'bg-stone-400';
  let shareColor = 'text-stone-600';

  if (metrics.balanceState === 'speaking') {
    cardStyle = `border-2 border-lime-600 bg-lime-100/80 shadow-sm ${
      sessionStatus === 'running' ? 'animate-olive-pulse' : ''
    }`;
    gaugeBg = 'bg-lime-200';
    gaugeFill = isTurnOvertime ? 'bg-orange-600' : 'bg-lime-700';
    shareColor = isTurnOvertime ? 'text-orange-700' : 'text-lime-800';
  } else if (metrics.balanceState === 'dominant') {
    cardStyle = 'border border-orange-500 bg-orange-50 shadow-sm';
    gaugeBg = 'bg-orange-200';
    gaugeFill = 'bg-orange-600';
    shareColor = 'text-orange-700';
  } else if (metrics.balanceState === 'balanced') {
    cardStyle = 'border border-emerald-400 bg-emerald-50 shadow-sm';
    gaugeBg = 'bg-emerald-200';
    gaugeFill = 'bg-emerald-600';
    shareColor = 'text-emerald-800';
  }

  // Auto-scaled card sizing guaranteeing 3-4 Korean chars fit on 1 line without truncation
  const sizeClasses = isCompactCount
    ? 'w-auto min-w-[84px] sm:min-w-[100px] px-1.5 py-1 sm:px-2 sm:py-1 rounded-xl [@media(max-height:450px)]:min-w-[82px] [@media(max-height:450px)]:py-0.5'
    : isMediumCount
      ? 'w-auto min-w-[96px] sm:min-w-[114px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-2xl [@media(max-height:450px)]:min-w-[90px] [@media(max-height:450px)]:py-0.5'
      : 'w-auto min-w-[108px] sm:min-w-[126px] px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl [@media(max-height:450px)]:min-w-[100px] [@media(max-height:450px)]:py-1';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'layout' || isEditingName) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDragging(true);
    const rect = canvas.getBoundingClientRect();

    const updatePos = (clientX: number, clientY: number) => {
      if (rect.width <= 0 || rect.height <= 0) return;
      const pctX = ((clientX - rect.left) / rect.width) * 100;
      const pctY = ((clientY - rect.top) / rect.height) * 100;
      onMove(participant.id, pctX, pctY);
    };

    const onPointerMove = (moveEv: PointerEvent) => {
      updatePos(moveEv.clientX, moveEv.clientY);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const commitName = () => {
    onRename(participant.id, draftName);
    setIsEditingName(false);
  };

  return (
    <div
      style={{
        left: `${participant.x}%`,
        top: `${participant.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={handlePointerDown}
      onClick={() => {
        if (mode === 'discuss' && !isEditingName) {
          onSelect(participant.id);
        }
      }}
      role={mode === 'discuss' ? 'button' : undefined}
      tabIndex={mode === 'discuss' ? 0 : undefined}
      onKeyDown={(e) => {
        if (mode === 'discuss' && !isEditingName && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(participant.id);
        }
      }}
      className={`absolute select-none transition-all duration-150 ${sizeClasses} ${cardStyle} ${
        mode === 'layout'
          ? `touch-none cursor-grab ${isDragging ? 'z-30 scale-105 cursor-grabbing shadow-lg' : 'z-10 hover:shadow-md'}`
          : 'z-10 cursor-pointer active:scale-95'
      }`}
    >
      {mode === 'layout' && canDelete && !isEditingName && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(participant.id);
          }}
          title="참여자 삭제"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-xs transition hover:border-orange-500 hover:text-orange-700"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="flex items-stretch gap-1.5 sm:gap-2">
        {/* Left Vertical Sand Gauge Bar (fixed w-1.5) */}
        <div
          className={`relative w-1.5 shrink-0 overflow-hidden rounded-full ${gaugeBg}`}
          title={isSpeaking ? '현재 발언 권장 시간 잔여 게이지' : '발언 균형 상태'}
        >
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-150 ${gaugeFill}`}
            style={{
              height: isSpeaking
                ? isTurnOvertime
                  ? '100%'
                  : `${Math.round(turnRemainingRatio * 100)}%`
                : metrics.totalSec > 0
                  ? '100%'
                  : '24%',
            }}
          />
        </div>

        {/* Card Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            {isEditingName ? (
              <input
                ref={inputRef}
                type="text"
                value={draftName}
                maxLength={14}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') {
                    setDraftName(participant.name);
                    setIsEditingName(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-20 rounded border border-lime-600 bg-white px-1 py-0.5 text-xs font-bold text-stone-900 focus:outline-none"
              />
            ) : (
              <>
                <span
                  className={`whitespace-nowrap font-bold leading-tight text-stone-900 ${
                    isCompactCount ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                  }`}
                >
                  {participant.name}
                </span>
                {mode === 'layout' ? (
                  <div className="flex shrink-0 items-center gap-0.5 text-stone-600">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingName(true);
                      }}
                      title="이름 수정"
                      className="rounded p-0.5 hover:bg-stone-100 hover:text-stone-900"
                    >
                      <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                    <GripVertical className="h-3 w-3 text-stone-400" />
                  </div>
                ) : (
                  <span
                    className={`shrink-0 whitespace-nowrap text-[10px] font-bold tabular-nums ${shareColor}`}
                  >
                    {Math.round(metrics.sharePct)}%
                  </span>
                )}
              </>
            )}
          </div>

          <div
            className={`mt-0.5 flex items-center justify-between gap-1.5 whitespace-nowrap tabular-nums leading-tight text-stone-600 ${
              isCompactCount ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
            }`}
          >
            <span>{formatClockMMSS(metrics.totalSec)}</span>
            <span className="text-[10px]">{metrics.turnCount}회</span>
          </div>

          {isTurnOvertime && (
            <div className="mt-0.5 whitespace-nowrap rounded bg-orange-600 px-1 py-[1px] text-center text-[9px] font-bold text-white">
              권장 초과
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
