'use client';


import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EQBand } from '@/lib/audio-engine';
import { Settings, Plus, Minus, ChevronUp, ChevronDown, RotateCcw, Power } from 'lucide-react';
import { bandZoneLabel, qToBandwidthOct } from '@/lib/profile-store';
import { InfoTooltip } from './InfoTooltip';

interface EQPanelProps {
  bands: EQBand[];
  onBandChange: (index: number, params: Partial<EQBand>) => void;
  preAmp: number;
  onPreAmpChange: (val: number) => void;
  phaseMode: 'iir' | 'fir' | 'hybrid';
  onPhaseModeChange: (mode: 'iir' | 'fir' | 'hybrid') => void;
  dynamicEqMaster: boolean;
  onDynamicEqMasterChange: (val: boolean) => void;
  spectralPeaks?: number[];
  dynamicGains?: number[];
}

const BAND_ZONE_COLORS: Record<string, string> = {
  'Sub-Bass':  '#7c3aed',
  'Bass':      '#6366f1',
  'Low-Mid':   '#0ea5e9',
  'Mid':       '#10b981',
  'High-Mid':  '#facc15',
  'Presence':  '#fb923c',
  'Air':       '#f43f5e',
};

const ZONE_EFFECT_MAP: Record<string, 'fire' | 'plasma' | 'lightning'> = {
  'Sub-Bass': 'fire',
  'Bass': 'fire',
  'Low-Mid': 'plasma',
  'Mid': 'plasma',
  'High-Mid': 'lightning',
  'Presence': 'lightning',
  'Air': 'lightning',
};

// --- Effect Components ---

function DynamicAetherTrail({ color, intensity, heightPct }: { color: string; intensity: number; heightPct: number }) {
  const isUp = heightPct < 0;
  
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-visible h-0 flex justify-center">
      {/* Main core glow trail */}
      <motion.div
        animate={{
          height: [`${Math.abs(heightPct)}%`, `${Math.abs(heightPct) * 0.8}%`, `${Math.abs(heightPct)}%`],
          opacity: [0.3 * intensity, 0.6 * intensity, 0.3 * intensity],
        }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-1 rounded-full blur-[2px] mix-blend-screen"
        style={{
          backgroundColor: color,
          bottom: isUp ? 'auto' : 0,
          top: isUp ? 0 : 'auto',
          boxShadow: `0 0 15px ${color}`,
        }}
      />
      
      {/* Expanding aura at the dynamic peak */}
      <motion.div
        animate={{
          scale: [1, 2.5 + intensity],
          opacity: [0.4 * intensity, 0],
        }}
        transition={{ duration: 0.4, repeat: Infinity, ease: "easeOut" }}
        className="absolute w-6 h-6 rounded-full border border-white/40 blur-[1px]"
        style={{
          top: `${heightPct * 0.45}px`, // approximate mapping
          transform: 'translateY(-50%)',
          backgroundColor: `${color}22`
        }}
      />

      {/* Floating particles or "sparks" near the peak */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [heightPct * 0.45, heightPct * 0.45 + (i - 1) * 20],
            x: [(i - 1) * 10, (i - 1) * 20],
            opacity: [1, 0],
            scale: [1, 0],
          }}
          transition={{
            duration: 0.6 + i * 0.1,
            repeat: Infinity,
            delay: i * 0.2
          }}
          className="absolute w-1 h-1 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}
        />
      ))}
    </div>
  );
}

function BandDynamicEffect({ zone, accent, intensity, heightPct }: { zone: string; accent: string; intensity: number; heightPct: number }) {
  return (
    <DynamicAetherTrail 
      color={accent} 
      intensity={intensity} 
      heightPct={heightPct} 
    />
  );
}

// 1. Gain delta indicator — compares current value with A/B snapshot
function GainDeltaBadge({ current, snapshot }: { current: number; snapshot: number | null }) {
  if (snapshot === null) return null;
  const delta = current - snapshot;
  if (Math.abs(delta) < 0.1) return null;
  
  return (
    <span className={`text-[8px] font-mono tabular-nums ${delta > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
    </span>
  );
}

// 2. Spectral peak indicator — shows if a band is nearing clipping
function SpectralWarning({ peakDb }: { peakDb: number }) {
  if (peakDb === undefined || peakDb === null || isNaN(peakDb) || peakDb < -3) return null; // Warn only when nearing 0dB
  return (
    <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor] ${
      peakDb > 0 ? 'bg-red-500 text-red-500' : 'bg-amber-400 text-amber-400'
    }`} title={`Peak: ${peakDb.toFixed(1)} dB`} />
  );
}

