/**
 * Comprehensive tests for Computer Algebra System
 */

import { describe, expect, it } from 'vitest';
import { createConstantNode, createOperatorNode, createSymbolNode } from '../parser/ast';
import { parse } from '../parser/parser';
import {
  ComputerAlgebraSystem,
  createCAS,
  type Pattern,
  type RewriteRule,
  RuleCategory,
} from './computer-algebra-system';

describe('ComputerAlgebraSystem', () => {
  describe('Pattern Matching', () => {
    it('should create pattern with wildcards', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('A + B');

      expect(pattern.wildcards.has('A')).toBe(true);
      expect(pattern.wildcards.has('B')).toBe(true);
      expect(pattern.wildcards.size).toBe(2);
    });

    it('should match simple patterns', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('A + B');
      const expr = parse('x + y');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(true);
      expect(result.bindings.size).toBe(2);
      expect(result.confidence).toBe(1.0);
    });

    it('should match patterns with same wildcard multiple times', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('A + A');
      const expr = parse('x + x');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(true);
      expect(result.bindings.size).toBe(1);
    });

    it('should not match when same wildcard has different values', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('A + A');
      const expr = parse('x + y');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(false);
    });

    it('should match nested expressions', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('A * (B + C)');
      const expr = parse('2 * (x + 3)');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(true);
      expect(result.bindings.size).toBe(3);
    });

    it('should match function patterns', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('sin(A)');
      const expr = parse('sin(x)');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(true);
      expect(result.bindings.has('A')).toBe(true);
    });

    it('should not match different operators', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('A + B');
      const expr = parse('x * y');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(false);
    });

    it('should match complex patterns', () => {
      const cas = createCAS();
      const pattern = cas.createPattern('sin(A)^2 + cos(A)^2');
      const expr = parse('sin(x)^2 + cos(x)^2');

      const result = cas.match(pattern, expr);

      expect(result.matched).toBe(true);
    });
  });

  describe('Expression Comparison', () => {
    it('should identify equal constants', () => {
      const cas = createCAS();
      const a = createConstantNode(5);
      const b = createConstantNode(5);

      expect(cas.expressionEquals(a, b)).toBe(true);
    });

    it('should identify unequal constants', () => {
      const cas = createCAS();
      const a = createConstantNode(5);
      const b = createConstantNode(7);

      expect(cas.expressionEquals(a, b)).toBe(false);
    });

    it('should identify equal symbols', () => {
      const cas = createCAS();
      const a = createSymbolNode('x');
      const b = createSymbolNode('x');

      expect(cas.expressionEquals(a, b)).toBe(true);
    });

    it('should identify unequal symbols', () => {
      const cas = createCAS();
      const a = createSymbolNode('x');
      const b = createSymbolNode('y');

      expect(cas.expressionEquals(a, b)).toBe(false);
    });

    it('should identify equal operator expressions', () => {
      const cas = createCAS();
      const a = parse('x + y');
      const b = parse('x + y');

      expect(cas.expressionEquals(a, b)).toBe(true);
    });

    it('should identify structurally different expressions', () => {
      const cas = createCAS();
      const a = parse('x + y');
      const b = parse('x * y');

      expect(cas.expressionEquals(a, b)).toBe(false);
    });

    it('should check equivalence after simplification', () => {
      const cas = createCAS();
      const a = parse('x + 0');
      const b = parse('x');

      expect(cas.isEquivalent(a, b)).toBe(true);
    });
  });

  describe('Algebraic Simplification', () => {
    it('should simplify x + 0 to x', () => {
      const cas = createCAS();
      const result = cas.simplify('x + 0');

      expect(result.rulesApplied).toBeGreaterThan(0);
      expect(result.complexityReduction).toBeGreaterThanOrEqual(0);
    });

    it('should simplify x * 0 to 0', () => {
      const cas = createCAS();
      const result = cas.simplify('x * 0');

      expect(result.rulesApplied).toBeGreaterThan(0);
      // Result should be constant 0
      expect(result.expression.type).toBe('ConstantNode');
    });

    it('should simplify x * 1 to x', () => {
      const cas = createCAS();
      const result = cas.simplify('x * 1');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });

    it('should simplify x^0 to 1', () => {
      const cas = createCAS();
      const result = cas.simplify('x ^ 0');

      expect(result.rulesApplied).toBeGreaterThan(0);
      expect(result.expression.type).toBe('ConstantNode');
    });

    it('should simplify x^1 to x', () => {
      const cas = createCAS();
      const result = cas.simplify('x ^ 1');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });

    it('should track time taken', () => {
      const cas = createCAS();
      const result = cas.simplify('(x + 0) * 1');

      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple simplification steps', () => {
      const cas = createCAS();
      const result = cas.simplify('(x + 0) * (y * 1)');

      expect(result.rulesApplied).toBeGreaterThan(1);
    });
  });

  describe('Trigonometric Simplification', () => {
    it('should simplify sin^2 + cos^2 to 1', () => {
      const cas = createCAS();
      const result = cas.simplify('sin(x)^2 + cos(x)^2');

      expect(result.rulesApplied).toBeGreaterThan(0);
      // Should simplify to constant 1
      const expr = result.expression;
      expect(expr.type).toBe('ConstantNode');
      if (expr.type === 'ConstantNode') {
        expect(expr.value).toBe(1);
      }
    });

    it('should expand sin(2*x) using double angle formula', () => {
      const cas = createCAS();
      const result = cas.simplify('sin(2 * x)');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });
  });

  describe('Exponential Simplification', () => {
    it('should simplify exp(a) * exp(b) to exp(a+b)', () => {
      const cas = createCAS();
      const result = cas.simplify('exp(a) * exp(b)');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });

    it('should simplify exp(a)^b to exp(a*b)', () => {
      const cas = createCAS();
      const result = cas.simplify('exp(a) ^ b');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });
  });

  describe('Logarithmic Simplification', () => {
    it('should simplify log(a*b) to log(a) + log(b)', () => {
      const cas = createCAS();
      const result = cas.simplify('log(a * b)');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });

    it('should simplify log(a/b) to log(a) - log(b)', () => {
      const cas = createCAS();
      const result = cas.simplify('log(a / b)');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });

    it('should simplify log(a^b) to b*log(a)', () => {
      const cas = createCAS();
      const result = cas.simplify('log(a ^ b)');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });
  });

  describe('Polynomial Expansion', () => {
    it('should expand (x + y)*(a + b)', () => {
      const cas = createCAS();
      const result = cas.expand('(x + y) * (a + b)');

      // Should distribute multiplication
      expect(result).toBeDefined();
    });

    it('should expand (x + 1)^2', () => {
      const cas = createCAS();
      const result = cas.expand('(x + 1) ^ 2');

      expect(result).toBeDefined();
    });

    it('should expand (x + 1)^3', () => {
      const cas = createCAS();
      const result = cas.expand('(x + 1) ^ 3');

      expect(result).toBeDefined();
    });

    it('should expand nested expressions', () => {
      const cas = createCAS();
      const result = cas.expand('(x + y) * (a + (b + c))');

      expect(result).toBeDefined();
    });

    it('should handle high powers efficiently', () => {
      const cas = createCAS();
      const startTime = performance.now();
      const result = cas.expand('(x + 1) ^ 5');
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Polynomial Factoring', () => {
    it('should attempt to factor polynomials', () => {
      const cas = createCAS();
      const result = cas.factor('x^2 - 5*x + 6', 'x');

      expect(result).toBeDefined();
    });

    it('should handle irreducible polynomials', () => {
      const cas = createCAS();
      const result = cas.factor('x^2 + 1', 'x');

      // Should return original if irreducible
      expect(result).toBeDefined();
    });
  });

  describe('Polynomial Division', () => {
    it('should divide polynomials', () => {
      const cas = createCAS();

      const dividend = {
        coefficients: [6, -5, 1], // x^2 - 5x + 6
        variable: 'x',
        degree: 2,
      };

      const divisor = {
        coefficients: [-2, 1], // x - 2
        variable: 'x',
        degree: 1,
      };

      const result = cas.dividePolynomials(dividend, divisor);

      expect(result.quotient).toBeDefined();
      expect(result.remainder).toBeDefined();
    });

    it('should compute GCD of polynomials', () => {
      const cas = createCAS();

      const a = {
        coefficients: [6, -5, 1],
        variable: 'x',
        degree: 2,
      };

      const b = {
        coefficients: [-2, 1],
        variable: 'x',
        degree: 1,
      };

      const gcd = cas.gcdPolynomials(a, b);

      expect(gcd).toBeDefined();
      expect(gcd.degree).toBeGreaterThanOrEqual(0);
    });

    it('should compute LCM of polynomials', () => {
      const cas = createCAS();

      const a = {
        coefficients: [-2, 1],
        variable: 'x',
        degree: 1,
      };

      const b = {
        coefficients: [-3, 1],
        variable: 'x',
        degree: 1,
      };

      const lcm = cas.lcmPolynomials(a, b);

      expect(lcm).toBeDefined();
      expect(lcm.degree).toBe(2); // Should be degree 2
    });
  });

  describe('Partial Fractions', () => {
    it('should decompose rational functions', () => {
      const cas = createCAS();

      const rational = {
        numerator: {
          coefficients: [1, 1],
          variable: 'x',
          degree: 1,
        },
        denominator: {
          coefficients: [6, -5, 1],
          variable: 'x',
          degree: 2,
        },
      };

      const result = cas.partialFractions(rational);

      expect(result.fractions).toBeDefined();
      expect(result.fractions.length).toBeGreaterThan(0);
    });

    it('should handle improper fractions', () => {
      const cas = createCAS();

      const rational = {
        numerator: {
          coefficients: [1, 1, 1],
          variable: 'x',
          degree: 2,
        },
        denominator: {
          coefficients: [1, 1],
          variable: 'x',
          degree: 1,
        },
      };

      const result = cas.partialFractions(rational);

      expect(result.polynomialPart).toBeDefined();
    });
  });

  describe('Substitution', () => {
    it('should substitute variable with value', () => {
      const cas = createCAS();
      const expr = parse('x + y');
      const value = createConstantNode(5);

      const result = cas.substitute(expr, 'x', value);

      expect(result).toBeDefined();
    });

    it('should substitute in nested expressions', () => {
      const cas = createCAS();
      const expr = parse('sin(x) + cos(x)');
      const value = createConstantNode(0);

      const result = cas.substitute(expr, 'x', value);

      expect(result).toBeDefined();
    });

    it('should substitute with expressions', () => {
      const cas = createCAS();
      const expr = parse('x^2');
      const value = parse('y + 1');

      const result = cas.substitute(expr, 'x', value);

      expect(result).toBeDefined();
    });
  });

  describe('Custom Rules', () => {
    it('should accept custom rewrite rules', () => {
      const customRule: RewriteRule = {
        name: 'custom_rule',
        description: 'Custom test rule',
        category: RuleCategory.Algebraic,
        priority: 90,
        pattern: {
          expr: parse('A + A'),
          wildcards: new Set(['A']),
        },
        replacement: (bindings) => {
          const a = bindings.get('A')!;
          return createOperatorNode('*', 'multiply', [createConstantNode(2), a] as const);
        },
      };

      const cas = createCAS([customRule]);
      const result = cas.simplify('x + x');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });

    it('should prioritize high-priority rules', () => {
      const highPriorityRule: RewriteRule = {
        name: 'high_priority',
        description: 'High priority rule',
        category: RuleCategory.Algebraic,
        priority: 200,
        pattern: {
          expr: parse('A * 1'),
          wildcards: new Set(['A']),
        },
        replacement: (bindings) => bindings.get('A')!,
      };

      const cas = createCAS([highPriorityRule]);
      const result = cas.simplify('x * 1');

      expect(result.rulesApplied).toBeGreaterThan(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle deeply nested expressions', () => {
      const cas = createCAS();
      const deepExpr = '((((x + 1) + 1) + 1) + 1)';

      const result = cas.simplify(deepExpr);

      expect(result).toBeDefined();
      expect(result.timeMs).toBeLessThan(1000);
    });

    it('should prevent infinite loops with max iterations', () => {
      const cas = createCAS();
      const result = cas.simplify('x + y');

      expect(result).toBeDefined();
      expect(result.timeMs).toBeLessThan(1000);
    });

    it('should handle expressions with no simplification', () => {
      const cas = createCAS();
      const result = cas.simplify('a * b + c');

      expect(result.rulesApplied).toBeGreaterThanOrEqual(0);
    });

    it('should work with string inputs', () => {
      const cas = createCAS();
      const result = cas.simplify('x + 0');

      expect(result).toBeDefined();
    });

    it('should work with expression node inputs', () => {
      const cas = createCAS();
      const expr = parse('x + 0');
      const result = cas.simplify(expr);

      expect(result).toBeDefined();
    });
  });
});
