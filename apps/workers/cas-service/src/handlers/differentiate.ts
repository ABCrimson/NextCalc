/**
 * Symbolic differentiation handler
 * Computes derivatives using mathjs symbolic computation
 */

import type { SymbolNode } from 'mathjs';
import { all, create } from 'mathjs';
import type { ApiResponse, DifferentiateRequest } from '../utils/validators.js';
import { createErrorResponse, createSuccessResponse } from '../utils/validators.js';

// Create a mathjs instance with all functionality
const math = create(all!);

/**
 * Result type for differentiation operations
 */
export interface DifferentiateResult {
  derivative: string;
  originalExpression: string;
  variable: string;
  order: number;
  simplified: boolean;
  latex?: string;
}

/**
 * Computes the symbolic derivative of an expression
 *
 * Features:
 * - Single-variable differentiation
 * - Higher-order derivatives (up to 5th order)
 * - Automatic simplification
 * - LaTeX output for rendering
 *
 * Examples:
 * - d/dx (x^2 + 3x) = 2x + 3
 * - d^2/dx^2 (x^3) = 6x
 * - d/dx (sin(x)) = cos(x)
 *
 * @param request - Validated differentiate request
 * @returns Derivative result with symbolic expression
 * @throws Error if expression cannot be parsed or differentiated
 */
export async function differentiateMathExpression(
  request: DifferentiateRequest,
): Promise<ApiResponse<DifferentiateResult>> {
  const startTime = performance.now();

  try {
    const { expression, variable, order, simplify } = request;

    // Parse the expression to ensure it's valid
    let parsedExpression: math.MathNode;
    try {
      parsedExpression = math.parse(expression);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Parse error';
      return createErrorResponse(`Failed to parse expression: ${errorMessage}`, 'PARSE_ERROR', {
        originalError: errorMessage,
      });
    }

    // Compute the derivative
    let derivative = parsedExpression;

    try {
      // Apply differentiation 'order' times
      for (let i = 0; i < order; i++) {
        derivative = math.derivative(derivative, variable);
      }

      // Optionally simplify the result
      if (simplify) {
        derivative = math.simplify(derivative);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Differentiation error';
      return createErrorResponse(
        `Failed to compute derivative: ${errorMessage}`,
        'DIFFERENTIATION_ERROR',
        { originalError: errorMessage },
      );
    }

    // Convert to string representation
    const derivativeString = derivative.toString();

    // Generate LaTeX for rendering (optional enhancement)
    let latexOutput: string | undefined;
    try {
      latexOutput = derivative.toTex();
    } catch {
      // LaTeX conversion is optional, continue without it
      latexOutput = undefined;
    }

    const executionTime = performance.now() - startTime;

    const result: DifferentiateResult = {
      derivative: derivativeString,
      originalExpression: expression,
      variable,
      order,
      simplified: simplify,
      ...(latexOutput && { latex: latexOutput }),
    };

    return createSuccessResponse(result, executionTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(
      `Unexpected error during differentiation: ${errorMessage}`,
      'INTERNAL_ERROR',
      { error: errorMessage },
    );
  }
}

/**
 * Validates that an expression contains the specified variable
 * @param expression - Mathematical expression
 * @param variable - Variable to check for
 * @returns True if variable is present in expression
 */
export function expressionContainsVariable(expression: string, variable: string): boolean {
  try {
    const parsed = math.parse(expression);

    // Get all symbols used in the expression
    const symbols = new Set<string>();

    parsed.traverse((node) => {
      if (node.type === 'SymbolNode') {
        symbols.add((node as SymbolNode).name);
      }
    });

    return symbols.has(variable);
  } catch {
    return false;
  }
}

/**
 * Computes partial derivatives for multivariable functions
 * @param expression - Mathematical expression
 * @param variables - Array of variables to differentiate with respect to
 * @returns Map of variable to derivative
 */
export async function computePartialDerivatives(
  expression: string,
  variables: string[],
): Promise<ApiResponse<Map<string, string>>> {
  const startTime = performance.now();

  try {
    const parsed = math.parse(expression);
    const partials = new Map<string, string>();

    for (const variable of variables) {
      try {
        const derivative = math.derivative(parsed, variable);
        const simplified = math.simplify(derivative);
        partials.set(variable, simplified.toString());
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return createErrorResponse(
          `Failed to compute partial derivative for ${variable}: ${errorMessage}`,
          'PARTIAL_DERIVATIVE_ERROR',
        );
      }
    }

    const executionTime = performance.now() - startTime;
    return createSuccessResponse(partials, executionTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(
      `Failed to compute partial derivatives: ${errorMessage}`,
      'INTERNAL_ERROR',
    );
  }
}

/**
 * Computes the gradient vector for a multivariable function
 * The gradient is the vector of all partial derivatives
 *
 * @param expression - Multivariable function
 * @param variables - Variables to compute gradient for
 * @returns Gradient vector as array of derivatives
 */
export async function computeGradient(
  expression: string,
  variables: string[],
): Promise<ApiResponse<string[]>> {
  const partialsResult = await computePartialDerivatives(expression, variables);

  if (!partialsResult.success || !partialsResult.data) {
    return partialsResult as unknown as ApiResponse<string[]>;
  }

  const data = partialsResult.data;
  const gradient = variables.map((v) => (data ? (data.get(v) ?? '') : ''));

  return createSuccessResponse(gradient, partialsResult.metadata?.executionTime);
}
