/**
 * Correlation and Covariance Module
 *
 * Provides functions for measuring relationships between variables.
 * All functions are pure and immutable.
 *
 * @module stats/correlation
 */

import { mean } from './descriptive';

/**
 * Validates that x and y arrays are compatible for correlation/covariance
 */
function validatePairedData(x: number[], y: number[], functionName: string): void {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error(`${functionName}: x and y must be arrays`);
  }

  if (x.length === 0 || y.length === 0) {
    throw new Error(`${functionName}: Data arrays must be non-empty`);
  }

  if (x.length !== y.length) {
    throw new Error(`${functionName}: x and y arrays must have the same length`);
  }

  if (x.some(val => !Number.isFinite(val)) || y.some(val => !Number.isFinite(val))) {
    throw new Error(`${functionName}: Data arrays contain invalid values (NaN or Infinity)`);
  }
}

/**
 * Calculates the covariance between two datasets.
 *
 * Covariance measures the joint variability of two random variables.
 * Positive covariance indicates variables tend to move together.
 * Negative covariance indicates they move in opposite directions.
 *
 * @param x - First dataset
 * @param y - Second dataset
 * @param sample - If true, uses sample covariance (n-1 denominator); if false, uses population covariance (n denominator)
 * @returns The covariance between x and y
 * @throws {Error} If data is invalid or incompatible
 *
 * @example
 * covariance([1, 2, 3, 4, 5], [2, 4, 5, 4, 5], true) // 1.5
 */
export function covariance(x: number[], y: number[], sample = true): number {
  validatePairedData(x, y, 'covariance');

  if (sample && x.length === 1) {
    throw new Error('covariance: Sample covariance requires at least 2 data points');
  }

  const n = x.length;
  const xMean = mean(x);
  const yMean = mean(y);

  // Calculate sum of products of deviations
  let sumProduct = 0;
  let compensation = 0;

  for (let i = 0; i < n; i++) {
    const xVal = x[i];
    const yVal = y[i];
    if (xVal === undefined || yVal === undefined) continue;
    const product = (xVal - xMean) * (yVal - yMean);
    const y_val = product - compensation;
    const temp = sumProduct + y_val;
    compensation = (temp - sumProduct) - y_val;
    sumProduct = temp;
  }

  const divisor = sample ? n - 1 : n;
  return sumProduct / divisor;
}

/**
 * Calculates the Pearson correlation coefficient between two datasets.
 *
 * The correlation coefficient measures the linear relationship between two variables.
 * Values range from -1 (perfect negative correlation) to +1 (perfect positive correlation).
 * A value of 0 indicates no linear correlation.
 *
 * This implementation uses a numerically stable single-pass algorithm.
 *
 * @param x - First dataset
 * @param y - Second dataset
 * @returns The Pearson correlation coefficient (-1 to 1)
 * @throws {Error} If data is invalid or incompatible
 *
 * @example
 * correlation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) // 1.0 (perfect positive correlation)
 * correlation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]) // -1.0 (perfect negative correlation)
 * correlation([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]) // ~0.69
 */
export function correlation(x: number[], y: number[]): number {
  validatePairedData(x, y, 'correlation');

  const n = x.length;

  if (n === 1) {
    throw new Error('correlation: At least 2 data points are required');
  }

  // Use Welford's online algorithm for numerical stability
  const firstX = x[0];
  const firstY = y[0];
  if (firstX === undefined || firstY === undefined) {
    throw new Error('correlation: Invalid data');
  }
  let meanX = firstX;
  let meanY = firstY;
  let m2X = 0;
  let m2Y = 0;
  let m2XY = 0;

  for (let i = 1; i < n; i++) {
    const xVal = x[i];
    const yVal = y[i];
    if (xVal === undefined || yVal === undefined) continue;
    const deltaX = xVal - meanX;
    const deltaY = yVal - meanY;

    meanX += deltaX / (i + 1);
    meanY += deltaY / (i + 1);

    const deltaX2 = xVal - meanX;
    const deltaY2 = yVal - meanY;

    m2X += deltaX * deltaX2;
    m2Y += deltaY * deltaY2;
    m2XY += deltaX * deltaY2;
  }

  // Check for zero variance
  if (m2X === 0 || m2Y === 0) {
    throw new Error('correlation: One or both variables have zero variance');
  }

  // Pearson correlation coefficient
  return m2XY / Math.sqrt(m2X * m2Y);
}

/**
 * Calculates Spearman's rank correlation coefficient.
 *
 * Spearman's rank correlation assesses monotonic relationships using rank values.
 * It is less sensitive to outliers than Pearson correlation and can detect
 * non-linear monotonic relationships.
 *
 * @param x - First dataset
 * @param y - Second dataset
 * @returns The Spearman rank correlation coefficient (-1 to 1)
 * @throws {Error} If data is invalid or incompatible
 *
 * @example
 * spearmanCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) // 1.0
 * spearmanCorrelation([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]) // 1.0 (monotonic but not linear)
 */
export function spearmanCorrelation(x: number[], y: number[]): number {
  validatePairedData(x, y, 'spearmanCorrelation');

  // Convert to ranks
  const xRanks = assignRanks(x);
  const yRanks = assignRanks(y);

  // Calculate Pearson correlation on ranks
  return correlation(xRanks, yRanks);
}

/**
 * Assigns ranks to data values, handling ties by averaging ranks.
 *
 * @param data - Array of numbers to rank
 * @returns Array of rank values
 */
function assignRanks(data: number[]): number[] {
  const n = data.length;

  // Create index-value pairs and sort by value
  const indexed = data.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  // Assign ranks, handling ties by averaging
  const ranks = new Array(n);
  let i = 0;

  while (i < n) {
    let j = i;

    // Find the end of the tied group
    const iVal = indexed[i];
    if (!iVal) break;
    while (j < n) {
      const jVal = indexed[j];
      if (!jVal || jVal.value !== iVal.value) break;
      j++;
    }

    // Average rank for tied values
    const averageRank = (i + j + 1) / 2;

    // Assign average rank to all tied values
    for (let k = i; k < j; k++) {
      const kVal = indexed[k];
      if (kVal) {
        ranks[kVal.index] = averageRank;
      }
    }

    i = j;
  }

  return ranks;
}

/**
 * Calculates the coefficient of determination (R²) between two datasets.
 *
 * R² represents the proportion of variance in y that is predictable from x.
 * It is the square of the Pearson correlation coefficient.
 *
 * @param x - Independent variable
 * @param y - Dependent variable
 * @returns R² value (0 to 1)
 * @throws {Error} If data is invalid or incompatible
 *
 * @example
 * rSquared([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) // 1.0
 */
export function rSquared(x: number[], y: number[]): number {
  const r = correlation(x, y);
  return r * r;
}
