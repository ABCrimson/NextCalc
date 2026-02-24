/**
 * Symbolic Integration Engine
 *
 * Implements pattern-matching integration for common forms:
 * 1. Power rule: ∫x^n dx = x^(n+1)/(n+1) + C
 * 2. Exponential: ∫e^x dx = e^x + C
 * 3. Logarithmic: ∫1/x dx = ln|x| + C
 * 4. Trigonometric: ∫sin(x) dx = -cos(x) + C, etc.
 * 5. Linearity: ∫(f + g) dx = ∫f dx + ∫g dx
 * 6. Integration by parts (IBP): ∫u dv = u·v − ∫v du (LIATE heuristic)
 *
 * Falls back to numerical integration for complex expressions.
 */

import type {
  ExpressionNode,
  ConstantNode,
  OperatorNode,
  MathFunction,
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
import { parse } from '../parser/parser';
import { evaluate } from '../parser/evaluator';
import { differentiate } from './differentiate';

/**
 * Check if an expression tree contains a given variable
 */
function containsVariable(expr: ExpressionNode, variable: string): boolean {
  if (isConstantNode(expr)) return false;
  if (isSymbolNode(expr)) return expr.name === variable;
  if (isOperatorNode(expr)) return expr.args.some(a => containsVariable(a, variable));
  if (isFunctionNode(expr)) return expr.args.some(a => containsVariable(a, variable));
  return false;
}

/**
 * Result of flattening a multiply tree into its constituent parts.
 * The constant accumulates all numeric scalar factors; factors holds
 * all sub-expressions that depend on the integration variable.
 */
interface FlattenedMultiply {
  constant: number;
  factors: ExpressionNode[];
}

/**
 * Recursively flatten a chain of multiplications into:
 *   - a single accumulated numeric constant
 *   - an array of non-constant factor nodes
 *
 * Example:
 *   flattenMultiply((-1 * cos(x)) * (2 * x))
 *   → { constant: -2, factors: [cos(x), x] }
 *
 * This is the key helper that enables the constant-multiple rule to work
 * even when constants are buried inside nested multiply trees produced
 * by integration-by-parts recursion.
 */
function flattenMultiply(expr: ExpressionNode): FlattenedMultiply {
  if (isConstantNode(expr)) {
    return { constant: Number(expr.value), factors: [] };
  }

  if (isOperatorNode(expr) && expr.op === '*') {
    const leftFlat = flattenMultiply(expr.args[0]);
    const rightFlat = flattenMultiply(expr.args[1]);
    return {
      constant: leftFlat.constant * rightFlat.constant,
      factors: [...leftFlat.factors, ...rightFlat.factors],
    };
  }

  // Division by a constant: extract 1/c as the constant factor.
  // e.g. x^2/2 → { constant: 0.5, factors: [x^2] }
  if (isOperatorNode(expr) && expr.op === '/') {
    const numerator = expr.args[0];
    const denominator = expr.args[1];
    if (isConstantNode(denominator)) {
      const numFlat = flattenMultiply(numerator);
      return {
        constant: numFlat.constant / Number(denominator.value),
        factors: numFlat.factors,
      };
    }
  }

  // Anything that is not a constant or a product is a variable factor
  return { constant: 1, factors: [expr] };
}

/**
 * Rebuild a product expression from a constant and a list of factors.
 * Returns a single ExpressionNode representing constant * f0 * f1 * ...
 *
 * Edge cases handled:
 *  - No factors and constant === 1  → ConstantNode(1)
 *  - Single factor, constant === 1  → the factor itself
 *  - Multiple factors               → left-associative multiply tree
 *  - constant !== 1                 → prepend the constant to the tree
 */
function buildProduct(constant: number, factors: ExpressionNode[]): ExpressionNode {
  if (factors.length === 0) {
    return createConstantNode(constant);
  }

  // Build left-associative product of all factors
  let product: ExpressionNode = factors[0]!;
  for (let i = 1; i < factors.length; i++) {
    product = createOperatorNode('*', 'multiply', [product, factors[i]!] as const);
  }

  if (constant === 1) return product;
  return createOperatorNode('*', 'multiply', [createConstantNode(constant), product] as const);
}

/**
 * Extract the power of a variable from an expression, if it is a simple power form.
 * Returns the exponent if the expression is of the form:
 *   x      → 1
 *   x^n    → n  (where n is a constant)
 *   1/x    → -1
 *   1/x^n  → -n
 *   c/x    → -1 (c is constant, extracted separately)
 *   c/x^n  → -n
 * Returns null if the expression is not a simple power of the variable.
 */
function extractVariablePower(expr: ExpressionNode, variable: string): { power: number; coefficient: number } | null {
  // x → power 1
  if (isSymbolNode(expr) && expr.name === variable) {
    return { power: 1, coefficient: 1 };
  }

  // x^n → power n
  if (
    isOperatorNode(expr) &&
    expr.op === '^' &&
    isSymbolNode(expr.args[0]) &&
    expr.args[0].name === variable &&
    isConstantNode(expr.args[1])
  ) {
    return { power: Number(expr.args[1].value), coefficient: 1 };
  }

  // c/x^n or c/x patterns
  if (isOperatorNode(expr) && expr.op === '/') {
    const numerator = expr.args[0];
    const denominator = expr.args[1];

    // 1/x → power -1
    if (
      isConstantNode(numerator) &&
      isSymbolNode(denominator) &&
      denominator.name === variable
    ) {
      return { power: -1, coefficient: Number(numerator.value) };
    }

    // 1/x^n → power -n
    if (
      isConstantNode(numerator) &&
      isOperatorNode(denominator) &&
      denominator.op === '^' &&
      isSymbolNode(denominator.args[0]) &&
      denominator.args[0].name === variable &&
      isConstantNode(denominator.args[1])
    ) {
      return { power: -Number(denominator.args[1].value), coefficient: Number(numerator.value) };
    }
  }

  return null;
}

/**
 * Simplify a list of factors by combining powers of the integration variable.
 *
 * Example:
 *   [x^2, 1/x] → { constant: 1, simplified: x }
 *   (because x^2 * x^-1 = x^1)
 *
 * Factors that are not simple powers of the variable are left unchanged.
 * Returns a new constant multiplier and simplified factor list.
 */
function simplifyFactors(
  constant: number,
  factors: ExpressionNode[],
  variable: string
): { constant: number; factors: ExpressionNode[] } {
  let combinedPower = 0;
  let combinedCoeff = 1;
  let hasPowerFactors = false;
  const nonPowerFactors: ExpressionNode[] = [];

  for (const factor of factors) {
    const powerInfo = extractVariablePower(factor, variable);
    if (powerInfo !== null) {
      combinedPower += powerInfo.power;
      combinedCoeff *= powerInfo.coefficient;
      hasPowerFactors = true;
    } else {
      nonPowerFactors.push(factor);
    }
  }

  if (!hasPowerFactors) {
    return { constant, factors };
  }

  const newConstant = constant * combinedCoeff;
  const newFactors = [...nonPowerFactors];

  // Rebuild the combined power as a single expression
  if (combinedPower === 0) {
    // x^0 = 1 — no variable factor needed
  } else if (combinedPower === 1) {
    newFactors.push(createSymbolNode(variable));
  } else {
    newFactors.push(
      createOperatorNode('^', 'pow', [
        createSymbolNode(variable),
        createConstantNode(combinedPower),
      ] as const)
    );
  }

  return { constant: newConstant, factors: newFactors };
}

/**
 * LIATE ranking for integration by parts heuristic.
 * Lower rank = better choice for u (differentiate it away).
 *
 * Ranks:
 *   0 – Logarithmic
 *   1 – Inverse trigonometric
 *   2 – Algebraic (polynomials, constants)
 *   3 – Trigonometric
 *   4 – Exponential / hyperbolic
 *
 * FIX: For multiply/divide nodes the old code used Math.min which caused
 * a product like (-1 * cos(x)) to rank as 2 (algebraic) instead of 3
 * (trig).  The correct behaviour is:
 *   • Ignore pure-constant factors (rank 2 from a numeric constant has no
 *     meaningful category — it is just a scalar).
 *   • Return the rank of the dominant non-constant sub-expression.
 *   • Fall back to 2 if all factors are constants.
 */
function liateRank(expr: ExpressionNode, variable: string): number {
  if (isFunctionNode(expr)) {
    const fn = expr.fn;
    if (fn === 'log' || fn === 'ln' || fn === 'log10' || fn === 'log2') return 0;
    if (fn === 'asin' || fn === 'acos' || fn === 'atan' || fn === 'asec' || fn === 'acsc' || fn === 'acot') return 1;
    if (fn === 'sin' || fn === 'cos' || fn === 'tan' || fn === 'sec' || fn === 'csc' || fn === 'cot') return 3;
    if (fn === 'exp' || fn === 'sinh' || fn === 'cosh' || fn === 'tanh') return 4;
  }

  if (isConstantNode(expr)) return 2; // treat constant as algebraic
  if (isSymbolNode(expr)) return 2;   // variable = algebraic

  if (isOperatorNode(expr)) {
    // x^n where n is a constant → algebraic / polynomial
    if (
      expr.op === '^' &&
      isSymbolNode(expr.args[0]) &&
      isConstantNode(expr.args[1])
    ) {
      return 2;
    }

    if (expr.op === '*') {
      // FIX: Flatten the entire multiply subtree and rank its non-constant
      // factors.  A product that contains only constants still ranks as
      // algebraic (2).
      const { factors } = flattenMultiply(expr);
      if (factors.length === 0) return 2;

      // Return the minimum rank among the non-constant factors.
      // "Minimum" because the factor with the lowest LIATE number is the one
      // that defines what category the whole product belongs to for the
      // purpose of choosing u.
      return Math.min(...factors.map(f => liateRank(f, variable)));
    }

    if (expr.op === '/') {
      // For division nodes, rank based on the numerator and denominator
      // directly to avoid infinite recursion (flattenMultiply only handles
      // division by constants, so non-constant denominators would loop).
      const numRank = liateRank(expr.args[0], variable);
      const denRank = liateRank(expr.args[1], variable);
      return Math.min(numRank, denRank);
    }
  }

  return 2; // default: treat as algebraic
}

/**
 * Integration rule interface
 */
interface IntegrationRule {
  name: string;
  pattern: (expr: ExpressionNode, variable: string) => boolean;
  apply: (expr: ExpressionNode, variable: string) => ExpressionNode;
  priority: number;
}

/**
 * Integration engine with pattern matching
 */
class IntegrationEngine {
  private rules: IntegrationRule[] = [];

  constructor() {
    this.registerBuiltInRules();
  }

  private registerBuiltInRules() {
    // Constant rule: ∫k dx = kx + C
    this.addRule({
      name: 'constant-rule',
      priority: 5,
      pattern: (expr, _variable) => {
        if (!isConstantNode(expr)) return false;
        return true;
      },
      apply: (_expr, variable) => {
        return createOperatorNode('*', 'multiply', [
          _expr,
          createSymbolNode(variable),
        ] as const);
      },
    });

    // Variable rule: ∫x dx = x²/2 + C
    this.addRule({
      name: 'variable-rule',
      priority: 10,
      pattern: (expr, _variable) => {
        return isSymbolNode(expr) && expr.name === _variable;
      },
      apply: (_expr, variable) => {
        return createOperatorNode('/', 'divide', [
          createOperatorNode('^', 'pow', [
            createSymbolNode(variable),
            createConstantNode(2),
          ] as const),
          createConstantNode(2),
        ] as const);
      },
    });

    // Power rule: ∫x^n dx = x^(n+1)/(n+1) + C
    this.addRule({
      name: 'power-rule',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isOperatorNode(expr)) return false;
        if (expr.op !== '^') return false;

        const base = expr.args[0];
        const exponent = expr.args[1];
        if (!base || !exponent) return false;
        return (
          isSymbolNode(base) &&
          base.name === variable &&
          isConstantNode(exponent)
        );
      },
      apply: (expr, variable) => {
        const power = expr as OperatorNode;
        const exponentNode = power.args[1];
        if (!exponentNode) {
          throw new Error('Power rule requires exponent');
        }
        const exponent = exponentNode as ConstantNode;
        const n = Number(exponent.value);

        if (n === -1) {
          // Special case: ∫x^(-1) dx = ln|x| + C
          return createFunctionNode('log', [createSymbolNode(variable)]);
        }

        // ∫x^n dx = x^(n+1)/(n+1)
        return createOperatorNode('/', 'divide', [
          createOperatorNode('^', 'pow', [
            createSymbolNode(variable),
            createConstantNode(n + 1),
          ] as const),
          createConstantNode(n + 1),
        ] as const);
      },
    });

    // Exponential rule: ∫e^x dx = e^x + C
    this.addRule({
      name: 'exponential-e',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'exp') return false;

        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (expr, _variable) => expr, // e^x integrates to itself
    });

    // Logarithm rule: ∫ln(x) dx = x*ln(x) - x + C
    this.addRule({
      name: 'logarithm',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        // Support both 'log' and 'ln' function names
        if (expr.fn !== 'log' && expr.fn !== 'ln') return false;

        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (expr, variable) => {
        // ∫ln(x) dx = x*ln(x) - x
        const x = createSymbolNode(variable);
        const lnX = expr; // Keep original log/ln function

        return createOperatorNode('-', 'subtract', [
          createOperatorNode('*', 'multiply', [x, lnX] as const),
          x,
        ] as const);
      },
    });

    // Logarithm with base 10: ∫log10(x) dx = x*log10(x) - x/ln(10)
    this.addRule({
      name: 'logarithm-base10',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'log10') return false;

        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (expr, variable) => {
        const x = createSymbolNode(variable);

        return createOperatorNode('-', 'subtract', [
          createOperatorNode('*', 'multiply', [x, expr] as const),
          createOperatorNode('/', 'divide', [
            x,
            createFunctionNode('log', [createConstantNode(10)]),
          ] as const),
        ] as const);
      },
    });

    // Logarithm with base 2: ∫log2(x) dx = x*log2(x) - x/ln(2)
    this.addRule({
      name: 'logarithm-base2',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'log2') return false;

        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (expr, variable) => {
        const x = createSymbolNode(variable);

        return createOperatorNode('-', 'subtract', [
          createOperatorNode('*', 'multiply', [x, expr] as const),
          createOperatorNode('/', 'divide', [
            x,
            createFunctionNode('log', [createConstantNode(2)]),
          ] as const),
        ] as const);
      },
    });

    // Exponential with constant base: ∫a^x dx = a^x/ln(a) + C
    this.addRule({
      name: 'exponential-constant-base',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isOperatorNode(expr)) return false;
        if (expr.op !== '^') return false;

        const base = expr.args[0];
        const exponent = expr.args[1];

        if (!base || !exponent) return false;

        // Check if base is a positive constant and exponent is the variable
        return (
          isConstantNode(base) &&
          typeof base.value === 'number' &&
          base.value > 0 &&
          base.value !== 1 &&
          isSymbolNode(exponent) &&
          exponent.name === variable
        );
      },
      apply: (expr, _variable) => {
        const power = expr as OperatorNode;
        const base = power.args[0] as ConstantNode;

        // ∫a^x dx = a^x / ln(a)
        return createOperatorNode('/', 'divide', [
          expr, // a^x
          createFunctionNode('log', [base]), // ln(a)
        ] as const);
      },
    });

    // Trigonometric rules
    this.addTrigRules();

    // Integration by parts for product forms: ∫u·dv = u·v − ∫v·du
    this.addIntegrationByParts();

    // Sum/Difference rule: ∫(f + g) dx = ∫f dx + ∫g dx
    // Constant multiple rule: ∫(c * f) dx = c * ∫f dx
    this.addLinearityRules();
  }

  private addTrigRules() {
    const trigRules: Array<{
      from: string;
      to: string | ((variable: string) => ExpressionNode);
      sign?: -1 | 1;
    }> = [
      { from: 'sin', to: 'cos', sign: -1 },
      { from: 'cos', to: 'sin', sign: 1 },
      { from: 'tan', to: (v) => createFunctionNode('log', [createFunctionNode('abs', [createFunctionNode('sec', [createSymbolNode(v)])])]), sign: 1 },
      { from: 'sec', to: (v) => createFunctionNode('log', [createFunctionNode('abs', [createOperatorNode('+', 'add', [createFunctionNode('sec', [createSymbolNode(v)]), createFunctionNode('tan', [createSymbolNode(v)])] as const)])]), sign: 1 },
      { from: 'csc', to: (v) => createFunctionNode('log', [createFunctionNode('abs', [createOperatorNode('+', 'add', [createFunctionNode('csc', [createSymbolNode(v)]), createFunctionNode('cot', [createSymbolNode(v)])] as const)])]), sign: -1 },
      { from: 'cot', to: (v) => createFunctionNode('log', [createFunctionNode('abs', [createFunctionNode('sin', [createSymbolNode(v)])])]), sign: 1 },
    ];

    for (const rule of trigRules) {
      this.addRule({
        name: `trig-${rule.from}`,
        priority: 10,
        pattern: (expr, variable) => {
          if (!isFunctionNode(expr)) return false;
          if (expr.fn !== rule.from) return false;

          const arg = expr.args[0];
          if (!arg) return false;
          return isSymbolNode(arg) && arg.name === variable;
        },
        apply: (_expr, variable) => {
          const resultFn = typeof rule.to === 'string'
            ? createFunctionNode(rule.to as MathFunction, [createSymbolNode(variable)])
            : rule.to(variable);

          return rule.sign === -1
            ? createOperatorNode('*', 'multiply', [
                createConstantNode(-1),
                resultFn,
              ] as const)
            : resultFn;
        },
      });
    }

    // Add hyperbolic function rules
    this.addRule({
      name: 'sinh-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'sinh') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => createFunctionNode('cosh', [createSymbolNode(variable)]),
    });

    this.addRule({
      name: 'cosh-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'cosh') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => createFunctionNode('sinh', [createSymbolNode(variable)]),
    });

    this.addRule({
      name: 'tanh-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'tanh') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) =>
        createFunctionNode('log', [createFunctionNode('cosh', [createSymbolNode(variable)])]),
    });

    // Inverse trigonometric function rules
    this.addRule({
      name: 'asin-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'asin') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => {
        const x = createSymbolNode(variable);
        // ∫asin(x)dx = x*asin(x) + sqrt(1-x²)
        return createOperatorNode('+', 'add', [
          createOperatorNode('*', 'multiply', [x, _expr] as const),
          createFunctionNode('sqrt', [
            createOperatorNode('-', 'subtract', [
              createConstantNode(1),
              createOperatorNode('^', 'pow', [x, createConstantNode(2)] as const),
            ] as const),
          ]),
        ] as const);
      },
    });

    this.addRule({
      name: 'acos-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'acos') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => {
        const x = createSymbolNode(variable);
        // ∫acos(x)dx = x*acos(x) - sqrt(1-x²)
        return createOperatorNode('-', 'subtract', [
          createOperatorNode('*', 'multiply', [x, _expr] as const),
          createFunctionNode('sqrt', [
            createOperatorNode('-', 'subtract', [
              createConstantNode(1),
              createOperatorNode('^', 'pow', [x, createConstantNode(2)] as const),
            ] as const),
          ]),
        ] as const);
      },
    });

    this.addRule({
      name: 'atan-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'atan') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => {
        const x = createSymbolNode(variable);
        // ∫atan(x)dx = x*atan(x) - ln(1+x²)/2
        return createOperatorNode('-', 'subtract', [
          createOperatorNode('*', 'multiply', [x, _expr] as const),
          createOperatorNode('/', 'divide', [
            createFunctionNode('log', [
              createOperatorNode('+', 'add', [
                createConstantNode(1),
                createOperatorNode('^', 'pow', [x, createConstantNode(2)] as const),
              ] as const),
            ]),
            createConstantNode(2),
          ] as const),
        ] as const);
      },
    });

    this.addRule({
      name: 'asec-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'asec') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => {
        const x = createSymbolNode(variable);
        // ∫asec(x)dx = x*asec(x) - ln(x + sqrt(x²-1))
        return createOperatorNode('-', 'subtract', [
          createOperatorNode('*', 'multiply', [x, _expr] as const),
          createFunctionNode('log', [
            createOperatorNode('+', 'add', [
              x,
              createFunctionNode('sqrt', [
                createOperatorNode('-', 'subtract', [
                  createOperatorNode('^', 'pow', [x, createConstantNode(2)] as const),
                  createConstantNode(1),
                ] as const),
              ]),
            ] as const),
          ]),
        ] as const);
      },
    });

    this.addRule({
      name: 'acsc-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'acsc') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => {
        const x = createSymbolNode(variable);
        // ∫acsc(x)dx = x*acsc(x) + ln(x + sqrt(x²-1))
        return createOperatorNode('+', 'add', [
          createOperatorNode('*', 'multiply', [x, _expr] as const),
          createFunctionNode('log', [
            createOperatorNode('+', 'add', [
              x,
              createFunctionNode('sqrt', [
                createOperatorNode('-', 'subtract', [
                  createOperatorNode('^', 'pow', [x, createConstantNode(2)] as const),
                  createConstantNode(1),
                ] as const),
              ]),
            ] as const),
          ]),
        ] as const);
      },
    });

    this.addRule({
      name: 'acot-integral',
      priority: 10,
      pattern: (expr, variable) => {
        if (!isFunctionNode(expr)) return false;
        if (expr.fn !== 'acot') return false;
        const arg = expr.args[0];
        if (!arg) return false;
        return isSymbolNode(arg) && arg.name === variable;
      },
      apply: (_expr, variable) => {
        const x = createSymbolNode(variable);
        // ∫acot(x)dx = x*acot(x) + ln(1+x²)/2
        return createOperatorNode('+', 'add', [
          createOperatorNode('*', 'multiply', [x, _expr] as const),
          createOperatorNode('/', 'divide', [
            createFunctionNode('log', [
              createOperatorNode('+', 'add', [
                createConstantNode(1),
                createOperatorNode('^', 'pow', [x, createConstantNode(2)] as const),
              ] as const),
            ]),
            createConstantNode(2),
          ] as const),
        ] as const);
      },
    });
  }

  /**
   * Integration by parts: ∫u·dv = u·v − ∫v·du
   * Uses LIATE heuristic to choose u:
   *   L(og) > I(nverse trig) > A(lgebraic) > T(rig) > E(xponential)
   * The earlier category becomes u, the later becomes dv.
   *
   * FIX: The old pattern only matched when one rank ≤ 2 AND the other ≥ 3.
   * That fails for compound multiply nodes like (-1*cos(x))*(2*x) because
   * the ranks are 3 and 2 — condition satisfied — but rank comparison on
   * the raw node returned 2 for both.  We now use the fixed liateRank which
   * correctly ignores scalar constants when ranking a product.
   *
   * Additionally the pattern is relaxed: IBP is attempted whenever the two
   * factors have strictly DIFFERENT ranks (not just one ≤ 2 and other ≥ 3).
   * This covers L*T, L*E, I*T, I*E, A*T, A*E cases.
   */
  private addIntegrationByParts() {
    this.addRule({
      name: 'integration-by-parts',
      // Lower priority than basic rules so they are tried first
      priority: 3,
      pattern: (expr, variable) => {
        if (!isOperatorNode(expr) || expr.op !== '*') return false;

        // Flatten the multiply tree to extract the real factors
        const { constant: _c, factors } = flattenMultiply(expr);
        // After extracting constants we need at least two variable factors
        const varFactors = factors.filter(f => containsVariable(f, variable));
        if (varFactors.length < 2) return false;

        // Pair up: try the first two variable factors
        const leftRank = liateRank(varFactors[0]!, variable);
        const rightRank = liateRank(varFactors[1]!, variable);

        // IBP is useful when the two primary factors have different LIATE ranks
        // (i.e. one can be differentiated away while the other can be integrated)
        return leftRank !== rightRank;
      },
      apply: (expr, variable) => {
        const { constant, factors } = flattenMultiply(expr);
        const varFactors = factors.filter(f => containsVariable(f, variable));

        // Choose u (lower rank) and dv (higher rank) from the first two variable factors
        const leftRank = liateRank(varFactors[0]!, variable);
        const rightRank = liateRank(varFactors[1]!, variable);
        const [u, dv] = leftRank <= rightRank
          ? [varFactors[0]!, varFactors[1]!]
          : [varFactors[1]!, varFactors[0]!];

        const ibpResult = this.applyIBP(u, dv, variable, 0);

        // Re-apply the overall constant factor (scalar extracted from the tree)
        if (constant === 1) return ibpResult;
        return createOperatorNode('*', 'multiply', [createConstantNode(constant), ibpResult] as const);
      },
    });
  }

  /**
   * Recursively apply integration by parts: ∫u·dv = u·v − ∫v·du
   * @param depth - current recursion depth; prevents infinite loops
   */
  private applyIBP(u: ExpressionNode, dv: ExpressionNode, variable: string, depth: number): ExpressionNode {
    if (depth > 4) {
      throw new Error('Integration by parts exceeded maximum depth');
    }

    // v = ∫dv
    const v = this.integrate(dv, variable);
    // du = d(u)/dx
    const du = differentiate(u, variable);

    // u·v
    const uv = createOperatorNode('*', 'multiply', [u, v] as const);

    // Early exit: if du = 0 then ∫u dv = u*v (u was a constant, shouldn't happen
    // but guard against it).
    if (isConstantNode(du) && Number(du.value) === 0) {
      return uv;
    }

    // Build v·du and try to integrate it.
    // Key insight: before recursing, flatten the product v*du and extract any
    // scalar constants.  This ensures that a product like (-cos(x)) * (2*x)
    // — which arises after the first IBP step for x^2*sin(x) — gets handled
    // by the constant-multiple rule before IBP is attempted again.
    const vduRaw = flattenMultiply(createOperatorNode('*', 'multiply', [v, du] as const));

    // Simplify by combining powers of the variable.
    // e.g. x^2 * (1/x) → x (from IBP of x*ln(x): v=x²/2, du=1/x)
    const vduFlat = simplifyFactors(vduRaw.constant, vduRaw.factors, variable);

    let integralVdu: ExpressionNode;

    try {
      if (vduFlat.constant === 0) {
        // v*du is identically zero
        return uv;
      }

      if (vduFlat.factors.length === 0) {
        // v*du reduces to a plain constant → ∫c dx = c*x
        integralVdu = createOperatorNode('*', 'multiply', [
          createConstantNode(vduFlat.constant),
          createSymbolNode(variable),
        ] as const);
      } else {
        // Rebuild the product with the extracted constant and try integration.
        // The constant-multiple rule (priority 2) or IBP rule (priority 3) will
        // handle the result.  Pass depth+1 into IBP via the patched apply closure.
        const vduExpr = buildProduct(vduFlat.constant, vduFlat.factors);

        const ibpRule = this.rules.find(r => r.name === 'integration-by-parts');
        if (ibpRule) {
          const origApply = ibpRule.apply;
          ibpRule.apply = (e, v2) => {
            const { constant: c2, factors: fs2 } = flattenMultiply(e);
            const varFs = fs2.filter(f => containsVariable(f, v2));
            const lR = liateRank(varFs[0]!, v2);
            const rR = liateRank(varFs[1]!, v2);
            const [u2, dv2] = lR <= rR ? [varFs[0]!, varFs[1]!] : [varFs[1]!, varFs[0]!];
            const ibpRes = this.applyIBP(u2, dv2, v2, depth + 1);
            if (c2 === 1) return ibpRes;
            return createOperatorNode('*', 'multiply', [createConstantNode(c2), ibpRes] as const);
          };
          try {
            integralVdu = this.integrate(vduExpr, variable);
          } finally {
            ibpRule.apply = origApply;
          }
        } else {
          integralVdu = this.integrate(createOperatorNode('*', 'multiply', [v, du] as const), variable);
        }
      }
    } catch {
      throw new Error('Cannot integrate expression (integration by parts failed). Try numerical integration instead.');
    }

    // u·v − ∫v·du
    return createOperatorNode('-', 'subtract', [uv, integralVdu] as const);
  }

  private addLinearityRules() {
    // Sum rule: ∫(f + g) dx = ∫f dx + ∫g dx
    this.addRule({
      name: 'sum-rule',
      priority: 1,
      pattern: (expr, _variable) => isOperatorNode(expr) && expr.op === '+',
      apply: (expr, variable) => {
        const op = expr as OperatorNode;
        const left = op.args[0];
        const right = op.args[1];
        if (!left || !right) {
          throw new Error('Sum rule requires two operands');
        }

        return createOperatorNode('+', 'add', [
          this.integrate(left, variable),
          this.integrate(right, variable),
        ] as const);
      },
    });

    // Difference rule: ∫(f - g) dx = ∫f dx - ∫g dx
    this.addRule({
      name: 'difference-rule',
      priority: 1,
      pattern: (expr, _variable) => isOperatorNode(expr) && expr.op === '-',
      apply: (expr, variable) => {
        const op = expr as OperatorNode;
        const left = op.args[0];
        const right = op.args[1];
        if (!left || !right) {
          throw new Error('Difference rule requires two operands');
        }

        return createOperatorNode('-', 'subtract', [
          this.integrate(left, variable),
          this.integrate(right, variable),
        ] as const);
      },
    });

    /**
     * Constant multiple rule: ∫(c * f) dx = c * ∫f dx
     *
     * FIX: The old rule only matched when the direct left or right child was a
     * ConstantNode.  That missed cases produced by IBP such as:
     *   (-1 * cos(x)) * (2 * x)
     * where neither direct child is a ConstantNode.
     *
     * The new rule uses flattenMultiply to pull ALL numeric scalar factors
     * out of any depth in the multiply tree.  If there is at least one
     * non-unity constant buried anywhere, we extract it and integrate only
     * the remaining expression.
     */
    this.addRule({
      name: 'constant-multiple-rule',
      priority: 2,
      pattern: (expr, variable) => {
        if (!isOperatorNode(expr)) return false;
        if (expr.op !== '*') return false;

        const { constant, factors } = flattenMultiply(expr);

        // Rule applies when there is a non-trivial scalar constant AND at least
        // one variable-dependent factor remaining.
        if (constant === 1) return false;
        if (factors.filter(f => containsVariable(f, variable)).length === 0) return false;
        return true;
      },
      apply: (expr, variable) => {
        const { constant, factors } = flattenMultiply(expr);
        const varFactors = factors.filter(f => containsVariable(f, variable));
        const innerExpr = buildProduct(1, varFactors);

        return createOperatorNode('*', 'multiply', [
          createConstantNode(constant),
          this.integrate(innerExpr, variable),
        ] as const);
      },
    });
  }

  addRule(rule: IntegrationRule) {
    this.rules.push(rule);
  }

  integrate(expr: ExpressionNode, variable: string): ExpressionNode {
    // Check for special (non-elementary) functions that have symbolic representations.
    // Returns a result node when the integral resolves to a named special function,
    // or throws when no representation exists at all.
    const specialResult = this.handleSpecialFunctions(expr, variable);
    if (specialResult !== null) {
      return specialResult;
    }

    // Try each rule in priority order (highest priority first)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.pattern(expr, variable)) {
        return rule.apply(expr, variable);
      }
    }

    // No rule matched
    throw new Error(
      `Cannot integrate expression (no matching rule). Try numerical integration instead.`
    );
  }

  /**
   * Handle expressions whose integrals are named special functions.
   *
   * Returns an ExpressionNode representing the special-function result when
   * the integrand is a recognised non-elementary form.
   *
   * Returns null when the expression is not a known special-function form
   * (letting normal rule matching proceed).
   *
   * Throws when a non-elementary form is detected but has no implemented
   * special-function representation.
   *
   * Recognised forms:
   *   ∫ sin(x)/x dx  = Si(x)   — Sine Integral
   *   ∫ cos(x)/x dx  = Ci(x)   — Cosine Integral  (principal value)
   *   ∫ 1/ln(x) dx  = li(x)   — Logarithmic Integral
   *   ∫ exp(x²) dx  = (√π/2)·erf(x)  — Error Function (throws, not implementable here)
   */
  private handleSpecialFunctions(expr: ExpressionNode, variable: string): ExpressionNode | null {
    // ∫exp(x^2) dx  →  not representable without erf; throw a descriptive error
    if (isFunctionNode(expr) && expr.fn === 'exp') {
      const expArg = expr.args[0];
      if (
        expArg &&
        isOperatorNode(expArg) &&
        expArg.op === '^' &&
        isSymbolNode(expArg.args[0]) &&
        expArg.args[0].name === variable &&
        isConstantNode(expArg.args[1]) &&
        expArg.args[1].value === 2
      ) {
        throw new Error(
          `∫exp(${variable}²) requires the Error Function erf(${variable}), ` +
          `which is not expressible in elementary functions. ` +
          `Use numerical integration instead.`
        );
      }
    }

    // Division-based special functions
    if (isOperatorNode(expr) && expr.op === '/') {
      const numerator = expr.args[0];
      const denominator = expr.args[1];
      if (!numerator || !denominator) return null;

      // ∫ sin(x)/x dx = Si(x)  — Sine Integral
      if (
        isFunctionNode(numerator) &&
        numerator.fn === 'sin' &&
        isSymbolNode(denominator) &&
        denominator.name === variable
      ) {
        const sinArg = numerator.args[0];
        if (sinArg && isSymbolNode(sinArg) && sinArg.name === variable) {
          return createFunctionNode('Si', [createSymbolNode(variable)]);
        }
      }

      // ∫ cos(x)/x dx = Ci(x)  — Cosine Integral (Cauchy principal value)
      if (
        isFunctionNode(numerator) &&
        numerator.fn === 'cos' &&
        isSymbolNode(denominator) &&
        denominator.name === variable
      ) {
        const cosArg = numerator.args[0];
        if (cosArg && isSymbolNode(cosArg) && cosArg.name === variable) {
          return createFunctionNode('Ci', [createSymbolNode(variable)]);
        }
      }

      // ∫ 1/ln(x) dx = li(x)  — Logarithmic Integral
      if (
        isConstantNode(numerator) &&
        numerator.value === 1 &&
        isFunctionNode(denominator) &&
        (denominator.fn === 'log' || denominator.fn === 'ln')
      ) {
        const logArg = denominator.args[0];
        if (logArg && isSymbolNode(logArg) && logArg.name === variable) {
          return createFunctionNode('li', [createSymbolNode(variable)]);
        }
      }
    }

    return null;
  }
}

