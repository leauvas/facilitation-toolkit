import React, { useRef } from 'react';
import {
  Circle,
  Download,
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
    tableShape,
    setTableShape,
    mode,
    recommendedTurnSec,
    setRecommendedTurnSec,
    sessionStatus,
    activeSpeakerId,
    activeSpeakerName,
    currentTurnElapsedSec,
    facilitatorTotalSec,
    participantMetrics,
    recoverableSession,
    addParticipant,
    removeParticipant,
    renameParticipant,
    moveParticipant,
    resetLayout,
    selectSpeaker,
    recoverUnfinishedSession,
    discardUnfinishedBackup,
  } = useSession();

  const canvasRef = useRef<HTMLDivElement | null>(null);

  const isLive = sessionStatus === 'running' || sessionStatus === 'paused';
  const isParticipantSpeaking = isLive && activeSpeakerId !== 'facilitator';
  const turnRemainingSec = Math.max(0, recommendedTurnSec - currentTurnElapsedSec);
  const turnOvertimeSec = Math.max(0, currentTurnElapsedSec - recommendedTurnSec);
  const isOvertime = isParticipantSpeaking && currentTurnElapsedSec > recommendedTurnSec;
  const remainingRatio = isParticipantSpeaking
    ? Math.max(0, 1 - currentTurnElapsedSec / recommendedTurnSec)
    : 1;

  return (
    <main className="relative flex flex-1 min-h-0 w-full flex-col overflow-hidden bg-[#FAF8F5]">
      {/* Recovery Banner if interrupted session exists in IndexedDB */}
      {recoverableSession && (
        <div className="z-30 mx-auto mt-1.5 flex w-[96%] max-w-2xl shrink-0 items-center justify-between gap-2 rounded-2xl border border-[#C86D51]/40 bg-[#FFF8F5] px-3 py-1.5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#8D3A21]">
              이전 미완료 세션 백업이 발견되었습니다
            </p>
            <p className="truncate text-[11px] text-[#767066]">
              시작: {new Date(recoverableSession.sessionStartedAt).toLocaleString('ko-KR')} ·{' '}
              {formatClockMMSS(recoverableSession.totalDurationSec)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void recoverUnfinishedSession()}
              className="flex items-center gap-1 rounded-full bg-[#8A9A5B] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#7A8A4E]"
            >
              <Download className="h-3 w-3" />
              <span>복구/다운로드</span>
            </button>
            <button
              type="button"
              onClick={() => void discardUnfinishedBackup()}
              title="백업 삭제"
              className="flex items-center gap-1 rounded-full border border-[#E5DEC9] bg-white px-2 py-1 text-[11px] font-semibold text-[#767066] hover:border-[#C86D51] hover:text-[#C86D51]"
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">백업 삭제</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Table Canvas */}
      <div ref={canvasRef} className="relative flex-1 min-h-0 w-full select-none overflow-hidden">
        {/* Subtle grid guide when in layout mode */}
        {mode === 'layout' && (
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage: 'radial-gradient(#C7BFA9 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        )}

        {/* Center Conference Table (Rect or Circle) */}
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
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-[#DFD7C5] bg-white/90 shadow-sm transition-all duration-300 flex flex-col items-center justify-center text-center ${
            mode === 'discuss' && isParticipantSpeaking ? 'cursor-pointer hover:border-[#8A9A5B]' : ''
          } ${
            tableShape === 'circle'
              ? 'h-[138px] w-[138px] rounded-full sm:h-[212px] sm:w-[212px] md:h-[244px] md:w-[244px] [@media(max-height:450px)]:h-[126px] [@media(max-height:450px)]:w-[126px]'
              : 'h-[36%] w-[44%] min-h-[116px] min-w-[160px] max-h-[244px] max-w-[356px] rounded-[28px] sm:rounded-[36px] [@media(max-height:450px)]:h-[38%] [@media(max-height:450px)]:w-[40%]'
          }`}
        >
          <HourglassSvg
            remainingRatio={remainingRatio}
            isOvertime={isOvertime}
            isActiveParticipant={isParticipantSpeaking}
            isPaused={sessionStatus === 'paused'}
            sizeClass="h-10 w-10 sm:h-16 sm:w-16 [@media(max-height:450px)]:h-9 [@media(max-height:450px)]:w-9"
          />

          <div className="mt-0.5 px-2">
            <p className="max-w-[136px] truncate text-[11px] font-bold text-[#2C2A25] sm:max-w-[200px] sm:text-xs">
              {sessionStatus === 'idle'
                ? '준비 완료'
                : sessionStatus === 'paused'
                  ? '일시정지'
                  : isParticipantSpeaking
                    ? `${activeSpeakerName} 발언 중`
                    : '진행자 발언 중'}
            </p>
            <p
              className={`tabular-nums text-sm font-extrabold sm:text-lg [@media(max-height:450px)]:text-xs ${
                isOvertime
                  ? 'text-[#C86D51]'
                  : isParticipantSpeaking
                    ? 'text-[#5E6B3B]'
                    : 'text-[#767066]'
              }`}
            >
              {isParticipantSpeaking
                ? isOvertime
                  ? `+${formatClockMMSS(turnOvertimeSec)}`
                  : formatClockMMSS(turnRemainingSec)
                : formatClockMMSS(facilitatorTotalSec)}
            </p>
          </div>

          {/* Recommended turn duration quick selector */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-1 flex items-center gap-0.5 rounded-full border border-[#E5DEC9] bg-[#FAF8F5] p-0.5"
          >
            {TURN_PRESETS.map((preset) => (
              <button
                key={preset.sec}
                type="button"
                onClick={() => setRecommendedTurnSec(preset.sec)}
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition sm:px-2 sm:text-[10px] ${
                  recommendedTurnSec === preset.sec
                    ? 'bg-[#8A9A5B] text-white'
                    : 'text-[#767066] hover:text-[#2C2A25]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

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
            canvasRef={canvasRef}
            onSelect={selectSpeaker}
            onMove={moveParticipant}
            onRename={renameParticipant}
            onRemove={removeParticipant}
          />
        ))}
      </div>

      {/* Slim Bottom Bar (never overlaps corner cards) */}
      <footer className="z-20 flex h-8 sm:h-9 w-full shrink-0 items-center justify-between gap-2 border-t border-[#E5DEC9]/80 bg-white/85 px-2 sm:px-4 backdrop-blur-xs">
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Table Shape Switcher */}
          <div className="flex items-center rounded-full border border-[#E5DEC9] bg-[#FAF8F5] p-0.5">
            <button
              type="button"
              onClick={() => setTableShape('rect')}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition sm:text-[11px] ${
                tableShape === 'rect'
                  ? 'bg-[#8A9A5B] text-white'
                  : 'text-[#5E584E] hover:text-[#2C2A25]'
              }`}
              title="4면 직사각형 테이블"
            >
              <RectIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>4면</span>
            </button>
            <button
              type="button"
              onClick={() => setTableShape('circle')}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition sm:text-[11px] ${
                tableShape === 'circle'
                  ? 'bg-[#8A9A5B] text-white'
                  : 'text-[#5E584E] hover:text-[#2C2A25]'
              }`}
              title="원형 테이블"
            >
              <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>원형</span>
            </button>
          </div>

          {/* Add Participant (available in both layout and discuss mode for latecomers) */}
          <button
            type="button"
            disabled={participants.length >= MAX_PARTICIPANTS}
            onClick={addParticipant}
            className={`flex items-center gap-1 rounded-full border border-[#E5DEC9] bg-white px-2.5 py-0.5 text-[10px] font-semibold transition sm:text-[11px] ${
              participants.length >= MAX_PARTICIPANTS
                ? 'cursor-not-allowed text-[#BFB8A9]'
                : 'text-[#2C2A25] hover:border-[#8A9A5B] hover:text-[#5E6B3B]'
            }`}
            title="참여자 추가 (최대 12명)"
          >
            <Plus className="h-3 w-3" />
            <span>참여자 ({participants.length}/12)</span>
          </button>

          {/* Reset Layout in layout mode */}
          {mode === 'layout' && (
            <button
              type="button"
              onClick={resetLayout}
              className="flex items-center gap-1 rounded-full border border-[#E5DEC9] bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[#5E584E] transition hover:border-[#C86D51] hover:text-[#C86D51] sm:text-[11px]"
              title="좌석 배치 기본값으로 초기화"
            >
              <RotateCcw className="h-3 w-3" />
              <span>배치 초기화</span>
            </button>
          )}
        </div>

        {/* Balance Legend & Facilitator Separate Total */}
        <div className="flex items-center gap-2 text-[10px] font-medium text-[#5E584E] sm:text-[11px]">
          <div className="hidden items-center gap-2 md:flex">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#D7CFC1]" />
              미발언
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#8A9A5B]" />
              발언 중
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#B9CA98]" />
              적정 균형
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#C86D51]" />
              발언 집중
            </span>
          </div>
          <span className="tabular-nums font-semibold text-[#2C2A25] md:border-l md:border-[#E5DEC9] md:pl-2">
            진행자 {formatClockMMSS(facilitatorTotalSec)}
          </span>
        </div>
      </footer>

      {/* End Session Confirmation Modal */}
      {confirmEndOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2A25]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-[#E5DEC9] bg-[#FAF8F5] p-5 shadow-2xl">
            <h2 className="text-base font-bold text-[#2C2A25]">세션을 종료하시겠습니까?</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#6E675C]">
              종료하면 지금까지 기록된 발언 타임라인과 녹음 파일을 정리하여 결과 리포트 모달을 엽니다.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEnd}
                className="rounded-full border border-[#E5DEC9] bg-white px-4 py-1.5 text-xs font-semibold text-[#5E584E] hover:bg-[#EFECE6]"
              >
                계속 진행
              </button>
              <button
                type="button"
                onClick={onConfirmEnd}
                className="rounded-full bg-[#C86D51] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#B45E44]"
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
