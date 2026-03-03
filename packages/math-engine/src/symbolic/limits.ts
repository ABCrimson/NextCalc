/**
 * Symbolic Limit Computation Engine
 *
 * Provides comprehensive limit calculation capabilities:
 * - One-sided limits (left, right)
 * - Two-sided limits
 * - Limits at infinity
 * - Indeterminate forms (0/0, ∞/∞, 0·∞, ∞-∞, 0^0, 1^∞, ∞^0)
 * - L'Hôpital's rule application
 * - Common limit patterns (sin(x)/x, (1+1/x)^x, etc.)
 * - Series expansion for difficult limits
 *
 * All implementations follow rigorous mathematical definitions and maintain
 * numerical stability through careful evaluation strategies.
 */

import type { ExpressionNode } from '../parser/ast';
import {
  createConstantNode,
  createOperatorNode,
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isSymbolNode,
} from '../parser/ast';
import { evaluate } from '../parser/evaluator';
import { differentiate } from './differentiate';
import { maclaurinSeries, taylorSeries } from './series';
import { astEquals, simplify, substitute } from './simplify';

/**
 * Limit direction specification
 */
export type LimitDirection = 'left' | 'right' | 'both';

/**
 * Limit point specification
 */
export type LimitPoint = number | 'infinity' | '-infinity';

/**
 * Limit value result
 */
export type LimitValue = number | 'infinity' | '-infinity' | 'undefined' | 'DNE';

/**
 * Indeterminate form types
 */
export type IndeterminateForm = '0/0' | '∞/∞' | '0·∞' | '∞-∞' | '0^0' | '1^∞' | '∞^0' | 'none';

/**
 * Limit computation method
 */
export type LimitMethod =
  | 'direct' // Direct substitution
  | 'lhopital' // L'Hôpital's rule
  | 'series' // Taylor series expansion
  | 'algebraic' // Algebraic manipulation
  | 'numerical' // Numerical approximation
  | 'pattern'; // Known limit pattern

/**
 * Configuration for limit computation
 */
export interface LimitConfig {
  /** Direction of the limit (default: 'both') */
  direction?: LimitDirection;
  /** Point at which to compute the limit */
  point: LimitPoint;
  /** Numerical tolerance for approximate computation (default: 1e-10) */
  tolerance?: number;
  /** Maximum iterations for L'Hôpital's rule (default: 5) */
  maxLhopitalIterations?: number;
  /** Include step-by-step explanation (default: false) */
  includeSteps?: boolean;
  /** @internal Skip algebraic simplification to prevent recursion */
  _skipAlgebraic?: boolean;
}

/**
 * Result of limit computation
 */
export interface LimitResult {
  /** The limit value */
  value: LimitValue;
  /** Whether the limit exists */
  exists: boolean;
  /** Method used to compute the limit */
  method: LimitMethod;
  /** Indeterminate form encountered (if any) */
  indeterminateForm?: IndeterminateForm | undefined;
  /** Step-by-step explanation */
  steps?: readonly string[] | undefined;
  /** LaTeX representation of the result */
  latex?: string | undefined;
}

/**
 * Compute the limit of an expression
 *
 * Implements a comprehensive limit computation strategy:
 * 1. Known pattern recognition (must precede direct substitution to avoid
 *    numerical constant-folding stealing results for patterns like (1+1/x)^x)
 * 2. Direct substitution
 * 3. Algebraic simplification
 * 4. L'Hôpital's rule for indeterminate forms
 * 5. Series expansion (Taylor/Maclaurin)
 * 6. Numerical approximation (fallback)
 *
 * @param expr - Expression to compute limit of
 * @param variable - Variable approaching the limit point
 * @param config - Limit configuration
 * @returns Limit computation result
 *
 * @example
 * ```typescript
 * // lim (x→0) sin(x)/x = 1
 * const expr = parse("sin(x) / x");
 * const result = limit(expr, 'x', { point: 0 });
 * console.log(result.value); // 1
 * console.log(result.method); // 'pattern'
 * ```
 */
