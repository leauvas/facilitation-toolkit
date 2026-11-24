import React, { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Download,
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
    elapsedAudioSec,
    currentTurnElapsedSec,
    facilitatorTotalSec,
    timeline,
    participantMetrics,
    recoverableSession,
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
    discardUnfinishedBackup,
  } = useSession();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [countDraft, setCountDraft] = useState<string>(String(participants.length));
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

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
  const goalRemainingSec = Math.max(0, goalTotalSec - elapsedAudioSec);
  const goalProgressPct =
    goalTotalSec > 0 ? Math.min(100, Math.max(0, (goalRemainingSec / goalTotalSec) * 100)) : 0;
  const isGoalOvertime = elapsedAudioSec > goalTotalSec;

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
            <HourglassSvg
              remainingRatio={remainingRatio}
              isOvertime={isOvertime}
              isActiveParticipant={isParticipantSpeaking}
              isPaused={sessionStatus === 'paused'}
              sizeClass="h-9 w-9 sm:h-14 sm:w-14 [@media(max-height:450px)]:h-7 [@media(max-height:450px)]:w-7"
            />

            <div className="px-2">
              <p className="max-w-[110px] truncate text-[10px] font-bold text-stone-900 sm:max-w-[176px] sm:text-xs">
                {sessionStatus === 'idle'
                  ? '준비 완료'
                  : sessionStatus === 'paused'
                    ? '일시정지'
                    : isParticipantSpeaking
                      ? `${activeSpeakerName} 발언 중`
                      : '진행자 발언 중'}
              </p>
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

      {/* Right Column (~32%, 240px~280px): Zero-Scroll Live Sub-Info Panel */}
      <aside className="flex h-[34%] min-h-[172px] max-h-[236px] w-full shrink-0 flex-col justify-between gap-1.5 overflow-hidden border-t border-stone-200 bg-white p-2 sm:h-full sm:max-h-none sm:w-[248px] sm:border-l sm:border-t-0 sm:p-2.5 md:w-[264px] lg:w-[280px] landscape:h-full landscape:max-h-none landscape:w-[240px] landscape:border-l landscape:border-t-0 [@media(max-height:450px)]:gap-1 [@media(max-height:450px)]:p-1.5">
        {/* Top: Active Speaker, Facilitator Total & Goal Time Gauge */}
        <div className="shrink-0 rounded-xl border border-stone-200 bg-stone-100 p-2 [@media(max-height:450px)]:p-1.5">
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
            <span>진행자 누적 {formatClockMMSS(facilitatorTotalSec)}</span>
            <span className={isGoalOvertime ? 'text-orange-700' : 'text-stone-600'}>
              목표 {goalMinutes}분 ·{' '}
              {isLive
                ? isGoalOvertime
                  ? `+${formatClockMMSS(elapsedAudioSec - goalTotalSec)}`
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

        {/* Middle: Live Share Bar List (auto 2-col grid at >= 7 participants, zero scroll) */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className="mb-1 flex shrink-0 items-center justify-between">
            <span className="text-[11px] font-bold text-stone-600">실시간 발언 점유율</span>
            <span className="text-[10px] font-semibold text-stone-400 tabular-nums">
              {participants.length}명
            </span>
          </div>

          <div
            className={`grid flex-1 min-h-0 content-start overflow-hidden ${
              useTwoColBars
                ? 'grid-cols-2 gap-x-2.5 gap-y-1 [@media(max-height:450px)]:gap-y-0.5'
                : 'grid-cols-1 gap-y-1.5 [@media(max-height:450px)]:gap-y-1'
            }`}
          >
            {participants.map((p) => {
              const m = participantMetrics[p.id] ?? {
                totalSec: 0,
                turnCount: 0,
                sharePct: 0,
                balanceState: 'unspoken',
                currentTurnElapsedSec: 0,
              };

              const barColor =
                m.balanceState === 'speaking'
                  ? 'bg-lime-700'
                  : m.balanceState === 'dominant'
                    ? 'bg-orange-600'
                    : m.balanceState === 'balanced'
                      ? 'bg-emerald-500'
                      : 'bg-stone-300';

              return (
                <div key={p.id} className="min-w-0 px-0.5">
                  <div className="flex items-center justify-between gap-1 leading-tight">
                    <span className="min-w-0 truncate whitespace-nowrap text-[11px] font-bold text-stone-900 [@media(max-height:450px)]:text-[10px]">
                      {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[10px] font-semibold text-stone-600">
                      {Math.round(m.sharePct)}%
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 [@media(max-height:450px)]:h-1">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                      style={{ width: `${Math.min(100, Math.max(m.totalSec > 0 ? 4 : 0, m.sharePct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom: Latest 2 Switch Logs */}
        <div className="shrink-0 border-t border-stone-200 pt-1.5">
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
