import { describe, expect, it } from 'vitest';
import { marchingSquares } from '../../utils/marching-squares';
import type { ContourSegment } from '../../utils/marching-squares';

/**
 * Helper: builds a grid by evaluating f(x, y) over the given viewport with
 * the specified number of rows and cols.
 */
function buildGrid(
  fn: (x: number, y: number) => number,
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number },
  rows: number,
  cols: number,
): { grid: number[][]; dx: number; dy: number } {
  const dx = (viewport.xMax - viewport.xMin) / (cols - 1);
  const dy = (viewport.yMax - viewport.yMin) / (rows - 1);
  const grid: number[][] = [];

  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      const x = viewport.xMin + j * dx;
      const y = viewport.yMin + i * dy;
      row.push(fn(x, y));
    }
    grid.push(row);
  }

  return { grid, dx, dy };
}

describe('marchingSquares', () => {
  const defaultViewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };

  // ── Empty / degenerate inputs ─────────────────────────────────────

  it('should return empty array for empty grid', () => {
    const result = marchingSquares([], 0, 1, 1, defaultViewport);
    expect(result).toEqual([]);
  });

  it('should return empty array for grid with empty rows', () => {
    const result = marchingSquares([[]], 0, 1, 1, defaultViewport);
    expect(result).toEqual([]);
  });

  it('should return empty array for 1x1 grid (no cells)', () => {
    const result = marchingSquares([[0]], 0, 1, 1, defaultViewport);
    expect(result).toEqual([]);
  });

  it('should return empty array when all grid values are above isovalue', () => {
    // All corners inside => case 15 everywhere => no contour
    const grid = [
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
    ];
    const result = marchingSquares(grid, 0, 1, 1, defaultViewport);
    expect(result).toEqual([]);
  });

  it('should return empty array when all grid values are below isovalue', () => {
    // All corners outside => case 0 everywhere => no contour
    const grid = [
      [-5, -5, -5],
      [-5, -5, -5],
      [-5, -5, -5],
    ];
    const result = marchingSquares(grid, 0, 1, 1, defaultViewport);
    expect(result).toEqual([]);
  });

  // ── Basic contour detection ───────────────────────────────────────

  it('should detect a contour in a simple 2x2 grid', () => {
    // Single cell with mixed sign => should produce a segment
    const grid = [
      [-1, 1],
      [1, -1],
    ];
    const result = marchingSquares(grid, 0, 1, 1, defaultViewport);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.points.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect a contour in a 3x3 grid with a sign change', () => {
    // Center cell positive, surrounding negative => diagonal split
    const grid = [
      [-1, -1, -1],
      [-1, 1, -1],
      [-1, -1, -1],
    ];
    const result = marchingSquares(grid, 0, 1, 1, defaultViewport);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce contour points within the viewport bounds', () => {
    const viewport = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    const { grid, dx, dy } = buildGrid((x, y) => x * x + y * y - 1, viewport, 50, 50);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    expect(result.length).toBeGreaterThan(0);
    for (const segment of result) {
      for (const p of segment.points) {
        expect(p.x).toBeGreaterThanOrEqual(viewport.xMin - dx);
        expect(p.x).toBeLessThanOrEqual(viewport.xMax + dx);
        expect(p.y).toBeGreaterThanOrEqual(viewport.yMin - dy);
        expect(p.y).toBeLessThanOrEqual(viewport.yMax + dy);
      }
    }
  });

  // ── Circle: x^2 + y^2 = r^2 ──────────────────────────────────────

  it('should trace a circle contour (x^2+y^2-4=0)', () => {
    const viewport = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
    const { grid, dx, dy } = buildGrid((x, y) => x * x + y * y - 4, viewport, 100, 100);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    expect(result.length).toBeGreaterThan(0);
    const totalPoints = result.reduce((sum, s) => sum + s.points.length, 0);
    expect(totalPoints).toBeGreaterThan(10);
  });

  it('should produce points approximately on the circle', () => {
    const viewport = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
    const { grid, dx, dy } = buildGrid((x, y) => x * x + y * y - 4, viewport, 200, 200);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    // Every contour point should satisfy x^2+y^2 ~ 4 (radius 2)
    for (const segment of result) {
      for (const p of segment.points) {
        const distSq = p.x * p.x + p.y * p.y;
        // At 200x200 resolution over [-3,3] the step is 0.03, so allow reasonable tolerance
        expect(distSq).toBeGreaterThan(2.5);
        expect(distSq).toBeLessThan(5.5);
      }
    }
  });

  // ── Linear function: y - x = 0 (diagonal line) ───────────────────

  it('should trace a diagonal line contour (y-x=0)', () => {
    const viewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    const { grid, dx, dy } = buildGrid((x, y) => y - x, viewport, 50, 50);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    expect(result.length).toBeGreaterThan(0);
    // Each point on the contour should have x ~ y
    for (const segment of result) {
      for (const p of segment.points) {
        expect(Math.abs(p.x - p.y)).toBeLessThan(0.5);
      }
    }
  });

  // ── Horizontal line: y = 0 ───────────────────────────────────────

  it('should trace a horizontal line contour (y=0)', () => {
    const viewport = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
    const { grid, dx, dy } = buildGrid((_x, y) => y, viewport, 40, 40);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    expect(result.length).toBeGreaterThan(0);
    for (const segment of result) {
      for (const p of segment.points) {
        expect(Math.abs(p.y)).toBeLessThan(0.5);
      }
    }
  });

  // ── Custom isovalue ───────────────────────────────────────────────

  it('should use a non-zero isovalue', () => {
    const viewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    // f(x,y) = x + y, isovalue = 2 => contour along x+y=2
    const { grid, dx, dy } = buildGrid((x, y) => x + y, viewport, 60, 60);
    const result = marchingSquares(grid, 2, dx, dy, viewport);

    expect(result.length).toBeGreaterThan(0);
    for (const segment of result) {
      for (const p of segment.points) {
        expect(Math.abs(p.x + p.y - 2)).toBeLessThan(0.5);
      }
    }
  });

  // ── All segments have at least 2 points ───────────────────────────

  it('should only emit segments with at least 2 points', () => {
    const viewport = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
    const { grid, dx, dy } = buildGrid((x, y) => x * x + y * y - 1, viewport, 80, 80);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    for (const segment of result) {
      expect(segment.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  // ── Saddle-point resolution ───────────────────────────────────────

  it('should handle saddle-point grids without crashing', () => {
    // Saddle-like function: f(x,y) = x*y
    // At the origin the function has a saddle point => cases 5 and 10 can appear
    const viewport = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    const { grid, dx, dy } = buildGrid((x, y) => x * y, viewport, 60, 60);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    // Should produce at least one segment for each branch of the hyperbola
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Large grid performance sanity ─────────────────────────────────

  it('should handle a 200x200 grid without infinite loop', () => {
    const viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    const { grid, dx, dy } = buildGrid((x, y) => Math.sin(x) + Math.cos(y), viewport, 200, 200);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    // Multiple contour lines expected for a periodic function
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Return type structure ─────────────────────────────────────────

  it('should return ContourSegment objects with correct shape', () => {
    const viewport = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    const { grid, dx, dy } = buildGrid((x, y) => x * x + y * y - 1, viewport, 40, 40);
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    expect(Array.isArray(result)).toBe(true);
    for (const segment of result) {
      expect(segment).toHaveProperty('points');
      expect(Array.isArray(segment.points)).toBe(true);
      for (const p of segment.points) {
        expect(typeof p.x).toBe('number');
        expect(typeof p.y).toBe('number');
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  // ── Ellipse: x^2/16 + y^2/9 - 1 = 0 ─────────────────────────────

  it('should trace an ellipse contour', () => {
    const viewport = { xMin: -5, xMax: 5, yMin: -4, yMax: 4 };
    const { grid, dx, dy } = buildGrid(
      (x, y) => (x * x) / 16 + (y * y) / 9 - 1,
      viewport,
      100,
      100,
    );
    const result = marchingSquares(grid, 0, dx, dy, viewport);

    expect(result.length).toBeGreaterThan(0);
    const totalPoints = result.reduce((sum, s) => sum + s.points.length, 0);
    expect(totalPoints).toBeGreaterThan(5);
  });

  // ── No contour when function is uniformly on the boundary ─────────

  it('should return empty for a grid where all values equal the isovalue', () => {
    // All values equal to 0 => all corners are >= 0 => case 15 => no segments
    const grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const result = marchingSquares(grid, 0, 1, 1, defaultViewport);
    // case 15 (all inside), no contour produced
    expect(result).toEqual([]);
  });
});
