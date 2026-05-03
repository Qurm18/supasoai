import * as ort from 'onnxruntime-web';
import { logger } from '@/lib/logger';

export type PredictedGenre = 
  | 'Classical'
  | 'Jazz'
  | 'Pop'
  | 'Rock'
  | 'Electronic/EDM'
  | 'Hip-Hop/Rap'
  | 'Metal'
  | 'Country'
  | 'R&B/Soul'
  | 'Ambient/Experimental'
  | 'Unknown';

const GENRE_LABELS: PredictedGenre[] = [
  'Classical',
  'Jazz',
  'Pop',
  'Rock',
  'Electronic/EDM',
  'Hip-Hop/Rap',
  'Metal',
  'Country',
  'R&B/Soul',
  'Ambient/Experimental'
];

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

export function buildMelFilterbank(
  sampleRate: number, 
  fftSize: number, 
  numMelBands: number
): number[][] {
  const minHz = 20; // Ignore sub-20Hz
  const maxHz = sampleRate / 2;
  const minMel = hzToMel(minHz);
  const maxMel = hzToMel(maxHz);
  const melPoints = new Float32Array(numMelBands + 2);
  
  for (let i = 0; i < melPoints.length; i++) {
    melPoints[i] = minMel + i * (maxMel - minMel) / (numMelBands + 1);
  }
  
  const hzPoints = new Float32Array(melPoints.length);
  for (let i = 0; i < melPoints.length; i++) {
    hzPoints[i] = melToHz(melPoints[i]);
  }
  
  const binFreqs = new Float32Array(fftSize / 2);
  for (let i = 0; i < binFreqs.length; i++) {
    binFreqs[i] = (i * sampleRate) / fftSize;
  }
  
  const filterbank: number[][] = [];
  
  for (let i = 0; i < numMelBands; i++) {
    const filter = new Array(fftSize / 2).fill(0);
    const hzStart = hzPoints[i];
    const hzPeak = hzPoints[i + 1];
    const hzEnd = hzPoints[i + 2];
    
    for (let j = 0; j < binFreqs.length; j++) {
      const hz = binFreqs[j];
      if (hz >= hzStart && hz <= hzPeak) {
        filter[j] = (hz - hzStart) / (hzPeak - hzStart);
      } else if (hz > hzPeak && hz <= hzEnd) {
        filter[j] = (hzEnd - hz) / (hzEnd - hzPeak);
      }
    }
    filterbank.push(filter);
  }
  
  return filterbank;
}

export function getMelFrame(
  analyser: AnalyserNode,
  melFilters: number[][]
): Float32Array {
  const fftData = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(fftData);

  // dB to power
  const power = fftData.map(v => Math.pow(10, v / 10));

  const mel = new Float32Array(melFilters.length);

  for (let m = 0; m < melFilters.length; m++) {
    let sum = 0;
    const filter = melFilters[m];

    for (let k = 0; k < filter.length; k++) {
      sum += filter[k] * power[k];
    }

    mel[m] = Math.log10(sum + 1e-6); // log scale for stability
  }

  return mel;
}

export class MelBuffer {
  private buffer: Float32Array[] = [];

  constructor(private maxFrames = 32) {}

  push(frame: Float32Array) {
    this.buffer.push(frame);
    if (this.buffer.length > this.maxFrames) {
      this.buffer.shift();
    }
  }

  isReady() {
    return this.buffer.length === this.maxFrames;
  }

  toTensor(): Float32Array {
    // flatten [32 x num_mels]
    const length = this.buffer.length;
    if (length === 0) return new Float32Array(0);
    const frameSize = this.buffer[0].length;
    const result = new Float32Array(length * frameSize);
    for (let i = 0; i < length; i++) {
      result.set(this.buffer[i], i * frameSize);
    }
    return result;
  }

  reset() {
    this.buffer = [];
  }
}

class EMASmoother {
  private state: Float32Array | null = null;

  constructor(private alpha = 0.7) {}

  apply(current: Float32Array) {
    if (!this.state) {
      this.state = current.slice(); // copy
      return current;
    }

    const out = new Float32Array(current.length);

    for (let i = 0; i < current.length; i++) {
      out[i] = this.alpha * current[i] + (1 - this.alpha) * this.state[i];
    }

    this.state = out;
    return out;
  }

  reset() {
    this.state = null;
  }
}

export class GenreClassifier {
  private session: ort.InferenceSession | null = null;
  private isInitializing = false;
  private modelLoaded = false;
  private buffer: MelBuffer;
  private smoother: EMASmoother;
  private melFilters: number[][] = [];
  private lastPredictTime = 0;
  
