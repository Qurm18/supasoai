import { PredictedGenre } from './genre-classifier';
import { MoodEnergyState } from './mood-energy';
import genreProfiles from './genre-eq-profiles.json';
import { logger } from '@/lib/logger';

interface GenreProfile {
  description: string;
  eqCurve: number[];
  q: number[];
}

const PROFILES = genreProfiles as Record<string, GenreProfile>;

/**
 * DynamicEQEngine sử dụng các phép toán Vector và Mapping hàm số 
 * để biến đổi các đặc trưng âm nhạc thành tham số EQ vật lý.
 */
export class DynamicEQEngine {
  
  /**
   * Tính toán EQ Curve thích nghi (Adaptive EQ Curve)
   * Công thức: G_final = G_base + (Energy_mod * V_mask) + (Valence_mod * Brightness_mask)
   */
  public calculateOptimalEQ(
    genre: PredictedGenre,
    mood: MoodEnergyState
  ): { gains: number[]; qs: number[] } {
    const baseProfile = PROFILES[genre] || PROFILES['Ambient/Experimental'];
    const numBands = 10;
    
    // 1. Phân tách đặc trưng chi tiết
    // energy: [0, 1], valence: [-1, 1], bpm: [60, 200]
    const { energy, valence, bpm } = mood;
    
    // 2. Định nghĩa các "Smart Shaping Masks"
    // V-Shape truyền thống cho sự phấn khích
    const vShapeMask = [2.0, 1.2, 0.2, -0.6, -1.2, -0.8, 0, 1.0, 1.8, 2.4]; 
    
    // Brightness mask để tăng độ chi tiết (Valence cao)
    const detailMask = [-1.5, -1.0, -0.5, 0, 0, 0.8, 1.5, 2.2, 2.8, 3.5];
    
    // Vocal Presence Mask: Tập trung vào 500Hz - 4kHz
    const vocalMask = [-0.5, -0.5, 0.5, 1.5, 2.0, 1.5, 0.5, 0, 0, 0];
    
    // Low-end Clutter Suppression: Giảm 250Hz khi energy quá cao để tránh đục (muddy)
    const deMudMask = [0, 0, -1.0, -2.5, -1.5, 0, 0, 0, 0, 0];

    // 3. Tính toán Weighting Vectors (Hệ số điều phối thông minh)
    
    // Impact: Độ mạnh của Dynamic EQ dựa trên Energy (Intensity)
    const impactScale = Math.pow(energy, 1.5); // Tăng phi tuyến tính để cảm giác mạnh mẽ hơn
    
    // Tính toán impact cho từng mask
    const vImpact = (energy - 0.4) * 5.0 * impactScale; // Energy trên 0.4 mới bắt đầu đẩy V-shape
    const dImpact = valence * 4.0; // Valence âm sẽ làm EQ tối đi (warm), dương sẽ làm sáng (bright)
    
    // Vocal focus: Nếu là Jazz/Pop/Rock và energy thấp, boost vocal để nghe rõ lời
    const vocalGenres: PredictedGenre[] = ['Pop', 'Jazz', 'Rock', 'R&B/Soul'];
    const vPosImpact = vocalGenres.includes(genre) ? (1.0 - energy) * 2.5 : 0;
    
    // De-mud: Khi energy cao (Bass/EDM), tự động kích hoạt lọc clutter
    const mudImpact = energy > 0.7 ? (energy - 0.7) * 6.0 : 0;

    // 4. Tổng hợp Gain (Hybrid Vector Mixing)
    const finalGains = baseProfile.eqCurve.map((baseGain, i) => {
      const dynamic = (vShapeMask[i] * vImpact) + 
                      (detailMask[i] * dImpact) + 
                      (vocalMask[i] * vPosImpact) +
                      (deMudMask[i] * mudImpact);
                    
      // Áp dụng Soft Clipping cho Dynamic Gain để không nhảy quá gắt
      const total = baseGain + dynamic;
      return Math.max(-15, Math.min(15, total));
    });

    // 5. Tempo-Adaptive Q (Nâng cấp)
    // Tempo càng nhanh, EQ bands càng hẹp (Q cao) để tránh phase smearing
    const tempoRatio = bpm / 120;
    const finalQs = baseProfile.q.map(baseQ => {
      // Nhạc nhanh (EDM/Metal): Q tăng -> Punchy
      // Nhạc chậm (Ambient/Jazz): Q giảm -> Smooth
      const qMod = 0.8 + (tempoRatio - 1.0) * 0.5;
      return Math.max(0.4, Math.min(5.0, baseQ * qMod));
    });

    logger.debug(`[ML-EQ] Upgraded Engine: Genre=${genre}, Energy=${energy.toFixed(2)}, MudImpact=${mudImpact.toFixed(2)}, BPM=${bpm}`);

    return {
      gains: finalGains,
      qs: finalQs
    };
  }
}

export const dynamicEQEngine = new DynamicEQEngine();
