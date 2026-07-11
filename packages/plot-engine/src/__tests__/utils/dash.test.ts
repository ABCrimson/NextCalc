import { describe, expect, it } from 'vitest';
import type { Point2D } from '../../types/index';
import { dashPolyline } from '../../utils/dash';

function segmentLength(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe('dashPolyline', () => {
  it('emits 5 pairs for a 10-unit segment with dash 1 / gap 1', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const out = dashPolyline(points, 1, 1);
    expect(out).toHaveLength(10); // 5 pairs
    for (let i = 0; i < out.length; i += 2) {
      expect(segmentLength(out[i]!, out[i + 1]!)).toBeCloseTo(1, 10);
      expect(out[i]!.x).toBeCloseTo(i, 10); // dashes start at 0, 2, 4, 6, 8
    }
  });

  it('keeps dash/gap ratio over long polylines', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const out = dashPolyline(points, 3, 2);
    let dashTotal = 0;
    for (let i = 0; i < out.length; i += 2) {
      dashTotal += segmentLength(out[i]!, out[i + 1]!);
    }
    // 100 units of period-5 pattern => 20 dashes x 3 units
    expect(dashTotal).toBeCloseTo(60, 6);
  });

  it('continues dash phase across polyline joints', () => {
    // Two 0.75-length segments with dash 1 / gap 1: the first dash spans the
    // corner and ends 0.25 into the second segment.
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 0.75, y: 0 },
      { x: 0.75, y: 0.75 },
    ];
    const out = dashPolyline(points, 1, 1);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[1]!.x).toBeCloseTo(0.75, 10);
    expect(out[1]!.y).toBeCloseTo(0.25, 10);
  });

  it('emits a trailing partial dash', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2.5, y: 0 },
    ];
    const out = dashPolyline(points, 1, 1);
    expect(out).toHaveLength(4); // [0,1] and [2,2.5]
    expect(out[2]!.x).toBeCloseTo(2, 10);
    expect(out[3]!.x).toBeCloseTo(2.5, 10);
  });

  it('returns [] for degenerate inputs', () => {
    expect(dashPolyline([], 1, 1)).toEqual([]);
    expect(dashPolyline([{ x: 0, y: 0 }], 1, 1)).toEqual([]);
    expect(
      dashPolyline(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        0,
        1,
      ),
    ).toEqual([]);
    expect(
      dashPolyline(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        -1,
        1,
      ),
    ).toEqual([]);
  });

  it('skips zero-length and non-finite segments', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: Number.NaN, y: 0 },
      { x: 2, y: 0 },
    ];
    // No crash; NaN segments contribute nothing
    const out = dashPolyline(points, 1, 1);
    expect(out.length % 2).toBe(0);
    for (const p of out) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});
