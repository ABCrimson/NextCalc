/**
 * Renderer exports and factory utilities
 * @module renderers
 */

export * from './canvas-2d';
export * from './shaders';
export * from './webgl-2d';
// 3D renderer will be lazy-loaded via loadWebGL3DRenderer() in the barrel
export type { WebGL3DRenderer } from './webgl-3d';
export * from './webgpu-2d';
export * from './wgsl-shaders';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

import type { IRenderer } from '../types/index';
import { detectBestBackend } from '../utils/gpu-detection';
import { Canvas2DRenderer } from './canvas-2d';
import { WebGL2DRenderer } from './webgl-2d';
import { WebGPU2DRenderer } from './webgpu-2d';

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

/**
 * Creates AND initializes the best available 2D renderer, falling through to
 * the next candidate if `initialize()` itself throws — not just when the
 * capability probe (`detectBestBackend`) predicted unavailability.
 *
 * `createBest2DRenderer` only picks a constructor based on feature detection
 * (`navigator.gpu` presence, etc.); it never calls `initialize()`, so a
 * WebGPU adapter that exists but fails to produce a working device (driver
 * bug, exhausted GPU process, disabled in a sandboxed context, ...) still
 * gets selected and only fails later, when the caller invokes
 * `renderer.initialize()` themselves — with no fallback in place.
 *
 * This helper tries each backend in order (WebGPU → WebGL2 → Canvas2D),
 * calling `initialize()` on each candidate and moving to the next one on
 * failure, so the caller always gets back a renderer that has *already*
 * initialized successfully (or an error if every backend failed).
 *
 * @param canvas  The HTMLCanvasElement to render into.
 * @returns       Promise resolving to an already-initialized IRenderer.
 *
 * @example
 * const renderer = await createAndInitBest2DRenderer(canvas);
 * renderer.render(config); // no separate initialize() call needed
 */
export async function createAndInitBest2DRenderer(canvas: HTMLCanvasElement): Promise<IRenderer> {
  const factories: Array<() => IRenderer> = [
    () => new WebGPU2DRenderer(canvas),
    () => new WebGL2DRenderer(canvas),
    () => new Canvas2DRenderer(canvas),
  ];

  let lastError: unknown;
  for (const create of factories) {
    const renderer = create();
    try {
      await renderer.initialize();
      return renderer;
    } catch (error) {
      lastError = error;
      try {
        renderer.dispose();
      } catch {
        // Best-effort cleanup of a partially-initialized renderer — ignore.
      }
    }
  }

  throw new Error(
    `createAndInitBest2DRenderer: every rendering backend failed to initialize ` +
      `(WebGPU, WebGL2, Canvas2D). Last error: ${String(lastError)}`,
  );
}
