'use client';

import { useState, useEffect, useCallback } from 'react';

export type OnboardingStep = 'welcome' | 'load_track' | 'calibrate_hint' | 'complete' | null;

export function useOnboarding() {
  const [step, setStep] = useState<OnboardingStep>(null);
  const [hasCalibrated, setHasCalibrated] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem('sonic_onboarded_v2');
    if (!done) {
      // Delay slightly to ensure layout is ready
      const timer = setTimeout(() => {
        setStep('welcome');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const advance = useCallback(() => {
    setStep(prev => {
      const flow: OnboardingStep[] = ['welcome', 'load_track', 'calibrate_hint'];
      const currentIndex = flow.indexOf(prev);
      if (currentIndex !== -1 && currentIndex < flow.length - 1) {
        return flow[currentIndex + 1];
      }
      if (prev === 'calibrate_hint') return null;
      if (prev === 'complete') {
        localStorage.setItem('sonic_onboarded_v2', 'true');
        return null;
      }
      return null;
    });
  }, []);

  const completeCalibration = useCallback(() => {
    const done = localStorage.getItem('sonic_onboarded_v2');
    if (!done && !hasCalibrated) {
      setStep('complete');
      setHasCalibrated(true);
    }
  }, [hasCalibrated]);

  const skip = useCallback(() => {
    localStorage.setItem('sonic_onboarded_v2', 'true');
    setStep(null);
  }, []);

  return {
    step,
    setStep,
    advance,
    skip,
    completeCalibration
  };
}

export type useOnboardingReturn = ReturnType<typeof useOnboarding>;
