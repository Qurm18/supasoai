'use client';

import React, { useEffect, useRef } from 'react';
import { useAudioEngine } from '@/lib/audio-engine-context';

export function AmbientAurora() {
  const engine = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;
    let isActive = true;

    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0) canvas.width = Math.round(r.width * (window.devicePixelRatio || 1));
      if (r.height > 0) canvas.height = Math.round(r.height * (window.devicePixelRatio || 1));
    });
    ro.observe(canvas);

    const r = canvas.getBoundingClientRect();
    if (r.width > 0) canvas.width = Math.round(r.width * (window.devicePixelRatio || 1));
    if (r.height > 0) canvas.height = Math.round(r.height * (window.devicePixelRatio || 1));

    const freqBuf = new Uint8Array(128); // Low res is fine for ambient
    let smoothBass = 0;
    let smoothTreble = 0;
    let time = 0;

    const draw = () => {
      if (!isActive) return;
      rafId = requestAnimationFrame(draw);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      // Extract Audio Features
      // @ts-ignore
      if (engine && engine.isReady && engine.analyzer && engine.context?.state === 'running') {
        // @ts-ignore
        engine.analyzer.getByteFrequencyData(freqBuf);
        let bass = 0, treble = 0;
        // Bass
        for(let i = 1; i < 4; i++) bass += freqBuf[i];
        bass /= 3;
        
        // Treble
        for(let i = 40; i < 80; i++) treble += freqBuf[i];
        treble /= 40;

        smoothBass += (bass - smoothBass) * 0.1;
        smoothTreble += (treble - smoothTreble) * 0.1;
      } else {
        smoothBass *= 0.95;
        smoothTreble *= 0.95;
      }

      time += 0.005 + (smoothTreble / 255) * 0.02; // Time speeds up with treble

      ctx.clearRect(0, 0, W, H);

      // Base background
      ctx.fillStyle = '#07080a';
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'screen';

      const bassIntensity = smoothBass / 255;
      const trebleIntensity = smoothTreble / 255;

      // Primary warm gradient (reacts to bass)
      const cx1 = W * 0.3 + Math.sin(time) * W * 0.2;
      const cy1 = H * 0.7 + Math.cos(time * 0.8) * H * 0.2;
      const rw1 = W * 0.6 + bassIntensity * W * 0.2;
      
      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, rw1);
      g1.addColorStop(0, `hsla(26, ${70 + bassIntensity * 30}%, ${20 + bassIntensity * 10}%, ${0.5 + bassIntensity * 0.3})`);
      g1.addColorStop(0.5, `hsla(30, 80%, 15%, ${0.2 + bassIntensity * 0.2})`);
      g1.addColorStop(1, 'transparent');

      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      // Secondary cool/purple gradient (reacts to treble)
      const cx2 = W * 0.8 + Math.cos(time * 1.2) * W * 0.2;
      const cy2 = H * 0.2 + Math.sin(time * 0.9) * H * 0.2;
      const rw2 = W * 0.5 + trebleIntensity * W * 0.2;

      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, rw2);
      g2.addColorStop(0, `hsla(250, ${60 + trebleIntensity * 40}%, ${25 + trebleIntensity * 15}%, ${0.4 + trebleIntensity * 0.3})`);
      g2.addColorStop(0.5, `hsla(260, 70%, 15%, ${0.2 + trebleIntensity * 0.2})`);
      g2.addColorStop(1, 'transparent');

      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'source-over';
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      isActive = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [engine]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full pointer-events-none -z-10" 
      aria-hidden="true" 
    />
  );
}
