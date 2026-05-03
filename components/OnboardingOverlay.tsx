'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Music, Zap, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { OnboardingStep } from '@/hooks/useOnboarding';

interface OnboardingOverlayProps {
  step: OnboardingStep;
  onAdvance: () => void;
  onSkip: () => void;
  isAudioReady: boolean;
}

export function OnboardingOverlay({ step, onAdvance, onSkip, isAudioReady }: OnboardingOverlayProps) {
  const bars = React.useMemo(() => {
    return [...Array(24)].map((_, i) => ({
      height: [20, 80 + ((i * 17) % 10) * 20, 20],
      duration: 2 + ((i * 7) % 5) * 0.4,
      delay: i * 0.1,
    }));
  }, []);

  if (!step) return null;

  return (
    <AnimatePresence mode="wait">
      {step === 'welcome' && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md overflow-hidden"
        >
          {/* Animated Background Waveform */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            {bars.map((bar, i) => (
              <motion.div
                key={i}
                animate={{
                  height: bar.height,
                  opacity: [0.1, 0.4, 0.1],
                }}
                transition={{
                  duration: bar.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: bar.delay,
                }}
                className="w-1.5 mx-1.5 bg-[#F27D26] rounded-full"
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className="relative z-10 text-center max-w-lg px-6"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 mx-auto mb-8 relative"
            >
              <div className="absolute inset-0 bg-[#F27D26] blur-3xl opacity-30" />
              <div className="w-full h-full border-2 border-dashed border-[#F27D26]/30 rounded-full animate-spin-slow" />
              <Sparkles className="w-16 h-16 text-[#F27D26] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </motion.div>

            <h1 className="text-6xl font-black tracking-tighter text-white mb-4">
              SONIC <span className="text-[#F27D26]">AI</span>
            </h1>
            <p className="text-xl text-white/60 mb-12 font-medium tracking-tight">
              Your sound. Learned. Perfected.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onAdvance}
                className="group relative px-10 py-5 bg-[#F27D26] text-black font-black uppercase tracking-widest text-xs rounded-2xl overflow-hidden transition-all active:scale-95 shadow-[0_20px_60px_rgba(242,125,38,0.4)] hover:shadow-[0_20px_80px_rgba(242,125,38,0.6)]"
              >
                <span className="relative flex items-center gap-2">
                  Start Calibrating <ChevronRight className="w-4 h-4" />
                </span>
              </button>
              <button
                onClick={onSkip}
                className="px-10 py-5 bg-white/5 text-white/50 hover:text-white font-bold uppercase tracking-widest text-xs rounded-2xl transition-all hover:bg-white/10 active:scale-95"
              >
                Skip &mdash; I&apos;m a Pro
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {(step === 'load_track' || step === 'calibrate_hint') && (
        <motion.div 
          key="onboarding-tooltips"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] pointer-events-none"
        >
          {/* Dimmed background overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          
          {step === 'load_track' && (
            <Tooltip 
              title="Step 1: Load Music" 
              content="Drop a track you know well &mdash; something you&apos;ve heard a thousand times. Jazz, acoustic guitar, or vocal-heavy tracks work best."
              icon={<Music className="w-5 h-5 text-[#F27D26]" />}
              onNext={onAdvance}
              className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              onClose={onSkip}
            />
          )}

          {step === 'calibrate_hint' && (
            <Tooltip 
              title="Step 2: AI Calibrate" 
              content="Let AI listen with you. It learns your taste in 15 rounds and constructs a unique sonic profile for your exact setup."
              icon={<Zap className="w-5 h-5 text-amber-400" />}
              onNext={onAdvance}
              className="top-24 right-8 lg:right-24"
              onClose={onSkip}
            />
          )}
        </motion.div>
      )}

      {step === 'complete' && (
        <motion.div
           key="complete"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className="bg-[#0f1013] border border-[#F27D26]/20 rounded-[3rem] p-12 max-w-md text-center relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#F27D26] to-transparent shadow-[0_0_20px_#F27D26]" />
            
            <div className="w-20 h-20 bg-[#F27D26]/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-[#F27D26]/20">
              <CheckCircle2 className="w-10 h-10 text-[#F27D26]" />
            </div>

            <h2 className="text-3xl font-black text-white tracking-tighter mb-4">Sonic Profile Created</h2>
            <p className="text-[#8E9299] text-base mb-10 leading-relaxed font-medium">
              We&apos;ve mapped your hearing landscape. Warm mids and controlled sub-bass have been balanced for your current environment.
            </p>

            <button
               onClick={onSkip}
               className="w-full py-5 bg-[#F27D26] text-black font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 shadow-[0_10px_40px_rgba(242,125,38,0.3)] hover:shadow-[0_10px_60px_rgba(242,125,38,0.5)]"
            >
              Start Full Listening
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Tooltip({ title, content, icon, onNext, className, onClose }: { 
  title: string, 
  content: string, 
  icon: React.ReactNode, 
  onNext: () => void, 
  onClose: () => void,
  className?: string 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`absolute z-[210] w-80 bg-[#141518]/90 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl pointer-events-auto ${className}`}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-lg text-white/20 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
          {icon}
        </div>
        <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
      </div>
      
      <p className="text-[13px] text-white/50 leading-relaxed mb-6 font-medium">
        {content}
      </p>
      
      <button
        onClick={onNext}
        className="w-full py-3 bg-[#F27D26] text-black font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[#F27D26]/10"
      >
        Continue <ChevronRight className="w-3 h-3" />
      </button>
    </motion.div>
  );
}
