'use client';

export interface TuningPreference {
  choice: 'A' | 'B';
  scenario: string;
}

export interface EQProfile {
  name: string;
  description: string;
  genre: string;
  gains: number[];
  insights: string[];
  color: string;
}

export interface ChoiceReason {
  scenario: string;
  choice: 'A' | 'B';
  label: string;
  direction: 'boost' | 'cut';
  bandIdx: number;
  bandLabel: string;
  avgDeltaDb: number;
  votes: number;
  trials: number;
  agreement: number;
}

export interface TasteEntry {
  id: string;
  label: string;
  score: number;
  descriptionVi: string;
}

export interface TasteResult {
  profileName: string;
  gains: number[];
  insights: string[];
  top: TasteEntry[];
}

export interface ScenarioChoiceAnalysis {
  scenario: string;
  scenarioLabel: string;
  choiceA: number;
  choiceB: number;
  dislikeBoth: number;
  winner: 'A' | 'B' | 'tie';
  winnerConfidence: number;
  dominantBandLabel: string;
  region: string;
  perceptualLabel: string;
  whyA: string;
  whyB: string;
  conclusion: string;
}

// ─── Band Metadata ────────────────────────────────────────────────────────────
const BAND_LABELS = ['32Hz','64Hz','125Hz','250Hz','500Hz','1kHz','2kHz','4kHz','8kHz','16kHz'];

// ─── Weight Matrix ────────────────────────────────────────────────────────────
const WEIGHT_MATRIX: Record<string, { A: number[]; B: number[] }> = {
  bass_depth:       { A: [5.0, 3.5, 1.0, 0,    0,    0,    0,    0,    0,    0   ], B: [0,    4.0,  2.5,  0,    0,    0,    0,    0,    0,    0   ] },
  vocal_clarity:    { A: [0,   0,   0,   2.5,  3.5,  1.0,  0,    0,    0,    0   ], B: [0,    0,    0,    0,    0.5,  3.0,  4.5,  2.0,  0,    0   ] },
  sub_bass:         { A: [6.0, 2.0, 0,   0,    0,    0,    0,    0,    0,    0   ], B: [-1.5, 0,    0,    0,    0,    0,    0,    0,    0,    0   ] },
  instrument_sep:   { A: [0,   0,   0,   0,   -1.0,  2.0,  3.5,  4.0,  2.0,  0   ], B: [0,    0,    0,    2.5,  4.0,  3.0,  0,    0,    0,    0   ] },
  mid_punch:        { A: [0,   1.5, 4.5, 3.0,  1.0,  0,    0,    0,    0,    0   ], B: [0,    0,   -1.0, -1.5,  2.0,  1.0,  0,    0,    0,    0   ] },
  high_frequency:   { A: [0,   0,   0,   0,    0,    0,    0,   -1.0, -2.5, -4.0 ], B: [0,    0,    0,    0,    0,    0,    1.0,  2.5,  4.5,  6.0 ] },
  presence:         { A: [0,   0,   0,   0,    0,   -1.5, -2.0, -1.5,  0,    0   ], B: [0,    0,    0,    0,    0,    1.5,  3.5,  3.0,  1.0,  0   ] },
  warmth_body:      { A: [0,   0,   1.5, 4.0,  3.5,  2.0,  0,    0,    0,    0   ], B: [0,    0,    0,   -1.0, -1.5,  0,    0,    0,    0,    0   ] },
  sibilance:        { A: [0,   0,   0,   0,    0,    0,   -1.5, -3.5, -5.0, -3.0 ], B: [0,    0,    0,    0,    0,    0,    0,    2.0,  3.5,  2.5 ] },
  overall_balance:  { A: [3.5, 2.0, 0,  -1.5, -2.5, -1.5,  0,   2.0,  3.5,  4.5 ], B: [0,    0,    0,    0,    0,    0,    0,    0,    0,    0   ] },
};

// ─── Feature Dimensions ───────────────────────────────────────────────────────
interface FeatureScores {
  subBassEnergy: number;
  midBassEnergy: number;
  midRange: number;
  presence: number;
  airDetail: number;
  flatness: number;

  [key: string]: number;
}

