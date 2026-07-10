/**
 * Linear System Solver
 *
 * Standalone Gaussian elimination with partial pivoting for solving Ax = b.
 * This is deliberately separate from the {@link Matrix} class: it operates on
 * plain `number[][]`/`number[]` (no Matrix allocation overhead) and is the
 * canonical implementation shared by callers that need to solve a linear
 * system directly (e.g. polynomial regression's normal equations) without
 * going through Matrix.gaussJordanInverse, which solves a different shape
 * of problem (full matrix inversion via an augmented [A | I] matrix).
 *
 * @module matrix/linear-system
 */

/**
 * Solves a linear system Ax = b using Gaussian elimination with partial pivoting.
 *
 * @param a - Coefficient matrix (not modified)
 * @param b - Right-hand side vector (not modified)
 * @returns Solution vector x, or null if the system is singular or nearly singular
 *
 * @example
 * solveLinearSystem([[2, 1], [1, 3]], [3, 5]); // [0.8, 1.4]
 * solveLinearSystem([[1, 1], [1, 1]], [1, 2]); // null (singular)
 */
export function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = a.length;

  // Create augmented matrix [A|b] by copying to avoid mutating the inputs
  const aug: number[][] = a.map((row, i) => {
    const bVal = b[i];
    if (bVal === undefined) {
      throw new Error('solveLinearSystem: Invalid b vector');
    }
    return [...row, bVal];
  });

  // Forward elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      const kRow = aug[k];
      const maxRowData = aug[maxRow];
      if (kRow && maxRowData) {
        const kVal = kRow[i];
        const maxVal = maxRowData[i];
        if (kVal !== undefined && maxVal !== undefined && Math.abs(kVal) > Math.abs(maxVal)) {
          maxRow = k;
        }
      }
    }

    // Swap rows
    const iRow = aug[i];
    const maxRowData = aug[maxRow];
    if (!iRow || !maxRowData) {
      throw new Error('solveLinearSystem: Invalid matrix row');
    }
    [aug[i], aug[maxRow]] = [maxRowData, iRow];

    // Check for singular matrix
    const currentRow = aug[i];
    if (!currentRow) {
      throw new Error('solveLinearSystem: Invalid matrix row');
    }
    const pivotVal = currentRow[i];
    if (pivotVal === undefined || Math.abs(pivotVal) < 1e-10) {
      return null; // Singular or nearly singular
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const kRow = aug[k];
      if (!kRow) continue;
      const kVal = kRow[i];
      if (kVal === undefined) continue;
      const factor = kVal / pivotVal;
      for (let j = i; j <= n; j++) {
        const kRowVal = kRow[j];
        const iRowVal = currentRow[j];
        if (kRowVal !== undefined && iRowVal !== undefined) {
          kRow[j] = kRowVal - factor * iRowVal;
        }
      }
    }
  }

  // Back substitution
  const x: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const iRow = aug[i];
    if (!iRow) {
      throw new Error('solveLinearSystem: Invalid matrix row during back substitution');
    }
    const sumStart = iRow[n];
    if (sumStart === undefined) {
      throw new Error('solveLinearSystem: Invalid augmented column');
    }
    let sum = sumStart;
    for (let j = i + 1; j < n; j++) {
      const iRowVal = iRow[j];
      const xVal = x[j];
      if (iRowVal !== undefined && xVal !== undefined) {
        sum -= iRowVal * xVal;
      }
    }
    const pivotVal = iRow[i];
    if (pivotVal === undefined) {
      throw new Error('solveLinearSystem: Invalid pivot during back substitution');
    }
    x[i] = sum / pivotVal;
  }

  return x;
}
