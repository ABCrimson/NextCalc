/**
 * Tests for adaptive sampling algorithm
 * @module sampling/adaptive.test
 */

import { describe, expect, it } from 'vitest';
import { adaptiveSample1D, defaultSamplingConfig, uniformSample1D } from './adaptive';

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
});
