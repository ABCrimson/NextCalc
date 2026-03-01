/**
 * Regression Analysis Module
 *
 * Implements various regression models for fitting curves to data.
 * All regression functions return coefficients and R² (coefficient of determination).
 *
 * @module stats/regression
 */

import { mean } from './descriptive';

/**
 * Validates that x and y arrays are compatible for regression
 */
function validateRegressionData(x: number[], y: number[], functionName: string): void {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error(`${functionName}: x and y must be arrays`);
  }

  if (x.length === 0 || y.length === 0) {
    throw new Error(`${functionName}: Data arrays must be non-empty`);
  }

  if (x.length !== y.length) {
    throw new Error(`${functionName}: x and y arrays must have the same length`);
  }

  if (x.some((val) => !Number.isFinite(val)) || y.some((val) => !Number.isFinite(val))) {
    throw new Error(`${functionName}: Data arrays contain invalid values (NaN or Infinity)`);
  }

  if (x.length < 2) {
    throw new Error(`${functionName}: At least 2 data points are required`);
  }
}

/**
 * Calculates R² (coefficient of determination) for a regression model.
 *
 * R² measures the proportion of variance in the dependent variable
 * that is predictable from the independent variable(s).
 * Values range from 0 (no fit) to 1 (perfect fit).
 *
 * @param yActual - Actual y values
 * @param yPredicted - Predicted y values
 * @returns R² value
 */
function calculateR2(yActual: number[], yPredicted: number[]): number {
  const yMean = mean(yActual);

  // Total sum of squares (TSS)
  let tss = 0;
  for (const y of yActual) {
    tss += (y - yMean) ** 2;
  }

  // Residual sum of squares (RSS)
  let rss = 0;
  for (let i = 0; i < yActual.length; i++) {
    const actual = yActual[i];
    const predicted = yPredicted[i];
    if (actual === undefined || predicted === undefined) continue;
    rss += (actual - predicted) ** 2;
  }

  // R² = 1 - (RSS / TSS)
  return tss === 0 ? 0 : 1 - rss / tss;
}

/**
 * Result of linear regression analysis
 */
export interface LinearRegressionResult {
  /** Slope of the line (m in y = mx + b) */
  slope: number;
  /** Y-intercept (b in y = mx + b) */
  intercept: number;
  /** Coefficient of determination (0 to 1) */
  r2: number;
}

/**
 * Performs simple linear regression (least squares fit).
 *
 * Fits the model: y = slope * x + intercept
 * Uses the least squares method to minimize residual sum of squares.
 *
 * @param x - Independent variable values
 * @param y - Dependent variable values
 * @returns Linear regression coefficients and R²
 * @throws {Error} If data is invalid or insufficient
 *
 * @example
 * linearRegression([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])
 * // { slope: 0.6, intercept: 2.2, r2: 0.47 }
 */
export function linearRegression(x: number[], y: number[]): LinearRegressionResult {
  validateRegressionData(x, y, 'linearRegression');

  const n = x.length;
  const xMean = mean(x);
  const yMean = mean(y);

  // Calculate slope using the least squares formula
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xVal = x[i];
    const yVal = y[i];
    if (xVal === undefined || yVal === undefined) continue;
    const xDiff = xVal - xMean;
    const yDiff = yVal - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  if (Math.abs(denominator) < 1e-10) {
    throw new Error('linearRegression: All x values are identical (vertical line)');
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R²
  const yPredicted = x.map((xi) => slope * xi + intercept);
  const r2 = calculateR2(y, yPredicted);

  return { slope, intercept, r2 };
}

/**
 * Result of polynomial regression analysis
 */
export interface PolynomialRegressionResult {
  /** Polynomial coefficients [a0, a1, a2, ...] where y = a0 + a1*x + a2*x² + ... */
  coefficients: number[];
  /** Coefficient of determination (0 to 1) */
  r2: number;
}

/**
 * Performs polynomial regression using least squares.
 *
 * Fits a polynomial of specified degree: y = a0 + a1*x + a2*x² + ... + an*x^n
 * Uses normal equations to solve the least squares problem.
 *
 * @param x - Independent variable values
 * @param y - Dependent variable values
 * @param degree - Degree of polynomial (must be >= 1 and < data length)
 * @returns Polynomial coefficients (lowest to highest degree) and R²
 * @throws {Error} If data is invalid or degree is inappropriate
 *
 * @example
 * polynomialRegression([1, 2, 3, 4, 5], [1, 4, 9, 16, 25], 2)
 * // Fits y = x², returns coefficients [0, 0, 1] and high R²
 */
export function polynomialRegression(
  x: number[],
  y: number[],
  degree: number,
): PolynomialRegressionResult {
  validateRegressionData(x, y, 'polynomialRegression');

  if (!Number.isInteger(degree) || degree < 1) {
    throw new Error('polynomialRegression: Degree must be a positive integer');
  }

  if (degree >= x.length) {
    throw new Error('polynomialRegression: Degree must be less than number of data points');
  }

  const n = x.length;

  // Build the Vandermonde matrix and solve using normal equations
  // X^T * X * coeffs = X^T * y

  // Create matrix X where X[i][j] = x[i]^j
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X[i] = [];
    const xVal = x[i];
    if (xVal === undefined) continue;
    const row = X[i];
    if (!row) continue;
    for (let j = 0; j <= degree; j++) {
      row[j] = xVal ** j;
    }
  }

  // Compute X^T * X (gram matrix)
  const XtX: number[][] = [];
  for (let i = 0; i <= degree; i++) {
    XtX[i] = [];
    for (let j = 0; j <= degree; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        const xRow = X[k];
        if (!xRow) continue;
        const xki = xRow[i];
        const xkj = xRow[j];
        if (xki !== undefined && xkj !== undefined) {
          sum += xki * xkj;
        }
      }
      const row = XtX[i];
      if (row) {
        row[j] = sum;
      }
    }
  }

  // Compute X^T * y
  const Xty: number[] = [];
  for (let i = 0; i <= degree; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const xRow = X[k];
      const yVal = y[k];
      if (!xRow || yVal === undefined) continue;
      const xki = xRow[i];
      if (xki !== undefined) {
        sum += xki * yVal;
      }
    }
    Xty[i] = sum;
  }

  // Solve the system using Gaussian elimination
  const coefficients = solveLinearSystem(XtX, Xty);

  // Calculate R²
  const yPredicted = x.map((xi) => {
    let yPred = 0;
    for (let j = 0; j <= degree; j++) {
      const coeff = coefficients[j];
      if (coeff !== undefined) {
        yPred += coeff * xi ** j;
      }
    }
    return yPred;
  });

  const r2 = calculateR2(y, yPredicted);

  return { coefficients, r2 };
}

