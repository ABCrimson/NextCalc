/**
 * WebGPU Compute Shader Accelerator for Bifurcation Diagram Generation.
 *
 * Architecture:
 * - A single compute pass dispatches one workgroup per r-value (up to 512 r-steps).
 * - Each invocation runs warmup + plot iterations of x_{n+1} = r·x·(1-x) in parallel.
 * - Output lives in a GPU storage buffer (vec2f per attractor point).
 * - A readback maps the buffer to CPU-readable Float32Array.
 * - Returns null if the WebGPU adapter is unavailable — caller uses CPU fallback.
 *
 * WebGPU types come from @webgpu/types (referenced in types/webgpu.d.ts).
 *
 * WGSL shader uses @workgroup_size(256) so the GPU scheduler can fill
 * wavefronts efficiently even when rSteps < 256.
 */

/**
 * Supported bifurcation maps.
 * - logistic: x_{n+1} = r * x * (1 - x)  — classic logistic map, r ∈ [2.5, 4]
 * - sine:     x_{n+1} = r * sin(π * x)   — sine map, r ∈ [0, 1]
 * - tent:     x_{n+1} = r * min(x, 1-x)  — tent map, r ∈ [0, 2]
 */
export type BifurcationMapType = 'logistic' | 'sine' | 'tent' | 'cubic' | 'gauss' | 'circle';

export interface BifurcationGPUParams {
  rMin: number;
  rMax: number;
  rSteps: number;
  warmup: number;
  plotPoints: number;
  /** Initial condition x₀ ∈ (0, 1). Defaults to 0.5. */
  x0?: number;
  /** Which iterated map to use. Defaults to 'logistic'. */
  mapType?: BifurcationMapType;
}

export interface BifurcationPoint {
  r: number;
  x: number;
}

export interface WebGPUBifurcationResult {
  points: BifurcationPoint[];
  /** Wall-clock milliseconds for the GPU compute + readback. */
  gpuMs: number;
  /** True when WebGPU was used; false means the caller should use CPU fallback. */
  usedGPU: boolean;
}

// ─── WGSL Compute Shader ────────────────────────────────────────────────────

/**
 * Params uniform layout (explicit WGSL struct offsets, 4-byte aligned):
 *   offset  0 : f32 r_min
 *   offset  4 : f32 r_max
 *   offset  8 : u32 r_steps
 *   offset 12 : u32 warmup
 *   offset 16 : u32 plot_points
 *   offset 20 : f32 x0         (initial condition)
 *   offset 24 : u32 map_type   (0=logistic, 1=sine, 2=tent)
 *   offset 28 : u32 _pad
 */
const BIFURCATION_WGSL = /* wgsl */ `
struct Params {
  r_min      : f32,
  r_max      : f32,
  r_steps    : u32,
  warmup     : u32,
  plot_points: u32,
  x0         : f32,
  map_type   : u32,
  _pad       : u32,
}

@group(0) @binding(0) var<uniform>            params : Params;
@group(0) @binding(1) var<storage, read_write> points : array<vec2f>;

fn iterate(map_type: u32, r: f32, x: f32) -> f32 {
  if (map_type == 0u) {
    // Logistic map: x_{n+1} = r * x * (1 - x)
    return r * x * (1.0 - x);
  } else if (map_type == 1u) {
    // Sine map: x_{n+1} = r * sin(pi * x)
    return r * sin(3.14159265358979 * x);
  } else {
    // Tent map: x_{n+1} = r * min(x, 1 - x)
    return r * min(x, 1.0 - x);
  }
}

@compute @workgroup_size(256)
fn bifurcation(@builtin(global_invocation_id) id: vec3u) {
  let r_idx = id.x;
  if (r_idx >= params.r_steps) { return; }

  // Map r_idx → growth rate r in [r_min, r_max)
  let r = params.r_min
        + f32(r_idx) * (params.r_max - params.r_min)
        / f32(params.r_steps);

  // Warm-up: iterate without recording to reach the attractor
  var x: f32 = params.x0;
  for (var i: u32 = 0u; i < params.warmup; i = i + 1u) {
    x = iterate(params.map_type, r, x);
  }

  // Record attractor points
  let base = r_idx * params.plot_points;
  for (var i: u32 = 0u; i < params.plot_points; i = i + 1u) {
    x = iterate(params.map_type, r, x);
    points[base + i] = vec2f(r, x);
  }
}
`;

// ─── Navigator GPU shim (minimal — only what the feature check needs) ────────

interface NavigatorWithGPU extends Navigator {
  readonly gpu: GPU;
}

