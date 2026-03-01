/**
 * Gradient Descent Optimization
 *
 * Implements various gradient descent algorithms:
 * - Batch Gradient Descent
 * - Stochastic Gradient Descent (SGD)
 * - Mini-batch Gradient Descent
 * - Momentum
 * - Nesterov Accelerated Gradient
 *
 * Used extensively in machine learning for optimizing loss functions.
 */

/**
 * Gradient descent result
 */
export interface GradientDescentResult {
  /** Final parameters */
  readonly parameters: ReadonlyArray<number>;
  /** Final loss value */
  readonly loss: number;
  /** Number of iterations performed */
  readonly iterations: number;
  /** Loss history for visualization */
  readonly history: ReadonlyArray<number>;
  /** Whether optimization converged */
  readonly converged: boolean;
}

/**
 * Gradient descent options
 */
export interface GradientDescentOptions {
  /** Learning rate (step size) */
  readonly learningRate?: number;
  /** Maximum number of iterations */
  readonly maxIterations?: number;
  /** Convergence tolerance */
  readonly tolerance?: number;
  /** Momentum coefficient (0-1) */
  readonly momentum?: number;
  /** Use Nesterov momentum */
  readonly nesterov?: boolean;
  /** Batch size (for SGD/mini-batch) */
  readonly batchSize?: number;
}

/**
 * Loss function type: computes loss and gradient
 */
export type LossFunction = (
  parameters: ReadonlyArray<number>,
  data?: unknown,
) => {
  loss: number;
  gradient: ReadonlyArray<number>;
};

/**
 * Batch Gradient Descent
 *
 * Uses the full dataset to compute gradients at each step.
 * Guaranteed to converge to global minimum for convex functions.
 *
 * Time Complexity: O(iterations × n × d) where n is data size, d is dimension
 * Space Complexity: O(d)
 *
 * @param lossFunction - Function that computes loss and gradient
 * @param initialParams - Starting parameters
 * @param options - Optimization options
 */
export function batchGradientDescent(
  lossFunction: LossFunction,
  initialParams: ReadonlyArray<number>,
  options: GradientDescentOptions = {},
): GradientDescentResult {
  const { learningRate = 0.01, maxIterations = 1000, tolerance = 1e-6, momentum = 0 } = options;

  const params = [...initialParams];
  const velocity = new Array(params.length).fill(0);
  const history: number[] = [];
  let converged = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    const { loss, gradient } = lossFunction(params);
    history.push(loss);

    // Check convergence
    const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (gradientNorm < tolerance) {
      converged = true;
      break;
    }

    // Update with momentum
    for (let i = 0; i < params.length; i++) {
      velocity[i] = momentum * velocity[i] - learningRate * gradient[i]!;
      params[i] += velocity[i]!;
    }
  }

  return {
    parameters: params,
    loss: history[history.length - 1] || 0,
    iterations: history.length,
    history,
    converged,
  };
}

/**
 * Stochastic Gradient Descent (SGD)
 *
 * Uses single random sample to compute gradient at each step.
 * Faster updates but noisier convergence.
 *
 * @param lossFunction - Function that computes loss and gradient for one sample
 * @param initialParams - Starting parameters
 * @param dataSize - Number of samples in dataset
 * @param options - Optimization options
 */
export function stochasticGradientDescent(
  lossFunction: (
    params: ReadonlyArray<number>,
    index: number,
  ) => {
    loss: number;
    gradient: ReadonlyArray<number>;
  },
  initialParams: ReadonlyArray<number>,
  dataSize: number,
  options: GradientDescentOptions = {},
): GradientDescentResult {
  const { learningRate = 0.01, maxIterations = 1000, tolerance = 1e-6, momentum = 0 } = options;

  const params = [...initialParams];
  const velocity = new Array(params.length).fill(0);
  const history: number[] = [];
  let converged = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Random sample
    const index = Math.floor(Math.random() * dataSize);
    const { loss, gradient } = lossFunction(params, index);

    // Record loss every N iterations for smoothing
    if (iter % 10 === 0) {
      history.push(loss);
    }

    // Check convergence (with noise tolerance)
    const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (gradientNorm < tolerance && iter > 100) {
      converged = true;
      break;
    }

    // Update with momentum
    for (let i = 0; i < params.length; i++) {
      velocity[i] = momentum * velocity[i] - learningRate * gradient[i]!;
      params[i] += velocity[i]!;
    }
  }

  return {
    parameters: params,
    loss: history[history.length - 1] || 0,
    iterations: history.length,
    history,
    converged,
  };
}

