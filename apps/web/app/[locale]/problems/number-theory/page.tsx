'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Divide,
  GitBranch,
  Grid,
  Hash,
  Infinity,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DisplayMath, MathRenderer } from '@/components/ui/math-renderer';
import { cn } from '@/lib/utils';

// =============================================================================
// WEBGPU DETECTION
// =============================================================================

const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

// =============================================================================
// WGSL SHADERS
// =============================================================================

/**
 * SIEVE GRID SHADER
 *
 * Renders a grid of cells for the Sieve of Eratosthenes.
 * Each cell is an instance with (col, row, state) packed into a storage buffer.
 * state: 0=default, 1=prime, 2=eliminated, 3=current-factor
 */
const SIEVE_SHADER = /* wgsl */ `
struct Uniforms {
  cols    : u32,
  rows    : u32,
  cellPx  : f32,
  canvasW : f32,
  canvasH : f32,
  _p0     : f32,
  _p1     : f32,
  _p2     : f32,
}

// Each cell: col(u32), row(u32), state(u32), _pad(u32)
struct CellData {
  col   : u32,
  row   : u32,
  state : u32,
  _pad  : u32,
}

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var<storage, read> cells : array<CellData>;

struct VOut {
  @builtin(position) pos   : vec4<f32>,
  @location(0)       color : vec4<f32>,
  @location(1)       uv    : vec2<f32>,
}

const QUAD : array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(0.0, 0.0),
  vec2<f32>(1.0, 0.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(0.0, 0.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(0.0, 1.0),
);

fn stateToColor(state : u32) -> vec4<f32> {
  switch state {
    case 1u: { return vec4<f32>(0.133, 0.773, 0.369, 1.0); }  // prime: green-500
    case 2u: { return vec4<f32>(0.937, 0.267, 0.267, 1.0); }  // eliminated: red-500
    case 3u: { return vec4<f32>(0.961, 0.620, 0.043, 1.0); }  // current: amber-500
    default: { return vec4<f32>(0.886, 0.910, 0.941, 0.85); } // default: slate-200
  }
}

@vertex
fn vs_main(
  @builtin(vertex_index)   vi   : u32,
  @builtin(instance_index) inst : u32,
) -> VOut {
  let cell = cells[inst];
  let q = QUAD[vi];

  // Cell top-left in pixel space
  let pad = 1.0;
  let size = uni.cellPx - pad * 2.0;
  let px = f32(cell.col) * uni.cellPx + pad + q.x * size;
  let py = f32(cell.row) * uni.cellPx + pad + q.y * size;

  // Pixel to NDC
  let nx = (px / uni.canvasW) * 2.0 - 1.0;
  let ny = 1.0 - (py / uni.canvasH) * 2.0;

  var out : VOut;
  out.pos   = vec4<f32>(nx, ny, 0.0, 1.0);
  out.color = stateToColor(cell.state);
  out.uv    = q;
  return out;
}

@fragment
fn fs_main(in : VOut) -> @location(0) vec4<f32> {
  // Rounded corner SDF: distance from inside of cell, corner radius 0.15
  let p = in.uv * 2.0 - vec2<f32>(1.0);
  let r = 0.15;
  let q = abs(p) - vec2<f32>(1.0 - r);
  let dist = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - r;
  let alpha = in.color.a * (1.0 - smoothstep(-0.02, 0.02, dist));
  return vec4<f32>(in.color.rgb, alpha);
}
`;

/**
 * BAR CHART SHADER
 *
 * Renders a bar chart via instanced rendering.
 * Each bar is an instance with (barIndex, normalizedHeight, r, g, b).
 */
const BAR_SHADER = /* wgsl */ `
struct Uniforms {
  barCount : u32,
  canvasW  : f32,
  canvasH  : f32,
  padPx    : f32,
}

struct BarData {
  barIndex : u32,
  normH    : f32,
  r        : f32,
  g        : f32,
  b        : f32,
  _p0      : f32,
  _p1      : f32,
  _p2      : f32,
}

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var<storage, read> bars : array<BarData>;

struct VOut {
  @builtin(position) pos   : vec4<f32>,
  @location(0)       color : vec3<f32>,
  @location(1)       normY : f32,
}

const QUAD : array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(0.0, 0.0),
  vec2<f32>(1.0, 0.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(0.0, 0.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(0.0, 1.0),
);

@vertex
fn vs_main(
  @builtin(vertex_index)   vi   : u32,
  @builtin(instance_index) inst : u32,
) -> VOut {
  let bar = bars[inst];
  let q = QUAD[vi];

  let plotW = uni.canvasW - uni.padPx * 2.0;
  let plotH = uni.canvasH - uni.padPx * 2.0 - 20.0;
  let barW = plotW / f32(uni.barCount);
  let barH = bar.normH * plotH;

  // Bar left-right in pixel coords
  let bx = uni.padPx + f32(bar.barIndex) * barW + 1.0 + q.x * (barW - 2.0);
  // Bar bottom is canvas bottom - pad, top is that minus barH
  let baseY = uni.canvasH - uni.padPx - 20.0;
  let by = baseY - barH + q.y * barH;

  let nx = (bx / uni.canvasW) * 2.0 - 1.0;
  let ny = 1.0 - (by / uni.canvasH) * 2.0;

  var out : VOut;
  out.pos   = vec4<f32>(nx, ny, 0.0, 1.0);
  out.color = vec3<f32>(bar.r, bar.g, bar.b);
  out.normY = q.y;
  return out;
}

@fragment
fn fs_main(in : VOut) -> @location(0) vec4<f32> {
  // Vertical gradient: brighter at top
  let brightness = 0.7 + in.normY * 0.3;
  return vec4<f32>(in.color * brightness, 1.0);
}
`;

/**
 * LINE PLOT SHADER
 *
 * Renders a polyline as instanced quads (segment-per-instance).
 * Each segment: (x0,y0,x1,y1,r,g,b,_pad)
 */
const LINE_SHADER = /* wgsl */ `
struct Uniforms {
  minVal   : f32,
  maxVal   : f32,
  numPts   : u32,
  canvasW  : f32,
  canvasH  : f32,
  padPx    : f32,
  lineW    : f32,
  _p       : f32,
}

struct SegData {
  x0 : f32,
  y0 : f32,
  x1 : f32,
  y1 : f32,
  r  : f32,
  g  : f32,
  b  : f32,
  _p : f32,
}

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var<storage, read> segs : array<SegData>;

struct VOut {
  @builtin(position) pos   : vec4<f32>,
  @location(0)       color : vec3<f32>,
  @location(1)       sideUV: f32,
}

const QUAD : array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0, -1.0),
  vec2<f32>( 1.0,  1.0),
  vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0,  1.0),
  vec2<f32>(-1.0,  1.0),
);

fn pixelToNDC(p : vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    (p.x / uni.canvasW) * 2.0 - 1.0,
    1.0 - (p.y / uni.canvasH) * 2.0,
  );
}

@vertex
fn vs_main(
  @builtin(vertex_index)   vi   : u32,
  @builtin(instance_index) inst : u32,
) -> VOut {
  let seg = segs[inst];
  let q = QUAD[vi];

  let p0 = pixelToNDC(vec2<f32>(seg.x0, seg.y0));
  let p1 = pixelToNDC(vec2<f32>(seg.x1, seg.y1));

  let dir  = normalize(p1 - p0);
  let perp = vec2<f32>(-dir.y, dir.x);
  let halfW = uni.lineW / uni.canvasH;

  let base   = mix(p0, p1, (q.x + 1.0) * 0.5);
  let offset = perp * halfW * q.y;

  var out : VOut;
  out.pos    = vec4<f32>(base + offset, 0.0, 1.0);
  out.color  = vec3<f32>(seg.r, seg.g, seg.b);
  out.sideUV = (q.y + 1.0) * 0.5;
  return out;
}

@fragment
fn fs_main(in : VOut) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.65, 1.0, abs(in.sideUV * 2.0 - 1.0));
  return vec4<f32>(in.color * alpha, alpha);
}
`;

// =============================================================================
// GPU INIT HELPERS
// =============================================================================

interface SieveGPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  cellBuffer: GPUBuffer;
  maxCells: number;
}

interface BarGPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  barBuffer: GPUBuffer;
  maxBars: number;
}

interface LineGPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  segBuffer: GPUBuffer;
  maxSegs: number;
}

async function initGPUWithShader(
  canvas: HTMLCanvasElement,
  wgslCode: string,
  vertEntry: string,
  fragEntry: string,
  bindGroupLayout: GPUBindGroupLayoutDescriptor,
  width: number,
  height: number,
  blendAlpha: boolean,
): Promise<{
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  format: GPUTextureFormat;
} | null> {
  if (!supportsWebGPU) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) return null;

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    canvas.width = width;
    canvas.height = height;

    const shader = device.createShaderModule({ code: wgslCode });
    const bgl = device.createBindGroupLayout(bindGroupLayout);

    const blend: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };

    const pipeline = await device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: { module: shader, entryPoint: vertEntry },
      fragment: {
        module: shader,
        entryPoint: fragEntry,
        targets: [{ format, ...(blendAlpha ? { blend } : {}) }],
      },
      primitive: { topology: 'triangle-list' },
    });

    return { device, context, pipeline, format };
  } catch {
    return null;
  }
}

// GPUShaderStage enum constants — inlined to avoid SSR ReferenceError
// (GPUShaderStage is a browser-only global, unavailable during Next.js static generation)
const GPU_VERTEX = 0x1;
const GPU_FRAGMENT = 0x2;
const GPU_COMPUTE = 0x4;

const SIEVE_BGL: GPUBindGroupLayoutDescriptor = {
  entries: [
    { binding: 0, visibility: GPU_VERTEX | GPU_FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPU_VERTEX, buffer: { type: 'read-only-storage' } },
  ],
};

