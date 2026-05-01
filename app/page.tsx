'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Settings, Sparkles, Volume2, Music, 
  Download, List, Sliders, Activity,
  ArrowRight, RotateCcw, Save, FolderOpen,
  Undo2, Redo2, Upload, X, ChevronDown
} from 'lucide-react';
import { AudioEngine, DEFAULT_BANDS, EQBand, AB_PREVIEW_GAINS } from '@/lib/audio-engine';
import { Visualizer } from '@/components/Visualizer';
import { EQPanel } from '@/components/EQPanel';
import { EQCurve } from '@/components/EQCurve';
import { TuningWizard } from '@/components/TuningWizard';
import { EQProfile } from '@/lib/ai-engine';
import {
  SavedProfile,
  saveProfile,
  getAllProfiles,
  deleteProfile,
  persistCurrentState,
  loadCurrentState,
  exportProfileAsJSON,
  exportProfileAsAPO,
  parseEqualizerAPO,
} from '@/lib/profile-store';
import { useEQHistory } from '@/hooks/use-eq-history';

const TRACKS = [
  { id: 'idol', name: 'J-Pop Vibe (CORS)', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a7315b.mp3' },
  { id: 'anime', name: 'Ambient Chill (CORS)', url: 'https://cdn.pixabay.com/audio/2022/01/21/audio_3174244a07.mp3' },
  { id: 'citypop', name: 'Retro Synth (CORS)', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_17e3a242c1.mp3' },
];

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bands, setBands] = useState<EQBand[]>(DEFAULT_BANDS);
  const [volume, setVolume] = useState(0.8);
  const [preAmp, setPreAmp] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [analyzer, setAnalyzer] = useState<AnalyserNode | null>(null);
  const [lastSync, setLastSync] = useState<string>('');
  const [audioSource, setAudioSource] = useState(TRACKS[0].url);
  const [currentTrackName, setCurrentTrackName] = useState(TRACKS[0].name);
  const [urlInput, setUrlInput] = useState('');
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [isAICalibrated, setIsAICalibrated] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileColor, setProfileColor] = useState<string>('#F27D26');
  const [profileGenre, setProfileGenre] = useState<string | null>(null);

  // Profile library
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Undo/Redo history
  const history = useEQHistory();

  useEffect(() => {
    // Set last sync on mount only to avoid hydration mismatch and linter warnings
    const time = new Date().toLocaleTimeString();
    const timer = setTimeout(() => {
      setLastSync(time);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const initAudio = async () => {
    if (!audioRef.current) return;
    
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    
    await engineRef.current.initialize(audioRef.current);
    setAnalyzer(engineRef.current.getAnalyzer());
    setIsReady(true);
  };

  useEffect(() => {
    if (engineRef.current && isReady) {
      (window as any).__ENGINE__ = engineRef.current;
      (window as any).__AUDIO_SRC__ = audioSource;
    }
  }, [isReady, audioSource]);

  const togglePlayback = async () => {
    if (!audioRef.current) return;
    
    // Explicitly resume on every click to be safe
    if (engineRef.current) {
      await engineRef.current.resume();
    } else {
      await initAudio();
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const promise = audioRef.current.play();
        if (promise !== undefined) {
          promise.then(() => {
            setIsPlaying(true);
            setErrorHeader(null);
          }).catch(error => {
            console.error("Playback failed:", error);
            setErrorHeader("Autoplay blocked or network error.");
            setIsPlaying(false);
          });
        }
      }
    } catch (err) {
      console.error("Playback error:", err);
      setIsPlaying(false);
    }
  };

  const handleTrackChange = async (url: string, name: string) => {
    setAudioSource(url);
    setCurrentTrackName(name);
    setIsPlaying(false);
    setErrorHeader(null);
    
    // In Next.js/React, we need to wait for src to update before loading
    setTimeout(() => {
      if (audioRef.current) {
        // Clear previous state
        audioRef.current.pause();
        audioRef.current.load();
        setIsPlaying(false);
      }
    }, 0);
  };

  const handleBandChange = (index: number, params: Partial<EQBand>) => {
    const newBands = [...bands];
    newBands[index] = { ...newBands[index], ...params };
    setBands(newBands);
    engineRef.current?.updateBandParams(index, params);

    // Push to undo history (only on gain change to avoid flooding on Q/freq tweaks)
    if (params.gain !== undefined) {
      history.push(newBands, preAmp);
    }

    // Auto Pre-Amp: reduce preamp to headroom if any band boosts
    const maxGain = Math.max(...newBands.map(b => b.gain));
    const newPreAmp = maxGain > 0 ? -maxGain * 0.5 : 0;
    setPreAmp(newPreAmp);
    engineRef.current?.setPreAmp(newPreAmp);
    debouncedPersist(newBands, newPreAmp);
  };

  const handlePreAmpChange = (val: number) => {
    setPreAmp(val);
    engineRef.current?.setPreAmp(val);
    debouncedPersist(bands, val);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    engineRef.current?.setMasterVolume(val);
  };

  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Real A/B crossfade preview:
   * 1. Auto-play if paused
   * 2. Seek to the calibration segment for this scenario
   * 3. Load gains into chain A (preview)
   * 4. Crossfade from B (current) → A (preview) or vice-versa
   */
  const handlePreviewAB = (scenarioId: string, branch: 'A' | 'B', seekTime?: number) => {
    if (!engineRef.current || !audioRef.current) return;

    // Start playback if needed
    if (audioRef.current.paused) togglePlayback();

    // Seek to the best segment for this scenario
    if (seekTime !== undefined) {
      audioRef.current.currentTime = seekTime;
    } else if (audioRef.current.currentTime > 120) {
      audioRef.current.currentTime = 30;
    }

    // Load the correct gains for branch A into the preview chain
    const gains = AB_PREVIEW_GAINS[scenarioId];
    if (gains) {
      engineRef.current.loadPreviewGains(gains[branch]);
      engineRef.current.crossfadeTo('A'); // A chain always holds the preview gains
    }
  };

  const handleExitAB = () => {
    engineRef.current?.exitABMode();
  };

  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const applyBandsToEngine = useCallback((newBands: EQBand[], newPreAmp: number) => {
    newBands.forEach((band, i) => engineRef.current?.updateBandParams(i, band));
    engineRef.current?.setPreAmp(newPreAmp);
  }, []);

  const debouncedPersist = useCallback((newBands: EQBand[], newPreAmp: number) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => persistCurrentState(newBands, newPreAmp), 500);
  }, []);

  // Load persisted state on mount
  useEffect(() => {
    const { bands: savedBands, preAmp: savedPreAmp } = loadCurrentState();
    if (savedBands && savedBands.length === 10) {
      setBands(savedBands);
      setPreAmp(savedPreAmp);
      if (engineRef.current) applyBandsToEngine(savedBands, savedPreAmp);
    }
    setSavedProfiles(getAllProfiles());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Don't fire when typing in inputs
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      // Ctrl+Z / Cmd+Z — Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z — Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl+Y — Redo (Windows style)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Space — Play/Pause
      if (e.key === ' ' && !showWizard && !showProfilePanel && !showSaveDialog) {
        e.preventDefault();
        togglePlayback();
        return;
      }
      // R — Reset EQ
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        handleReset();
        return;
      }
      // S — Save profile
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setSaveNameInput(profileName || '');
        setShowSaveDialog(true);
        return;
      }
      // Escape — close any open modal
      if (e.key === 'Escape') {
        if (showWizard) { restoreBands(); return; }
        if (showProfilePanel) { setShowProfilePanel(false); return; }
        if (showSaveDialog) { setShowSaveDialog(false); return; }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWizard, showProfilePanel, showSaveDialog, profileName]);

  const handleTuningComplete = (result: { gains: number[]; profileName: string; insights: string[]; profile?: EQProfile }) => {
    const newBands = bands.map((band, i) => ({ ...band, gain: result.gains[i] }));
    setBands(newBands);
    setIsAICalibrated(true);
    setProfileName(result.profileName);
    setProfileColor(result.profile?.color ?? '#F27D26');
    setProfileGenre(result.profile?.genre ?? null);
    setAiInsights(result.insights);
    applyBandsToEngine(newBands, preAmp);

    const maxGain = Math.max(...result.gains);
    const newPreAmp = maxGain > 0 ? -maxGain : 0;
    handlePreAmpChange(newPreAmp);

    history.push(newBands, newPreAmp, `AI: ${result.profileName}`);
    debouncedPersist(newBands, newPreAmp);
    setShowWizard(false);
  };

  const handleReset = () => {
    history.push(bands, preAmp, 'Before reset');
    setBands(DEFAULT_BANDS);
    DEFAULT_BANDS.forEach((_, i) => engineRef.current?.updateBand(i, 0));
    setIsAICalibrated(false);
    setProfileName(null);
    setPreAmp(0);
    engineRef.current?.setPreAmp(0);
    debouncedPersist(DEFAULT_BANDS, 0);
  };

  const handleUndo = () => {
    if (!history.canUndo()) return;
    const snapshot = history.undo();
    if (!snapshot) return;
    setBands(snapshot.bands);
    setPreAmp(snapshot.preAmp);
    applyBandsToEngine(snapshot.bands, snapshot.preAmp);
    debouncedPersist(snapshot.bands, snapshot.preAmp);
  };

  const handleRedo = () => {
    if (!history.canRedo()) return;
    const snapshot = history.redo();
    if (!snapshot) return;
    setBands(snapshot.bands);
    setPreAmp(snapshot.preAmp);
    applyBandsToEngine(snapshot.bands, snapshot.preAmp);
    debouncedPersist(snapshot.bands, snapshot.preAmp);
  };

  const handleSaveProfile = () => {
    const name = saveNameInput.trim() || profileName || 'My Profile';
    const saved = saveProfile(name, bands, preAmp, {
      genre: profileGenre ?? undefined,
      color: profileColor,
      source: isAICalibrated ? 'ai' : 'manual',
    });
    setSavedProfiles(getAllProfiles());
    setSaveNameInput('');
    setShowSaveDialog(false);
    setProfileName(saved.name);
  };

  const handleLoadProfile = (profile: SavedProfile) => {
    history.push(bands, preAmp, 'Before load profile');
    setBands(profile.bands);
    setPreAmp(profile.preAmp);
    setProfileName(profile.name);
    setProfileColor(profile.color ?? '#F27D26');
    setProfileGenre(profile.genre ?? null);
    setIsAICalibrated(profile.source === 'ai' || profile.source === 'import');
    applyBandsToEngine(profile.bands, profile.preAmp);
    debouncedPersist(profile.bands, profile.preAmp);
    setShowProfilePanel(false);
  };

  const handleDeleteProfile = (id: string) => {
    deleteProfile(id);
    setSavedProfiles(getAllProfiles());
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const text = await file.text();

    // JSON profile (exported from SONIC)
    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text) as SavedProfile;
        if (!parsed.bands || !Array.isArray(parsed.bands)) throw new Error('Invalid profile JSON');
        history.push(bands, preAmp, 'Before import');
        setBands(parsed.bands);
        setPreAmp(parsed.preAmp ?? 0);
        setProfileName(parsed.name);
        setIsAICalibrated(true);
        applyBandsToEngine(parsed.bands, parsed.preAmp ?? 0);
        const saved = saveProfile(parsed.name, parsed.bands, parsed.preAmp ?? 0, { source: 'import', color: parsed.color, genre: parsed.genre });
        setSavedProfiles(getAllProfiles());
        setProfileName(saved.name);
        return;
      } catch {
        setImportError('Invalid JSON profile file.');
        return;
      }
    }

    // EqualizerAPO / AutoEq .txt format
    const result = parseEqualizerAPO(text);
    if (result.errors.length > 0 && result.bands.length === 0) {
      setImportError(result.errors.join(' '));
      return;
    }

    // Map parsed bands onto the 10-band grid (closest frequency match)
    const newBands = DEFAULT_BANDS.map((defaultBand) => {
      const closest = result.bands.reduce((best, b) =>
        Math.abs(b.frequency - defaultBand.frequency) < Math.abs(best.frequency - defaultBand.frequency) ? b : best
      );
      const dist = Math.abs(closest.frequency - defaultBand.frequency);
      if (dist > defaultBand.frequency * 0.5) return defaultBand; // too far, keep default
      return { ...defaultBand, gain: closest.gain, q: closest.q, type: closest.type };
    });

    history.push(bands, preAmp, 'Before APO import');
    setBands(newBands);
    setPreAmp(result.preAmp);
    setIsAICalibrated(true);
    applyBandsToEngine(newBands, result.preAmp);
    const importName = file.name.replace(/\.[^.]+$/, '');
    const saved = saveProfile(importName, newBands, result.preAmp, { source: 'import' });
    setSavedProfiles(getAllProfiles());
    setProfileName(saved.name);
    debouncedPersist(newBands, result.preAmp);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const restoreBands = () => {
    // Exit A/B preview mode and restore the live EQ chain to UI state
    engineRef.current?.exitABMode();
    bands.forEach((band, i) => {
        engineRef.current?.updateBand(i, band.gain);
    });
    setShowWizard(false);
  };

  const exportLogs = () => {
    const logData = {
      timestamp: new Date().toISOString(),
      bands: bands.map(b => ({ freq: b.frequency, gain: b.gain })),
      masterVolume: volume,
      profile: "Sonic AI Generated"
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eq-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      handleTrackChange(url, file.name || 'User Track');
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    // Simple heuristic for YouTube links to guide user
    if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
      setErrorHeader("YouTube direct links are restricted. Use a direct MP3/OGG URL or Import local file.");
      return;
    }

    handleTrackChange(urlInput, 'Stream: ' + urlInput.split('/').pop());
    setUrlInput('');
  };

  const handleAudioError = () => {
    setErrorHeader("Audio Source Error: Check your connection or file format.");
    setIsPlaying(false);
  };

  return (
    <main className="min-h-screen bg-[#E6E6E6] p-0 md:p-8 flex items-center justify-center font-sans relative">
      
      {/* Initial Activation Overlay */}
      {!isReady && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0b] p-6">
          <div className="text-center space-y-12 max-w-sm w-full">
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="w-24 h-24 bg-gradient-to-tr from-[#F27D26] to-[#FF4444] rounded-[2rem] mx-auto flex items-center justify-center shadow-[0_20px_50px_rgba(242,125,38,0.4)]"
             >
                <Activity className="w-12 h-12 text-white" />
             </motion.div>
             
             <div className="space-y-4">
               <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                 SONIC<span className="text-[#F27D26]">AI</span>
               </h1>
               <p className="text-[#8E9299] text-sm font-medium leading-relaxed">
                 High-fidelity PEQ Engine with Intelligent Calibration.<br/>
                 Tap to initialize the processing core.
               </p>
             </div>
             
             <button 
               onClick={initAudio}
               className="group relative w-full overflow-hidden rounded-2xl bg-white p-5 font-bold uppercase tracking-widest text-black transition-all hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
             >
               <span className="relative z-10 flex items-center justify-center gap-2">
                 Ignite Engine <ArrowRight className="w-4 h-4" />
               </span>
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
             </button>

             <div className="pt-8 flex justify-center gap-6 opacity-30">
               <Sliders className="w-5 h-5" />
               <Sparkles className="w-5 h-5" />
               <Activity className="w-5 h-5" />
             </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl bg-[#151619] text-white md:rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.3)] border border-white/5 overflow-hidden flex flex-col h-screen md:h-auto">
        
        {/* Header Rail */}
        <div className="border-bottom border-white/10 p-4 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F27D26] flex items-center justify-center">
              <Activity className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-sm font-medium tracking-tight uppercase tracking-widest text-[#8E9299]">
                Sonic AI <span className="text-white">v1.0</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {/* Undo/Redo */}
            <button
              onClick={handleUndo}
              disabled={!history.canUndo()}
              title="Undo (Ctrl+Z)"
              className="p-2 rounded-lg text-[#8E9299] hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!history.canRedo()}
              title="Redo"
              className="p-2 rounded-lg text-[#8E9299] hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            {/* Profile Library */}
            <button
              onClick={() => setShowProfilePanel(true)}
              className="p-2 rounded-lg text-[#8E9299] hover:text-white hover:bg-white/5 transition-all relative"
              title="Profile Library"
            >
              <FolderOpen className="w-4 h-4" />
              {savedProfiles.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#F27D26] rounded-full" />
              )}
            </button>

            {/* Save Profile */}
            <button
              onClick={() => { setSaveNameInput(profileName || ''); setShowSaveDialog(true); }}
              className="hidden md:flex p-2 rounded-lg text-[#8E9299] hover:text-white hover:bg-white/5 transition-all"
              title="Save current EQ as profile"
            >
              <Save className="w-4 h-4" />
            </button>

            {/* Import */}
            <button
              onClick={() => importFileRef.current?.click()}
              className="hidden md:flex p-2 rounded-lg text-[#8E9299] hover:text-white hover:bg-white/5 transition-all"
              title="Import EqualizerAPO / SONIC profile"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input ref={importFileRef} type="file" accept=".json,.txt" className="hidden" onChange={handleImportFile} />

            <div className="w-px h-6 bg-white/10 mx-1 hidden md:block" />

            <button 
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] rounded-full text-xs font-mono uppercase tracking-widest border border-[#F27D26]/20 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">AI Calibrate</span>
              <span className="sm:hidden">AI</span>
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 p-4 md:p-10 space-y-6 md:space-y-8 overflow-y-auto">
          
          {/* Top Section: Visualizer and Player */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            <div className="lg:col-span-8 space-y-4 md:space-y-6">
              <EQCurve bands={bands} />
              <Visualizer analyzer={analyzer} />
              
              <div className="bg-[#1a1c20] p-4 md:p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                    <Music className="w-6 h-6 text-[#8E9299]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <select 
                         value={audioSource} 
                         onChange={(e) => {
                            const track = TRACKS.find(t => t.url === e.target.value);
                            handleTrackChange(e.target.value, track?.name || 'User Track');
                         }}
                         className="bg-transparent text-sm font-medium text-white border-none focus:ring-0 cursor-pointer outline-none max-w-[200px] truncate"
                       >
                         {TRACKS.map(t => (
                           <option key={t.id} value={t.url} className="bg-[#1a1c20]">{t.name}</option>
                         ))}
                         {audioSource !== TRACKS[0].url && audioSource !== TRACKS[1].url && audioSource !== TRACKS[2].url && (
                           <option value={audioSource} className="bg-[#1a1c20]">Custom Track</option>
                         )}
                       </select>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-[#F27D26] font-mono uppercase tracking-widest hover:underline mt-1 block"
                    >
                      + Import your own Music
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="audio/*" 
                      className="hidden" 
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4 md:gap-6 justify-center w-full md:w-auto">
                  <div className="flex items-center gap-4">
                    <button className="text-[#8E9299] hover:text-white transition-colors p-2"><SkipBack className="w-5 h-5 md:w-6 md:h-6" /></button>
                    <button 
                      onClick={togglePlayback}
                      className="w-12 h-12 md:w-14 md:h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6 ml-1" />}
                    </button>
                    <button className="text-[#8E9299] hover:text-white transition-colors p-2"><SkipForward className="w-5 h-5 md:w-6 md:h-6" /></button>
                  </div>
                  
                  <div className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-4 md:pl-6">
                    <Volume2 className="w-4 h-4 text-[#8E9299]" />
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#F27D26]" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex-1 bg-[#1a1c20] p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">Stream Source</span>
                    <Activity className="w-4 h-4 text-[#F27D26]" />
                  </div>
                  
                  <form onSubmit={handleUrlSubmit} className="space-y-2">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste Audio/Direct Link..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono focus:border-[#F27D26] outline-none transition-all pr-10"
                      />
                      <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#F27D26] hover:scale-110 transition-transform">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">Neural Insights</span>
                      <Sparkles className="w-4 h-4 text-[#F27D26]" />
                    </div>
                    <div className="space-y-3">
                      {aiInsights.length > 0 ? (
                        aiInsights.map((insight, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.2 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-[#8E9299] italic leading-relaxed"
                          >
                            &quot;{insight}&quot;
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-[10px] text-[#8E9299]/50 italic">Calibrate neural core to unlock track-specific insights.</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={exportLogs}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export EQ Log
                </button>
              </div>
            </div>
          </div>

          {/* EQ Controls Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#F27D26]" />
                  <h3 className="text-xs font-mono text-[#8E9299] uppercase tracking-widest font-bold">10-Band Parametric Equalizer</h3>
                </div>
                {isAICalibrated && (
                   <motion.div 
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     className="flex items-center gap-2 px-2 py-0.5 rounded border"
                     style={{ background: profileColor + '15', borderColor: profileColor + '40' }}
                   >
                     <Sparkles className="w-2.5 h-2.5" style={{ color: profileColor }} />
                     <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: profileColor }}>
                       {profileName || 'Neural Tuning'}
                     </span>
                     {profileGenre && (
                       <span className="text-[8px] text-[#8E9299] hidden sm:inline">· {profileGenre.split(' · ')[0]}</span>
                     )}
                   </motion.div>
                )}
              </div>
              <div className="flex gap-2">
                 <button 
                   onClick={handleReset}
                   className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md text-[10px] font-mono uppercase tracking-widest text-[#8E9299] hover:text-white transition-all"
                 >
                   Reset
                 </button>
              </div>
            </div>
            <EQPanel 
              bands={bands} 
              onBandChange={handleBandChange} 
              preAmp={preAmp}
              onPreAmpChange={handlePreAmpChange}
            />
          </div>

        </div>
        
        {/* Footer Info */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex flex-col gap-2">
          {errorHeader && (
            <div className="text-[10px] font-mono text-red-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {errorHeader}
            </div>
          )}
          <div className="flex justify-between items-center text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">
            <div>Engine: WebAudio 2.0 · Biquad Exact Curve · AI Engine v3 Local</div>
            <div>Project: PEQ Calibration • Last Sync: {lastSync || 'Initializing...'}</div>
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio 
          ref={audioRef} 
          src={audioSource} 
          onEnded={() => setIsPlaying(false)}
          onError={handleAudioError}
          crossOrigin={audioSource.startsWith('blob:') ? undefined : "anonymous"}
        />
        
        {/* Modals */}
        <AnimatePresence>
          {showWizard && (
            <TuningWizard 
              onComplete={handleTuningComplete} 
              onClose={restoreBands}
              onPreviewAB={handlePreviewAB}
              onExitAB={handleExitAB}
            />
          )}
        </AnimatePresence>

        {/* Profile Library Panel */}
        <AnimatePresence>
          {showProfilePanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowProfilePanel(false)}
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#151619] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white uppercase tracking-tight">Profile Library</h2>
                      <p className="text-[10px] text-[#8E9299] font-mono uppercase tracking-widest mt-0.5">{savedProfiles.length} saved profiles</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setShowProfilePanel(false); importFileRef.current?.click(); }}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono uppercase tracking-widest text-[#8E9299] hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <Upload className="w-3 h-3" /> Import
                      </button>
                      <button onClick={() => setShowProfilePanel(false)} className="p-1.5 text-[#8E9299] hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {importError && (
                    <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-mono">{importError}</div>
                  )}

                  {savedProfiles.length === 0 ? (
                    <div className="py-12 text-center">
                      <FolderOpen className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-[#8E9299] text-sm">No saved profiles yet.</p>
                      <p className="text-[#8E9299]/50 text-xs mt-1">Run AI Calibrate or save manually.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {savedProfiles.map(p => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/8 rounded-xl border border-white/5 group"
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color ?? '#888' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{p.name}</div>
                            <div className="text-[10px] text-[#8E9299] font-mono">{p.genre ?? p.source} · {new Date(p.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { const sp = savedProfiles.find(x => x.id === p.id)!; exportProfileAsAPO(sp); }}
                              className="p-1.5 text-[#8E9299] hover:text-white rounded-lg hover:bg-white/10 transition-all"
                              title="Export APO"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(p.id)}
                              className="p-1.5 text-[#8E9299] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                              title="Delete"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => handleLoadProfile(p)}
                            className="px-3 py-1.5 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all"
                          >
                            Load
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Profile Dialog */}
        <AnimatePresence>
          {showSaveDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowSaveDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl"
              >
                <h3 className="text-base font-bold text-white uppercase tracking-tight mb-4">Save Profile</h3>
                <input
                  type="text"
                  value={saveNameInput}
                  onChange={e => setSaveNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setShowSaveDialog(false); }}
                  placeholder={profileName || 'Profile name...'}
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#F27D26] outline-none transition-all mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-mono uppercase tracking-widest text-[#8E9299] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="flex-1 py-2.5 bg-[#F27D26] hover:bg-[#F27D26]/90 rounded-xl text-xs font-mono uppercase tracking-widest text-black font-bold transition-all"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
