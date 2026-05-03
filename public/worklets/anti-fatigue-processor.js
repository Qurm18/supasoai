class BiquadFilter {
  constructor(type, freq, sr) {
    this.type = type;
    this.freq = freq;
    this.sr = sr;
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
    this.updateCoefficients(freq);
  }
  
  updateCoefficients(freq) {
    const w0 = 2 * Math.PI * freq / this.sr;
    const alpha = Math.sin(w0) / (2 * 0.707);
    const cosw0 = Math.cos(w0);
    
    let a0 = 1;
    if (this.type === 'lowpass') {
      const b0 = (1 - cosw0) / 2;
      const b1 = 1 - cosw0;
      const b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      const a1 = -2 * cosw0;
      const a2 = 1 - alpha;
      this.b0 = b0/a0; this.b1 = b1/a0; this.b2 = b2/a0;
      this.a1 = a1/a0; this.a2 = a2/a0;
    } else if (this.type === 'highpass') {
      const b0 = (1 + cosw0) / 2;
      const b1 = -(1 + cosw0);
      const b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      const a1 = -2 * cosw0;
      const a2 = 1 - alpha;
      this.b0 = b0/a0; this.b1 = b1/a0; this.b2 = b2/a0;
      this.a1 = a1/a0; this.a2 = a2/a0;
    }
  }

  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

class AntiFatigueProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.delayBuffer = [];
    this.maxDelay = 128; // Lookahead

    // Pre-allocated blocks for 3 bands (up to 2 channels initially, grows dynamically)
    this.lowBlocks = [];
    this.midBlocks = [];
    this.highBlocks = [];

    // Listener adaptation
    this.listenerFrames = 0; // tracking time
    
    // Loudness tracking
    this.lufsHist = [];
    this.maxLufsHist = 150; // reduced frames for faster reaction
    this.slowGain = 0;

    // envelope
    this.att = 0.012; // slightly slower
    this.rel = 0.06;
    this.env = []; // dynamic per channel
    
    this.filters = [];
    
    this.sr = globalThis.sampleRate || 44100;
  }

  getFilters(channel) {
    if (!this.filters[channel]) {
        this.filters[channel] = {
            lp: new BiquadFilter('lowpass', 240, this.sr),
            hp: new BiquadFilter('highpass', 3800, this.sr)
        };
    }
    return this.filters[channel];
  }

  getEnv(channel) {
    if (!this.env[channel]) {
        this.env[channel] = [0, 0, 0];
    }
    return this.env[channel];
  }

  getBlocks(channel, frames) {
    if (!this.lowBlocks[channel] || this.lowBlocks[channel].length !== frames) {
        this.lowBlocks[channel] = new Float32Array(frames);
        this.midBlocks[channel] = new Float32Array(frames);
        this.highBlocks[channel] = new Float32Array(frames);
    }
    return { 
        low: this.lowBlocks[channel], 
        mid: this.midBlocks[channel], 
        high: this.highBlocks[channel] 
    };
  }

  computeRMSdb(x) {
    if (!x || x.length === 0) return -100;
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
        const s = x[i];
        sum += s * s;
    }
    const rms = Math.sqrt(sum / x.length);
    return 20 * Math.log10(rms + 1e-8);
  }

  computePeakDb(x) {
    if (!x || x.length === 0) return -100;
    let peak = 0;
    for (let i = 0; i < x.length; i++) {
        const a = Math.abs(x[i]);
        if (a > peak) peak = a;
    }
    return 20 * Math.log10(peak + 1e-8);
  }

  isTransient(rms, peak) {
    return (peak - rms) > 10; // More conservative
  }

  dynamicEQ(freq, level) {
    let gain = 0;
    if (freq > 2000 && freq < 4500 && level > -22) gain -= 3.5; // Aggressive on harsh mids
    if (freq < 100 && level > -18) gain -= 2.5; // Controlled bass
    return gain;
  }

  maskingCorrection(low, mid, high) {
    let lowAdj = 0, highAdj = 0;
    // Basic psychoacoustic masking: if bass is too strong, it masks mids
    if (low > mid * 1.6) lowAdj -= 1.5;
    if (high > mid * 1.4) highAdj -= 1.0;
    return { lowAdj, highAdj };
  }

  computeGainDb(rms, th, ratio, knee = 6) {
    const d = rms - th;
    if (2 * d < -knee) return 0;
    if (Math.abs(2 * d) <= knee) {
      return (1 / ratio - 1) * (d + knee / 2) ** 2 / (2 * knee);
    }
    return d * (1 / ratio - 1);
  }

  envelopeProcess(target, attack, release, channel, bandIdx) {
    const env = this.getEnv(channel);
    const val = env[bandIdx];
    const coeff = target < val ? attack : release;
    env[bandIdx] = val + coeff * (target - val);
    return env[bandIdx];
  }

  earWeight(freq) {
    if (freq < 150) return 0.75;
    if (freq < 1500) return 1.0;
    if (freq < 4500) return 1.25;
    return 0.85;
  }

  targetLufs(dynamicRange) {
    if (dynamicRange > 22) return -18;
    if (dynamicRange < 8) return -12;
    return -14;
  }

  process(inputs, outputs, parameters) {
    try {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || input.length === 0 || input[0].length === 0) return true;
        const numChannels = input.length;
        const frames = input[0].length;
        
        const dbToLinear = (db) => {
            if (db > 40) db = 40;
            if (db < -100) return 0;
            return Math.pow(10, db / 20);
        };
        
        let totalRms = 0;
        let validChannels = 0;

        for (let c = 0; c < numChannels; c++) {
          const channel = input[c];
          const outChannel = output[c];
          if (!outChannel) continue;
          validChannels++;
          
          const filters = this.getFilters(c);
          const blocks = this.getBlocks(c, frames);
            
          if (!this.delayBuffer[c]) this.delayBuffer[c] = [];
          const dbuf = this.delayBuffer[c];
          dbuf.push(new Float32Array(channel));
          
          let delayed = channel;
          if (dbuf.length >= this.maxDelay) {
              delayed = dbuf.shift();
          }

          let peak = 0;
          for (let i=0; i<frames; i++) {
            const abs = Math.abs(channel[i]);
            if(abs > peak) peak = abs;
          }
          
          let limitGain = 1.0;
          if (peak > 0.98) limitGain = 0.98 / peak;

          // Multiband split (optimized loop)
          const { low, mid, high } = blocks;
          for(let i=0; i<frames; i++) {
              const s = channel[i];
              low[i] = filters.lp.process(s);
              high[i] = filters.hp.process(s);
              mid[i] = s - low[i] - high[i];
          }
          
          const bandBlocks = [low, mid, high];
          const bandFreqs = [100, 1000, 5000];
          const bandGains = [0, 0, 0];
          const bandThresholds = [-22, -26, -24];
          const bandRatios = [2.5, 4, 3];
          
          const rmsVals = [0, 0, 0];
          for(let b=0; b<3; b++) {
              const bRms = this.computeRMSdb(bandBlocks[b]);
              const bPeak = this.computePeakDb(bandBlocks[b]);
              rmsVals[b] = bRms;
              
              const transient = this.isTransient(bRms, bPeak);
              const eqGain = this.dynamicEQ(bandFreqs[b], bRms);
              let gain = this.computeGainDb(bRms, bandThresholds[b], bandRatios[b]);
              
              if (transient) gain -= 1.5; // attenuate sharp peaks
              
              gain *= this.earWeight(bandFreqs[b]);
              gain += eqGain;
              
              bandGains[b] = this.envelopeProcess(gain, this.att, this.rel, c, b);
          }
          
          const mAdj = this.maskingCorrection(dbToLinear(rmsVals[0]), dbToLinear(rmsVals[1]), dbToLinear(rmsVals[2]));
          bandGains[0] += mAdj.lowAdj;
          bandGains[2] += mAdj.highAdj;
          
          const rmsTotal = this.computeRMSdb(channel);
          totalRms += rmsTotal;
          
          const g0 = dbToLinear(bandGains[0]);
          const g1 = dbToLinear(bandGains[1]);
          const g2 = dbToLinear(bandGains[2]);

          for (let i = 0; i < frames; i++) {
             const sOut = low[i] * g0 + mid[i] * g1 + high[i] * g2;
             outChannel[i] = sOut * limitGain; 
          }
        }
        
        if (validChannels > 0) totalRms /= validChannels;
        
        this.lufsHist.push(totalRms);
        if (this.lufsHist.length > this.maxLufsHist) this.lufsHist.shift();
        
        let currentLufs = 0;
        if (this.lufsHist.length > 0) {
            for(let i=0; i<this.lufsHist.length; i++) {
                const val = this.lufsHist[i];
                if (!isNaN(val) && isFinite(val)) currentLufs += val;
            }
            currentLufs /= this.lufsHist.length;
        } else {
            currentLufs = -60;
        }
        if (isNaN(currentLufs) || !isFinite(currentLufs)) currentLufs = -60;

        const target = -14.5; // Consistent target
        const diff = target - currentLufs;
        const gainDrift = 0.004 * (diff - this.slowGain);
        this.slowGain += gainDrift;
        
        if (isNaN(this.slowGain) || !isFinite(this.slowGain)) this.slowGain = 0;
        if (this.slowGain > 12) this.slowGain = 12; // Cap makeup gain
        if (this.slowGain < -20) this.slowGain = -20;

        this.listenerFrames++;
        const t = (this.listenerFrames * frames) / this.sr;
        let fatigueF = 1.0;
        if (t > 1800) fatigueF = 0.88;
        else if (t > 600) fatigueF = 0.94;

        const linearSlowGain = dbToLinear(this.slowGain);
        const finalGain = linearSlowGain * fatigueF;
        
        for (let c = 0; c < numChannels; c++) {
            const outChannel = output[c];
            if (!outChannel) continue;
            for (let i = 0; i < frames; i++) {
                outChannel[i] *= finalGain;
                // Final safety clamp to prevent speaker-killing NaNs or Infinity
                if (isNaN(outChannel[i]) || !isFinite(outChannel[i])) {
                    outChannel[i] = 0;
                }
            }
        }
    } catch (err) {
        // Fallback: pass through input to output if logic fails
        const input = inputs[0];
        const output = outputs[0];
        if (input && output) {
            for (let c = 0; c < Math.min(input.length, output.length); c++) {
                if (output[c] && input[c]) output[c].set(input[c]);
            }
        }
    }

    return true;
  }
}

registerProcessor('anti-fatigue-processor', AntiFatigueProcessor);
