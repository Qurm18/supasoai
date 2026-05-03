import { logger } from '@/lib/logger';

export class WebGPUFFT {
  private device: GPUDevice | null = null;
  private fftPipeline: GPUComputePipeline | null = null;
  private n: number;

  constructor(n: number = 2048) {
    this.n = n;
  }

  async initialize() {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      logger.warn('WebGPU not supported in this browser');
      return;
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) return;
    this.device = await adapter.requestDevice();
    if (!this.device) return;

    const shaderCode = `
      struct Complex {
        real: f32,
        imag: f32,
      };

      @group(0) @binding(0) var<storage, read_write> data: array<Complex>;
      
      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        // Simplified butterfly stage for demonstration
        // In a real implementation, this would be part of a multi-stage pass.
        if (idx >= arrayLength(&data) / 2u) { return; }
        
        // Butterfly logic would go here
      }
    `;

    this.fftPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({ code: shaderCode }),
        entryPoint: 'main',
      },
    });

    logger.info(`WebGPU FFT initialized for size ${this.n}`);
  }

  async compute(buffer: Float32Array): Promise<Float32Array> {
    if (!this.device || !this.fftPipeline) return new Float32Array(this.n);

    const gpuBuffer = this.device.createBuffer({
      size: buffer.byteLength * 2, // real + imag
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const mappedArr = new Float32Array(gpuBuffer.getMappedRange());
    for (let i = 0; i < buffer.length; i++) {
      mappedArr[i * 2] = buffer[i];
      mappedArr[i * 2 + 1] = 0;
    }
    gpuBuffer.unmap();

    const resultBuffer = this.device.createBuffer({
      size: buffer.byteLength * 2,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.fftPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: gpuBuffer } }],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.fftPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(this.n / 256));
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(gpuBuffer, 0, resultBuffer, 0, buffer.byteLength * 2);
    this.device.queue.submit([commandEncoder.finish()]);

    await resultBuffer.mapAsync(GPUMapMode.READ);
    const output = new Float32Array(resultBuffer.getMappedRange().slice(0));
    resultBuffer.unmap();

    return output;
  }
}

export const webGPUFFT = new WebGPUFFT();
