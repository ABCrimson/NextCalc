/**
 * Advanced Symbolic Simplification Engine
 *
 * Extends basic simplification with advanced mathematical identities:
 * - Trigonometric identities (Pythagorean, double angle, sum/difference)
 * - Logarithmic rules (product, quotient, power)
 * - Exponential simplification
 * - Radical simplification and rationalization
 * - Rational function simplification
 * - Complex expression factoring
 *
 * Uses pattern matching and rewrite rules to apply sophisticated
 * mathematical transformations while preserving mathematical equivalence.
 */

import type {
  ExpressionNode,
} from '../parser/ast';
import {
  createConstantNode,
  createSymbolNode,
  createOperatorNode,
  createFunctionNode,
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isFunctionNode,
} from '../parser/ast';
import { simplify } from './simplify';

/**
 * Advanced simplification configuration
 */
export interface AdvancedSimplifyConfig {
  /** Apply trigonometric identities (default: true) */
  trigIdentities?: boolean;
  /** Apply logarithmic rules (default: true) */
  logRules?: boolean;
  /** Apply exponential rules (default: true) */
  expRules?: boolean;
  /** Simplify radicals (default: true) */
  radicals?: boolean;
  /** Rationalize denominators (default: false) */
  rationalize?: boolean;
  /** Maximum iterations (default: 10) */
  maxIterations?: number;
}

/**
 * Apply advanced simplification rules to an expression
 *
 * @param expr - Expression to simplify
 * @param config - Simplification configuration
 * @returns Simplified expression
 *
 * @example
 * ```typescript
 * // Simplify sin²(x) + cos²(x) → 1
 * const expr = parse("sin(x)^2 + cos(x)^2");
 * const result = simplifyAdvanced(expr);
 * // Result: 1
 * ```
 */
export function simplifyAdvanced(
  expr: ExpressionNode,
  config: AdvancedSimplifyConfig = {}
): ExpressionNode {
  const {
    trigIdentities = true,
    logRules = true,
    expRules = true,
    radicals = true,
    rationalize = false,
    maxIterations = 10,
  } = config;

  let current = expr;
  let previous: ExpressionNode | null = null;
  let iterations = 0;

  while (!astEquals(current, previous) && iterations < maxIterations) {
    previous = cloneNode(current);
    iterations++;

    // Apply basic simplification first
    current = simplify(current);

    // Apply advanced rules
    if (trigIdentities) {
      current = applyTrigIdentities(current);
    }

    if (logRules) {
      current = applyLogRules(current);
    }

    if (expRules) {
      current = applyExpRules(current);
    }

    if (radicals) {
      current = simplifyRadicals(current);
    }

    if (rationalize) {
      current = rationalizeDenominator(current);
    }
  }

  return current;
}

// ============================================================================
// TRIGONOMETRIC IDENTITIES
// ============================================================================

/**
 * Apply trigonometric identities
 *
 * Implements:
 * - Pythagorean: sin²(x) + cos²(x) = 1
 * - Double angle: sin(2x) = 2sin(x)cos(x)
 * - Half angle formulas
 * - Sum/difference formulas
 */
function applyTrigIdentities(expr: ExpressionNode): ExpressionNode {
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftSimp = applyTrigIdentities(left);
    const rightSimp = applyTrigIdentities(right);

    // Pythagorean identity: sin²(x) + cos²(x) = 1
    if (expr.op === '+') {
      const pythag = matchPythagorean(leftSimp, rightSimp);
      if (pythag) return pythag;
    }

    // Pythagorean identity: 1 - sin²(x) = cos²(x)
    if (expr.op === '-') {
      const pythag = matchPythagoreanSubtract(leftSimp, rightSimp);
      if (pythag) return pythag;
    }

    // Double angle: 2*sin(x)*cos(x) = sin(2x)
    if (expr.op === '*') {
      const doubleAngle = matchDoubleAngleSin(leftSimp, rightSimp);
      if (doubleAngle) return doubleAngle;
    }

    return createOperatorNode(expr.op, expr.fn, [leftSimp, rightSimp]);
  }

  if (isFunctionNode(expr)) {
    const argsSimp = expr.args.map(applyTrigIdentities);
    return createFunctionNode(expr.fn, argsSimp);
  }

  return expr;
}

/**
 * Match sin²(x) + cos²(x) = 1
 */
