import * as tf from '@tensorflow/tfjs';
import { logger } from '@/lib/logger';
import { MusicGenre } from '@/lib/ai-engine-v2';

export interface UserPreferenceData {
  eqHistory: number[][]; // Last 100 EQ settings [100, 10]
  genre: MusicGenre;     // Current genre
  loudnessPref: number;  // Scalar preference [-1, 1]
}

const GENRE_MAP: Record<MusicGenre, number> = {
  'classical': 0, 'jazz': 1, 'folk': 2, 'acoustic': 3,
  'pop': 4, 'rock': 5, 'indie': 6, 'alternative': 7,
  'hip-hop': 8, 'rap': 9, 'r&b': 10, 'soul': 11,
  'edm': 12, 'house': 13, 'techno': 14, 'trance': 15,
  'metal': 16, 'punk': 17, 'country': 18, 'latin': 19,
  'ambient': 20, 'experimental': 21, 'unknown': 22
};

export class PreferenceEncoder {
  private model: tf.LayersModel | null = null;
  private isInitializing = false;
  private numGenres = Object.keys(GENRE_MAP).length;

  constructor() {}

  async initialize() {
    if (this.model || this.isInitializing) return;
    this.isInitializing = true;
    try {
      this.model = this.buildModel();
      logger.info('Preference Encoder initialized');
    } catch (err) {
      logger.error('Failed to initialize Preference Encoder', err);
    } finally {
      this.isInitializing = false;
    }
  }

  private buildModel(): tf.LayersModel {
    // 1. EQ History [100, 10] -> 32D Embedding
    const historyInput = tf.input({ shape: [100, 10], name: 'history' });
    let h = tf.layers.flatten().apply(historyInput) as tf.SymbolicTensor;
    const historyEmbedding = tf.layers.dense({ units: 32, activation: 'relu', name: 'history_emb' }).apply(h) as tf.SymbolicTensor;

    // 2. Genre [1] -> 16D Embedding
    const genreInput = tf.input({ shape: [1], name: 'genre' });
    const genreEmbedding = tf.layers.embedding({ 
      inputDim: this.numGenres, 
      outputDim: 16, 
      name: 'genre_emb' 
    }).apply(genreInput) as tf.SymbolicTensor;
    const genreFlattened = tf.layers.flatten().apply(genreEmbedding) as tf.SymbolicTensor;

    // 3. Loudness [1] -> 1D Scalar
    const loudnessInput = tf.input({ shape: [1], name: 'loudness' });

    // 4. Concatenate all features
    const combined = tf.layers.concatenate().apply([historyEmbedding, genreFlattened, loudnessInput]) as tf.SymbolicTensor;

    // 5. Output: 10D Bias Vector
    let x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(combined) as tf.SymbolicTensor;
    const biasOutput = tf.layers.dense({ units: 10, activation: 'linear', name: 'bias_vector' }).apply(x) as tf.SymbolicTensor;

    return tf.model({ inputs: [historyInput, genreInput, loudnessInput], outputs: biasOutput });
  }

  async encode(data: UserPreferenceData): Promise<number[]> {
    if (!this.model) {
      await this.initialize();
    }

    if (!this.model) throw new Error('Model failed to initialize');

    return tf.tidy(() => {
      // Prepare history tensor [1, 100, 10]
      const paddedHistory = [...data.eqHistory];
      while (paddedHistory.length < 100) {
        paddedHistory.push(new Array(10).fill(0));
      }
      const historyTensor = tf.tensor3d([paddedHistory.slice(-100)], [1, 100, 10]);

      // Prepare genre tensor [1, 1]
      const genreIndex = GENRE_MAP[data.genre] ?? GENRE_MAP['unknown'];
      const genreTensor = tf.tensor2d([[genreIndex]], [1, 1]);

      // Prepare loudness tensor [1, 1]
      const loudnessTensor = tf.tensor2d([[data.loudnessPref]], [1, 1]);

      const pStart = performance.now();
      const output = this.model!.predict([historyTensor, genreTensor, loudnessTensor]) as tf.Tensor;
      const bias = Array.from(output.dataSync());
      const pEnd = performance.now();

      logger.debug(`[PERF] PreferenceEncoder Inference: ${(pEnd - pStart).toFixed(2)}ms`);

      return bias;
    });
  }
}

export const preferenceEncoder = new PreferenceEncoder();
