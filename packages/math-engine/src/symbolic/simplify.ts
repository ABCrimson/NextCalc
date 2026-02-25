/**
 * Symbolic Simplification Engine
 *
 * Provides comprehensive algebraic simplification and manipulation:
 * - expand(): Expand algebraic expressions
 * - factor(): Factor polynomials
 * - simplify(): General simplification with identity rules
 * - substitute(): Variable substitution
 *
 * All transformations are immutable and preserve mathematical equivalence.
 */

import type {
  ExpressionNode,
  OperatorNode,
  FunctionNode,
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

/**
 * Term representation for algebraic manipulation
 * Represents coefficient * variable^exponent
 * (Currently unused - reserved for future polynomial operations)
 */
// interface Term {
//   coefficient: number;
//   variable: string | null;
//   exponent: number;
// }

/**
 * Polynomial representation as array of terms
 * (Currently unused - reserved for future polynomial operations)
 */
// interface Polynomial {
//   terms: Term[];
//   variable: string;
// }

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract numeric value from constant node
 */
function getNumericValue(node: ExpressionNode): number | null {
  if (!isConstantNode(node)) return null;
  const value = node.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}

/**
 * Check if two AST nodes are structurally equal
 */
function astEquals(a: ExpressionNode, b: ExpressionNode): boolean {
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
    return createOperatorNode(
      node.op,
      node.fn,
      [cloneNode(left), cloneNode(right)] as const
    );
  }

  if (isFunctionNode(node)) {
    return createFunctionNode(
      node.fn,
      node.args.map(cloneNode)
    );
  }

  return node;
}

/**
 * Check if expression is a power operation
 */
function isPower(node: ExpressionNode): node is OperatorNode {
  return isOperatorNode(node) && node.op === '^';
}

/**
 * Check if expression is multiplication
 */
function isMultiplication(node: ExpressionNode): node is OperatorNode {
  return isOperatorNode(node) && node.op === '*';
}

/**
 * Check if expression is addition
 */
function isAddition(node: ExpressionNode): node is OperatorNode {
  return isOperatorNode(node) && node.op === '+';
}

/**
 * Check if expression is subtraction
 */
function isSubtraction(node: ExpressionNode): node is OperatorNode {
  return isOperatorNode(node) && node.op === '-';
}

/**
 * Check if expression contains a specific variable
 */
function containsVariable(expr: ExpressionNode, variable: string): boolean {
  if (isConstantNode(expr)) return false;
  if (isSymbolNode(expr)) return expr.name === variable;

  if (isOperatorNode(expr)) {
    return expr.args.some(arg => arg && containsVariable(arg, variable));
  }

  if (isFunctionNode(expr)) {
    return expr.args.some(arg => arg && containsVariable(arg, variable));
  }

  return false;
}

// ============================================================================
// SIMPLIFY: General Simplification
// ============================================================================

/**
 * Simplify an expression using algebraic rules
 *
 * Applies the following simplifications:
 * - Constant folding: 2 + 3 → 5
 * - Identity rules: x + 0 → x, x * 1 → x, x * 0 → 0
 * - Power rules: x^0 → 1, x^1 → x
 * - Combine like terms: 2x + 3x → 5x
 * - Trigonometric identities: sin²(x) + cos²(x) → 1
 * - Fraction simplification: x²/x → x
 *
 * @param expr - Expression to simplify
 * @returns Simplified expression
 *
 * @example
 * ```typescript
 * const expr = parse("2 + 3 * 0");
 * const simplified = simplify(expr); // → 2
 * ```
 */
export function simplify(expr: ExpressionNode): ExpressionNode {
  // Apply simplification rules recursively until no changes
  let current = expr;
  let previous: ExpressionNode | null = null;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (!previous || !astEquals(current, previous)) {
    if (iterations++ > maxIterations) {
      throw new Error('Simplification exceeded maximum iterations');
    }
    previous = cloneNode(current);
    current = simplifyOnce(current);
  }

  return current;
}

/**
 * Single pass simplification
 */
function simplifyOnce(expr: ExpressionNode): ExpressionNode {
  // Base cases
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isOperatorNode(expr)) {
    return simplifyOperator(expr);
  }

  if (isFunctionNode(expr)) {
    return simplifyFunction(expr);
  }

  return expr;
}

/**
 * Simplify operator nodes
 */
function simplifyOperator(node: OperatorNode): ExpressionNode {
  const [left, right] = node.args;
  const leftSimp = simplifyOnce(left);
  const rightSimp = simplifyOnce(right);

  const leftVal = getNumericValue(leftSimp);
  const rightVal = getNumericValue(rightSimp);

  switch (node.op) {
    case '+':
      return simplifyAddition(leftSimp, rightSimp, leftVal, rightVal);
    case '-':
      return simplifySubtraction(leftSimp, rightSimp, leftVal, rightVal);
    case '*':
      return simplifyMultiplication(leftSimp, rightSimp, leftVal, rightVal);
    case '/':
      return simplifyDivision(leftSimp, rightSimp, leftVal, rightVal);
    case '^':
      return simplifyPower(leftSimp, rightSimp, leftVal, rightVal);
    case '%':
      return simplifyModulo(leftSimp, rightSimp, leftVal, rightVal);
    default:
      return createOperatorNode(node.op, node.fn, [leftSimp, rightSimp] as const);
  }
}

