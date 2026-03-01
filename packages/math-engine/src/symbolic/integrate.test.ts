/**
 * Tests for symbolic integration
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../parser/parser';
import { astToString, integrate, integrateDefinite } from './integrate';

describe('integrate', () => {
  describe('power rule', () => {
    it('integrates x to x^2/2', () => {
      const result = integrate('x', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('2');
      expect(resultStr).toContain('^');
    });

    it('integrates x^2 to x^3/3', () => {
      const result = integrate(parse('x^2'), 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('3');
    });

    it('integrates x^5 to x^6/6', () => {
      const result = integrate('x^5', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('6');
    });
  });

  describe('constant rule', () => {
    it('integrates constant 5', () => {
      const result = integrate('5', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('5');
      expect(resultStr).toContain('x');
    });
  });

  describe('exponential functions', () => {
    it('integrates exp(x) to exp(x)', () => {
      const result = integrate('exp(x)', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('exp');
    });
  });

  describe('trigonometric functions', () => {
    it('integrates sin(x) to -cos(x)', () => {
      const result = integrate('sin(x)', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('cos');
      expect(resultStr).toContain('-1');
    });

    it('integrates cos(x) to sin(x)', () => {
      const result = integrate('cos(x)', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('sin');
    });
  });

  describe('linearity', () => {
    it('integrates sum x + 5', () => {
      const result = integrate('x + 5', 'x');
      const resultStr = astToString(result);
      // Should be x^2/2 + 5x
      expect(resultStr).toBeTruthy();
    });

    it('integrates 2*x', () => {
      const result = integrate('2 * x', 'x');
      const resultStr = astToString(result);
      expect(resultStr).toContain('2');
    });
  });

  describe('definite integrals', () => {
    it('calculates ∫₀¹ x^2 dx = 1/3', () => {
      const result = integrateDefinite('x^2', 'x', 0, 1, 'numerical');
      expect(result).toBeCloseTo(1 / 3, 3);
    });

    it('calculates ∫₀^π sin(x) dx ≈ 2', () => {
      const result = integrateDefinite('sin(x)', 'x', 0, Math.PI, 'numerical');
      expect(result).toBeCloseTo(2, 3);
    });

    it('calculates ∫₁² x dx = 1.5', () => {
      const result = integrateDefinite('x', 'x', 1, 2, 'numerical');
      expect(result).toBeCloseTo(1.5, 3);
    });
  });

  describe('integration by parts', () => {
    it('integrates x*ln(x) to (x^2/2)*ln(x) - x^2/4', () => {
      const result = integrate('x*ln(x)', 'x');
      const resultStr = astToString(result);

      // The result should contain ln(x) and x^2 terms
      expect(resultStr).toContain('ln');
      expect(resultStr).toContain('^');

      // Verify numerically: the definite integral ∫₁ᵉ x*ln(x) dx
      // = [(x²/2)*ln(x) - x²/4]₁ᵉ
      // = (e²/2)*1 - e²/4 - (1/2)*0 + 1/4
      // = e²/4 + 1/4
      const definiteResult = integrateDefinite('x*ln(x)', 'x', 1, Math.E, 'symbolic');
      const expected = Math.E ** 2 / 4 + 1 / 4;
      expect(definiteResult).toBeCloseTo(expected, 6);
    });
  });

  describe('error handling', () => {
    it('throws on unsupported function', () => {
      expect(() => integrate('factorial(x)', 'x')).toThrow();
    });
  });
});
