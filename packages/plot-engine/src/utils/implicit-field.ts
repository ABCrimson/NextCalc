/**
 * Scalar-field sampling for implicit curves and inequality regions.
 *
 * `sampleScalarField` evaluates F(x, y) on a regular grid using an adaptive
 * two-level scheme: a coarse pass finds the cells where F changes sign (or is
 * NaN), only those cells receive exact fine-grid evaluations, and the rest is
 * bilinearly interpolated from the coarse corners. Sign-constant regions stay
 * sign-correct under bilinear interpolation, so downstream marching-squares
 * contours and region masks are exact while the number of field evaluations
 * drops by an order of magnitude for typical curves.
 *
 * Non-finite samples stay NaN — they are *not* zeroed. Zeroing manufactured
 * fake F = 0 contours along every singularity/domain hole (the historical
 * behaviour of both renderImplicit implementations); NaN cells are instead
 * skipped by the (NaN-aware) marching squares and masked out by shaders.
 *
 * @module utils/implicit-field
 */

import type { Viewport } from '../types/index';
import { getFunctionId } from './fn-identity';

/** A sampled scalar field over a viewport-aligned regular grid. */
export interface ScalarField {
  /** Row-major values: grid[i][j] = F(xMin + j·dx, yMin + i·dy) */
  grid: number[][];
  /** Number of cells in x (grid has nx + 1 columns) */
  nx: number;
  /** Number of cells in y (grid has ny + 1 rows) */
  ny: number;
  /** Grid spacing in x */
  dx: number;
  /** Grid spacing in y */
  dy: number;
}

type FieldViewport = Omit<Viewport, 'zMin' | 'zMax'>;

/** Number of coarse cells per axis in the first sampling pass. */
const COARSE_CELLS = 48;

/** Default fine-grid resolution (cells per axis). */
export const DEFAULT_FIELD_RESOLUTION = { x: 256, y: 256 } as const;

function safeEval(fn: (x: number, y: number) => number, x: number, y: number): number {
  try {
    const v = fn(x, y);
    return Number.isFinite(v) ? v : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

/**
 * Samples F(x, y) over the viewport on a (resolution.y + 1) × (resolution.x + 1)
 * grid using coarse-then-refine adaptive evaluation. See module docs.
 */
export function sampleScalarField(
  fn: (x: number, y: number) => number,
  viewport: FieldViewport,
  resolution: { x: number; y: number } = DEFAULT_FIELD_RESOLUTION,
): ScalarField {
  const nx = Math.max(1, Math.floor(resolution.x));
  const ny = Math.max(1, Math.floor(resolution.y));
  const dx = (viewport.xMax - viewport.xMin) / nx;
  const dy = (viewport.yMax - viewport.yMin) / ny;

  const cols = nx + 1;
  const rows = ny + 1;
  const grid: number[][] = new Array(rows);
  for (let i = 0; i < rows; i++) {
    grid[i] = new Array<number>(cols);
  }

  const xAt = (j: number) => viewport.xMin + j * dx;
  const yAt = (i: number) => viewport.yMin + i * dy;

  // Small grids: exact evaluation everywhere, no adaptivity needed.
  if (nx <= COARSE_CELLS || ny <= COARSE_CELLS) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        grid[i]![j] = safeEval(fn, xAt(j), yAt(i));
      }
    }
    return { grid, nx, ny, dx, dy };
  }

  // --- Coarse pass -----------------------------------------------------
  // Coarse corners are snapped onto fine grid indices so their exact values
  // can be written straight into the fine grid.
  const coarseJ: number[] = new Array(COARSE_CELLS + 1);
  const coarseI: number[] = new Array(COARSE_CELLS + 1);
  for (let k = 0; k <= COARSE_CELLS; k++) {
    coarseJ[k] = Math.round((k * nx) / COARSE_CELLS);
    coarseI[k] = Math.round((k * ny) / COARSE_CELLS);
  }

  const coarse: number[][] = new Array(COARSE_CELLS + 1);
  for (let ci = 0; ci <= COARSE_CELLS; ci++) {
    coarse[ci] = new Array<number>(COARSE_CELLS + 1);
    for (let cj = 0; cj <= COARSE_CELLS; cj++) {
      coarse[ci]![cj] = safeEval(fn, xAt(coarseJ[cj]!), yAt(coarseI[ci]!));
    }
  }

  // --- Refine / interpolate per coarse cell -----------------------------
  for (let ci = 0; ci < COARSE_CELLS; ci++) {
    const i0 = coarseI[ci]!;
    const i1 = coarseI[ci + 1]!;
    for (let cj = 0; cj < COARSE_CELLS; cj++) {
      const j0 = coarseJ[cj]!;
      const j1 = coarseJ[cj + 1]!;

      const v00 = coarse[ci]![cj]!;
      const v01 = coarse[ci]![cj + 1]!;
      const v10 = coarse[ci + 1]![cj]!;
      const v11 = coarse[ci + 1]![cj + 1]!;

      const hasNaN =
        Number.isNaN(v00) || Number.isNaN(v01) || Number.isNaN(v10) || Number.isNaN(v11);
      const allPositive = v00 > 0 && v01 > 0 && v10 > 0 && v11 > 0;
      const allNegative = v00 < 0 && v01 < 0 && v10 < 0 && v11 < 0;
      const active = hasNaN || !(allPositive || allNegative);

      // The cell owns fine rows [i0, i1) and cols [j0, j1); the final coarse
      // row/column also owns its trailing fine boundary line.
      const iEnd = ci === COARSE_CELLS - 1 ? i1 : i1 - 1;
      const jEnd = cj === COARSE_CELLS - 1 ? j1 : j1 - 1;

      if (active) {
        for (let i = i0; i <= iEnd; i++) {
          for (let j = j0; j <= jEnd; j++) {
            grid[i]![j] = safeEval(fn, xAt(j), yAt(i));
          }
        }
      } else {
        const di = i1 - i0;
        const dj = j1 - j0;
        for (let i = i0; i <= iEnd; i++) {
          const ty = di === 0 ? 0 : (i - i0) / di;
          const left = v00 + (v10 - v00) * ty;
          const right = v01 + (v11 - v01) * ty;
          for (let j = j0; j <= jEnd; j++) {
            const tx = dj === 0 ? 0 : (j - j0) / dj;
            grid[i]![j] = left + (right - left) * tx;
          }
        }
      }
    }
  }

  return { grid, nx, ny, dx, dy };
}

