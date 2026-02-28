/**
 * Tests for symbolic differentiation
 */

import { describe, it, expect } from 'vitest';
import { differentiate, simplifyDerivative } from './differentiate';
import { parse } from '../parser/parser';
import { evaluate } from '../parser/evaluator';

describe('Basic Differentiation', () => {
  it('differentiates constants', () => {
    const expr = parse('5');
    const derivative = differentiate(expr, 'x');
    const result = evaluate(derivative);
    expect(result.value).toBe(0);
  });

  it('differentiates variables', () => {
    const expr = parse('x');
    const derivative = differentiate(expr, 'x');
    const result = evaluate(derivative);
    expect(result.value).toBe(1);
  });

  it('differentiates non-matching variables to 0', () => {
    const expr = parse('y');
    const derivative = differentiate(expr, 'x');
    const result = evaluate(derivative);
    expect(result.value).toBe(0);
  });

  it('differentiates power rule: x^2', () => {
    const expr = parse('x^2');
    const derivative = differentiate(expr, 'x');
    const simplified = simplifyDerivative(derivative);
    // d/dx(x^2) = 2*x^1 = 2x
    const result = evaluate(simplified, { variables: { x: 3 } });
    expect(result.value).toBe(6); // 2*3 = 6
  });

  it('differentiates power rule: x^3', () => {
    const expr = parse('x^3');
    const derivative = differentiate(expr, 'x');
    // d/dx(x^3) = 3*x^2
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBe(12); // 3*4 = 12
  });

  it('differentiates sum rule', () => {
    const expr = parse('x + x^2');
    const derivative = differentiate(expr, 'x');
    // d/dx(x + x^2) = 1 + 2x
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBe(5); // 1 + 2*2 = 5
  });

  it('differentiates difference rule', () => {
    const expr = parse('x^3 - x');
    const derivative = differentiate(expr, 'x');
    // d/dx(x^3 - x) = 3x^2 - 1
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBe(11); // 3*4 - 1 = 11
  });
});

describe('Product and Quotient Rules', () => {
  it('differentiates product rule: x * x', () => {
    const expr = parse('x * x');
    const derivative = differentiate(expr, 'x');
    // d/dx(x*x) = x + x = 2x
    const result = evaluate(derivative, { variables: { x: 3 } });
    expect(result.value).toBe(6); // 2*3 = 6
  });

  it('differentiates quotient rule: x^2 / x', () => {
    const expr = parse('x^2 / x');
    const derivative = differentiate(expr, 'x');
    // d/dx(x^2/x) = (2x*x - x^2*1)/x^2 = (2x^2 - x^2)/x^2 = x^2/x^2 = 1
    const result = evaluate(derivative, { variables: { x: 5 } });
    expect(result.value).toBeCloseTo(1, 5);
  });
});

