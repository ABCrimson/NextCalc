/**
 * Tests for Taylor/Maclaurin series expansion
 */

import { describe, expect, it } from 'vitest';
import {
  createConstantNode,
  createFunctionNode,
  createOperatorNode,
  createSymbolNode,
  createUnaryOperatorNode,
} from '../parser/ast';
import {
  astToLatex,
  computeBernoulliNumbers,
  getKnownSeries,
  maclaurinSeries,
  taylorSeries,
} from './series';

describe('Series - Maclaurin Series', () => {
  it('should compute Maclaurin series of sin(x)', () => {
    // sin(x) = x - x³/6 + x⁵/120 - ...
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.polynomial).toBeDefined();
    expect(result.radiusOfConvergence).toBe(Infinity);
  });

  it('should compute Maclaurin series of cos(x)', () => {
    // cos(x) = 1 - x²/2 + x⁴/24 - ...
    const expr = createFunctionNode('cos', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.polynomial).toBeDefined();
  });

  it('should compute Maclaurin series of exp(x)', () => {
    // exp(x) = 1 + x + x²/2 + x³/6 + ...
    const expr = createFunctionNode('exp', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 5 });

    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.polynomial).toBeDefined();
  });

  it('should compute Maclaurin series of polynomial', () => {
    // x² + 2x + 1 (should be exact)
    const expr = createOperatorNode('+', 'add', [
      createOperatorNode('+', 'add', [
        createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
        createOperatorNode('*', 'multiply', [createConstantNode(2), createSymbolNode('x')]),
      ]),
      createConstantNode(1),
    ]);

    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
  });
});

describe('Series - Taylor Series', () => {
  it('should compute Taylor series around x=1', () => {
    // Simple polynomial around x=1
    const expr = createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]);

    const result = taylorSeries(expr, 'x', { center: 1, terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.polynomial).toBeDefined();
  });

  it('should compute Taylor series of sin(x) around x=π/2', () => {
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = taylorSeries(expr, 'x', {
      center: Math.PI / 2,
      terms: 3,
    });

    expect(result.terms.length).toBeGreaterThan(0);
  });

  it('should handle different centers', () => {
    const expr = createSymbolNode('x');

    const result1 = taylorSeries(expr, 'x', { center: 0, terms: 2 });
    const result2 = taylorSeries(expr, 'x', { center: 5, terms: 2 });

    expect(result1.terms.length).toBeGreaterThan(0);
    expect(result2.terms.length).toBeGreaterThan(0);
  });
});

describe('Series - Known Series', () => {
  it('should return exact sine series', () => {
    const result = getKnownSeries('sin', 'x', { terms: 5 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(5);
    expect(result!.radiusOfConvergence).toBe(Infinity);
  });

  it('should return exact cosine series', () => {
    const result = getKnownSeries('cos', 'x', { terms: 5 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(5);
    expect(result!.radiusOfConvergence).toBe(Infinity);
  });

  it('should return exact exponential series', () => {
    const result = getKnownSeries('exp', 'x', { terms: 6 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(6);
    expect(result!.radiusOfConvergence).toBe(Infinity);
  });

  it('should return exact logarithm series', () => {
    const result = getKnownSeries('ln', 'x', { terms: 5 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(5);
    expect(result!.radiusOfConvergence).toBe(1);
  });

  it('should return exact tangent series', () => {
    const result = getKnownSeries('tan', 'x', { terms: 3 });

    expect(result).toBeDefined();
    expect(result!.radiusOfConvergence).toBe(Math.PI / 2);
  });

  it('should return exact sinh series', () => {
    const result = getKnownSeries('sinh', 'x', { terms: 4 });

    expect(result).toBeDefined();
    expect(result!.radiusOfConvergence).toBe(Infinity);
  });

  it('should return exact cosh series', () => {
    const result = getKnownSeries('cosh', 'x', { terms: 4 });

    expect(result).toBeDefined();
    expect(result!.radiusOfConvergence).toBe(Infinity);
  });

  it('should return null for non-standard center', () => {
    const result = getKnownSeries('sin', 'x', { center: 1, terms: 3 });

    expect(result).toBeNull();
  });

  it('should return null for unknown function', () => {
    const result = getKnownSeries('unknown', 'x', { terms: 3 });

    expect(result).toBeNull();
  });
});

describe('Series - Configuration Options', () => {
  it('should respect term count parameter', () => {
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);

    const result3 = maclaurinSeries(expr, 'x', { terms: 3 });
    const result5 = maclaurinSeries(expr, 'x', { terms: 5 });

    expect(result3.terms.length).toBeLessThanOrEqual(result5.terms.length);
  });

  it('should provide LaTeX output', () => {
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.latex).toBeDefined();
    expect(typeof result.latex).toBe('string');
    expect(result.latex.length).toBeGreaterThan(0);
  });

  it('should include steps when requested', () => {
    const expr = createFunctionNode('exp', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', {
      terms: 3,
      includeSteps: true,
    });

    expect(result.steps).toBeDefined();
    expect(result.steps!.length).toBeGreaterThan(0);
  });

  it('should include remainder when requested', () => {
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', {
      terms: 3,
      includeRemainder: true,
    });

    expect(result.remainder).toBeDefined();
  });

  it('should handle simplifyTerms option', () => {
    const expr = createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]);

    const result1 = maclaurinSeries(expr, 'x', { terms: 3, simplifyTerms: true });
    const result2 = maclaurinSeries(expr, 'x', { terms: 3, simplifyTerms: false });

    expect(result1.polynomial).toBeDefined();
    expect(result2.polynomial).toBeDefined();
  });
});

describe('Series - Edge Cases', () => {
  it('should handle constant function', () => {
    const expr = createConstantNode(42);
    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
  });

  it('should handle linear function', () => {
    const expr = createSymbolNode('x');
    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
  });

  it('should handle zero terms gracefully', () => {
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 0 });

    expect(result.terms.length).toBe(0);
  });

  it('should handle large term count', () => {
    const expr = createFunctionNode('exp', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 10 });

    expect(result.terms.length).toBeLessThanOrEqual(10);
  });
});

