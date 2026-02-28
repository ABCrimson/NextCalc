/**
 * Improper Integrals Handler
 *
 * Handles integration with:
 * - Infinite limits (∫[a,∞] or ∫[-∞,b] or ∫[-∞,∞])
 * - Singularities at endpoints or interior points
 * - Oscillatory integrands (Filon's method)
 * - Exponential decay detection
 *
 * @module @nextcalc/math-engine/symbolic/integrate-improper
 */

import type { ExpressionNode } from '../parser/ast';
import {
  NodeType,
  createConstantNode,
  createSymbolNode,
  createOperatorNode,
  createUnaryOperatorNode,
  createFunctionNode,
  type OperatorNode,
  type UnaryOperatorNode,
  type FunctionNode,
} from '../parser/ast';
import { parse } from '../parser/parser';
import { evaluate } from '../parser/evaluator';
import {
  integrateNumerical,
  type NumericalIntegrationConfig,
  type IntegrationResult,
  IntegrationError,
} from './integrate-numerical';

/**
 * Improper integral configuration
 */
export interface ImproperIntegralConfig extends NumericalIntegrationConfig {
  /** Strategy for infinite limits */
  infiniteStrategy?: 'substitution' | 'truncation';

  /** Singularity handling */
  singularityStrategy?: 'subtraction' | 'transformation' | 'adaptive';

  /** Detect oscillatory behavior */
  detectOscillation?: boolean;

  /** Truncation point for infinite integrals (default: based on decay) */
  truncationPoint?: number;
}

/**
 * Substitute a variable in an expression with another expression
 * Creates a deep copy with the substitution applied
 */
function substituteVariable(
  expr: ExpressionNode,
  variable: string,
  replacement: ExpressionNode
): ExpressionNode {
  switch (expr.type) {
    case NodeType.ConstantNode:
      return expr;

    case NodeType.SymbolNode:
      if (expr.name === variable) {
        return replacement;
      }
      return expr;

    case NodeType.OperatorNode: {
      const opNode = expr as OperatorNode;
      return createOperatorNode(
        opNode.op,
        opNode.fn,
        [
          substituteVariable(opNode.args[0], variable, replacement),
          substituteVariable(opNode.args[1], variable, replacement),
        ] as const
      );
    }

    case NodeType.UnaryOperatorNode: {
      const unaryNode = expr as UnaryOperatorNode;
      return createUnaryOperatorNode(
        unaryNode.op,
        unaryNode.fn,
        [substituteVariable(unaryNode.args[0], variable, replacement)] as const
      );
    }

    case NodeType.FunctionNode: {
      const fnNode = expr as FunctionNode;
      return createFunctionNode(
        fnNode.fn,
        fnNode.args.map(arg => substituteVariable(arg, variable, replacement))
      );
    }

    default:
      // For any other node type (ParenthesisNode, AccessorNode), return as-is
      return expr;
  }
}

/**
 * Check if function appears to decay exponentially
 * Planned: optimize infinite integrals by detecting exponential decay in the integrand
 */
// function hasExponentialDecay(
//   expr: ExpressionNode,
//   variable: string,
//   x: number
// ): boolean {
//   const testPoints = [x, x * 2, x * 4];
//   const values: number[] = [];
//
//   for (const point of testPoints) {
//     const result = evaluate(expr, { variables: { [variable]: point } });
//     if (!result.success) return false;
//
//     const value = Math.abs(Number(result.value));
//     if (!Number.isFinite(value)) return false;
//
//     values.push(value);
//   }
//
//   // Check if values decrease exponentially
//   const val0 = values[0];
//   const val1 = values[1];
//   const val2 = values[2];
//   if (val0 === undefined || val1 === undefined || val2 === undefined) return false;
//   const ratio1 = val1 / val0;
//   const ratio2 = val2 / val1;
//
//   return ratio1 < 0.5 && ratio2 < 0.5 && Math.abs(ratio1 - ratio2) < 0.1;
// }

/**
 * Detect singularity by sampling near point
 */
function detectSingularity(
  expr: ExpressionNode,
  variable: string,
  point: number,
  epsilon = 1e-6
): boolean {
  const testPoints = [
    point - epsilon,
    point - epsilon / 10,
    point + epsilon / 10,
    point + epsilon,
  ];

  for (const x of testPoints) {
    const result = evaluate(expr, { variables: { [variable]: x } });

    if (!result.success) return true;

    const value = Number(result.value);
    if (!Number.isFinite(value) || Math.abs(value) > 1e10) {
      return true;
    }
  }

  return false;
}

