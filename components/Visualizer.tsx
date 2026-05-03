'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNeuromorphicEngine } from '@/hooks/useNeuromorphicEngine';
import { computeCurveFast, biquadMagFast, getCurveCoeffs } from '@/lib/math/eq-curve-utils';
import { EQBand } from '@/lib/audio-engine';

interface VisualizerProps {
  analyzer: AnalyserNode | null;
  analyzerL?: AnalyserNode | null;
  analyzerR?: AnalyserNode | null;
  metrics?: { momentary: number; shortTerm: number; integrated: number; peak: number; psr: number };
  bands?: EQBand[];
  baseCorrection?: number[];
  dynamicGains?: number[];
}

function freqToX(freq: number, W: number): number {
  const MIN = 20, MAX = 22050;
  return (Math.log10(freq / MIN) / Math.log10(MAX / MIN)) * W;
}

function drawSparkles(ctx: CanvasRenderingContext2D, W: number, H: number, sparkle: any) {
  const count = Math.floor(sparkle.density * 50);
  ctx.fillStyle = `rgba(255, 255, 255, ${sparkle.opacity})`;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const s = Math.random() * sparkle.size;
    ctx.fillRect(x, y, s, s);
  }
}

function drawRimPulse(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number) {
  ctx.save();
  ctx.shadowBlur = 40 * intensity;
  ctx.shadowColor = `rgba(242, 125, 38, ${intensity})`;
  ctx.strokeStyle = `rgba(242, 125, 38, ${intensity * 0.5})`;
  ctx.lineWidth = 10 * intensity;
  ctx.strokeRect(0, 0, W, H);
  ctx.restore();
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyzer, analyzerL, analyzerR, metrics, bands = [], baseCorrection, dynamicGains }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { expressionRef, perceptionRef, attentionRef, triggerMicroFeedback } = useNeuromorphicEngine(analyzer, bands);
  const [dbVal, setDbVal] = useState(-96);
  const rafRef = useRef<number>(0);

  // Canvas resize logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0) canvas.width = Math.round(r.width * (window.devicePixelRatio || 1));
      if (r.height > 0) canvas.height = Math.round(r.height * (window.devicePixelRatio || 1));
    });
    ro.observe(canvas);
    const r = canvas.getBoundingClientRect();
    if (r.width > 0) canvas.width = Math.round(r.width * (window.devicePixelRatio || 1));
    if (r.height > 0) canvas.height = Math.round(r.height * (window.devicePixelRatio || 1));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!analyzer) return;

    const SR = (analyzer.context as AudioContext).sampleRate || 48000;
    
    // Smooth buffer for spectrum
    const bins = analyzer.frequencyBinCount;
    const freqBuf = new Uint8Array(bins);
    const smoothBuf = new Float32Array(bins);

    let lastDrawTime = performance.now();

    const loop = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = timestamp - lastDrawTime;
      if (dt < 1000 / 60) return;
      lastDrawTime = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      if (analyzer.context.state === 'suspended') {
        (analyzer.context as AudioContext).resume().catch(() => {});
      }
      
      const W = canvas.width;
      const H = canvas.height;
      const expression = expressionRef.current;

      // 1. Background Render (Ambient)
      ctx.clearRect(0, 0, W, H);
      if (expression.background.opacity > 0) {
        const { hue, breathing, rimPulse, sparkle, opacity } = expression.background;
        
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(W/2, H + 100, 100, W/2, H/2 + 50 * Math.sin(timestamp/breathing.speed/1000), W);
        grad.addColorStop(0, `hsla(${hue}, 80%, 40%, ${opacity * 0.4})`);
        grad.addColorStop(0.5, `hsla(${hue + 40}, 90%, 20%, ${opacity * 0.2})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'source-over';
        
        if (sparkle.opacity > 0.05) drawSparkles(ctx, W, H, sparkle);
        if (rimPulse.active) drawRimPulse(ctx, W, H, rimPulse.intensity);
      } else {
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, W, H);
      }

      const drawH = H - 24;
      const DB_FLOOR = -90, DB_CEIL = 0;

      // 1.5 Draw Grid (Subtle)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      // dB lines
      [-12, -6, 0, 6, 12].forEach(db => {
         const y = (H/2) - (db/15) * (H/2) * 0.85;
         ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
         ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 5, y - 4);
      });
      // Freq lines
      [50, 100, 500, 1000, 5000, 10000, 20000].forEach(f => {
         const x = freqToX(f, W);
         ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, drawH); ctx.stroke();
         ctx.fillText(f >= 1000 ? `${f/1000}k` : `${f}`, x + 4, drawH + 16);
      });
      ctx.restore();

      // 2. Draw Spectrum (Subtle)
      analyzer.getByteFrequencyData(freqBuf);
      ctx.save();
      
      const specPath = new Path2D();
      let first = true;
      for (let i = 1; i < bins; i++) {
        smoothBuf[i] += (freqBuf[i] - smoothBuf[i]) * 0.45;
        const freq = (i / bins) * (SR / 2);
        if (freq < 20 || freq > 22050) continue;
        const x = freqToX(freq, W);
        const lin = smoothBuf[i] / 255;
        const db = lin <= 0 ? -96 : Math.max(-96, 20 * Math.log10(lin));
        const y = drawH - ((db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)) * drawH;
        
        if (first) { specPath.moveTo(x, drawH); specPath.lineTo(x, y); first = false; }
        else { specPath.lineTo(x, y); }
      }
      specPath.lineTo(W, drawH);

      const specGrad = ctx.createLinearGradient(0, 0, 0, drawH);
      specGrad.addColorStop(0, 'rgba(242, 125, 38, 0.4)');
      specGrad.addColorStop(1, 'rgba(242, 125, 38, 0.0)');
      ctx.fillStyle = specGrad;
      ctx.fill(specPath);

      ctx.strokeStyle = 'rgba(242, 125, 38, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke(specPath);
      ctx.restore();

      // 3. EQ System Render (Interaction)
      if (bands.length > 0) {
        ctx.save();
        const curvePoints = computeCurveFast(bands, baseCorrection, 160);
        
        // Transform based on expression
        const tr = expression.eq.transform;
        if (tr.scale !== 1) {
          ctx.translate(W / 2, H / 2);
          ctx.scale(tr.scale, tr.scale);
          ctx.translate(-W / 2, -H / 2);
        }
        if (tr.blur > 0.1) {
          ctx.filter = `blur(${tr.blur}px)`;
        }

        const buildPath2D = (pts: {freq: number, gain: number}[]) => {
          const p = new Path2D();
          pts.forEach((pt, i) => {
            const x = freqToX(pt.freq, W);
            const y = (H / 2) - (pt.gain / 15) * (H / 2) * 0.85;
            if (i===0) p.moveTo(x, y); else p.lineTo(x, y);
          });
          return p;
        };

        const mainPath = buildPath2D(curvePoints);
        
        // Ghost Dynamic EQ Curve (Theoretical Max Cut/Boost)
        const hasDynamic = bands.some(b => b.dynEnabled);
        if (hasDynamic && dynamicGains && dynamicGains.length === bands.length) {
          const maxDynBands = bands.map(b => ({
            ...b,
            gain: b.gain + (b.dynEnabled ? (b.range || 0) : 0) // Max gain change
          }));
          const minDynBands = bands.map(b => ({
            ...b,
            gain: b.gain - (b.dynEnabled ? (b.range || 0) : 0) // Min gain change
          }));
          
          const dynPtsMax = computeCurveFast(maxDynBands, baseCorrection, 160);
          const dynPtsMin = computeCurveFast(minDynBands, baseCorrection, 160);

          ctx.save();
          // Fill area between min and max dynamic range to show the 'area of effect'
          const area = new Path2D();
          dynPtsMax.forEach((pt, i) => {
             const x = freqToX(pt.freq, W);
             const y = (H / 2) - (pt.gain / 15) * (H / 2) * 0.85;
             if (i === 0) area.moveTo(x, y); else area.lineTo(x, y);
          });
          for(let i = dynPtsMin.length - 1; i >= 0; i--) {
             const x = freqToX(dynPtsMin[i].freq, W);
             const y = (H / 2) - (dynPtsMin[i].gain / 15) * (H / 2) * 0.85;
             area.lineTo(x, y);
          }
          area.closePath();
          
          const dynGrad = ctx.createLinearGradient(0, H/2 - 50, 0, H/2 + 50);
          dynGrad.addColorStop(0, `rgba(251, 191, 36, ${0.12 * expression.intensity})`);
          dynGrad.addColorStop(1, `rgba(251, 191, 36, ${0.06 * expression.intensity})`);
          ctx.fillStyle = dynGrad;
          ctx.fill(area);
          ctx.restore();
        } else if (expression.eq.ghostCurve.active && expression.eq.ghostCurve.opacity > 0) {
          // Standard Ghost curve based on expression
        }
        
        // Main curve style
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(242, 125, 38, ${0.8 * expression.intensity})`;
        ctx.strokeStyle = `rgba(242, 125, 38, ${1 * expression.intensity})`;
        ctx.lineWidth = 3;
        ctx.stroke(mainPath);
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * expression.intensity})`;
        ctx.lineWidth = 1;
        ctx.stroke(mainPath);

        // Band Glows
        bands.forEach((b, i) => {
           const x = freqToX(b.frequency, W);
           const y = (H / 2) - (b.gain / 15) * (H / 2) * 0.85;
           
           ctx.beginPath();
           ctx.arc(x, y, 5, 0, Math.PI * 2);
           ctx.fillStyle = b.dynEnabled ? '#fbbf24' : '#fff';
           ctx.fill();
           
           ctx.beginPath();
           ctx.arc(x, y, 6, 0, Math.PI * 2);
           ctx.strokeStyle = b.dynEnabled ? '#f59e0b' : '#f27d26';
           ctx.lineWidth = 2;
           ctx.stroke();

           // Draw dynamic gain indicator (actual current change if available)
           if (b.dynEnabled && dynamicGains && dynamicGains[i]) {
              const dynY = (H / 2) - ((b.gain + dynamicGains[i]) / 15) * (H / 2) * 0.85;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, dynY);
              ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(x, dynY, 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(251, 191, 36, 1)';
              ctx.fill();
           }
        });

        ctx.restore();
      }

      // 4. Micro Feedback Layer
      if (expression.micro.signals.length > 0) {
        ctx.save();
        expression.micro.signals.forEach(sig => {
           if (sig.type === 'confetti') {
              for (let i = 0; i < sig.intensity * 20; i++) {
                 ctx.fillStyle = `hsl(${Math.random()*360}, 100%, 70%)`;
                 ctx.fillRect(Math.random()*W, Math.random()*H, 3, 3);
              }
           } else if (sig.type === 'glow') {
              ctx.shadowBlur = Math.min(20, sig.intensity * 30);
              ctx.shadowColor = sig.color || 'rgba(0, 255, 0, 0.5)';
              ctx.strokeStyle = sig.color || 'rgba(0, 255, 0, 0.5)';
              ctx.strokeRect(0, 0, W, H);
           }
        });
        ctx.restore();
      }

    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyzer, bands, baseCorrection, expressionRef, dynamicGains]);

  return (
    <div className="w-full bg-[#08080f] rounded-xl border border-white/[.08] overflow-hidden relative shadow-2xl transition-all duration-300">
      <canvas ref={canvasRef} width={800} height={180} className="w-full h-[180px] block" />
    </div>
  );
};

Visualizer.displayName = 'Visualizer';


