import { logger } from '@/lib/logger';

export class SpectrogramRenderer {
  private device: GPUDevice | null = null;
  private canvasContext: GPUCanvasContext | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private texture: GPUTexture | null = null;
  private width: number = 0;
  private height: number = 0;

  constructor() {}

  async initialize(canvas: HTMLCanvasElement) {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      logger.warn('WebGPU not supported for Spectrogram');
      return;
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) return;
    this.device = await adapter.requestDevice();
    if (!this.device) return;

    this.canvasContext = canvas.getContext('webgpu') as GPUCanvasContext;
    const presentationFormat = (navigator as any).gpu.getPreferredCanvasFormat();

    this.canvasContext.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
    });

    this.width = canvas.width;
    this.height = canvas.height;

    // Create a texture to store history of FFTs
    this.texture = this.device.createTexture({
      size: [this.width, this.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const shaderCode = `
      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 4>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(1.0, 1.0)
        );
        return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
      }

      @group(0) @binding(0) var t: texture_2d<f32>;
      @group(0) @binding(1) var s: sampler;

      @fragment
      fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
        let uv = pos.xy / vec2<f32>(f32(${this.width}), f32(${this.height}));
        return textureSample(t, s, uv);
      }
    `;

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({ code: shaderCode }),
        entryPoint: 'vs_main',
      },
      fragment: {
        module: this.device.createShaderModule({ code: shaderCode }),
        entryPoint: 'fs_main',
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: 'triangle-strip',
      },
    });

    logger.info('Spectrogram Renderer (GPU) initialized');
  }

  update(fftData: Float32Array) {
    if (!this.device || !this.texture) return;

    // Shift texture and upload new row
    // Simplified: Just upload current FFT as a row for now
    this.device.queue.writeTexture(
      { texture: this.texture, origin: [0, 0, 0] },
      fftData as any,
      { bytesPerRow: this.width * 4, rowsPerImage: 1 },
      [this.width, 1, 1]
    );

    this.render();
  }

  private render() {
    if (!this.device || !this.renderPipeline || !this.canvasContext || !this.texture) return;

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.canvasContext.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView() },
        { binding: 1, resource: sampler },
      ],
    });

    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(4);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}

export const spectrogramRenderer = new SpectrogramRenderer();