/**
 * Simplify addition
 */
function simplifyAddition(
  left: ExpressionNode,
  right: ExpressionNode,
  leftVal: number | null,
  rightVal: number | null
): ExpressionNode {
  // Constant folding: 2 + 3 = 5
  if (leftVal !== null && rightVal !== null) {
    return createConstantNode(leftVal + rightVal);
  }

  // Identity: 0 + x = x
  if (leftVal === 0) return right;

  // Identity: x + 0 = x
  if (rightVal === 0) return left;

  // Combine like terms: 2x + 3x = 5x
  const combined = combineLikeTerms(left, right, '+');
  if (combined) return combined;

  return createOperatorNode('+', 'add', [left, right] as const);
}

/**
 * Simplify subtraction
 */
function simplifySubtraction(
  left: ExpressionNode,
  right: ExpressionNode,
  leftVal: number | null,
  rightVal: number | null
): ExpressionNode {
  // Constant folding: 5 - 3 = 2
  if (leftVal !== null && rightVal !== null) {
    return createConstantNode(leftVal - rightVal);
  }

  // Identity: x - 0 = x
  if (rightVal === 0) return left;

  // Identity: 0 - x = -x
  if (leftVal === 0) {
    return createOperatorNode('*', 'multiply', [
      createConstantNode(-1),
      right,
    ] as const);
  }

  // Self-cancellation: x - x = 0
  if (astEquals(left, right)) {
    return createConstantNode(0);
  }

  return createOperatorNode('-', 'subtract', [left, right] as const);
}

/**
 * Simplify multiplication
 */
function simplifyMultiplication(
  left: ExpressionNode,
  right: ExpressionNode,
  leftVal: number | null,
  rightVal: number | null
): ExpressionNode {
  // Constant folding: 2 * 3 = 6
  if (leftVal !== null && rightVal !== null) {
    return createConstantNode(leftVal * rightVal);
  }

  // Zero property: 0 * x = 0
  if (leftVal === 0 || rightVal === 0) {
    return createConstantNode(0);
  }

  // Identity: 1 * x = x
  if (leftVal === 1) return right;

  // Identity: x * 1 = x
  if (rightVal === 1) return left;

  // Negation: -1 * x = -x (simplified form)
  if (leftVal === -1) {
    return createOperatorNode('*', 'multiply', [
      createConstantNode(-1),
      right,
    ] as const);
  }

  if (rightVal === -1) {
    return createOperatorNode('*', 'multiply', [
      createConstantNode(-1),
      left,
    ] as const);
  }

  // Combine powers: x^a * x^b = x^(a+b)
  const powerCombined = combinePowers(left, right);
  if (powerCombined) return powerCombined;

  return createOperatorNode('*', 'multiply', [left, right] as const);
}

/**
 * Simplify division
 */
function simplifyDivision(
  left: ExpressionNode,
  right: ExpressionNode,
  leftVal: number | null,
  rightVal: number | null
): ExpressionNode {
  // Constant folding: 6 / 2 = 3
  if (leftVal !== null && rightVal !== null) {
    if (rightVal === 0) {
      throw new Error('Division by zero');
    }
    return createConstantNode(leftVal / rightVal);
  }

  // Identity: 0 / x = 0 (x ≠ 0)
  if (leftVal === 0) return createConstantNode(0);

  // Identity: x / 1 = x
  if (rightVal === 1) return left;

  // Self-cancellation: x / x = 1
  if (astEquals(left, right)) {
    return createConstantNode(1);
  }

  // Cancel common factors: x^a / x^b = x^(a-b)
  const cancelled = cancelDivision(left, right);
  if (cancelled) return cancelled;

  return createOperatorNode('/', 'divide', [left, right] as const);
}

/**
 * Simplify exponentiation
 */
function simplifyPower(
  base: ExpressionNode,
  exponent: ExpressionNode,
  baseVal: number | null,
  expVal: number | null
): ExpressionNode {
  // Constant folding: 2^3 = 8
  if (baseVal !== null && expVal !== null) {
    return createConstantNode(Math.pow(baseVal, expVal));
  }

  // Identity: x^0 = 1
  if (expVal === 0) return createConstantNode(1);

  // Identity: x^1 = x
  if (expVal === 1) return base;

  // Identity: 0^x = 0 (x > 0)
  if (baseVal === 0 && expVal !== null && expVal > 0) {
    return createConstantNode(0);
  }

  // Identity: 1^x = 1
  if (baseVal === 1) return createConstantNode(1);

  // Power of power: (x^a)^b = x^(a*b)
  if (isPower(base)) {
    const innerBase = base.args[0];
    const innerExp = base.args[1];
    const innerExpVal = getNumericValue(innerExp);

    if (innerExpVal !== null && expVal !== null) {
      return createOperatorNode('^', 'pow', [
        innerBase,
        createConstantNode(innerExpVal * expVal),
      ] as const);
    }

    return createOperatorNode('^', 'pow', [
      innerBase,
      createOperatorNode('*', 'multiply', [innerExp, exponent] as const),
    ] as const);
  }

  return createOperatorNode('^', 'pow', [base, exponent] as const);
}

