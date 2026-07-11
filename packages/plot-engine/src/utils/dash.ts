/**
 * CPU polyline dashing for GPU line-list rendering.
 *
 * WebGL/WebGPU line primitives have no native dash support, so dashed
 * boundaries (strict inequalities) are emitted as independent segment pairs
 * by walking the polyline's arc length. Callers convert a pixel dash size to
 * math units via `(viewport.xMax - viewport.xMin) / canvasCssWidth`.
 *
 * @module utils/dash
 */

import type { Point2D } from '../types/index';

/**
 * Converts a polyline into dashed line-list pairs (even index = segment
 * start, odd index = segment end) by walking its arc length in math units.
 * Dash phase is continuous across polyline joints, so corners do not reset
 * the pattern.
 */
export function dashPolyline(points: Point2D[], dashLength: number, gapLength: number): Point2D[] {
  if (points.length < 2 || dashLength <= 0 || gapLength < 0) return [];

  const out: Point2D[] = [];
  const period = dashLength + gapLength;

  /** Distance already travelled within the current dash/gap period. */
  let phase = 0;
  /** Pending dash start (null while inside a gap). */
  let dashStart: Point2D | null = points[0]!;

  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s]!;
    const b = points[s + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen === 0 || !Number.isFinite(segLen)) continue;

    const ux = (b.x - a.x) / segLen;
    const uy = (b.y - a.y) / segLen;

    let travelled = 0;
    while (travelled < segLen) {
      const inDash = phase < dashLength;
      // Distance until the current dash or gap ends
      const boundary = inDash ? dashLength - phase : period - phase;
      const step = Math.min(boundary, segLen - travelled);

      travelled += step;
      phase += step;

      const px = a.x + ux * travelled;
      const py = a.y + uy * travelled;

      if (phase >= period) {
        // Gap ended — the next dash starts here
        phase = 0;
        dashStart = { x: px, y: py };
      } else if (inDash && phase >= dashLength && dashStart) {
        // Dash ended — emit the completed pair
        out.push(dashStart, { x: px, y: py });
        dashStart = null;
      }
    }
  }

  // Trailing partial dash reaches the polyline end
  const last = points[points.length - 1]!;
  if (dashStart && phase < dashLength && (dashStart.x !== last.x || dashStart.y !== last.y)) {
    out.push(dashStart, { x: last.x, y: last.y });
  }

  return out;
}
