import { useRef, useEffect, useCallback } from 'react';
import { EQBand } from '@/lib/audio-engine';

export type UserIntent = 'explore' | 'adjust' | 'precise' | 'idle';

export interface AudioPerception {
  energy: { level: number; trend: 'rising' | 'falling' | 'stable'; volatility: number };
  spectrum: { low: number; mid: number; high: number };
  rhythm: { pulseStrength: number; regularity: number; bpm: number; phase: number };
  envelope: { attack: number; decay: number };
}

export interface UserPerception {
  intent: UserIntent;
  focusLevel: number;
  confidence: number;
  gesture: { type: 'drag' | 'tap' | 'hover' | 'flick' | 'none'; velocityNormalized: number };
}

export interface SystemPerception {
  stability: number;
  load: number;
  responsiveness: number;
  thermal: number;
}

export interface ExpressionState {
  intensity: number;
  motion: { speed: number; easing: 'linear' | 'easeOutQuad' | 'damped'; continuity: number };
  eq: {
    curve: { points: { freq: number; gain: number }[]; tweenProgress: number };
    ghostCurve: { active: boolean; opacity: number; lifetime: number; originalPoints: { freq: number; gain: number }[] };
    interactionPhysics: { resistance: number; snapBack: number };
    predictiveHint: { enabled: boolean; opacity: number; futurePoints: { freq: number; gain: number }[] };
    bandGlow: { bandIndex: number | null; color: 'low' | 'mid' | 'high'; intensity: number; timestamp: number };
    transform: { scale: number; blur: number; saturation: number };
  };
  background: {
    type: 'aurora';
    breathing: { speed: number; intensity: number };
    hue: number;
    saturation: number;
    lightness: number;
    rimPulse: { active: boolean; intensity: number; decay: number; position: 'all' | 'bottom' };
    sparkle: { opacity: number; density: number; size: number };
    opacity: number;
  };
  micro: {
    signals: Array<{
      id: string;
      type: 'pulse' | 'glow' | 'fade' | 'snap' | 'confetti' | 'morph';
      target: 'confidenceBar' | 'eqBand' | 'profile' | 'calibration';
      intensity: number;
      duration: number;
      startTime: number;
      color?: string;
    }>;
    maxConcurrent: number;
  };
}

const ema = (current: number, previous: number, alpha: number) => {
  return current * alpha + previous * (1 - alpha);
};

