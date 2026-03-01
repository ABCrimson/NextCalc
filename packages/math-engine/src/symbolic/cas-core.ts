/**
 * Computer Algebra System (CAS) Core
 *
 * Provides comprehensive symbolic computation capabilities:
 * - Expression manipulation and transformation
 * - Algebraic simplification with rule systems
 * - Equation solving (polynomial, transcendental)
 * - Integration and differentiation
 * - Series expansion
 * - Matrix operations (symbolic)
 *
 * This is the central hub for all symbolic mathematics operations.
 */

import type { ExpressionNode } from '../parser/ast';
import { isConstantNode, isFunctionNode, isOperatorNode, isSymbolNode } from '../parser/ast';
import { parse } from '../parser/parser';
import type { Solution } from '../solver/solve';
import { solve } from '../solver/solve';
import { differentiate } from './differentiate';
import {
  analyzeExpression,
  type EnhancedExpression,
  getPolynomialDegree,
  getVariables,
} from './expression-tree';
import { integrate, integrateDefinite } from './integrate';
import { expand, factor, simplify, substitute } from './simplify';

/**
 * CAS computation result
 */
export interface CASResult<T = unknown> {
  /** Success flag */
  readonly success: boolean;
  /** Result value */
  readonly value?: T;
  /** Error message if failed */
  readonly error?: string;
  /** Computation steps (for step-by-step solving) */
  readonly steps?: ReadonlyArray<ComputationStep>;
  /** Metadata about the computation */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Single computation step
 */
export interface ComputationStep {
  /** Step description */
  readonly description: string;
  /** Expression before this step */
  readonly before: ExpressionNode;
  /** Expression after this step */
  readonly after: ExpressionNode;
  /** Rule or transformation applied */
  readonly rule: string;
  /** Additional explanation */
  readonly explanation?: string;
}

/**
 * Transformation rule
 */
export interface TransformationRule {
  /** Rule name */
  readonly name: string;
  /** Rule description */
  readonly description: string;
  /** Pattern to match */
  readonly pattern: (expr: ExpressionNode) => boolean;
  /** Transformation to apply */
  readonly transform: (expr: ExpressionNode) => ExpressionNode;
  /** Category */
  readonly category: 'algebraic' | 'trigonometric' | 'exponential' | 'logarithmic' | 'calculus';
}

// ============================================================================
// MAIN CAS CLASS
// ============================================================================

/**
 * Computer Algebra System
 */
export class CAS {
  private readonly rules: ReadonlyArray<TransformationRule>;

  constructor() {
    this.rules = getDefaultRules();
  }

  /**
   * Parse expression from string
   */
  parse(expr: string): CASResult<ExpressionNode> {
    try {
      const node = parse(expr);
      return {
        success: true,
        value: node,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Parse error',
      };
    }
  }

