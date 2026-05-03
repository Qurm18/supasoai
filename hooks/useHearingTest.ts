'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { 
  initAudiogram, 
  Frequency, 
  Audiogram, 
  selectNextDb, 
  runTrial 
} from '@/lib/hearing/audiometry-test';
import { predictHearingCurve, generateContour } from '@/lib/hearing/loudness-contours';

import { UseHearingTestReturn } from '@/lib/types';

export function useHearingTest(): UseHearingTestReturn {
  const [showHearingTest, setShowHearingTest] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [audiogram, setAudiogram] = useState<Audiogram>(initAudiogram());
  const [currentFrequency, setCurrentFrequency] = useState<Frequency>(1000);
  const [currentDb, setCurrentDb] = useState(20);
  const [testResult, setTestResult] = useState<any>(null);
  
  const frequencies = useMemo<Frequency[]>(() => [250, 500, 1000, 2000, 4000, 8000], []);
  const trialsPerFreq = 8;
  const totalTrials = frequencies.length * trialsPerFreq;

  const startTest = useCallback(() => {
    setAudiogram(initAudiogram());
    setStep(0);
    setIsTestRunning(true);
    setCurrentFrequency(frequencies[0]); 
    setCurrentDb(20);
    setTestResult(null);
  }, [frequencies]);

  const handleResponse = useCallback((heard: boolean) => {
    const nextAudiogram = runTrial(audiogram, currentFrequency, currentDb, heard);
    setAudiogram(nextAudiogram);
    
    const nextStep = step + 1;
    if (nextStep >= totalTrials) {
      // Test finished
      setIsTestRunning(false);
      
      const flatAudiogram = Object.entries(nextAudiogram).map(([f, v]) => ({
        f: Number(f),
        threshold: v.mu
      }));
      
      // Full curve prediction using GP
      const fullFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const curve = predictHearingCurve(fullFreqs, flatAudiogram);
      const contour = generateContour(curve);
      
      setTestResult({
        audiogram: nextAudiogram,
        curve,
        contour
      });
      return;
    }

    setStep(nextStep);
    
    // Choose next frequency and intensity
    const freqIdx = Math.floor(nextStep / trialsPerFreq);
    const nextFreq = frequencies[freqIdx];
    setCurrentFrequency(nextFreq);
    
    const nextDb = selectNextDb(nextAudiogram[nextFreq]);
    setCurrentDb(nextDb);
  }, [audiogram, currentFrequency, currentDb, step, totalTrials, frequencies]);

  return {
    showHearingTest,
    setShowHearingTest,
    isTestRunning,
    setIsTestRunning,
    step,
    totalTrials,
    currentFrequency,
    currentDb,
    audiogram,
    testResult,
    startTest,
    handleResponse
  };
}
