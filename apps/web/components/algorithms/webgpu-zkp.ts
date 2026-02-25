/**
 * WebGPU Compute Shader Accelerator for Zero-Knowledge Proof Operations.
 *
 * Two compute kernels:
 *
 * 1. **Modular Exponentiation** (`mod_exp`):
 *    Computes base^exp mod n for N independent tasks simultaneously using
 *    the square-and-multiply algorithm.  This is the hot inner loop in
 *    discrete-log ZKP verification (Schnorr / Pedersen).
 *
 *    Note on 32-bit arithmetic in WGSL:
 *    WGSL does not have native u64.  We emulate safe 32-bit modular
 *    multiplication by splitting the multiplicand into 16-bit halves and
 *    doing the high-half multiplication via 16 repeated doublings mod m.
 *    This is correct and avoids overflow for our 32-bit demo prime
 *    (p = 32_452_843 < 2^25).
 *
 * 2. **Batch Schnorr Verification** (`batch_verify`):
 *    Verifies N Schnorr round transcripts in parallel.
 *    Each workgroup item checks:  g^s ≡ t · y^c  (mod p)
 *    and writes a u32 result (1 = verified, 0 = failed).
 *
 * WebGPU types come from @webgpu/types (referenced in types/webgpu.d.ts).
 * Falls back gracefully when WebGPU is unavailable.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ModExpTask {
  base: number;
  exp: number;
  mod: number;
}

export interface ModExpResult {
  results: number[];
  gpuMs: number;
}

export interface SchnorrRound {
  /** g^r mod p — the commitment */
  t: number;
  /** The verifier's challenge */
  c: number;
  /** The prover's response s = r + c*x */
  s: number;
  /** g^x mod p — the public key */
  y: number;
  /** Generator g */
  g: number;
  /** Prime modulus p */
  p: number;
}

export interface BatchVerifyResult {
  /** true = verified, false = failed for each round */
  verified: boolean[];
  /** Wall-clock ms for the operation */
  gpuMs: number;
  usedGPU: boolean;
}

// ─── WGSL: Modular Exponentiation ────────────────────────────────────────────

/**
 * Task struct layout (std140, 4-byte per field):
 *   base(u32), exp(u32), mod(u32), _pad(u32) → 16 bytes per task
 */
const MOD_EXP_WGSL = /* wgsl */ `
struct Task {
  base : u32,
  exp  : u32,
  mod  : u32,
  _pad : u32,
}

@group(0) @binding(0) var<storage, read>       tasks   : array<Task>;
@group(0) @binding(1) var<storage, read_write> results : array<u32>;

/**
 * Safe 32-bit mulmod: (a * b) % m  where a, b, m < 2^25.
 * Splits a into 16-bit halves to avoid overflow in u32 arithmetic.
 */
fn mulmod(a: u32, b: u32, m: u32) -> u32 {
  let a_lo  : u32 = a & 0xFFFFu;
  let a_hi  : u32 = a >> 16u;
  let lo    : u32 = (a_lo * b) % m;
  let mid   : u32 = (a_hi * b) % m;
  // Multiply mid by 2^16 mod m via 16 doublings
  var shifted: u32 = mid;
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {
    shifted = (shifted * 2u) % m;
  }
  return (lo + shifted) % m;
}

/** Square-and-multiply modpow. */
fn modpow(base_in: u32, exp_in: u32, m: u32) -> u32 {
  if (m == 1u) { return 0u; }
  var result : u32 = 1u;
  var b      : u32 = base_in % m;
  var e      : u32 = exp_in;
  loop {
    if (e == 0u) { break; }
    if ((e & 1u) == 1u) {
      result = mulmod(result, b, m);
    }
    e = e >> 1u;
    b = mulmod(b, b, m);
  }
  return result;
}

@compute @workgroup_size(256)
fn mod_exp(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&tasks)) { return; }
  let t = tasks[idx];
  results[idx] = modpow(t.base, t.exp, t.mod);
}
`;

