/**
 * Tests for limit computation engine
 */

import { describe, it, expect } from 'vitest';
import { limit, type LimitConfig } from './limits';
import { createConstantNode, createSymbolNode, createOperatorNode, createFunctionNode } from '../parser/ast';

describe('Limits - Direct Substitution', () => {
  it('should compute simple polynomial limit', () => {
    // lim (x→2) x^2 = 4
    const expr = createOperatorNode('^', 'pow', [
      createSymbolNode('x'),
      createConstantNode(2),
    ]);

    const result = limit(expr, 'x', { point: 2 });

    expect(result.value).toBe(4);
    expect(result.exists).toBe(true);
    expect(result.method).toBe('direct');
  });

  it('should compute limit of constant', () => {
    // lim (x→5) 42 = 42
    const expr = createConstantNode(42);
    const result = limit(expr, 'x', { point: 5 });

    expect(result.value).toBe(42);
    expect(result.exists).toBe(true);
    expect(result.method).toBe('direct');
  });

  it('should compute limit of linear function', () => {
    // lim (x→3) 2x + 1 = 7
    const expr = createOperatorNode('+', 'add', [
      createOperatorNode('*', 'multiply', [
        createConstantNode(2),
        createSymbolNode('x'),
      ]),
      createConstantNode(1),
    ]);

    const result = limit(expr, 'x', { point: 3 });

    expect(result.value).toBe(7);
    expect(result.exists).toBe(true);
  });
});

describe('Limits - Known Patterns', () => {
  it('should recognize sin(x)/x → 1 as x → 0', () => {
    // lim (x→0) sin(x)/x = 1
    const expr = createOperatorNode('/', 'divide', [
      createFunctionNode('sin', [createSymbolNode('x')]),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: 0 });

    expect(result.value).toBe(1);
    expect(result.exists).toBe(true);
    expect(result.method).toBe('pattern');
  });

  it('should recognize (1-cos(x))/x → 0 as x → 0', () => {
    // lim (x→0) (1-cos(x))/x = 0
    const expr = createOperatorNode('/', 'divide', [
      createOperatorNode('-', 'subtract', [
        createConstantNode(1),
        createFunctionNode('cos', [createSymbolNode('x')]),
      ]),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: 0 });

    expect(result.value).toBe(0);
    expect(result.exists).toBe(true);
    expect(result.method).toBe('pattern');
  });

  it('should recognize tan(x)/x → 1 as x → 0', () => {
    // lim (x→0) tan(x)/x = 1
    const expr = createOperatorNode('/', 'divide', [
      createFunctionNode('tan', [createSymbolNode('x')]),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: 0 });

    expect(result.value).toBe(1);
    expect(result.exists).toBe(true);
    expect(result.method).toBe('pattern');
  });

  it('should recognize (1+1/x)^x → e as x → ∞', () => {
    // lim (x→∞) (1 + 1/x)^x = e
    const expr = createOperatorNode('^', 'pow', [
      createOperatorNode('+', 'add', [
        createConstantNode(1),
        createOperatorNode('/', 'divide', [
          createConstantNode(1),
          createSymbolNode('x'),
        ]),
      ]),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: 'infinity' });

    expect(result.value).toBeCloseTo(Math.E, 5);
    expect(result.exists).toBe(true);
    expect(result.method).toBe('pattern');
  });
});

describe('Limits - L\'Hôpital\'s Rule', () => {
  it('should apply L\'Hôpital for x/sin(x) as x → 0', () => {
    // lim (x→0) x/sin(x) = 1
    // This is 0/0, so L'Hôpital applies: 1/cos(x) → 1
    const expr = createOperatorNode('/', 'divide', [
      createSymbolNode('x'),
      createFunctionNode('sin', [createSymbolNode('x')]),
    ]);

    const result = limit(expr, 'x', { point: 0, includeSteps: true });

    expect(result.value).toBeCloseTo(1, 5);
    expect(result.exists).toBe(true);
  });

  it('should handle x²/(1-cos(x)) with multiple L\'Hôpital applications', () => {
    // lim (x→0) x²/(1-cos(x)) = 2
    // First L'Hôpital: 2x/sin(x) (still 0/0)
    // Second L'Hôpital: 2/cos(x) → 2
    const expr = createOperatorNode('/', 'divide', [
      createOperatorNode('^', 'pow', [
        createSymbolNode('x'),
        createConstantNode(2),
      ]),
      createOperatorNode('-', 'subtract', [
        createConstantNode(1),
        createFunctionNode('cos', [createSymbolNode('x')]),
      ]),
    ]);

    const result = limit(expr, 'x', { point: 0 });

    expect(typeof result.value).toBe('number');
    expect(result.exists).toBe(true);
  });
});