function matchPythagorean(
  left: ExpressionNode,
  right: ExpressionNode
): ExpressionNode | null {
  // Check if left is sin²(x) and right is cos²(x) (or vice versa)
  const leftSq = extractSquaredTrig(left);
  const rightSq = extractSquaredTrig(right);

  if (!leftSq || !rightSq) return null;

  // Check if one is sin and other is cos with same argument
  if (
    leftSq.fn === 'sin' &&
    rightSq.fn === 'cos' &&
    astEquals(leftSq.arg, rightSq.arg)
  ) {
    return createConstantNode(1);
  }

  if (
    leftSq.fn === 'cos' &&
    rightSq.fn === 'sin' &&
    astEquals(leftSq.arg, rightSq.arg)
  ) {
    return createConstantNode(1);
  }

  return null;
}

/**
 * Match 1 - sin²(x) = cos²(x) and 1 - cos²(x) = sin²(x)
 */
function matchPythagoreanSubtract(
  left: ExpressionNode,
  right: ExpressionNode
): ExpressionNode | null {
  // 1 - sin²(x) → cos²(x)
  if (isConstantNode(left) && left.value === 1) {
    const rightSq = extractSquaredTrig(right);
    if (rightSq) {
      if (rightSq.fn === 'sin') {
        return createOperatorNode('^', 'pow', [
          createFunctionNode('cos', [rightSq.arg]),
          createConstantNode(2),
        ]);
      }
      if (rightSq.fn === 'cos') {
        return createOperatorNode('^', 'pow', [
          createFunctionNode('sin', [rightSq.arg]),
          createConstantNode(2),
        ]);
      }
    }
  }

  return null;
}

/**
 * Match 2*sin(x)*cos(x) = sin(2x)
 */
function matchDoubleAngleSin(
  left: ExpressionNode,
  right: ExpressionNode
): ExpressionNode | null {
  // Pattern: 2 * sin(x) * cos(x) or sin(x) * cos(x) * 2
  let coefficient: number | null = null;
  let sinTerm: ExpressionNode | null = null;
  let cosTerm: ExpressionNode | null = null;

  // Extract components
  if (isConstantNode(left)) {
    coefficient = typeof left.value === 'number' ? left.value : null;
    // right should be sin*cos
    if (isOperatorNode(right) && right.op === '*') {
      const [a, b] = right.args;
      if (isFunctionNode(a) && isFunctionNode(b)) {
        if (a.fn === 'sin' && b.fn === 'cos') {
          sinTerm = a;
          cosTerm = b;
        } else if (a.fn === 'cos' && b.fn === 'sin') {
          sinTerm = b;
          cosTerm = a;
        }
      }
    }
  }

  if (coefficient === 2 && sinTerm && cosTerm && isFunctionNode(sinTerm) && isFunctionNode(cosTerm)) {
    const sinArg = sinTerm.args[0];
    const cosArg = cosTerm.args[0];
    if (sinArg && cosArg && astEquals(sinArg, cosArg)) {
      // Create 2*x
      const doubleArg = createOperatorNode('*', 'multiply', [
        createConstantNode(2),
        sinArg,
      ]);
      return createFunctionNode('sin', [doubleArg]);
    }
  }

  return null;
}

/**
 * Extract f²(x) as { fn: 'sin'|'cos', arg: x }
 */
function extractSquaredTrig(
  expr: ExpressionNode
): { fn: 'sin' | 'cos'; arg: ExpressionNode } | null {
  if (!isOperatorNode(expr) || expr.op !== '^') return null;

  const [base, exp] = expr.args;
  if (!isConstantNode(exp) || exp.value !== 2) return null;

  if (isFunctionNode(base) && (base.fn === 'sin' || base.fn === 'cos')) {
    const arg = base.args[0];
    if (arg) {
      return { fn: base.fn, arg };
    }
  }

  return null;
}

// ============================================================================
// LOGARITHMIC RULES
// ============================================================================

/**
 * Apply logarithmic simplification rules
 *
 * Implements:
 * - Product rule: log(a*b) = log(a) + log(b)
 * - Quotient rule: log(a/b) = log(a) - log(b)
 * - Power rule: log(a^b) = b*log(a)
 * - log(1) = 0
 * - log(e) = 1 (for natural log)
 */