/**
 * Solves a linear system Ax = b using Gaussian elimination with partial pivoting.
 *
 * @param A - Coefficient matrix (will not be modified)
 * @param b - Right-hand side vector (will not be modified)
 * @returns Solution vector x
 * @throws {Error} If system is singular or incompatible
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;

  // Create augmented matrix [A|b] by copying to avoid mutation
  const aug: number[][] = A.map((row, i) => {
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
      throw new Error('solveLinearSystem: Matrix is singular or nearly singular');
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

/**
 * Result of exponential regression analysis
 */
export interface ExponentialRegressionResult {
  /** Coefficient a in y = a * e^(b*x) */
  a: number;
  /** Coefficient b in y = a * e^(b*x) */
  b: number;
  /** Coefficient of determination (0 to 1) */
  r2: number;
}

/**
 * Performs exponential regression.
 *
 * Fits the model: y = a * e^(b*x)
 * Uses logarithmic transformation and linear regression on ln(y) vs x.
 *
 * @param x - Independent variable values
 * @param y - Dependent variable values (must be positive)
 * @returns Exponential regression coefficients and R²
 * @throws {Error} If data is invalid or y values are non-positive
 *
 * @example
 * exponentialRegression([0, 1, 2, 3], [1, 2.7, 7.4, 20.1])
 * // Approximates y = e^x, returns { a: ~1, b: ~1, r2: ~0.99 }
 */
export function exponentialRegression(x: number[], y: number[]): ExponentialRegressionResult {
  validateRegressionData(x, y, 'exponentialRegression');

  // Check that all y values are positive
  if (y.some((yi) => yi <= 0)) {
    throw new Error('exponentialRegression: All y values must be positive');
  }

  // Transform to linear: ln(y) = ln(a) + b*x
  const lnY = y.map((yi) => Math.log(yi));

  // Perform linear regression on ln(y) vs x
  const linearResult = linearRegression(x, lnY);

  // Convert back to exponential form
  const a = Math.exp(linearResult.intercept);
  const b = linearResult.slope;

  // Calculate R² in original space (not transformed)
  const yPredicted = x.map((xi) => a * Math.exp(b * xi));
  const r2 = calculateR2(y, yPredicted);

  return { a, b, r2 };
}

/**
 * Predicts y value(s) from a regression model.
 *
 * @param regression - Regression result from linearRegression, polynomialRegression, or exponentialRegression
 * @param x - X value(s) to predict at
 * @returns Predicted y value(s)
 *
 * @example
 * const model = linearRegression([1, 2, 3], [2, 4, 6]);
 * predict(model, 4); // ~8
 * predict(model, [4, 5]); // [~8, ~10]
 */
export function predict(
  regression: LinearRegressionResult | PolynomialRegressionResult | ExponentialRegressionResult,
  x: number | number[],
): number | number[] {
  const predictSingle = (xi: number): number => {
    if ('slope' in regression) {
      // Linear regression
      return regression.slope * xi + regression.intercept;
    } else if ('coefficients' in regression) {
      // Polynomial regression
      let result = 0;
      for (let i = 0; i < regression.coefficients.length; i++) {
        const coeff = regression.coefficients[i];
        if (coeff !== undefined) {
          result += coeff * xi ** i;
        }
      }
      return result;
    } else if ('a' in regression && 'b' in regression) {
      // Exponential regression
      return regression.a * Math.exp(regression.b * xi);
    } else {
      throw new Error('predict: Unknown regression type');
    }
  };

  if (Array.isArray(x)) {
    return x.map(predictSingle);
  } else {
    return predictSingle(x);
  }
}
