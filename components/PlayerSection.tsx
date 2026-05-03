'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Music, SkipBack, Pause, Play, SkipForward, Volume2, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAudioEngine } from '@/lib/audio-engine-context';

function waveformToMoodColor(waveform: Float32Array | null, defaultColor: string = '#F27D26'): string {
  if (!waveform || waveform.length === 0) return defaultColor;
  let sum = 0;
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < waveform.length; i++) {
    sum += waveform[i];
    if (waveform[i] > max) max = waveform[i];
    if (waveform[i] < min) min = waveform[i];
  }
  const avgAmplitude = sum / waveform.length;
  const dynamicRange = max - min;
  
  if (dynamicRange > 0.8) return '#F27D26'; // high dynamic = warm amber
  if (avgAmplitude > 0.6) return '#6366F1'; // loud = purple
  if (avgAmplitude < 0.2) return '#0EA5E9'; // quiet = blue
  return defaultColor; 
}

interface PlayerSectionProps {
  currentTrackName: string;
  audioSourceUrl?: string;
  activeProfileColor?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioMetadata?: { sampleRate: number; bitDepth: number | string; channels: number; format: string } | null;
  onSeek: (time: number) => void;
  onBrowseLibrary: () => void;
  onRewImport: () => void;
  onFileUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPrevTrack: () => void;
  onTogglePlayback: () => void;
  onNextTrack: () => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  isMinimized?: boolean;
  onWakeUp?: () => void;
  onMinimize?: () => void;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function PlayerSection({
  currentTrackName,
  audioSourceUrl,
  activeProfileColor = '#F27D26',
  isPlaying,
  currentTime,
  duration,
  audioMetadata,
  onSeek,
  onBrowseLibrary,
  onRewImport,
  onPrevTrack,
  onTogglePlayback,
  onNextTrack,
  volume,
  onVolumeChange,
  isMinimized = false,
  onWakeUp,
  onMinimize,
}: PlayerSectionProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  
  const engine = useAudioEngine();
  const [waveform, setWaveform] = useState<Float32Array | null>(null);

  const [metrics, setMetrics] = useState({
    lufs: -70,
    peak: -96,
    dr: 0,
    isResampled: false
  });

  useEffect(() => {
    if (!engine) return;
    const interval = setInterval(() => {
      const l = typeof engine.getLoudnessMetrics === 'function' ? engine.getLoudnessMetrics() : null;
      setMetrics({
        lufs: l ? Math.round(l.integrated) : -70,
        peak: l ? Math.round(l.peak) : -96,
        dr: l ? Math.round((Math.abs(l.peak - l.integrated) || 0) * 10) / 10 : 0,
        isResampled: engine.isResampled || false
      });
    }, 500);
    return () => clearInterval(interval);
  }, [engine, isPlaying]);

  const displayMeta = useMemo(() => {
    if (audioMetadata) return audioMetadata;
    return {
      sampleRate: 44100,
      bitDepth: 16,
      format: 'MP3'
    };
  }, [audioMetadata]);

  useEffect(() => {
    let active = true;
    if (!audioSourceUrl || !engine) {
      if (waveform !== null) {
        requestAnimationFrame(() => active && setWaveform(null));
      }
      return;
    }
    
    // Only support blob URLs or same-origin for now, engine handles it mostly.
    engine.getWaveformThumbnail(audioSourceUrl, 100)
      .then(data => {
        if (active) setWaveform(data);
      })
      .catch((e: any) => console.warn("Waveform gen error", e));

    return () => { active = false; };
  }, [audioSourceUrl, engine, waveform]);

  const moodColor = useMemo(() => waveformToMoodColor(waveform, activeProfileColor), [waveform, activeProfileColor]);

  // Mini keyboard shortcuts overlay
  const [showShortcuts, setShowShortcuts] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ignore if typing in input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === '?' || (e.key === '?' && e.shiftKey)) {
        setShowShortcuts(prev => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        onTogglePlayback();
      } else if (e.key === 'ArrowRight') {
        onSeek(Math.min(duration, currentTime + 5));
      } else if (e.key === 'ArrowLeft') {
        onSeek(Math.max(0, currentTime - 5));
      } else if (e.key === 'Escape') {
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, onTogglePlayback, onSeek]);

