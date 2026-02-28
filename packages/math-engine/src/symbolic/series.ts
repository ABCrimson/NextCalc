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
  ConstantNode,
  OperatorNode,
  UnaryOperatorNode,
  FunctionNode,
} from '../parser/ast';
import {
  createConstantNode,
  createSymbolNode,
  createOperatorNode,
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isUnaryOperatorNode,
  isFunctionNode,
  visit,
} from '../parser/ast';
import { differentiate } from './differentiate';
import { simplify, substitute } from './simplify';
import { evaluate } from '../parser/evaluator';

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
    case 'sec':
      return getSecantSeries(variable, terms);
    case 'cot':
      return getCotangentSeries(variable, terms);
    case 'sinh':
      return getSinhSeries(variable, terms);
    case 'cosh':
      return getCoshSeries(variable, terms);
    case 'tanh':
      return getTanhSeries(variable, terms);
    default:
      return null;
  }
}

/**
 * Compute even Bernoulli numbers B_2, B_4, ..., B_{2*count}.
 *
 * This is a public wrapper around the internal Akiyama-Tanigawa implementation.
 * Bernoulli numbers appear in the Taylor series of many trigonometric and
 * hyperbolic functions (tan, sec, cot, tanh, etc.) and in numerous number-
 * theoretic formulas.
 *
 * @param count - Number of even Bernoulli numbers to compute
 * @returns Array [B_2, B_4, ..., B_{2*count}]
 *
 * @example
 * ```typescript
 * const b = computeBernoulliNumbers(4);
 * // b = [1/6, -1/30, 1/42, -1/30]
 * // representing B_2, B_4, B_6, B_8
 * ```
 */
export function computeBernoulliNumbers(count: number): number[] {
  return bernoulliNumbers(count);
}

/**
 * Convert an AST expression node to a LaTeX string representation.
 *
 * Handles all node types in the math-engine AST:
 * - Constants: `5` -> `5`, fractions detected automatically
 * - Symbols: `x` -> `x`
 * - Addition: `a + b` -> `a + b`
 * - Subtraction: `a - b` -> `a - b`
 * - Multiplication: `a * b` -> `a \cdot b` (or juxtaposition when appropriate)
 * - Division: `a / b` -> `\frac{a}{b}`
 * - Powers: `a ^ b` -> `a^{b}`
 * - Functions: `sin(x)` -> `\sin\left(x\right)`, `sqrt(x)` -> `\sqrt{x}`
 * - Parenthesization based on operator precedence
 *
 * @param node - The AST node to convert
 * @returns LaTeX string representation
 *
 * @example
 * ```typescript
 * import { parse } from '@nextcalc/math-engine/parser';
 * import { astToLatex } from '@nextcalc/math-engine/symbolic';
 *
 * const expr = parse('sin(x^2) + 1/3');
 * const latex = astToLatex(expr);
 * // latex = '\\sin\\left(x^{2}\\right) + \\frac{1}{3}'
 * ```
 */