/**
 * Find optimal truncation point for infinite integral
 */
function findTruncationPoint(
  expr: ExpressionNode,
  variable: string,
  start: number,
  tolerance: number
): number {
  let x = Math.abs(start) + 10;
  const maxX = 1e6;

  while (x < maxX) {
    const result = evaluate(expr, { variables: { [variable]: x } });

    if (!result.success) {
      return x / 2;
    }

    const value = Math.abs(Number(result.value));

    if (value < tolerance || !Number.isFinite(value)) {
      return x;
    }

    x *= 2;
  }

  return maxX;
}

/**
 * Integrate to positive infinity using substitution u = 1/x
 *
 * ∫[a,∞] f(x) dx = ∫[0,1/a] f(1/u) / u² du
 */
function integrateToInfinity(
  expr: ExpressionNode,
  variable: string,
  a: number,
  config: ImproperIntegralConfig
): IntegrationResult {
  const strategy = config.infiniteStrategy ?? 'substitution';

  if (strategy === 'truncation' || a === 0) {
    // Use truncation method
    const tolerance = config.tolerance ?? 1e-10;
    const truncPoint = config.truncationPoint
      ?? findTruncationPoint(expr, variable, a, tolerance);

    const result = integrateNumerical(expr, variable, a, truncPoint, config);

    result.warnings.push(
      `Infinite integral truncated at ${truncPoint.toExponential(2)}`
    );

    return result;
  }

  // Substitution: u = 1/x, x = 1/u, dx = -1/u² du
  // When x = a, u = 1/a; when x → ∞, u → 0
  // The integral becomes: ∫[0, 1/a] f(1/u) / u² du

  // Create a transformed expression: f(1/u) / u²
  // We do this by building a wrapper AST node that applies the substitution
  const upperBound = 1 / a;

  // Small epsilon to avoid singularity at u = 0
  const epsilon = config.tolerance ?? 1e-10;
  const lowerBound = epsilon;

  // Create the substituted expression: f(1/u) * (1/u²)
  // This is represented as: original_expr[variable -> 1/u] * (1/u²)
  const oneOverU = createOperatorNode('/', 'divide', [
    createConstantNode(1),
    createSymbolNode('u'),
  ] as const);

  const uSquared = createOperatorNode('^', 'pow', [
    createSymbolNode('u'),
    createConstantNode(2),
  ] as const);

  const oneOverUSq = createOperatorNode('/', 'divide', [
    createConstantNode(1),
    uSquared,
  ] as const);

  const substitutedExpr: ExpressionNode = createOperatorNode('*', 'multiply', [
    substituteVariable(expr, variable, oneOverU),
    oneOverUSq,
  ] as const);

  // Integrate the transformed expression from epsilon to 1/a
  const result = integrateNumerical(substitutedExpr, 'u', lowerBound, upperBound, {
    ...config,
    subdivisions: Math.max(config.subdivisions ?? 50, 100), // More subdivisions for accuracy
  });

  result.warnings.push(
    `Used substitution u = 1/${variable} for infinite integral`
  );

  return result;
}

/**
 * Integrate from negative infinity using substitution
 *
 * ∫[-∞,b] f(x) dx can be transformed using:
 * 1. Substitution: x = b - t, then ∫[0,∞] f(b-t) dt
 * 2. Truncation: find suitable lower bound and integrate directly
 */
