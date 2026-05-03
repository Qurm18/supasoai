// Reference: "State-Of-The-Art Perception Blueprint"

/**
 * UltimatePerceptionLayer (TypeScript / WebAudio implementation)
 * 
 * An advanced real-time psychoacoustic and neural-proxy audio perception engine.
 * Computes graphical maps for loudnes, masking, attention (transient, harmonic, surprise),
 * temporal curves, and emotion proxies directly from Web Audio spectral data.
 */

export class UltimatePerceptionLayer {
  private sampleRate: number = 44100;
  private fftSize: number = 2048; // hop size ~11ms at 44.1k
  private nBands: number = 32;
  
  // Analysers
  private analyser: AnalyserNode;
  private timeData: Float32Array;
  private freqData: Float32Array;
  
  // ERB Mapping
  private erbToFft: number[][] = []; // For each band, list of fft bins
  
  // History arrays (for temporal & masking models)
  private shortLoudness: Float32Array;
  private longLoudness: Float32Array;
  private historyLoudness: Float32Array[] = [];
  
  private prevFreqData: Float32Array;
  private peakFreqData: Float32Array; // For temporal masking

  // Pre-allocated buffers for result reuse (Zero Allocation Hot Path)
  private importanceMap: Float32Array;
  private specificLoudnessBuffer: Float32Array;
  private maskingMapBuffer: Float32Array;
  private attentionMapBuffer: Float32Array;
  private maskCurveBuffer: Float32Array;

  // Emotion / Attention Tracking
  private arousalProxy: number = 0;
  private valenceProxy: number = 0;
  private energyProxy: number = 0;
  private tensionProxy: number = 0;
  private prevCentroid: number = 0;

  constructor(context: AudioContext, sourceNode: AudioNode) {
    this.sampleRate = context.sampleRate;
    
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.2; // Want raw frames for transient
    sourceNode.connect(this.analyser);
    
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.freqData = new Float32Array(this.analyser.frequencyBinCount);
    this.prevFreqData = new Float32Array(this.analyser.frequencyBinCount);
    this.peakFreqData = new Float32Array(this.analyser.frequencyBinCount);

    this.shortLoudness = new Float32Array(this.nBands);
    this.longLoudness = new Float32Array(this.nBands);

    // Pre-allocate result buffers
    this.importanceMap = new Float32Array(this.nBands);
    this.specificLoudnessBuffer = new Float32Array(this.nBands);
    this.maskingMapBuffer = new Float32Array(this.nBands);
    this.attentionMapBuffer = new Float32Array(this.nBands);
    this.maskCurveBuffer = new Float32Array(this.nBands);

    for(let i = 0; i < 50; i++) { // ~1 sec history at ~20ms hop
      this.historyLoudness.push(new Float32Array(this.nBands));
    }

    this._initErbBands();
  }

  /**
   * Initialize Gammatone/ERB bands based on Moore-Glasberg formula.
   * Number of bands = 32. Range = 20Hz -> 20kHz
   */
  private _initErbBands() {
    this.erbToFft = [];
    const minFreq = 20;
    const maxFreq = 20000;
    
    // Cam=21.4*log10(4.37*f(kHz)+1)
    const freqToCam = (f: number) => 21.4 * Math.log10(4.37 * (f/1000) + 1);
    const camToFreq = (c: number) => 1000 * ((Math.pow(10, c / 21.4) - 1) / 4.37);
    
    const minCam = freqToCam(minFreq);
    const maxCam = freqToCam(maxFreq);
    const camStep = (maxCam - minCam) / this.nBands;
    
    for (let i = 0; i < this.nBands; i++) {
      const c = minCam + i * camStep;
      const fCenter = camToFreq(c);
      // Rough bandwidth
      const erb = 24.7 * (4.37 * (fCenter/1000) + 1); 
      const fMin = fCenter - erb/2;
      const fMax = fCenter + erb/2;
      
      const bins: number[] = [];
      const binResolution = this.sampleRate / this.fftSize;
      
      let startBin = Math.floor(fMin / binResolution);
      let endBin = Math.ceil(fMax / binResolution);
      if (startBin === endBin) endBin++; // Ensure at least 1 bin
      
      for(let b = startBin; b <= endBin; b++) {
        if(b >= 0 && b < this.freqData.length) {
          bins.push(b);
        }
      }
      this.erbToFft.push(bins);
    }
  }

