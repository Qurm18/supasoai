/**
 * Sonic AI - High-Performance Audio Processing Core
 * Optimized for 32-bit Float Processing & Near-Zero Latency
 */

class SonicProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bassEnhance', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'ceiling', defaultValue: -0.3, minValue: -12, maxValue: 0 },
      { name: 'dither', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'width', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'crossFeed', defaultValue: 0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this._ditherErrorL = 0;
    this._ditherErrorR = 0;
    
    // Crossfeed buffers (Circular)
    this._cfL = new Float64Array(512).fill(0);
    this._cfR = new Float64Array(512).fill(0);
    this._cfIdx = 0;
    this._cfLpf1L = 0; this._cfLpf2L = 0;
    this._cfLpf1R = 0; this._cfLpf2R = 0;

    // Harmonic filter states
    this._hL_prevInput = 0;
    this._hR_prevInput = 0;
    this._hL_prevOutput = 0;
    this._hR_prevOutput = 0;

    // Metering
    this._lastMeterUpdate = 0;
    this._shortTermWindow = new Float32Array(30).fill(0);
    this._stIdx = 0;
    
    // Transients
    this._transientEnvL = 0;
    this._transientEnvR = 0;
  }

  _ditherShape(sample, isRight) {
    const noise = (Math.random() + Math.random() - 1) * (1 / 32768);
    const err = isRight ? this._ditherErrorR : this._ditherErrorL;
    const shaped = sample + noise - err * 0.5;
    const quantized = Math.round(shaped * 32768) / 32768;
    if (isRight) this._ditherErrorR = quantized - shaped;
    else this._ditherErrorL = quantized - shaped;
    return quantized;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || input[0].length === 0) return true;

    const channelCount = input.length;
    const sampleCount = input[0].length;
    
    const bassVal = parameters.bassEnhance[0];
    const ceilVal = parameters.ceiling[0];
    const widthVal = parameters.width[0];
    const cfVal = parameters.crossFeed[0];
    const ditherVal = parameters.dither[0];

    // Pre-calculations
    const linCeil = Math.exp(ceilVal * 0.11512925464970228);
    const x0 = linCeil * 0.85;
    const a_clip = Math.max(1e-4, linCeil - x0);
    
    const sr = sampleRate;
    const lpfCoeff = Math.exp(-2 * Math.PI * 700 / sr);
    
    const drive = 1.0 + bassVal * 0.4;
    const bAmt = bassVal * 0.35;
    const bHamt = bassVal * 0.12;

    const bufSize = 512;
    const bufMask = 511;
    const delaySamples = Math.max(1, Math.round(sr * 0.0004)) & bufMask;

    // Fast tanh approx
    const fastTanh = (x) => {
      if (x < -3) return -1;
      if (x > 3) return 1;
      const x2 = x * x;
      return x * (27 + x2) / (27 + 9 * x2);
    };

    const processTape = (x) => {
      const g = x * drive;
      const ax = Math.abs(g);
      if (ax < 0.6) return g;
      if (ax < 1.2) {
         const t = (ax - 0.6) / 0.6;
         return Math.sign(x) * (0.6 + 0.6 * (t - (t * t * t) / 3));
      }
      return Math.sign(x) * 1.0;
    };

    let localPeak = 0;
    
    // Cache states in locals
    let traEnvL = this._transientEnvL;
    let traEnvR = this._transientEnvR;
    let hL_in = this._hL_prevInput;
    let hR_in = this._hR_prevInput;
    let hL_out = this._hL_prevOutput;
    let hR_out = this._hR_prevOutput;
    let cfIdx = this._cfIdx;
    let cfLpf1L = this._cfLpf1L;
    let cfLpf2L = this._cfLpf2L;
    let cfLpf1R = this._cfLpf1R;
    let cfLpf2R = this._cfLpf2R;

    for (let i = 0; i < sampleCount; i++) {
      let L = input[0][i];
      let R = channelCount > 1 ? input[1][i] : L;

      // Sanity
      if (!Number.isFinite(L)) L = 0;
      if (!Number.isFinite(R)) R = 0;

      // 1. Stereo Width
      if (widthVal !== 1.0) {
        const M = (L + R) * 0.5;
        const S = (L - R) * 0.5 * widthVal;
        L = M + S; R = M - S;
      }

      // 2. Transient Detection & Softening
      const aL = Math.abs(L);
      traEnvL = aL > traEnvL ? 0.9 * traEnvL + 0.1 * aL : 0.999 * traEnvL;
      const isTrL = aL > traEnvL * 2.5 + 0.05;
      if (traEnvL > 0.8) L *= (1.0 - (traEnvL - 0.8) * 0.2);

      const aR = Math.abs(R);
      traEnvR = aR > traEnvR ? 0.9 * traEnvR + 0.1 * aR : 0.999 * traEnvR;
      const isTrR = aR > traEnvR * 2.5 + 0.05;
      if (traEnvR > 0.8) R *= (1.0 - (traEnvR - 0.8) * 0.2);

      // 3. Headphone Crossfeed
      if (cfVal > 0) {
        this._cfL[cfIdx & bufMask] = L; 
        this._cfR[cfIdx & bufMask] = R;
        const lOld = this._cfL[(cfIdx - delaySamples + bufSize) & bufMask];
        const rOld = this._cfR[(cfIdx - delaySamples + bufSize) & bufMask];
        cfIdx = (cfIdx + 1) & bufMask;
        
        const cf = cfVal * 0.3;
        cfLpf1L = lpfCoeff * cfLpf1L + (1 - lpfCoeff) * rOld;
        cfLpf2L = lpfCoeff * cfLpf2L + (1 - lpfCoeff) * cfLpf1L;
        cfLpf1R = lpfCoeff * cfLpf1R + (1 - lpfCoeff) * lOld;
        cfLpf2R = lpfCoeff * cfLpf2R + (1 - lpfCoeff) * cfLpf1R;
        
        L += cfLpf2L * cf * 0.15; R += cfLpf2R * cf * 0.15;
      }

      // 4. Robust Saturation
      if (bassVal > 0) {
        const lSat = isTrL ? L : processTape(L);
        const rSat = isTrR ? R : processTape(R);
        L = L * (1 - bAmt) + lSat * bAmt;
        R = R * (1 - bAmt) + rSat * bAmt;
        
        // Stability Guard for HPF (Remove DC)
        hL_out = 0.995 * hL_out + (L - hL_in);
        hR_out = 0.995 * hR_out + (R - hR_in);
        hL_in = L; hR_in = R;
        L += hL_out * bHamt; R += hR_out * bHamt;
      }

      // 5. Robust Soft Clipper
      const absL = Math.abs(L);
      if (absL > x0) {
        L = Math.sign(L) * (x0 + (linCeil - x0) * fastTanh((absL - x0) / (a_clip + 1e-6)));
      }
      const absR = Math.abs(R);
      if (absR > x0) {
        R = Math.sign(R) * (x0 + (linCeil - x0) * fastTanh((absR - x0) / (a_clip + 1e-6)));
      }

      // Final bounds & NaN check
      if (L > 2.0) L = 2.0; else if (L < -2.0) L = -2.0;
      if (R > 2.0) R = 2.0; else if (R < -2.0) R = -2.0;
      if (!Number.isFinite(L)) L = 0;
      if (!Number.isFinite(R)) R = 0;

      const m = Math.max(Math.abs(L), Math.abs(R));
      if (m > localPeak) localPeak = m;

      // 6. Dither
      if (ditherVal > 0) {
        L = this._ditherShape(L, false) * ditherVal + L * (1 - ditherVal);
        R = this._ditherShape(R, true) * ditherVal + R * (1 - ditherVal);
      }

      output[0][i] = L;
      if (channelCount > 1) output[1][i] = R;
    }

    // Sync back states
    this._transientEnvL = traEnvL; this._transientEnvR = traEnvR;
    this._hL_prevInput = hL_in; this._hR_prevInput = hR_in;
    this._hL_prevOutput = hL_out; this._hR_prevOutput = hR_out;
    this._cfIdx = cfIdx;
    this._cfLpf1L = cfLpf1L; this._cfLpf2L = cfLpf2L;
    this._cfLpf1R = cfLpf1R; this._cfLpf2R = cfLpf2R;

    // Metering
    const now = currentFrame / sr;
    if (now - this._lastMeterUpdate > 0.08) {
      this.port.postMessage({
        type: 'metering',
        momentary: 20 * Math.log10(Math.max(1e-6, localPeak)),
        shortTerm: 0, // Simplified for performance
        peak: 20 * Math.log10(Math.max(1e-6, localPeak)),
        psr: 0
      });
      this._lastMeterUpdate = now;
    }

    return true;
  }
}

registerProcessor('sonic-processor', SonicProcessor);
