/**
 * Equation Solving Engine
 *
 * Supports:
 * 1. Linear equations: ax + b = 0
 * 2. Quadratic equations: ax² + bx + c = 0
 * 3. Polynomial equations (numerical)
 * 4. Transcendental equations (numerical via Newton-Raphson)
 */

import type { ExpressionNode } from '../parser/ast';
import { createOperatorNode } from '../parser/ast';
import { evaluate } from '../parser/evaluator';
import { parse } from '../parser/parser';
import { differentiate } from '../symbolic/differentiate';

/**
 * Complex number for complex solutions
 */
export class Complex {
  constructor(
    public real: number,
    public imag: number,
  ) {}

  toString(): string {
    if (this.imag === 0) return this.real.toString();
    if (this.real === 0) return `${this.imag}i`;
    const sign = this.imag > 0 ? '+' : '';
    return `${this.real}${sign}${this.imag}i`;
  }

  equals(other: Complex, tolerance = 1e-10): boolean {
    return (
      Math.abs(this.real - other.real) < tolerance && Math.abs(this.imag - other.imag) < tolerance
    );
  }
}

/**
 * Solution to an equation
 */
export interface Solution {
  value: number | Complex;
  multiplicity?: number;
}

/**
 * Solve linear equation: ax + b = 0
 * @returns Array of solutions
 */
function solveLinear(a: number, b: number): Solution[] {
  if (Math.abs(a) < 1e-10) {
    if (Math.abs(b) < 1e-10) {
      // 0 = 0, infinite solutions
      return [{ value: Number.POSITIVE_INFINITY, multiplicity: Number.POSITIVE_INFINITY }];
    }
    // 0 = b (b ≠ 0), no solution
    return [];
  }

  return [{ value: -b / a, multiplicity: 1 }];
}

/**
 * Solve quadratic equation: ax² + bx + c = 0
 * @returns Array of solutions (may include complex numbers)
 */
function solveQuadratic(a: number, b: number, c: number): Solution[] {
  if (Math.abs(a) < 1e-10) {
    return solveLinear(b, c);
  }

  const discriminant = b * b - 4 * a * c;

  if (discriminant > 1e-10) {
    // Two real solutions
    const sqrtD = Math.sqrt(discriminant);
    return [
      { value: (-b + sqrtD) / (2 * a), multiplicity: 1 },
      { value: (-b - sqrtD) / (2 * a), multiplicity: 1 },
    ];
  }

  if (Math.abs(discriminant) < 1e-10) {
    // One repeated solution
    return [{ value: -b / (2 * a), multiplicity: 2 }];
  }

  // Two complex solutions
  const real = -b / (2 * a);
  const imag = Math.sqrt(-discriminant) / (2 * a);
  return [
    { value: new Complex(real, imag), multiplicity: 1 },
    { value: new Complex(real, -imag), multiplicity: 1 },
  ];
}

/**
 * Extract coefficients from linear expression: ax + b
 */
function extractLinearCoefficients(
  expr: ExpressionNode,
  variable: string,
): { a: number; b: number } | null {
  // Try to evaluate as ax + b
  try {
    // Evaluate at x=0 to get b
    const bResult = evaluate(expr, { variables: { [variable]: 0 } });
    if (!bResult.success) return null;
    const b = Number(bResult.value);

    // Evaluate at x=1 to get a+b
    const abResult = evaluate(expr, { variables: { [variable]: 1 } });
    if (!abResult.success) return null;
    const ab = Number(abResult.value);

    const a = ab - b;

    // Verify it's actually linear by checking x=2
    const verifyResult = evaluate(expr, { variables: { [variable]: 2 } });
    if (!verifyResult.success) return null;
    const expected = 2 * a + b;
    if (Math.abs(Number(verifyResult.value) - expected) > 1e-10) return null;

    return { a, b };
  } catch {
    return null;
  }
}

/**
 * Extract coefficients from quadratic expression: ax² + bx + c
 */
function extractQuadraticCoefficients(
  expr: ExpressionNode,
  variable: string,
): { a: number; b: number; c: number } | null {
  try {
    // Evaluate at x=0,1,2 to get three equations
    const c_result = evaluate(expr, { variables: { [variable]: 0 } });
    if (!c_result.success) return null;
    const c = Number(c_result.value);

    const result1 = evaluate(expr, { variables: { [variable]: 1 } });
    if (!result1.success) return null;
    const v1 = Number(result1.value); // a + b + c

    const result2 = evaluate(expr, { variables: { [variable]: 2 } });
    if (!result2.success) return null;
    const v2 = Number(result2.value); // 4a + 2b + c

    // Solve for a and b
    // a + b + c = v1  =>  a + b = v1 - c
    // 4a + 2b + c = v2  =>  4a + 2b = v2 - c
    // From first: b = v1 - c - a
    // Substitute into second: 4a + 2(v1 - c - a) = v2 - c
    // 4a + 2v1 - 2c - 2a = v2 - c
    // 2a = v2 - c - 2v1 + 2c
    // 2a = v2 + c - 2v1
    const a = (v2 + c - 2 * v1) / 2;
    const b = v1 - c - a;

    // Verify it's actually quadratic
    const verifyResult = evaluate(expr, { variables: { [variable]: 3 } });
    if (!verifyResult.success) return null;
    const expected = 9 * a + 3 * b + c;
    if (Math.abs(Number(verifyResult.value) - expected) > 1e-10) return null;

    return { a, b, c };
  } catch {
    return null;
  }
}