export function limit(expr: ExpressionNode, variable: string, config: LimitConfig): LimitResult {
  const {
    direction = 'both',
    point,
    tolerance = 1e-10,
    maxLhopitalIterations = 5,
    includeSteps = false,
  } = config;

  const steps: string[] = [];

  if (includeSteps) {
    steps.push(`Computing lim (${variable}→${formatPoint(point)}) of expression`);
  }

  // Step 1: Check for known patterns before direct substitution.
  // Pattern recognition must run first because some indeterminate forms
  // (e.g. (1+1/x)^x as x→∞) constant-fold numerically to a finite value
  // via simplify(), which would cause direct substitution to succeed and
  // return method: 'direct' instead of the correct method: 'pattern'.
  const patternResult = tryKnownPatterns(expr, variable, point, steps, includeSteps);
  if (patternResult.success) {
    return {
      value: patternResult.value,
      exists: true,
      method: 'pattern',
      indeterminateForm: patternResult.form,
      steps: includeSteps ? steps : undefined,
    };
  }

  // Step 2: Try direct substitution
  const directResult = tryDirectSubstitution(expr, variable, point, steps, includeSteps);
  if (directResult.success) {
    return {
      value: directResult.value,
      exists: directResult.value !== 'undefined' && directResult.value !== 'DNE',
      method: 'direct',
      steps: includeSteps ? steps : undefined,
    };
  }

  // Step 3: Try algebraic simplification (skip if already simplified to prevent recursion)
  if (!config._skipAlgebraic) {
    const algebraicResult = tryAlgebraicSimplification(expr, variable, point, steps, includeSteps);
    if (algebraicResult.success) {
      return limit(algebraicResult.simplified, variable, {
        ...config,
        includeSteps: false,
        _skipAlgebraic: true,
      });
    }
  }

  // Step 4: Apply L'Hôpital's rule for indeterminate forms
  const indeterminateForm = detectIndeterminateForm(directResult);
  if (indeterminateForm === '0/0' || indeterminateForm === '∞/∞') {
    const lhopitalResult = tryLhopitalsRule(
      expr,
      variable,
      point,
      maxLhopitalIterations,
      steps,
      includeSteps,
    );
    if (lhopitalResult.success) {
      return {
        value: lhopitalResult.value,
        exists: true,
        method: 'lhopital',
        indeterminateForm,
        steps: includeSteps ? steps : undefined,
      };
    }
  }

  // Step 5: Try series expansion for difficult limits.
  // Expands numerator and denominator as Taylor series around the limit point,
  // cancels common leading-order factors of (x - a)^n, and evaluates the
  // simplified ratio. Handles 0/0 indeterminate forms that survive L'Hôpital
  // (e.g. when symbolic differentiation produces expressions whose evaluation
  // still requires the numerical evaluator fallback).
  if (typeof point === 'number') {
    const seriesResult = trySeriesExpansion(expr, variable, point, steps, includeSteps);
    if (seriesResult.success) {
      return {
        value: seriesResult.value,
        exists: true,
        method: 'series',
        ...(indeterminateForm !== 'none' ? { indeterminateForm } : {}),
        steps: includeSteps ? steps : undefined,
      };
    }
  }

  // Step 6: Numerical approximation (fallback)
  const numericalResult = tryNumericalApproximation(
    expr,
    variable,
    point,
    direction,
    tolerance,
    steps,
    includeSteps,
  );

  return {
    value: numericalResult.value,
    exists: numericalResult.value !== 'undefined' && numericalResult.value !== 'DNE',
    method: 'numerical',
    steps: includeSteps ? steps : undefined,
  };
}

// ============================================================================
// DIRECT SUBSTITUTION
// ============================================================================

interface SubstitutionResult {
  success: boolean;
  value: LimitValue;
  numeratorValue?: LimitValue;
  denominatorValue?: LimitValue;
}

/**
 * Attempt direct substitution.
 *
 * For quotient expressions, numerator and denominator are evaluated separately
 * BEFORE attempting to evaluate the full expression. This prevents the
 * division-by-zero exception that simplify() throws on 0/0 from being caught
 * and swallowing the indeterminate form information needed by
 * detectIndeterminateForm().
 */
