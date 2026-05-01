'use client';

<<<<<<< HEAD
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
=======

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, SkipForward, SkipBack,
  Sparkles, Volume2, Music,
  Download, List, Sliders, Activity,
  ArrowRight, Save, FolderOpen, Headphones,
  Undo2, Redo2, Upload, X, Target,
  LayoutDashboard, ChevronDown, RotateCcw, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { AudioEngine, DEFAULT_BANDS, EQBand, AB_PREVIEW_GAINS, EnhancementParams, DEFAULT_ENHANCEMENT } from '@/lib/audio-engine';
import { AdaptiveEQLearner, LearnerState, Interaction, LearnerAudioContext, AudioFeatures } from '@/lib/adaptive-eq';
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
import { Visualizer } from '@/components/Visualizer';
import { EQPanel } from '@/components/EQPanel';
import { EQCurve } from '@/components/EQCurve';
import { TuningWizard } from '@/components/TuningWizard';
<<<<<<< HEAD
import { EQProfile } from '@/lib/ai-engine';
=======
import { ExportDialog } from '@/components/ExportDialog';
import { DeviceInspector } from '@/components/DeviceInspector';
import { InfoTooltip } from '@/components/InfoTooltip';
import { AudioInitOverlay } from '@/components/AudioInitOverlay';
import { Header } from '@/components/Header';
import { AnalysisSidebar } from '@/components/AnalysisSidebar';
import { PlayerSection } from '@/components/PlayerSection';
import { EnhancementPanel } from '@/components/EnhancementPanel';
import { AdaptiveEQModule } from '@/components/AdaptiveEQModule';
import { AUDIO_ACCEPT_ATTR } from '@/lib/device-inspector';
import { EQProfile, TasteResult, ChoiceReason, ScenarioChoiceAnalysis } from '@/lib/ai-engine';
import { optimalQ } from '@/lib/math';
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
import {
  SavedProfile,
  saveProfile,
  getAllProfiles,
  deleteProfile,
  persistCurrentState,
<<<<<<< HEAD
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
=======
  exportProfileAsAPO,
  parseEqualizerAPO,
} from '@/lib/profile-store';
import { TARGET_CURVES } from '@/lib/eq-targets';
import { useEQHistory } from '@/hooks/use-eq-history';
import { RewImport } from '@/components/RewImport';
import { ZeroLatencyVisualizer } from '@/components/ZeroLatencyVisualizer';

import { EQSectionHeader } from '@/components/EQSectionHeader';
import { HearingProtectionIndicator } from '@/components/HearingProtectionIndicator';
import { MainAppFooter } from '@/components/MainAppFooter';
import { ProfileLibraryModal } from '@/components/ProfileLibraryModal';
import { TrackLibraryModal } from '@/components/TrackLibraryModal';
import { SaveProfileModal } from '@/components/SaveProfileModal';

import { useTrackLibrary } from '@/hooks/useTrackLibrary';
import { useAdaptiveEQ } from '@/hooks/useAdaptiveEQ';
import { useTuningAB } from '@/hooks/useTuningAB';

import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useCalibration } from '@/hooks/useCalibration';
import { useProfileManager } from '@/hooks/useProfileManager';
import { earDamageRisk } from '@/lib/math/loudness-adaptive';

interface Track {
  id: string;
  name: string;
  artist?: string;
  genre: string;
  url: string;
  duration?: string;
}

const TRACKS: Track[] = [
  // User tracks can be added here. Example format:
  // { id: 't1', name: 'Song Name', artist: 'Artist', genre: 'Genre', duration: '3:00', url: '/tracks/song1.mp3' },
];