  public getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  /**
   * 1. LOUDNESS PERCEPTION ENGINE (Moore-Glasberg inspired)
   * 1.2 Specific loudness per band
   */
  private getSpecificLoudness(): Float32Array {
    const binRes = this.sampleRate / this.fftSize;
    
    for (let i = 0; i < this.nBands; i++) {
        let eSig = 0;
        const bins = this.erbToFft[i];
        if (bins.length === 0) {
            this.specificLoudnessBuffer[i] = 0;
            continue;
        }
        
        for (const b of bins) {
            // Convert dB to linear energy proxy
            const db = this.freqData[b];
            let lin = Math.pow(10, db / 20);
            eSig += lin * lin;
        }
        eSig = Math.sqrt(eSig / bins.length);
        
        const centerFreq = bins[0] * binRes; 
        const eth = (centerFreq < 100) ? 0.2 : (centerFreq > 14000) ? 0.15 : 0.01;
        
        const alpha = 0.23;
        const c = 0.8; 
        let p = (eSig * 8) / (eth + 0.0005); 
        let nPrime = c * (Math.pow(p + 1, alpha) - 1);
        
        this.specificLoudnessBuffer[i] = Math.max(0, nPrime * 2.5); 
    }

    // 1.3 Time-domain integration
    for (let i = 0; i < this.nBands; i++) {
        this.shortLoudness[i] = 0.7 * this.shortLoudness[i] + 0.3 * this.specificLoudnessBuffer[i]; 
        this.longLoudness[i] = 0.999 * this.longLoudness[i] + 0.001 * this.specificLoudnessBuffer[i]; 
    }

    // 1.4 Normalization (Reusing specificLoudnessBuffer to hold return value)
    for (let i = 0; i < this.nBands; i++) {
        const localMean = this.longLoudness[i];
        const val = this.shortLoudness[i];
        this.specificLoudnessBuffer[i] = Math.max(0, (val - localMean * 0.3) / (localMean + 0.05));
    }
    
    return this.specificLoudnessBuffer;
  }

  /**
   * 2. MASKING MODEL
   * 2.1 Simultaneous masking & 2.2 Temporal masking
   */
  private computeMasking(loudness: Float32Array): Float32Array {
      // Calculate simultaneous masking (spreading function)
      for(let i = 0; i < this.nBands; i++) {
          let maskE = 0;
          for(let j = 0; j < this.nBands; j++) {
              if (i === j) continue;
              const dz = Math.abs(i - j);
              const slope = (j < i) ? -2.5 : -1.5; 
              const spread = Math.pow(10, (slope * dz) / 10);
              maskE += loudness[j] * spread;
          }
          this.maskCurveBuffer[i] = maskE;
      }

      // Temporal Masking (Post-masking)
      for(let i=0; i<this.nBands; i++) {
          this.peakFreqData[i] = Math.max(this.peakFreqData[i] * 0.85, loudness[i]); 
          this.maskCurveBuffer[i] = Math.max(this.maskCurveBuffer[i], this.peakFreqData[i] * 0.5); 
      }

      for(let i = 0; i < this.nBands; i++) {
          // SMR > 0 means audible
          this.maskingMapBuffer[i] = loudness[i] - this.maskCurveBuffer[i]; 
      }
      return this.maskingMapBuffer;
  }

  /**
   * 3. ATTENTION MODEL
   * 3.2 Transient-driven & 3.4 Surprise-based
   */
  private computeAttention(loudness: Float32Array): Float32Array {
      // Calculate spectral flux (Transient)
      let globalFlux = 0;
      for(let i = 0; i < this.freqData.length; i++) {
          const diff = this.freqData[i] - this.prevFreqData[i];
          if (diff > 0) globalFlux += diff;
      }
      
      // Information Surprise (KL Divergence proxy)
      let klProxy = 0;
      for(let i = 0; i < this.nBands; i++) {
          const h = loudness[i] / (this.longLoudness[i] + 0.1);
          klProxy += Math.max(0, h * Math.log(h + 0.0001));
      }
      const surprise = 1.0 / (1.0 + Math.exp(-klProxy + 2)); // sigmoid

      for(let i = 0; i < this.nBands; i++) {
          // Band-wise transient
          let bandTr = 0;
          for (const b of this.erbToFft[i]) {
            bandTr += Math.max(0, this.freqData[b] - this.prevFreqData[b]);
          }
          bandTr = bandTr / (this.erbToFft[i].length + 1);

          // Combined attention
          const attn = (bandTr * 0.01) + (surprise * 0.5);
          this.attentionMapBuffer[i] = Math.min(1.0, Math.max(0, attn));
      }

      // Update history
      this.prevFreqData.set(this.freqData);
      
      return this.attentionMapBuffer;
  }