function navigatorHasGPU(nav: Navigator): nav is NavigatorWithGPU {
  return 'gpu' in nav;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the bifurcation diagram computation on the GPU via WebGPU compute.
 *
 * Returns `null` when WebGPU is unavailable (caller must use CPU path).
 */
export async function computeBifurcationGPU(
  params: BifurcationGPUParams
): Promise<WebGPUBifurcationResult | null> {
  // ── Feature detection ─────────────────────────────────────────────────────
  if (typeof navigator === 'undefined' || !navigatorHasGPU(navigator)) return null;

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return null;

  const device = await adapter.requestDevice({ label: 'NextCalc bifurcation device' });

  const t0 = performance.now();

  const {
    rMin,
    rMax,
    rSteps,
    warmup,
    plotPoints,
    x0 = 0.5,
    mapType = 'logistic',
  } = params;
  const totalPoints = rSteps * plotPoints;

  // Map type enum (must match WGSL): 0=logistic, 1=sine, 2=tent
  // cubic/gauss/circle are CPU-only; return null so caller uses CPU fallback.
  const GPU_SUPPORTED_MAPS: Partial<Record<BifurcationMapType, number>> = {
    logistic: 0,
    sine: 1,
    tent: 2,
  };
  const mapTypeIdx = GPU_SUPPORTED_MAPS[mapType];
  if (mapTypeIdx === undefined) return null;

  // ── Uniform buffer: Params (8 × 4 bytes = 32 bytes) ─────────────────────
  const UNIFORM_SIZE = 32;
  const uniformData = new ArrayBuffer(UNIFORM_SIZE);
  const uniformF32 = new Float32Array(uniformData);
  const uniformU32 = new Uint32Array(uniformData);
  uniformF32[0] = rMin;
  uniformF32[1] = rMax;
  uniformU32[2] = rSteps;
  uniformU32[3] = warmup;
  uniformU32[4] = plotPoints;
  uniformF32[5] = x0;
  uniformU32[6] = mapTypeIdx;
  uniformU32[7] = 0; // padding

  const uniformBuffer = device.createBuffer({
    label: 'bifurcation params uniform',
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  // ── Storage buffer: output points (vec2f = 8 bytes each) ─────────────────
  const POINT_BYTES = 8;
  const storageBuffer = device.createBuffer({
    label: 'bifurcation points storage',
    size: totalPoints * POINT_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Staging buffer for CPU readback
  const readBuffer = device.createBuffer({
    label: 'bifurcation readback',
    size: totalPoints * POINT_BYTES,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const shaderModule = device.createShaderModule({
    label: 'bifurcation compute shader',
    code: BIFURCATION_WGSL,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    label: 'bifurcation bgl',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' as GPUBufferBindingType },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' as GPUBufferBindingType },
      },
    ],
  });

  const pipeline = await device.createComputePipelineAsync({
    label: 'bifurcation pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: shaderModule,
      entryPoint: 'bifurcation',
    },
  });

  const bindGroup = device.createBindGroup({
    label: 'bifurcation bind group',
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: storageBuffer } },
    ],
  });

  // ── Encode and submit ─────────────────────────────────────────────────────
  const encoder = device.createCommandEncoder({ label: 'bifurcation encoder' });
  const pass = encoder.beginComputePass({ label: 'bifurcation compute pass' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  // Dispatch enough workgroups to cover rSteps (workgroup_size = 256)
  const numWorkgroups = Math.ceil(rSteps / 256);
  pass.dispatchWorkgroups(numWorkgroups);
  pass.end();

  // Copy storage → staging
  encoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, totalPoints * POINT_BYTES);
  device.queue.submit([encoder.finish()]);

  // ── Readback ──────────────────────────────────────────────────────────────
  await readBuffer.mapAsync(GPUMapMode.READ);
  const raw = new Float32Array(readBuffer.getMappedRange().slice(0));
  readBuffer.unmap();

  const gpuMs = performance.now() - t0;

  // ── Parse vec2f array → BifurcationPoint[] ───────────────────────────────
  const points: BifurcationPoint[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const r = raw[i];
    const x = raw[i + 1];
    // Exclude out-of-range or degenerate values
    if (r !== undefined && x !== undefined && isFinite(r) && isFinite(x) && x > 0 && x < 1) {
      points.push({ r, x });
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  uniformBuffer.destroy();
  storageBuffer.destroy();
  readBuffer.destroy();
  device.destroy();

  return { points, gpuMs, usedGPU: true };
}
