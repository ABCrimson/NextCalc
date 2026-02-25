/**
 * Unit tests for descriptive statistics
 */

import { describe, it, expect } from 'vitest';
import { mean, median, mode, variance, stdDev, range, quartiles, sum, product } from './descriptive';

describe('Descriptive Statistics', () => {
  describe('mean', () => {
    it('calculates mean of positive numbers', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('calculates mean of negative numbers', () => {
      expect(mean([-1, -2, -3, -4, -5])).toBe(-3);
    });

    it('calculates mean of mixed numbers', () => {
      expect(mean([10, 20, 30])).toBe(20);
    });

    it('handles single element', () => {
      expect(mean([42])).toBe(42);
    });

    it('throws on empty array', () => {
      expect(() => mean([])).toThrow();
    });

    it('throws on NaN values', () => {
      expect(() => mean([1, NaN, 3])).toThrow();
    });

    it('throws on Infinity', () => {
      expect(() => mean([1, Infinity, 3])).toThrow();
    });
  });

  describe('median', () => {
    it('calculates median of odd-length array', () => {
      expect(median([1, 2, 3, 4, 5])).toBe(3);
    });

    it('calculates median of even-length array', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it('handles unsorted array', () => {
      expect(median([5, 2, 3, 1, 4])).toBe(3);
    });

    it('handles single element', () => {
      expect(median([42])).toBe(42);
    });

    it('handles duplicates', () => {
      expect(median([1, 2, 2, 3])).toBe(2);
    });

    it('throws on empty array', () => {
      expect(() => median([])).toThrow();
    });
  });

  describe('mode', () => {
    it('finds single mode', () => {
      expect(mode([1, 2, 2, 3, 3, 3])).toEqual([3]);
    });

    it('finds multiple modes', () => {
      expect(mode([1, 1, 2, 2, 3])).toEqual([1, 2]);
    });

    it('returns empty array when no mode exists', () => {
      expect(mode([1, 2, 3, 4])).toEqual([]);
    });

    it('handles all same values', () => {
      expect(mode([5, 5, 5, 5])).toEqual([5]);
    });

    it('handles single element', () => {
      expect(mode([42])).toEqual([]);
    });

    it('throws on empty array', () => {
      expect(() => mode([])).toThrow();
    });
  });

  describe('variance', () => {
    it('calculates sample variance', () => {
      const result = variance([1, 2, 3, 4, 5], true);
      expect(result).toBeCloseTo(2.5, 10);
    });

    it('calculates population variance', () => {
      const result = variance([1, 2, 3, 4, 5], false);
      expect(result).toBeCloseTo(2.0, 10);
    });

    it('handles zero variance', () => {
      expect(variance([5, 5, 5, 5], true)).toBe(0);
    });

    it('throws on single element with sample variance', () => {
      expect(() => variance([42], true)).toThrow();
    });

    it('allows single element with population variance', () => {
      expect(variance([42], false)).toBe(0);
    });

    it('throws on empty array', () => {
      expect(() => variance([], true)).toThrow();
    });
  });

  describe('stdDev', () => {
    it('calculates sample standard deviation', () => {
      const result = stdDev([1, 2, 3, 4, 5], true);
      expect(result).toBeCloseTo(Math.sqrt(2.5), 10);
    });

    it('calculates population standard deviation', () => {
      const result = stdDev([1, 2, 3, 4, 5], false);
      expect(result).toBeCloseTo(Math.sqrt(2.0), 10);
    });

    it('handles zero standard deviation', () => {
      expect(stdDev([5, 5, 5, 5], true)).toBe(0);
    });
  });

  describe('range', () => {
    it('calculates range statistics', () => {
      const result = range([1, 2, 3, 4, 5]);
      expect(result).toEqual({ min: 1, max: 5, range: 4 });
    });

    it('handles negative numbers', () => {
      const result = range([-5, -2, 0, 3, 7]);
      expect(result).toEqual({ min: -5, max: 7, range: 12 });
    });

    it('handles single element', () => {
      const result = range([42]);
      expect(result).toEqual({ min: 42, max: 42, range: 0 });
    });

    it('throws on empty array', () => {
      expect(() => range([])).toThrow();
    });
  });

  describe('quartiles', () => {
    it('calculates quartiles for odd-length array', () => {
      const result = quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(result.q1).toBeCloseTo(3, 10);
      expect(result.q2).toBe(5);
      expect(result.q3).toBeCloseTo(7, 10);
      expect(result.iqr).toBeCloseTo(4, 10);
    });

    it('calculates quartiles for even-length array', () => {
      const result = quartiles([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(result.q1).toBeCloseTo(2.75, 10);
      expect(result.q2).toBe(4.5);
      expect(result.q3).toBeCloseTo(6.25, 10);
      expect(result.iqr).toBeCloseTo(3.5, 10);
    });

    it('handles small arrays', () => {
      const result = quartiles([1, 2, 3]);
      expect(result.q2).toBe(2);
    });

    it('throws on empty array', () => {
      expect(() => quartiles([])).toThrow();
    });
  });

  describe('sum', () => {
    it('calculates sum of positive numbers', () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15);
    });

    it('calculates sum of negative numbers', () => {
      expect(sum([-1, -2, -3])).toBe(-6);
    });

    it('handles empty array', () => {
      expect(sum([])).toBe(0);
    });

    it('handles single element', () => {
      expect(sum([42])).toBe(42);
    });

    it('throws on NaN', () => {
      expect(() => sum([1, NaN, 3])).toThrow();
    });
  });

  describe('product', () => {
    it('calculates product of positive numbers', () => {
      expect(product([1, 2, 3, 4, 5])).toBe(120);
    });

    it('calculates product with zero', () => {
      expect(product([1, 2, 0, 4])).toBe(0);
    });

    it('handles single element', () => {
      expect(product([42])).toBe(42);
    });

    it('throws on empty array', () => {
      expect(() => product([])).toThrow();
    });
  });

  describe('immutability', () => {
    it('does not modify original array in median', () => {
      const data = [5, 2, 8, 1, 9];
      const original = [...data];
      median(data);
      expect(data).toEqual(original);
    });

    it('does not modify original array in quartiles', () => {
      const data = [5, 2, 8, 1, 9];
      const original = [...data];
      quartiles(data);
      expect(data).toEqual(original);
    });

    it('does not modify original array in mode', () => {
      const data = [5, 2, 8, 1, 9];
      const original = [...data];
      mode(data);
      expect(data).toEqual(original);
    });
  });
});
