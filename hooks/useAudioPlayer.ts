import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine, EQBand, EnhancementParams, DEFAULT_ENHANCEMENT } from '@/lib/audio-engine';
import { webUSB } from '@/lib/webusb-audio';
import { logger } from '@/lib/logger';
import { safeAudioOperation } from '@/components/AudioProcessingErrorBoundary';

// ===== STATE MACHINE TYPES =====
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlaybackOperation {
  type: 'play' | 'pause' | 'load';
  abortController: AbortController;
  timestamp: number;
}

import { UseAudioPlayerReturn } from '@/lib/types';

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const isPlaying = playbackState === 'playing'; // Derived for backward compatibility
  
  const [volume, setVolume] = useState(0.8);
  const [preAmp, setPreAmp] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioSource, setAudioSource] = useState('');
  const [currentTrackName, setCurrentTrackName] = useState('No track loaded');
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [analyzer, setAnalyzer] = useState<AnalyserNode | null>(null);
  const [analyzerL, setAnalyzerL] = useState<AnalyserNode | null>(null);
  const [analyzerR, setAnalyzerR] = useState<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [enhancement, setEnhancement] = useState<EnhancementParams>({ ...DEFAULT_ENHANCEMENT });
  const [lufsMetrics, setLufsMetrics] = useState({ momentary: -70, shortTerm: -70, integrated: -70, peak: -96, psr: 0 });
  const [phaseMode, setPhaseMode] = useState<'iir' | 'fir' | 'hybrid'>('iir');
  const [spatialEnabled, setSpatialEnabled] = useState(false);
  const [spatialPosition, setSpatialPosition] = useState({ azimuth: 0, elevation: 0 });
  const [headTracking, setHeadTracking] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const blobUrlCacheRef = useRef<Set<string>>(new Set());

  const [pipelineInfo, setPipelineInfo] = useState({ actualSampleRate: 44100, targetSampleRate: 44100, isResampled: false });
  const [audioMetadata, setAudioMetadata] = useState<{ sampleRate: number; bitDepth: number | string; channels: number; format: string } | null>(null);

  const currentOperationRef = useRef<PlaybackOperation | null>(null);
  const pendingOperationRef = useRef<PlaybackOperation | null>(null);

  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIsPlaying(playbackState === 'playing');
    }
  }, [playbackState]);

  // ===== HELPER: Cancel operation =====
  const cancelOperation = useCallback((operation: PlaybackOperation | null) => {
    if (operation) {
      operation.abortController.abort();
    }
  }, []);

  // ===== MAIN: Execute operation =====
  const executeOperation = useCallback(async (operation: PlaybackOperation, extraData?: any): Promise<void> => {
    const { type, abortController } = operation;
    if (!audioRef.current) return;
    
    await safeAudioOperation(async () => {
      if (type === 'play') {
        if (engineRef.current) await engineRef.current.resume();
        const promise = audioRef.current!.play();
        if (promise !== undefined) await promise;
        
        if (!abortController.signal.aborted) {
          setPlaybackState('playing');
          setErrorHeader(null);
        }
      } 
      else if (type === 'pause') {
        audioRef.current!.pause();
        if (!abortController.signal.aborted) {
          setPlaybackState('paused');
        }
      }
      else if (type === 'load') {
        const { url, wasPlaying } = extraData;
        setPlaybackState('loading');
        
        console.log(`[Audio] Loading: ${url}, wasPlaying=${wasPlaying}`);

        try {
          if (wasPlaying && engineRef.current) {
            await engineRef.current.crossfade(url, audioRef.current!);
            if (!abortController.signal.aborted) {
              setPlaybackState(audioRef.current!.paused ? 'paused' : 'playing');
            }
          } else {
            if (!audioRef.current) {
              console.error('[Audio] Audio element not available');
              setErrorHeader('Audio element not initialized');
              setPlaybackState('error');
              return;
            }
            
            
            // Basic validation for better error reporting
            if (!url.startsWith('blob:')) {
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    const contentType = response.headers.get('Content-Type');
                    console.log(`[Audio] Content-Type for ${url}: ${contentType}`);
                    if (contentType && !contentType.startsWith('audio/') && !contentType.startsWith('application/octet-stream')) {
                        console.warn(`[Audio] Unexpected Content-Type for ${url}: ${contentType}`);
                    }
                } catch (e) {
                    console.info('[Audio] Could not check Content-Type (CORS or network issue), proceeding with load');
                }
            }

            audioRef.current.src = url;
            audioRef.current.crossOrigin = url.startsWith('blob:') ? null : 'anonymous';
            
            console.log(`[Audio] Attempting to load: ${url}`);
            
            const loadPromise = new Promise<void>((resolve) => {
              let isDone = false;
              
              const done = () => {
                if (isDone) return;
                isDone = true;
                audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
                audioRef.current?.removeEventListener('error', onLoadError);
                console.log('[Audio] Load metadata success');
                resolve();
              };
              
              const onLoadError = () => {
                if (isDone) return;
                isDone = true;
                audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
                audioRef.current?.removeEventListener('error', onLoadError);
                
                const errorCode = audioRef.current?.error?.code || -1;
                const errorMsg = audioRef.current?.error?.message || 'Unknown error';
                console.error(`[Audio] Load error - Code: ${errorCode}, Message: ${errorMsg}`);
                
                // Specifically identify format errors
                if (errorCode === 4) {
                    setErrorHeader(`Format Error (4): Browser cannot decode this file.`);
                    console.warn('[Audio] Code 4 often means unsupported codec, corrupted file, or CORS blocking that the browser misinterprets.');
                } else if (errorCode === 1) {
                    setErrorHeader(`Load Aborted (1): Request was cancelled.`);
                } else if (errorCode === 2) {
                    setErrorHeader(`Network Error (2): Check your connection.`);
                } else if (errorCode === 3) {
                    setErrorHeader(`Decoder Error (3): Audio corruption detected.`);
                } else {
                    setErrorHeader(`Failed to load audio: ${errorMsg}`);
                }
                setPlaybackState('error');
                resolve();
              };
              
              const onLoadedMetadata = done;
              
              audioRef.current?.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
              audioRef.current?.addEventListener('error', onLoadError, { once: true });
              
              // Timeout fallback
              const timeoutId = setTimeout(() => {
                if (!isDone) {
                  console.warn('[Audio] Load timeout after 2s');
                  done();
                }
              }, 2000);
              
              const originalResolve = resolve;
              resolve = (value?: void | PromiseLike<void>) => {
                clearTimeout(timeoutId);
                originalResolve(value);
              };
            });
            
            await loadPromise;
            
            if (!abortController.signal.aborted) {
              if (!audioRef.current?.error) {
                setPlaybackState('paused');
              }
            }
          }
        } catch (error) {
          console.error('[Audio] Error in load operation:', error);
          setErrorHeader(`Error loading audio: ${error}`);
          setPlaybackState('error');
        }
      }
    }, `playback_operation_${type}`);
  }, []);

  const updatePipelineInfo = useCallback(() => {
    if (engineRef.current) {
        setPipelineInfo({
           actualSampleRate: engineRef.current.actualSampleRate,
           targetSampleRate: engineRef.current.targetSampleRate,
           isResampled: engineRef.current.isResampled
        });
    }
  }, []);

  const initPromiseRef = useRef<Promise<any> | null>(null);

  const initAudio = useCallback(async () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    const promise = safeAudioOperation(async () => {
      if (!engineRef.current) engineRef.current = new AudioEngine();
      await engineRef.current.initialize(audioEl);
      setAnalyzer(engineRef.current.getAnalyzer());
      setAnalyzerL(engineRef.current.getAnalyzerL());
      setAnalyzerR(engineRef.current.getAnalyzerR());
      setAudioContext(engineRef.current.getContext());
      updatePipelineInfo();
      setIsReady(true);
    }, 'audio_engine_init');
    
    initPromiseRef.current = promise.finally(() => {
        initPromiseRef.current = null;
    });
    
    return initPromiseRef.current;
  }, [updatePipelineInfo]);

  const togglePlayback = useCallback(async () => {
    if (!audioRef.current) return;
    if (!engineRef.current && !initPromiseRef.current) await initAudio();

    const targetType = playbackState === 'playing' ? 'pause' : 'play';
    
    const newOperation: PlaybackOperation = {
      type: targetType,
      abortController: new AbortController(),
      timestamp: Date.now()
    };
    
    pendingOperationRef.current = newOperation;
    
    if (currentOperationRef.current) {
      cancelOperation(currentOperationRef.current);
    }
    
    // Yield to let aborts propagate
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const opToExecute = pendingOperationRef.current;
    if (!opToExecute || opToExecute !== newOperation) return;
    
    currentOperationRef.current = opToExecute;
    pendingOperationRef.current = null;
    
    await executeOperation(opToExecute);
  }, [playbackState, initAudio, executeOperation, cancelOperation]);

  const currentBlobUrlRef = useRef<string | null>(null);

  const handleTrackChange = useCallback(async (url: string, name: string) => {
    if (!url) return;
    
    const wasPlaying = playbackState === 'playing' || (currentOperationRef.current?.type === 'play' && !currentOperationRef.current.abortController.signal.aborted);
    
    // Cancel active ops
    cancelOperation(currentOperationRef.current);
    cancelOperation(pendingOperationRef.current);
    currentOperationRef.current = null;
    pendingOperationRef.current = null;

    if (url.startsWith('blob:')) {
      currentBlobUrlRef.current = url;
      blobUrlCacheRef.current.add(url);
      console.log(`[Audio] Cached blob URL: ${url}, Total cached: ${blobUrlCacheRef.current.size}`);
    } else {
      currentBlobUrlRef.current = null;
    }

    // UI Updates
    setAudioSource(url);
    setCurrentTrackName(name);
    setErrorHeader(null);
    setCurrentTime(0);

    if (!audioRef.current) return;
    if (!engineRef.current && !initPromiseRef.current) await initAudio();

    const loadOp: PlaybackOperation = {
      type: 'load',
      abortController: new AbortController(),
      timestamp: Date.now()
    };
    
    currentOperationRef.current = loadOp;
    await executeOperation(loadOp, { url, wasPlaying });
  }, [playbackState, initAudio, executeOperation, cancelOperation]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    engineRef.current?.setMasterVolume(v);
  }, []);

  const handlePreAmpChange = useCallback((val: number) => {
    setPreAmp(val);
    engineRef.current?.setPreAmp(val);
  }, []);

  const handleAudioError = useCallback(() => {
    setErrorHeader('Audio Source Error: Check your connection or file format.');
    setPlaybackState('error');
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleEnhancementChange = useCallback((params: Partial<EnhancementParams>) => {
    setEnhancement((prev: EnhancementParams) => {
      const next = { ...prev, ...params };
      engineRef.current?.updateEnhancement(next);
      return next;
    });
  }, []);

  const applyBandsToEngine = useCallback((newBands: EQBand[], newPreAmp: number) => {
    if (!engineRef.current) return;
    newBands.forEach((b, i) => engineRef.current?.updateBandParams(i, b));
    engineRef.current.setPreAmp(newPreAmp);
  }, []);

  const handlePhaseModeChange = useCallback((mode: 'iir' | 'fir' | 'hybrid') => {
    setPhaseMode(mode);
    engineRef.current?.setPhaseMode(mode);
  }, []);

  const handleSpatialToggle = useCallback((enabled: boolean) => {
    setSpatialEnabled(enabled);
    engineRef.current?.setSpatialEnabled(enabled);
  }, []);

  const handleSpatialPositionChange = useCallback((azimuth: number, elevation: number) => {
    setSpatialPosition({ azimuth, elevation });
    engineRef.current?.spatializer?.setPosition(azimuth, elevation);
  }, []);

  const handleHeadTrackingToggle = useCallback((enabled: boolean) => {
    setHeadTracking(enabled);
    if (enabled) engineRef.current?.enableHeadTracking();
    else engineRef.current?.disableHeadTracking();
  }, []);

  const enableWebUSB = useCallback(async () => {
    if (!webUSB.isActive) {
      const ok = await webUSB.requestDevice();
      if (!ok) return false;
    }
    if (engineRef.current) await engineRef.current.toggleWebUSB(true);
    return true;
  }, []);

  const disableWebUSB = useCallback(async () => {
    await webUSB.disconnect();
    if (engineRef.current) await engineRef.current.toggleWebUSB(false);
  }, []);

  const setExactSampleRate = useCallback(async (rate: number) => {
    if (engineRef.current && audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      const currentTime = audioRef.current.currentTime;

      // Pause cleanly before reinit to avoid AbortError race
      if (wasPlaying) {
        audioRef.current.pause();
        setPlaybackState('paused');
      }

      await engineRef.current.reinitializeAtRate(audioRef.current, rate);

      // Update ALL audio-graph refs so Visualizer gets fresh nodes
      setAudioContext(engineRef.current.getContext());
      setAnalyzer(engineRef.current.getAnalyzer());
      setAnalyzerL(engineRef.current.getAnalyzerL());
      setAnalyzerR(engineRef.current.getAnalyzerR());
      updatePipelineInfo();

      if (wasPlaying) {
        try {
          // Give the new context a moment to settle
          await new Promise(resolve => setTimeout(resolve, 150));
          audioRef.current!.currentTime = currentTime;
          const promise = audioRef.current!.play();
          if (promise !== undefined) {
            promise
              .then(() => setPlaybackState('playing'))
              .catch((e) => {
                if ((e as { name: string }).name !== 'AbortError') {
                  logger.warn('Failed to resume playback after sample rate change:', e);
                }
                setPlaybackState('paused');
              });
          } else {
            setPlaybackState('playing');
          }
        } catch (e) {
          logger.warn('Failed to resume playback after sample rate change:', e);
          setPlaybackState('error');
        }
      }
    }
  }, [updatePipelineInfo]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (engineRef.current && isPlaying) {
        const m = engineRef.current.getLoudnessMetrics();
        setLufsMetrics(m);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const blobCache = blobUrlCacheRef.current;
    return () => {
      // Clean up cached blob URLs on unmount
      blobCache.forEach((blobUrl) => {
        try {
          URL.revokeObjectURL(blobUrl);
          console.log(`[Audio] Revoked blob URL on cleanup: ${blobUrl}`);
        } catch (e) {
          console.warn(`[Audio] Error revoking blob URL: ${e}`);
        }
      });
      blobCache.clear();

      cancelOperation(currentOperationRef.current);
      cancelOperation(pendingOperationRef.current);
      if (engineRef.current) {
        engineRef.current.cancel();
        engineRef.current.detachVisualizer();
        engineRef.current.destroy();
      }
    };
  }, [cancelOperation]);

  return {
    audioRef,
    engineRef,
    playbackState,
    isPlaying,
    setIsPlaying: (p: boolean) => setPlaybackState(p ? 'playing' : 'paused'),
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
    handleTimeUpdate,
    handleLoadedMetadata,
    seek,
    currentTime,
    duration,
    applyBandsToEngine,
    handlePhaseModeChange,
    enableWebUSB,
    disableWebUSB,
    setExactSampleRate,
    pipelineInfo,
    audioMetadata,
    setAudioMetadata,
    spatialEnabled,
    spatialPosition,
    handleSpatialToggle,
    handleSpatialPositionChange,
    headTracking,
    handleHeadTrackingToggle,
  };
}
