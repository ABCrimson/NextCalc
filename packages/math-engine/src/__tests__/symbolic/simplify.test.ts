import { describe, expect, it } from 'vitest';
import {
  simplify,
  expand,
  factor,
  substitute,
  astEquals,
  isExpanded,
  isFactored,
} from '../../symbolic/simplify';
import {
  createConstantNode,
  createSymbolNode,
  createOperatorNode,
  createFunctionNode,
  createUnaryOperatorNode,
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isFunctionNode,
  type ExpressionNode,
  type ConstantNode,
} from '../../parser/ast';

// ============================================================================
// Helper to build AST nodes concisely
// ============================================================================

const num = (n: number) => createConstantNode(n);
const sym = (name: string) => createSymbolNode(name);
const add = (l: ExpressionNode, r: ExpressionNode) =>
  createOperatorNode('+', 'add', [l, r] as const);
const sub = (l: ExpressionNode, r: ExpressionNode) =>
  createOperatorNode('-', 'subtract', [l, r] as const);
const mul = (l: ExpressionNode, r: ExpressionNode) =>
  createOperatorNode('*', 'multiply', [l, r] as const);
const div = (l: ExpressionNode, r: ExpressionNode) =>
  createOperatorNode('/', 'divide', [l, r] as const);
const pow = (l: ExpressionNode, r: ExpressionNode) =>
  createOperatorNode('^', 'pow', [l, r] as const);
const mod = (l: ExpressionNode, r: ExpressionNode) =>
  createOperatorNode('%', 'modulo', [l, r] as const);
const neg = (e: ExpressionNode) => createUnaryOperatorNode('-', 'unaryMinus', [e] as const);
const pos = (e: ExpressionNode) => createUnaryOperatorNode('+', 'unaryPlus', [e] as const);
const fn = (name: Parameters<typeof createFunctionNode>[0], ...args: ExpressionNode[]) =>
  createFunctionNode(name, args);

function getNumericValue(node: ExpressionNode): number | null {
  if (!isConstantNode(node)) return null;
  const value = (node as ConstantNode).value;
  if (typeof value === 'number') return value;
  return null;
}

// ============================================================================
// astEquals
// ============================================================================

describe('astEquals', () => {
  it('considers identical constants equal', () => {
    expect(astEquals(num(5), num(5))).toBe(true);
  });

  it('considers different constants unequal', () => {
    expect(astEquals(num(5), num(3))).toBe(false);
  });

  it('considers identical symbols equal', () => {
    expect(astEquals(sym('x'), sym('x'))).toBe(true);
  });

  it('considers different symbols unequal', () => {
    expect(astEquals(sym('x'), sym('y'))).toBe(false);
  });

  it('considers identical operators equal', () => {
    expect(astEquals(add(sym('x'), num(1)), add(sym('x'), num(1)))).toBe(true);
  });

  it('considers different operators unequal', () => {
    expect(astEquals(add(sym('x'), num(1)), sub(sym('x'), num(1)))).toBe(false);
  });

  it('considers identical function nodes equal', () => {
    expect(astEquals(fn('sin', sym('x')), fn('sin', sym('x')))).toBe(true);
  });

  it('considers different function nodes unequal', () => {
    expect(astEquals(fn('sin', sym('x')), fn('cos', sym('x')))).toBe(false);
  });

  it('considers constant and symbol unequal', () => {
    expect(astEquals(num(1), sym('x'))).toBe(false);
  });
});

// ============================================================================
// Constant Folding
// ============================================================================