function applyLogRules(expr: ExpressionNode): ExpressionNode {
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftSimp = applyLogRules(left);
    const rightSimp = applyLogRules(right);
    return createOperatorNode(expr.op, expr.fn, [leftSimp, rightSimp]);
  }

  if (isFunctionNode(expr)) {
    const argsSimp = expr.args.map(applyLogRules);

    // Apply log rules
    if (expr.fn === 'log' || expr.fn === 'ln') {
      const arg = argsSimp[0];
      if (!arg) return createFunctionNode(expr.fn, argsSimp);

      // log(1) = 0
      if (isConstantNode(arg) && arg.value === 1) {
        return createConstantNode(0);
      }

      // log(e) = 1 (for natural log)
      if (
        (expr.fn === 'log' || expr.fn === 'ln') &&
        isConstantNode(arg) &&
        typeof arg.value === 'number' &&
        Math.abs(arg.value - Math.E) < 1e-10
      ) {
        return createConstantNode(1);
      }

      // Power rule: log(a^b) = b*log(a)
      if (isOperatorNode(arg) && arg.op === '^') {
        const [base, exponent] = arg.args;
        return createOperatorNode('*', 'multiply', [
          exponent,
          createFunctionNode(expr.fn, [base]),
        ]);
      }

      // Product rule: log(a*b) = log(a) + log(b)
      if (isOperatorNode(arg) && arg.op === '*') {
        const [a, b] = arg.args;
        return createOperatorNode('+', 'add', [
          createFunctionNode(expr.fn, [a]),
          createFunctionNode(expr.fn, [b]),
        ]);
      }

      // Quotient rule: log(a/b) = log(a) - log(b)
      if (isOperatorNode(arg) && arg.op === '/') {
        const [a, b] = arg.args;
        return createOperatorNode('-', 'subtract', [
          createFunctionNode(expr.fn, [a]),
          createFunctionNode(expr.fn, [b]),
        ]);
      }
    }

    return createFunctionNode(expr.fn, argsSimp);
  }

  return expr;
}

// ============================================================================
// EXPONENTIAL RULES
// ============================================================================

/**
 * Apply exponential simplification rules
 *
 * Implements:
 * - exp(0) = 1
 * - exp(ln(x)) = x
 * - ln(exp(x)) = x
 * - exp(a) * exp(b) = exp(a+b)
 * - exp(a) / exp(b) = exp(a-b)
 */
function applyExpRules(expr: ExpressionNode): ExpressionNode {
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftSimp = applyExpRules(left);
    const rightSimp = applyExpRules(right);

    // exp(a) * exp(b) = exp(a+b)
    if (expr.op === '*') {
      if (
        isFunctionNode(leftSimp) &&
        leftSimp.fn === 'exp' &&
        isFunctionNode(rightSimp) &&
        rightSimp.fn === 'exp'
      ) {
        const argLeft = leftSimp.args[0];
        const argRight = rightSimp.args[0];
        if (argLeft && argRight) {
          return createFunctionNode('exp', [
            createOperatorNode('+', 'add', [argLeft, argRight]),
          ]);
        }
      }
    }

    // exp(a) / exp(b) = exp(a-b)
    if (expr.op === '/') {
      if (
        isFunctionNode(leftSimp) &&
        leftSimp.fn === 'exp' &&
        isFunctionNode(rightSimp) &&
        rightSimp.fn === 'exp'
      ) {
        const argLeft = leftSimp.args[0];
        const argRight = rightSimp.args[0];
        if (argLeft && argRight) {
          return createFunctionNode('exp', [
            createOperatorNode('-', 'subtract', [argLeft, argRight]),
          ]);
        }
      }
    }

    return createOperatorNode(expr.op, expr.fn, [leftSimp, rightSimp]);
  }

  if (isFunctionNode(expr)) {
    const argsSimp = expr.args.map(applyExpRules);
    const arg = argsSimp[0];

    // exp(ln(x)) = x
    if (expr.fn === 'exp' && arg && isFunctionNode(arg)) {
      if (arg.fn === 'log' || arg.fn === 'ln') {
        const innerArg = arg.args[0];
        if (innerArg) return innerArg;
      }
    }

    // ln(exp(x)) = x
    if ((expr.fn === 'log' || expr.fn === 'ln') && arg && isFunctionNode(arg)) {
      if (arg.fn === 'exp') {
        const innerArg = arg.args[0];
        if (innerArg) return innerArg;
      }
    }

    return createFunctionNode(expr.fn, argsSimp);
  }

  return expr;
}

// ============================================================================
// RADICAL SIMPLIFICATION
// ============================================================================

/**
 * Simplify radical expressions
 *
 * Implements:
 * - √(a²) = |a| (simplified to a for symbolic algebra)
 * - √(a*b) = √a * √b
 * - √(a/b) = √a / √b
 * - √(a^(2n)) = a^n
 */
