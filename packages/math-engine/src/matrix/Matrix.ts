/**
 * Immutable Matrix class with type safety
 * Follows numpy-style API for familiarity
 *
 * @example
 * const m = new Matrix([[1, 2], [3, 4]]);
 * const inv = m.inverse();
 * const det = m.determinant();
 */

/**
 * Matrix class with immutable operations
 */
export class Matrix {
  private readonly data: number[][];
  readonly rows: number;
  readonly cols: number;

  constructor(data: number[][] | number, cols?: number) {
    if (typeof data === 'number') {
      // Create zero matrix: new Matrix(3, 4) → 3x4 zero matrix
      this.rows = data;
      this.cols = cols ?? data;
      this.data = Array(this.rows)
        .fill(0)
        .map(() => Array(this.cols).fill(0));
    } else {
      this.data = data.map((row) => [...row]); // Deep copy
      this.rows = data.length;
      this.cols = data[0]?.length ?? 0;
      this.validate();
    }
  }

  private validate(): void {
    if (this.rows === 0 || this.cols === 0) {
      throw new Error('Matrix cannot be empty');
    }
    // Check all rows have same length
    if (!this.data.every((row) => row.length === this.cols)) {
      throw new Error('All rows must have the same length');
    }
  }

  // Accessors
  get(row: number, col: number): number {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds: (${row}, ${col})`);
    }
    const rowData = this.data[row];
    if (!rowData) {
      throw new Error(`Row ${row} is undefined`);
    }
    const value = rowData[col];
    if (value === undefined) {
      throw new Error(`Column ${col} is undefined in row ${row}`);
    }
    return value;
  }

  set(row: number, col: number, value: number): Matrix {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds: (${row}, ${col})`);
    }
    const newData = this.data.map((r) => [...r]);
    const targetRow = newData[row];
    if (!targetRow) {
      throw new Error(`Row ${row} is undefined`);
    }
    targetRow[col] = value;
    return new Matrix(newData);
  }

  // Matrix Operations
  add(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error(
        `Cannot add matrices with different dimensions: ${this.rows}x${this.cols} and ${other.rows}x${other.cols}`,
      );
    }

    const result = this.data.map((row, i) => row.map((val, j) => val + other.get(i, j)));

    return new Matrix(result);
  }

  subtract(other: Matrix): Matrix {
    return this.add(other.scale(-1));
  }

  scale(scalar: number): Matrix {
    const result = this.data.map((row) => row.map((val) => val * scalar));
    return new Matrix(result);
  }

  multiply(other: Matrix): Matrix {
    if (this.cols !== other.rows) {
      throw new Error(
        `Cannot multiply ${this.rows}x${this.cols} matrix by ${other.rows}x${other.cols} matrix`,
      );
    }

    const result: number[][] = [];

    for (let i = 0; i < this.rows; i++) {
      result[i] = [];
      const currentRow = result[i];
      if (!currentRow) continue;
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.get(i, k) * other.get(k, j);
        }
        currentRow[j] = sum;
      }
    }

    return new Matrix(result);
  }

  transpose(): Matrix {
    const result: number[][] = Array(this.cols)
      .fill(0)
      .map(() => Array(this.rows).fill(0));

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const row = result[j];
        if (row) {
          row[i] = this.get(i, j);
        }
      }
    }

    return new Matrix(result);
  }

  determinant(): number {
    if (this.rows !== this.cols) {
      throw new Error('Determinant only defined for square matrices');
    }

    if (this.rows === 1) {
      return this.get(0, 0);
    }

    if (this.rows === 2) {
      return this.get(0, 0) * this.get(1, 1) - this.get(0, 1) * this.get(1, 0);
    }

    // Use LU decomposition for larger matrices
    return this.luDecomposition().determinant;
  }

  inverse(): Matrix {
    if (this.rows !== this.cols) {
      throw new Error('Inverse only defined for square matrices');
    }

    const det = this.determinant();
    if (Math.abs(det) < 1e-10) {
      throw new Error('Matrix is singular (determinant ≈ 0)');
    }

    // Gauss-Jordan elimination
    return this.gaussJordanInverse();
  }

  private gaussJordanInverse(): Matrix {
    const n = this.rows;
    // Create augmented matrix [A | I]
    const augmented = this.data.map((row, i) => [
      ...row,
      ...Array(n)
        .fill(0)
        .map((_, j) => (i === j ? 1 : 0)),
    ]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        const kRow = augmented[k];
        const maxRowData = augmented[maxRow];
        if (kRow && maxRowData) {
          const kVal = kRow[i];
          const maxVal = maxRowData[i];
          if (kVal !== undefined && maxVal !== undefined && Math.abs(kVal) > Math.abs(maxVal)) {
            maxRow = k;
          }
        }
      }

      // Swap rows
      const tempRow = augmented[i];
      const maxRowData = augmented[maxRow];
      if (!tempRow || !maxRowData) {
        throw new Error('Matrix row is undefined during swap');
      }
      [augmented[i], augmented[maxRow]] = [maxRowData, tempRow];

      // Check for singular matrix
      const currentRow = augmented[i];
      if (!currentRow) {
        throw new Error('Matrix row is undefined');
      }
      const pivotValue = currentRow[i];
      if (pivotValue === undefined || Math.abs(pivotValue) < 1e-10) {
        throw new Error('Matrix is singular (cannot invert)');
      }

      // Scale pivot row
      const pivot = pivotValue;
      for (let j = 0; j < 2 * n; j++) {
        const val = currentRow[j];
        if (val !== undefined) {
          currentRow[j] = val / pivot;
        }
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const kRow = augmented[k];
          if (!kRow) continue;
          const factor = kRow[i];
          if (factor === undefined) continue;
          for (let j = 0; j < 2 * n; j++) {
            const kVal = kRow[j];
            const iVal = currentRow[j];
            if (kVal !== undefined && iVal !== undefined) {
              kRow[j] = kVal - factor * iVal;
            }
          }
        }
      }
    }

    // Extract inverse from right half
    const inverse = augmented.map((row) => row.slice(n));
    return new Matrix(inverse);
  }

  private luDecomposition(): { L: Matrix; U: Matrix; P: Matrix; determinant: number } {
    const n = this.rows;
    const L = Matrix.identity(n);
    let U = new Matrix(this.data);
    const P = Matrix.identity(n);

    let det = 1;

    for (let k = 0; k < n; k++) {
      // Find pivot
      let maxRow = k;
      let maxVal = Math.abs(U.get(k, k));

      for (let i = k + 1; i < n; i++) {
        const val = Math.abs(U.get(i, k));
        if (val > maxVal) {
          maxVal = val;
          maxRow = i;
        }
      }

      if (maxVal < 1e-10) {
        // Singular matrix
        return { L, U, P, determinant: 0 };
      }

      // Swap rows in U and P if needed
      if (maxRow !== k) {
        det = -det; // Sign change for row swap
        // Swap rows in U
        for (let j = 0; j < n; j++) {
          const temp = U.get(k, j);
          U = U.set(k, j, U.get(maxRow, j));
          U = U.set(maxRow, j, temp);
        }
      }

      det *= U.get(k, k);

      // Elimination
      for (let i = k + 1; i < n; i++) {
        const factor = U.get(i, k) / U.get(k, k);
        for (let j = k; j < n; j++) {
          U = U.set(i, j, U.get(i, j) - factor * U.get(k, j));
        }
      }
    }

    return { L, U, P, determinant: det };
  }

  // Static factory methods
  static identity(n: number): Matrix {
    const data = Array(n)
      .fill(0)
      .map((_, i) =>
        Array(n)
          .fill(0)
          .map((_, j) => (i === j ? 1 : 0)),
      );
    return new Matrix(data);
  }

  static zeros(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols);
  }

  static ones(rows: number, cols: number): Matrix {
    const data = Array(rows)
      .fill(0)
      .map(() => Array(cols).fill(1));
    return new Matrix(data);
  }

  static random(rows: number, cols: number, min = 0, max = 1): Matrix {
    const data = Array(rows)
      .fill(0)
      .map(() =>
        Array(cols)
          .fill(0)
          .map(() => min + Math.random() * (max - min)),
      );
    return new Matrix(data);
  }

  // Utility methods
  toString(): string {
    return this.data.map((row) => row.map((v) => v.toFixed(4)).join('\t')).join('\n');
  }

  toLatex(): string {
    const rows = this.data.map((row) => row.join(' & ')).join(' \\\\ ');
    return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
  }

  toArray(): number[][] {
    return this.data.map((row) => [...row]);
  }

  equals(other: Matrix, tolerance = 1e-10): boolean {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      return false;
    }

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (Math.abs(this.get(i, j) - other.get(i, j)) > tolerance) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Trace - Sum of diagonal elements
   * Only defined for square matrices
   */
  trace(): number {
    if (this.rows !== this.cols) {
      throw new Error('Trace only defined for square matrices');
    }

    let sum = 0;
    for (let i = 0; i < this.rows; i++) {
      sum += this.get(i, i);
    }
    return sum;
  }

  /**
   * Rank - Number of linearly independent rows/columns
   * Uses row echelon form to count non-zero rows
   */
  rank(tolerance = 1e-10): number {
    const rref = this.rowEchelonForm();
    let rank = 0;

    for (let i = 0; i < rref.rows; i++) {
      let isNonZero = false;
      for (let j = 0; j < rref.cols; j++) {
        if (Math.abs(rref.get(i, j)) > tolerance) {
          isNonZero = true;
          break;
        }
      }
      if (isNonZero) rank++;
    }

    return rank;
  }

  /**
   * Convert matrix to row echelon form (for rank calculation)
   */
  private rowEchelonForm(): Matrix {
    let result = new Matrix(this.data);
    let lead = 0;

    for (let r = 0; r < this.rows; r++) {
      if (lead >= this.cols) break;

      // Find pivot
      let i = r;
      while (Math.abs(result.get(i, lead)) < 1e-10) {
        i++;
        if (i === this.rows) {
          i = r;
          lead++;
          if (lead === this.cols) break;
        }
      }

      if (lead === this.cols) break;

      // Swap rows
      if (i !== r) {
        for (let j = 0; j < this.cols; j++) {
          const temp = result.get(r, j);
          result = result.set(r, j, result.get(i, j));
          result = result.set(i, j, temp);
        }
      }

      // Scale pivot row
      const pivot = result.get(r, lead);
      if (Math.abs(pivot) > 1e-10) {
        for (let j = 0; j < this.cols; j++) {
          result = result.set(r, j, result.get(r, j) / pivot);
        }

        // Eliminate below
        for (let i = r + 1; i < this.rows; i++) {
          const factor = result.get(i, lead);
          for (let j = 0; j < this.cols; j++) {
            result = result.set(i, j, result.get(i, j) - factor * result.get(r, j));
          }
        }
      }

      lead++;
    }

    return result;
  }

  /**
   * Frobenius norm (square root of sum of squares of all elements)
   */
  frobeniusNorm(): number {
    let sum = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const val = this.get(i, j);
        sum += val * val;
      }
    }
    return Math.sqrt(sum);
  }

  /**
   * Condition number - ratio of largest to smallest singular value
   * Approximated using norm of matrix and its inverse
   */
  conditionNumber(): number {
    if (this.rows !== this.cols) {
      throw new Error('Condition number only defined for square matrices');
    }

    try {
      const inv = this.inverse();
      return this.frobeniusNorm() * inv.frobeniusNorm();
    } catch (e) {
      return Infinity; // Singular matrix has infinite condition number
    }
  }

  /**
   * QR Decomposition using Gram-Schmidt orthogonalization
   * Returns Q (orthogonal) and R (upper triangular) where A = QR
   */
  qrDecomposition(): { Q: Matrix; R: Matrix } {
    const m = this.rows;
    const n = this.cols;

    // Extract columns as vectors
    const columns: number[][] = [];
    for (let j = 0; j < n; j++) {
      const col: number[] = [];
      for (let i = 0; i < m; i++) {
        col.push(this.get(i, j));
      }
      columns.push(col);
    }

    // Gram-Schmidt process
    const orthonormal: number[][] = [];
    const rData: number[][] = Array(n)
      .fill(0)
      .map(() => Array(n).fill(0));

    for (let j = 0; j < n; j++) {
      let v = [...columns[j]!];

      // Subtract projections onto previous orthonormal vectors
      for (let i = 0; i < j; i++) {
        const u = orthonormal[i]!;
        const rRow = rData[i]!;
        const dotProduct = v.reduce((sum, val, k) => sum + val * u[k]!, 0);
        rRow[j] = dotProduct;

        // v = v - (v·u)u
        v = v.map((val, k) => val - dotProduct * u[k]!);
      }

      // Normalize
      const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));

      if (norm < 1e-10) {
        // Linearly dependent column, use zero vector
        orthonormal.push(Array(m).fill(0));
        const rRow = rData[j]!;
        rRow[j] = 0;
      } else {
        orthonormal.push(v.map((val) => val / norm));
        const rRow = rData[j]!;
        rRow[j] = norm;
      }
    }

    // Build Q matrix (columns are orthonormal vectors)
    const qData: number[][] = Array(m)
      .fill(0)
      .map(() => Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const col = orthonormal[j];
        if (col) {
          qData[i]![j] = col[i] ?? 0;
        }
      }
    }

    return {
      Q: new Matrix(qData),
      R: new Matrix(rData),
    };
  }

  /**
   * Compute dominant eigenvalue and eigenvector using power iteration
   * Returns { eigenvalue, eigenvector } for the largest eigenvalue
   */
  powerIteration(
    maxIterations = 100,
    tolerance = 1e-10,
  ): { eigenvalue: number; eigenvector: Matrix } {
    if (this.rows !== this.cols) {
      throw new Error('Eigenvalues only defined for square matrices');
    }

    const n = this.rows;

    // Start with random vector
    let v = Matrix.random(n, 1, -1, 1);

    // Normalize
    let norm = v.frobeniusNorm();
    v = v.scale(1 / norm);

    let eigenvalue = 0;
    let prevEigenvalue = 0;

    for (let iter = 0; iter < maxIterations; iter++) {
      // v_new = A * v
      const vNew = this.multiply(v);

      // Compute eigenvalue (Rayleigh quotient)
      eigenvalue = vNew.transpose().multiply(v).get(0, 0);

      // Normalize
      norm = vNew.frobeniusNorm();
      if (norm < tolerance) break;

      v = vNew.scale(1 / norm);

      // Check convergence
      if (Math.abs(eigenvalue - prevEigenvalue) < tolerance) {
        break;
      }

      prevEigenvalue = eigenvalue;
    }

    return { eigenvalue, eigenvector: v };
  }

  /**
   * LU Decomposition (public method)
   * Returns L (lower triangular), U (upper triangular), P (permutation)
   */
  lu(): { L: Matrix; U: Matrix; P: Matrix; determinant: number } {
    return this.luDecomposition();
  }

  /**
   * Nullspace (kernel) of the matrix
   * Returns basis vectors that span the nullspace
   */
  nullspace(tolerance = 1e-10): Matrix[] {
    // Use RREF to find free variables
    const rref = this.reducedRowEchelonForm();
    const pivotCols: number[] = [];
    const freeCols: number[] = [];

    // Identify pivot and free columns
    for (let i = 0; i < rref.rows; i++) {
      for (let j = 0; j < rref.cols; j++) {
        if (Math.abs(rref.get(i, j)) > tolerance) {
          pivotCols.push(j);
          break;
        }
      }
    }

    for (let j = 0; j < rref.cols; j++) {
      if (!pivotCols.includes(j)) {
        freeCols.push(j);
      }
    }

    // Build nullspace basis vectors
    const basis: Matrix[] = [];
    for (const freeCol of freeCols) {
      const vec = Array(rref.cols).fill(0);
      vec[freeCol] = 1;

      // Back-substitute to find dependent variables
      for (let i = pivotCols.length - 1; i >= 0; i--) {
        const pivotCol = pivotCols[i];
        if (pivotCol === undefined) continue;

        let sum = 0;
        for (let j = pivotCol + 1; j < rref.cols; j++) {
          sum += rref.get(i, j) * vec[j]!;
        }
        vec[pivotCol] = -sum;
      }

      basis.push(new Matrix([vec]).transpose());
    }

    return basis;
  }

  /**
   * Column space (range) of the matrix
   * Returns basis vectors that span the column space
   */
  columnSpace(tolerance = 1e-10): Matrix[] {
    const rref = this.rowEchelonForm();
    const pivotCols: number[] = [];

    // Find pivot columns
    for (let i = 0; i < rref.rows; i++) {
      for (let j = 0; j < rref.cols; j++) {
        if (Math.abs(rref.get(i, j)) > tolerance) {
          pivotCols.push(j);
          break;
        }
      }
    }

    // Extract corresponding columns from original matrix
    const basis: Matrix[] = [];
    for (const col of pivotCols) {
      const colData: number[] = [];
      for (let i = 0; i < this.rows; i++) {
        colData.push(this.get(i, col));
      }
      basis.push(new Matrix([colData]).transpose());
    }

    return basis;
  }

  /**
   * Reduced Row Echelon Form (RREF)
   * Used for solving systems and finding nullspace
   */
  private reducedRowEchelonForm(): Matrix {
    let result = this.rowEchelonForm();

    // Back substitution to make leading entries the only non-zero in their columns
    for (let i = result.rows - 1; i >= 0; i--) {
      // Find leading entry
      let leadCol = -1;
      for (let j = 0; j < result.cols; j++) {
        if (Math.abs(result.get(i, j)) > 1e-10) {
          leadCol = j;
          break;
        }
      }

      if (leadCol === -1) continue;

      // Eliminate above
      for (let k = 0; k < i; k++) {
        const factor = result.get(k, leadCol);
        for (let j = 0; j < result.cols; j++) {
          result = result.set(k, j, result.get(k, j) - factor * result.get(i, j));
        }
      }
    }

    return result;
  }

  /**
   * Least squares solution to Ax = b
   * Returns x that minimizes ||Ax - b||²
   * Uses normal equations: x = (A^T A)^(-1) A^T b
   */
  leastSquares(b: Matrix): Matrix {
    if (this.rows !== b.rows || b.cols !== 1) {
      throw new Error(
        `Incompatible dimensions for least squares: A is ${this.rows}×${this.cols}, b is ${b.rows}×${b.cols}`,
      );
    }

    // Compute A^T A
    const AtA = this.transpose().multiply(this);

    // Compute A^T b
    const Atb = this.transpose().multiply(b);

    // Solve (A^T A)x = A^T b
    try {
      return AtA.inverse().multiply(Atb);
    } catch (e) {
      throw new Error('Least squares solution failed: A^T A is singular');
    }
  }

  /**
   * Gram-Schmidt orthogonalization for a set of column vectors
   * Returns orthonormal basis
   */
  gramSchmidt(): Matrix {
    const { Q } = this.qrDecomposition();
    return Q;
  }

  /**
   * Project vector b onto column space of this matrix
   */
  project(b: Matrix): Matrix {
    if (this.rows !== b.rows || b.cols !== 1) {
      throw new Error(`Incompatible dimensions for projection`);
    }

    // Projection matrix: P = A(A^T A)^(-1)A^T
    try {
      const At = this.transpose();
      const AtA = At.multiply(this);
      const AtA_inv = AtA.inverse();
      const P = this.multiply(AtA_inv).multiply(At);
      return P.multiply(b);
    } catch (e) {
      throw new Error('Projection failed: columns are linearly dependent');
    }
  }
}

// Export convenience functions
export function matrix(data: number[][]): Matrix {
  return new Matrix(data);
}

export function det(m: Matrix): number {
  return m.determinant();
}

export function inv(m: Matrix): Matrix {
  return m.inverse();
}

export function transpose(m: Matrix): Matrix {
  return m.transpose();
}
