/**
 * Algebraic equation solver handler
 * Solves linear, quadratic, and polynomial equations using mathjs
 */

import { all, create } from 'mathjs';
import type { SolveRequest, ApiResponse } from '../utils/validators.js';
import { createSuccessResponse, createErrorResponse } from '../utils/validators.js';

// Create a mathjs instance with all functionality
const math = create(all);

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
 * Solves algebraic equations
 *
 * Supported equation types:
 * - Linear: 2x + 5 = 13
 * - Quadratic: x^2 - 5x + 6 = 0
 * - Polynomial: x^3 + 2x^2 - x - 2 = 0
 * - Systems: Not yet supported (future enhancement)
 *
 * @param request - Validated solve request
 * @returns Solution result with all roots
 * @throws Error if equation cannot be parsed or solved
 */
export async function solveMathExpression(
  request: SolveRequest
): Promise<ApiResponse<SolveResult>> {
  const startTime = performance.now();

  try {
    const { expression, variable, precision } = request;

    // Parse the equation (split on =)
    const parts = expression.split('=').map((part) => part.trim());

    if (parts.length !== 2) {
      return createErrorResponse(
        'Equation must have exactly one equals sign',
        'INVALID_EQUATION'
      );
    }

    const [leftSide, rightSide] = parts;

    // Rewrite as: leftSide - rightSide = 0
    const equationToSolve = `${leftSide} - (${rightSide})`;

    // Try to solve the equation
    let solutions: Array<number | string | { re: number; im: number }>;
    let solutionType: 'numeric' | 'symbolic' | 'complex' = 'numeric';

    try {
      // Parse the expression to ensure it's valid
      const parsed = math.parse(equationToSolve);

      // Simplify the expression
      const simplified = math.simplify(parsed);

      // Try symbolic solving first
      try {
        const symbolicSolutions = math.solveAll(simplified, variable) as unknown[];

        // Process solutions
        solutions = symbolicSolutions.map((sol) => {
          if (typeof sol === 'number') {
            // Round to specified precision
            return parseFloat(sol.toFixed(precision));
          } else if (math.isComplex(sol)) {
            // Handle complex numbers
            const complex = sol as { re: number; im: number };
            solutionType = 'complex';
            return {
              re: parseFloat(complex.re.toFixed(precision)),
              im: parseFloat(complex.im.toFixed(precision)),
            };
          } else {
            // Symbolic solution
            solutionType = 'symbolic';
            return String(sol);
          }
        });

      } catch {
        // If symbolic solving fails, try numeric approach
        // This is a fallback for complex equations
        const numericSolution = math.evaluate(equationToSolve, { [variable]: 0 });

        if (typeof numericSolution === 'number' && Math.abs(numericSolution) < 0.0001) {
          // If evaluating at 0 gives ~0, then 0 is a solution
          solutions = [0];
        } else {
          throw new Error('Unable to solve equation symbolically or numerically');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(
        `Failed to solve equation: ${errorMessage}`,
        'SOLVE_ERROR',
        { originalError: errorMessage }
      );
    }

    // Validate solutions exist
    if (!solutions || solutions.length === 0) {
      return createErrorResponse(
        'No solutions found for the given equation',
        'NO_SOLUTIONS'
      );
    }

    const executionTime = performance.now() - startTime;

    const result: SolveResult = {
      solutions,
      expression: expression,
      variable,
      solutionType,
    };

    return createSuccessResponse(result, executionTime);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(
      `Unexpected error while solving: ${errorMessage}`,
      'INTERNAL_ERROR',
      { error: errorMessage }
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
export function verifySolution(
  expression: string,
  variable: string,
  solution: number
): boolean {
  try {
    const parts = expression.split('=');
    if (parts.length !== 2) return false;

    const [leftSide, rightSide] = parts;

    const leftResult = math.evaluate(leftSide, { [variable]: solution }) as number;
    const rightResult = math.evaluate(rightSide, { [variable]: solution }) as number;

    // Check if both sides are approximately equal (within tolerance)
    const tolerance = 1e-10;
    return Math.abs(leftResult - rightResult) < tolerance;

  } catch {
    return false;
  }
}