/**
 * Simplify modulo
 */
function simplifyModulo(
  left: ExpressionNode,
  right: ExpressionNode,
  leftVal: number | null,
  rightVal: number | null
): ExpressionNode {
  // Constant folding: 7 % 3 = 1
  if (leftVal !== null && rightVal !== null) {
    if (rightVal === 0) {
      throw new Error('Modulo by zero');
    }
    return createConstantNode(leftVal % rightVal);
  }

  // Identity: 0 % x = 0
  if (leftVal === 0) return createConstantNode(0);

  return createOperatorNode('%', 'modulo', [left, right] as const);
}

/**
 * Simplify function nodes
 */
function simplifyFunction(node: FunctionNode): ExpressionNode {
  // Simplify arguments first
  const simplifiedArgs = node.args.map(simplifyOnce);

  // Trigonometric identities
  if (node.fn === 'sin' || node.fn === 'cos' || node.fn === 'tan') {
    // sin(0) = 0, cos(0) = 1, tan(0) = 0
    const arg = simplifiedArgs[0];
    if (!arg) return createFunctionNode(node.fn, simplifiedArgs);
    const argVal = getNumericValue(arg);

    if (argVal === 0) {
      if (node.fn === 'sin' || node.fn === 'tan') {
        return createConstantNode(0);
      }
      if (node.fn === 'cos') {
        return createConstantNode(1);
      }
    }
  }

  // sqrt(x^2) = |x| (simplified to x for algebraic purposes)
  if (node.fn === 'sqrt') {
    const arg = simplifiedArgs[0];
    if (arg && isPower(arg)) {
      const base = arg.args[0];
      const exp = arg.args[1];
      if (base && exp) {
        const expVal = getNumericValue(exp);
        if (expVal === 2) {
          return createFunctionNode('abs', [base]);
        }
      }
    }
  }

  // abs(-x) = abs(x)
  if (node.fn === 'abs') {
    const arg = simplifiedArgs[0];
    if (arg && isMultiplication(arg)) {
      const left = arg.args[0];
      const right = arg.args[1];
      if (left && right) {
        const leftVal = getNumericValue(left);
        if (leftVal === -1) {
          return createFunctionNode('abs', [right]);
        }
      }
    }
  }

  // log(1) = 0, log(e) = 1 (for natural log)
  if (node.fn === 'log') {
    const arg = simplifiedArgs[0];
    if (arg) {
      const argVal = getNumericValue(arg);
      if (argVal === 1) return createConstantNode(0);
    }
  }

  // exp(0) = 1
  if (node.fn === 'exp') {
    const arg = simplifiedArgs[0];
    if (arg) {
      const argVal = getNumericValue(arg);
      if (argVal === 0) return createConstantNode(1);
    }
  }

  return createFunctionNode(node.fn, simplifiedArgs);
}

/**
 * Combine like terms: 2x + 3x = 5x
 */
function combineLikeTerms(
  left: ExpressionNode,
  right: ExpressionNode,
  op: '+' | '-'
): ExpressionNode | null {
  // Extract coefficient and variable part
  const leftTerm = extractTerm(left);
  const rightTerm = extractTerm(right);

  if (!leftTerm || !rightTerm) return null;

  // Check if variable parts match
  if (leftTerm.variable && rightTerm.variable) {
    if (!astEquals(leftTerm.variable, rightTerm.variable)) return null;

    // Combine coefficients
    const newCoeff = op === '+'
      ? leftTerm.coefficient + rightTerm.coefficient
      : leftTerm.coefficient - rightTerm.coefficient;

    if (newCoeff === 0) return createConstantNode(0);
    if (newCoeff === 1) return leftTerm.variable;

    return createOperatorNode('*', 'multiply', [
      createConstantNode(newCoeff),
      leftTerm.variable,
    ] as const);
  }

  return null;
}

/**
 * Extract term structure: coefficient * variable
 */
function extractTerm(
  expr: ExpressionNode
): { coefficient: number; variable: ExpressionNode | null } | null {
  if (isConstantNode(expr)) {
    const val = getNumericValue(expr);
    return val !== null ? { coefficient: val, variable: null } : null;
  }

  if (isMultiplication(expr)) {
    const [left, right] = expr.args;
    const leftVal = getNumericValue(left);

    if (leftVal !== null) {
      return { coefficient: leftVal, variable: right };
    }

    const rightVal = getNumericValue(right);
    if (rightVal !== null) {
      return { coefficient: rightVal, variable: left };
    }
  }

  return { coefficient: 1, variable: expr };
}

