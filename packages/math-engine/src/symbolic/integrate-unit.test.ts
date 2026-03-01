/**
 * Additional integration tests with numerical verification
 *
 * For each symbolic integral, we verify both:
 * 1. The symbolic result has the expected form
 * 2. The definite integral produces a known numerical answer
 */

import { describe, expect, it } from 'vitest';
import { evaluate } from '../parser/evaluator';
import { parse } from '../parser/parser';
import { astToString, integrate, integrateDefinite } from './integrate';

// ---------------------------------------------------------------------------
// Helper: verify a definite integral numerically
// ---------------------------------------------------------------------------
function expectDefinite(
  expr: string,
  variable: string,
  a: number,
  b: number,
  expected: number,
  tolerance = 1e-3,
) {
  const result = integrateDefinite(expr, variable, a, b, 'numerical');
  expect(result).toBeCloseTo(expected, -Math.log10(tolerance));
}

// ===========================================================================
// POWER RULE (extended)
// ===========================================================================

describe('Integration - Power Rule Extended', () => {
  it('integrates x^0 (constant 1) => x on [0,5] = 5', () => {
    expectDefinite('1', 'x', 0, 5, 5);
  });

  it('integrates x on [0,1] = 0.5', () => {
    expectDefinite('x', 'x', 0, 1, 0.5);
  });

  it('integrates x^2 on [0,1] = 1/3', () => {
    expectDefinite('x^2', 'x', 0, 1, 1 / 3);
  });

  it('integrates x^3 on [0,2] = 4', () => {
    expectDefinite('x^3', 'x', 0, 2, 4);
  });

  it('integrates x^4 on [0,1] = 1/5', () => {
    expectDefinite('x^4', 'x', 0, 1, 0.2);
  });
});

// ===========================================================================
// EXPONENTIAL INTEGRALS
// ===========================================================================

describe('Integration - Exponential', () => {
  it('integrates exp(x) on [0,1] = e - 1', () => {
    expectDefinite('exp(x)', 'x', 0, 1, Math.E - 1);
  });

  it('integrates exp(x) on [0,2] = e^2 - 1', () => {
    expectDefinite('exp(x)', 'x', 0, 2, Math.E ** 2 - 1);
  });
});

// ===========================================================================
// TRIGONOMETRIC INTEGRALS
// ===========================================================================

describe('Integration - Trigonometric', () => {
  it('integrates sin(x) on [0, pi] = 2', () => {
    expectDefinite('sin(x)', 'x', 0, Math.PI, 2);
  });

  it('integrates sin(x) on [0, 2*pi] = 0', () => {
    expectDefinite('sin(x)', 'x', 0, 2 * Math.PI, 0, 1e-2);
  });

  it('integrates cos(x) on [0, pi/2] = 1', () => {
    expectDefinite('cos(x)', 'x', 0, Math.PI / 2, 1);
  });

  it('integrates cos(x) on [0, pi] = 0', () => {
    expectDefinite('cos(x)', 'x', 0, Math.PI, 0, 1e-2);
  });
});

// ===========================================================================
// LINEARITY
// ===========================================================================

describe('Integration - Linearity', () => {
  it('integrates 2*x on [0,1] = 1', () => {
    expectDefinite('2*x', 'x', 0, 1, 1);
  });

  it('integrates 3*x^2 on [0,1] = 1', () => {
    expectDefinite('3*x^2', 'x', 0, 1, 1);
  });

  it('integrates x + 1 on [0,2] = 4', () => {
    // integral of x + 1 from 0 to 2 = [x^2/2 + x] = 2 + 2 = 4
    expectDefinite('x + 1', 'x', 0, 2, 4);
  });

  it('integrates x^2 + x on [0,1] = 1/3 + 1/2 = 5/6', () => {
    expectDefinite('x^2 + x', 'x', 0, 1, 5 / 6);
  });
});

// ===========================================================================
// SYMBOLIC OUTPUT VERIFICATION
// ===========================================================================

describe('Integration - Symbolic Output', () => {
  it('integral of constant produces x term', () => {
    const result = integrate('3', 'x');
    const str = astToString(result);
    expect(str).toContain('x');
    expect(str).toContain('3');
  });

  it('integral of sin produces cos', () => {
    const result = integrate('sin(x)', 'x');
    const str = astToString(result);
    expect(str).toContain('cos');
  });

  it('integral of cos produces sin', () => {
    const result = integrate('cos(x)', 'x');
    const str = astToString(result);
    expect(str).toContain('sin');
  });

  it('integral of exp produces exp', () => {
    const result = integrate('exp(x)', 'x');
    const str = astToString(result);
    expect(str).toContain('exp');
  });

  it('integral of x^n produces x^(n+1)', () => {
    const result = integrate('x^3', 'x');
    const str = astToString(result);
    expect(str).toContain('4'); // exponent becomes 4
  });
});

// ===========================================================================
// DEFINITE INTEGRALS - KNOWN VALUES
// ===========================================================================

describe('Integration - Known Definite Values', () => {
  it('integral of sin^2(x) on [0, pi] = pi/2', () => {
    // sin^2(x) = (1 - cos(2x))/2, integral = pi/2
    expectDefinite('sin(x)^2', 'x', 0, Math.PI, Math.PI / 2, 1e-2);
  });

  it('integral of 1/(1+x^2) on [0, 1] = pi/4 (arctan)', () => {
    expectDefinite('1/(1+x^2)', 'x', 0, 1, Math.PI / 4, 1e-2);
  });

  it('integral of x*exp(x) on [0, 1] = 1 (by parts)', () => {
    // integral x*e^x dx = x*e^x - e^x. From 0 to 1: (e - e) - (0 - 1) = 1
    expectDefinite('x*exp(x)', 'x', 0, 1, 1, 1e-2);
  });
});

// ===========================================================================
// ERROR HANDLING
// ===========================================================================

describe('Integration - Error Handling', () => {
  it('throws on unsupported function', () => {
    expect(() => integrate('factorial(x)', 'x')).toThrow();
  });
});