  /**
   * 5. EMOTION PROXY LAYER (Heuristic CLAP replacement)
   */
  private computeEmotionProxy(loudness: Float32Array, attention: Float32Array) {
      // Arousal: Related to broad energy + transients (high attention)
      let sumEnergy = 0;
      let sumAttn = 0;
      for(let i=0; i<this.nBands; i++) {
          sumEnergy += loudness[i];
          sumAttn += attention[i];
      }
      
      const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
      const tanh = (x: number) => Math.tanh(x);

      const rawArousal = tanh((sumEnergy * 0.1 + sumAttn * 0.5) * 0.5);
      
      // Valence proxy: usually spectral centroid / brightness + harmonicity
      let centroidNum = 0;
      let centroidDen = 0;
      for(let i=0; i<this.nBands; i++) {
          centroidNum += loudness[i] * i;
          centroidDen += loudness[i];
      }
      const centroid = centroidDen > 0 ? (centroidNum / centroidDen) / this.nBands : 0.5;
      const rawValence = Math.max(0, Math.min(1.0, centroid * 1.5));

      // Tension proxy: Inharmonicity & dissonance (proxied by high-freq masking density)
      const rawTension = tanh(sumAttn * 0.2);

      // Smooth (LoHi filter)
      const alpha = 0.15; 
      this.arousalProxy = alpha * rawArousal + (1-alpha) * this.arousalProxy;
      this.valenceProxy = alpha * rawValence + (1-alpha) * this.valenceProxy;
      this.energyProxy = alpha * tanh(sumEnergy * 0.05) + (1-alpha) * this.energyProxy;
      this.tensionProxy = alpha * rawTension + (1-alpha) * this.tensionProxy;
  }

  /**
   * 6. PERCEIVED IMPORTANCE MAP - The Ultimate Fusion
   */
  public forward(): {
      importanceMap: Float32Array,
      loudness: Float32Array,
      maskingMap: Float32Array,
      attentionMap: Float32Array,
      emotionVector: [number, number, number, number]
  } {
      this.analyser.getFloatFrequencyData(this.freqData as any);
      this.analyser.getFloatTimeDomainData(this.timeData as any);

      const loudness = this.getSpecificLoudness();
      const maskingMap = this.computeMasking(loudness);
      const attention = this.computeAttention(loudness);
      
      this.computeEmotionProxy(loudness, attention);

      for(let i = 0; i < this.nBands; i++) {
          // Psychoacoustic importance fusion
          const sigLoud = 1 / (1 + Math.exp(-(loudness[i] * 8 - 1.5)));
          const unmasked = maskingMap[i] > 0 ? 1.0 : 0.35;
          
          let imp = sigLoud 
                        * (1 + attention[i] * 1.5) 
                        * (1 + this.arousalProxy * 0.5) 
                        * unmasked;
          
          this.importanceMap[i] = Math.min(1.0, imp);
      }

      return {
          importanceMap: this.importanceMap, 
          loudness, 
          maskingMap,
          attentionMap: attention,
          emotionVector: [
              Math.min(1, Math.max(0, this.arousalProxy)), 
              Math.min(1, Math.max(0, this.valenceProxy)), 
              Math.min(1, Math.max(0, this.energyProxy)), 
              Math.min(1, Math.max(0, this.tensionProxy))
          ]
      };
  }

  public reset() {
    this.shortLoudness.fill(0);
    this.longLoudness.fill(0);
    this.peakFreqData.fill(0);
    this.prevFreqData.fill(0);
    this.historyLoudness.forEach(h => h.fill(0));
    this.importanceMap.fill(0);
    this.specificLoudnessBuffer.fill(0);
    this.maskingMapBuffer.fill(0);
    this.attentionMapBuffer.fill(0);
    this.maskCurveBuffer.fill(0);
    this.arousalProxy = 0;
    this.valenceProxy = 0;
    this.energyProxy = 0;
    this.tensionProxy = 0;
  }
}
