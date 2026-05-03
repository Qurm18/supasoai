'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Activity, Sparkles } from 'lucide-react';

interface AdaptiveEQModuleProps {
  isAdaptiveMode: boolean;
  setIsAdaptiveMode: (val: boolean) => void;
  stability: number;
  sectionType: string;
  setSectionType: (val: 'intro' | 'verse' | 'chorus' | 'drop' | 'outro') => void;
  profileName: string | null;
}

export function AdaptiveEQModule({
  isAdaptiveMode,
  setIsAdaptiveMode,
  stability,
  sectionType,
  setSectionType,
  profileName,
}: AdaptiveEQModuleProps) {
  const mounted = React.useSyncExternalStore(() => () => {}, () => true, () => false);

  return (
    <div className="relative rounded-2xl p-5 border border-white/10 overflow-hidden flex flex-col tracking-tight group transition-all duration-500 hover:border-white/20 bg-gradient-to-br from-[#0a0a0f] to-[#12121a]">
      {/* Background Neural Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative z-10 flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-white/10">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">Neural Engine</h3>
            <p className="text-[9px] text-white/40 uppercase font-mono tracking-widest mt-0.5">Psychoacoustic Core</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdaptiveMode(!isAdaptiveMode)}
          className={`w-10 h-5 rounded-full relative transition-all duration-300 shadow-inner ${isAdaptiveMode ? 'bg-orange-500' : 'bg-white/10'}`}
        >
          <motion.div
            animate={{ x: isAdaptiveMode ? 22 : 2 }}
            initial={false}
            className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          />
        </button>
      </div>

      {isAdaptiveMode ? (
        <div className="relative z-10 flex flex-col gap-4 h-full">
          <div className="px-4 py-3 rounded-xl bg-black/40 border border-white/5 shadow-inner">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Adapt Stability</span>
              <span className="text-[10px] font-mono text-orange-400 font-bold">
                {mounted ? (stability * 100).toFixed(0) : '0'}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5 shadow-inner">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: mounted ? stability : 0 }}
                className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-amber-200 origin-left"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 shadow-inner flex flex-col transition-colors hover:bg-white/5">
              <div className="text-[8px] font-mono text-white/40 uppercase tracking-wider mb-2">Contextual Role</div>
              <select
                value={sectionType}
                onChange={(e) => setSectionType(e.target.value as 'intro' | 'verse' | 'chorus' | 'drop' | 'outro')}
                className="w-full bg-transparent text-xs font-medium text-white/90 outline-none cursor-pointer appearance-none"
              >
                <option value="intro" className="bg-[#12121a]">Intro Analysis</option>
                <option value="verse" className="bg-[#12121a]">Verse Tracking</option>
                <option value="chorus" className="bg-[#12121a]">Chorus Expand</option>
                <option value="drop" className="bg-[#12121a]">Drop Impact</option>
                <option value="outro" className="bg-[#12121a]">Outro Decay</option>
              </select>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 shadow-inner flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-green-400/5 blur-xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
              <div className="text-[8px] font-mono text-white/40 uppercase tracking-wider mb-1 z-10">Sensory State</div>
              <div className="text-xs font-mono text-green-400 flex items-center gap-2 z-10 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-[ping_2s_ease-out_infinite]" />
                ACTIVE
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-50">
           <div className="w-12 h-12 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-1">
             <Activity className="w-5 h-5 text-white/30" />
           </div>
           <div className="text-xs font-mono uppercase tracking-widest text-white/60">Neural Loop Offline</div>
        </div>
      )}
    </div>
  );
}
