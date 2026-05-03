'use client'

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Upload, X, FolderOpen, Download, Trash2, Sparkles, ChevronRight } from 'lucide-react'
import { SavedProfile } from '@/lib/profile-store'
import { EQBand } from '@/lib/audio-engine'

interface ProfileLibraryModalProps {
  show: boolean
  onClose: () => void
  savedProfiles: SavedProfile[]
  handleDeleteProfile: (id: string) => void
  handleLoadProfile: (p: SavedProfile) => void
  exportProfileAsAPO: (p: SavedProfile) => void
  importFileRef: React.RefObject<HTMLInputElement | null>
  importError: string | null
}

// Helper: relative date
function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// Component: Mini EQ Sparkline
interface SparklineProps {
  bands: EQBand[];
  color: string;
  className?: string;
}

function MiniEQSparkline({ bands, color, className }: SparklineProps) {
  const W = 240, H = 32, MID = H / 2;
  // If bands are empty, show a straight line
  const points = bands.length > 0 
    ? bands.map((b, i) => {
        const x = (i / (bands.length - 1)) * W;
        const y = MID - (b.gain / 15) * MID; // normalize to SVG coords, clamp visuals a bit
        return `${x},${y}`;
      }).join(' ')
    : `0,${MID} ${W},${MID}`;
  
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full h-8 ${className}`} preserveAspectRatio="none">
      {/* Zero line */}
      <line x1="0" y1={MID} x2={W} y2={MID} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 4" />
      {/* Area fill */}
      <polyline points={`0,${MID} ${points} ${W},${MID}`} fill={color} fillOpacity="0.08" />
      {/* EQ curve */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

// Component: Profile Card
interface ProfileCardProps {
  profile: SavedProfile;
  onLoad: () => void;
  onDelete: () => void;
  onExport: () => void;
}

function ProfileCard({ profile, onLoad, onDelete, onExport }: ProfileCardProps) {
  const accentColor = profile.color || '#F27D26';
  
  return (
    <motion.div
      layout
      className="relative group p-4 rounded-2xl border border-white/5 transition-all cursor-pointer overflow-hidden sonic-glass-dark"
      style={{
        background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
      }}
      whileHover={{ y: -2, scale: 1.01, borderColor: `${accentColor}40`, backgroundColor: 'rgba(255,255,255,0.02)' }}
      onClick={onLoad}
    >
      {/* Color accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full shadow-[0_0_8px_rgba(242,125,38,0.3)]"
        style={{ background: accentColor }}
      />
      
      <div className="pl-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white tracking-tight truncate group-hover:text-[#F27D26] transition-colors">
              {profile.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded">
                {profile.genre ?? profile.source}
              </span>
              <span className="text-white/10">|</span>
              <span className="text-[10px] font-mono text-white/30">
                {formatRelativeDate(profile.createdAt)}
              </span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 bg-black/20 p-1 rounded-xl border border-white/5">
            <button 
              onClick={(e) => { e.stopPropagation(); onExport(); }}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              title="Export APO"
              aria-label="Export APO"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
              title="Delete"
              aria-label="Delete Profile"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Mini EQ Sparkline */}
        <div className="mt-3 relative">
           <MiniEQSparkline bands={profile.bands} color={accentColor} />
           <div className="absolute right-0 bottom-0 top-0 w-8 bg-gradient-to-l from-[#0f1013]/0 to-transparent flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4 text-white/20" />
           </div>
        </div>
      </div>
    </motion.div>
  );
}

export const ProfileLibraryModal: React.FC<ProfileLibraryModalProps> = ({
  show,
  onClose,
  savedProfiles,
  handleDeleteProfile,
  handleLoadProfile,
  exportProfileAsAPO,
  importFileRef,
  importError,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 32, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f1013] border border-white/10 rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="pt-8 px-8 pb-4 flex items-center justify-between border-b border-white/5">
              <div>
                <h2 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-[#F27D26]" />
                  Profile Library
                </h2>
                <div className="flex items-center gap-2 mt-1">
                   <div className="px-2 py-0.5 bg-white/5 rounded-full">
                      <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-[0.2em]">
                        {savedProfiles.length} Profiles
                      </span>
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { onClose(); importFileRef.current?.click(); }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-mono uppercase tracking-widest text-white transition-all flex items-center gap-2 border border-white/5 active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-[#F27D26]" /> Import
                </button>
                <button onClick={onClose} className="p-2 bg-white/5 hover:bg-red-500/10 text-[#8E9299] hover:text-red-400 rounded-xl transition-all border border-white/5 active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Error Message */}
            {importError && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-8 mt-4"
              >
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] text-red-400 font-mono flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  {importError}
                </div>
              </motion.div>
            )}

            {/* Profiles Content */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
              {savedProfiles.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-[#F27D26] blur-3xl opacity-10 animate-pulse" />
                    <FolderOpen className="w-16 h-16 text-white/5 relative z-10" />
                  </div>
                  <h3 className="text-white font-bold text-lg">No profiles found</h3>
                  <p className="text-[#8E9299] text-sm mt-1 max-w-[240px] mx-auto">
                    Your sonic signatures will appear here. Start by calibrating your audio.
                  </p>
                  
                  <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                    <button 
                      onClick={() => { onClose(); importFileRef.current?.click(); }}
                      className="px-6 py-3 bg-[#F27D26] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_8px_30px_rgba(242,125,38,0.3)]"
                    >
                      Import .txt / .json
                    </button>
                    <button 
                      onClick={onClose}
                      className="px-6 py-3 bg-white/5 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all hover:bg-white/10"
                    >
                      Browse Studio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {savedProfiles.map((p) => (
                    <ProfileCard 
                      key={p.id}
                      profile={p}
                      onLoad={() => handleLoadProfile(p)}
                      onDelete={() => handleDeleteProfile(p.id)}
                      onExport={() => exportProfileAsAPO(p)}
                    />
                  ))}
                </div>
              )}
            </div>
            
            {/* Minimal persistent tip */}
            {savedProfiles.length > 0 && (
              <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-center">
                <p className="text-[9px] font-mono text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Select a profile to apply it instantly
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

