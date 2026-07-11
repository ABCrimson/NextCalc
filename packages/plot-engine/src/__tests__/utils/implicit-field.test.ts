import { describe, expect, it } from 'vitest';
import {
  combineIntersectionGrids,
  SCALAR_FIELD_CACHE_MAX_ENTRIES,
  ScalarFieldCache,
  sampleScalarField,
} from '../../utils/implicit-field';

const viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

describe('sampleScalarField', () => {
  it('produces a (ny+1) x (nx+1) grid with correct spacing', () => {
    const field = sampleScalarField((x, y) => x + y, viewport, { x: 256, y: 256 });
    expect(field.grid).toHaveLength(257);
    expect(field.grid[0]).toHaveLength(257);
    expect(field.nx).toBe(256);
    expect(field.ny).toBe(256);
    expect(field.dx).toBeCloseTo(20 / 256);
    expect(field.dy).toBeCloseTo(20 / 256);
  });

  it('is exact at active (sign-change) cells for a circle field', () => {
    const fn = (x: number, y: number) => x * x + y * y - 25;
    const field = sampleScalarField(fn, viewport, { x: 256, y: 256 });

    // Along the y = 0 row (grid row 128) the contour crossings at x = ±5 sit
    // in coarse cells whose corners straddle the sign change, so every grid
    // point near the contour on that row must be an exact evaluation.
    const i = 128;
    let checked = 0;
    for (let j = 0; j <= 256; j++) {
      const x = viewport.xMin + j * field.dx;
      const exact = fn(x, 0);
      if (Math.abs(exact) < 2) {
        expect(field.grid[i]![j]).toBeCloseTo(exact, 10);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('is sign-correct away from the contour (bilinear interior is a convex combination)', () => {
    const fn = (x: number, y: number) => x * x + y * y - 25;
    const field = sampleScalarField(fn, viewport, { x: 256, y: 256 });
    for (let i = 0; i <= 256; i++) {
      for (let j = 0; j <= 256; j++) {
        const x = viewport.xMin + j * field.dx;
        const y = viewport.yMin + i * field.dy;
        const exact = fn(x, y);
        // |F| > 5 keeps us at least one coarse cell away from the contour
        if (Math.abs(exact) > 5) {
          expect(Math.sign(field.grid[i]![j]!)).toBe(Math.sign(exact));
        }
      }
    }
  });

  it('preserves NaN at singularities (1/x - y has a hole at x = 0)', () => {
    const fn = (x: number, y: number) => 1 / x - y;
    const field = sampleScalarField(fn, viewport, { x: 256, y: 256 });
    // x = 0 is fine-grid column j = 128 (0 = -10 + 128 * 20/256)
    expect(field.grid[0]![128]).toBeNaN();
    expect(field.grid[128]![128]).toBeNaN();
    expect(field.grid[256]![128]).toBeNaN();
    // Neighbouring columns are finite
    expect(Number.isFinite(field.grid[128]![127]!)).toBe(true);
    expect(Number.isFinite(field.grid[128]![129]!)).toBe(true);
  });

  it('maps thrown evaluation errors to NaN', () => {
    const fn = (x: number, _y: number): number => {
      if (x > 0) throw new Error('domain');
      return x;
    };
    const field = sampleScalarField(fn, viewport, { x: 64, y: 64 });
    expect(field.grid[0]![0]).toBeCloseTo(-10);
    expect(field.grid[0]![64]).toBeNaN();
  });

  it('evaluates exactly everywhere for grids at or below coarse resolution', () => {
    const fn = (x: number, y: number) => Math.sin(x) * Math.cos(y);
    const field = sampleScalarField(fn, viewport, { x: 32, y: 32 });
    for (let i = 0; i <= 32; i++) {
      for (let j = 0; j <= 32; j++) {
        const x = viewport.xMin + j * field.dx;
        const y = viewport.yMin + i * field.dy;
        expect(field.grid[i]![j]).toBeCloseTo(fn(x, y), 12);
      }
    }
  });
});

describe('ScalarFieldCache', () => {
  it('returns the identical field object on repeat calls', () => {
    const cache = new ScalarFieldCache();
    const fn = (x: number, y: number) => x * x + y * y - 25;
    const a = cache.get(fn, viewport);
    const b = cache.get(fn, viewport);
    expect(b).toBe(a);
  });

  it('returns a distinct field after a viewport change', () => {
    const cache = new ScalarFieldCache();
    const fn = (x: number, y: number) => x * x + y * y - 25;
    const a = cache.get(fn, viewport);
    const b = cache.get(fn, { xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
    expect(b).not.toBe(a);
  });

  it('keys on function closure identity', () => {
    const cache = new ScalarFieldCache();
    const makeFn = () => (x: number, y: number) => x + y;
    const a = cache.get(makeFn(), viewport, { x: 16, y: 16 });
    const b = cache.get(makeFn(), viewport, { x: 16, y: 16 });
    expect(b).not.toBe(a);
  });

  it('evicts the least-recently-used entry at capacity', () => {
    const cache = new ScalarFieldCache();
    const fns: Array<(x: number, y: number) => number> = [];
    for (let i = 0; i < SCALAR_FIELD_CACHE_MAX_ENTRIES + 1; i++) {
      const k = i;
      fns.push((x: number, _y: number) => x + k);
    }

    const firstField = cache.get(fns[0]!, viewport, { x: 8, y: 8 });
    for (let i = 1; i <= SCALAR_FIELD_CACHE_MAX_ENTRIES; i++) {
      cache.get(fns[i]!, viewport, { x: 8, y: 8 });
    }
    // fns[0] was evicted by the 65th insert — a fresh object is produced
    expect(cache.get(fns[0]!, viewport, { x: 8, y: 8 })).not.toBe(firstField);
  });

  it('clear() drops all entries', () => {
    const cache = new ScalarFieldCache();
    const fn = (x: number, y: number) => x - y;
    const a = cache.get(fn, viewport, { x: 8, y: 8 });
    cache.clear();
    expect(cache.get(fn, viewport, { x: 8, y: 8 })).not.toBe(a);
  });
});

describe('combineIntersectionGrids', () => {
  it('computes the elementwise min of dir-scaled values', () => {
    const f = [
      [-1, 2],
      [3, -4],
    ];
    const g = [
      [5, -6],
      [-7, 8],
    ];
    // f <= 0 (dir -1) intersect g >= 0 (dir +1): min(-f, g)
    const combined = combineIntersectionGrids([
      { grid: f, dir: -1 },
      { grid: g, dir: 1 },
    ]);
    expect(combined).toEqual([
      [Math.min(1, 5), Math.min(-2, -6)],
      [Math.min(-3, -7), Math.min(4, 8)],
    ]);
  });

  it('propagates NaN from any layer', () => {
    const combined = combineIntersectionGrids([
      { grid: [[Number.NaN, 1]], dir: 1 },
      { grid: [[2, 3]], dir: 1 },
    ]);
    expect(combined[0]![0]).toBeNaN();
    expect(combined[0]![1]).toBe(1);
  });

  it('normalizes a single layer by its direction', () => {
    const combined = combineIntersectionGrids([{ grid: [[-2, 3]], dir: -1 }]);
    expect(combined).toEqual([[2, -3]]);
  });

  it('returns [] for no layers', () => {
    expect(combineIntersectionGrids([])).toEqual([]);
  });
});
