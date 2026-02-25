/**
 * Manager for compute worker pool
 * Handles worker lifecycle, message routing, and error recovery
 */

import type { ComputeRequest, ComputeResponse } from './compute.worker';
import type { EvaluationContext } from '@nextcalc/math-engine';

type PendingRequest = {
  // biome-ignore lint/suspicious/noExplicitAny: generic resolve callback from Promise constructor
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class ComputeManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.initWorker();
  }

  /**
   * Initialize the compute worker
   */
  private initWorker(): void {
    try {
      // In Next.js, we need to use URL constructor for worker
      this.worker = new Worker(
        new URL('./compute.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Failed to initialize compute worker:', error);
      // Fallback: computations will run on main thread
    }
  }

  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent<ComputeResponse | { type: 'ready' }>): void {
    const data = event.data;

    // Handle worker ready signal
    if ('type' in data && data.type === 'ready') {
      this.readyResolve();
      return;
    }

    const response = data as ComputeResponse;
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      console.warn(`Received response for unknown request: ${response.id}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.type === 'success') {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'Computation failed'));
    }
  }

  /**
   * Handle worker errors
   */
  private handleError(error: ErrorEvent): void {
    console.error('Worker error:', error);

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker encountered an error'));
      this.pendingRequests.delete(id);
    }

    // Attempt to restart worker
    this.worker?.terminate();
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.initWorker();
  }

  /**
   * Send a compute request to the worker
   */
  private async sendRequest<T>(
    type: ComputeRequest['type'],
    expression: string,
    context?: EvaluationContext,
    timeoutMs = 10000
  ): Promise<T> {
    // Wait for worker to be ready
    await this.readyPromise;

    if (!this.worker) {
      throw new Error('Compute worker not available');
    }

    const id = `req-${++this.requestCounter}`;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Computation timeout'));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const request: ComputeRequest = {
        id,
        type,
        expression,
        ...(context && { context }),
      };

      this.worker!.postMessage(request);
    });
  }

  /**
   * Evaluate an expression in the worker
   */
  async evaluate(expression: string, context?: EvaluationContext): Promise<number | bigint | string> {
    return this.sendRequest('evaluate', expression, context);
  }

  /**
   * Parse an expression in the worker
   */
  async parse(expression: string): Promise<unknown> {
    return this.sendRequest('parse', expression);
  }

  /**
   * Simplify an expression in the worker
   */
  async simplify(expression: string): Promise<unknown> {
    return this.sendRequest('simplify', expression);
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker terminated'));
      this.pendingRequests.delete(id);
    }
  }
}

// Singleton instance
let computeManagerInstance: ComputeManager | null = null;

/**
 * Get the global compute manager instance
 */
export function getComputeManager(): ComputeManager {
  if (!computeManagerInstance) {
    computeManagerInstance = new ComputeManager();
  }
  return computeManagerInstance;
}