export function astToLatex(node: ExpressionNode): string {
  return nodeToLatex(node, 0, false);
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
 * Compute Bernoulli numbers B(0), B(2), B(4), ..., B(2*count) using the
 * Akiyama-Tanigawa algorithm.
 *
 * The algorithm builds a triangular table T where:
 *   T[0][k] = 1 / (k + 1)
 *   T[n][k] = (k + 1) * (T[n-1][k] - T[n-1][k+1])
 *
 * The Bernoulli number B(n) = T[n][0].
 *
 * We only need even-indexed Bernoulli numbers (B_2, B_4, ...) because
 * all odd-indexed Bernoulli numbers with index > 1 are zero, and the
 * tangent series uses only B_{2n} for n >= 1.
 *
 * @param count - Number of even Bernoulli numbers to return: [B_2, B_4, ..., B_{2*count}]
 * @returns Array of length `count` with B_{2}, B_{4}, ..., B_{2*count}
 */
function bernoulliNumbers(count: number): number[] {
  if (count <= 0) return [];

  // We need B_0 through B_{2*count}.  The Akiyama-Tanigawa table row n
  // gives B_n, so we need 2*count + 1 rows.
  const totalRows = 2 * count + 1;

  // row[k] = T[currentRow][k].  We maintain only the current row in place.
  // Initialize with T[0][k] = 1/(k+1) for k = 0 .. totalRows-1
  const row: number[] = [];
  for (let k = 0; k < totalRows; k++) {
    row[k] = 1 / (k + 1);
  }

  // bernoulli[n] = B_n = T[n][0]; collect these as we go.
  // We only collect even-indexed B_n for n >= 2.
  const evenBernoulli: number[] = [];

  // The first element of the initial row (before any update) is B_0 = 1.
  // We iterate to update the row and read off B_n = row[0] after n updates.
  for (let n = 1; n <= 2 * count; n++) {
    // Update row in reverse to do the Akiyama-Tanigawa recurrence in place:
    // T[n][k] = (k+1) * (T[n-1][k] - T[n-1][k+1])
    const rowLength = totalRows - n;
    for (let k = 0; k < rowLength; k++) {
      row[k] = (k + 1) * ((row[k] ?? 0) - (row[k + 1] ?? 0));
    }
    // row[0] is now B_n.
    // Collect only even-indexed Bernoulli numbers with n >= 2.
    if (n >= 2 && n % 2 === 0) {
      evenBernoulli.push(row[0] ?? 0);
    }
  }

  return evenBernoulli;
}

/**
 * Tangent series: tan(x) = x + x^3/3 + 2x^5/15 + 17x^7/315 + ...
 *
 * The general term formula is:
 *   tan(x) = Σ_{n=1}^{∞} (-1)^{n-1} * 2^{2n} * (2^{2n} - 1) * B_{2n} / (2n)! * x^{2n-1}
 *
 * where B_{2n} are the Bernoulli numbers.  Note that (-1)^{n-1} * B_{2n} is
 * always positive because B_{2n} has sign (-1)^{n+1} for n >= 1:
 *   B_2 = 1/6  (positive, n=1: (-1)^0 * 1/6 > 0)
 *   B_4 = -1/30 (negative, n=2: (-1)^1 * (-1/30) > 0)
 * So the coefficients are always positive.
 */
function getTangentSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  // Compute the required even Bernoulli numbers: B_2, B_4, ..., B_{2*terms}
  const evenB = bernoulliNumbers(terms);

  for (let n = 1; n <= terms; n++) {
    // n-th term uses B_{2n} (1-indexed: evenB[n-1])
    const b2n = evenB[n - 1] ?? 0;
    const power = 2 * n - 1;  // x^1, x^3, x^5, ...
    const twoToThe2n = Math.pow(2, 2 * n);
    const factorial2n = computeFactorial(2 * n);

    // coefficient = (-1)^{n-1} * 2^{2n} * (2^{2n} - 1) * B_{2n} / (2n)!
    const sign = n % 2 === 1 ? 1 : -1;
    const coefficient = sign * twoToThe2n * (twoToThe2n - 1) * b2n / factorial2n;

    if (coefficient === 0) continue;

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
 * Secant series: sec(x) = 1 + x^2/2 + 5x^4/24 + 61x^6/720 + ...
 *
 * The general term formula uses Euler numbers E_{2n}:
 *   sec(x) = Σ_{n=0}^{∞} (-1)^n * E_{2n} / (2n)! * x^{2n}
 *
 * Euler numbers can be computed from Bernoulli numbers and powers of 2
 * via the secant coefficients. We use the recurrence relation for Euler
 * numbers directly:
 *   E_0 = 1
 *   E_{2n} = -Σ_{k=0}^{n-1} C(2n, 2k) * E_{2k}
 *
 * All secant coefficients are positive since the (-1)^n cancels the sign
 * of E_{2n}.
 */
function getSecantSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  // Compute Euler numbers E_0, E_2, ..., E_{2*(terms-1)} via recurrence
  const euler = eulerNumbers(terms);

  for (let n = 0; n < terms; n++) {
    const e2n = euler[n] ?? 0;
    const power = 2 * n;
    const factorial2n = computeFactorial(power);

    // coefficient = (-1)^n * E_{2n} / (2n)!
    const sign = n % 2 === 0 ? 1 : -1;
    const coefficient = sign * e2n / factorial2n;

    if (Math.abs(coefficient) < 1e-15) continue;

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
    radiusOfConvergence: Math.PI / 2,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Compute Euler numbers E_0, E_2, ..., E_{2*(count-1)} using the recurrence:
 *   E_0 = 1
 *   E_{2n} = -Σ_{k=0}^{n-1} C(2n, 2k) * E_{2k}
 *
 * @param count - Number of Euler numbers to compute
 * @returns Array [E_0, E_2, E_4, ...]
 */
function eulerNumbers(count: number): number[] {
  if (count <= 0) return [];

  const result: number[] = [1]; // E_0 = 1

  for (let n = 1; n < count; n++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += binomialCoefficient(2 * n, 2 * k) * (result[k] ?? 0);
    }
    result.push(-sum);
  }

  return result;
}

/**
 * Compute the binomial coefficient C(n, k) = n! / (k! * (n-k)!)
 * Uses multiplicative formula to avoid overflow for moderate n.
 */
function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  // Leverage symmetry: C(n,k) = C(n,n-k)
  if (k > n - k) k = n - k;

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Cotangent series: cot(x) = 1/x - x/3 - x^3/45 - 2x^5/945 - ...
 *
 * The general term formula is:
 *   cot(x) = 1/x + Σ_{n=1}^{∞} (-1)^n * 2^{2n} * B_{2n} / (2n)! * x^{2n-1}
 *
 * where B_{2n} are the Bernoulli numbers.
 *
 * Note: cot(x) has a pole at x=0 (the 1/x term). We include the 1/x
 * leading term and then the regular part of the Laurent series.
 */
function getCotangentSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  // Leading term: 1/x
  const leadingTerm = createOperatorNode('/', 'divide', [
    createConstantNode(1),
    x,
  ]);
  seriesTerms.push(simplify(leadingTerm));

  // Remaining terms use Bernoulli numbers
  const effectiveTerms = Math.max(terms - 1, 0);
  if (effectiveTerms > 0) {
    const evenB = bernoulliNumbers(effectiveTerms);

    for (let n = 1; n <= effectiveTerms; n++) {
      const b2n = evenB[n - 1] ?? 0;
      const power = 2 * n - 1;
      const twoToThe2n = Math.pow(2, 2 * n);
      const factorial2n = computeFactorial(2 * n);

      // coefficient = (-1)^n * 2^{2n} * B_{2n} / (2n)!
      const sign = n % 2 === 0 ? 1 : -1;
      const coefficient = sign * twoToThe2n * b2n / factorial2n;

      if (Math.abs(coefficient) < 1e-15) continue;

      const term = power === 1
        ? createOperatorNode('*', 'multiply', [
            createConstantNode(coefficient),
            x,
          ])
        : createOperatorNode('*', 'multiply', [
            createConstantNode(coefficient),
            createOperatorNode('^', 'pow', [x, createConstantNode(power)]),
          ]);

      seriesTerms.push(simplify(term));
    }
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
    radiusOfConvergence: Math.PI,
    latex: generateSeriesLatex(seriesTerms, variable, 0),
  };
}

/**
 * Hyperbolic tangent series: tanh(x) = x - x^3/3 + 2x^5/15 - 17x^7/315 + ...
 *
 * The general term formula is:
 *   tanh(x) = Σ_{n=1}^{∞} 2^{2n} * (2^{2n} - 1) * B_{2n} / (2n)! * x^{2n-1}
 *
 * This is similar to the tangent series but without the (-1)^{n-1} factor,
 * and with alternating signs coming purely from the Bernoulli numbers.
 */
function getTanhSeries(variable: string, terms: number): SeriesResult {
  const seriesTerms: ExpressionNode[] = [];
  const x = createSymbolNode(variable);

  const evenB = bernoulliNumbers(terms);

  for (let n = 1; n <= terms; n++) {
    const b2n = evenB[n - 1] ?? 0;
    const power = 2 * n - 1;
    const twoToThe2n = Math.pow(2, 2 * n);
    const factorial2n = computeFactorial(2 * n);

    // coefficient = 2^{2n} * (2^{2n} - 1) * B_{2n} / (2n)!
    const coefficient = twoToThe2n * (twoToThe2n - 1) * b2n / factorial2n;

    if (Math.abs(coefficient) < 1e-15) continue;

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

  // Fallback: use numerical evaluator for cases where simplify
  // doesn't reduce function calls (e.g. sin(π/2) → 1)
  const result = evaluate(substituted, { variables: {}, mode: 'approximate' });
  if (result.success && typeof result.value === 'number') {
    return result.value;
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
        case 'sec':
        case 'tanh':
          return Math.PI / 2;
        case 'cot':
          return Math.PI;
        default:
          return undefined;
      }
    }
  }

  // For general expressions, would need ratio test implementation
  return undefined;
}