const FEATURE_RULES: Record<string, Partial<Record<keyof FeatureScores, { A: number; B: number }>>> = {
  bass_depth:       { subBassEnergy: { A: 1.5, B: 0.3 }, midBassEnergy: { A: 0.5, B: 1.2 } },
  sub_bass:         { subBassEnergy: { A: 2.0, B: -0.5 } },
  mid_punch:        { midBassEnergy: { A: 1.5, B: -0.3 }, midRange: { A: 0.8, B: -0.5 } },
  vocal_clarity:    { midRange: { A: 1.5, B: -0.2 }, presence: { A: -0.3, B: 1.0 } },
  warmth_body:      { midRange: { A: 1.8, B: -0.8 }, flatness: { A: -0.5, B: 0.8 } },
  instrument_sep:   { presence: { A: 0.8, B: -0.2 }, midRange: { A: -0.3, B: 0.5 } },
  presence:         { presence: { A: -1.0, B: 2.0 } },
  high_frequency:   { airDetail: { A: -1.5, B: 2.0 }, flatness: { A: 0.5, B: -0.3 } },
  sibilance:        { airDetail: { A: -1.0, B: 1.5 } },
  overall_balance:  { subBassEnergy: { A: 0.8, B: 0 }, airDetail: { A: 0.8, B: 0 }, flatness: { A: -1.0, B: 2.0 } },
};

// ─── Profile Definitions ──────────────────────────────────────────────────────
interface ProfileDef {
  name: string;
  description: string;
  genre: string;
  color: string;
  insights: string[];
  requires: Partial<Record<keyof FeatureScores, number>>;
  rejects?: Partial<Record<keyof FeatureScores, number>>;
  bias: number[];
  priority: number;
  affinities?: Partial<Record<keyof FeatureScores, number>>;
}

const PROFILES: ProfileDef[] = [
  {
    name: 'Deep Sub Reference',
    description: 'Maximum sub-bass extension with ultra-controlled mids',
    genre: 'EDM · Cinematic · Hip-Hop',
    color: '#7F77DD',
    insights: [
      'Sub-bass shelf boosted to physical pressure threshold.',
      'Mid-range notched for maximum sub clarity and definition.',
    ],
    requires: { subBassEnergy: 2.5 },
    rejects: { flatness: 2.0 },
    bias: [3.0, 1.5, 0, -1.0, -1.5, -1.0, 0, 0, 0, 0],
    affinities: { subBassEnergy: 2.0, midBassEnergy: 0.5 },
    priority: 8,
  },
  {
    name: 'Power Bass',
    description: 'Aggressive low-end impact across the entire bass register',
    genre: 'EDM · Modern Pop · Gaming',
    color: '#E24B4A',
    insights: [
      'Full bass register boosted — sub slam meets mid-bass thump.',
      'Treble kept clean to prevent listener fatigue at high volumes.',
    ],
    requires: { subBassEnergy: 1.0, midBassEnergy: 1.0 },
    rejects: { flatness: 2.0, airDetail: 2.0 },
    bias: [2.0, 2.5, 1.0, 0, -1.0, 0, 0, 0, 0, 0],
    affinities: { subBassEnergy: 1.5, midBassEnergy: 1.5 },
    priority: 7,
  },
  {
    name: 'Analog Warmth',
    description: 'Tube-like mid-body saturation, rolled-off highs',
    genre: 'Vocal Jazz · Acoustic · R&B',
    color: '#EF9F27',
    insights: [
      'Lower midrange lifted for a rich, full-bodied texture.',
      'High-frequency air gently rolled off for zero digital harshness.',
    ],
    requires: { midRange: 2.0 },
    rejects: { airDetail: 1.5, subBassEnergy: 2.5 },
    bias: [0, 0, 1.5, 2.0, 1.5, 0.5, -0.5, -1.0, -1.5, -2.0],
    affinities: { midRange: 2.0, midBassEnergy: 0.5 },
    priority: 6,
  },
  {
    name: 'Vocal Forward',
    description: 'Elevated presence and clarity, optimized for voices',
    genre: 'Pop · Podcast · Live Performance',
    color: '#D4537E',
    insights: [
      '1–4 kHz presence region lifted — vocals sit front and center.',
      'Bass is intentionally lean to prevent masking the vocal fundamental.',
    ],
    requires: { midRange: 1.5, presence: 1.0 },
    rejects: { subBassEnergy: 2.0 },
    bias: [0, 0, 0, 1.0, 2.5, 3.0, 1.5, 0.5, 0, 0],
    affinities: { presence: 2.0, midRange: 1.0 },
    priority: 6,
  },
  {
    name: 'Ultra Clarity',
    description: 'Maximum detail retrieval and upper-harmonic resolution',
    genre: 'Classical · Jazz · Audiophile',
    color: '#378ADD',
    insights: [
      'Upper harmonics lifted for microscopic instrument separation.',
      'Presence region tuned for forward transient attack on every note.',
    ],
    requires: { airDetail: 2.0, presence: 1.0 },
    rejects: { subBassEnergy: 2.0, midRange: 2.5 },
    bias: [0, 0, 0, -0.5, 0, 1.0, 2.5, 3.0, 2.0, 1.0],
    affinities: { airDetail: 2.0, presence: 1.5 },
    priority: 7,
  },
  {
    name: 'V-Excitement',
    description: 'Classic consumer V-curve — boosted bass and treble',
    genre: 'Rock · Pop · Outdoor Listening',
    color: '#D85A30',
    insights: [
      'Classic V-shaped fun curve — both ends of the spectrum amplified.',
      'Ideal for energetic listening when critical accuracy is secondary.',
    ],
    requires: { subBassEnergy: 0.8, airDetail: 0.8 },
    rejects: { flatness: 2.5, midRange: 2.5 },
    bias: [2.0, 1.5, 0, -1.5, -2.0, -1.5, 0, 1.5, 2.0, 2.5],
    affinities: { subBassEnergy: 1.0, airDetail: 1.0 },
    priority: 5,
  },
  {
    name: 'Harman Target',
    description: 'Research-based target curve for over-ear headphones',
    genre: 'Universal · Critical Listening',
    color: '#1D9E75',
    insights: [
      'Follows Harman International research — statistically preferred by most listeners.',
      'Gentle bass shelf, flat mids, slight treble dip around 6kHz.',
    ],
    requires: { flatness: 0.5 },
    rejects: { subBassEnergy: 2.5, airDetail: 2.5 },
    bias: [3.0, 2.0, 1.0, 0, -0.5, -0.5, -1.5, -2.0, -1.0, 0],
    affinities: { flatness: 1.5 },
    priority: 4,
  },
  {
    name: 'Studio Reference',
    description: 'Neutral flat response for accurate monitoring',
    genre: 'Mixing · Mastering · Production',
    color: '#888780',
    insights: [
      'Flat response — every frequency reproduced with equal weight.',
      'Optimized for critical listening where source accuracy is paramount.',
    ],
    requires: {},
    bias: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    affinities: { flatness: 2.0 },
    priority: 1,
  },
];

