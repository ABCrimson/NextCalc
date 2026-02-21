'use client';

/**
 * WebGPU-Accelerated Heatmap Renderer for PDE Visualizations
 *
 * Rendering:
 * - Native WebGPU render pipeline with WGSL shaders
 * - Fullscreen triangle trick (3 vertices, no vertex buffer)
 * - r32float storage texture updated via device.queue.writeTexture()
 * - GPUSampler with magFilter:'linear' for smooth interpolation
 *   (requests float32-filterable feature; falls back to r16float)
 * - Perceptually uniform colormaps matching the WebGL implementation
 * - FPS performance monitoring overlay
 * - Device lost / context lost recovery
 * - Automatic fallback to WebGLHeatmap when WebGPU is unavailable
 *
 * GPU Compute (when gpuSolverEnabled=true):
 * - Ping-pong storage buffers for heat / wave / Laplace finite difference
 * - Gradient compute pass (central differences)
 * - Particle advection compute pass
 * - Canvas 2D particle overlay drawn over the heatmap
 *
 * @module components/plots/webgpu-heatmap
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent,
} from 'react';
import { Info } from 'lucide-react';
import { WebGLHeatmap } from './webgl-heatmap';
import {
  WGSL_HEAT_COMPUTE,
  WGSL_WAVE_COMPUTE,
  WGSL_LAPLACE_COMPUTE,
  WGSL_GRADIENT_COMPUTE,
  WGSL_PARTICLE_COMPUTE,
  PDE_UNIFORM_SIZE,
} from './pde-compute-shaders';

// ---------------------------------------------------------------------------
// GPUShaderStage numeric constants (SSR-safe, no browser globals at module level)
// ---------------------------------------------------------------------------
const SHADER_STAGE_FRAGMENT = 0x2; // GPUShaderStage.FRAGMENT

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export type PdeEquationType = 'heat' | 'wave' | 'laplace';

export interface WebGPUHeatmapProps {
  /** 2D array of values (row-major order). Used in CPU mode and for initial GPU state. */
  data: number[][];
  /** Minimum value for color mapping */
  minValue?: number;
  /** Maximum value for color mapping */
  maxValue?: number;
  /** Color mode: 'heat' or 'wave' (laplace uses heat colormap) */
  colorMode?: 'heat' | 'wave';
  /** Canvas width in logical pixels */
  width?: number;
  /** Canvas height in logical pixels */
  height?: number;
  /** Enable smooth bilinear filtering */
  smoothing?: boolean;
  /** Callback invoked once the renderer is fully initialized */
  onReady?: () => void;
  // ---- GPU compute props ----
  /** When true the GPU compute solver runs in real-time */
  gpuSolverEnabled?: boolean;
  /** Which PDE to solve on the GPU */
  equationType?: PdeEquationType;
  /** Diffusivity α (heat) or wave speed c (wave) */
  solverAlpha?: number;
  /** Show particle advection overlay */
  showParticles?: boolean;
  /** Callback fired each frame with the current FPS (GPU solver mode) */
  onFps?: (fps: number) => void;
}

// ---------------------------------------------------------------------------
// WGSL render shaders
// ---------------------------------------------------------------------------

const WGSL_VERTEX = /* wgsl */ `
struct VertOut {
  @builtin(position) pos : vec4<f32>,
  @location(0)       uv  : vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertIdx: u32) -> VertOut {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  var uv = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0),
  );
  var out : VertOut;
  out.pos = vec4<f32>(pos[vertIdx], 0.0, 1.0);
  out.uv  = uv[vertIdx];
  return out;
}
`;

