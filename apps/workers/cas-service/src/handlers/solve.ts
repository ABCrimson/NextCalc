/**
 * Algebraic equation solver handler
 * Solves linear, quadratic, and polynomial equations using mathjs
 */

import { all, create } from 'mathjs';
import type { ApiResponse, SolveRequest } from '../utils/validators.js';
import { createErrorResponse, createSuccessResponse } from '../utils/validators.js';

// Create a mathjs instance with all functionality
const math = create(all!);

/**
 * Result type for equation solving
 */
export interface SolveResult {
  solutions: Array<number | string | { re: number; im: number }>;
  expression: string;
  variable: string;
  steps?: string[];
  solutionType: 'numeric' | 'symbolic' | 'complex';
}

/**
 * Extract polynomial coefficients from a simplified expression string.
 * Returns an array [a0, a1, a2, ...] where the polynomial is a0 + a1*x + a2*x^2 + ...
 * Returns null if the expression is not a polynomial in the given variable.
 */
function extractPolynomialCoefficients(
  expr: string,
  variable: string,
  precision: number,
): number[] | null {
  try {
    // Evaluate at multiple points to determine coefficients
    // For a polynomial of degree n, we need n+1 points
    const maxDegree = 10;
    const points: number[] = [];

    for (let i = 0; i <= maxDegree; i++) {
      const val = math.evaluate(expr, { [variable]: i }) as number;
      if (typeof val !== 'number' || !Number.isFinite(val)) return null;
      points.push(val);
    }

    // Use finite differences to extract coefficients
    // First, compute the forward difference table
    const diffs: number[][] = [points.slice()];
    for (let order = 1; order <= maxDegree; order++) {
      const prev = diffs[order - 1]!;
      const next: number[] = [];
      for (let i = 0; i < prev.length - 1; i++) {
        next.push(prev[i + 1]! - prev[i]!);
      }
      diffs.push(next);
    }

    // Find the degree: the first order where all differences are ~0
    let degree = 0;
    for (let d = 0; d <= maxDegree; d++) {
      const allZero = diffs[d]!.every((v) => Math.abs(v) < 1e-8);
      if (allZero) {
        degree = d - 1;
        break;
      }
      if (d === maxDegree) return null; // Not a polynomial up to degree 10
    }

    if (degree < 0) degree = 0;

    // Extract coefficients using the Newton forward difference formula
    // P(x) = sum_{k=0}^{n} C(x,k) * delta^k(f(0))
    // where delta^k(f(0)) = diffs[k][0]
    // We need to convert from Newton form to standard coefficients
    const coeffs = new Array<number>(degree + 1).fill(0);

    // Newton forward differences at x=0
    const deltas = diffs.map((d) => d[0]!);

    // Convert Newton form to standard polynomial using Stirling numbers
    // coefficient of x^k = sum over j>=k of S(j,k) * delta^j / j!
    // where S(j,k) are Stirling numbers of the first kind
    for (let k = 0; k <= degree; k++) {
      // Compute coefficient of x^k from Newton basis
      // Newton basis: C(x,j) = x*(x-1)*(x-2)*...*(x-j+1) / j!
      // We expand these products to get standard coefficients
      let coeff = 0;
      for (let j = k; j <= degree; j++) {
        // Coefficient of x^k in C(x,j)
        coeff += (stirling1(j, k) * deltas[j]!) / factorial(j);
      }
      coeffs[k] = parseFloat(coeff.toFixed(precision));
    }

    return coeffs;
  } catch {
    return null;
  }
}

