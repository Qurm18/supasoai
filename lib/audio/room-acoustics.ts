import { logger } from '@/lib/logger';

export interface RoomProperties {
  length: number; // L in meters
  width: number;  // W in meters
  height: number; // H in meters
  absorption: number; // Overall absorption coefficient (simplification of octave bands)
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export class RoomAcousticsGenerator {
  private c = 343; // Speed of sound (m/s)
  private sampleRate = 48000;

  /**
   * Calculates T60 using the Sabine equation
   * T60 = 0.161 * (Volume / AbsorptionArea)
   */
  private calculateT60(room: RoomProperties): number {
    const volume = room.length * room.width * room.height;
    const surfaceArea = 2 * (room.length * room.width + room.length * room.height + room.width * room.height);
    const absorptionArea = surfaceArea * room.absorption;
    
    if (absorptionArea === 0) return 1.0;
    return (0.161 * volume) / absorptionArea;
  }

  private distance(p1: Position3D, p2: Position3D): number {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    );
  }

  /**
   * Simulate Early Reflections via Image Source Method (Up to 4th order)
   * Generate RIR impulse response (32K samples @ 48kHz = ~0.67s)
   */
  public generateRIR(
    room: RoomProperties,
    src: Position3D,
    mic: Position3D,
    seed: number = 42
  ): Float32Array {
    const pStart = performance.now();
    const lengthSamples = 32768; // ~0.68s at 48kHz
    const rir = new Float32Array(lengthSamples);

    const t60 = this.calculateT60(room);
    
    // PRNG for consistent noise
    const rand = (function() {
      let t = seed += 0x6D2B79F5;
      return function() {
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })();

    // 1. Early Reflections (Image Source Method - up to 4th order)
    const maxOrder = 4;
    for (let ix = -maxOrder; ix <= maxOrder; ix++) {
      for (let iy = -maxOrder; iy <= maxOrder; iy++) {
        for (let iz = -maxOrder; iz <= maxOrder; iz++) {
          const bounces = Math.abs(ix) + Math.abs(iy) + Math.abs(iz);
          if (bounces > maxOrder) continue;

          // Compute image source position
          const isrc = {
            x: (ix % 2 === 0) ? (ix * room.length + src.x) : ((ix + 1) * room.length - src.x),
            y: (iy % 2 === 0) ? (iy * room.width + src.y) : ((iy + 1) * room.width - src.y),
            z: (iz % 2 === 0) ? (iz * room.height + src.z) : ((iz + 1) * room.height - src.z)
          };

          const dist = this.distance(isrc, mic);
          const time = dist / this.c;
          const sample = Math.floor(time * this.sampleRate);

          if (sample >= 0 && sample < lengthSamples) {
            // Attenuation: Inverse distance law + material absorption
            const attenuation = Math.pow(1 - room.absorption, bounces) / (dist > 0.1 ? dist : 1.0);
            
            // Add to impulse response (avoiding exact sample overlap by simple summation)
            rir[sample] += attenuation;
          }
        }
      }
    }

    // 2. Late Reverberation (Schroeder's statistical model)
    // Start diffuse field after early reflections (approx after 50ms)
    const lateReverbStartSample = Math.floor(0.05 * this.sampleRate);
    
    // T60 = time to decay by 60dB (factor of 1e-3 in amplitude)
    // A(t) = exp(-t / tau), tau = T60 / 6.908
    const tau = t60 / Math.log(1000); 

    for (let i = lateReverbStartSample; i < lengthSamples; i++) {
        const time = i / this.sampleRate;
        const envelope = Math.exp(-time / tau);
        
        // Inject diffuse white noise
        const diffuseNoise = (rand() * 2 - 1) * 0.05; // Base diffuse intensity
        rir[i] += diffuseNoise * envelope;
    }

    // 3. Normalize Impulse Response
    let maxAbs = 0;
    for (let i = 0; i < lengthSamples; i++) {
        const absVal = Math.abs(rir[i]);
        if (absVal > maxAbs) maxAbs = absVal;
    }
    
    if (maxAbs > 0) {
        for (let i = 0; i < lengthSamples; i++) {
            rir[i] /= maxAbs;
        }
    }

    const pEnd = performance.now();
    logger.debug(`[PERF] RIR Generation (Image Source + Schroeder): ${(pEnd - pStart).toFixed(2)}ms`);

    return rir;
  }

  /**
   * Linear convolution mapping via standard Web Audio API ConvolverNode
   * Native Partition Convolution (typically 128/512 block size depending on implementation)
   * Complexity: O(N log N) inside the browser audio engine.
   */
  public generateConvolver(
    audioCtx: AudioContext,
    rirData: Float32Array
  ): ConvolverNode {
    const buffer = audioCtx.createBuffer(1, rirData.length, this.sampleRate);
    buffer.getChannelData(0).set(rirData);

    const convolver = audioCtx.createConvolver();
    convolver.buffer = buffer;
    convolver.normalize = true; 

    return convolver;
  }
}

export const roomAcousticsGenerator = new RoomAcousticsGenerator();