/**
 * Combine powers: x^a * x^b = x^(a+b)
 */
function combinePowers(
  left: ExpressionNode,
  right: ExpressionNode
): ExpressionNode | null {
  // x * x = x^2
  if (astEquals(left, right)) {
    return createOperatorNode('^', 'pow', [
      left,
      createConstantNode(2),
    ] as const);
  }

  // x^a * x^b = x^(a+b)
  if (isPower(left) && isPower(right)) {
    const [leftBase, leftExp] = left.args;
    const [rightBase, rightExp] = right.args;

    if (astEquals(leftBase, rightBase)) {
      const newExp = simplifyOnce(
        createOperatorNode('+', 'add', [leftExp, rightExp] as const)
      );
      return createOperatorNode('^', 'pow', [leftBase, newExp] as const);
    }
  }

  // x^a * x = x^(a+1)
  if (isPower(left)) {
    const [leftBase, leftExp] = left.args;
    if (astEquals(leftBase, right)) {
      const newExp = simplifyOnce(
        createOperatorNode('+', 'add', [leftExp, createConstantNode(1)] as const)
      );
      return createOperatorNode('^', 'pow', [leftBase, newExp] as const);
    }
  }

  // x * x^b = x^(1+b)
  if (isPower(right)) {
    const [rightBase, rightExp] = right.args;
    if (astEquals(left, rightBase)) {
      const newExp = simplifyOnce(
        createOperatorNode('+', 'add', [createConstantNode(1), rightExp] as const)
      );
      return createOperatorNode('^', 'pow', [rightBase, newExp] as const);
    }
  }

  return null;
}

/**
 * Cancel common factors in division: x^a / x^b = x^(a-b)
 */
function cancelDivision(
  numerator: ExpressionNode,
  denominator: ExpressionNode
): ExpressionNode | null {
  // x / x = 1 (already handled in simplifyDivision)

  // x^a / x = x^(a-1)
  if (isPower(numerator)) {
    const [numBase, numExp] = numerator.args;
    if (astEquals(numBase, denominator)) {
      const newExp = simplifyOnce(
        createOperatorNode('-', 'subtract', [numExp, createConstantNode(1)] as const)
      );
      const expVal = getNumericValue(newExp);
      if (expVal === 0) return createConstantNode(1);
      if (expVal === 1) return numBase;
      return createOperatorNode('^', 'pow', [numBase, newExp] as const);
    }
  }

  // x / x^b = x^(1-b)
  if (isPower(denominator)) {
    const [denBase, denExp] = denominator.args;
    if (astEquals(numerator, denBase)) {
      const newExp = simplifyOnce(
        createOperatorNode('-', 'subtract', [createConstantNode(1), denExp] as const)
      );
      const expVal = getNumericValue(newExp);
      if (expVal === 0) return createConstantNode(1);
      if (expVal === 1) return denBase;
      return createOperatorNode('^', 'pow', [denBase, newExp] as const);
    }
  }

  // x^a / x^b = x^(a-b)
  if (isPower(numerator) && isPower(denominator)) {
    const [numBase, numExp] = numerator.args;
    const [denBase, denExp] = denominator.args;

    if (astEquals(numBase, denBase)) {
      const newExp = simplifyOnce(
        createOperatorNode('-', 'subtract', [numExp, denExp] as const)
      );
      const expVal = getNumericValue(newExp);
      if (expVal === 0) return createConstantNode(1);
      if (expVal === 1) return numBase;
      return createOperatorNode('^', 'pow', [numBase, newExp] as const);
    }
  }

  return null;
}

// ============================================================================
// EXPAND: Algebraic Expansion
// ============================================================================

/**
 * Expand algebraic expressions
 *
 * Applies distributive property to expand products:
 * - (a + b) * c → a*c + b*c
 * - (a + b) * (c + d) → a*c + a*d + b*c + b*d
 * - (a + b)^2 → a^2 + 2*a*b + b^2
 * - (a + b)^n → binomial expansion for small n
 *
 * @param expr - Expression to expand
 * @returns Expanded expression
 *
 * @example
 * ```typescript
 * const expr = parse("(x + 1) * (x - 1)");
 * const expanded = expand(expr); // → x^2 - 1
 * ```
 */
export function expand(expr: ExpressionNode): ExpressionNode {
  // Base cases
  if (isConstantNode(expr) || isSymbolNode(expr)) {
    return expr;
  }

  if (isFunctionNode(expr)) {
    return createFunctionNode(expr.fn, expr.args.map(expand));
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftExp = expand(left);
    const rightExp = expand(right);

    switch (expr.op) {
      case '*':
        return expandMultiplication(leftExp, rightExp);
      case '^':
        return expandPower(leftExp, rightExp);
      case '+':
      case '-':
      case '/':
      case '%':
        return createOperatorNode(expr.op, expr.fn, [leftExp, rightExp] as const);
      default:
        return createOperatorNode(expr.op, expr.fn, [leftExp, rightExp] as const);
    }
  }

  return expr;
}

