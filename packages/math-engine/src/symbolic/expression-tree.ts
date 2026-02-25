/**
 * Enhanced Expression Tree with Metadata
 *
 * Extends the basic AST with rich metadata for:
 * - Type information (polynomial, transcendental, etc.)
 * - Complexity metrics
 * - Variable dependencies
 * - Mathematical properties
 */

import type {
  ExpressionNode,
  OperatorNode,
} from '../parser/ast';
import {
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isFunctionNode,
} from '../parser/ast';

/**
 * Expression type classification
 */
export enum ExpressionType {
  /** Constant value */
  Constant = 'Constant',
  /** Single variable */
  Variable = 'Variable',
  /** Polynomial in one or more variables */
  Polynomial = 'Polynomial',
  /** Rational function (ratio of polynomials) */
  Rational = 'Rational',
  /** Contains trigonometric functions */
  Trigonometric = 'Trigonometric',
  /** Contains exponential functions */
  Exponential = 'Exponential',
  /** Contains logarithmic functions */
  Logarithmic = 'Logarithmic',
  /** Mixed transcendental */
  Transcendental = 'Transcendental',
  /** Unknown or complex type */
  Unknown = 'Unknown',
}

/**
 * Mathematical properties of an expression
 */
export interface ExpressionProperties {
  /** Is the expression always positive? */
  readonly positive?: boolean;
  /** Is the expression always negative? */
  readonly negative?: boolean;
  /** Is the expression always real-valued? */
  readonly real?: boolean;
  /** Is the expression always integer-valued? */
  readonly integer?: boolean;
  /** Is the expression even? f(-x) = f(x) */
  readonly even?: boolean;
  /** Is the expression odd? f(-x) = -f(x) */
  readonly odd?: boolean;
  /** Is the expression linear in any variable? */
  readonly linear?: boolean;
  /** Is the expression periodic? */
  readonly periodic?: boolean;
  /** Period if periodic */
  readonly period?: number;
}

/**
 * Complexity metrics for an expression
 */
export interface ComplexityMetrics {
  /** Total number of nodes in the AST */
  readonly nodeCount: number;
  /** Maximum depth of the expression tree */
  readonly depth: number;
  /** Number of operations */
  readonly operationCount: number;
  /** Number of function calls */
  readonly functionCount: number;
  /** Number of unique variables */
  readonly variableCount: number;
  /** Estimated computational complexity (simplified measure) */
  readonly computationalComplexity: number;
}

/**
 * Variable dependency information
 */
export interface VariableDependency {
  /** Variable name */
  readonly name: string;
  /** Degree of the variable (for polynomials) */
  readonly degree: number;
  /** Does the variable appear in a transcendental function? */
  readonly transcendental: boolean;
}

/**
 * Enhanced expression tree with metadata
 */
export interface EnhancedExpression {
  /** Original AST node */
  readonly node: ExpressionNode;
  /** Expression type classification */
  readonly type: ExpressionType;
  /** Mathematical properties */
  readonly properties: ExpressionProperties;
  /** Complexity metrics */
  readonly complexity: ComplexityMetrics;
  /** Variable dependencies */
  readonly variables: ReadonlyArray<VariableDependency>;
  /** LaTeX representation */
  readonly latex?: string;
  /** Human-readable description */
  readonly description?: string;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze an expression and create enhanced expression tree
 */
export function analyzeExpression(node: ExpressionNode): EnhancedExpression {
  const type = classifyExpression(node);
  const properties = analyzeProperties(node);
  const complexity = computeComplexity(node);
  const variables = analyzeVariables(node);

  return {
    node,
    type,
    properties,
    complexity,
    variables,
  };
}

/**
 * Classify expression type
 */
export function classifyExpression(node: ExpressionNode): ExpressionType {
  if (isConstantNode(node)) {
    return ExpressionType.Constant;
  }

  if (isSymbolNode(node)) {
    return ExpressionType.Variable;
  }

  if (isFunctionNode(node)) {
    const fn = node.fn;
    if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh'].includes(fn)) {
      return ExpressionType.Trigonometric;
    }
    if (['exp'].includes(fn)) {
      return ExpressionType.Exponential;
    }
    if (['log', 'log10', 'log2'].includes(fn)) {
      return ExpressionType.Logarithmic;
    }
    return ExpressionType.Transcendental;
  }