export function useNeuromorphicEngine(
  analyzer: AnalyserNode | null,
  bands: EQBand[]
) {
  const frameTimeRef = useRef<number>(16.6);
  const lastTimeRef = useRef<number>(0);
  const freqBuf = useRef<Uint8Array | null>(null);

  const pointerState = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isDragging: false,
    hoverDuration: 0,
    lastMove: 0,
  });

  const perceptionRef = useRef<{ audio: AudioPerception; user: UserPerception; system: SystemPerception }>({
    audio: {
      energy: { level: 0, trend: 'stable', volatility: 0 },
      spectrum: { low: 0, mid: 0, high: 0 },
      rhythm: { pulseStrength: 0, regularity: 0, bpm: 0, phase: 0 },
      envelope: { attack: 0, decay: 0 },
    },
    user: { intent: 'idle', focusLevel: 0, confidence: 1, gesture: { type: 'none', velocityNormalized: 0 } },
    system: { stability: 1, load: 0, responsiveness: 1, thermal: 0 },
  });

  const attentionRef = useRef({ eq: 0, background: 0, micro: 0 });

  const expressionRef = useRef<ExpressionState>({
    intensity: 1,
    motion: { speed: 1, easing: 'linear', continuity: 1 },
    eq: {
      curve: { points: [], tweenProgress: 1 },
      ghostCurve: { active: false, opacity: 0, lifetime: 0, originalPoints: [] },
      interactionPhysics: { resistance: 0.2, snapBack: 1 },
      predictiveHint: { enabled: false, opacity: 0, futurePoints: [] },
      bandGlow: { bandIndex: null, color: 'mid', intensity: 0, timestamp: 0 },
      transform: { scale: 1, blur: 0, saturation: 1 },
    },
    background: {
      type: 'aurora',
      breathing: { speed: 5, intensity: 0 },
      hue: 200,
      saturation: 0.5,
      lightness: 0.1,
      rimPulse: { active: false, intensity: 0, decay: 0.2, position: 'all' },
      sparkle: { opacity: 0, density: 0, size: 2 },
      opacity: 1,
    },
    micro: { signals: [], maxConcurrent: 2 },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleMove = (e: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(1, now - pointerState.current.lastMove);
      const vx = (e.clientX - pointerState.current.x) / dt;
      const vy = (e.clientY - pointerState.current.y) / dt;
      pointerState.current = {
        ...pointerState.current,
        x: e.clientX,
        y: e.clientY,
        vx: ema(vx, pointerState.current.vx, 0.4),
        vy: ema(vy, pointerState.current.vy, 0.4),
        lastMove: now,
      };
    };
    const handleDown = () => pointerState.current.isDragging = true;
    const handleUp = () => pointerState.current.isDragging = false;

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    if (analyzer && !freqBuf.current) {
        freqBuf.current = new Uint8Array(analyzer.frequencyBinCount);
    }

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      frameTimeRef.current = ema(dt, frameTimeRef.current, 0.1);
      const currentFps = 1000 / dt;
      const stability = Math.max(0, 1 - Math.abs(dt - 16.6) / 16.6);
      const load = Math.max(0, 1 - Math.min(1, currentFps / 60));

      let audioELevel = 0, low = 0, mid = 0, high = 0;
      if (analyzer && freqBuf.current) {
        // @ts-ignore
        analyzer.getByteFrequencyData(freqBuf.current);
        let sum = 0;
        for (let i=0; i<freqBuf.current.length; i++) {
          const val = freqBuf.current[i] / 255;
          sum += val;
          if (i < 10) low += val;
          else if (i < 100) mid += val;
          else high += val;
        }
        audioELevel = sum / freqBuf.current.length;
        low = low / 10;
        mid = mid / 90;
        high = high / (freqBuf.current.length - 100);
      }

      const p = perceptionRef.current;
      const energyL = ema(audioELevel, p.audio.energy.level, 0.2);
      const lowL = ema(low, p.audio.spectrum.low, 0.3);
      const midL = ema(mid, p.audio.spectrum.mid, 0.3);
      const highL = ema(high, p.audio.spectrum.high, 0.3);
      const pulse = audioELevel > p.audio.energy.level + 0.1 ? 1 : p.audio.rhythm.pulseStrength * 0.9;
      
      const velocity = Math.sqrt(pointerState.current.vx ** 2 + pointerState.current.vy ** 2);
      let intent: UserIntent = 'idle';
      if (pointerState.current.isDragging) {
         intent = velocity > 0.5 ? 'explore' : 'precise';
      } else if (velocity > 0) {
         intent = 'explore';
      }

      p.audio.energy.level = energyL;
      p.audio.spectrum.low = lowL;
      p.audio.spectrum.mid = midL;
      p.audio.spectrum.high = highL;
      p.audio.rhythm.pulseStrength = pulse;

      p.user.intent = intent;
      p.user.confidence = Math.max(0, Math.min(1, p.user.confidence + (intent === 'precise' ? 0.01 : 0)));
      p.user.gesture = { type: pointerState.current.isDragging ? 'drag' : 'none', velocityNormalized: Math.min(1, velocity) };

      p.system.stability = ema(stability, p.system.stability, 0.1);
      p.system.load = ema(load, p.system.load, 0.1);

      const priorityEq = 0.5 * ((p.user.intent as string) === 'adjust' || p.user.intent === 'precise' ? 1.5 : 1) * (p.user.focusLevel + 0.5) * (p.audio.energy.level + 0.5) * p.system.stability;
      const priorityBg = 0.2 * (p.user.intent === 'explore' ? 1.5 : 1) * (p.user.focusLevel + 0.5) * (p.audio.energy.level + 0.5) * p.system.stability;
      const priorityMicro = 0.3 * (p.user.intent === 'idle' ? 1.5 : 1) * (p.user.focusLevel + 0.5) * (p.audio.energy.level + 0.5) * p.system.stability;
      const sumPriorities = priorityEq + priorityBg + priorityMicro || 1;
      
      const a = attentionRef.current;
      a.eq = ema(priorityEq / sumPriorities, a.eq, 0.3);
      a.background = ema(priorityBg / sumPriorities, a.background, 0.3);
      a.micro = ema(priorityMicro / sumPriorities, a.micro, 0.3);

      const exp = expressionRef.current;
      exp.intensity = (a.eq + a.background + a.micro) * p.system.stability * (1 - p.system.load);
      exp.motion.speed = p.system.stability > 0.8 ? (p.user.intent === 'explore' ? 0.9 : 0.2) : 0.05;
      exp.motion.easing = p.system.stability > 0.8 ? (p.user.intent === 'explore' ? 'linear' : 'easeOutQuad') : 'damped';

      exp.eq.ghostCurve.active = p.user.confidence < 0.3;
      exp.eq.ghostCurve.opacity = a.eq * 0.3;
      exp.eq.ghostCurve.lifetime = Math.max(0, exp.eq.ghostCurve.lifetime - dt);
      exp.eq.predictiveHint.enabled = (p.user.intent as string) === 'adjust';
      exp.eq.predictiveHint.opacity = 0.15;
      exp.eq.transform.scale = Math.max(1, a.eq * 0.2 + 1);
      exp.eq.transform.blur = p.system.stability < 0.3 ? 10 * (1 - p.system.stability) : 0;
      
      exp.background.breathing.speed = 1 + (1 - p.audio.energy.level) * 4;
      exp.background.breathing.intensity = a.background * p.audio.rhythm.pulseStrength;
      exp.background.hue = 200 + p.audio.spectrum.mid * 160;
      exp.background.saturation = 0.4 + p.audio.energy.level * 0.4;
      exp.background.lightness = 0.1 + p.system.stability * 0.2;
      exp.background.rimPulse.active = p.audio.spectrum.low > 0.7 && p.system.load < 0.7;
      exp.background.rimPulse.intensity = p.audio.spectrum.low;
      exp.background.rimPulse.decay = ema(0.2, exp.background.rimPulse.decay, 0.1);
      exp.background.sparkle.opacity = p.system.load > 0.7 ? 0 : p.audio.spectrum.high * 0.5;
      exp.background.sparkle.density = p.system.load > 0.7 ? 0 : 0.2 + p.audio.spectrum.high * 0.8;
      exp.background.sparkle.size = 2 + p.audio.spectrum.high * 6;
      exp.background.opacity = p.system.load > 0.9 ? 0 : a.background * (p.system.stability > 0.3 ? 1 : 0.5);

      exp.micro.signals = exp.micro.signals.filter(s => time - s.startTime < s.duration);
      exp.micro.maxConcurrent = p.system.load > 0.7 ? 1 : 2;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [analyzer, bands]);

  const triggerMicroFeedback = useCallback((signal: Omit<ExpressionState['micro']['signals'][0], 'id' | 'startTime'>) => {
    const prev = expressionRef.current;
    if (prev.micro.signals.length >= prev.micro.maxConcurrent) return;
    prev.micro.signals.push({ ...signal, id: Math.random().toString(), startTime: performance.now() });
  }, []);

  return { perceptionRef, attentionRef, expressionRef, triggerMicroFeedback };
}