function tryDirectSubstitution(
  expr: ExpressionNode,
  variable: string,
  point: LimitPoint,
  steps: string[],
  includeSteps: boolean,
): SubstitutionResult {
  // For quotient expressions, evaluate numerator and denominator independently
  // so we can track the indeterminate form even when the full expression throws.
  let numeratorValue: LimitValue | undefined;
  let denominatorValue: LimitValue | undefined;

  if (isOperatorNode(expr) && expr.op === '/') {
    const [numerator, denominator] = expr.args;
    try {
      numeratorValue = evaluateAtPoint(numerator, variable, point);
    } catch {
      numeratorValue = 'undefined';
    }
    try {
      denominatorValue = evaluateAtPoint(denominator, variable, point);
    } catch {
      denominatorValue = 'undefined';
    }
  }

  try {
    const value = evaluateAtPoint(expr, variable, point);

    if (includeSteps) {
      steps.push(`Direct substitution: ${formatLimitValue(value)}`);
    }

    // Check if the value is well-defined
    if (typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value)) {
      return { success: true, value };
    }

    // Handle infinity results
    if (value === 'infinity' || value === '-infinity') {
      return { success: true, value };
    }

    // Return failure with numerator/denominator values for indeterminate form detection
    return {
      success: false,
      value: 'undefined',
      ...(numeratorValue !== undefined ? { numeratorValue } : {}),
      ...(denominatorValue !== undefined ? { denominatorValue } : {}),
    };
  } catch {
    // evaluateAtPoint threw (e.g. division by zero inside simplify()).
    // Return the separately-evaluated numerator/denominator so that
    // detectIndeterminateForm() can still identify 0/0 or ∞/∞.
    return {
      success: false,
      value: 'undefined',
      ...(numeratorValue !== undefined ? { numeratorValue } : {}),
      ...(denominatorValue !== undefined ? { denominatorValue } : {}),
    };
  }
}

/**
 * Evaluate expression at a specific point.
 *
 * Uses two-stage evaluation:
 * 1. Symbolic simplification via simplify() — handles exact cases such as
 *    sin(0)=0, cos(0)=1, and constant arithmetic folding.
 * 2. Numerical fallback via evaluate() — handles transcendental functions at
 *    arbitrary non-zero points (e.g. sin(ε), cos(ε)) that simplify() leaves
 *    as un-reduced FunctionNodes.
 *
 * For infinity limits, substitutes Infinity/-Infinity directly so that
 * Math.pow(Infinity, 2) = Infinity propagates correctly through simplify(),
 * giving the correct 'infinity' result for divergent expressions.
 */
function evaluateAtPoint(expr: ExpressionNode, variable: string, point: LimitPoint): LimitValue {
  // Convert limit point to a numeric substitution value.
  // Using the actual Infinity constant (rather than a large finite proxy like 1e10)
  // ensures that divergent expressions such as x^2 correctly fold to Infinity
  // rather than a finite number like 1e20.
  let numericPoint: number;
  if (point === 'infinity') {
    numericPoint = Infinity;
  } else if (point === '-infinity') {
    numericPoint = -Infinity;
  } else {
    numericPoint = point;
  }

  const substValue = createConstantNode(numericPoint);
  const substituted = substitute(expr, variable, substValue);
  const simplified = simplify(substituted);

  // Stage 1: check whether symbolic simplification produced a constant node
  if (isConstantNode(simplified)) {
    const val = simplified.value;
    if (typeof val === 'number') {
      if (Number.isNaN(val)) return 'undefined';
      if (!Number.isFinite(val)) {
        return val > 0 ? 'infinity' : '-infinity';
      }
      return val;
    }
  }

  // Stage 2: numerical fallback for transcendental expressions at non-zero
  // finite points. simplify() only reduces trig functions at exactly 0
  // (e.g. sin(0)=0, cos(0)=1). For nearby points like sin(1e-6), the result
  // remains a FunctionNode. The full evaluator handles these numerically.
  if (Number.isFinite(numericPoint)) {
    const evalResult = evaluate(substituted, {
      variables: {},
      mode: 'approximate',
    });
    if (evalResult.success && typeof evalResult.value === 'number') {
      const val = evalResult.value;
      if (Number.isNaN(val)) return 'undefined';
      if (!Number.isFinite(val)) {
        return val > 0 ? 'infinity' : '-infinity';
      }
      return val;
    }
  }

  return 'undefined';
}

