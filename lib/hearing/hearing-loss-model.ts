export interface HearingParams {
  alpha: number;   // age slope (yearly degradation factor)
  beta: number;    // noise exposure factor (cumulative damage)
  sigma: number;   // model uncertainty
}

/**
 * Predicts threshold based on age and noise exposure params.
 */
export function predictThreshold(
  base: number,
  age: number,
  noise: number,
  params: HearingParams
) {
  const { alpha, beta, sigma } = params;

  const mean =
    base +
    alpha * age +
    beta * noise;

  return {
    mean,
    lower: mean - 1.96 * sigma,
    upper: mean + 1.96 * sigma
  };
}

/**
 * Weighting factor where higher frequencies degrade faster with age.
 */
export function frequencyWeight(f: number) {
  // higher frequencies degrade faster relative to 1kHz
  return Math.log2(f / 1000);
}

/**
 * Predicts full audiogram trajectory over time.
 */
export function predictAudiogramOverTime(
  audiogram: { f: number; threshold: number }[],
  age: number,
  noise: number,
  params: HearingParams
) {

  return audiogram.map(p => {
    const w = frequencyWeight(p.f);

    const result = predictThreshold(
      p.threshold,
      age * w, // apply age factor weighted by frequency
      noise,
      params
    );

    return {
      frequency: p.f,
      ...result
    };
  });
}

/**
 * Bayesian update of model parameters based on observed trial errors.
 */
export function updateParams(
  params: HearingParams,
  observedError: number
): HearingParams {

  return {
    alpha: params.alpha * (1 + observedError * 0.01),
    beta: params.beta,
    sigma: Math.max(1, params.sigma * 0.98)
  };
}
