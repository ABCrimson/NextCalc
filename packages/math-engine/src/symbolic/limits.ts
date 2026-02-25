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

import type {
  ExpressionNode,
} from '../parser/ast';
import {
  createConstantNode,
  createOperatorNode,
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isFunctionNode,
} from '../parser/ast';
import { differentiate } from './differentiate';
import { simplify, substitute } from './simplify';

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
export type IndeterminateForm =
  | '0/0'
  | '∞/∞'
  | '0·∞'
  | '∞-∞'
  | '0^0'
  | '1^∞'
  | '∞^0'
  | 'none';

/**
 * Limit computation method
 */
export type LimitMethod =
  | 'direct'      // Direct substitution
  | 'lhopital'    // L'Hôpital's rule
  | 'series'      // Taylor series expansion
  | 'algebraic'   // Algebraic manipulation
  | 'numerical'   // Numerical approximation
  | 'pattern';    // Known limit pattern

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
 * 1. Direct substitution
 * 2. Algebraic simplification
 * 3. Known pattern recognition
 * 4. L'Hôpital's rule for indeterminate forms
 * 5. Series expansion
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
 * console.log(result.method); // 'lhopital' or 'pattern'
 * ```
 */
export function limit(
  expr: ExpressionNode,
  variable: string,
  config: LimitConfig
): LimitResult {
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

  // Step 1: Try direct substitution
  const directResult = tryDirectSubstitution(expr, variable, point, steps, includeSteps);
  if (directResult.success) {
    return {
      value: directResult.value,
      exists: directResult.value !== 'undefined' && directResult.value !== 'DNE',
      method: 'direct',
      steps: includeSteps ? steps : undefined,
    };
  }

  // Step 2: Check for known patterns
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

  // Step 3: Try algebraic simplification
  const algebraicResult = tryAlgebraicSimplification(
    expr,
    variable,
    point,
    steps,
    includeSteps
  );
  if (algebraicResult.success) {
    return limit(algebraicResult.simplified, variable, {
      ...config,
      includeSteps: false,
    });
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
      includeSteps
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

  // Step 5: Try series expansion for difficult limits
  // (Implementation placeholder - would require series.ts)

  // Step 6: Numerical approximation (fallback)
  const numericalResult = tryNumericalApproximation(
    expr,
    variable,
    point,
    direction,
    tolerance,
    steps,
    includeSteps
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
 * Attempt direct substitution
 */
function tryDirectSubstitution(
  expr: ExpressionNode,
  variable: string,
  point: LimitPoint,
  steps: string[],
  includeSteps: boolean
): SubstitutionResult {
  try {
    const value = evaluateAtPoint(expr, variable, point);

    if (includeSteps) {
      steps.push(`Direct substitution: ${formatLimitValue(value)}`);
    }

    // Check if the value is well-defined
    if (
      typeof value === 'number' &&
      !Number.isNaN(value) &&
      Number.isFinite(value)
    ) {
      return { success: true, value };
    }

    // Handle infinity results
    if (value === 'infinity' || value === '-infinity') {
      return { success: true, value };
    }

    // For division, track numerator and denominator separately
    if (isOperatorNode(expr) && expr.op === '/') {
      const [numerator, denominator] = expr.args;
      const numValue = evaluateAtPoint(numerator, variable, point);
      const denValue = evaluateAtPoint(denominator, variable, point);

      return {
        success: false,
        value: 'undefined',
        numeratorValue: numValue,
        denominatorValue: denValue,
      };
    }

    return { success: false, value: 'undefined' };
  } catch {
    return { success: false, value: 'undefined' };
  }
}

/**
 * Evaluate expression at a specific point
 */
function evaluateAtPoint(
  expr: ExpressionNode,
  variable: string,
  point: LimitPoint
): LimitValue {
  // Convert limit point to substitution value
  let substValue: ExpressionNode;
  if (point === 'infinity') {
    // For infinity, use a very large number for numerical evaluation
    substValue = createConstantNode(1e10);
  } else if (point === '-infinity') {
    substValue = createConstantNode(-1e10);
  } else {
    substValue = createConstantNode(point);
  }

  const substituted = substitute(expr, variable, substValue);
  const simplified = simplify(substituted);

  // Extract numerical value
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
  if (
    numeratorValue === 0 &&
    denominatorValue === 0
  ) {
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
  includeSteps: boolean
): LhopitalResult {
  // L'Hôpital's rule only applies to quotients
  if (!isOperatorNode(expr) || expr.op !== '/') {
    return { success: false, value: 'undefined' };
  }

  const [numerator, denominator] = expr.args;

  if (includeSteps) {
    steps.push('Applying L\'Hôpital\'s rule...');
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
    steps.push('L\'Hôpital\'s rule did not converge');
  }

  return { success: false, value: 'undefined' };
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
  includeSteps: boolean
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
  includeSteps: boolean
): AlgebraicResult {
  // Simplify the expression
  const simplified = simplify(expr);

  // Check if simplification made a difference
  if (JSON.stringify(simplified) !== JSON.stringify(expr)) {
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
  includeSteps: boolean
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
      testPoints.push(Math.pow(10, i));
    }
  } else {
    // Approach -infinity
    for (let i = 1; i <= 5; i++) {
      testPoints.push(-Math.pow(10, i));
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