  if (isOperatorNode(node)) {
    const leftType = classifyExpression(node.args[0]);
    const rightType = classifyExpression(node.args[1]);

    // If either side is transcendental, the whole expression is
    if (leftType === ExpressionType.Transcendental || rightType === ExpressionType.Transcendental) {
      return ExpressionType.Transcendental;
    }

    // Trigonometric/exponential/logarithmic propagates
    if (leftType === ExpressionType.Trigonometric || rightType === ExpressionType.Trigonometric) {
      return ExpressionType.Trigonometric;
    }
    if (leftType === ExpressionType.Exponential || rightType === ExpressionType.Exponential) {
      return ExpressionType.Exponential;
    }
    if (leftType === ExpressionType.Logarithmic || rightType === ExpressionType.Logarithmic) {
      return ExpressionType.Logarithmic;
    }

    // Check for polynomial
    if (isPolynomialOperation(node, leftType, rightType)) {
      return ExpressionType.Polynomial;
    }

    // Check for rational
    if (node.op === '/' && isPolynomial(node.args[0]) && isPolynomial(node.args[1])) {
      return ExpressionType.Rational;
    }

    return ExpressionType.Polynomial;
  }

  return ExpressionType.Unknown;
}

/**
 * Check if operation preserves polynomial property
 */
function isPolynomialOperation(
  node: OperatorNode,
  leftType: ExpressionType,
  rightType: ExpressionType
): boolean {
  const polynomialTypes = [
    ExpressionType.Constant,
    ExpressionType.Variable,
    ExpressionType.Polynomial,
  ];

  if (!polynomialTypes.includes(leftType) || !polynomialTypes.includes(rightType)) {
    return false;
  }

  // +, -, * preserve polynomial property
  if (['+', '-', '*'].includes(node.op)) {
    return true;
  }

  // ^ preserves polynomial if exponent is constant non-negative integer
  if (node.op === '^') {
    const right = node.args[1];
    if (isConstantNode(right)) {
      const val = right.value;
      return typeof val === 'number' && Number.isInteger(val) && val >= 0;
    }
  }

  return false;
}

/**
 * Check if expression is a polynomial
 */
function isPolynomial(node: ExpressionNode): boolean {
  const type = classifyExpression(node);
  return [
    ExpressionType.Constant,
    ExpressionType.Variable,
    ExpressionType.Polynomial,
  ].includes(type);
}

/**
 * Analyze mathematical properties
 */
export function analyzeProperties(node: ExpressionNode): ExpressionProperties {
  // Check if constant
  if (isConstantNode(node)) {
    const val = typeof node.value === 'number' ? node.value : Number(node.value);
    return {
      positive: val > 0,
      negative: val < 0,
      real: true,
      integer: Number.isInteger(val),
    };
  }

  // Check for even/odd functions
  if (isFunctionNode(node)) {
    if (['cos'].includes(node.fn)) {
      return {
        even: true,
        periodic: true,
        period: 2 * Math.PI,
      };
    }
    if (['sin', 'tan'].includes(node.fn)) {
      return {
        odd: true,
        periodic: true,
        period: node.fn === 'tan' ? Math.PI : 2 * Math.PI,
      };
    }
    if (['abs'].includes(node.fn)) {
      return {
        even: true,
        positive: true,
      };
    }
    if (['exp'].includes(node.fn)) {
      return {
        positive: true,
        real: true,
      };
    }
  }

  // Check for power operations
  if (isOperatorNode(node) && node.op === '^') {
    const left = node.args[0];
    const right = node.args[1];

    if (isConstantNode(right)) {
      const exp = typeof right.value === 'number' ? right.value : Number(right.value);
      if (Number.isInteger(exp)) {
        if (exp % 2 === 0) {
          return {
            positive: true,
            even: true,
          };
        }
        return {
          integer: isConstantNode(left) && typeof left.value === 'number' && Number.isInteger(left.value),
        };
      }
    }
  }

  return {};
}

/**
 * Compute complexity metrics
 */
export function computeComplexity(node: ExpressionNode): ComplexityMetrics {
  let nodeCount = 0;
  let operationCount = 0;
  let functionCount = 0;
  const variables = new Set<string>();

  function traverse(n: ExpressionNode, depth: number): number {
    nodeCount++;

    if (isSymbolNode(n)) {
      variables.add(n.name);
      return depth;
    }

    if (isOperatorNode(n)) {
      operationCount++;
      const leftDepth = traverse(n.args[0], depth + 1);
      const rightDepth = traverse(n.args[1], depth + 1);
      return Math.max(leftDepth, rightDepth);
    }

    if (isFunctionNode(n)) {
      functionCount++;
      const depths = n.args.map(arg => traverse(arg, depth + 1));
      return Math.max(...depths, depth);
    }

    return depth;
  }

  const depth = traverse(node, 1);

  // Computational complexity estimate (simplified)
  // Based on node count and function count
  const computationalComplexity = nodeCount + functionCount * 2;

  return {
    nodeCount,
    depth,
    operationCount,
    functionCount,
    variableCount: variables.size,
    computationalComplexity,
  };
}

/**
 * Analyze variable dependencies
 */