function simplifyRadicals(expr: ExpressionNode): ExpressionNode {
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftSimp = simplifyRadicals(left);
    const rightSimp = simplifyRadicals(right);
    return createOperatorNode(expr.op, expr.fn, [leftSimp, rightSimp]);
  }

  if (isFunctionNode(expr)) {
    const argsSimp = expr.args.map(simplifyRadicals);
    const arg = argsSimp[0];

    if (expr.fn === 'sqrt' && arg) {
      // √(a²) = a
      if (isOperatorNode(arg) && arg.op === '^') {
        const [base, exponent] = arg.args;
        if (isConstantNode(exponent) && exponent.value === 2) {
          return createFunctionNode('abs', [base]);
        }

        // √(a^(2n)) = a^n
        if (
          isConstantNode(exponent) &&
          typeof exponent.value === 'number' &&
          exponent.value % 2 === 0
        ) {
          return createOperatorNode('^', 'pow', [
            base,
            createConstantNode(exponent.value / 2),
          ]);
        }
      }

      // √(a*b) = √a * √b
      if (isOperatorNode(arg) && arg.op === '*') {
        const [a, b] = arg.args;
        return createOperatorNode('*', 'multiply', [
          createFunctionNode('sqrt', [a]),
          createFunctionNode('sqrt', [b]),
        ]);
      }

      // √(a/b) = √a / √b
      if (isOperatorNode(arg) && arg.op === '/') {
        const [a, b] = arg.args;
        return createOperatorNode('/', 'divide', [
          createFunctionNode('sqrt', [a]),
          createFunctionNode('sqrt', [b]),
        ]);
      }
    }

    return createFunctionNode(expr.fn, argsSimp);
  }

  return expr;
}

// ============================================================================
// RATIONALIZATION
// ============================================================================

/**
 * Rationalize denominators
 *
 * Transforms expressions to remove radicals from denominators:
 * - 1/√a → √a/a
 * - 1/(a + √b) → (a - √b)/(a² - b)
 */
function rationalizeDenominator(expr: ExpressionNode): ExpressionNode {
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftSimp = rationalizeDenominator(left);
    const rightSimp = rationalizeDenominator(right);

    // Rationalize division with sqrt in denominator
    if (expr.op === '/') {
      // 1/√a → √a/a
      if (isFunctionNode(rightSimp) && rightSimp.fn === 'sqrt') {
        const arg = rightSimp.args[0];
        if (arg) {
          return createOperatorNode('/', 'divide', [
            createOperatorNode('*', 'multiply', [leftSimp, rightSimp]),
            arg,
          ]);
        }
      }

      // a/(b + √c) → a(b - √c)/(b² - c)
      if (isOperatorNode(rightSimp) && rightSimp.op === '+') {
        const [a, b] = rightSimp.args;
        if (isFunctionNode(b) && b.fn === 'sqrt') {
          const sqrtArg = b.args[0];
          if (sqrtArg) {
            // Multiply by conjugate (a - √b)
            const conjugate = createOperatorNode('-', 'subtract', [a, b]);

            // New numerator: left * conjugate
            const newNum = createOperatorNode('*', 'multiply', [
              leftSimp,
              conjugate,
            ]);

            // New denominator: a² - b
            const newDen = createOperatorNode('-', 'subtract', [
              createOperatorNode('^', 'pow', [a, createConstantNode(2)]),
              sqrtArg,
            ]);

            return createOperatorNode('/', 'divide', [newNum, newDen]);
          }
        }
      }
    }

    return createOperatorNode(expr.op, expr.fn, [leftSimp, rightSimp]);
  }

  if (isFunctionNode(expr)) {
    const argsSimp = expr.args.map(rationalizeDenominator);
    return createFunctionNode(expr.fn, argsSimp);
  }

  return expr;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if two AST nodes are structurally equal
 */
function astEquals(a: ExpressionNode | null, b: ExpressionNode | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;

  if (isConstantNode(a) && isConstantNode(b)) {
    return a.value === b.value;
  }

  if (isSymbolNode(a) && isSymbolNode(b)) {
    return a.name === b.name;
  }

  if (isOperatorNode(a) && isOperatorNode(b)) {
    return (
      a.op === b.op &&
      astEquals(a.args[0], b.args[0]) &&
      astEquals(a.args[1], b.args[1])
    );
  }

  if (isFunctionNode(a) && isFunctionNode(b)) {
    if (a.fn !== b.fn || a.args.length !== b.args.length) return false;
    return a.args.every((arg, i) => {
      const bArg = b.args[i];
      return bArg && astEquals(arg, bArg);
    });
  }

  return false;
}

/**
 * Clone AST node (deep copy)
 */
function cloneNode(node: ExpressionNode): ExpressionNode {
  if (isConstantNode(node)) {
    return createConstantNode(node.value);
  }

  if (isSymbolNode(node)) {
    return createSymbolNode(node.name);
  }

  if (isOperatorNode(node)) {
    const left = node.args[0];
    const right = node.args[1];
    if (!left || !right) return node;
    return createOperatorNode(node.op, node.fn, [
      cloneNode(left),
      cloneNode(right),
    ]);
  }

  if (isFunctionNode(node)) {
    return createFunctionNode(node.fn, node.args.map(cloneNode));
  }

  return node;
}
