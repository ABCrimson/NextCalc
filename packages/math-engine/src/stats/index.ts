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

// Descriptive statistics
export {
  mean,
  median,
  mode,
  variance,
  stdDev,
  range,
  quartiles,
  sum,
  product,
  type RangeResult,
  type QuartileResult,
} from './descriptive';

// Regression analysis
export {
  linearRegression,
  polynomialRegression,
  exponentialRegression,
  predict,
  type LinearRegressionResult,
  type PolynomialRegressionResult,
  type ExponentialRegressionResult,
} from './regression';

// Correlation and covariance
export {
  correlation,
  covariance,
  spearmanCorrelation,
  rSquared,
} from './correlation';
