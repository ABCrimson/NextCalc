'use client';

/**
 * GPU Direction Field Component
 *
 * Renders a vector field (direction field) for ODE systems using WebGPU
 * compute shaders that evaluate (dx/dt, dy/dt) at every grid point in
 * parallel on the GPU.
 *
 * Architecture:
 * - WebGPU compute shader evaluates the ODE right-hand side at each of the
 *   N×N grid points and writes (dx, dy, magnitude) into a storage buffer.
 * - A subsequent render pass reads that buffer and draws instanced arrows
 *   (line body + triangle head) — one draw call for all arrows.
 * - Arrow color is determined by speed magnitude: blue→green→yellow→red.
 * - Fallback: if WebGPU is unavailable, arrows are drawn via Canvas 2D.
 *
 * SSR safety:
 * - No browser globals at module scope.
 * - GPUShaderStage constants are expressed as numeric literals because
 *   `GPUShaderStage` is undefined during SSR.
 *   VERTEX = 0x1, FRAGMENT = 0x2, COMPUTE = 0x4
 *
 * TypeScript compliance:
 * - TypeScript 6.0 strict / exactOptionalPropertyTypes.
 * - Zero `any` / `as any`.
 * - React 19.3: no forwardRef, no displayName.
 *
 * @module app/solver/ode/GpuDirectionField
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// GPUSHADERSTAGE NUMERIC CONSTANTS (SSR-safe)
// ============================================================================

const GPU_STAGE_VERTEX = 0x1;
const GPU_STAGE_COMPUTE = 0x4;

// ============================================================================
// TYPES
// ============================================================================

/** Supported ODE equation types for the direction field shader. */
export type FieldEquationType =
  | 'custom'
  | 'lotka-volterra'
  | 'van-der-pol'
  | 'stable-spiral'
  | 'pendulum';

export interface GpuDirectionFieldProps {
  /** Canvas width/height in logical pixels (field is square). */
  readonly size: number;
  /** Left boundary of the domain. */
  readonly xMin: number;
  /** Right boundary of the domain. */
  readonly xMax: number;
  /** Bottom boundary of the domain. */
  readonly yMin: number;
  /** Top boundary of the domain. */
  readonly yMax: number;
  /**
   * For custom equation type: JavaScript functions computing dx/dt and dy/dt.
   * These run on the CPU fallback path; the GPU uses built-in WGSL equations.
   */
  readonly f: (x: number, y: number, t: number) => number;
  readonly g: (x: number, y: number, t: number) => number;
  /** Which built-in equation the GPU shader should use. */
  readonly equationType: FieldEquationType;
  /** Grid resolution per axis. Default 64 → 64×64 = 4096 arrows. */
  readonly gridN?: number;
  /** Opacity of the direction field layer [0, 1]. Default 0.4. */
  readonly opacity?: number;
  /** Whether to show the direction field at all. */
  readonly visible?: boolean;
}

// ============================================================================
// WGSL — COMPUTE SHADER
//
// Evaluates the ODE system at each grid point and stores (dx, dy, mag) in
// a storage buffer laid out as:
//   struct Arrow { dx: f32, dy: f32, mag: f32, _pad: f32 }
// Each workgroup processes 8×8 = 64 arrows.
//
// Equation selector:
//   0 = custom placeholder (fixed spiral — host should use CPU path for custom)
//   1 = Lotka-Volterra
//   2 = Van der Pol
//   3 = Stable Spiral
//   4 = Nonlinear Pendulum
//   5 = First-order scalar (dy/dx = f(x,y) rendered as 2D vector [1, slope])
// ============================================================================