describe('Constant Folding', () => {
  it('folds 2 + 3 to 5', () => {
    const result = simplify(add(num(2), num(3)));
    expect(getNumericValue(result)).toBe(5);
  });

  it('folds 5 - 3 to 2', () => {
    const result = simplify(sub(num(5), num(3)));
    expect(getNumericValue(result)).toBe(2);
  });

  it('folds 2 * 3 to 6', () => {
    const result = simplify(mul(num(2), num(3)));
    expect(getNumericValue(result)).toBe(6);
  });

  it('folds 6 / 2 to 3', () => {
    const result = simplify(div(num(6), num(2)));
    expect(getNumericValue(result)).toBe(3);
  });

  it('folds 2^3 to 8', () => {
    const result = simplify(pow(num(2), num(3)));
    expect(getNumericValue(result)).toBe(8);
  });

  it('folds 7 % 3 to 1', () => {
    const result = simplify(mod(num(7), num(3)));
    expect(getNumericValue(result)).toBe(1);
  });

  it('throws on division by zero', () => {
    expect(() => simplify(div(num(5), num(0)))).toThrow('Division by zero');
  });

  it('throws on modulo by zero', () => {
    expect(() => simplify(mod(num(5), num(0)))).toThrow('Modulo by zero');
  });
});

// ============================================================================
// Identity Rules
// ============================================================================

describe('Identity Rules - Addition', () => {
  it('simplifies x + 0 to x', () => {
    const result = simplify(add(sym('x'), num(0)));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies 0 + x to x', () => {
    const result = simplify(add(num(0), sym('x')));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });
});

describe('Identity Rules - Subtraction', () => {
  it('simplifies x - 0 to x', () => {
    const result = simplify(sub(sym('x'), num(0)));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies x - x to 0', () => {
    const result = simplify(sub(sym('x'), sym('x')));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies 0 - x to -1 * x', () => {
    const result = simplify(sub(num(0), sym('x')));
    // Should be -1 * x
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
    }
  });
});

describe('Identity Rules - Multiplication', () => {
  it('simplifies x * 1 to x', () => {
    const result = simplify(mul(sym('x'), num(1)));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies 1 * x to x', () => {
    const result = simplify(mul(num(1), sym('x')));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies x * 0 to 0', () => {
    const result = simplify(mul(sym('x'), num(0)));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies 0 * x to 0', () => {
    const result = simplify(mul(num(0), sym('x')));
    expect(getNumericValue(result)).toBe(0);
  });
});

describe('Identity Rules - Division', () => {
  it('simplifies x / 1 to x', () => {
    const result = simplify(div(sym('x'), num(1)));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies 0 / x to 0', () => {
    const result = simplify(div(num(0), sym('x')));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies x / x to 1', () => {
    const result = simplify(div(sym('x'), sym('x')));
    expect(getNumericValue(result)).toBe(1);
  });
});

// ============================================================================
// Power Rules
// ============================================================================

describe('Power Rules', () => {
  it('simplifies x^0 to 1', () => {
    const result = simplify(pow(sym('x'), num(0)));
    expect(getNumericValue(result)).toBe(1);
  });

  it('simplifies x^1 to x', () => {
    const result = simplify(pow(sym('x'), num(1)));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies 1^x to 1', () => {
    const result = simplify(pow(num(1), sym('x')));
    expect(getNumericValue(result)).toBe(1);
  });

  it('simplifies 0^5 to 0', () => {
    const result = simplify(pow(num(0), num(5)));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies (x^2)^3 to x^6 (power of power)', () => {
    const result = simplify(pow(pow(sym('x'), num(2)), num(3)));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(6);
    }
  });
});

// ============================================================================
// Combine Like Terms
// ============================================================================

describe('Combine Like Terms', () => {
  it('simplifies 2x + 3x to 5x', () => {
    const result = simplify(add(mul(num(2), sym('x')), mul(num(3), sym('x'))));
    // Result should be 5 * x
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
      expect(getNumericValue(result.args[0])).toBe(5);
    }
  });

  it('simplifies x + x to 2 * x', () => {
    // x + x: extractTerm gives coefficient=1, variable=x for both
    const result = simplify(add(sym('x'), sym('x')));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
      expect(getNumericValue(result.args[0])).toBe(2);
    }
  });

  it('simplifies 3x + (-3)x to 0', () => {
    const result = simplify(add(mul(num(3), sym('x')), mul(num(-3), sym('x'))));
    expect(getNumericValue(result)).toBe(0);
  });
});

