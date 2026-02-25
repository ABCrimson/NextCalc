/**
 * Tests for equation solver
 */

import { describe, it, expect } from 'vitest';
import { solve, solveInRange, Complex } from './solve';

describe('solve', () => {
  describe('linear equations', () => {
    it('solves x - 5 = 0', () => {
      const solutions = solve('x - 5', 'x');
      expect(solutions).toHaveLength(1);
      expect(solutions[0].value).toBeCloseTo(5, 10);
    });

    it('solves 2*x + 4 = 0', () => {
      const solutions = solve('2*x + 4', 'x');
      expect(solutions).toHaveLength(1);
      expect(solutions[0].value).toBeCloseTo(-2, 10);
    });

    it('solves equation with both sides: x + 3 = 7', () => {
      const solutions = solve('x + 3 = 7', 'x');
      expect(solutions).toHaveLength(1);
      expect(solutions[0].value).toBeCloseTo(4, 10);
    });
  });

  describe('quadratic equations', () => {
    it('solves x^2 - 4 = 0', () => {
      const solutions = solve('x^2 - 4', 'x');
      expect(solutions).toHaveLength(2);

      const values = solutions.map((s) => s.value as number).sort((a, b) => a - b);
      expect(values[0]).toBeCloseTo(-2, 8);
      expect(values[1]).toBeCloseTo(2, 8);
    });

    it('solves x^2 - 4*x + 4 = 0 (repeated root)', () => {
      const solutions = solve('x^2 - 4*x + 4', 'x');
      expect(solutions).toHaveLength(1);
      expect(solutions[0].value).toBeCloseTo(2, 8);
      expect(solutions[0].multiplicity).toBe(2);
    });

    it('solves x^2 + 1 = 0 (complex roots)', () => {
      const solutions = solve('x^2 + 1', 'x');
      expect(solutions).toHaveLength(2);

      const s1 = solutions[0].value as Complex;
      const s2 = solutions[1].value as Complex;

      expect(s1).toBeInstanceOf(Complex);
      expect(s2).toBeInstanceOf(Complex);

      expect(s1.real).toBeCloseTo(0, 10);
      expect(Math.abs(s1.imag)).toBeCloseTo(1, 10);
    });

    it('solves 2*x^2 - 8 = 0', () => {
      const solutions = solve('2*x^2 - 8', 'x');
      expect(solutions).toHaveLength(2);

      const values = solutions.map((s) => s.value as number).sort((a, b) => a - b);
      expect(values[0]).toBeCloseTo(-2, 8);
      expect(values[1]).toBeCloseTo(2, 8);
    });
  });

  describe('transcendental equations', () => {
    it('solves exp(x) - 2 = 0 numerically', () => {
      const solutions = solve('exp(x) - 2', 'x', { method: 'numerical' });
      expect(solutions).toHaveLength(1);
      expect(solutions[0].value).toBeCloseTo(Math.log(2), 8);
    });

    it('solves sin(x) = 0 with initial guess near pi', () => {
      const solutions = solve('sin(x)', 'x', {
        method: 'numerical',
        initialGuess: 3,
      });
      expect(solutions).toHaveLength(1);
      expect(solutions[0].value).toBeCloseTo(Math.PI, 6);
    });
  });

  describe('solveInRange', () => {
    it('finds multiple solutions for sin(x) in [0, 2π]', () => {
      const solutions = solveInRange('sin(x)', 'x', 0, 2 * Math.PI, 20);

      // Should find x=0, x=π, x=2π (approximately)
      expect(solutions.length).toBeGreaterThanOrEqual(2);

      // Check we found solutions near 0, π
      const values = solutions.map((s) => s.value as number);
      const hasZero = values.some((v) => Math.abs(v) < 0.1);
      const hasPi = values.some((v) => Math.abs(v - Math.PI) < 0.1);

      expect(hasZero || hasPi).toBe(true);
    });
  });

  describe('Complex number', () => {
    it('creates complex number', () => {
      const c = new Complex(3, 4);
      expect(c.real).toBe(3);
      expect(c.imag).toBe(4);
    });

    it('converts to string', () => {
      expect(new Complex(3, 4).toString()).toBe('3+4i');
      expect(new Complex(3, -4).toString()).toBe('3-4i');
      expect(new Complex(0, 4).toString()).toBe('4i');
      expect(new Complex(3, 0).toString()).toBe('3');
    });

    it('checks equality', () => {
      const c1 = new Complex(1, 2);
      const c2 = new Complex(1, 2);
      const c3 = new Complex(1, 3);

      expect(c1.equals(c2)).toBe(true);
      expect(c1.equals(c3)).toBe(false);
    });
  });
});