const COMPUTE_SHADER = /* wgsl */ `
struct Uniforms {
  xMin      : f32,
  xMax      : f32,
  yMin      : f32,
  yMax      : f32,
  gridN     : u32,
  eqType    : u32,
  // params for equations (a,b for lotka-volterra, mu for vdp, etc.)
  param0    : f32,
  param1    : f32,
}

struct Arrow {
  dx  : f32,
  dy  : f32,
  mag : f32,
  _p  : f32,
}

@group(0) @binding(0) var<uniform>            uni    : Uniforms;
@group(0) @binding(1) var<storage, read_write> arrows : array<Arrow>;

fn evalSystem(x: f32, y: f32) -> vec2<f32> {
  switch uni.eqType {
    case 1u: {
      // Lotka-Volterra: dx/dt = a*x - x*y,  dy/dt = x*y - b*y
      let a = uni.param0;
      let b = uni.param1;
      return vec2<f32>(a * x - x * y, x * y - b * y);
    }
    case 2u: {
      // Van der Pol: dx/dt = y,  dy/dt = (1 - x^2)*y - x
      let mu = uni.param0;
      return vec2<f32>(y, mu * (1.0 - x * x) * y - x);
    }
    case 3u: {
      // Stable Spiral: dx/dt = -alpha*x - y,  dy/dt = x - alpha*y
      let alpha = uni.param0;
      return vec2<f32>(-alpha * x - y, x - alpha * y);
    }
    case 4u: {
      // Damped Pendulum: dx/dt = y,  dy/dt = -sin(x) - gamma*y
      let gamma = uni.param0;
      return vec2<f32>(y, -sin(x) - gamma * y);
    }
    default: {
      // Fallback: linear rotation field
      return vec2<f32>(-y, x);
    }
  }
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = uni.gridN;
  let col = gid.x;
  let row = gid.y;
  if (col >= N || row >= N) { return; }

  let idx = row * N + col;

  // Map grid index to domain coordinates (cell centres)
  let fx = uni.xMin + (f32(col) + 0.5) / f32(N) * (uni.xMax - uni.xMin);
  let fy = uni.yMin + (f32(row) + 0.5) / f32(N) * (uni.yMax - uni.yMin);

  let v   = evalSystem(fx, fy);
  let mag = length(v);

  arrows[idx] = Arrow(v.x, v.y, mag, 0.0);
}
`;

// ============================================================================
// WGSL — RENDER SHADER
//
// Draws instanced arrows from the compute output buffer.
// Each instance = one arrow at one grid cell.
//
// Arrow geometry per instance (12 vertices, 4 triangles):
//   - Shaft: 6 vertices (2 triangles = rectangle along direction)
//   - Head:  6 vertices (2 triangles = wider triangle at tip)
//
// Arrow length is proportional to normalised magnitude (clamped).
// Arrow color: blue (slow) → green → yellow → red (fast).
// ============================================================================