  /**
   * Analyze expression and return metadata
   */
  analyze(expr: string | ExpressionNode): CASResult<EnhancedExpression> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const analysis = analyzeExpression(node);
      return {
        success: true,
        value: analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis error',
      };
    }
  }

  /**
   * Simplify expression
   */
  simplify(expr: string | ExpressionNode): CASResult<ExpressionNode> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const simplified = simplify(node);
      return {
        success: true,
        value: simplified,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Simplification error',
      };
    }
  }

  /**
   * Expand expression
   */
  expand(expr: string | ExpressionNode): CASResult<ExpressionNode> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const expanded = expand(node);
      return {
        success: true,
        value: expanded,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Expansion error',
      };
    }
  }

  /**
   * Factor expression
   */
  factor(expr: string | ExpressionNode, variable = 'x'): CASResult<ExpressionNode> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const factored = factor(node, variable);
      return {
        success: true,
        value: factored,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Factorization error',
      };
    }
  }

  /**
   * Substitute variable with value
   */
  substitute(
    expr: string | ExpressionNode,
    variable: string,
    value: ExpressionNode | number,
  ): CASResult<ExpressionNode> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const substituted = substitute(node, variable, value);
      return {
        success: true,
        value: substituted,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Substitution error',
      };
    }
  }

  /**
   * Differentiate expression
   */
  differentiate(expr: string | ExpressionNode, variable = 'x'): CASResult<ExpressionNode> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const derivative = differentiate(node, variable);
      const simplified = simplify(derivative);
      return {
        success: true,
        value: simplified,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Differentiation error',
      };
    }
  }

  /**
   * Integrate expression
   */
  integrate(
    expr: string | ExpressionNode,
    variable = 'x',
    options?: { lower?: number; upper?: number },
  ): CASResult<ExpressionNode | number> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;

      // If bounds are provided, use definite integration
      if (options?.lower !== undefined && options?.upper !== undefined) {
        const result = integrateDefinite(node, variable, options.lower, options.upper);
        return {
          success: true,
          value: result,
        };
      }

      // Otherwise, use indefinite integration
      const integral = integrate(node, variable);
      return {
        success: true,
        value: integral,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Integration error',
      };
    }
  }

  /**
   * Solve equation
   */
  solve(
    equation: string | ExpressionNode,
    variable = 'x',
    options?: { method?: 'auto' | 'numerical'; initialGuess?: number },
  ): CASResult<ReadonlyArray<Solution>> {
    try {
      const node = typeof equation === 'string' ? parse(equation) : equation;
      const solutions = solve(node, variable, options);
      return {
        success: true,
        value: solutions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Solving error',
      };
    }
  }

  /**
   * Apply transformation rules to simplify expression
   */
  applyRules(expr: ExpressionNode): CASResult<ExpressionNode> {
    try {
      let current = expr;
      let changed = true;
      const steps: ComputationStep[] = [];
      let iterations = 0;
      const maxIterations = 100;

      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        for (const rule of this.rules) {
          if (rule.pattern(current)) {
            const before = current;
            current = rule.transform(current);

            if (!astEquals(before, current)) {
              steps.push({
                description: rule.description,
                before,
                after: current,
                rule: rule.name,
              });
              changed = true;
              break; // Apply one rule at a time
            }
          }
        }
      }

      return {
        success: true,
        value: current,
        steps,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rule application error',
      };
    }
  }

  /**
   * Get all variables in expression
   */
  getVariables(expr: string | ExpressionNode): CASResult<ReadonlyArray<string>> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const vars = getVariables(node);
      return {
        success: true,
        value: vars,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Variable extraction error',
      };
    }
  }

  /**
   * Get polynomial degree
   */
  getDegree(expr: string | ExpressionNode, variable = 'x'): CASResult<number> {
    try {
      const node = typeof expr === 'string' ? parse(expr) : expr;
      const degree = getPolynomialDegree(node, variable);
      return {
        success: true,
        value: degree,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Degree calculation error',
      };
    }
  }
}

// ============================================================================
// DEFAULT TRANSFORMATION RULES
// ============================================================================

/**
 * Get default transformation rules
 */
function getDefaultRules(): ReadonlyArray<TransformationRule> {
  return [
    // Trigonometric identities
    {
      name: 'pythagorean_identity',
      description: 'Apply sin²(x) + cos²(x) = 1',
      category: 'trigonometric',
      pattern: (_expr) => {
        // This is a simplified pattern matcher
        // Full implementation would use proper pattern matching
        return false;
      },
      transform: (expr) => expr,
    },

    // Exponential rules
    {
      name: 'exp_product',
      description: 'Apply e^a * e^b = e^(a+b)',
      category: 'exponential',
      pattern: (_expr) => false,
      transform: (expr) => expr,
    },

    // Logarithmic rules
    {
      name: 'log_product',
      description: 'Apply log(a*b) = log(a) + log(b)',
      category: 'logarithmic',
      pattern: (_expr) => false,
      transform: (expr) => expr,
    },
  ];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
    const aArg0 = a.args[0];
    const aArg1 = a.args[1];
    const bArg0 = b.args[0];
    const bArg1 = b.args[1];

    return (
      a.op === b.op &&
      aArg0 !== undefined &&
      aArg1 !== undefined &&
      bArg0 !== undefined &&
      bArg1 !== undefined &&
      astEquals(aArg0, bArg0) &&
      astEquals(aArg1, bArg1)
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
 * Create a default CAS instance
 */
export function createCAS(): CAS {
  return new CAS();
}

/**
 * Quick simplification function
 */
export function quickSimplify(expr: string): string {
  const cas = createCAS();
  const result = cas.simplify(expr);
  if (result.success && result.value) {
    return expressionToString(result.value);
  }
  return expr;
}

/**
 * Convert expression node to string (simplified)
 */
function expressionToString(node: ExpressionNode): string {
  if (isConstantNode(node)) {
    return String(node.value);
  }

  if (isSymbolNode(node)) {
    return node.name || '';
  }

  if (isOperatorNode(node)) {
    const arg0 = node.args[0];
    const arg1 = node.args[1];
    if (arg0 === undefined || arg1 === undefined) return '';
    return `(${expressionToString(arg0)} ${node.op} ${expressionToString(arg1)})`;
  }

  if (isFunctionNode(node)) {
    return `${node.fn}(${node.args.map(expressionToString).join(', ')})`;
  }

  return '';
}
