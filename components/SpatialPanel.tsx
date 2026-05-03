'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Box, Headphones, Compass, Ear } from 'lucide-react';

interface SpatialPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  position: { azimuth: number; elevation: number };
  onPositionChange: (az: number, el: number) => void;
  headTracking: boolean;
  onHeadTrackingToggle: (enabled: boolean) => void;
}

export function SpatialPanel({ enabled, onToggle, position, onPositionChange, headTracking, onHeadTrackingToggle }: SpatialPanelProps) {
  const padRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!enabled || !padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Map x to Azimuth (0-360)
    // Map y to Elevation (-90 to 90)
    const az = Math.round(x * 360);
    const el = Math.round(((1-y) * 180) - 90);

    onPositionChange(az, el);
  };

  const azPercent = (position.azimuth / 360) * 100;
  const elPercent = (1 - (position.elevation + 90) / 180) * 100;

  return (
    <div className="theme-glass rounded-2xl p-5 border border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Headphones className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold tracking-tight">Sonic Spatial</h3>
            <p className="text-[10px] text-white/40 uppercase font-mono tracking-widest">Binaural Renderer</p>
          </div>
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
            enabled ? 'bg-orange-500 text-black shadow-[0_0_15px_rgba(242,125,38,0.4)]' : 'bg-white/5 text-white/40 border border-white/10'
          }`}
        >
          {enabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Spatial Pad */}
        <div 
          ref={padRef}
          onPointerMove={e => e.buttons === 1 && handlePointerMove(e)}
          onPointerDown={handlePointerMove}
          className={`relative aspect-square w-full rounded-xl bg-black/40 border border-white/5 overflow-hidden transition-opacity cursor-crosshair ${!enabled && 'opacity-30 pointer-events-none'}`}
        >
            {/* Grid lines */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <div className="w-full h-[1px] bg-white" />
                <div className="h-full w-[1px] bg-white absolute" />
            </div>
            
            {/* Azimuth / Elevation Guide */}
            <div className="absolute bottom-2 left-2 flex flex-col gap-1 opacity-40 font-mono text-[9px] uppercase">
                <span>Az: {position.azimuth}°</span>
                <span>El: {position.elevation}°</span>
            </div>

            {/* Position Indicator */}
            <motion.div
              animate={{ left: `${azPercent}%`, top: `${elPercent}%` }}
              transition={{ type: 'spring', damping: 15, stiffness: 100 }}
              className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(242,125,38,0.8)] border border-white"
            />
            
            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 -ml-1 -mt-1 w-2 h-2 border border-white/20 rounded-full" />
        </div>

        {/* Features list */}
        <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] text-white/70">3D Azimuth & Elevation Engine</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                <Ear className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] text-white/70">Ear-Shape Personalization Ready</span>
            </div>
            
            <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[11px] text-white/70">Head Tracking</span>
                <button 
                  onClick={() => onHeadTrackingToggle(!headTracking)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${headTracking ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/40'}`}
                >
                  {headTracking ? 'ON' : 'OFF'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
