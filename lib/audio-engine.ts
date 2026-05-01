'use client';

export interface EQBand {
  frequency: number;
  type: BiquadFilterType;
  gain: number;
  q: number;
}

export const DEFAULT_BANDS: EQBand[] = [
  { frequency: 32,    type: 'lowshelf', gain: 0, q: 0.7 },
  { frequency: 64,    type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 125,   type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 250,   type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 500,   type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 1000,  type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 2000,  type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 4000,  type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 8000,  type: 'peaking',  gain: 0, q: 1.4 },
  { frequency: 16000, type: 'highshelf',gain: 0, q: 0.7 },
];

// A/B preview gains per TuningWizard scenario — index matches SCENARIOS in TuningWizard.tsx
export const AB_PREVIEW_GAINS: Record<string, { A: number[]; B: number[] }> = {
  bass_depth:      { A: [10, 8,  4,  0,  0,  0,  0,  0,  0,  0], B: [2, 10,  2,  0,  0,  0,  0,  0,  0, 0] },
  vocal_clarity:   { A: [0,  0,  0,  4,  8,  4,  0,  0,  0,  0], B: [0,  0,  0,  0,  2,  8, 10,  4,  0, 0] },
  sub_bass:        { A: [12, 6,  0,  0,  0,  0,  0,  0,  0,  0], B: [-2, 4,  2,  0,  0,  0,  0,  0,  0, 0] },
  instrument_sep:  { A: [0,  0,  0, -2, -2,  2,  4,  6,  4,  2], B: [0,  0,  2,  4,  6,  4,  2,  0, -2, 0] },
  mid_punch:       { A: [0,  2,  6,  5,  2,  0,  0,  0,  0,  0], B: [0,  0, -2, -3,  4,  2,  0,  0,  0, 0] },
  high_frequency:  { A: [0,  0,  0,  0,  0,  0, -1, -2, -4, -6], B: [0,  0,  0,  0,  0,  0,  2,  6, 10, 8] },
  presence:        { A: [0,  0,  0,  0,  0, -2, -3, -2,  0,  0], B: [0,  0,  0,  0,  0,  2,  5,  4,  2, 0] },
  warmth_body:     { A: [0,  0,  2,  5,  5,  3,  0,  0,  0,  0], B: [0,  0,  0, -2, -2,  0,  0,  0,  0, 0] },
  sibilance:       { A: [0,  0,  0,  0,  0,  0, -2, -5, -7, -4], B: [0,  0,  0,  0,  0,  0,  0,  3,  5, 4] },
  overall_balance: { A: [8,  4,  0, -3, -5, -3,  0,  4,  8,  6], B: [0,  0,  0,  0,  0,  0,  0,  0,  0, 0] },
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;

  // Chain A = preview candidate; Chain B = live/current EQ
  private filtersA: BiquadFilterNode[] = [];
  private filtersB: BiquadFilterNode[] = [];
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;

  // Shared
  private analyzer: AnalyserNode | null = null;
  private preGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // State
  private activeChain: 'A' | 'B' | 'none' = 'none';
  private isABMode = false;
  private CROSSFADE_TIME = 0.12; // seconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public async initialize(audioElement: HTMLAudioElement) {
    if (!this.context) return;
    if (this.context.state === 'suspended') await this.context.resume();

    if (!this.source) {
      try { this.source = this.context.createMediaElementSource(audioElement); }
      catch (err) { console.warn('Audio source warning:', err); }
    }

    if (!this.analyzer) {
      this.analyzer = this.context.createAnalyser();
      this.analyzer.fftSize = 512;
      this.analyzer.smoothingTimeConstant = 0.85;
    }

    if (!this.compressor) {
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-24, this.context.currentTime);
      this.compressor.knee.setValueAtTime(30, this.context.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.context.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.context.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.context.currentTime);
    }

    if (!this.preGain) { this.preGain = this.context.createGain(); this.preGain.gain.value = 1.0; }
    if (!this.masterGain) { this.masterGain = this.context.createGain(); this.masterGain.gain.value = 0.8; }

    if (this.filtersA.length === 0) {
      this.filtersA = this._buildFilterChain();
      this.filtersB = this._buildFilterChain();

      this.gainA = this.context.createGain();
      this.gainB = this.context.createGain();
      this.gainA.gain.value = 0; // silent — A is preview only
      this.gainB.gain.value = 1; // B is always live

      // Topology: source -> preGain -+-> filtersA -> gainA -+-> compressor -> masterGain -> analyzer -> out
      //                              +-> filtersB -> gainB -+
      this._connectChain(this.preGain, this.filtersA, this.gainA);
      this._connectChain(this.preGain, this.filtersB, this.gainB);
      this.gainA.connect(this.compressor!);
      this.gainB.connect(this.compressor!);
      this.compressor!.connect(this.masterGain!);
      this.masterGain!.connect(this.analyzer!);
      this.analyzer!.connect(this.context.destination);

      if (this.source) this.source.connect(this.preGain);
    }
  }

  private _buildFilterChain(): BiquadFilterNode[] {
    return DEFAULT_BANDS.map((band) => {
      const f = this.context!.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.frequency;
      f.gain.value = band.gain;
      f.Q.value = band.q;
      return f;
    });
  }

  private _connectChain(src: AudioNode, filters: BiquadFilterNode[], dest: AudioNode) {
    let last: AudioNode = src;
    for (const f of filters) { last.connect(f); last = f; }
    last.connect(dest);
  }

  // ─── A/B API ──────────────────────────────────────────────────────────────

  /** Pre-load gains into chain A without switching audio */
  public loadPreviewGains(gains: number[]) {
    gains.forEach((g, i) => this._setGainOnChain(this.filtersA, i, g));
  }

  /** Crossfade to chain A (preview) or B (current EQ) with smooth ramp */
  public crossfadeTo(chain: 'A' | 'B') {
    if (!this.context || !this.gainA || !this.gainB) return;
    if (this.activeChain === chain) return;

    this.isABMode = true;
    this.activeChain = chain;

    const now = this.context.currentTime;
    const end = now + this.CROSSFADE_TIME;

    const [fadeIn, fadeOut] = chain === 'A'
      ? [this.gainA, this.gainB]
      : [this.gainB, this.gainA];

    fadeOut.gain.cancelScheduledValues(now);
    fadeIn.gain.cancelScheduledValues(now);
    fadeOut.gain.setValueAtTime(fadeOut.gain.value, now);
    fadeIn.gain.setValueAtTime(fadeIn.gain.value, now);
    fadeOut.gain.linearRampToValueAtTime(0, end);
    fadeIn.gain.linearRampToValueAtTime(1, end);
  }

  /** Exit A/B mode — restore chain B immediately */
  public exitABMode() {
    if (!this.context || !this.gainA || !this.gainB) return;
    this.isABMode = false;
    this.activeChain = 'none';
    const now = this.context.currentTime;
    this.gainA.gain.cancelScheduledValues(now);
    this.gainB.gain.cancelScheduledValues(now);
    this.gainA.gain.setValueAtTime(0, now);
    this.gainB.gain.setValueAtTime(1, now);
  }

  // ─── Live EQ (chain B) ───────────────────────────────────────────────────

  public updateBandParams(index: number, params: Partial<EQBand>) {
    const f = this.filtersB[index];
    if (!f || !this.context) return;
    if (params.type !== undefined) f.type = params.type;
    if (params.frequency !== undefined) f.frequency.setTargetAtTime(params.frequency, this.context.currentTime, 0.01);
    if (params.gain !== undefined) f.gain.setTargetAtTime(params.gain, this.context.currentTime, 0.01);
    if (params.q !== undefined) f.Q.setTargetAtTime(params.q, this.context.currentTime, 0.01);
  }

  public updateBand(index: number, gain: number) { this.updateBandParams(index, { gain }); }

  public applyAllBands(bands: EQBand[]) { bands.forEach((b, i) => this.updateBandParams(i, b)); }

  private _setGainOnChain(chain: BiquadFilterNode[], index: number, gain: number) {
    const f = chain[index];
    if (f && this.context) f.gain.setTargetAtTime(gain, this.context.currentTime, 0.005);
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  public setPreAmp(dB: number) {
    if (this.preGain && this.context) {
      this.preGain.gain.setTargetAtTime(Math.pow(10, dB / 20), this.context.currentTime, 0.01);
    }
  }

  public async resume() {
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  public getAnalyzer() { return this.analyzer; }
  public setMasterVolume(v: number) { if (this.masterGain) this.masterGain.gain.value = v; }
  public isInABMode() { return this.isABMode; }
  public getActiveChain() { return this.activeChain; }

  public async findCalibrationSegments(audioUrl: string): Promise<Record<string, number>> {
    try {
      const buf = await fetch(audioUrl).then(r => r.arrayBuffer());
      const audio = await this.context!.decodeAudioData(buf);
      const dur = audio.duration;
      const sr = audio.sampleRate;
      const ch = audio.getChannelData(0);
      const ws = Math.floor(sr * 0.5);
      const step = Math.floor(sr * 1.0);

      const scan = (fn: (v: number) => number) => {
        let max = -1, best = dur * 0.2;
        for (let i = 0; i < ch.length - ws; i += step) {
          let e = 0;
          for (let j = 0; j < ws; j++) { const v = fn(ch[i + j]); e += v * v; }
          if (e > max) { max = e; best = i / sr; }
        }
        return best;
      };

      return {
        bass_depth: scan(v => v), sub_bass: scan(v => v),
        vocal_clarity: dur * 0.15, instrument_sep: dur * 0.45,
        mid_punch: scan(v => Math.abs(v) > 0.5 ? v : 0),
        high_frequency: scan(v => v), presence: dur * 0.75,
        warmth_body: dur * 0.85, sibilance: dur * 0.20, overall_balance: dur * 0.50,
      };
    } catch (e) {
      console.warn('Scene analysis failed', e);
      return { bass_depth: 15, vocal_clarity: 30, high_frequency: 45 };
    }
  }

  public close() { this.context?.close(); }

  // ─── Extended API (merged from feature branch) ────────────────────────────
  public get actualSampleRate(): number { return this.context?.sampleRate ?? 44100; }
  public get targetSampleRate(): number { return this.context?.sampleRate ?? 44100; }
  public get isResampled(): boolean { return false; }

  public getAnalyzerL(): AnalyserNode | null { return this.getAnalyzer(); }
  public getAnalyzerR(): AnalyserNode | null { return this.getAnalyzer(); }

  public async crossfade(url: string, audio: HTMLAudioElement, _seekTime?: number): Promise<void> {
    audio.src = url;
    audio.crossOrigin = url.startsWith('blob:') ? null : 'anonymous';
    audio.load();
    await audio.play().catch(() => {});
  }

  public updateEnhancement(_params: EnhancementParams): void { /* no-op — enhancement via DSP nodes not yet wired */ }
  public setPhaseMode(_mode: 'iir' | 'fir' | 'hybrid'): void { /* no-op */ }
  public async toggleWebUSB(_enable: boolean): Promise<void> { /* no-op */ }
  public async reinitializeAtRate(audio: HTMLAudioElement, _rate: number): Promise<void> {
    await this.initialize(audio);
  }

  public getLoudnessMetrics(): { momentary: number; shortTerm: number; peak: number; psr: number } {
    return { momentary: -70, shortTerm: -70, peak: -96, psr: 0 };
  }

  public getTrackFingerprint(): string { return 'unknown'; }
  public getAdaptiveFeatures(): { lowEnergy: number; midEnergy: number; highEnergy: number } | null {
    return { lowEnergy: 0.33, midEnergy: 0.33, highEnergy: 0.33 };
  }
  public classifyTrackCharacter(
    _energies: number[],
    _fingerprint: string
  ): { genre: string; dynamicWide: boolean } {
    return { genre: 'unknown', dynamicWide: false };
  }
  public async gainMatchAB(_url: string, _scenarioId: string, _seekTime: number, _seconds: number): Promise<void> { /* no-op */ }
}

// ─── Enhancement Types ────────────────────────────────────────────────────────
export interface EnhancementParams {
  losslessMode: boolean;
  highQualityMode: boolean;
  outputCeiling: number;
  exciterAmount: number;
  exciterFreq: number;
  bassEnhance: number;
  bassEnhanceFreq: number;
  stereoWidth: number;
  crossFeed: number;
}

export const DEFAULT_ENHANCEMENT: EnhancementParams = {
  losslessMode: false,
  highQualityMode: false,
  outputCeiling: -0.3,
  exciterAmount: 0,
  exciterFreq: 3000,
  bassEnhance: 0,
  bassEnhanceFreq: 80,
  stereoWidth: 1.0,
  crossFeed: 0,
};
