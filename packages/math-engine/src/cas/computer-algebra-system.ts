/**
 * Comprehensive Computer Algebra System (CAS)
 *
 * Advanced symbolic mathematics engine featuring:
 * - Pattern matching and rewrite rules
 * - Advanced simplification (algebraic, trigonometric, exponential, logarithmic)
 * - Symbolic operations (expand, factor, partial fractions, polynomial division)
 * - Step-by-step solution tracking with explanations
 * - Expression comparison and equality checking
 *
 * @module computer-algebra-system
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * const cas = new ComputerAlgebraSystem();
 *
 * // Pattern matching
 * const pattern = cas.createPattern('a*x + b*x');
 * const matched = cas.match(pattern, parse('2*y + 3*y'));
 * // matched = { a: 2, b: 3, x: 'y' }
 *
 * // Advanced simplification
 * const result = cas.simplify('sin(x)^2 + cos(x)^2');
 * // result = 1
 *
 * // Polynomial operations
 * const expanded = cas.expand('(x + 1)^3');
 * // expanded = x^3 + 3*x^2 + 3*x + 1
 *
 * const factored = cas.factor('x^2 - 5*x + 6');
 * // factored = (x - 2)*(x - 3)
 * ```
 */

import type { ExpressionNode } from '../parser/ast';
import {
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isUnaryOperatorNode,
  isFunctionNode,
  createConstantNode,
  createSymbolNode,
  createOperatorNode,
  createFunctionNode,
} from '../parser/ast';
import { parse } from '../parser/parser';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Pattern for matching expressions
 */
export interface Pattern {
  /** Pattern expression */
  readonly expr: ExpressionNode;
  /** Variable names that can match any expression */
  readonly wildcards: ReadonlySet<string>;
  /** Pattern metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Pattern matching result
 */
export interface PatternMatch {
  /** Whether the pattern matched */
  readonly matched: boolean;
  /** Bindings for wildcards */
  readonly bindings: ReadonlyMap<string, ExpressionNode>;
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Rewrite rule for expression transformation
 */
export interface RewriteRule {
  /** Rule name */
  readonly name: string;
  /** Rule description */
  readonly description: string;
  /** Pattern to match */
  readonly pattern: Pattern;
  /** Replacement expression (may use bindings from pattern) */
  readonly replacement: (bindings: ReadonlyMap<string, ExpressionNode>) => ExpressionNode;
  /** Rule category */
  readonly category: RuleCategory;
  /** Priority (higher = applied first) */
  readonly priority: number;
  /** Preconditions that must be satisfied */
  readonly preconditions?: Array<(bindings: ReadonlyMap<string, ExpressionNode>) => boolean>;
}

/**
 * Rule categories for organization
 */
export enum RuleCategory {
  Algebraic = 'algebraic',
  Trigonometric = 'trigonometric',
  Exponential = 'exponential',
  Logarithmic = 'logarithmic',
  Complex = 'complex',
  Rational = 'rational',
  Polynomial = 'polynomial',
}

/**
 * Simplification result with metadata
 */
export interface SimplificationResult {
  /** Simplified expression */
  readonly expression: ExpressionNode;
  /** Number of rules applied */
  readonly rulesApplied: number;
  /** Complexity reduction */
  readonly complexityReduction: number;
  /** Time taken in milliseconds */
  readonly timeMs: number;
}

/**
 * Polynomial in standard form
 */
export interface Polynomial {
  /** Coefficients (index = power) */
  readonly coefficients: ReadonlyArray<number>;
  /** Variable name */
  readonly variable: string;
  /** Degree */
  readonly degree: number;
}

/**
 * Rational function (p/q where p, q are polynomials)
 */
export interface RationalFunction {
  /** Numerator polynomial */
  readonly numerator: Polynomial;
  /** Denominator polynomial */
  readonly denominator: Polynomial;
}

/**
 * Partial fraction decomposition result
 */
export interface PartialFractions {
  /** List of partial fractions */
  readonly fractions: ReadonlyArray<{
    readonly numerator: Polynomial;
    readonly denominator: Polynomial;
  }>;
  /** Polynomial part (if degree(num) >= degree(den)) */
  readonly polynomialPart?: Polynomial;
}

// ============================================================================
// INTERNAL TYPES FOR PARTIAL FRACTION DECOMPOSITION
// ============================================================================

/**
 * Describes a single irreducible factor of the denominator together with its
 * multiplicity.  Used internally by `partialFractions`.
 */
type PartialFractionFactor =
  | {
      /** Linear factor (x - root)^multiplicity */
      readonly type: 'linear';
      readonly root: number;
      readonly multiplicity: number;
      readonly variable: string;
    }
  | {
      /** Irreducible quadratic factor (x^2 + b*x + c)^multiplicity */
      readonly type: 'quadratic';
      readonly b: number;
      readonly c: number;
      readonly multiplicity: number;
      readonly variable: string;
    };

// ============================================================================
// MAIN CAS CLASS
// ============================================================================

/**
 * Comprehensive Computer Algebra System
 */
export class ComputerAlgebraSystem {
  private readonly rules: ReadonlyArray<RewriteRule>;

  constructor(customRules: ReadonlyArray<RewriteRule> = []) {
    this.rules = [...getStandardRules(), ...customRules].sort(
      (a, b) => b.priority - a.priority
    );
  }

  // ========================================================================
  // PATTERN MATCHING
  // ========================================================================

  /**
   * Create a pattern from an expression string
   *
   * Wildcards are denoted by capital letters (A, B, C, etc.)
   */
  createPattern(expr: string, wildcards?: ReadonlyArray<string>): Pattern {
    const node = parse(expr);
    const detectedWildcards = new Set(wildcards || this.detectWildcards(node));

    return {
      expr: node,
      wildcards: detectedWildcards,
    };
  }

  /**
   * Detect wildcard variables (capital letters)
   */
  private detectWildcards(node: ExpressionNode): Array<string> {
    const wildcards = new Set<string>();

    const traverse = (n: ExpressionNode): void => {
      if (isSymbolNode(n)) {
        // Capital letters are wildcards
        if (n.name.length === 1 && n.name >= 'A' && n.name <= 'Z') {
          wildcards.add(n.name);
        }
      } else if (isOperatorNode(n)) {
        traverse(n.args[0]);
        traverse(n.args[1]);
      } else if (isFunctionNode(n)) {
        n.args.forEach(traverse);
      }
    };

    traverse(node);
    return Array.from(wildcards);
  }

