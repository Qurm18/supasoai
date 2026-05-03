import { EQBand, EnhancementParams, AudioEngine } from './audio-engine';
import { TasteResult, ChoiceReason, ScenarioChoiceAnalysis } from './ai-engine';
import { SavedProfile } from './profile-store';
import { ContextualPreferenceState } from './ai-engine-v2';
import { Track } from '@/hooks/useTrackLibrary';

// Core Audio State
export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  errorHeader: string | null;
}

// ML Model output types
export interface MLInferenceResult {
  spectralFeatures: {
    peaks: Array<{ freqHz: number; magnitudeDb: number; prominenceDb: number; tonality: number }>;
    centroid: number;
    flatness: number;
    crestFactor: number;
    tonality: number;
  };
  recommendedEQ: {
    gains: number[];
    preAmp: number;
    confidence: number;
  };
  timestamp: number;
  processingTime: number;
}

export interface UseAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  engineRef: React.MutableRefObject<AudioEngine | null>;
  playbackState: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  volume: number;
  handleVolumeChange: (v: number) => void;
  preAmp: number;
  handlePreAmpChange: (v: number) => void;
  setPreAmp: (v: number) => void;
  currentTime: number;
  handleTimeUpdate: () => void;
  duration: number;
  handleLoadedMetadata: () => void;
  audioSource: string | null;
  setAudioSource: (v: string) => void;
  currentTrackName: string;
  setCurrentTrackName: (v: string) => void;
  errorHeader: string | null;
  setErrorHeader: (v: string | null) => void;
  analyzer: AnalyserNode | null;
  analyzerL: AnalyserNode | null;
  analyzerR: AnalyserNode | null;
  audioContext: AudioContext | null;
  isReady: boolean;
  enhancement: EnhancementParams;
  setEnhancement: React.Dispatch<React.SetStateAction<EnhancementParams>>;
  lufsMetrics: { momentary: number; shortTerm: number; integrated: number; peak: number; psr: number };
  phaseMode: 'iir' | 'fir' | 'hybrid';
  handlePhaseModeChange: (m: 'iir' | 'fir' | 'hybrid') => void;
  setPhaseMode: (m: 'iir' | 'fir' | 'hybrid') => void;
  initAudio: () => Promise<void | null>;
  togglePlayback: () => Promise<void>;
  handleTrackChange: (url: string, name: string) => Promise<void>;
  handleEnhancementChange: (params: Partial<EnhancementParams>) => void;
  handleAudioError: () => void;
  seek: (v: number) => void;
  applyBandsToEngine: (bands: EQBand[], preAmp: number) => void;
  enableWebUSB: () => Promise<boolean>;
  disableWebUSB: () => Promise<void>;
  setExactSampleRate: (rate: number) => Promise<void>;
  pipelineInfo: { actualSampleRate: number; targetSampleRate: number; isResampled: boolean };
  audioMetadata: { sampleRate: number; bitDepth: number | string; channels: number; format: string } | null;
  setAudioMetadata: (meta: { sampleRate: number; bitDepth: number | string; channels: number; format: string } | null) => void;
  spatialEnabled: boolean;
  spatialPosition: { azimuth: number; elevation: number };
  handleSpatialToggle: (v: boolean) => void;
  handleSpatialPositionChange: (az: number, el: number) => void;
  headTracking: boolean;
  handleHeadTrackingToggle: (v: boolean) => void;
}

