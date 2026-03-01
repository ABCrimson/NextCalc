/**
 * Statistics Module
 *
 * Comprehensive statistical analysis toolkit including:
 * - Descriptive statistics (mean, median, mode, variance, standard deviation, etc.)
 * - Regression analysis (linear, polynomial, exponential)
 * - Correlation and covariance measures
 *
 * All functions are pure, immutable, and numerically stable.
 *
 * @module stats
 */

// Correlation and covariance
export {
  correlation,
  covariance,
  rSquared,
  spearmanCorrelation,
} from './correlation';
// Descriptive statistics
export {
  mean,
  median,
  mode,
  product,
  type QuartileResult,
  quartiles,
  type RangeResult,
  range,
  stdDev,
  sum,
  variance,
} from './descriptive';
// Regression analysis
export {
  type ExponentialRegressionResult,
  exponentialRegression,
  type LinearRegressionResult,
  linearRegression,
  type PolynomialRegressionResult,
  polynomialRegression,
  predict,
} from './regression';