export function analyzeVariables(node: ExpressionNode): ReadonlyArray<VariableDependency> {
  const variableMap = new Map<string, { degree: number; transcendental: boolean }>();

  function traverse(n: ExpressionNode, inTranscendental: boolean): void {
    if (isSymbolNode(n)) {
      const existing = variableMap.get(n.name);
      if (existing) {
        variableMap.set(n.name, {
          degree: Math.max(existing.degree, 1),
          transcendental: existing.transcendental || inTranscendental,
        });
      } else {
        variableMap.set(n.name, {
          degree: 1,
          transcendental: inTranscendental,
        });
      }
      return;
    }

    if (isOperatorNode(n)) {
      // Check for power to update degree
      if (n.op === '^') {
        const base = n.args[0];
        const exp = n.args[1];

        if (isSymbolNode(base) && isConstantNode(exp)) {
          const expVal = typeof exp.value === 'number' ? exp.value : Number(exp.value);
          const existing = variableMap.get(base.name);
          variableMap.set(base.name, {
            degree: Math.max(existing?.degree || 0, expVal),
            transcendental: existing?.transcendental || inTranscendental,
          });
        } else {
          traverse(base, inTranscendental);
          traverse(exp, inTranscendental);
        }
      } else {
        traverse(n.args[0], inTranscendental);
        traverse(n.args[1], inTranscendental);
      }
      return;
    }

    if (isFunctionNode(n)) {
      const isTransFunc = ['sin', 'cos', 'tan', 'exp', 'log', 'sqrt'].includes(n.fn);
      for (const arg of n.args) {
        traverse(arg, inTranscendental || isTransFunc);
      }
    }
  }

  traverse(node, false);

  return Array.from(variableMap.entries()).map(([name, info]) => ({
    name,
    degree: info.degree,
    transcendental: info.transcendental,
  }));
}

/**
 * Get all variables in an expression
 */
export function getVariables(node: ExpressionNode): ReadonlyArray<string> {
  const variables = new Set<string>();

  function traverse(n: ExpressionNode): void {
    if (isSymbolNode(n)) {
      variables.add(n.name);
      return;
    }

    if (isOperatorNode(n)) {
      traverse(n.args[0]);
      traverse(n.args[1]);
      return;
    }

    if (isFunctionNode(n)) {
      for (const arg of n.args) {
        traverse(arg);
      }
    }
  }

  traverse(node);
  return Array.from(variables).sort();
}

/**
 * Get the degree of a polynomial in a given variable
 * Returns -1 if not a polynomial
 */
export function getPolynomialDegree(node: ExpressionNode, variable: string): number {
  if (isConstantNode(node)) {
    return 0;
  }

  if (isSymbolNode(node)) {
    return node.name === variable ? 1 : 0;
  }

  if (isOperatorNode(node)) {
    const left = node.args[0];
    const right = node.args[1];

    switch (node.op) {
      case '+':
      case '-': {
        const leftDegree = getPolynomialDegree(left, variable);
        const rightDegree = getPolynomialDegree(right, variable);
        if (leftDegree === -1 || rightDegree === -1) return -1;
        return Math.max(leftDegree, rightDegree);
      }

      case '*': {
        const leftDegree = getPolynomialDegree(left, variable);
        const rightDegree = getPolynomialDegree(right, variable);
        if (leftDegree === -1 || rightDegree === -1) return -1;
        return leftDegree + rightDegree;
      }

      case '^': {
        const baseDegree = getPolynomialDegree(left, variable);
        if (baseDegree === -1) return -1;

        // Exponent must be constant non-negative integer
        if (isConstantNode(right)) {
          const exp = typeof right.value === 'number' ? right.value : Number(right.value);
          if (Number.isInteger(exp) && exp >= 0) {
            return baseDegree * exp;
          }
        }
        return -1;
      }

      case '/': {
        // Division by variable makes it not a polynomial
        const denomDegree = getPolynomialDegree(right, variable);
        if (denomDegree > 0) return -1;

        const numDegree = getPolynomialDegree(left, variable);
        return numDegree;
      }

      default:
        return -1;
    }
  }

  // Functions make it not a polynomial (except for special cases)
  return -1;
}

/**
 * Check if expression contains a specific variable
 */
export function containsVariable(node: ExpressionNode, variable: string): boolean {
  return getVariables(node).includes(variable);
}

/**
 * Estimate the "simplicity" of an expression (lower is simpler)
 */
export function getSimplicityScore(node: ExpressionNode): number {
  const complexity = computeComplexity(node);

  // Simpler expressions have:
  // - Fewer nodes
  // - Lower depth
  // - Fewer operations
  // - Fewer functions
  return (
    complexity.nodeCount * 1 +
    complexity.depth * 2 +
    complexity.operationCount * 1.5 +
    complexity.functionCount * 3
  );
}
