import { logger } from '@/lib/logger';

/**
 * GPU-accelerated Convolution for Room Impulse Response
 */
export class WebGPUConvolution {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private kernelBuffer: GPUBuffer | null = null;

  async initialize(kernel: Float32Array) {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      logger.warn('WebGPU not supported for Convolution');
      return;
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) return;
    this.device = await adapter.requestDevice();
    if (!this.device) return;

    // Store RIR kernel in constant buffer
    this.kernelBuffer = this.device.createBuffer({
      size: kernel.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.kernelBuffer.getMappedRange()).set(kernel);
    this.kernelBuffer.unmap();

    const shaderCode = `
      @group(0) @binding(0) var<storage, read> kernel: array<f32>;
      @group(0) @binding(1) var<storage, read> input: array<f32>;
      @group(0) @binding(2) var<storage, read_write> output: array<f32>;

      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= arrayLength(&output)) { return; }

        var sum = 0.0;
        let kLen = arrayLength(&kernel);
        
        // Simplified Time-domain convolution (Real-time usually uses Partitioned FFT Convolution)
        // For demonstration, we show the parallel structure.
        for (var i = 0u; i < kLen; i = i + 1u) {
          if (idx >= i) {
            sum = sum + input[idx - i] * kernel[i];
          }
        }
        output[idx] = sum;
      }
    `;

    this.pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({ code: shaderCode }),
        entryPoint: 'main',
      },
    });

    logger.info(`WebGPU Convolution initialized with kernel size ${kernel.length}`);
  }

  async process(inputBuffer: Float32Array): Promise<Float32Array> {
    if (!this.device || !this.pipeline || !this.kernelBuffer) return inputBuffer;

    const inputGpuBuffer = this.device.createBuffer({
      size: inputBuffer.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(inputGpuBuffer.getMappedRange()).set(inputBuffer);
    inputGpuBuffer.unmap();

    const outputGpuBuffer = this.device.createBuffer({
      size: inputBuffer.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.kernelBuffer } },
        { binding: 1, resource: { buffer: inputGpuBuffer } },
        { binding: 2, resource: { buffer: outputGpuBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(inputBuffer.length / 256));
    passEncoder.end();

    const readBuffer = this.device.createBuffer({
      size: inputBuffer.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(outputGpuBuffer, 0, readBuffer, 0, inputBuffer.byteLength);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    return result;
  }
}

export const webGPUConvolution = new WebGPUConvolution();