// ============================================================================
// Combine Powers (Multiplication)
// ============================================================================

describe('Combine Powers', () => {
  it('simplifies x * x to x^2', () => {
    const result = simplify(mul(sym('x'), sym('x')));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(2);
    }
  });

  it('simplifies x^2 * x^3 to x^5', () => {
    const result = simplify(mul(pow(sym('x'), num(2)), pow(sym('x'), num(3))));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(5);
    }
  });

  it('simplifies x^2 * x to x^3', () => {
    const result = simplify(mul(pow(sym('x'), num(2)), sym('x')));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(3);
    }
  });

  it('simplifies x * x^3 to x^4', () => {
    const result = simplify(mul(sym('x'), pow(sym('x'), num(3))));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(4);
    }
  });
});

// ============================================================================
// Division Cancellation
// ============================================================================

describe('Division Cancellation', () => {
  it('simplifies x^3 / x to x^2', () => {
    const result = simplify(div(pow(sym('x'), num(3)), sym('x')));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(2);
    }
  });

  it('simplifies x^2 / x to x', () => {
    const result = simplify(div(pow(sym('x'), num(2)), sym('x')));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies x / x^2 to x^(-1)', () => {
    const result = simplify(div(sym('x'), pow(sym('x'), num(2))));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(-1);
    }
  });

  it('simplifies x^5 / x^3 to x^2', () => {
    const result = simplify(div(pow(sym('x'), num(5)), pow(sym('x'), num(3))));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('^');
      expect(getNumericValue(result.args[1])).toBe(2);
    }
  });

  it('simplifies x^3 / x^3 to 1', () => {
    // x^3 / x^3: astEquals catches this as x/x -> 1 before cancelDivision
    const result = simplify(div(pow(sym('x'), num(3)), pow(sym('x'), num(3))));
    expect(getNumericValue(result)).toBe(1);
  });
});

// ============================================================================
// Unary Operators
// ============================================================================