  return (
    <>
      <AnimatePresence>
        {showShortcuts && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-black/90 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl font-mono text-sm pointer-events-auto">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded">⌨</span> Keyboard Shortcuts
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[#8E9299]">
                <div><span className="text-white/80 w-16 inline-block">Space</span> Play/Pause</div>
                <div><span className="text-white/80 w-16 inline-block">←  →</span> Seek 5s</div>
                <div><span className="text-white/80 w-16 inline-block">Ctrl+Z</span> Undo EQ</div>
                <div><span className="text-white/80 w-16 inline-block">Ctrl+S</span> Save Profile</div>
                <div><span className="text-white/80 w-16 inline-block">Ctrl+E</span> Export</div>
                <div><span className="text-white/80 w-16 inline-block">?</span> Toggle Help</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isMinimized ? (
          <motion.div
            key="minimized"
            onClick={onWakeUp}
            drag="y"
            dragConstraints={{ top: -50, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y < -20 && onWakeUp) {
                onWakeUp();
              }
            }}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="pointer-events-auto cursor-pointer max-w-3xl w-full mx-auto bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl p-2.5 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden group hover:border-white/20 hover:bg-black/80 transition-all hover:-translate-y-1 touch-none"
          >
            {/* Ambient Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-1000" style={{ background: `linear-gradient(90deg, ${moodColor}, transparent)` }} />

            {/* Album Art Placeholder */}
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden shadow-inner border border-white/5"
              style={{ background: `linear-gradient(135deg, #111, #000)` }}
            >
              <Music className="w-6 h-6 opacity-80" style={{ color: moodColor }} />
              {isPlaying && (
                <motion.div 
                  className="absolute inset-0 mix-blend-screen"
                  style={{ backgroundColor: `${moodColor}40` }}
                  animate={{ opacity: [0.1, 0.5, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </div>
            
            <div className="flex flex-col min-w-0 flex-1 justify-center z-10">
               <div className="flex items-center gap-2 mb-1">
                 <span className="text-[14px] font-bold text-white truncate w-full pr-2 tracker-tight drop-shadow-md">{currentTrackName}</span>
                 <span className="text-[11px] font-mono text-white/50 bg-white/5 px-1.5 py-0.5 rounded ml-auto shrink-0 border border-white/10">Hi-Res Audio</span>
               </div>
               
               {/* Mini waveform + Progress */}
               <div className="flex items-center gap-2 w-full pr-2 mt-0.5" onClick={e => e.stopPropagation()}>
                 <span className="text-[10px] font-mono text-white/40 w-8">{formatTime(currentTime)}</span>
                 <div 
                    className="flex-1 h-3 flex items-end gap-[1px] opacity-90 cursor-pointer group/seek"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSeek(( (e.clientX - rect.left) / rect.width ) * duration);
                    }}
                 >
                   {waveform ? (
                     Array.from(waveform).slice(0, 80).map((v, i) => {
                       const isPast = (i / 80) <= progressRatio;
                       return (
                         <div 
                           key={i} 
                           className="flex-1 rounded-sm transition-colors duration-200" 
                           style={{ 
                             height: `${Math.max(10, v * 100)}%`,
                             backgroundColor: isPast ? moodColor : 'rgba(255,255,255,0.15)',
                             opacity: isPast ? 1 : 0.4
                           }} 
                         />
                       );
                     })
                   ) : (
                     <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden self-center group-hover/seek:h-2 transition-all">
                       <div className="absolute top-0 left-0 bottom-0 transition-none" style={{ width: `${progress}%`, backgroundColor: moodColor }} />
                     </div>
                   )}
                 </div>
                 <span className="text-[10px] font-mono text-white/40 w-8 text-right">{formatTime(duration)}</span>
               </div>
            </div>
    
            <div className="flex items-center gap-2 shrink-0 z-10 px-2" onClick={e => e.stopPropagation()}>
              <button 
                onClick={(e) => { e.stopPropagation(); onVolumeChange(volume === 0 ? 1 : 0); }}
                className="w-8 h-8 rounded-full text-white/40 hover:text-white flex items-center justify-center hover:bg-white/10 transition-all sm:flex hidden"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-white/10 mx-1 sm:block hidden" />

              <button 
                onClick={(e) => { e.stopPropagation(); onPrevTrack(); }}
                className="w-10 h-10 rounded-full text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onTogglePlayback(); }}
                className="w-12 h-12 rounded-full text-black bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_4px_14px_rgba(255,255,255,0.25)]"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onNextTrack(); }}
                className="w-10 h-10 rounded-full text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
             key="full"
             initial={{ opacity: 0, y: "100%" }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: "100%" }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto"
          >
             {/* Backdrop */}
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => onMinimize && onMinimize()}
               className="absolute inset-0 bg-black/80 backdrop-blur-md"
             />
  
             {/* Drawer Content */}
             <motion.div 
               drag="y"
               dragConstraints={{ top: 0, bottom: 0 }}
               dragElastic={{ top: 0, bottom: 0.5 }}
               onDragEnd={(e, info) => {
                 if (info.offset.y > 100 && onMinimize) {
                   onMinimize();
                 }
               }}
               className="relative w-full h-[95vh] sm:h-[88vh] sm:max-w-[440px] bg-[#0a0b0e] border border-white/10 rounded-t-[2.5rem] sm:rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col pt-6 pb-8 px-6 sm:px-8 overflow-hidden mx-auto"
             >
               {/* Dynamic Ambient Background */}
               <div className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-screen" style={{ background: `radial-gradient(circle at 50% 20%, ${moodColor}, transparent 70%)` }} />

               {/* Swipe handle */}
               <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 pointer-events-none" />
  
               {/* Header */}
               <div className="flex items-center justify-between mb-8 relative z-10">
                 <button onClick={() => onMinimize && onMinimize()} className="p-2 -ml-2 text-white/50 hover:text-white transition-colors">
                   <X className="w-6 h-6" />
                 </button>
                 <div className="flex flex-col items-center">
                   <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.25em]">Now Playing</span>
                   <div className="flex items-center gap-1.5 mt-0.5">
                     <span className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: moodColor, color: moodColor }} />
                     <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Hi-Res Engine</span>
                   </div>
                 </div>
                 <button className="p-2 -mr-2 text-white/50 hover:text-white transition-colors">
                   {/* Menu placeholder */}
                   <div className="flex flex-col gap-1 w-5"><div className="h-0.5 bg-current rounded-full" /><div className="h-0.5 w-3 ml-auto bg-current rounded-full" /></div>
                 </button>
               </div>
  