  // Model settings
  private readonly NUM_MELS = 40;
  private readonly FRAMES = 32;

  constructor() {
    this.buffer = new MelBuffer(this.FRAMES);
    this.smoother = new EMASmoother(0.7);
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  }

  async initialize(sampleRate: number = 44100, fftSize: number = 1024) {
    if (this.session || this.isInitializing) return;
    this.isInitializing = true;
    try {
      this.melFilters = buildMelFilterbank(sampleRate, fftSize, this.NUM_MELS);
      
      // Try to load model, fail gracefully if missing
      try {
        this.session = await ort.InferenceSession.create('/models/genre.onnx', {
          executionProviders: ['wasm']
        });
        this.modelLoaded = true;
        logger.info('Genre Classifier ONNX model initialized successfully');
      } catch (loadErr) {
        logger.warn('ONNX model /models/genre.onnx not found. Audio features won\'t be classified to genre.', loadErr);
        this.modelLoaded = false;
      }
    } catch (err) {
      logger.error('Failed to initialize Genre Classifier', err);
    } finally {
      this.isInitializing = false;
    }
  }

  private rafId = 0;
  private onPredictCallback: ((result: { genre: PredictedGenre; confidence: number; probs: Float32Array }) => void) | null = null;
  public onPredict(cb: (result: { genre: PredictedGenre; confidence: number; probs: Float32Array }) => void) {
    this.onPredictCallback = cb;
  }

  public startRealtimeLoop(analyser: AnalyserNode) {
    this.stopRealtimeLoop();
    let lastTime = 0;

    const tick = async (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      if (now - lastTime < 100) return; // ~10fps

      if (!this.modelLoaded || !this.session || this.melFilters.length === 0) return;
      
      const frame = getMelFrame(analyser, this.melFilters);
      this.buffer.push(frame);

      if (this.buffer.isReady()) {
        try {
          const inputData = this.buffer.toTensor();
          const tensor = new ort.Tensor('float32', inputData, [1, this.FRAMES, this.NUM_MELS, 1]);
          const output = await this.session.run({ input: tensor });
          
          const outputName = this.session.outputNames[0];
          const probsData = output[outputName].data as Float32Array;
          const smoothProbs = this.smoother.apply(probsData);

          let maxIdx = 0;
          let maxVal = smoothProbs[0];
          for (let i = 1; i < smoothProbs.length; i++) {
            if (smoothProbs[i] > maxVal) {
              maxVal = smoothProbs[i];
              maxIdx = i;
            }
          }

          if (this.onPredictCallback) {
            this.onPredictCallback({
              genre: GENRE_LABELS[maxIdx] || 'Unknown',
              confidence: maxVal,
              probs: smoothProbs
            });
          }
        } catch (e) {
          logger.error('ONNX prediction error', e);
        }
        lastTime = now;
      }
    };
    
    this.rafId = requestAnimationFrame(tick);
  }

  public stopRealtimeLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  async processAnalyserNode(analyser: AnalyserNode): Promise<{ genre: PredictedGenre; confidence: number; probs: Float32Array } | null> {
    if (!this.modelLoaded || !this.session || this.melFilters.length === 0) return null;

    const frame = getMelFrame(analyser, this.melFilters);
    this.buffer.push(frame);

    if (this.buffer.isReady()) {
      const now = performance.now();
      // Throttle predictions (e.g. 10-15 fps so ~100ms)
      if (now - this.lastPredictTime > 100) {
        this.lastPredictTime = now;
        const inputData = this.buffer.toTensor();
        
        try {
          const tensor = new ort.Tensor('float32', inputData, [1, this.FRAMES, this.NUM_MELS, 1]);
          const output = await this.session.run({ input: tensor });
          
          // Assume output is named 'probs' or similar, take the first output
          const outputName = this.session.outputNames[0];
          const probsData = output[outputName].data as Float32Array;
          const smoothProbs = this.smoother.apply(probsData);

          let maxIdx = 0;
          let maxVal = smoothProbs[0];
          for (let i = 1; i < smoothProbs.length; i++) {
            if (smoothProbs[i] > maxVal) {
              maxVal = smoothProbs[i];
              maxIdx = i;
            }
          }

          return {
            genre: GENRE_LABELS[maxIdx] || 'Unknown',
            confidence: maxVal,
            probs: smoothProbs
          };
        } catch (e) {
          logger.error('ONNX prediction error', e);
          return null;
        }
      }
    }
    return null;
  }

  reset() {
    this.buffer.reset();
    this.smoother.reset();
  }
}

export const genreClassifier = new GenreClassifier();