// ─── Contradiction Detector ───────────────────────────────────────────────────
interface Contradiction {
  scenarioA: string;
  choiceA: 'A' | 'B';
  scenarioB: string;
  choiceB: 'A' | 'B';
  description: string;
  penalty: number;
  bands: number[];
}

const CONTRADICTIONS: Contradiction[] = [
  {
    scenarioA: 'sub_bass',       choiceA: 'A',
    scenarioB: 'overall_balance', choiceB: 'B',
    description: 'Heavy sub preference conflicts with reference flat balance',
    penalty: 0.4, bands: [0, 1],
  },
  {
    scenarioA: 'high_frequency', choiceA: 'B',
    scenarioB: 'sibilance',      choiceB: 'A',
    description: 'Bright treble preference contradicts sibilance suppression',
    penalty: 0.5, bands: [6, 7, 8, 9],
  },
  {
    scenarioA: 'vocal_clarity',  choiceA: 'B',
    scenarioB: 'warmth_body',    choiceB: 'A',
    description: 'Crisp vocal presence conflicts with thick body warmth',
    penalty: 0.35, bands: [3, 4, 5],
  },
  {
    scenarioA: 'bass_depth',     choiceA: 'A',
    scenarioB: 'mid_punch',      choiceB: 'B',
    description: 'Deep bass boost conflicts with lean mid-punch preference',
    penalty: 0.3, bands: [1, 2, 3],
  },
];

// ─── Confidence Engine ────────────────────────────────────────────────────────
interface ConfidenceResult {
  score: number;
  contradictions: string[];
  dominantFeature: keyof FeatureScores | null;
  bandDampening: number[];
}