// ============================================================================
// AST-TO-LATEX SERIALIZATION
// ============================================================================

/**
 * Operator precedence levels for parenthesization decisions.
 * Higher numbers bind more tightly.
 */
const PRECEDENCE: Record<string, number> = {
  '+': 10,
  '-': 10,
  '*': 20,
  '/': 20,
  '^': 30,
};

/**
 * Return the precedence of an OperatorNode's operator symbol.
 */
function operatorPrecedence(op: string): number {
  return PRECEDENCE[op] ?? 0;
}

/**
 * Format a numeric constant as a LaTeX string.
 * - Integers and simple fractions are displayed cleanly.
 * - Negative numbers are wrapped in braces to prevent ambiguity in
 *   exponents and fraction numerators.
 * - Floating-point values are rounded to 10 significant digits to
 *   eliminate accumulation noise from floating-point arithmetic.
 */
function formatConstantLatex(value: number | bigint | string): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string') {
    return value;
  }

  // Handle special IEEE 754 values
  if (!isFinite(value)) {
    return value > 0 ? '\\infty' : '-\\infty';
  }
  if (isNaN(value)) {
    return '\\text{NaN}';
  }

  // Round to 10 significant figures to eliminate floating-point noise
  const rounded = parseFloat(value.toPrecision(10));

  // Detect integer values (within tolerance)
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return Math.round(rounded).toString();
  }

  // Detect simple fractions p/q with |p|,|q| <= 10000
  // by checking if 1/value or small multiples are near integers.
  const sign = rounded < 0 ? -1 : 1;
  const absVal = Math.abs(rounded);
  for (let q = 1; q <= 10000; q++) {
    const p = Math.round(absVal * q);
    if (p > 0 && Math.abs(p / q - absVal) < 1e-9) {
      const num = sign * p;
      if (q === 1) return num.toString();
      return `\\frac{${num}}{${q}}`;
    }
  }

  // Fallback: use toPrecision with up to 6 digits
  return parseFloat(value.toPrecision(6)).toString();
}

