/**
 * Lorenz Attractor system constants.
 *
 * The WGSL compute shader and raw-WebGPU pipeline constants have been removed
 * in favour of the three.js 0.184 TSL-compute idiom (instancedArray + Fn).
 * Only the Lorenz system parameters remain here as they are shared between
 * the TSL compute kernel and CPU-side initialisation logic.
 *
 * @module components/chaos/lorenz-compute-shaders
 */

/** Default Lorenz system parameters */
export const LORENZ_DEFAULTS = {
  sigma: 10.0,
  rho: 28.0,
  beta: 8.0 / 3.0,
  dt: 0.005,
} as const;
