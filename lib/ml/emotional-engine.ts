export class ContrastEngine {
  private alpha: number;        // hệ số EMA cho ngữ cảnh
  private K: number;            // cường độ tương phản (dB)
  private ctx: number | null;   // giá trị ngữ cảnh trung bình

  constructor(alpha = 0.1, K_db = 2.0) {
    this.alpha = alpha;
    this.K = K_db;
    this.ctx = null;
  }

  /** Gọi mỗi khi có centroid mới (từ FFT) */
  process(centroidHz: number): { lowGain_db: number; highGain_db: number } {
    if (this.ctx === null) {
      this.ctx = centroidHz;
      return { lowGain_db: 0, highGain_db: 0 };
    }

    // Cập nhật ngữ cảnh (trung bình động)
    this.ctx = this.alpha * centroidHz + (1 - this.alpha) * this.ctx;

    // Độ lệch tương đối
    let delta = (centroidHz - this.ctx) / (this.ctx + 1e-6);
    // Giới hạn trong [-2, 2] để tránh tanh bão hòa quá sớm
    delta = Math.min(2, Math.max(-2, delta));

    // Hàm chuyển đổi: dùng tanh để có độ bão hòa tự nhiên
    const factor = Math.tanh(delta * 2.0);  // từ -1 đến 1

    const lowGain = -this.K * factor;
    const highGain = +this.K * factor;

    return { lowGain_db: lowGain, highGain_db: highGain };
  }

  /** Điều chỉnh cường độ cảm xúc (gọi từ UI khi A/B test) */
  setStrength(K_db: number) {
    this.K = K_db;
  }
}

export class MacroEnvelope {
  private beta: number;          // hệ số làm mượt (phụ thuộc time constant)
  private gainRange: number;     // biên độ dao động gain (dB)
  private envSmooth: number | null;
  private minEnv: number | null;
  private maxEnv: number | null;
  private readonly decay = 0.999; // tốc độ quên min/max

  // Sử dụng dt (delta time) theo chu kỳ loop (0.25s) thay vì hopSize để phù hợp vs setInterval
  constructor(tauSeconds = 0.2, gainRange_db = 1.5, dt = 0.25) {
    this.beta = 1 - Math.exp(-dt / tauSeconds);
    this.gainRange = gainRange_db;
    this.envSmooth = null;
    this.minEnv = null;
    this.maxEnv = null;
  }

  /** Gọi mỗi định kỳ, với rms là giá trị RMS hiện tại (0..1) */
  process(rms: number): number {
    // Bước 1: làm mượt envelope
    if (this.envSmooth === null) {
      this.envSmooth = rms;
    } else {
      this.envSmooth = (1 - this.beta) * this.envSmooth + this.beta * rms;
    }

    // Bước 2: cập nhật min/max (running percentile đơn giản)
    if (this.minEnv === null || this.envSmooth < this.minEnv) {
      this.minEnv = this.envSmooth;
    } else {
      this.minEnv = this.decay * this.minEnv + (1 - this.decay) * this.envSmooth;
    }

    if (this.maxEnv === null || this.envSmooth > this.maxEnv) {
      this.maxEnv = this.envSmooth;
    } else {
      this.maxEnv = this.decay * this.maxEnv + (1 - this.decay) * this.envSmooth;
    }

    // Tránh chia zero
    const range = this.maxEnv - this.minEnv;
    let norm = 0.5;
    if (range > 1e-6) {
      norm = (this.envSmooth - this.minEnv) / range;
    }
    // Chuẩn hóa về [-1, 1] và nhân với gain range
    const gain = (2 * norm - 1) * this.gainRange;
    return gain; // dB
  }

  setGainRange(db: number) {
    this.gainRange = db;
  }

  /** Gọi khi chuyển bài hát để reset min/max */
  reset() {
    this.envSmooth = null;
    this.minEnv = null;
    this.maxEnv = null;
  }
}

export class InteractionMatrix {
  private cLM: number;  // hệ số low → mid
  private cHM: number;  // hệ số high → mid

  constructor(cLM = 0.15, cHM = 0.08) {
    this.cLM = cLM;
    this.cHM = cHM;
  }

  process(deltaLow_db: number, deltaHigh_db: number): number {
    const midCompensation = -this.cLM * deltaLow_db - this.cHM * deltaHigh_db;
    return Math.min(3, Math.max(-3, midCompensation));
  }

  setCoefficients(cLM: number, cHM: number) {
    this.cLM = cLM;
    this.cHM = cHM;
  }
}