async function initSieveGPU(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  maxCells: number,
): Promise<SieveGPUResources | null> {
  const base = await initGPUWithShader(
    canvas,
    SIEVE_SHADER,
    'vs_main',
    'fs_main',
    SIEVE_BGL,
    w,
    h,
    true,
  );
  if (!base) return null;
  const { device, context, pipeline } = base;
  // Uniform: cols(u32), rows(u32), cellPx(f32), canvasW(f32), canvasH(f32), _p0,_p1,_p2 = 32 bytes
  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Each cell: col(u32), row(u32), state(u32), _pad(u32) = 16 bytes
  const cellBuffer = device.createBuffer({
    size: maxCells * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  return { device, context, pipeline, uniformBuffer, cellBuffer, maxCells };
}

async function initBarGPU(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  maxBars: number,
): Promise<BarGPUResources | null> {
  const base = await initGPUWithShader(
    canvas,
    BAR_SHADER,
    'vs_main',
    'fs_main',
    SIEVE_BGL,
    w,
    h,
    false,
  );
  if (!base) return null;
  const { device, context, pipeline } = base;
  // Uniform: barCount(u32), canvasW(f32), canvasH(f32), padPx(f32) = 16 bytes
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Each bar: barIndex(u32), normH(f32), r,g,b(f32), _p0,_p1,_p2(f32) = 32 bytes
  const barBuffer = device.createBuffer({
    size: maxBars * 32,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  return { device, context, pipeline, uniformBuffer, barBuffer, maxBars };
}

async function initLineGPU(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  maxSegs: number,
): Promise<LineGPUResources | null> {
  const base = await initGPUWithShader(
    canvas,
    LINE_SHADER,
    'vs_main',
    'fs_main',
    SIEVE_BGL,
    w,
    h,
    true,
  );
  if (!base) return null;
  const { device, context, pipeline } = base;
  // Uniform: minVal,maxVal(f32), numPts(u32), canvasW,canvasH,padPx,lineW,_p(f32) = 32 bytes
  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Each seg: x0,y0,x1,y1,r,g,b,_p = 8 floats = 32 bytes
  const segBuffer = device.createBuffer({
    size: maxSegs * 32,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  return { device, context, pipeline, uniformBuffer, segBuffer, maxSegs };
}

// =============================================================================
// GPU SIEVE COMPUTE SHADER
// =============================================================================

/**
 * SIEVE COMPUTE SHADER
 *
 * Each dispatch call marks all multiples of a given prime as composite.
 * Buffer layout:
 *   binding 0 (uniform): SieveUniforms { prime: u32, sieveSize: u32 }
 *   binding 1 (storage read_write): array<u32>  — 0 = prime candidate, 1 = composite
 *
 * Workgroup size: 256 threads.
 * Thread global_id.x handles the composite at index: prime*prime + global_id.x * prime
 * i.e. thread k marks the (k+1)-th multiple starting from prime^2.
 */
const SIEVE_COMPUTE_SHADER = /* wgsl */ `
struct SieveUniforms {
  prime     : u32,
  sieveSize : u32,
}

@group(0) @binding(0) var<uniform>            uni    : SieveUniforms;
@group(0) @binding(1) var<storage, read_write> sieve  : array<u32>;

@compute @workgroup_size(256)
fn cs_main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let p      = uni.prime;
  let limit  = uni.sieveSize;
  // The (gid.x + 1)-th multiple of p at or above p*p
  // multiple index = p*p + gid.x * p  =>  (p + gid.x) * p
  let index  = (p + gid.x) * p;
  if (index < limit && index < arrayLength(&sieve)) {
    sieve[index] = 1u;
  }
}
`;

// Compute BGL: uniform at 0 (compute), storage read_write at 1 (compute)
const SIEVE_COMPUTE_BGL: GPUBindGroupLayoutDescriptor = {
  entries: [
    { binding: 0, visibility: GPU_COMPUTE, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPU_COMPUTE, buffer: { type: 'storage' } },
  ],
};

interface SieveComputeGPUResources {
  device: GPUDevice;
  computePipeline: GPUComputePipeline;
  computeUniformBuffer: GPUBuffer;
  sieveBuffer: GPUBuffer;
  stagingBuffer: GPUBuffer;
  sieveSize: number;
}

async function initSieveComputeGPU(sieveSize: number): Promise<SieveComputeGPUResources | null> {
  if (!supportsWebGPU) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const device = await adapter.requestDevice();

    const shader = device.createShaderModule({ code: SIEVE_COMPUTE_SHADER });
    const bgl = device.createBindGroupLayout(SIEVE_COMPUTE_BGL);

    const computePipeline = await device.createComputePipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      compute: { module: shader, entryPoint: 'cs_main' },
    });

    // Uniform: prime(u32) + sieveSize(u32) = 8 bytes
    const computeUniformBuffer = device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Sieve buffer: one u32 per number 0..sieveSize-1
    // 0 = prime candidate, 1 = composite
    const alignedSize = Math.ceil(sieveSize / 4) * 4;
    const sieveBuffer = device.createBuffer({
      size: alignedSize * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // Staging buffer for CPU readback
    const stagingBuffer = device.createBuffer({
      size: alignedSize * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    return { device, computePipeline, computeUniformBuffer, sieveBuffer, stagingBuffer, sieveSize };
  } catch {
    return null;
  }
}

/**
 * Run one GPU compute step: dispatch a shader that marks all multiples
 * of `prime` (starting at prime^2) as composite, then read back the
 * full sieve buffer and return it as a Uint32Array.
 */
async function gpuSieveStep(
  resources: SieveComputeGPUResources,
  prime: number,
): Promise<Uint32Array | null> {
  const { device, computePipeline, computeUniformBuffer, sieveBuffer, stagingBuffer, sieveSize } =
    resources;

  // Write uniform: prime, sieveSize
  const uniData = new Uint32Array([prime, sieveSize]);
  device.queue.writeBuffer(computeUniformBuffer, 0, uniData);

  const bgl = computePipeline.getBindGroupLayout(0);
  const bindGroup = device.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: computeUniformBuffer } },
      { binding: 1, resource: { buffer: sieveBuffer } },
    ],
  });

  // Number of multiples to mark = ceil((sieveSize - prime*prime) / prime)
  const startIdx = prime * prime;
  if (startIdx >= sieveSize) {
    // No multiples to mark, just read back current buffer
  } else {
    const numMultiples = Math.ceil((sieveSize - startIdx) / prime);
    // Dispatch enough workgroups to cover all multiples
    const workgroupCount = Math.ceil(numMultiples / 256);

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();

    // Copy sieve buffer to staging for readback
    enc.copyBufferToBuffer(sieveBuffer, 0, stagingBuffer, 0, sieveBuffer.size);
    device.queue.submit([enc.finish()]);
  }

  // Map and read staging buffer
  try {
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const raw = stagingBuffer.getMappedRange();
    const result = new Uint32Array(raw.slice(0));
    stagingBuffer.unmap();
    return result;
  } catch {
    return null;
  }
}

/**
 * Initialize the GPU sieve buffer by marking 0 and 1 as composite,
 * and everything else as 0 (prime candidate). Returns the initial
 * Uint32Array state.
 */
async function gpuSieveInit(resources: SieveComputeGPUResources): Promise<Uint32Array | null> {
  const { device, sieveBuffer, stagingBuffer, sieveSize } = resources;

  // Build initial state: 0,1 = composite (1); rest = prime candidate (0)
  const initial = new Uint32Array(Math.ceil(sieveSize / 4) * 4);
  initial[0] = 1;
  if (sieveSize > 1) initial[1] = 1;

  device.queue.writeBuffer(sieveBuffer, 0, initial);

  // Readback to confirm
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(sieveBuffer, 0, stagingBuffer, 0, stagingBuffer.size);
  device.queue.submit([enc.finish()]);

  try {
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const raw = stagingBuffer.getMappedRange();
    const result = new Uint32Array(raw.slice(0));
    stagingBuffer.unmap();
    return result;
  } catch {
    return null;
  }
}

// =============================================================================
// NUMBER THEORY COMPUTATION ENGINE
// =============================================================================

function safeNum(n: bigint): number {
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > MAX) return Number.MAX_SAFE_INTEGER;
  if (n < -MAX) return -Number.MAX_SAFE_INTEGER;
  return Number(n);
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a / gcd(a, b)) * b;
}

interface GCDStep {
  a: bigint;
  b: bigint;
  quotient: bigint;
  remainder: bigint;
}

function euclideanSteps(a: bigint, b: bigint): GCDStep[] {
  const steps: GCDStep[] = [];
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const q = x / y;
    const r = x % y;
    steps.push({ a: x, b: y, quotient: q, remainder: r });
    x = y;
    y = r;
  }
  return steps;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % mod;
    e /= 2n;
    b = (b * b) % mod;
  }
  return result;
}

function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n || n === 5n || n === 7n) return true;
  if (n % 2n === 0n || n % 3n === 0n || n % 5n === 0n) return false;

  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    r++;
  }

  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

  outerLoop: for (const a of witnesses) {
    if (a >= n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 0n; i < r - 1n; i++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) continue outerLoop;
    }
    return false;
  }
  return true;
}

function modInverse(a: bigint, m: bigint): bigint | null {
  const extGcd = (x: bigint, y: bigint): [bigint, bigint, bigint] => {
    if (y === 0n) return [x, 1n, 0n];
    const [g, x1, y1] = extGcd(y, x % y);
    return [g, y1, x1 - (x / y) * y1];
  };
  const [g, x] = extGcd(((a % m) + m) % m, m);
  if (g !== 1n) return null;
  return ((x % m) + m) % m;
}

interface FactorResult {
  factor: bigint;
  exponent: number;
}

function primeFactorization(n: bigint): FactorResult[] {
  const factors: FactorResult[] = [];
  let remaining = n < 0n ? -n : n;
  if (remaining <= 1n) return factors;
  for (let f = 2n; f * f <= remaining; f++) {
    if (remaining % f === 0n) {
      let exp = 0;
      while (remaining % f === 0n) {
        remaining /= f;
        exp++;
      }
      factors.push({ factor: f, exponent: exp });
    }
  }
  if (remaining > 1n) factors.push({ factor: remaining, exponent: 1 });
  return factors;
}

function eulerTotient(n: bigint): bigint {
  if (n <= 0n) return 0n;
  if (n === 1n) return 1n;
  const factors = primeFactorization(n);
  let result = n;
  for (const { factor } of factors) result = (result / factor) * (factor - 1n);
  return result;
}

function totientSteps(n: bigint): Array<{ text: string; latex: string }> {
  const factors = primeFactorization(n);
  if (factors.length === 0) return [{ text: 'φ(1) = 1 by definition', latex: '\\varphi(1) = 1' }];

  const steps: Array<{ text: string; latex: string }> = [];
  const factorStr = factors
    .map(({ factor, exponent }) => (exponent === 1 ? `${factor}` : `${factor}^{${exponent}}`))
    .join(' \\cdot ');
  steps.push({ text: `Factor ${n}`, latex: `${n} = ${factorStr}` });
  steps.push({
    text: 'Apply multiplicativity of φ',
    latex: `\\varphi(n) = n \\prod_{p \\mid n} \\left(1 - \\frac{1}{p}\\right)`,
  });
  const parts = factors.map(({ factor }) => `\\left(1 - \\frac{1}{${factor}}\\right)`).join('');
  steps.push({ text: 'Substitute prime factors', latex: `\\varphi(${n}) = ${n} \\cdot ${parts}` });
  steps.push({ text: 'Result', latex: `\\varphi(${n}) = ${eulerTotient(n)}` });
  return steps;
}