/** Compute unsigned Stirling numbers of the first kind (for polynomial conversion) */
function stirling1(n: number, k: number): number {
  if (n === 0 && k === 0) return 1;
  if (n === 0 || k === 0) return 0;
  // s(n,k) = s(n-1,k-1) - (n-1)*s(n-1,k) for signed
  // We want signed Stirling numbers for converting Newton to standard form
  return stirling1(n - 1, k - 1) - (n - 1) * stirling1(n - 1, k);
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Solve a polynomial given its coefficients [a0, a1, ..., an]
 * where the polynomial is a0 + a1*x + a2*x^2 + ... + an*x^n = 0
 */
function solvePolynomial(
  coeffs: number[],
  precision: number,
): Array<number | { re: number; im: number }> {
  // Remove trailing zeros to find actual degree
  while (coeffs.length > 1 && Math.abs(coeffs[coeffs.length - 1]!) < 1e-10) {
    coeffs.pop();
  }

  const degree = coeffs.length - 1;

  if (degree === 0) {
    // Constant — no solutions (or infinitely many if constant is 0)
    return Math.abs(coeffs[0]!) < 1e-10 ? [0] : [];
  }

  if (degree === 1) {
    // Linear: a0 + a1*x = 0 → x = -a0/a1
    const x = -coeffs[0]! / coeffs[1]!;
    return [parseFloat(x.toFixed(precision))];
  }

  if (degree === 2) {
    // Quadratic: a0 + a1*x + a2*x^2 = 0
    const c = coeffs[0]!;
    const b = coeffs[1]!;
    const a = coeffs[2]!;
    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
      const sqrtD = Math.sqrt(discriminant);
      const x1 = (-b + sqrtD) / (2 * a);
      const x2 = (-b - sqrtD) / (2 * a);
      const solutions = [parseFloat(x1.toFixed(precision))];
      if (Math.abs(x1 - x2) > 1e-10) {
        solutions.push(parseFloat(x2.toFixed(precision)));
      }
      return solutions;
    }
    // Complex roots
    const realPart = -b / (2 * a);
    const imagPart = Math.sqrt(-discriminant) / (2 * a);
    return [
      {
        re: parseFloat(realPart.toFixed(precision)),
        im: parseFloat(imagPart.toFixed(precision)),
      },
      {
        re: parseFloat(realPart.toFixed(precision)),
        im: parseFloat((-imagPart).toFixed(precision)),
      },
    ];
  }

  // For higher degree, use numerical root finding (Durand-Kerner method)
  return durandKerner(coeffs, precision);
}

/**
 * Durand-Kerner method for finding all roots of a polynomial.
 */
function durandKerner(
  coeffs: number[],
  precision: number,
): Array<number | { re: number; im: number }> {
  const n = coeffs.length - 1; // degree
  const an = coeffs[n]!; // leading coefficient

  // Normalize coefficients
  const norm = coeffs.map((c) => c / an);

  // Initial guesses spread around the unit circle
  const roots: Array<{ re: number; im: number }> = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + 0.4;
    roots.push({
      re: Math.cos(angle) * 1.5,
      im: Math.sin(angle) * 1.5,
    });
  }

  // Iterate
  const maxIter = 1000;
  const tol = 1e-12;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;

    for (let i = 0; i < n; i++) {
      const ri = roots[i]!;
      // Evaluate polynomial at roots[i]
      let pRe = norm[0]!;
      let pIm = 0;
      let zRe = 1;
      let zIm = 0;

      for (let k = 1; k <= n; k++) {
        const newZRe = zRe * ri.re - zIm * ri.im;
        const newZIm = zRe * ri.im + zIm * ri.re;
        zRe = newZRe;
        zIm = newZIm;
        pRe += norm[k]! * zRe;
        pIm += norm[k]! * zIm;
      }

      // Compute product of (roots[i] - roots[j]) for j != i
      let dRe = 1;
      let dIm = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const rj = roots[j]!;
        const diffRe = ri.re - rj.re;
        const diffIm = ri.im - rj.im;
        const newDRe = dRe * diffRe - dIm * diffIm;
        const newDIm = dRe * diffIm + dIm * diffRe;
        dRe = newDRe;
        dIm = newDIm;
      }

      // delta = p(z_i) / product
      const denom = dRe * dRe + dIm * dIm;
      if (denom < 1e-30) continue;
      const deltaRe = (pRe * dRe + pIm * dIm) / denom;
      const deltaIm = (pIm * dRe - pRe * dIm) / denom;

      ri.re -= deltaRe;
      ri.im -= deltaIm;

      maxDelta = Math.max(maxDelta, Math.sqrt(deltaRe * deltaRe + deltaIm * deltaIm));
    }

    if (maxDelta < tol) break;
  }

  // Convert roots to output format
  return roots.map((r) => {
    if (Math.abs(r.im) < 1e-8) {
      return parseFloat(r.re.toFixed(precision));
    }
    return {
      re: parseFloat(r.re.toFixed(precision)),
      im: parseFloat(r.im.toFixed(precision)),
    };
  });
}

