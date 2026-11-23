import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { playTimerChime } from '../lib/audioRecorder';

export type TimerSubMode = 'countdown' | 'clock';

interface TimerContextValue {
  subMode: TimerSubMode;
  durationSec: number;
  remainingSec: number;
  isRunning: boolean;
  isFinished: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  setSubMode: (mode: TimerSubMode) => void;
  setPresetDuration: (seconds: number) => void;
  startCountdown: () => void;
  pauseCountdown: () => void;
  resetCountdown: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subMode, setSubMode] = useState<TimerSubMode>('countdown');
  const [durationSec, setDurationSec] = useState<number>(300); // default 5 min
  const [remainingSec, setRemainingSec] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isInAppFullscreen, setIsInAppFullscreen] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);

  const endPerfMsRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    const handleFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsNativeFullscreen(active);
      if (!active) {
        setIsInAppFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInAppFullscreen && !document.fullscreenElement) {
        setIsInAppFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInAppFullscreen]);

  useEffect(() => {
    if (!isRunning) return;

    const id = window.setInterval(() => {
      const leftMs = endPerfMsRef.current - performance.now();
      if (leftMs <= 0) {
        setRemainingSec(0);
        setIsRunning(false);
        setIsFinished(true);
        if (!isMutedRef.current) {
          playTimerChime();
        }
      } else {
        setRemainingSec(Math.ceil(leftMs / 1000));
      }
    }, 100);

    return () => {
      window.clearInterval(id);
    };
  }, [isRunning]);

  const setPresetDuration = useCallback((seconds: number) => {
    const safe = Math.max(1, Math.min(36000, Math.round(seconds)));
    setIsRunning(false);
    setIsFinished(false);
    setDurationSec(safe);
    setRemainingSec(safe);
  }, []);

  const startCountdown = useCallback(() => {
    if (remainingSec <= 0) {
      endPerfMsRef.current = performance.now() + durationSec * 1000;
      setRemainingSec(durationSec);
    } else {
      endPerfMsRef.current = performance.now() + remainingSec * 1000;
    }
    setIsFinished(false);
    setIsRunning(true);
  }, [durationSec, remainingSec]);

  const pauseCountdown = useCallback(() => {
    if (!isRunning) return;
    const leftMs = Math.max(0, endPerfMsRef.current - performance.now());
    setRemainingSec(Math.ceil(leftMs / 1000));
    setIsRunning(false);
  }, [isRunning]);

  const resetCountdown = useCallback(() => {
    setIsRunning(false);
    setIsFinished(false);
    setRemainingSec(durationSec);
  }, [durationSec]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const exitFullscreen = useCallback(async () => {
    setIsInAppFullscreen(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore
      }
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const active = isNativeFullscreen || isInAppFullscreen;
    if (active) {
      await exitFullscreen();
      return;
    }

    const rootEl = document.documentElement;
    if (typeof rootEl.requestFullscreen === 'function') {
      try {
        await rootEl.requestFullscreen();
        setIsInAppFullscreen(true);
        return;
      } catch {
        // Fall back to in-app fullscreen (e.g. iOS Safari)
      }
    }
    setIsInAppFullscreen(true);
  }, [exitFullscreen, isInAppFullscreen, isNativeFullscreen]);

  const isFullscreen = isNativeFullscreen || isInAppFullscreen;

  const value: TimerContextValue = {
    subMode,
    durationSec,
    remainingSec,
    isRunning,
    isFinished,
    isMuted,
    isFullscreen,
    setSubMode,
    setPresetDuration,
    startCountdown,
    pauseCountdown,
    resetCountdown,
    toggleMute,
    toggleFullscreen,
    exitFullscreen,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used inside TimerProvider');
  }
  return ctx;
}
