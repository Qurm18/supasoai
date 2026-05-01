'use client';

import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyzer: AnalyserNode | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyzer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!analyzer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      // Motion blur effect with trails
      ctx.fillStyle = 'rgba(10, 10, 11, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw faint HUD grid
      ctx.strokeStyle = 'rgba(242, 125, 38, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      const barWidth = (canvas.width / (bufferLength / 2)) * 1.5;
      let barHeight;
      let x = canvas.width / 2;
      let xInv = canvas.width / 2;

      for (let i = 0; i < bufferLength / 2; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

        // Dynamic gradient based on amplitude
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#F27D26'); 
        gradient.addColorStop(0.5, '#FF4444');
        gradient.addColorStop(1, '#FFFFFF');

        ctx.fillStyle = gradient;
        
        // Symmetrical bars from center with slight glow effect simulated by opacity
        const centerY = canvas.height / 2;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 3, barHeight);
        ctx.fillRect(xInv - barWidth, centerY - barHeight / 2, barWidth - 3, barHeight);

        x += barWidth;
        xInv -= barWidth;
      }

      // Add "scanline" effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < canvas.height; i += 4) {
         ctx.fillRect(0, i, canvas.width, 1);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyzer]);

  return (
    <div className="w-full h-32 bg-[#151619] rounded-lg border border-[#8E9299]/20 overflow-hidden relative">
      <div className="absolute top-2 left-2 text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">
        Spectrum Analyzer
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-full"
      />
    </div>
  );
};
