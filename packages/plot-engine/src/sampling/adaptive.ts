/**
 * Adaptive sampling algorithm for mathematical functions
 * Uses recursive subdivision with a turning-angle tolerance.
 *
 * Discontinuities are preserved: where the function throws or evaluates
 * non-finite, the samplers emit explicit break markers (`{x, y: NaN}`, see
 * {@link isSampleBreak}) instead of silently dropping the sample, so
 * consumers can split their strokes at poles and domain gaps rather than
 * bridging them with a chord.
 *
 * @module sampling/adaptive
 */

import type { Point2D, SamplingConfig } from '../types/index';

export interface SamplingResult {
  points: Point2D[];
  sampleCount: number;
  elapsedTime: number;
}

/**
 * Golden-ratio conjugate (1/φ). Interior probe/split position used by
 * recursive subdivision, as a fraction of the cell width.
 *
 * A midpoint probe (0.5) is blind to any feature whose period is commensurate
 * with the sampling grid: y = sin(10πx) sampled with 100 uniform cells on
 * [-10, 10] is exactly zero at every grid point AND at every dyadic midpoint,
 * so midpoint refinement sees collinear points everywhere and renders a flat
 * line. Probing at an irrational fraction of the cell — and splitting there,
 * so every deeper probe also lands at an irrational fraction — makes it
 * impossible for a grid-commensurate oscillation to hide from refinement at
 * any recursion depth. Deterministic: same input always yields same output.
 */
const PROBE_FRACTION = 0.618033988749895;

/**
 * True when a sampled point is a discontinuity break marker rather than a
 * drawable sample. Markers are emitted where the plotted function throws or
 * returns a non-finite value; polylines/strips must be split at them.
 */
export function isSampleBreak(point: Point2D): boolean {
  return Number.isNaN(point.y);
}

/**
 * Splits a marker-bearing sample array into contiguous drawable segments.
 * Runs with fewer than 2 points (nothing to stroke) are dropped.
 */
export function splitSampleSegments(points: Point2D[]): Point2D[][] {
  const segments: Point2D[][] = [];
  let current: Point2D[] = [];
  for (const point of points) {
    if (isSampleBreak(point)) {
      if (current.length >= 2) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

/**
 * Computes the turning angle at p1 between segments p0→p1 and p1→p2:
 * 0 for collinear samples, growing with curvature, π for a full reversal.
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
  result: Point2D[],
): void {
  // Base case: max depth reached
  if (depth >= maxDepth) {
    result.push({ x: x1, y: y1 });
    return;
  }

  // Probe at an irrational (golden-ratio) fraction of the cell — never the
  // midpoint — so grid-commensurate oscillations cannot alias to a flat line
  // at any recursion depth (see PROBE_FRACTION).
  const xProbe = x0 + PROBE_FRACTION * (x1 - x0);
  let yProbe: number;

  try {
    yProbe = fn(xProbe);
  } catch {
    yProbe = Number.NaN;
  }

  if (!Number.isFinite(yProbe)) {
    // Function undefined inside the cell (pole or domain edge) — emit an
    // explicit break marker so consumers split the stroke instead of drawing
    // a chord across the gap.
    result.push({ x: xProbe, y: Number.NaN }, { x: x1, y: y1 });
    return;
  }

  // Turning angle at the probe point: 0 when the three samples are collinear,
  // growing with curvature. Refine while the polyline bends beyond tolerance.
  const angle = computeAngle({ x: x0, y: y0 }, { x: xProbe, y: yProbe }, { x: x1, y: y1 });

  if (angle > tolerance) {
    subdivide(fn, x0, xProbe, y0, yProbe, depth + 1, maxDepth, tolerance, result);
    subdivide(fn, xProbe, x1, yProbe, y1, depth + 1, maxDepth, tolerance, result);
  } else {
    // Bend is below tolerance — accept this segment as-is
    result.push({ x: x1, y: y1 });
  }
}

/**
 * Samples a 1D function adaptively using recursive subdivision
 *
 * Where `fn` throws or evaluates non-finite, the output contains explicit
 * break markers (`{x, y: NaN}`, collapsed when consecutive) instead of
 * silently omitting the sample — split strokes there ({@link
 * splitSampleSegments}) so asymptotes and domain gaps are never bridged.
 *
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
  config: SamplingConfig,
): SamplingResult {
  const startTime = performance.now();

  // Initial uniform sampling (grid positions exact, including endpoints, so
  // poles at "nice" x values — 1/x at 0 on a symmetric range — are hit and
  // become break markers rather than being straddled silently)
  const initialPoints: Point2D[] = [];
  const dx = (xMax - xMin) / config.initialSamples;

  for (let i = 0; i <= config.initialSamples; i++) {
    const x = xMin + i * dx;
    let y: number;
    try {
      y = fn(x);
    } catch {
      y = Number.NaN;
    }
    if (Number.isFinite(y)) {
      initialPoints.push({ x, y });
    } else {
      // Break marker; consecutive invalid samples collapse into one marker
      const last = initialPoints.at(-1);
      if (!last || !isSampleBreak(last)) {
        initialPoints.push({ x, y: Number.NaN });
      }
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

    if (isSampleBreak(p0) || isSampleBreak(p1)) {
      // Never refine across a discontinuity marker — keep the gap
      result.push(p1);
      continue;
    }

    subdivide(fn, p0.x, p1.x, p0.y, p1.y, 0, config.maxDepth, config.angleTolerance, result);
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
  config: SamplingConfig,
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

    // Turning angle beyond tolerance means high curvature at p1
    if (angle > config.angleTolerance && i < points.length - 1) {
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
  samples: number,
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
  // 256 uniform cells before refinement. The legacy 2D renderers evaluated
  // ~1000 blind uniform samples; 256 adaptive cells (up to 2^maxDepth points
  // each where curvature demands) match or exceed that fidelity while staying
  // cheap on smooth regions, and a power-of-two count keeps dx exactly
  // representable on binary-friendly ranges so grid samples land on "nice"
  // x values (e.g. the pole of 1/x at 0 on a symmetric domain).
  initialSamples: 256,
  maxDepth: 5,
  angleTolerance: 0.1, // max turning angle (~5.7°) accepted without refinement
  method: 'recursive-subdivision',
  useGPU: false,
};
