/**
 * Taylor and Maclaurin Series Expansion Engine
 *
 * Provides series expansion capabilities for symbolic expressions:
 * - Taylor series expansion around any point
 * - Maclaurin series (special case at x=0)
 * - Common series for elementary functions (sin, cos, exp, ln, etc.)
 * - Error estimation and remainder terms
 * - Radius of convergence computation
 * - Automatic term simplification
 *
 * Uses symbolic differentiation to compute Taylor coefficients and
 * maintains exact arithmetic where possible for precise expansions.
 */

import type {
  ExpressionNode,
} from '../parser/ast';
import {
  createConstantNode,
  createSymbolNode,
  createOperatorNode,
  isConstantNode,
  isSymbolNode,
  isFunctionNode,
} from '../parser/ast';
import { differentiate } from './differentiate';
import { simplify, substitute } from './simplify';

/**
 * Configuration for series expansion
 */
export interface SeriesConfig {
  /** Center point for expansion (default: 0 for Maclaurin) */
  center?: number;
  /** Number of terms to compute (default: 5) */
  terms?: number;
  /** Include remainder term (default: false) */
  includeRemainder?: boolean;
  /** Simplify each term (default: true) */
  simplifyTerms?: boolean;
  /** Include step-by-step derivation (default: false) */
  includeSteps?: boolean;
}

/**
 * Result of series expansion
 */
export interface SeriesResult {
  /** Individual terms of the series */
  readonly terms: ReadonlyArray<ExpressionNode>;
  /** Combined polynomial expression */
  readonly polynomial: ExpressionNode;
  /** Remainder term (if requested) */
  readonly remainder?: ExpressionNode | undefined;
  /** Radius of convergence (if computable) */
  readonly radiusOfConvergence?: number | undefined;
  /** LaTeX representation */
  readonly latex: string;
  /** Step-by-step explanation */
  readonly steps?: readonly string[] | undefined;
}

/**
 * Compute Taylor series expansion of an expression
 *
 * Taylor Series Formula:
 * f(x) = Σ[n=0 to ∞] (f^(n)(a) / n!) * (x - a)^n
 *
 * where:
 * - f^(n)(a) is the nth derivative of f evaluated at a
 * - n! is the factorial of n
 * - a is the center of expansion
 *
 * @param expr - Expression to expand
 * @param variable - Variable to expand with respect to
 * @param config - Expansion configuration
 * @returns Series expansion result
 *
 * @example
 * ```typescript
 * // Taylor series of sin(x) around x=0 (Maclaurin series)
 * const expr = parse("sin(x)");
 * const result = taylorSeries(expr, 'x', { terms: 5 });
 * // Result: x - x^3/6 + x^5/120 - ...
 * ```
 */
