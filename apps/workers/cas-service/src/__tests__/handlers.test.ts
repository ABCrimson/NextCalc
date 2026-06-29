/**
 * Unit tests for CAS service handlers
 * Tests equation solving, differentiation, and integration
 */

import { describe, expect, it } from 'vitest';
import {
  differentiateMathExpression,
  expressionContainsVariable,
} from '../handlers/differentiate.js';
import { integrateMathExpression } from '../handlers/integrate.js';
import { solveMathExpression, verifySolution } from '../handlers/solve.js';

describe('Solve Handler', () => {
  it('should solve a linear equation', async () => {
    const result = await solveMathExpression({
      expression: '2*x + 5 = 13',
      variable: 'x',
      precision: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data?.solutions).toContain(4);
  });

  it('should solve a quadratic equation', async () => {
    const result = await solveMathExpression({
      expression: 'x^2 - 5*x + 6 = 0',
      variable: 'x',
      precision: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data?.solutions.length).toBeGreaterThan(0);
  });

  it('should return error for invalid equation', async () => {
    const result = await solveMathExpression({
      expression: '2*x + 5',
      variable: 'x',
      precision: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_EQUATION');
  });

  it('should verify solutions correctly', () => {
    expect(verifySolution('2*x + 5 = 13', 'x', 4)).toBe(true);
    expect(verifySolution('2*x + 5 = 13', 'x', 5)).toBe(false);
  });
});

describe('Differentiate Handler', () => {
  it('should differentiate a polynomial', async () => {
    const result = await differentiateMathExpression({
      expression: 'x^2 + 3*x + 2',
      variable: 'x',
      order: 1,
      simplify: true,
    });

    expect(result.success).toBe(true);
    // d/dx(x^2 + 3x + 2) = 2x + 3. mathjs renders this as "2 * x + 3".
    // Assert the actual content (whitespace-insensitive) rather than mere existence.
    const derivative = result.data?.derivative ?? '';
    const compact = derivative.replace(/\s+/g, '');
    // Leading coefficient 2 multiplied by a single x.
    expect(compact).toMatch(/2\*?x/);
    // Constant term 3 from differentiating 3x; the +2 constant vanishes.
    expect(compact).toMatch(/3/);
    // Exactly one occurrence of the variable x in the linear result.
    expect((compact.match(/x/g) ?? []).length).toBe(1);
    // The constant 2 must NOT survive differentiation as a standalone term.
    expect(compact).not.toMatch(/\+2$/);
  });

  it('should compute second derivative', async () => {
    const result = await differentiateMathExpression({
      expression: 'x^3',
      variable: 'x',
      order: 2,
      simplify: true,
    });

    expect(result.success).toBe(true);
    // d^2/dx^2(x^3) = 6x. mathjs renders this as "6 * x".
    const derivative = result.data?.derivative ?? '';
    const compact = derivative.replace(/\s+/g, '');
    // Coefficient 6 multiplied by a single x, with no remaining power.
    expect(compact).toMatch(/^6\*?x$/);
  });

  it('should return error for invalid expression', async () => {
    const result = await differentiateMathExpression({
      expression: 'invalid@#$',
      variable: 'x',
      order: 1,
      simplify: true,
    });

    expect(result.success).toBe(false);
  });

  it('should detect variable presence', () => {
    expect(expressionContainsVariable('x^2 + 3*x', 'x')).toBe(true);
    expect(expressionContainsVariable('5 + 2', 'x')).toBe(false);
    expect(expressionContainsVariable('y^2', 'x')).toBe(false);
  });
});

describe('Integrate Handler', () => {
  it('should integrate a polynomial indefinitely', async () => {
    const result = await integrateMathExpression({
      expression: 'x^2',
      variable: 'x',
      simplify: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.integral).toBeDefined();
    expect(result.data?.definite).toBe(false);
  });

  it('should compute definite integral', async () => {
    const result = await integrateMathExpression({
      expression: 'x^2',
      variable: 'x',
      lowerBound: 0,
      upperBound: 1,
      simplify: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.definite).toBe(true);
    expect(result.data?.numericValue).toBeCloseTo(0.333333, 4);
  });

  it('should return error for invalid expression', async () => {
    const result = await integrateMathExpression({
      expression: 'invalid@#$',
      variable: 'x',
      simplify: true,
    });

    expect(result.success).toBe(false);
  });

  it('should handle constant integration', async () => {
    const result = await integrateMathExpression({
      expression: '5',
      variable: 'x',
      lowerBound: 0,
      upperBound: 2,
      simplify: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.numericValue).toBeCloseTo(10, 4);
  });
});
