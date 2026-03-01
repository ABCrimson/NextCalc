/**
 * Marching Squares algorithm for implicit plot contours
 * Finds iso-contours where f(x,y) = isovalue
 * @module utils/marching-squares
 */

import type { Point2D } from '../types/index';

/**
 * Contour segment resulting from marching squares
 */
export interface ContourSegment {
  points: Point2D[];
}

/**
 * Configuration for viewport transformation
 */
interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Marching squares lookup table
 * Each entry defines the edges to connect for a given cell configuration
 * Edges are numbered: 0=bottom, 1=right, 2=top, 3=left
 */
const MARCHING_SQUARES_CASES: number[][] = [
  [], // 0000: all outside
  [0, 3], // 0001: bottom-left corner inside
  [0, 1], // 0010: bottom-right corner inside
  [1, 3], // 0011: bottom edge inside
  [1, 2], // 0100: top-right corner inside
  [0, 1, 2, 3], // 0101: saddle point (ambiguous)
  [0, 2], // 0110: right edge inside
  [2, 3], // 0111: top-left corner outside
  [2, 3], // 1000: top-left corner inside
  [0, 2], // 1001: left edge inside
  [1, 2, 0, 3], // 1010: saddle point (ambiguous)
  [1, 2], // 1011: top-right corner outside
  [1, 3], // 1100: top edge inside
  [0, 1], // 1101: bottom-right corner outside
  [0, 3], // 1110: bottom-left corner outside
  [], // 1111: all inside
];

/**
 * Applies the Marching Squares algorithm to find iso-contours
 *
 * @param grid - 2D array of function values sampled on a grid
 * @param isovalue - Target value for the contour (typically 0 for implicit plots)
 * @param dx - Grid spacing in x direction
 * @param dy - Grid spacing in y direction
 * @param viewport - Viewport bounds for coordinate transformation
 * @returns Array of contour segments
 */
export function marchingSquares(
  grid: number[][],
  isovalue: number,
  dx: number,
  dy: number,
  viewport: Viewport,
): ContourSegment[] {
  const rows = grid.length;
  if (rows === 0) return [];

  const cols = grid[0]!.length;
  if (cols === 0) return [];

  const contours: ContourSegment[] = [];
  const visited = new Set<string>();

  // Process each cell in the grid
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const cellKey = `${i},${j}`;
      if (visited.has(cellKey)) continue;

      const segment = traceContour(grid, isovalue, i, j, dx, dy, viewport, visited);

      if (segment.points.length >= 2) {
        contours.push(segment);
      }
    }
  }

  return contours;
}

/**
 * Traces a contour starting from a given cell
 */
function traceContour(
  grid: number[][],
  isovalue: number,
  startI: number,
  startJ: number,
  dx: number,
  dy: number,
  viewport: Viewport,
  visited: Set<string>,
): ContourSegment {
  const points: Point2D[] = [];
  const rows = grid.length;
  const cols = grid[0]!.length;

  let i = startI;
  let j = startJ;
  let iterations = 0;
  const maxIterations = rows * cols * 2; // Prevent infinite loops

  // Trace the contour
  while (iterations < maxIterations) {
    const cellKey = `${i},${j}`;

    if (visited.has(cellKey)) break;
    visited.add(cellKey);

    // Get cell configuration
    const cellCase = getCellCase(grid, i, j, isovalue);

    if (cellCase === 0 || cellCase === 15) break;

    // Get edge intersections for this case
    const edges = MARCHING_SQUARES_CASES[cellCase];
    if (!edges || edges.length === 0) break;

    // Calculate intersection points
    for (let e = 0; e < edges.length; e += 2) {
      const edge1 = edges[e];
      const edge2 = edges[e + 1];

      if (edge1 === undefined || edge2 === undefined) continue;

      const p1 = getEdgePoint(grid, i, j, edge1, isovalue, dx, dy, viewport);
      const p2 = getEdgePoint(grid, i, j, edge2, isovalue, dx, dy, viewport);

      if (p1 && points.length === 0) points.push(p1);
      if (p2) points.push(p2);
    }

    // Move to next cell (simple greedy approach)
    const moved = moveToNextCell(grid, isovalue, i, j, visited);
    if (!moved) break;

    i = moved.i;
    j = moved.j;
    iterations++;
  }

  return { points };
}