  /**
   * Match a pattern against an expression.
   *
   * Supports:
   *   - Wildcard matching: pattern variables bind to arbitrary sub-expressions.
   *   - Commutative matching: for '+' and '*' the operands may be swapped
   *     (e.g. pattern  A + B  matches  y + x  with A=y, B=x).
   *   - Associative matching: flat lists of operands under '+' and '*' are
   *     tried in all partitions so that  A + B  can match  (x + y) + z  with
   *     A = x+y, B = z  **or**  A = x, B = y+z, etc.
   */
  match(pattern: Pattern, expr: ExpressionNode): PatternMatch {
    const bindings = new Map<string, ExpressionNode>();
    const cas = this;

    /**
     * Snapshot current bindings state for backtracking.
     */
    const snapshot = (): Map<string, ExpressionNode> => new Map(bindings);

    /**
     * Restore bindings from a snapshot.
     */
    const restore = (snap: Map<string, ExpressionNode>): void => {
      bindings.clear();
      for (const [k, v] of snap) bindings.set(k, v);
    };

    /**
     * Try matching pattern node p against expression node e.
     * Mutates `bindings`; caller must snapshot/restore on failure.
     */
    const matchNode = (p: ExpressionNode, e: ExpressionNode): boolean => {
      // Wildcard matches anything
      if (isSymbolNode(p) && pattern.wildcards.has(p.name)) {
        const existing = bindings.get(p.name);
        if (existing) {
          return cas.expressionEquals(existing, e);
        }
        bindings.set(p.name, e);
        return true;
      }

      // Constants must match exactly
      if (isConstantNode(p) && isConstantNode(e)) {
        return p.value === e.value;
      }

      // Symbols must match exactly (unless wildcard)
      if (isSymbolNode(p) && isSymbolNode(e)) {
        return p.name === e.name;
      }

      // Operators must match structure
      if (isOperatorNode(p) && isOperatorNode(e)) {
        if (p.op !== e.op) return false;

        // 1. Direct structural match (original behavior)
        const s1 = snapshot();
        if (matchNode(p.args[0], e.args[0]) && matchNode(p.args[1], e.args[1])) {
          return true;
        }
        restore(s1);

        // 2. Commutative match: try swapped operands for + and *
        if (isCommutativeOp(p.op)) {
          const s2 = snapshot();
          if (matchNode(p.args[0], e.args[1]) && matchNode(p.args[1], e.args[0])) {
            return true;
          }
          restore(s2);

          // 3. Associative match: flatten the expression operands and try
          //    splitting them into two groups that match the two pattern operands.
          //    Only used when the expression has more operands than the pattern.
          const eFlat = flattenAssoc(e, e.op);
          if (eFlat.length > 2) {
            for (let k = 1; k < eFlat.length; k++) {
              const leftExpr = rebuildTree(eFlat.slice(0, k), e.op);
              const rightExpr = rebuildTree(eFlat.slice(k), e.op);

              const sA = snapshot();
              if (matchNode(p.args[0], leftExpr) && matchNode(p.args[1], rightExpr)) {
                return true;
              }
              restore(sA);

              const sB = snapshot();
              if (matchNode(p.args[0], rightExpr) && matchNode(p.args[1], leftExpr)) {
                return true;
              }
              restore(sB);
            }
          }
        }

        return false;
      }

      // Functions must match
      if (isFunctionNode(p) && isFunctionNode(e)) {
        if (p.fn !== e.fn || p.args.length !== e.args.length) return false;
        return p.args.every((arg, i) => {
          const eArg = e.args[i];
          return eArg !== undefined && matchNode(arg, eArg);
        });
      }

      return false;
    };

    const matched = matchNode(pattern.expr, expr);

    return {
      matched,
      bindings,
      confidence: matched ? 1.0 : 0.0,
    };
  }

  // ========================================================================
  // EXPRESSION COMPARISON
  // ========================================================================

  /**
   * Check if two expressions are structurally equal
   */
  expressionEquals(a: ExpressionNode, b: ExpressionNode): boolean {
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
        this.expressionEquals(a.args[0], b.args[0]) &&
        this.expressionEquals(a.args[1], b.args[1])
      );
    }

    if (isFunctionNode(a) && isFunctionNode(b)) {
      if (a.fn !== b.fn || a.args.length !== b.args.length) return false;
      return a.args.every((arg, i) => {
        const bArg = b.args[i];
        return bArg !== undefined && this.expressionEquals(arg, bArg);
      });
    }

    return false;
  }

  /**
   * Check if two expressions are mathematically equivalent (may differ in form)
   */
  isEquivalent(a: ExpressionNode, b: ExpressionNode): boolean {
    const simplifiedA = this.simplifyExpression(a);
    const simplifiedB = this.simplifyExpression(b);
    return this.expressionEquals(simplifiedA, simplifiedB);
  }

  // ========================================================================
  // ADVANCED SIMPLIFICATION
  // ========================================================================

  /**
   * Simplify expression using all available rules
   */
  simplify(expr: string | ExpressionNode): SimplificationResult {
    const startTime = performance.now();
    const node = typeof expr === 'string' ? parse(expr) : expr;
    const originalComplexity = this.getComplexity(node);

    let current = node;
    let rulesApplied = 0;
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      let changed = false;
      iterations++;

      // Try matching rules at the top level
      for (const rule of this.rules) {
        const matchResult = this.match(rule.pattern, current);

        if (matchResult.matched) {
          // Check preconditions
          if (rule.preconditions) {
            const satisfied = rule.preconditions.every(cond => cond(matchResult.bindings));
            if (!satisfied) continue;
          }

          const transformed = rule.replacement(matchResult.bindings);

          if (!this.expressionEquals(current, transformed)) {
            current = transformed;
            rulesApplied++;
            changed = true;
            break; // Apply one rule per iteration
          }
        }
      }

      if (!changed) {
        // No top-level rule matched — try simplifying children one level deep
        const childSimplified = this._simplifyChildren(current);
        if (!this.expressionEquals(childSimplified, current)) {
          current = childSimplified;
          rulesApplied++;
          continue;
        }
        break;
      }
    }

    const finalComplexity = this.getComplexity(current);
    const endTime = performance.now();