const RENDER_SHADER = /* wgsl */ `
struct Uniforms {
  xMin      : f32,
  xMax      : f32,
  yMin      : f32,
  yMax      : f32,
  gridN     : u32,
  eqType    : u32,
  param0    : f32,
  param1    : f32,
}

struct RenderUniforms {
  canvasW   : f32,
  canvasH   : f32,
  opacity   : f32,
  maxMag    : f32,
  cellSize  : f32,
  _pad0     : f32,
  _pad1     : f32,
  _pad2     : f32,
}

struct Arrow {
  dx  : f32,
  dy  : f32,
  mag : f32,
  _p  : f32,
}

@group(0) @binding(0) var<uniform>           compUni : Uniforms;
@group(0) @binding(1) var<storage, read>     arrows  : array<Arrow>;
@group(0) @binding(2) var<uniform>           rndUni  : RenderUniforms;

struct VOut {
  @builtin(position) pos   : vec4<f32>,
  @location(0)       color : vec4<f32>,
}

// Speed-based colormap: blue (0) → cyan → green → yellow → red (1)
fn speedColor(t_in: f32, opacity: f32) -> vec4<f32> {
  let t = clamp(t_in, 0.0, 1.0);
  var rgb: vec3<f32>;
  if t < 0.25 {
    let s = t * 4.0;
    rgb = mix(vec3<f32>(0.10, 0.30, 0.85), vec3<f32>(0.10, 0.75, 0.85), s);
  } else if t < 0.5 {
    let s = (t - 0.25) * 4.0;
    rgb = mix(vec3<f32>(0.10, 0.75, 0.85), vec3<f32>(0.20, 0.82, 0.20), s);
  } else if t < 0.75 {
    let s = (t - 0.5) * 4.0;
    rgb = mix(vec3<f32>(0.20, 0.82, 0.20), vec3<f32>(0.95, 0.85, 0.08), s);
  } else {
    let s = (t - 0.75) * 4.0;
    rgb = mix(vec3<f32>(0.95, 0.85, 0.08), vec3<f32>(0.92, 0.15, 0.10), s);
  }
  return vec4<f32>(rgb, opacity);
}

// Map domain coords to NDC
fn toNDC(p: vec2<f32>, xMin: f32, xMax: f32, yMin: f32, yMax: f32) -> vec2<f32> {
  let u = (p.x - xMin) / (xMax - xMin);
  let v = (p.y - yMin) / (yMax - yMin);
  return vec2<f32>(u * 2.0 - 1.0, v * 2.0 - 1.0);
}

// 12 vertices: shaft (6) + head (6)
// Shaft quad local coords (unit arrow pointing right):
//   shaft half-width = 0.05, length = 0..0.65
//   head  half-width = 0.15, covers 0.65..1.0
const SHAFT_HALF_W : f32 = 0.06;
const HEAD_HALF_W  : f32 = 0.20;
const SHAFT_LEN    : f32 = 0.62;

fn arrowVertex(localIdx: u32) -> vec2<f32> {
  // Shaft rectangle: 6 verts (2 tris)
  // All in local space where arrow points in +x direction, length = 1
  if localIdx < 6u {
    let shaft = array<vec2<f32>, 6>(
      vec2<f32>(0.0,       -SHAFT_HALF_W),
      vec2<f32>(SHAFT_LEN, -SHAFT_HALF_W),
      vec2<f32>(SHAFT_LEN,  SHAFT_HALF_W),
      vec2<f32>(0.0,       -SHAFT_HALF_W),
      vec2<f32>(SHAFT_LEN,  SHAFT_HALF_W),
      vec2<f32>(0.0,        SHAFT_HALF_W),
    );
    return shaft[localIdx];
  }
  // Head triangle (6 verts / 2 tris but only 3 unique — pad into 2 degenerate tris)
  let hi = localIdx - 6u;
  let head = array<vec2<f32>, 6>(
    vec2<f32>(SHAFT_LEN, -HEAD_HALF_W),
    vec2<f32>(1.0,        0.0        ),
    vec2<f32>(SHAFT_LEN,  HEAD_HALF_W),
    // Degenerate tri to avoid index buffer (just repeat last tri)
    vec2<f32>(SHAFT_LEN, -HEAD_HALF_W),
    vec2<f32>(SHAFT_LEN,  HEAD_HALF_W),
    vec2<f32>(1.0,        0.0        ),
  );
  return head[hi];
}

@vertex
fn vs_main(
  @builtin(vertex_index)   vi   : u32,
  @builtin(instance_index) inst : u32,
) -> VOut {
  let N       = compUni.gridN;
  let col     = inst % N;
  let row     = inst / N;

  // Cell centre in domain space
  let cx = compUni.xMin + (f32(col) + 0.5) / f32(N) * (compUni.xMax - compUni.xMin);
  let cy = compUni.yMin + (f32(row) + 0.5) / f32(N) * (compUni.yMax - compUni.yMin);

  let arrow   = arrows[inst];
  let mag     = arrow.mag;

  // Clamp and normalize magnitude for visual length
  let maxMag  = max(rndUni.maxMag, 0.001);
  let normMag = clamp(mag / maxMag, 0.0, 1.0);
  // Arrow length in domain units: proportional to sqrt of normalized mag
  // (sqrt compresses the dynamic range so huge fast regions don't overwhelm)
  let arrowDomainLen = rndUni.cellSize * 0.45 * (0.15 + 0.85 * sqrt(normMag));

  // Direction unit vector (guard zero-length)
  var dir: vec2<f32>;
  if mag < 1e-12 {
    dir = vec2<f32>(1.0, 0.0);
  } else {
    dir = vec2<f32>(arrow.dx, arrow.dy) / mag;
  }

  // Build rotation matrix: local +x → dir
  let cosA = dir.x;
  let sinA = dir.y;

  // Get arrow vertex in local space [0,1]×[-0.2,0.2]
  let local = arrowVertex(vi);

  // Scale by arrow domain length, rotate, translate to cell centre
  let scaled = local * arrowDomainLen;
  let rotated = vec2<f32>(
    cosA * scaled.x - sinA * scaled.y,
    sinA * scaled.x + cosA * scaled.y,
  );

  // Arrow is centred at the grid point (offset so it's centred not right-aligned)
  let halfLen = arrowDomainLen * 0.5;
  let offsetDir = vec2<f32>(cosA * halfLen, sinA * halfLen);
  let worldPos = vec2<f32>(cx, cy) - offsetDir + rotated;

  let ndcPos = toNDC(
    worldPos,
    compUni.xMin, compUni.xMax,
    compUni.yMin, compUni.yMax,
  );

  var out: VOut;
  out.pos   = vec4<f32>(ndcPos.x, ndcPos.y, 0.0, 1.0);
  out.color = speedColor(normMag, rndUni.opacity);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
  return in.color;
}
`;

