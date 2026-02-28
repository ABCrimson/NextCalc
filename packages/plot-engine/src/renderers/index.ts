/**
 * Renderer exports and factory utilities
 * @module renderers
 */

export * from './webgl-2d';
export * from './webgpu-2d';
export * from './canvas-2d';
export * from './shaders';
export * from './wgsl-shaders';

// 3D renderer will be lazy-loaded via loadWebGL3DRenderer() in the barrel
export type { WebGL3DRenderer } from './webgl-3d';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

import type { IRenderer } from '../types/index';
import { detectBestBackend } from '../utils/gpu-detection';
import { WebGPU2DRenderer } from './webgpu-2d';
import { WebGL2DRenderer } from './webgl-2d';
import { Canvas2DRenderer } from './canvas-2d';

/**
 * Creates and returns the best available 2D renderer for the current
 * environment.
 *
 * Selection order:
 *   1. WebGPU   – when navigator.gpu is present and a GPU adapter is obtainable
 *   2. WebGL 2  – universal fallback for all modern browsers
 *   3. Canvas2D – minimal fallback when no GPU API is available
 *
 * The returned renderer has NOT been initialized yet.
 * Call `renderer.initialize()` before rendering.
 *
 * @param canvas  The HTMLCanvasElement to render into.
 * @returns       Promise resolving to the most capable IRenderer instance.
 *
 * @example
 * const renderer = await createBest2DRenderer(canvas);
 * await renderer.initialize();
 * renderer.render(config);
 */
export async function createBest2DRenderer(canvas: HTMLCanvasElement): Promise<IRenderer> {
  const backend = await detectBestBackend();

  if (backend === 'webgpu') {
    return new WebGPU2DRenderer(canvas);
  }

  if (backend === 'webgl2') {
    return new WebGL2DRenderer(canvas);
  }

  // Canvas 2D — software fallback for environments without GPU acceleration.
  // Supports Cartesian, polar, and parametric 2D plots.
  return new Canvas2DRenderer(canvas);
}