/**
 * Fallback: numerical root finding using bisection / Newton's method
 * for when polynomial extraction fails.
 */
function numericalSolve(expr: string, variable: string, precision: number): number[] {
  const f = (x: number): number => math.evaluate(expr, { [variable]: x }) as number;

  const solutions: number[] = [];
  // Scan the interval [-100, 100] for sign changes
  const step = 0.5;
  let prev = f(-100);

  for (let x = -100 + step; x <= 100; x += step) {
    const curr = f(x);
    if (prev * curr < 0) {
      // Sign change — refine with bisection
      let lo = x - step;
      let hi = x;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const fMid = f(mid);
        if (Math.abs(fMid) < 1e-14) {
          lo = hi = mid;
          break;
        }
        if (fMid * f(lo) < 0) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      solutions.push(parseFloat(((lo + hi) / 2).toFixed(precision)));
    } else if (Math.abs(curr) < 1e-10) {
      solutions.push(parseFloat(x.toFixed(precision)));
    }
    prev = curr;
  }

  return solutions;
}

/**
 * Solves algebraic equations
 *
 * Supported equation types:
 * - Linear: 2x + 5 = 13
 * - Quadratic: x^2 - 5x + 6 = 0
 * - Polynomial: x^3 + 2x^2 - x - 2 = 0
 *
 * @param request - Validated solve request
 * @returns Solution result with all roots
 */
export async function solveMathExpression(
  request: SolveRequest,
): Promise<ApiResponse<SolveResult>> {
  const startTime = performance.now();

  try {
    const { expression, variable, precision } = request;

    // Parse the equation (split on =)
    const parts = expression.split('=').map((part) => part.trim());

    if (parts.length !== 2) {
      return createErrorResponse('Equation must have exactly one equals sign', 'INVALID_EQUATION');
    }

    const leftSide = parts[0]!;
    const rightSide = parts[1]!;

    // Rewrite as: leftSide - rightSide = 0
    const equationToSolve = `${leftSide} - (${rightSide})`;

    let solutions: Array<number | string | { re: number; im: number }>;
    let solutionType: 'numeric' | 'symbolic' | 'complex' = 'numeric';

    try {
      // Parse to validate the expression
      math.parse(equationToSolve);

      // Try polynomial coefficient extraction
      const coeffs = extractPolynomialCoefficients(equationToSolve, variable, precision);

      if (coeffs) {
        solutions = solvePolynomial(coeffs, precision);
        // Check if any solutions are complex
        if (solutions.some((s) => typeof s === 'object')) {
          solutionType = 'complex';
        }
      } else {
        // Fallback to numerical root finding
        const numericRoots = numericalSolve(equationToSolve, variable, precision);
        if (numericRoots.length > 0) {
          solutions = numericRoots;
        } else {
          throw new Error('Unable to find solutions for this equation');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(`Failed to solve equation: ${errorMessage}`, 'SOLVE_ERROR', {
        originalError: errorMessage,
      });
    }

    // Validate solutions exist
    if (!solutions || solutions.length === 0) {
      return createErrorResponse('No solutions found for the given equation', 'NO_SOLUTIONS');
    }

    const executionTime = performance.now() - startTime;

    const result: SolveResult = {
      solutions,
      expression,
      variable,
      solutionType,
    };

    return createSuccessResponse(result, executionTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(
      `Unexpected error while solving: ${errorMessage}`,
      'INTERNAL_ERROR',
      { error: errorMessage },
    );
  }
}

/**
 * Verifies a solution by substituting it back into the original equation
 * @param expression - Original equation
 * @param variable - Variable name
 * @param solution - Solution to verify
 * @returns True if solution is valid (within tolerance)
 */
export function verifySolution(expression: string, variable: string, solution: number): boolean {
  try {
    const parts = expression.split('=');
    if (parts.length !== 2) return false;

    const leftSide = parts[0]!;
    const rightSide = parts[1]!;

    const leftResult = math.evaluate(leftSide, { [variable]: solution }) as number;
    const rightResult = math.evaluate(rightSide, { [variable]: solution }) as number;

    // Check if both sides are approximately equal (within tolerance)
    const tolerance = 1e-10;
    return Math.abs(leftResult - rightResult) < tolerance;
  } catch {
    return false;
  }
}
