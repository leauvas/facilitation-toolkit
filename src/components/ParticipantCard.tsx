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

  // 4-stage balance color classes
  let cardStyle = 'border-[#DDD6C7] bg-[#EFECE6] text-[#4E4940]'; // unspoken (warm gray)
  let gaugeBg = 'bg-[#D7CFC1]';
  let gaugeFill = 'bg-[#A69E8E]';

  if (metrics.balanceState === 'speaking') {
    cardStyle = `border-[#6C7B42] bg-[#8A9A5B] text-white ${
      sessionStatus === 'running' ? 'animate-olive-pulse' : ''
    }`;
    gaugeBg = 'bg-white/25';
    gaugeFill = isTurnOvertime ? 'bg-[#F8D0C2]' : 'bg-white';
  } else if (metrics.balanceState === 'dominant') {
    cardStyle = 'border-[#C86D51] bg-[#FDF2EE] text-[#8D3A21] shadow-xs';
    gaugeBg = 'bg-[#F2D5CA]';
    gaugeFill = 'bg-[#C86D51]';
  } else if (metrics.balanceState === 'balanced') {
    cardStyle = 'border-[#A7BA84] bg-[#E8EFE0] text-[#2F3B1F] shadow-2xs';
    gaugeBg = 'bg-[#CFDDC0]';
    gaugeFill = 'bg-[#8A9A5B]';
  }

  // Responsive card dimensions scaled by participant count + landscape height
  const sizeClasses = isCompactCount
    ? 'w-[74px] sm:w-[106px] md:w-[120px] px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl [@media(max-height:450px)]:w-[92px] [@media(max-height:450px)]:py-0.5'
    : isMediumCount
      ? 'w-[88px] sm:w-[120px] md:w-[134px] px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-2xl [@media(max-height:450px)]:w-[104px] [@media(max-height:450px)]:py-1'
      : 'w-[104px] sm:w-[134px] md:w-[148px] px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl [@media(max-height:450px)]:w-[114px] [@media(max-height:450px)]:py-1.5';

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
      className={`absolute select-none border transition-all duration-150 ${sizeClasses} ${cardStyle} ${
        mode === 'layout'
          ? `touch-none cursor-grab ${isDragging ? 'z-30 scale-105 cursor-grabbing shadow-lg' : 'z-10 hover:shadow-md'}`
          : 'cursor-pointer active:scale-95 z-10'
      }`}
    >
      {/* Delete button in layout mode */}
      {mode === 'layout' && canDelete && !isEditingName && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(participant.id);
          }}
          title="참여자 삭제"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#E5DEC9] bg-white text-[#767066] shadow-xs transition hover:border-[#C86D51] hover:text-[#C86D51]"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="flex items-stretch gap-1.5 sm:gap-2">
        {/* Left Vertical Sand Gauge Bar */}
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
                  : '20%',
            }}
          />
        </div>

        {/* Card Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
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
                className="w-full rounded border border-[#8A9A5B] bg-white px-1 py-0.5 text-xs font-semibold text-[#2C2A25] focus:outline-none"
              />
            ) : (
              <>
                <span
                  className={`truncate font-bold leading-tight ${
                    isCompactCount
                      ? 'text-[11px] sm:text-xs'
                      : 'text-xs sm:text-sm'
                  }`}
                >
                  {participant.name}
                </span>
                {mode === 'layout' ? (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-75">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingName(true);
                      }}
                      title="이름 수정"
                      className="rounded p-0.5 hover:bg-black/10"
                    >
                      <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                    <GripVertical className="h-3 w-3 opacity-60" />
                  </div>
                ) : (
                  <span
                    className={`shrink-0 text-[10px] font-semibold tabular-nums ${
                      isSpeaking
                        ? 'text-white/90'
                        : metrics.balanceState === 'dominant'
                          ? 'text-[#C86D51]'
                          : 'text-[#767066]'
                    }`}
                  >
                    {Math.round(metrics.sharePct)}%
                  </span>
                )}
              </>
            )}
          </div>

          <div
            className={`mt-0.5 flex items-center justify-between gap-1 tabular-nums leading-tight ${
              isCompactCount ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
            } ${isSpeaking ? 'text-white/95' : 'opacity-80'}`}
          >
            <span>{formatClockMMSS(metrics.totalSec)}</span>
            <span className="text-[10px] opacity-85">{metrics.turnCount}회</span>
          </div>

          {isTurnOvertime && (
            <div className="mt-0.5 rounded bg-[#C86D51] px-1 py-[1px] text-center text-[9px] font-bold text-white">
              권장 초과
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
