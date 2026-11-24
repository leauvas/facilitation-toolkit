export type SoundId =
  | 'crystal_bowl'
  | 'school_bell'
  | 'warm_marimba'
  | 'wood_triplets'
  | 'classic_alarm';

export interface SoundOption {
  id: SoundId;
  label: string;
  durationSec: number;
}

export const SOUND_OPTIONS: SoundOption[] = [
  { id: 'crystal_bowl', label: '맑은 크리스탈 싱잉볼', durationSec: 4.8 },
  { id: 'school_bell', label: '학교 종소리', durationSec: 4.8 },
  { id: 'warm_marimba', label: '웜 마림바 2단 아치', durationSec: 4.8 },
  { id: 'wood_triplets', label: '우드 마림바 3연음', durationSec: 2.4 },
  { id: 'classic_alarm', label: '클래식 탁상 알람시계', durationSec: 3.0 },
];

let sharedCtx: AudioContext | null = null;
let reverbBuffer: AudioBuffer | null = null;
let activeMasterGain: GainNode | null = null;
let activeNodes: AudioScheduledSourceNode[] = [];
let activeEndTimer: number | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtx();
    reverbBuffer = null;
  }
  return sharedCtx;
}

function getStereoHallImpulse(ctx: AudioContext): AudioBuffer {
  if (reverbBuffer && reverbBuffer.sampleRate === ctx.sampleRate) {
    return reverbBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 1.8);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = Math.pow(1 - t, 2.8);
      const white = Math.random() * 2 - 1;
      // Gentle low-pass smoothing for warm acoustic hall tail
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp * decay;
    }
  }

  reverbBuffer = buffer;
  return buffer;
}

export function unlockAudio(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    // Play silent 1-sample buffer to unlock iOS Safari audio session
    const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // Ignore unlock errors
  }
}

export function stopSound(): void {
  if (activeEndTimer !== null) {
    window.clearTimeout(activeEndTimer);
    activeEndTimer = null;
  }

  const ctx = sharedCtx;
  if (ctx && activeMasterGain) {
    try {
      const now = ctx.currentTime;
      activeMasterGain.gain.cancelScheduledValues(now);
      activeMasterGain.gain.setValueAtTime(activeMasterGain.gain.value, now);
      activeMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
    } catch {
      // Ignore
    }
  }

  const nodesToStop = activeNodes;
  activeNodes = [];
  window.setTimeout(() => {
    for (const node of nodesToStop) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
  }, 50);

  activeMasterGain = null;
}

function scheduleTone(
  ctx: AudioContext,
  dryDest: AudioNode,
  wetDest: AudioNode | null,
  startTime: number,
  duration: number,
  freq: number,
  peakGain: number,
  type: OscillatorType = 'sine',
  attack = 0.01,
  wetRatio = 0.32
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(env);
  env.connect(dryDest);
  if (wetDest && wetRatio > 0) {
    const send = ctx.createGain();
    send.gain.value = wetRatio;
    env.connect(send);
    send.connect(wetDest);
  }

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
  activeNodes.push(osc);
}