export default function Home() {
  const {
    audioRef: hookAudioRef,
    engineRef: hookEngineRef,
    isPlaying,
    setIsPlaying,
    volume,
    preAmp,
    setPreAmp,
    audioSource,
    setAudioSource,
    currentTrackName,
    setCurrentTrackName,
    errorHeader,
    setErrorHeader,
    analyzer,
    analyzerL,
    analyzerR,
    audioContext,
    isReady,
    enhancement,
    setEnhancement,
    lufsMetrics,
    phaseMode,
    setPhaseMode,
    initAudio,
    togglePlayback,
    handleTrackChange,
    handleVolumeChange,
    handlePreAmpChange,
    handleEnhancementChange,
    handleAudioError,
    applyBandsToEngine: hookApplyBandsToEngine,
    handlePhaseModeChange,
    setExactSampleRate,
    enableWebUSB,
    disableWebUSB,
    pipelineInfo,
  } = useAudioPlayer();

  const {
    showWizard,
    setShowWizard,
    isAICalibrated,
    setIsAICalibrated,
    calibrationConfidence,
    taste,
    reasons,
    scenarioAnalysis,
    aiInsights,
    selectionMode,
    setSelectionMode,
    selectedTrackUrls,
    setSelectedTrackUrls,
    handleCalibrationComplete,
  } = useCalibration();

  const {
    savedProfiles,
    showProfilePanel,
    setShowProfilePanel,
    profileName,
    setProfileName,
    profileColor,
    setProfileColor,
    profileGenre,
    setProfileGenre,
    saveNameInput,
    setSaveNameInput,
    showSaveDialog,
    setShowSaveDialog,
    importError,
    setImportError,
    refreshProfiles,
    handleSaveProfile: saveProfileToStore,
    deleteProfile,
  } = useProfileManager();

  // ─── Track Library Hook ────────────────────────────────────────────────
  const {
    customTracks,
    setCustomTracks,
    allTracks,
    showTrackLibrary,
    setShowTrackLibrary,
    genreFilter,
    setGenreFilter,
    trackSearch,
    setTrackSearch,
    handleNextTrack,
    handlePrevTrack,
    allGenres
  } = useTrackLibrary(TRACKS, audioSource, handleTrackChange);

  // ─── Remaining Page State (UI & UI only) ───────────────────────────────
  const [bands, setBands] = useState<EQBand[]>(DEFAULT_BANDS);
  const [spectralPeaks, setSpectralPeaks] = useState<number[]>([]);
  const [lastSync, setLastSync] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [showRewImport, setShowRewImport] = useState(false);
  const [baseCorrection, setBaseCorrection] = useState<number[]>(new Array(10).fill(0));
  const [sessionDuration, setSessionDuration] = useState(0);

  // UI state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [targetCurveId, setTargetCurveId] = useState<string>('none');
  const [showEnhancement, setShowEnhancement] = useState(false);
  const [useZeroLatency, setUseZeroLatency] = useState(false);
  const [showAnalysisSidebar, setShowAnalysisSidebar] = useState(true);
  const [lastManualEditTime, setLastManualEditTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);

  const history = useEQHistory();

  const applyBandsToEngine = useCallback((newBands: EQBand[], newPreAmp: number) => {
    newBands.forEach((b, i) => hookEngineRef.current?.updateBandParams(i, b));
    hookEngineRef.current?.setPreAmp(newPreAmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)

  const debouncedPersist = useCallback((newBands: EQBand[], newPreAmp: number) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => persistCurrentState(newBands, newPreAmp), 500);
  }, []);

<<<<<<< HEAD
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
=======
  // ─── Adaptive EQ Hook ──────────────────────────────────────────────────
  const {
    learnerState,
    isAdaptiveMode,
    setIsAdaptiveMode,
    sectionType,
    setSectionType,
    handleInteraction,
    leanerRef,
    setLearnerState
  } = useAdaptiveEQ(hookEngineRef, isPlaying, preAmp, applyBandsToEngine);

  // Continuous prediction loop
  // useEffect(() => {
  //   if (!isAdaptiveMode || !isPlaying || !hookEngineRef.current || !leanerRef.current) return;
  // 
  //   const interval = setInterval(() => {
  //     // Pause adaptation if user edited recently (10s cooldown)
  //     if (Date.now() - lastManualEditTime < 10000) return;
  // 
  //     const energies = hookEngineRef.current!.getAdaptiveFeatures();
  //     const fingerprint = hookEngineRef.current!.getTrackFingerprint();
  //     if (!energies) return;
  // 
  //     const char = hookEngineRef.current!.classifyTrackCharacter(
  //       [energies.lowEnergy, energies.midEnergy, energies.highEnergy], 
  //       fingerprint
  //     );
  // 
  //     const contextObj = {
  //       genre: char.genre as any,
  //       tempoCategory: 'moderate' as any,
  //       complexity: char.dynamicWide ? 'orchestral' : 'dense' as any,
  //       vocalPresence: char.genre === 'vocal-mid' ? 'prominent' : 'none' as any,
  //     };
  // 
  //     const suggestion = leanerRef.current!.suggestGainsForContext(contextObj);
  //     const adjustment = suggestion.gains;
  //     const dynamicFreqs = hookEngineRef.current!.computeDynamicEQFrequencies(fingerprint);
  // 
  //     setBands((prev: EQBand[]) => {
  //       const hasSignificantGain = adjustment.some((a: number, i) => Math.abs(a - prev[i].gain) > 0.5);
  //       const hasSignificantFreq = dynamicFreqs.some((f: number, i) => Math.abs(f - prev[i].frequency) > prev[i].frequency * 0.05);
  // 
  //       if (!hasSignificantGain && !hasSignificantFreq) return prev;
  // 
  //       const next = prev.map((b, i) => ({
  //         ...b,
  //         gain: Math.max(-15, Math.min(15, adjustment[i])),
  //         frequency: dynamicFreqs[i] // Shift frequency to match track profile
  //       }));
  //       
  //       applyBandsToEngine(next, preAmp);
  //       
  //       // Push frequencies globally to the engine so underlying nodes shift
  //       if (hasSignificantFreq) {
  //         hookEngineRef.current!.updateFrequencies(dynamicFreqs);
  //       }
  // 
  //       return next;
  //     });
  //   }, 2000); 
  // 
  //   return () => clearInterval(interval);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [isAdaptiveMode, isPlaying, sectionType, preAmp, applyBandsToEngine, leanerRef]);

  const handleDynamicEqMasterChange = (val: boolean) => {
    handleEnhancementChange({ dynamicEqMaster: val });
  };

  // ─── Mount: last-sync timestamp ────────────────────────────────────────
  useEffect(() => {
    const t = new Date().toLocaleTimeString();
    const id = setTimeout(() => setLastSync(t), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const bandsRef = useRef(bands);
  const preAmpRef = useRef(preAmp);
  useEffect(() => { bandsRef.current = bands; preAmpRef.current = preAmp; }, [bands, preAmp]);

  useEffect(() => {
    if (hookEngineRef.current && isReady) {
      (window as any).__ENGINE__ = hookEngineRef.current;
      (window as any).__AUDIO_SRC__ = audioSource;
      hookApplyBandsToEngine(bandsRef.current, preAmpRef.current);
    }
  }, [isReady, audioSource, hookEngineRef, hookApplyBandsToEngine]);
  
  useEffect(() => {
    if (!audioSource || !hookEngineRef.current) return;
    
    const analyzePeaks = async () => {
      try {
        const peaks = await hookEngineRef.current!.getSpectralPeaks(audioSource);
        setSpectralPeaks(peaks);
      } catch (err) {
        console.warn('Failed to discover resonances:', err);
      }
    };
    
    analyzePeaks();
  }, [audioSource, hookEngineRef]);

  // ─── Band manipulation (with live-Q recompute) ─────────────────────────
  const handleBandChange = useCallback((index: number, params: Partial<EQBand>) => {
    const newBands = [...bands];
    newBands[index] = { ...newBands[index], ...params };

    if (params.gain !== undefined && params.q === undefined) {
      const me = newBands[index];
      const left = newBands[index - 1];
      const right = newBands[index + 1];
      const neighbourFreq = left && right
        ? (Math.abs(left.frequency - me.frequency) < Math.abs(right.frequency - me.frequency)
            ? left.frequency : right.frequency)
        : (left ?? right)?.frequency ?? me.frequency * 2;
      const newQ = optimalQ(me.frequency, neighbourFreq, me.gain, { minQ: 0.5, maxQ: 4 });
      newBands[index] = { ...me, q: newQ };
      hookEngineRef.current?.updateBandParams(index, { ...params, q: newQ });
    } else {
      hookEngineRef.current?.updateBandParams(index, params);
    }

    const maxGain = Math.max(...newBands.map((b) => b.gain));
    const newPreAmp = maxGain > 0 ? -maxGain * 0.5 : 0;
    setBands(newBands);
    setLastManualEditTime(Date.now());

    if (params.gain !== undefined) history.push(newBands, newPreAmp);

    setPreAmp(newPreAmp);
    hookEngineRef.current?.setPreAmp(newPreAmp);
    debouncedPersist(newBands, newPreAmp);
  }, [bands, history, hookEngineRef, setPreAmp, debouncedPersist]);

  // Handlers for volume/preAmp/phase are now in audio hook

  // ─── A/B preview (multi-track aware) ──────────────────────────────────
  const { handlePreviewAB, handleExitAB } = useTuningAB(
    audioSource,
    hookAudioRef,
    hookEngineRef,
    togglePlayback,
    setIsPlaying,
    setAudioSource,
    setCurrentTrackName,
    TRACKS
  );

  // Sync engine on profile/bands change
  useEffect(() => {
    if (hookEngineRef.current) hookApplyBandsToEngine(bands, preAmp);
    refreshProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, preAmp, hookApplyBandsToEngine, refreshProfiles]);

  // ─── EQ controls ───────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    history.push(bands, preAmp, 'Before reset');
    const resetBands = DEFAULT_BANDS.map((band) => ({ ...band }));
    setBands(resetBands);
    resetBands.forEach((band, i) => hookEngineRef.current?.updateBandParams(i, band));
    setIsAICalibrated(false);
    setProfileName(null);
    handlePreAmpChange(0);
    debouncedPersist(resetBands, 0);
  }, [bands, preAmp, history, debouncedPersist, setIsAICalibrated, setProfileName, hookEngineRef, handlePreAmpChange]);

  const handleUndo = useCallback(() => {
    if (!history.canUndo()) return;
    const s = history.undo();
    if (!s) return;
    setBands(s.bands); setPreAmp(s.preAmp);
    hookApplyBandsToEngine(s.bands, s.preAmp);
    debouncedPersist(s.bands, s.preAmp);
  }, [history, setPreAmp, hookApplyBandsToEngine, debouncedPersist]);

  const handleRedo = useCallback(() => {
    if (!history.canRedo()) return;
    const s = history.redo();
    if (!s) return;
    setBands(s.bands); setPreAmp(s.preAmp);
    hookApplyBandsToEngine(s.bands, s.preAmp);
    debouncedPersist(s.bands, s.preAmp);
  }, [history, setPreAmp, hookApplyBandsToEngine, debouncedPersist]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const restoreBands = useCallback(() => {
    hookEngineRef.current?.exitABMode?.();
    bands.forEach((band, i) => hookEngineRef.current?.updateBandParams(i, band));
    setShowWizard(false);
  }, [bands, hookEngineRef, setShowWizard]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); handleUndo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault(); handleRedo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); handleRedo(); return;
      }
      if (e.key === ' ' && !showWizard && !showProfilePanel && !showSaveDialog && !showExportDialog) {
        e.preventDefault(); togglePlayback(); return;
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) { handleReset(); return; }
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setSaveNameInput(profileName || '');
        setShowSaveDialog(true);
        return;
      }
