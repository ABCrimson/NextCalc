/**
 * Adaptive sampling algorithm for mathematical functions
 * Uses recursive subdivision with angle-based tolerance
 * @module sampling/adaptive
 */

import type { Point2D, SamplingConfig } from '../types/index';

export interface SamplingResult {
  points: Point2D[];
  sampleCount: number;
  elapsedTime: number;
}

/**
 * Computes the angle between three points
 * Used to determine curvature
 */
function computeAngle(p0: Point2D, p1: Point2D, p2: Point2D): number {
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

/**
 * Recursively subdivides a function between two points based on curvature
 */
function subdivide(
  fn: (x: number) => number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  depth: number,
  maxDepth: number,
  tolerance: number,
  result: Point2D[]
): void {
  // Base case: max depth reached
  if (depth >= maxDepth) {
    result.push({ x: x1, y: y1 });
    return;
  }

  // Sample midpoint
  const xMid = (x0 + x1) / 2;
  let yMid: number;

  try {
    yMid = fn(xMid);
    if (!Number.isFinite(yMid)) {
      // Function undefined at midpoint - split anyway
      result.push({ x: x1, y: y1 });
      return;
    }
  } catch {
    // Function error at midpoint
    result.push({ x: x1, y: y1 });
    return;
  }

  // Compute angle to determine if subdivision is needed
  const angle = computeAngle(
    { x: x0, y: y0 },
    { x: xMid, y: yMid },
    { x: x1, y: y1 }
  );

  // If angle is too large (high curvature), subdivide
  if (Math.abs(Math.PI - angle) > tolerance) {
    subdivide(fn, x0, xMid, y0, yMid, depth + 1, maxDepth, tolerance, result);
    subdivide(fn, xMid, x1, yMid, y1, depth + 1, maxDepth, tolerance, result);
  } else {
    // Angle is small enough, accept this segment
    result.push({ x: x1, y: y1 });
  }
}

/**
 * Samples a 1D function adaptively using recursive subdivision
 * @param fn Function to sample
 * @param xMin Minimum x value
 * @param xMax Maximum x value
 * @param config Sampling configuration
 * @returns Adaptively sampled points
 */
export function adaptiveSample1D(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  config: SamplingConfig
): SamplingResult {
  const startTime = performance.now();

  // Initial uniform sampling
  const initialPoints: Point2D[] = [];
  const dx = (xMax - xMin) / config.initialSamples;

  for (let i = 0; i <= config.initialSamples; i++) {
    const x = xMin + i * dx;
    try {
      const y = fn(x);
      if (Number.isFinite(y)) {
        initialPoints.push({ x, y });
      }
    } catch {
      // Skip invalid points
    }
  }

  if (initialPoints.length < 2) {
    return {
      points: initialPoints,
      sampleCount: initialPoints.length,
      elapsedTime: performance.now() - startTime,
    };
  }

  // Apply adaptive refinement between consecutive points
  const result: Point2D[] = [initialPoints[0]!];

  for (let i = 0; i < initialPoints.length - 1; i++) {
    const p0 = initialPoints[i]!;
    const p1 = initialPoints[i + 1]!;

    subdivide(
      fn,
      p0.x,
      p1.x,
      p0.y,
      p1.y,
      0,
      config.maxDepth,
      config.angleTolerance,
      result
    );
  }

  return {
    points: result,
    sampleCount: result.length,
    elapsedTime: performance.now() - startTime,
  };
}

/**
 * Samples a 2D parametric function adaptively
 */
export function adaptiveSampleParametric2D(
  xFn: (t: number) => number,
  yFn: (t: number) => number,
  tMin: number,
  tMax: number,
  config: SamplingConfig
): SamplingResult {
  const startTime = performance.now();

  // Create composite function for sampling
  const points: Point2D[] = [];
  const dt = (tMax - tMin) / config.initialSamples;

  // Initial uniform sampling
  for (let i = 0; i <= config.initialSamples; i++) {
    const t = tMin + i * dt;
    try {
      const x = xFn(t);
      const y = yFn(t);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ x, y });
      }
    } catch {
      // Skip invalid points
    }
  }

  if (points.length < 2) {
    return {
      points,
      sampleCount: points.length,
      elapsedTime: performance.now() - startTime,
    };
  }

  // Refine based on angle between consecutive segments
  const refined: Point2D[] = [points[0]!];

  for (let i = 0; i < points.length - 2; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const p2 = points[i + 2]!;

    const angle = computeAngle(p0, p1, p2);

    if (Math.abs(Math.PI - angle) > config.angleTolerance && i < points.length - 1) {
      // High curvature: add intermediate point
      const tMid = tMin + (i + 0.5) * dt;
      try {
        const x = xFn(tMid);
        const y = yFn(tMid);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          refined.push({ x, y });
        }
      } catch {
        // Skip
      }
    }

    refined.push(p1);
  }

  // Add last point
  refined.push(points[points.length - 1]!);

  return {
    points: refined,
    sampleCount: refined.length,
    elapsedTime: performance.now() - startTime,
  };
}

/**
 * Uniform sampling (fallback for simple cases)
 */
export function uniformSample1D(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  samples: number
): SamplingResult {
  const startTime = performance.now();
  const points: Point2D[] = [];
  const dx = (xMax - xMin) / samples;

  for (let i = 0; i <= samples; i++) {
    const x = xMin + i * dx;
    try {
      const y = fn(x);
      if (Number.isFinite(y)) {
        points.push({ x, y });
      }
    } catch {
      // Skip invalid points
    }
  }

  return {
    points,
    sampleCount: points.length,
    elapsedTime: performance.now() - startTime,
  };
}

/**
 * Default sampling configuration
 */
export const defaultSamplingConfig: SamplingConfig = {
  initialSamples: 100,
  maxDepth: 5,
  angleTolerance: 0.1, // ~5.7 degrees
  method: 'recursive-subdivision',
  useGPU: false,
};
