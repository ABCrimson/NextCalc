/**
 * WGSL Compute Shader for GPU-Accelerated Lorenz Attractor Particle Field
 *
 * Runs RK4 integration of the Lorenz system (dx/dt = sigma(y-x), dy/dt = x(rho-z)-y,
 * dz/dt = xy - beta*z) for N particles simultaneously on the GPU.
 *
 * Particle buffer layout: stride = 4 floats per particle [x, y, z, speed]
 * Params uniform: [particleCount, dt, sigma, rho, beta, time, _pad0, _pad1]
 *
 * @module components/chaos/lorenz-compute-shaders
 */

/** Size of the params uniform buffer in bytes (8 x f32 = 32 bytes) */
export const LORENZ_PARAMS_SIZE = 32;

/** Stride per particle in the storage buffer: 4 floats (x, y, z, speed) */
export const LORENZ_PARTICLE_STRIDE = 4;

/** Bytes per particle: 4 floats * 4 bytes = 16 */
export const LORENZ_PARTICLE_BYTES = 16;

/** Compute shader workgroup size — must match @workgroup_size in the WGSL */
export const LORENZ_WORKGROUP_SIZE = 256;

/** Default Lorenz system parameters */
export const LORENZ_DEFAULTS = {
  sigma: 10.0,
  rho: 28.0,
  beta: 8.0 / 3.0,
  dt: 0.005,
} as const;

export const WGSL_LORENZ_COMPUTE = /* wgsl */ `
struct Params {
  particleCount : u32,
  dt            : f32,
  sigma         : f32,
  rho           : f32,
  beta          : f32,
  time          : f32,
  _pad0         : u32,
  _pad1         : u32,
}

@group(0) @binding(0) var<uniform>            params    : Params;
@group(0) @binding(1) var<storage, read_write> particles : array<f32>;

fn lorenz(p: vec3<f32>, s: f32, r: f32, b: f32) -> vec3<f32> {
  return vec3<f32>(
    s * (p.y - p.x),
    p.x * (r - p.z) - p.y,
    p.x * p.y - b * p.z
  );
}

// PCG hash for deterministic respawn randomness
fn pcgHash(input: u32) -> u32 {
  var state = input * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn hashToFloat01(h: u32) -> f32 {
  return f32(h) / 4294967295.0;
}

@compute @workgroup_size(256)
fn cs_lorenz(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if idx >= params.particleCount { return; }

  let base = idx * 4u;
  var p = vec3<f32>(particles[base], particles[base + 1u], particles[base + 2u]);

  // RK4 integration of the Lorenz ODE system
  let dt = params.dt;
  let s = params.sigma;
  let r = params.rho;
  let b = params.beta;

  let k1 = lorenz(p, s, r, b);
  let k2 = lorenz(p + 0.5 * dt * k1, s, r, b);
  let k3 = lorenz(p + 0.5 * dt * k2, s, r, b);
  let k4 = lorenz(p + dt * k3, s, r, b);
  p += (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);

  // Velocity magnitude for coloring (use k1 = instantaneous derivative)
  let vel = length(k1);

  // Respawn if diverged beyond attractor basin or NaN
  if any(abs(p) > vec3<f32>(100.0)) || any(p != p) {
    // PCG hash for deterministic respawn position
    let seed = pcgHash(idx + u32(params.time * 1000.0));
    let rx = hashToFloat01(pcgHash(seed));
    let ry = hashToFloat01(pcgHash(seed + 1u));
    let rz = hashToFloat01(pcgHash(seed + 2u));
    p = vec3<f32>(
      (rx - 0.5) * 40.0,
      (ry - 0.5) * 40.0,
      rz * 40.0 + 5.0
    );
  }

  particles[base]      = p.x;
  particles[base + 1u] = p.y;
  particles[base + 2u] = p.z;
  particles[base + 3u] = vel;
}
`;
