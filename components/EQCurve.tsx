'use client';

import React, { useMemo } from 'react';
import { EQBand } from '@/lib/audio-engine';

interface EQCurveProps {
  bands: EQBand[];
}

// ─── Biquad math: exact Web Audio API transfer function ──────────────────────
// Returns magnitude in dB at frequency f (Hz) for a single biquad filter
// Source: Audio EQ Cookbook by Robert Bristow-Johnson
function biquadMagnitudeDB(band: EQBand, f: number, sampleRate = 48000): number {
  const { frequency: f0, gain: dBgain, q: Q, type } = band;
  if (dBgain === 0 && type === 'peaking') return 0;

  const A = Math.pow(10, dBgain / 40); // amplitude (not power)
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Q);

  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

  switch (type) {
    case 'peaking':
      b0 =  1 + alpha * A;
      b1 = -2 * cosW0;
      b2 =  1 - alpha * A;
      a0 =  1 + alpha / A;
      a1 = -2 * cosW0;
      a2 =  1 - alpha / A;
      break;
    case 'lowshelf':
      b0 =      A * ((A + 1) - (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha);
      b1 =  2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 =      A * ((A + 1) - (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha);
      a0 =            (A + 1) + (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha;
      a1 =     -2 * ((A - 1) + (A + 1) * cosW0);
      a2 =            (A + 1) + (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha;
      break;
    case 'highshelf':
      b0 =       A * ((A + 1) + (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 =       A * ((A + 1) + (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha);
      a0 =             (A + 1) - (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha;
      a1 =      2 * ((A - 1) - (A + 1) * cosW0);
      a2 =             (A + 1) - (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha;
      break;
    case 'notch':
      b0 =  1;
      b1 = -2 * cosW0;
      b2 =  1;
      a0 =  1 + alpha;
      a1 = -2 * cosW0;
      a2 =  1 - alpha;
      break;
    case 'bandpass':
      b0 =  sinW0 / 2;
      b1 =  0;
      b2 = -sinW0 / 2;
      a0 =  1 + alpha;
      a1 = -2 * cosW0;
      a2 =  1 - alpha;
      break;
    default:
      return 0;
  }

  // Normalize coefficients
  b0 /= a0; b1 /= a0; b2 /= a0;
  a1 /= a0; a2 /= a0;

  // Compute H(e^jw) at w = 2*pi*f/fs using the bilinear z-transform evaluation
  const w = (2 * Math.PI * f) / sampleRate;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);

  // H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
  // At z = e^jw: numerator and denominator are complex numbers
  const numRe = b0 + b1 * cosW + b2 * Math.cos(2 * w);
  const numIm =    - b1 * sinW - b2 * Math.sin(2 * w);
  const denRe = 1  + a1 * cosW + a2 * Math.cos(2 * w);
  const denIm =    - a1 * sinW - a2 * Math.sin(2 * w);

  const numMag2 = numRe * numRe + numIm * numIm;
  const denMag2 = denRe * denRe + denIm * denIm;

  if (denMag2 === 0) return 0;
  return 10 * Math.log10(numMag2 / denMag2);
}

// ─── Sum all bands at each frequency point ───────────────────────────────────
function computeCurve(bands: EQBand[], numPoints = 120): { freq: number; gain: number }[] {
  const points: { freq: number; gain: number }[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const freq = 20 * Math.pow(1000, i / numPoints); // log sweep 20Hz → 20kHz
    let totalDB = 0;
    for (const band of bands) {
      totalDB += biquadMagnitudeDB(band, freq);
    }
    points.push({ freq: Math.round(freq), gain: parseFloat(totalDB.toFixed(2)) });
  }
  return points;
}

// ─── SVG path builder ────────────────────────────────────────────────────────
function buildPath(
  points: { freq: number; gain: number }[],
  width: number,
  height: number,
  dBRange = 15
): string {
  const freqToX = (f: number) =>
    ((Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * width;
  const gainToY = (g: number) =>
    height / 2 - (g / dBRange) * (height / 2) * 0.85;

  return points
    .map((p, i) => {
      const x = freqToX(p.freq);
      const y = gainToY(p.gain);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ─── Frequency grid labels ───────────────────────────────────────────────────
const FREQ_LABELS = [
  { f: 32, label: '32' },
  { f: 100, label: '100' },
  { f: 250, label: '250' },
  { f: 500, label: '500' },
  { f: 1000, label: '1k' },
  { f: 4000, label: '4k' },
  { f: 10000, label: '10k' },
  { f: 16000, label: '16k' },
];

const DB_LINES = [9, 6, 3, 0, -3, -6, -9];

export const EQCurve: React.FC<EQCurveProps> = ({ bands }) => {
  const W = 800;
  const H = 200;
  const DB_RANGE = 13;

  const { points, linePath, fillPath } = useMemo(() => {
    const pts = computeCurve(bands, 200);

    const freqToX = (f: number) =>
      ((Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * W;
    const gainToY = (g: number) =>
      H / 2 - (g / DB_RANGE) * (H / 2) * 0.85;

    const line = buildPath(pts, W, H, DB_RANGE);

    // Closed fill path: go along curve then back along bottom
    const firstX = freqToX(pts[0].freq);
    const lastX = freqToX(pts[pts.length - 1].freq);
    const fill = `${line} L${lastX.toFixed(1)},${H / 2} L${firstX.toFixed(1)},${H / 2} Z`;

    return { points: pts, linePath: line, fillPath: fill };
  }, [bands]);

  // Hover state for tooltip
  const [hoverInfo, setHoverInfo] = React.useState<{ x: number; freq: number; gain: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const freq = 20 * Math.pow(1000, xRatio);
    const clampedFreq = Math.max(20, Math.min(20000, freq));
    // Find nearest point
    const nearest = points.reduce((best, p) =>
      Math.abs(Math.log10(p.freq) - Math.log10(clampedFreq)) <
      Math.abs(Math.log10(best.freq) - Math.log10(clampedFreq)) ? p : best
    );
    setHoverInfo({ x: xRatio * 100, freq: nearest.freq, gain: nearest.gain });
  };

  const freqToXPct = (f: number) =>
    ((Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * 100;

  return (
    <div className="w-full h-32 md:h-48 bg-[#0a0a0b] rounded-2xl border border-white/10 overflow-hidden relative group">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <defs>
          <linearGradient id="eqFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F27D26" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#F27D26" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#F27D26" stopOpacity="0" />
          </linearGradient>
          <filter id="curveGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="curveClip">
            <rect x="0" y="0" width={W} height={H / 2} />
          </clipPath>
          <clipPath id="curveCutClip">
            <rect x="0" y={H / 2} width={W} height={H / 2} />
          </clipPath>
        </defs>

        {/* dB grid lines */}
        {DB_LINES.map(db => {
          const y = H / 2 - (db / DB_RANGE) * (H / 2) * 0.85;
          return (
            <line
              key={db}
              x1={0} y1={y} x2={W} y2={y}
              stroke={db === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}
              strokeWidth={db === 0 ? 1.5 : 1}
              strokeDasharray={db === 0 ? undefined : '4 6'}
            />
          );
        })}

        {/* Frequency vertical grid */}
        {FREQ_LABELS.map(({ f }) => {
          const x = ((Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * W;
          return (
            <line
              key={f}
              x1={x} y1={0} x2={x} y2={H}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          );
        })}

        {/* Boost fill (above zero line) */}
        <path d={fillPath} fill="url(#eqFillGrad)" clipPath="url(#curveClip)" />

        {/* Cut fill (below zero line) */}
        <path d={fillPath} fill="rgba(100,140,255,0.08)" clipPath="url(#curveCutClip)" />

        {/* Glow layer */}
        <path d={linePath} fill="none" stroke="#F27D26" strokeWidth={6} strokeOpacity={0.2} filter="url(#curveGlow)" />

        {/* Main curve */}
        <path d={linePath} fill="none" stroke="#F27D26" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover crosshair */}
        {hoverInfo && (() => {
          const x = (hoverInfo.x / 100) * W;
          const y = H / 2 - (hoverInfo.gain / DB_RANGE) * (H / 2) * 0.85;
          return (
            <>
              <line x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 4" />
              <circle cx={x} cy={y} r={4} fill="#F27D26" stroke="#fff" strokeWidth={1.5} />
            </>
          );
        })()}
      </svg>

      {/* Frequency labels */}
      <div className="absolute bottom-2 left-0 right-0 flex pointer-events-none px-1">
        {FREQ_LABELS.map(({ f, label }) => (
          <span
            key={f}
            className="absolute text-[8px] font-mono text-white/20 transform -translate-x-1/2"
            style={{ left: `${freqToXPct(f)}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* dB labels */}
      <div className="absolute top-0 left-2 h-full flex flex-col justify-between pointer-events-none py-2">
        {['+12', '+6', '0', '-6', '-12'].map(l => (
          <span key={l} className="text-[7px] font-mono text-white/15">{l}</span>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoverInfo && (
        <div
          className="absolute top-3 pointer-events-none bg-[#1a1c20]/90 border border-white/10 px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-sm"
          style={{
            left: hoverInfo.x < 75 ? `calc(${hoverInfo.x}% + 10px)` : undefined,
            right: hoverInfo.x >= 75 ? `calc(${100 - hoverInfo.x}% + 10px)` : undefined,
          }}
        >
          <p className="text-[9px] font-mono text-[#8E9299] uppercase tracking-widest">
            {hoverInfo.freq >= 1000 ? `${(hoverInfo.freq / 1000).toFixed(1)}kHz` : `${hoverInfo.freq}Hz`}
          </p>
          <p className="text-sm font-black text-white">
            {hoverInfo.gain >= 0 ? '+' : ''}{hoverInfo.gain.toFixed(1)} dB
          </p>
        </div>
      )}

      {/* Badge */}
      <div className="absolute top-3 left-4 pointer-events-none">
        <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest bg-black/30 px-2 py-0.5 rounded">
          Biquad · Exact Response
        </span>
      </div>
    </div>
  );
};
