/**
 * Web Worker for adaptive sampling
 * Runs sampling in a separate thread to avoid blocking UI
 * @module sampling/worker
 */

import type { SamplingConfig } from '../types/index';
import { adaptiveSample1D, adaptiveSampleParametric2D, type SamplingResult } from './adaptive';

export interface SamplingRequest {
  id: string;
  type: '1d' | 'parametric-2d';
  fnString: string; // Serialized function
  xMin?: number;
  xMax?: number;
  tMin?: number;
  tMax?: number;
  config: SamplingConfig;
}

export interface SamplingResponse {
  id: string;
  result: SamplingResult;
  error?: string;
}

/**
 * Web Worker manager for adaptive sampling
 */
export class SamplingWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (result: SamplingResult) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /**
   * Initializes the worker
   */
  async initialize(): Promise<void> {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers not supported');
    }

    // Create worker from blob to avoid external file dependency
    const workerCode = `
      ${adaptiveSample1D.toString()}
      ${adaptiveSampleParametric2D.toString()}

      // Helper functions
      function computeAngle(p0, p1, p2) {
        const v1x = p1.x - p0.x;
        const v1y = p1.y - p0.y;
        const v2x = p2.x - p1.x;
        const v2y = p2.y - p1.y;

        const dot = v1x * v2x + v1y * v2y;
        const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

        if (len1 === 0 || len2 === 0) return 0;

        const cosAngle = dot / (len1 * len2);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      }

      function subdivide(fn, x0, x1, y0, y1, depth, maxDepth, tolerance, result) {
        if (depth >= maxDepth) {
          result.push({ x: x1, y: y1 });
          return;
        }

        const xMid = (x0 + x1) / 2;
        let yMid;

        try {
          yMid = fn(xMid);
          if (!Number.isFinite(yMid)) {
            result.push({ x: x1, y: y1 });
            return;
          }
        } catch {
          result.push({ x: x1, y: y1 });
          return;
        }

        const angle = computeAngle(
          { x: x0, y: y0 },
          { x: xMid, y: yMid },
          { x: x1, y: y1 }
        );

        if (Math.abs(Math.PI - angle) > tolerance) {
          subdivide(fn, x0, xMid, y0, yMid, depth + 1, maxDepth, tolerance, result);
          subdivide(fn, xMid, x1, yMid, y1, depth + 1, maxDepth, tolerance, result);
        } else {
          result.push({ x: x1, y: y1 });
        }
      }

      // Message handler
      self.addEventListener('message', (event) => {
        const request = event.data;

        try {
          // Reconstruct function from string
          const fn = new Function('x', 'return ' + request.fnString);

          let result;
          if (request.type === '1d') {
            result = adaptiveSample1D(fn, request.xMin, request.xMax, request.config);
          } else if (request.type === 'parametric-2d') {
            const xFn = new Function('t', 'return ' + request.xFnString);
            const yFn = new Function('t', 'return ' + request.yFnString);
            result = adaptiveSampleParametric2D(xFn, yFn, request.tMin, request.tMax, request.config);
          } else {
            throw new Error('Unknown sampling type');
          }

          self.postMessage({ id: request.id, result });
        } catch (error) {
          self.postMessage({
            id: request.id,
            error: error.message || 'Sampling failed'
          });
        }
      });
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));

    this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
    this.worker.addEventListener('error', this.handleWorkerError.bind(this));
  }

  /**
   * Samples a 1D function using the worker
   */
  sample1D(
    fn: (x: number) => number,
    xMin: number,
    xMax: number,
    config: SamplingConfig
  ): Promise<SamplingResult> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = Math.random().toString(36).substring(7);
    const fnString = fn.toString().replace(/^[^{]*{\s*return\s*/, '').replace(/;\s*}$/, '');

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage({
        id,
        type: '1d',
        fnString,
        xMin,
        xMax,
        config,
      } as SamplingRequest);

      // Timeout after 10 seconds
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error('Sampling timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Samples a 2D parametric function using the worker
   */
  sampleParametric2D(
    xFn: (t: number) => number,
    yFn: (t: number) => number,
    tMin: number,
    tMax: number,
    config: SamplingConfig
  ): Promise<SamplingResult> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = Math.random().toString(36).substring(7);
    const xFnString = xFn.toString().replace(/^[^{]*{\s*return\s*/, '').replace(/;\s*}$/, '');
    const yFnString = yFn.toString().replace(/^[^{]*{\s*return\s*/, '').replace(/;\s*}$/, '');

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage({
        id,
        type: 'parametric-2d',
        xFnString,
        yFnString,
        tMin,
        tMax,
        config,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error('Sampling timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handles messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent<SamplingResponse>): void {
    const response = event.data;
    const pending = this.pendingRequests.get(response.id);

    if (pending) {
      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  /**
   * Handles worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Worker error'));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Terminates the worker
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Worker disposed'));
      this.pendingRequests.delete(id);
    }
  }
}