<<<<<<< HEAD
      // Escape — close any open modal
=======
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setShowExportDialog(true);
        return;
      }
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
      if (e.key === 'Escape') {
        if (showWizard) { restoreBands(); return; }
        if (showProfilePanel) { setShowProfilePanel(false); return; }
        if (showSaveDialog) { setShowSaveDialog(false); return; }
<<<<<<< HEAD
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
=======
        if (showExportDialog) { setShowExportDialog(false); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
     
  }, [showWizard, showProfilePanel, showSaveDialog, showExportDialog, profileName, togglePlayback, restoreBands, handleReset, handleUndo, handleRedo, setSaveNameInput, setShowSaveDialog, setShowProfilePanel]);

  // ─── AI tuning complete ────────────────────────────────────────────────
  const handleTuningComplete = (result: any) => {
    handleCalibrationComplete(result);
    
    const qs = result.profile?.qSuggestions;
    const newBands = bands.map((band, i) => ({
      ...band,
      gain: result.gains[i],
      q: qs?.[i] ?? band.q,
    }));
    setBands(newBands);
    setProfileName(result.profileName);
    setProfileColor(result.profile?.color ?? '#F27D26');
    setProfileGenre(result.profile?.genre ?? null);
    hookApplyBandsToEngine(newBands, preAmp);
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)

    const maxGain = Math.max(...result.gains);
    const newPreAmp = maxGain > 0 ? -maxGain : 0;
    handlePreAmpChange(newPreAmp);

    history.push(newBands, newPreAmp, `AI: ${result.profileName}`);
    debouncedPersist(newBands, newPreAmp);