               <div className="flex flex-col items-center flex-1 min-h-0 relative z-10 w-full mb-4">
                 
                 {/* Large Square Cover */}
                 <div 
                   className="w-full aspect-square max-h-[35vh] sm:max-h-[320px] max-w-[320px] rounded-[2rem] bg-gradient-to-br from-[#1a1c23] to-[#08090b] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] flex items-center justify-center relative overflow-hidden transition-colors duration-1000 group mb-6 mt-1 mx-auto"
                   style={{ 
                     boxShadow: isPlaying ? `0 20px 50px -20px ${moodColor}60` : ''
                   }}
                 >
                   <Music className="w-20 h-20 text-white/5 group-hover:scale-105 transition-transform duration-700" />
                   {isPlaying && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 mix-blend-screen pointer-events-none" 
                        style={{ background: `radial-gradient(circle at center, ${moodColor}20, transparent 65%)` }}
                      />
                   )}
                 </div>
                 
                 {/* Track Title and Stats */}
                 <div className="w-full flex flex-col justify-center items-center text-center px-2 mb-6 shrink-0">
                   <h2 className="text-xl sm:text-2xl font-black text-white truncate w-full tracking-tight mb-2 leading-tight px-4">
                     {currentTrackName}
                   </h2>
                   
                   <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                     <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider" style={{ color: moodColor, backgroundColor: `${moodColor}15` }}>
                       AI Neuromorphic
                     </span>
                     <span className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] text-white/70 font-mono">
                       {displayMeta.sampleRate / 1000}kHz
                     </span>
                     <span className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] text-white/70 font-mono">
                       {displayMeta.bitDepth}-Bit
                     </span>
                     <span className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] text-white/70 font-mono">
                       {metrics.isResampled ? 'DSP' : 'Lossless'}
                     </span>
                   </div>

                   {/* Compact Advanced Info (Hiby vibe) */}
                   <div className="grid grid-cols-3 w-full max-w-[280px] gap-2 divide-x divide-white/10 border-t border-b border-white/5 py-2">
                     <div className="flex flex-col items-center justify-center">
                       <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold">LUFS</span>
                       <span className="text-xs font-mono text-white/80">{metrics.lufs}</span>
                     </div>
                     <div className="flex flex-col items-center justify-center">
                       <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Dynamic</span>
                       <span className="text-xs font-mono text-white/80">{metrics.dr.toFixed(1)}dB</span>
                     </div>
                     <div className="flex flex-col items-center justify-center">
                       <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Peak</span>
                       <span className="text-xs font-mono text-white/80">{metrics.peak}</span>
                     </div>
                   </div>
                 </div>

                 {/* Waveform Scrubber */}
                 <div className="w-full flex flex-col justify-center gap-1.5 mb-6 shrink-0 mt-auto px-2">
                   <div className="flex justify-between items-center w-full px-1 mb-1">
                     <span className="text-[11px] font-mono font-medium text-white/40">{formatTime(currentTime)}</span>
                     <span className="text-[11px] font-mono font-medium text-white/40">{formatTime(duration)}</span>
                   </div>
                   <div 
                     className="relative w-full cursor-pointer group/progress touch-none flex items-end h-8 gap-[1px]" 
                     onClick={(e) => {
                       const rect = e.currentTarget.getBoundingClientRect();
                       const x = e.clientX - rect.left;
                       onSeek((x / rect.width) * duration);
                     }}
                   >
                     <div className="absolute inset-y-0 -inset-x-2 bg-white/0 group-hover/progress:bg-white/5 rounded-xl transition-colors" />

                     {waveform ? (
                       Array.from(waveform).map((v, i) => {
                         const percent = i / waveform.length;
                         const isPast = percent <= progressRatio;
                         return (
                           <div 
                             key={i}
                             className="flex-1 rounded-sm origin-bottom z-10 transition-colors duration-100"
                             style={{
                               height: `${Math.max(20, v * 100)}%`,
                               backgroundColor: isPast ? moodColor : 'rgba(255, 255, 255, 0.2)',
                               opacity: isPast ? 1 : 0.3
                             }}
                           />
                         )
                       })
                     ) : (
                       <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden self-center group-hover/progress:h-2 transition-all z-10">
                         <div className="absolute top-0 left-0 bottom-0 transition-linear duration-300" style={{ width: `${progress}%`, backgroundColor: moodColor }} />
                       </div>
                     )}
                   </div>
                 </div>

                 {/* Primary Playback Controls */}
                 <div className="flex items-center justify-between w-full max-w-[320px] shrink-0 mb-4">
                   <button onClick={onBrowseLibrary} className="p-3 text-white/30 hover:text-white transition-colors">
                     <Music className="w-5 h-5" />
                   </button>
                   <button onClick={onPrevTrack} className="p-3 text-white/60 hover:text-white transition-colors hover:scale-110 active:scale-95">
                     <SkipBack className="w-7 h-7 fill-current" />
                   </button>
                   <button
                     onClick={onTogglePlayback}
                     className="w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5"
                     style={{ background: `linear-gradient(135deg, ${moodColor}, #9d4b1a)` }}
                   >
                     {isPlaying ? <Pause className="w-7 h-7 text-white fill-current" /> : <Play className="w-7 h-7 text-white fill-current ml-1" />}
                   </button>
                   <button onClick={onNextTrack} className="p-3 text-white/60 hover:text-white transition-colors hover:scale-110 active:scale-95">
                     <SkipForward className="w-7 h-7 fill-current" />
                   </button>
                   <button onClick={onRewImport} className="p-3 text-white/30 hover:text-white transition-colors relative">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-2.5 right-2.5 shadow-[0_0_5px_currentColor]" />
                     <Settings className="w-5 h-5" />
                   </button>
                 </div>
               </div>
  
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>

  );
}
