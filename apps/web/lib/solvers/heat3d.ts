/**
 * 3D Heat Equation Solver (FTCS Explicit Scheme)
 *
 * Solves the heat equation in three dimensions:
 *   du/dt = alpha * (d2u/dx2 + d2u/dy2 + d2u/dz2)
 *
 * Uses a flat Float32Array grid of N x N x N with Dirichlet boundary
 * conditions (zero at all boundaries).
 *
 * Stability condition: alpha * dt / dx^2 <= 1/6
 * The solver clamps r = alpha * dt / dx^2 to 0.16 for safety.
 *
 * @module lib/solvers/heat3d
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Heat3DParams {
  /** Thermal diffusivity coefficient */
  alpha: number;
  /** Time step */
  dt: number;
  /** Spatial step (uniform in x, y, z) */
  dx: number;
}

export type InitialCondition3D = 'gaussian' | 'randomHotspots' | 'planeWave';

// ---------------------------------------------------------------------------
// Index helpers
// ---------------------------------------------------------------------------

/** Convert 3D indices to flat array index */
function idx(i: number, j: number, k: number, N: number): number {
  return i * N * N + j * N + k;
}

// ---------------------------------------------------------------------------
// Initial condition generators
// ---------------------------------------------------------------------------

/**
 * Create a Gaussian blob centered at (cx, cy, cz) with spread sigma.
 * Values are normalized to a peak of 1.0.
 */
export function gaussianBlob(
  N: number,
  cx: number,
  cy: number,
  cz: number,
  sigma: number,
): Float32Array {
  const grid = new Float32Array(N * N * N);
  const invTwoSigmaSq = 1 / (2 * sigma * sigma);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        const di = i - cx;
        const dj = j - cy;
        const dk = k - cz;
        grid[idx(i, j, k, N)] = Math.exp(-(di * di + dj * dj + dk * dk) * invTwoSigmaSq);
      }
    }
  }
  return grid;
}

/**
 * Create several random hot spots scattered through the domain.
 * Each hotspot is a small Gaussian blob with random center and fixed sigma.
 */
export function randomHotspots(N: number, count: number): Float32Array {
  const grid = new Float32Array(N * N * N);
  const sigma = N / 10;
  const invTwoSigmaSq = 1 / (2 * sigma * sigma);

  for (let h = 0; h < count; h++) {
    const cx = Math.random() * (N - 2) + 1;
    const cy = Math.random() * (N - 2) + 1;
    const cz = Math.random() * (N - 2) + 1;

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        for (let k = 0; k < N; k++) {
          const di = i - cx;
          const dj = j - cy;
          const dk = k - cz;
          const val = Math.exp(-(di * di + dj * dj + dk * dk) * invTwoSigmaSq);
          const index = idx(i, j, k, N);
          grid[index] = Math.min(1.0, grid[index]! + val);
        }
      }
    }
  }
  return grid;
}

/**
 * Create a plane wave initial condition:
 *   u(x, y, z) = sin(2 * pi * freq * coord / N)
 * where coord is determined by axis ('x', 'y', or 'z').
 */
export function planeWave(N: number, axis: 'x' | 'y' | 'z', freq: number): Float32Array {
  const grid = new Float32Array(N * N * N);
  const scale = (2 * Math.PI * freq) / N;

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        let coord: number;
        if (axis === 'x') coord = i;
        else if (axis === 'y') coord = j;
        else coord = k;

        // Use sin^2 to keep values non-negative and smooth
        const s = Math.sin(coord * scale);
        grid[idx(i, j, k, N)] = s * s;
      }
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Perform a single time step of the 3D heat equation using the FTCS
 * (Forward-Time Central-Space) explicit finite difference scheme.
 *
 * Returns a new Float32Array containing the updated field.
 * Dirichlet boundary conditions: u = 0 on all faces.
 *
 * The stability parameter r = alpha * dt / dx^2 is clamped to 0.16
 * (the theoretical limit is 1/6 ~ 0.1667) to keep the scheme stable.
 */
export function stepHeat3D(
  grid: Float32Array,
  N: number,
  alpha: number,
  dt: number,
  dx: number,
): Float32Array {
  const out = new Float32Array(N * N * N);

  // Compute r, clamped for stability
  let r = (alpha * dt) / (dx * dx);
  if (r > 0.16) r = 0.16;

  // Interior points only (boundaries remain 0)
  for (let i = 1; i < N - 1; i++) {
    for (let j = 1; j < N - 1; j++) {
      for (let k = 1; k < N - 1; k++) {
        const c = idx(i, j, k, N);
        const u = grid[c]!;

        const laplacian =
          grid[idx(i + 1, j, k, N)]! +
          grid[idx(i - 1, j, k, N)]! +
          grid[idx(i, j + 1, k, N)]! +
          grid[idx(i, j - 1, k, N)]! +
          grid[idx(i, j, k + 1, N)]! +
          grid[idx(i, j, k - 1, N)]! -
          6 * u;

        out[c] = u + r * laplacian;
      }
    }
  }

  return out;
}

/**
 * Generate a default initial condition by type.
 */
export function createInitialCondition3D(type: InitialCondition3D, N: number): Float32Array {
  const center = N / 2;
  switch (type) {
    case 'gaussian':
      return gaussianBlob(N, center, center, center, N / 6);
    case 'randomHotspots':
      return randomHotspots(N, 5);
    case 'planeWave':
      return planeWave(N, 'x', 2);
  }
}
