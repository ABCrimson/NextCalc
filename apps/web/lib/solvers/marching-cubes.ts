/**
 * Marching Cubes Algorithm
 *
 * Classic Marching Cubes implementation for extracting isosurfaces from
 * a 3D scalar field. Uses the standard 256-entry edge/triangle tables
 * (Paul Bourke tables).
 *
 * Input: Float32Array scalar field, N grid size, isovalue
 * Output: positions, normals, and vertexCount for rendering
 *
 * @module lib/solvers/marching-cubes
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarchingCubesResult {
  /** Flat array of vertex positions (x, y, z) triples */
  positions: Float32Array;
  /** Flat array of vertex normals (nx, ny, nz) triples */
  normals: Float32Array;
  /** Number of vertices (positions.length / 3) */
  vertexCount: number;
}

// ---------------------------------------------------------------------------
// Edge Table (256 entries)
// Each entry is a 12-bit bitmask indicating which edges are intersected
// by the isosurface for a given cube configuration.
// ---------------------------------------------------------------------------

/* prettier-ignore */
const EDGE_TABLE: Uint16Array = new Uint16Array([
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03,
  0xe09, 0xf00, 0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96,
  0xd9a, 0xc93, 0xf99, 0xe90, 0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35,
  0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30, 0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0, 0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f,
  0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60, 0x5f0, 0x4f9, 0x7f3, 0x6fa,
  0x1f6, 0xff, 0x3f5, 0x2fc, 0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 0x650, 0x759,
  0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc, 0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3,
  0x9c9, 0x8c0, 0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc, 0xcc, 0x1c5, 0x2cf, 0x3c6,
  0x4ca, 0x5c3, 0x6c9, 0x7c0, 0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x55,
  0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650, 0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0, 0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f,
  0xd65, 0xc6c, 0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460, 0xca0, 0xda9, 0xea3, 0xfaa,
  0x8a6, 0x9af, 0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0, 0xd30, 0xc39,
  0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393,
  0x99, 0x190, 0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406,
  0x30a, 0x203, 0x109, 0x0,
]);

// ---------------------------------------------------------------------------
// Triangle Table (256 x 16 entries)
// Each entry lists the edges that form triangles for a given configuration.
// -1 marks the end of the list.
// ---------------------------------------------------------------------------