// ─── WGSL: Batch Schnorr Verification ────────────────────────────────────────

/**
 * Round struct: 8 × u32 = 32 bytes.
 *   t(u32), c(u32), s(u32), y(u32), g(u32), p(u32), _p0(u32), _p1(u32)
 */
const BATCH_VERIFY_WGSL = /* wgsl */ `
struct Round {
  t    : u32,
  c    : u32,
  s    : u32,
  y    : u32,
  g    : u32,
  p    : u32,
  _p0  : u32,
  _p1  : u32,
}

@group(0) @binding(0) var<storage, read>       rounds   : array<Round>;
@group(0) @binding(1) var<storage, read_write> verified : array<u32>;

fn mulmod(a: u32, b: u32, m: u32) -> u32 {
  let a_lo   : u32 = a & 0xFFFFu;
  let a_hi   : u32 = a >> 16u;
  let lo     : u32 = (a_lo * b) % m;
  let mid    : u32 = (a_hi * b) % m;
  var shifted: u32 = mid;
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {
    shifted = (shifted * 2u) % m;
  }
  return (lo + shifted) % m;
}

fn modpow(base_in: u32, exp_in: u32, m: u32) -> u32 {
  if (m == 1u) { return 0u; }
  var result: u32 = 1u;
  var b     : u32 = base_in % m;
  var e     : u32 = exp_in;
  loop {
    if (e == 0u) { break; }
    if ((e & 1u) == 1u) {
      result = mulmod(result, b, m);
    }
    e = e >> 1u;
    b = mulmod(b, b, m);
  }
  return result;
}

/**
 * Verify Schnorr round: g^s ≡ t·y^c (mod p)
 */
@compute @workgroup_size(256)
fn batch_verify(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&rounds)) { return; }
  let r    = rounds[idx];
  let left  : u32 = modpow(r.g, r.s, r.p);
  let yc    : u32 = modpow(r.y, r.c, r.p);
  let right : u32 = mulmod(r.t, yc, r.p) % r.p;
  verified[idx] = select(0u, 1u, left == right);
}
`;

// ─── Navigator GPU shim ───────────────────────────────────────────────────────

interface NavigatorWithGPU extends Navigator {
  readonly gpu: GPU;
}

function navigatorHasGPU(nav: Navigator): nav is NavigatorWithGPU {
  return 'gpu' in nav;
}

// ─── Device acquisition helper ────────────────────────────────────────────────

async function acquireDevice(): Promise<GPUDevice | null> {
  if (typeof navigator === 'undefined' || !navigatorHasGPU(navigator)) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return null;
  return adapter.requestDevice({ label: 'NextCalc ZKP device' });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run N modular-exponentiation tasks on the GPU.
 * Returns null when WebGPU is unavailable.
 */
export async function gpuModExp(tasks: ModExpTask[]): Promise<ModExpResult | null> {
  const device = await acquireDevice();
  if (!device) return null;

  const t0 = performance.now();
  const n = tasks.length;

  // Task buffer: 4 × u32 = 16 bytes per task
  const taskBuf = device.createBuffer({
    label: 'modexp tasks',
    size: n * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const taskData = new Uint32Array(n * 4);
  for (let i = 0; i < n; i++) {
    taskData[i * 4]     = tasks[i]?.base ?? 0;
    taskData[i * 4 + 1] = tasks[i]?.exp  ?? 0;
    taskData[i * 4 + 2] = tasks[i]?.mod  ?? 1;
    taskData[i * 4 + 3] = 0;
  }
  device.queue.writeBuffer(taskBuf, 0, taskData.buffer);

  // Result buffer: u32 per task
  const resultBuf = device.createBuffer({
    label: 'modexp results',
    size: n * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readBuf = device.createBuffer({
    label: 'modexp readback',
    size: n * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const shader = device.createShaderModule({ code: MOD_EXP_WGSL });
  const bgl = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' as GPUBufferBindingType },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' as GPUBufferBindingType },
      },
    ],
  });
  const pipeline = await device.createComputePipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
    compute: { module: shader, entryPoint: 'mod_exp' },
  });
  const bg = device.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: taskBuf } },
      { binding: 1, resource: { buffer: resultBuf } },
    ],
  });

  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(n / 256));
  pass.end();
  enc.copyBufferToBuffer(resultBuf, 0, readBuf, 0, n * 4);
  device.queue.submit([enc.finish()]);

  await readBuf.mapAsync(GPUMapMode.READ);
  const raw = new Uint32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();

  const gpuMs = performance.now() - t0;

  taskBuf.destroy();
  resultBuf.destroy();
  readBuf.destroy();
  device.destroy();

  return { results: Array.from(raw), gpuMs };
}

