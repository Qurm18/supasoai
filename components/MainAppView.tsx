/* eslint-disable react-hooks/refs */
'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Upload, List, Music } from 'lucide-react';
import { AudioEngineProvider } from '@/lib/audio-engine-context';
import { TARGET_CURVES } from '@/lib/eq-targets';
import { exportProfileAsAPO } from '@/lib/profile-store';
import { earDamageRisk } from '@/lib/math/loudness-adaptive';

// Components
import { AudioInitOverlay } from '@/components/AudioInitOverlay';
import { AIVisualEngineV2 } from '@/components/AIVisualEngineV2';
import { Header } from '@/components/Header';
import { EQCurve } from '@/components/EQCurve';
import { ZeroLatencyVisualizer } from '@/components/ZeroLatencyVisualizer';
import { Visualizer } from '@/components/Visualizer';
import { PerceptionVisualizer } from '@/components/PerceptionVisualizer';
import { PlayerSection } from '@/components/PlayerSection';
import { AnalysisSidebar } from '@/components/AnalysisSidebar';
import { EQSectionHeader } from '@/components/EQSectionHeader';
import { EQPanel } from '@/components/EQPanel';
import { EnhancementPanel } from '@/components/EnhancementPanel';
import { AdaptiveEQModule } from '@/components/AdaptiveEQModule';
import { HearingProtectionIndicator } from '@/components/HearingProtectionIndicator';
import { MainAppFooter } from '@/components/MainAppFooter';
import { RewImport } from '@/components/RewImport';
import { TuningWizard } from '@/components/TuningWizard';
import { ExportDialog } from '@/components/ExportDialog';
import { ProfileLibraryModal } from '@/components/ProfileLibraryModal';
import { TrackLibraryModal } from '@/components/TrackLibraryModal';
import { SaveProfileModal } from '@/components/SaveProfileModal';
import { HearingTestWizard } from '@/components/HearingTestWizard';
import { SpatialPanel } from '@/components/SpatialPanel';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';

import { MainAppViewProps } from '@/lib/types';

