'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ear, Check, X, Info, Activity, History } from 'lucide-react';
import { useHearingTest } from '@/hooks/useHearingTest';
import { useAudioEngine } from '@/lib/audio-engine-context';

interface HearingTestWizardProps {
  onClose: () => void;
  onComplete: (testResult: any) => void;
}

export const HearingTestWizard: React.FC<HearingTestWizardProps> = ({ onClose, onComplete }) => {
  const engine = useAudioEngine();
  const test = useHearingTest();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    if (test.isTestRunning) {
      const trigger = async () => {
        if (!engine) return;
        // Avoid synchronous state update within effect
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!active) return;
        setIsPlaying(true);
        await engine.playPureTone(test.currentFrequency, test.currentDb);
        if (!active) return;
        setIsPlaying(false);
      };
      trigger();
    }
    return () => { active = false; };
  }, [test.step, test.isTestRunning, engine, test.currentFrequency, test.currentDb]);

  const playTone = useCallback(async () => {
    if (!engine) return;
    setIsPlaying(true);
    await engine.playPureTone(test.currentFrequency, test.currentDb);
    setIsPlaying(false);
  }, [engine, test.currentFrequency, test.currentDb]);

  const handleResponse = (heard: boolean) => {
    test.handleResponse(heard);
  };

  const progress = (test.step / test.totalTrials) * 100;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#151619] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-8 sm:p-10">
          {!test.isTestRunning && !test.testResult ? (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Ear className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Bayesian Hearing Assessment</h2>
              <p className="text-sm text-[#8E9299] leading-relaxed">
                This test uses an adaptive probabilistic model to estimate your hearing threshold across 6 frequencies (250Hz - 8kHz). 
                We will play a series of tones. Please wear headphones in a quiet environment.
              </p>
              <div className="pt-4 space-y-3">
                <button
                  onClick={test.startTest}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                >
                  Start Assessment
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-[#8E9299] text-sm font-semibold rounded-2xl transition-all"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          ) : test.isTestRunning ? (
            <div className="space-y-10 text-center">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Assessment Progress</span>
                  <span className="text-[10px] font-mono text-blue-400">{test.step} / {test.totalTrials}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-blue-500" 
                    animate={{ width: `${progress}%` }} 
                  />
                </div>
              </div>

              <div className="py-8 space-y-6">
                <div className="relative inline-block">
                   <div className={`w-24 h-24 rounded-full border-2 ${isPlaying ? 'border-blue-400 scale-110' : 'border-white/10'} transition-all duration-300 flex items-center justify-center`}>
                      <Activity className={`w-10 h-10 ${isPlaying ? 'text-blue-400' : 'text-white/20'}`} />
                   </div>
                   {isPlaying && (
                     <motion.div
                       animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                       transition={{ repeat: Infinity, duration: 1 }}
                       className="absolute inset-0 rounded-full bg-blue-400/20"
                     />
                   )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">{test.currentFrequency} Hz</h3>
                  <p className="text-xs text-[#8E9299] font-mono uppercase tracking-[0.2em]">Did you hear the tone?</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleResponse(true)}
                  disabled={isPlaying}
                  className="flex flex-col items-center gap-3 p-6 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-3xl transition-all group disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Yes</span>
                </button>
                <button
                  onClick={() => handleResponse(false)}
                  disabled={isPlaying}
                  className="flex flex-col items-center gap-3 p-6 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-3xl transition-all group disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                  <span className="text-xs font-bold text-red-400 uppercase tracking-widest">No</span>
                </button>
              </div>

              <div className="pt-2">
                 <button 
                   onClick={playTone}
                   className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest hover:text-white transition-colors"
                 >
                   Replay Tone
                 </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-center">
               <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Assessment Complete</h2>
              <p className="text-sm text-[#8E9299] leading-relaxed">
                Your hearing profile has been calibrated. We have generated an equal loudness contour to compensate for any sensitivity variations.
              </p>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-bold">Inference Results</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(test.testResult.audiogram).map(([f, v]: [string, any]) => (
                    <div key={f} className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5">
                      <span className="text-[9px] font-mono text-[#8E9299]">{f}Hz</span>
                      <span className="text-[11px] font-bold text-white">{v.mu.toFixed(1)} dB</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={() => onComplete(test.testResult)}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl transition-all"
                >
                  Apply Compensation
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
