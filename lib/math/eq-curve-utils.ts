import { EQBand } from '@/lib/audio-engine';

export interface CurveCoeffs {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

export function getCurveCoeffs(band: EQBand, sampleRate = 48000): CurveCoeffs {
  const { frequency: f0, gain: dBgain, q: Q, type } = band;
  if (!f0 || !Q) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };

  const A = Math.pow(10, dBgain / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Q);

  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

  switch (type) {
    case 'peaking':
      b0 =  1 + alpha * A;  b1 = -2 * cosW0;  b2 = 1 - alpha * A;
      a0 =  1 + alpha / A;  a1 = -2 * cosW0;  a2 = 1 - alpha / A;
      break;
    case 'lowshelf':
      b0 =      A * ((A + 1) - (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha);
      b1 =  2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 =      A * ((A + 1) - (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha);
      a0 =            (A + 1) + (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha;
      a1 =     -2 * ((A - 1) + (A + 1) * cosW0);
      a2 =            (A + 1) + (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha;
      break;
    case 'highshelf':
      b0 =       A * ((A + 1) + (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 =       A * ((A + 1) + (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha);
      a0 =             (A + 1) - (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha;
      a1 =      2 * ((A - 1) - (A + 1) * cosW0);
      a2 =             (A + 1) - (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha;
      break;
  }
  return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
}

export function biquadMagFast(c: CurveCoeffs, f: number, sampleRate = 48000): number {
  const w = (2 * Math.PI * f) / sampleRate;
  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cos2W = Math.cos(2*w), sin2W = Math.sin(2*w);

  const numRe = c.b0 + c.b1 * cosW + c.b2 * cos2W;
  const numIm =      - c.b1 * sinW - c.b2 * sin2W;
  const denRe = 1    + c.a1 * cosW + c.a2 * cos2W;
  const denIm =      - c.a1 * sinW - c.a2 * sin2W;

  const numMag2 = numRe * numRe + numIm * numIm;
  const denMag2 = denRe * denRe + denIm * denIm;
  if (denMag2 < 1e-20) return 0;
  return 10 * Math.log10(numMag2 / denMag2);
}

export function computeCurveFast(bands: EQBand[], baseCorrection?: number[], numPoints = 200, dynamicGains?: number[]): { freq: number; gain: number }[] {
  const points: { freq: number; gain: number }[] = [];
  const bandFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  const actualBands = bands.map((b, i) => {
    return {
      ...b,
      gain: b.gain + (dynamicGains && dynamicGains[i] !== undefined ? dynamicGains[i] : 0)
    };
  });

  const bandCoeffs = actualBands.map(b => getCurveCoeffs(b));
  const correctionCoeffs = (baseCorrection || []).map((gain, i) => 
    gain !== 0 ? getCurveCoeffs({ frequency: bandFreqs[i], gain, q: 1.0, type: 'peaking' } as EQBand) : null
  ).filter(Boolean) as CurveCoeffs[];

  for (let i = 0; i <= numPoints; i++) {
    const freq = 20 * Math.pow(1000, i / numPoints);
    let totalDB = 0;
    for (let j = 0; j < bandCoeffs.length; j++) totalDB += biquadMagFast(bandCoeffs[j], freq);
    for (let j = 0; j < correctionCoeffs.length; j++) totalDB += biquadMagFast(correctionCoeffs[j], freq);
    points.push({ freq, gain: totalDB });
  }
  return points;
}