const WGSL_FRAGMENT = /* wgsl */ `
struct Uniforms {
  minValue  : f32,
  maxValue  : f32,
  colorMode : u32,
  _pad      : u32,
}
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var dataSampler : sampler;
@group(0) @binding(2) var dataTexture : texture_2d<f32>;

fn heatColor(t_in: f32) -> vec3<f32> {
  let t = clamp(t_in, 0.0, 1.0);
  if t < 0.2 {
    let s = t * 5.0;
    return mix(vec3<f32>(0.001, 0.000, 0.014), vec3<f32>(0.258, 0.010, 0.306), s);
  } else if t < 0.4 {
    let s = (t - 0.2) * 5.0;
    return mix(vec3<f32>(0.258, 0.010, 0.306), vec3<f32>(0.576, 0.050, 0.490), s);
  } else if t < 0.6 {
    let s = (t - 0.4) * 5.0;
    return mix(vec3<f32>(0.576, 0.050, 0.490), vec3<f32>(0.902, 0.341, 0.051), s);
  } else if t < 0.8 {
    let s = (t - 0.6) * 5.0;
    return mix(vec3<f32>(0.902, 0.341, 0.051), vec3<f32>(0.980, 0.647, 0.000), s);
  } else {
    let s = (t - 0.8) * 5.0;
    return mix(vec3<f32>(0.980, 0.647, 0.000), vec3<f32>(0.988, 0.998, 0.645), s);
  }
}

fn waveColor(t_in: f32) -> vec3<f32> {
  let t = clamp(t_in, 0.0, 1.0);
  let v = t * 2.0 - 1.0;
  if v < -0.6 {
    let s = (v + 1.0) / 0.4;
    return mix(vec3<f32>(0.016, 0.055, 0.180), vec3<f32>(0.082, 0.267, 0.800), s);
  } else if v < -0.15 {
    let s = (v + 0.6) / 0.45;
    return mix(vec3<f32>(0.082, 0.267, 0.800), vec3<f32>(0.150, 0.420, 0.650), s);
  } else if v < 0.0 {
    let s = (v + 0.15) / 0.15;
    return mix(vec3<f32>(0.150, 0.420, 0.650), vec3<f32>(0.040, 0.060, 0.080), s);
  } else if v < 0.15 {
    let s = v / 0.15;
    return mix(vec3<f32>(0.040, 0.060, 0.080), vec3<f32>(0.650, 0.120, 0.060), s);
  } else if v < 0.6 {
    let s = (v - 0.15) / 0.45;
    return mix(vec3<f32>(0.650, 0.120, 0.060), vec3<f32>(0.900, 0.200, 0.040), s);
  } else {
    let s = (v - 0.6) / 0.4;
    return mix(vec3<f32>(0.900, 0.200, 0.040), vec3<f32>(0.600, 0.020, 0.020), s);
  }
}

struct FragIn {
  @builtin(position) fragCoord : vec4<f32>,
  @location(0)       uv        : vec2<f32>,
}

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
  let uv    = vec2<f32>(in.uv.x, 1.0 - in.uv.y);
  let value = textureSample(dataTexture, dataSampler, uv).r;
  let norm  = (value - u.minValue) / max(u.maxValue - u.minValue, 0.001);

  var color: vec3<f32>;
  if u.colorMode == 0u {
    color = heatColor(norm);
  } else {
    color = waveColor(norm);
  }
  return vec4<f32>(color, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RenderResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  sampler: GPUSampler;
  textureFormat: 'r32float' | 'r16float';
  dataTexture: GPUTexture | null;
  bindGroup: GPUBindGroup | null;
  bindGroupLayout: GPUBindGroupLayout;
}

/** GPU buffers and pipelines used by the compute solver */
interface ComputeResources {
  /** Two ping-pong storage buffers (A and B) for the scalar field */
  bufA: GPUBuffer;
  bufB: GPUBuffer;
  /** For wave equation: a third buffer for u_prev */
  bufPrev: GPUBuffer | null;
  /** Flat gradient buffer: 2 floats (gx, gy) per cell */
  gradBuf: GPUBuffer;
  /** Particle buffer: 4 floats per particle [px, py, age, pad] */
  particleBuf: GPUBuffer;
  /** PDE uniform buffer (shared with all compute passes) */
  pdeUniformBuf: GPUBuffer;
  /** Particle-specific uniform buffer */
  particleUniformBuf: GPUBuffer;
  /** Laplace: boundary mask buffer */
  maskBuf: GPUBuffer | null;
  /** Compiled compute pipeline for the active equation type */
  pdePipeline: GPUComputePipeline;
  gradientPipeline: GPUComputePipeline;
  particlePipeline: GPUComputePipeline;
  /** Bind group for the PDE step (recreated when buffers swap) */
  pdeBindGroupA: GPUBindGroup; // reads A, writes B
  pdeBindGroupB: GPUBindGroup; // reads B, writes A
  gradBindGroupA: GPUBindGroup; // gradient from A
  gradBindGroupB: GPUBindGroup; // gradient from B
  particleBindGroup: GPUBindGroup;
  /** Which ping-pong index is current (0 = A is current) */
  pingPong: 0 | 1;
  gridW: number;
  gridH: number;
  particleCount: number;
}

// ---------------------------------------------------------------------------
// Helpers: float16 conversion
// ---------------------------------------------------------------------------

function float32ToFloat16Array(src: Float32Array): Uint16Array {
  const dst = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const v = src[i] ?? 0;
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setFloat32(0, v, false);
    const bits = view.getUint32(0, false);
    const sign = (bits >>> 31) & 0x1;
    const exp  = (bits >>> 23) & 0xff;
    const mant = bits & 0x7fffff;
    let hExp: number;
    let hMant: number;
    if (exp === 0xff) {
      hExp  = 0x1f;
      hMant = mant !== 0 ? 0x200 : 0;
    } else if (exp === 0) {
      hExp  = 0;
      hMant = 0;
    } else {
      hExp = exp - 127 + 15;
      if (hExp >= 0x1f) {
        hExp  = 0x1f;
        hMant = 0;
      } else if (hExp <= 0) {
        hExp  = 0;
        hMant = 0;
      } else {
        hMant = mant >> 13;
      }
    }
    dst[i] = ((sign << 15) | (hExp << 10) | hMant) >>> 0;
  }
  return dst;
}

function createDataTexture(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
  sampler: GPUSampler,
  cols: number,
  rows: number,
  format: 'r32float' | 'r16float',
): { texture: GPUTexture; bindGroup: GPUBindGroup } {
  const texture = device.createTexture({
    size: { width: cols, height: rows },
    format,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
    ],
  });
  return { texture, bindGroup };
}

// ---------------------------------------------------------------------------
// WebGPU feature detection (SSR-safe)
// ---------------------------------------------------------------------------

function isWebGPUAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as { gpu?: unknown }).gpu !== 'undefined'
  );
}

// ---------------------------------------------------------------------------
// Flatten a 2D JS array into a row-major Float32Array
// ---------------------------------------------------------------------------

function flattenGrid(data: number[][]): Float32Array {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const flat = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const row = data[r];
    if (row) {
      for (let c = 0; c < cols; c++) {
        flat[r * cols + c] = row[c] ?? 0;
      }
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Build PDE uniform buffer data
// ---------------------------------------------------------------------------

function writePdeUniforms(
  buf: GPUBuffer,
  device: GPUDevice,
  gridW: number,
  gridH: number,
  dt: number,
  dx: number,
  alphaOrC2: number,
): void {
  const arr = new ArrayBuffer(PDE_UNIFORM_SIZE);
  const view = new DataView(arr);
  view.setUint32( 0, gridW,      true);
  view.setUint32( 4, gridH,      true);
  view.setFloat32( 8, dt,         true);
  view.setFloat32(12, dx,         true);
  view.setFloat32(16, alphaOrC2,  true);
  view.setUint32(20, 0,           true);
  view.setUint32(24, 0,           true);
  view.setUint32(28, 0,           true);
  device.queue.writeBuffer(buf, 0, arr);
}

// ---------------------------------------------------------------------------
// Build all compute resources
// ---------------------------------------------------------------------------

function buildComputeResources(
  device: GPUDevice,
  equationType: PdeEquationType,
  initialFlat: Float32Array,
  gridW: number,
  gridH: number,
  particleCount: number,
  maskFlat: Uint32Array | null,
): ComputeResources {
  const cellCount = gridW * gridH;
  const bufSize   = cellCount * 4; // Float32, 4 bytes each

  // ---- Ping-pong scalar field buffers ----
  const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;

  const bufA = device.createBuffer({ size: bufSize, usage: storageUsage });
  const bufB = device.createBuffer({ size: bufSize, usage: storageUsage });
  device.queue.writeBuffer(bufA, 0, initialFlat.buffer);
  device.queue.writeBuffer(bufB, 0, initialFlat.buffer);

  // Wave equation needs a u_prev buffer
  let bufPrev: GPUBuffer | null = null;
  if (equationType === 'wave') {
    bufPrev = device.createBuffer({ size: bufSize, usage: storageUsage });
    device.queue.writeBuffer(bufPrev, 0, initialFlat.buffer);
  }

  // ---- Gradient buffer: 2 floats per cell ----
  const gradBuf = device.createBuffer({
    size: cellCount * 2 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // ---- Particle buffer: 4 floats per particle ----
  const particleBuf = device.createBuffer({
    size: particleCount * 4 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  // Seed random positions
  const particleInit = new Float32Array(particleCount * 4);
  for (let i = 0; i < particleCount; i++) {
    particleInit[i * 4 + 0] = Math.random(); // px
    particleInit[i * 4 + 1] = Math.random(); // py
    particleInit[i * 4 + 2] = Math.random() * 4.0; // age (staggered)
    particleInit[i * 4 + 3] = 0;
  }
  device.queue.writeBuffer(particleBuf, 0, particleInit.buffer);

  // ---- PDE uniform buffer ----
  const pdeUniformBuf = device.createBuffer({
    size: PDE_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // ---- Particle uniform buffer: [particleCount, advectScale, pad, pad] ----
  const particleUniformBuf = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const puArr = new ArrayBuffer(16);
  const puView = new DataView(puArr);
  puView.setUint32(0, particleCount, true);
  puView.setFloat32(4, 0.002, true); // advectScale
  puView.setUint32(8, 0, true);
  puView.setUint32(12, 0, true);
  device.queue.writeBuffer(particleUniformBuf, 0, puArr);

  // ---- Boundary mask buffer (Laplace) ----
  let maskBuf: GPUBuffer | null = null;
  if (equationType === 'laplace') {
    const mask = maskFlat ?? new Uint32Array(cellCount);
    maskBuf = device.createBuffer({
      size: cellCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(maskBuf, 0, mask.buffer);
  }

  // ---- Compile compute pipelines ----
  const pdeCode =
    equationType === 'heat'    ? WGSL_HEAT_COMPUTE    :
    equationType === 'wave'    ? WGSL_WAVE_COMPUTE    :
                                 WGSL_LAPLACE_COMPUTE;

  const pdeEntryPoint =
    equationType === 'heat'    ? 'cs_heat'    :
    equationType === 'wave'    ? 'cs_wave'    :
                                 'cs_laplace';

  const pdePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: pdeCode }),
      entryPoint: pdeEntryPoint,
    },
  });

  const gradientPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: WGSL_GRADIENT_COMPUTE }),
      entryPoint: 'cs_gradient',
    },
  });

  const particlePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: WGSL_PARTICLE_COMPUTE }),
      entryPoint: 'cs_particles',
    },
  });

  // ---- Build bind groups ----
  // PDE bind groups (heat / laplace: 3 bindings; wave: 4 bindings)
  const pdeBindGroupA = buildPdeBindGroup(
    device, pdePipeline, equationType, pdeUniformBuf, bufA, bufB, bufPrev, maskBuf,
  );
  const pdeBindGroupB = buildPdeBindGroup(
    device, pdePipeline, equationType, pdeUniformBuf, bufB, bufA, bufPrev, maskBuf,
  );

  // Gradient bind groups
  const gradBindGroupA = device.createBindGroup({
    layout: gradientPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: pdeUniformBuf } },
      { binding: 1, resource: { buffer: bufA } },
      { binding: 2, resource: { buffer: gradBuf } },
    ],
  });
  const gradBindGroupB = device.createBindGroup({
    layout: gradientPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: pdeUniformBuf } },
      { binding: 1, resource: { buffer: bufB } },
      { binding: 2, resource: { buffer: gradBuf } },
    ],
  });

  // Particle bind group
  const particleBindGroup = device.createBindGroup({
    layout: particlePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: pdeUniformBuf } },
      { binding: 1, resource: { buffer: gradBuf } },
      { binding: 2, resource: { buffer: particleBuf } },
      { binding: 3, resource: { buffer: particleUniformBuf } },
    ],
  });

  return {
    bufA, bufB, bufPrev,
    gradBuf, particleBuf,
    pdeUniformBuf, particleUniformBuf,
    maskBuf,
    pdePipeline, gradientPipeline, particlePipeline,
    pdeBindGroupA, pdeBindGroupB,
    gradBindGroupA, gradBindGroupB,
    particleBindGroup,
    pingPong: 0,
    gridW, gridH,
    particleCount,
  };
}

function buildPdeBindGroup(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  equationType: PdeEquationType,
  uniformBuf: GPUBuffer,
  src: GPUBuffer,
  dst: GPUBuffer,
  bufPrev: GPUBuffer | null,
  maskBuf: GPUBuffer | null,
): GPUBindGroup {
  if (equationType === 'wave' && bufPrev !== null) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: bufPrev } },
        { binding: 2, resource: { buffer: src } },
        { binding: 3, resource: { buffer: dst } },
      ],
    });
  }
  if (equationType === 'laplace' && maskBuf !== null) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: src } },
        { binding: 2, resource: { buffer: dst } },
        { binding: 3, resource: { buffer: maskBuf } },
      ],
    });
  }
  // heat (and laplace without mask)
  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: { buffer: src } },
      { binding: 2, resource: { buffer: dst } },
    ],
  });
}

// ---------------------------------------------------------------------------
// Destroy all compute resources
// ---------------------------------------------------------------------------

function destroyComputeResources(c: ComputeResources): void {
  c.bufA.destroy();
  c.bufB.destroy();
  c.bufPrev?.destroy();
  c.gradBuf.destroy();
  c.particleBuf.destroy();
  c.pdeUniformBuf.destroy();
  c.particleUniformBuf.destroy();
  c.maskBuf?.destroy();
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WebGPUHeatmap({
  data,
  minValue = 0,
  maxValue = 100,
  colorMode = 'heat',
  width = 512,
  height = 512,
  smoothing = true,
  onReady,
  gpuSolverEnabled = false,
  equationType = 'heat',
  solverAlpha = 0.1,
  showParticles = false,
  onFps,
}: WebGPUHeatmapProps) {
  const [gpuAvailable, setGpuAvailable] = useState(false);

  useEffect(() => {
    setGpuAvailable(isWebGPUAvailable());
  }, []);

  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // 2D particle overlay
  const renderRef        = useRef<RenderResources | null>(null);
  const computeRef       = useRef<ComputeResources | null>(null);
  const rafRef           = useRef<number>(0);
  const isInitRef        = useRef(false);
  const initCompleteRef  = useRef(false);
  const retryCountRef    = useRef(0);
  const dataDimsRef      = useRef<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const frameCountRef    = useRef(0);
  const fpsEpochRef      = useRef(0);
  const [fps, setFps]    = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  // For GPU-solver readback we need a staging buffer
  const stagingBufRef = useRef<GPUBuffer | null>(null);

  // Hovering value inspector
  const [hoveredValue, setHoveredValue] = useState<{
    x: number; y: number; value: number;
  } | null>(null);

  // -------------------------------------------------------------------------
  // WebGPU initialization (one-time on mount)
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: One-time WebGPU initialization on mount only
  useEffect(() => {
    if (!gpuAvailable) return;

    const canvas = canvasRef.current;
    if (!canvas || isInitRef.current) return;

    let destroyed = false;

    const init = async () => {
      try {
        const gpu = (navigator as { gpu: GPU }).gpu;
        const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) throw new Error('No suitable WebGPU adapter found.');
        if (destroyed) return;

        const supportsFloat32Filterable = adapter.features.has('float32-filterable');
        const device = await adapter.requestDevice({
          ...(supportsFloat32Filterable ? { requiredFeatures: ['float32-filterable'] } : {}),
        });
        if (destroyed) { device.destroy(); return; }

        const textureFormat: 'r32float' | 'r16float' = supportsFloat32Filterable
          ? 'r32float' : 'r16float';

        device.lost.then((info) => {
          if (destroyed) return;
          console.warn(`WebGPU device lost (reason: ${info.reason}): ${info.message}`);
          isInitRef.current = false;
          initCompleteRef.current = false;
          renderRef.current = null;
        });

        // Canvas context
        const context = canvas.getContext('webgpu');
        if (!context) throw new Error('Failed to obtain WebGPU canvas context.');
        const presentationFormat = gpu.getPreferredCanvasFormat();
        context.configure({ device, format: presentationFormat, alphaMode: 'opaque' });

        // Render uniform buffer
        const uniformBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Sampler
        const filterMode: GPUFilterMode = smoothing ? 'linear' : 'nearest';
        const sampler = device.createSampler({
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
          magFilter: filterMode,
          minFilter: filterMode,
        });

        // Render bind group layout
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: SHADER_STAGE_FRAGMENT,
              buffer: { type: 'uniform' },
            },
            {
              binding: 1,
              visibility: SHADER_STAGE_FRAGMENT,
              sampler: { type: 'filtering' },
            },
            {
              binding: 2,
              visibility: SHADER_STAGE_FRAGMENT,
              texture: { sampleType: 'float', viewDimension: '2d' },
            },
          ],
        });

        // Shader modules + pipeline
        const vertModule = device.createShaderModule({ code: WGSL_VERTEX });
        const fragModule = device.createShaderModule({ code: WGSL_FRAGMENT });
        const pipeline = device.createRenderPipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
          vertex: { module: vertModule, entryPoint: 'vs_main' },
          fragment: {
            module: fragModule,
            entryPoint: 'fs_main',
            targets: [{ format: presentationFormat }],
          },
          primitive: { topology: 'triangle-list' },
        });

        renderRef.current = {
          device, context, pipeline,
          uniformBuffer, sampler, textureFormat,
          dataTexture: null, bindGroup: null, bindGroupLayout,
        };
        isInitRef.current = true;
        initCompleteRef.current = true;
        retryCountRef.current = 0;

        // Trigger data upload now that init is complete
        setDataVersion(v => v + 1);

        if (onReady) onReady();
      } catch (err) {
        console.error('WebGPU initialization failed:', err);
        isInitRef.current = false;
        initCompleteRef.current = false;
      }
    };

    void init();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);

      const r = renderRef.current;
      if (r) {
        r.dataTexture?.destroy();
        r.uniformBuffer.destroy();
        r.device.destroy();
      }
      renderRef.current = null;

      const c = computeRef.current;
      if (c) destroyComputeResources(c);
      computeRef.current = null;

      stagingBufRef.current?.destroy();
      stagingBufRef.current = null;

      isInitRef.current = false;
      initCompleteRef.current = false;
    };
  }, []); // ONE-TIME mount initialization

  // -------------------------------------------------------------------------
  // Canvas dimensions
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = width; canvas.height = height; }
    const overlay = overlayCanvasRef.current;
    if (overlay) { overlay.width = width; overlay.height = height; }
  }, [width, height]);

  // -------------------------------------------------------------------------
  // Update heatmap texture from CPU data (only used in CPU mode)
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: dataVersion is used to retry after init completes
  useEffect(() => {
    if (gpuSolverEnabled) return; // GPU mode manages its own texture
    if (!data || data.length === 0) return;
    if (!initCompleteRef.current) {
      // Init is still in progress — retry after a short delay (max 50 retries = 5s)
      retryCountRef.current++;
      if (retryCountRef.current < 50) {
        const timer = setTimeout(() => setDataVersion(v => v + 1), 100);
        return () => clearTimeout(timer);
      }
      return;
    }
    const r = renderRef.current;
    if (!r) return;

    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    if (cols === 0) return;

    const { device, bindGroupLayout, uniformBuffer, sampler, textureFormat } = r;

    const flat = new Float32Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      const srcRow = data[rows - 1 - i];
      if (srcRow) {
        for (let j = 0; j < cols; j++) {
          flat[i * cols + j] = srcRow[j] ?? 0;
        }
      }
    }

    const dimsChanged =
      dataDimsRef.current.rows !== rows || dataDimsRef.current.cols !== cols;

    if (dimsChanged) {
      r.dataTexture?.destroy();
      const { texture, bindGroup } = createDataTexture(
        device, bindGroupLayout, uniformBuffer, sampler, cols, rows, textureFormat,
      );
      r.dataTexture  = texture;
      r.bindGroup    = bindGroup;
      dataDimsRef.current = { rows, cols };
    }

    if (!r.dataTexture) return;

    if (textureFormat === 'r32float') {
      device.queue.writeTexture(
        { texture: r.dataTexture },
        flat.buffer,
        { bytesPerRow: cols * 4 },
        { width: cols, height: rows },
      );
    } else {
      const half = float32ToFloat16Array(flat);
      device.queue.writeTexture(
        { texture: r.dataTexture },
        half.buffer,
        { bytesPerRow: cols * 2 },
        { width: cols, height: rows },
      );
    }
  }, [data, gpuSolverEnabled, dataVersion]);

  // -------------------------------------------------------------------------
  // Rebuild sampler when smoothing changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    const r = renderRef.current;
    if (!r || !isInitRef.current) return;
    const { device, bindGroupLayout, uniformBuffer, textureFormat } = r;
    const filterMode: GPUFilterMode = smoothing ? 'linear' : 'nearest';
    const newSampler = device.createSampler({
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      magFilter: filterMode,
      minFilter: filterMode,
    });
    r.sampler = newSampler;
    if (r.dataTexture) {
      const { rows, cols } = dataDimsRef.current;
      const { texture, bindGroup } = createDataTexture(
        device, bindGroupLayout, uniformBuffer, newSampler, cols, rows, textureFormat,
      );
      r.dataTexture.destroy();
      r.dataTexture = texture;
      r.bindGroup   = bindGroup;
    }
  }, [smoothing]);

  // -------------------------------------------------------------------------
  // Initialize / tear-down GPU compute solver
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reinitialize GPU compute when solver params change
  useEffect(() => {
    if (!gpuSolverEnabled || !gpuAvailable) return;
    if (!data || data.length === 0) return;
    if (!initCompleteRef.current) {
      // Init is still in progress — retry after a short delay (max 50 retries = 5s)
      retryCountRef.current++;
      if (retryCountRef.current < 50) {
        const timer = setTimeout(() => setDataVersion(v => v + 1), 100);
        return () => clearTimeout(timer);
      }
      return;
    }
    const r = renderRef.current;
    if (!r) return;

    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    if (cols === 0) return;

    const { device, bindGroupLayout, uniformBuffer, sampler, textureFormat } = r;

    // Destroy old compute resources
    const oldC = computeRef.current;
    if (oldC) destroyComputeResources(oldC);
    computeRef.current = null;

    stagingBufRef.current?.destroy();
    stagingBufRef.current = null;

    // Flatten initial data
    const initialFlat = flattenGrid(data);

    // Build Laplace boundary mask: borders are fixed
    let maskFlat: Uint32Array | null = null;
    if (equationType === 'laplace') {
      maskFlat = new Uint32Array(rows * cols);
      for (let r2 = 0; r2 < rows; r2++) {
        for (let c2 = 0; c2 < cols; c2++) {
          if (r2 === 0 || r2 === rows - 1 || c2 === 0 || c2 === cols - 1) {
            maskFlat[r2 * cols + c2] = 1;
          }
        }
      }
    }

    const PARTICLE_COUNT = 2048;
    const compute = buildComputeResources(
      device, equationType, initialFlat, cols, rows, PARTICLE_COUNT, maskFlat,
    );
    computeRef.current = compute;

    // Write initial PDE uniforms
    const dt = equationType === 'wave' ? 0.005 : 0.01;
    const dx = 1.0;
    const alphaOrC2 = equationType === 'wave' ? solverAlpha * solverAlpha : solverAlpha;
    writePdeUniforms(compute.pdeUniformBuf, device, cols, rows, dt, dx, alphaOrC2);

    // Create heatmap texture from initial data and build render bind group
    r.dataTexture?.destroy();
    const { texture, bindGroup } = createDataTexture(
      device, bindGroupLayout, uniformBuffer, sampler, cols, rows, textureFormat,
    );
    r.dataTexture = texture;
    r.bindGroup   = bindGroup;
    dataDimsRef.current = { rows, cols };

    // Upload initial data to texture
    if (textureFormat === 'r32float') {
      // Flip vertically for display (row-0 of data at top)
      const flipped = new Float32Array(rows * cols);
      for (let i = 0; i < rows; i++) {
        const srcRow = data[rows - 1 - i];
        if (srcRow) {
          for (let j = 0; j < cols; j++) {
            flipped[i * cols + j] = srcRow[j] ?? 0;
          }
        }
      }
      device.queue.writeTexture(
        { texture },
        flipped.buffer,
        { bytesPerRow: cols * 4 },
        { width: cols, height: rows },
      );
    } else {
      const flipped = new Float32Array(rows * cols);
      for (let i = 0; i < rows; i++) {
        const srcRow = data[rows - 1 - i];
        if (srcRow) {
          for (let j = 0; j < cols; j++) {
            flipped[i * cols + j] = srcRow[j] ?? 0;
          }
        }
      }
      const half = float32ToFloat16Array(flipped);
      device.queue.writeTexture(
        { texture },
        half.buffer,
        { bytesPerRow: cols * 2 },
        { width: cols, height: rows },
      );
    }

    // Create staging buffer for readback
    stagingBufRef.current = device.createBuffer({
      size: rows * cols * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

  }, [gpuSolverEnabled, equationType, gpuAvailable, dataVersion, data, solverAlpha]);

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restart render loop on relevant state changes
  useEffect(() => {
    if (!gpuAvailable) return;

    let running = true;
    let fpsEpoch = performance.now();
    fpsEpochRef.current = fpsEpoch;
    frameCountRef.current = 0;

    const render = (now: number) => {
      if (!running) return;

      // FPS counter
      frameCountRef.current++;
      if (now - fpsEpoch >= 1000) {
        const currentFps = frameCountRef.current;
        setFps(currentFps);
        if (onFps) onFps(currentFps);
        frameCountRef.current = 0;
        fpsEpoch = now;
        fpsEpochRef.current = fpsEpoch;
      }

      const r = renderRef.current;
      if (!r || !isInitRef.current) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // ---- GPU compute step (when enabled) ----
      const c = computeRef.current;
      if (gpuSolverEnabled && c) {
        const { device } = r;
        const encoder = device.createCommandEncoder();
        const { gridW, gridH } = c;

        // Determine iteration count
        const stepsPerFrame = equationType === 'laplace' ? 8 : 1;

        for (let step = 0; step < stepsPerFrame; step++) {
          const bindGroupPde = c.pingPong === 0 ? c.pdeBindGroupA : c.pdeBindGroupB;
          const computePass = encoder.beginComputePass();
          computePass.setPipeline(c.pdePipeline);
          computePass.setBindGroup(0, bindGroupPde);
          computePass.dispatchWorkgroups(
            Math.ceil(gridW / 16),
            Math.ceil(gridH / 16),
          );
          computePass.end();

          // Swap ping-pong
          c.pingPong = c.pingPong === 0 ? 1 : 0;
        }

        // Gradient pass (reads current buffer)
        const currentBuf = c.pingPong === 0 ? c.bufA : c.bufB;
        const gradBindGroup = c.pingPong === 0 ? c.gradBindGroupA : c.gradBindGroupB;

        if (showParticles) {
          const gradPass = encoder.beginComputePass();
          gradPass.setPipeline(c.gradientPipeline);
          gradPass.setBindGroup(0, gradBindGroup);
          gradPass.dispatchWorkgroups(
            Math.ceil(gridW / 16),
            Math.ceil(gridH / 16),
          );
          gradPass.end();

          // Particle advection pass
          const partPass = encoder.beginComputePass();
          partPass.setPipeline(c.particlePipeline);
          partPass.setBindGroup(0, c.particleBindGroup);
          partPass.dispatchWorkgroups(Math.ceil(c.particleCount / 64));
          partPass.end();
        }

        // Copy current GPU buffer to the heatmap texture for rendering
        if (r.dataTexture) {
          encoder.copyBufferToTexture(
            { buffer: currentBuf, bytesPerRow: gridW * 4 },
            { texture: r.dataTexture },
            { width: gridW, height: gridH },
          );
        }

        device.queue.submit([encoder.finish()]);

        // Read back particle positions to canvas 2D overlay asynchronously
        if (showParticles) {
          void readbackAndDrawParticles(c, r, width, height);
        } else {
          // Clear overlay
          const overlay = overlayCanvasRef.current;
          if (overlay) {
            const ctx2d = overlay.getContext('2d');
            ctx2d?.clearRect(0, 0, overlay.width, overlay.height);
          }
        }
      }

      // ---- Render pass ----
      if (r.bindGroup) {
        const { device, context, pipeline, uniformBuffer, bindGroup } = r;

        const uniformData = new Float32Array(4);
        uniformData[0] = minValue;
        uniformData[1] = maxValue;
        const uniformDataView = new DataView(uniformData.buffer);
        uniformDataView.setUint32(8, colorMode === 'heat' ? 0 : 1, true);
        uniformDataView.setUint32(12, 0, true);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

        const encoder2 = device.createCommandEncoder();
        const view     = context.getCurrentTexture().createView();
        const pass = encoder2.beginRenderPass({
          colorAttachments: [{
            view,
            clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder2.finish()]);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [minValue, maxValue, colorMode, gpuAvailable, gpuSolverEnabled, equationType, showParticles, width, height, onFps]);

  // -------------------------------------------------------------------------
  // Async particle readback + 2D overlay draw
  // -------------------------------------------------------------------------
  async function readbackAndDrawParticles(
    c: ComputeResources,
    r: RenderResources,
    canvasW: number,
    canvasH: number,
  ): Promise<void> {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    const staging = stagingBufRef.current;
    if (!staging) return;

    // We re-use the staging buffer for particles: it must be large enough
    const particleByteSize = c.particleCount * 4 * 4;
    if (staging.size < particleByteSize) return;

    const { device } = r;

    // Copy particle buffer to staging
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(c.particleBuf, 0, staging, 0, particleByteSize);
    device.queue.submit([enc.finish()]);

    await staging.mapAsync(GPUMapMode.READ, 0, particleByteSize);
    const mapped = staging.getMappedRange(0, particleByteSize);
    const positions = new Float32Array(mapped.slice(0));
    staging.unmap();

    // Draw on 2D canvas overlay
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < c.particleCount; i++) {
      const px  = positions[i * 4 + 0] ?? 0;
      const py  = positions[i * 4 + 1] ?? 0;
      const age = positions[i * 4 + 2] ?? 0;
      if (px < 0 || px > 1 || py < 0 || py > 1) continue;

      // Fade out near end of life
      const alpha = Math.min(1.0, (4.0 - age) / 1.0);
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.arc(px * canvasW, py * canvasH, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  // -------------------------------------------------------------------------
  // Mouse interaction
  // -------------------------------------------------------------------------
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !data || data.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const cols = data[0]?.length ?? 0;
      const rows = data.length;
      const x = Math.floor(((e.clientX - rect.left) / rect.width)  * cols);
      const y = Math.floor(((e.clientY - rect.top)  / rect.height) * rows);
      if (y >= 0 && y < rows && x >= 0 && x < cols) {
        setHoveredValue({ x, y, value: data[y]?.[x] ?? 0 });
      }
    },
    [data],
  );

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  // -------------------------------------------------------------------------
  // Fallback to WebGL
  // -------------------------------------------------------------------------
  if (!gpuAvailable) {
    return (
      <WebGLHeatmap
        data={data}
        minValue={minValue}
        maxValue={maxValue}
        colorMode={colorMode}
        width={width}
        height={height}
        smoothing={smoothing}
        {...(onReady !== undefined ? { onReady } : {})}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const backendLabel = gpuSolverEnabled ? 'WebGPU Compute' : 'WebGPU';

  return (
    <div className="relative w-full group flex items-center justify-center">
      {/* Main heatmap canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block rounded-lg max-w-full"
        style={{
          imageRendering: smoothing ? 'auto' : 'pixelated',
          aspectRatio: '1 / 1',
          width: '100%',
          maxWidth: `${width}px`,
          height: 'auto',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-label="PDE simulation heatmap"
        role="img"
      />

      {/* Particle overlay canvas (transparent, positioned on top) */}
      {showParticles && (
        <canvas
          ref={overlayCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0 block rounded-lg max-w-full pointer-events-none"
          style={{
            aspectRatio: '1 / 1',
            width: '100%',
            maxWidth: `${width}px`,
            height: 'auto',
          }}
          aria-hidden="true"
        />
      )}

      {/* FPS overlay */}
      <div
        className="absolute top-2 right-2 px-3 py-1.5 rounded-lg backdrop-blur-md bg-black/40 border border-white/10 text-xs font-mono text-emerald-400 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        aria-live="polite"
        aria-atomic="true"
        suppressHydrationWarning
      >
        <span suppressHydrationWarning>{fps} FPS</span>
        <span suppressHydrationWarning> · {backendLabel}</span>
      </div>

      {/* Value inspector */}
      {hoveredValue !== null && (
        <div
          className="absolute top-2 left-2 px-3 py-2 rounded-lg backdrop-blur-md bg-black/40 border border-white/10 text-xs font-mono text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-1 mb-1">
            <Info className="w-3 h-3 text-blue-400" />
            <span className="text-blue-400">Grid Position</span>
          </div>
          <div className="space-y-0.5">
            <div><span className="text-muted-foreground">X:</span> {hoveredValue.x}</div>
            <div><span className="text-muted-foreground">Y:</span> {hoveredValue.y}</div>
            <div>
              <span className="text-muted-foreground">Value:</span>{' '}
              <span className="text-yellow-400">{hoveredValue.value.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Low-FPS warning */}
      {fps > 0 && fps < 30 && (
        <div className="absolute bottom-2 left-2 px-3 py-1.5 rounded-lg backdrop-blur-md bg-orange-500/20 border border-orange-500/30 text-xs text-orange-300 shadow-lg">
          Low FPS detected — consider reducing grid size
        </div>
      )}
    </div>
  );
}
