import React, { useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '@/lib/audio-engine-context';
import { motion } from 'motion/react';
import { BrainCircuit, Activity, Zap, Flame, Wind } from 'lucide-react';

export function PerceptionVisualizer() {
  const engine = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [metrics, setMetrics] = useState({ arousal: 0, valence: 0, energy: 0, tension: 0 });
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    let animationId: number;
    let lastDrawTime = 0;
    const minFrameTime = 1000 / 30; // 30 FPS throttle

    const render = (time: number) => {
      if (!engine || !engine.perceptionLayer || !canvasRef.current) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const results = engine.perceptionLayer.forward();
      if (!results) return;
      const { importanceMap, emotionVector } = results;

      // Throttle UI updates (10fps for numbers is enough)
      if (time - lastUpdateRef.current > 100) {
        setMetrics({
          arousal: emotionVector[0],
          valence: emotionVector[1],
          energy: emotionVector[2],
          tension: emotionVector[3]
        });
        lastUpdateRef.current = time;
      }

      if (time - lastDrawTime < minFrameTime) {
        animationId = requestAnimationFrame(render);
        return;
      }
      lastDrawTime = time;

      // Render Heatmap (Time x Frequency)
      const width = canvas.width;
      const height = canvas.height;

      // Shift old data to the left (ULTRA FAST path)
      ctx.drawImage(canvas, 1, 0, width - 1, height, 0, 0, width - 1, height);

      const nBands = importanceMap.length;
      const bandHeight = height / nBands;

      // Draw new column
      for (let i = 0; i < nBands; i++) {
        // Boost importance for visualization if it's too dark
        const val = Math.min(1.0, Math.pow(importanceMap[i] * 2.2, 0.7)); 
        
        let r, g, b;
        if (val < 0.1) {
          r = val * 10 * 60;
          g = 0;
          b = 30 + val * 10 * 120;
        } else if (val < 0.4) {
          r = 60 + (val - 0.1) * 3.3 * 195;
          g = (val - 0.1) * 3.3 * 60;
          b = 150 - (val - 0.1) * 3.3 * 150;
        } else {
          r = 255;
          g = 60 + (val - 0.4) * 1.6 * 195;
          b = (val - 0.4) * 1.6 * 80;
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(width - 1, height - (i + 1) * bandHeight, 1, bandHeight);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [engine]);

  return (
    <div className="bg-[#0b0c10] border border-white/5 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 blur-[80px] pointer-events-none" />
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-500/30 to-purple-500/30 flex items-center justify-center border border-fuchsia-500/20">
            <BrainCircuit className="w-5 h-5 text-fuchsia-400" />
          </div>
          <div>
            <h3 className="font-bold text-white tracking-tight text-sm md:text-base">Neural Perception Engine v2.0</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Dynamic Psychoacoustic Saliency Map</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          <MetricCard title="Arousal" value={metrics.arousal} icon={<Activity />} color="text-rose-400" bgColor="bg-rose-400/10" progressColor="bg-rose-400" />
          <MetricCard title="Brightness" value={metrics.valence} icon={<Flame />} color="text-amber-400" bgColor="bg-amber-400/10" progressColor="bg-amber-400" />
          <MetricCard title="Psycho-Energy" value={metrics.energy} icon={<Zap />} color="text-yellow-400" bgColor="bg-yellow-400/10" progressColor="bg-yellow-400" />
          <MetricCard title="Spectral Tension" value={metrics.tension} icon={<Wind />} color="text-teal-400" bgColor="bg-teal-400/10" progressColor="bg-teal-400" />
      </div>

      <div className="relative w-full h-[200px] rounded-xl overflow-hidden bg-black border border-white/10">
        <canvas ref={canvasRef} width={800} height={200} className="w-full h-full" />
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[10px] text-white/70 font-mono flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span> Importance Heatmap (Time x Frequency)
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, bgColor, progressColor }: any) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-3 ${bgColor} border border-white/5`}>
      <div className={`flex items-center gap-2 ${color}`}>
        {React.cloneElement(icon, { className: "w-4 h-4" })}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white">{(value * 100).toFixed(0)}%</div>
      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full ${progressColor}`}
          animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
          transition={{ type: 'spring', damping: 20 }}
        />
      </div>
    </div>
  );
}