function integrateFromNegInfinity(
  expr: ExpressionNode,
  variable: string,
  b: number,
  config: ImproperIntegralConfig
): IntegrationResult {
  const strategy = config.infiniteStrategy ?? 'substitution';
  const tolerance = config.tolerance ?? 1e-10;

  if (strategy === 'truncation') {
    // Use truncation method - find where function becomes negligible
    const truncPoint = -findTruncationPoint(expr, variable, Math.abs(b) + 1, tolerance);

    const result = integrateNumerical(expr, variable, truncPoint, b, config);

    result.warnings.push(
      `Infinite integral truncated at ${truncPoint.toExponential(2)}`
    );

    return result;
  }

  // Substitution method: x = b - t, dx = -dt
  // When x = b, t = 0; when x → -∞, t → ∞
  // ∫[-∞,b] f(x) dx = ∫[0,∞] f(b-t) dt

  // Create substituted expression: f(b - t)
  const bMinusT = createOperatorNode('-', 'subtract', [
    createConstantNode(b),
    createSymbolNode('t'),
  ] as const);

  const substitutedExpr = substituteVariable(expr, variable, bMinusT);

  // Now we need to integrate from 0 to ∞
  // Use another substitution: u = 1/(1+t), t = (1-u)/u, dt = -1/u² du
  // When t = 0, u = 1; when t → ∞, u → 0
  // ∫[0,∞] g(t) dt = ∫[0,1] g((1-u)/u) / u² du

  // Create the final transformed expression
  const tExpr: ExpressionNode = createOperatorNode('/', 'divide', [
    createOperatorNode('-', 'subtract', [
      createConstantNode(1),
      createSymbolNode('u'),
    ] as const),
    createSymbolNode('u'),
  ] as const);

  const uSquaredFinal = createOperatorNode('^', 'pow', [
    createSymbolNode('u'),
    createConstantNode(2),
  ] as const);

  const finalExpr: ExpressionNode = createOperatorNode('*', 'multiply', [
    substituteVariable(substitutedExpr, 't', tExpr),
    createOperatorNode('/', 'divide', [
      createConstantNode(1),
      uSquaredFinal,
    ] as const),
  ] as const);

  // Small epsilon to avoid singularity at u = 0
  const epsilon = tolerance;

  // Integrate from epsilon to 1
  const result = integrateNumerical(finalExpr, 'u', epsilon, 1, {
    ...config,
    subdivisions: Math.max(config.subdivisions ?? 50, 100),
  });

  result.warnings.push(
    `Used substitution ${variable} = ${b} - (1-u)/u for infinite integral from -∞`
  );

  return result;
}

/**
 * Integrate over entire real line
 *
 * ∫[-∞,∞] f(x) dx = ∫[-∞,0] f(x) dx + ∫[0,∞] f(x) dx
 */
function integrateOverRealLine(
  expr: ExpressionNode,
  variable: string,
  config: ImproperIntegralConfig
): IntegrationResult {
  // Split at x = 0
  const negPart = integrateFromNegInfinity(expr, variable, 0, config);
  const posPart = integrateToInfinity(expr, variable, 0, config);

  return {
    value: negPart.value + posPart.value,
    error: negPart.error + posPart.error,
    evaluations: negPart.evaluations + posPart.evaluations,
    subdivisions: negPart.subdivisions + posPart.subdivisions,
    converged: negPart.converged && posPart.converged,
    warnings: [...negPart.warnings, ...posPart.warnings],
  };
}

/**
 * Handle singularity at endpoint using limit
 *
 * ∫[a,b] f(x) dx where f has singularity at a
 * = lim(ε→0+) ∫[a+ε,b] f(x) dx
 */
function integrateSingularEndpoint(
  expr: ExpressionNode,
  variable: string,
  a: number,
  b: number,
  singularAt: 'left' | 'right',
  config: ImproperIntegralConfig
): IntegrationResult {
  // Use a more aggressive epsilon for singularities
  // For integrable singularities like 1/sqrt(x), we need to avoid the singularity but get close
  const baseEpsilon = 1e-8;
  const epsilonStart = Math.max(baseEpsilon, Math.abs(a === 0 ? 1 : a) * 1e-8, (b - a) * 1e-6);

  let adjustedA = a;
  let adjustedB = b;

  if (singularAt === 'left') {
    adjustedA = a + epsilonStart;
  } else {
    adjustedB = b - epsilonStart;
  }

  // Use higher subdivisions for better accuracy near singularities
  const singularityConfig = {
    ...config,
    subdivisions: Math.max(config.subdivisions ?? 50, 100),
    tolerance: config.tolerance ?? 1e-6,
  };

  const result = integrateNumerical(expr, variable, adjustedA, adjustedB, singularityConfig);

  result.warnings.push(
    `Singularity at ${singularAt} endpoint avoided with ε = ${epsilonStart.toExponential(2)}`
  );

  return result;
}

/**
 * Split integral around interior singularity
 *
 * ∫[a,b] f(x) dx where f has singularity at c ∈ (a,b)
 * = ∫[a,c-ε] f(x) dx + ∫[c+ε,b] f(x) dx
 */
