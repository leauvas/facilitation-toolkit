import React, { useEffect, useState } from 'react';
import {
  Clock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTimer } from '../context/TimerContext';

const PRESETS = [
  { label: '3분', sec: 180 },
  { label: '5분', sec: 300 },
  { label: '10분', sec: 600 },
  { label: '15분', sec: 900 },
  { label: '20분', sec: 1200 },
];

const WEEKDAYS_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function formatCountdownDisplay(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TimerView: React.FC = () => {
  const {
    subMode,
    setSubMode,
    durationSec,
    remainingSec,
    isRunning,
    isFinished,
    isMuted,
    isFullscreen,
    setPresetDuration,
    startCountdown,
    pauseCountdown,
    resetCountdown,
    toggleMute,
    toggleFullscreen,
  } = useTimer();

  const [now, setNow] = useState<Date>(() => new Date());
  const [customMin, setCustomMin] = useState<string>('5');
  const [customSec, setCustomSec] = useState<string>('00');

  useEffect(() => {
    if (subMode !== 'clock') return;
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 250);
    return () => window.clearInterval(id);
  }, [subMode]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number.parseInt(customMin || '0', 10);
    const s = Number.parseInt(customSec || '0', 10);
    const total = (Number.isNaN(m) ? 0 : m) * 60 + (Number.isNaN(s) ? 0 : s);
    if (total > 0) {
      setPresetDuration(total);
    }
  };

  const progressPct =
    durationSec > 0 ? Math.max(0, Math.min(100, (remainingSec / durationSec) * 100)) : 0;
  const isLowWarning =
    subMode === 'countdown' &&
    !isFinished &&
    remainingSec > 0 &&
    remainingSec <= Math.min(30, durationSec * 0.15);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${
    WEEKDAYS_KO[now.getDay()] ?? ''
  }`;

  return (
    <main
      className={`relative flex flex-1 min-h-0 w-full flex-col items-center justify-center overflow-hidden bg-stone-100 ${
        isFullscreen ? 'p-2 sm:p-6' : 'p-2 sm:p-5 [@media(max-height:450px)]:p-1.5'
      }`}
    >
      {/* Top Sub-Mode & Fullscreen Controls */}
      <div
        className={`flex w-full max-w-4xl shrink-0 items-center justify-between gap-2 ${
          isFullscreen
            ? 'absolute left-1/2 top-3 z-20 -translate-x-1/2 px-4'
            : 'mb-2 sm:mb-4 [@media(max-height:450px)]:mb-1.5'
        }`}
      >
        {!isFullscreen ? (
          <div className="flex items-center rounded-full border border-stone-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setSubMode('countdown')}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                subMode === 'countdown'
                  ? 'bg-lime-700 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <TimerIcon className="h-3.5 w-3.5" />
              <span>카운트다운</span>
            </button>
            <button
              type="button"
              onClick={() => setSubMode('clock')}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                subMode === 'clock'
                  ? 'bg-lime-700 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>탁상시계</span>
            </button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5">
          {subMode === 'countdown' && (
            <button
              type="button"
              onClick={toggleMute}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                isMuted
                  ? 'border-stone-200 bg-stone-100 text-stone-600'
                  : 'border-stone-200 bg-white text-stone-900 hover:border-lime-600'
              }`}
              title="종료 차임벨 알림음 설정"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isMuted ? '음소거' : '알림음 ON'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-900 shadow-sm transition hover:border-lime-600"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>전체화면 종료</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>전체화면</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Classic Paper / Desk Clock Display Card */}
      <section
        className={`relative flex w-full flex-col items-center justify-between overflow-hidden rounded-3xl border shadow-sm transition-colors duration-300 ${
          isFullscreen
            ? 'h-full max-h-[82dvh] max-w-5xl p-5 sm:p-10'
            : 'flex-1 min-h-0 max-h-[520px] max-w-4xl p-4 sm:p-7 [@media(max-height:450px)]:p-3'
        } ${isFinished ? 'border-orange-500 bg-orange-50' : 'border-stone-200 bg-white'}`}
      >
        {subMode === 'countdown' ? (
          <>
            {/* Top Status Label & Presets */}
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    isFinished
                      ? 'bg-orange-600 text-white'
                      : isRunning
                        ? 'bg-lime-100/80 text-lime-800'
                        : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isFinished ? '시간 종료' : isRunning ? '진행 중' : '대기 중'}
                </span>
                <span className="text-xs font-semibold text-stone-600 tabular-nums">
                  설정: {formatCountdownDisplay(durationSec)}
                </span>
              </div>

              {!isFullscreen && (
                <div className="flex flex-wrap items-center gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.sec}
                      type="button"
                      onClick={() => setPresetDuration(p.sec)}
                      className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                        durationSec === p.sec
                          ? 'border-lime-600 bg-lime-700 text-white'
                          : 'border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Giant Classic Digital Face */}
            <div className="my-auto flex flex-col items-center justify-center py-1">
              <div
                className={`tabular-nums font-bold tracking-tight transition-colors ${
                  isFullscreen
                    ? 'text-[18vw] leading-none sm:text-[148px] md:text-[176px]'
                    : 'text-[15vw] leading-none sm:text-[112px] md:text-[136px] [@media(max-height:450px)]:text-[72px]'
                } ${
                  isFinished || isLowWarning ? 'text-orange-700' : 'text-stone-900'
                }`}
              >
                {formatCountdownDisplay(remainingSec)}
              </div>
            </div>

            {/* Controls & Custom Input */}
            <div className="w-full space-y-2.5 [@media(max-height:450px)]:space-y-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={isRunning ? pauseCountdown : startCountdown}
                  className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 sm:px-7 sm:py-2.5 sm:text-sm ${
                    isRunning
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-lime-700 hover:bg-lime-800'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause className="h-4 w-4" />
                      <span>일시정지</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      <span>{remainingSec < durationSec && remainingSec > 0 ? '계속하기' : '시작'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetCountdown}
                  className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>초기화</span>
                </button>

                {!isFullscreen && (
                  <form
                    onSubmit={handleApplyCustom}
                    className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1"
                  >
                    <input
                      type="number"
                      min={0}
                      max={599}
                      value={customMin}
                      onChange={(e) => setCustomMin(e.target.value)}
                      aria-label="분 입력"
                      className="w-10 bg-transparent text-center text-xs font-bold tabular-nums text-stone-900 focus:outline-none"
                    />
                    <span className="text-[11px] text-stone-600">분</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={customSec}
                      onChange={(e) => setCustomSec(e.target.value)}
                      aria-label="초 입력"
                      className="w-9 bg-transparent text-center text-xs font-bold tabular-nums text-stone-900 focus:outline-none"
                    />
                    <span className="text-[11px] text-stone-600">초</span>
                    <button
                      type="submit"
                      className="ml-1 rounded-full bg-lime-700 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-lime-800"
                    >
                      설정
                    </button>
                  </form>
                )}
              </div>

              {/* Bottom Remaining Progress Bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isFinished || isLowWarning ? 'bg-orange-600' : 'bg-lime-700'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          /* Classic Desk Clock Mode */
          <div className="my-auto flex w-full flex-col items-center justify-center text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-3.5 py-1 text-xs font-semibold text-stone-600 sm:text-sm">
              <Clock className="h-3.5 w-3.5 text-lime-800" />
              <span>{dateLabel}</span>
            </div>

            <div
              className={`tabular-nums font-bold tracking-tight text-stone-900 ${
                isFullscreen
                  ? 'text-[16vw] leading-none sm:text-[132px] md:text-[164px]'
                  : 'text-[15vw] leading-none sm:text-[104px] md:text-[128px] [@media(max-height:450px)]:text-[72px]'
              }`}
            >
              {hh}:{mm}
              <span className="text-lime-800">:{ss}</span>
            </div>

            <p className="mt-3 text-xs font-medium text-stone-600 sm:text-sm [@media(max-height:450px)]:mt-1.5">
              쉬는 시간 · 대기 안내용 탁상 전자시계
            </p>
          </div>
        )}
      </section>
    </main>
  );
};
