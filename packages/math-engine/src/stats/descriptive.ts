/**
 * Descriptive Statistics Module
 *
 * Provides fundamental statistical measures for analyzing data distributions.
 * All functions are pure and immutable - they do not modify input arrays.
 *
 * @module stats/descriptive
 */

/**
 * Validates that the data array is non-empty and contains only valid numbers
 * @throws {Error} If array is empty or contains invalid values
 */
function validateData(data: number[], operationName: string): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${operationName}: Data array must be non-empty`);
  }

  if (data.some((x) => !Number.isFinite(x))) {
    throw new Error(`${operationName}: Data array contains invalid values (NaN or Infinity)`);
  }
}

/**
 * Calculates the arithmetic mean (average) of a dataset.
 *
 * The mean is computed using Kahan summation algorithm for improved numerical stability
 * when dealing with large datasets or values with significant magnitude differences.
 *
 * @param data - Array of numbers
 * @returns The arithmetic mean
 * @throws {Error} If data is empty or contains invalid values
 *
 * @example
 * mean([1, 2, 3, 4, 5]) // 3
 * mean([10, 20, 30]) // 20
 */
export function mean(data: number[]): number {
  validateData(data, 'mean');

  // Use Kahan summation for numerical stability
  let sum = 0;
  let compensation = 0;

  for (const value of data) {
    const y = value - compensation;
    const temp = sum + y;
    compensation = temp - sum - y;
    sum = temp;
  }

  return sum / data.length;
}

/**
 * Calculates the median (middle value) of a dataset.
 *
 * For odd-length arrays, returns the middle element.
 * For even-length arrays, returns the average of the two middle elements.
 * This function does not modify the original array.
 *
 * @param data - Array of numbers
 * @returns The median value
 * @throws {Error} If data is empty or contains invalid values
 *
 * @example
 * median([1, 2, 3, 4, 5]) // 3
 * median([1, 2, 3, 4]) // 2.5
 */
export function median(data: number[]): number {
  validateData(data, 'median');

  // Sort a copy to avoid mutating the original array
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Even length: average of two middle values
    const val1 = sorted[mid - 1];
    const val2 = sorted[mid];
    if (val1 === undefined || val2 === undefined) {
      throw new Error('median: Invalid data');
    }
    return (val1 + val2) / 2;
  } else {
    // Odd length: middle value
    const val = sorted[mid];
    if (val === undefined) {
      throw new Error('median: Invalid data');
    }
    return val;
  }
}

/**
 * Finds the mode(s) of a dataset.
 *
 * The mode is the value(s) that appear most frequently.
 * Multiple modes can exist if several values have the same highest frequency.
 * Returns an empty array if all values appear exactly once.
 *
 * @param data - Array of numbers
 * @returns Array of mode values (may be empty if no mode exists)
 * @throws {Error} If data is empty or contains invalid values
 *
 * @example
 * mode([1, 2, 2, 3, 3, 3]) // [3]
 * mode([1, 1, 2, 2, 3]) // [1, 2]
 * mode([1, 2, 3, 4]) // [] (no mode)
 */
export function mode(data: number[]): number[] {
  validateData(data, 'mode');

  // Count frequencies using a Map for better performance with floating-point keys
  const frequencies = new Map<number, number>();
  let maxFrequency = 0;

  for (const value of data) {
    const count = (frequencies.get(value) ?? 0) + 1;
    frequencies.set(value, count);
    maxFrequency = Math.max(maxFrequency, count);
  }

  // If all values appear exactly once, there is no mode
  if (maxFrequency === 1) {
    return [];
  }

  // Find all values with maximum frequency
  const modes: number[] = [];
  for (const [value, frequency] of frequencies) {
    if (frequency === maxFrequency) {
      modes.push(value);
    }
  }

  return modes.sort((a, b) => a - b);
}

/**
 * Calculates the variance of a dataset.
 *
 * Variance measures how far a set of numbers are spread out from their mean.
 * Uses the two-pass algorithm for improved numerical stability.
 *
 * @param data - Array of numbers
 * @param sample - If true, uses sample variance (n-1 denominator); if false, uses population variance (n denominator)
 * @returns The variance
 * @throws {Error} If data is empty, contains invalid values, or sample variance is requested for single-element array
 *
 * @example
 * variance([1, 2, 3, 4, 5], true) // 2.5 (sample variance)
 * variance([1, 2, 3, 4, 5], false) // 2.0 (population variance)
 */
export function variance(data: number[], sample = true): number {
  validateData(data, 'variance');

  if (sample && data.length === 1) {
    throw new Error('variance: Sample variance requires at least 2 data points');
  }

  const avg = mean(data);
  const n = sample ? data.length - 1 : data.length;

  // Two-pass algorithm for better numerical stability
  let sumSquaredDiff = 0;
  let compensation = 0;

  for (const value of data) {
    const diff = value - avg;
    const y = diff * diff - compensation;
    const temp = sumSquaredDiff + y;
    compensation = temp - sumSquaredDiff - y;
    sumSquaredDiff = temp;
  }

  return sumSquaredDiff / n;
}

/**
 * Calculates the standard deviation of a dataset.
 *
 * Standard deviation is the square root of variance and measures the amount
 * of variation or dispersion in a set of values.
 *
 * @param data - Array of numbers
 * @param sample - If true, uses sample standard deviation; if false, uses population standard deviation
 * @returns The standard deviation
 * @throws {Error} If data is empty, contains invalid values, or sample stddev is requested for single-element array
 *
 * @example
 * stdDev([1, 2, 3, 4, 5], true) // ~1.58
 * stdDev([1, 2, 3, 4, 5], false) // ~1.41
 */
export function stdDev(data: number[], sample = true): number {
  return Math.sqrt(variance(data, sample));
}

/**
 * Range statistics for a dataset
 */
export interface RangeResult {
  /** Minimum value in the dataset */
  readonly min: number;
  /** Maximum value in the dataset */
  readonly max: number;
  /** Difference between max and min */
  readonly range: number;
}

/**
 * Calculates the range statistics of a dataset.
 *
 * @param data - Array of numbers
 * @returns Object containing min, max, and range
 * @throws {Error} If data is empty or contains invalid values
 *
 * @example
 * range([1, 2, 3, 4, 5]) // { min: 1, max: 5, range: 4 }
 */
export function range(data: number[]): RangeResult {
  validateData(data, 'range');

  const firstVal = data[0];
  if (firstVal === undefined) {
    throw new Error('range: Data must not be empty');
  }
  let min = firstVal;
  let max = firstVal;

  for (let i = 1; i < data.length; i++) {
    const val = data[i];
    if (val === undefined) continue;
    if (val < min) min = val;
    if (val > max) max = val;
  }

  return {
    min,
    max,
    range: max - min,
  };
}

/**
 * Quartile statistics for a dataset
 */
export interface QuartileResult {
  /** First quartile (25th percentile) */
  q1: number;
  /** Second quartile (50th percentile, same as median) */
  q2: number;
  /** Third quartile (75th percentile) */
  q3: number;
  /** Interquartile range (Q3 - Q1) */
  iqr: number;
}

/**
 * Calculates quartiles and interquartile range of a dataset.
 *
 * Uses the inclusive method (also known as Method 3) for computing quartiles,
 * which includes the median in both halves when computing Q1 and Q3 for odd-length datasets.
 *
 * @param data - Array of numbers
 * @returns Object containing Q1, Q2 (median), Q3, and IQR
 * @throws {Error} If data is empty or contains invalid values
 *
 * @example
 * quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9])
 * // { q1: 2.5, q2: 5, q3: 7.5, iqr: 5 }
 */
export function quartiles(data: number[]): QuartileResult {
  validateData(data, 'quartiles');

  // Sort a copy to avoid mutating original
  const sorted = [...data].sort((a, b) => a - b);

  // Q2 is the median
  const q2 = median(sorted);

  // Helper function to calculate percentile
  const percentile = (arr: number[], p: number): number => {
    const index = (arr.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    const lowerVal = arr[lower];
    const upperVal = arr[upper];
    if (lowerVal === undefined || upperVal === undefined) {
      throw new Error('percentile: Invalid data');
    }
    return lowerVal * (1 - weight) + upperVal * weight;
  };

  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);

  return {
    q1,
    q2,
    q3,
    iqr: q3 - q1,
  };
}

/**
 * Calculates the sum of an array of numbers using Kahan summation for numerical stability.
 *
 * @param data - Array of numbers
 * @returns The sum of all values
 * @throws {Error} If data contains invalid values
 *
 * @example
 * sum([1, 2, 3, 4, 5]) // 15
 */
export function sum(data: number[]): number {
  if (data.length === 0) return 0;

  if (data.some((x) => !Number.isFinite(x))) {
    throw new Error('sum: Data array contains invalid values (NaN or Infinity)');
  }

  // Kahan summation
  let total = 0;
  let compensation = 0;

  for (const value of data) {
    const y = value - compensation;
    const temp = total + y;
    compensation = temp - total - y;
    total = temp;
  }

  return total;
}

/**
 * Calculates the product of an array of numbers.
 *
 * @param data - Array of numbers
 * @returns The product of all values
 * @throws {Error} If data is empty or contains invalid values
 *
 * @example
 * product([1, 2, 3, 4, 5]) // 120
 */
export function product(data: number[]): number {
  validateData(data, 'product');

  let result = 1;
  for (const value of data) {
    result *= value;
  }

  return result;
}