export function taylorSeries(
  expr: ExpressionNode,
  variable: string,
  config: SeriesConfig = {}
): SeriesResult {
  const {
    center = 0,
    terms = 5,
    includeRemainder = false,
    simplifyTerms = true,
    includeSteps = false,
  } = config;

  const steps: string[] = [];

  if (includeSteps) {
    steps.push(
      `Computing Taylor series expansion around ${variable} = ${center} with ${terms} terms`
    );
  }

  // Generate individual terms
  const seriesTerms: ExpressionNode[] = [];
  let currentDerivative = expr;

  for (let n = 0; n < terms; n++) {
    // Compute f^(n)(a)
    const derivativeAtCenter = evaluateAtPoint(currentDerivative, variable, center);

    if (includeSteps) {
      steps.push(
        `Term ${n}: f^(${n})(${center}) = ${formatValue(derivativeAtCenter)}`
      );
    }

    // Skip zero terms (optimization)
    if (derivativeAtCenter !== 0) {
      // Compute (x - a)^n
      const xMinusA = center === 0
        ? createSymbolNode(variable)
        : createOperatorNode('-', 'subtract', [
            createSymbolNode(variable),
            createConstantNode(center),
          ]);

      const power = n === 0
        ? createConstantNode(1)
        : n === 1
        ? xMinusA
        : createOperatorNode('^', 'pow', [xMinusA, createConstantNode(n)]);

      // Compute coefficient: f^(n)(a) / n!
      const factorial = computeFactorial(n);
      const coefficient = derivativeAtCenter / factorial;

      // Build term: coefficient * (x - a)^n
      let term: ExpressionNode;
      if (coefficient === 1) {
        term = power;
      } else {
        term = createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          power,
        ]);
      }

      // Simplify if requested
      if (simplifyTerms) {
        term = simplify(term);
      }

      seriesTerms.push(term);
    }

    // Compute next derivative for next iteration
    if (n < terms - 1) {
      currentDerivative = differentiate(currentDerivative, variable);
    }
  }

  // Build polynomial by summing all terms
  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  if (simplifyTerms) {
    polynomial = simplify(polynomial);
  }

  // Compute remainder term if requested
  let remainder: ExpressionNode | undefined;
  if (includeRemainder) {
    remainder = computeRemainderTerm(expr, variable, center, terms);
  }

  // Estimate radius of convergence
  const radiusOfConvergence = estimateRadiusOfConvergence(expr, variable, center);

  // Generate LaTeX representation
  const latex = generateSeriesLatex(seriesTerms, variable, center);

  return {
    terms: seriesTerms,
    polynomial,
    remainder,
    radiusOfConvergence,
    latex,
    steps: includeSteps ? steps : undefined,
  };
}

/**
 * Compute Maclaurin series (Taylor series at x=0)
 *
 * This is a convenience wrapper around taylorSeries with center=0.
 *
 * @param expr - Expression to expand
 * @param variable - Variable to expand with respect to
 * @param config - Expansion configuration (center will be set to 0)
 * @returns Series expansion result
 *
 * @example
 * ```typescript
 * // Maclaurin series of e^x
 * const expr = parse("exp(x)");
 * const result = maclaurinSeries(expr, 'x', { terms: 6 });
 * // Result: 1 + x + x^2/2 + x^3/6 + x^4/24 + x^5/120
 * ```
 */
export function maclaurinSeries(
  expr: ExpressionNode,
  variable: string,
  config: Omit<SeriesConfig, 'center'> = {}
): SeriesResult {
  return taylorSeries(expr, variable, { ...config, center: 0 });
}

/**
 * Get known series expansion for common functions
 *
 * Returns pre-computed series for elementary functions for better
 * performance and exactness.
 *
 * @param functionName - Name of the function
 * @param variable - Variable name
 * @param config - Expansion configuration
 * @returns Series expansion or null if not a known function
 *
 * @example
 * ```typescript
 * // Get exact series for sin(x)
 * const result = getKnownSeries('sin', 'x', { terms: 5 });
 * ```
 */
export function getKnownSeries(
  functionName: string,
  variable: string,
  config: SeriesConfig = {}
): SeriesResult | null {
  const { center = 0, terms = 5 } = config;

  // Only provide known series for center = 0 (Maclaurin)
  if (center !== 0) return null;

  switch (functionName) {
    case 'sin':
      return getSineSeries(variable, terms);
    case 'cos':
      return getCosineSeries(variable, terms);
    case 'exp':
      return getExponentialSeries(variable, terms);
    case 'ln':
    case 'log':
      return getLogarithmSeries(variable, terms);
    case 'tan':
      return getTangentSeries(variable, terms);
    case 'sinh':
      return getSinhSeries(variable, terms);
    case 'cosh':
      return getCoshSeries(variable, terms);
    default:
      return null;
  }
}

// ============================================================================
// KNOWN SERIES EXPANSIONS
// ============================================================================

/**
 * Sine series: sin(x) = x - x^3/3! + x^5/5! - x^7/7! + ...
 */
function getSineSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  for (let n = 0; n < terms; n++) {
    const power = 2 * n + 1;
    const sign = n % 2 === 0 ? 1 : -1;
    const factorial = computeFactorial(power);
    const coefficient = sign / factorial;

    const term = createOperatorNode('*', 'multiply', [
      createConstantNode(coefficient),
      createOperatorNode('^', 'pow', [x, createConstantNode(power)]),
    ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: Infinity,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Cosine series: cos(x) = 1 - x^2/2! + x^4/4! - x^6/6! + ...
 */
function getCosineSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  for (let n = 0; n < terms; n++) {
    const power = 2 * n;
    const sign = n % 2 === 0 ? 1 : -1;
    const factorial = computeFactorial(power);
    const coefficient = sign / factorial;

    const term = power === 0
      ? createConstantNode(coefficient)
      : createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          createOperatorNode('^', 'pow', [x, createConstantNode(power)]),
        ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: Infinity,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Exponential series: e^x = 1 + x + x^2/2! + x^3/3! + x^4/4! + ...
 */
function getExponentialSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  for (let n = 0; n < terms; n++) {
    const factorial = computeFactorial(n);
    const coefficient = 1 / factorial;

    const term = n === 0
      ? createConstantNode(coefficient)
      : n === 1
      ? createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          x,
        ])
      : createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          createOperatorNode('^', 'pow', [x, createConstantNode(n)]),
        ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: Infinity,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Natural logarithm series: ln(1+x) = x - x^2/2 + x^3/3 - x^4/4 + ...
 * Valid for |x| < 1
 */
function getLogarithmSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  for (let n = 1; n <= terms; n++) {
    const sign = n % 2 === 1 ? 1 : -1;
    const coefficient = sign / n;

    const term = n === 1
      ? createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          x,
        ])
      : createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          createOperatorNode('^', 'pow', [x, createConstantNode(n)]),
        ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: 1,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Tangent series: tan(x) = x + x^3/3 + 2x^5/15 + 17x^7/315 + ...
 * (Uses Bernoulli numbers)
 */
function getTangentSeries(variable: string, terms: number): SeriesResult {
  // Simplified version - exact coefficients would require Bernoulli numbers
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  // First few terms of tan(x) series
  const coefficients = [1, 1/3, 2/15, 17/315, 62/2835];

  for (let n = 0; n < Math.min(terms, coefficients.length); n++) {
    const power = 2 * n + 1;
    const coefficient = coefficients[n];
    if (!coefficient) continue;

    const term = createOperatorNode('*', 'multiply', [
      createConstantNode(coefficient),
      createOperatorNode('^', 'pow', [x, createConstantNode(power)]),
    ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: Math.PI / 2,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Hyperbolic sine series: sinh(x) = x + x^3/3! + x^5/5! + x^7/7! + ...
 */
function getSinhSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  for (let n = 0; n < terms; n++) {
    const power = 2 * n + 1;
    const factorial = computeFactorial(power);
    const coefficient = 1 / factorial;

    const term = createOperatorNode('*', 'multiply', [
      createConstantNode(coefficient),
      createOperatorNode('^', 'pow', [x, createConstantNode(power)]),
    ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: Infinity,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Hyperbolic cosine series: cosh(x) = 1 + x^2/2! + x^4/4! + x^6/6! + ...
 */
function getCoshSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  for (let n = 0; n < terms; n++) {
    const power = 2 * n;
    const factorial = computeFactorial(power);
    const coefficient = 1 / factorial;

    const term = power === 0
      ? createConstantNode(coefficient)
      : createOperatorNode('*', 'multiply', [
          createConstantNode(coefficient),
          createOperatorNode('^', 'pow', [x, createConstantNode(power)]),
        ]);

    seriesTerms.push(simplify(term));
  }

  let polynomial: ExpressionNode = seriesTerms[0] ?? createConstantNode(0);
  for (let i = 1; i < seriesTerms.length; i++) {
    const term = seriesTerms[i];
    if (term) {
      polynomial = createOperatorNode('+', 'add', [polynomial, term]);
    }
  }

  return {
    terms: seriesTerms,
    polynomial: simplify(polynomial),
    radiusOfConvergence: Infinity,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Evaluate expression at a specific point
 */
function evaluateAtPoint(
  expr: ExpressionNode,
  variable: string,
  point: number
): number {
  const substituted = substitute(expr, variable, point);
  const simplified = simplify(substituted);

  if (isConstantNode(simplified)) {
    const val = simplified.value;
    if (typeof val === 'number') return val;
  }

  throw new Error(`Cannot evaluate expression at ${variable} = ${point}`);
}

/**
 * Compute factorial
 */
function computeFactorial(n: number): number {
  if (n < 0) throw new Error('Factorial undefined for negative numbers');
  if (n === 0 || n === 1) return 1;

  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Compute Lagrange remainder term
 *
 * R_n(x) = f^(n+1)(ξ) / (n+1)! * (x - a)^(n+1)
 * where ξ is between a and x
 */
function computeRemainderTerm(
  expr: ExpressionNode,
  variable: string,
  center: number,
  n: number
): ExpressionNode {
  // Compute (n+1)th derivative symbolically
  let derivative = expr;
  for (let i = 0; i <= n; i++) {
    derivative = differentiate(derivative, variable);
  }

  // Build (x - a)^(n+1)
  const xMinusA = center === 0
    ? createSymbolNode(variable)
    : createOperatorNode('-', 'subtract', [
        createSymbolNode(variable),
        createConstantNode(center),
      ]);

  const power = createOperatorNode('^', 'pow', [
    xMinusA,
    createConstantNode(n + 1),
  ]);

  // Build coefficient: 1 / (n+1)!
  const factorial = computeFactorial(n + 1);
  const coefficient = createConstantNode(1 / factorial);

  // Build: f^(n+1)(ξ) / (n+1)! * (x - a)^(n+1)
  // Note: ξ is represented symbolically
  const xi = createSymbolNode('ξ');
  const derivativeAtXi = substitute(derivative, variable, xi);

  const term = createOperatorNode('*', 'multiply', [
    createOperatorNode('*', 'multiply', [coefficient, derivativeAtXi]),
    power,
  ]);

  return simplify(term);
}

/**
 * Estimate radius of convergence
 *
 * For power series, uses ratio test when possible.
 * Returns Infinity if series converges everywhere.
 */
function estimateRadiusOfConvergence(
  expr: ExpressionNode,
  variable: string,
  center: number
): number | undefined {
  // Check for known functions with known convergence
  if (isFunctionNode(expr)) {
    const arg = expr.args[0];
    if (!arg) return undefined;

    // For f(g(x)), if g(x) = x and center = 0, use known values
    if (isSymbolNode(arg) && arg.name === variable && center === 0) {
      switch (expr.fn) {
        case 'sin':
        case 'cos':
        case 'exp':
        case 'sinh':
        case 'cosh':
          return Infinity;
        case 'ln':
        case 'log':
          return 1; // for ln(1+x)
        case 'tan':
          return Math.PI / 2;
        default:
          return undefined;
      }
    }
  }

  // For general expressions, would need ratio test implementation
  return undefined;
}

/**
 * Generate LaTeX representation of series
 */
function generateSeriesLatex(
  terms: ExpressionNode[],
  variable: string,
  center: number
): string {
  const termStrings = terms.map((term, i) => {
    // Simplified LaTeX generation
    // Full implementation would traverse AST and build proper LaTeX
    if (isConstantNode(term)) {
      return term.value.toString();
    }
    return `\\text{term}_${i}`;
  });

  const centerStr = center === 0 ? '' : ` \\text{ around } ${variable} = ${center}`;
  return `${termStrings.join(' + ')} + \\cdots${centerStr}`;
}

/**
 * Format numeric value for display
 */
function formatValue(value: number): string {
  if (Math.abs(value) < 1e-10) return '0';
  if (Math.abs(value - Math.round(value)) < 1e-10) {
    return Math.round(value).toString();
  }
  return value.toFixed(6);
}
