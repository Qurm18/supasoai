export interface SoundPersonality {
  id: string;
  label: string;
  description: string;
  color: string;
}

export const SOUND_PERSONALITIES: SoundPersonality[] = [
  { 
    id: 'studio_ref',   
    label: 'Studio Reference',  
    description: 'You prefer natural reproduction with a focus on accuracy and transparency.',
    color: '#3b82f6' 
  },
  { 
    id: 'warm_analog',  
    label: 'Warm & Analog',     
    description: 'You enjoy rounded lows and a smooth, forgiving high-end that reduces fatigue.',
    color: '#f59e0b' 
  },
  { 
    id: 'v_shaped',     
    label: 'V-Shaped Energy',   
    description: 'Exciting and aggressive, with emphasized bass and crystalline highs.',
    color: '#ef4444' 
  },
  { 
    id: 'vocal_focus',  
    label: 'Vocal Forward',     
    description: 'Intimate and detailed, bringing voices and lead instruments to the front.',
    color: '#8b5cf6' 
  },
  { 
    id: 'bass_head',    
    label: 'Bass Enthusiast',   
    description: 'Deep, physical impact with a focus on sub-bass pressure and power.',
    color: '#10b981' 
  },
];

export function getProfileDNA(gains: number[]) {
  // bands: [20, 60, 125, 250, 500, 1k, 2k, 4k, 8k, 16k]
  const subBassVal = (gains[0] + gains[1]) / 2;
  const bassVal = (gains[1] + gains[2]) / 2;
  const midsVal = (gains[3] + gains[4] + gains[5]) / 3;
  const presenceVal = (gains[6] + gains[7]) / 2;
  const airVal = (gains[8] + gains[9]) / 2;

  // Normalize -12..12 -> 0..100
  return {
    subBass: Math.min(100, Math.max(0, (subBassVal + 12) * 4.16)),
    bass: Math.min(100, Math.max(0, (bassVal + 12) * 4.16)),
    vocalPresence: Math.min(100, Math.max(0, (presenceVal + 12) * 4.16)),
    trebleDetail: Math.min(100, Math.max(0, (airVal + 12) * 4.16)),
    warmth: Math.min(100, Math.max(0, (midsVal + 12) * 4.16)),
  };
}

export function classifyProfile(gains: number[]): SoundPersonality {
  const [sub, bass, , , , , presence, , air] = gains;

  if (sub > 3 && bass > 2) return SOUND_PERSONALITIES.find(p => p.id === 'bass_head')!;
  if (presence > 3 && bass < 2) return SOUND_PERSONALITIES.find(p => p.id === 'vocal_focus')!;
  if (bass > 2 && air > 2) return SOUND_PERSONALITIES.find(p => p.id === 'v_shaped')!;
  if (bass > 2 && presence < 0) return SOUND_PERSONALITIES.find(p => p.id === 'warm_analog')!;
  
  return SOUND_PERSONALITIES.find(p => p.id === 'studio_ref')!;
}
