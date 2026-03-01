/**
 * End-to-end tests: parse -> evaluate -> verify
 *
 * These tests exercise the full pipeline from string expression to numerical
 * result, serving as regression tests for mathematical correctness.
 */

import { describe, expect, it } from 'vitest';
import { evaluate } from './parser/evaluator';
import { parse } from './parser/parser';
import { correlation } from './stats/correlation';
import { mean, median, stdDev, variance } from './stats/descriptive';
import { linearRegression } from './stats/regression';
import { differentiate, simplifyDerivative } from './symbolic/differentiate';
import { astToString } from './symbolic/integrate';
import { simplify } from './symbolic/simplify';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function evalExpr(expr: string, vars: Record<string, number> = {}): number {
  const result = evaluate(expr, { variables: vars });
  if (!result.success) throw new Error(`Evaluation failed: ${expr}`);
  return Number(result.value);
}

// ===========================================================================
// FULL PIPELINE: parse -> evaluate
// ===========================================================================

describe('E2E: Parse and Evaluate', () => {
  it('basic arithmetic chain', () => {
    expect(evalExpr('1 + 2 * 3 - 4 / 2')).toBe(5);
  });

  it('nested functions', () => {
    expect(evalExpr('sqrt(abs(-16))')).toBe(4);
  });

  it('trig at special angles', () => {
    expect(evalExpr('sin(pi/6)')).toBeCloseTo(0.5, 10);
    expect(evalExpr('cos(pi/3)')).toBeCloseTo(0.5, 10);
    expect(evalExpr('tan(pi/4)')).toBeCloseTo(1, 10);
  });

  it('logarithmic identities', () => {
    // log(a^n) = n*log(a)
    const lhs = evalExpr('log(2^5)');
    const rhs = evalExpr('5 * log(2)');
    expect(lhs).toBeCloseTo(rhs, 10);
  });

  it('change of base formula: log_b(x) = ln(x) / ln(b)', () => {
    // log2(32) = ln(32)/ln(2) = 5
    expect(evalExpr('ln(32) / ln(2)')).toBeCloseTo(5, 10);
  });

  it('exponential and log inverse: exp(ln(x)) = x', () => {
    expect(evalExpr('exp(ln(7))')).toBeCloseTo(7, 10);
  });
});

// ===========================================================================
// MATHEMATICAL IDENTITIES
// ===========================================================================

describe('E2E: Mathematical Identities', () => {
  const angles = [0.3, 0.7, 1.2, 2.0, 2.5];

  it('sin^2(x) + cos^2(x) = 1 for multiple angles', () => {
    for (const x of angles) {
      const result = evalExpr('sin(x)^2 + cos(x)^2', { x });
      expect(result).toBeCloseTo(1, 10);
    }
  });

  it('1 + tan^2(x) = sec^2(x) for multiple angles', () => {
    for (const x of angles) {
      const lhs = evalExpr('1 + tan(x)^2', { x });
      const rhs = evalExpr('sec(x)^2', { x });
      expect(lhs).toBeCloseTo(rhs, 8);
    }
  });

  it('cosh^2(x) - sinh^2(x) = 1 for multiple values', () => {
    for (const x of [0, 0.5, 1, 2, 3]) {
      const result = evalExpr('cosh(x)^2 - sinh(x)^2', { x });
      expect(result).toBeCloseTo(1, 10);
    }
  });

  it('double angle: cos(2x) = cos^2(x) - sin^2(x)', () => {
    for (const x of angles) {
      const lhs = evalExpr('cos(2*x)', { x });
      const rhs = evalExpr('cos(x)^2 - sin(x)^2', { x });
      expect(lhs).toBeCloseTo(rhs, 10);
    }
  });

  it('sum-to-product: sin(a+b) = sin(a)cos(b) + cos(a)sin(b)', () => {
    const a = 0.5;
    const b = 0.8;
    const lhs = evalExpr('sin(a + b)', { a, b });
    const rhs = evalExpr('sin(a)*cos(b) + cos(a)*sin(b)', { a, b });
    expect(lhs).toBeCloseTo(rhs, 10);
  });

  it('power rule: (a*b)^n = a^n * b^n', () => {
    expect(evalExpr('(2*3)^4')).toBe(evalExpr('2^4 * 3^4'));
  });

  it('exp addition: exp(a+b) = exp(a)*exp(b)', () => {
    const a = 1.5;
    const b = 2.3;
    const lhs = evalExpr('exp(a+b)', { a, b });
    const rhs = evalExpr('exp(a)*exp(b)', { a, b });
    expect(lhs).toBeCloseTo(rhs, 8);
  });
});

// ===========================================================================
// DIFFERENTIATION + EVALUATION
// ===========================================================================

