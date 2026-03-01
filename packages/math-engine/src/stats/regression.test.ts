/**
 * Unit tests for regression analysis
 */

import { describe, expect, it } from 'vitest';
import {
  exponentialRegression,
  linearRegression,
  polynomialRegression,
  predict,
} from './regression';

describe('Regression Analysis', () => {
  describe('linearRegression', () => {
    it('fits perfect linear relationship', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = linearRegression(x, y);

      expect(result.slope).toBeCloseTo(2, 10);
      expect(result.intercept).toBeCloseTo(0, 10);
      expect(result.r2).toBeCloseTo(1.0, 10);
    });

    it('fits linear relationship with intercept', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 5, 7, 9, 11];
      const result = linearRegression(x, y);

      expect(result.slope).toBeCloseTo(2, 10);
      expect(result.intercept).toBeCloseTo(1, 10);
      expect(result.r2).toBeCloseTo(1.0, 10);
    });

    it('handles imperfect fit', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 5, 4, 5];
      const result = linearRegression(x, y);

      expect(result.slope).toBeCloseTo(0.6, 5);
      expect(result.r2).toBeLessThan(1.0);
      expect(result.r2).toBeGreaterThan(0);
    });

    it('handles negative slope', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      const result = linearRegression(x, y);

      expect(result.slope).toBeCloseTo(-2, 10);
      expect(result.intercept).toBeCloseTo(12, 10);
      expect(result.r2).toBeCloseTo(1.0, 10);
    });

    it('throws on mismatched array lengths', () => {
      expect(() => linearRegression([1, 2, 3], [1, 2])).toThrow();
    });

    it('throws on empty arrays', () => {
      expect(() => linearRegression([], [])).toThrow();
    });

    it('throws on single data point', () => {
      expect(() => linearRegression([1], [2])).toThrow();
    });

    it('throws when all x values are identical', () => {
      expect(() => linearRegression([5, 5, 5], [1, 2, 3])).toThrow();
    });
  });

  describe('polynomialRegression', () => {
    it('fits quadratic relationship', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];
      const result = polynomialRegression(x, y, 2);

      expect(result.coefficients[0]).toBeCloseTo(0, 5); // constant term
      expect(result.coefficients[1]).toBeCloseTo(0, 5); // linear term
      expect(result.coefficients[2]).toBeCloseTo(1, 5); // quadratic term
      expect(result.r2).toBeCloseTo(1.0, 10);
    });

    it('fits cubic relationship', () => {
      const x = [1, 2, 3, 4];
      const y = [1, 8, 27, 64];
      const result = polynomialRegression(x, y, 3);

      expect(result.coefficients[3]).toBeCloseTo(1, 5); // cubic term
      expect(result.r2).toBeCloseTo(1.0, 5);
    });

    it('fits linear with degree 1', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = polynomialRegression(x, y, 1);

      expect(result.coefficients[0]).toBeCloseTo(0, 10);
      expect(result.coefficients[1]).toBeCloseTo(2, 10);
      expect(result.r2).toBeCloseTo(1.0, 10);
    });

    it('throws on invalid degree', () => {
      expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 0)).toThrow();
      expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], -1)).toThrow();
      expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 1.5)).toThrow();
    });

    it('throws when degree >= data length', () => {
      expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 3)).toThrow();
      expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 5)).toThrow();
    });

    it('throws on mismatched array lengths', () => {
      expect(() => polynomialRegression([1, 2, 3], [1, 2], 2)).toThrow();
    });
  });

  describe('exponentialRegression', () => {
    it('fits exponential relationship', () => {
      const x = [0, 1, 2, 3];
      const y = [1, Math.E, Math.E ** 2, Math.E ** 3];
      const result = exponentialRegression(x, y);

      expect(result.a).toBeCloseTo(1, 3);
      expect(result.b).toBeCloseTo(1, 3);
      expect(result.r2).toBeCloseTo(1.0, 5);
    });

    it('fits exponential decay', () => {
      const x = [0, 1, 2, 3];
      const y = [10, 5, 2.5, 1.25];
      const result = exponentialRegression(x, y);

      expect(result.a).toBeCloseTo(10, 3);
      expect(result.b).toBeCloseTo(-Math.log(2), 3);
      expect(result.r2).toBeGreaterThan(0.9);
    });

    it('throws on non-positive y values', () => {
      expect(() => exponentialRegression([1, 2, 3], [1, 0, 3])).toThrow();
      expect(() => exponentialRegression([1, 2, 3], [1, -1, 3])).toThrow();
    });

    it('throws on mismatched array lengths', () => {
      expect(() => exponentialRegression([1, 2, 3], [1, 2])).toThrow();
    });

    it('throws on empty arrays', () => {
      expect(() => exponentialRegression([], [])).toThrow();
    });
  });

  describe('predict', () => {
    it('predicts from linear regression', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const model = linearRegression(x, y);

      expect(predict(model, 6)).toBeCloseTo(12, 10);
      expect(predict(model, 0)).toBeCloseTo(0, 10);
    });

    it('predicts multiple values from linear regression', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const model = linearRegression(x, y);

      const predictions = predict(model, [6, 7, 8]) as number[];
      expect(predictions[0]).toBeCloseTo(12, 10);
      expect(predictions[1]).toBeCloseTo(14, 10);
      expect(predictions[2]).toBeCloseTo(16, 10);
    });

    it('predicts from polynomial regression', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];
      const model = polynomialRegression(x, y, 2);

      expect(predict(model, 6)).toBeCloseTo(36, 5);
      expect(predict(model, 0)).toBeCloseTo(0, 5);
    });

    it('predicts from exponential regression', () => {
      const x = [0, 1, 2, 3];
      const y = [1, 2, 4, 8];
      const model = exponentialRegression(x, y);

      const prediction = predict(model, 4) as number;
      expect(prediction).toBeCloseTo(16, 1);
    });

    it('predicts multiple values from polynomial regression', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];
      const model = polynomialRegression(x, y, 2);

      const predictions = predict(model, [6, 7]) as number[];
      expect(predictions[0]).toBeCloseTo(36, 5);
      expect(predictions[1]).toBeCloseTo(49, 5);
    });
  });

  describe('numerical stability', () => {
    it('handles large values in linear regression', () => {
      const x = [1000, 2000, 3000, 4000, 5000];
      const y = [2000, 4000, 6000, 8000, 10000];
      const result = linearRegression(x, y);

      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.r2).toBeCloseTo(1.0, 10);
    });

    it('handles small values in linear regression', () => {
      const x = [0.001, 0.002, 0.003, 0.004, 0.005];
      const y = [0.002, 0.004, 0.006, 0.008, 0.01];
      const result = linearRegression(x, y);

      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.r2).toBeCloseTo(1.0, 10);
    });
  });
});
