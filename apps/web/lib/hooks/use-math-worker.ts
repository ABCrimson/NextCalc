'use client';

/**
 * React hook for off-main-thread high-precision math computation
 *
 * Spawns a dedicated Web Worker that loads the MPFR WASM module (or mock
 * fallback) and provides a promise-based API for evaluating expressions
 * without blocking the UI thread.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

import type { MathWorkerResponse } from '@/lib/workers/math-worker';

interface PendingRequest {
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

export function useMathWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const idCounterRef = useRef(0);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;

    const worker = new Worker(
      new URL('@/lib/workers/math-worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (
      event: MessageEvent<MathWorkerResponse | { type: 'ready' }>,
    ) => {
      const data = event.data;

      // Handle worker ready signal
      if ('type' in data && data.type === 'ready') {
        setAvailable(true);
        return;
      }

      const response = data as MathWorkerResponse;
      const pending = pendingRef.current.get(response.id);
      if (!pending) return;
      pendingRef.current.delete(response.id);

      if (response.error) {
        pending.reject(new Error(response.error));
      } else if (response.result !== undefined) {
        pending.resolve(response.result);
      }
    };

    worker.onerror = () => {
      // Reject all pending requests on fatal error
      for (const [, p] of pendingRef.current) {
        p.reject(new Error('Math worker error'));
      }
      pendingRef.current.clear();
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      setAvailable(false);

      for (const [, p] of pendingRef.current) {
        p.reject(new Error('Worker terminated'));
      }
      pendingRef.current.clear();
    };
  }, []);

  /**
   * Evaluate a numeric expression with arbitrary precision.
   *
   * @param expression - Decimal number string to evaluate
   * @param precision - Optional MPFR precision in bits (e.g. 256, 512)
   * @returns The result as a full-precision string
   */
  const evaluate = useCallback(
    (expression: string, precision?: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not available'));
          return;
        }

        const id = String(++idCounterRef.current);
        pendingRef.current.set(id, { resolve, reject });
        workerRef.current.postMessage({
          id,
          type: 'evaluate',
          expression,
          ...(precision ? { precision } : {}),
        });
      });
    },
    [],
  );

  /**
   * Set default precision for subsequent evaluations.
   *
   * @param precision - MPFR precision in bits (e.g. 128, 256, 512, 1024)
   */
  const setPrecision = useCallback((precision: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not available'));
        return;
      }

      const id = String(++idCounterRef.current);
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({
        id,
        type: 'set-precision',
        precision,
      });
    });
  }, []);

  return { evaluate, setPrecision, available };
}
