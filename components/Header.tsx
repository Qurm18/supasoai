'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Undo2, Redo2, FolderOpen, Save, Download, Upload, Sparkles, LayoutDashboard, Target, Ear, ChevronDown, ChevronUp
} from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { Divider, IconBtn } from './Shared';

interface HeaderProps {
  profileName: string | null;
  calibrationConfidence: number;
  interactionCount: number;
  stability: number;
  isAICalibrated: boolean;
  isHearingCompActive: boolean;
  profileColor: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onShowProfilePanel: () => void;
  onShowSaveDialog: () => void;
  onShowExportDialog: () => void;
  onImportClick: () => void;
  onAICalibrate: () => void;
  onQuickCalibrate: () => void;
  onHearingTest: () => void;
  showAnalysisSidebar: boolean;
  setShowAnalysisSidebar: (show: boolean) => void;
  savedProfilesCount: number;
}

export function Header({
  profileName,
  calibrationConfidence,
  interactionCount,
  stability,
  isAICalibrated,
  isHearingCompActive,
  profileColor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onShowProfilePanel,
  onShowSaveDialog,
  onShowExportDialog,
  onImportClick,
  onAICalibrate,
  onQuickCalibrate,
  onHearingTest,
  showAnalysisSidebar,
  setShowAnalysisSidebar,
  savedProfilesCount,
}: HeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [showStatus, setShowStatus] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const hasMetrics = mounted && (calibrationConfidence > 0 || interactionCount > 0 || isHearingCompActive);

  return (
    <div className="flex flex-col gap-2 mb-4 md:mb-6">
      <header className="sticky top-2 md:top-4 z-30 sonic-glass rounded-2xl px-3 md:px-5 py-2 md:py-3 flex items-center justify-between gap-x-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        {/* Identity Zone */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-[#F27D26] to-[#FF4444] flex items-center justify-center shadow-[0_6px_18px_rgba(242,125,38,0.45)] flex-shrink-0 group cursor-pointer transition-transform hover:scale-105 active:scale-95">
            <Activity className="w-4 h-4 md:w-5 md:h-5 text-black" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] md:text-[10px] font-mono text-[#8E9299] uppercase tracking-[0.2em] leading-none mb-1">
              SONIC AI <span className="text-white/40">v1.1</span>
            </div>
            <div className="text-sm md:text-base font-bold tracking-tight text-white truncate flex items-center gap-2">
              {mounted ? (profileName || 'Untitled Session') : 'Loading...'}
              
              {mounted && isAICalibrated && (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/5"
                >
                  <Sparkles className="w-2.5 h-2.5 text-[#F27D26]" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F27D26]">
                    AI Tuned
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Action Zone */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <div className="hidden lg:flex items-center gap-1 pr-2 border-r border-white/10">
            <IconBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </IconBtn>
            <IconBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="w-4 h-4" />
            </IconBtn>
          </div>

          <div className="flex items-center gap-1">
            <IconBtn onClick={onShowProfilePanel} title="Profile Library" badge={savedProfilesCount > 0}>
              <FolderOpen className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              onClick={onShowSaveDialog}
              title="Save profile (Ctrl+S)"
              hideOnMobile
            >
              <Save className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              onClick={onShowExportDialog}
              title="Export EQ (Ctrl+E)"
            >
              <Download className="w-4 h-4" />
            </IconBtn>
          </div>

          <Divider />

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={onAICalibrate}
              className="px-3 md:px-5 py-1.5 md:py-2 bg-[#F27D26] hover:bg-[#FF6F3C] text-black rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 md:gap-2 shadow-[0_4px_15px_rgba(242,125,38,0.4)] active:scale-95 border border-white/20"
              title="Pick 1-3 tracks for the AI test, then start"
            >
              <Sparkles className="w-3.5 h-3.5 fill-black" />
              <span>AI Calibrate</span>
            </button>
            
            <button
              onClick={onHearingTest}
              className="inline-flex px-2 md:px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-[10px] font-mono uppercase tracking-widest border border-blue-500/20 transition-all items-center gap-2 active:scale-95"
              title="Start Hearing Sensitivity Test"
            >
              <Ear className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[9px]">Sensitivity</span>
            </button>
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-white/10 ml-1">
            <IconBtn
              onClick={() => setShowAnalysisSidebar(!showAnalysisSidebar)}
              title={showAnalysisSidebar ? "Hide Analysis" : "Show Analysis"}
              className={`${showAnalysisSidebar ? 'bg-[#F27D26]/20 text-[#F27D26]' : ''}`}
            >
              <LayoutDashboard className="w-4 h-4" />
            </IconBtn>
            {hasMetrics && (
              <IconBtn
                onClick={() => setShowStatus(!showStatus)}
                title={showStatus ? "Collapse Stats" : "Expand Stats"}
                className={`sm:hidden ${showStatus ? 'text-[#F27D26]' : ''}`}
              >
                {showStatus ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </IconBtn>
            )}
          </div>
        </div>
      </header>

      {/* Status Zone */}
      <AnimatePresence>
        {hasMetrics && showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sonic-glass-dark rounded-xl px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 border border-white/5 shadow-inner shadow-white/5"
          >
            {calibrationConfidence > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[#F27D26]" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      AI Confidence
                    </span>
                    <span className="text-[11px] font-black text-[#F27D26] ml-auto">
                      {Math.round(calibrationConfidence * 100)}%
                    </span>
                  </div>
                  <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${calibrationConfidence * 100}%` }}
                      className="h-full bg-gradient-to-r from-[#F27D26] to-[#FF4444]"
                    />
                  </div>
                </div>
              </div>
            )}

            {interactionCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Target className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      Environment Stability
                    </span>
                    <span className={`text-[11px] font-black ml-auto ${
                      stability < 0.4 ? 'text-red-400' : 
                      stability < 0.7 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {Math.round(stability * 100)}%
                    </span>
                    <InfoTooltip 
                      side="bottom" 
                      align="center" 
                      content={
                        stability < 0.4 ? 'Cần thêm dữ liệu nghe thực tế để cá nhân hoá chuyên sâu.' :
                        stability < 0.7 ? 'AI đang bắt đầu hiểu EQ lý tưởng của bạn.' :
                        'Profile đã đạt độ ổn định cao dựa trên thói quen nghe của bạn.'
                      } 
                    />
                  </div>
                  <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stability * 100}%` }}
                      className={`h-full ${
                        stability < 0.4 ? 'bg-red-500' : 
                        stability < 0.7 ? 'bg-yellow-500' : 'bg-green-400'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {isHearingCompActive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Ear className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">
                  Perceptual Compensation Active
                </span>
              </div>
            )}
            
            <div className="ml-auto hidden sm:flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Engine Live</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