<<<<<<< HEAD
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
=======

    // Tầng 3: Session summary is not compatible with contextual learner state.
  };

  const handleSaveProfileLocal = () => {
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
    const name = saveNameInput.trim() || profileName || 'My Profile';
    const saved = saveProfile(name, bands, preAmp, {
      genre: profileGenre ?? undefined,
      color: profileColor,
      source: isAICalibrated ? 'ai' : 'manual',
<<<<<<< HEAD
    });
    setSavedProfiles(getAllProfiles());
=======
      // We can map the new Map contexts to old simple object, or just leave it empty.
      // Profile schema accepts contextPreferences, but we don't strictly need it.
      contextPreferences: {},
    });

    refreshProfiles();
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
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
<<<<<<< HEAD
    applyBandsToEngine(profile.bands, profile.preAmp);
    debouncedPersist(profile.bands, profile.preAmp);
=======
    hookApplyBandsToEngine(profile.bands, profile.preAmp);
    debouncedPersist(profile.bands, profile.preAmp);
    
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
    setShowProfilePanel(false);
  };

  const handleDeleteProfile = (id: string) => {
    deleteProfile(id);
<<<<<<< HEAD
    setSavedProfiles(getAllProfiles());
  };

=======
  };

  // ─── Import (.json / .txt) ─────────────────────────────────────────────
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
<<<<<<< HEAD

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
=======
    const text = await file.text();

    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        // Support both legacy SavedProfile and new SonicAIExport shape
        const isNew = parsed?.format === 'sonic-ai-eq';
        const bandsRaw = isNew ? parsed.bands : parsed.bands;
        const preAmpRaw = isNew ? parsed.preAmp : (parsed.preAmp ?? 0);
        const nameRaw = isNew ? parsed.profile?.name : parsed.name;
        if (!Array.isArray(bandsRaw)) throw new Error('Invalid profile JSON');

        const importedBands: EQBand[] = bandsRaw.map((b: any) => ({
          frequency: b.frequency,
          gain: b.gain,
          q: b.q,
          type: b.type,
        }));

        history.push(bands, preAmp, 'Before import');
        setBands(importedBands);
        setPreAmp(preAmpRaw);
        setProfileName(nameRaw ?? 'Imported');
        setIsAICalibrated(true);
        hookApplyBandsToEngine(importedBands, preAmpRaw);
        const saved = saveProfile(nameRaw ?? 'Imported', importedBands, preAmpRaw, {
          source: 'import',
          color: isNew ? parsed.profile?.color : parsed.color,
          genre: isNew ? parsed.profile?.genre : parsed.genre,
        });
        refreshProfiles();
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
        setProfileName(saved.name);
        return;
      } catch {
        setImportError('Invalid JSON profile file.');
        return;
      }
    }

