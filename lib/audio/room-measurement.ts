import { logger } from '@/lib/logger';

export interface SweepOptions {
  sampleRate: number;
  duration: number; // seconds
  fStart: number;  // 20Hz
  fEnd: number;    // 20kHz
}

/**
 * Advanced calibration using Sine Sweep deconvolution
 */
export class RoomMeasurementService {
  /**
   * Generates a logarithmic sine sweep
   */
  public generateLogSweep(options: SweepOptions): Float32Array {
    const { sampleRate, duration, fStart, fEnd } = options;
    const numSamples = Math.floor(sampleRate * duration);
    const sweep = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Logarithmic sweep frequency ratio
      const logRatio = Math.log(fEnd / fStart);
      const phase = 2 * Math.PI * fStart * (duration / logRatio) * (Math.exp(t * logRatio / duration) - 1);
      sweep[i] = Math.sin(phase);
      
      // Apply fade in/out to avoid clicks
      const fadeLen = Math.floor(0.01 * sampleRate); // 10ms
      if (i < fadeLen) {
        sweep[i] *= i / fadeLen;
      } else if (i > numSamples - fadeLen) {
        sweep[i] *= (numSamples - i) / fadeLen;
      }
    }

    return sweep;
  }

  /**
   * Simplified Frequency Analysis (Magnitude response)
   * In a full implementation, we'd use FFT-based deconvolution (conv with inverse filter).
   * Here we provide a Magnitude Estimation from a recorded sweep.
   */
  public analyzeMagnitudeResponse(
    recorded: Float32Array,
    original: Float32Array
  ): number[] {
    const bands = 10; // Target 10-band EQ
    const response = new Array(bands).fill(0);
    
    // Check if lengths match (roughly)
    if (Math.abs(recorded.length - original.length) > original.length * 0.1) {
      logger.warn('Room measurement recording length mismatch');
    }

    // Split signals into 10 frequency-distributed regions
    // We compare peak energy in each region to estimate the room's transfer function
    const regionSize = Math.floor(original.length / bands);
    
    for (let b = 0; b < bands; b++) {
      const start = b * regionSize;
      const end = (b + 1) * regionSize;
      
      let energyOrig = 0;
      let energyRec = 0;
      
      for (let i = start; i < end; i++) {
        energyOrig += original[i] * original[i];
        energyRec += (recorded[i] || 0) * (recorded[i] || 0);
      }
      
      // Ratio in dB
      if (energyOrig > 0 && energyRec > 0) {
        const ratio = 10 * Math.log10(energyRec / energyOrig);
        response[b] = ratio;
      }
    }

    logger.info('Room frequency response (dB difference):', response);
    return response;
  }

  /**
   * Creates an "Inverse EQ" curve to flatten the room response.
   */
  public calculateCompensationCurve(responseDb: number[]): number[] {
    // Basic inversion: If room has +3dB peak, suggest -3dB cut
    // We damp the effect to avoid feedback/extreme artifacts
    const dampening = 0.5;
    return responseDb.map(val => Math.max(-12, Math.min(12, -val * dampening)));
  }
}

export const roomMeasurementService = new RoomMeasurementService();