/**
 * Solve equation numerically using Newton-Raphson method
 */
function solveNumerical(
  expr: ExpressionNode,
  variable: string,
  initialGuess = 0,
  tolerance = 1e-10,
  maxIterations = 100,
): Solution[] {
  try {
    // Newton-Raphson: x_{n+1} = x_n - f(x_n)/f'(x_n)
    const derivative = differentiate(expr, variable);
    let x = initialGuess;

    for (let i = 0; i < maxIterations; i++) {
      const fxResult = evaluate(expr, { variables: { [variable]: x } });
      if (!fxResult.success) {
        throw new Error('Failed to evaluate function');
      }
      const fx = Number(fxResult.value);

      const fpxResult = evaluate(derivative, { variables: { [variable]: x } });
      if (!fpxResult.success) {
        throw new Error('Failed to evaluate derivative');
      }
      const fpx = Number(fpxResult.value);

      if (Math.abs(fpx) < 1e-15) {
        throw new Error('Newton-Raphson failed: derivative too small');
      }

      const xNew = x - fx / fpx;

      if (Math.abs(xNew - x) < tolerance) {
        // Converged
        return [{ value: xNew, multiplicity: 1 }];
      }

      x = xNew;
    }

    throw new Error('Newton-Raphson did not converge');
  } catch (error) {
    throw new Error(
      `Numerical solving failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Find multiple solutions in a range by trying different initial guesses
 */
export function solveInRange(
  equation: string | ExpressionNode,
  variable: string,
  min: number,
  max: number,
  numGuesses = 10,
): Solution[] {
  const expr = typeof equation === 'string' ? parse(equation) : equation;
  const solutions: Solution[] = [];
  const step = (max - min) / numGuesses;

  for (let i = 0; i <= numGuesses; i++) {
    const guess = min + i * step;
    try {
      const sol = solveNumerical(expr, variable, guess);
      const firstSol = sol[0];
      if (!firstSol) continue;
      // Check if this is a new solution
      const isNew = !solutions.some((s) =>
        typeof s.value === 'number' && typeof firstSol.value === 'number'
          ? Math.abs(s.value - firstSol.value) < 1e-6
          : false,
      );
      if (isNew) {
        solutions.push(...sol);
      }
    } catch {}
  }

  return solutions.sort((a, b) => {
    const aVal = typeof a.value === 'number' ? a.value : a.value.real;
    const bVal = typeof b.value === 'number' ? b.value : b.value.real;
    return aVal - bVal;
  });
}

/**
 * Solve an equation
 * @param equation - Equation string (e.g., "x^2 - 4 = 0" or just "x^2 - 4")
 * @param variable - Variable to solve for (default: 'x')
 * @param options - Solver options
 * @returns Array of solutions
 *
 * @example
 * solve("x^2 - 4", "x") // [{ value: -2 }, { value: 2 }]
 * solve("x^2 + 1", "x") // [{ value: Complex(0, 1) }, { value: Complex(0, -1) }]
 */
export function solve(
  equation: string | ExpressionNode,
  variable = 'x',
  options: { method?: 'auto' | 'numerical'; initialGuess?: number } = {},
): Solution[] {
  const { method = 'auto', initialGuess = 0 } = options;

  // Parse equation if string
  let expr: ExpressionNode;
  if (typeof equation === 'string') {
    // Check if equation contains '='
    if (equation.includes('=')) {
      const parts = equation.split('=').map((s) => s.trim());
      const lhs = parts[0];
      const rhs = parts[1];
      if (!lhs || !rhs) {
        throw new Error('Invalid equation format');
      }
      const lhsExpr = parse(lhs);
      const rhsExpr = parse(rhs);

      // Move everything to left side: lhs - rhs = 0
      expr = createOperatorNode('-', 'subtract', [lhsExpr, rhsExpr]);
    } else {
      expr = parse(equation);
    }
  } else {
    expr = equation;
  }

  // Try to determine equation type and solve accordingly
  if (method === 'auto') {
    // Try linear
    const linearCoeffs = extractLinearCoefficients(expr, variable);
    if (linearCoeffs) {
      return solveLinear(linearCoeffs.a, linearCoeffs.b);
    }

    // Try quadratic
    const quadraticCoeffs = extractQuadraticCoefficients(expr, variable);
    if (quadraticCoeffs) {
      return solveQuadratic(quadraticCoeffs.a, quadraticCoeffs.b, quadraticCoeffs.c);
    }

    // Fall back to numerical
    return solveNumerical(expr, variable, initialGuess);
  }

  // Force numerical
  return solveNumerical(expr, variable, initialGuess);
}