/**
 * Convert a MathFunction name to its LaTeX command.
 */
function functionToLatex(fn: string): string {
  const latexCommands: Record<string, string> = {
    sin:   '\\sin',
    cos:   '\\cos',
    tan:   '\\tan',
    sec:   '\\sec',
    csc:   '\\csc',
    cot:   '\\cot',
    asin:  '\\arcsin',
    acos:  '\\arccos',
    atan:  '\\arctan',
    sinh:  '\\sinh',
    cosh:  '\\cosh',
    tanh:  '\\tanh',
    exp:   '\\exp',
    ln:    '\\ln',
    log:   '\\log',
    log10: '\\log_{10}',
    log2:  '\\log_{2}',
    sqrt:  '\\sqrt',
    cbrt:  '\\sqrt[3]',
    abs:   '\\left|',   // handled specially below
    ceil:  '\\lceil',   // handled specially below
    floor: '\\lfloor',  // handled specially below
    erf:   '\\operatorname{erf}',
    Si:    '\\operatorname{Si}',
    Ci:    '\\operatorname{Ci}',
    li:    '\\operatorname{li}',
  };
  return latexCommands[fn] ?? `\\operatorname{${fn}}`;
}

/**
 * Recursively convert an ExpressionNode to a LaTeX string.
 *
 * @param node - The AST node to serialize.
 * @param parentPrecedence - Precedence of the enclosing operator, used to
 *   decide whether this subexpression needs to be parenthesized.
 * @param isRightChild - True when this node is the right-hand operand of a
 *   non-commutative operator (subtraction, division, exponentiation), which
 *   requires parenthesization at equal precedence.
 */