/* prettier-ignore */
const TRI_TABLE: Int8Array[] = [
  new Int8Array([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 1, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 8, 3, 9, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 3, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 2, 10, 0, 2, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 8, 3, 2, 10, 8, 10, 9, 8, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 11, 2, 8, 11, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 9, 0, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 11, 2, 1, 9, 11, 9, 8, 11, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 10, 1, 11, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 10, 1, 0, 8, 10, 8, 11, 10, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 9, 0, 3, 11, 9, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 3, 0, 7, 3, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 1, 9, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 1, 9, 4, 7, 1, 7, 3, 1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 10, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 4, 7, 3, 0, 4, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 2, 10, 9, 0, 2, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4, -1, -1, -1, -1]),
  new Int8Array([8, 4, 7, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([11, 4, 7, 11, 2, 4, 2, 0, 4, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 0, 1, 8, 4, 7, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1, -1, -1, -1, -1]),
  new Int8Array([3, 10, 1, 3, 11, 10, 7, 8, 4, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4, -1, -1, -1, -1]),
  new Int8Array([4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3, -1, -1, -1, -1]),
  new Int8Array([4, 7, 11, 4, 11, 9, 9, 11, 10, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 5, 4, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 5, 4, 1, 5, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 5, 4, 8, 3, 5, 3, 1, 5, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 10, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 0, 8, 1, 2, 10, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 2, 10, 5, 4, 2, 4, 0, 2, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8, -1, -1, -1, -1]),
  new Int8Array([9, 5, 4, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 11, 2, 0, 8, 11, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 5, 4, 0, 1, 5, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5, -1, -1, -1, -1]),
  new Int8Array([10, 3, 11, 10, 1, 3, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10, -1, -1, -1, -1]),
  new Int8Array([5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3, -1, -1, -1, -1]),
  new Int8Array([5, 4, 8, 5, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 7, 8, 5, 7, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 3, 0, 9, 5, 3, 5, 7, 3, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 7, 8, 0, 1, 7, 1, 5, 7, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 7, 8, 9, 5, 7, 10, 1, 2, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3, -1, -1, -1, -1]),
  new Int8Array([8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2, -1, -1, -1, -1]),
  new Int8Array([2, 10, 5, 2, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([7, 9, 5, 7, 8, 9, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11, -1, -1, -1, -1]),
  new Int8Array([2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7, -1, -1, -1, -1]),
  new Int8Array([11, 2, 1, 11, 1, 7, 7, 1, 5, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11, -1, -1, -1, -1]),
  new Int8Array([5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0, -1]),
  new Int8Array([11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0, -1]),
  new Int8Array([11, 10, 5, 7, 11, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 3, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 0, 1, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 8, 3, 1, 9, 8, 5, 10, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 6, 5, 2, 6, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 6, 5, 1, 2, 6, 3, 0, 8, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 6, 5, 9, 0, 6, 0, 2, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8, -1, -1, -1, -1]),
  new Int8Array([2, 3, 11, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([11, 0, 8, 11, 2, 0, 10, 6, 5, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 1, 9, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11, -1, -1, -1, -1]),
  new Int8Array([6, 3, 11, 6, 5, 3, 5, 1, 3, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6, -1, -1, -1, -1]),
  new Int8Array([3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9, -1, -1, -1, -1]),
  new Int8Array([6, 5, 9, 6, 9, 11, 11, 9, 8, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 10, 6, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 3, 0, 4, 7, 3, 6, 5, 10, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 9, 0, 5, 10, 6, 8, 4, 7, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4, -1, -1, -1, -1]),
  new Int8Array([6, 1, 2, 6, 5, 1, 4, 7, 8, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7, -1, -1, -1, -1]),
  new Int8Array([8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6, -1, -1, -1, -1]),
  new Int8Array([7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9, -1]),
  new Int8Array([3, 11, 2, 7, 8, 4, 10, 6, 5, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11, -1, -1, -1, -1]),
  new Int8Array([0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1]),
  new Int8Array([9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6, -1]),
  new Int8Array([8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6, -1, -1, -1, -1]),
  new Int8Array([5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11, -1]),
  new Int8Array([0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7, -1]),
  new Int8Array([6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9, -1, -1, -1, -1]),
  new Int8Array([10, 4, 9, 6, 4, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 10, 6, 4, 9, 10, 0, 8, 3, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 0, 1, 10, 6, 0, 6, 4, 0, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10, -1, -1, -1, -1]),
  new Int8Array([1, 4, 9, 1, 2, 4, 2, 6, 4, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4, -1, -1, -1, -1]),
  new Int8Array([0, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 3, 2, 8, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 4, 9, 10, 6, 4, 11, 2, 3, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6, -1, -1, -1, -1]),
  new Int8Array([3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10, -1, -1, -1, -1]),
  new Int8Array([6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1, -1]),
  new Int8Array([9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3, -1, -1, -1, -1]),
  new Int8Array([8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1, -1]),
  new Int8Array([3, 11, 6, 3, 6, 0, 0, 6, 4, -1, -1, -1, -1, -1, -1]),
  new Int8Array([6, 4, 8, 11, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([7, 10, 6, 7, 8, 10, 8, 9, 10, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10, -1, -1, -1, -1]),
  new Int8Array([10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0, -1, -1, -1, -1]),
  new Int8Array([10, 6, 7, 10, 7, 1, 1, 7, 3, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7, -1, -1, -1, -1]),
  new Int8Array([2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9, -1]),
  new Int8Array([7, 8, 0, 7, 0, 6, 6, 0, 2, -1, -1, -1, -1, -1, -1]),
  new Int8Array([7, 3, 2, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7, -1, -1, -1, -1]),
  new Int8Array([2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7, -1]),
  new Int8Array([1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11, -1]),
  new Int8Array([11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1, -1, -1, -1, -1]),
  new Int8Array([8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6, -1]),
  new Int8Array([0, 9, 1, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0, -1, -1, -1, -1]),
  new Int8Array([7, 11, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 0, 8, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 1, 9, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 1, 9, 8, 3, 1, 11, 7, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 1, 2, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 10, 3, 0, 8, 6, 11, 7, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 9, 0, 2, 10, 9, 6, 11, 7, -1, -1, -1, -1, -1, -1]),
  new Int8Array([6, 11, 7, 2, 10, 3, 10, 8, 3, 10, 9, 8, -1, -1, -1, -1]),
  new Int8Array([7, 2, 3, 6, 2, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([7, 0, 8, 7, 6, 0, 6, 2, 0, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 7, 6, 2, 3, 7, 0, 1, 9, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6, -1, -1, -1, -1]),
  new Int8Array([10, 7, 6, 10, 1, 7, 1, 3, 7, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8, -1, -1, -1, -1]),
  new Int8Array([0, 3, 7, 0, 7, 10, 0, 10, 9, 6, 10, 7, -1, -1, -1, -1]),
  new Int8Array([7, 6, 10, 7, 10, 8, 8, 10, 9, -1, -1, -1, -1, -1, -1]),
  new Int8Array([6, 8, 4, 11, 8, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 6, 11, 3, 0, 6, 0, 4, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 6, 11, 8, 4, 6, 9, 0, 1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6, -1, -1, -1, -1]),
  new Int8Array([6, 8, 4, 6, 11, 8, 2, 10, 1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 10, 3, 0, 11, 0, 6, 11, 0, 4, 6, -1, -1, -1, -1]),
  new Int8Array([4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9, -1, -1, -1, -1]),
  new Int8Array([10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3, -1]),
  new Int8Array([8, 2, 3, 8, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8, -1, -1, -1, -1]),
  new Int8Array([1, 9, 4, 1, 4, 2, 2, 4, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 1, 3, 8, 6, 1, 8, 4, 6, 6, 10, 1, -1, -1, -1, -1]),
  new Int8Array([10, 1, 0, 10, 0, 6, 6, 0, 4, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3, -1]),
  new Int8Array([10, 9, 4, 6, 10, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 9, 5, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 3, 4, 9, 5, 11, 7, 6, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 0, 1, 5, 4, 0, 7, 6, 11, -1, -1, -1, -1, -1, -1]),
  new Int8Array([11, 7, 6, 8, 3, 4, 3, 5, 4, 3, 1, 5, -1, -1, -1, -1]),
  new Int8Array([9, 5, 4, 10, 1, 2, 7, 6, 11, -1, -1, -1, -1, -1, -1]),
  new Int8Array([6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5, -1, -1, -1, -1]),
  new Int8Array([7, 6, 11, 5, 4, 10, 4, 2, 10, 4, 0, 2, -1, -1, -1, -1]),
  new Int8Array([3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7, 6, -1]),
  new Int8Array([7, 2, 3, 7, 6, 2, 5, 4, 9, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 5, 4, 0, 8, 6, 0, 6, 2, 6, 8, 7, -1, -1, -1, -1]),
  new Int8Array([3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0, -1, -1, -1, -1]),
  new Int8Array([6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8, -1]),
  new Int8Array([9, 5, 4, 10, 1, 6, 1, 7, 6, 1, 3, 7, -1, -1, -1, -1]),
  new Int8Array([1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9, 5, 4, -1]),
  new Int8Array([4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10, -1]),
  new Int8Array([7, 6, 10, 7, 10, 8, 5, 4, 10, 4, 8, 10, -1, -1, -1, -1]),
  new Int8Array([6, 9, 5, 6, 11, 9, 11, 8, 9, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5, -1, -1, -1, -1]),
  new Int8Array([0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11, -1, -1, -1, -1]),
  new Int8Array([6, 11, 3, 6, 3, 5, 5, 3, 1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6, -1, -1, -1, -1]),
  new Int8Array([0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10, -1]),
  new Int8Array([11, 8, 5, 11, 5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5, -1]),
  new Int8Array([6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3, -1, -1, -1, -1]),
  new Int8Array([5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2, -1, -1, -1, -1]),
  new Int8Array([9, 5, 6, 9, 6, 0, 0, 6, 2, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8, 2, 6, 2, 8, -1]),
  new Int8Array([1, 5, 6, 2, 1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6, -1]),
  new Int8Array([10, 1, 0, 10, 0, 6, 9, 5, 0, 5, 6, 0, -1, -1, -1, -1]),
  new Int8Array([0, 3, 8, 5, 6, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 5, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([11, 5, 10, 7, 5, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([11, 5, 10, 11, 7, 5, 8, 3, 0, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 11, 7, 5, 10, 11, 1, 9, 0, -1, -1, -1, -1, -1, -1]),
  new Int8Array([10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1, -1, -1, -1, -1]),
  new Int8Array([11, 1, 2, 11, 7, 1, 7, 5, 1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 3, 1, 2, 7, 1, 7, 5, 7, 2, 11, -1, -1, -1, -1]),
  new Int8Array([9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7, -1, -1, -1, -1]),
  new Int8Array([7, 5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2, -1]),
  new Int8Array([2, 5, 10, 2, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5, -1, -1, -1, -1]),
  new Int8Array([9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2, -1, -1, -1, -1]),
  new Int8Array([9, 8, 2, 9, 2, 1, 8, 7, 2, 10, 2, 5, 7, 5, 2, -1]),
  new Int8Array([1, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 7, 0, 7, 1, 1, 7, 5, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 0, 3, 9, 3, 5, 5, 3, 7, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 8, 7, 5, 9, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 8, 4, 5, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1]),
  new Int8Array([5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0, -1, -1, -1, -1]),
  new Int8Array([0, 1, 9, 8, 4, 10, 8, 10, 11, 10, 4, 5, -1, -1, -1, -1]),
  new Int8Array([10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3, 1, 4, -1]),
  new Int8Array([2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8, -1, -1, -1, -1]),
  new Int8Array([0, 4, 11, 0, 11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11, -1]),
  new Int8Array([0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8, 11, 8, 5, -1]),
  new Int8Array([9, 4, 5, 2, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 5, 10, 3, 5, 2, 3, 4, 5, 3, 8, 4, -1, -1, -1, -1]),
  new Int8Array([5, 10, 2, 5, 2, 4, 4, 2, 0, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9, -1]),
  new Int8Array([5, 10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2, -1, -1, -1, -1]),
  new Int8Array([8, 4, 5, 8, 5, 3, 3, 5, 1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 4, 5, 1, 0, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5, -1, -1, -1, -1]),
  new Int8Array([9, 4, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 11, 7, 4, 9, 11, 9, 10, 11, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11, -1, -1, -1, -1]),
  new Int8Array([1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11, -1, -1, -1, -1]),
  new Int8Array([3, 1, 4, 3, 4, 8, 1, 10, 4, 7, 4, 11, 10, 11, 4, -1]),
  new Int8Array([4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2, -1, -1, -1, -1]),
  new Int8Array([9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3, -1]),
  new Int8Array([11, 7, 4, 11, 4, 2, 2, 4, 0, -1, -1, -1, -1, -1, -1]),
  new Int8Array([11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4, -1, -1, -1, -1]),
  new Int8Array([2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9, -1, -1, -1, -1]),
  new Int8Array([9, 10, 7, 9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7, -1]),
  new Int8Array([3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10, 0, 4, 0, 10, -1]),
  new Int8Array([1, 10, 2, 8, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 9, 1, 4, 1, 7, 7, 1, 3, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 9, 1, 4, 1, 7, 0, 8, 1, 8, 7, 1, -1, -1, -1, -1]),
  new Int8Array([4, 0, 3, 7, 4, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([4, 8, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 0, 9, 3, 9, 11, 11, 9, 10, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 1, 10, 0, 10, 8, 8, 10, 11, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 1, 10, 11, 3, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 2, 11, 1, 11, 9, 9, 11, 8, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 0, 9, 3, 9, 11, 1, 2, 9, 2, 11, 9, -1, -1, -1, -1]),
  new Int8Array([0, 2, 11, 8, 0, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 3, 8, 2, 8, 10, 10, 8, 9, -1, -1, -1, -1, -1, -1]),
  new Int8Array([9, 10, 2, 0, 9, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8, -1, -1, -1, -1]),
  new Int8Array([1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([1, 3, 8, 9, 1, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 9, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([0, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
  new Int8Array([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
];

// ---------------------------------------------------------------------------
// Edge vertex offsets
// The 12 edges of a cube: each edge connects two of the 8 cube vertices.
// Vertex numbering follows the Bourke convention:
//   0=(0,0,0) 1=(1,0,0) 2=(1,1,0) 3=(0,1,0)
//   4=(0,0,1) 5=(1,0,1) 6=(1,1,1) 7=(0,1,1)
// ---------------------------------------------------------------------------

const EDGE_VERTICES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** Vertex offsets (di, dj, dk) for the 8 corners of a unit cube */
const VERTEX_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

// ---------------------------------------------------------------------------
// Helper: linear interpolation of vertex position along an edge
// ---------------------------------------------------------------------------

function interpolateEdge(
  v1: readonly [number, number, number],
  v2: readonly [number, number, number],
  val1: number,
  val2: number,
  isovalue: number,
): [number, number, number] {
  if (Math.abs(val1 - val2) < 1e-10) {
    return [v1[0], v1[1], v1[2]];
  }
  const t = (isovalue - val1) / (val2 - val1);
  return [v1[0] + t * (v2[0] - v1[0]), v1[1] + t * (v2[1] - v1[1]), v1[2] + t * (v2[2] - v1[2])];
}

// ---------------------------------------------------------------------------
// Helper: compute normal via central differences
// ---------------------------------------------------------------------------

function computeNormal(
  field: Float32Array,
  N: number,
  i: number,
  j: number,
  k: number,
): [number, number, number] {
  const ip = Math.min(i + 1, N - 1);
  const im = Math.max(i - 1, 0);
  const jp = Math.min(j + 1, N - 1);
  const jm = Math.max(j - 1, 0);
  const kp = Math.min(k + 1, N - 1);
  const km = Math.max(k - 1, 0);

  const nx = field[im * N * N + j * N + k]! - field[ip * N * N + j * N + k]!;
  const ny = field[i * N * N + jm * N + k]! - field[i * N * N + jp * N + k]!;
  const nz = field[i * N * N + j * N + km]! - field[i * N * N + j * N + kp]!;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-10) return [0, 1, 0];
  return [nx / len, ny / len, nz / len];
}

// ---------------------------------------------------------------------------
// Main marching cubes function
// ---------------------------------------------------------------------------

/**
 * Extract an isosurface from a 3D scalar field using Marching Cubes.
 *
 * @param field  - Flat Float32Array of size N*N*N
 * @param N      - Grid size per dimension
 * @param isovalue - The scalar value of the isosurface
 * @returns Positions and normals as Float32Arrays, plus vertex count
 */
export function marchingCubes(
  field: Float32Array,
  N: number,
  isovalue: number,
): MarchingCubesResult {
  // Pre-allocate with a generous estimate.
  // Worst case: ~5 triangles per cell, 3 vertices per triangle, 3 components each.
  // We use a growing array approach with typed array at the end.
  const positionsList: number[] = [];
  const normalsList: number[] = [];

  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      for (let k = 0; k < N - 1; k++) {
        // Get scalar values at the 8 corners
        const values: number[] = new Array(8);
        for (let v = 0; v < 8; v++) {
          const off = VERTEX_OFFSETS[v]!;
          values[v] = field[(i + off[0]) * N * N + (j + off[1]) * N + (k + off[2])]!;
        }

        // Compute the cube index (which corners are inside the isosurface)
        let cubeIndex = 0;
        for (let v = 0; v < 8; v++) {
          if (values[v]! < isovalue) cubeIndex |= 1 << v;
        }

        // Skip if entirely inside or outside
        const edges = EDGE_TABLE[cubeIndex]!;
        if (edges === 0) continue;

        // Compute interpolated vertex positions for intersected edges
        const edgeVertices: Array<[number, number, number]> = new Array(12);

        for (let e = 0; e < 12; e++) {
          if (edges & (1 << e)) {
            const [v1idx, v2idx] = EDGE_VERTICES[e]!;
            const off1 = VERTEX_OFFSETS[v1idx]!;
            const off2 = VERTEX_OFFSETS[v2idx]!;

            edgeVertices[e] = interpolateEdge(
              [i + off1[0], j + off1[1], k + off1[2]],
              [i + off2[0], j + off2[1], k + off2[2]],
              values[v1idx]!,
              values[v2idx]!,
              isovalue,
            );
          }
        }

        // Generate triangles from the triangle table
        const triRow = TRI_TABLE[cubeIndex]!;
        for (let t = 0; t < 16; t += 3) {
          if (triRow[t]! === -1) break;

          for (let vi = 0; vi < 3; vi++) {
            const edgeIdx = triRow[t + vi]!;
            const vertex = edgeVertices[edgeIdx]!;
            positionsList.push(vertex[0], vertex[1], vertex[2]);

            // Compute normal at this vertex position via central differences
            const ni = Math.round(vertex[0]);
            const nj = Math.round(vertex[1]);
            const nk = Math.round(vertex[2]);
            const normal = computeNormal(
              field,
              N,
              Math.max(0, Math.min(N - 1, ni)),
              Math.max(0, Math.min(N - 1, nj)),
              Math.max(0, Math.min(N - 1, nk)),
            );
            normalsList.push(normal[0], normal[1], normal[2]);
          }
        }
      }
    }
  }

  const positions = new Float32Array(positionsList);
  const normals = new Float32Array(normalsList);

  return {
    positions,
    normals,
    vertexCount: positions.length / 3,
  };
}
