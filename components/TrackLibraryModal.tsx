'use client'

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Upload, X, FolderOpen, Sparkles, Search, Music } from 'lucide-react'
import { Track } from '@/hooks/useTrackLibrary'

interface TrackLibraryModalProps {
  show: boolean
  onClose: () => void
  selectionMode: boolean
  setSelectionMode: (mode: boolean) => void
  selectedTrackUrls: string[]
  setSelectedTrackUrls: (urls: string[]) => void
  allTracks: Track[]
  trackSearch: string
  setTrackSearch: (search: string) => void
  genreFilter: string
  setGenreFilter: (genre: string) => void
  allGenres: string[]
  handleFolderImport: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  audioSource: string
  currentTrackName: string
  currentTrackId?: string
  onTrackSelect: (track: Track) => void
  onConfirmCalibration?: () => void
  urlInput: string
  setUrlInput: (url: string) => void
  handleUrlSubmit: (e: React.FormEvent) => void
  isPlaying: boolean
}

export const TrackLibraryModal: React.FC<TrackLibraryModalProps> = ({
  show,
  onClose,
  selectionMode,
  setSelectionMode,
  selectedTrackUrls,
  setSelectedTrackUrls,
  allTracks,
  trackSearch,
  setTrackSearch,
  genreFilter,
  setGenreFilter,
  allGenres,
  handleFolderImport,
  fileInputRef,
  audioSource,
  currentTrackName,
  onTrackSelect,
  onConfirmCalibration,
  urlInput,
  setUrlInput,
  handleUrlSubmit,
  isPlaying,
}) => {
  const filteredTracks = allTracks.filter(t => 
    (genreFilter === 'All' || t.genre === genreFilter) &&
    (trackSearch === '' || 
      t.name.toLowerCase().includes(trackSearch.toLowerCase()) ||
      t.genre?.toLowerCase().includes(trackSearch.toLowerCase()))
  )

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f1013] border border-white/10 rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
          >
            {/* Sidebar (Filters & Actions) - Extremely compact */}
            <div className="w-full md:w-16 bg-[#07080a]/80 border-b md:border-b-0 md:border-r border-white/5 flex flex-col shrink-0 overflow-hidden">
              <div className="p-2 flex flex-col items-center gap-2">
                <button onClick={onClose} aria-label="Close" className="md:hidden self-end p-1.5 text-[#8E9299] hover:text-white bg-white/5 rounded-xl">
                  <X className="w-3.5 h-3.5" />
                </button>
                
                <div className="flex flex-row md:flex-col gap-2 w-full items-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Add Local Files"
                    aria-label="Add Local Files"
                    className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all flex items-center justify-center shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleFolderImport}
                    title="Import Folder"
                    aria-label="Import Folder"
                    className="w-9 h-9 bg-white/5 hover:bg-white/10 text-[#8E9299] hover:text-white rounded-lg transition-all flex items-center justify-center shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  
                  {!selectionMode ? (
                    <button
                      onClick={() => { setSelectionMode(true); setSelectedTrackUrls([audioSource]); }}
                      title="Calibration Mode"
                      aria-label="Calibration Mode"
                      className="w-9 h-9 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] rounded-lg border border-[#F27D26]/30 transition-all flex items-center justify-center shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSelectionMode(false); setSelectedTrackUrls([]); }}
                      title="Exit Selection"
                      aria-label="Exit Selection"
                      className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all flex items-center justify-center shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-1 py-2 hidden md:flex flex-col gap-1 items-center">
                <div className="w-4 h-px bg-white/5 mb-1" />
                {allGenres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenreFilter(g)}
                    title={g}
                    className={`w-9 h-7 rounded-md text-[8px] font-mono leading-tight transition-all flex items-center justify-center text-center overflow-hidden break-all px-0.5 ${
                      genreFilter === g 
                        ? 'bg-white/10 text-white border border-white/10' 
                        : 'text-[#8E9299] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {g.substring(0, 3).toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Mobile horizontal genres */}
              <div className="md:hidden overflow-x-auto px-5 py-3 flex gap-2 sonic-scroll border-b border-white/5">
                {allGenres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenreFilter(g)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap ${
                      genreFilter === g 
                        ? 'bg-[#F27D26] text-black font-bold' 
                        : 'bg-white/5 text-[#8E9299] border border-white/5'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area - Increased dominance */}
            <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#0f1013] to-[#0a0b0d]">
              {/* Compact Header */}
              <div className="px-4 py-2 border-b border-white/5 flex gap-2 items-center shrink-0">
                <button onClick={onClose} aria-label="Close" className="p-1.5 text-[#8E9299] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 relative min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8E9299]" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={(e) => setTrackSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-white/[0.02] border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-[11px] font-medium focus:border-[#F27D26]/50 outline-none text-white placeholder-white/30 transition-all"
                  />
                </div>
                <div className="text-[9px] font-mono text-[#F27D26]/60 uppercase tracking-tighter whitespace-nowrap">
                   {filteredTracks.length} tracks
                </div>
              </div>

              {/* Dominant Scroll Area - Fix Scrolling */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-2 overscroll-contain">
                
                {/* Custom URL Section - Micro */}
                <div className="bg-[#07080a]/30 border border-white/5 rounded-xl p-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { handleUrlSubmit(e); onClose(); } }}
                      placeholder="Remote URL..."
                      className="flex-1 min-w-0 bg-[#1a1b20] border border-white/5 rounded-lg px-2.5 py-1 text-[10px] font-medium focus:border-indigo-500/50 outline-none text-white placeholder-white/20 transition-all"
                    />
                    <button
                      onClick={(e) => { handleUrlSubmit(e); if (urlInput && !urlInput.includes('youtube') && !urlInput.includes('youtu.be')) onClose(); }}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-black uppercase transition-all"
                    >
                      Load
                    </button>
                  </div>
                </div>

                {/* Track List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredTracks.map((t) => {
                    const isSelected = selectedTrackUrls.includes(t.url);
                    const isCurrent = t.url === audioSource;
                    
                    return (
                      <button
                        key={t.url}
                        onClick={() => onTrackSelect(t)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                          isSelected 
                            ? 'bg-[#F27D26]/10 border-[#F27D26]/40' 
                            : isCurrent
                              ? 'bg-white/10 border-white/30'
                              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#F27D26] text-black' : 
                          isCurrent ? 'bg-white text-black' : 'bg-[#15161A] text-[#8E9299]'
                        }`}>
                          <Music className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{t.name}</div>
                          <div className="text-[9px] font-mono text-[#8E9299] uppercase truncate">{t.genre || '---'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectionMode && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="p-4 md:px-6 md:py-4 border-t border-white/5 bg-[#0a0b0d] shrink-0 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-[#F27D26]/20 flex items-center justify-center border border-[#F27D26]/30">
                        <span className="text-[#F27D26] font-bold text-xs">{selectedTrackUrls.length}</span>
                     </div>
                     <span className="text-xs font-medium text-white/80">
                        Tracks ready for calibration analysis
                     </span>
                  </div>
                  <button
                    disabled={selectedTrackUrls.length === 0}
                    onClick={() => onConfirmCalibration?.()}
                    className="px-8 py-3 bg-gradient-to-r from-[#F27D26] to-[#FF6F3C] hover:from-[#FF6F3C] hover:to-[#F27D26] disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_4px_25px_rgba(242,125,38,0.4)] hover:shadow-[0_4px_35px_rgba(242,125,38,0.6)] transform hover:-translate-y-1 active:translate-y-0 active:scale-95"
                  >
                    Start Analysis
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