    return {
      expression: current,
      rulesApplied,
      complexityReduction: originalComplexity - finalComplexity,
      timeMs: endTime - startTime,
    };
  }

  /**
   * Internal simplification (returns expression directly)
   */
  private simplifyExpression(expr: ExpressionNode): ExpressionNode {
    return this.simplify(expr).expression;
  }

  /**
   * Try to simplify immediate children of an expression one level deep.
   * This enables the main simplify loop to reduce sub-expressions when
   * no top-level rule matches.
   */
  private _simplifyChildren(node: ExpressionNode): ExpressionNode {
    if (isOperatorNode(node)) {
      const left = this.applyOneRule(node.args[0]);
      const right = this.applyOneRule(node.args[1]);
      if (
        this.expressionEquals(left, node.args[0]) &&
        this.expressionEquals(right, node.args[1])
      ) {
        return node;
      }
      return createOperatorNode(node.op, node.fn, [left, right] as const);
    }

    if (isFunctionNode(node)) {
      let anyChanged = false;
      const newArgs = node.args.map(arg => {
        const simplified = this.applyOneRule(arg);
        if (!this.expressionEquals(simplified, arg)) {
          anyChanged = true;
        }
        return simplified;
      });
      return anyChanged ? createFunctionNode(node.fn, newArgs) : node;
    }

    return node;
  }

  /**
   * Try to apply one rewrite rule to the given expression.
   * Returns the transformed expression or the original if no rule applied.
   */
  private applyOneRule(expr: ExpressionNode): ExpressionNode {
    for (const rule of this.rules) {
      const matchResult = this.match(rule.pattern, expr);
      if (matchResult.matched) {
        if (rule.preconditions) {
          const satisfied = rule.preconditions.every(cond => cond(matchResult.bindings));
          if (!satisfied) continue;
        }
        const transformed = rule.replacement(matchResult.bindings);
        if (!this.expressionEquals(expr, transformed)) {
          return transformed;
        }
      }
    }
    return expr;
  }

  // ========================================================================
  // POLYNOMIAL OPERATIONS
  // ========================================================================

  /**
   * Expand polynomial expression
   */
  expand(expr: string | ExpressionNode): ExpressionNode {
    const node = typeof expr === 'string' ? parse(expr) : expr;
    return this.expandNode(node);
  }

  private expandNode(node: ExpressionNode): ExpressionNode {
    if (isConstantNode(node) || isSymbolNode(node)) {
      return node;
    }

    if (isOperatorNode(node)) {
      const left = this.expandNode(node.args[0]);
      const right = this.expandNode(node.args[1]);

      // ---------------------------------------------------------------
      // Distribute multiplication over addition and subtraction.
      //
      // Subtraction a*(b-c) is treated as a*b - a*c directly, preserving
      // the subtraction node so downstream constant-folding can simplify.
      //
      // Nested multiplication is handled automatically because both
      // operands are already recursively expanded before we reach this
      // point.  If the right child was  b*(c+d),  it will have been
      // expanded to  b*c + b*d  during the recursive call above, so the
      // outer  a * (b*c + b*d)  is then caught by one of the cases below.
      // ---------------------------------------------------------------
      if (node.op === '*') {
        // (a + b) * right  →  a*right + b*right
        if (isOperatorNode(left) && left.op === '+') {
          const a = left.args[0];
          const b = left.args[1];
          return this.expandNode(
            createOperatorNode('+', 'add', [
              createOperatorNode('*', 'multiply', [a, right] as const),
              createOperatorNode('*', 'multiply', [b, right] as const),
            ] as const)
          );
        }

        // (a - b) * right  →  a*right - b*right
        if (isOperatorNode(left) && left.op === '-') {
          const a = left.args[0];
          const b = left.args[1];
          return this.expandNode(
            createOperatorNode('-', 'subtract', [
              createOperatorNode('*', 'multiply', [a, right] as const),
              createOperatorNode('*', 'multiply', [b, right] as const),
            ] as const)
          );
        }

        // left * (a + b)  →  left*a + left*b
        if (isOperatorNode(right) && right.op === '+') {
          const a = right.args[0];
          const b = right.args[1];
          return this.expandNode(
            createOperatorNode('+', 'add', [
              createOperatorNode('*', 'multiply', [left, a] as const),
              createOperatorNode('*', 'multiply', [left, b] as const),
            ] as const)
          );
        }

        // left * (a - b)  →  left*a - left*b
        if (isOperatorNode(right) && right.op === '-') {
          const a = right.args[0];
          const b = right.args[1];
          return this.expandNode(
            createOperatorNode('-', 'subtract', [
              createOperatorNode('*', 'multiply', [left, a] as const),
              createOperatorNode('*', 'multiply', [left, b] as const),
            ] as const)
          );
        }
      }

      // ---------------------------------------------------------------
      // Expand powers of sums/differences: (expr)^n for small n ≥ 0.
      //
      // For subtraction bases (a - b)^n the base is rewritten as
      // (a + (-1)*b) so the existing binomial expansion in expandPower
      // handles both uniformly via the (a+b)^n path.
      // ---------------------------------------------------------------
      if (node.op === '^' && isConstantNode(right)) {
        const exp = Number(right.value);
        if (Number.isInteger(exp) && exp >= 0 && exp <= 10) {
          // Rewrite (a - b)^n → (a + (-1)*b)^n for binomial expansion
          if (isOperatorNode(left) && left.op === '-') {
            const a = left.args[0];
            const b = left.args[1];
            const negB = createOperatorNode('*', 'multiply', [
              createConstantNode(-1),
              b,
            ] as const);
            const plusForm = createOperatorNode('+', 'add', [a, negB] as const);
            return this.expandPower(plusForm, exp);
          }
          return this.expandPower(left, exp);
        }
      }

      return createOperatorNode(node.op, node.fn, [left, right] as const);
    }

    if (isFunctionNode(node)) {
      const args = node.args.map(arg => this.expandNode(arg));
      return createFunctionNode(node.fn, args);
    }

    return node;
  }

  /**
   * Expand (expr)^n using binomial theorem
   */
  private expandPower(expr: ExpressionNode, n: number): ExpressionNode {
    if (n === 0) return createConstantNode(1);
    if (n === 1) return expr;

    // For (a + b)^n, use binomial expansion
    if (isOperatorNode(expr) && expr.op === '+') {
      const a = expr.args[0];
      const b = expr.args[1];
      let result: ExpressionNode = createConstantNode(0);

      for (let k = 0; k <= n; k++) {
        const coeff = this.binomial(n, k);
        const aPower = k === 0 ? createConstantNode(1) : createOperatorNode('^', 'pow', [a, createConstantNode(k)] as const);
        const bPower = n - k === 0 ? createConstantNode(1) : createOperatorNode('^', 'pow', [b, createConstantNode(n - k)] as const);

        let term: ExpressionNode = createConstantNode(coeff);
        if (k > 0) term = createOperatorNode('*', 'multiply', [term, aPower] as const);
        if (n - k > 0) term = createOperatorNode('*', 'multiply', [term, bPower] as const);

        result = createOperatorNode('+', 'add', [result, term] as const);
      }

      return this.expandNode(result);
    }

    // Simple case: expr^n
    return createOperatorNode('^', 'pow', [expr, createConstantNode(n)] as const);
  }

  /**
   * Calculate binomial coefficient C(n, k)
   */
  private binomial(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;

    let result = 1;
    for (let i = 1; i <= k; i++) {
      result *= (n - k + i) / i;
    }
    return Math.round(result);
  }

  /**
   * Factor polynomial expression
   */
  factor(expr: string | ExpressionNode, variable = 'x'): ExpressionNode {
    const node = typeof expr === 'string' ? parse(expr) : expr;
    const poly = this.expressionToPolynomial(node, variable);

    if (!poly) return node;

    // Try to find rational roots using rational root theorem
    const roots = this.findRationalRoots(poly);

    if (roots.length === 0) return node;

    // Build factored form
    let result: ExpressionNode = createConstantNode(1);

    for (const root of roots) {
      const factor = createOperatorNode('-', 'subtract', [
        createSymbolNode(variable),
        createConstantNode(root),
      ] as const);
      result = createOperatorNode('*', 'multiply', [result, factor] as const);
    }

    return result;
  }

  /**
   * Convert an expression AST to a polynomial representation.
   *
   * Recursively traverses the expression tree and builds a Polynomial whose
   * coefficients array is indexed by power (coefficients[i] is the coefficient
   * of variable^i).
   *
   * Handles:
   *   - Constants (numeric literals)
   *   - The target variable (degree-1 polynomial [0, 1])
   *   - Addition (+), subtraction (-), multiplication (*)
   *   - Non-negative integer exponents: variable^n, polynomial^n
   *   - Division by a constant: polynomial / constant
   *   - Unary negation: -polynomial
   *
   * Returns null if the expression cannot be represented as a polynomial in
   * the given variable (e.g. contains transcendental functions, non-integer
   * exponents, division by the variable, or symbols other than the target).
   */
  private expressionToPolynomial(expr: ExpressionNode, variable: string): Polynomial | null {
    // --- Constant node ---
    if (isConstantNode(expr)) {
      return {
        coefficients: [Number(expr.value)],
        variable,
        degree: 0,
      };
    }

    // --- Symbol node ---
    if (isSymbolNode(expr)) {
      if (expr.name === variable) {
        // x  →  [0, 1]
        return { coefficients: [0, 1], variable, degree: 1 };
      }
      // Other symbols (like constants a, b, ...) cannot be represented as
      // numeric polynomial coefficients.
      return null;
    }

    // --- Unary negation ---
    if (isUnaryOperatorNode(expr) && expr.op === '-') {
      const inner = this.expressionToPolynomial(expr.args[0], variable);
      if (!inner) return null;
      return {
        coefficients: inner.coefficients.map(c => -c),
        variable,
        degree: inner.degree,
      };
    }

    // --- Binary operators ---
    if (isOperatorNode(expr)) {
      const left = this.expressionToPolynomial(expr.args[0], variable);
      const right = this.expressionToPolynomial(expr.args[1], variable);

      switch (expr.op) {
        case '+': {
          if (!left || !right) return null;
          return this.addPolynomials(left, right);
        }

        case '-': {
          if (!left || !right) return null;
          const negRight: Polynomial = {
            coefficients: right.coefficients.map(c => -c),
            variable,
            degree: right.degree,
          };
          return this.addPolynomials(left, negRight);
        }

        case '*': {
          if (!left || !right) return null;
          return this.multiplyPolynomials(left, right);
        }

        case '/': {
          // Only division by a non-zero constant is allowed.
          if (!left || !right) return null;
          if (right.degree !== 0) return null;
          const divisor = right.coefficients[0] ?? 0;
          if (divisor === 0) return null;
          return {
            coefficients: left.coefficients.map(c => c / divisor),
            variable,
            degree: left.degree,
          };
        }

        case '^': {
          // Exponent must be a non-negative integer constant.
          if (!right) return null;
          if (right.degree !== 0) return null;
          const exp = right.coefficients[0] ?? 0;
          if (!Number.isInteger(exp) || exp < 0 || exp > 20) return null;

          if (exp === 0) {
            return { coefficients: [1], variable, degree: 0 };
          }

          // Compute base^exp by repeated multiplication.
          if (!left) return null;
          let result = left;
          for (let i = 1; i < exp; i++) {
            result = this.multiplyPolynomials(result, left);
          }
          return result;
        }

        default:
          return null;
      }
    }

    // Expression types not representable as a polynomial (functions, etc.).
    return null;
  }

  /**
   * Add two polynomials coefficient-wise.
   */
  private addPolynomials(a: Polynomial, b: Polynomial): Polynomial {
    const maxDeg = Math.max(a.degree, b.degree);
    const coefficients: Array<number> = [];
    for (let i = 0; i <= maxDeg; i++) {
      coefficients.push((a.coefficients[i] ?? 0) + (b.coefficients[i] ?? 0));
    }
    // Trim trailing zeros to compute actual degree.
    let degree = coefficients.length - 1;
    while (degree > 0 && Math.abs(coefficients[degree] ?? 0) < 1e-15) {
      degree--;
    }
    return { coefficients: coefficients.slice(0, degree + 1), variable: a.variable, degree };
  }

  /**
   * Multiply two polynomials via coefficient convolution.
   */
  private multiplyPolynomials(a: Polynomial, b: Polynomial): Polynomial {
    const degree = a.degree + b.degree;
    const coefficients: Array<number> = new Array<number>(degree + 1).fill(0);
    for (let i = 0; i <= a.degree; i++) {
      for (let j = 0; j <= b.degree; j++) {
        const idx = i + j;
        coefficients[idx] = (coefficients[idx] ?? 0) + (a.coefficients[i] ?? 0) * (b.coefficients[j] ?? 0);
      }
    }
    return { coefficients, variable: a.variable, degree };
  }

  /**
   * Find rational roots of a polynomial using rational root theorem
   */
  private findRationalRoots(poly: Polynomial): Array<number> {
    const roots: Array<number> = [];

    // Candidates are ±(factors of constant term)/(factors of leading coefficient)
    const constant = poly.coefficients[0] || 0;
    const leading = poly.coefficients[poly.degree] || 1;

    const constantFactors = this.getFactors(Math.abs(constant));
    const leadingFactors = this.getFactors(Math.abs(leading));

    const candidates = new Set<number>();
    for (const p of constantFactors) {
      for (const q of leadingFactors) {
        candidates.add(p / q);
        candidates.add(-p / q);
      }
    }

    // Test each candidate
    for (const candidate of Array.from(candidates)) {
      if (this.evaluatePolynomial(poly, candidate) === 0) {
        roots.push(candidate);
      }
    }

    return roots;
  }

  /**
   * Get all positive integer factors of n
   */
  private getFactors(n: number): Array<number> {
    const factors: Array<number> = [];
    const limit = Math.sqrt(n);

    for (let i = 1; i <= limit; i++) {
      if (n % i === 0) {
        factors.push(i);
        if (i !== n / i) {
          factors.push(n / i);
        }
      }
    }

    return factors.sort((a, b) => a - b);
  }

  /**
   * Evaluate polynomial at a given value
   */
  private evaluatePolynomial(poly: Polynomial, x: number): number {
    let result = 0;
    for (let i = 0; i <= poly.degree; i++) {
      const coeff = poly.coefficients[i] || 0;
      result += coeff * Math.pow(x, i);
    }
    return result;
  }

  /**
   * Polynomial division (returns quotient and remainder)
   */
  dividePolynomials(
    dividend: Polynomial,
    divisor: Polynomial
  ): { quotient: Polynomial; remainder: Polynomial } {
    const quotientCoeffs: Array<number> = [];
    let remainder = [...dividend.coefficients];

    const divisorDegree = divisor.degree;
    const divisorLeading = divisor.coefficients[divisorDegree] || 1;

    while (remainder.length - 1 >= divisorDegree) {
      const remainderDegree = remainder.length - 1;
      const remainderLeading = remainder[remainderDegree] || 0;
      const coeff = remainderLeading / divisorLeading;

      quotientCoeffs.unshift(coeff);

      // Subtract divisor * coeff from remainder
      for (let i = 0; i <= divisorDegree; i++) {
        const idx = remainderDegree - divisorDegree + i;
        const divisorCoeff = divisor.coefficients[i] || 0;
        remainder[idx] = (remainder[idx] || 0) - coeff * divisorCoeff;
      }

      remainder.pop();
    }

    return {
      quotient: {
        coefficients: quotientCoeffs.reverse(),
        variable: dividend.variable,
        degree: quotientCoeffs.length - 1,
      },
      remainder: {
        coefficients: remainder,
        variable: dividend.variable,
        degree: remainder.length - 1,
      },
    };
  }

  /**
   * GCD of two polynomials using Euclidean algorithm
   */
  gcdPolynomials(a: Polynomial, b: Polynomial): Polynomial {
    if (b.degree === 0 && (b.coefficients[0] === 0 || b.coefficients[0] === undefined)) {
      return a;
    }

    const { remainder } = this.dividePolynomials(a, b);
    return this.gcdPolynomials(b, remainder);
  }

  /**
   * LCM of two polynomials
   */
  lcmPolynomials(a: Polynomial, b: Polynomial): Polynomial {
    const gcd = this.gcdPolynomials(a, b);
    const { quotient } = this.dividePolynomials(a, gcd);

    // Multiply quotient by b
    const resultCoeffs: Array<number> = new Array(quotient.degree + b.degree + 1).fill(0);

    for (let i = 0; i <= quotient.degree; i++) {
      for (let j = 0; j <= b.degree; j++) {
        const qCoeff = quotient.coefficients[i] || 0;
        const bCoeff = b.coefficients[j] || 0;
        resultCoeffs[i + j] = (resultCoeffs[i + j] || 0) + qCoeff * bCoeff;
      }
    }

    return {
      coefficients: resultCoeffs,
      variable: a.variable,
      degree: resultCoeffs.length - 1,
    };
  }

  /**
   * Partial fraction decomposition
   *
   * Decomposes a rational function P(x)/Q(x) into a sum of simpler fractions.
   *
   * Algorithm:
   *   1. If deg(P) >= deg(Q), perform polynomial long division first.
   *   2. Find all roots of Q(x) numerically (Durand-Kerner iteration).
   *   3. Cluster roots: real roots become linear factors (x - r)^k,
   *      complex-conjugate pairs become irreducible quadratic factors
   *      (x^2 + bx + c)^k.
   *   4. For each factor of multiplicity k, introduce k unknown coefficients.
   *   5. Multiply through by Q(x) and evaluate at distinct test points to
   *      assemble a linear system A·v = b.
   *   6. Solve the system via Gaussian elimination with partial pivoting.
   *   7. Assemble and return the PartialFractions result.
   */
  partialFractions(rational: RationalFunction): PartialFractions {
    const { numerator, denominator } = rational;

    // ---- Step 1: polynomial long division for improper fractions ----
    let workingNumerator = numerator;
    let polynomialPart: Polynomial | undefined;

    if (numerator.degree >= denominator.degree) {
      const { quotient, remainder } = this.dividePolynomials(numerator, denominator);
      polynomialPart = quotient;
      workingNumerator = remainder;
    }

    // ---- Edge case: constant denominator → no partial fractions ----
    const denLeading = denominator.coefficients[denominator.degree] ?? 1;
    if (denominator.degree === 0) {
      // P(x) / c  →  polynomial part already handles this via division
      const scaledCoeffs = workingNumerator.coefficients.map(c => c / denLeading);
      return {
        fractions: [],
        polynomialPart: polynomialPart ?? {
          coefficients: scaledCoeffs,
          variable: numerator.variable,
          degree: workingNumerator.degree,
        },
      };
    }

    // ---- Step 2: find all roots of the denominator ----
    const roots = this.findPolynomialRoots(denominator);

    // ---- Step 3: cluster roots into factors ----
    const factors = this.clusterRootsToFactors(roots, denominator.variable);

    // ---- Steps 4-6: build and solve the linear system ----
    const fractions = this.solvePartialFractionSystem(
      workingNumerator,
      denominator,
      factors
    );

    return polynomialPart !== undefined
      ? { fractions, polynomialPart }
      : { fractions };
  }

  // =========================================================================
  // PRIVATE HELPERS FOR PARTIAL FRACTION DECOMPOSITION
  // =========================================================================

  /**
   * Find all (complex) roots of a polynomial using the Durand-Kerner method.
   *
   * Returns an array of { re, im } objects.  Roots with |im| < EPS are treated
   * as real.  The length of the array equals deg(poly).
   */
  private findPolynomialRoots(
    poly: Polynomial
  ): Array<{ re: number; im: number }> {
    const n = poly.degree;
    if (n === 0) return [];

    // Normalise so leading coefficient is 1.
    const lead = poly.coefficients[n] ?? 1;
    const coeffs: Array<number> = [];
    for (let i = 0; i <= n; i++) {
      coeffs.push((poly.coefficients[i] ?? 0) / lead);
    }

    // Evaluate the (monic) polynomial at a complex point.
    const evalComplex = (re: number, im: number): { re: number; im: number } => {
      // Horner's method for complex numbers, coefficients ascending by degree.
      let rr = 0;
      let ri = 0;
      for (let i = n; i >= 0; i--) {
        // (rr + i*ri) * (re + i*im) + coeffs[i]
        const newRe = rr * re - ri * im + (coeffs[i] ?? 0);
        const newIm = rr * im + ri * re;
        rr = newRe;
        ri = newIm;
      }
      return { re: rr, im: ri };
    };

    // Initial guesses: spread on a circle of radius 1 + max|coeff|^(1/n).
    const maxCoeff = coeffs.slice(0, n).reduce((m, c) => Math.max(m, Math.abs(c)), 1);
    const radius = 1 + Math.pow(maxCoeff, 1 / n);
    const roots: Array<{ re: number; im: number }> = [];
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k) / n + 0.1; // offset avoids symmetry stalling
      roots.push({ re: radius * Math.cos(angle), im: radius * Math.sin(angle) });
    }

    const MAX_ITER = 500;
    const TOL = 1e-12;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      let maxMove = 0;

      for (let i = 0; i < n; i++) {
        // Compute product (z_i - z_j) for j ≠ i
        let prodRe = 1;
        let prodIm = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const dRe = (roots[i]?.re ?? 0) - (roots[j]?.re ?? 0);
          const dIm = (roots[i]?.im ?? 0) - (roots[j]?.im ?? 0);
          const newProdRe = prodRe * dRe - prodIm * dIm;
          const newProdIm = prodRe * dIm + prodIm * dRe;
          prodRe = newProdRe;
          prodIm = newProdIm;
        }

        const fVal = evalComplex(roots[i]?.re ?? 0, roots[i]?.im ?? 0);

        // delta = f(z_i) / product
        const denom2 = prodRe * prodRe + prodIm * prodIm;
        if (denom2 < 1e-300) continue; // avoid division by zero

        const deltaRe = (fVal.re * prodRe + fVal.im * prodIm) / denom2;
        const deltaIm = (fVal.im * prodRe - fVal.re * prodIm) / denom2;

        const ri = roots[i];
        if (ri) {
          ri.re -= deltaRe;
          ri.im -= deltaIm;
          maxMove = Math.max(maxMove, Math.sqrt(deltaRe * deltaRe + deltaIm * deltaIm));
        }
      }

      if (maxMove < TOL) break;
    }

    // Polish each root with Newton iterations.
    for (let i = 0; i < n; i++) {
      for (let iter = 0; iter < 20; iter++) {
        const ri = roots[i];
        if (!ri) break;
        const fVal = evalComplex(ri.re, ri.im);

        // Compute derivative at ri: use Horner again.
        let dr = 0;
        let di = 0;
        for (let k = n; k >= 1; k--) {
          const newDr = dr * ri.re - di * ri.im + k * (coeffs[k] ?? 0);
          const newDi = dr * ri.im + di * ri.re;
          dr = newDr;
          di = newDi;
        }
        const dd2 = dr * dr + di * di;
        if (dd2 < 1e-300) break;
        const stepRe = (fVal.re * dr + fVal.im * di) / dd2;
        const stepIm = (fVal.im * dr - fVal.re * di) / dd2;
        ri.re -= stepRe;
        ri.im -= stepIm;
        if (Math.sqrt(stepRe * stepRe + stepIm * stepIm) < 1e-14) break;
      }
    }

    // Snap nearly-real roots to the real line for cleanliness.
    const EPS_IM = 1e-8;
    for (const r of roots) {
      if (Math.abs(r.im) < EPS_IM) r.im = 0;
    }

    return roots;
  }

  /**
   * Cluster roots into canonical factors.
   *
   * - Real roots (im == 0) → linear factor descriptor.
   * - Complex-conjugate pairs (im ≠ 0) → irreducible quadratic descriptor.
   *
   * Repeated roots (within tolerance) are grouped into a single factor
   * with multiplicity > 1.
   */
  private clusterRootsToFactors(
    roots: Array<{ re: number; im: number }>,
    variable: string
  ): Array<PartialFractionFactor> {
    const EPS_ROOT = 1e-6;
    const used = new Array<boolean>(roots.length).fill(false);
    const factors: Array<PartialFractionFactor> = [];

    for (let i = 0; i < roots.length; i++) {
      if (used[i]) continue;
      const ri = roots[i];
      if (!ri) continue;

      if (ri.im === 0) {
        // Real root: collect multiplicity.
        let multiplicity = 1;
        used[i] = true;
        for (let j = i + 1; j < roots.length; j++) {
          if (used[j]) continue;
          const rj = roots[j];
          if (!rj) continue;
          if (rj.im === 0 && Math.abs(rj.re - ri.re) < EPS_ROOT) {
            multiplicity++;
            used[j] = true;
          }
        }
        factors.push({
          type: 'linear',
          root: ri.re,
          multiplicity,
          variable,
        });
      } else if (ri.im > 0) {
        // Complex root with positive imaginary part: look for conjugate.
        used[i] = true;
        let multiplicity = 1;
        for (let j = i + 1; j < roots.length; j++) {
          if (used[j]) continue;
          const rj = roots[j];
          if (!rj) continue;
          if (
            Math.abs(rj.re - ri.re) < EPS_ROOT &&
            Math.abs(rj.im + ri.im) < EPS_ROOT
          ) {
            used[j] = true;
            break;
          }
        }
        // Build irreducible quadratic x^2 + bx + c from the conjugate pair.
        // (x - (a+bi))(x - (a-bi)) = x^2 - 2a*x + (a^2 + b^2)
        const b = -2 * ri.re;
        const c = ri.re * ri.re + ri.im * ri.im;

        // Count further repeated copies of this quadratic.
        for (let j = i + 1; j < roots.length; j++) {
          if (used[j]) continue;
          const rj = roots[j];
          if (!rj || rj.im <= 0) continue;
          if (
            Math.abs(rj.re - ri.re) < EPS_ROOT &&
            Math.abs(Math.abs(rj.im) - Math.abs(ri.im)) < EPS_ROOT
          ) {
            multiplicity++;
            used[j] = true;
            // Mark its conjugate too.
            for (let k = j + 1; k < roots.length; k++) {
              if (used[k]) continue;
              const rk = roots[k];
              if (!rk) continue;
              if (
                Math.abs(rk.re - rj.re) < EPS_ROOT &&
                Math.abs(rk.im + rj.im) < EPS_ROOT
              ) {
                used[k] = true;
                break;
              }
            }
          }
        }

        factors.push({
          type: 'quadratic',
          b,
          c,
          multiplicity,
          variable,
        });
      }
      // Roots with im < 0 that weren't already consumed as conjugates
      // (shouldn't happen for real-coefficient polynomials, but skip if so).
    }

    return factors;
  }

  /**
   * Set up and solve the partial fraction linear system, returning an array
   * of { numerator, denominator } fraction pairs.
   *
   * For a proper fraction P(x)/Q(x) with Q factored as a product of
   * (x - r_i)^{k_i} and (x^2 + b_j*x + c_j)^{m_j}, the decomposition is:
   *
   *   P(x)/Q(x) = sum_i sum_p A_{i,p}/(x-r_i)^p
   *             + sum_j sum_q (B_{j,q}*x + C_{j,q})/(x^2+b_j*x+c_j)^q
   *
   * Multiplying both sides by Q(x) and evaluating at N distinct test points
   * gives a linear system.
   */
  private solvePartialFractionSystem(
    numerator: Polynomial,
    denominator: Polynomial,
    factors: Array<PartialFractionFactor>
  ): ReadonlyArray<{ numerator: Polynomial; denominator: Polynomial }> {
    const variable = denominator.variable;

    // Count total unknowns.
    let totalUnknowns = 0;
    for (const f of factors) {
      if (f.type === 'linear') {
        totalUnknowns += f.multiplicity;
      } else {
        totalUnknowns += 2 * f.multiplicity; // B and C for each power
      }
    }

    if (totalUnknowns === 0) {
      // Denominator is constant (shouldn't reach here, but be safe).
      return [{ numerator, denominator }];
    }

    // Build the matrix A and right-hand-side b for the linear system.
    // We evaluate at totalUnknowns distinct real test points.
    const testPoints = this.buildTestPoints(totalUnknowns, factors);

    const matA: Array<Array<number>> = [];
    const vecB: Array<number> = [];

    for (const x of testPoints) {
      const row: Array<number> = [];
      const denVal = this.evaluatePolynomialAt(denominator, x);
      const numVal = this.evaluatePolynomialAt(numerator, x);

      // For each factor, for each power p = 1..multiplicity:
      //   coefficient of A_{i,p} in row is Q(x) / (x - r_i)^p
      for (const f of factors) {
        if (f.type === 'linear') {
          for (let p = 1; p <= f.multiplicity; p++) {
            // Q(x) / (x - r)^p
            const denom = Math.pow(x - f.root, p);
            row.push(Math.abs(denom) < 1e-15 ? 0 : denVal / denom);
          }
        } else {
          // Quadratic factor (x^2 + b*x + c)
          for (let q = 1; q <= f.multiplicity; q++) {
            const quadVal = Math.pow(x * x + f.b * x + f.c, q);
            const colBase = Math.abs(quadVal) < 1e-15 ? 0 : denVal / quadVal;
            // B coefficient (multiplied by x)
            row.push(colBase * x);
            // C coefficient (multiplied by 1)
            row.push(colBase);
          }
        }
      }

      matA.push(row);
      vecB.push(numVal);
    }

    // Solve via Gaussian elimination with partial pivoting.
    const solution = this.gaussianElimination(matA, vecB);

    if (solution === null) {
      // System is degenerate - fall back to single fraction.
      return [{ numerator, denominator }];
    }

    // Assemble the partial fraction terms.
    const fractions: Array<{ numerator: Polynomial; denominator: Polynomial }> = [];
    let idx = 0;

    for (const f of factors) {
      if (f.type === 'linear') {
        for (let p = 1; p <= f.multiplicity; p++) {
          const A = this.roundSmall(solution[idx++] ?? 0);
          // numerator: constant A; denominator: (x - r)^p
          const numPoly: Polynomial = {
            coefficients: [A],
            variable,
            degree: 0,
          };
          const denPoly = this.buildLinearPower(f.root, p, variable);
          fractions.push({ numerator: numPoly, denominator: denPoly });
        }
      } else {
        for (let q = 1; q <= f.multiplicity; q++) {
          const B = this.roundSmall(solution[idx++] ?? 0);
          const C = this.roundSmall(solution[idx++] ?? 0);
          // numerator: B*x + C; denominator: (x^2 + b*x + c)^q
          const numPoly: Polynomial = {
            coefficients: [C, B],
            variable,
            degree: B === 0 ? 0 : 1,
          };
          const denPoly = this.buildQuadraticPower(f.b, f.c, q, variable);
          fractions.push({ numerator: numPoly, denominator: denPoly });
        }
      }
    }

    return fractions;
  }

  /**
   * Choose test points that avoid poles of the partial fractions.
   * Spread points away from roots using a deterministic strategy.
   */
  private buildTestPoints(
    count: number,
    factors: Array<PartialFractionFactor>
  ): Array<number> {
    const badPoints = new Set<number>();
    for (const f of factors) {
      if (f.type === 'linear') {
        badPoints.add(Math.round(f.root * 1e6) / 1e6);
      }
    }

    const points: Array<number> = [];
    let candidate = 0;
    let step = 1;
    while (points.length < count) {
      const rounded = Math.round(candidate * 1e6) / 1e6;
      if (!badPoints.has(rounded)) {
        points.push(candidate);
      }
      candidate += step;
      step = step > 0 ? -(step + 1) : -step; // 0, 1, -1, 2, -2, 3, -3, ...
    }
    return points;
  }

  /**
   * Evaluate a polynomial at a real point x using Horner's method.
   */
  private evaluatePolynomialAt(poly: Polynomial, x: number): number {
    let result = 0;
    for (let i = poly.degree; i >= 0; i--) {
      result = result * x + (poly.coefficients[i] ?? 0);
    }
    return result;
  }

  /**
   * Gaussian elimination with partial pivoting.
   * Solves A·x = b, returns x or null if singular.
   */
  private gaussianElimination(
    A: Array<Array<number>>,
    b: Array<number>
  ): Array<number> | null {
    const n = b.length;
    // Augmented matrix [A | b]
    const M: Array<Array<number>> = A.map((row, i) => [...row, b[i] ?? 0]);

    for (let col = 0; col < n; col++) {
      // Partial pivot: find row with max absolute value in this column.
      let maxVal = Math.abs(M[col]?.[col] ?? 0);
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        const val = Math.abs(M[row]?.[col] ?? 0);
        if (val > maxVal) {
          maxVal = val;
          maxRow = row;
        }
      }

      if (maxVal < 1e-12) return null; // Singular or near-singular

      // Swap rows.
      if (maxRow !== col) {
        [M[col], M[maxRow]] = [M[maxRow] as Array<number>, M[col] as Array<number>];
      }

      // Eliminate column below pivot.
      const pivot = M[col]?.[col] ?? 1;
      for (let row = col + 1; row < n; row++) {
        const factor = (M[row]?.[col] ?? 0) / pivot;
        if (factor === 0) continue;
        for (let k = col; k <= n; k++) {
          const mRow = M[row];
          const mCol = M[col];
          if (mRow && mCol) {
            mRow[k] = (mRow[k] ?? 0) - factor * (mCol[k] ?? 0);
          }
        }
      }
    }

    // Back-substitution.
    const x: Array<number> = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i]?.[n] ?? 0;
      for (let j = i + 1; j < n; j++) {
        sum -= (M[i]?.[j] ?? 0) * (x[j] ?? 0);
      }
      const diag = M[i]?.[i] ?? 1;
      x[i] = Math.abs(diag) < 1e-15 ? 0 : sum / diag;
    }

    return x;
  }

  /**
   * Build the polynomial representing (x - root)^power.
   * Coefficients are computed by repeated convolution.
   */
  private buildLinearPower(root: number, power: number, variable: string): Polynomial {
    // Start with [1] and convolve with [-root, 1] `power` times.
    let coeffs: Array<number> = [1];
    const factor = [-root, 1];

    for (let p = 0; p < power; p++) {
      const next: Array<number> = new Array<number>(coeffs.length + 1).fill(0);
      for (let i = 0; i < coeffs.length; i++) {
        next[i] = (next[i] ?? 0) + (coeffs[i] ?? 0) * (factor[0] ?? 0);
        next[i + 1] = (next[i + 1] ?? 0) + (coeffs[i] ?? 0) * (factor[1] ?? 0);
      }
      coeffs = next;
    }

    return {
      coefficients: coeffs,
      variable,
      degree: power,
    };
  }

  /**
   * Build the polynomial representing (x^2 + b*x + c)^power.
   * Coefficients are computed by repeated convolution.
   */
  private buildQuadraticPower(
    b: number,
    c: number,
    power: number,
    variable: string
  ): Polynomial {
    // quadratic factor as coefficient array: [c, b, 1]
    let coeffs: Array<number> = [1];
    const factor = [c, b, 1];

    for (let p = 0; p < power; p++) {
      const next: Array<number> = new Array<number>(coeffs.length + 2).fill(0);
      for (let i = 0; i < coeffs.length; i++) {
        next[i] = (next[i] ?? 0) + (coeffs[i] ?? 0) * (factor[0] ?? 0);
        next[i + 1] = (next[i + 1] ?? 0) + (coeffs[i] ?? 0) * (factor[1] ?? 0);
        next[i + 2] = (next[i + 2] ?? 0) + (coeffs[i] ?? 0) * (factor[2] ?? 0);
      }
      coeffs = next;
    }

    return {
      coefficients: coeffs,
      variable,
      degree: 2 * power,
    };
  }

  /**
   * Round a number to zero if its absolute value is below a threshold.
   * This cleans up floating-point noise in the solved coefficients.
   */
  private roundSmall(x: number, eps = 1e-9): number {
    return Math.abs(x) < eps ? 0 : x;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get complexity score of an expression (lower is simpler)
   */
  private getComplexity(node: ExpressionNode): number {
    let count = 0;

    const traverse = (n: ExpressionNode): void => {
      count++;
      if (isOperatorNode(n)) {
        traverse(n.args[0]);
        traverse(n.args[1]);
      } else if (isFunctionNode(n)) {
        n.args.forEach(traverse);
      }
    };

    traverse(node);
    return count;
  }

  /**
   * Substitute variable with expression
   */
  substitute(
    expr: ExpressionNode,
    variable: string,
    value: ExpressionNode
  ): ExpressionNode {
    if (isSymbolNode(expr)) {
      return expr.name === variable ? value : expr;
    }

    if (isConstantNode(expr)) {
      return expr;
    }

    if (isOperatorNode(expr)) {
      return createOperatorNode(expr.op, expr.fn, [
        this.substitute(expr.args[0], variable, value),
        this.substitute(expr.args[1], variable, value),
      ] as const);
    }

    if (isFunctionNode(expr)) {
      return createFunctionNode(
        expr.fn,
        expr.args.map(arg => this.substitute(arg, variable, value))
      );
    }

    return expr;
  }
}