/**
 * Gets the cell case (0-15) based on which corners are inside the contour
 */
function getCellCase(grid: number[][], i: number, j: number, isovalue: number): number {
  const rows = grid.length;
  const cols = grid[0]!.length;

  if (i >= rows - 1 || j >= cols - 1) return 0;

  const v00 = grid[i]![j]! >= isovalue ? 1 : 0; // bottom-left
  const v10 = grid[i]![j + 1]! >= isovalue ? 1 : 0; // bottom-right
  const v11 = grid[i + 1]![j + 1]! >= isovalue ? 1 : 0; // top-right
  const v01 = grid[i + 1]![j]! >= isovalue ? 1 : 0; // top-left

  return v00 | (v10 << 1) | (v11 << 2) | (v01 << 3);
}

/**
 * Calculates the intersection point on a cell edge using linear interpolation
 */
function getEdgePoint(
  grid: number[][],
  i: number,
  j: number,
  edge: number,
  isovalue: number,
  dx: number,
  dy: number,
  viewport: Viewport,
): Point2D | null {
  const rows = grid.length;
  const cols = grid[0]!.length;

  if (i >= rows - 1 || j >= cols - 1) return null;

  let x = 0;
  let y = 0;

  // Get values at edge endpoints and interpolate
  switch (edge) {
    case 0: {
      // Bottom edge
      const v0 = grid[i]![j]!;
      const v1 = grid[i]![j + 1]!;
      const t = (isovalue - v0) / (v1 - v0);
      x = viewport.xMin + (j + t) * dx;
      y = viewport.yMin + i * dy;
      break;
    }
    case 1: {
      // Right edge
      const v0 = grid[i]![j + 1]!;
      const v1 = grid[i + 1]![j + 1]!;
      const t = (isovalue - v0) / (v1 - v0);
      x = viewport.xMin + (j + 1) * dx;
      y = viewport.yMin + (i + t) * dy;
      break;
    }
    case 2: {
      // Top edge
      const v0 = grid[i + 1]![j]!;
      const v1 = grid[i + 1]![j + 1]!;
      const t = (isovalue - v0) / (v1 - v0);
      x = viewport.xMin + (j + t) * dx;
      y = viewport.yMin + (i + 1) * dy;
      break;
    }
    case 3: {
      // Left edge
      const v0 = grid[i]![j]!;
      const v1 = grid[i + 1]![j]!;
      const t = (isovalue - v0) / (v1 - v0);
      x = viewport.xMin + j * dx;
      y = viewport.yMin + (i + t) * dy;
      break;
    }
  }

  return { x, y };
}

/**
 * Determines the next cell to visit when tracing a contour
 */
function moveToNextCell(
  grid: number[][],
  isovalue: number,
  i: number,
  j: number,
  visited: Set<string>,
): { i: number; j: number } | null {
  const rows = grid.length;
  const cols = grid[0]!.length;

  // Check neighboring cells
  const neighbors = [
    { i: i - 1, j }, // up
    { i: i + 1, j }, // down
    { i, j: j - 1 }, // left
    { i, j: j + 1 }, // right
  ];

  for (const neighbor of neighbors) {
    if (
      neighbor.i >= 0 &&
      neighbor.i < rows - 1 &&
      neighbor.j >= 0 &&
      neighbor.j < cols - 1 &&
      !visited.has(`${neighbor.i},${neighbor.j}`)
    ) {
      const cellCase = getCellCase(grid, neighbor.i, neighbor.j, isovalue);
      if (cellCase > 0 && cellCase < 15) {
        return neighbor;
      }
    }
  }

  return null;
}