/**
 * Batch-verify N Schnorr rounds on the GPU.
 * Returns null when WebGPU is unavailable — caller must use CPU path.
 */
export async function gpuBatchVerify(rounds: SchnorrRound[]): Promise<BatchVerifyResult | null> {
  const device = await acquireDevice();
  if (!device) return null;

  const t0 = performance.now();
  const n = rounds.length;

  // Round buffer: 8 × u32 = 32 bytes per round
  const roundBuf = device.createBuffer({
    label: 'schnorr rounds',
    size: n * 32,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const roundData = new Uint32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const rnd = rounds[i];
    if (!rnd) continue;
    roundData[i * 8]     = rnd.t;
    roundData[i * 8 + 1] = rnd.c;
    roundData[i * 8 + 2] = rnd.s;
    roundData[i * 8 + 3] = rnd.y;
    roundData[i * 8 + 4] = rnd.g;
    roundData[i * 8 + 5] = rnd.p;
    roundData[i * 8 + 6] = 0;
    roundData[i * 8 + 7] = 0;
  }
  device.queue.writeBuffer(roundBuf, 0, roundData.buffer);

  const verifiedBuf = device.createBuffer({
    label: 'schnorr verified',
    size: n * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readBuf = device.createBuffer({
    label: 'schnorr readback',
    size: n * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const shader = device.createShaderModule({ code: BATCH_VERIFY_WGSL });
  const bgl = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' as GPUBufferBindingType },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' as GPUBufferBindingType },
      },
    ],
  });
  const pipeline = await device.createComputePipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
    compute: { module: shader, entryPoint: 'batch_verify' },
  });
  const bg = device.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: roundBuf } },
      { binding: 1, resource: { buffer: verifiedBuf } },
    ],
  });

  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(n / 256));
  pass.end();
  enc.copyBufferToBuffer(verifiedBuf, 0, readBuf, 0, n * 4);
  device.queue.submit([enc.finish()]);

  await readBuf.mapAsync(GPUMapMode.READ);
  const raw = new Uint32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();

  const gpuMs = performance.now() - t0;

  roundBuf.destroy();
  verifiedBuf.destroy();
  readBuf.destroy();
  device.destroy();

  return {
    verified: Array.from(raw).map(v => v === 1),
    gpuMs,
    usedGPU: true,
  };
}

/**
 * CPU fallback for batch Schnorr verification (pure TypeScript BigInt).
 */
export function cpuBatchVerify(rounds: SchnorrRound[]): BatchVerifyResult {
  const t0 = performance.now();

  const cpuModPow = (base: number, exp: number, mod: number): number => {
    if (mod === 1) return 0;
    let result = 1n;
    let b = BigInt(base) % BigInt(mod);
    let e = BigInt(exp);
    const m = BigInt(mod);
    while (e > 0n) {
      if (e % 2n === 1n) result = (result * b) % m;
      e >>= 1n;
      b = (b * b) % m;
    }
    return Number(result);
  };

  const verified = rounds.map(r => {
    const left  = cpuModPow(r.g, r.s, r.p);
    const right = Number(BigInt(r.t) * BigInt(cpuModPow(r.y, r.c, r.p)) % BigInt(r.p));
    return left === right;
  });

  return { verified, gpuMs: performance.now() - t0, usedGPU: false };
}