// ============================================================================
// INDETERMINATE FORM DETECTION
// ============================================================================

/**
 * Detect indeterminate form from substitution result
 */
function detectIndeterminateForm(result: SubstitutionResult): IndeterminateForm {
  const { numeratorValue, denominatorValue } = result;

  // 0/0 form
  if (numeratorValue === 0 && denominatorValue === 0) {
    return '0/0';
  }

  // ∞/∞ form
  if (
    (numeratorValue === 'infinity' || numeratorValue === '-infinity') &&
    (denominatorValue === 'infinity' || denominatorValue === '-infinity')
  ) {
    return '∞/∞';
  }

  // More complex forms would be detected here
  // 0·∞, ∞-∞, 0^0, 1^∞, ∞^0

  return 'none';
}

// ============================================================================
// L'HÔPITAL'S RULE
// ============================================================================

interface LhopitalResult {
  success: boolean;
  value: LimitValue;
}

/**
 * Apply L'Hôpital's rule for 0/0 or ∞/∞ indeterminate forms
 *
 * L'Hôpital's Rule: If lim f(x)/g(x) is 0/0 or ∞/∞, then
 * lim f(x)/g(x) = lim f'(x)/g'(x) (if the latter limit exists)
 */
function tryLhopitalsRule(
  expr: ExpressionNode,
  variable: string,
  point: LimitPoint,
  maxIterations: number,
  steps: string[],
  includeSteps: boolean,
): LhopitalResult {
  // L'Hôpital's rule only applies to quotients
  if (!isOperatorNode(expr) || expr.op !== '/') {
    return { success: false, value: 'undefined' };
  }

  const [numerator, denominator] = expr.args;

  if (includeSteps) {
    steps.push("Applying L'Hôpital's rule...");
  }

  let currentNum = numerator;
  let currentDen = denominator;

  for (let i = 0; i < maxIterations; i++) {
    // Differentiate numerator and denominator
    try {
      currentNum = differentiate(currentNum, variable);
      currentDen = differentiate(currentDen, variable);

      if (includeSteps) {
        steps.push(`Iteration ${i + 1}: Differentiated numerator and denominator`);
      }

      // Try direct substitution
      const newExpr = createOperatorNode('/', 'divide', [currentNum, currentDen]);
      const result = tryDirectSubstitution(newExpr, variable, point, steps, false);

      if (result.success) {
        if (includeSteps) {
          steps.push(`L'Hôpital's rule succeeded: ${formatLimitValue(result.value)}`);
        }
        return { success: true, value: result.value };
      }

      // Check if we still have an indeterminate form
      const form = detectIndeterminateForm(result);
      if (form !== '0/0' && form !== '∞/∞') {
        // No longer an indeterminate form, but substitution failed
        break;
      }
    } catch {
      break;
    }
  }

  if (includeSteps) {
    steps.push("L'Hôpital's rule did not converge");
  }

  return { success: false, value: 'undefined' };
}

// ============================================================================
// SERIES EXPANSION
// ============================================================================

interface SeriesExpansionResult {
  success: boolean;
  value: LimitValue;
}