// ============================================================================
// PATTERN MATCHING HELPER FUNCTIONS
// ============================================================================

/**
 * Check whether an operator is commutative (operands may be swapped).
 */
function isCommutativeOp(op: string): boolean {
  return op === '+' || op === '*';
}

/**
 * Get the function name for an operator.
 */
function fnForOp(op: string): string {
  switch (op) {
    case '+': return 'add';
    case '-': return 'subtract';
    case '*': return 'multiply';
    case '/': return 'divide';
    case '^': return 'pow';
    case '%': return 'mod';
    default: return op;
  }
}

/**
 * Flatten a binary expression tree into a list of leaf operands under a given
 * associative operator.
 *
 * Example: flattenAssoc((a + b) + c, '+') => [a, b, c]
 *
 * Only the expression side is flattened (not the pattern), so the result
 * always has >= 2 elements for a non-trivial tree.
 */
function flattenAssoc(
  node: ExpressionNode,
  op: string
): ExpressionNode[] {
  if (isOperatorNode(node) && node.op === op) {
    return [
      ...flattenAssoc(node.args[0], op),
      ...flattenAssoc(node.args[1], op),
    ];
  }
  return [node];
}

/**
 * Rebuild a left-associative binary tree from a flat list of operands.
 */
function rebuildTree(
  operands: ExpressionNode[],
  op: string
): ExpressionNode {
  if (operands.length === 1) {
    return operands[0]!;
  }

  let result = operands[0]!;
  for (let i = 1; i < operands.length; i++) {
    result = createOperatorNode(
      op as '+' | '-' | '*' | '/' | '^' | '%',
      fnForOp(op),
      [result, operands[i]!] as const
    );
  }
  return result;
}