// ============================================================================
// GPU RESOURCES
// ============================================================================

interface FieldGpuResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  computePipeline: GPUComputePipeline;
  renderPipeline: GPURenderPipeline;
  computeUniBuffer: GPUBuffer;
  renderUniBuffer: GPUBuffer;
  arrowBuffer: GPUBuffer;
  computeBindGroup: GPUBindGroup;
  renderBindGroup: GPUBindGroup;
  currentN: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function isWebGPUAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof (navigator as { gpu?: unknown }).gpu !== 'undefined'
  );
}

/** Equation type → integer selector passed to WGSL shader. */
function eqTypeToInt(eq: FieldEquationType): number {
  switch (eq) {
    case 'lotka-volterra':
      return 1;
    case 'van-der-pol':
      return 2;
    case 'stable-spiral':
      return 3;
    case 'pendulum':
      return 4;
    default:
      return 0;
  }
}

/** Default shader parameters for each equation type. */
function eqParams(eq: FieldEquationType): [number, number] {
  switch (eq) {
    case 'lotka-volterra':
      return [1.5, 1.0]; // a=1.5, b=1.0
    case 'van-der-pol':
      return [1.0, 0.0]; // mu=1.0
    case 'stable-spiral':
      return [0.1, 0.0]; // alpha=0.1
    case 'pendulum':
      return [0.1, 0.0]; // gamma=0.1
    default:
      return [0.0, 0.0];
  }
}

/**
 * Writes a packed compute-uniforms block into the provided buffer.
 * Layout (32 bytes):
 *   xMin(f32) xMax(f32) yMin(f32) yMax(f32)
 *   gridN(u32) eqType(u32) param0(f32) param1(f32)
 */
function writeComputeUniforms(
  device: GPUDevice,
  buf: GPUBuffer,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  gridN: number,
  eqType: number,
  param0: number,
  param1: number,
): void {
  const data = new ArrayBuffer(32);
  const f = new Float32Array(data);
  const u = new Uint32Array(data);
  f[0] = xMin;
  f[1] = xMax;
  f[2] = yMin;
  f[3] = yMax;
  u[4] = gridN;
  u[5] = eqType;
  f[6] = param0;
  f[7] = param1;
  device.queue.writeBuffer(buf, 0, data);
}

/**
 * Writes render-uniforms (16 bytes per WebGPU 16-byte alignment).
 * Layout (32 bytes):
 *   canvasW(f32) canvasH(f32) opacity(f32) maxMag(f32)
 *   cellSize(f32) _pad0..2(f32×3)
 */