/**
 * Nesterov Accelerated Gradient
 *
 * Improved momentum method that "looks ahead" before computing gradient.
 * Often converges faster than standard momentum.
 *
 * @param lossFunction - Function that computes loss and gradient
 * @param initialParams - Starting parameters
 * @param options - Optimization options
 */
export function nesterovAcceleratedGradient(
  lossFunction: LossFunction,
  initialParams: ReadonlyArray<number>,
  options: GradientDescentOptions = {},
): GradientDescentResult {
  const { learningRate = 0.01, maxIterations = 1000, tolerance = 1e-6, momentum = 0.9 } = options;

  const params = [...initialParams];
  const velocity = new Array(params.length).fill(0);
  const history: number[] = [];
  let converged = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Look ahead: compute gradient at future position
    const lookahead = params.map((p, i) => p + momentum * velocity[i]!);
    const { loss, gradient } = lossFunction(lookahead);
    history.push(loss);

    // Check convergence
    const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (gradientNorm < tolerance) {
      converged = true;
      break;
    }

    // Update velocity and parameters
    for (let i = 0; i < params.length; i++) {
      velocity[i] = momentum * velocity[i] - learningRate * gradient[i]!;
      params[i] += velocity[i]!;
    }
  }

  return {
    parameters: params,
    loss: history[history.length - 1] || 0,
    iterations: history.length,
    history,
    converged,
  };
}

/**
 * Example: Linear Regression with Gradient Descent
 *
 * Demonstrates how to use gradient descent for a real problem.
 */
export function linearRegressionGD(
  X: ReadonlyArray<ReadonlyArray<number>>,
  y: ReadonlyArray<number>,
  options: GradientDescentOptions = {},
): GradientDescentResult {
  const n = X.length;
  const d = X[0]?.length || 0;

  // Initialize parameters to zero
  const initialParams = new Array(d).fill(0);

  // Mean Squared Error loss function
  const lossFunction: LossFunction = (params) => {
    let loss = 0;
    const gradient = new Array(d).fill(0);

    for (let i = 0; i < n; i++) {
      // Prediction
      let pred = 0;
      for (let j = 0; j < d; j++) {
        pred += params[j]! * X[i]![j]!;
      }

      // Error
      const error = pred - y[i]!;
      loss += error * error;

      // Gradient
      for (let j = 0; j < d; j++) {
        gradient[j] += 2 * error * X[i]![j]!;
      }
    }

    // Normalize
    loss /= n;
    for (let j = 0; j < d; j++) {
      gradient[j] /= n;
    }

    return { loss, gradient };
  };

  return batchGradientDescent(lossFunction, initialParams, options);
}

/**
 * Example: Logistic Regression with Gradient Descent
 */
export function logisticRegressionGD(
  X: ReadonlyArray<ReadonlyArray<number>>,
  y: ReadonlyArray<number>, // Binary: 0 or 1
  options: GradientDescentOptions = {},
): GradientDescentResult {
  const n = X.length;
  const d = X[0]?.length || 0;

  const initialParams = new Array(d).fill(0);

  // Sigmoid function
  const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

  // Binary cross-entropy loss
  const lossFunction: LossFunction = (params) => {
    let loss = 0;
    const gradient = new Array(d).fill(0);

    for (let i = 0; i < n; i++) {
      // Prediction
      let z = 0;
      for (let j = 0; j < d; j++) {
        z += params[j]! * X[i]![j]!;
      }
      const pred = sigmoid(z);

      // Cross-entropy loss
      const yi = y[i]!;
      loss -= yi * Math.log(pred + 1e-10) + (1 - yi) * Math.log(1 - pred + 1e-10);

      // Gradient
      const error = pred - yi;
      for (let j = 0; j < d; j++) {
        gradient[j] += error * X[i]![j]!;
      }
    }

    loss /= n;
    for (let j = 0; j < d; j++) {
      gradient[j] /= n;
    }

    return { loss, gradient };
  };

  return batchGradientDescent(lossFunction, initialParams, options);
}