function computeConfidence(
  preferences: TuningPreference[],
  featureScores: FeatureScores
): ConfidenceResult {
  const prefMap = new Map(preferences.map(p => [p.scenario, p.choice]));
  const bandDampening = new Array(10).fill(1.0);
  const contradictionMessages: string[] = [];

  for (const c of CONTRADICTIONS) {
    if (prefMap.get(c.scenarioA) === c.choiceA && prefMap.get(c.scenarioB) === c.choiceB) {
      contradictionMessages.push(c.description);
      for (const band of c.bands) {
        bandDampening[band] = Math.min(bandDampening[band], 1 - c.penalty);
      }
    }
  }

  const values = Object.values(featureScores);
  const maxVal = Math.max(...values.map(Math.abs));
  const spread = maxVal > 0
    ? values.reduce((sum, v) => sum + Math.abs(v), 0) / (values.length * maxVal)
    : 0;

  const contradictionPenalty = contradictionMessages.length * 0.08;
  const confidenceScore = Math.max(0.3, Math.min(1.0, spread * 1.2 - contradictionPenalty));

  const featureEntries = Object.entries(featureScores) as [keyof FeatureScores, number][];
  const dominant = featureEntries.reduce((best, curr) =>
    Math.abs(curr[1]) > Math.abs(best[1]) ? curr : best, featureEntries[0]);
  const dominantFeature = Math.abs(dominant[1]) > 0.5 ? dominant[0] : null;

  return { score: confidenceScore, contradictions: contradictionMessages, dominantFeature, bandDampening };
}

// ─── Psychoacoustic Masking Filter ────────────────────────────────────────────
function applyMaskingFilter(gains: number[]): number[] {
  const result = [...gains];
  for (let i = 1; i < gains.length - 1; i++) {
    const maxNeighbor = Math.max(Math.abs(gains[i - 1]), Math.abs(gains[i + 1]));
    if (maxNeighbor > 4 && Math.abs(gains[i]) < maxNeighbor * 0.4) {
      result[i] = gains[i] * 0.75;
    }
  }
  return result;
}

// ─── Adaptive Smoothing ───────────────────────────────────────────────────────
function adaptiveSmooth(gains: number[], confidence: number): number[] {
  return gains.map((g, i) => {
    const prev = gains[i - 1] ?? g;
    const next = gains[i + 1] ?? g;
    const sf = 0.15 + (1 - confidence) * 0.2;
    return prev * sf + g * (1 - sf * 2) + next * sf;
  });
}

// ─── Soft Profile Scoring ─────────────────────────────────────────────────────
function scoreProfile(profile: ProfileDef, scores: FeatureScores): number {
  for (const [key, threshold] of Object.entries(profile.rejects ?? {})) {
  if ((scores[key as keyof FeatureScores] ?? 0) >= (threshold ?? 0)) {
    return -Infinity;
  }
  }

  let requireScore = 0;
  for (const [key, threshold = 0] of Object.entries(profile.requires)) {
    const actual = scores[key as keyof FeatureScores] ?? 0;
    requireScore += actual < threshold ? -(threshold - actual) * 2 : 1;
  }

  let affinityScore = 0;
  for (const [key, weight = 0] of Object.entries(profile.affinities ?? {})) {
    affinityScore += (scores[key as keyof FeatureScores] ?? 0) * weight;
  }

  return profile.priority * 1.5 + requireScore * 2.0 + affinityScore;
}

// ─── Dynamic Insight Generator ────────────────────────────────────────────────
function generateInsights(
  profile: ProfileDef,
  featureScores: FeatureScores,
  confidence: ConfidenceResult,
  finalGains: number[]
): string[] {
  const insights: string[] = [...profile.insights];

  if (confidence.score < 0.5) {
    insights.push('Mixed preferences detected — gains moderated for balanced output.');
  } else if (confidence.score > 0.8) {
    insights.push(`Strong preference signal — calibration confidence at ${Math.round(confidence.score * 100)}%.`);
  }

  if (confidence.contradictions.length > 0) {
    insights.push(`Conflicting preferences resolved: ${confidence.contradictions[0].toLowerCase()}.`);
  }

  const featureLabels: Record<keyof FeatureScores, string> = {
    subBassEnergy: 'deep sub-bass energy',
    midBassEnergy: 'mid-bass punch',
    midRange: 'midrange warmth',
    presence: 'vocal presence',
    airDetail: 'high-frequency detail',
    flatness: 'neutral reference',
  };

  if (confidence.dominantFeature && insights.length < 4) {
    insights.push(`Dominant signature: ${featureLabels[confidence.dominantFeature]} — all gains tuned around this axis.`);
  }

  const maxGainIdx = finalGains.reduce((best, g, i) =>
    Math.abs(g) > Math.abs(finalGains[best]) ? i : best, 0);
  const maxGain = finalGains[maxGainIdx];
  if (Math.abs(maxGain) > 3 && insights.length < 4) {
    const dir = maxGain > 0 ? 'boosted' : 'cut';
    insights.push(`Peak adjustment: ${BAND_LABELS[maxGainIdx]} ${dir} ${Math.abs(maxGain).toFixed(1)} dB.`);
  }

  return insights.slice(0, 4);
}

