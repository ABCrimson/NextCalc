/**
 * Adam Optimizer
 *
 * Adaptive Moment Estimation (Adam) is one of the most popular optimization
 * algorithms in deep learning. It combines the benefits of:
 * - Momentum (exponential moving average of gradients)
 * - RMSProp (exponential moving average of squared gradients)
 *
 * Published by Kingma & Ba in 2014, it's the default optimizer for many
 * deep learning frameworks.
 *
 * Reference: https://arxiv.org/abs/1412.6980
 */

/**
 * Adam optimizer result
 */
export interface AdamResult {
  /** Final parameters */
  readonly parameters: ReadonlyArray<number>;
  /** Final loss value */
  readonly loss: number;
  /** Number of iterations */
  readonly iterations: number;
  /** Loss history */
  readonly history: ReadonlyArray<number>;
  /** Convergence flag */
  readonly converged: boolean;
}

/**
 * Adam optimizer options
 */
export interface AdamOptions {
  /** Learning rate (default: 0.001) */
  readonly learningRate?: number;
  /** Exponential decay rate for first moment (default: 0.9) */
  readonly beta1?: number;
  /** Exponential decay rate for second moment (default: 0.999) */
  readonly beta2?: number;
  /** Small constant for numerical stability (default: 1e-8) */
  readonly epsilon?: number;
  /** Maximum iterations (default: 1000) */
  readonly maxIterations?: number;
  /** Convergence tolerance (default: 1e-6) */
  readonly tolerance?: number;
}

/**
 * Loss function type
 */
export type LossFunction = (
  parameters: ReadonlyArray<number>
) => {
  loss: number;
  gradient: ReadonlyArray<number>;
};

/**
 * Adam Optimizer Implementation
 *
 * Algorithm:
 * 1. Initialize first moment m = 0 and second moment v = 0
 * 2. For each iteration t:
 *    - Compute gradient g
 *    - Update biased first moment: m = β₁·m + (1-β₁)·g
 *    - Update biased second moment: v = β₂·v + (1-β₂)·g²
 *    - Compute bias-corrected moments: m̂ = m/(1-β₁ᵗ), v̂ = v/(1-β₂ᵗ)
 *    - Update parameters: θ = θ - α·m̂/(√v̂ + ε)
 *
 * Time Complexity: O(iterations × d) where d is parameter dimension
 * Space Complexity: O(d) for storing moments
 *
 * @param lossFunction - Function that computes loss and gradient
 * @param initialParams - Starting parameters
 * @param options - Optimizer options
 */