function writeRenderUniforms(
  device: GPUDevice,
  buf: GPUBuffer,
  canvasW: number,
  canvasH: number,
  opacity: number,
  maxMag: number,
  cellSize: number,
): void {
  const data = new Float32Array(8);
  data[0] = canvasW;
  data[1] = canvasH;
  data[2] = opacity;
  data[3] = maxMag;
  data[4] = cellSize;
  data[5] = 0;
  data[6] = 0;
  data[7] = 0;
  device.queue.writeBuffer(buf, 0, data.buffer);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initFieldGPU(
  canvas: HTMLCanvasElement,
  size: number,
  gridN: number,
): Promise<FieldGpuResources | null> {
  try {
    const gpuObj = (navigator as { gpu?: GPU }).gpu;
    if (!gpuObj) return null;

    const adapter = await gpuObj.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) return null;

    const format = gpuObj.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    canvas.width = size;
    canvas.height = size;

    // ----- Compute pipeline -----
    const computeShaderModule = device.createShaderModule({ code: COMPUTE_SHADER });

    const computeBGL = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          // COMPUTE = 0x4
          visibility: GPU_STAGE_COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPU_STAGE_COMPUTE,
          buffer: { type: 'storage' },
        },
      ],
    });

    const computePipeline = await device.createComputePipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeBGL] }),
      compute: { module: computeShaderModule, entryPoint: 'main' },
    });

    // ----- Render pipeline -----
    const renderShaderModule = device.createShaderModule({ code: RENDER_SHADER });

    const renderBGL = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          // VERTEX = 0x1
          visibility: GPU_STAGE_VERTEX,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPU_STAGE_VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 2,
          visibility: GPU_STAGE_VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const renderPipeline = await device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderBGL] }),
      vertex: { module: renderShaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: renderShaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

    // ----- Buffers -----
    // Compute uniforms: 32 bytes
    const computeUniBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Render uniforms: 32 bytes
    const renderUniBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Arrow buffer: gridN * gridN arrows × 16 bytes each (4 × f32)
    const arrowBuffer = device.createBuffer({
      size: gridN * gridN * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // ----- Bind groups -----
    const computeBindGroup = device.createBindGroup({
      layout: computeBGL,
      entries: [
        { binding: 0, resource: { buffer: computeUniBuffer } },
        { binding: 1, resource: { buffer: arrowBuffer } },
      ],
    });

    const renderBindGroup = device.createBindGroup({
      layout: renderBGL,
      entries: [
        { binding: 0, resource: { buffer: computeUniBuffer } },
        { binding: 1, resource: { buffer: arrowBuffer } },
        { binding: 2, resource: { buffer: renderUniBuffer } },
      ],
    });

    return {
      device,
      context,
      computePipeline,
      renderPipeline,
      computeUniBuffer,
      renderUniBuffer,
      arrowBuffer,
      computeBindGroup,
      renderBindGroup,
      currentN: gridN,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * GPU-accelerated direction field overlay.
 *
 * Renders as a transparent canvas that sits on top of the phase plane canvas.
 * Uses WebGPU compute to evaluate the ODE system at all grid points, then
 * draws instanced arrows via a render pass.
 *
 * Falls back to Canvas 2D arrow rendering if WebGPU is unavailable.
 */
export function GpuDirectionField({
  size,
  xMin,
  xMax,
  yMin,
  yMax,
  f,
  g,
  equationType,
  gridN = 64,
  opacity = 0.4,
  visible = true,
}: GpuDirectionFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<FieldGpuResources | null>(null);
  const gpuActiveRef = useRef(false);
  const [gpuAvailable, setGpuAvailable] = useState(false);
  const [_renderBackend, setRenderBackend] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');

  // Detect WebGPU on client only (SSR-safe)
  useEffect(() => {
    setGpuAvailable(isWebGPUAvailable());
  }, []);

  // ----- WebGPU initialization (once) -----
  // biome-ignore lint/correctness/useExhaustiveDependencies: One-time GPU init
  useEffect(() => {
    if (!gpuAvailable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    initFieldGPU(canvas, size, gridN).then((res) => {
      if (destroyed || !res) return;
      gpuRef.current = res;
      gpuActiveRef.current = true;
      setRenderBackend('WebGPU');

      res.device.lost.then(() => {
        if (destroyed) return;
        gpuRef.current = null;
        gpuActiveRef.current = false;
        setRenderBackend('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const r = gpuRef.current;
      if (r) {
        r.arrowBuffer.destroy();
        r.computeUniBuffer.destroy();
        r.renderUniBuffer.destroy();
        r.device.destroy();
      }
      gpuRef.current = null;
      gpuActiveRef.current = false;
    };
  }, [gpuAvailable]);

  // ----- WebGPU render -----
  useEffect(() => {
    if (!visible) return;
    if (!gpuActiveRef.current || !gpuRef.current) return;

    const r = gpuRef.current;
    const {
      device,
      context,
      computePipeline,
      renderPipeline,
      computeUniBuffer,
      renderUniBuffer,
      arrowBuffer: _arrowBuffer,
      computeBindGroup,
      renderBindGroup,
    } = r;

    const eqInt = eqTypeToInt(equationType);
    const [param0, param1] = eqParams(equationType);

    // Write compute uniforms
    writeComputeUniforms(
      device,
      computeUniBuffer,
      xMin,
      xMax,
      yMin,
      yMax,
      gridN,
      eqInt,
      param0,
      param1,
    );

    // Estimate max magnitude for normalization (domain-size dependent heuristic)
    const domainW = xMax - xMin;
    const domainH = yMax - yMin;
    const maxMag = Math.max(domainW, domainH) * 2.0;

    // Cell size in domain units
    const cellSize = Math.max(domainW, domainH) / gridN;

    // Write render uniforms
    writeRenderUniforms(device, renderUniBuffer, size, size, opacity, maxMag, cellSize);

    // Dispatch compute: workgroups of 8×8, ceil(gridN/8) per axis
    const wg = Math.ceil(gridN / 8);
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(wg, wg);
    computePass.end();

    // Render pass: instanced arrows
    const textureView = context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
        },
      ],
    });

    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    // 12 vertices per arrow, gridN*gridN instances
    renderPass.draw(12, gridN * gridN);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
  }, [
    visible,
    xMin,
    xMax,
    yMin,
    yMax,
    equationType,
    gridN,
    opacity,
    size,
    // We re-run whenever gpuActiveRef changes conceptually (tracked via gpuAvailable)
    gpuAvailable,
  ]);

  // ----- Canvas 2D fallback render -----
  const drawCpu = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    if (!visible) return;

    const ARROWS = gridN;
    const cellPx = size / ARROWS;
    const arrowLen = cellPx * 0.45;

    ctx.globalAlpha = opacity;

    for (let col = 0; col < ARROWS; col++) {
      for (let row = 0; row < ARROWS; row++) {
        const x = xMin + ((col + 0.5) / ARROWS) * (xMax - xMin);
        const y = yMin + ((row + 0.5) / ARROWS) * (yMax - yMin);

        let dx: number;
        let dy: number;
        try {
          dx = f(x, y, 0);
          dy = g(x, y, 0);
        } catch {
          continue;
        }
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;

        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag < 1e-12) continue;

        // Normalize magnitude for color and length
        const domainMax = Math.max(xMax - xMin, yMax - yMin);
        const normMag = Math.min(1, mag / (domainMax * 2));

        // Speed color: blue → cyan → green → yellow → red
        const hue = 240 - normMag * 240; // 240=blue, 0=red
        ctx.strokeStyle = `hsl(${hue}, 85%, 55%)`;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 1.2;

        // Visual arrow length: proportional to sqrt of normalized mag
        const len = arrowLen * (0.15 + 0.85 * Math.sqrt(normMag));
        const unitX = dx / mag;
        const unitY = dy / mag;

        // Canvas pixel coordinates (y-flipped)
        const cx = (col + 0.5) * cellPx;
        const cy = size - (row + 0.5) * cellPx;

        // Arrow starts at half-length before centre, ends at half-length after
        const halfLen = len * 0.5;
        const startX = cx - unitX * halfLen;
        const startY = cy + unitY * halfLen; // +y because canvas y is flipped
        const endX = cx + unitX * halfLen;
        const endY = cy - unitY * halfLen;

        // Shaft
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Head
        const angle = Math.atan2(startY - endY, endX - startX);
        const headLen = len * 0.3;
        const headAngle = 0.45;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - headAngle),
          endY + headLen * Math.sin(angle - headAngle),
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle + headAngle),
          endY + headLen * Math.sin(angle + headAngle),
        );
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;
  }, [size, xMin, xMax, yMin, yMax, f, g, gridN, opacity, visible]);

  // Trigger CPU fallback draw whenever dependencies change and GPU is off
  useEffect(() => {
    if (!gpuActiveRef.current) {
      drawCpu();
    }
  }, [drawCpu]);

  // ----- Render -----
  if (!visible) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute inset-0 w-full h-full rounded-lg pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
      aria-hidden="true"
      suppressHydrationWarning
    />
  );
}

// ============================================================================
// MAGNITUDE LEGEND
// ============================================================================

/**
 * Color legend showing the speed-to-color mapping for the direction field.
 */
export function DirectionFieldLegend() {
  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      aria-label="Direction field speed color legend"
    >
      <span>Slow</span>
      <div
        className="h-2 w-20 rounded-full"
        style={{
          background: 'linear-gradient(to right, #1a4de0, #1abcd9, #33d133, #f0d814, #eb2619)',
        }}
        aria-hidden="true"
      />
      <span>Fast</span>
    </div>
  );
}