/**
 * Maximum retained (fn, viewport, resolution) entries per cache instance.
 * Each 256² field is ~0.5 MB, so 64 entries bound worst-case memory to ~32 MB
 * while keeping recent pan/zoom steps for several relations warm.
 */
export const SCALAR_FIELD_CACHE_MAX_ENTRIES = 64;

/**
 * Per-renderer-instance LRU cache of sampled scalar fields, keyed by function
 * closure identity (see utils/fn-identity) + viewport + resolution. Mirrors
 * the CartesianSampleCache Map-reinsert LRU pattern.
 */
export class ScalarFieldCache {
  /** Insertion-ordered: first key = least recently used (hits re-insert). */
  private cache = new Map<string, ScalarField>();

  get(
    fn: (x: number, y: number) => number,
    viewport: FieldViewport,
    resolution: { x: number; y: number } = DEFAULT_FIELD_RESOLUTION,
  ): ScalarField {
    const key = `${getFunctionId(fn)}:${viewport.xMin}:${viewport.xMax}:${viewport.yMin}:${viewport.yMax}:${resolution.x}:${resolution.y}`;
    const cached = this.cache.get(key);
    if (cached) {
      // LRU touch: re-insert so this key moves to the most-recent position
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const field = sampleScalarField(fn, viewport, resolution);
    if (this.cache.size >= SCALAR_FIELD_CACHE_MAX_ENTRIES) {
      const lru = this.cache.keys().next().value;
      if (lru !== undefined) this.cache.delete(lru);
    }
    this.cache.set(key, field);
    return field;
  }

  /** Drops all cached fields. Call on renderer dispose to release memory. */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Combines several directed scalar fields into a single intersection mask
 * field: elementwise `min(dir_k · grid_k)`. The result is positive exactly
 * where every relation holds (dir·F > 0), so the combined grid can be fed to
 * the same fill/contour machinery as a single field. NaN propagates — a hole
 * in any layer is a hole in the intersection.
 */
export function combineIntersectionGrids(
  layers: Array<{ grid: number[][]; dir: 1 | -1 }>,
): number[][] {
  const first = layers[0];
  if (!first) return [];

  const rows = first.grid.length;
  const cols = first.grid[0]?.length ?? 0;
  const out: number[][] = new Array(rows);

  for (let i = 0; i < rows; i++) {
    out[i] = new Array<number>(cols);
    for (let j = 0; j < cols; j++) {
      let min = Number.POSITIVE_INFINITY;
      for (const layer of layers) {
        const v = layer.dir * (layer.grid[i]?.[j] ?? Number.NaN);
        if (Number.isNaN(v)) {
          min = Number.NaN;
          break;
        }
        if (v < min) min = v;
      }
      out[i]![j] = min;
    }
  }

  return out;
}