// ─── Sigmoid Normalization ────────────────────────────────────────────────────
function sigmoidGain(raw: number): number {
  return 12 * Math.tanh(raw / 8);
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export async function analyzePreferences(
  preferences: TuningPreference[]
): Promise<{ gains: number[]; profileName: string; insights: string[]; profile: EQProfile }> {
  console.group('SONIC AI Engine v3 — Upgraded Local Analysis');

  // Step 1: Accumulate raw gains & feature scores
  const rawGains = new Array(10).fill(0);
  const featureScores: FeatureScores = {
    subBassEnergy: 0, midBassEnergy: 0, midRange: 0,
    presence: 0, airDetail: 0, flatness: 0,
  };

  for (const pref of preferences) {
    const weights = WEIGHT_MATRIX[pref.scenario]?.[pref.choice];
    if (weights) for (let i = 0; i < 10; i++) rawGains[i] += weights[i];
    const rules = FEATURE_RULES[pref.scenario];
    if (rules) {
      for (const [feature, votes] of Object.entries(rules)) {
        featureScores[feature as keyof FeatureScores] += votes?.[pref.choice] ?? 0;
      }
    }
  }

  // Step 2: Confidence & contradiction analysis
  const confidence = computeConfidence(preferences, featureScores);
  console.log('Confidence:', confidence.score.toFixed(2), '| Contradictions:', confidence.contradictions.length);
  console.log('Feature scores:', { ...featureScores });

  // Step 3: Soft profile scoring
  const scoredProfiles = PROFILES
    .map(p => ({ profile: p, score: scoreProfile(p, featureScores) }))
    .filter(x => x.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  const bestProfile = scoredProfiles[0]?.profile ?? PROFILES[PROFILES.length - 1];
  console.log('Profile ranking top-3:', scoredProfiles.slice(0, 3).map(x => `${x.profile.name} (${x.score.toFixed(1)})`));

  // Step 4: Bias + confidence dampening
  const biasedGains = rawGains.map((g, i) => g + bestProfile.bias[i]);
  const dampenedGains = biasedGains.map((g, i) => g * confidence.bandDampening[i]);

  // Step 5: Sigmoid → masking → adaptive smooth
  const sigmoidGains = dampenedGains.map(sigmoidGain);
  const maskedGains = applyMaskingFilter(sigmoidGains);
  const finalGains = adaptiveSmooth(maskedGains, confidence.score);

  console.log('Final gains:', finalGains.map(g => g.toFixed(2)));
  console.groupEnd();

  const insights = generateInsights(bestProfile, featureScores, confidence, finalGains);

  const result: EQProfile = {
    name: bestProfile.name,
    description: bestProfile.description,
    genre: bestProfile.genre,
    color: bestProfile.color,
    gains: finalGains,
    insights,
  };

  return { gains: finalGains, profileName: bestProfile.name, insights, profile: result };
}

export function getProfileNames(): string[] {
  return PROFILES.map(p => p.name);
}

// ─── Utility: Explain calibration for debugging ───────────────────────────────
export function explainCalibration(preferences: TuningPreference[]): {
  featureVector: Record<string, number>;
  confidenceScore: number;
  contradictions: string[];
} {
  const featureScores: FeatureScores = {
    subBassEnergy: 0, midBassEnergy: 0, midRange: 0,
    presence: 0, airDetail: 0, flatness: 0,
  };
  for (const pref of preferences) {
    const rules = FEATURE_RULES[pref.scenario];
    if (rules) {
      for (const [feature, votes] of Object.entries(rules)) {
        featureScores[feature as keyof FeatureScores] += votes?.[pref.choice] ?? 0;
      }
    }
  }
  const confidence = computeConfidence(preferences, featureScores);
  return {
    featureVector: featureScores,
    confidenceScore: confidence.score,
    contradictions: confidence.contradictions,
  };
}

// Re-export DeviceProfile from profile-store for backwards compat
export type { DeviceProfile } from '@/lib/profile-store';
