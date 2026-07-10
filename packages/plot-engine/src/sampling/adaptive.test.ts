/**
 * Tests for adaptive sampling algorithm
 * @module sampling/adaptive.test
 */

import { describe, expect, it } from 'vitest';
import {
  adaptiveSample1D,
  adaptiveSampleParametric2D,
  defaultSamplingConfig,
  isSampleBreak,
  splitSampleSegments,
  uniformSample1D,
} from './adaptive';

describe('Adaptive Sampling', () => {
  describe('uniformSample1D', () => {
    it('should sample a linear function uniformly', () => {
      const fn = (x: number) => 2 * x + 1;
      const result = uniformSample1D(fn, 0, 10, 10);

      expect(result.points.length).toBe(11); // 0 to 10 inclusive
      expect(result.points[0]).toEqual({ x: 0, y: 1 });
      expect(result.points[10]).toEqual({ x: 10, y: 21 });
    });

    it('should handle discontinuous functions', () => {
      const fn = (x: number) => (x === 0 ? Number.NaN : 1 / x);
      const result = uniformSample1D(fn, -2, 2, 10);

      // Should skip invalid points
      expect(result.points.length).toBeLessThan(11);
      expect(result.points.every((p) => Number.isFinite(p.y))).toBe(true);
    });
  });

  describe('adaptiveSample1D', () => {
    it('should sample a smooth function with adaptive behavior', () => {
      // Use a linear function (zero curvature) for predictable adaptive behavior
      const fn = (x: number) => 2 * x + 1;
      const adaptive = adaptiveSample1D(fn, -5, 5, {
        ...defaultSamplingConfig,
        initialSamples: 10,
        maxDepth: 2, // Limit subdivision to keep points reasonable
        angleTolerance: 0.5, // Higher tolerance for smoother curves
      });

      // With limited maxDepth, output should be bounded
      // maxDepth=2 means at most 10 * 2^2 = 40 points per segment
      expect(adaptive.points.length).toBeGreaterThan(10);
      expect(adaptive.points.length).toBeLessThan(500);
    });

    it('should sample a highly curved function with more detail', () => {
      const fn = (x: number) => Math.sin(10 * x);
      const result = adaptiveSample1D(fn, 0, 2 * Math.PI, {
        ...defaultSamplingConfig,
        initialSamples: 10,
        maxDepth: 5,
        angleTolerance: 0.1,
      });

      // High curvature should trigger subdivision
      expect(result.points.length).toBeGreaterThan(50);
    });

    it('should handle edge cases gracefully', () => {
      const fn = (x: number) => (x === 0 ? 0 : Math.sin(1 / x));
      const result = adaptiveSample1D(fn, -1, 1, defaultSamplingConfig);

      expect(result.points.length).toBeGreaterThan(0);
      expect(result.points.every((p) => Number.isFinite(p.y))).toBe(true);
    });

    it('should complete in reasonable time', () => {
      const fn = (x: number) => Math.exp(-x * x) * Math.sin(5 * x);
      const result = adaptiveSample1D(fn, -5, 5, defaultSamplingConfig);

      expect(result.elapsedTime).toBeLessThan(100); // <100ms
    });
  });

  describe('grid resonance (aliasing regression)', () => {
    it('resolves sin(10πx) on [-10, 10] even when the period equals the grid step', () => {
      // With 100 uniform cells on [-10, 10], dx = 0.2 = the exact period of
      // sin(10πx): every grid point AND every dyadic midpoint evaluates to 0,
      // so midpoint-probe refinement rendered a flat line at y = 0. The
      // golden-ratio probe must recover the oscillation deterministically.
      const fn = (x: number) => Math.sin(10 * Math.PI * x);
      const result = adaptiveSample1D(fn, -10, 10, {
        ...defaultSamplingConfig,
        initialSamples: 100,
      });

      const finite = result.points.filter((p) => Number.isFinite(p.y));
      const maxAbsY = Math.max(...finite.map((p) => Math.abs(p.y)));
      expect(maxAbsY).toBeGreaterThan(0.9);
    });

    it('resolves even-harmonic resonance (period = dx/2) as well', () => {
      // A constant grid shift only fixes odd harmonics; the irrational probe
      // fraction must also catch sin(20πx) (two full periods per cell).
      const fn = (x: number) => Math.sin(20 * Math.PI * x);
      const result = adaptiveSample1D(fn, -10, 10, {
        ...defaultSamplingConfig,
        initialSamples: 100,
      });

      const finite = result.points.filter((p) => Number.isFinite(p.y));
      const maxAbsY = Math.max(...finite.map((p) => Math.abs(p.y)));
      expect(maxAbsY).toBeGreaterThan(0.9);
    });

    it('does not blow the sample budget on smooth low-frequency functions', () => {
      const cap = defaultSamplingConfig.initialSamples * 2 ** defaultSamplingConfig.maxDepth;

      for (const fn of [(x: number) => Math.sin(x), (x: number) => x * x]) {
        const result = adaptiveSample1D(fn, -10, 10, defaultSamplingConfig);
        // Smooth functions must stay FAR under the cap — the inverted
        // turning-angle criterion used to subdivide straight segments to
        // full depth (hitting the cap exactly), while pruning sharp spikes.
        expect(result.points.length).toBeLessThan(cap / 4);
      }
    });

    it('leaves a perfectly linear function at the initial grid resolution', () => {
      // Regression for the inverted criterion: a line has zero turning angle
      // everywhere and must accept every cell without subdivision.
      const result = adaptiveSample1D((x: number) => 2 * x + 1, -5, 5, defaultSamplingConfig);
      expect(result.points.length).toBe(defaultSamplingConfig.initialSamples + 1);
    });

    it('refines a sharp corner instead of accepting it as smooth', () => {
      // The inverted criterion read a near-reversal (spike) as "collinear"
      // and pruned it. A corner placed OFF the uniform grid (0.01 is not a
      // multiple of dx) must now gain refinement samples around it.
      const fn = (x: number) => Math.abs(x - 0.01);
      const result = adaptiveSample1D(fn, -5, 5, defaultSamplingConfig);
      expect(result.points.length).toBeGreaterThan(defaultSamplingConfig.initialSamples + 1);
    });
  });

  describe('discontinuity break markers', () => {
    it('splits 1/x on [-5, 5] into segments that never bridge the pole at x = 0', () => {
      const result = adaptiveSample1D((x: number) => 1 / x, -5, 5, defaultSamplingConfig);

      // The pole itself is marked, not silently dropped
      expect(result.points.some((p) => isSampleBreak(p))).toBe(true);

      const segments = splitSampleSegments(result.points);
      expect(segments.length).toBeGreaterThanOrEqual(2);
      for (const segment of segments) {
        const crossesPole = segment.some((p) => p.x < 0) && segment.some((p) => p.x > 0);
        expect(crossesPole).toBe(false);
      }
    });

    it('keeps the domain gap of sqrt(x²−1) open: no finite samples and no segment inside (−1, 1)', () => {
      const fn = (x: number) => Math.sqrt(x * x - 1);
      const result = adaptiveSample1D(fn, -5, 5, defaultSamplingConfig);

      const finite = result.points.filter((p) => Number.isFinite(p.y));
      expect(finite.some((p) => p.x > -1 && p.x < 1)).toBe(false);

      const segments = splitSampleSegments(result.points);
      expect(segments.length).toBeGreaterThanOrEqual(2);
      for (const segment of segments) {
        // No segment may connect the two branches across the gap
        const bridgesGap = segment.some((p) => p.x <= -1) && segment.some((p) => p.x >= 1);
        expect(bridgesGap).toBe(false);
      }
    });

    it('marks samples where the function throws', () => {
      const fn = (x: number) => {
        if (x >= 0) throw new RangeError('domain');
        return x;
      };
      const result = adaptiveSample1D(fn, -5, 5, defaultSamplingConfig);

      expect(result.points.some((p) => isSampleBreak(p))).toBe(true);
      const segments = splitSampleSegments(result.points);
      expect(segments).toHaveLength(1);
      expect(segments[0]!.every((p) => p.x < 0)).toBe(true);
    });

    it('collapses consecutive invalid samples into a single marker', () => {
      const fn = (x: number) => Math.log(x); // -Infinity at 0, NaN for x < 0
      const result = adaptiveSample1D(fn, -5, 5, defaultSamplingConfig);

      let previousWasBreak = false;
      for (const point of result.points) {
        const isBreak = isSampleBreak(point);
        expect(isBreak && previousWasBreak).toBe(false);
        previousWasBreak = isBreak;
      }
    });
  });

  describe('splitSampleSegments', () => {
    it('returns a single segment when there are no break markers', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 4 },
      ];
      expect(splitSampleSegments(points)).toEqual([points]);
    });

    it('splits at markers and drops runs shorter than 2 points', () => {
      const segments = splitSampleSegments([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: Number.NaN },
        { x: 3, y: 3 }, // isolated single point — nothing to stroke
        { x: 4, y: Number.NaN },
        { x: 5, y: 5 },
        { x: 6, y: 6 },
      ]);

      expect(segments).toEqual([
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 5, y: 5 },
          { x: 6, y: 6 },
        ],
      ]);
    });
  });

  describe('adaptiveSampleParametric2D', () => {
    it('does not add refinement points to a straight parametric line', () => {
      const result = adaptiveSampleParametric2D(
        (t) => t,
        (t) => 2 * t,
        0,
        1,
        { ...defaultSamplingConfig, initialSamples: 20 },
      );
      expect(result.points.length).toBe(21);
    });

    it('adds refinement points on a curved path', () => {
      const result = adaptiveSampleParametric2D(
        (t) => Math.cos(t),
        (t) => Math.sin(t),
        0,
        2 * Math.PI,
        { ...defaultSamplingConfig, initialSamples: 20 },
      );
      expect(result.points.length).toBeGreaterThan(21);
    });
  });
});
