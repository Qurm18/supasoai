import { logger } from './logger';

export interface EarProfile {
  id: string;
  pinnaSize: number;      // 0-1
  conchaDepth: number;    // 0-1
  cavumConcha: number;    // 0-1
  cymbaConcha: number;    // 0-1
  preferredHRTFSet: string; // 'CIPIC', 'KEMAR', 'SADIE', 'LISTEN'
}

export interface HRTFMetadata {
  azimuth: number;   // -180 to 180
  elevation: number; // -90 to 90
  dataset: string;
  leftBuffer: AudioBuffer;
  rightBuffer: AudioBuffer;
}

export class SpatialEngine {
  private ctx: AudioContext;
  private input: GainNode;
  private output: GainNode;
  
  // HRTF processors
  private convolverL: ConvolverNode;
  private convolverR: ConvolverNode;
  
  // ITD/ILD
  private delayL: DelayNode;
  private delayR: DelayNode;
  private gainL: GainNode;
  private gainR: GainNode;
  
  // Routing
  private merger: ChannelMergerNode;
  private splitter: ChannelSplitterNode;
  
  // State management
  public currentAzimuth: number = 0;
  public currentElevation: number = 0;
  private hrtfDatabase: HRTFDatabase;
  public personalizedProfile: EarProfile | null = null;
  
  // Head tracking
  public headTrackingEnabled: boolean = false;
  public smoothingAlpha: number = 0.3;
  
  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.hrtfDatabase = new HRTFDatabase(ctx);
    
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);
    this.convolverL = this.ctx.createConvolver();
    this.convolverR = this.ctx.createConvolver();
    this.delayL = this.ctx.createDelay(0.02);
    this.delayR = this.ctx.createDelay(0.02);
    this.gainL = this.ctx.createGain();
    this.gainR = this.ctx.createGain();
    
    this.buildGraph();
  }
  
  private buildGraph() {
    this.input.connect(this.splitter);
    
    // Left chain
    this.splitter.connect(this.convolverL, 0);
    this.convolverL.connect(this.delayL);
    this.delayL.connect(this.gainL);
    this.gainL.connect(this.merger, 0, 0);
    
    // Right chain
    this.splitter.connect(this.convolverR, 1);
    this.convolverR.connect(this.delayR);
    this.delayR.connect(this.gainR);
    this.gainR.connect(this.merger, 0, 1);
    
    this.merger.connect(this.output);
  }

  public async setPosition(azimuth: number, elevation: number) {
    // Normalize angles
    azimuth = ((azimuth % 360) + 360) % 360;
    elevation = Math.max(-90, Math.min(90, elevation));
    
    const dataset = this.personalizedProfile?.preferredHRTFSet || 'CIPIC';
    const target = this.hrtfDatabase.getHRTF(azimuth, elevation, dataset);
    
    if (target) {
        // In a real product-grade engine, we'd use FFT interpolation or cross-fading
        // For now, we apply nearest neighbor for stability
        this.convolverL.buffer = target.leftBuffer;
        this.convolverR.buffer = target.rightBuffer;
        
        this.currentAzimuth = azimuth;
        this.currentElevation = elevation;
        
        this.updateITD(azimuth, elevation);
        this.updateILD(azimuth, elevation);
    }
  }

  private updateITD(azimuth: number, elevation: number) {
    const maxDelay = 0.0007; // 0.7ms typical human head
    
    const azRad = azimuth * Math.PI / 180;
    const elRad = elevation * Math.PI / 180;
    
    // Woodworth model approximation
    const azFactor = Math.sin(azRad);
    const elFactor = Math.cos(elRad);
    const delay = azFactor * elFactor * maxDelay;
    
    this.delayL.delayTime.setTargetAtTime(delay > 0 ? delay : 0, this.ctx.currentTime, 0.02);
    this.delayR.delayTime.setTargetAtTime(delay < 0 ? -delay : 0, this.ctx.currentTime, 0.02);
  }

  private updateILD(azimuth: number, elevation: number) {
    const azRad = azimuth * Math.PI / 180;
    const elRad = elevation * Math.PI / 180;
    
    const azILD = Math.cos(azRad);
    const elILD = Math.cos(elRad);
    const ild = azILD * (0.7 + 0.3 * elILD);
    
    this.gainL.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02);
    this.gainR.gain.setTargetAtTime(Math.max(0.1, (ild + 1) / 2), this.ctx.currentTime, 0.02);
  }
  
  get inputNode() { return this.input; }
  get outputNode() { return this.output; }
  get database() { return this.hrtfDatabase; }
}

