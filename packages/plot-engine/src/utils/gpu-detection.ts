/**
 * GPU capability detection and backend selection
 *
 * Determines the best available rendering backend at runtime by probing
 * navigator.gpu (WebGPU), then canvas.getContext('webgl2'), falling back to
 * canvas2d when neither GPU API is available.
 *
 * Usage:
 *   const backend = await detectBestBackend();
 *   // → 'webgpu' | 'webgl2' | 'canvas2d'
 *
 * @module utils/gpu-detection
 */

import type { RenderBackend } from '../types/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detailed report returned by probeGPUCapabilities */
export interface GPUCapabilityReport {
  /** Selected backend after probing */
  backend: RenderBackend;
  /** True if navigator.gpu exists */
  hasWebGPU: boolean;
  /** True if a WebGPU adapter was successfully requested */
  hasWebGPUAdapter: boolean;
  /** True if WebGL 2 context is available */
  hasWebGL2: boolean;
  /** True if WebGL 1 context is available (sub-feature of webgl2 fallback path) */
  hasWebGL1: boolean;
  /** GPU adapter info when WebGPU is available, otherwise null */
  adapterInfo: GPUAdapterInfo | null;
  /** Human-readable description of selected backend and detected capabilities */
  description: string;
}

// ---------------------------------------------------------------------------
// Primary detection function
// ---------------------------------------------------------------------------

/**
 * Detects and returns the best available rendering backend.
 *
 * Priority order:
 *   1. WebGPU  – navigator.gpu present and adapter obtainable
 *   2. WebGL 2 – canvas.getContext('webgl2') succeeds
 *   3. Canvas 2D – universal fallback
 *
 * @returns Promise resolving to the best available RenderBackend string.
 */
export async function detectBestBackend(): Promise<RenderBackend> {
  // WebGPU check
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (adapter) {
        return 'webgpu';
      }
    } catch {
      // Adapter request failed (e.g. blocked by permissions policy) – continue
    }
  }

  // WebGL 2 check
  if (typeof document !== 'undefined') {
    const probe = document.createElement('canvas');
    const ctx = probe.getContext('webgl2');
    if (ctx) {
      // Clean up the context so the browser can release resources
      const ext = ctx.getExtension('WEBGL_lose_context');
      ext?.loseContext();
      return 'webgl2';
    }
  }

  return 'canvas2d';
}

// ---------------------------------------------------------------------------
// Extended capability probe
// ---------------------------------------------------------------------------

/**
 * Performs a full capability probe and returns a detailed report.
 * Useful for diagnostics, telemetry, and conditional feature activation.
 *
 * @returns Promise resolving to a GPUCapabilityReport.
 */
export async function probeGPUCapabilities(): Promise<GPUCapabilityReport> {
  let hasWebGPU = false;
  let hasWebGPUAdapter = false;
  let hasWebGL2 = false;
  let hasWebGL1 = false;
  let adapterInfo: GPUAdapterInfo | null = null;

  // --- WebGPU probe ---
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    hasWebGPU = true;
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (adapter) {
        hasWebGPUAdapter = true;
        try {
          // requestAdapterInfo is a newer addition and may not exist on all
          // browser builds that support WebGPU.  Use optional chaining so the
          // TypeScript strict check is satisfied without casting the adapter.
          const adapterWithInfo = adapter as GPUAdapter & {
            requestAdapterInfo?: () => Promise<GPUAdapterInfo>;
          };
          if (typeof adapterWithInfo.requestAdapterInfo === 'function') {
            adapterInfo = await adapterWithInfo.requestAdapterInfo();
          }
        } catch {
          // requestAdapterInfo may require user gesture in some browsers
        }
      }
    } catch {
      // Adapter request threw – adapter unavailable
    }
  }

  // --- WebGL probe (always run for reporting completeness) ---
  if (typeof document !== 'undefined') {
    const probe = document.createElement('canvas');

    const gl2 = probe.getContext('webgl2');
    if (gl2) {
      hasWebGL2 = true;
      const ext = gl2.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }

    const gl1 = probe.getContext('webgl') ?? probe.getContext('experimental-webgl');
    if (gl1) {
      hasWebGL1 = true;
    }
  }

  // --- Determine selected backend ---
  let backend: RenderBackend;
  if (hasWebGPUAdapter) {
    backend = 'webgpu';
  } else if (hasWebGL2) {
    backend = 'webgl2';
  } else {
    backend = 'canvas2d';
  }

  // --- Build description ---
  const parts: string[] = [`Selected backend: ${backend}`];
  if (hasWebGPUAdapter && adapterInfo) {
    const vendor = adapterInfo.vendor ?? 'unknown vendor';
    const device = adapterInfo.device ?? 'unknown device';
    parts.push(`WebGPU adapter: ${vendor} / ${device}`);
  } else if (hasWebGPU) {
    parts.push('WebGPU API present but no adapter obtained');
  }
  if (hasWebGL2) parts.push('WebGL 2 available');
  if (hasWebGL1) parts.push('WebGL 1 available');
  if (!hasWebGL2 && !hasWebGL1) parts.push('No WebGL support detected');

  return {
    backend,
    hasWebGPU,
    hasWebGPUAdapter,
    hasWebGL2,
    hasWebGL1,
    adapterInfo,
    description: parts.join(' | '),
  };
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Returns true when the current browser exposes navigator.gpu.
 * Does NOT guarantee an adapter can be obtained.
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Returns true when WebGL 2 is available in the current environment.
 */
export function isWebGL2Available(): boolean {
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('canvas');
  return probe.getContext('webgl2') !== null;
}