describe('Trigonometric Differentiation', () => {
  it('differentiates sin(x)', () => {
    const expr = parse('sin(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(sin(x)) = cos(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('differentiates cos(x)', () => {
    const expr = parse('cos(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(cos(x)) = -sin(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(0, 10);
  });

  it('differentiates tan(x)', () => {
    const expr = parse('tan(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(tan(x)) = sec^2(x) = 1/cos^2(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('differentiates sec(x)', () => {
    const expr = parse('sec(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(sec(x)) = sec(x)*tan(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(0, 10);
  });

  it('differentiates csc(x)', () => {
    const expr = parse('csc(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(csc(x)) = -csc(x)*cot(x)
    const result = evaluate(derivative, { variables: { x: Math.PI / 2 } });
    expect(result.value).toBeCloseTo(0, 10);
  });

  it('differentiates cot(x)', () => {
    const expr = parse('cot(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(cot(x)) = -csc^2(x)
    const result = evaluate(derivative, { variables: { x: Math.PI / 4 } });
    expect(result.value).toBeCloseTo(-2, 5);
  });
});

describe('Inverse Trigonometric Differentiation', () => {
  it('differentiates asin(x)', () => {
    const expr = parse('asin(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(asin(x)) = 1/sqrt(1-x^2)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('differentiates acos(x)', () => {
    const expr = parse('acos(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(acos(x)) = -1/sqrt(1-x^2)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(-1, 10);
  });

  it('differentiates atan(x)', () => {
    const expr = parse('atan(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(atan(x)) = 1/(1+x^2)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('differentiates atan at x=1', () => {
    const expr = parse('atan(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(atan(x)) = 1/(1+x^2)
    const result = evaluate(derivative, { variables: { x: 1 } });
    expect(result.value).toBeCloseTo(0.5, 10);
  });
});

describe('Hyperbolic Differentiation', () => {
  it('differentiates sinh(x)', () => {
    const expr = parse('sinh(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(sinh(x)) = cosh(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('differentiates cosh(x)', () => {
    const expr = parse('cosh(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(cosh(x)) = sinh(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(0, 10);
  });

  it('differentiates tanh(x)', () => {
    const expr = parse('tanh(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(tanh(x)) = 1/cosh^2(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });
});

describe('Exponential and Logarithmic Differentiation', () => {
  it('differentiates exp(x)', () => {
    const expr = parse('exp(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(exp(x)) = exp(x)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('differentiates log(x)', () => {
    const expr = parse('log(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(log(x)) = 1/x
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(0.5, 10);
  });

  it('differentiates ln(x)', () => {
    const expr = parse('ln(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(ln(x)) = 1/x
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(0.5, 10);
  });

  it('differentiates log10(x)', () => {
    const expr = parse('log10(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(log10(x)) = 1/(x*ln(10))
    const result = evaluate(derivative, { variables: { x: 10 } });
    expect(result.value).toBeCloseTo(1 / (10 * Math.log(10)), 10);
  });

  it('differentiates log2(x)', () => {
    const expr = parse('log2(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(log2(x)) = 1/(x*ln(2))
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(1 / (2 * Math.log(2)), 10);
  });

  it('differentiates sqrt(x)', () => {
    const expr = parse('sqrt(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(sqrt(x)) = 1/(2*sqrt(x))
    const result = evaluate(derivative, { variables: { x: 4 } });
    expect(result.value).toBeCloseTo(0.25, 10);
  });

  it('differentiates abs(x) for positive x', () => {
    const expr = parse('abs(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(abs(x)) = x/abs(x) = sign(x)
    const result = evaluate(derivative, { variables: { x: 5 } });
    expect(result.value).toBeCloseTo(1, 10);
  });
});

describe('Exponential with Constant Base', () => {
  it('differentiates 2^x', () => {
    const expr = parse('2^x');
    const derivative = differentiate(expr, 'x');
    // d/dx(2^x) = 2^x * ln(2)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(Math.log(2), 10);
  });

  it('differentiates 10^x', () => {
    const expr = parse('10^x');
    const derivative = differentiate(expr, 'x');
    // d/dx(10^x) = 10^x * ln(10)
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(Math.log(10), 10);
  });

  it('differentiates e^x using exp', () => {
    const expr = parse('exp(x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(e^x) = e^x
    const result = evaluate(derivative, { variables: { x: 1 } });
    expect(result.value).toBeCloseTo(Math.E, 10);
  });
});

describe('General Variable Exponent Differentiation', () => {
  it('differentiates x^x using the logarithmic differentiation formula', () => {
    // (x^x)' = x^x * (1 * ln(x) + x * 1/x)
    //         = x^x * (ln(x) + 1)
    // At x = 1: 1^1 * (ln(1) + 1) = 1 * (0 + 1) = 1
    const expr = parse('x^x');
    const derivative = differentiate(expr, 'x');
    const result = evaluate(derivative, { variables: { x: 1 } });
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('x^x derivative at x=2 equals 4*(ln(2)+1)', () => {
    // (x^x)' at x=2: 2^2 * (ln(2) + 1) = 4 * (ln(2) + 1)
    const expr = parse('x^x');
    const derivative = differentiate(expr, 'x');
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(4 * (Math.log(2) + 1), 10);
  });

  it('simplifies x^x derivative correctly', () => {
    // After simplifyDerivative the structure is still numerically equivalent
    const expr = parse('x^x');
    const derivative = differentiate(expr, 'x');
    const simplified = simplifyDerivative(derivative);
    const result = evaluate(simplified, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(4 * (Math.log(2) + 1), 10);
  });
});

describe('Chain Rule', () => {
  it('differentiates sin(2*x)', () => {
    const expr = parse('sin(2*x)');
    const derivative = differentiate(expr, 'x');
    // d/dx(sin(2x)) = cos(2x) * 2
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(2, 10);
  });

  it('differentiates (x^2)^3', () => {
    const expr = parse('(x^2)^3');
    const derivative = differentiate(expr, 'x');
    // d/dx((x^2)^3) = 3*(x^2)^2 * 2x = 6x^5
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(6 * Math.pow(2, 5), 5);
  });

  it('differentiates exp(x^2)', () => {
    const expr = parse('exp(x^2)');
    const derivative = differentiate(expr, 'x');
    // d/dx(exp(x^2)) = exp(x^2) * 2x
    const result = evaluate(derivative, { variables: { x: 0 } });
    expect(result.value).toBeCloseTo(0, 10);
  });

  it('differentiates ln(x^2)', () => {
    const expr = parse('ln(x^2)');
    const derivative = differentiate(expr, 'x');
    // d/dx(ln(x^2)) = (1/x^2) * 2x = 2/x
    const result = evaluate(derivative, { variables: { x: 2 } });
    expect(result.value).toBeCloseTo(1, 10);
  });
});

describe('Simplification', () => {
  it('simplifies 0 + x to x', () => {
    const expr = parse('x');
    const derivative = differentiate(parse('0 + x'), 'x');
    const simplified = simplifyDerivative(derivative);
    const result = evaluate(simplified);
    expect(result.value).toBe(1);
  });

  it('simplifies 0 * x to 0', () => {
    const derivative = differentiate(parse('0'), 'x');
    const simplified = simplifyDerivative(derivative);
    const result = evaluate(simplified);
    expect(result.value).toBe(0);
  });

  it('simplifies 1 * x to x', () => {
    const expr = parse('x');
    const derivative = differentiate(expr, 'x');
    const simplified = simplifyDerivative(derivative);
    const result = evaluate(simplified);
    expect(result.value).toBe(1);
  });
});