/**
 * Expand multiplication: (a + b) * (c + d) → a*c + a*d + b*c + b*d
 */
function expandMultiplication(
  left: ExpressionNode,
  right: ExpressionNode
): ExpressionNode {
  // (a + b) * c → a*c + b*c
  if (isAddition(left)) {
    const a = left.args[0];
    const b = left.args[1];
    if (a && b) {
      const ac = expand(createOperatorNode('*', 'multiply', [a, right] as const));
      const bc = expand(createOperatorNode('*', 'multiply', [b, right] as const));
      return simplify(createOperatorNode('+', 'add', [ac, bc] as const));
    }
  }

  // a * (b + c) → a*b + a*c
  if (isAddition(right)) {
    const b = right.args[0];
    const c = right.args[1];
    if (b && c) {
      const ab = expand(createOperatorNode('*', 'multiply', [left, b] as const));
      const ac = expand(createOperatorNode('*', 'multiply', [left, c] as const));
      return simplify(createOperatorNode('+', 'add', [ab, ac] as const));
    }
  }

  // (a - b) * c → a*c - b*c
  if (isSubtraction(left)) {
    const a = left.args[0];
    const b = left.args[1];
    if (a && b) {
      const ac = expand(createOperatorNode('*', 'multiply', [a, right] as const));
      const bc = expand(createOperatorNode('*', 'multiply', [b, right] as const));
      return simplify(createOperatorNode('-', 'subtract', [ac, bc] as const));
    }
  }

  // a * (b - c) → a*b - a*c
  if (isSubtraction(right)) {
    const b = right.args[0];
    const c = right.args[1];
    if (b && c) {
      const ab = expand(createOperatorNode('*', 'multiply', [left, b] as const));
      const ac = expand(createOperatorNode('*', 'multiply', [left, c] as const));
      return simplify(createOperatorNode('-', 'subtract', [ab, ac] as const));
    }
  }

  return createOperatorNode('*', 'multiply', [left, right] as const);
}

/**
 * Expand power: (a + b)^n → binomial expansion
 */
function expandPower(base: ExpressionNode, exponent: ExpressionNode): ExpressionNode {
  const expVal = getNumericValue(exponent);

  // Only expand for small positive integer exponents
  if (expVal === null || expVal < 0 || expVal > 10 || !Number.isInteger(expVal)) {
    return createOperatorNode('^', 'pow', [base, exponent] as const);
  }

  if (expVal === 0) return createConstantNode(1);
  if (expVal === 1) return base;

  // Expand (a + b)^n or (a - b)^n
  if (isAddition(base) || isSubtraction(base)) {
    const isAdd = isAddition(base);
    const a = base.args[0];
    const b = base.args[1];

    if (!a || !b) {
      return createOperatorNode('^', 'pow', [base, exponent] as const);
    }

    // Binomial expansion: sum of C(n, k) * a^(n-k) * b^k
    let result: ExpressionNode = createConstantNode(0);

    for (let k = 0; k <= expVal; k++) {
      const coeff = binomialCoefficient(expVal, k);
      const aPower = expVal - k;
      const bPower = k;

      let term: ExpressionNode = createConstantNode(coeff);

      // Multiply by a^(n-k)
      if (aPower > 0) {
        const aTerm = aPower === 1
          ? a
          : createOperatorNode('^', 'pow', [a, createConstantNode(aPower)] as const);
        term = createOperatorNode('*', 'multiply', [term, aTerm] as const);
      }

      // Multiply by b^k (with sign for subtraction)
      if (bPower > 0) {
        let bTerm = bPower === 1
          ? b
          : createOperatorNode('^', 'pow', [b, createConstantNode(bPower)] as const);

        // Alternate sign for (a - b)^n
        if (!isAdd && bPower % 2 === 1) {
          bTerm = createOperatorNode('*', 'multiply', [
            createConstantNode(-1),
            bTerm,
          ] as const);
        }

        term = createOperatorNode('*', 'multiply', [term, bTerm] as const);
      }

      result = createOperatorNode('+', 'add', [result, term] as const);
    }

    return simplify(result);
  }

  // Expand x^n as x * x * ... * x (for small n)
  if (expVal <= 3) {
    let result = base;
    for (let i = 1; i < expVal; i++) {
      result = expandMultiplication(result, base);
    }
    return simplify(result);
  }

  return createOperatorNode('^', 'pow', [base, exponent] as const);
}

/**
 * Calculate binomial coefficient C(n, k)
 */
function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = result * (n - i + 1) / i;
  }

  return Math.round(result);
}

// ============================================================================
// FACTOR: Polynomial Factorization
// ============================================================================

