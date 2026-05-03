import { logger } from '@/lib/logger';

export interface MoodEnergyState {
  valence: number; // [-1, 1] (Negative to Positive)
  energy: number;  // [0, 1] (Calm to Intense)
  bpm: number;     // Estimated Beats Per Minute
}

export class MoodEnergyEstimator {
  private energyHistory: number[] = [];
  private readonly bufferSize = 128; // ~3 seconds of history for tempo

  constructor() {}

  /**
   * Estimates mood and energy based on spectral and temporal features
   * @param rms Root Mean Square (loudness)
   * @param centroid Spectral Centroid (brightness)
   * @param flux Spectral Flux (change rate)
   * @param spectralData Raw frequency data for onset detection
   */
  public estimate(
    rms: number,
    centroid: number,
    flux: number,
    spectralData: Float32Array
  ): MoodEnergyState {
    // 1. Energy Calculation (Intensity)
    // Combines loudness (RMS) and spectral complexity (Flux)
    const energy = Math.min(1, (rms * 0.7) + (flux * 0.3));

    // 2. Valence Calculation (Sentiment/Mood)
    // Higher spectral centroid usually correlates with "brightness" / positive valence
    // Lower centroid/darker sounds correlate with relaxation or sadness
    // Normalized [-1, 1]
    const valence = Math.max(-1, Math.min(1, (centroid / 10000) * 2 - 1));

    // 3. Tempo Estimation (BPM)
    // Simple onset detection + autocorrelation on energy envelope
    this.energyHistory.push(rms);
    if (this.energyHistory.length > this.bufferSize) {
      this.energyHistory.shift();
    }

    const bpm = this.estimateBPM();

    return {
      valence,
      energy,
      bpm
    };
  }

  private estimateBPM(): number {
    if (this.energyHistory.length < this.bufferSize) return 120;

    // Detect peaks in energy history (onsets)
    const peaks: number[] = [];
    const threshold = 0.1;
    for (let i = 1; i < this.energyHistory.length - 1; i++) {
      if (this.energyHistory[i] > this.energyHistory[i - 1] && 
          this.energyHistory[i] > this.energyHistory[i + 1] &&
          this.energyHistory[i] > threshold) {
        peaks.push(i);
      }
    }

    if (peaks.length < 2) return 120;

    // Calculate average distance between peaks (heartbeat of the track)
    let totalDist = 0;
    for (let i = 1; i < peaks.length; i++) {
        totalDist += (peaks[i] - peaks[i - 1]);
    }
    
    const avgDist = totalDist / (peaks.length - 1);
    // Assuming 512ms per frame (as per genre-classifier spec)
    // We'd need the actual sampling rate of the detection loop to be precise.
    // Here we use a proportional estimate.
    const calculatedBpm = Math.round(60 / (avgDist * 0.512));
    
    // Clamp to realistic musical range
    return Math.max(60, Math.min(200, calculatedBpm || 120));
  }
}

export const moodEnergyEstimator = new MoodEnergyEstimator();
