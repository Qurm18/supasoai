export type Frequency = 250 | 500 | 1000 | 2000 | 4000 | 8000;

export interface Trial {
  frequency: Frequency;
  db: number;
  heard: boolean;
  timestamp: number;
}

export interface PosteriorState {
  mu: number;        // estimated threshold
  sigma: number;     // uncertainty
}

export type Audiogram = Record<Frequency, PosteriorState>;

/**
 * Initializes a new audiogram with baseline priors.
 */
export function initAudiogram(): Audiogram {
  const freqs: Frequency[] = [250, 500, 1000, 2000, 4000, 8000];

  const prior: Audiogram = {} as Audiogram;

  for (const f of freqs) {
    prior[f] = {
      mu: 30,        // baseline hearing threshold (dB SPL)
      sigma: 15      // uncertainty
    };
  }

  return prior;
}

/**
 * Psychometric function (likelihood model).
 * Probability that the user hears a tone of 'db' intensity given their threshold 'T'.
 */
export function hearingLikelihood(db: number, T: number, k = 0.8): number {
  // sigmoid mapping: probability user hears tone
  return 1 / (1 + Math.exp(-k * (db - T)));
}

/**
 * Bayesian update using an approximate Gaussian update.
 */
export function updatePosterior(
  prior: PosteriorState,
  db: number,
  heard: boolean
): PosteriorState {

  const { mu, sigma } = prior;

  const likelihood = hearingLikelihood(db, mu);
  const observation = heard ? 1 : 0;
  const error = observation - likelihood;

  // Bayesian learning rate scales with uncertainty
  const learningRate = 1.2 * (sigma / (sigma + 10));

  // Correct gradient-based update: 
  // If heard, threshold mu should DECREASE. If not heard, mu should INCREASE.
  // Using a factor of 6 for stable convergence within 8 trials.
  let newMu = mu - (learningRate * error * 6);
  
  // Safety clamp for threshold estimation
  newMu = Math.max(-10, Math.min(80, newMu));

  // Reduce uncertainty after each trial
  const newSigma = Math.max(1.2, sigma * 0.9);

  return {
    mu: newMu,
    sigma: newSigma
  };
}

/**
 * Adaptive stimulus selection (information gain heuristic).
 * Probes near the estimated threshold with a noise component based on uncertainty.
 */
export function selectNextDb(state: PosteriorState): number {
  const { mu, sigma } = state;

  // probe near uncertainty region
  const noise = (Math.random() - 0.5) * sigma;

  // Stimulus range: 0 (total silence) to 80 (loud)
  return clamp(mu + noise, 0, 80);
}

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

/**
 * Main test loop handler for a single trial.
 */
export function runTrial(
  audiogram: Audiogram,
  frequency: Frequency,
  db: number,
  heard: boolean
): Audiogram {

  const updated = updatePosterior(audiogram[frequency], db, heard);

  return {
    ...audiogram,
    [frequency]: updated
  };
}

/**
 * Exports the audiogram to a standard flat format.
 */
export function exportAudiogram(a: Audiogram) {
  return Object.entries(a).map(([f, v]) => ({
    frequency: Number(f),
    threshold: v.mu,
    confidence: v.sigma
  }));
}