describe('Unary Operators', () => {
  it('folds unary minus on constant: -(3) to -3', () => {
    const result = simplify(neg(num(3)));
    expect(getNumericValue(result)).toBe(-3);
  });

  it('removes unary plus: +(x) to x', () => {
    const result = simplify(pos(sym('x')));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('folds -(-(5)) to 5', () => {
    const result = simplify(neg(neg(num(5))));
    expect(getNumericValue(result)).toBe(5);
  });
});

// ============================================================================
// Function Simplification
// ============================================================================

describe('Function Simplification', () => {
  it('simplifies sin(0) to 0', () => {
    const result = simplify(fn('sin', num(0)));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies cos(0) to 1', () => {
    const result = simplify(fn('cos', num(0)));
    expect(getNumericValue(result)).toBe(1);
  });

  it('simplifies tan(0) to 0', () => {
    const result = simplify(fn('tan', num(0)));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies log(1) to 0', () => {
    const result = simplify(fn('log', num(1)));
    expect(getNumericValue(result)).toBe(0);
  });

  it('simplifies exp(0) to 1', () => {
    const result = simplify(fn('exp', num(0)));
    expect(getNumericValue(result)).toBe(1);
  });

  it('simplifies sqrt(x^2) to abs(x)', () => {
    const result = simplify(fn('sqrt', pow(sym('x'), num(2))));
    expect(isFunctionNode(result)).toBe(true);
    if (isFunctionNode(result)) {
      expect(result.fn).toBe('abs');
    }
  });

  it('simplifies abs(-1 * x) to abs(x)', () => {
    const result = simplify(fn('abs', mul(num(-1), sym('x'))));
    expect(isFunctionNode(result)).toBe(true);
    if (isFunctionNode(result)) {
      expect(result.fn).toBe('abs');
      // Argument should be x, not -1*x
      expect(isSymbolNode(result.args[0])).toBe(true);
    }
  });

  it('preserves sin(x) without simplification', () => {
    const result = simplify(fn('sin', sym('x')));
    expect(isFunctionNode(result)).toBe(true);
    if (isFunctionNode(result)) {
      expect(result.fn).toBe('sin');
    }
  });
});

// ============================================================================
// Modulo Simplification
// ============================================================================

describe('Modulo Simplification', () => {
  it('simplifies 0 % x to 0', () => {
    const result = simplify(mod(num(0), sym('x')));
    expect(getNumericValue(result)).toBe(0);
  });
});

// ============================================================================
// Nested Simplifications
// ============================================================================

describe('Nested Simplifications', () => {
  it('simplifies (x + 0) * 1 to x', () => {
    const result = simplify(mul(add(sym('x'), num(0)), num(1)));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies (x * 1) + (y * 0) to x', () => {
    const result = simplify(add(mul(sym('x'), num(1)), mul(sym('y'), num(0))));
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });

  it('simplifies 2 + 3 * 0 to 2', () => {
    const result = simplify(add(num(2), mul(num(3), num(0))));
    expect(getNumericValue(result)).toBe(2);
  });

  it('simplifies (x^1 + 0) / 1 to x', () => {
    const result = simplify(div(add(pow(sym('x'), num(1)), num(0)), num(1)));
    expect(isSymbolNode(result)).toBe(true);
  });
});

// ============================================================================
// Expand
// ============================================================================

describe('expand', () => {
  it('expands (a + b) * c to a*c + b*c', () => {
    const expr = mul(add(sym('a'), sym('b')), sym('c'));
    const result = expand(expr);
    // Should be an addition of two products
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('+');
    }
  });

  it('expands c * (a + b) to c*a + c*b', () => {
    const expr = mul(sym('c'), add(sym('a'), sym('b')));
    const result = expand(expr);
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('+');
    }
  });

  it('expands (a - b) * c to a*c - b*c', () => {
    const expr = mul(sub(sym('a'), sym('b')), sym('c'));
    const result = expand(expr);
    expect(isOperatorNode(result)).toBe(true);
  });

  it('expands (x + 1)^2 using binomial expansion', () => {
    const expr = pow(add(sym('x'), num(1)), num(2));
    const result = expand(expr);
    // Should be simplified to x^2 + 2*x + 1 (in some form)
    expect(result).toBeDefined();
  });

  it('expands (x + y)^0 to 1', () => {
    const result = expand(pow(add(sym('x'), sym('y')), num(0)));
    expect(getNumericValue(result)).toBe(1);
  });

  it('expands (x + y)^1 to x + y', () => {
    const result = expand(pow(add(sym('x'), sym('y')), num(1)));
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('+');
    }
  });

  it('leaves constants unchanged', () => {
    expect(getNumericValue(expand(num(42)))).toBe(42);
  });

  it('leaves symbols unchanged', () => {
    const result = expand(sym('x'));
    expect(isSymbolNode(result)).toBe(true);
  });

  it('leaves division unchanged', () => {
    const expr = div(sym('x'), sym('y'));
    const result = expand(expr);
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('/');
    }
  });
});

// ============================================================================
// Substitute
// ============================================================================

describe('substitute', () => {
  it('substitutes x with a number', () => {
    const expr = add(sym('x'), num(1));
    const result = substitute(expr, 'x', 5);
    const simplified = simplify(result);
    expect(getNumericValue(simplified)).toBe(6);
  });

  it('substitutes x with an expression', () => {
    const expr = mul(sym('x'), num(2));
    const replacement = add(sym('y'), num(1));
    const result = substitute(expr, 'x', replacement);
    // Should be (y + 1) * 2
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
    }
  });

  it('does not substitute different variables', () => {
    const expr = add(sym('x'), sym('y'));
    const result = substitute(expr, 'x', num(3));
    // Should be 3 + y
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      const simplified = simplify(result);
      expect(isOperatorNode(simplified)).toBe(true);
    }
  });

  it('preserves constants during substitution', () => {
    const expr = num(42);
    const result = substitute(expr, 'x', num(5));
    expect(getNumericValue(result)).toBe(42);
  });

  it('substitutes inside function arguments', () => {
    const expr = fn('sin', sym('x'));
    const result = substitute(expr, 'x', num(0));
    expect(isFunctionNode(result)).toBe(true);
    if (isFunctionNode(result)) {
      expect(result.fn).toBe('sin');
      expect(getNumericValue(result.args[0])).toBe(0);
    }
  });

  it('substitutes x in x^2 + 2*x + 1 with value 3 and simplifies to 16', () => {
    const expr = add(add(pow(sym('x'), num(2)), mul(num(2), sym('x'))), num(1));
    const result = simplify(substitute(expr, 'x', 3));
    expect(getNumericValue(result)).toBe(16); // 9 + 6 + 1 = 16
  });
});