// ============================================================================
// STANDARD REWRITE RULES
// ============================================================================

/**
 * Get standard simplification rules
 */
function getStandardRules(): ReadonlyArray<RewriteRule> {
  return [
    // Algebraic rules
    {
      name: 'add_zero',
      description: 'x + 0 = x',
      category: RuleCategory.Algebraic,
      priority: 100,
      pattern: {
        expr: parse('A + 0'),
        wildcards: new Set(['A']),
      },
      replacement: (bindings) => bindings.get('A')!,
    },
    {
      name: 'multiply_zero',
      description: 'x * 0 = 0',
      category: RuleCategory.Algebraic,
      priority: 100,
      pattern: {
        expr: parse('A * 0'),
        wildcards: new Set(['A']),
      },
      replacement: () => createConstantNode(0),
    },
    {
      name: 'multiply_one',
      description: 'x * 1 = x',
      category: RuleCategory.Algebraic,
      priority: 100,
      pattern: {
        expr: parse('A * 1'),
        wildcards: new Set(['A']),
      },
      replacement: (bindings) => bindings.get('A')!,
    },
    {
      name: 'power_zero',
      description: 'x^0 = 1',
      category: RuleCategory.Algebraic,
      priority: 100,
      pattern: {
        expr: parse('A ^ 0'),
        wildcards: new Set(['A']),
      },
      replacement: () => createConstantNode(1),
    },
    {
      name: 'power_one',
      description: 'x^1 = x',
      category: RuleCategory.Algebraic,
      priority: 100,
      pattern: {
        expr: parse('A ^ 1'),
        wildcards: new Set(['A']),
      },
      replacement: (bindings) => bindings.get('A')!,
    },

    // Trigonometric identities
    {
      name: 'pythagorean_identity',
      description: 'sin(x)^2 + cos(x)^2 = 1',
      category: RuleCategory.Trigonometric,
      priority: 80,
      pattern: {
        expr: parse('sin(A)^2 + cos(A)^2'),
        wildcards: new Set(['A']),
      },
      replacement: () => createConstantNode(1),
    },
    {
      name: 'sin_double_angle',
      description: 'sin(2*x) = 2*sin(x)*cos(x)',
      category: RuleCategory.Trigonometric,
      priority: 70,
      pattern: {
        expr: parse('sin(2 * A)'),
        wildcards: new Set(['A']),
      },
      replacement: (bindings) => {
        const a = bindings.get('A')!;
        return createOperatorNode('*', 'multiply', [
          createConstantNode(2),
          createOperatorNode('*', 'multiply', [
            createFunctionNode('sin', [a]),
            createFunctionNode('cos', [a]),
          ] as const),
        ] as const);
      },
    },

    // Exponential rules
    {
      name: 'exp_product',
      description: 'e^a * e^b = e^(a+b)',
      category: RuleCategory.Exponential,
      priority: 75,
      pattern: {
        expr: parse('exp(A) * exp(B)'),
        wildcards: new Set(['A', 'B']),
      },
      replacement: (bindings) => {
        const a = bindings.get('A')!;
        const b = bindings.get('B')!;
        return createFunctionNode('exp', [
          createOperatorNode('+', 'add', [a, b] as const),
        ]);
      },
    },
    {
      name: 'exp_power',
      description: '(e^a)^b = e^(a*b)',
      category: RuleCategory.Exponential,
      priority: 75,
      pattern: {
        expr: parse('exp(A) ^ B'),
        wildcards: new Set(['A', 'B']),
      },
      replacement: (bindings) => {
        const a = bindings.get('A')!;
        const b = bindings.get('B')!;
        return createFunctionNode('exp', [
          createOperatorNode('*', 'multiply', [a, b] as const),
        ]);
      },
    },

    // Logarithmic rules
    {
      name: 'log_product',
      description: 'log(a*b) = log(a) + log(b)',
      category: RuleCategory.Logarithmic,
      priority: 75,
      pattern: {
        expr: parse('log(A * B)'),
        wildcards: new Set(['A', 'B']),
      },
      replacement: (bindings) => {
        const a = bindings.get('A')!;
        const b = bindings.get('B')!;
        return createOperatorNode('+', 'add', [
          createFunctionNode('log', [a]),
          createFunctionNode('log', [b]),
        ] as const);
      },
    },
    {
      name: 'log_quotient',
      description: 'log(a/b) = log(a) - log(b)',
      category: RuleCategory.Logarithmic,
      priority: 75,
      pattern: {
        expr: parse('log(A / B)'),
        wildcards: new Set(['A', 'B']),
      },
      replacement: (bindings) => {
        const a = bindings.get('A')!;
        const b = bindings.get('B')!;
        return createOperatorNode('-', 'subtract', [
          createFunctionNode('log', [a]),
          createFunctionNode('log', [b]),
        ] as const);
      },
    },
    {
      name: 'log_power',
      description: 'log(a^b) = b*log(a)',
      category: RuleCategory.Logarithmic,
      priority: 75,
      pattern: {
        expr: parse('log(A ^ B)'),
        wildcards: new Set(['A', 'B']),
      },
      replacement: (bindings) => {
        const a = bindings.get('A')!;
        const b = bindings.get('B')!;
        return createOperatorNode('*', 'multiply', [
          b,
          createFunctionNode('log', [a]),
        ] as const);
      },
    },
  ];
}

/**
 * Factory function to create CAS instance
 */
export function createCAS(customRules?: ReadonlyArray<RewriteRule>): ComputerAlgebraSystem {
  return new ComputerAlgebraSystem(customRules);
}