function nodeToLatex(
  node: ExpressionNode,
  parentPrecedence = 0,
  isRightChild = false
): string {
  return visit<string>(node, {
    visitConstant(n: ConstantNode): string {
      return formatConstantLatex(n.value);
    },

    visitSymbol(n): string {
      return n.name;
    },

    visitUnaryOperator(n: UnaryOperatorNode): string {
      const operand = nodeToLatex(n.args[0], 25);
      if (n.op === '-') {
        // Wrap in parens when nested inside something that binds tighter
        // than addition/subtraction to avoid ambiguity.
        const result = `-${operand}`;
        return parentPrecedence > 10 ? `\\left(${result}\\right)` : result;
      }
      return operand;
    },

    visitOperator(n: OperatorNode): string {
      const prec = operatorPrecedence(n.op);
      const [left, right] = n.args;

      // Division: render as \frac{numerator}{denominator}
      if (n.op === '/') {
        // \frac{...}{...} never needs outer parentheses because its
        // horizontal bar is an implicit grouping.
        const num = nodeToLatex(left, 0, false);
        const den = nodeToLatex(right, 0, false);
        const frac = `\\frac{${num}}{${den}}`;
        return parentPrecedence > 20 ? `\\left(${frac}\\right)` : frac;
      }

      // Exponentiation: render as {base}^{exponent}
      if (n.op === '^') {
        // The base must be parenthesized when it is itself a binary
        // operation (including another power) or a unary minus.
        const baseNeedsParens =
          isOperatorNode(left) ||
          isUnaryOperatorNode(left);
        const baseStr = baseNeedsParens
          ? `\\left(${nodeToLatex(left, 0, false)}\\right)`
          : nodeToLatex(left, 30, false);
        // The exponent is always braced in LaTeX so no extra parens needed.
        const expStr = nodeToLatex(right, 0, false);
        const power = `${baseStr}^{${expStr}}`;
        // Exponentiation right-associative; still parenthesize if embedded
        // as right child of another ^ or as child of * / etc.
        return parentPrecedence > 30 ? `\\left(${power}\\right)` : power;
      }

      // Addition and subtraction
      if (n.op === '+' || n.op === '-') {
        const leftStr = nodeToLatex(left, prec, false);
        // The right operand of '-' only needs parens if it itself is an
        // additive expression (otherwise '-' already groups it correctly).
        let rightStr: string;
        if (n.op === '-') {
          const needsParens =
            isOperatorNode(right) &&
            (right.op === '+' || right.op === '-');
          rightStr = needsParens
            ? `\\left(${nodeToLatex(right, 0, false)}\\right)`
            : nodeToLatex(right, prec, true);
        } else {
          rightStr = nodeToLatex(right, prec, false);
        }

        const expr = `${leftStr} ${n.op} ${rightStr}`;
        // Wrap in parens when this additive expression appears inside a
        // higher-precedence context (*, /, ^).
        return parentPrecedence > prec ? `\\left(${expr}\\right)` : expr;
      }

      // Multiplication: use \cdot between two generic subexpressions,
      // but elide the operator when the left factor is a numeric constant
      // and the right factor is a symbol or a power thereof (e.g. 3x, 3x^2).
      if (n.op === '*') {
        const leftStr = nodeToLatex(left, prec, false);
        const rightStr = nodeToLatex(right, prec, isRightChild);

        const isLeftNumeric = isConstantNode(left);
        const isRightSymbolOrPower =
          isSymbolNode(right) ||
          (isOperatorNode(right) && right.op === '^' && isSymbolNode(right.args[0]));

        const separator =
          isLeftNumeric && isRightSymbolOrPower ? '' : ' \\cdot ';
        const expr = `${leftStr}${separator}${rightStr}`;
        return parentPrecedence > prec ? `\\left(${expr}\\right)` : expr;
      }

      // Fallback for any other operator (e.g. modulo)
      const leftStr = nodeToLatex(left, prec, false);
      const rightStr = nodeToLatex(right, prec, true);
      return `${leftStr} ${n.op} ${rightStr}`;
    },

    visitFunction(n: FunctionNode): string {
      // Special rendering for functions that use delimiters instead of
      // parentheses: abs, ceil, floor.
      if (n.fn === 'abs') {
        const inner = nodeToLatex(n.args[0] ?? createConstantNode(0), 0);
        return `\\left|${inner}\\right|`;
      }
      if (n.fn === 'ceil') {
        const inner = nodeToLatex(n.args[0] ?? createConstantNode(0), 0);
        return `\\left\\lceil ${inner} \\right\\rceil`;
      }
      if (n.fn === 'floor') {
        const inner = nodeToLatex(n.args[0] ?? createConstantNode(0), 0);
        return `\\left\\lfloor ${inner} \\right\\rfloor`;
      }

      // sqrt and cbrt use \sqrt[n]{...} syntax (no outer parens needed)
      if (n.fn === 'sqrt') {
        const inner = nodeToLatex(n.args[0] ?? createConstantNode(0), 0);
        return `\\sqrt{${inner}}`;
      }
      if (n.fn === 'cbrt') {
        const inner = nodeToLatex(n.args[0] ?? createConstantNode(0), 0);
        return `\\sqrt[3]{${inner}}`;
      }

      // Standard function: \fn(arg1, arg2, ...)
      const cmd = functionToLatex(n.fn);
      const args = n.args.map(a => nodeToLatex(a, 0)).join(', ');
      return `${cmd}\\left(${args}\\right)`;
    },
  });
}