export class EarShapeEstimator {
  // Dùng MediaPipe Face Mesh hoặc logic hình học để detect ear landmarks
  async estimateFromPhoto(imageData: ImageData): Promise<EarProfile> {
    // Giả lập logic đo đạc từ ảnh
    const pinnaHeight = 0.6; // Giả lập đo được
    const conchaDepth = 0.4;
    
    const profile: EarProfile = {
      id: Math.random().toString(36).substring(7),
      pinnaSize: pinnaHeight,
      conchaDepth: conchaDepth,
      cavumConcha: 0.5,
      cymbaConcha: 0.5,
      preferredHRTFSet: this.selectHRTFDataset(pinnaHeight, conchaDepth)
    };
    
    return profile;
  }
  
  private selectHRTFDataset(pinnaSize: number, conchaDepth: number): string {
    if (pinnaSize > 0.7) return 'CIPIC';
    if (conchaDepth < 0.3) return 'KEMAR';
    return 'SADIE';
  }
}

export class HRTFDatabase {
  private ctx: AudioContext;
  private metadata: HRTFMetadata[] = [];
  
  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async loadDataset(basePath: string, dataset: string, azimuths: number[], elevations: number[]) {
    logger.info(`Loading HRTF dataset: ${dataset}`);
    // Trong thực tế sẽ fetch file .wav từ basePath
    // Ở đây chúng ta chuẩn bị cấu trúc để load
  }

  getHRTF(azimuth: number, elevation: number, dataset: string): HRTFMetadata | null {
    if (this.metadata.length === 0) return null;

    let minDist = Infinity;
    let nearest = this.metadata[0];
    
    for (const hrtf of this.metadata) {
      if (hrtf.dataset !== dataset) continue;
      
      const azDiff = Math.abs(hrtf.azimuth - azimuth);
      const elDiff = Math.abs(hrtf.elevation - elevation);
      const dist = Math.sqrt(azDiff * azDiff + elDiff * elDiff);
      
      if (dist < minDist) {
        minDist = dist;
        nearest = hrtf;
      }
    }
    
    return nearest;
  }
}

export class SpatialPositionManager {
  private engine: SpatialEngine;
  private database: HRTFDatabase;
  
  constructor(engine: SpatialEngine, database: HRTFDatabase) {
    this.engine = engine;
    this.database = database;
  }
  
  async setPosition(azimuth: number, elevation: number) {
    await this.engine.setPosition(azimuth, elevation);
  }
}

export class HeadTracker {
  private engine: SpatialEngine;
  private positionManager: SpatialPositionManager;
  private targetAzimuth: number = 0;
  private targetElevation: number = 0;
  private isEnabled: boolean = false;
  
  constructor(engine: SpatialEngine, positionManager: SpatialPositionManager) {
    this.engine = engine;
    this.positionManager = positionManager;
  }
  
  enable() {
    if (typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', this.handleOrientation);
      this.isEnabled = true;
    }
  }

  disable() {
    if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', this.handleOrientation);
        this.isEnabled = false;
    }
  }
  
  private handleOrientation = (event: DeviceOrientationEvent) => {
    if (!this.isEnabled) return;

    // Simplified Euler to Spherical for azimuth/elevation
    // alpha: rotation around z-axis (azimuth)
    // beta: rotation around x-axis (elevation)
    const alpha = event.alpha || 0;
    const beta = event.beta || 0;
    
    // Applying smoothing
    this.targetAzimuth = this.smooth(this.targetAzimuth, alpha);
    this.targetElevation = this.smooth(this.targetElevation, beta);
    
    this.positionManager.setPosition(this.targetAzimuth, this.targetElevation);
  };
  
  private smooth(current: number, target: number): number {
    return current * this.engine.smoothingAlpha + target * (1 - this.engine.smoothingAlpha);
  }
}

export class EnvironmentalProcessor {
  private ctx: AudioContext;
  private input: GainNode;
  private output: GainNode;
  private reflections: DelayNode[] = [];
  private reflectionGains: GainNode[] = [];
  
  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    this.input.connect(this.output);
  }
  
  createReflections(roomSize: 'small' | 'medium' | 'large' = 'medium') {
    const config = {
      small: { taps: [0.003, 0.008, 0.015], gains: [0.25, 0.15, 0.08] },
      medium: { taps: [0.005, 0.012, 0.020], gains: [0.3, 0.2, 0.1] },
      large: { taps: [0.008, 0.018, 0.030], gains: [0.35, 0.25, 0.12] }
    };
    
    const { taps, gains } = config[roomSize];
    
    // Clear existing
    this.reflections.forEach(r => r.disconnect());
    this.reflectionGains.forEach(g => g.disconnect());
    this.reflections = [];
    this.reflectionGains = [];

    taps.forEach((tap, i) => {
      const delay = this.ctx.createDelay();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      
      delay.delayTime.value = tap;
      gain.gain.value = gains[i];
      panner.pan.value = Math.sin(tap * 500) * 0.5;
      
      this.input.connect(delay);
      delay.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);
      
      this.reflections.push(delay);
      this.reflectionGains.push(gain);
    });
  }
  
  get inputNode() { return this.input; }
  get outputNode() { return this.output; }
}
