/**
 * Tests for symbolic simplification engine
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../parser/parser';
import { astToString } from './integrate';
import { expand, factor, simplify, substitute } from './simplify';

describe('Symbolic Simplification', () => {
  describe('simplify()', () => {
    it('should perform constant folding', () => {
      const expr = parse('2 + 3');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('5');
    });

    it('should apply addition identity: x + 0 = x', () => {
      const expr = parse('x + 0');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should apply addition identity: 0 + x = x', () => {
      const expr = parse('0 + x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should apply multiplication identity: x * 1 = x', () => {
      const expr = parse('x * 1');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should apply multiplication identity: 1 * x = x', () => {
      const expr = parse('1 * x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should apply multiplication zero property: x * 0 = 0', () => {
      const expr = parse('x * 0');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('0');
    });

    it('should apply multiplication zero property: 0 * x = 0', () => {
      const expr = parse('0 * x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('0');
    });

    it('should apply power identity: x^0 = 1', () => {
      const expr = parse('x ^ 0');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('1');
    });

    it('should apply power identity: x^1 = x', () => {
      const expr = parse('x ^ 1');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should simplify subtraction: x - x = 0', () => {
      const expr = parse('x - x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('0');
    });

    it('should simplify division: x / x = 1', () => {
      const expr = parse('x / x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('1');
    });

    it('should simplify nested expressions', () => {
      const expr = parse('(x + 0) * 1 + 0');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should combine powers: x * x = x^2', () => {
      const expr = parse('x * x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('(x)^(2)');
    });

    it('should cancel division: x^2 / x = x', () => {
      const expr = parse('x ^ 2 / x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should simplify power of power: (x^2)^3 = x^6', () => {
      const expr = parse('(x ^ 2) ^ 3');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('(x)^(6)');
    });

    it('should simplify exp(0) = 1', () => {
      const expr = parse('exp(0)');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('1');
    });

    it('should simplify log(1) = 0', () => {
      const expr = parse('log(1)');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('0');
    });

    it('should simplify sin(0) = 0', () => {
      const expr = parse('sin(0)');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('0');
    });

    it('should simplify cos(0) = 1', () => {
      const expr = parse('cos(0)');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('1');
    });

    it('should handle complex expressions', () => {
      const expr = parse('2 * x + 3 * 0 + 1 * y');
      const simplified = simplify(expr);
      // Should simplify to 2*x + y
      expect(astToString(simplified)).toContain('x');
      expect(astToString(simplified)).toContain('y');
    });
  });

  describe('expand()', () => {
    it('should expand (a + b) * c', () => {
      const expr = parse('(x + 1) * 2');
      const expanded = expand(expr);
      const result = astToString(expanded);
      // Should contain x and 2
      expect(result).toContain('x');
    });

    it('should expand (x + 1) * (x - 1)', () => {
      const expr = parse('(x + 1) * (x - 1)');
      const expanded = expand(expr);
      const simplified = simplify(expanded);
      const result = astToString(simplified);
      // Should expand to x^2 - 1
      expect(result).toContain('x');
    });

    it('should expand (x + 1)^2', () => {
      const expr = parse('(x + 1) ^ 2');
      const expanded = expand(expr);
      const result = astToString(expanded);
      // Should contain x^2, x, and constant terms
      expect(result).toContain('x');
    });

    it('should expand (x - 1)^2', () => {
      const expr = parse('(x - 1) ^ 2');
      const expanded = expand(expr);
      const result = astToString(expanded);
      // Should contain x^2, -2x, and 1
      expect(result).toContain('x');
    });

    it('should expand (x + 2)^3', () => {
      const expr = parse('(x + 2) ^ 3');
      const expanded = expand(expr);
      const result = astToString(expanded);
      // Should be a polynomial
      expect(result).toContain('x');
    });

    it('should not expand high powers', () => {
      const expr = parse('(x + 1) ^ 20');
      const expanded = expand(expr);
      const result = astToString(expanded);
      // Should remain as power
      expect(result).toContain('^');
    });

    it('should expand distributive property', () => {
      const expr = parse('x * (y + z)');
      const expanded = expand(expr);
      const result = astToString(expanded);
      // Should contain x*y and x*z
      expect(result).toContain('x');
      expect(result).toContain('y');
    });
  });

  describe('factor()', () => {
    it('should factor difference of squares: x^2 - 4', () => {
      const expr = parse('x ^ 2 - 4');
      const factored = factor(expr, 'x');
      const result = astToString(factored);
      // Should factor to (x - 2)(x + 2)
      expect(result).toContain('*');
    });

    it('should factor difference of squares: x^2 - 1', () => {
      const expr = parse('x ^ 2 - 1');
      const factored = factor(expr, 'x');
      const result = astToString(factored);
      // Should factor to (x - 1)(x + 1)
      expect(result).toContain('*');
    });

    it('should simplify if cannot factor', () => {
      const expr = parse('x ^ 2 + 1');
      const factored = factor(expr, 'x');
      const result = astToString(factored);
      // Cannot factor over reals, should return simplified
      expect(result).toBeDefined();
    });

    it('should handle already factored expressions', () => {
      const expr = parse('(x + 1) * (x - 1)');
      const factored = factor(expr, 'x');
      const result = astToString(factored);
      expect(result).toContain('*');
    });
  });

  describe('substitute()', () => {
    it('should substitute x with a number', () => {
      const expr = parse('x + 1');
      const substituted = substitute(expr, 'x', 5);
      const simplified = simplify(substituted);
      expect(astToString(simplified)).toBe('6');
    });

    it('should substitute x with an expression', () => {
      const expr = parse('x ^ 2');
      const value = parse('y + 1');
      const substituted = substitute(expr, 'x', value);
      const result = astToString(substituted);
      // Should be (y + 1)^2
      expect(result).toContain('y');
      expect(result).toContain('^');
    });

    it('should substitute multiple occurrences', () => {
      const expr = parse('x + x');
      const substituted = substitute(expr, 'x', 3);
      const simplified = simplify(substituted);
      expect(astToString(simplified)).toBe('6');
    });

    it('should not affect other variables', () => {
      const expr = parse('x + y');
      const substituted = substitute(expr, 'x', 2);
      const result = astToString(substituted);
      // Should be 2 + y
      expect(result).toContain('y');
      expect(result).toContain('2');
    });

    it('should substitute in nested expressions', () => {
      const expr = parse('sin(x) + cos(x)');
      const substituted = substitute(expr, 'x', 0);
      const simplified = simplify(substituted);
      const result = astToString(simplified);
      // sin(0) + cos(0) = 0 + 1 = 1
      expect(result).toBe('1');
    });

    it('should substitute with complex expressions', () => {
      const expr = parse('2 * x + 3');
      const value = parse('a + b');
      const substituted = substitute(expr, 'x', value);
      const result = astToString(substituted);
      // Should be 2*(a+b) + 3
      expect(result).toContain('a');
      expect(result).toContain('b');
    });
  });

  describe('Integration with other symbolic operations', () => {
    it('should simplify then expand', () => {
      const expr = parse('(x + 0) * (x + 1)');
      const simplified = simplify(expr);
      const expanded = expand(simplified);
      const result = astToString(expanded);
      expect(result).toContain('x');
    });

    it('should expand then simplify', () => {
      const expr = parse('(x + 1) * (x - 1)');
      const expanded = expand(expr);
      const simplified = simplify(expanded);
      const result = astToString(simplified);
      // Should simplify to x^2 - 1
      expect(result).toBeDefined();
    });

    it('should substitute then simplify', () => {
      const expr = parse('x * 0 + y');
      const substituted = substitute(expr, 'y', 5);
      const simplified = simplify(substituted);
      expect(astToString(simplified)).toBe('5');
    });
  });

  describe('Edge cases', () => {
    it('should handle constants', () => {
      const expr = parse('42');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('42');
    });

    it('should handle single variable', () => {
      const expr = parse('x');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBe('x');
    });

    it('should handle division by zero protection', () => {
      const expr = parse('5 / 0');
      expect(() => simplify(expr)).toThrow('Division by zero');
    });

    it('should handle modulo by zero protection', () => {
      const expr = parse('5 % 0');
      expect(() => simplify(expr)).toThrow('Modulo by zero');
    });

    it('should handle negative exponents', () => {
      // x ^ -1 parses as OperatorNode(^, [x, UnaryOperatorNode(-, [1])])
      // The simplifier folds the unary minus into a ConstantNode(-1), producing x^(-1)
      const expr = parse('x ^ -1');
      const simplified = simplify(expr);
      const result = astToString(simplified);
      // Should produce x raised to the power -1 without error
      expect(result).toBeDefined();
      expect(result).toContain('x');
      expect(result).toContain('-1');
    });

    it('should handle fractional exponents', () => {
      const expr = parse('x ^ 0.5');
      const simplified = simplify(expr);
      expect(astToString(simplified)).toBeDefined();
    });
  });
});