export function playSound(soundId: SoundId, onEnded?: () => void): void {
  stopSound();

  const ctx = getAudioContext();
  if (!ctx) {
    onEnded?.();
    return;
  }

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime + 0.02;

  // Mastering chain: Dry + Stereo Hall Reverb -> DynamicsCompressor -> MasterGain -> Destination
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, now);
  compressor.knee.setValueAtTime(18, now);
  compressor.ratio.setValueAtTime(4, now);
  compressor.attack.setValueAtTime(0.003, now);
  compressor.release.setValueAtTime(0.22, now);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, now);
  compressor.connect(master);
  master.connect(ctx.destination);
  activeMasterGain = master;

  const convolver = ctx.createConvolver();
  convolver.buffer = getStereoHallImpulse(ctx);
  const wetGain = ctx.createGain();
  wetGain.gain.setValueAtTime(0.42, now);
  convolver.connect(wetGain);
  wetGain.connect(compressor);

  const option = SOUND_OPTIONS.find((s) => s.id === soundId) ?? SOUND_OPTIONS[0];

  if (soundId === 'crystal_bowl') {
    // Strike 1 (0.0s) + Strike 2 bright variation (2.3s), 4.8s total
    const strike1 = now;
    scheduleTone(ctx, compressor, convolver, strike1, 2.5, 528, 0.34, 'sine', 0.018, 0.45);
    scheduleTone(ctx, compressor, convolver, strike1, 2.1, 1056, 0.14, 'sine', 0.012, 0.48);
    scheduleTone(ctx, compressor, convolver, strike1, 1.7, 1584, 0.07, 'sine', 0.01, 0.5);
    scheduleTone(ctx, compressor, convolver, strike1, 1.2, 2640, 0.03, 'sine', 0.008, 0.55);

    const strike2 = now + 2.3;
    scheduleTone(ctx, compressor, convolver, strike2, 2.5, 528, 0.3, 'sine', 0.018, 0.48);
    scheduleTone(ctx, compressor, convolver, strike2, 2.3, 529.6, 0.1, 'sine', 0.02, 0.48);
    scheduleTone(ctx, compressor, convolver, strike2, 2.2, 1056, 0.15, 'sine', 0.012, 0.52);
    scheduleTone(ctx, compressor, convolver, strike2, 1.8, 1584, 0.085, 'sine', 0.01, 0.55);
    scheduleTone(ctx, compressor, convolver, strike2, 1.4, 2640, 0.042, 'sine', 0.008, 0.6);
  } else if (soundId === 'school_bell') {
    // Westminster 2-phrase variation (4.8s)
    const p1 = [
      { t: 0.0, f: 659.25 }, // E5
      { t: 0.5, f: 523.25 }, // C5
      { t: 1.0, f: 587.33 }, // D5
      { t: 1.5, f: 392.0 }, // G4
    ];
    for (const n of p1) {
      const t = now + n.t;
      scheduleTone(ctx, compressor, convolver, t, 0.85, n.f, 0.26, 'sine', 0.008, 0.38);
      scheduleTone(ctx, compressor, convolver, t, 0.5, n.f * 2, 0.08, 'sine', 0.005, 0.4);
      scheduleTone(ctx, compressor, convolver, t, 0.3, n.f * 3, 0.025, 'sine', 0.004, 0.42);
    }

    const p2 = [
      { t: 2.35, f: 392.0, d: 0.8 }, // G4
      { t: 2.85, f: 587.33, d: 0.8 }, // D5
      { t: 3.35, f: 659.25, d: 0.8 }, // E5
      { t: 3.85, f: 523.25, d: 1.0 }, // C5
    ];
    p2.forEach((n, idx) => {
      const t = now + n.t;
      scheduleTone(ctx, compressor, convolver, t, n.d, n.f, 0.27, 'sine', 0.008, 0.42);
      scheduleTone(ctx, compressor, convolver, t, n.d * 0.6, n.f * 2, 0.085, 'sine', 0.005, 0.44);
      if (idx === p2.length - 1) {
        scheduleTone(ctx, compressor, convolver, t, 1.0, 1046.5, 0.11, 'sine', 0.01, 0.5);
      }
    });
  } else if (soundId === 'warm_marimba') {
    // 2-phrase arch (4.8s): ascending intro -> descending resolution + C3 bass
    const asc = [261.63, 329.63, 392.0, 493.88, 587.33]; // C4-E4-G4-B4-D5
    asc.forEach((f, idx) => {
      const t = now + idx * 0.36;
      scheduleTone(ctx, compressor, convolver, t, 0.65, f, 0.28, 'sine', 0.004, 0.28);
      scheduleTone(ctx, compressor, convolver, t, 0.09, f * 4, 0.06, 'triangle', 0.002, 0.2);
    });

    const desc = [587.33, 493.88, 392.0, 329.63, 261.63]; // D5-B4-G4-E4-C4
    desc.forEach((f, idx) => {
      const t = now + 2.35 + idx * 0.36;
      const isLast = idx === desc.length - 1;
      scheduleTone(ctx, compressor, convolver, t, isLast ? 1.05 : 0.65, f, 0.28, 'sine', 0.004, 0.3);
      scheduleTone(ctx, compressor, convolver, t, 0.09, f * 4, 0.06, 'triangle', 0.002, 0.2);
      if (isLast) {
        scheduleTone(ctx, compressor, convolver, t, 1.15, 130.81, 0.2, 'sine', 0.008, 0.35);
      }
    });
  } else if (soundId === 'wood_triplets') {
    // Crisp 2.4s wood marimba triplet arpeggio
    const notes = [
      { t: 0.0, f: 523.25 }, // C5
      { t: 0.16, f: 659.25 }, // E5
      { t: 0.32, f: 783.99 }, // G5
      { t: 0.72, f: 659.25 }, // E5
      { t: 0.88, f: 783.99 }, // G5
      { t: 1.04, f: 1046.5 }, // C6
    ];
    notes.forEach((n, idx) => {
      const t = now + n.t;
      const dur = idx === notes.length - 1 ? 1.25 : 0.45;
      scheduleTone(ctx, compressor, convolver, t, dur, n.f, 0.28, 'sine', 0.003, 0.25);
      scheduleTone(ctx, compressor, convolver, t, 0.065, n.f * 3.98, 0.08, 'triangle', 0.002, 0.15);
    });
  } else if (soundId === 'classic_alarm') {
    // 3.0s: 3-stage crescendo of 4 rapid pulses (2000Hz + 4000Hz)
    const stageGains = [0.12, 0.22, 0.34];
    stageGains.forEach((gain, stageIdx) => {
      const base = now + stageIdx * 0.96;
      for (let p = 0; p < 4; p++) {
        const t = base + p * 0.15;
        scheduleTone(ctx, compressor, convolver, t, 0.08, 2000, gain, 'square', 0.003, 0.1);
        scheduleTone(ctx, compressor, convolver, t, 0.08, 4000, gain * 0.35, 'sine', 0.003, 0.1);
      }
    });
  }

  activeEndTimer = window.setTimeout(() => {
    activeEndTimer = null;
    activeNodes = [];
    activeMasterGain = null;
    onEnded?.();
  }, Math.round(option.durationSec * 1000) + 120);
}
