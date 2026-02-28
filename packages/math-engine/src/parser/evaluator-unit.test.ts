/**
 * Comprehensive unit tests for the expression evaluator
 *
 * Tests all arithmetic operations, built-in functions, constants,
 * variable bindings, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator';

// ---------------------------------------------------------------------------
// Helper: assert successful evaluation equals expected value
// ---------------------------------------------------------------------------
function expectValue(expr: string, expected: number, ctx: Record<string, number> = {}) {
  const result = evaluate(expr, { variables: ctx });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.value).toBeCloseTo(expected, 10);
  }
}

function expectExact(expr: string, expected: number, ctx: Record<string, number> = {}) {
  const result = evaluate(expr, { variables: ctx });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.value).toBe(expected);
  }
}

function expectFailure(expr: string, ctx: Record<string, number> = {}) {
  const result = evaluate(expr, { variables: ctx });
  expect(result.success).toBe(false);
}

// ===========================================================================
// BASIC ARITHMETIC
// ===========================================================================

describe('Evaluator - Basic Arithmetic', () => {
  it('evaluates integer addition', () => {
    expectExact('2 + 3', 5);
  });

  it('evaluates integer subtraction', () => {
    expectExact('10 - 4', 6);
  });

  it('evaluates integer multiplication', () => {
    expectExact('6 * 7', 42);
  });

  it('evaluates integer division', () => {
    expectExact('20 / 4', 5);
  });

  it('evaluates floating-point division', () => {
    expectValue('7 / 2', 3.5);
  });

  it('evaluates exponentiation', () => {
    expectExact('2 ^ 10', 1024);
  });

  it('evaluates modulo', () => {
    expectExact('17 % 5', 2);
  });

  it('evaluates chained addition', () => {
    expectExact('1 + 2 + 3 + 4', 10);
  });

  it('evaluates mixed operations', () => {
    expectExact('2 + 3 * 4', 14);
  });

  it('evaluates parenthesized expressions', () => {
    expectExact('(2 + 3) * 4', 20);
  });

  it('evaluates nested parentheses', () => {
    expectExact('((1 + 2) * (3 + 4))', 21);
  });

  it('evaluates deeply nested parentheses', () => {
    expectExact('(((2 + 3)))', 5);
  });
});

// ===========================================================================
// OPERATOR PRECEDENCE
// ===========================================================================

describe('Evaluator - Operator Precedence', () => {
  it('multiplication before addition', () => {
    expectExact('2 + 3 * 4', 14);
  });

  it('multiplication before subtraction', () => {
    expectExact('10 - 2 * 3', 4);
  });

  it('exponentiation before multiplication', () => {
    expectExact('2 * 3 ^ 2', 18);
  });

  it('exponentiation is right-associative', () => {
    // 2^3^2 = 2^(3^2) = 2^9 = 512
    expectExact('2 ^ 3 ^ 2', 512);
  });

  it('division and multiplication left-to-right', () => {
    expectExact('24 / 4 * 3', 18);
  });

  it('addition and subtraction left-to-right', () => {
    expectExact('10 - 3 + 2', 9);
  });
});

// ===========================================================================
// UNARY OPERATORS
// ===========================================================================

describe('Evaluator - Unary Operators', () => {
  it('negates a constant', () => {
    expectExact('-5', -5);
  });

  it('negates a variable', () => {
    expectExact('-x', -7, { x: 7 });
  });

  it('double negation', () => {
    expectExact('--3', 3);
  });

  it('unary minus in expression', () => {
    expectExact('5 + -3', 2);
  });

  it('unary minus with exponentiation: -(x^2)', () => {
    expectExact('-x^2', -9, { x: 3 });
  });

  it('unary plus is identity', () => {
    expectExact('+5', 5);
  });
});

// ===========================================================================
// BUILT-IN CONSTANTS
// ===========================================================================

describe('Evaluator - Built-in Constants', () => {
  it('evaluates pi', () => {
    expectValue('pi', Math.PI);
  });

  it('evaluates e', () => {
    expectValue('e', Math.E);
  });

  it('evaluates tau = 2*pi', () => {
    expectValue('tau', 2 * Math.PI);
  });

  it('uses pi in expression', () => {
    expectValue('2 * pi', 2 * Math.PI);
  });

  it('uses e in expression', () => {
    expectValue('e ^ 2', Math.E ** 2);
  });
});

// ===========================================================================
// VARIABLE BINDINGS
// ===========================================================================

describe('Evaluator - Variable Bindings', () => {
  it('evaluates single variable', () => {
    expectExact('x', 42, { x: 42 });
  });

  it('evaluates multiple variables', () => {
    expectExact('x + y', 7, { x: 3, y: 4 });
  });

  it('evaluates expression with variable and constant', () => {
    expectExact('2 * x + 1', 9, { x: 4 });
  });

  it('variable overrides built-in when bound', () => {
    expectExact('e', 99, { e: 99 });
  });

  it('fails on undefined variable', () => {
    expectFailure('x + 1');
  });

  it('fails on partially undefined expression', () => {
    expectFailure('x + y', { x: 5 });
  });
});

// ===========================================================================
// TRIGONOMETRIC FUNCTIONS
// ===========================================================================

describe('Evaluator - Trigonometric Functions', () => {
  it('sin(0) = 0', () => {
    expectValue('sin(0)', 0);
  });

  it('sin(pi/2) = 1', () => {
    expectValue('sin(pi / 2)', 1);
  });

  it('cos(0) = 1', () => {
    expectValue('cos(0)', 1);
  });

  it('cos(pi) = -1', () => {
    expectValue('cos(pi)', -1);
  });

  it('tan(0) = 0', () => {
    expectValue('tan(0)', 0);
  });

  it('tan(pi/4) = 1', () => {
    expectValue('tan(pi / 4)', 1);
  });

  it('sec(0) = 1', () => {
    expectValue('sec(0)', 1);
  });

  it('csc(pi/2) = 1', () => {
    expectValue('csc(pi / 2)', 1);
  });

  it('cot(pi/4) = 1', () => {
    expectValue('cot(pi / 4)', 1);
  });

  // Pythagorean identity: sin^2(x) + cos^2(x) = 1
  it('verifies Pythagorean identity at x = 1.5', () => {
    const sinResult = evaluate('sin(x)', { variables: { x: 1.5 } });
    const cosResult = evaluate('cos(x)', { variables: { x: 1.5 } });
    expect(sinResult.success && cosResult.success).toBe(true);
    if (sinResult.success && cosResult.success) {
      const s = Number(sinResult.value);
      const c = Number(cosResult.value);
      expect(s * s + c * c).toBeCloseTo(1, 10);
    }
  });
});

// ===========================================================================
// INVERSE TRIGONOMETRIC FUNCTIONS
// ===========================================================================

describe('Evaluator - Inverse Trigonometric Functions', () => {
  it('asin(0) = 0', () => {
    expectValue('asin(0)', 0);
  });

  it('asin(1) = pi/2', () => {
    expectValue('asin(1)', Math.PI / 2);
  });

  it('acos(1) = 0', () => {
    expectValue('acos(1)', 0);
  });

  it('acos(0) = pi/2', () => {
    expectValue('acos(0)', Math.PI / 2);
  });

  it('atan(0) = 0', () => {
    expectValue('atan(0)', 0);
  });

  it('atan(1) = pi/4', () => {
    expectValue('atan(1)', Math.PI / 4);
  });
});

// ===========================================================================
// HYPERBOLIC FUNCTIONS
// ===========================================================================

describe('Evaluator - Hyperbolic Functions', () => {
  it('sinh(0) = 0', () => {
    expectValue('sinh(0)', 0);
  });

  it('cosh(0) = 1', () => {
    expectValue('cosh(0)', 1);
  });

  it('tanh(0) = 0', () => {
    expectValue('tanh(0)', 0);
  });

  // Identity: cosh^2(x) - sinh^2(x) = 1
  it('verifies hyperbolic Pythagorean identity', () => {
    const sinhR = evaluate('sinh(x)', { variables: { x: 2 } });
    const coshR = evaluate('cosh(x)', { variables: { x: 2 } });
    expect(sinhR.success && coshR.success).toBe(true);
    if (sinhR.success && coshR.success) {
      const s = Number(sinhR.value);
      const c = Number(coshR.value);
      expect(c * c - s * s).toBeCloseTo(1, 10);
    }
  });
});

// ===========================================================================
// EXPONENTIAL AND LOGARITHMIC FUNCTIONS
// ===========================================================================

describe('Evaluator - Exponential and Logarithmic Functions', () => {
  it('exp(0) = 1', () => {
    expectValue('exp(0)', 1);
  });

  it('exp(1) = e', () => {
    expectValue('exp(1)', Math.E);
  });

  it('log(1) = 0', () => {
    expectValue('log(1)', 0);
  });

  it('log(e) = 1', () => {
    expectValue('log(e)', 1);
  });

  it('ln(e) = 1', () => {
    expectValue('ln(e)', 1);
  });

  it('log10(100) = 2', () => {
    expectValue('log10(100)', 2);
  });

  it('log10(1000) = 3', () => {
    expectValue('log10(1000)', 3);
  });

  it('log2(8) = 3', () => {
    expectValue('log2(8)', 3);
  });

  it('log2(1024) = 10', () => {
    expectValue('log2(1024)', 10);
  });

  // Inverse property: log(exp(x)) = x
  it('log(exp(x)) = x', () => {
    expectValue('log(exp(5))', 5);
  });

  // exp(log(x)) = x
  it('exp(log(x)) = x for x > 0', () => {
    expectValue('exp(log(7))', 7);
  });
});

// ===========================================================================
// POWER AND ROOT FUNCTIONS
// ===========================================================================

describe('Evaluator - Power and Root Functions', () => {
  it('sqrt(4) = 2', () => {
    expectExact('sqrt(4)', 2);
  });

  it('sqrt(9) = 3', () => {
    expectExact('sqrt(9)', 3);
  });

  it('sqrt(2) approx 1.414...', () => {
    expectValue('sqrt(2)', Math.SQRT2);
  });

  it('cbrt(8) = 2', () => {
    expectExact('cbrt(8)', 2);
  });

  it('cbrt(27) = 3', () => {
    expectExact('cbrt(27)', 3);
  });

  it('cbrt(-8) = -2', () => {
    expectExact('cbrt(-8)', -2);
  });
});

// ===========================================================================
// ROUNDING AND UTILITY FUNCTIONS
// ===========================================================================

describe('Evaluator - Rounding and Utility Functions', () => {
  it('abs(-5) = 5', () => {
    expectExact('abs(-5)', 5);
  });

  it('abs(5) = 5', () => {
    expectExact('abs(5)', 5);
  });

  it('abs(0) = 0', () => {
    expectExact('abs(0)', 0);
  });

  it('ceil(2.3) = 3', () => {
    expectExact('ceil(2.3)', 3);
  });

  it('ceil(-2.3) = -2', () => {
    expectExact('ceil(-2.3)', -2);
  });

  it('floor(2.7) = 2', () => {
    expectExact('floor(2.7)', 2);
  });

  it('floor(-2.7) = -3', () => {
    expectExact('floor(-2.7)', -3);
  });

  it('round(2.5) = 3', () => {
    expectExact('round(2.5)', 3);
  });

  it('round(2.4) = 2', () => {
    expectExact('round(2.4)', 2);
  });
});

// ===========================================================================
// FACTORIAL
// ===========================================================================

describe('Evaluator - Factorial', () => {
  it('factorial(0) = 1', () => {
    expectExact('factorial(0)', 1);
  });

  it('factorial(1) = 1', () => {
    expectExact('factorial(1)', 1);
  });

  it('factorial(5) = 120', () => {
    expectExact('factorial(5)', 120);
  });

  it('factorial(10) = 3628800', () => {
    expectExact('factorial(10)', 3628800);
  });

  it('fails on negative factorial', () => {
    expectFailure('factorial(-1)');
  });

  it('fails on non-integer factorial', () => {
    expectFailure('factorial(2.5)');
  });
});

// ===========================================================================
// DIVISION BY ZERO
// ===========================================================================

describe('Evaluator - Division by Zero', () => {
  it('fails on direct division by zero', () => {
    expectFailure('1 / 0');
  });

  it('fails on variable division by zero', () => {
    expectFailure('x / 0', { x: 5 });
  });
});

// ===========================================================================
// COMPLEX EXPRESSIONS
// ===========================================================================

describe('Evaluator - Complex Expressions', () => {
  it('evaluates quadratic formula discriminant', () => {
    // b^2 - 4*a*c for a=1, b=5, c=6
    expectExact('b^2 - 4*a*c', 1, { a: 1, b: 5, c: 6 });
  });

  it('evaluates Gaussian at x=0', () => {
    // exp(-x^2 / 2) at x=0 = 1
    expectValue('exp(-x^2 / 2)', 1, { x: 0 });
  });

  it('evaluates polynomial 3x^3 + 2x^2 - x + 7 at x=2', () => {
    // 3(8) + 2(4) - 2 + 7 = 24 + 8 - 2 + 7 = 37
    expectExact('3*x^3 + 2*x^2 - x + 7', 37, { x: 2 });
  });

  it('evaluates compound trig expression sin(x)^2 + cos(x)^2', () => {
    expectValue('sin(x)^2 + cos(x)^2', 1, { x: 1.234 });
  });

  it('evaluates exp(-x) * sin(x) at x=0', () => {
    expectValue('exp(-x) * sin(x)', 0, { x: 0 });
  });

  it('evaluates nested function composition', () => {
    // sin(cos(0)) = sin(1)
    expectValue('sin(cos(0))', Math.sin(1));
  });
});

// ===========================================================================
// MATHEMATICAL IDENTITIES (Regression Tests)
// ===========================================================================

describe('Evaluator - Mathematical Identities', () => {
  it('e^(i*pi) identity: exp(0) = 1 (real analog)', () => {
    expectValue('exp(0)', 1);
  });

  it('log identity: log(a*b) = log(a) + log(b)', () => {
    const lhs = evaluate('log(6)', {});
    const rhs = evaluate('log(2) + log(3)', {});
    expect(lhs.success && rhs.success).toBe(true);
    if (lhs.success && rhs.success) {
      expect(Number(lhs.value)).toBeCloseTo(Number(rhs.value), 10);
    }
  });

  it('power identity: (a^m)^n = a^(m*n)', () => {
    expectValue('(2^3)^4', Math.pow(2, 12));
  });

  it('double angle: sin(2x) = 2*sin(x)*cos(x)', () => {
    const x = 0.7;
    const lhs = evaluate('sin(2*x)', { variables: { x } });
    const rhs = evaluate('2*sin(x)*cos(x)', { variables: { x } });
    expect(lhs.success && rhs.success).toBe(true);
    if (lhs.success && rhs.success) {
      expect(Number(lhs.value)).toBeCloseTo(Number(rhs.value), 10);
    }
  });
});
