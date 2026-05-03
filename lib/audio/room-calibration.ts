import { RoomProperties, Position3D } from './room-acoustics';
import { logger } from '@/lib/logger';

export type RoomType = 'bedroom' | 'studio' | 'living-room' | 'outdoor' | 'custom';

export interface RoomPreset {
  name: string;
  dimensions: { l: number; w: number; h: number };
  absorption: number;
}

export const ROOM_PRESETS: Record<Exclude<RoomType, 'custom'>, RoomPreset> = {
  'bedroom': {
    name: 'Small Bedroom',
    dimensions: { l: 3, w: 4, h: 2.5 },
    absorption: 0.35 // Higher absorption due to bed, carpet, curtains
  },
  'studio': {
    name: 'Recording Studio',
    dimensions: { l: 4, w: 5, h: 3 },
    absorption: 0.6 // High absorption (foam, traps)
  },
  'living-room': {
    name: 'Living Room',
    dimensions: { l: 5, w: 6, h: 2.8 },
    absorption: 0.2 // Mixed (drywall, some furniture)
  },
  'outdoor': {
    name: 'Outdoor',
    dimensions: { l: 50, w: 50, h: 50 },
    absorption: 0.95 // Minimal reflections
  }
};

export interface CalibrationResult {
  properties: RoomProperties;
  sourcePos: Position3D;
  micPos: Position3D;
  suggestedEqGains: number[]; // 10-band compensation
}

export class RoomCalibrationEngine {
  /**
   * Generates a suggested EQ curve to compensate for room characteristics.
   * Logic: 
   * - Inverse of absorption: If room is too "dead" (high absorption), boost highs.
   * - Room Modes: Compensate for standing wave resonances based on dimensions (simplified).
   */
  public getSuggestedCompensation(room: RoomProperties): number[] {
    const baseGains = new Array(10).fill(0);
    
    // 1. Absorption Compensation
    // Low absorption (reflective) room -> cut highs to reduce harshness
    // High absorption (dead) room -> boost highs for clarity
    const trebleDiff = (room.absorption - 0.25) * 10; // Normalized around 0.25
    
    // Apply gradually across 10 bands (last 4 bands are high freq)
    baseGains[6] += trebleDiff * 0.4;
    baseGains[7] += trebleDiff * 0.7;
    baseGains[8] += trebleDiff * 1.0;
    baseGains[9] += trebleDiff * 1.2;

    // 2. Room Mode Compensation (Simplified)
    // Small rooms often have build-up in Low-Mids (200-500Hz)
    const volume = room.length * room.width * room.height;
    if (volume < 40) {
      baseGains[2] -= 2.0; // Cut 250Hz
      baseGains[3] -= 1.5; // Cut 500Hz
    }

    logger.debug(`[Calibration] Suggested gains for ${room.absorption} absorption:`, baseGains);
    
    return baseGains.map(g => Math.max(-12, Math.min(12, g)));
  }

  public getPreset(type: RoomType): RoomPreset | null {
    if (type === 'custom') return null;
    return ROOM_PRESETS[type];
  }
}

export const roomCalibrationEngine = new RoomCalibrationEngine();
