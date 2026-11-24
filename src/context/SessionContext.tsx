import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AudioPartBlob,
  BalanceMode,
  FacilitatorSeat,
  Participant,
  PausedRange,
  SessionRecord,
  SessionStatus,
  SpeakerBalanceState,
  TableShape,
  TimelineEntry,
} from '../types/facilitation';
import {
  createParticipant,
  loadBalanceSettings,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  redistributeWithFacilitator,
  saveBalanceSettings,
  snapPercent,
} from '../lib/layoutUtils';
import {
  getExtForMime,
  isMp4Mime,
  selectSupportedAudioMime,
  WakeKeepAlive,
} from '../lib/audioRecorder';
import {
  appendAudioChunk,
  deleteSessionData,
  getSessionAudioParts,
  getUnfinishedSession,
  saveSessionMeta,
} from '../lib/indexedDb';
import { round2 } from '../lib/exportUtils';

export interface LiveParticipantMetrics {
  totalSec: number;
  turnCount: number;
  sharePct: number;
  balanceState: SpeakerBalanceState;
  currentTurnElapsedSec: number;
}

export interface ResultModalPayload {
  record: SessionRecord;
  audioParts: AudioPartBlob[];
  isRecovered: boolean;
}

interface SessionEngineState {
  sessionId: string;
  sessionStartedAt: string;
  status: SessionStatus;
  isBackgroundPaused: boolean;
  recordingActive: boolean;
  audioMimeType: string;
  activeSpeakerId: string;
  activeSpeakerName: string;
  activeTurnNumber: number;
  elapsedAudioSec: number;
  partElapsedSec: number;
  currentAudioPart: number;
  activeTurnStartAudioSec: number;
  activeTurnStartPartSec: number;
  lastTickPerfMs: number;
  timeline: TimelineEntry[];
  pausedRanges: PausedRange[];
  activePauseStartIso: string | null;
  activePauseReason: 'manual' | 'background' | null;
  activePauseOffsetSec: number;
}

