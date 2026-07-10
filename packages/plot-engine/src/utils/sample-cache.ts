/**
 * Per-renderer-instance cache of adaptively-sampled Cartesian points.
 *
 * Every 2D renderer's `y = f(x)` render path re-samples the plotted function
 * on *every* render() call, even when nothing about that function or its
 * viewport domain changed since the previous frame (e.g. re-rendering
 * because a sibling function's style changed, or a debounce/resize tick that
 * doesn't touch this series). This cache keys on the function's stable
 * closure identity (see `fn-identity.ts`) plus the sampled domain and sample
 * budget, so an unchanged (fn, xMin, xMax) triple skips resampling entirely.
 *
 * Bounded: every pan/zoom step mints a fresh `xMin:xMax` key, so an uncapped
 * map would grow for as long as the user keeps interacting. Entries are held
 * in an insertion-ordered Map used as an LRU — a hit re-inserts its key, and
 * inserting past {@link SAMPLE_CACHE_MAX_ENTRIES} evicts the least-recently
 * used entry. Entries belonging to replaced function references (function
 * identity is per-reference; there is no explicit invalidation event) become
 * unreachable keys and age out the same way.
 *
 * @module utils/sample-cache
 */

import { adaptiveSample1D, defaultSamplingConfig } from '../sampling/adaptive';
import type { Point2D } from '../types/index';
import { getFunctionId } from './fn-identity';

/**
 * Maximum retained (fn, domain) entries per cache instance. 128 keeps about
 * a dozen recent viewports for each of ~10 plotted series (or deeper history
 * for fewer series) while bounding worst-case memory to
 * 128 × (initialSamples × 2^maxDepth) sampled points.
 */
export const SAMPLE_CACHE_MAX_ENTRIES = 128;

export class CartesianSampleCache {
  /** Insertion-ordered: first key = least recently used (hits re-insert). */
  private cache = new Map<string, Point2D[]>();

  /**
   * Returns adaptively-sampled `{x, y}` points for `fn` over `[xMin, xMax]`,
   * reusing a previous result when the function identity, domain, and
   * sample budget are unchanged.
   */
  get(fn: (x: number) => number, xMin: number, xMax: number): Point2D[] {
    const key = `${getFunctionId(fn)}:${xMin}:${xMax}:${defaultSamplingConfig.initialSamples}`;
    const cached = this.cache.get(key);
    if (cached) {
      // LRU touch: re-insert so this key moves to the most-recent position
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const { points } = adaptiveSample1D(fn, xMin, xMax, defaultSamplingConfig);
    if (this.cache.size >= SAMPLE_CACHE_MAX_ENTRIES) {
      // Evict the least-recently-used entry (first in insertion order)
      const lru = this.cache.keys().next().value;
      if (lru !== undefined) this.cache.delete(lru);
    }
    this.cache.set(key, points);
    return points;
  }

  /** Drops all cached samples. Call on renderer dispose to release memory. */
  clear(): void {
    this.cache.clear();
  }
}