describe('Limits - At Infinity', () => {
  it('should compute limit of 1/x as x → ∞', () => {
    // lim (x→∞) 1/x = 0
    const expr = createOperatorNode('/', 'divide', [
      createConstantNode(1),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: 'infinity' });

    expect(result.value).toBeCloseTo(0, 5);
    expect(result.exists).toBe(true);
  });

  it('should compute limit of polynomial as x → ∞', () => {
    // lim (x→∞) x² → ∞
    const expr = createOperatorNode('^', 'pow', [
      createSymbolNode('x'),
      createConstantNode(2),
    ]);

    const result = limit(expr, 'x', { point: 'infinity' });

    expect(result.value).toBe('infinity');
    expect(result.exists).toBe(true);
  });

  it('should compute limit at negative infinity', () => {
    // lim (x→-∞) 1/x = 0
    const expr = createOperatorNode('/', 'divide', [
      createConstantNode(1),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: '-infinity' });

    expect(result.value).toBeCloseTo(0, 5);
    expect(result.exists).toBe(true);
  });
});

describe('Limits - One-sided Limits', () => {
  it('should compute left-hand limit', () => {
    // Simple case: lim (x→2⁻) x = 2
    const expr = createSymbolNode('x');
    const result = limit(expr, 'x', { point: 2, direction: 'left' });

    expect(result.value).toBeCloseTo(2, 5);
    expect(result.exists).toBe(true);
  });

  it('should compute right-hand limit', () => {
    // Simple case: lim (x→2⁺) x = 2
    const expr = createSymbolNode('x');
    const result = limit(expr, 'x', { point: 2, direction: 'right' });

    expect(result.value).toBeCloseTo(2, 5);
    expect(result.exists).toBe(true);
  });
});

describe('Limits - Trigonometric Functions', () => {
  it('should compute limit of sin(x) as x → 0', () => {
    // lim (x→0) sin(x) = 0
    const expr = createFunctionNode('sin', [createSymbolNode('x')]);
    const result = limit(expr, 'x', { point: 0 });

    expect(result.value).toBeCloseTo(0, 5);
    expect(result.exists).toBe(true);
  });

  it('should compute limit of cos(x) as x → 0', () => {
    // lim (x→0) cos(x) = 1
    const expr = createFunctionNode('cos', [createSymbolNode('x')]);
    const result = limit(expr, 'x', { point: 0 });

    expect(result.value).toBeCloseTo(1, 5);
    expect(result.exists).toBe(true);
  });
});

describe('Limits - Edge Cases', () => {
  it('should handle division by zero limit', () => {
    // lim (x→0) 1/x (from both sides - undefined)
    const expr = createOperatorNode('/', 'divide', [
      createConstantNode(1),
      createSymbolNode('x'),
    ]);

    const result = limit(expr, 'x', { point: 0 });

    // Left and right limits differ (∞ and -∞), so limit DNE
    expect(['undefined', 'DNE', 'infinity', '-infinity']).toContain(result.value);
  });

  it('should provide steps when requested', () => {
    const expr = createOperatorNode('+', 'add', [
      createSymbolNode('x'),
      createConstantNode(1),
    ]);

    const result = limit(expr, 'x', { point: 2, includeSteps: true });

    expect(result.steps).toBeDefined();
    expect(result.steps!.length).toBeGreaterThan(0);
  });
});
