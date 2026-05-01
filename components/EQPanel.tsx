'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EQBand } from '@/lib/audio-engine';
import { Settings, Plus, Minus, ChevronUp, ChevronDown } from 'lucide-react';

interface EQPanelProps {
  bands: EQBand[];
  onBandChange: (index: number, params: Partial<EQBand>) => void;
  preAmp: number;
  onPreAmpChange: (val: number) => void;
}

export const EQPanel: React.FC<EQPanelProps> = ({ bands, onBandChange, preAmp, onPreAmpChange }) => {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Pre-Amp and Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-black/20 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest leading-none mb-1">Pre-Amplification</span>
            <span className="text-sm font-bold text-white">{preAmp > 0 ? `+${preAmp.toFixed(1)}` : preAmp.toFixed(1)} dB</span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            value={preAmp}
            onChange={(e) => onPreAmpChange(parseFloat(e.target.value))}
            className="flex-1 md:w-48 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#F27D26]"
          />
        </div>
        
        <div className="flex items-center gap-4 text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">
           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F27D26]" /> Active Filters</span>
           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Linear Phase</span>
        </div>
      </div>

      <div className="bg-[#151619] rounded-3xl border border-white/10 p-6 shadow-inner relative overflow-hidden">
        {/* Frequency Labels */}
        <div className="absolute top-8 left-0 right-0 flex justify-between px-10 pointer-events-none opacity-20">
           {['20', '100', '1k', '10k', '20k'].map(f => (
             <span key={f} className="text-[8px] font-mono font-bold">{f}Hz</span>
           ))}
        </div>

        <div className="flex overflow-x-auto md:grid md:grid-cols-10 gap-6 md:gap-2 snap-x pb-4">
          {bands.map((band, index) => (
            <div key={index} className="flex flex-col items-center gap-6 group min-w-[70px] md:min-w-0 snap-center relative">
              
              {/* Parameter Badge */}
              <div 
                className={`absolute -top-2 z-20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter transition-all cursor-pointer ${
                  editingIndex === index ? 'bg-white text-black' : 'bg-black/80 text-[#8E9299] hover:text-white'
                }`}
                onClick={() => setEditingIndex(editingIndex === index ? null : index)}
              >
                Q:{band.q.toFixed(1)}
              </div>

              <div className="relative h-56 w-full flex justify-center items-center py-4">
                {/* Visual Scale Lines */}
                <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-[1px] bg-white/5 flex flex-col justify-between">
                   {Array.from({length: 7}).map((_, i) => (
                     <div key={i} className="w-4 h-[1px] bg-white/10 -ml-2" />
                   ))}
                </div>

                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={band.gain}
                  onChange={(e) => onBandChange(index, { gain: parseFloat(e.target.value) })}
                  className="vertical-slider appearance-none h-full w-12 bg-transparent cursor-pointer z-10"
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl'
                  } as any}
                />
                
                {/* HiBy Style Thumb */}
                <motion.div 
                  initial={false}
                  animate={{ bottom: `${((band.gain + 12) / 24) * 100}%` }}
                  className="absolute w-10 h-4 bg-gradient-to-b from-white to-[#F27D26] border border-white/40 shadow-[0_4px_15px_rgba(242,125,38,0.4)] rounded-md pointer-events-none z-0"
                  style={{ transform: 'translateY(50%)' }}
                >
                  <div className="w-full h-[1px] bg-white/50 mt-2" />
                </motion.div>
              </div>
              
              <div className="flex flex-col items-center gap-1 w-full">
                <button 
                  onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  className="text-[10px] font-bold font-mono text-white/90 hover:text-[#F27D26] transition-colors"
                >
                  {formatFreq(band.frequency)}
                </button>
                <div className="text-[11px] font-black font-mono text-[#F27D26]">
                  {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)}
                </div>
              </div>

              {/* Advanced Popover (HiBy style) */}
              <AnimatePresence>
                {editingIndex === index && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-full mb-4 z-50 bg-[#1a1c20] border border-white/20 rounded-2xl shadow-2xl p-4 w-48"
                  >
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">Filters</span>
                          <button onClick={() => setEditingIndex(null)} className="text-white/40 hover:text-white"><Settings className="w-3 h-3" /></button>
                        </div>
                        
                        <div className="space-y-3">
                           <div>
                              <span className="text-[9px] text-[#8E9299] block mb-1">Frequency (Hz)</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => onBandChange(index, { frequency: Math.max(20, band.frequency - 5) })} className="p-1 bg-white/5 rounded"><Minus className="w-3 h-3" /></button>
                                <span className="flex-1 text-center font-mono text-xs">{band.frequency}</span>
                                <button onClick={() => onBandChange(index, { frequency: Math.min(20000, band.frequency + 5) })} className="p-1 bg-white/5 rounded"><Plus className="w-3 h-3" /></button>
                              </div>
                           </div>

                           <div>
                              <span className="text-[9px] text-[#8E9299] block mb-1">Q Factor (Bandwidth)</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => onBandChange(index, { q: Math.max(0.1, band.q - 0.1) })} className="p-1 bg-white/5 rounded"><ChevronDown className="w-3 h-3" /></button>
                                <span className="flex-1 text-center font-mono text-xs">{band.q.toFixed(1)}</span>
                                <button onClick={() => onBandChange(index, { q: Math.min(10, band.q + 0.1) })} className="p-1 bg-white/5 rounded"><ChevronUp className="w-3 h-3" /></button>
                              </div>
                           </div>

                           <div>
                              <span className="text-[9px] text-[#8E9299] block mb-1">Type</span>
                              <select 
                                value={band.type}
                                onChange={(e) => onBandChange(index, { type: e.target.value as BiquadFilterType })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg text-[10px] p-2 text-white outline-none"
                              >
                                 <option value="peaking">Peaking</option>
                                 <option value="lowshelf">Low Shelf</option>
                                 <option value="highshelf">High Shelf</option>
                                 <option value="notch">Notch</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
      
      <style jsx>{`
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
      `}</style>
    </div>
  );
};

function formatFreq(freq: number): string {
  if (freq >= 1000) return `${freq / 1000}k`;
  return `${freq}`;
}