<<<<<<< HEAD
    // EqualizerAPO / AutoEq .txt format
=======
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
    const result = parseEqualizerAPO(text);
    if (result.errors.length > 0 && result.bands.length === 0) {
      setImportError(result.errors.join(' '));
      return;
    }

<<<<<<< HEAD
    // Map parsed bands onto the 10-band grid (closest frequency match)
=======
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
    const newBands = DEFAULT_BANDS.map((defaultBand) => {
      const closest = result.bands.reduce((best, b) =>
        Math.abs(b.frequency - defaultBand.frequency) < Math.abs(best.frequency - defaultBand.frequency) ? b : best
      );
      const dist = Math.abs(closest.frequency - defaultBand.frequency);
<<<<<<< HEAD
      if (dist > defaultBand.frequency * 0.5) return defaultBand; // too far, keep default
=======
      if (dist > defaultBand.frequency * 0.5) return defaultBand;
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
      return { ...defaultBand, gain: closest.gain, q: closest.q, type: closest.type };
    });

    history.push(bands, preAmp, 'Before APO import');
    setBands(newBands);
    setPreAmp(result.preAmp);
    setIsAICalibrated(true);
<<<<<<< HEAD
    applyBandsToEngine(newBands, result.preAmp);
    const importName = file.name.replace(/\.[^.]+$/, '');
    const saved = saveProfile(importName, newBands, result.preAmp, { source: 'import' });
    setSavedProfiles(getAllProfiles());
=======
    hookApplyBandsToEngine(newBands, result.preAmp);
    const importName = file.name.replace(/\.[^.]+$/, '');
    const saved = saveProfile(importName, newBands, result.preAmp, { source: 'import' });
    refreshProfiles();
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
    setProfileName(saved.name);
    debouncedPersist(newBands, result.preAmp);
    if (importFileRef.current) importFileRef.current.value = '';
  };

