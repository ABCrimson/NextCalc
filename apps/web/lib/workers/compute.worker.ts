/**
 * Web Worker for isolated mathematical computations
 * Prevents blocking the main UI thread during heavy calculations
 */

import { type EvaluationContext, evaluate, parse, simplify } from '@nextcalc/math-engine';

// Message types for worker communication
export interface ComputeRequest {
  id: string;
  type: 'evaluate' | 'parse' | 'simplify';
  expression: string;
  context?: EvaluationContext;
}

export interface ComputeResponse {
  id: string;
  type: 'success' | 'error';
  // The math engine returns heterogeneous results (number, bigint, complex,
  // matrix, AST node, …) depending on the request type. Callers narrow.
  result?: unknown;
  error?: string;
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async (event: MessageEvent<ComputeRequest>) => {
  const { id, type, expression, context } = event.data;

  try {
    let result: unknown;

    switch (type) {
      case 'evaluate': {
        const evalResult = evaluate(expression, context);
        if (evalResult.success) {
          result = evalResult.value;
        } else {
          throw evalResult.error;
        }
        break;
      }

      case 'parse': {
        result = parse(expression);
        break;
      }

      case 'simplify': {
        // Parse and simplify the expression using symbolic simplification
        const ast = parse(expression);
        result = simplify(ast);
        break;
      }

      default:
        throw new Error(`Unknown compute type: ${type}`);
    }

    const response: ComputeResponse = {
      id,
      type: 'success',
      result,
    };

    self.postMessage(response);
  } catch (error) {
    const response: ComputeResponse = {
      id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };

    self.postMessage(response);
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
