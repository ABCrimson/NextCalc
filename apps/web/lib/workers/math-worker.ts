/// <reference lib="webworker" />

/**
 * Web Worker for off-main-thread high-precision math computation
 *
 * Uses the MPFR WASM module (or mock fallback) to perform arbitrary-precision
 * arithmetic without blocking the UI thread.
 */

import { getHighPrecision, HighPrecisionScope, type MPFRModule } from '@nextcalc/math-engine/wasm';

// ============ Message Protocol ============

export interface MathWorkerRequest {
  id: string;
  type: 'evaluate' | 'set-precision';
  expression?: string;
  precision?: number;
}

export interface MathWorkerResponse {
  id: string;
  result?: string;
  error?: string;
}

// ============ Module State ============

let mpfrModule: MPFRModule | null = null;

async function ensureInit(): Promise<MPFRModule> {
  if (!mpfrModule) {
    mpfrModule = await getHighPrecision();
  }
  return mpfrModule;
}

/**
 * Evaluate an expression string using high-precision arithmetic.
 *
 * Supports numeric literals and returns the string representation
 * with full precision. The expression is parsed as a decimal number
 * and evaluated through the MPFR/mock backend.
 */
async function evaluateExpression(expression: string, precision?: number): Promise<string> {
  const mod = await ensureInit();

  if (precision) {
    mod._mpfr_set_default_precision(precision);
  }

  return HighPrecisionScope.run(mod, (scope: InstanceType<typeof HighPrecisionScope>) => {
    const num = scope.create(expression);
    return num.toString(10, 0);
  });
}

// ============ Message Handler ============

self.onmessage = async (event: MessageEvent<MathWorkerRequest>) => {
  const { id, type, expression, precision } = event.data;

  try {
    switch (type) {
      case 'evaluate': {
        if (!expression) {
          throw new Error('Missing expression');
        }
        const result = await evaluateExpression(expression, precision);
        const response: MathWorkerResponse = { id, result };
        self.postMessage(response);
        break;
      }

      case 'set-precision': {
        if (!precision) {
          throw new Error('Missing precision value');
        }
        const mod = await ensureInit();
        mod._mpfr_set_default_precision(precision);
        const response: MathWorkerResponse = { id, result: 'ok' };
        self.postMessage(response);
        break;
      }

      default: {
        const exhaustive: never = type;
        throw new Error(`Unknown request type: ${exhaustive}`);
      }
    }
  } catch (err) {
    const response: MathWorkerResponse = {
      id,
      error: err instanceof Error ? err.message : 'Computation failed',
    };
    self.postMessage(response);
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
