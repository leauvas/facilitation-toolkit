export function selectSupportedAudioMime(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const mime of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

export function getExtForMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('mp4') || lower.includes('aac') || lower.includes('m4a')) {
    return 'm4a';
  }
  return 'webm';
}

export function isMp4Mime(mime: string): boolean {
  return mime.toLowerCase().includes('mp4');
}

export class WakeKeepAlive {
  private wakeLock: WakeLockSentinel | null = null;
  private audioCtx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  async start(): Promise<void> {
    await this.requestWakeLock();
    this.startSilentAudio();
  }

  async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        if (!this.wakeLock || this.wakeLock.released) {
          this.wakeLock = await navigator.wakeLock.request('screen');
        }
      }
    } catch {
      // Screen Wake Lock may be denied on low battery or unsupported browsers
    }
  }

  private startSilentAudio(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      if (!this.osc) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1;
        // Near-silent signal to help keep Safari audio session alive
        gain.gain.value = 0.00001;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        this.osc = osc;
        this.gain = gain;
      }
    } catch {
      // Ignore AudioContext blocks
    }
  }

  async resume(): Promise<void> {
    await this.requestWakeLock();
    try {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
    } catch {
      // Ignore
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.wakeLock && !this.wakeLock.released) {
        await this.wakeLock.release();
      }
    } catch {
      // Ignore
    }
    this.wakeLock = null;

    try {
      this.osc?.stop();
      this.osc?.disconnect();
      this.gain?.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        await this.audioCtx.close();
      }
    } catch {
      // Ignore
    }
    this.osc = null;
    this.gain = null;
    this.audioCtx = null;
  }
}

export function playTimerChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6 soft chime
    notes.forEach((freq, idx) => {
      const startAt = now + idx * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 1.2);
    });

    setTimeout(() => {
      if (ctx.state !== 'closed') {
        void ctx.close();
      }
    }, 2600);
  } catch {
    // Ignore audio playback errors
  }
}