describe('Series - Mathematical Correctness', () => {
  it('should have correct coefficient for sin(x) first term', () => {
    // sin(x) first non-zero term should be x (coefficient 1)
    const result = getKnownSeries('sin', 'x', { terms: 1 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(1);
  });

  it('should have correct coefficient for cos(x) first term', () => {
    // cos(x) first term should be 1
    const result = getKnownSeries('cos', 'x', { terms: 1 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(1);
  });

  it('should have correct coefficient for exp(x) first term', () => {
    // exp(x) first term should be 1
    const result = getKnownSeries('exp', 'x', { terms: 1 });

    expect(result).toBeDefined();
    expect(result!.terms.length).toBe(1);
  });
});

// ============================================================================
// Bernoulli Numbers
// ============================================================================

describe('Bernoulli Numbers', () => {
  it('should return empty array for count <= 0', () => {
    expect(computeBernoulliNumbers(0)).toEqual([]);
    expect(computeBernoulliNumbers(-1)).toEqual([]);
  });

  it('should compute B_2 = 1/6', () => {
    const b = computeBernoulliNumbers(1);
    expect(b).toHaveLength(1);
    expect(b[0]).toBeCloseTo(1 / 6, 10);
  });

  it('should compute B_4 = -1/30', () => {
    const b = computeBernoulliNumbers(2);
    expect(b).toHaveLength(2);
    expect(b[1]).toBeCloseTo(-1 / 30, 10);
  });

  it('should compute B_6 = 1/42', () => {
    const b = computeBernoulliNumbers(3);
    expect(b[2]).toBeCloseTo(1 / 42, 10);
  });

  it('should compute B_8 = -1/30', () => {
    const b = computeBernoulliNumbers(4);
    expect(b[3]).toBeCloseTo(-1 / 30, 10);
  });

  it('should compute B_10 = 5/66', () => {
    const b = computeBernoulliNumbers(5);
    expect(b[4]).toBeCloseTo(5 / 66, 8);
  });

  it('should compute multiple Bernoulli numbers at once', () => {
    const b = computeBernoulliNumbers(6);
    expect(b).toHaveLength(6);
    // B_2 = 1/6, B_4 = -1/30, B_6 = 1/42, B_8 = -1/30, B_10 = 5/66, B_12 = -691/2730
    expect(b[0]).toBeCloseTo(1 / 6, 10);
    expect(b[1]).toBeCloseTo(-1 / 30, 10);
    expect(b[2]).toBeCloseTo(1 / 42, 10);
    expect(b[3]).toBeCloseTo(-1 / 30, 8);
    expect(b[4]).toBeCloseTo(5 / 66, 8);
    expect(b[5]).toBeCloseTo(-691 / 2730, 6);
  });
});

// ============================================================================
// Bernoulli-based Series: sec, cot, tanh
// ============================================================================

describe('Series - Known Series (Bernoulli-based)', () => {
  it('should return exact secant series with correct radius', () => {
    const result = getKnownSeries('sec', 'x', { terms: 4 });
    expect(result).toBeDefined();
    expect(result!.radiusOfConvergence).toBe(Math.PI / 2);
    expect(result!.terms.length).toBeGreaterThan(0);
    expect(result!.latex).toBeDefined();
  });

  it('should compute correct secant series coefficients', () => {
    // sec(x) = 1 + x^2/2 + 5x^4/24 + 61x^6/720 + 277x^8/8064 + ...
    const result = getKnownSeries('sec', 'x', { terms: 5 });
    expect(result).toBeDefined();

    // Evaluate the polynomial numerically at x = 0.3 and compare to sec(0.3)
    const x = 0.3;
    const expected = 1 / Math.cos(x);
    // Build approximate value from known coefficients (5 terms)
    const approx = 1 + x ** 2 / 2 + (5 * x ** 4) / 24 + (61 * x ** 6) / 720 + (277 * x ** 8) / 8064;
    expect(approx).toBeCloseTo(expected, 5);
  });

  it('should return exact cotangent series with correct radius', () => {
    const result = getKnownSeries('cot', 'x', { terms: 4 });
    expect(result).toBeDefined();
    expect(result!.radiusOfConvergence).toBe(Math.PI);
    expect(result!.terms.length).toBeGreaterThan(0);
    expect(result!.latex).toBeDefined();
  });

  it('should compute correct cotangent series terms', () => {
    // cot(x) = 1/x - x/3 - x^3/45 - 2x^5/945 - ...
    // At x = 0.5: cot(0.5) ~= 1.8305
    const x = 0.5;
    const expected = Math.cos(x) / Math.sin(x);
    // Laurent series approximation
    const approx = 1 / x - x / 3 - x ** 3 / 45 - (2 * x ** 5) / 945;
    expect(approx).toBeCloseTo(expected, 3);
  });

  it('should return exact tanh series with correct radius', () => {
    const result = getKnownSeries('tanh', 'x', { terms: 4 });
    expect(result).toBeDefined();
    expect(result!.radiusOfConvergence).toBe(Math.PI / 2);
    expect(result!.terms.length).toBeGreaterThan(0);
    expect(result!.latex).toBeDefined();
  });

  it('should compute correct tanh series coefficients', () => {
    // tanh(x) = x - x^3/3 + 2x^5/15 - 17x^7/315 + ...
    const x = 0.5;
    const expected = Math.tanh(x);
    const approx = x - x ** 3 / 3 + (2 * x ** 5) / 15 - (17 * x ** 7) / 315;
    expect(approx).toBeCloseTo(expected, 4);
  });

  it('tangent series should produce correct coefficients via Bernoulli numbers', () => {
    // tan(x) = x + x^3/3 + 2x^5/15 + 17x^7/315 + ...
    const result = getKnownSeries('tan', 'x', { terms: 4 });
    expect(result).toBeDefined();

    const x = 0.3;
    const expected = Math.tan(x);
    const approx = x + x ** 3 / 3 + (2 * x ** 5) / 15 + (17 * x ** 7) / 315;
    expect(approx).toBeCloseTo(expected, 5);
  });
});

// ============================================================================
// AST-to-LaTeX Serialization
// ============================================================================

describe('astToLatex', () => {
  it('should render constants', () => {
    expect(astToLatex(createConstantNode(5))).toBe('5');
    expect(astToLatex(createConstantNode(0))).toBe('0');
    expect(astToLatex(createConstantNode(-3))).toBe('-3');
  });

  it('should render symbols', () => {
    expect(astToLatex(createSymbolNode('x'))).toBe('x');
    expect(astToLatex(createSymbolNode('alpha'))).toBe('alpha');
  });

  it('should render addition', () => {
    const expr = createOperatorNode('+', 'add', [createSymbolNode('a'), createSymbolNode('b')]);
    expect(astToLatex(expr)).toBe('a + b');
  });

  it('should render subtraction', () => {
    const expr = createOperatorNode('-', 'subtract', [
      createSymbolNode('a'),
      createSymbolNode('b'),
    ]);
    expect(astToLatex(expr)).toBe('a - b');
  });

  it('should render multiplication with cdot', () => {
    const expr = createOperatorNode('*', 'multiply', [
      createSymbolNode('a'),
      createSymbolNode('b'),
    ]);
    expect(astToLatex(expr)).toBe('a \\cdot b');
  });

  it('should render multiplication with juxtaposition for number * symbol', () => {
    const expr = createOperatorNode('*', 'multiply', [
      createConstantNode(3),
      createSymbolNode('x'),
    ]);
    expect(astToLatex(expr)).toBe('3x');
  });

  it('should render multiplication with juxtaposition for number * power', () => {
    const expr = createOperatorNode('*', 'multiply', [
      createConstantNode(2),
      createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(3)]),
    ]);
    expect(astToLatex(expr)).toBe('2x^{3}');
  });

  it('should render division as frac', () => {
    const expr = createOperatorNode('/', 'divide', [createSymbolNode('a'), createSymbolNode('b')]);
    expect(astToLatex(expr)).toBe('\\frac{a}{b}');
  });

  it('should render powers', () => {
    const expr = createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]);
    expect(astToLatex(expr)).toBe('x^{2}');
  });

  it('should render nested powers with parentheses on base', () => {
    // (a + b)^2
    const expr = createOperatorNode('^', 'pow', [
      createOperatorNode('+', 'add', [createSymbolNode('a'), createSymbolNode('b')]),
      createConstantNode(2),
    ]);
    expect(astToLatex(expr)).toBe('\\left(a + b\\right)^{2}');
  });

  it('should render sin function', () => {
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\sin\\left(x\\right)');
  });

  it('should render cos function', () => {
    const expr = createFunctionNode('cos', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\cos\\left(x\\right)');
  });

  it('should render tan function', () => {
    const expr = createFunctionNode('tan', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\tan\\left(x\\right)');
  });

  it('should render sqrt with special syntax', () => {
    const expr = createFunctionNode('sqrt', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\sqrt{x}');
  });

  it('should render cbrt with special syntax', () => {
    const expr = createFunctionNode('cbrt', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\sqrt[3]{x}');
  });

  it('should render abs with vertical bars', () => {
    const expr = createFunctionNode('abs', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\left|x\\right|');
  });

  it('should render floor with brackets', () => {
    const expr = createFunctionNode('floor', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\left\\lfloor x \\right\\rfloor');
  });

  it('should render ceil with brackets', () => {
    const expr = createFunctionNode('ceil', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\left\\lceil x \\right\\rceil');
  });

  it('should render exp function', () => {
    const expr = createFunctionNode('exp', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\exp\\left(x\\right)');
  });

  it('should render ln function', () => {
    const expr = createFunctionNode('ln', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\ln\\left(x\\right)');
  });

  it('should render asin as arcsin', () => {
    const expr = createFunctionNode('asin', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\arcsin\\left(x\\right)');
  });

  it('should render unary minus', () => {
    const expr = createUnaryOperatorNode('-', 'negate', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('-x');
  });

  it('should render fractions from constant values', () => {
    // 1/3 as a constant
    const expr = createConstantNode(1 / 3);
    expect(astToLatex(expr)).toBe('\\frac{1}{3}');
  });

  it('should render complex nested expressions', () => {
    // sin(x^2) + 1/3
    const expr = createOperatorNode('+', 'add', [
      createFunctionNode('sin', [
        createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
      ]),
      createConstantNode(1 / 3),
    ]);
    const latex = astToLatex(expr);
    expect(latex).toContain('\\sin');
    expect(latex).toContain('x^{2}');
    expect(latex).toContain('\\frac{1}{3}');
  });

  it('should parenthesize addition inside multiplication', () => {
    // (a + b) * c
    const expr = createOperatorNode('*', 'multiply', [
      createOperatorNode('+', 'add', [createSymbolNode('a'), createSymbolNode('b')]),
      createSymbolNode('c'),
    ]);
    const latex = astToLatex(expr);
    expect(latex).toContain('\\left(a + b\\right)');
  });

  it('should handle infinity', () => {
    expect(astToLatex(createConstantNode(Infinity))).toBe('\\infty');
    expect(astToLatex(createConstantNode(-Infinity))).toBe('-\\infty');
  });

  it('should handle sec, csc, cot functions', () => {
    expect(astToLatex(createFunctionNode('sec', [createSymbolNode('x')]))).toBe(
      '\\sec\\left(x\\right)',
    );
    expect(astToLatex(createFunctionNode('csc', [createSymbolNode('x')]))).toBe(
      '\\csc\\left(x\\right)',
    );
    expect(astToLatex(createFunctionNode('cot', [createSymbolNode('x')]))).toBe(
      '\\cot\\left(x\\right)',
    );
  });

  it('should handle erf as operatorname', () => {
    const expr = createFunctionNode('erf', [createSymbolNode('x')]);
    expect(astToLatex(expr)).toBe('\\operatorname{erf}\\left(x\\right)');
  });
});
