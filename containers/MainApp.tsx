'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useCalibration } from '@/hooks/useCalibration';
import { useProfileManager } from '@/hooks/useProfileManager';
import { useTrackLibrary } from '@/hooks/useTrackLibrary';
import { useAdaptiveEQ } from '@/hooks/useAdaptiveEQ';
import { useTuningAB } from '@/hooks/useTuningAB';
import { useAIStatus } from '@/hooks/useAIStatus';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEQManager } from '@/hooks/useEQManager';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useHearingTest } from '@/hooks/useHearingTest';
import { useOnboarding } from '@/hooks/useOnboarding';
import { AudioEngine } from '@/lib/audio-engine';

import { MainAppView } from '@/components/MainAppView';
import { recordSessionSummary } from '@/lib/profile-store';
import { MusicContext, MusicGenre, TempoCategory, MixComplexity, VocalPresence, ContextualPreferenceState } from '@/lib/ai-engine-v2';
import { logger } from '@/lib/logger';
import { getAudioMetadata } from '@/lib/audio-info';
import { toast } from 'sonner';

const TRACKS = [
  { id: 't1', name: 'Ambient Texture (Cloud)', artist: 'Demo', genre: 'Ambient', duration: '3:00', url: 'https://cdn.freesound.org/previews/612/612459_5674468-lq.mp3' },
  { id: 't2', name: 'Electronic Beat (Cloud)', artist: 'Demo', genre: 'Electronic', duration: '2:45', url: 'https://cdn.freesound.org/previews/528/528129_4398532-lq.mp3' },
];

