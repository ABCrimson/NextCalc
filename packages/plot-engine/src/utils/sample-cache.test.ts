/**
 * Tests for the per-instance Cartesian adaptive-sample cache.
 * @module utils/sample-cache.test
 */

import { describe, expect, it, vi } from 'vitest';
import { defaultSamplingConfig } from '../sampling/adaptive';
import { CartesianSampleCache, SAMPLE_CACHE_MAX_ENTRIES } from './sample-cache';

describe('CartesianSampleCache', () => {
  it('returns the same array instance for the same fn reference and domain', () => {
    const cache = new CartesianSampleCache();
    const fn = vi.fn((x: number) => x * x);

    const first = cache.get(fn, -5, 5);
    const second = cache.get(fn, -5, 5);

    expect(second).toBe(first);
    // The underlying sampler ran only once — the second call was a cache hit.
    expect(fn.mock.calls.length).toBeGreaterThan(0);
    const callsAfterFirst = fn.mock.calls.length;
    cache.get(fn, -5, 5);
    expect(fn.mock.calls.length).toBe(callsAfterFirst);
  });

  it('resamples when the domain changes', () => {
    const cache = new CartesianSampleCache();
    const fn = (x: number) => x;

    const a = cache.get(fn, -5, 5);
    const b = cache.get(fn, -10, 10);

    expect(b).not.toBe(a);
  });

  it('resamples for a different function reference over the same domain', () => {
    const cache = new CartesianSampleCache();
    const fnA = (x: number) => x;
    const fnB = (x: number) => x;

    const a = cache.get(fnA, 0, 1);
    const b = cache.get(fnB, 0, 1);

    expect(b).not.toBe(a);
  });

  it('clear() drops cached entries so the next get() resamples', () => {
    const cache = new CartesianSampleCache();
    const fn = vi.fn((x: number) => x);

    const first = cache.get(fn, 0, 1);
    cache.clear();
    const second = cache.get(fn, 0, 1);

    expect(second).not.toBe(first);
  });

  it('still hits the cache across interleaved re-renders of multiple series', () => {
    const cache = new CartesianSampleCache();
    const fnA = (x: number) => x * x;
    const fnB = (x: number) => Math.sin(x);

    const a1 = cache.get(fnA, -5, 5);
    const b1 = cache.get(fnB, -5, 5);
    // Second render frame: both series re-request the same domain
    const a2 = cache.get(fnA, -5, 5);
    const b2 = cache.get(fnB, -5, 5);

    expect(a2).toBe(a1);
    expect(b2).toBe(b1);
  });

  describe('bounded LRU eviction', () => {
    it('evicts the least-recently-used entry once capacity is exceeded', () => {
      const cache = new CartesianSampleCache();
      const fn = (x: number) => x;

      // Fill the cache to exactly capacity with distinct pan/zoom domains
      const first = cache.get(fn, 0, 1);
      const second = cache.get(fn, 1, 2);
      for (let i = 2; i < SAMPLE_CACHE_MAX_ENTRIES; i++) {
        cache.get(fn, i, i + 1);
      }
      expect(cache.get(fn, 0, 1)).toBe(first); // resident at capacity; touch → newest

      cache.get(fn, -1000, -999); // capacity + 1 → evicts the LRU entry

      // The just-touched (0, 1) entry survived the overflow...
      expect(cache.get(fn, 0, 1)).toBe(first);
      // ...while (1, 2) — the least recently used at overflow time — was
      // evicted and resamples to a fresh array.
      expect(cache.get(fn, 1, 2)).not.toBe(second);
    });

    it('never grows past capacity during a continuous pan (new domain every frame)', () => {
      const cache = new CartesianSampleCache();
      const fn = vi.fn((x: number) => x);

      const frames = SAMPLE_CACHE_MAX_ENTRIES * 3;
      for (let i = 0; i < frames; i++) {
        cache.get(fn, i * 0.25, i * 0.25 + 10);
      }

      // Peek via the private map: capacity must be respected after 3x churn.
      const map = (cache as unknown as { cache: Map<string, unknown> }).cache;
      expect(map.size).toBe(SAMPLE_CACHE_MAX_ENTRIES);
    });

    it('a get() refreshes recency, protecting the entry from eviction', () => {
      const cache = new CartesianSampleCache();
      const protectedFn = (x: number) => x * 2;
      const filler = (x: number) => x;

      const kept = cache.get(protectedFn, 0, 1);

      // Fill to capacity (protected entry + MAX-1 fillers)
      for (let i = 0; i < SAMPLE_CACHE_MAX_ENTRIES - 1; i++) {
        cache.get(filler, i, i + 1);
      }

      // Touch the oldest (protected) entry, then overflow by one: the LRU
      // victim must be the first filler, not the just-touched entry.
      expect(cache.get(protectedFn, 0, 1)).toBe(kept);
      cache.get(filler, 5000, 5001);

      expect(cache.get(protectedFn, 0, 1)).toBe(kept);
    });

    it('evicts stale entries for a replaced function reference as the LRU churns', () => {
      const cache = new CartesianSampleCache();
      // Simulates the user editing a formula: the old closure is replaced by
      // a new one. Old entries key on the old identity and can never be hit
      // again — the LRU must reclaim them instead of leaking.
      const oldFn = (x: number) => x + 1;
      const newFn = (x: number) => x + 2;

      cache.get(oldFn, 0, 1);
      for (let i = 1; i <= SAMPLE_CACHE_MAX_ENTRIES; i++) {
        cache.get(newFn, i, i + 1);
      }

      const map = (cache as unknown as { cache: Map<string, unknown> }).cache;
      expect(map.size).toBe(SAMPLE_CACHE_MAX_ENTRIES);
      // The stale oldFn entry (the only one with domain 0..1) was the LRU
      // and is gone.
      const staleKeys = [...map.keys()].filter((k) =>
        k.endsWith(`:0:1:${defaultSamplingConfig.initialSamples}`),
      );
      expect(staleKeys).toHaveLength(0);
    });
  });
});
