/**
 * 3D Wave Equation Solver (Verlet / Leapfrog Scheme)
 *
 * Solves the wave equation in three dimensions:
 *   d2u/dt2 = c^2 * (d2u/dx2 + d2u/dy2 + d2u/dz2)
 *
 * Uses two flat Float32Array buffers (prev, curr) to produce next.
 * Dirichlet boundary conditions (zero at all boundaries).
 *
 * CFL condition: c * dt / dx <= 1 / sqrt(3)
 * The solver clamps r^2 = (c * dt / dx)^2 to 0.33 for safety.
 *
 * @module lib/solvers/wave3d
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Wave3DParams {
  /** Wave propagation speed */
  c: number;
  /** Time step */
  dt: number;
  /** Spatial step (uniform in x, y, z) */
  dx: number;
}

// ---------------------------------------------------------------------------
// Index helper
// ---------------------------------------------------------------------------

function idx(i: number, j: number, k: number, N: number): number {
  return i * N * N + j * N + k;
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Perform a single time step of the 3D wave equation using the Verlet
 * (leapfrog) explicit finite difference scheme.
 *
 * u_next[i,j,k] = 2 * u_curr - u_prev + r2 * (laplacian of u_curr)
 *
 * where r2 = (c * dt / dx)^2, clamped to 0.33 for CFL stability.
 *
 * Returns a new Float32Array containing the next time step.
 * Dirichlet boundary conditions: u = 0 on all faces.
 */
export function stepWave3D(
  prev: Float32Array,
  curr: Float32Array,
  N: number,
  c: number,
  dt: number,
  dx: number,
): Float32Array {
  const next = new Float32Array(N * N * N);

  // Compute r^2, clamped for CFL stability
  let r2 = ((c * dt) / dx) * ((c * dt) / dx);
  if (r2 > 0.33) r2 = 0.33;

  // Interior points only (boundaries remain 0)
  for (let i = 1; i < N - 1; i++) {
    for (let j = 1; j < N - 1; j++) {
      for (let k = 1; k < N - 1; k++) {
        const ci = idx(i, j, k, N);
        const uCurr = curr[ci]!;
        const uPrev = prev[ci]!;

        const laplacian =
          curr[idx(i + 1, j, k, N)]! +
          curr[idx(i - 1, j, k, N)]! +
          curr[idx(i, j + 1, k, N)]! +
          curr[idx(i, j - 1, k, N)]! +
          curr[idx(i, j, k + 1, N)]! +
          curr[idx(i, j, k - 1, N)]! -
          6 * uCurr;

        next[ci] = 2 * uCurr - uPrev + r2 * laplacian;
      }
    }
  }

  return next;
}