export const EQPanel: React.FC<EQPanelProps> = React.memo(({ 
  bands, 
  onBandChange, 
  preAmp, 
  onPreAmpChange,
  phaseMode,
  onPhaseModeChange,
  dynamicEqMaster,
  onDynamicEqMasterChange,
  spectralPeaks,
  dynamicGains
}) => {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const [snapshotGains, setSnapshotGains] = React.useState<number[] | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      let k = sessionStorage.getItem('_tab_id');
      if (!k) {
        k = Math.random().toString(36).slice(2);
        sessionStorage.setItem('_tab_id', k);
      }
      const key = 'eq_snapshot_a_' + k;
      const stored = sessionStorage.getItem(key);
      return stored ? (JSON.parse(stored) as number[]) : null;
    } catch {
      return null;
    }
  });

  const ssKeyRef = React.useRef<string>(
    typeof window !== 'undefined'
      ? (() => {
          try {
            let k = sessionStorage.getItem('_tab_id') || 'default';
            return 'eq_snapshot_a_' + k;
          } catch {
            return 'eq_snapshot_a';
          }
        })()
      : 'eq_snapshot_a'
  );

  // Re-sync ssKeyRef in an effect if necessary, but lazy initialization is usually enough for the ref's first value
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        let k = sessionStorage.getItem('_tab_id');
        if (k) ssKeyRef.current = 'eq_snapshot_a_' + k;
      } catch {}
    }
  }, []);
  const [isComparingSnapshot, setIsComparingSnapshot] = React.useState(false);
  const [snapshotB, setSnapshotB] = React.useState<number[] | null>(null);

  const handleSaveA = () => {
    const gains = bands.map(b => b.gain);
    setSnapshotGains(gains);
    setIsComparingSnapshot(false);
    try { sessionStorage.setItem(ssKeyRef.current, JSON.stringify(gains)); } catch {}
  };
  
  const handleCompareA = () => {
    if (!snapshotGains) return;
    if (isComparingSnapshot) {
      if (snapshotB) {
        snapshotB.forEach((g, i) => onBandChange(i, { gain: g }));
      }
      setIsComparingSnapshot(false);
    } else {
      setSnapshotB(bands.map(b => b.gain));
      snapshotGains.forEach((g, i) => onBandChange(i, { gain: g }));
      setIsComparingSnapshot(true);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Precision EQ Control center */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-[#121215]/80 rounded-3xl border border-white/5 backdrop-blur-2xl relative z-20 shadow-2xl">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col min-w-[100px]">
            <span className="text-[9px] font-mono text-[#8E9299] uppercase tracking-widest leading-none mb-1">Gain Control</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tabular-nums">
                {preAmp > 0 ? `+${preAmp.toFixed(1)}` : preAmp.toFixed(1)} dB
              </span>
              {preAmp < -0.1 && (
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 leading-none"
                  title={`Auto-compensated to prevent clipping.`}
                >
                  LIMIT {preAmp.toFixed(1)} dB
                </span>
              )}
            </div>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            value={preAmp}
            onChange={(e) => onPreAmpChange(parseFloat(e.target.value))}
            className="flex-1 md:w-56 sonic-range cursor-pointer"
          />
          <button
            onClick={() => onPreAmpChange(0)}
            className="p-1.5 text-[#8E9299] hover:text-white hover:bg-white/5 rounded-md transition-all"
            title="Reset gain"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveA}
            className="px-3 py-1.5 text-[10px] font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all shadow-lg active:scale-95"
          >
            Store A
          </button>
          <button
            disabled={!snapshotGains}
            onClick={handleCompareA}
            className={`px-4 py-1.5 text-[10px] font-bold rounded-xl transition-all shadow-lg active:scale-95 ${
              !snapshotGains 
                ? 'opacity-30 cursor-not-allowed text-[#8E9299] border border-transparent'
                : isComparingSnapshot
                ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black border border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
            }`}
          >
            {isComparingSnapshot ? 'Show Current' : 'A/B Test'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onDynamicEqMasterChange(!dynamicEqMaster)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all shadow-lg ${
              dynamicEqMaster 
                ? 'bg-gradient-to-r from-teal-500 to-emerald-400 text-black shadow-emerald-500/20' 
                : 'bg-white/5 text-white/40 border border-white/10'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {dynamicEqMaster ? 'Dynamic ON' : 'Dynamic OFF'}
          </button>
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            {['iir', 'fir', 'hybrid'].map((m) => (
              <button
                key={m}
                onClick={() => onPhaseModeChange(m as 'iir' | 'fir' | 'hybrid')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${
                  phaseMode === m 
                    ? 'bg-gradient-to-b from-white/20 to-white/5 text-white shadow-inner border border-white/10' 
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Precision Slider Matrix */}
      <div className="bg-[#0a0a0c] rounded-3xl border border-white/10 p-5 md:p-6 shadow-2xl relative overflow-hidden group/matrix">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-orange-500/5 blur-[100px] pointer-events-none group-hover/matrix:bg-orange-500/10 transition-colors duration-1000" />
        
        <div className="flex flex-row sm:grid sm:grid-cols-10 gap-2 sm:gap-2 relative overflow-x-auto pb-4 sm:pb-0 sonic-scroll items-end">
          {bands.map((band, index) => {
            const zone = bandZoneLabel(band.frequency);
            const accent = BAND_ZONE_COLORS[zone] ?? '#F27D26';
            const isEditing = editingIndex === index;
            const isHover = hoverIndex === index;
            const gainPct = ((band.gain + 12) / 24) * 100;
            const dynamicOffset = dynamicGains?.[index] ?? 0;
            const effectiveGain = band.gain + dynamicOffset;
            const effectivePct = ((effectiveGain + 12) / 24) * 100;

            return (
              <motion.div
                key={index}
                animate={dynamicEqMaster && Math.abs(dynamicOffset) > 0.4 ? {
                  x: [0, (index % 2 === 0 ? 1 : -1) * (index * 0.1) * dynamicOffset, 0],
                  y: [0, (index % 3 === 0 ? 1 : -1) * (index * 0.05) * dynamicOffset, 0],
                  scale: [1, 1 + Math.abs(dynamicOffset) * 0.005, 1],
                } : {}}
                transition={{ duration: 0.15, repeat: Infinity, ease: "linear" }}
                className={`flex flex-col items-center gap-2 group relative min-w-[56px] sm:min-w-0 flex-1 p-2 rounded-2xl transition-all duration-300 ${
                  isEditing 
                    ? 'bg-white/[0.03] ring-1 ring-offset-4 ring-offset-[#0a0a0c]' 
                    : 'bg-transparent ring-0'
                }`}
                style={isEditing ? { ['--tw-ring-color' as any]: `${accent}40` } : {}}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Zone label with dynamic glow & Spectral Warning */}
                <div className="flex items-center gap-1.5 h-3">
                  <div 
                    className={`text-[8px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${isHover || isEditing ? 'opacity-100' : 'opacity-40'}`}
                    style={{ color: accent, textShadow: isHover || isEditing ? `0 0 10px ${accent}66` : 'none' }}
                  >
                    {zone}
                  </div>
                  {spectralPeaks && <SpectralWarning peakDb={spectralPeaks[index]} />}
                </div>

                {/* Vertical Slider Column */}
                <div className="relative h-44 sm:h-56 w-full flex justify-center items-center py-1 group/slider">
                  <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-[1px] bg-white/[0.04] flex flex-col justify-between pointer-events-none">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className={`h-px bg-white/10 ${i % 4 === 0 ? 'w-4 -ml-2' : 'w-2 -ml-1'}`} />
                    ))}
                  </div>

                  <input
                    type="range"
                    role="slider"
                    aria-label={`${band.frequency}Hz gain`}
                    aria-valuenow={band.gain}
                    aria-valuemin={-12}
                    aria-valuemax={12}
                    aria-valuetext={`${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)} decibels`}
                    min="-12"
                    max="12"
                    step="0.1"
                    value={band.gain}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBandChange(index, { gain: val });
                    }}
                    onDoubleClick={() => onBandChange(index, { gain: 0 })}
                    className="vertical-slider appearance-none h-full w-12 bg-transparent cursor-ns-resize z-40 touch-none"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl', touchAction: 'none' }}
                  />

                  {/* Effects Layer (Behind physical movement) */}
                  {dynamicEqMaster && Math.abs(effectivePct - gainPct) > 0.5 && (
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-10 w-full"
                      style={{ bottom: `${effectivePct}%` }}
                    >
                      <BandDynamicEffect 
                        zone={zone} 
                        accent={accent} 
                        intensity={Math.min(2.0, Math.abs(dynamicOffset) / 2.5)} 
                        heightPct={effectivePct - gainPct}
                      />
                    </div>
                  )}

                  {/* Highnd Glassmorphic Thumb (Physically moves with Dynamic EQ) */}
                  <motion.div
                    initial={false}
                    animate={{ 
                      bottom: `${effectivePct}%`, 
                      scale: isHover ? 1.1 : 1,
                      backgroundColor: dynamicEqMaster && Math.abs(dynamicOffset) > 0.5 ? '#fff' : 'transparent'
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 450 }}
                    className="absolute w-8 sm:w-11 h-3.5 rounded-full pointer-events-none z-30 flex items-center justify-center border border-white/40"
                    style={{
                      transform: 'translateY(50%)',
                      background: `linear-gradient(to bottom, #ffffff 0%, ${accent} 100%)`,
                      boxShadow: `0 4px 15px rgba(0,0,0,0.6), 0 0 10px ${accent}${(Math.abs(dynamicOffset) * 10).toFixed(0)}`,
                    }}
                  >
                    {/* Center groove */}
                    <div className="w-1/3 h-[1px] bg-black/30 rounded-full" />
                    
                    {/* Shadow "ghost" of original position when dynamic is on */}
                    {dynamicEqMaster && Math.abs(dynamicOffset) > 0.5 && (
                       <div 
                         className="absolute w-full h-full rounded-full border border-dashed border-white/20 -z-10"
                         style={{ bottom: `${gainPct - effectivePct}%`, transform: 'translateY(0%)' }}
                       />
                    )}
                  </motion.div>

                  {band.dynEnabled && (
                    <motion.div 
                      layoutId={`dyn-dot-${index}`}
                      className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] z-30"
                    />
                  )}
                </div>

                {/* Info Text */}
                <div className="text-center space-y-0.5">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => setEditingIndex(isEditing ? null : index)}
                      className="text-[10px] font-bold text-white/50 group-hover:text-white transition-colors"
                    >
                      {formatFreq(band.frequency)}
                    </button>
                    <span className="text-[7px] text-white/20 font-mono tracking-tighter">HZ</span>
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-[11px] font-mono font-bold ${band.gain > 0 ? 'text-amber-400' : band.gain < 0 ? 'text-blue-400' : 'text-white/20'}`}>
                      {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}
                    </span>
                    <span className="text-[7px] text-white/20 font-bold uppercase tracking-tighter">dB</span>
                    <GainDeltaBadge current={band.gain} snapshot={snapshotGains ? snapshotGains[index] : null} />
                  </div>
                </div>

                {/* Detail Popover Target */}
                <div className="relative w-full">
                  <button 
                    onClick={() => setEditingIndex(isEditing ? null : index)}
                    className={`w-full py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                      isEditing 
                        ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' 
                        : 'bg-white/[0.03] text-white/40 border-white/5 hover:border-white/20'
                    }`}
                    style={!isEditing && isHover ? { 
                      color: accent,
                      borderColor: `${accent}44`,
                      backgroundColor: `${accent}11`,
                      boxShadow: `0 0 15px ${accent}22`
                    } : {}}
                  >
                    {isEditing ? 'Close' : 'Tune'}
                  </button>

                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={`absolute bottom-full mb-3 z-50 bg-[#121215] border border-white/10 rounded-2xl p-4 w-60 shadow-2xl ${
                          index < 2 ? 'left-0' : index > 7 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        }`}
                      >
                         <div className="space-y-4">
                           <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>Band {index + 1}</span>
                             <div className="flex items-center gap-2">
                               <span className="text-[8px] text-white/40">DYN</span>
                               <button 
                                 onClick={() => onBandChange(index, { dynEnabled: !band.dynEnabled })}
                                 className={`w-7 h-3.5 rounded-full relative transition-all ${band.dynEnabled ? 'bg-orange-500' : 'bg-white/10'}`}
                               >
                                 <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${band.dynEnabled ? 'left-4' : 'left-0.5'}`} />
                               </button>
                             </div>
                           </div>

                           <div className="space-y-3">
                             <div>
                               <div className="flex justify-between text-[9px] text-white/40 mb-1">
                                 <span>Freq: {band.frequency}Hz</span>
                                 <span>Q: {band.q.toFixed(2)}</span>
                               </div>
                               <input type="range" min="20" max="20000" value={band.frequency} onChange={(e) => onBandChange(index, { frequency: parseFloat(e.target.value) })} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-white"/>
                             </div>
                             
                             <div>
                               <span className="text-[9px] text-white/40 block mb-1">Filter Type</span>
                               <select 
                                 value={band.type} 
                                 onChange={(e) => onBandChange(index, { type: e.target.value as BiquadFilterType })}
                                 className="w-full bg-white/5 border border-white/10 rounded-lg text-[10px] p-1.5 outline-none"
                               >
                                 <option value="peaking">Peaking</option>
                                 <option value="lowshelf">Low Shelf</option>
                                 <option value="highshelf">High Shelf</option>
                                 <option value="notch">Notch</option>
                               </select>
                             </div>
                           </div>

                           {band.dynEnabled && (
                             <div className="pt-2 border-t border-white/5 space-y-3">
                               <div className="space-y-1">
                                 <div className="flex justify-between text-[8px] text-white/40 italic">
                                   <span>Threshold: {band.threshold}dB</span>
                                 </div>
                                 <input type="range" min="-60" max="0" value={band.threshold} onChange={(e) => onBandChange(index, { threshold: parseFloat(e.target.value) })} className="w-full h-1 bg-white/5 rounded-full appearance-none accent-orange-500"/>
                               </div>
                               <div className="space-y-1">
                                 <div className="flex justify-between text-[8px] text-white/40 italic">
                                   <span>Range: {band.range}dB</span>
                                 </div>
                                 <input type="range" min="0" max="18" value={band.range} onChange={(e) => onBandChange(index, { range: parseFloat(e.target.value) })} className="w-full h-1 bg-white/5 rounded-full appearance-none accent-orange-500"/>
                               </div>
                             </div>
                           )}

                           <button onClick={() => onBandChange(index, { gain: 0 })} className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold text-white/40 transition-colors uppercase">Reset Band</button>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <style>{`
        .vertical-slider {
          -webkit-appearance: none;
          background: transparent;
        }
        .vertical-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 0;
          width: 0;
        }
        .vertical-slider::-moz-range-thumb {
          height: 0;
          width: 0;
          background: transparent;
          border: none;
        }
        @keyframes plasma-jitter {
          0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.8; }
          25% { transform: translateX(-2px) scaleX(1.3); opacity: 1; }
          50% { transform: translateX(1.5px) scaleX(0.8); opacity: 0.6; }
          75% { transform: translateX(-1px) scaleX(1.1); opacity: 0.9; }
        }
        @keyframes plasma-jitter-reverse {
          0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.8; }
          25% { transform: translateX(1.5px) scaleX(0.9); opacity: 0.9; }
          50% { transform: translateX(-2px) scaleX(1.4); opacity: 1; }
          75% { transform: translateX(1px) scaleX(0.7); opacity: 0.5; }
        }
        .animate-plasma-jitter {
          animation: plasma-jitter 0.08s infinite alternate;
        }
        .animate-plasma-jitter-reverse {
          animation: plasma-jitter-reverse 0.09s infinite alternate;
        }
      `}</style>
    </div>
  );
});

EQPanel.displayName = 'EQPanel';

function formatFreq(freq: number): string {
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}k`;
  return `${Math.round(freq)}`;
}
