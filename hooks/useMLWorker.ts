import { useRef, useCallback, useEffect } from 'react';

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: number;
}

export function useMLWorker(poolSize: number = 2) {
  const workersRef = useRef<Worker[]>([]);
  const currentWorkerIndex = useRef(0);
  const taskMapRef = useRef<Map<number, PendingTask>>(new Map());
  const taskCounterRef = useRef(0);

  const initWorkers = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (workersRef.current.length > 0) return;

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(
        new URL('@/public/workers/ml-inference.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent) => {
        const { taskId, success, result, error } = event.data;
        const pending = taskMapRef.current.get(taskId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          if (success) pending.resolve(result);
          else pending.reject(new Error(error));
          taskMapRef.current.delete(taskId);
        }
      };

      worker.onerror = (err) => {
        console.error('Worker error, restarting...', err);
        // Auto‑restart this worker
        const index = workersRef.current.indexOf(worker);
        if (index !== -1) {
          workersRef.current.splice(index, 1);
          const newWorker = new Worker(
            new URL('@/public/workers/ml-inference.worker.ts', import.meta.url),
            { type: 'module' }
          );
          
          newWorker.onmessage = worker.onmessage;
          newWorker.onerror = worker.onerror;

          workersRef.current.push(newWorker);
        }
      };

      workersRef.current.push(worker);
    }
  }, [poolSize]);

  const runTask = useCallback(
    (task: string, payload: any, transferable: Transferable[] = []): Promise<any> => {
      return new Promise((resolve, reject) => {
        initWorkers();
        if (workersRef.current.length === 0) {
          reject(new Error('No workers available'));
          return;
        }

        const taskId = ++taskCounterRef.current;
        const timeoutId = window.setTimeout(() => {
          if (taskMapRef.current.has(taskId)) {
            reject(new Error('Worker task timeout'));
            taskMapRef.current.delete(taskId);
          }
        }, 5000) as unknown as number;

        taskMapRef.current.set(taskId, { resolve, reject, timeoutId });

        // Round‑robin load balancing
        const worker = workersRef.current[currentWorkerIndex.current % workersRef.current.length];
        currentWorkerIndex.current++;

        // Optimize: transfer large arrays (e.g., spectrum)
        worker.postMessage({ task, payload, taskId }, transferable);
      });
    },
    [initWorkers]
  );

  // Fallback function when workers are not supported
  const runTaskInline = useCallback((task: string, payload: any): Promise<any> => {
    // simple synchronous fallback (for demo)
    return new Promise((resolve) => {
      if (task === 'classify-genre') resolve({ genre: 'electronic', confidence: 0.7 });
      else if (task === 'predict-eq') resolve(Array(10).fill(0));
      else resolve({ arousal: 0.5, valence: 0.6 });
    });
  }, []);

  useEffect(() => {
    return () => {
      workersRef.current.forEach(worker => worker.terminate());
      workersRef.current = [];
    };
  }, []);

  return { runTask, runTaskInline, isSupported: typeof Worker !== 'undefined' };
}
