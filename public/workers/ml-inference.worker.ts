import { genreClassifier } from '../../lib/ml/genre-classifier';
import { dynamicEQEngine } from '../../lib/ml/dynamic-eq-engine';
import { moodEnergyEstimator } from '../../lib/ml/mood-energy';

self.onmessage = async (event: MessageEvent) => {
  const { task, payload, taskId, transferList } = event.data;

  try {
    let result: any;
    switch (task) {
      case 'classify-genre':
        result = genreClassifier.classify(payload.spectrum, payload.peaks);
        break;
      case 'predict-eq':
        result = dynamicEQEngine.calculateOptimalEQ(payload.genre, payload.mood);
        break;
      case 'estimate-mood':
        // Providing empty array for backward compatibility if signature is wider
        result = moodEnergyEstimator.estimate(payload.rms, payload.centroid, payload.flux, payload.raw);
        break;
      default:
        throw new Error(`Unknown task: ${task}`);
    }

    // Transfer large arrays back if possible
    const transfer: Transferable[] = [];
    if (result && result.largeArray instanceof Float32Array) {
      transfer.push(result.largeArray.buffer);
    }

    self.postMessage({ success: true, result, taskId }, { transfer });
  } catch (error) {
    self.postMessage({ success: false, error: (error as Error).message, taskId });
  }
};