export function MainAppView({ audio, eq, ai, profiles, adaptive, tuningAB, aiStatus, library, hearing, state }: MainAppViewProps) {
  const {
    spectralPeaks, setSpectralPeaks, lastSync, setLastSync, urlInput, setUrlInput,
    showRewImport, setShowRewImport, sessionDuration, sessionDurationStr, showExportDialog,
    setShowExportDialog, targetCurveId, setTargetCurveId, showEnhancement,
    setShowEnhancement, useZeroLatency, setUseZeroLatency, showAnalysisSidebar,
    setShowAnalysisSidebar, engineInstance, isAnalyzing, setIsAnalyzing,
    deferredBands, dynamicGains, refs, handleDynamicEqMasterChange, restoreBands,
    handleTuningComplete, handleSaveProfileLocal, handleLoadProfile,
    handleImportFile, handleUrlSubmit, handleFileUpload, handleHearingTestComplete, TRACKS,
    onboarding,
    spatialEnabled, spatialPosition, handleSpatialToggle, handleSpatialPositionChange,
    headTracking, handleHeadTrackingToggle
  } = state || {};
  const { importFile, fileInput, folderInput } = refs || {};
  const risk = useMemo(() => {
    return earDamageRisk(
      eq.bands.map((b: any) => b.gain),
      eq.bands.map((b: any) => b.frequency),
      'moderate',
      sessionDuration
    );
  }, [eq.bands, sessionDuration]);

  const isHearingCompActive = useMemo(() => eq.baseCorrection.some((g: number) => Math.abs(g) > 0.01), [eq.baseCorrection]);

  // Optimize: Pre-warm Audio Engine on first interaction to prevent lag on first playback
  React.useEffect(() => {
    const preWarm = () => {
      if (!audio.isReady && audio.initAudio) {
        audio.initAudio().catch((e: any) => console.warn('Pre-warm failed', e));
      }
      document.removeEventListener('pointerdown', preWarm);
      document.removeEventListener('keydown', preWarm);
    };
    document.addEventListener('pointerdown', preWarm, { passive: true, once: true });
    document.addEventListener('keydown', preWarm, { passive: true, once: true });
    return () => {
      document.removeEventListener('pointerdown', preWarm);
      document.removeEventListener('keydown', preWarm);
    };
  }, [audio]);

  const [isMinimized, setIsMinimized] = React.useState(false);

  // Auto-minimize after inactivity
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = React.useRef(audio.isPlaying);
  React.useEffect(() => {
    isPlayingRef.current = audio.isPlaying;
  }, [audio.isPlaying]);

  React.useEffect(() => {
    const startTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current) {
          setIsMinimized(true);
        }
      }, 8000); 
    };

    const handleActivity = () => {
      if (!isMinimized && isPlayingRef.current) {
        startTimeout();
      }
    };

    if (audio.isPlaying && !isMinimized) {
      startTimeout();
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      events.forEach(name => document.addEventListener(name, handleActivity, { passive: true }));
      return () => {
        events.forEach(name => document.removeEventListener(name, handleActivity));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [audio.isPlaying, isMinimized]);

  const aiSelectedTracks = ai?.selectedTrackUrls;
  const libAllTracks = library?.allTracks;
  const audioSource = audio?.audioSource;
  const audioTrackName = audio?.currentTrackName;

  const wizardTracks = useMemo(() => {
    if (!aiSelectedTracks || !libAllTracks) return [];
    if (aiSelectedTracks.length > 0) {
      return aiSelectedTracks.map((u: string) => {
        const t = libAllTracks.find((x: any) => x.url === u);
        return { url: u, name: t?.name ?? 'Selected Track' };
      });
    }
    
    const currentUrl = audioSource || '';
    const currentName = audioTrackName || 'Current Track';
    return [{ url: currentUrl, name: currentName }];
  }, [aiSelectedTracks, libAllTracks, audioSource, audioTrackName]); 

  return (
    <AudioEngineProvider engine={engineInstance}>
      <main className="min-h-screen bg-[#07080a] text-white relative overflow-x-hidden">
        {/* Ambient aurora */}
        <AIVisualEngineV2 />

        {/* Activation overlay */}
        {!onboarding.step && (
          <AudioInitOverlay isReady={audio.isReady} onInit={audio.initAudio} />
        )}

        {/* Onboarding Flow */}
        <OnboardingOverlay 
          step={onboarding.step} 
          onAdvance={() => {
            if (!audio.isReady) audio.initAudio();
            onboarding.advance();
          }} 
          onSkip={() => {
            if (!audio.isReady) audio.initAudio();
            onboarding.skip();
          }} 
          isAudioReady={audio.isReady}
        />

        {/* App shell */}
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-3 md:px-6 lg:px-8 py-4 md:py-6">
          {/* Header (sticky-ish glass) */}
          <Header
            profileName={profiles.profileName}
            calibrationConfidence={ai.calibrationConfidence}
            interactionCount={aiStatus.interactionCount}
            stability={aiStatus.stability}
            isAICalibrated={ai.isAICalibrated}
            isHearingCompActive={isHearingCompActive}
            profileColor={profiles.profileColor}
            canUndo={eq.history.canUndo()}
            canRedo={eq.history.canRedo()}
            onUndo={eq.handleUndo}
            onRedo={eq.handleRedo}
            onShowProfilePanel={() => profiles.setShowProfilePanel(true)}
            onShowSaveDialog={() => { profiles.setSaveNameInput(profiles.profileName || ''); profiles.setShowSaveDialog(true); }}
            onShowExportDialog={() => setShowExportDialog(true)}
            onImportClick={() => importFile.current?.click()}
            onAICalibrate={() => {
              ai.setSelectionMode(true);
              ai.setSelectedTrackUrls(audio.audioSource ? [audio.audioSource] : []);
              library.setShowTrackLibrary(true);
            }}
            onQuickCalibrate={() => {
              if (!audio.audioSource) {
                ai.setSelectionMode(true);
                library.setShowTrackLibrary(true);
              } else {
                ai.setShowWizard(true);
              }
            }}
            onHearingTest={() => hearing.setShowHearingTest(true)}
            showAnalysisSidebar={showAnalysisSidebar}
            setShowAnalysisSidebar={setShowAnalysisSidebar}
            savedProfilesCount={profiles.savedProfiles.length}
          />
          <input
            ref={importFile}
            type="file"
            accept=".json,.txt"
            className="hidden"
            onChange={handleImportFile}
          />
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Top: Curve + Visualizer (stacked) | Player + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 items-start">
            {/* LEFT: Curve, Visualizer, Player */}
            <div className={`${showAnalysisSidebar ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4 md:space-y-5 transition-all duration-300 w-full`}>
              {/* EQ Curve with target overlay control */}
              <div className="relative">
                {isAnalyzing && (
                  <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-2xl border border-white/10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-2 border-[#F27D26]/20 border-t-[#F27D26] rounded-full animate-spin" />
                      <p className="text-[10px] font-mono text-[#F27D26] uppercase tracking-[0.2em] animate-pulse">Analyzing Resonances...</p>
                    </div>
                  </div>
                )}
                <EQCurve 
                  bands={deferredBands} 
                  baseCorrection={eq.baseCorrection}
                  ghostGains={audio.enhancement.dynamicEqMaster ? dynamicGains : undefined}
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
                {isAnalyzing && (
                  <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-2xl border border-white/10">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <motion.div
                          key={i}
                          animate={{ height: [10, 30, 10] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                          className="w-1 bg-[#F27D26]/40 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {useZeroLatency ? (
                   <ZeroLatencyVisualizer key={`zlv-${audio.audioContext?.sampleRate ?? 0}-${engineInstance ? 1 : 0}`} pipelineInfo={audio.pipelineInfo} />
                ) : (
                   <Visualizer
                     key={`viz-${engineInstance ? 1 : 0}`}
                     analyzer={audio.analyzer} 
                     analyzerL={audio.analyzerL} 
                     analyzerR={audio.analyzerR} 
                     metrics={audio.lufsMetrics} 
                   />
                )}
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                   {useZeroLatency && (
                      <button 
                         onClick={() => {
                            const rates = [44100, 48000, 96000, 192000];
                            const idx = rates.indexOf(audio.pipelineInfo?.targetSampleRate || 44100);
                            const nextIdx = (idx + 1) % rates.length;
                            audio.setExactSampleRate(rates[nextIdx]);
                         }}
                        className="px-2 py-1 text-[9px] uppercase font-mono rounded bg-white/10 hover:bg-white/20 text-white"
                      >
                        Rate: {audio.pipelineInfo?.targetSampleRate ? (audio.pipelineInfo.targetSampleRate/1000).toFixed(1) : 44.1}k
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

              {/* UI-01: Empty state guide for first-time users */}
              {!audio.audioSource && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="theme-glass border border-dashed border-white/10 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center gap-6"
                >
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#F27D26]/20 to-orange-500/10 border border-[#F27D26]/20 flex items-center justify-center shadow-[0_0_40px_rgba(242,125,38,0.15)] ring-1 ring-white/5">
                    <Music className="w-8 h-8 text-[#F27D26]" />
                  </div>
                  
                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-white font-bold text-xl tracking-tight">Audio Engine Ready</h3>
                    <p className="text-[#8E9299] text-sm leading-relaxed">
                      Calibrate your setup with AI-powered EQ. Select a reference track or upload your own to begin the session.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                    <button
                      onClick={() => library.setShowTrackLibrary(true)}
                      className="w-full sm:flex-1 h-12 bg-gradient-to-tr from-[#F27D26] to-[#FF6F3C] text-black font-black text-sm rounded-2xl hover:scale-[1.04] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(242,125,38,0.3)]"
                    >
                      <List className="w-4 h-4" />
                      Browse Library
                    </button>
                    <button
                      onClick={() => {
                        if (fileInput?.current) {
                          fileInput.current.click();
                        } else if (refs?.fileInput?.current) {
                          refs.fileInput.current.click();
                        }
                      }}
                      className="w-full sm:flex-1 h-12 bg-white/10 border border-white/20 hover:bg-white/20 text-white font-black text-sm rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 backdrop-blur-md"
                    >
                      <Upload className="w-4 h-4" />
                      Upload File
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <AnalysisSidebar
              showAnalysisSidebar={showAnalysisSidebar}
              urlInput={urlInput}
              setUrlInput={setUrlInput}
              onUrlSubmit={handleUrlSubmit}
              onShowTrackLibrary={() => library.setShowTrackLibrary(true)}
              tracksCount={TRACKS.length}
              taste={ai.taste}
              scenarioAnalysis={ai.scenarioAnalysis}
              reasons={ai.reasons}
              aiInsights={ai.aiInsights}
              onShowExportDialog={() => setShowExportDialog(true)}
            />
          </div>
          {/* EQ controls section */}
          <section className="mt-6 md:mt-8 space-y-6">
            <EQSectionHeader
              profileGenre={profiles.profileGenre}
              profileName={profiles.profileName}
              handleReset={eq.handleReset}
              setSaveNameInput={profiles.setSaveNameInput}
              setShowSaveDialog={profiles.setShowSaveDialog}
            />

            {/* MAIN EQ PANEL - Top Priority */}
            <div className="relative z-20">
              <EQPanel
                bands={eq.bands}
                onBandChange={eq.handleBandChange}
                preAmp={audio.preAmp}
                onPreAmpChange={audio.handlePreAmpChange}
                phaseMode={audio.phaseMode}
                onPhaseModeChange={audio.handlePhaseModeChange}
                dynamicEqMaster={audio.enhancement.dynamicEqMaster}
                onDynamicEqMasterChange={handleDynamicEqMasterChange}
                spectralPeaks={spectralPeaks}
                dynamicGains={dynamicGains}
              />
            </div>

            {audio.audioSource && engineInstance && (
              <div className="relative z-10 my-4">
                <PerceptionVisualizer />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* ─── Spatial Audio Panel ─── */}
              <SpatialPanel
                enabled={spatialEnabled}
                onToggle={handleSpatialToggle}
                position={spatialPosition}
                onPositionChange={handleSpatialPositionChange}
                headTracking={headTracking}
                onHeadTrackingToggle={handleHeadTrackingToggle}
              />

              {/* ─── Sound Enhancement Panel ─── */}
              <EnhancementPanel
                showEnhancement={showEnhancement}
                setShowEnhancement={setShowEnhancement}
                enhancement={audio.enhancement}
                setEnhancement={audio.setEnhancement}
                onEnhancementChange={audio.handleEnhancementChange}
              />

              {/* ─── Adaptive EQ Module ─── */}
              <AdaptiveEQModule
                isAdaptiveMode={adaptive.isAdaptiveMode}
                setIsAdaptiveMode={adaptive.setIsAdaptiveMode}
                stability={aiStatus.stability}
                sectionType={adaptive.sectionType}
                setSectionType={adaptive.setSectionType}
                profileName={profiles.profileName}
              />

              {/* Hearing Protection Indicator */}
              <HearingProtectionIndicator risk={risk} />
            </div>
          </section>

          {/* Footer */}
          <MainAppFooter errorHeader={audio.errorHeader} lastSync={lastSync} />

          <div className="h-32 md:h-24" />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 z-[90] pointer-events-none">
          <div className="mx-auto max-w-[1400px] pointer-events-auto">
            <AnimatePresence>
              {audio.audioSource && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                >
                  <PlayerSection
                    isMinimized={isMinimized}
                    onWakeUp={() => setIsMinimized(false)}
                    onMinimize={() => setIsMinimized(true)}
                    currentTrackName={audio.currentTrackName}
                    audioSourceUrl={audioSource || undefined}
                    isPlaying={audio.isPlaying}
                    currentTime={audio.currentTime}
                    duration={audio.duration}
                    audioMetadata={audio.audioMetadata}
                    onSeek={audio.seek}
                    onBrowseLibrary={() => library.setShowTrackLibrary(true)}
                    onRewImport={() => setShowRewImport(true)}
                    onFileUploadClick={() => {
                      if (fileInput?.current) {
                        fileInput.current.click();
                      } else if (refs?.fileInput?.current) {
                        refs.fileInput.current.click();
                      }
                    }}
                    fileInputRef={fileInput}
                    handleFileUpload={handleFileUpload}
                    onPrevTrack={library.handlePrevTrack}
                    onTogglePlayback={audio.togglePlayback}
                    onNextTrack={library.handleNextTrack}
                    volume={audio.volume}
                    onVolumeChange={(val: any) => audio.handleVolumeChange(val)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Hidden audio */}
        <audio
          ref={audio.audioRef}
          src={audio.audioSource || undefined}
          onEnded={() => audio.setIsPlaying(false)}
          onTimeUpdate={audio.handleTimeUpdate}
          onLoadedMetadata={audio.handleLoadedMetadata}
          onError={audio.handleAudioError}
          preload="auto"
          crossOrigin={audio.audioSource && !audio.audioSource.startsWith('blob:') ? 'anonymous' : undefined}
        />

        <input
          type="file"
          ref={folderInput}
          onChange={library.handleFolderInputChange}
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          className="hidden"
        />

        {/* Modals */}
        <AnimatePresence>
          {showRewImport && (
            <RewImport 
              onClose={() => setShowRewImport(false)}
              onApply={(gains: number[]) => {
                const newBands = eq.bands.map((b: any, i: number) => ({ ...b, gain: gains[i] }));
                eq.setBands(newBands);
                audio.applyBandsToEngine(newBands, audio.preAmp);
                eq.history.push(newBands, audio.preAmp, 'REW Measurement Apply');
                eq.debouncedPersist(newBands, audio.preAmp);
              }}
            />
          )}
          {ai.showWizard && (
            <TuningWizard
              learnerState={adaptive.learnerState}
              onComplete={handleTuningComplete}
              onClose={restoreBands}
              onPreviewAB={tuningAB.handlePreviewAB}
              onExitAB={tuningAB.handleExitAB}
              onChoice={adaptive.handleInteraction}
              tracks={wizardTracks}
              targetSamples={Math.min(40, 15 + 10 * Math.max(1, ai.selectedTrackUrls.length))}
            />
          )}
          {hearing.showHearingTest && (
            <HearingTestWizard
              onClose={() => hearing.setShowHearingTest(false)}
              onComplete={handleHearingTestComplete}
            />
          )}
        </AnimatePresence>

        {/* Export dialog */}
        <ExportDialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          bands={eq.bands}
          preAmp={audio.preAmp}
          defaultName={profiles.profileName || 'Sonic AI Live EQ'}
          defaultGenre={profiles.profileGenre ?? undefined}
          defaultColor={profiles.profileColor}
        />

        <ProfileLibraryModal
          show={profiles.showProfilePanel}
          onClose={() => profiles.setShowProfilePanel(false)}
          savedProfiles={profiles.savedProfiles}
          handleDeleteProfile={profiles.deleteProfile}
          handleLoadProfile={handleLoadProfile}
          exportProfileAsAPO={exportProfileAsAPO}
          importFileRef={importFile}
          importError={profiles.importError}
        />

        <TrackLibraryModal
          show={library.showTrackLibrary}
          onClose={() => library.setShowTrackLibrary(false)}
          selectionMode={ai.selectionMode}
          setSelectionMode={ai.setSelectionMode}
          selectedTrackUrls={ai.selectedTrackUrls}
          setSelectedTrackUrls={ai.setSelectedTrackUrls}
          allTracks={library.allTracks}
          trackSearch={library.trackSearch}
          setTrackSearch={library.setTrackSearch}
          genreFilter={library.genreFilter}
          setGenreFilter={library.setGenreFilter}
          allGenres={library.allGenres}
          handleFolderImport={() => folderInput.current?.click()}
          fileInputRef={fileInput}
          audioSource={audio.audioSource || ''}
          currentTrackName={audio.currentTrackName}
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          handleUrlSubmit={handleUrlSubmit}
          isPlaying={audio.isPlaying}
          onConfirmCalibration={() => {
            library.setShowTrackLibrary(false);
            ai.setShowWizard(true);
          }}
          onTrackSelect={(track: any) => {
            if (ai.selectionMode) {
              ai.setSelectedTrackUrls((prev: string[]) => {
                if (prev.includes(track.url)) return prev.filter((u: string) => u !== track.url);
                if (prev.length >= 3) return [...prev.slice(1), track.url];
                return [...prev, track.url];
              });
            } else {
              audio.handleTrackChange(track.url, track.name);
              library.setShowTrackLibrary(false);
            }
          }}
        />

        <SaveProfileModal
          show={profiles.showSaveDialog}
          onClose={() => profiles.setShowSaveDialog(false)}
          saveNameInput={profiles.saveNameInput}
          setSaveNameInput={profiles.setSaveNameInput}
          handleSaveProfileLocal={handleSaveProfileLocal}
          profileName={profiles.profileName}
        />
      </main>
    </AudioEngineProvider>
  );
}
