import React, { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Clock,
  Download,
  History,
  Hourglass,
  Mic,
  Minus,
  Plus,
  RotateCcw,
  Square as RectIcon,
  Trash2,
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../lib/layoutUtils';
import { formatClockMMSS } from '../lib/exportUtils';
import { useCurrentTimeHHMM } from '../hooks/useCurrentTime';
import { useLongPress } from '../hooks/useLongPress';
import { BalanceMode, Participant } from '../types/facilitation';
import { LiveParticipantMetrics } from '../context/SessionContext';
import { HourglassSvg } from './HourglassSvg';
import { ParticipantCard } from './ParticipantCard';
import { FacilitatorCard } from './FacilitatorCard';

interface BalanceViewProps {
  confirmEndOpen: boolean;
  onCancelEnd: () => void;
  onConfirmEnd: () => void;
}

const TURN_PRESETS = [
  { label: '1분', sec: 60 },
  { label: '2분', sec: 120 },
  { label: '3분', sec: 180 },
  { label: '5분', sec: 300 },
];

interface ShareChipProps {
  participant: Participant;
  metrics: LiveParticipantMetrics;
  mode: BalanceMode;
  onRename: (id: string, name: string) => void;
}

const ShareChip: React.FC<ShareChipProps> = ({ participant, metrics, mode, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(participant.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftName(participant.name);
  }, [participant.name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const {
    isPressing,
    handlers: longPressHandlers,
  } = useLongPress({
    enabled: mode === 'layout' && !isEditing,
    delayMs: 900,
    moveThresholdPx: 8,
    onLongPress: () => setIsEditing(true),
  });

  const commitName = () => {
    onRename(participant.id, draftName);
    setIsEditing(false);
  };

  const dotColor =
    metrics.balanceState === 'speaking'
      ? 'bg-lime-600'
      : metrics.balanceState === 'dominant'
        ? 'bg-orange-500'
        : metrics.balanceState === 'balanced'
          ? 'bg-emerald-500'
          : 'bg-stone-300';

  const barColor = dotColor;

  return (
    <div
      {...longPressHandlers}
      className={`touch-callout-none relative min-w-0 select-none rounded-lg border px-2 py-1 transition [@media(max-height:450px)]:px-1.5 [@media(max-height:450px)]:py-0.5 ${
        isEditing
          ? 'z-10 border-lime-600 bg-white ring-2 ring-lime-600'
          : 'border-stone-200 bg-stone-50/80'
      }`}
    >
      {isEditing ? (
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
              setIsEditing(false);
            }
          }}
          className="w-full rounded bg-transparent text-xs font-semibold text-stone-900 focus:outline-none sm:text-[11px]"
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 leading-tight">
            <div className="flex min-w-0 items-center gap-1">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
              <span className="min-w-0 truncate whitespace-nowrap text-xs font-semibold text-stone-900 sm:text-[11px] [@media(max-height:450px)]:text-[10px]">
                {participant.name}
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-[11px] font-semibold text-stone-600 sm:text-[10px]">
              {Math.round(metrics.sharePct)}%
            </span>
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all duration-200 ${barColor}`}
              style={{
                width: `${Math.min(100, Math.max(metrics.totalSec > 0 ? 4 : 0, metrics.sharePct))}%`,
              }}
            />
          </div>
        </>
      )}
      {isPressing && (
        <div className="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 overflow-hidden rounded-full bg-lime-200">
          <div className="animate-long-press-fill h-full bg-lime-700" />
        </div>
      )}
    </div>
  );
};

export const BalanceView: React.FC<BalanceViewProps> = ({
  confirmEndOpen,
  onCancelEnd,
  onConfirmEnd,
}) => {
  const {
    participants,
    facilitatorSeat,
    showFacilitatorSeat,
    setShowFacilitatorSeat,
    tableShape,
    setTableShape,
    mode,
    recommendedTurnSec,
    setRecommendedTurnSec,
    goalMinutes,
    sessionStatus,
    activeSpeakerId,
    activeSpeakerName,
    currentSessionNumber,
    currentSessionElapsedSec,
    currentTurnElapsedSec,
    facilitatorTotalSec,
    overallFacilitatorTotalSec,
    timeline,
    completedSessions,
    participantMetrics,
    overallParticipantMetrics,
    recoverableSession,
    lastCompletedSession,
    addParticipant,
    setParticipantCount,
    removeParticipant,
    renameParticipant,
    moveParticipant,
    moveFacilitatorSeat,
    swapSeats,
    resetLayout,
    selectSpeaker,
    switchToFacilitator,
    recoverUnfinishedSession,
    reopenLastSession,
    discardUnfinishedBackup,
  } = useSession();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [countDraft, setCountDraft] = useState<string>(String(participants.length));
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [shareViewTab, setShareViewTab] = useState<'current' | 'prev' | 'total'>('current');
  const [selectedPrevSessionNum, setSelectedPrevSessionNum] = useState<number>(1);
  const currentTimeHHMM = useCurrentTimeHHMM();

  useEffect(() => {
    if (completedSessions.length > 0) {
      setSelectedPrevSessionNum(completedSessions[completedSessions.length - 1].sessionNumber);
    } else if (shareViewTab === 'prev') {
      setShareViewTab('current');
    }
  }, [completedSessions, shareViewTab]);

  const getAllSeatPositions = () => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const p of participants) {
      map[p.id] = { x: p.x, y: p.y };
    }
    if (showFacilitatorSeat) {
      map['facilitator'] = { x: facilitatorSeat.x, y: facilitatorSeat.y };
    }
    return map;
  };

  useEffect(() => {
    setCountDraft(String(participants.length));
  }, [participants.length]);

  const commitParticipantCount = () => {
    const parsed = Number.parseInt(countDraft, 10);
    if (Number.isNaN(parsed)) {
      setCountDraft(String(participants.length));
      return;
    }
    const clamped = Math.max(MIN_PARTICIPANTS, Math.min(MAX_PARTICIPANTS, parsed));
    setParticipantCount(clamped);
    setCountDraft(String(isLive && clamped < participants.length ? participants.length : clamped));
  };

  const isLive = sessionStatus === 'running' || sessionStatus === 'paused';
  const isParticipantSpeaking = isLive && activeSpeakerId !== 'facilitator';
  const turnRemainingSec = Math.max(0, recommendedTurnSec - currentTurnElapsedSec);
  const turnOvertimeSec = Math.max(0, currentTurnElapsedSec - recommendedTurnSec);
  const isOvertime = isParticipantSpeaking && currentTurnElapsedSec > recommendedTurnSec;
  const remainingRatio = isParticipantSpeaking
    ? Math.max(0, 1 - currentTurnElapsedSec / recommendedTurnSec)
    : 1;

  const goalTotalSec = goalMinutes * 60;
  const goalRemainingSec = Math.max(0, goalTotalSec - currentSessionElapsedSec);
  const goalProgressPct =
    goalTotalSec > 0 ? Math.min(100, Math.max(0, (goalRemainingSec / goalTotalSec) * 100)) : 0;
  const isGoalOvertime = isLive && currentSessionElapsedSec > goalTotalSec;

  const activePrevSnapshot =
    completedSessions.find((s) => s.sessionNumber === selectedPrevSessionNum) ??
    completedSessions[completedSessions.length - 1] ??
    null;

  const useTwoColBars = participants.length >= 7;
  const recentLogs = timeline.slice(-2).reverse();

  return (
    <main className="relative flex flex-1 min-h-0 w-full flex-col overflow-hidden bg-stone-100 sm:flex-row landscape:flex-row">
      {/* Left Column (~68%): Table Canvas + Compact Bottom Bar */}
      <section className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
        {/* Recovery Banner if interrupted session exists in IndexedDB */}
        {recoverableSession && (
          <div className="z-20 mx-2 mt-1.5 flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-orange-500 bg-orange-50 px-3 py-1.5 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-orange-700">
                이전 미완료 세션 백업이 발견되었습니다
              </p>
              <p className="truncate text-[11px] text-stone-600 tabular-nums">
                시작: {new Date(recoverableSession.sessionStartedAt).toLocaleString('ko-KR')} ·{' '}
                {formatClockMMSS(recoverableSession.totalDurationSec)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void recoverUnfinishedSession()}
                className="flex items-center gap-1 rounded-full bg-lime-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-lime-800"
              >
                <Download className="h-3 w-3" />
                <span>복구/다운로드</span>
              </button>
              <button
                type="button"
                onClick={() => void discardUnfinishedBackup()}
                title="백업 삭제"
                className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-600 hover:border-orange-500 hover:text-orange-700"
              >
                <Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">백업 삭제</span>
              </button>
            </div>
          </div>
        )}

        {/* Interactive Table Canvas */}
        <div ref={canvasRef} className="relative flex-1 min-h-0 w-full select-none overflow-hidden">
          {mode === 'layout' && (
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(var(--color-stone-400) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
          )}

          {/* Center Conference Table (Rect or True Square Circle) */}
          <div
            onClick={() => {
              if (mode === 'discuss' && isParticipantSpeaking) {
                selectSpeaker(activeSpeakerId);
              }
            }}
            title={
              mode === 'discuss' && isParticipantSpeaking
                ? '터치하여 진행자 구간으로 복귀'
                : undefined
            }
            className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border-2 border-stone-300 bg-stone-200/70 text-center shadow-inner transition-all duration-300 ${
              mode === 'discuss' && isParticipantSpeaking
                ? 'cursor-pointer hover:border-lime-600'
                : ''
            } ${
              tableShape === 'circle'
                ? 'aspect-square h-[142px] rounded-full sm:h-[196px] md:h-[224px] [@media(max-height:450px)]:h-[104px]'
                : 'h-[38%] w-[46%] min-h-[116px] min-w-[164px] max-h-[228px] max-w-[332px] rounded-3xl [@media(max-height:450px)]:h-[98px] [@media(max-height:450px)]:min-h-[96px]'
            }`}
          >
            {sessionStatus === 'idle' ? (
              <div className="mb-1 flex flex-col items-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-stone-600 shadow-2xs sm:text-[10px]">
                  <Clock className="h-2.5 w-2.5 text-lime-700" />
                  <span>현재 시각</span>
                </span>
                <span className="mt-0.5 tabular-nums text-xl font-extrabold leading-tight tracking-tight text-stone-900 sm:text-3xl [@media(max-height:450px)]:text-lg">
                  {currentTimeHHMM}
                </span>
              </div>
            ) : (
              <HourglassSvg
                remainingRatio={remainingRatio}
                isOvertime={isOvertime}
                isActiveParticipant={isParticipantSpeaking}
                isPaused={sessionStatus === 'paused'}
                sizeClass="h-9 w-9 sm:h-14 sm:w-14 [@media(max-height:450px)]:h-7 [@media(max-height:450px)]:w-7"
              />
            )}

            <div className="px-2">
              <div className="flex items-center justify-center gap-1">
                {sessionStatus !== 'idle' && (
                  <Hourglass
                    className={`h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 ${
                      sessionStatus === 'running' ? 'animate-hourglass-rock' : ''
                    } ${
                      isOvertime
                        ? 'text-orange-600'
                        : isParticipantSpeaking
                          ? 'text-lime-700'
                          : 'text-stone-500'
                    }`}
                  />
                )}
                <p className="max-w-[110px] truncate text-[10px] font-bold text-stone-900 sm:max-w-[176px] sm:text-xs">
                  {sessionStatus === 'idle'
                    ? '준비 완료'
                    : sessionStatus === 'paused'
                      ? '일시정지'
                      : isParticipantSpeaking
                        ? `${activeSpeakerName} 발언 중`
                        : '진행자 발언 중'}
                </p>
              </div>
              <p
                className={`tabular-nums text-xs font-extrabold sm:text-base [@media(max-height:450px)]:text-xs ${
                  isOvertime
                    ? 'text-orange-700'
                    : isParticipantSpeaking
                      ? 'text-lime-800'
                      : 'text-stone-600'
                }`}
              >
                {isParticipantSpeaking
                  ? isOvertime
                    ? `+${formatClockMMSS(turnOvertimeSec)}`
                    : formatClockMMSS(turnRemainingSec)
                  : formatClockMMSS(facilitatorTotalSec)}
              </p>
            </div>

            {/* Recommended turn duration single-row selector */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-1 flex flex-nowrap items-center justify-center gap-0.5 rounded-full border border-stone-200 bg-white p-0.5 shadow-xs"
            >
              {TURN_PRESETS.map((preset) => (
                <button
                  key={preset.sec}
                  type="button"
                  onClick={() => setRecommendedTurnSec(preset.sec)}
                  className={`whitespace-nowrap rounded-full px-1 py-0.5 text-[9px] font-bold transition sm:px-1.5 sm:text-[10px] ${
                    recommendedTurnSec === preset.sec
                      ? 'bg-lime-700 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fixed Facilitator Seat (N+1) */}
          {showFacilitatorSeat && (
            <FacilitatorCard
              seat={facilitatorSeat}
              totalSec={facilitatorTotalSec}
              isSpeaking={activeSpeakerId === 'facilitator'}
              mode={mode}
              sessionStatus={sessionStatus}
              isCompactCount={participants.length >= 9}
              isSwapTarget={swapTargetId === 'facilitator'}
              canvasRef={canvasRef}
              getAllSeatPositions={getAllSeatPositions}
              onSelect={switchToFacilitator}
              onMove={moveFacilitatorSeat}
              onSwapTargetChange={setSwapTargetId}
              onSwapSeats={swapSeats}
            />
          )}

          {/* Participant Cards around the table */}
          {participants.map((p) => (
            <ParticipantCard
              key={p.id}
              participant={p}
              metrics={
                participantMetrics[p.id] ?? {
                  totalSec: 0,
                  turnCount: 0,
                  sharePct: 0,
                  balanceState: 'unspoken',
                  currentTurnElapsedSec: 0,
                }
              }
              mode={mode}
              sessionStatus={sessionStatus}
              recommendedTurnSec={recommendedTurnSec}
              participantCount={participants.length}
              canDelete={participants.length > MIN_PARTICIPANTS && sessionStatus === 'idle'}
              isSwapTarget={swapTargetId === p.id}
              canvasRef={canvasRef}
              getAllSeatPositions={getAllSeatPositions}
              onSelect={selectSpeaker}
              onMove={moveParticipant}
              onSwapTargetChange={setSwapTargetId}
              onSwapSeats={swapSeats}
              onRename={renameParticipant}
              onRemove={removeParticipant}
            />
          ))}
        </div>

        {/* Left Bottom Control Strip (fits 390px portrait cleanly without wrapping) */}
        <footer className="z-20 flex h-8 w-full shrink-0 items-center justify-between gap-1 border-t border-stone-200 bg-white px-1.5 sm:gap-2 sm:px-3 [@media(max-height:450px)]:h-7">
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {/* Table Shape Switcher */}
            <div className="flex shrink-0 items-center rounded-full border border-stone-200 bg-stone-100 p-0.5">
              <button
                type="button"
                onClick={() => setTableShape('rect')}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition sm:px-2 ${
                  tableShape === 'rect'
                    ? 'bg-lime-700 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="4면 직사각형 테이블"
              >
                <RectIcon className="h-2.5 w-2.5" />
                <span>4면</span>
              </button>
              <button
                type="button"
                onClick={() => setTableShape('circle')}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition sm:px-2 ${
                  tableShape === 'circle'
                    ? 'bg-lime-700 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="원형 테이블"
              >
                <Circle className="h-2.5 w-2.5" />
                <span>원형</span>
              </button>
            </div>

            {/* Participant Count Direct Numeric Stepper (2~12) */}
            <div className="flex shrink-0 items-center rounded-full border border-stone-200 bg-stone-100 p-0.5">
              <button
                type="button"
                disabled={isLive || participants.length <= MIN_PARTICIPANTS}
                onClick={() => setParticipantCount(participants.length - 1)}
                title={isLive ? '세션 중에는 인원 감소 불가' : '참여자 1명 줄이기'}
                className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                  isLive || participants.length <= MIN_PARTICIPANTS
                    ? 'cursor-not-allowed text-stone-400'
                    : 'bg-white text-stone-900 shadow-2xs hover:bg-stone-200'
                }`}
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <label className="flex items-center px-1 text-[10px] font-bold text-stone-900">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_PARTICIPANTS}
                  max={MAX_PARTICIPANTS}
                  value={countDraft}
                  onChange={(e) => setCountDraft(e.target.value)}
                  onBlur={commitParticipantCount}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  aria-label="참여자 인원수 입력 (2~12명)"
                  className="w-6 bg-transparent text-center text-[11px] font-bold tabular-nums text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="whitespace-nowrap text-stone-600">명</span>
              </label>
              <button
                type="button"
                disabled={participants.length >= MAX_PARTICIPANTS}
                onClick={addParticipant}
                title="참여자 1명 추가 (최대 12명)"
                className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                  participants.length >= MAX_PARTICIPANTS
                    ? 'cursor-not-allowed text-stone-400'
                    : 'bg-white text-stone-900 shadow-2xs hover:bg-lime-100 hover:text-lime-800'
                }`}
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>

            {mode === 'layout' && (
              <button
                type="button"
                onClick={resetLayout}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600 transition hover:border-orange-500 hover:text-orange-700"
                title="좌석 배치 기본값으로 초기화"
              >
                <RotateCcw className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">배치 초기화</span>
              </button>
            )}

            {/* Toggle Facilitator Seat Visibility */}
            <button
              type="button"
              onClick={() => setShowFacilitatorSeat(!showFacilitatorSeat)}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                showFacilitatorSeat
                  ? 'border-stone-400 bg-stone-200 text-stone-800'
                  : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800'
              }`}
              title="진행자 자리 표시 ON/OFF"
            >
              <Mic className="h-2.5 w-2.5 shrink-0" />
              <span>진행자 자리</span>
            </button>

            {/* Reopen Latest Completed Result Report when idle */}
            {sessionStatus === 'idle' && lastCompletedSession && (
              <button
                type="button"
                onClick={() => void reopenLastSession()}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-lime-600 bg-lime-100/80 px-2 py-0.5 text-[10px] font-semibold text-lime-800 transition hover:bg-lime-200/70"
                title="가장 최근 완료된 세션 결과 리포트 다시 열기"
              >
                <History className="h-2.5 w-2.5 shrink-0" />
                <span>최근 결과</span>
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="hidden items-center gap-2 text-[10px] font-semibold text-stone-600 md:flex">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-stone-300" />
              미발언
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-lime-700" />
              발언 중
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              적정 균형
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-orange-600" />
              발언 집중
            </span>
          </div>
        </footer>
      </section>

      {/* Right Column (~32%, 240px~280px) / Bottom Portrait Panel (auto-height, zero scroll for 12명) */}
      <aside className="flex h-auto max-h-none w-full shrink-0 flex-col gap-1.5 overflow-hidden border-t border-stone-200 bg-white p-2 sm:h-full sm:w-[248px] sm:justify-between sm:border-l sm:border-t-0 sm:p-2.5 md:w-[264px] lg:w-[280px] landscape:h-full landscape:w-[240px] landscape:justify-between landscape:border-l landscape:border-t-0 [@media(max-height:450px)]:gap-1 [@media(max-height:450px)]:p-1.5">
        {/* Mobile Portrait Single-Row Status Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-xs sm:hidden landscape:hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                sessionStatus === 'running'
                  ? 'bg-lime-700 animate-pulse'
                  : sessionStatus === 'paused'
                    ? 'bg-orange-600'
                    : 'bg-stone-400'
              }`}
            />
            <span className="truncate font-bold text-stone-900">
              {sessionStatus === 'idle' ? '진행자 대기' : activeSpeakerName}
            </span>
          </div>
          <span className="shrink-0 tabular-nums text-[11px] font-semibold text-stone-600">
            진행자 {formatClockMMSS(facilitatorTotalSec)}
          </span>
          <span
            className={`shrink-0 tabular-nums text-[11px] font-bold ${
              isGoalOvertime ? 'text-orange-700' : 'text-lime-800'
            }`}
          >
            {currentSessionNumber}세션 · {goalMinutes}분
          </span>
        </div>

        {/* Desktop / Landscape Expanded Status Card */}
        <div className="hidden shrink-0 rounded-xl border border-stone-200 bg-stone-100 p-2 sm:block landscape:block [@media(max-height:450px)]:p-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  sessionStatus === 'running'
                    ? 'bg-lime-700 animate-pulse'
                    : sessionStatus === 'paused'
                      ? 'bg-orange-600'
                      : 'bg-stone-400'
                }`}
              />
              <span className="truncate text-xs font-bold text-stone-900">
                {sessionStatus === 'idle' ? '진행자 대기' : activeSpeakerName}
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-xs font-bold text-lime-800">
              {formatClockMMSS(currentTurnElapsedSec)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-stone-600 tabular-nums">
            <span>
              진행자{' '}
              {formatClockMMSS(
                shareViewTab === 'total'
                  ? overallFacilitatorTotalSec
                  : shareViewTab === 'prev' && activePrevSnapshot
                    ? activePrevSnapshot.facilitatorTotalSec
                    : facilitatorTotalSec
              )}
            </span>
            <span className={isGoalOvertime ? 'text-orange-700' : 'text-stone-600'}>
              {currentSessionNumber}세션 · {goalMinutes}분{' '}
              {isLive
                ? isGoalOvertime
                  ? `+${formatClockMMSS(currentSessionElapsedSec - goalTotalSec)}`
                  : formatClockMMSS(goalRemainingSec)
                : formatClockMMSS(goalTotalSec)}
            </span>
          </div>

          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isGoalOvertime ? 'bg-orange-600' : 'bg-lime-700'
              }`}
              style={{ width: `${isLive ? goalProgressPct : 100}%` }}
            />
          </div>
        </div>

        {/* Middle: Live Share Chips with Session Tabs */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-1">
            <span className="shrink-0 text-[11px] font-bold text-stone-600">실시간 발언 점유율</span>
            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-stone-100 p-0.5 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setShareViewTab('current')}
                className={`whitespace-nowrap rounded-full px-1.5 py-0.5 transition ${
                  shareViewTab === 'current'
                    ? 'bg-lime-700 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                현재 세션
              </button>
              <button
                type="button"
                disabled={completedSessions.length === 0}
                onClick={() => setShareViewTab('prev')}
                className={`whitespace-nowrap rounded-full px-1.5 py-0.5 transition ${
                  completedSessions.length === 0
                    ? 'cursor-not-allowed text-stone-400'
                    : shareViewTab === 'prev'
                      ? 'bg-lime-700 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                이전 ({completedSessions.length})
              </button>
              <button
                type="button"
                onClick={() => setShareViewTab('total')}
                className={`whitespace-nowrap rounded-full px-1.5 py-0.5 transition ${
                  shareViewTab === 'total'
                    ? 'bg-lime-700 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                전체 합산
              </button>
            </div>
          </div>

          {/* Sub-selector when >= 2 completed sessions exist */}
          {shareViewTab === 'prev' && completedSessions.length > 0 && (
            <div className="mb-1 flex shrink-0 items-center justify-between gap-1 text-[10px] text-stone-600">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {completedSessions.map((s) => (
                  <button
                    key={s.sessionNumber}
                    type="button"
                    onClick={() => setSelectedPrevSessionNum(s.sessionNumber)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-semibold transition ${
                      (activePrevSnapshot?.sessionNumber ?? 1) === s.sessionNumber
                        ? 'border-lime-600 bg-lime-100/80 text-lime-800'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    {s.sessionNumber}세션
                  </button>
                ))}
              </div>
              {activePrevSnapshot && (
                <span className="shrink-0 tabular-nums font-semibold text-stone-500">
                  소요 {formatClockMMSS(activePrevSnapshot.durationSec)}
                </span>
              )}
            </div>
          )}

          <div
            className={`grid flex-1 min-h-0 content-start overflow-hidden ${
              useTwoColBars
                ? 'grid-cols-3 gap-1 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-1 landscape:grid-cols-2 landscape:gap-x-2 landscape:gap-y-1 [@media(max-height:450px)]:gap-y-0.5'
                : 'grid-cols-2 gap-1.5 sm:grid-cols-1 sm:gap-y-1.5 landscape:grid-cols-1 landscape:gap-y-1 [@media(max-height:450px)]:gap-y-1'
            }`}
          >
            {participants.map((p) => {
              let chipMetrics: LiveParticipantMetrics;
              if (shareViewTab === 'prev' && activePrevSnapshot) {
                const stat = activePrevSnapshot.participantStats.find((s) => s.id === p.id);
                const totalSec = stat?.totalSec ?? 0;
                const turnCount = stat?.turnCount ?? 0;
                const sharePct = stat?.sharePct ?? 0;
                const equalSharePct = participants.length > 0 ? 100 / participants.length : 100;
                const prevSum = activePrevSnapshot.participantStats.reduce(
                  (acc, s) => acc + s.totalSec,
                  0
                );
                const balanceState =
                  totalSec <= 0
                    ? 'unspoken'
                    : prevSum >= 60 && sharePct > equalSharePct * 1.5
                      ? 'dominant'
                      : 'balanced';
                chipMetrics = {
                  totalSec,
                  turnCount,
                  sharePct,
                  balanceState,
                  currentTurnElapsedSec: 0,
                };
              } else {
                const source =
                  shareViewTab === 'total' ? overallParticipantMetrics : participantMetrics;
                chipMetrics = source[p.id] ?? {
                  totalSec: 0,
                  turnCount: 0,
                  sharePct: 0,
                  balanceState: 'unspoken',
                  currentTurnElapsedSec: 0,
                };
              }

              return (
                <ShareChip
                  key={p.id}
                  participant={p}
                  metrics={chipMetrics}
                  mode={mode}
                  onRename={renameParticipant}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom: Latest 2 Switch Logs (hidden on portrait to keep 12명 grid zero-scroll) */}
        <div className="hidden shrink-0 border-t border-stone-200 pt-1.5 sm:block landscape:block">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-600">최근 전환 로그</span>
            <span className="text-[10px] text-stone-400 tabular-nums">
              {timeline.length}건
            </span>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-[10px] text-stone-400">화자 전환 기록이 여기에 표시됩니다.</p>
          ) : (
            <div className="space-y-0.5">
              {recentLogs.map((entry) => (
                <div
                  key={`${entry.turn}-${entry.startSec}`}
                  className="flex items-center justify-between gap-1 text-[10px] leading-tight"
                >
                  <span className="whitespace-nowrap font-bold text-stone-900">
                    #{entry.turn} {entry.speaker}
                  </span>
                  <span className="shrink-0 tabular-nums text-stone-600">
                    {formatClockMMSS(entry.startSec)}–{formatClockMMSS(entry.endSec)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* End Session Confirmation Modal */}
      {confirmEndOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl">
            <h2 className="text-base font-bold text-stone-900">세션을 종료하시겠습니까?</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
              종료하면 지금까지 기록된 발언 타임라인과 녹음 파일을 정리하여 결과 리포트 모달을 엽니다.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEnd}
                className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                계속 진행
              </button>
              <button
                type="button"
                onClick={onConfirmEnd}
                className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
              >
                세션 종료 및 리포트
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
