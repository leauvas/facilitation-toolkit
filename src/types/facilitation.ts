export type TabRoute = 'balance' | 'timer';

export type TableShape = 'rect' | 'circle';

export type BalanceMode = 'layout' | 'discuss';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'ended';

export type SpeakerBalanceState = 'unspoken' | 'speaking' | 'dominant' | 'balanced';

export interface Participant {
  id: string;
  name: string;
  x: number; // 0..100 percent of canvas width
  y: number; // 0..100 percent of canvas height
}

export interface FacilitatorSeat {
  x: number;
  y: number;
}

export interface TimelineEntry {
  turn: number;
  speakerId: string; // 'facilitator' or participant.id
  speaker: string; // '진행자' or participant.name
  startSec: number; // cumulative audio timeline seconds (2 decimals)
  endSec: number;
  durationSec: number;
  audioPart: number; // 1-based recording part index
  partStartSec: number; // offset within audioPart file (2 decimals)
  partEndSec: number;
}

export interface PausedRange {
  startedAt: string; // ISO timestamp
  endedAt: string; // ISO timestamp
  audioOffsetSec: number;
  reason: 'manual' | 'background';
}

export interface SessionRecord {
  id: string;
  sessionStartedAt: string; // ISO timestamp
  status: 'running' | 'paused' | 'completed';
  recordingEnabled: boolean;
  audioMimeType: string;
  totalDurationSec: number;
  participants: Participant[];
  timeline: TimelineEntry[];
  pausedRanges: PausedRange[];
  audioPartsCount: number;
}

export interface AudioPartBlob {
  part: number;
  mimeType: string;
  ext: string;
  blob: Blob;
}

export interface AudioChunkRecord {
  id?: number;
  sessionId: string;
  part: number;
  mimeType: string;
  seq: number;
  blob: Blob;
  createdAt: number;
}

export interface ParticipantStat {
  id: string;
  name: string;
  totalSec: number;
  turnCount: number;
  sharePct: number;
}

export interface BalanceSettings {
  participants: Participant[];
  facilitatorSeat: FacilitatorSeat;
  showFacilitatorSeat: boolean;
  tableShape: TableShape;
  recommendedTurnSec: number;
  goalMinutes: number;
}
