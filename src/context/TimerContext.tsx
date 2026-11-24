import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  playSound,
  SOUND_OPTIONS,
  SoundId,
  stopSound,
  unlockAudio,
} from '../lib/soundEngine';

export type TimerSubMode = 'countdown' | 'clock';

const SOUND_STORAGE_KEY = 'allvoices_timer_sound_v1';

function loadSavedSoundId(): SoundId {
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved && SOUND_OPTIONS.some((s) => s.id === saved)) {
      return saved as SoundId;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'crystal_bowl';
}

interface TimerContextValue {
  subMode: TimerSubMode;
  durationSec: number;
  remainingSec: number;
  isRunning: boolean;
  isFinished: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  selectedSoundId: SoundId;
  isPreviewing: boolean;
  setSubMode: (mode: TimerSubMode) => void;
  setPresetDuration: (seconds: number) => void;
  setSelectedSoundId: (id: SoundId) => void;
  startCountdown: () => void;
  pauseCountdown: () => void;
  resetCountdown: () => void;
  toggleMute: () => void;
  togglePreview: () => void;
  stopPreview: () => void;
  toggleFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subMode, setSubMode] = useState<TimerSubMode>('countdown');
  const [durationSec, setDurationSec] = useState<number>(300);
  const [remainingSec, setRemainingSec] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedSoundId, setSelectedSoundIdState] = useState<SoundId>(loadSavedSoundId);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isInAppFullscreen, setIsInAppFullscreen] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);

  const endPerfMsRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;
  const selectedSoundRef = useRef<SoundId>(selectedSoundId);
  selectedSoundRef.current = selectedSoundId;

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
          setIsPreviewing(false);
          playSound(selectedSoundRef.current);
        }
      } else {
        setRemainingSec(Math.ceil(leftMs / 1000));
      }
    }, 100);

    return () => {
      window.clearInterval(id);
    };
  }, [isRunning]);

  const stopPreview = useCallback(() => {
    stopSound();
    setIsPreviewing(false);
  }, []);

  const setSelectedSoundId = useCallback(
    (id: SoundId) => {
      setSelectedSoundIdState(id);
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, id);
      } catch {
        // Ignore
      }
      if (isPreviewing) {
        stopSound();
        setIsPreviewing(false);
      }
    },
    [isPreviewing]
  );

  const togglePreview = useCallback(() => {
    if (isPreviewing) {
      stopSound();
      setIsPreviewing(false);
      return;
    }
    unlockAudio();
    setIsPreviewing(true);
    playSound(selectedSoundRef.current, () => {
      setIsPreviewing(false);
    });
  }, [isPreviewing]);

  const setPresetDuration = useCallback((seconds: number) => {
    const safe = Math.max(1, Math.min(36000, Math.round(seconds)));
    setIsRunning(false);
    setIsFinished(false);
    setDurationSec(safe);
    setRemainingSec(safe);
  }, []);

  const startCountdown = useCallback(() => {
    unlockAudio();
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
    stopSound();
    setIsPreviewing(false);
    setIsRunning(false);
    setIsFinished(false);
    setRemainingSec(durationSec);
  }, [durationSec]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopSound();
        setIsPreviewing(false);
      }
      return next;
    });
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
    selectedSoundId,
    isPreviewing,
    setSubMode,
    setPresetDuration,
    setSelectedSoundId,
    startCountdown,
    pauseCountdown,
    resetCountdown,
    toggleMute,
    togglePreview,
    stopPreview,
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
