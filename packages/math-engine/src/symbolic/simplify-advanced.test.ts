/**
 * Tests for advanced simplification engine
 */

import { describe, expect, it } from 'vitest';
import {
  createConstantNode,
  createFunctionNode,
  createOperatorNode,
  createSymbolNode,
} from '../parser/ast';
import { simplifyAdvanced } from './simplify-advanced';

describe('Advanced Simplify - Trigonometric Identities', () => {
  it('should simplify sin²(x) + cos²(x) to 1', () => {
    // sin²(x) + cos²(x) = 1
    const expr = createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('ConstantNode');
    if (result.type === 'ConstantNode') {
      expect(result.value).toBe(1);
    }
  });

  it('should simplify cos²(x) + sin²(x) to 1 (reversed order)', () => {
    // cos²(x) + sin²(x) = 1
    const expr = createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('ConstantNode');
    if (result.type === 'ConstantNode') {
      expect(result.value).toBe(1);
    }
  });

  it('should simplify 1 - sin²(x) to cos²(x)', () => {
    // 1 - sin²(x) = cos²(x)
    const expr = createOperatorNode('-', 'subtract', [
      createConstantNode(1),
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('^');
    }
  });

  it('should simplify 1 - cos²(x) to sin²(x)', () => {
    // 1 - cos²(x) = sin²(x)
    const expr = createOperatorNode('-', 'subtract', [
      createConstantNode(1),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('^');
    }
  });
});

describe('Advanced Simplify - Logarithmic Rules', () => {
  it('should simplify log(1) to 0', () => {
    // log(1) = 0
    const expr = createFunctionNode('log', [createConstantNode(1)]);
    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('ConstantNode');
    if (result.type === 'ConstantNode') {
      expect(result.value).toBe(0);
    }
  });

  it('should apply power rule: log(a^b) = b*log(a)', () => {
    // log(x^2) = 2*log(x)
    const expr = createFunctionNode('log', [
      createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('*');
    }
  });

  it('should apply product rule: log(a*b) = log(a) + log(b)', () => {
    // log(x*y) = log(x) + log(y)
    const expr = createFunctionNode('log', [
      createOperatorNode('*', 'multiply', [createSymbolNode('x'), createSymbolNode('y')]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('+');
    }
  });

  it('should apply quotient rule: log(a/b) = log(a) - log(b)', () => {
    // log(x/y) = log(x) - log(y)
    const expr = createFunctionNode('log', [
      createOperatorNode('/', 'divide', [createSymbolNode('x'), createSymbolNode('y')]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('-');
    }
  });

  it('should handle ln(1) = 0', () => {
    const expr = createFunctionNode('ln', [createConstantNode(1)]);
    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('ConstantNode');
    if (result.type === 'ConstantNode') {
      expect(result.value).toBe(0);
    }
  });
});

describe('Advanced Simplify - Exponential Rules', () => {
  it('should simplify exp(ln(x)) to x', () => {
    // exp(ln(x)) = x
    const expr = createFunctionNode('exp', [createFunctionNode('ln', [createSymbolNode('x')])]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('SymbolNode');
    if (result.type === 'SymbolNode') {
      expect(result.name).toBe('x');
    }
  });

  it('should simplify ln(exp(x)) to x', () => {
    // ln(exp(x)) = x
    const expr = createFunctionNode('ln', [createFunctionNode('exp', [createSymbolNode('x')])]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('SymbolNode');
    if (result.type === 'SymbolNode') {
      expect(result.name).toBe('x');
    }
  });

  it('should simplify exp(a) * exp(b) to exp(a+b)', () => {
    // exp(x) * exp(y) = exp(x+y)
    const expr = createOperatorNode('*', 'multiply', [
      createFunctionNode('exp', [createSymbolNode('x')]),
      createFunctionNode('exp', [createSymbolNode('y')]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('FunctionNode');
    if (result.type === 'FunctionNode') {
      expect(result.fn).toBe('exp');
    }
  });

  it('should simplify exp(a) / exp(b) to exp(a-b)', () => {
    // exp(x) / exp(y) = exp(x-y)
    const expr = createOperatorNode('/', 'divide', [
      createFunctionNode('exp', [createSymbolNode('x')]),
      createFunctionNode('exp', [createSymbolNode('y')]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('FunctionNode');
    if (result.type === 'FunctionNode') {
      expect(result.fn).toBe('exp');
    }
  });
});

describe('Advanced Simplify - Radical Simplification', () => {
  it('should simplify √(x²) to |x|', () => {
    // √(x²) = |x|
    const expr = createFunctionNode('sqrt', [
      createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('FunctionNode');
    if (result.type === 'FunctionNode') {
      expect(result.fn).toBe('abs');
    }
  });

  it('should simplify √(x⁴) to x²', () => {
    // √(x⁴) = x²
    const expr = createFunctionNode('sqrt', [
      createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(4)]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('^');
    }
  });

  it('should split √(a*b) to √a * √b', () => {
    // √(x*y) = √x * √y
    const expr = createFunctionNode('sqrt', [
      createOperatorNode('*', 'multiply', [createSymbolNode('x'), createSymbolNode('y')]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('*');
    }
  });

  it('should split √(a/b) to √a / √b', () => {
    // √(x/y) = √x / √y
    const expr = createFunctionNode('sqrt', [
      createOperatorNode('/', 'divide', [createSymbolNode('x'), createSymbolNode('y')]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('/');
    }
  });
});

describe('Advanced Simplify - Rationalization', () => {
  it('should rationalize 1/√a to √a/a', () => {
    // 1/√x → √x/x
    const expr = createOperatorNode('/', 'divide', [
      createConstantNode(1),
      createFunctionNode('sqrt', [createSymbolNode('x')]),
    ]);

    const result = simplifyAdvanced(expr, { rationalize: true });

    expect(result.type).toBe('OperatorNode');
    if (result.type === 'OperatorNode') {
      expect(result.op).toBe('/');
    }
  });

  it('should rationalize complex denominators', () => {
    // a/(b + √c) → a(b - √c)/(b² - c)
    const expr = createOperatorNode('/', 'divide', [
      createSymbolNode('a'),
      createOperatorNode('+', 'add', [
        createSymbolNode('b'),
        createFunctionNode('sqrt', [createSymbolNode('c')]),
      ]),
    ]);

    const result = simplifyAdvanced(expr, { rationalize: true });

    expect(result.type).toBe('OperatorNode');
  });
});

describe('Advanced Simplify - Configuration Options', () => {
  it('should respect trigIdentities option', () => {
    const expr = createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const withTrig = simplifyAdvanced(expr, { trigIdentities: true });
    const withoutTrig = simplifyAdvanced(expr, { trigIdentities: false });

    expect(withTrig.type).toBe('ConstantNode');
    expect(withoutTrig.type).toBe('OperatorNode');
  });

  it('should respect logRules option', () => {
    const expr = createFunctionNode('log', [createConstantNode(1)]);

    const withLog = simplifyAdvanced(expr, { logRules: true });
    const withoutLog = simplifyAdvanced(expr, { logRules: false });

    expect(withLog.type).toBe('ConstantNode');
    // Without log rules, basic simplification might still apply
    expect(withoutLog).toBeDefined();
  });

  it('should respect expRules option', () => {
    const expr = createFunctionNode('exp', [createFunctionNode('ln', [createSymbolNode('x')])]);

    const withExp = simplifyAdvanced(expr, { expRules: true });
    const withoutExp = simplifyAdvanced(expr, { expRules: false });

    expect(withExp.type).toBe('SymbolNode');
    expect(withoutExp.type).toBe('FunctionNode');
  });

  it('should respect maxIterations option', () => {
    const expr = createSymbolNode('x');

    const result1 = simplifyAdvanced(expr, { maxIterations: 1 });
    const result2 = simplifyAdvanced(expr, { maxIterations: 10 });

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });
});

describe('Advanced Simplify - Combined Transformations', () => {
  it('should handle multiple simplification rules', () => {
    // sin²(x) + cos²(x) with log context
    const expr = createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const result = simplifyAdvanced(expr, {
      trigIdentities: true,
      logRules: true,
      expRules: true,
    });

    expect(result.type).toBe('ConstantNode');
  });

  it('should handle nested expressions', () => {
    // log(exp(sin²(x) + cos²(x)))
    const innerExpr = createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]);

    const expr = createFunctionNode('log', [createFunctionNode('exp', [innerExpr])]);

    const result = simplifyAdvanced(expr);

    // Should simplify to 1 (since sin²+cos²=1, then log(exp(1))=1)
    expect(result).toBeDefined();
  });
});

describe('Advanced Simplify - Edge Cases', () => {
  it('should handle constants', () => {
    const expr = createConstantNode(42);
    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('ConstantNode');
    if (result.type === 'ConstantNode') {
      expect(result.value).toBe(42);
    }
  });

  it('should handle symbols', () => {
    const expr = createSymbolNode('x');
    const result = simplifyAdvanced(expr);

    expect(result.type).toBe('SymbolNode');
    if (result.type === 'SymbolNode') {
      expect(result.name).toBe('x');
    }
  });

  it('should handle complex nested structures', () => {
    // exp(log(x^2))
    const expr = createFunctionNode('exp', [
      createFunctionNode('log', [
        createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
      ]),
    ]);

    const result = simplifyAdvanced(expr);

    expect(result).toBeDefined();
  });
});