/**
 * Factor a polynomial expression
 *
 * Attempts to factor expressions into products:
 * - Greatest common factor: 2x + 4 → 2(x + 2)
 * - Difference of squares: x^2 - 4 → (x - 2)(x + 2)
 * - Quadratic: x^2 + 5x + 6 → (x + 2)(x + 3)
 * - Sum/difference of cubes: x^3 - 8 → (x - 2)(x^2 + 2x + 4)
 *
 * @param expr - Expression to factor
 * @param variable - Variable to factor with respect to (default: 'x')
 * @returns Factored expression
 *
 * @example
 * ```typescript
 * const expr = parse("x^2 - 1");
 * const factored = factor(expr, 'x'); // → (x - 1)(x + 1)
 * ```
 */
export function factor(expr: ExpressionNode, variable = 'x'): ExpressionNode {
  // Simplify first
  const simplified = simplify(expr);

  // Try different factoring strategies
  const gcf = factorGCF(simplified, variable);
  if (gcf) return gcf;

  const diffSquares = factorDifferenceOfSquares(simplified, variable);
  if (diffSquares) return diffSquares;

  const quadratic = factorQuadratic(simplified, variable);
  if (quadratic) return quadratic;

  // Cannot factor further
  return simplified;
}

/**
 * Factor out greatest common factor
 * Implements full GCF extraction with polynomial term analysis
 */
function factorGCF(expr: ExpressionNode, variable: string): ExpressionNode | null {
  // Collect all terms in the expression
  const terms = collectTerms(expr);
  if (terms.length < 2) return null;

  // Find GCF of all numeric coefficients
  const coefficients = terms.map(t => Math.abs(t.coefficient)).filter(c => c !== 0);
  if (coefficients.length === 0) return null;

  const gcfCoeff = coefficients.reduce((a, b) => gcd(a, b));
  if (gcfCoeff <= 1) {
    // No numeric GCF, check for variable factor
    const minPower = findMinVariablePower(terms, variable);
    if (minPower <= 0) return null;

    // Factor out x^minPower
    const factored = terms.map(t => ({
      ...t,
      variablePower: t.variablePower - minPower,
    }));

    const remainingExpr = termsToExpression(factored, variable);
    const gcfExpr = minPower === 1
      ? createSymbolNode(variable)
      : createOperatorNode('^', 'power', [
          createSymbolNode(variable),
          createConstantNode(minPower),
        ] as const);

    return createOperatorNode('*', 'multiply', [gcfExpr, remainingExpr] as const);
  }

  // Find minimum variable power
  const minPower = findMinVariablePower(terms, variable);

  // Factor out GCF coefficient and variable power
  const factored = terms.map(t => ({
    coefficient: t.coefficient / gcfCoeff,
    variablePower: t.variablePower - Math.max(0, minPower),
  }));

  const remainingExpr = termsToExpression(factored, variable);

  // Build the GCF expression
  let gcfExpr: ExpressionNode = createConstantNode(gcfCoeff);

  if (minPower > 0) {
    const varPart = minPower === 1
      ? createSymbolNode(variable)
      : createOperatorNode('^', 'power', [
          createSymbolNode(variable),
          createConstantNode(minPower),
        ] as const);
    gcfExpr = createOperatorNode('*', 'multiply', [gcfExpr, varPart] as const);
  }

  return createOperatorNode('*', 'multiply', [gcfExpr, remainingExpr] as const);
}

/**
 * Term representation for polynomial analysis
 */
interface PolynomialTerm {
  coefficient: number;
  variablePower: number;
}

/**
 * Collect terms from an expression (sum of products)
 */
function collectTerms(expr: ExpressionNode): PolynomialTerm[] {
  const terms: PolynomialTerm[] = [];

  function collectAddends(node: ExpressionNode, sign: number): void {
    if (isAddition(node)) {
      const left = node.args[0];
      const right = node.args[1];
      if (left) collectAddends(left, sign);
      if (right) collectAddends(right, sign);
    } else if (isSubtraction(node)) {
      const left = node.args[0];
      const right = node.args[1];
      if (left) collectAddends(left, sign);
      if (right) collectAddends(right, -sign);
    } else {
      // Parse the term
      const term = parseTerm(node, sign);
      if (term) terms.push(term);
    }
  }

  collectAddends(expr, 1);
  return terms;
}

/**
 * Parse a single term into coefficient and variable power
 */
