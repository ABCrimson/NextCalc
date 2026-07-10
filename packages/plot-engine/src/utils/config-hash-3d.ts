/**
 * Pure, side-effect-free change-detection hashing for 3D plot configs.
 * Used by WebGL3DRenderer to decide whether the plotted geometry needs to be
 * rebuilt, or whether the previous frame's mesh can be reused as-is.
 *
 * `JSON.stringify` silently *drops* function-valued properties, so a naive
 * `JSON.stringify(config)` hash is blind to the plotted function itself
 * changing as long as every other field (viewport, resolution, colorMap, ...)
 * stays the same — editing a formula with an unchanged viewport/resolution
 * would never trigger a rebuild. We fold in a stable per-closure id (see
 * `fn-identity.ts`) for every function on the config so a different function
 * reference always produces a different hash, regardless of what else is
 * (or isn't) JSON-serializable.
 *
 * @module utils/config-hash-3d
 */

import type {
  Plot3DCurveConfig,
  Plot3DParametricCurveConfig,
  Plot3DParametricSurfaceConfig,
  Plot3DSurfaceConfig,
  PlotConfig,
} from '../types/index';
import { getFunctionId } from './fn-identity';

/** Union of the four plot config types the WebGL 3D renderer supports. */
export type Plot3DConfig =
  | Plot3DSurfaceConfig
  | Plot3DParametricSurfaceConfig
  | Plot3DCurveConfig
  | Plot3DParametricCurveConfig;

const PLOT_3D_TYPES: ReadonlySet<PlotConfig['type']> = new Set([
  '3d-surface',
  '3d-parametric',
  '3d-curve',
  '3d-parametric-curve',
] satisfies Plot3DConfig['type'][]);

/**
 * Type guard for 3D plot configs — the single source of truth for which plot
 * types the WebGL 3D renderer (and this hash) support. `render()` validates
 * with this BEFORE hashing so a 2D config fails with a descriptive
 * "Unsupported plot type" error instead of an opaque TypeError from
 * `getFunctionId(undefined)` in the hash fallthrough.
 */
export function isPlot3DConfig(config: PlotConfig): config is Plot3DConfig {
  return PLOT_3D_TYPES.has(config.type);
}

/**
 * Computes a change-detection hash for a 3D plot config.
 * Same config shape + same function references + same other fields ⇒ same hash.
 * Any different function reference ⇒ a different hash, even when the
 * function's source text is byte-identical to the previous one.
 */
export function hashPlot3DConfig(config: Plot3DConfig): string {
  const { type } = config;

  if (type === '3d-surface') {
    const { viewport, resolution, colorMap, wireframe, fn } = config;
    return JSON.stringify({
      type,
      viewport,
      resolution,
      colorMap,
      wireframe,
      fnId: getFunctionId(fn),
    });
  }

  if (type === '3d-parametric') {
    const { uRange, vRange, resolution, colorMap, functions } = config;
    return JSON.stringify({
      type,
      uRange,
      vRange,
      resolution,
      colorMap,
      fnIds: [getFunctionId(functions.x), getFunctionId(functions.y), getFunctionId(functions.z)],
    });
  }

  // 3d-curve | 3d-parametric-curve (narrowed by the early returns above)
  const { type: _type, functions, ...rest } = config;
  return JSON.stringify({
    type,
    ...rest,
    fnIds: [getFunctionId(functions.x), getFunctionId(functions.y), getFunctionId(functions.z)],
  });
}
