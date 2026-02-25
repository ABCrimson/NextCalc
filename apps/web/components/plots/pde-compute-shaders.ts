/**
 * WGSL Compute Shaders for GPU-Accelerated PDE Solvers
 *
 * Implements finite difference stencils for:
 *   - Heat equation:    u_t  = α∇²u
 *   - Wave equation:    u_tt = c²∇²u  (Verlet integration)
 *   - Laplace equation: ∇²u  = 0      (Jacobi iteration)
 *
 * Ping-pong pattern: two storage buffers (A and B).
 * Each dispatch reads from the "current" buffer and writes to "next".
 * The host swaps them after each step.
 *
 * Grid layout: row-major Float32 flat buffers of length (gridW * gridH).
 * Cell (i, j) is at index (j * gridW + i).  (i = column, j = row)
 *
 * @module components/plots/pde-compute-shaders
 */

// ---------------------------------------------------------------------------
// Uniform block shared across all compute shaders
//
// Offset  Size  Field
//   0      4    gridW      (u32)
//   4      4    gridH      (u32)
//   8      4    dt         (f32)  – time step
//  12      4    dx         (f32)  – spatial step
//  16      4    alpha      (f32)  – heat diffusivity OR c² for wave
//  20      4    _pad0      (u32)
//  24      4    _pad1      (u32)
//  28      4    _pad2      (u32)
// Total: 32 bytes (2× 16-byte rows)
// ---------------------------------------------------------------------------

export const PDE_UNIFORM_SIZE = 32; // bytes

// ---------------------------------------------------------------------------
// Heat equation compute shader
//
// Forward Euler (FTCS):
//   u_new[i,j] = u[i,j] + alpha*dt/dx² * (u[i+1,j] + u[i-1,j]
//                                          + u[i,j+1] + u[i,j-1]
//                                          - 4*u[i,j])
//
// Stability: alpha*dt/dx² <= 0.25 must be satisfied by the caller.
// Boundary cells are held at 0 (Dirichlet).
// ---------------------------------------------------------------------------
export const WGSL_HEAT_COMPUTE = /* wgsl */ `
struct Uniforms {
  gridW : u32,
  gridH : u32,
  dt    : f32,
  dx    : f32,
  alpha : f32,
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
}

@group(0) @binding(0) var<uniform>            u    : Uniforms;
@group(0) @binding(1) var<storage, read>       src  : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst  : array<f32>;

// Boundary check helper
fn idx(col: u32, row: u32) -> u32 {
  return row * u.gridW + col;
}

fn safe(col: u32, row: u32) -> f32 {
  if col >= u.gridW || row >= u.gridH { return 0.0; }
  return src[idx(col, row)];
}

@compute @workgroup_size(16, 16)
fn cs_heat(@builtin(global_invocation_id) gid: vec3<u32>) {
  let col = gid.x;
  let row = gid.y;
  if col >= u.gridW || row >= u.gridH { return; }

  // Dirichlet: boundary cells stay at 0
  if col == 0u || col == u.gridW - 1u || row == 0u || row == u.gridH - 1u {
    dst[idx(col, row)] = 0.0;
    return;
  }

  let center = safe(col,     row    );
  let right  = safe(col + 1u, row   );
  let left   = safe(col - 1u, row   );
  let up     = safe(col,     row + 1u);
  let down   = safe(col,     row - 1u);

  let laplacian = right + left + up + down - 4.0 * center;
  let r = clamp(u.alpha * u.dt / (u.dx * u.dx), 0.0, 0.24);
  dst[idx(col, row)] = center + r * laplacian;
}
`;