// ============================================================================
// Factor
// ============================================================================

describe('factor', () => {
  it('factors difference of squares: x^2 - 4', () => {
    // x^2 - 4 = (x - 2)(x + 2)
    const expr = sub(pow(sym('x'), num(2)), num(4));
    const result = factor(expr, 'x');
    // Should be a multiplication
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
    }
  });

  it('factors quadratic x^2 + 5x + 6 into (x - r1)(x - r2)', () => {
    // x^2 + 5x + 6 = (x + 2)(x + 3) => roots are -2 and -3
    const expr = add(add(pow(sym('x'), num(2)), mul(num(5), sym('x'))), num(6));
    const result = factor(expr, 'x');
    // Should produce a multiplication
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
    }
  });

  it('factors GCF: 2x + 4 to 2 * (x + 2)', () => {
    const expr = add(mul(num(2), sym('x')), num(4));
    const result = factor(expr, 'x');
    expect(isOperatorNode(result)).toBe(true);
    if (isOperatorNode(result)) {
      expect(result.op).toBe('*');
    }
  });

  it('returns simplified expression when factoring is not possible', () => {
    const expr = add(sym('x'), num(1));
    const result = factor(expr, 'x');
    // Cannot factor x + 1 further, so it should return the simplified form
    expect(result).toBeDefined();
  });
});

// ============================================================================
// isExpanded / isFactored
// ============================================================================

describe('isExpanded', () => {
  it('considers constants as expanded', () => {
    expect(isExpanded(num(5))).toBe(true);
  });

  it('considers symbols as expanded', () => {
    expect(isExpanded(sym('x'))).toBe(true);
  });

  it('considers x + y as expanded', () => {
    expect(isExpanded(add(sym('x'), sym('y')))).toBe(true);
  });

  it('considers (x + y)^2 as not expanded', () => {
    expect(isExpanded(pow(add(sym('x'), sym('y')), num(2)))).toBe(false);
  });

  it('considers (x - y)^3 as not expanded', () => {
    expect(isExpanded(pow(sub(sym('x'), sym('y')), num(3)))).toBe(false);
  });
});

describe('isFactored', () => {
  it('considers a product as factored', () => {
    expect(isFactored(mul(sym('x'), sym('y')))).toBe(true);
  });

  it('considers a constant as factored', () => {
    expect(isFactored(num(5))).toBe(true);
  });

  it('considers a sum as not factored', () => {
    expect(isFactored(add(sym('x'), sym('y')))).toBe(false);
  });
});

// ============================================================================
// Maximum Iteration Guard
// ============================================================================

describe('Iteration guard', () => {
  it('does not hang on already-simplified expressions', () => {
    const result = simplify(sym('x'));
    expect(isSymbolNode(result)).toBe(true);
  });

  it('handles deeply nested expressions', () => {
    // ((((x + 0) * 1) + 0) * 1)
    let expr: ExpressionNode = sym('x');
    for (let i = 0; i < 5; i++) {
      expr = mul(add(expr, num(0)), num(1));
    }
    const result = simplify(expr);
    expect(isSymbolNode(result)).toBe(true);
    if (isSymbolNode(result)) {
      expect(result.name).toBe('x');
    }
  });
});