// Global integration engine instance
const engine = new IntegrationEngine();

/**
 * Integrate an expression symbolically.
 * @param expression - Expression string or AST to integrate
 * @param variable   - Variable to integrate with respect to (default: 'x')
 * @returns Integrated expression as AST
 * @throws Error when no elementary anti-derivative exists
 */
export function integrate(
  expression: string | ExpressionNode,
  variable = 'x'
): ExpressionNode {
  const expr = typeof expression === 'string' ? parse(expression) : expression;

  try {
    return engine.integrate(expr, variable);
  } catch (error) {
    throw new Error(
      `Cannot integrate expression: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Definite integral — symbolic first, numerical fallback.
 * @param expression  - Expression to integrate
 * @param variable    - Variable to integrate with respect to
 * @param lowerBound  - Lower bound of integration
 * @param upperBound  - Upper bound of integration
 * @param method      - 'symbolic' tries symbolic first; 'numerical' forces numerical
 * @returns Numerical value of the definite integral
 */
export function integrateDefinite(
  expression: string | ExpressionNode,
  variable: string,
  lowerBound: number,
  upperBound: number,
  method: 'symbolic' | 'numerical' = 'symbolic'
): number {
  if (method === 'symbolic') {
    try {
      // Try symbolic first
      const indefinite = integrate(expression, variable);

      // Evaluate at bounds: F(b) - F(a)
      const upperResult = evaluate(indefinite, { variables: { [variable]: upperBound } });
      const lowerResult = evaluate(indefinite, { variables: { [variable]: lowerBound } });

      if (upperResult.success && lowerResult.success) {
        return Number(upperResult.value) - Number(lowerResult.value);
      }

      // Fall back to numerical
      return numericalIntegrate(expression, variable, lowerBound, upperBound);
    } catch {
      // Fall back to numerical
      return numericalIntegrate(expression, variable, lowerBound, upperBound);
    }
  }

  // Numerical integration (Simpson's rule)
  return numericalIntegrate(expression, variable, lowerBound, upperBound);
}

/**
 * Numerical integration using Simpson's Rule (composite).
 * @param expression - Expression to integrate
 * @param variable   - Variable to integrate with respect to
 * @param a          - Lower bound
 * @param b          - Upper bound
 * @param n          - Number of intervals (must be even, default: 1000)
 * @returns Numerical approximation of the integral
 */
function numericalIntegrate(
  expression: string | ExpressionNode,
  variable: string,
  a: number,
  b: number,
  n = 1000
): number {
  // Ensure n is even
  if (n % 2 !== 0) n++;

  const h = (b - a) / n;
  let sum = 0;

  const expr = typeof expression === 'string' ? parse(expression) : expression;

  for (let i = 0; i <= n; i++) {
    const x = a + i * h;
    const result = evaluate(expr, { variables: { [variable]: x } });

    if (!result.success) {
      throw new Error(`Failed to evaluate at ${variable} = ${x}`);
    }

    const fx = Number(result.value);

    if (i === 0 || i === n) {
      sum += fx;
    } else if (i % 2 === 1) {
      sum += 4 * fx;
    } else {
      sum += 2 * fx;
    }
  }

  return (h / 3) * sum;
}

/**
 * Convert an AST node to a human-readable infix string.
 * Useful for debugging and for displaying results to the user.
 */
export function astToString(node: ExpressionNode): string {
  if (isConstantNode(node)) {
    return String(node.value);
  }

  if (isSymbolNode(node)) {
    return node.name;
  }

  if (isOperatorNode(node)) {
    const left = node.args[0];
    const right = node.args[1];
    if (!left || !right) return String(node);
    const leftStr = astToString(left);
    const rightStr = astToString(right);

    if (node.op === '^') {
      return `(${leftStr})^(${rightStr})`;
    }

    return `(${leftStr} ${node.op} ${rightStr})`;
  }

  if (isFunctionNode(node)) {
    const argsStr = node.args.map(astToString).join(', ');
    // Special function display names
    switch (node.fn) {
      case 'Si': return `Si(${argsStr})`;
      case 'Ci': return `Ci(${argsStr})`;
      case 'li': return `li(${argsStr})`;
      case 'erf': return `erf(${argsStr})`;
      default: return `${node.fn}(${argsStr})`;
    }
  }

  return String(node);
}