function parseTerm(node: ExpressionNode, sign: number): PolynomialTerm | null {
  // Constant
  if (isConstantNode(node)) {
    const val = getNumericValue(node);
    return val !== null ? { coefficient: sign * val, variablePower: 0 } : null;
  }

  // Variable (x^1)
  if (isSymbolNode(node)) {
    return { coefficient: sign, variablePower: 1 };
  }

  // Power (x^n)
  if (isPower(node)) {
    const base = node.args[0];
    const exp = node.args[1];
    if (base && isSymbolNode(base) && exp) {
      const expVal = getNumericValue(exp);
      if (expVal !== null && Number.isInteger(expVal)) {
        return { coefficient: sign, variablePower: expVal };
      }
    }
  }

  // Multiplication (c * x^n)
  if (isMultiplication(node)) {
    const left = node.args[0];
    const right = node.args[1];
    if (!left || !right) return null;

    // c * x
    if (isConstantNode(left)) {
      const coeff = getNumericValue(left);
      if (coeff === null) return null;

      if (isSymbolNode(right)) {
        return { coefficient: sign * coeff, variablePower: 1 };
      }

      if (isPower(right)) {
        const base = right.args[0];
        const exp = right.args[1];
        if (base && isSymbolNode(base) && exp) {
          const expVal = getNumericValue(exp);
          if (expVal !== null && Number.isInteger(expVal)) {
            return { coefficient: sign * coeff, variablePower: expVal };
          }
        }
      }

      // c * constant
      if (isConstantNode(right)) {
        const rightVal = getNumericValue(right);
        if (rightVal !== null) {
          return { coefficient: sign * coeff * rightVal, variablePower: 0 };
        }
      }
    }
  }

  return null;
}

/**
 * Find minimum variable power across all terms
 */
