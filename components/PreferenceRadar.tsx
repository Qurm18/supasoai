'use client';

import React from 'react';
import { motion } from 'motion/react';
import { getProfileDNA } from '@/lib/personality';

interface PreferenceRadarProps {
  gains: number[];
  color?: string;
  size?: number;
}

export function PreferenceRadar({ gains, color = '#F27D26', size = 160 }: PreferenceRadarProps) {
  const dna = getProfileDNA(gains);
  const data = [
    { label: 'Sub', value: dna.subBass },
    { label: 'Bass', value: dna.bass },
    { label: 'Warm', value: dna.warmth },
    { label: 'Vocal', value: dna.vocalPresence },
    { label: 'Air', value: dna.trebleDetail },
  ];

  const center = size / 2;
  const radius = (size / 2) * 0.7;

  const getPoint = (value: number, index: number) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const points = data.map((d, i) => {
    const p = getPoint(d.value, i);
    const angle = (i * 2 * Math.PI) / data.length - Math.PI / 2;
    return {
      ...p,
      labelX: center + (radius + 24) * Math.cos(angle),
      labelY: center + (radius + 18) * Math.sin(angle),
      axisX: center + radius * Math.cos(angle),
      axisY: center + radius * Math.sin(angle),
    };
  });

  const pathData = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Background webs */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((rScale, i) => (
          <polygon
            key={i}
            points={points.map((_, j) => {
              const angle = (j * 2 * Math.PI) / points.length - Math.PI / 2;
              const r = rScale * radius;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(' ')}
            fill="none"
            stroke="white"
            strokeOpacity={0.05}
          />
        ))}

        {/* Axes */}
        {points.map((p, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.axisX}
            y2={p.axisY}
            stroke="white"
            strokeOpacity={0.1}
          />
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            alignmentBaseline="middle"
            className="text-[8px] font-mono fill-white/40 uppercase tracking-widest font-bold"
          >
            {data[i].label}
          </text>
        ))}

        {/* Data polygon */}
        <motion.polygon
          animate={{ points: pathData }}
          transition={{ type: 'spring', stiffness: 60, damping: 15 }}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="filter drop-shadow-[0_0_8px_currentColor]"
          style={{ color }}
        />
      </svg>
    </div>
  );
}
