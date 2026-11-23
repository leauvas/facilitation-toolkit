import React, { useState } from 'react';
import {
  Clock,
  Mic,
  MicOff,
  Move,
  Pause,
  Play,
  Square,
  Undo2,
  Users,
} from 'lucide-react';
import { TabRoute } from '../types/facilitation';
import { useSession } from '../context/SessionContext';
import { formatClockMMSS } from '../lib/exportUtils';

interface TopNavBarProps {
  activeTab: TabRoute;
  onNavigate: (tab: TabRoute) => void;
  onRequestEndSession: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  onNavigate,
  onRequestEndSession,
}) => {
  const {
    mode,
    setMode,
    sessionStatus,
    activeSpeakerName,
    elapsedAudioSec,
    currentTurnElapsedSec,
    goalMinutes,
    setGoalMinutes,
    recordingEnabled,
    setRecordingEnabled,
    canUndo,
    startSession,
    pauseSession,
    resumeSession,
    undoLastSwitch,
  } = useSession();

  const [showGoalPopover, setShowGoalPopover] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState(String(goalMinutes));

  const goalTotalSec = goalMinutes * 60;
  const goalRemainingSec = Math.max(0, goalTotalSec - elapsedAudioSec);
  const goalProgressPct =
    goalTotalSec > 0 ? Math.min(100, Math.max(0, (goalRemainingSec / goalTotalSec) * 100)) : 0;
  const isGoalOvertime = elapsedAudioSec > goalTotalSec;

  const isLive = sessionStatus === 'running' || sessionStatus === 'paused';

  const applyCustomGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(customGoalInput, 10);
    if (!Number.isNaN(parsed) && parsed >= 5 && parsed <= 360) {
      setGoalMinutes(parsed);
      setShowGoalPopover(false);
    }
  };

  return (
    <header className="landscape-compact-header relative z-30 h-11 min-h-[44px] w-full shrink-0 border-b border-[#E5DEC9] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-1.5 px-2 sm:px-4">
        {/* Left: Primary Tab Navigation */}
        <nav
          aria-label="도구 탭 전환"
          className="flex shrink-0 items-center rounded-full bg-[#EFECE6] p-0.5"
        >
          <button
            type="button"
            onClick={() => onNavigate('balance')}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all sm:px-3 ${
              activeTab === 'balance'
                ? 'bg-[#8A9A5B] text-white shadow-xs'
                : 'text-[#5E584E] hover:text-[#2C2A25]'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>발언 균형</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('timer')}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all sm:px-3 ${
              activeTab === 'timer'
                ? 'bg-[#8A9A5B] text-white shadow-xs'
                : 'text-[#5E584E] hover:text-[#2C2A25]'
            }`}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>전광판 타이머</span>
          </button>
        </nav>

        {/* Right: Context-specific Slim Controls */}
        {activeTab === 'balance' ? (
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
            {/* Goal Time & Countdown Gauge */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCustomGoalInput(String(goalMinutes));
                  setShowGoalPopover((v) => !v);
                }}
                title="전체 목표 시간 설정"
                className="flex flex-col justify-center rounded-lg border border-[#E5DEC9] bg-[#FAF8F5] px-2 py-0.5 text-left transition hover:border-[#8A9A5B]"
              >
                <div className="flex items-center gap-1 text-[11px] font-medium leading-tight">
                  <span className="hidden md:inline text-[#767066]">목표</span>
                  <span
                    className={`tabular-nums font-semibold ${
                      isGoalOvertime ? 'text-[#C86D51]' : 'text-[#2C2A25]'
                    }`}
                  >
                    {isLive
                      ? isGoalOvertime
                        ? `+${formatClockMMSS(elapsedAudioSec - goalTotalSec)}`
                        : formatClockMMSS(goalRemainingSec)
                      : `${goalMinutes}분`}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-11 sm:w-14 overflow-hidden rounded-full bg-[#E5DEC9]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isGoalOvertime ? 'bg-[#C86D51]' : 'bg-[#8A9A5B]'
                    }`}
                    style={{ width: `${isLive ? goalProgressPct : 100}%` }}
                  />
                </div>
              </button>

              {showGoalPopover && (
                <div className="fixed right-3 top-12 z-50 w-56 rounded-2xl border border-[#E5DEC9] bg-white p-3 shadow-xl sm:absolute sm:right-0 sm:top-full sm:mt-1.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2C2A25]">전체 토론 목표 시간</span>
                    <button
                      type="button"
                      onClick={() => setShowGoalPopover(false)}
                      className="text-xs text-[#767066] hover:text-[#2C2A25]"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-3 gap-1.5">
                    {[30, 60, 90].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setGoalMinutes(m);
                          setShowGoalPopover(false);
                        }}
                        className={`rounded-lg py-1 text-xs font-semibold transition ${
                          goalMinutes === m
                            ? 'bg-[#8A9A5B] text-white'
                            : 'bg-[#FAF8F5] text-[#4C473F] hover:bg-[#EFECE6]'
                        }`}
                      >
                        {m}분
                      </button>
                    ))}
                  </div>
                  <form onSubmit={applyCustomGoal} className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={5}
                      max={360}
                      value={customGoalInput}
                      onChange={(e) => setCustomGoalInput(e.target.value)}
                      className="w-full rounded-lg border border-[#E5DEC9] bg-[#FAF8F5] px-2 py-1 text-xs tabular-nums focus:border-[#8A9A5B] focus:outline-none"
                      placeholder="직접 입력(분)"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg bg-[#8A9A5B] px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      적용
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Active Speaker / Recording Status Badge */}
            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                sessionStatus === 'running'
                  ? 'border-[#8A9A5B]/40 bg-[#F3F6EC] text-[#3F4A23]'
                  : sessionStatus === 'paused'
                    ? 'border-[#C86D51]/40 bg-[#FDF2EE] text-[#9B472D]'
                    : 'border-[#E5DEC9] bg-[#FAF8F5] text-[#767066]'
              }`}
            >
              {recordingEnabled && isLive && (
                <span className="flex items-center gap-1 rounded-full bg-[#C86D51] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-white ${
                      sessionStatus === 'running' ? 'animate-pulse' : ''
                    }`}
                  />
                  REC
                </span>
              )}
              <span className="max-w-[92px] truncate sm:max-w-[140px]">
                {sessionStatus === 'idle'
                  ? '대기 중'
                  : sessionStatus === 'paused'
                    ? `일시정지 · ${activeSpeakerName}`
                    : `기록 중: ${activeSpeakerName}`}
              </span>
              {isLive && (
                <span className="tabular-nums text-[#5E6B3B]">
                  {formatClockMMSS(currentTurnElapsedSec)}
                </span>
              )}
            </div>

            {/* Recording ON/OFF Toggle (when idle) */}
            {!isLive && (
              <button
                type="button"
                onClick={() => setRecordingEnabled(!recordingEnabled)}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                  recordingEnabled
                    ? 'border-[#C86D51] bg-[#FDF2EE] text-[#A84E32]'
                    : 'border-[#E5DEC9] bg-[#FAF8F5] text-[#767066] hover:text-[#2C2A25]'
                }`}
                title="선택형 연속 녹음 토글"
              >
                {recordingEnabled ? (
                  <Mic className="h-3 w-3 shrink-0" />
                ) : (
                  <MicOff className="h-3 w-3 shrink-0" />
                )}
                <span>{recordingEnabled ? '녹음 ON' : '녹음 OFF'}</span>
              </button>
            )}

            {/* Layout / Discuss Mode Toggle */}
            <button
              type="button"
              onClick={() => setMode(mode === 'layout' ? 'discuss' : 'layout')}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                mode === 'layout'
                  ? 'border-[#8A9A5B] bg-[#8A9A5B]/15 text-[#495729]'
                  : 'border-[#E5DEC9] bg-white text-[#5E584E] hover:bg-[#FAF8F5]'
              }`}
              title="좌석 배치 / 토론 진행 모드 전환"
            >
              <Move className="h-3 w-3 shrink-0" />
              <span>{mode === 'layout' ? '좌석 배치' : '토론 진행'}</span>
            </button>

            {/* Session Action Buttons */}
            {!isLive ? (
              <button
                type="button"
                onClick={() => void startSession()}
                className="flex shrink-0 items-center gap-1 rounded-full bg-[#8A9A5B] px-3 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-[#7A8A4E] active:scale-95"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>시작</span>
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={sessionStatus === 'running' ? pauseSession : resumeSession}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                    sessionStatus === 'paused'
                      ? 'border-[#8A9A5B] bg-[#8A9A5B] text-white'
                      : 'border-[#E5DEC9] bg-[#FAF8F5] text-[#2C2A25] hover:bg-[#EFECE6]'
                  }`}
                >
                  {sessionStatus === 'running' ? (
                    <>
                      <Pause className="h-3 w-3" />
                      <span className="landscape-hide-label sm:inline">일시정지</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 fill-current" />
                      <span className="landscape-hide-label sm:inline">재개</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={undoLastSwitch}
                  title="직전 오터치 실행 취소 (직전 화자로 시간 병합)"
                  className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                    canUndo
                      ? 'border-[#E5DEC9] bg-white text-[#2C2A25] hover:bg-[#FAF8F5] active:scale-95'
                      : 'cursor-not-allowed border-[#EFECE6] bg-[#FAF8F5] text-[#BEB7AA]'
                  }`}
                >
                  <Undo2 className="h-3 w-3" />
                  <span className="hidden md:inline">실행 취소</span>
                </button>

                <button
                  type="button"
                  onClick={onRequestEndSession}
                  className="flex items-center gap-1 rounded-full bg-[#C86D51] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#B45E44] active:scale-95"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  <span>종료</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* On Timer Tab: Mini Live Session Badge to return instantly */
          <div className="flex items-center gap-2">
            {isLive ? (
              <button
                type="button"
                onClick={() => onNavigate('balance')}
                className="flex items-center gap-1.5 rounded-full border border-[#8A9A5B]/50 bg-[#F3F6EC] px-2.5 py-1 text-xs font-semibold text-[#3F4A23] shadow-2xs transition hover:bg-[#E7EEDB]"
              >
                {recordingEnabled && (
                  <span className="flex items-center gap-1 rounded-full bg-[#C86D51] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-white ${
                        sessionStatus === 'running' ? 'animate-pulse' : ''
                      }`}
                    />
                    REC
                  </span>
                )}
                <span className="max-w-[110px] truncate">
                  {sessionStatus === 'paused' ? '일시정지' : `기록 중: ${activeSpeakerName}`}
                </span>
                <span className="tabular-nums text-[#5E6B3B]">
                  {formatClockMMSS(elapsedAudioSec)}
                </span>
              </button>
            ) : (
              <span className="hidden text-xs font-medium text-[#767066] sm:inline">
                facilitation.group Toolkit
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