export interface UseEQManagerReturn {
  bands: EQBand[];
  setBands: (v: EQBand[]) => void;
  baseCorrection: number[];
  setBaseCorrection: (v: number[]) => void;
  history: {
    canUndo: () => boolean;
    canRedo: () => boolean;
    push: (bands: EQBand[], preAmp: number, label?: string) => void;
    undo: () => { bands: EQBand[]; preAmp: number } | null;
    redo: () => { bands: EQBand[]; preAmp: number } | null;
  };
  lastManualEditTime: number;
  setLastManualEditTime: (v: number) => void;
  debouncedPersist: (bands: EQBand[], preAmp: number) => void;
  handleBandChange: (index: number, params: Partial<EQBand>) => void;
  handleReset: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

export interface UseProfileManagerReturn {
  savedProfiles: SavedProfile[];
  setSavedProfiles: (v: SavedProfile[]) => void;
  showProfilePanel: boolean;
  setShowProfilePanel: (v: boolean) => void;
  profileName: string | null;
  setProfileName: (v: string | null) => void;
  profileColor: string;
  setProfileColor: (v: string) => void;
  profileGenre: string | null;
  setProfileGenre: (v: string | null) => void;
  saveNameInput: string;
  setSaveNameInput: (v: string) => void;
  showSaveDialog: boolean;
  setShowSaveDialog: (v: boolean) => void;
  importError: string | null;
  setImportError: (v: string | null) => void;
  refreshProfiles: () => void;
  handleSaveProfile: (name: string, bands: EQBand[], preAmp: number, metadata?: Partial<SavedProfile>) => SavedProfile;
  deleteProfile: (id: string) => void;
}

export interface UseTrackLibraryReturn {
  allTracks: Track[];
  customTracks: Track[];
  setCustomTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  trackSearch: string;
  setTrackSearch: (v: string) => void;
  genreFilter: string;
  setGenreFilter: (v: string) => void;
  allGenres: string[];
  showTrackLibrary: boolean;
  setShowTrackLibrary: (v: boolean) => void;
  handlePrevTrack: () => void;
  handleNextTrack: () => void;
  handleFolderImport: () => void;
  handleFolderInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface UseCalibrationReturn {
  showWizard: boolean;
  setShowWizard: React.Dispatch<React.SetStateAction<boolean>>;
  isAICalibrated: boolean;
  setIsAICalibrated: React.Dispatch<React.SetStateAction<boolean>>;
  calibrationConfidence: number;
  setCalibrationConfidence: React.Dispatch<React.SetStateAction<number>>;
  taste: TasteResult | null;
  setTaste: React.Dispatch<React.SetStateAction<TasteResult | null>>;
  reasons: ChoiceReason[];
  setReasons: React.Dispatch<React.SetStateAction<ChoiceReason[]>>;
  scenarioCounts: Record<string, { A: number; B: number; dislikeBoth: number }>;
  setScenarioCounts: React.Dispatch<React.SetStateAction<Record<string, { A: number; B: number; dislikeBoth: number }>>>;
  scenarioAnalysis: ScenarioChoiceAnalysis[];
  setScenarioAnalysis: React.Dispatch<React.SetStateAction<ScenarioChoiceAnalysis[]>>;
  aiInsights: string[];
  setAiInsights: React.Dispatch<React.SetStateAction<string[]>>;
  selectionMode: boolean;
  setSelectionMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTrackUrls: string[];
  setSelectedTrackUrls: React.Dispatch<React.SetStateAction<string[]>>;
  handleCalibrationComplete: (result: {
    taste?: TasteResult;
    reasons?: ChoiceReason[];
    scenarioCounts?: Record<string, { A: number; B: number; dislikeBoth: number }>;
    scenarioAnalysis?: ScenarioChoiceAnalysis[];
    confidenceScore: number;
    insights?: string[];
    profileName?: string;
    profile?: any;
    gains?: number[];
  }) => void;
}

export interface UseAdaptiveEQReturn {
  isAdaptiveMode: boolean;
  setIsAdaptiveMode: React.Dispatch<React.SetStateAction<boolean>>;
  sectionType: 'intro' | 'verse' | 'chorus' | 'drop' | 'outro';
  setSectionType: React.Dispatch<React.SetStateAction<'intro' | 'verse' | 'chorus' | 'drop' | 'outro'>>;
  learnerState: ContextualPreferenceState | null;
  setLearnerState: React.Dispatch<React.SetStateAction<ContextualPreferenceState | null>>;
  leanerRef: React.MutableRefObject<any>;
  handleInteraction: (
    choice: 'A' | 'B' | 'DISLIKE_BOTH' | 'NO_PREFERENCE',
    interaction: {
      eqA: number[];
      eqB: number[];
      listenTime: number;
      confidence?: number;
    }
  ) => void;
}

export interface UseTuningABReturn {
  handlePreviewAB: (
    scenarioId: string,
    branch: 'A' | 'B',
    seekTime?: number,
    trackUrl?: string,
    customGains?: number[]
  ) => Promise<void>;
  handleExitAB: () => void;
}

export interface UseAIStatusReturn {
  interactionCount: number;
  stability: number;
}

export interface UseHearingTestReturn {
  showHearingTest: boolean;
  setShowHearingTest: (v: boolean) => void;
  isTestRunning: boolean;
  setIsTestRunning: (v: boolean) => void;
  step: number;
  totalTrials: number;
  currentFrequency: number;
  currentDb: number;
  audiogram: any;
  testResult: any;
  startTest: () => void;
  handleResponse: (heard: boolean) => void;
}

// Component Props
export interface MainAppViewProps {
  audio: UseAudioPlayerReturn;
  eq: UseEQManagerReturn;
  ai: UseCalibrationReturn;
  profiles: UseProfileManagerReturn;
  adaptive: UseAdaptiveEQReturn;
  tuningAB: UseTuningABReturn;
  aiStatus: UseAIStatusReturn;
  library: UseTrackLibraryReturn;
  hearing: UseHearingTestReturn;
  state: {
    spectralPeaks: number[];
    setSpectralPeaks: (v: number[]) => void;
    lastSync: string;
    setLastSync: (v: string) => void;
    urlInput: string;
    setUrlInput: (v: string) => void;
    showRewImport: boolean;
    setShowRewImport: React.Dispatch<React.SetStateAction<boolean>>;
    sessionDuration: number;
    sessionDurationStr: string;
    setSessionDuration: React.Dispatch<React.SetStateAction<number>>;
    showExportDialog: boolean;
    setShowExportDialog: React.Dispatch<React.SetStateAction<boolean>>;
    targetCurveId: string;
    setTargetCurveId: React.Dispatch<React.SetStateAction<string>>;
    showEnhancement: boolean;
    setShowEnhancement: React.Dispatch<React.SetStateAction<boolean>>;
    useZeroLatency: boolean;
    setUseZeroLatency: React.Dispatch<React.SetStateAction<boolean>>;
    showAnalysisSidebar: boolean;
    setShowAnalysisSidebar: React.Dispatch<React.SetStateAction<boolean>>;
    engineInstance: any;
    isAnalyzing: boolean;
    setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
    deferredBands: EQBand[];
    dynamicGains: number[];
    refs: {
      importFile: React.RefObject<HTMLInputElement | null>;
      fileInput: React.RefObject<HTMLInputElement | null>;
      folderInput: React.RefObject<HTMLInputElement | null>;
    };
    handleDynamicEqMasterChange: (v: boolean) => void;
    restoreBands: () => void;
    handleTuningComplete: (result: any) => void;
    handleSaveProfileLocal: () => void;
    handleLoadProfile: (loadedProfile: any) => void;
    handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleUrlSubmit: (e: React.FormEvent) => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleHearingTestComplete: (result: any) => void;
    TRACKS: any[];
    onboarding: import('@/hooks/useOnboarding').useOnboardingReturn;
    spatialEnabled: boolean;
    spatialPosition: { azimuth: number; elevation: number };
    handleSpatialToggle: (v: boolean) => void;
    handleSpatialPositionChange: (az: number, el: number) => void;
    headTracking: boolean;
    handleHeadTrackingToggle: (v: boolean) => void;
  };
}

// Type Guards
export function isValidMLResult(obj: unknown): obj is MLInferenceResult {
  const result = obj as MLInferenceResult;
  return (
    typeof result === 'object' &&
    result !== null &&
    typeof result.timestamp === 'number' &&
    result.recommendedEQ &&
    typeof result.recommendedEQ.confidence === 'number' &&
    Array.isArray(result.recommendedEQ.gains)
  );
}
