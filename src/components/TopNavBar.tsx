import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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

const GOAL_PRESETS = [30, 60, 90, 120];

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

  const openGoalPopover = () => {
    setCustomGoalInput(String(goalMinutes));
    setShowGoalPopover((prev) => !prev);
  };

  const handleSelectPreset = (minutes: number) => {
    setGoalMinutes(minutes);
    setCustomGoalInput(String(minutes));
    setShowGoalPopover(false);
  };

  const applyCustomGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(customGoalInput, 10);
    if (!Number.isNaN(parsed) && parsed >= 5 && parsed <= 360) {
      setGoalMinutes(parsed);
      setShowGoalPopover(false);
    }
  };

  return (
    <>
      <header className="landscape-compact-header relative z-30 h-10 min-h-[40px] w-full shrink-0 border-b border-stone-200 bg-white sm:h-11 sm:min-h-[44px]">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-1.5 px-2 sm:px-4">
          {/* Left: Primary Tab Navigation */}
          <nav
            aria-label="도구 탭 전환"
            className="flex shrink-0 items-center rounded-full bg-stone-100 p-0.5"
          >
            <button
              type="button"
              onClick={() => onNavigate('balance')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all sm:px-3 sm:py-1 sm:text-xs ${
                activeTab === 'balance'
                  ? 'bg-lime-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>발언 균형</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('timer')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all sm:px-3 sm:py-1 sm:text-xs ${
                activeTab === 'timer'
                  ? 'bg-lime-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>전광판 타이머</span>
            </button>
          </nav>

          {/* Right: Context-specific Slim Controls */}
          {activeTab === 'balance' ? (
            <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-1.5">
              {/* Goal Time & Countdown Gauge Button */}
              <button
                type="button"
                onClick={openGoalPopover}
                title="전체 목표 시간 설정"
                className="flex shrink-0 flex-col justify-center rounded-lg border border-stone-200 bg-stone-100 px-2 py-0.5 text-left transition hover:border-lime-600"
              >
                <div className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold leading-tight sm:text-[11px]">
                  <span className="text-stone-600">목표 {goalMinutes}분</span>
                  {isLive && (
                    <span
                      className={`tabular-nums font-bold ${
                        isGoalOvertime ? 'text-orange-700' : 'text-lime-800'
                      }`}
                    >
                      {isGoalOvertime
                        ? `+${formatClockMMSS(elapsedAudioSec - goalTotalSec)}`
                        : formatClockMMSS(goalRemainingSec)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 h-1 w-full min-w-[44px] overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isGoalOvertime ? 'bg-orange-600' : 'bg-lime-700'
                    }`}
                    style={{ width: `${isLive ? goalProgressPct : 100}%` }}
                  />
                </div>
              </button>

              {/* Active Speaker / Recording Status Badge */}
              <div
                className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:py-1 sm:text-[11px] ${
                  sessionStatus === 'running'
                    ? 'border-lime-600 bg-lime-100/80 text-lime-800'
                    : sessionStatus === 'paused'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-stone-200 bg-stone-100 text-stone-600'
                }`}
              >
                {recordingEnabled && isLive && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-white ${
                        sessionStatus === 'running' ? 'animate-pulse' : ''
                      }`}
                    />
                    REC
                  </span>
                )}
                <span className="max-w-[96px] truncate sm:max-w-[140px]">
                  {sessionStatus === 'idle'
                    ? '대기 중'
                    : sessionStatus === 'paused'
                      ? `일시정지 · ${activeSpeakerName}`
                      : `기록 중: ${activeSpeakerName}`}
                </span>
                {isLive && (
                  <span className="tabular-nums font-bold">
                    {formatClockMMSS(currentTurnElapsedSec)}
                  </span>
                )}
              </div>

              {/* Recording ON/OFF Toggle (when idle) */}
              {!isLive && (
                <button
                  type="button"
                  onClick={() => setRecordingEnabled(!recordingEnabled)}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition sm:py-1 sm:text-[11px] ${
                    recordingEnabled
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-stone-200 bg-stone-100 text-stone-600 hover:text-stone-900'
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
                className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition sm:py-1 sm:text-[11px] ${
                  mode === 'layout'
                    ? 'border-lime-600 bg-lime-100/80 text-lime-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
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
                  className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-lime-700 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-lime-800 active:scale-95 sm:px-3 sm:py-1 sm:text-xs"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>시작</span>
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={sessionStatus === 'running' ? pauseSession : resumeSession}
                    className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition active:scale-95 sm:px-2.5 sm:py-1 sm:text-[11px] ${
                      sessionStatus === 'paused'
                        ? 'border-lime-600 bg-lime-700 text-white hover:bg-lime-800'
                        : 'border-stone-200 bg-stone-100 text-stone-900 hover:bg-stone-200'
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
                    className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition sm:py-1 sm:text-[11px] ${
                      canUndo
                        ? 'border-stone-200 bg-white text-stone-900 hover:bg-stone-100 active:scale-95'
                        : 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Undo2 className="h-3 w-3" />
                    <span className="hidden md:inline">실행 취소</span>
                  </button>

                  <button
                    type="button"
                    onClick={onRequestEndSession}
                    className="flex items-center gap-1 whitespace-nowrap rounded-full bg-orange-600 px-2.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-orange-700 active:scale-95 sm:py-1 sm:text-[11px]"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                    <span>종료</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* On Timer Tab: Mini Live Session Badge */
            <div className="flex items-center gap-2">
              {isLive ? (
                <button
                  type="button"
                  onClick={() => onNavigate('balance')}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-lime-600 bg-lime-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-lime-800 shadow-xs transition hover:bg-lime-200/70 sm:py-1 sm:text-xs"
                >
                  {recordingEnabled && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
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
                  <span className="tabular-nums font-bold">
                    {formatClockMMSS(elapsedAudioSec)}
                  </span>
                </button>
              ) : (
                <span className="hidden text-xs font-medium text-stone-600 sm:inline">
                  facilitation.group Toolkit
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Portal Goal Time Selector Modal/Popover (never clipped by header overflow) */}
      {showGoalPopover &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-end bg-stone-900/20 p-2 pt-11 sm:p-4 sm:pt-12"
            onClick={() => setShowGoalPopover(false)}
          >
            <div
              className="w-64 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900">전체 토론 목표 시간</span>
                <button
                  type="button"
                  onClick={() => setShowGoalPopover(false)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                >
                  닫기
                </button>
              </div>

              <div className="mb-2.5 grid grid-cols-4 gap-1.5">
                {GOAL_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectPreset(m)}
                    className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                      goalMinutes === m
                        ? 'border-lime-600 bg-lime-700 text-white'
                        : 'border-stone-200 bg-stone-100 text-stone-900 hover:bg-stone-200'
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
                  className="w-full rounded-lg border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-stone-900 focus:border-lime-600 focus:bg-white focus:outline-none"
                  placeholder="직접 입력 (5~360분)"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-lime-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-lime-800"
                >
                  적용
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
