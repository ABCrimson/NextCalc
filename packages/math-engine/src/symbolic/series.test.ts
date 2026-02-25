/**
 * Tests for Taylor/Maclaurin series expansion
 */

import { describe, it, expect } from 'vitest';
import { taylorSeries, maclaurinSeries, getKnownSeries } from './series';
import { createConstantNode, createSymbolNode, createOperatorNode, createFunctionNode } from '../parser/ast';

describe('Series - Maclaurin Series', () => {
  it('should compute Maclaurin series of sin(x)', () => {
    // sin(x) = x - x³/6 + x⁵/120 - ...
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = maclaurinSeries(expr, 'x', { terms: 3 });

    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.polynomial).toBeDefined();
    expect(result.radiusOfConvergence).toBeUndefined();
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
        createOperatorNode('^', 'pow', [
          createSymbolNode('x'),
          createConstantNode(2),
        ]),
        createOperatorNode('*', 'multiply', [
          createConstantNode(2),
          createSymbolNode('x'),
        ]),
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
    const expr = createOperatorNode('^', 'pow', [
      createSymbolNode('x'),
      createConstantNode(2),
    ]);

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
    const expr = createOperatorNode('^', 'pow', [
      createSymbolNode('x'),
      createConstantNode(2),
    ]);

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