interface SessionContextValue {
  participants: Participant[];
  facilitatorSeat: FacilitatorSeat;
  showFacilitatorSeat: boolean;
  tableShape: TableShape;
  mode: BalanceMode;
  recommendedTurnSec: number;
  goalMinutes: number;
  recordingEnabled: boolean;
  sessionStatus: SessionStatus;
  activeSpeakerId: string;
  activeSpeakerName: string;
  elapsedAudioSec: number;
  currentTurnElapsedSec: number;
  facilitatorTotalSec: number;
  participantsTotalSec: number;
  canUndo: boolean;
  timeline: TimelineEntry[];
  participantMetrics: Record<string, LiveParticipantMetrics>;
  recoverableSession: SessionRecord | null;
  resultModal: ResultModalPayload | null;
  toastMessage: string | null;
  setMode: (mode: BalanceMode) => void;
  setTableShape: (shape: TableShape) => void;
  setShowFacilitatorSeat: (show: boolean) => void;
  setRecommendedTurnSec: (sec: number) => void;
  setGoalMinutes: (mins: number) => void;
  setRecordingEnabled: (enabled: boolean) => void;
  addParticipant: () => void;
  setParticipantCount: (count: number) => void;
  removeParticipant: (id: string) => void;
  renameParticipant: (id: string, name: string) => void;
  moveParticipant: (id: string, x: number, y: number) => void;
  moveFacilitatorSeat: (x: number, y: number) => void;
  resetLayout: () => void;
  startSession: () => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  selectSpeaker: (participantId: string) => void;
  switchToFacilitator: () => void;
  undoLastSwitch: () => void;
  endSession: () => Promise<void>;
  closeResultModal: () => void;
  recoverUnfinishedSession: () => Promise<void>;
  discardUnfinishedBackup: () => Promise<void>;
  showToast: (msg: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function createEmptyEngine(): SessionEngineState {
  return {
    sessionId: '',
    sessionStartedAt: '',
    status: 'idle',
    isBackgroundPaused: false,
    recordingActive: false,
    audioMimeType: '',
    activeSpeakerId: 'facilitator',
    activeSpeakerName: '진행자',
    activeTurnNumber: 1,
    elapsedAudioSec: 0,
    partElapsedSec: 0,
    currentAudioPart: 1,
    activeTurnStartAudioSec: 0,
    activeTurnStartPartSec: 0,
    lastTickPerfMs: 0,
    timeline: [],
    pausedRanges: [],
    activePauseStartIso: null,
    activePauseReason: null,
    activePauseOffsetSec: 0,
  };
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSettings = useMemo(() => loadBalanceSettings(), []);

  const [participants, setParticipants] = useState<Participant[]>(initialSettings.participants);
  const [facilitatorSeat, setFacilitatorSeat] = useState<FacilitatorSeat>(
    initialSettings.facilitatorSeat
  );
  const [showFacilitatorSeat, setShowFacilitatorSeat] = useState<boolean>(
    initialSettings.showFacilitatorSeat
  );
  const [tableShape, setTableShapeState] = useState<TableShape>(initialSettings.tableShape);
  const [recommendedTurnSec, setRecommendedTurnSecState] = useState<number>(
    initialSettings.recommendedTurnSec
  );
  const [goalMinutes, setGoalMinutesState] = useState<number>(initialSettings.goalMinutes);
  const [mode, setMode] = useState<BalanceMode>('discuss');
  const [recordingEnabled, setRecordingEnabledState] = useState<boolean>(false);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>('facilitator');
  const [activeSpeakerName, setActiveSpeakerName] = useState<string>('진행자');
  const [elapsedAudioSec, setElapsedAudioSec] = useState<number>(0);
  const [currentTurnElapsedSec, setCurrentTurnElapsedSec] = useState<number>(0);
  const [timelineSnapshot, setTimelineSnapshot] = useState<TimelineEntry[]>([]);

  const [recoverableSession, setRecoverableSession] = useState<SessionRecord | null>(null);
  const [resultModal, setResultModal] = useState<ResultModalPayload | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const participantsRef = useRef<Participant[]>(participants);
  participantsRef.current = participants;

  const engineRef = useRef<SessionEngineState>(createEmptyEngine());
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkSeqRef = useRef<number>(0);
  const recorderStopPromiseRef = useRef<Promise<void> | null>(null);
  const wakeKeepAliveRef = useRef<WakeKeepAlive>(new WakeKeepAlive());
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3400);
  }, []);

  // Persist layout & preferences to localStorage
  useEffect(() => {
    saveBalanceSettings({
      participants,
      facilitatorSeat,
      showFacilitatorSeat,
      tableShape,
      recommendedTurnSec,
      goalMinutes,
    });
  }, [participants, facilitatorSeat, showFacilitatorSeat, tableShape, recommendedTurnSec, goalMinutes]);

  // Check IndexedDB on mount for any interrupted/uncompleted session
  useEffect(() => {
    let mounted = true;
    void getUnfinishedSession().then((sess) => {
      if (mounted && sess) {
        setRecoverableSession(sess);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const syncEngineClock = useCallback(() => {
    const eng = engineRef.current;
    if (eng.status !== 'running' || eng.isBackgroundPaused) {
      return;
    }
    const now = performance.now();
    const deltaSec = Math.max(0, (now - eng.lastTickPerfMs) / 1000);
    eng.elapsedAudioSec += deltaSec;
    eng.partElapsedSec += deltaSec;
    eng.lastTickPerfMs = now;
  }, []);

  const syncUiFromEngine = useCallback(() => {
    const eng = engineRef.current;
    setSessionStatus(eng.status);
    setActiveSpeakerId(eng.activeSpeakerId);
    setActiveSpeakerName(eng.activeSpeakerName);
    setElapsedAudioSec(eng.elapsedAudioSec);
    setCurrentTurnElapsedSec(Math.max(0, eng.elapsedAudioSec - eng.activeTurnStartAudioSec));
    setTimelineSnapshot([...eng.timeline]);
  }, []);

  const buildSnapshotRecord = useCallback(
    (includeCurrentTurn: boolean, statusOverride?: 'running' | 'paused' | 'completed'): SessionRecord => {
      const eng = engineRef.current;
      const entries = [...eng.timeline];
      if (includeCurrentTurn && eng.status !== 'idle') {
        const startSec = round2(eng.activeTurnStartAudioSec);
        const endSec = round2(eng.elapsedAudioSec);
        const partStartSec = round2(eng.activeTurnStartPartSec);
        const partEndSec = round2(eng.partElapsedSec);
        if (endSec > startSec || entries.length === 0) {
          entries.push({
            turn: eng.activeTurnNumber,
            speakerId: eng.activeSpeakerId,
            speaker: eng.activeSpeakerName,
            startSec,
            endSec,
            durationSec: round2(Math.max(0, endSec - startSec)),
            audioPart: eng.currentAudioPart,
            partStartSec,
            partEndSec,
          });
        }
      }

      return {
        id: eng.sessionId,
        sessionStartedAt: eng.sessionStartedAt,
        status:
          statusOverride ??
          (eng.status === 'paused' ? 'paused' : eng.status === 'ended' ? 'completed' : 'running'),
        recordingEnabled: eng.recordingActive,
        audioMimeType: eng.audioMimeType,
        totalDurationSec: round2(eng.elapsedAudioSec),
        participants: participantsRef.current,
        timeline: entries,
        pausedRanges: [...eng.pausedRanges],
        audioPartsCount: eng.recordingActive ? eng.currentAudioPart : 0,
      };
    },
    []
  );

  const persistSnapshotToIdb = useCallback(
    (includeCurrentTurn: boolean, statusOverride?: 'running' | 'paused' | 'completed') => {
      const eng = engineRef.current;
      if (!eng.sessionId) return;
      const record = buildSnapshotRecord(includeCurrentTurn, statusOverride);
      void saveSessionMeta(record).catch(() => {
        // Ignore transient IDB write errors
      });
    },
    [buildSnapshotRecord]
  );

  const startRecorderForPart = useCallback((stream: MediaStream, mimeType: string, part: number) => {
    const eng = engineRef.current;
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
    const recorder = new MediaRecorder(stream, options);
    const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';
    eng.audioMimeType = effectiveMime;

    let resolveStop!: () => void;
    recorderStopPromiseRef.current = new Promise<void>((res) => {
      resolveStop = res;
    });

    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0 && eng.sessionId) {
        const seq = chunkSeqRef.current++;
        void appendAudioChunk({
          sessionId: eng.sessionId,
          part,
          mimeType: effectiveMime,
          seq,
          blob: ev.data,
          createdAt: Date.now(),
        }).catch(() => {
          // Ignore chunk write errors
        });
      }
    };

    recorder.onstop = () => {
      resolveStop();
    };

    recorder.onerror = () => {
      resolveStop();
    };

    recorderRef.current = recorder;
    recorder.start(1000);
  }, []);

  const stopCurrentRecorder = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state !== 'inactive') {
      const stopPromise = recorderStopPromiseRef.current;
      try {
        recorder.stop();
      } catch {
        // Ignore if already stopped
      }
      if (stopPromise) {
        await Promise.race([
          stopPromise,
          new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
        ]);
      }
    }
    recorderRef.current = null;
  }, []);

  const closeCurrentTurnAndSwitch = useCallback(
    (nextSpeakerId: string, nextSpeakerName: string) => {
      const eng = engineRef.current;
      const startSec = round2(eng.activeTurnStartAudioSec);
      const endSec = round2(eng.elapsedAudioSec);
      const durationSec = round2(Math.max(0, endSec - startSec));
      const partStartSec = round2(eng.activeTurnStartPartSec);
      const partEndSec = round2(eng.partElapsedSec);

      eng.timeline.push({
        turn: eng.activeTurnNumber,
        speakerId: eng.activeSpeakerId,
        speaker: eng.activeSpeakerName,
        startSec,
        endSec,
        durationSec,
        audioPart: eng.currentAudioPart,
        partStartSec,
        partEndSec,
      });

      eng.activeTurnNumber += 1;
      eng.activeSpeakerId = nextSpeakerId;
      eng.activeSpeakerName = nextSpeakerName;
      eng.activeTurnStartAudioSec = eng.elapsedAudioSec;
      eng.activeTurnStartPartSec = eng.partElapsedSec;
    },
    []
  );

  // High-frequency tick while running + periodic IDB backup every 5s
  useEffect(() => {
    if (sessionStatus !== 'running') return;

    let backupCounter = 0;
    const intervalId = window.setInterval(() => {
      syncEngineClock();
      syncUiFromEngine();
      backupCounter += 1;
      if (backupCounter >= 50) {
        backupCounter = 0;
        persistSnapshotToIdb(true);
      }
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [sessionStatus, syncEngineClock, syncUiFromEngine, persistSnapshotToIdb]);

  // Safari / background visibility defense & MP4 part splitting
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const eng = engineRef.current;
      if (eng.status !== 'running') return;

      if (document.visibilityState === 'hidden') {
        if (eng.isBackgroundPaused) return;
        syncEngineClock();
        eng.isBackgroundPaused = true;
        eng.activePauseStartIso = new Date().toISOString();
        eng.activePauseReason = 'background';
        eng.activePauseOffsetSec = eng.elapsedAudioSec;

        if (eng.recordingActive && recorderRef.current) {
          if (isMp4Mime(eng.audioMimeType)) {
            // Split turn cleanly at part boundary so part1.m4a and timeline match 1:1
            closeCurrentTurnAndSwitch(eng.activeSpeakerId, eng.activeSpeakerName);
            await stopCurrentRecorder();
          } else if (recorderRef.current.state === 'recording') {
            try {
              recorderRef.current.pause();
            } catch {
              // Ignore pause failure
            }
          }
        }
        persistSnapshotToIdb(true);
      } else if (document.visibilityState === 'visible') {
        if (!eng.isBackgroundPaused) return;
        if (eng.activePauseStartIso) {
          eng.pausedRanges.push({
            startedAt: eng.activePauseStartIso,
            endedAt: new Date().toISOString(),
            audioOffsetSec: round2(eng.activePauseOffsetSec),
            reason: eng.activePauseReason ?? 'background',
          });
          eng.activePauseStartIso = null;
          eng.activePauseReason = null;
        }

        eng.isBackgroundPaused = false;
        eng.lastTickPerfMs = performance.now();
        void wakeKeepAliveRef.current.resume();

        if (eng.recordingActive) {
          const rec = recorderRef.current;
          if (rec && rec.state === 'paused') {
            try {
              rec.resume();
            } catch {
              // Fallback to new part if resume fails
            }
          } else if (!rec || rec.state === 'inactive') {
            // Ensure previous turn is closed before incrementing part if it wasn't already closed on hide
            if (eng.elapsedAudioSec > eng.activeTurnStartAudioSec) {
              closeCurrentTurnAndSwitch(eng.activeSpeakerId, eng.activeSpeakerName);
            }
            eng.currentAudioPart += 1;
            eng.partElapsedSec = 0;
            eng.activeTurnStartPartSec = 0;

            let stream = streamRef.current;
            const hasLiveTrack = stream?.getAudioTracks().some((t) => t.readyState === 'live');
            if (!hasLiveTrack && navigator.mediaDevices?.getUserMedia) {
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
              } catch {
                eng.recordingActive = false;
                setRecordingEnabledState(false);
                showToast('백그라운드 복귀 중 마이크 재연결에 실패해 녹음 없이 이어서 기록합니다.');
              }
            }
            if (stream && eng.recordingActive) {
              startRecorderForPart(stream, eng.audioMimeType, eng.currentAudioPart);
            }
          }
        }

        syncUiFromEngine();
        persistSnapshotToIdb(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    closeCurrentTurnAndSwitch,
    persistSnapshotToIdb,
    showToast,
    startRecorderForPart,
    stopCurrentRecorder,
    syncEngineClock,
    syncUiFromEngine,
  ]);

  const setTableShape = useCallback(
    (shape: TableShape) => {
      setTableShapeState(shape);
      const next = redistributeWithFacilitator(
        participantsRef.current,
        shape,
        showFacilitatorSeat
      );
      setParticipants(next.participants);
      setFacilitatorSeat(next.facilitatorSeat);
    },
    [showFacilitatorSeat]
  );

  const setRecommendedTurnSec = useCallback((sec: number) => {
    setRecommendedTurnSecState(Math.max(30, sec));
  }, []);

  const setGoalMinutes = useCallback((mins: number) => {
    setGoalMinutesState(Math.max(5, Math.min(360, mins)));
  }, []);

  const setRecordingEnabled = useCallback(
    (enabled: boolean) => {
      if (engineRef.current.status === 'running' || engineRef.current.status === 'paused') {
        showToast('세션 진행 중에는 녹음 설정을 변경할 수 없습니다.');
        return;
      }
      setRecordingEnabledState(enabled);
    },
    [showToast]
  );

  const addParticipant = useCallback(() => {
    setParticipants((prev) => {
      if (prev.length >= MAX_PARTICIPANTS) {
        showToast(`참여자는 최대 ${MAX_PARTICIPANTS}명까지 추가할 수 있습니다.`);
        return prev;
      }
      return [...prev, createParticipant(prev, tableShape, facilitatorSeat, showFacilitatorSeat)];
    });
  }, [facilitatorSeat, showFacilitatorSeat, showToast, tableShape]);

  const setParticipantCount = useCallback(
    (targetCount: number) => {
      const clamped = Math.max(MIN_PARTICIPANTS, Math.min(MAX_PARTICIPANTS, Math.round(targetCount)));
      const current = participantsRef.current;
      const isLive =
        engineRef.current.status === 'running' || engineRef.current.status === 'paused';

      if (isLive && clamped < current.length) {
        showToast('세션 진행 중에는 참여자 수를 줄일 수 없습니다.');
        return;
      }

      if (clamped === current.length) return;

      if (clamped > current.length) {
        const nextList = [...current];
        while (nextList.length < clamped) {
          nextList.push(
            createParticipant(nextList, tableShape, facilitatorSeat, showFacilitatorSeat)
          );
        }
        if (isLive) {
          setParticipants(nextList);
        } else {
          const redistributed = redistributeWithFacilitator(
            nextList,
            tableShape,
            showFacilitatorSeat
          );
          setParticipants(redistributed.participants);
          setFacilitatorSeat(redistributed.facilitatorSeat);
        }
      } else {
        const sliced = current.slice(0, clamped);
        const redistributed = redistributeWithFacilitator(
          sliced,
          tableShape,
          showFacilitatorSeat
        );
        setParticipants(redistributed.participants);
        setFacilitatorSeat(redistributed.facilitatorSeat);
      }
    },
    [facilitatorSeat, showFacilitatorSeat, showToast, tableShape]
  );

  const removeParticipant = useCallback(
    (id: string) => {
      if (engineRef.current.status === 'running' || engineRef.current.status === 'paused') {
        showToast('세션 진행 중에는 참여자를 삭제할 수 없습니다.');
        return;
      }
      setParticipants((prev) => {
        if (prev.length <= MIN_PARTICIPANTS) {
          showToast(`참여자는 최소 ${MIN_PARTICIPANTS}명 이상이어야 합니다.`);
          return prev;
        }
        return prev.filter((p) => p.id !== id);
      });
    },
    [showToast]
  );

  const renameParticipant = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: trimmed || p.name } : p))
    );
    if (trimmed && engineRef.current.activeSpeakerId === id) {
      engineRef.current.activeSpeakerName = trimmed;
      setActiveSpeakerName(trimmed);
    }
  }, []);

  const moveParticipant = useCallback((id: string, x: number, y: number) => {
    const snappedX = snapPercent(x, 8, 92);
    const snappedY = snapPercent(y, 10, 90);
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x: snappedX, y: snappedY } : p))
    );
  }, []);

  const moveFacilitatorSeat = useCallback((x: number, y: number) => {
    const snappedX = snapPercent(x, 8, 92);
    const snappedY = snapPercent(y, 10, 90);
    setFacilitatorSeat({ x: snappedX, y: snappedY });
  }, []);

  const resetLayout = useCallback(() => {
    const next = redistributeWithFacilitator(
      participantsRef.current,
      tableShape,
      showFacilitatorSeat
    );
    setParticipants(next.participants);
    setFacilitatorSeat(next.facilitatorSeat);
    showToast('좌석 배치를 기본 위치로 정리했습니다.');
  }, [showFacilitatorSeat, showToast, tableShape]);

  const startSession = useCallback(async () => {
    if (engineRef.current.status === 'running' || engineRef.current.status === 'paused') {
      return;
    }

    let wantsRecording = recordingEnabled;
    let stream: MediaStream | null = null;
    let selectedMime = '';

    if (wantsRecording) {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        wantsRecording = false;
        setRecordingEnabledState(false);
        showToast('현재 브라우저에서 녹음을 지원하지 않아 발언 기록만 시작합니다.');
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          selectedMime = selectSupportedAudioMime();
        } catch {
          wantsRecording = false;
          setRecordingEnabledState(false);
          showToast('마이크 권한이 거부되어 녹음 OFF 상태로 발언 기록을 시작합니다.');
        }
      }
    }

    const nowIso = new Date().toISOString();
    const sessionId = `sess_${Date.now()}`;
    chunkSeqRef.current = 0;

    engineRef.current = {
      sessionId,
      sessionStartedAt: nowIso,
      status: 'running',
      isBackgroundPaused: false,
      recordingActive: wantsRecording,
      audioMimeType: selectedMime,
      activeSpeakerId: 'facilitator',
      activeSpeakerName: '진행자',
      activeTurnNumber: 1,
      elapsedAudioSec: 0,
      partElapsedSec: 0,
      currentAudioPart: 1,
      activeTurnStartAudioSec: 0,
      activeTurnStartPartSec: 0,
      lastTickPerfMs: performance.now(),
      timeline: [],
      pausedRanges: [],
      activePauseStartIso: null,
      activePauseReason: null,
      activePauseOffsetSec: 0,
    };

    if (wantsRecording && stream) {
      streamRef.current = stream;
      try {
        startRecorderForPart(stream, selectedMime, 1);
      } catch {
        engineRef.current.recordingActive = false;
        setRecordingEnabledState(false);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        showToast('녹음 초기화에 실패해 발언 기록만 진행합니다.');
      }
    }

    setMode('discuss');
    void wakeKeepAliveRef.current.start();
    syncUiFromEngine();
    persistSnapshotToIdb(false, 'running');
  }, [persistSnapshotToIdb, recordingEnabled, showToast, startRecorderForPart, syncUiFromEngine]);

  const pauseSession = useCallback(() => {
    const eng = engineRef.current;
    if (eng.status !== 'running') return;

    syncEngineClock();
    eng.status = 'paused';
    eng.activePauseStartIso = new Date().toISOString();
    eng.activePauseReason = 'manual';
    eng.activePauseOffsetSec = eng.elapsedAudioSec;

    if (eng.recordingActive && recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.pause();
      } catch {
        // Ignore pause errors
      }
    }

    syncUiFromEngine();
    persistSnapshotToIdb(true, 'paused');
  }, [persistSnapshotToIdb, syncEngineClock, syncUiFromEngine]);

  const resumeSession = useCallback(() => {
    const eng = engineRef.current;
    if (eng.status !== 'paused') return;

    if (eng.activePauseStartIso) {
      eng.pausedRanges.push({
        startedAt: eng.activePauseStartIso,
        endedAt: new Date().toISOString(),
        audioOffsetSec: round2(eng.activePauseOffsetSec),
        reason: eng.activePauseReason ?? 'manual',
      });
      eng.activePauseStartIso = null;
      eng.activePauseReason = null;
    }

    eng.status = 'running';
    eng.lastTickPerfMs = performance.now();
    void wakeKeepAliveRef.current.resume();

    if (eng.recordingActive && recorderRef.current && recorderRef.current.state === 'paused') {
      try {
        recorderRef.current.resume();
      } catch {
        // Ignore resume errors
      }
    }

    syncUiFromEngine();
    persistSnapshotToIdb(true, 'running');
  }, [persistSnapshotToIdb, syncUiFromEngine]);

  const selectSpeaker = useCallback(
    (participantId: string) => {
      const eng = engineRef.current;
      if (eng.status === 'idle') {
        showToast('상단의 [시작] 버튼을 눌러 세션을 시작해 주세요.');
        return;
      }
      if (eng.status === 'paused') {
        showToast('일시정지 상태입니다. [재개] 후 화자를 전환해 주세요.');
        return;
      }
      if (eng.status !== 'running') return;

      syncEngineClock();

      if (eng.activeSpeakerId === participantId) {
        closeCurrentTurnAndSwitch('facilitator', '진행자');
      } else {
        const target = participantsRef.current.find((p) => p.id === participantId);
        if (!target) return;
        closeCurrentTurnAndSwitch(target.id, target.name);
      }

      syncUiFromEngine();
      persistSnapshotToIdb(true);
    },
    [closeCurrentTurnAndSwitch, persistSnapshotToIdb, showToast, syncEngineClock, syncUiFromEngine]
  );

  const switchToFacilitator = useCallback(() => {
    const eng = engineRef.current;
    if (eng.status === 'idle') {
      showToast('상단의 [시작] 버튼을 눌러 세션을 시작해 주세요.');
      return;
    }
    if (eng.status === 'paused') {
      showToast('일시정지 상태입니다. [재개] 후 전환해 주세요.');
      return;
    }
    if (eng.status !== 'running') return;
    if (eng.activeSpeakerId === 'facilitator') return;

    syncEngineClock();
    closeCurrentTurnAndSwitch('facilitator', '진행자');
    syncUiFromEngine();
    persistSnapshotToIdb(true);
  }, [closeCurrentTurnAndSwitch, persistSnapshotToIdb, showToast, syncEngineClock, syncUiFromEngine]);

  const undoLastSwitch = useCallback(() => {
    const eng = engineRef.current;
    if (eng.status !== 'running' && eng.status !== 'paused') return;
    if (eng.timeline.length === 0) return;

    syncEngineClock();
    const prev = eng.timeline[eng.timeline.length - 1];
    if (!prev) return;
    if (prev.audioPart !== eng.currentAudioPart) {
      showToast('이전 녹음 파트 구간은 실행 취소할 수 없습니다.');
      return;
    }

    eng.timeline.pop();
    eng.activeTurnNumber = prev.turn;
    eng.activeSpeakerId = prev.speakerId;
    eng.activeSpeakerName = prev.speaker;
    eng.activeTurnStartAudioSec = prev.startSec;
    eng.activeTurnStartPartSec = prev.partStartSec;

    syncUiFromEngine();
    persistSnapshotToIdb(true);
    showToast(`직전 전환을 취소하고 '${prev.speaker}' 구간으로 병합했습니다.`);
  }, [persistSnapshotToIdb, showToast, syncEngineClock, syncUiFromEngine]);

  const endSession = useCallback(async () => {
    const eng = engineRef.current;
    if (eng.status !== 'running' && eng.status !== 'paused') return;

    syncEngineClock();

    if (eng.activePauseStartIso) {
      eng.pausedRanges.push({
        startedAt: eng.activePauseStartIso,
        endedAt: new Date().toISOString(),
        audioOffsetSec: round2(eng.activePauseOffsetSec),
        reason: eng.activePauseReason ?? 'manual',
      });
      eng.activePauseStartIso = null;
      eng.activePauseReason = null;
    }

    closeCurrentTurnAndSwitch('facilitator', '진행자');
    eng.status = 'ended';

    if (eng.recordingActive) {
      await stopCurrentRecorder();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    await wakeKeepAliveRef.current.stop();

    const finalRecord = buildSnapshotRecord(false, 'completed');
    try {
      await saveSessionMeta(finalRecord);
    } catch {
      // Ignore IDB save failure on finish
    }

    let audioParts: AudioPartBlob[] = [];
    if (finalRecord.recordingEnabled) {
      audioParts = await getSessionAudioParts(finalRecord.id, finalRecord.audioMimeType);
      if (audioParts.length > 0 && !finalRecord.audioMimeType) {
        finalRecord.audioMimeType = audioParts[0].mimeType;
      }
    }

    setResultModal({
      record: finalRecord,
      audioParts,
      isRecovered: false,
    });
    setRecoverableSession(null);

    engineRef.current = createEmptyEngine();
    syncUiFromEngine();
  }, [
    buildSnapshotRecord,
    closeCurrentTurnAndSwitch,
    stopCurrentRecorder,
    syncEngineClock,
    syncUiFromEngine,
  ]);

  const closeResultModal = useCallback(() => {
    setResultModal(null);
  }, []);

  const recoverUnfinishedSession = useCallback(async () => {
    if (!recoverableSession) return;
    const record: SessionRecord = {
      ...recoverableSession,
      status: 'completed',
    };
    const audioParts = recoverableSession.recordingEnabled
      ? await getSessionAudioParts(recoverableSession.id, recoverableSession.audioMimeType)
      : [];
    // Ensure extension consistency if needed
    const normalizedParts = audioParts.map((part) => ({
      ...part,
      ext: getExtForMime(part.mimeType),
    }));
    await saveSessionMeta(record).catch(() => {});
    setResultModal({
      record,
      audioParts: normalizedParts,
      isRecovered: true,
    });
    setRecoverableSession(null);
  }, [recoverableSession]);

  const discardUnfinishedBackup = useCallback(async () => {
    if (!recoverableSession) return;
    await deleteSessionData(recoverableSession.id);
    setRecoverableSession(null);
    showToast('이전 세션 백업 데이터를 삭제했습니다.');
  }, [recoverableSession, showToast]);

  // Compute live participant metrics & 4-stage balance color classification
  const { participantMetrics, facilitatorTotalSec, participantsTotalSec } = useMemo(() => {
    const totals = new Map<string, number>();
    const turns = new Map<string, number>();
    let facTotal = 0;

    for (const entry of timelineSnapshot) {
      if (entry.speakerId === 'facilitator') {
        facTotal += entry.durationSec;
      } else {
        totals.set(entry.speakerId, (totals.get(entry.speakerId) ?? 0) + entry.durationSec);
        turns.set(entry.speakerId, (turns.get(entry.speakerId) ?? 0) + 1);
      }
    }

    if (sessionStatus === 'running' || sessionStatus === 'paused') {
      if (activeSpeakerId === 'facilitator') {
        facTotal += currentTurnElapsedSec;
      } else {
        totals.set(activeSpeakerId, (totals.get(activeSpeakerId) ?? 0) + currentTurnElapsedSec);
        turns.set(activeSpeakerId, (turns.get(activeSpeakerId) ?? 0) + 1);
      }
    }

    let pSum = 0;
    for (const p of participants) {
      pSum += totals.get(p.id) ?? 0;
    }

    const equalSharePct = participants.length > 0 ? 100 / participants.length : 100;
    const metrics: Record<string, LiveParticipantMetrics> = {};

    for (const p of participants) {
      const totalSec = totals.get(p.id) ?? 0;
      const turnCount = turns.get(p.id) ?? 0;
      const sharePct = pSum > 0 ? (totalSec / pSum) * 100 : 0;
      const isSpeaking =
        (sessionStatus === 'running' || sessionStatus === 'paused') && activeSpeakerId === p.id;

      let balanceState: SpeakerBalanceState;
      if (isSpeaking) {
        balanceState = 'speaking';
      } else if (totalSec <= 0) {
        balanceState = 'unspoken';
      } else if (pSum >= 60 && sharePct > equalSharePct * 1.5) {
        balanceState = 'dominant';
      } else {
        balanceState = 'balanced';
      }

      metrics[p.id] = {
        totalSec,
        turnCount,
        sharePct,
        balanceState,
        currentTurnElapsedSec: isSpeaking ? currentTurnElapsedSec : 0,
      };
    }

    return {
      participantMetrics: metrics,
      facilitatorTotalSec: facTotal,
      participantsTotalSec: pSum,
    };
  }, [activeSpeakerId, currentTurnElapsedSec, participants, sessionStatus, timelineSnapshot]);

  const canUndo =
    (sessionStatus === 'running' || sessionStatus === 'paused') &&
    timelineSnapshot.length > 0 &&
    timelineSnapshot[timelineSnapshot.length - 1]?.audioPart === engineRef.current.currentAudioPart;

  const value: SessionContextValue = {
    participants,
    facilitatorSeat,
    showFacilitatorSeat,
    tableShape,
    mode,
    recommendedTurnSec,
    goalMinutes,
    recordingEnabled,
    sessionStatus,
    activeSpeakerId,
    activeSpeakerName,
    elapsedAudioSec,
    currentTurnElapsedSec,
    facilitatorTotalSec,
    participantsTotalSec,
    canUndo,
    timeline: timelineSnapshot,
    participantMetrics,
    recoverableSession,
    resultModal,
    toastMessage,
    setMode,
    setTableShape,
    setShowFacilitatorSeat,
    setRecommendedTurnSec,
    setGoalMinutes,
    setRecordingEnabled,
    addParticipant,
    setParticipantCount,
    removeParticipant,
    renameParticipant,
    moveParticipant,
    moveFacilitatorSeat,
    resetLayout,
    startSession,
    pauseSession,
    resumeSession,
    selectSpeaker,
    switchToFacilitator,
    undoLastSwitch,
    endSession,
    closeResultModal,
    recoverUnfinishedSession,
    discardUnfinishedBackup,
    showToast,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return ctx;
}