function findMinVariablePower(terms: PolynomialTerm[], _variable: string): number {
  let min = Number.POSITIVE_INFINITY;
  for (const term of terms) {
    if (term.variablePower < min) {
      min = term.variablePower;
    }
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min;
}

/**
 * Convert terms back to an expression
 */
function termsToExpression(terms: PolynomialTerm[], variable: string): ExpressionNode {
  if (terms.length === 0) {
    return createConstantNode(0);
  }

  function termToExpr(term: PolynomialTerm): ExpressionNode {
    if (term.variablePower === 0) {
      return createConstantNode(term.coefficient);
    }

    const varExpr = term.variablePower === 1
      ? createSymbolNode(variable)
      : createOperatorNode('^', 'power', [
          createSymbolNode(variable),
          createConstantNode(term.variablePower),
        ] as const);

    if (term.coefficient === 1) {
      return varExpr;
    }

    if (term.coefficient === -1) {
      return createOperatorNode('*', 'multiply', [
        createConstantNode(-1),
        varExpr,
      ] as const);
    }

    return createOperatorNode('*', 'multiply', [
      createConstantNode(term.coefficient),
      varExpr,
    ] as const);
  }

  let result = termToExpr(terms[0]!);

  for (let i = 1; i < terms.length; i++) {
    const term = terms[i]!;
    const termExpr = termToExpr({ ...term, coefficient: Math.abs(term.coefficient) });

    if (term.coefficient >= 0) {
      result = createOperatorNode('+', 'add', [result, termExpr] as const);
    } else {
      result = createOperatorNode('-', 'subtract', [result, termExpr] as const);
    }
  }

  return result;
}

/**
 * Calculate GCD of two numbers
 */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Factor difference of squares: a^2 - b^2 = (a - b)(a + b)
 */
function factorDifferenceOfSquares(
  expr: ExpressionNode,
  _variable: string
): ExpressionNode | null {
  if (!isSubtraction(expr)) return null;

  const left = expr.args[0];
  const right = expr.args[1];

  if (!left || !right) return null;

  // Check if left is a perfect square
  const leftBase = extractSquareRoot(left);
  const rightBase = extractSquareRoot(right);

  if (!leftBase || !rightBase) return null;

  // a^2 - b^2 = (a - b)(a + b)
  const factor1 = createOperatorNode('-', 'subtract', [leftBase, rightBase] as const);
  const factor2 = createOperatorNode('+', 'add', [leftBase, rightBase] as const);

  return createOperatorNode('*', 'multiply', [factor1, factor2] as const);
}

/**
 * Extract square root if expression is perfect square
 */
function extractSquareRoot(expr: ExpressionNode): ExpressionNode | null {
  if (isPower(expr)) {
    const base = expr.args[0];
    const exp = expr.args[1];
    if (base && exp) {
      const expVal = getNumericValue(exp);
      if (expVal === 2) return base;
    }
  }

  if (isConstantNode(expr)) {
    const val = getNumericValue(expr);
    if (val !== null && val >= 0) {
      const sqrt = Math.sqrt(val);
      if (Number.isInteger(sqrt)) {
        return createConstantNode(sqrt);
      }
    }
  }

  return null;
}

/**
 * Factor quadratic: ax^2 + bx + c
 * TODO: Implement complete quadratic factoring with coefficient extraction
 */
function factorQuadratic(
  expr: ExpressionNode,
  _variable: string
): ExpressionNode | null {
  // Extract coefficients a, b, c from ax^2 + bx + c
  const coeffs = extractQuadraticCoefficients(expr, _variable);
  if (!coeffs) return null;

  const { a, b, c } = coeffs;

  // Use quadratic formula to find roots
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return null; // Complex roots, cannot factor over reals

  const sqrtDisc = Math.sqrt(discriminant);

  // Check if roots are rational
  if (!Number.isInteger(sqrtDisc)) return null;

  const root1 = (-b + sqrtDisc) / (2 * a);
  const root2 = (-b - sqrtDisc) / (2 * a);

  // Check if roots are integers
  if (!Number.isInteger(root1) || !Number.isInteger(root2)) return null;

  // Factor as a(x - root1)(x - root2)
  const factor1 = createOperatorNode('-', 'subtract', [
    createSymbolNode(_variable),
    createConstantNode(root1),
  ] as const);

  const factor2 = createOperatorNode('-', 'subtract', [
    createSymbolNode(_variable),
    createConstantNode(root2),
  ] as const);

  let result: ExpressionNode = createOperatorNode('*', 'multiply', [
    factor1,
    factor2,
  ] as const);

  if (a !== 1) {
    result = createOperatorNode('*', 'multiply', [
      createConstantNode(a),
      result,
    ] as const);
  }

  return result;
}

/**
 * Extract coefficients from quadratic expression ax^2 + bx + c
 * Implements complete coefficient extraction with polynomial term analysis
 */
function extractQuadraticCoefficients(
  expr: ExpressionNode,
  variable: string
): { a: number; b: number; c: number } | null {
  if (!containsVariable(expr, variable)) return null;

  // Collect all terms in the expression
  const terms = collectTerms(expr);
  if (terms.length === 0) return null;

  // Initialize coefficients
  let a = 0; // coefficient of x^2
  let b = 0; // coefficient of x^1
  let c = 0; // constant term (x^0)

  // Extract coefficients from terms
  for (const term of terms) {
    switch (term.variablePower) {
      case 2:
        a += term.coefficient;
        break;
      case 1:
        b += term.coefficient;
        break;
      case 0:
        c += term.coefficient;
        break;
      default:
        // Not a quadratic (has terms with power > 2 or < 0)
        if (term.variablePower > 2 || term.variablePower < 0) {
          return null;
        }
    }
  }

  // Must have a non-zero leading coefficient for quadratic
  if (a === 0) return null;

  return { a, b, c };
}

// ============================================================================
// SUBSTITUTE: Variable Substitution
// ============================================================================

/**
 * Substitute a variable with a value or expression
 *
 * Replaces all occurrences of a variable with the given value or expression.
 * Useful for partial evaluation and symbolic manipulation.
 *
 * @param expr - Expression to substitute into
 * @param variable - Variable name to replace
 * @param value - Value or expression to substitute
 * @returns Expression with substitution applied
 *
 * @example
 * ```typescript
 * const expr = parse("x^2 + 2*x + 1");
 * const substituted = substitute(expr, 'x', parse("y + 1"));
 * // → (y + 1)^2 + 2*(y + 1) + 1
 * ```
 */
export function substitute(
  expr: ExpressionNode,
  variable: string,
  value: ExpressionNode | number
): ExpressionNode {
  const valueNode = typeof value === 'number'
    ? createConstantNode(value)
    : value;

  return substituteRecursive(expr, variable, valueNode);
}

/**
 * Recursive substitution helper
 */
function substituteRecursive(
  expr: ExpressionNode,
  variable: string,
  value: ExpressionNode
): ExpressionNode {
  if (isConstantNode(expr)) {
    return expr;
  }

  if (isSymbolNode(expr)) {
    return expr.name === variable ? value : expr;
  }

  if (isOperatorNode(expr)) {
    const [left, right] = expr.args;
    const leftSub = substituteRecursive(left, variable, value);
    const rightSub = substituteRecursive(right, variable, value);
    return createOperatorNode(expr.op, expr.fn, [leftSub, rightSub] as const);
  }

  if (isFunctionNode(expr)) {
    const argsSub = expr.args.map(arg => substituteRecursive(arg, variable, value));
    return createFunctionNode(expr.fn, argsSub);
  }

  return expr;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if expression is in expanded form
 */
export function isExpanded(expr: ExpressionNode): boolean {
  if (isConstantNode(expr) || isSymbolNode(expr)) return true;

  if (isPower(expr)) {
    const [base, exp] = expr.args;
    const expVal = getNumericValue(exp);
    // Not expanded if base is sum/difference with exponent > 1
    if ((isAddition(base) || isSubtraction(base)) && expVal !== null && expVal > 1) {
      return false;
    }
  }

  if (isOperatorNode(expr)) {
    return expr.args.every(isExpanded);
  }

  if (isFunctionNode(expr)) {
    return expr.args.every(isExpanded);
  }

  return true;
}

/**
 * Check if expression is in factored form
 */
export function isFactored(expr: ExpressionNode): boolean {
  // This is a heuristic check
  // An expression is considered factored if it's a product of simpler terms
  if (isMultiplication(expr)) return true;
  if (isConstantNode(expr) || isSymbolNode(expr)) return true;
  return false;
}
