import { useState, useMemo, useCallback } from 'react';

export interface Track {
  id: string;
  name: string;
  artist?: string;
  genre: string;
  url: string;
  duration?: string;
}

import { UseTrackLibraryReturn } from '@/lib/types';

export function useTrackLibrary(
  defaultTracks: Track[],
  audioSource: string,
  handleTrackChange: (url: string, name: string) => void
): UseTrackLibraryReturn {
  const [customTracks, setCustomTracks] = useState<Track[]>([]);
  const [showTrackLibrary, setShowTrackLibrary] = useState(false);
  const [genreFilter, setGenreFilter] = useState('All');
  const [trackSearch, setTrackSearch] = useState('');

  const allTracks = useMemo(() => [...defaultTracks, ...customTracks], [defaultTracks, customTracks]);

  const getCurrentTrackIndex = useCallback((source: string): number => {
    if (!source || allTracks.length === 0) return -1;
    
    // Tìm track by URL
    let index = allTracks.findIndex((t: Track) => t.url === source);
    if (index !== -1) {
      console.log(`[Library] Found track at index: ${index}`);
      return index;
    }
    
    // Fallback nếu URL invalid
    console.warn(`[Library] Track not found for ${source}, fallback to 0`);
    return 0;
  }, [allTracks]);

  const handleNextTrack = useCallback(() => {
    if (allTracks.length === 0) {
      console.warn('[Library] No tracks available');
      return;
    }
    
    let currentIndex = getCurrentTrackIndex(audioSource);
    if (currentIndex === -1) currentIndex = 0;
    
    const nextIndex = (currentIndex + 1) % allTracks.length;
    const nextTrack = allTracks[nextIndex];
    
    console.log(`[Library] Next: ${currentIndex} -> ${nextIndex} (${nextTrack.name})`);
    handleTrackChange(nextTrack.url, nextTrack.name);
  }, [audioSource, allTracks, handleTrackChange, getCurrentTrackIndex]);

  const handlePrevTrack = useCallback(() => {
    if (allTracks.length === 0) {
      console.warn('[Library] No tracks available');
      return;
    }
    
    let currentIndex = getCurrentTrackIndex(audioSource);
    if (currentIndex === -1) currentIndex = 0;
    
    const prevIndex = (currentIndex - 1 + allTracks.length) % allTracks.length;
    const prevTrack = allTracks[prevIndex];
    
    console.log(`[Library] Prev: ${currentIndex} -> ${prevIndex} (${prevTrack.name})`);
    handleTrackChange(prevTrack.url, prevTrack.name);
  }, [audioSource, allTracks, handleTrackChange, getCurrentTrackIndex]);

  const allGenres = useMemo(() => ['All', ...Array.from(new Set(allTracks.map((t) => t.genre)))], [allTracks]);

  const handleFolderImport = useCallback(() => {
    // This will be handled by the ref in the component
    // but we can provide a trigger here if needed, 
    // though the component usually calls folderInput.current.click()
  }, []);

  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: Track[] = [];
    const folderName = files[0].webkitRelativePath.split('/')[0] || 'Imported Album';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.ogg')) {
        newTracks.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name.replace(/\.[^/.]+$/, ""),
          genre: folderName,
          url: URL.createObjectURL(file)
        });
      }
    }

    if (newTracks.length > 0) {
      setCustomTracks(prev => [...prev, ...newTracks]);
      handleTrackChange(newTracks[0].url, newTracks[0].name);
    }
  }, [handleTrackChange]);

  return {
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
    allGenres,
    handleFolderImport,
    handleFolderInputChange
  };
}
