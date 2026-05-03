/**
 * RBF (Radial Basis Function) Kernel for Gaussian Process.
 */
export function rbfKernel(x: number, y: number, l = 1.0) {
  return Math.exp(-Math.pow(x - y, 2) / (2 * l * l));
}

/**
 * Transform frequency to log-2 space.
 */
export function logFreq(f: number) {
  return Math.log2(f);
}

/**
 * Simplified GP prediction (Kernel Regression) to predict hearing threshold across frequencies.
 */
export function predictHearingCurve(
  freqs: number[],
  audiogram: { f: number; threshold: number }[]
) {

  const X = audiogram.map(p => logFreq(p.f));
  const Y = audiogram.map(p => p.threshold);

  return freqs.map(f => {
    const x = logFreq(f);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < X.length; i++) {
      const k = rbfKernel(x, X[i]);

      numerator += k * Y[i];
      denominator += k;
    }

    return {
      frequency: f,
      hearingLoss: numerator / (denominator + 1e-12)
    };
  });
}

/**
 * Adjust sound pressure level based on hearing loss (recruitment effect compression).
 */
export function adjustLoudness(
  spl: number,
  hearingLoss: number
) {
  // recruitment effect (nonlinear compression)
  const adjusted = spl - hearingLoss;

  return adjusted < 0
    ? adjusted * 0.5
    : adjusted;
}

/**
 * Generates an equal loudness contour shift relative to 1kHz.
 */
export function generateContour(curve: { frequency: number; hearingLoss: number }[]) {
  // Normal hearing baseline (dBHL)
  // Below 20dB is considered normal; only thresholds above 20dB receive compensation.
  const baseline = 20; 

  return curve.map(c => {
    // Apply 35% damping to recommendations to keep results musical rather than purely clinical
    const rawShift = c.hearingLoss - baseline;
    const dampedShift = rawShift * 0.35;
    
    // Safety clamp: No cuts (0dB floor), and max +7dB boost (to avoid speaker distortion)
    const shift = Math.max(0, Math.min(7, dampedShift));
    
    return {
      frequency: c.frequency,
      phonShift: shift
    };
  });
}