describe('E2E: Differentiation and Evaluation', () => {
  it('d/dx[x^4] = 4x^3, verified at x=2', () => {
    const ast = parse('x^4');
    const deriv = differentiate(ast, 'x');
    const result = evaluate(deriv, { variables: { x: 2 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number(result.value)).toBeCloseTo(32, 5); // 4*2^3
    }
  });

  it('d/dx[sin(x)*cos(x)] at x=0 equals 1', () => {
    const ast = parse('sin(x)*cos(x)');
    const deriv = differentiate(ast, 'x');
    const result = evaluate(deriv, { variables: { x: 0 } });
    expect(result.success).toBe(true);
    if (result.success) {
      // d/dx[sin(x)cos(x)] = cos^2(x) - sin^2(x) = cos(2x)
      // At x=0: cos(0) = 1
      expect(Number(result.value)).toBeCloseTo(1, 8);
    }
  });

  it('d/dx[exp(2x)] at x=0 equals 2', () => {
    const ast = parse('exp(2*x)');
    const deriv = differentiate(ast, 'x');
    const result = evaluate(deriv, { variables: { x: 0 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number(result.value)).toBeCloseTo(2, 8);
    }
  });

  it('second derivative of sin(x) = -sin(x)', () => {
    const ast = parse('sin(x)');
    const first = differentiate(ast, 'x');
    const second = differentiate(first, 'x');
    const x = 1.0;
    const result = evaluate(second, { variables: { x } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number(result.value)).toBeCloseTo(-Math.sin(x), 8);
    }
  });
});

// ===========================================================================
// SIMPLIFICATION
// ===========================================================================

describe('E2E: Simplification', () => {
  it('simplifies 0 + x to x', () => {
    const result = simplify(parse('0 + x'));
    expect(astToString(result)).toBe('x');
  });

  it('simplifies x * 0 to 0', () => {
    const result = simplify(parse('x * 0'));
    expect(astToString(result)).toBe('0');
  });

  it('simplifies x^1 to x', () => {
    const result = simplify(parse('x^1'));
    expect(astToString(result)).toBe('x');
  });

  it('simplifies x^0 to 1', () => {
    const result = simplify(parse('x^0'));
    expect(astToString(result)).toBe('1');
  });

  it('constant folding: 2 + 3 * 4 = 14', () => {
    const result = simplify(parse('2 + 3 * 4'));
    expect(astToString(result)).toBe('14');
  });
});

// ===========================================================================
// STATISTICS CROSS-MODULE
// ===========================================================================

describe('E2E: Statistics Module', () => {
  it('mean of uniform sequence', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('median of even-length array', () => {
    expect(median([1, 3, 5, 7])).toBe(4);
  });

  it('variance and stdDev are consistent', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const v = variance(data);
    const s = stdDev(data);
    expect(s).toBeCloseTo(Math.sqrt(v), 10);
  });

  it('linear regression on perfect data', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [3, 5, 7, 9, 11]; // y = 2x + 1
    const result = linearRegression(x, y);
    expect(result.slope).toBeCloseTo(2, 10);
    expect(result.intercept).toBeCloseTo(1, 10);
    expect(result.r2).toBeCloseTo(1, 10);
  });

  it('correlation of identical arrays is 1', () => {
    const data = [1, 2, 3, 4, 5];
    expect(correlation(data, data)).toBeCloseTo(1, 10);
  });

  it('correlation of reversed array is -1', () => {
    const data = [1, 2, 3, 4, 5];
    const reversed = [5, 4, 3, 2, 1];
    expect(correlation(data, reversed)).toBeCloseTo(-1, 10);
  });
});

// ===========================================================================
// EDGE CASES AND ERROR PATHS
// ===========================================================================

describe('E2E: Edge Cases', () => {
  it('parse error on gibberish expression', () => {
    expect(() => parse('@@##')).toThrow();
  });

  it('parse error on unclosed parenthesis', () => {
    expect(() => parse('(2 + 3')).toThrow();
  });

  it('parse error on dangling operator', () => {
    expect(() => parse('2 +')).toThrow();
  });

  it('evaluation fails on undefined variable', () => {
    const result = evaluate('x + y', {});
    expect(result.success).toBe(false);
  });

  it('evaluation fails on division by zero', () => {
    const result = evaluate('1 / 0', {});
    expect(result.success).toBe(false);
  });

  it('evaluation of deeply nested expression', () => {
    // sin(cos(tan(exp(1))))
    const result = evaluate('sin(cos(tan(exp(1))))', {});
    expect(result.success).toBe(true);
    if (result.success) {
      const expected = Math.sin(Math.cos(Math.tan(Math.exp(1))));
      expect(Number(result.value)).toBeCloseTo(expected, 10);
    }
  });

  it('very large exponent', () => {
    const result = evaluate('2^50', {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number(result.value)).toBe(2 ** 50);
    }
  });

  it('fractional exponent', () => {
    // 8^(1/3) = 2
    const result = evaluate('8^(1/3)', {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number(result.value)).toBeCloseTo(2, 10);
    }
  });
});