function integrateAroundSingularity(
  expr: ExpressionNode,
  variable: string,
  a: number,
  b: number,
  singularity: number,
  config: ImproperIntegralConfig
): IntegrationResult {
  const epsilon = config.tolerance ?? 1e-10;
  const eps = Math.max(epsilon, Math.abs(singularity) * 1e-10);

  const leftPart = integrateNumerical(
    expr,
    variable,
    a,
    singularity - eps,
    config
  );

  const rightPart = integrateNumerical(
    expr,
    variable,
    singularity + eps,
    b,
    config
  );

  return {
    value: leftPart.value + rightPart.value,
    error: leftPart.error + rightPart.error,
    evaluations: leftPart.evaluations + rightPart.evaluations,
    subdivisions: leftPart.subdivisions + rightPart.subdivisions,
    converged: leftPart.converged && rightPart.converged,
    warnings: [
      ...leftPart.warnings,
      ...rightPart.warnings,
      `Split around singularity at ${singularity} with ε = ${eps.toExponential(2)}`,
    ],
  };
}

/**
 * Filon's method for oscillatory integrals
 *
 * Efficient for integrals of the form: ∫ f(x) * sin(ωx) dx or ∫ f(x) * cos(ωx) dx
 * Planned: automatic detection and handling of oscillatory integrals using Filon's method
 */
// function integrateOscillatory(
//   expr: ExpressionNode,
//   variable: string,
//   a: number,
//   b: number,
//   omega: number,
//   config: ImproperIntegralConfig
// ): IntegrationResult {
//   // For high-frequency oscillation, use adaptive method with careful subdivision
//   const n = Math.max(100, Math.ceil(Math.abs(omega * (b - a)) / Math.PI));
//
//   const result = integrateNumerical(expr, variable, a, b, {
//     ...config,
//     subdivisions: n,
//   });
//
//   result.warnings.push(
//     `Oscillatory integral with ω ≈ ${omega.toFixed(2)}, used ${n} subdivisions`
//   );
//
//   return result;
// }

/**
 * Main improper integral function
 *
 * @param expression - Expression to integrate
 * @param variable - Variable of integration
 * @param a - Lower bound (use -Infinity for -∞)
 * @param b - Upper bound (use Infinity for ∞)
 * @param config - Configuration options
 * @returns Integration result
 *
 * @example
 * ```ts
 * // Integrate 1/x² from 1 to infinity
 * const result = integrateImproper(
 *   parse('1/x^2'),
 *   'x',
 *   1,
 *   Infinity,
 *   { infiniteStrategy: 'substitution' }
 * );
 *
 * console.log(result.value); // Should be close to 1
 * ```
 */
export function integrateImproper(
  expression: string | ExpressionNode,
  variable: string,
  a: number,
  b: number,
  config: ImproperIntegralConfig = {}
): IntegrationResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;

  // Handle infinite limits
  if (!Number.isFinite(a) && !Number.isFinite(b)) {
    return integrateOverRealLine(expr, variable, config);
  }

  if (!Number.isFinite(a)) {
    return integrateFromNegInfinity(expr, variable, b, config);
  }

  if (!Number.isFinite(b)) {
    return integrateToInfinity(expr, variable, a, config);
  }

  // Finite integral - check for singularities
  if (config.detectSingularities !== false) {
    const leftSingular = detectSingularity(expr, variable, a);
    const rightSingular = detectSingularity(expr, variable, b);

    if (leftSingular && rightSingular) {
      throw new IntegrationError(
        'Singularities at both endpoints - integral may not converge'
      );
    }

    if (leftSingular) {
      return integrateSingularEndpoint(expr, variable, a, b, 'left', config);
    }

    if (rightSingular) {
      return integrateSingularEndpoint(expr, variable, a, b, 'right', config);
    }

    // Check for interior singularities (sample points)
    const samplePoints = [
      a + (b - a) * 0.25,
      a + (b - a) * 0.5,
      a + (b - a) * 0.75,
    ];

    for (const point of samplePoints) {
      if (detectSingularity(expr, variable, point)) {
        return integrateAroundSingularity(expr, variable, a, b, point, config);
      }
    }
  }

  // No singularities detected, use standard numerical integration
  return integrateNumerical(expr, variable, a, b, config);
}

/**
 * Integrate with automatic singularity detection
 *
 * Convenience function that automatically handles improper integrals
 */
export function integrateAuto(
  expression: string | ExpressionNode,
  variable: string,
  a: number,
  b: number,
  config: ImproperIntegralConfig = {}
): IntegrationResult {
  // Enable singularity detection by default
  const autoConfig = {
    ...config,
    detectSingularities: config.detectSingularities ?? true,
  };

  return integrateImproper(expression, variable, a, b, autoConfig);
}