/**
 * Generate a LaTeX representation of a series from its term AST nodes.
 *
 * Terms are joined with '+' or '-' (the sign of each term is detected by
 * inspecting the leading coefficient so that we can write
 * "x - \frac{x^{3}}{6}" instead of "x + -\frac{x^{3}}{6}").
 *
 * A trailing "+ \cdots" is appended, and if the center is non-zero an
 * annotation "\\text{ around } variable = center" is added.
 */
function generateSeriesLatex(
  terms: ExpressionNode[],
  variable: string,
  center: number
): string {
  if (terms.length === 0) {
    const centerStr = center === 0 ? '' : ` \\text{ around } ${variable} = ${center}`;
    return `0 + \\cdots${centerStr}`;
  }

  /**
   * Determine the leading numeric sign of a term node.
   * Returns -1 when the outermost structure is clearly negative
   * (a unary minus, or a multiply whose left child is a negative constant);
   * otherwise returns 1.
   */
  function leadingSign(node: ExpressionNode): -1 | 1 {
    if (isUnaryOperatorNode(node) && node.op === '-') return -1;
    if (isConstantNode(node)) {
      const v = node.value;
      return typeof v === 'number' && v < 0 ? -1 : 1;
    }
    if (isOperatorNode(node) && node.op === '*') {
      const [left] = node.args;
      if (isConstantNode(left)) {
        const v = left.value;
        return typeof v === 'number' && v < 0 ? -1 : 1;
      }
    }
    return 1;
  }

  /**
   * Negate the outermost leading factor of a node so we can render it
   * after a '-' operator without a redundant sign.
   * e.g. a term "(-1/6) * x^3" becomes "(1/6) * x^3".
   */
  function negateLeadingConstant(node: ExpressionNode): ExpressionNode {
    if (isUnaryOperatorNode(node) && node.op === '-') {
      // Strip the unary minus
      return node.args[0];
    }
    if (isConstantNode(node)) {
      const v = node.value;
      if (typeof v === 'number') return createConstantNode(-v);
    }
    if (isOperatorNode(node) && node.op === '*') {
      const [left, right] = node.args;
      if (isConstantNode(left)) {
        const v = left.value;
        if (typeof v === 'number') {
          return createOperatorNode('*', 'multiply', [
            createConstantNode(-v),
            right,
          ]);
        }
      }
    }
    // Cannot negate cleanly — return as-is (the caller will keep the '-')
    return node;
  }

  const parts: string[] = [];

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (!term) continue;

    if (i === 0) {
      // First term: render unconditionally, let its own sign appear.
      parts.push(nodeToLatex(term, 0));
    } else {
      const sign = leadingSign(term);
      if (sign === -1) {
        // Render as "- positiveVersion" so we get "- \frac{x^3}{6}"
        // instead of "+ -\frac{x^3}{6}".
        const positive = negateLeadingConstant(term);
        parts.push(`- ${nodeToLatex(positive, 0)}`);
      } else {
        parts.push(`+ ${nodeToLatex(term, 0)}`);
      }
    }
  }

  const centerStr =
    center === 0 ? '' : ` \\text{ around } ${variable} = ${center}`;
  return `${parts.join(' ')} + \\cdots${centerStr}`;
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