// ---------------------------------------------------------------------------
// Wave equation compute shader  (Verlet / leapfrog)
//
// u_next[i,j] = 2*u_curr[i,j] - u_prev[i,j]
//             + c²*dt²/dx² * (u_curr[i+1,j] + u_curr[i-1,j]
//                             + u_curr[i,j+1] + u_curr[i,j-1]
//                             - 4*u_curr[i,j])
//
// Requires THREE buffers: prev, curr, next.
// Binding layout:
//   binding 1 – u_prev (read)
//   binding 2 – u_curr (read)
//   binding 3 – u_next (read_write)
// ---------------------------------------------------------------------------
export const WGSL_WAVE_COMPUTE = /* wgsl */ `
struct Uniforms {
  gridW : u32,
  gridH : u32,
  dt    : f32,
  dx    : f32,
  c2    : f32,   // wave speed squared (c²)
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
}

@group(0) @binding(0) var<uniform>            u    : Uniforms;
@group(0) @binding(1) var<storage, read>       prev : array<f32>;
@group(0) @binding(2) var<storage, read>       curr : array<f32>;
@group(0) @binding(3) var<storage, read_write> next : array<f32>;

fn idx(col: u32, row: u32) -> u32 {
  return row * u.gridW + col;
}

fn safeC(col: u32, row: u32) -> f32 {
  if col >= u.gridW || row >= u.gridH { return 0.0; }
  return curr[idx(col, row)];
}

@compute @workgroup_size(16, 16)
fn cs_wave(@builtin(global_invocation_id) gid: vec3<u32>) {
  let col = gid.x;
  let row = gid.y;
  if col >= u.gridW || row >= u.gridH { return; }

  // Dirichlet: boundary cells stay at 0
  if col == 0u || col == u.gridW - 1u || row == 0u || row == u.gridH - 1u {
    next[idx(col, row)] = 0.0;
    return;
  }

  let center = safeC(col,      row    );
  let right  = safeC(col + 1u, row    );
  let left   = safeC(col - 1u, row    );
  let up     = safeC(col,      row + 1u);
  let down   = safeC(col,      row - 1u);

  let r2    = (u.c2 * u.dt * u.dt) / (u.dx * u.dx);
  let prevV = prev[idx(col, row)];

  next[idx(col, row)] = 2.0 * center - prevV + r2 * (right + left + up + down - 4.0 * center);
}
`;

// ---------------------------------------------------------------------------
// Laplace equation compute shader  (Jacobi iteration)
//
// u_new[i,j] = (u[i+1,j] + u[i-1,j] + u[i,j+1] + u[i,j-1]) / 4
//
// Run many iterations per frame for convergence.
// Boundary cells are held at their initial values (kept in src).
// ---------------------------------------------------------------------------
export const WGSL_LAPLACE_COMPUTE = /* wgsl */ `
struct Uniforms {
  gridW : u32,
  gridH : u32,
  dt    : f32,
  dx    : f32,
  alpha : f32,
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
}

@group(0) @binding(0) var<uniform>            u    : Uniforms;
@group(0) @binding(1) var<storage, read>       src  : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst  : array<f32>;
// Boundary mask: non-zero means the cell is a boundary (keep original value)
@group(0) @binding(3) var<storage, read>       mask : array<u32>;

fn idx(col: u32, row: u32) -> u32 {
  return row * u.gridW + col;
}

fn safe(col: u32, row: u32) -> f32 {
  if col >= u.gridW || row >= u.gridH { return 0.0; }
  return src[idx(col, row)];
}

@compute @workgroup_size(16, 16)
fn cs_laplace(@builtin(global_invocation_id) gid: vec3<u32>) {
  let col = gid.x;
  let row = gid.y;
  if col >= u.gridW || row >= u.gridH { return; }

  let i = idx(col, row);

  // Keep boundary values fixed
  if mask[i] != 0u {
    dst[i] = src[i];
    return;
  }

  // Jacobi: average of four neighbors
  let right = safe(col + 1u, row    );
  let left  = safe(col - 1u, row    );
  let up    = safe(col,      row + 1u);
  let down  = safe(col,      row - 1u);

  dst[i] = (right + left + up + down) * 0.25;
}
`;