/**
 * Attempt to evaluate a limit using Taylor/Maclaurin series expansion.
 *
 * Strategy for quotient limits lim(x→a) f(x)/g(x):
 * 1. Expand f(x) and g(x) as Taylor series around x = a.
 * 2. Identify the leading non-zero term in each series expansion.
 * 3. Compare the orders (powers of (x - a)) of the leading terms.
 * 4. Return the ratio of leading coefficients when orders match,
 *    0 when numerator order > denominator order, or ∞ otherwise.
 *
 * Strategy for general expressions:
 * 1. Expand as a Taylor series around x = a.
 * 2. The constant term of the Taylor polynomial equals f(a), so evaluating
 *    the polynomial at x = a gives the limit value.
 *
 * This handles cases that survive L'Hôpital because the differentiated
 * expression is still symbolically complex, and complements the numerical
 * evaluator fallback in tryDirectSubstitution for simpler post-L'Hôpital cases.
 *
 * @example
 * lim(x→0) sin(x)/x:
 *   sin(x) series: x - x^3/6 + ... leading term: power=1, coeff=1
 *   x series:      x               leading term: power=1, coeff=1
 *   same order → limit = 1/1 = 1
 *
 * @example
 * lim(x→0) x^2/(1-cos(x)):
 *   x^2        series: x^2             leading term: power=2, coeff=1
 *   1-cos(x)   series: x^2/2 - x^4/24 leading term: power=2, coeff=0.5
 *   same order → limit = 1 / 0.5 = 2
 */
function trySeriesExpansion(
  expr: ExpressionNode,
  variable: string,
  point: number,
  steps: string[],
  includeSteps: boolean,
): SeriesExpansionResult {
  const SERIES_TERMS = 8;

  if (includeSteps) {
    steps.push(`Trying series expansion around ${variable} = ${point}...`);
  }

  try {
    // For quotient expressions, expand numerator and denominator separately
    // and cancel common leading-order factors.
    if (isOperatorNode(expr) && expr.op === '/') {
      const [numerator, denominator] = expr.args;

      const numSeries =
        point === 0
          ? maclaurinSeries(numerator, variable, { terms: SERIES_TERMS })
          : taylorSeries(numerator, variable, { center: point, terms: SERIES_TERMS });

      const denSeries =
        point === 0
          ? maclaurinSeries(denominator, variable, { terms: SERIES_TERMS })
          : taylorSeries(denominator, variable, { center: point, terms: SERIES_TERMS });

      // Find the lowest-power non-zero term in each expansion.
      const numLeading = extractLeadingTerm(numSeries.terms, variable, point);
      const denLeading = extractLeadingTerm(denSeries.terms, variable, point);

      if (numLeading === null || denLeading === null) {
        if (includeSteps) {
          steps.push('Series expansion: could not extract leading terms');
        }
        return { success: false, value: 'undefined' };
      }

      if (includeSteps) {
        steps.push(
          `Series expansion: numerator leading term O((x-a)^${numLeading.power}), ` +
            `coefficient ${numLeading.coefficient}`,
        );
        steps.push(
          `Series expansion: denominator leading term O((x-a)^${denLeading.power}), ` +
            `coefficient ${denLeading.coefficient}`,
        );
      }

      // After cancelling (x-a)^min(numPower, denPower) from both sides,
      // the effective power difference determines the limit.
      const effectiveNumPower = numLeading.power - denLeading.power;

      if (effectiveNumPower > 0) {
        // Numerator vanishes faster than denominator: limit is 0
        if (includeSteps) {
          steps.push('Series expansion: numerator order > denominator order → limit is 0');
        }
        return { success: true, value: 0 };
      }

      if (effectiveNumPower < 0) {
        // Denominator vanishes faster than numerator: limit is ±∞
        const signPositive = numLeading.coefficient / denLeading.coefficient > 0;
        const infinityValue: LimitValue = signPositive ? 'infinity' : '-infinity';
        if (includeSteps) {
          steps.push(
            `Series expansion: numerator order < denominator order → limit is ${infinityValue}`,
          );
        }
        return { success: true, value: infinityValue };
      }

      // Same order: limit equals the ratio of leading coefficients
      if (denLeading.coefficient === 0) {
        return { success: false, value: 'undefined' };
      }

      const limitValue = numLeading.coefficient / denLeading.coefficient;

      if (!Number.isFinite(limitValue) || Number.isNaN(limitValue)) {
        return { success: false, value: 'undefined' };
      }

      if (includeSteps) {
        steps.push(
          `Series expansion succeeded: leading coefficient ratio = ` +
            `${numLeading.coefficient} / ${denLeading.coefficient} = ${limitValue}`,
        );
      }

      return { success: true, value: limitValue };
    }

    // For non-quotient expressions: expand as a series and evaluate the
    // polynomial at the limit point. The constant term of the Taylor series
    // equals f(a), so this recovers the limit via the polynomial approximation.
    const series =
      point === 0
        ? maclaurinSeries(expr, variable, { terms: SERIES_TERMS })
        : taylorSeries(expr, variable, { center: point, terms: SERIES_TERMS });

    const polyAtPoint = evaluateAtPoint(series.polynomial, variable, point);

    if (
      typeof polyAtPoint === 'number' &&
      Number.isFinite(polyAtPoint) &&
      !Number.isNaN(polyAtPoint)
    ) {
      if (includeSteps) {
        steps.push(
          `Series expansion: polynomial evaluates to ${polyAtPoint} at ${variable}=${point}`,
        );
      }
      return { success: true, value: polyAtPoint };
    }

    return { success: false, value: 'undefined' };
  } catch {
    // Series expansion may fail for non-analytic functions or when the
    // Taylor series does not converge at the limit point.
    if (includeSteps) {
      steps.push('Series expansion failed (function may not be analytic at this point)');
    }
    return { success: false, value: 'undefined' };
  }
}