export function MainApp() {
  usePerformanceMonitor();
  const audio = useAudioPlayer();
  const calibration = useCalibration();
  const profile = useProfileManager();

  const library = useTrackLibrary(TRACKS, audio.audioSource || '', audio.handleTrackChange);
  
  const eq = useEQManager(
    audio.engineRef,
    audio.preAmp,
    audio.setPreAmp,
    calibration.setIsAICalibrated,
    profile.setProfileName,
    audio.applyBandsToEngine
  );

  const adaptive = useAdaptiveEQ(
    audio.engineRef,
    audio.isPlaying,
    audio.preAmp,
    audio.applyBandsToEngine
  );

  const aiStatus = useAIStatus(adaptive.learnerState);
  const isMobile = useIsMobile();
  const hearing = useHearingTest();
  const onboarding = useOnboarding();

  const handleHearingTestComplete = (result: { contour: Array<{ phonShift: number }> }) => {
    const compensationGains = result.contour.map((c) => c.phonShift);
    
    // Set baseCorrection which now applies to the HIDDEN hearingFilters stage in AudioEngine
    // This maintains visual transparency (15dB on UI = 15dB in your EQ band)
    eq.setBaseCorrection(compensationGains);
    
    // We no longer call eq.setBands here to avoid overwriting the user's manual tuning
    
    hearing.setShowHearingTest(false);
    logger.info('Hearing assessment complete. Applied compensation to dedicated corrective DSP stage.');
  };

  const tuningAB = useTuningAB(
    audio.audioSource || '',
    audio.audioRef,
    audio.engineRef,
    audio.togglePlayback,
    audio.setIsPlaying,
    audio.setAudioSource,
    audio.setCurrentTrackName,
    TRACKS
  );

  // Remaining UI state
  const [spectralPeaks, setSpectralPeaks] = useState<number[]>([]);
  const [lastSync, setLastSync] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [showRewImport, setShowRewImport] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [targetCurveId, setTargetCurveId] = useState<string>('none');
  const [showEnhancement, setShowEnhancement] = useState(false);
  const [useZeroLatency, setUseZeroLatency] = useState(false);
  const [showAnalysisSidebar, setShowAnalysisSidebar] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dynamicGains, setDynamicGains] = useState<number[]>(new Array(10).fill(0));

  // Initialize with first track if empty
  useEffect(() => {
    if (!audio.audioSource && TRACKS.length > 0) {
      audio.handleTrackChange(TRACKS[0].url, TRACKS[0].name);
    }
  }, [audio.audioSource, audio.handleTrackChange]);

  // Derived engine instance instead of storing in state
  const engineInstance = audio.isReady && audio.engineRef.current ? audio.engineRef.current : null;

  useEffect(() => {
    if (!engineInstance || !audio.enhancement.dynamicEqMaster) {
      Promise.resolve().then(() => setDynamicGains(new Array(10).fill(0)));
      return;
    }
    
    // Poll the engine for the dynamic offsets
    const interval = setInterval(() => {
        const gains = (engineInstance as any).getDynamicGains();
        setDynamicGains(gains);
    }, 200);
    return () => clearInterval(interval);

  }, [engineInstance, audio.enhancement.dynamicEqMaster]);

  const refs = {
    fileInput: useRef<HTMLInputElement>(null),
    folderInput: useRef<HTMLInputElement>(null),
    importFile: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (isMobile) {
      Promise.resolve().then(() => setShowAnalysisSidebar(false));
    }
  }, [isMobile]);

  const handleDynamicEqMasterChange = (val: boolean) => {
    audio.handleEnhancementChange({ dynamicEqMaster: val });
  };

  useEffect(() => {
    const t = new Date().toLocaleTimeString();
    const id = setTimeout(() => setLastSync(t), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (audio.isPlaying) {
      timer = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [audio.isPlaying]);

  const bandsRef = useRef(eq.bands);
  const preAmpRef = useRef(audio.preAmp);
  useEffect(() => { bandsRef.current = eq.bands; preAmpRef.current = audio.preAmp; }, [eq.bands, audio.preAmp]);

  useEffect(() => {
    if (audio.engineRef.current && audio.isReady) {
      // Hearing compensation is now applied directly to eq.bands in handleHearingTestComplete
      audio.applyBandsToEngine(eq.bands, audio.preAmp);
    }
  }, [audio.isReady, audio.applyBandsToEngine, eq.bands, audio.preAmp]);
  
  useEffect(() => {
    if (!audio.audioSource || !audio.engineRef.current) return;
    const source = audio.audioSource;
    
    const analyzePeaks = async () => {
      setIsAnalyzing(true);
      try {
        const peaks = await audio.engineRef.current!.getSpectralPeaks(source);
        setSpectralPeaks(peaks);
      } catch (err) {
        logger.warn('Failed to discover resonances:', err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    
    analyzePeaks();
  }, [audio.audioSource, audio.engineRef]);

  useEffect(() => {
    profile.refreshProfiles();
  }, [profile.refreshProfiles]);

  const restoreBands = useCallback(() => {
    audio.engineRef.current?.exitABMode();
    audio.applyBandsToEngine(eq.bands, audio.preAmp);
    calibration.setShowWizard(false);
  }, [eq.bands, audio.preAmp, audio.engineRef, audio.applyBandsToEngine, calibration]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); eq.handleUndo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault(); eq.handleRedo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); eq.handleRedo(); return;
      }
      if (e.key === ' ' && !calibration.showWizard && !profile.showProfilePanel && !profile.showSaveDialog && !showExportDialog) {
        e.preventDefault(); audio.togglePlayback(); return;
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) { eq.handleReset(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        profile.setSaveNameInput(profile.profileName || '');
        profile.setShowSaveDialog(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setShowExportDialog(true);
        return;
      }
      if (e.key === 'Escape') {
        if (calibration.showWizard) { restoreBands(); return; }
        if (profile.showProfilePanel) { profile.setShowProfilePanel(false); return; }
        if (profile.showSaveDialog) { profile.setShowSaveDialog(false); return; }
        if (showExportDialog) { setShowExportDialog(false); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [calibration.showWizard, profile.showProfilePanel, profile.showSaveDialog, showExportDialog, profile.profileName, audio.togglePlayback, restoreBands, eq.handleReset, eq.handleUndo, eq.handleRedo, profile.setSaveNameInput, profile.setShowSaveDialog, profile.setShowProfilePanel]);

  const handleTuningComplete = (result: {
    profile?: { color: string; genre: string | null; qSuggestions?: number[] };
    profileName: string;
    gains: number[];
  }) => {
    calibration.handleCalibrationComplete(result as any);
    
    const qs = result.profile?.qSuggestions;
    const newBands = eq.bands.map((band, i) => ({
      ...band,
      gain: result.gains[i],
      q: qs?.[i] ?? band.q,
    }));
    eq.setBands(newBands);
    profile.setProfileName(result.profileName);
    profile.setProfileColor(result.profile?.color ?? '#F27D26');
    profile.setProfileGenre(result.profile?.genre ?? null);
    audio.applyBandsToEngine(newBands, audio.preAmp);

    const maxGain = Math.max(...result.gains);
    const newPreAmp = maxGain > 0 ? -maxGain : 0;
    audio.handlePreAmpChange(newPreAmp);

    eq.history.push(newBands, newPreAmp, `AI: ${result.profileName}`);
    eq.debouncedPersist(newBands, newPreAmp);

    if (adaptive.leanerRef.current) {
      recordSessionSummary(adaptive.leanerRef.current.getState());
    }
    
    // Complete onboarding calibration step if active
    onboarding.completeCalibration();
    
    toast.success('AI Calibration Complete', { description: `Tuned for ${result.profileName || 'your audio'}.` });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };

  const handleSaveProfileLocal = () => {
    const name = profile.saveNameInput.trim() || profile.profileName || 'My Profile';
    const saved = profile.handleSaveProfile(name, eq.bands, audio.preAmp, {
      genre: profile.profileGenre ?? undefined,
      color: profile.profileColor,
      source: calibration.isAICalibrated ? 'ai' : 'manual',
    });

    if (calibration.isAICalibrated && adaptive.leanerRef.current) {
      recordSessionSummary(adaptive.leanerRef.current.getState());
    }

    profile.refreshProfiles();
    profile.setSaveNameInput('');
    profile.setShowSaveDialog(false);
    profile.setProfileName(saved.name);
    
    // Notifications & Haptics
    toast.success('Profile Saved', { description: `${saved.name} saved successfully.` });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  };

  const handleLoadProfile = (loadedProfile: {
    bands: import('@/lib/audio-engine').EQBand[];
    preAmp: number;
    name: string;
    color?: string;
    genre?: string | null;
    source?: string;
  }) => {
    eq.history.push(eq.bands, audio.preAmp, 'Before load profile');
    eq.setBands(loadedProfile.bands);
    audio.setPreAmp(loadedProfile.preAmp);
    profile.setProfileName(loadedProfile.name);
    profile.setProfileColor(loadedProfile.color ?? '#F27D26');
    profile.setProfileGenre(loadedProfile.genre ?? null);
    calibration.setIsAICalibrated(loadedProfile.source === 'ai' || loadedProfile.source === 'import');
    audio.applyBandsToEngine(loadedProfile.bands, loadedProfile.preAmp);
    eq.debouncedPersist(loadedProfile.bands, loadedProfile.preAmp);
    
    // Notifications & Haptics
    toast.success('Profile Loaded', { description: `Loaded ${loadedProfile.name}` });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    profile.setShowProfilePanel(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    profile.setImportError(null);
    try {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (parsed.bands && Array.isArray(parsed.bands)) {
          eq.setBands(parsed.bands);
          if (parsed.preAmp !== undefined) audio.setPreAmp(parsed.preAmp);
          profile.setProfileName(file.name.replace('.json', ''));
          profile.setProfileColor(parsed.color || '#F27D26');
          if (parsed.genre) profile.setProfileGenre(parsed.genre);
          if (parsed.source === 'ai') calibration.setIsAICalibrated(true);
          toast.success('Profile Imported', { description: `Loaded from ${file.name}` });
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 30, 50]);
        } else {
          profile.setImportError('Invalid JSON structure. Needs "bands" array.');
          toast.error('Import Error', { description: 'Invalid JSON structure.' });
        }
      } else if (file.name.endsWith('.txt')) {
         profile.setImportError('Please use the REW Import tool for .txt files');
         toast.warning('Invalid Format', { description: 'Use REW Import tool for .txt files' });
      }
    } catch (err) {
      profile.setImportError('Failed to parse file');
      toast.error('Import Failed', { description: 'Could not read file.' });
    }
    if (refs.importFile.current) {
      refs.importFile.current.value = '';
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    // Check if it's a direct audio file
    const isDirectAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$|cdn\.freesound\.org/i.test(urlInput);
    if (isDirectAudio) {
      audio.handleTrackChange(urlInput, urlInput.split('/').pop() || 'Remote Track');
      setUrlInput('');
    } else if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
      // YouTube is handled with a warning in UI, but we can prevent submission here
      logger.warn('YouTube URL detected. Direct playback is discouraged due to CORS.');
    } else {
      // Assume it might work or let the audio error handler catch it
      audio.handleTrackChange(urlInput, 'Web Stream');
      setUrlInput('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: any[] = [];
    let firstMeta: any = null;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
        const meta = await getAudioMetadata(file);
        if (i === 0) firstMeta = meta;

        newTracks.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name.replace(/\.[^/.]+$/, ""),
          genre: 'Local',
          url: URL.createObjectURL(file),
          metadata: meta
        });
      }
    }

    if (newTracks.length > 0) {
      audio.setAudioMetadata(firstMeta);
      audio.handleTrackChange(newTracks[0].url, newTracks[0].name);
      library.setCustomTracks(prev => [...prev, ...newTracks]);
      
      if (onboarding.step === 'load_track') {
        onboarding.advance();
      }

      if (audio.setExactSampleRate && firstMeta?.sampleRate && firstMeta.sampleRate !== 44100) {
        await audio.setExactSampleRate(firstMeta.sampleRate);
      }
    }
  };

  useEffect(() => {
    const handleGesture = () => {
      if (audio.engineRef.current) {
        audio.engineRef.current.getContext?.()?.resume();
      }
    };
    window.addEventListener('click', handleGesture, { capture: true });
    window.addEventListener('keydown', handleGesture, { capture: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [audio.engineRef]);

  const deferredBands = useDeferredValue(eq.bands);
  const sessionDurationStr = `${Math.floor(sessionDuration / 60)}m ${sessionDuration % 60}s`;

  const state = {
    spectralPeaks, setSpectralPeaks,
    lastSync, setLastSync,
    urlInput, setUrlInput,
    showRewImport, setShowRewImport,
    sessionDuration, setSessionDuration,
    sessionDurationStr,
    showExportDialog, setShowExportDialog,
    targetCurveId, setTargetCurveId,
    showEnhancement, setShowEnhancement,
    useZeroLatency, setUseZeroLatency,
    showAnalysisSidebar, setShowAnalysisSidebar,
    engineInstance,
    isAnalyzing, setIsAnalyzing,
    deferredBands,
    dynamicGains,
    refs,
    handleDynamicEqMasterChange,
    restoreBands,
    handleTuningComplete,
    handleSaveProfileLocal,
    handleLoadProfile,
    handleImportFile,
    handleUrlSubmit,
    handleFileUpload,
    handleHearingTestComplete,
    TRACKS,
    onboarding,
    spatialEnabled: audio.spatialEnabled,
    spatialPosition: audio.spatialPosition,
    handleSpatialToggle: audio.handleSpatialToggle,
    handleSpatialPositionChange: audio.handleSpatialPositionChange,
    headTracking: audio.headTracking,
    handleHeadTrackingToggle: audio.handleHeadTrackingToggle
  };

  return <MainAppView audio={audio} eq={eq} ai={calibration} profiles={profile} adaptive={adaptive} tuningAB={tuningAB} aiStatus={aiStatus} library={library} hearing={hearing} state={state} />;
}