function fibonacci(n: number): bigint {
  if (n <= 0) return 0n;
  if (n === 1) return 1n;
  let a = 0n,
    b = 1n;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function lucas(n: number): bigint {
  if (n === 0) return 2n;
  if (n === 1) return 1n;
  let a = 2n,
    b = 1n;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function collatz(n: bigint, maxSteps = 500): bigint[] {
  const seq: bigint[] = [n];
  let cur = n;
  while (cur !== 1n && seq.length < maxSteps) {
    cur = cur % 2n === 0n ? cur / 2n : 3n * cur + 1n;
    seq.push(cur);
  }
  return seq;
}

function sieve(limit: number): boolean[] {
  const composite = new Uint8Array(limit + 1);
  composite[0] = 1;
  composite[1] = 1;
  for (let i = 2; i * i <= limit; i++) {
    if (!composite[i]) {
      for (let j = i * i; j <= limit; j += i) composite[j] = 1;
    }
  }
  return Array.from({ length: limit + 1 }, (_, i) => !composite[i]);
}

// =============================================================================
// SHARED UI PRIMITIVES
// =============================================================================

function SectionHeader({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0',
          gradient,
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FormulaBox({ latex, displayMode = true }: { latex: string; displayMode?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 border px-4 py-3 overflow-x-auto">
      <MathRenderer expression={latex} displayMode={displayMode} />
    </div>
  );
}

function StepList({ steps }: { steps: Array<{ label: string; latex: string; note?: string }> }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex gap-3 items-start"
        >
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{step.label}</p>
            <div className="mt-1 rounded bg-muted/40 px-3 py-1 overflow-x-auto">
              <MathRenderer expression={step.latex} displayMode={false} />
            </div>
            {step.note && <p className="text-xs text-muted-foreground mt-1">{step.note}</p>}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

// =============================================================================
// RENDER MODE BADGE
// =============================================================================

function RenderModeBadge({ mode }: { mode: 'WebGPU' | 'Canvas 2D' }) {
  return (
    <div className="absolute top-2 right-2 pointer-events-none z-10">
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-mono backdrop-blur-sm border ${
          mode === 'WebGPU'
            ? 'bg-violet-900/60 border-violet-500/40 text-violet-300'
            : 'bg-muted/60 border-border text-muted-foreground'
        }`}
      >
        {mode}
      </span>
    </div>
  );
}

// =============================================================================
// 1. PRIME CHECKER
// =============================================================================

function PrimeChecker() {
  const [input, setInput] = useState('97');
  const [result, setResult] = useState<{
    n: bigint;
    prime: boolean;
    factors: FactorResult[];
  } | null>(null);
  const [error, setError] = useState('');

  const check = useCallback(() => {
    setError('');
    const trimmed = input.trim();
    if (!/^\d+$/.test(trimmed)) {
      setError('Enter a positive integer.');
      return;
    }
    try {
      const n = BigInt(trimmed);
      if (n < 2n) {
        setError('Enter an integer ≥ 2.');
        return;
      }
      if (n > 10n ** 18n) {
        setError('Number too large (max 10¹⁸).');
        return;
      }
      setResult({ n, prime: isPrime(n), factors: primeFactorization(n) });
    } catch {
      setError('Invalid input.');
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Hash}
        title="Prime Checker"
        description="Test whether a number is prime using deterministic Miller-Rabin."
        gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && check()}
                placeholder="Enter a positive integer"
                className="font-mono"
                aria-label="Number to test for primality"
              />
              <Button onClick={check} aria-label="Check primality">
                Check
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid grid-cols-3 gap-2">
              {[2n, 17n, 97n, 100n, 561n, 999983n].map((n) => (
                <Button
                  key={String(n)}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(String(n));
                    setError('');
                  }}
                  className="font-mono text-xs"
                >
                  {String(n)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={String(result.n)}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card
                className={cn(
                  'border-l-4',
                  result.prime ? 'border-l-green-500' : 'border-l-amber-500',
                )}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {result.prime ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : (
                      <XCircle className="w-8 h-8 text-amber-500" />
                    )}
                    <div>
                      <CardTitle className="text-base font-mono">{String(result.n)}</CardTitle>
                      <Badge variant={result.prime ? 'default' : 'secondary'} className="mt-1">
                        {result.prime ? 'PRIME' : 'COMPOSITE'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.prime ? (
                    <div className="space-y-2">
                      <FormulaBox
                        latex={`${String(result.n)} \\text{ is prime}`}
                        displayMode={false}
                      />
                      <p className="text-sm text-muted-foreground">
                        Divisible only by 1 and itself. Verified via deterministic Miller-Rabin with
                        witnesses {'{2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37}'}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Prime factorization:</p>
                      <FormulaBox
                        latex={
                          String(result.n) +
                          ' = ' +
                          result.factors
                            .map(({ factor, exponent }) =>
                              exponent === 1 ? String(factor) : `${factor}^{${exponent}}`,
                            )
                            .join(' \\times ')
                        }
                        displayMode={false}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Miller-Rabin Primality Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormulaBox latex="n - 1 = 2^r \cdot d \quad (d \text{ odd})" />
          <p className="text-sm text-muted-foreground">
            For each witness <MathRenderer expression="a" />, compute{' '}
            <MathRenderer expression="x = a^d \bmod n" />. If{' '}
            <MathRenderer expression="x \equiv 1" /> or <MathRenderer expression="x \equiv n-1" />,
            the test passes. Otherwise square repeatedly: if{' '}
            <MathRenderer expression="x^{2^j} \equiv n-1" /> for some{' '}
            <MathRenderer expression="j" />, it passes. Failure means <em>n</em> is composite.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Time: O(k log³ n)</Badge>
            <Badge variant="outline">Deterministic for n &lt; 3.3 × 10²⁴</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// 2. FACTOR TREE
// =============================================================================

interface FactorNode {
  value: bigint;
  left?: FactorNode;
  right?: FactorNode;
  isPrime: boolean;
  x: number;
  y: number;
  width: number;
}

function buildFactorTree(n: bigint): FactorNode {
  function build(val: bigint, depth: number): FactorNode {
    if (isPrime(val) || val === 1n) {
      return { value: val, isPrime: true, x: 0, y: depth * 80, width: 1 };
    }
    let f = 2n;
    while (f * f <= val && val % f !== 0n) f++;
    if (f * f > val) {
      return { value: val, isPrime: true, x: 0, y: depth * 80, width: 1 };
    }
    const other = val / f;
    const leftNode = build(f, depth + 1);
    const rightNode = build(other, depth + 1);
    const w = leftNode.width + rightNode.width;
    return {
      value: val,
      left: leftNode,
      right: rightNode,
      isPrime: false,
      x: 0,
      y: depth * 80,
      width: w,
    };
  }

  function layout(node: FactorNode, xOffset: number): void {
    if (!node.left || !node.right) {
      node.x = xOffset * 60 + 30;
      return;
    }
    layout(node.left, xOffset);
    layout(node.right, xOffset + node.left.width);
    node.x = (node.left.x + node.right.x) / 2;
  }

  const root = build(n, 0);
  layout(root, 0);
  return root;
}

function FactorTreeCanvas({ root }: { root: FactorNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let maxX = 0,
      maxY = 0;
    function measure(node: FactorNode) {
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
      if (node.left) measure(node.left);
      if (node.right) measure(node.right);
    }
    measure(root);

    const W = Math.max(maxX + 60, 300);
    const H = maxY + 80;
    canvas.width = W;
    canvas.height = H;

    const prime = '#22c55e';
    const composite = '#6366f1';

    const c: CanvasRenderingContext2D = ctx;
    c.clearRect(0, 0, W, H);

    function drawNode(node: FactorNode) {
      if (node.left) {
        c.beginPath();
        c.moveTo(node.x, node.y + 20);
        c.lineTo(node.left.x, node.left.y - 20);
        c.strokeStyle = '#94a3b8';
        c.lineWidth = 1.5;
        c.stroke();
        drawNode(node.left);
      }
      if (node.right) {
        c.beginPath();
        c.moveTo(node.x, node.y + 20);
        c.lineTo(node.right.x, node.right.y - 20);
        c.strokeStyle = '#94a3b8';
        c.lineWidth = 1.5;
        c.stroke();
        drawNode(node.right);
      }

      c.beginPath();
      c.arc(node.x, node.y, 20, 0, Math.PI * 2);
      c.fillStyle = node.isPrime ? prime : composite;
      c.fill();

      const label = String(node.value);
      c.fillStyle = '#ffffff';
      c.font = `bold ${label.length > 4 ? 10 : 13}px monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label.length > 8 ? '…' : label, node.x, node.y);
    }

    drawNode(root);
  }, [root]);

  return (
    <canvas ref={canvasRef} className="max-w-full mx-auto" aria-label="Prime factor tree diagram" />
  );
}

function FactorizationPanel() {
  const [input, setInput] = useState('360');
  const [result, setResult] = useState<{
    n: bigint;
    factors: FactorResult[];
    tree: FactorNode;
  } | null>(null);
  const [error, setError] = useState('');

  const compute = useCallback(() => {
    setError('');
    if (!/^\d+$/.test(input.trim())) {
      setError('Enter a positive integer.');
      return;
    }
    try {
      const n = BigInt(input.trim());
      if (n < 2n) {
        setError('Enter an integer ≥ 2.');
        return;
      }
      if (n > 10n ** 12n) {
        setError('Number too large for factor tree (max 10¹²).');
        return;
      }
      const factors = primeFactorization(n);
      const tree = buildFactorTree(n);
      setResult({ n, factors, tree });
    } catch {
      setError('Invalid input.');
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={GitBranch}
        title="Prime Factorization"
        description="Decompose any integer into its prime factors with a visual factor tree."
        gradient="bg-gradient-to-br from-purple-500 to-pink-600"
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && compute()}
              placeholder="Enter a positive integer"
              className="font-mono"
              aria-label="Number to factorize"
            />
            <Button onClick={compute}>Factorize</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {[12n, 360n, 2520n, 9699690n].map((n) => (
              <Button
                key={String(n)}
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(String(n));
                  setError('');
                }}
                className="font-mono text-xs"
              >
                {String(n)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={String(result.n)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormulaBox
                  latex={
                    String(result.n) +
                    ' = ' +
                    result.factors
                      .map(({ factor, exponent }) =>
                        exponent === 1 ? String(factor) : `${factor}^{${exponent}}`,
                      )
                      .join(' \\times ')
                  }
                />
                <div className="flex flex-wrap gap-2">
                  {result.factors.map(({ factor, exponent }) => (
                    <Badge key={String(factor)} variant="outline" className="font-mono">
                      {String(factor)}
                      {exponent > 1 ? `^${exponent}` : ''}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Factor Tree</CardTitle>
                <CardDescription>
                  Green nodes are prime. Purple nodes are composite.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <FactorTreeCanvas root={result.tree} />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// 3. GCD / LCM
// =============================================================================

function GCDPanel() {
  const [aInput, setAInput] = useState('48');
  const [bInput, setBInput] = useState('36');
  const [result, setResult] = useState<{
    a: bigint;
    b: bigint;
    g: bigint;
    l: bigint;
    steps: GCDStep[];
  } | null>(null);
  const [error, setError] = useState('');

  const compute = useCallback(() => {
    setError('');
    if (!/^\d+$/.test(aInput.trim()) || !/^\d+$/.test(bInput.trim())) {
      setError('Enter two positive integers.');
      return;
    }
    try {
      const a = BigInt(aInput.trim());
      const b = BigInt(bInput.trim());
      if (a <= 0n || b <= 0n) {
        setError('Both values must be positive.');
        return;
      }
      setResult({ a, b, g: gcd(a, b), l: lcm(a, b), steps: euclideanSteps(a, b) });
    } catch {
      setError('Invalid input.');
    }
  }, [aInput, bInput]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Divide}
        title="GCD / LCM Calculator"
        description="Euclidean algorithm with step-by-step breakdown."
        gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="gcd-a">
                a
              </label>
              <Input
                id="gcd-a"
                value={aInput}
                onChange={(e) => setAInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && compute()}
                className="font-mono"
                aria-label="First number"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="gcd-b">
                b
              </label>
              <Input
                id="gcd-b"
                value={bInput}
                onChange={(e) => setBInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && compute()}
                className="font-mono"
                aria-label="Second number"
              />
            </div>
          </div>
          <Button onClick={compute} className="w-full">
            Compute GCD &amp; LCM
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`${result.a}-${result.b}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">GCD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono text-foreground">
                    {String(result.g)}
                  </div>
                  <MathRenderer
                    expression={`\\gcd(${result.a},\\,${result.b}) = ${result.g}`}
                    displayMode={false}
                    className="text-sm mt-1"
                  />
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-teal-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">LCM</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono text-foreground">
                    {String(result.l)}
                  </div>
                  <MathRenderer
                    expression={`\\text{lcm}(${result.a},\\,${result.b}) = ${result.l}`}
                    displayMode={false}
                    className="text-sm mt-1"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Euclidean Algorithm Steps</CardTitle>
                <CardDescription>
                  <MathRenderer expression="\gcd(a,b) = \gcd(b,\, a \bmod b)" displayMode={false} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.steps.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                    >
                      <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="overflow-x-auto">
                        <MathRenderer
                          expression={`${step.a} = ${step.quotient} \\times ${step.b} + ${step.remainder}`}
                          displayMode={false}
                        />
                      </div>
                      {step.remainder === 0n && (
                        <Badge variant="default" className="ml-auto flex-shrink-0 text-xs">
                          Done
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <MathRenderer
                      expression={`\\therefore \\gcd(${result.a},\\,${result.b}) = ${result.g}`}
                      displayMode={false}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">Relationship:</p>
                  <FormulaBox
                    latex={`\\text{lcm}(a,b) = \\frac{a \\cdot b}{\\gcd(a,b)} = \\frac{${result.a} \\cdot ${result.b}}{${result.g}} = ${result.l}`}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// 4. MODULAR ARITHMETIC
// =============================================================================

function ModularPanel() {
  const [aInput, setAInput] = useState('17');
  const [nInput, setNInput] = useState('5');
  const [expInput, setExpInput] = useState('3');
  const [result, setResult] = useState<{
    a: bigint;
    n: bigint;
    exp: bigint;
    mod: bigint;
    inv: bigint | null;
    pow: bigint;
  } | null>(null);
  const [error, setError] = useState('');

  const compute = useCallback(() => {
    setError('');
    if (
      !/^-?\d+$/.test(aInput.trim()) ||
      !/^\d+$/.test(nInput.trim()) ||
      !/^\d+$/.test(expInput.trim())
    ) {
      setError('Enter integers for a, n, and exponent.');
      return;
    }
    try {
      const a = BigInt(aInput.trim());
      const n = BigInt(nInput.trim());
      const exp = BigInt(expInput.trim());
      if (n <= 0n) {
        setError('Modulus n must be positive.');
        return;
      }
      if (exp < 0n) {
        setError('Exponent must be non-negative.');
        return;
      }
      const amod = ((a % n) + n) % n;
      setResult({ a, n, exp, mod: amod, inv: modInverse(amod, n), pow: modPow(amod, exp, n) });
    } catch {
      setError('Invalid input.');
    }
  }, [aInput, nInput, expInput]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Layers}
        title="Modular Arithmetic"
        description="Compute residues, modular inverses, and modular exponentiation."
        gradient="bg-gradient-to-br from-orange-500 to-red-600"
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="mod-a">
                a
              </label>
              <Input
                id="mod-a"
                value={aInput}
                onChange={(e) => setAInput(e.target.value)}
                className="font-mono"
                aria-label="Base value a"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="mod-n">
                n (modulus)
              </label>
              <Input
                id="mod-n"
                value={nInput}
                onChange={(e) => setNInput(e.target.value)}
                className="font-mono"
                aria-label="Modulus n"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="mod-exp">
                exponent k
              </label>
              <Input
                id="mod-exp"
                value={expInput}
                onChange={(e) => setExpInput(e.target.value)}
                className="font-mono"
                aria-label="Exponent k"
              />
            </div>
          </div>
          <Button onClick={compute} className="w-full">
            Compute
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`${result.a}-${result.n}-${result.exp}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">a mod n</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono">{String(result.mod)}</div>
                  <MathRenderer
                    expression={`${result.a} \\equiv ${result.mod} \\pmod{${result.n}}`}
                    displayMode={false}
                    className="text-sm mt-1"
                  />
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Modular Inverse</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.inv !== null ? (
                    <>
                      <div className="text-3xl font-bold font-mono">{String(result.inv)}</div>
                      <MathRenderer
                        expression={`${result.a}^{-1} \\equiv ${result.inv} \\pmod{${result.n}}`}
                        displayMode={false}
                        className="text-sm mt-1"
                      />
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-muted-foreground">Does not exist</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inverse exists iff{' '}
                        <MathRenderer
                          expression={`\\gcd(${result.mod},${result.n})=1`}
                          displayMode={false}
                        />
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    <MathRenderer expression="a^k \\bmod n" displayMode={false} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono">{String(result.pow)}</div>
                  <MathRenderer
                    expression={`${result.a}^{${result.exp}} \\equiv ${result.pow} \\pmod{${result.n}}`}
                    displayMode={false}
                    className="text-sm mt-1"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Formulas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StepList
                  steps={[
                    {
                      label: 'Reduction',
                      latex: `a \\bmod n \\;=\\; a - n\\left\\lfloor \\frac{a}{n} \\right\\rfloor`,
                    },
                    {
                      label: 'Modular inverse (Extended Euclidean)',
                      latex: `a^{-1} \\bmod n \\text{ exists} \\iff \\gcd(a, n) = 1`,
                    },
                    {
                      label: 'Modular exponentiation (binary method)',
                      latex: `a^k \\bmod n \\quad \\mathcal{O}(\\log k) \\text{ multiplications}`,
                    },
                    {
                      label: "Fermat's little theorem (p prime, gcd(a,p)=1)",
                      latex: `a^{p-1} \\equiv 1 \\pmod{p}`,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// 5. SIEVE OF ERATOSTHENES — GPU compute + WebGPU-accelerated grid
// =============================================================================

// Maximum sieve size. Grid display caps at SIEVE_DISPLAY_MAX; compute can go higher.
const SIEVE_DISPLAY_MAX = 10000;
// Cols in the grid display — adaptive based on limit
function sieveCols(limit: number): number {
  if (limit <= 200) return 20;
  if (limit <= 500) return 25;
  if (limit <= 1000) return 40;
  if (limit <= 2500) return 50;
  return 100;
}

// Cell states: 0=unchecked, 1=prime, 2=composite, 3=current-factor

interface SieveState {
  // Per-number state array indexed by number (indices 0,1 unused)
  cells: Uint8Array;
  // Current prime being processed (-1 if done or not started)
  currentPrime: number;
  // Index into the factors array
  factorIdx: number;
  // All prime factors p where p*p <= limit
  factors: number[];
  // The sieve limit
  limit: number;
  // Whether the sieve is complete
  done: boolean;
  // How many primes found so far (updated after each step)
  primeCount: number;
  // Start time for elapsed timer
  startMs: number;
}

/**
 * Build the initial SieveState for a given limit.
 * All numbers >= 2 start as unchecked (state 0).
 * Compute the list of factors p where p*p <= limit.
 */
function buildInitialSieveState(limit: number): SieveState {
  const cells = new Uint8Array(limit + 1); // all 0 = unchecked
  // Pre-build factors list using a quick CPU sieve to get p values
  const refPrimes = sieve(limit);
  const factors: number[] = [];
  for (let p = 2; p * p <= limit; p++) {
    if (refPrimes[p]) factors.push(p);
  }
  return {
    cells,
    currentPrime: -1,
    factorIdx: 0,
    factors,
    limit,
    done: false,
    primeCount: 0,
    startMs: 0,
  };
}

/**
 * Apply one CPU sieve step (mark multiples of the next factor).
 * Mutates the state in place. Returns true if a step was taken.
 */
function applyCpuSieveStep(state: SieveState): boolean {
  if (state.done || state.factorIdx >= state.factors.length) {
    state.done = true;
    state.currentPrime = -1;
    // Final pass: mark all remaining unchecked numbers as prime
    for (let n = 2; n <= state.limit; n++) {
      if (state.cells[n] === 0) state.cells[n] = 1;
    }
    // Count primes
    let count = 0;
    for (let n = 2; n <= state.limit; n++) {
      if (state.cells[n] === 1) count++;
    }
    state.primeCount = count;
    return false;
  }

  const p = state.factors[state.factorIdx]!;
  state.currentPrime = p;

  // Mark p itself as prime (if not already eliminated)
  if (state.cells[p] !== 2) state.cells[p] = 1;

  // Mark current factor as "being processed" (state 3) then mark its multiples
  state.cells[p] = 3;

  // Mark composites
  for (let m = p * p; m <= state.limit; m += p) {
    state.cells[m] = 2;
  }

  state.factorIdx++;

  // Count primes found so far (cells that are state 1 or 3)
  let count = 0;
  for (let n = 2; n <= state.limit; n++) {
    if (state.cells[n] === 1 || state.cells[n] === 3) count++;
  }
  state.primeCount = count;

  return true;
}

// =============================================================================
// SIEVE GRID CANVAS — renders the cell grid using WebGPU or Canvas 2D
// =============================================================================

interface SieveCanvasProps {
  cells: Uint8Array;
  limit: number;
  currentPrime: number;
}

function SieveCanvas({ cells, limit, currentPrime }: SieveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<SieveGPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');

  const cols = sieveCols(limit);
  const rows = Math.ceil((limit - 1) / cols);

  // Compute cell pixel size based on container width
  function getCellSize(canvas: HTMLCanvasElement): number {
    const containerW = canvas.parentElement?.clientWidth ?? 400;
    // For large sieves show smaller cells; cap at 28px
    return Math.max(Math.min(Math.floor(containerW / cols), 28), 4);
  }

  // WebGPU render init — done once, or when limit changes
  useEffect(() => {
    if (!supportsWebGPU) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    // Destroy previous GPU resources if any
    const prevGpu = gpuRef.current;
    if (prevGpu) {
      prevGpu.uniformBuffer.destroy();
      prevGpu.cellBuffer.destroy();
      prevGpu.device.destroy();
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    }

    const cellSize = getCellSize(canvas);
    const W = cols * cellSize;
    const H = rows * cellSize;
    const maxCells = limit - 1; // numbers 2..limit

    initSieveGPU(canvas, W, H, maxCells).then((resources) => {
      if (destroyed || !resources) return;
      gpuRef.current = resources;
      webgpuActiveRef.current = true;
      setRenderMode('WebGPU');

      resources.device.lost.then(() => {
        if (destroyed) return;
        webgpuActiveRef.current = false;
        gpuRef.current = null;
        setRenderMode('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.uniformBuffer.destroy();
        gpu.cellBuffer.destroy();
        gpu.device.destroy();
      }
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Render whenever cells/currentPrime changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellSize = getCellSize(canvas);
    const W = cols * cellSize;
    const H = rows * cellSize;

    if (webgpuActiveRef.current && gpuRef.current) {
      const gpu = gpuRef.current;

      // Uniform: cols(u32), rows(u32), cellPx(f32), canvasW(f32), canvasH(f32), _p0,_p1,_p2(f32) = 32 bytes
      const uniData = new ArrayBuffer(32);
      const uniView = new DataView(uniData);
      uniView.setUint32(0, cols, true);
      uniView.setUint32(4, rows, true);
      uniView.setFloat32(8, cellSize, true);
      uniView.setFloat32(12, W, true);
      uniView.setFloat32(16, H, true);
      gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniData);

      // Build cell data: col(u32), row(u32), state(u32), _pad(u32) = 16 bytes each
      const cellCount = limit - 1; // numbers 2..limit
      const cellData = new Uint32Array(Math.min(cellCount, gpu.maxCells) * 4);
      const count = Math.min(cellCount, gpu.maxCells);
      for (let i = 0; i < count; i++) {
        const n = i + 2;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rawState = cells[n] ?? 0;
        // Map CellState: 0=unchecked->0, 1=prime->1, 2=composite->2, 3=currentFactor->3
        const state: number = rawState;
        cellData[i * 4 + 0] = col;
        cellData[i * 4 + 1] = row;
        cellData[i * 4 + 2] = state;
        cellData[i * 4 + 3] = 0;
      }

      if (cellData.byteLength <= gpu.cellBuffer.size) {
        gpu.device.queue.writeBuffer(gpu.cellBuffer, 0, cellData);
      }

      const bindGroup = gpu.device.createBindGroup({
        layout: gpu.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.uniformBuffer } },
          { binding: 1, resource: { buffer: gpu.cellBuffer } },
        ],
      });

      const texture = gpu.context.getCurrentTexture().createView();
      const enc = gpu.device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: texture,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
          },
        ],
      });
      pass.setPipeline(gpu.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6, count);
      pass.end();
      gpu.device.queue.submit([enc.finish()]);
      return;
    }

    // Canvas 2D fallback
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Only render numbers 2..limit
    const renderCount = limit - 1;
    for (let i = 0; i < renderCount; i++) {
      const n = i + 2;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellSize;
      const y = row * cellSize;
      const state = cells[n] ?? 0;

      let bg = '#e2e8f0'; // unchecked: slate-200
      if (state === 1) bg = '#22c55e'; // prime: green-500
      if (state === 2) bg = '#ef4444'; // composite: red-500
      if (state === 3) bg = '#f59e0b'; // current factor: amber-500

      ctx.fillStyle = bg;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      // Only draw text if cells are large enough
      if (cellSize >= 14) {
        ctx.fillStyle = state === 1 || state === 3 ? '#ffffff' : '#64748b';
        ctx.font = `${cellSize >= 20 ? 11 : 8}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n), x + cellSize / 2, y + cellSize / 2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, limit, currentPrime, cols, rows]);

  return (
    <div className="relative overflow-hidden rounded-lg">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ imageRendering: 'pixelated' }}
        aria-label={`Sieve of Eratosthenes grid up to ${limit}`}
        suppressHydrationWarning
      />
      <RenderModeBadge mode={renderMode} />
    </div>
  );
}

// =============================================================================
// SIEVE PANEL — GPU compute orchestration + animation + controls
// =============================================================================

function SievePanel() {
  // Configuration
  const [limitInput, setLimitInput] = useState(200);
  const [speed, setSpeed] = useState(500); // ms per step
  const [gpuMode, setGpuMode] = useState(false); // whether GPU compute is active

  // Animation state
  const [animating, setAnimating] = useState(false);
  const [sieveState, setSieveState] = useState<SieveState>(() => buildInitialSieveState(200));
  const [elapsedMs, setElapsedMs] = useState(0);

  // GPU compute resources
  const gpuComputeRef = useRef<SieveComputeGPUResources | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const safeLimit = Math.min(Math.max(limitInput, 4), SIEVE_DISPLAY_MAX);

  // Initialize GPU compute resources when limit changes (best-effort)
  useEffect(() => {
    if (!supportsWebGPU) return;
    let destroyed = false;

    initSieveComputeGPU(safeLimit).then((res) => {
      if (destroyed) {
        if (res) {
          res.computeUniformBuffer.destroy();
          res.sieveBuffer.destroy();
          res.stagingBuffer.destroy();
          res.device.destroy();
        }
        return;
      }
      // Destroy old resources
      const old = gpuComputeRef.current;
      if (old) {
        old.computeUniformBuffer.destroy();
        old.sieveBuffer.destroy();
        old.stagingBuffer.destroy();
        old.device.destroy();
      }
      gpuComputeRef.current = res;
      if (res) setGpuMode(true);
    });

    return () => {
      destroyed = true;
    };
  }, [safeLimit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      const res = gpuComputeRef.current;
      if (res) {
        res.computeUniformBuffer.destroy();
        res.sieveBuffer.destroy();
        res.stagingBuffer.destroy();
        res.device.destroy();
      }
    };
  }, []);

  const stopTimers = useCallback(() => {
    if (animRef.current) {
      clearTimeout(animRef.current);
      animRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopTimers();
    setAnimating(false);
    setElapsedMs(0);
    const newState = buildInitialSieveState(safeLimit);
    setSieveState(newState);
    // Re-initialize GPU sieve buffer if available
    const gpuRes = gpuComputeRef.current;
    if (gpuRes && gpuRes.sieveSize === safeLimit) {
      gpuSieveInit(gpuRes).catch(() => undefined);
    }
  }, [safeLimit, stopTimers]);

  // Whenever safeLimit changes, reset automatically
  useEffect(() => {
    stopTimers();
    setAnimating(false);
    setElapsedMs(0);
    setSieveState(buildInitialSieveState(safeLimit));
  }, [safeLimit, stopTimers]);

  // Perform one GPU-assisted compute step
  const performGpuStep = useCallback(
    async (
      currentState: SieveState,
      gpuRes: SieveComputeGPUResources,
    ): Promise<SieveState | null> => {
      if (currentState.done || currentState.factorIdx >= currentState.factors.length) {
        return null;
      }

      const p = currentState.factors[currentState.factorIdx]!;
      const newState: SieveState = {
        ...currentState,
        cells: new Uint8Array(currentState.cells),
        currentPrime: p,
        factorIdx: currentState.factorIdx + 1,
      };

      // Mark p as current factor
      if (newState.cells[p] !== 2) newState.cells[p] = 3;

      // GPU dispatch: mark multiples of p
      const result = await gpuSieveStep(gpuRes, p);
      if (result) {
        // Merge GPU composite marks back into cells
        for (let n = p * p; n <= newState.limit; n += p) {
          if (result[n] === 1) newState.cells[n] = 2;
        }
      } else {
        // GPU failed — fall back to CPU marking
        for (let m = p * p; m <= newState.limit; m += p) {
          newState.cells[m] = 2;
        }
      }

      // Count primes
      let count = 0;
      for (let n = 2; n <= newState.limit; n++) {
        if (newState.cells[n] === 1 || newState.cells[n] === 3) count++;
      }
      newState.primeCount = count;

      // Check if done
      if (newState.factorIdx >= newState.factors.length) {
        // Final pass: mark all remaining unchecked as prime
        for (let n = 2; n <= newState.limit; n++) {
          if (newState.cells[n] === 0) newState.cells[n] = 1;
          if (newState.cells[n] === 3) newState.cells[n] = 1; // current factor -> prime
        }
        let finalCount = 0;
        for (let n = 2; n <= newState.limit; n++) {
          if (newState.cells[n] === 1) finalCount++;
        }
        newState.primeCount = finalCount;
        newState.done = true;
        newState.currentPrime = -1;
      }

      return newState;
    },
    [],
  );

  // Step forward callback (used by both Play and Step button)
  const stepForward = useCallback(
    (currentSieveState: SieveState, scheduleNext: boolean) => {
      const gpuRes = gpuComputeRef.current;
      const useGpu = gpuRes !== null && gpuMode && gpuRes.sieveSize === currentSieveState.limit;

      if (useGpu && gpuRes !== null) {
        // Async GPU step
        performGpuStep(currentSieveState, gpuRes).then((nextState) => {
          if (nextState === null) {
            // Already done
            const finalState: SieveState = { ...currentSieveState };
            // Final pass
            for (let n = 2; n <= finalState.limit; n++) {
              if (finalState.cells[n] === 0) finalState.cells[n] = 1;
              if (finalState.cells[n] === 3) finalState.cells[n] = 1;
            }
            let fc = 0;
            for (let n = 2; n <= finalState.limit; n++) {
              if (finalState.cells[n] === 1) fc++;
            }
            finalState.primeCount = fc;
            finalState.done = true;
            finalState.currentPrime = -1;
            setSieveState(finalState);
            setAnimating(false);
            stopTimers();
            return;
          }
          setSieveState(nextState);
          if (nextState.done) {
            setAnimating(false);
            stopTimers();
          } else if (scheduleNext) {
            animRef.current = setTimeout(() => {
              // Use functional update to get latest state
              setSieveState((prev) => {
                stepForward(prev, true);
                return prev;
              });
            }, speed);
          }
        });
      } else {
        // CPU step
        const nextState: SieveState = {
          ...currentSieveState,
          cells: new Uint8Array(currentSieveState.cells),
        };
        const stepped = applyCpuSieveStep(nextState);
        setSieveState(nextState);

        if (!stepped || nextState.done) {
          setAnimating(false);
          stopTimers();
        } else if (scheduleNext) {
          animRef.current = setTimeout(() => {
            setSieveState((prev) => {
              stepForward(prev, true);
              return prev;
            });
          }, speed);
        }
      }
    },
    [gpuMode, performGpuStep, speed, stopTimers],
  );

  const handlePlay = useCallback(() => {
    if (sieveState.done) return;
    stopTimers();
    setAnimating(true);
    startTimeRef.current = performance.now() - elapsedMs;
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - startTimeRef.current));
    }, 100);
    setSieveState((prev) => {
      stepForward(prev, true);
      return prev;
    });
  }, [sieveState.done, elapsedMs, stepForward, stopTimers]);

  const handlePause = useCallback(() => {
    stopTimers();
    setAnimating(false);
  }, [stopTimers]);

  const handleStep = useCallback(() => {
    if (animating || sieveState.done) return;
    stopTimers();
    setSieveState((prev) => {
      stepForward(prev, false);
      return prev;
    });
  }, [animating, sieveState.done, stepForward, stopTimers]);

  // Compute prime list for display when done
  const primeList: number[] = sieveState.done
    ? Array.from({ length: safeLimit - 1 }, (_, i) => i + 2).filter(
        (n) => sieveState.cells[n] === 1,
      )
    : [];

  const computeBackend = gpuMode && supportsWebGPU ? 'WebGPU Compute' : 'CPU';
  const renderBackend = supportsWebGPU ? 'WebGPU Render' : 'Canvas 2D';

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Grid}
        title="Sieve of Eratosthenes"
        description="GPU-compute accelerated prime sieve with animated step-through visualization up to 10,000."
        gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
      />

      {/* Controls card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Limit slider */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="sieve-limit">
              Sieve limit: <span className="font-mono text-primary">{safeLimit}</span>
            </label>
            <input
              id="sieve-limit"
              type="range"
              min={10}
              max={SIEVE_DISPLAY_MAX}
              step={10}
              value={limitInput}
              onChange={(e) => {
                setLimitInput(Number(e.target.value));
              }}
              className="w-full"
              aria-label="Sieve upper limit"
              disabled={animating}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>10</span>
              <span>250</span>
              <span>500</span>
              <span>1,000</span>
              <span>2,500</span>
              <span>5,000</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Speed slider */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block" htmlFor="sieve-speed">
              Step delay: <span className="font-mono text-primary">{speed}ms</span>
            </label>
            <input
              id="sieve-speed"
              type="range"
              min={50}
              max={2000}
              step={50}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full"
              aria-label="Animation speed in milliseconds per step"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!animating ? (
              <Button
                onClick={handlePlay}
                disabled={sieveState.done}
                className="flex-1 min-w-[120px]"
                aria-label="Play sieve animation"
              >
                <Play className="w-4 h-4 mr-2" />
                {sieveState.currentPrime === -1 && !sieveState.done ? 'Start' : 'Resume'}
              </Button>
            ) : (
              <Button
                onClick={handlePause}
                variant="secondary"
                className="flex-1 min-w-[120px]"
                aria-label="Pause sieve animation"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleStep}
              disabled={animating || sieveState.done}
              aria-label="Step forward one prime"
            >
              <ChevronRight className="w-4 h-4 mr-1" />
              Step
            </Button>
            <Button variant="outline" onClick={reset} aria-label="Reset sieve">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-muted-foreground/40 inline-block" />
              Unchecked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
              Prime
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
              Composite
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
              Current factor
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-cyan-500/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Current prime</p>
            <p className="text-2xl font-bold font-mono text-cyan-400" suppressHydrationWarning>
              {sieveState.currentPrime > 0 ? sieveState.currentPrime : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Primes found</p>
            <p className="text-2xl font-bold font-mono text-green-400" suppressHydrationWarning>
              {sieveState.primeCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Step</p>
            <p className="text-2xl font-bold font-mono text-blue-400" suppressHydrationWarning>
              {sieveState.factorIdx} / {sieveState.factors.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Elapsed</p>
            <p className="text-2xl font-bold font-mono text-violet-400" suppressHydrationWarning>
              {elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current step description */}
      <AnimatePresence mode="wait">
        {sieveState.currentPrime > 0 && (
          <motion.div
            key={sieveState.currentPrime}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge
                    variant="outline"
                    className="font-mono text-amber-400 border-amber-500/40 text-base px-3 py-1"
                  >
                    p = {sieveState.currentPrime}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Marking multiples of{' '}
                    <strong className="text-foreground">{sieveState.currentPrime}</strong> as
                    composite, starting at{' '}
                    <strong className="text-foreground">
                      {sieveState.currentPrime * sieveState.currentPrime}
                    </strong>{' '}
                    — computed via{' '}
                    <span className="text-violet-400 font-mono text-xs">{computeBackend}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {sieveState.done && (
          <motion.div key="done" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-3 px-4">
                <p className="text-sm text-green-400 font-medium">
                  Sieve complete. Found <strong>{sieveState.primeCount}</strong> primes up to{' '}
                  <strong>{safeLimit}</strong> in {elapsedMs}ms ({computeBackend}).
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid visualization */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Number Grid</CardTitle>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded font-mono backdrop-blur-sm border bg-violet-900/40 border-violet-500/30 text-violet-300">
                {renderBackend}
              </span>
              {gpuMode && supportsWebGPU && (
                <span className="px-2 py-0.5 rounded font-mono backdrop-blur-sm border bg-cyan-900/40 border-cyan-500/30 text-cyan-300">
                  GPU Compute
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <SieveCanvas
            cells={sieveState.cells}
            limit={safeLimit}
            currentPrime={sieveState.currentPrime}
          />
        </CardContent>
      </Card>

      {/* Results */}
      {sieveState.done && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-cyan-500/40">
            <CardHeader>
              <CardTitle className="text-base">
                Primes up to {safeLimit}{' '}
                <Badge variant="default" className="ml-2">
                  {primeList.length} primes
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show prime badges (cap at 200 for display) */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {primeList.slice(0, 200).map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-xs">
                    {p}
                  </Badge>
                ))}
                {primeList.length > 200 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{primeList.length - 200} more…
                  </Badge>
                )}
              </div>

              <div className="pt-4 border-t">
                <FormulaBox
                  latex={`\\pi(${safeLimit}) = ${primeList.length} \\approx \\frac{${safeLimit}}{\\ln ${safeLimit}} \\approx ${(safeLimit / Math.log(safeLimit)).toFixed(1)}`}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  <MathRenderer expression="\pi(x)" displayMode={false} /> is the prime-counting
                  function; the prime number theorem gives{' '}
                  <MathRenderer expression="\pi(x) \sim \frac{x}{\ln x}" displayMode={false} />.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Algorithm card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Algorithm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormulaBox latex="\text{For each prime } p \leq \sqrt{N}: \text{ mark } p^2, p^2+p, p^2+2p, \ldots \text{ composite}" />
          <StepList
            steps={[
              {
                label: 'Initialize',
                latex: '\\text{Mark } 0, 1 \\text{ composite; all } n \\geq 2 \\text{ unchecked}',
              },
              {
                label: 'Find next prime',
                latex: 'p = \\min\\{n \\geq 2 : n \\text{ unchecked}\\}',
              },
              {
                label: 'GPU dispatch',
                latex:
                  '\\text{dispatch}(\\lceil(N - p^2)/p / 256\\rceil) \\text{ workgroups, each thread marks } p(p+k)',
              },
              {
                label: 'Repeat',
                latex: 'p \\leftarrow \\text{next unchecked}; \\text{ stop when } p^2 > N',
              },
            ]}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Badge variant="outline">Time: O(n log log n)</Badge>
            <Badge variant="outline">GPU workgroup size: 256 threads</Badge>
            <Badge variant="outline">Max N: 10,000</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// 6. EULER'S TOTIENT
// =============================================================================

function TotientPanel() {
  const [input, setInput] = useState('36');
  const [result, setResult] = useState<{
    n: bigint;
    phi: bigint;
    steps: Array<{ text: string; latex: string }>;
    coprimes: number[];
  } | null>(null);
  const [error, setError] = useState('');

  const compute = useCallback(() => {
    setError('');
    if (!/^\d+$/.test(input.trim())) {
      setError('Enter a positive integer.');
      return;
    }
    try {
      const n = BigInt(input.trim());
      if (n < 1n) {
        setError('Enter an integer ≥ 1.');
        return;
      }
      if (n > 10n ** 9n) {
        setError('Number too large (max 10⁹).');
        return;
      }
      const phi = eulerTotient(n);
      const steps = totientSteps(n);
      const nNum = safeNum(n);
      const coprimes = Array.from({ length: nNum }, (_, i) => i + 1).filter(
        (k) => safeNum(gcd(BigInt(k), n)) === 1,
      );
      setResult({ n, phi, steps, coprimes });
    } catch {
      setError('Invalid input.');
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Circle}
        title="Euler's Totient Function"
        description="Count integers coprime to n; foundational to RSA and number theory."
        gradient="bg-gradient-to-br from-violet-500 to-purple-600"
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && compute()}
              placeholder="Enter n"
              className="font-mono"
              aria-label="Value of n for totient calculation"
            />
            <Button onClick={compute}>Compute φ(n)</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {[12n, 36n, 100n, 720n].map((n) => (
              <Button
                key={String(n)}
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(String(n));
                  setError('');
                }}
                className="font-mono text-xs"
              >
                φ({String(n)})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={String(result.n)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <Card className="border-l-4 border-l-violet-500">
              <CardHeader>
                <CardTitle className="text-3xl font-mono font-bold">
                  φ({String(result.n)}) = {String(result.phi)}
                </CardTitle>
                <CardDescription>
                  {String(result.phi)} integers in [1, {String(result.n)}] are coprime to{' '}
                  {String(result.n)}.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Derivation</CardTitle>
              </CardHeader>
              <CardContent>
                <StepList steps={result.steps.map((s) => ({ label: s.text, latex: s.latex }))} />
              </CardContent>
            </Card>

            {result.coprimes.length <= 72 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Coprime integers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {result.coprimes.map((k) => (
                      <Badge key={k} variant="outline" className="font-mono text-xs">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <StepList
                  steps={[
                    {
                      label: 'Multiplicativity',
                      latex: '\\varphi(mn) = \\varphi(m)\\varphi(n) \\text{ when } \\gcd(m,n) = 1',
                    },
                    {
                      label: 'Prime formula',
                      latex: '\\varphi(p^k) = p^k - p^{k-1} = p^{k-1}(p-1)',
                    },
                    {
                      label: "Euler's theorem",
                      latex: 'a^{\\varphi(n)} \\equiv 1 \\pmod{n} \\text{ when } \\gcd(a,n)=1',
                    },
                    { label: 'Sum identity', latex: '\\sum_{d \\mid n} \\varphi(d) = n' },
                  ]}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// 7. FIBONACCI / LUCAS — WebGPU-accelerated bar chart
// =============================================================================

function FibonacciCanvas({ terms }: { terms: bigint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<BarGPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');

  // WebGPU init
  useEffect(() => {
    if (!supportsWebGPU) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    const W = canvas.parentElement?.clientWidth ?? 500;
    const H = 220;

    initBarGPU(canvas, W, H, 128).then((resources) => {
      if (destroyed || !resources) return;
      gpuRef.current = resources;
      webgpuActiveRef.current = true;
      setRenderMode('WebGPU');

      resources.device.lost.then(() => {
        if (destroyed) return;
        webgpuActiveRef.current = false;
        gpuRef.current = null;
        setRenderMode('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.uniformBuffer.destroy();
        gpu.barBuffer.destroy();
        gpu.device.destroy();
      }
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (terms.length < 2) return;

    const W = canvas.parentElement?.clientWidth ?? 500;
    const H = 220;
    const nums = terms.map((t) => safeNum(t));
    const maxVal = Math.max(...nums, 1);
    const PAD = 4;

    if (webgpuActiveRef.current && gpuRef.current) {
      const gpu = gpuRef.current;
      const barCount = terms.length;

      // Uniform: barCount(u32), canvasW(f32), canvasH(f32), padPx(f32) = 16 bytes
      const uniData = new ArrayBuffer(16);
      const uniView = new DataView(uniData);
      uniView.setUint32(0, barCount, true);
      uniView.setFloat32(4, W, true);
      uniView.setFloat32(8, H, true);
      uniView.setFloat32(12, PAD, true);
      gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniData);

      // Bar data: barIndex(u32), normH(f32), r,g,b(f32), _p0,_p1,_p2(f32) = 32 bytes
      const barData = new ArrayBuffer(Math.min(barCount, gpu.maxBars) * 32);
      const barView = new DataView(barData);
      const count = Math.min(barCount, gpu.maxBars);
      for (let i = 0; i < count; i++) {
        const normH = nums[i]! / maxVal;
        // Gradient: violet (0.67 0.55 0.98) at low, indigo (0.39 0.40 1.0) at high
        const t = i / Math.max(count - 1, 1);
        const r = 0.67 - t * 0.28;
        const g = 0.55 - t * 0.15;
        const b = 0.98 + t * 0.02;
        barView.setUint32(i * 32 + 0, i, true);
        barView.setFloat32(i * 32 + 4, normH, true);
        barView.setFloat32(i * 32 + 8, r, true);
        barView.setFloat32(i * 32 + 12, g, true);
        barView.setFloat32(i * 32 + 16, b, true);
        barView.setFloat32(i * 32 + 20, 0, true);
        barView.setFloat32(i * 32 + 24, 0, true);
        barView.setFloat32(i * 32 + 28, 0, true);
      }
      gpu.device.queue.writeBuffer(gpu.barBuffer, 0, barData);

      const bindGroup = gpu.device.createBindGroup({
        layout: gpu.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.uniformBuffer } },
          { binding: 1, resource: { buffer: gpu.barBuffer } },
        ],
      });

      const texture = gpu.context.getCurrentTexture().createView();
      const enc = gpu.device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: texture,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.04, g: 0.04, b: 0.06, a: 1.0 },
          },
        ],
      });
      pass.setPipeline(gpu.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6, count);
      pass.end();
      gpu.device.queue.submit([enc.finish()]);
      return;
    }

    // Canvas 2D fallback
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const barW = W / terms.length;
    for (let i = 0; i < terms.length; i++) {
      const h = (nums[i]! / maxVal) * (H - 40);
      const x = i * barW;
      const y = H - h - 20;

      const grad = ctx.createLinearGradient(x, y, x, H - 20);
      grad.addColorStop(0, '#a78bfa');
      grad.addColorStop(1, '#6366f1');
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y, barW - 2, h);

      if (terms.length <= 20 && barW > 18) {
        const label = String(terms[i]);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label.length > 6 ? '' : label, x + barW / 2, H - 4);
      }
    }

    ctx.strokeStyle = 'rgba(251,191,36,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < terms.length; i++) {
      const xi = (i + 0.5) * barW;
      const yi = H - (nums[i]! / maxVal) * (H - 40) - 20;
      if (i === 0) ctx.moveTo(xi, yi);
      else ctx.lineTo(xi, yi);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }, [terms]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        aria-label="Fibonacci sequence bar chart"
      />
      <RenderModeBadge mode={renderMode} />
    </div>
  );
}

function FibLucasPanel() {
  const [nInput, setNInput] = useState('15');
  const [result, setResult] = useState<{
    n: number;
    fibTerms: bigint[];
    lucasTerms: bigint[];
    ratio: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'fibonacci' | 'lucas'>('fibonacci');

  const compute = useCallback(() => {
    setError('');
    const nNum = parseInt(nInput, 10);
    if (Number.isNaN(nNum) || nNum < 1) {
      setError('Enter a positive integer.');
      return;
    }
    if (nNum > 80) {
      setError('Max n = 80 for display.');
      return;
    }
    const fibTerms = Array.from({ length: nNum + 1 }, (_, i) => fibonacci(i));
    const lucasTerms = Array.from({ length: nNum + 1 }, (_, i) => lucas(i));
    const fn = safeNum(fibonacci(nNum));
    const fn1 = safeNum(fibonacci(nNum - 1));
    const ratio = fn1 !== 0 ? (fn / fn1).toFixed(10) : 'N/A';
    setResult({ n: nNum, fibTerms, lucasTerms, ratio });
  }, [nInput]);

  const terms = result ? (mode === 'fibonacci' ? result.fibTerms : result.lucasTerms) : [];
  const currentValue = result
    ? mode === 'fibonacci'
      ? fibonacci(result.n)
      : lucas(result.n)
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Infinity}
        title="Fibonacci & Lucas Sequences"
        description="Explore the golden ratio and recurrence relations. GPU-accelerated bar chart."
        gradient="bg-gradient-to-br from-amber-500 to-orange-600"
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={nInput}
              onChange={(e) => setNInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && compute()}
              placeholder="n (max 80)"
              className="font-mono"
              aria-label="Which Fibonacci/Lucas term to compute"
            />
            <Button onClick={compute}>Compute</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.n}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">F({result.n})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono break-all">
                    {String(fibonacci(result.n))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">L({result.n})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono break-all">
                    {String(lucas(result.n))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Sequence Visualization</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={mode === 'fibonacci' ? 'default' : 'outline'}
                      onClick={() => setMode('fibonacci')}
                    >
                      Fibonacci
                    </Button>
                    <Button
                      size="sm"
                      variant={mode === 'lucas' ? 'default' : 'outline'}
                      onClick={() => setMode('lucas')}
                    >
                      Lucas
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FibonacciCanvas terms={terms} />
                <div className="mt-2 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {terms.slice(0, 30).map((t, i) => (
                    <Badge
                      key={i}
                      variant={i === result.n ? 'default' : 'outline'}
                      className="font-mono text-xs"
                    >
                      {String(t)}
                    </Badge>
                  ))}
                  {terms.length > 30 && (
                    <Badge variant="outline" className="text-xs">
                      +{terms.length - 30} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mathematical Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormulaBox latex="F_n = F_{n-1} + F_{n-2}, \quad F_0 = 0,\; F_1 = 1" />
                <FormulaBox latex="L_n = L_{n-1} + L_{n-2}, \quad L_0 = 2,\; L_1 = 1" />
                <FormulaBox latex="\phi = \frac{1 + \sqrt{5}}{2} \approx 1.6180339887\ldots" />
                <FormulaBox
                  latex={`\\frac{F_{${result.n}}}{F_{${result.n - 1}}} = ${result.ratio}`}
                />
                <FormulaBox latex="F_n = \frac{\phi^n - \psi^n}{\sqrt{5}}, \quad \psi = \frac{1-\sqrt{5}}{2}" />
                <p className="text-xs text-muted-foreground">
                  As <MathRenderer expression="n \to \infty" displayMode={false} />, the ratio{' '}
                  <MathRenderer expression="F_n / F_{n-1} \to \phi" displayMode={false} /> (golden
                  ratio).
                </p>
                {currentValue !== null && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-1">Lucas–Fibonacci identity:</p>
                    <FormulaBox latex="L_n = F_{n-1} + F_{n+1}" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// 8. COLLATZ CONJECTURE — WebGPU-accelerated line plot
// =============================================================================

function CollatzCanvas({ seq }: { seq: bigint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<LineGPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');

  // WebGPU init
  useEffect(() => {
    if (!supportsWebGPU) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    const W = canvas.parentElement?.clientWidth ?? 600;
    const H = 240;

    initLineGPU(canvas, W, H, 1024).then((resources) => {
      if (destroyed || !resources) return;
      gpuRef.current = resources;
      webgpuActiveRef.current = true;
      setRenderMode('WebGPU');

      resources.device.lost.then(() => {
        if (destroyed) return;
        webgpuActiveRef.current = false;
        gpuRef.current = null;
        setRenderMode('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.uniformBuffer.destroy();
        gpu.segBuffer.destroy();
        gpu.device.destroy();
      }
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (seq.length < 2) return;

    const nums = seq.map((t) => safeNum(t));
    const maxVal = Math.max(...nums, 1);
    const W = canvas.parentElement?.clientWidth ?? 600;
    const H = 240;
    const pad = 20;
    const plotW = W - pad * 2;
    const plotH = H - pad * 2;

    if (webgpuActiveRef.current && gpuRef.current) {
      const gpu = gpuRef.current;

      // Build pixel-space segments with gradient colors
      const segCount = Math.min(seq.length - 1, gpu.maxSegs);
      const segData = new Float32Array(segCount * 8);
      for (let i = 0; i < segCount; i++) {
        const t = i / Math.max(segCount - 1, 1);
        // amber→red→green gradient
        const r = t < 0.5 ? 0.96 : 0.96 - (t - 0.5) * 2 * (0.96 - 0.13);
        const g = t < 0.5 ? 0.62 - t * 0.62 : (t - 0.5) * 2 * 0.77;
        const b = t < 0.5 ? 0.04 : 0.04;

        const x0 = pad + (i / (nums.length - 1)) * plotW;
        const y0 = H - pad - (nums[i]! / maxVal) * plotH;
        const x1 = pad + ((i + 1) / (nums.length - 1)) * plotW;
        const y1 = H - pad - (nums[i + 1]! / maxVal) * plotH;

        segData[i * 8 + 0] = x0;
        segData[i * 8 + 1] = y0;
        segData[i * 8 + 2] = x1;
        segData[i * 8 + 3] = y1;
        segData[i * 8 + 4] = r;
        segData[i * 8 + 5] = g;
        segData[i * 8 + 6] = b;
        segData[i * 8 + 7] = 0;
      }

      // Uniform: minVal,maxVal(f32), numPts(u32), canvasW,canvasH,padPx,lineW,_p(f32) = 32 bytes
      const uniData = new Float32Array(8);
      uniData[0] = 0;
      uniData[1] = maxVal;
      uniData[2] = seq.length;
      uniData[3] = W;
      uniData[4] = H;
      uniData[5] = pad;
      uniData[6] = 2.5;
      uniData[7] = 0;
      gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniData);

      if (segData.byteLength <= gpu.segBuffer.size) {
        gpu.device.queue.writeBuffer(gpu.segBuffer, 0, segData);
      }

      const bindGroup = gpu.device.createBindGroup({
        layout: gpu.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.uniformBuffer } },
          { binding: 1, resource: { buffer: gpu.segBuffer } },
        ],
      });

      const texture = gpu.context.getCurrentTexture().createView();
      const enc = gpu.device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: texture,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.04, g: 0.04, b: 0.06, a: 1.0 },
          },
        ],
      });
      pass.setPipeline(gpu.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6, segCount);
      pass.end();
      gpu.device.queue.submit([enc.finish()]);
      return;
    }

    // Canvas 2D fallback
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, H - pad);
    ctx.lineTo(W - pad, H - pad);
    ctx.stroke();

    const grad = ctx.createLinearGradient(pad, pad, W - pad, pad);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#ef4444');
    grad.addColorStop(1, '#22c55e');

    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    for (let i = 0; i < nums.length; i++) {
      const x = pad + (i / (nums.length - 1)) * plotW;
      const y = H - pad - (nums[i]! / maxVal) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const maxIdx = nums.indexOf(maxVal);
    const px = pad + (maxIdx / (nums.length - 1)) * plotW;
    const py = H - pad - plotH;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(maxVal), px, py - 8);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`n=${String(seq[0])}`, pad + 2, H - pad - 4);
    ctx.textAlign = 'right';
    ctx.fillText('1', W - pad - 2, H - pad - 4);
  }, [seq]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        aria-label="Collatz sequence trajectory"
      />
      <RenderModeBadge mode={renderMode} />
    </div>
  );
}

function CollatzPanel() {
  const [input, setInput] = useState('27');
  const [result, setResult] = useState<{
    n: bigint;
    seq: bigint[];
    peak: bigint;
    steps: number;
  } | null>(null);
  const [error, setError] = useState('');

  const compute = useCallback(() => {
    setError('');
    if (!/^\d+$/.test(input.trim())) {
      setError('Enter a positive integer.');
      return;
    }
    try {
      const n = BigInt(input.trim());
      if (n < 1n) {
        setError('Enter an integer ≥ 1.');
        return;
      }
      if (n > 10n ** 15n) {
        setError('Number too large (max 10¹⁵).');
        return;
      }
      const seq = collatz(n);
      const peak = seq.reduce((m, v) => (v > m ? v : m), n);
      setResult({ n, seq, peak, steps: seq.length - 1 });
    } catch {
      setError('Invalid input.');
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Shuffle}
        title="Collatz Conjecture"
        description="The 3n+1 problem: every positive integer eventually reaches 1. GPU-accelerated trajectory."
        gradient="bg-gradient-to-br from-rose-500 to-pink-600"
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && compute()}
              placeholder="Enter a positive integer"
              className="font-mono"
              aria-label="Starting number for Collatz sequence"
            />
            <Button onClick={compute}>
              Compute
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {[27n, 97n, 871n, 6171n].map((n) => (
              <Button
                key={String(n)}
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(String(n));
                  setError('');
                }}
                className="font-mono text-xs"
              >
                {String(n)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={String(result.n)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-rose-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Steps to 1</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono">{result.steps}</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-pink-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Peak value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono break-all">
                    {String(result.peak)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-fuchsia-500">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Sequence length</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono">{result.seq.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trajectory</CardTitle>
              </CardHeader>
              <CardContent>
                <CollatzCanvas seq={result.seq} />
                {result.seq.length <= 50 && (
                  <div className="mt-3 flex flex-wrap gap-1 text-xs">
                    {result.seq.map((v, i) => (
                      <span key={i} className="font-mono">
                        {String(v)}
                        {i < result.seq.length - 1 ? (
                          <ArrowRight className="w-3 h-3 inline mx-0.5" />
                        ) : null}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">The Rule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormulaBox latex="f(n) = \begin{cases} n/2 & \text{if } n \equiv 0 \pmod 2 \\ 3n + 1 & \text{if } n \equiv 1 \pmod 2 \end{cases}" />
                <p className="text-sm text-muted-foreground">
                  The Collatz conjecture states that for any positive integer <em>n</em>, repeated
                  application of <MathRenderer expression="f" displayMode={false} /> eventually
                  reaches 1. It has been verified for all{' '}
                  <MathRenderer expression="n < 2^{68}" displayMode={false} /> but remains unproven
                  in general.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// NAVIGATION TAB DEFINITIONS
// =============================================================================

const TABS = [
  { id: 'prime', label: 'Prime Checker', icon: Hash, component: PrimeChecker },
  { id: 'factorization', label: 'Factor Tree', icon: GitBranch, component: FactorizationPanel },
  { id: 'gcd', label: 'GCD / LCM', icon: Divide, component: GCDPanel },
  { id: 'modular', label: 'Modular', icon: Layers, component: ModularPanel },
  { id: 'sieve', label: 'Sieve', icon: Grid, component: SievePanel },
  { id: 'totient', label: "Euler's φ", icon: Circle, component: TotientPanel },
  { id: 'fibonacci', label: 'Fibonacci', icon: Infinity, component: FibLucasPanel },
  { id: 'collatz', label: 'Collatz', icon: Shuffle, component: CollatzPanel },
] as const;

type TabId = (typeof TABS)[number]['id'];

// =============================================================================
// PAGE ENTRY POINT
// =============================================================================

export default function NumberTheoryPage() {
  const t = useTranslations('numberTheory');
  const [activeTab, setActiveTab] = useState<TabId>('prime');
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component ?? PrimeChecker;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
            ℕ
          </div>
          <div>
            <h1 className="text-4xl font-bold">
              <span className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                {t('title')}
              </span>
            </h1>
          </div>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl">{t('description')}</p>

        <div className="flex flex-wrap gap-2 mt-4">
          <DisplayMath expression="\mathbb{Z} / n\mathbb{Z} \quad \varphi(n) \quad \gcd(a,b) \quad p \in \mathbb{P}" />
          {supportsWebGPU && (
            <Badge
              variant="outline"
              className="gap-1 backdrop-blur-sm bg-violet-500/10 border-violet-500/40 text-violet-300 text-xs"
            >
              {t('webgpuActive')}
            </Badge>
          )}
        </div>
      </div>

      {/* Topic navigation */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                activeTab === id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={activeTab === id}
              aria-label={`Open ${label} tool`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active tool panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <ActiveComponent />
        </motion.div>
      </AnimatePresence>

      {/* Footer reference */}
      <div className="mt-12 pt-6 border-t text-xs text-muted-foreground space-y-1">
        <p>
          All computations use JavaScript <code>BigInt</code> for exact integer arithmetic.
          Miller-Rabin primality testing is deterministic for n &lt; 3.3 &times; 10&sup2;&sup4;.
        </p>
        <p>
          Sieve of Eratosthenes time complexity:{' '}
          <MathRenderer expression="O(n \log \log n)" displayMode={false} />. GCD:{' '}
          <MathRenderer expression="O(\log \min(a,b))" displayMode={false} />. Modular
          exponentiation: <MathRenderer expression="O(\log k)" displayMode={false} />.
        </p>
        {supportsWebGPU && (
          <p className="text-violet-400/60">
            WebGPU rendering active: Sieve grid, Fibonacci bars, and Collatz trajectories are
            GPU-accelerated.
          </p>
        )}
      </div>
    </div>
  );
}