/**
 * Extract the leading (lowest-power, non-zero) term from a series expansion.
 *
 * Taylor series terms are built as coefficient * (x - a)^n nodes. To
 * determine the power of each term, we evaluate at two points offset from
 * the center by small amounts h and 2h. A term c*(x-a)^n satisfies:
 *
 *   term(a + h)  ≈ c * h^n
 *   term(a + 2h) ≈ c * (2h)^n
 *   ratio        = term(a+2h) / term(a+h) ≈ 2^n
 *
 * so n ≈ log₂(ratio). The coefficient is then term(a+h) / h^n.
 *
 * @param terms - Series term AST nodes (from taylorSeries / maclaurinSeries)
 * @param variable - The expansion variable name
 * @param center - The expansion center point
 * @returns { power, coefficient } of the leading term, or null if none found
 */
function extractLeadingTerm(
  terms: ReadonlyArray<ExpressionNode>,
  variable: string,
  center: number,
): { power: number; coefficient: number } | null {
  const h1 = 1e-3;
  const h2 = 2e-3;

  for (let n = 0; n < terms.length; n++) {
    const term = terms[n];
    if (!term) continue;

    try {
      const v1 = evaluateTermNumerically(term, variable, center + h1);
      if (v1 === null || Math.abs(v1) < 1e-15) continue;

      const v2 = evaluateTermNumerically(term, variable, center + h2);
      if (v2 === null || Math.abs(v2) < 1e-20) continue;

      // Estimate the power: ratio = (h2/h1)^power = 2^power
      const ratio = v2 / v1;
      const estimatedPower = Math.log2(Math.abs(ratio));
      const power = Math.round(estimatedPower);

      // Reject noisy or non-integer power estimates
      if (Math.abs(estimatedPower - power) > 0.2) continue;

      // Coefficient = v1 / h1^power
      const coefficient = v1 / h1 ** power;

      if (Math.abs(coefficient) < 1e-12) continue;

      return { power, coefficient };
    } catch {}
  }

  return null;
}

/**
 * Evaluate a single series term AST node at a specific numerical point.
 *
 * First tries symbolic simplification (fast path for polynomial terms).
 * Falls back to the full numerical evaluator for terms containing
 * transcendental functions.
 *
 * @returns The numerical value, or null if evaluation fails or is non-finite
 */
