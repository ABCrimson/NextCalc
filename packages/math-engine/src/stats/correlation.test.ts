/**
 * Unit tests for correlation and covariance
 */

import { describe, expect, it } from 'vitest';
import { correlation, covariance, rSquared, spearmanCorrelation } from './correlation';

describe('Correlation and Covariance', () => {
  describe('covariance', () => {
    it('calculates positive covariance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 5, 4, 5];
      const result = covariance(x, y, true);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeCloseTo(1.5, 10);
    });

    it('calculates negative covariance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      const result = covariance(x, y, true);

      expect(result).toBeLessThan(0);
      expect(result).toBeCloseTo(-2.5, 10);
    });

    it('calculates sample covariance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = covariance(x, y, true);

      expect(result).toBeCloseTo(5, 10);
    });

    it('calculates population covariance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = covariance(x, y, false);

      expect(result).toBeCloseTo(4, 10);
    });

    it('handles zero covariance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 3, 3, 3, 3];
      const result = covariance(x, y, true);

      expect(result).toBeCloseTo(0, 10);
    });

    it('throws on mismatched array lengths', () => {
      expect(() => covariance([1, 2, 3], [1, 2], true)).toThrow();
    });

    it('throws on empty arrays', () => {
      expect(() => covariance([], [], true)).toThrow();
    });

    it('throws on single element with sample covariance', () => {
      expect(() => covariance([1], [2], true)).toThrow();
    });
  });

  describe('correlation', () => {
    it('calculates perfect positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = correlation(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('calculates perfect negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      const result = correlation(x, y);

      expect(result).toBeCloseTo(-1.0, 10);
    });

    it('calculates moderate positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 5, 4, 5];
      const result = correlation(x, y);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
      expect(result).toBeCloseTo(0.7746, 2);
    });

    it('calculates near-zero correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 1, 4, 2, 5];
      const result = correlation(x, y);

      expect(Math.abs(result)).toBeLessThan(1);
    });

    it('handles identical arrays', () => {
      const x = [1, 2, 3, 4, 5];
      const result = correlation(x, x);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('throws on zero variance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 3, 3, 3, 3];

      expect(() => correlation(x, y)).toThrow();
    });

    it('throws on mismatched array lengths', () => {
      expect(() => correlation([1, 2, 3], [1, 2])).toThrow();
    });

    it('throws on single data point', () => {
      expect(() => correlation([1], [2])).toThrow();
    });

    it('throws on empty arrays', () => {
      expect(() => correlation([], [])).toThrow();
    });
  });

  describe('spearmanCorrelation', () => {
    it('calculates perfect monotonic relationship', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];
      const result = spearmanCorrelation(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('calculates perfect negative monotonic relationship', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [25, 16, 9, 4, 1];
      const result = spearmanCorrelation(x, y);

      expect(result).toBeCloseTo(-1.0, 10);
    });

    it('handles ties correctly', () => {
      const x = [1, 2, 2, 3];
      const y = [1, 2, 2, 3];
      const result = spearmanCorrelation(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('detects non-linear monotonic relationship', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];

      // Spearman should be 1 (perfect monotonic)
      const spearman = spearmanCorrelation(x, y);
      // Pearson should be less than 1 (not perfectly linear)
      const pearson = correlation(x, y);

      expect(spearman).toBeCloseTo(1.0, 10);
      expect(pearson).toBeLessThan(1.0);
    });

    it('throws on mismatched array lengths', () => {
      expect(() => spearmanCorrelation([1, 2, 3], [1, 2])).toThrow();
    });

    it('throws on empty arrays', () => {
      expect(() => spearmanCorrelation([], [])).toThrow();
    });
  });

  describe('rSquared', () => {
    it('calculates R² for perfect correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = rSquared(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('calculates R² for negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      const result = rSquared(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('calculates R² for moderate correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 5, 4, 5];
      const result = rSquared(x, y);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('returns value between 0 and 1', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 1, 4, 2, 5];
      const result = rSquared(x, y);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('numerical stability', () => {
    it('handles large values in correlation', () => {
      const x = [1000, 2000, 3000, 4000, 5000];
      const y = [2000, 4000, 6000, 8000, 10000];
      const result = correlation(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('handles small values in correlation', () => {
      const x = [0.001, 0.002, 0.003, 0.004, 0.005];
      const y = [0.002, 0.004, 0.006, 0.008, 0.01];
      const result = correlation(x, y);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('handles large values in covariance', () => {
      const x = [1000, 2000, 3000, 4000, 5000];
      const y = [2000, 4000, 6000, 8000, 10000];
      const result = covariance(x, y, false);

      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });
  });
});
