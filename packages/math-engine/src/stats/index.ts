/**
 * Statistics Module
 *
 * Comprehensive statistical analysis toolkit including:
 * - Descriptive statistics (mean, median, mode, variance, standard deviation, etc.)
 * - Regression analysis (linear, polynomial, exponential)
 * - Arbitrary-model tilde regression (Levenberg-Marquardt with analytic Jacobians)
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
// Arbitrary-model tilde regression (nonlinear least squares)
export {
  buildCannedModel,
  type CannedModelKind,
  type FitFailure,
  type FitOptions,
  type FitResult,
  type FitSuccess,
  type FitWarning,
  fitModel,
  type ParameterBounds,
  type ParsedModel,
  parseTildeModel,
  type TildeModel,
  type TildeModelErrorCode,
} from './fit';
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