function evaluateTermNumerically(
  term: ExpressionNode,
  variable: string,
  point: number,
): number | null {
  try {
    const substituted = substitute(term, variable, createConstantNode(point));
    const simplified = simplify(substituted);

    if (isConstantNode(simplified)) {
      const val = simplified.value;
      if (typeof val === 'number' && Number.isFinite(val)) {
        return val;
      }
    }

    // Fallback to full numerical evaluator for transcendental terms
    const evalResult = evaluate(substituted, { variables: {}, mode: 'approximate' });
    if (
      evalResult.success &&
      typeof evalResult.value === 'number' &&
      Number.isFinite(evalResult.value)
    ) {
      return evalResult.value;
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// KNOWN PATTERN RECOGNITION
// ============================================================================

interface PatternResult {
  success: boolean;
  value: LimitValue;
  form?: IndeterminateForm;
}

/**
 * Recognize and evaluate known limit patterns
 */
function tryKnownPatterns(
  expr: ExpressionNode,
  variable: string,
  point: LimitPoint,
  steps: string[],
  includeSteps: boolean,
): PatternResult {
  // Pattern: lim (x→0) sin(x)/x = 1
  if (point === 0) {
    const sinXOverX = matchSinXOverX(expr, variable);
    if (sinXOverX) {
      if (includeSteps) {
        steps.push('Recognized pattern: sin(x)/x → 1 as x → 0');
      }
      return { success: true, value: 1, form: '0/0' };
    }

    // Pattern: lim (x→0) (1-cos(x))/x = 0
    const oneMinusCosOverX = matchOneMinusCosXOverX(expr, variable);
    if (oneMinusCosOverX) {
      if (includeSteps) {
        steps.push('Recognized pattern: (1-cos(x))/x → 0 as x → 0');
      }
      return { success: true, value: 0, form: '0/0' };
    }

    // Pattern: lim (x→0) tan(x)/x = 1
    const tanXOverX = matchTanXOverX(expr, variable);
    if (tanXOverX) {
      if (includeSteps) {
        steps.push('Recognized pattern: tan(x)/x → 1 as x → 0');
      }
      return { success: true, value: 1, form: '0/0' };
    }
  }

  // Pattern: lim (x→∞) (1 + 1/x)^x = e
  if (point === 'infinity') {
    const oneOverXToX = matchOnePlusOneOverXToX(expr, variable);
    if (oneOverXToX) {
      if (includeSteps) {
        steps.push('Recognized pattern: (1 + 1/x)^x → e as x → ∞');
      }
      return { success: true, value: Math.E, form: '1^∞' };
    }
  }

  return { success: false, value: 'undefined' };
}

/**
 * Match sin(x)/x pattern
 */
function matchSinXOverX(expr: ExpressionNode, variable: string): boolean {
  if (!isOperatorNode(expr) || expr.op !== '/') return false;

  const [num, den] = expr.args;

  // Numerator should be sin(x)
  if (!isFunctionNode(num) || num.fn !== 'sin') return false;
  const sinArg = num.args[0];
  if (!sinArg || !isSymbolNode(sinArg) || sinArg.name !== variable) return false;

  // Denominator should be x
  if (!isSymbolNode(den) || den.name !== variable) return false;

  return true;
}

/**
 * Match (1 - cos(x))/x pattern
 */
function matchOneMinusCosXOverX(expr: ExpressionNode, variable: string): boolean {
  if (!isOperatorNode(expr) || expr.op !== '/') return false;

  const [num, den] = expr.args;

  // Numerator should be 1 - cos(x)
  if (!isOperatorNode(num) || num.op !== '-') return false;
  const [left, right] = num.args;

  if (!isConstantNode(left) || left.value !== 1) return false;
  if (!isFunctionNode(right) || right.fn !== 'cos') return false;

  const cosArg = right.args[0];
  if (!cosArg || !isSymbolNode(cosArg) || cosArg.name !== variable) return false;

  // Denominator should be x
  if (!isSymbolNode(den) || den.name !== variable) return false;

  return true;
}

/**
 * Match tan(x)/x pattern
 */
function matchTanXOverX(expr: ExpressionNode, variable: string): boolean {
  if (!isOperatorNode(expr) || expr.op !== '/') return false;

  const [num, den] = expr.args;

  // Numerator should be tan(x)
  if (!isFunctionNode(num) || num.fn !== 'tan') return false;
  const tanArg = num.args[0];
  if (!tanArg || !isSymbolNode(tanArg) || tanArg.name !== variable) return false;

  // Denominator should be x
  if (!isSymbolNode(den) || den.name !== variable) return false;

  return true;
}

/**
 * Match (1 + 1/x)^x pattern
 */
function matchOnePlusOneOverXToX(expr: ExpressionNode, variable: string): boolean {
  if (!isOperatorNode(expr) || expr.op !== '^') return false;

  const [base, exponent] = expr.args;

  // Exponent should be x
  if (!isSymbolNode(exponent) || exponent.name !== variable) return false;

  // Base should be 1 + 1/x
  if (!isOperatorNode(base) || base.op !== '+') return false;
  const [left, right] = base.args;

  if (!isConstantNode(left) || left.value !== 1) return false;
  if (!isOperatorNode(right) || right.op !== '/') return false;

  const [numRight, denRight] = right.args;
  if (!isConstantNode(numRight) || numRight.value !== 1) return false;
  if (!isSymbolNode(denRight) || denRight.name !== variable) return false;

  return true;
}

// ============================================================================
// ALGEBRAIC SIMPLIFICATION
// ============================================================================

interface AlgebraicResult {
  success: boolean;
  simplified: ExpressionNode;
}

/**
 * Try algebraic manipulation to simplify the limit
 */
function tryAlgebraicSimplification(
  expr: ExpressionNode,
  _variable: string,
  _point: LimitPoint,
  steps: string[],
  includeSteps: boolean,
): AlgebraicResult {
  // Simplify the expression
  const simplified = simplify(expr);

  // Check if simplification made a difference
  if (!astEquals(simplified, expr)) {
    if (includeSteps) {
      steps.push('Applied algebraic simplification');
    }
    return { success: true, simplified };
  }

  return { success: false, simplified: expr };
}

// ============================================================================
// NUMERICAL APPROXIMATION
// ============================================================================

interface NumericalResult {
  value: LimitValue;
}

/**
 * Compute limit using numerical approximation
 */
function tryNumericalApproximation(
  expr: ExpressionNode,
  variable: string,
  point: LimitPoint,
  direction: LimitDirection,
  tolerance: number,
  steps: string[],
  includeSteps: boolean,
): NumericalResult {
  if (includeSteps) {
    steps.push('Using numerical approximation...');
  }

  const epsilon = 1e-6;
  const testPoints: number[] = [];

  if (typeof point === 'number') {
    // Finite point
    if (direction === 'left' || direction === 'both') {
      for (let i = 1; i <= 5; i++) {
        testPoints.push(point - epsilon / i);
      }
    }
    if (direction === 'right' || direction === 'both') {
      for (let i = 1; i <= 5; i++) {
        testPoints.push(point + epsilon / i);
      }
    }
  } else if (point === 'infinity') {
    // Approach infinity
    for (let i = 1; i <= 5; i++) {
      testPoints.push(10 ** i);
    }
  } else {
    // Approach -infinity
    for (let i = 1; i <= 5; i++) {
      testPoints.push(-(10 ** i));
    }
  }

  const values: number[] = [];
  for (const testPoint of testPoints) {
    try {
      const value = evaluateAtPoint(expr, variable, testPoint);
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value);
      }
    } catch {
      // Skip failed evaluations
    }
  }

  if (values.length === 0) {
    return { value: 'undefined' };
  }

  // Check for convergence
  const lastValue = values[values.length - 1];
  if (lastValue === undefined) {
    return { value: 'undefined' };
  }

  const isConverging = values.every((v, i) => {
    if (i === 0) return true;
    return Math.abs(v - lastValue) < tolerance * (i + 1);
  });

  if (isConverging) {
    if (includeSteps) {
      steps.push(`Numerical approximation converged to ${lastValue}`);
    }
    return { value: lastValue };
  }

  if (includeSteps) {
    steps.push('Numerical approximation did not converge');
  }

  return { value: 'undefined' };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format limit point for display
 */
function formatPoint(point: LimitPoint): string {
  if (point === 'infinity') return '∞';
  if (point === '-infinity') return '-∞';
  return point.toString();
}

/**
 * Format limit value for display
 */
function formatLimitValue(value: LimitValue): string {
  if (value === 'infinity') return '∞';
  if (value === '-infinity') return '-∞';
  if (value === 'undefined' || value === 'DNE') return 'undefined';
  return value.toString();
}
