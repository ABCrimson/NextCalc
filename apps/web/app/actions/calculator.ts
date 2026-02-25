'use server';

/**
 * Next.js 16 Server Actions for Calculator Operations
 * These run on the server and can be called from client components
 */

import { evaluate as mathEvaluate } from '@nextcalc/math-engine';
import type { ComputeMode } from '@nextcalc/types';

export interface CalculationResult {
  success: boolean;
  result?: string | number;
  error?: string;
  timestamp: Date;
}

/**
 * Server-side calculation evaluation
 * Provides server-rendered fallback for complex calculations
 */
export async function evaluateExpression(
  expression: string,
  mode: ComputeMode = 'approximate'
): Promise<CalculationResult> {
  try {
    // Validate input
    if (!expression || expression.trim() === '') {
      return {
        success: false,
        error: 'Expression cannot be empty',
        timestamp: new Date(),
      };
    }

    // Validate expression length (prevent DOS)
    if (expression.length > 1000) {
      return {
        success: false,
        error: 'Expression too long (max 1000 characters)',
        timestamp: new Date(),
      };
    }

    // Server-side evaluation using math engine
    const evalResult = mathEvaluate(expression, {
      mode,
      variables: {},
    });

    // Handle evaluation result
    if (!evalResult.success) {
      return {
        success: false,
        error: evalResult.error.message,
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      result: typeof evalResult.value === 'bigint' ? evalResult.value.toString() : evalResult.value,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

/**
 * Server Action to save calculation history
 * Can be extended to persist to a database
 */
export async function saveCalculation(
  expression: string,
  result: string | number
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Validate inputs
    if (!expression || !result) {
      return {
        success: false,
        error: 'Invalid calculation data',
      };
    }

    // In a real app, save to database here
    // For now, just return success with mock ID
    const id = crypto.randomUUID();

    // Simulate database write
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      success: true,
      id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save calculation',
    };
  }
}

/**
 * Server Action to validate mathematical expression
 */
export async function validateExpression(expression: string): Promise<{
  valid: boolean;
  error?: string;
  suggestions?: string[];
}> {
  try {
    // Basic validation
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression is empty' };
    }

    // Check for balanced parentheses
    let balance = 0;
    for (const char of expression) {
      if (char === '(') balance++;
      if (char === ')') balance--;
      if (balance < 0) {
        return {
          valid: false,
          error: 'Unbalanced parentheses',
          suggestions: ['Check closing parentheses'],
        };
      }
    }

    if (balance !== 0) {
      return {
        valid: false,
        error: 'Unclosed parentheses',
        suggestions: ['Add closing parenthesis'],
      };
    }

    // Try parsing
    try {
      mathEvaluate(expression, { mode: 'approximate' });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid expression',
        suggestions: ['Check syntax', 'Use supported functions (sin, cos, tan, sqrt)'],
      };
    }
  } catch (_error) {
    return {
      valid: false,
      error: 'Validation failed',
    };
  }
}