// ---------------------------------------------------------------------------
// Gradient + particle advection compute shader
//
// Pass 1 (cs_gradient): compute gradient field from scalar field
//   gx[i,j] = (u[i+1,j] - u[i-1,j]) / (2*dx)   (central difference)
//   gy[i,j] = (u[i,j+1] - u[i,j-1]) / (2*dx)
//
// Pass 2 (cs_particles): update particle positions
//   px += gx_at_particle * dt * scale
//   py += gy_at_particle * dt * scale
//   Particles that leave [0,1] are wrapped around.
//
// Particle buffer layout (stride = 4 floats per particle):
//   [px, py, vx, vy]  – position in [0,1]², velocity (unused currently)
// ---------------------------------------------------------------------------
export const WGSL_GRADIENT_COMPUTE = /* wgsl */ `
struct Uniforms {
  gridW : u32,
  gridH : u32,
  dt    : f32,
  dx    : f32,
  alpha : f32,
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
}

@group(0) @binding(0) var<uniform>            u      : Uniforms;
// scalar field (read)
@group(0) @binding(1) var<storage, read>       field  : array<f32>;
// gradient output: interleaved [gx0, gy0, gx1, gy1, ...]
@group(0) @binding(2) var<storage, read_write> grad   : array<f32>;

fn idx(col: u32, row: u32) -> u32 {
  return row * u.gridW + col;
}

fn safeF(col: u32, row: u32) -> f32 {
  if col >= u.gridW || row >= u.gridH { return 0.0; }
  return field[idx(col, row)];
}

@compute @workgroup_size(16, 16)
fn cs_gradient(@builtin(global_invocation_id) gid: vec3<u32>) {
  let col = gid.x;
  let row = gid.y;
  if col >= u.gridW || row >= u.gridH { return; }

  var gx: f32 = 0.0;
  var gy: f32 = 0.0;

  // Central differences (fall back to one-sided at boundary)
  if col > 0u && col < u.gridW - 1u {
    gx = (safeF(col + 1u, row) - safeF(col - 1u, row)) / (2.0 * u.dx);
  }
  if row > 0u && row < u.gridH - 1u {
    gy = (safeF(col, row + 1u) - safeF(col, row - 1u)) / (2.0 * u.dx);
  }

  let base = (row * u.gridW + col) * 2u;
  grad[base]      = gx;
  grad[base + 1u] = gy;
}
`;

export const WGSL_PARTICLE_COMPUTE = /* wgsl */ `
struct Uniforms {
  gridW       : u32,
  gridH       : u32,
  dt          : f32,
  dx          : f32,
  alpha       : f32,
  _pad0       : u32,
  _pad1       : u32,
  _pad2       : u32,
}

struct ParticleUniforms {
  particleCount : u32,
  advectScale   : f32,
  _pad0         : u32,
  _pad1         : u32,
}

@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage, read>       grad   : array<f32>;
// particles: stride 4 floats [px, py, age, _pad]
@group(0) @binding(2) var<storage, read_write> parts  : array<f32>;
@group(0) @binding(3) var<uniform>             pu     : ParticleUniforms;

@compute @workgroup_size(64)
fn cs_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pid = gid.x;
  if pid >= pu.particleCount { return; }

  let base = pid * 4u;
  var px  = parts[base];
  var py  = parts[base + 1u];
  var age = parts[base + 2u];

  // Age out and respawn at random position using pid as seed
  age += u.dt;
  if age > 4.0 || px < 0.0 || px > 1.0 || py < 0.0 || py > 1.0 {
    // Simple LCG-ish respawn
    let seed = pid * 1664525u + 1013904223u;
    px  = f32((seed >> 8u) & 0xFFFFu) / 65535.0;
    py  = f32((seed >> 24u) & 0xFFFFu) / 65535.0;
    age = 0.0;
  }

  // Bilinear sample gradient at (px, py)
  let fx = clamp(px * f32(u.gridW - 1u), 0.0, f32(u.gridW - 1u));
  let fy = clamp(py * f32(u.gridH - 1u), 0.0, f32(u.gridH - 1u));
  let ix = u32(fx);
  let iy = u32(fy);
  let tx = fx - f32(ix);
  let ty = fy - f32(iy);

  let ix1 = min(ix + 1u, u.gridW  - 1u);
  let iy1 = min(iy + 1u, u.gridH  - 1u);

  let b00 = (iy  * u.gridW + ix ) * 2u;
  let b10 = (iy  * u.gridW + ix1) * 2u;
  let b01 = (iy1 * u.gridW + ix ) * 2u;
  let b11 = (iy1 * u.gridW + ix1) * 2u;

  let gx = mix(mix(grad[b00], grad[b10], tx), mix(grad[b01], grad[b11], tx), ty);
  let gy = mix(mix(grad[b00 + 1u], grad[b10 + 1u], tx), mix(grad[b01 + 1u], grad[b11 + 1u], tx), ty);

  px += gx * u.dt * pu.advectScale;
  py += gy * u.dt * pu.advectScale;

  parts[base]      = px;
  parts[base + 1u] = py;
  parts[base + 2u] = age;
  parts[base + 3u] = 0.0;
}
`;