<<<<<<< HEAD
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
=======
  const handleFolderImport = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const handleFolderInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setErrorHeader(null);
    const tracks: Track[] = files
      .filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'].includes(ext || '');
      })
      .map(file => {
        const url = URL.createObjectURL(file);
        // Try to get folder name from webkitRelativePath
        const folderName = file.webkitRelativePath.split('/')[0] || 'Imported Folder';
        return {
          id: `local-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          artist: folderName,
          genre: folderName,
          url,
          duration: '--:--',
        };
      });

    if (tracks.length === 0) {
      setErrorHeader('No supported audio files found in the selected folder.');
      return;
    }

    setCustomTracks(prev => [...prev, ...tracks]);
    
    if (tracks.length > 0 && !audioSource && !isPlaying) {
      handleTrackChange(tracks[0].url, tracks[0].name);
    }
  }, [audioSource, isPlaying, handleTrackChange, setErrorHeader, setCustomTracks]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newTracks: Track[] = files.map(file => {
      const url = URL.createObjectURL(file);
      return {
        id: `local-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Local File',
        genre: 'Local',
        url,
        duration: '--:--',
      };
    });

    setCustomTracks(prev => [...prev, ...newTracks]);

    // Load the first one of the pack
    if (newTracks.length > 0) {
      handleTrackChange(newTracks[0].url, newTracks[0].name);
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< HEAD
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
=======
    if (!urlInput.trim()) return;
    if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be') || urlInput.includes('spotify.com')) {
      setErrorHeader('YouTube/Spotify links are not directly supported. Paste a direct MP3/OGG/WAV/FLAC URL.');
      return;
    }
    handleTrackChange(urlInput.trim(), 'Stream: ' + (urlInput.split('/').pop()?.split('?')[0] || 'Custom'));
    setUrlInput('');
  };

  let interactionCount = 0;
  let stability = 0;
  if (learnerState && learnerState.totalInteractions !== undefined) {
    interactionCount = learnerState.totalInteractions;
    
    let sumConf = 0;
    let numContexts = 0;
    const contextsIter = learnerState.contexts instanceof Map ? Array.from(learnerState.contexts.values()) : Object.values(learnerState.contexts || {});
    for (const ctx of contextsIter) {
      if (!ctx || !Array.isArray((ctx as any).alphas) || !Array.isArray((ctx as any).betas)) continue;
      const alphas = (ctx as any).alphas as number[];
      const betas = (ctx as any).betas as number[];
      let bandConf = 0;
      const numBands = Math.min(10, alphas.length, betas.length);
      for (let i = 0; i < numBands; i++) {
        bandConf += Math.min(1, (alphas[i] + betas[i]) / 20);
      }
      sumConf += bandConf / 10;
      numContexts++;
    }
    stability = numContexts > 0 ? sumConf / numContexts : 0;
  }

  const risk = useMemo(() => {
    return earDamageRisk(
      bands.map(b => b.gain),
      bands.map(b => b.frequency),
      'moderate',
      sessionDuration
    );
  }, [bands, sessionDuration]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#07080a] text-white relative overflow-x-hidden">
      {/* Ambient aurora */}
      <div className="sonic-aurora" aria-hidden />

      {/* Activation overlay */}
      <AudioInitOverlay isReady={isReady} onInit={initAudio} />

      {/* App shell */}
      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-3 md:px-6 lg:px-8 py-4 md:py-6">
        {/* Header (sticky-ish glass) */}
        <Header
          profileName={profileName}
          calibrationConfidence={calibrationConfidence}
          interactionCount={interactionCount}
          stability={stability}
          isAICalibrated={isAICalibrated}
          profileColor={profileColor}
          canUndo={history.canUndo()}
          canRedo={history.canRedo()}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onShowProfilePanel={() => setShowProfilePanel(true)}
          onShowSaveDialog={() => { setSaveNameInput(profileName || ''); setShowSaveDialog(true); }}
          onShowExportDialog={() => setShowExportDialog(true)}
          onImportClick={() => importFileRef.current?.click()}
          onAICalibrate={() => {
            setSelectionMode(true);
            setSelectedTrackUrls([audioSource]);
            setShowTrackLibrary(true);
          }}
          onQuickCalibrate={() => setShowWizard(true)}
          showAnalysisSidebar={showAnalysisSidebar}
          setShowAnalysisSidebar={setShowAnalysisSidebar}
          savedProfilesCount={savedProfiles.length}
        />
        <input
          ref={importFileRef}
          type="file"
          accept=".json,.txt"
          className="hidden"
          onChange={handleImportFile}
        />

        {/* Top: Curve + Visualizer (stacked) | Player + Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 items-start">
          {/* LEFT: Curve, Visualizer, Player */}
          <div className={`${showAnalysisSidebar ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4 md:space-y-5 transition-all duration-300`}>
            {/* EQ Curve with target overlay control */}
            <div className="relative">
              <EQCurve 
                bands={bands} 
                baseCorrection={baseCorrection}
                target={targetCurveId} 
                spectralPeaks={spectralPeaks}
              />
              {/* Target curve picker */}
              <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
                <Target className="w-3 h-3 text-white/40" />
                <select
                  value={targetCurveId}
                  onChange={(e) => setTargetCurveId(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-md text-[9px] font-mono uppercase tracking-widest text-white/70 px-1.5 py-0.5 outline-none cursor-pointer hover:border-white/20"
                  title="Reference target curve"
                >
                  <option value="none">No Target</option>
                  {TARGET_CURVES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visualizer */}
            <div className="relative">
              {useZeroLatency ? (
                 <ZeroLatencyVisualizer pipelineInfo={pipelineInfo} />
              ) : (
                 <Visualizer 
                   analyzer={analyzer} 
                   analyzerL={analyzerL} 
                   analyzerR={analyzerR} 
                   metrics={lufsMetrics} 
                 />
              )}
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                 {useZeroLatency && (
                    <button 
                       onClick={() => {
                          const rates = [44100, 48000, 96000, 192000];
                          const idx = rates.indexOf(pipelineInfo?.targetSampleRate || 44100);
                          const nextIdx = (idx + 1) % rates.length;
                          setExactSampleRate(rates[nextIdx]);
                       }}
                      className="px-2 py-1 text-[9px] uppercase font-mono rounded bg-white/10 hover:bg-white/20 text-white"
                    >
                      Rate: {pipelineInfo?.targetSampleRate ? (pipelineInfo.targetSampleRate/1000).toFixed(1) : 44.1}k
                    </button>
                 )}
                 <button 
                    onClick={() => setUseZeroLatency(false)}
                   className={`px-2 py-1 text-[9px] uppercase font-mono rounded ${!useZeroLatency ? 'bg-[#F27D26] text-black font-bold' : 'bg-black/50 text-white/50 border border-white/10'}`}
                 >
                   Standard
                 </button>
                 <button 
                    onClick={() => setUseZeroLatency(true)}
                   className={`px-2 py-1 text-[9px] uppercase font-mono rounded ${useZeroLatency ? 'bg-[#F27D26] text-black font-bold' : 'bg-black/50 text-white/50 border border-white/10'}`}
                 >
                   Offscreen
                 </button>
              </div>
            </div>

            {/* UI-01 / UI-02: Empty state — guide first-time users */}
            {!audioSource && (
              <div className="flex flex-col items-center justify-center gap-4 py-8 px-6 rounded-2xl border border-dashed border-white/10 bg-black/20 backdrop-blur-sm text-center">
                <div className="w-14 h-14 rounded-full bg-[#F27D26]/10 border border-[#F27D26]/20 flex items-center justify-center">
                  <Music className="w-6 h-6 text-[#F27D26]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-base mb-1">Load a track to begin</p>
                  <p className="text-[#8E9299] text-xs max-w-xs">
                    Upload your own audio file, paste a URL, or open the track library to get started with AI-powered EQ calibration.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#F27D26] hover:bg-[#F27D26]/90 text-black font-semibold text-xs rounded-xl transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Audio
                  </button>
                  <button
                    onClick={() => setShowTrackLibrary(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs rounded-xl transition-all"
                  >
                    <List className="w-3.5 h-3.5" />
                    Browse Library
                  </button>
                </div>
              </div>
            )}

            {/* Player */}
            <PlayerSection
              currentTrackName={currentTrackName}
              isPlaying={isPlaying}
              onBrowseLibrary={() => setShowTrackLibrary(true)}
              onRewImport={() => setShowRewImport(true)}
              onFileUploadClick={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              handleFileUpload={handleFileUpload}
              onPrevTrack={handlePrevTrack}
              onTogglePlayback={togglePlayback}
              onNextTrack={handleNextTrack}
              volume={volume}
              onVolumeChange={(val) => handleVolumeChange(val)}
            />
          </div>

          <AnalysisSidebar
            showAnalysisSidebar={showAnalysisSidebar}
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            onUrlSubmit={handleUrlSubmit}
            onShowTrackLibrary={() => setShowTrackLibrary(true)}
            tracksCount={TRACKS.length}
            taste={taste}
            scenarioAnalysis={scenarioAnalysis}
            reasons={reasons}
            aiInsights={aiInsights}
            onShowExportDialog={() => setShowExportDialog(true)}
          />
        </div>
        {/* EQ controls section */}
        <section className="mt-6 md:mt-8 space-y-6">
          <EQSectionHeader
            profileGenre={profileGenre}
            profileName={profileName}
            handleReset={handleReset}
            setSaveNameInput={setSaveNameInput}
            setShowSaveDialog={setShowSaveDialog}
          />

          {/* MAIN EQ PANEL - Top Priority */}
          <div className="relative z-20">
            <EQPanel
              bands={bands}
              onBandChange={handleBandChange}
              preAmp={preAmp}
              onPreAmpChange={handlePreAmpChange}
              phaseMode={phaseMode}
              onPhaseModeChange={handlePhaseModeChange}
              dynamicEqMaster={enhancement.dynamicEqMaster}
              onDynamicEqMasterChange={handleDynamicEqMasterChange}
              spectralPeaks={spectralPeaks}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* ─── Sound Enhancement Panel ─── */}
            <EnhancementPanel
              showEnhancement={showEnhancement}
              setShowEnhancement={setShowEnhancement}
              enhancement={enhancement}
              setEnhancement={setEnhancement}
              onEnhancementChange={handleEnhancementChange}
            />

            {/* ─── Adaptive EQ Module ─── */}
            <AdaptiveEQModule
              isAdaptiveMode={isAdaptiveMode}
              setIsAdaptiveMode={setIsAdaptiveMode}
              stability={stability}
              sectionType={sectionType}
              setSectionType={setSectionType}
              profileName={profileName}
            />

            {/* Hearing Protection Indicator */}
            <HearingProtectionIndicator risk={risk} />
          </div>
        </section>

        {/* Footer */}
        <MainAppFooter errorHeader={errorHeader} lastSync={lastSync} />
      </div>

      {/* Hidden audio */}
      <audio
        key={(audioContext as any)?.id || 'initial'}
        ref={hookAudioRef}
        src={audioSource || undefined}
        onEnded={() => setIsPlaying(false)}
        onError={handleAudioError}
        preload="auto"
        crossOrigin={audioSource.startsWith('blob:') ? undefined : 'anonymous'}
      />

      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        {...({ webkitdirectory: "", directory: "" } as any)}
        className="hidden"
      />

      {/* Modals */}
      <AnimatePresence>
        {showRewImport && (
          <RewImport 
            onClose={() => setShowRewImport(false)}
            onApply={(gains) => {
              const newBands = bands.map((b, i) => ({ ...b, gain: gains[i] }));
              setBands(newBands);
              applyBandsToEngine(newBands, preAmp);
              history.push(newBands, preAmp, 'REW Measurement Apply');
              debouncedPersist(newBands, preAmp);
            }}
          />
        )}
        {showWizard && (
          <TuningWizard
            learnerState={learnerState}
            onComplete={handleTuningComplete}
            onClose={restoreBands}
            onPreviewAB={handlePreviewAB}
            onExitAB={handleExitAB}
            onChoice={handleInteraction}
            tracks={
              selectedTrackUrls.length > 0
                ? selectedTrackUrls.map((u) => {
                    const t = allTracks.find((x) => x.url === u);
                    return { url: u, name: t?.name ?? 'Selected Track' };
                  })
                : [{ url: audioSource, name: currentTrackName }]
            }
            targetSamples={Math.min(40, 15 + 10 * Math.max(1, selectedTrackUrls.length))}
          />
        )}
      </AnimatePresence>

      {/* Export dialog */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        bands={bands}
        preAmp={preAmp}
        defaultName={profileName || 'Sonic AI Live EQ'}
        defaultGenre={profileGenre ?? undefined}
        defaultColor={profileColor}
      />

      <ProfileLibraryModal
        show={showProfilePanel}
        onClose={() => setShowProfilePanel(false)}
        savedProfiles={savedProfiles}
        handleDeleteProfile={handleDeleteProfile}
        handleLoadProfile={handleLoadProfile}
        exportProfileAsAPO={exportProfileAsAPO}
        importFileRef={importFileRef}
        importError={importError}
      />

      <TrackLibraryModal
        show={showTrackLibrary}
        onClose={() => setShowTrackLibrary(false)}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        selectedTrackUrls={selectedTrackUrls}
        setSelectedTrackUrls={setSelectedTrackUrls}
        allTracks={allTracks}
        trackSearch={trackSearch}
        setTrackSearch={setTrackSearch}
        genreFilter={genreFilter}
        setGenreFilter={setGenreFilter}
        allGenres={allGenres}
        handleFolderImport={handleFolderImport}
        fileInputRef={fileInputRef}
        audioSource={audioSource}
        currentTrackName={currentTrackName}
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        handleUrlSubmit={handleUrlSubmit}
        isPlaying={isPlaying}
        onConfirmCalibration={() => {
          setShowTrackLibrary(false);
          setShowWizard(true);
        }}
        onTrackSelect={(track) => {
          if (selectionMode) {
            setSelectedTrackUrls((prev) => {
              if (prev.includes(track.url)) return prev.filter((u) => u !== track.url);
              if (prev.length >= 3) return [...prev.slice(1), track.url];
              return [...prev, track.url];
            });
          } else {
            handleTrackChange(track.url, track.name);
            setShowTrackLibrary(false);
          }
        }}
      />

      <SaveProfileModal
        show={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        saveNameInput={saveNameInput}
        setSaveNameInput={setSaveNameInput}
        handleSaveProfileLocal={handleSaveProfileLocal}
        profileName={profileName}
      />
    </main>
  );
}
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
