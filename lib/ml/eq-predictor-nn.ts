import * as tf from '@tensorflow/tfjs';
import { logger } from '@/lib/logger';

// Cache predictions to reuse
const predictionCache = new Map<string, { gains: number[], qs: number[] }>();

export class EQPredictorNN {
  private model: tf.LayersModel | null = null;
  private isInitializing = false;

  constructor() {}

  async initialize() {
    if (this.model || this.isInitializing) return;
    this.isInitializing = true;
    try {
      this.model = this.buildModel();
      // Compile model
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });
      logger.info('EQ Predictor NN model initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize EQ Predictor NN model', err);
    } finally {
      this.isInitializing = false;
    }
  }

  private buildModel(): tf.LayersModel {
    // Input: 256D spectral features (log-power spectrum)
    const input = tf.input({ shape: [256, 1] });

    // Encoder: 2 × Conv1D (32 filters, kernel=3)
    let x = tf.layers.conv1d({ filters: 32, kernelSize: 3, activation: 'relu', padding: 'same' }).apply(input) as tf.SymbolicTensor;
    x = tf.layers.maxPooling1d({ poolSize: 2 }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.conv1d({ filters: 32, kernelSize: 3, activation: 'relu', padding: 'same' }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.maxPooling1d({ poolSize: 2 }).apply(x) as tf.SymbolicTensor;

    // Flatten
    x = tf.layers.flatten().apply(x) as tf.SymbolicTensor;

    // Bottleneck: Dense (64 units) + Dropout(0.2)
    x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;

    // Output: 10D (10-band EQ gains) + 10D (Q factors)
    const output = tf.layers.dense({ units: 20, activation: 'linear' }).apply(x) as tf.SymbolicTensor;

    return tf.model({ inputs: input, outputs: output });
  }

  async predict(features256: number[]): Promise<{ gains: number[], qs: number[] }> {
    if (features256.length !== 256) {
      throw new Error('Expected 256D feature vector');
    }

    const cacheKey = features256.map(v => Math.round(v * 100)).join(',');
    if (predictionCache.has(cacheKey)) {
      return predictionCache.get(cacheKey)!;
    }

    if (!this.model) {
      await this.initialize();
    }

    return tf.tidy(() => {
      const inputTensor = tf.tensor3d(features256, [1, 256, 1]);
      
      const pStart = performance.now();
      const outputTensor = this.model!.predict(inputTensor) as tf.Tensor;
      const data = outputTensor.dataSync();
      const pEnd = performance.now();
      
      logger.debug(`[PERF] EQPredictorNN Inference: ${(pEnd - pStart).toFixed(2)}ms`);

      const gains = Array.from(data.slice(0, 10));
      // Bounding Q-factors to sensible defaults (0.1 to 10.0)
      const qs = Array.from(data.slice(10, 20)).map(q => Math.max(0.1, Math.min(10, q)));

      const result = { gains, qs };
      predictionCache.set(cacheKey, result);
      
      // Keep cache size bounded
      if (predictionCache.size > 100) {
        const firstKey = predictionCache.keys().next().value;
        if (firstKey !== undefined) {
          predictionCache.delete(firstKey);
        }
      }

      return result;
    });
  }

  // Placeholder for WebWorker offline training
  trainOffline(dataset: { input: number[], output: number[] }[]) {
     logger.info(`Started offline training with ${dataset.length} samples. This should be offloaded to a WebWorker.`);
     // To actualize this without blocking the main UI:
     // - Send data via postMessage to a worker
     // - The worker runs model.fit() using tfjs in WebWorker context
     // - Send updated weights back or save to IndexedDB (tf.io.browserIndexedDB)
  }
}

export const eqPredictorNN = new EQPredictorNN();