/** 
 * Fletcher-Munson / ISO 226 Compensator (Loudness Contour)
 * Tự động boost Bass và Treble khi nghe ở mức âm lượng (RMS) nhỏ
 * để bù đắp sự suy giảm độ nhạy của tai người.
 */
export class FletcherMunsonCompensator {
  private baseRms: number = 0.1; // RMS tham chiếu (mức âm lượng bình thường)
  private maxBassBoost: number = 4.0; // dB
  private maxTrebleBoost: number = 2.5; // dB

  process(rms: number): { lowBoost: number, highBoost: number } {
    if (rms <= 0) return { lowBoost: this.maxBassBoost, highBoost: this.maxTrebleBoost };
    
    // Nếu âm lượng càng nhỏ hơn baseRms, boost càng nhiều
    // Dùng log scale cho tự nhiên
    const ratio = Math.max(0.01, rms) / this.baseRms;
    const dbDrop = -20 * Math.log10(ratio); // Bao nhiêu dB nhỏ hơn chuẩn
    
    if (dbDrop <= 0) return { lowBoost: 0, highBoost: 0 }; // Âm lượng to -> ko cần bù
    
    // Chuẩn hóa mức bù đắp
    const factor = Math.min(1.0, dbDrop / 24.0); // Bù đắp tối đa khi drop xuống -24dB
    
    return {
      lowBoost: this.maxBassBoost * factor,
      highBoost: this.maxTrebleBoost * factor
    };
  }
}

/**
 * Psychoacoustic Unmasker (Giải phóng phổ)
 * Khi năng lượng Bass (Low) quá cao và lấn lướt Mid, 
 * thuật toán tự động "ducking" (dìm) dải Low-Mid một chút để vocal và nhạc cụ rõ ràng hơn.
 */
export class PsychoacousticUnmasker {
  private threshold: number = 0.6; // Ngưỡng tỷ lệ Low/Mid

  process(lowEnergy: number, midEnergy: number): number {
    const ratio = lowEnergy / (midEnergy + 1e-6);
    if (ratio > this.threshold) {
      // Dìm Mid-Lows (ở đây trả về gain âm cho phần đầu Mid)
      const ducking = -1.5 * (ratio - this.threshold);
      return Math.max(-3.0, ducking); // Giới hạn dìm -3dB
    }
    return 0;
  }
}

export interface EmotionalGains {
  low_db: number;
  mid_db: number;
  high_db: number;
}

export class EmotionalController {
  private contrast: ContrastEngine;
  private macro: MacroEnvelope;
  private interaction: InteractionMatrix;
  private fletcher: FletcherMunsonCompensator;
  private unmasker: PsychoacousticUnmasker;

  constructor(
    contrastStrength = 2.0,
    macroRange = 1.5,
    cLM = 0.15,
    cHM = 0.08,
    tauMacro = 0.2,
    dt = 0.25
  ) {
    this.contrast = new ContrastEngine(0.1, contrastStrength);
    this.macro = new MacroEnvelope(tauMacro, macroRange, dt);
    this.interaction = new InteractionMatrix(cLM, cHM);
    this.fletcher = new FletcherMunsonCompensator();
    this.unmasker = new PsychoacousticUnmasker();
  }

  process(centroidHz: number, rms: number, lowEn = 0.5, midEn = 0.5): EmotionalGains {
    // 1. Contrast engine
    const { lowGain_db: contrastLow, highGain_db: contrastHigh } = this.contrast.process(centroidHz);

    // 2. Macro envelope
    const macroGain = this.macro.process(rms);

    // 3. Fletcher-Munson Loudness Compensation
    const fletcherGains = this.fletcher.process(rms);

    // 4. Psychoacoustic Unmasking
    const unmaskDucking = this.unmasker.process(lowEn, midEn);

    // Tổng emotional gain (kết hợp các thuật toán Nâng Cao)
    const rawLow = contrastLow + macroGain + fletcherGains.lowBoost;
    const rawHigh = contrastHigh + macroGain + fletcherGains.highBoost;

    // Interaction bù cho mid dựa trên contrast + unmasker ducting
    const midComp = this.interaction.process(rawLow - fletcherGains.lowBoost, rawHigh - fletcherGains.highBoost) + unmaskDucking;

    return {
      low_db: rawLow,
      mid_db: midComp,
      high_db: rawHigh,
    };
  }

  setContrastStrength(K: number) {
    this.contrast.setStrength(K);
  }

  setMacroRange(db: number) {
    this.macro.setGainRange(db);
  }

  setInteraction(cLM: number, cHM: number) {
    this.interaction.setCoefficients(cLM, cHM);
  }

  resetMacro() {
    this.macro.reset();
  }
}

export const emotionalController = new EmotionalController();