export function adam(
  lossFunction: LossFunction,
  initialParams: ReadonlyArray<number>,
  options: AdamOptions = {}
): AdamResult {
  const {
    learningRate = 0.001,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
    maxIterations = 1000,
    tolerance = 1e-6,
  } = options;

  const d = initialParams.length;
  let params = [...initialParams];

  // Initialize first and second moments
  const m = new Array(d).fill(0); // First moment (mean of gradients)
  const v = new Array(d).fill(0); // Second moment (uncentered variance)

  const history: number[] = [];
  let converged = false;

  for (let t = 1; t <= maxIterations; t++) {
    // Compute loss and gradient
    const { loss, gradient } = lossFunction(params);
    history.push(loss);

    // Check convergence
    const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (gradientNorm < tolerance) {
      converged = true;
      break;
    }

    // Update biased first moment estimate
    for (let i = 0; i < d; i++) {
      m[i] = beta1 * m[i]! + (1 - beta1) * gradient[i]!;
    }

    // Update biased second raw moment estimate
    for (let i = 0; i < d; i++) {
      v[i] = beta2 * v[i]! + (1 - beta2) * gradient[i]! * gradient[i]!;
    }

    // Compute bias-corrected moments
    const mHat = m.map(mi => mi / (1 - Math.pow(beta1, t)));
    const vHat = v.map(vi => vi / (1 - Math.pow(beta2, t)));

    // Update parameters
    for (let i = 0; i < d; i++) {
      const param = params[i];
      const mHatVal = mHat[i];
      const vHatVal = vHat[i];
      if (param !== undefined && mHatVal !== undefined && vHatVal !== undefined) {
        params[i] = param - learningRate * mHatVal / (Math.sqrt(vHatVal) + epsilon);
      }
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
 * AdamW Optimizer
 *
 * Adam with decoupled weight decay regularization.
 * Often performs better than standard Adam with L2 regularization.
 *
 * Reference: Loshchilov & Hutter (2017)
 */
export function adamW(
  lossFunction: LossFunction,
  initialParams: ReadonlyArray<number>,
  options: AdamOptions & { weightDecay?: number } = {}
): AdamResult {
  const {
    learningRate = 0.001,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
    maxIterations = 1000,
    tolerance = 1e-6,
    weightDecay = 0.01,
  } = options;

  const d = initialParams.length;
  let params = [...initialParams];

  const m = new Array(d).fill(0);
  const v = new Array(d).fill(0);

  const history: number[] = [];
  let converged = false;

  for (let t = 1; t <= maxIterations; t++) {
    const { loss, gradient } = lossFunction(params);
    history.push(loss);

    const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (gradientNorm < tolerance) {
      converged = true;
      break;
    }

    // Update moments (same as Adam)
    for (let i = 0; i < d; i++) {
      m[i] = beta1 * m[i]! + (1 - beta1) * gradient[i]!;
      v[i] = beta2 * v[i]! + (1 - beta2) * gradient[i]! * gradient[i]!;
    }

    const mHat = m.map(mi => mi / (1 - Math.pow(beta1, t)));
    const vHat = v.map(vi => vi / (1 - Math.pow(beta2, t)));

    // Update with decoupled weight decay
    for (let i = 0; i < d; i++) {
      params[i] =
        params[i]! * (1 - learningRate * weightDecay) -
        learningRate * mHat[i]! / (Math.sqrt(vHat[i]!) + epsilon);
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
 * RAdam Optimizer
 *
 * Rectified Adam - addresses variance warmup issue in early training.
 * Automatically determines when to use adaptive learning rate.
 *
 * Reference: Liu et al. (2019)
 */
export function radam(
  lossFunction: LossFunction,
  initialParams: ReadonlyArray<number>,
  options: AdamOptions = {}
): AdamResult {
  const {
    learningRate = 0.001,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
    maxIterations = 1000,
    tolerance = 1e-6,
  } = options;

  const d = initialParams.length;
  let params = [...initialParams];

  const m = new Array(d).fill(0);
  const v = new Array(d).fill(0);

  const history: number[] = [];
  let converged = false;

  // Maximum length of the approximated SMA
  const rhoInf = 2 / (1 - beta2) - 1;

  for (let t = 1; t <= maxIterations; t++) {
    const { loss, gradient } = lossFunction(params);
    history.push(loss);

    const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (gradientNorm < tolerance) {
      converged = true;
      break;
    }

    // Update moments
    for (let i = 0; i < d; i++) {
      m[i] = beta1 * m[i]! + (1 - beta1) * gradient[i]!;
      v[i] = beta2 * v[i]! + (1 - beta2) * gradient[i]! * gradient[i]!;
    }

    // Bias correction
    const mHat = m.map(mi => mi / (1 - Math.pow(beta1, t)));
    const vHat = v.map(vi => vi / (1 - Math.pow(beta2, t)));

    // Compute variance rectification term
    const rho = rhoInf - 2 * t * Math.pow(beta2, t) / (1 - Math.pow(beta2, t));

    // If variance is tractable, use adaptive learning rate
    if (rho > 4) {
      const rectificationTerm = Math.sqrt(
        ((rho - 4) * (rho - 2) * rhoInf) /
        ((rhoInf - 4) * (rhoInf - 2) * rho)
      );

      for (let i = 0; i < d; i++) {
        const param = params[i];
        const mHatVal = mHat[i];
        const vHatVal = vHat[i];
        if (param !== undefined && mHatVal !== undefined && vHatVal !== undefined) {
          params[i] = param - learningRate * rectificationTerm * mHatVal / (Math.sqrt(vHatVal) + epsilon);
        }
      }
    } else {
      // Use momentum only
      for (let i = 0; i < d; i++) {
        const param = params[i];
        const mHatVal = mHat[i];
        if (param !== undefined && mHatVal !== undefined) {
          params[i] = param - learningRate * mHatVal;
        }
      }
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
 * Example: Neural Network Training with Adam
 *
 * Demonstrates Adam optimizer on a simple neural network
 */
export function trainNeuralNetworkAdam(
  X: ReadonlyArray<ReadonlyArray<number>>,
  y: ReadonlyArray<number>,
  hiddenSize: number,
  options: AdamOptions = {}
): {
  weights1: ReadonlyArray<number>;
  weights2: ReadonlyArray<number>;
  result: AdamResult;
} {
  const n = X.length;
  const inputSize = X[0]?.length || 0;
  const outputSize = 1;

  // Initialize weights randomly
  const w1Size = inputSize * hiddenSize;
  const w2Size = hiddenSize * outputSize;
  const totalParams = w1Size + w2Size;

  const initialParams = Array.from(
    { length: totalParams },
    () => (Math.random() - 0.5) * 0.1
  );

  // Sigmoid activation
  const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

  // Loss function with forward pass
  const lossFunction: LossFunction = (params) => {
    // Extract weights
    const w1 = params.slice(0, w1Size);
    const w2 = params.slice(w1Size);

    let loss = 0;
    const gradient = new Array(totalParams).fill(0);

    for (let i = 0; i < n; i++) {
      // Forward pass
      const hidden = new Array(hiddenSize).fill(0);
      for (let h = 0; h < hiddenSize; h++) {
        for (let j = 0; j < inputSize; j++) {
          hidden[h] += w1[h * inputSize + j]! * X[i]![j]!;
        }
        hidden[h] = sigmoid(hidden[h]!);
      }

      let output = 0;
      for (let h = 0; h < hiddenSize; h++) {
        output += w2[h]! * hidden[h]!;
      }
      output = sigmoid(output);

      // Loss (MSE)
      const error = output - y[i]!;
      loss += error * error;

      // Backward pass (simplified gradient computation)
      const outputGrad = 2 * error * output * (1 - output);

      // Gradients for w2
      for (let h = 0; h < hiddenSize; h++) {
        gradient[w1Size + h] += outputGrad * hidden[h]!;
      }

      // Gradients for w1
      for (let h = 0; h < hiddenSize; h++) {
        const hiddenGrad = outputGrad * w2[h]! * hidden[h]! * (1 - hidden[h]!);
        for (let j = 0; j < inputSize; j++) {
          gradient[h * inputSize + j] += hiddenGrad * X[i]![j]!;
        }
      }
    }

    // Normalize
    loss /= n;
    for (let i = 0; i < totalParams; i++) {
      gradient[i] /= n;
    }

    return { loss, gradient };
  };

  const result = adam(lossFunction, initialParams, options);

  return {
    weights1: result.parameters.slice(0, w1Size),
    weights2: result.parameters.slice(w1Size),
    result,
  };
}
