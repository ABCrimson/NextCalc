/**
 * Neural Network Implementation
 *
 * Feedforward neural network with backpropagation:
 * - Fully connected (dense) layers
 * - Multiple activation functions
 * - Mini-batch gradient descent
 * - L2 regularization
 *
 * @module algorithms/ml/neural-network
 */

/**
 * Matrix type (2D array)
 */
export type Matrix = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Vector type (1D array)
 */
export type Vector = ReadonlyArray<number>;

/**
 * Activation function type
 */
export type ActivationType = 'sigmoid' | 'tanh' | 'relu' | 'leaky-relu' | 'softmax';

/**
 * Layer configuration
 */
export interface LayerConfig {
  /** Number of neurons in this layer */
  readonly size: number;
  /** Activation function */
  readonly activation: ActivationType;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  /** Learning rate */
  readonly learningRate: number;
  /** Number of training epochs */
  readonly epochs: number;
  /** Batch size for mini-batch gradient descent */
  readonly batchSize: number;
  /** L2 regularization parameter */
  readonly lambda?: number;
  /** Whether to shuffle training data */
  readonly shuffle?: boolean;
  /** Progress callback fired every `logInterval` epochs */
  readonly onProgress?: (epoch: number, loss: number) => void;
  /** How often to fire onProgress (default: 100 epochs) */
  readonly logInterval?: number;
}

/**
 * Training data point
 */
export interface TrainingData {
  /** Input features */
  readonly input: Vector;
  /** Target output */
  readonly target: Vector;
}

// ============================================================================
// ACTIVATION FUNCTIONS
// ============================================================================

/**
 * Sigmoid activation: σ(x) = 1 / (1 + e^(-x))
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Sigmoid derivative: σ'(x) = σ(x)(1 - σ(x))
 */
function sigmoidDerivative(x: number): number {
  const s = sigmoid(x);
  return s * (1 - s);
}

/**
 * Hyperbolic tangent: tanh(x)
 */
function tanh(x: number): number {
  return Math.tanh(x);
}

/**
 * Tanh derivative: tanh'(x) = 1 - tanh²(x)
 */
function tanhDerivative(x: number): number {
  const t = Math.tanh(x);
  return 1 - t * t;
}

/**
 * ReLU activation: max(0, x)
 */
function relu(x: number): number {
  return Math.max(0, x);
}

/**
 * ReLU derivative: 1 if x > 0, else 0
 */
function reluDerivative(x: number): number {
  return x > 0 ? 1 : 0;
}

/**
 * Leaky ReLU: max(0.01x, x)
 */
function leakyRelu(x: number): number {
  return x > 0 ? x : 0.01 * x;
}

/**
 * Leaky ReLU derivative
 */
function leakyReluDerivative(x: number): number {
  return x > 0 ? 1 : 0.01;
}

/**
 * Softmax activation (for output layer)
 */
function softmax(vec: Vector): Vector {
  const max = Math.max(...vec);
  const exps = vec.map((x) => Math.exp(x - max)); // Numerical stability
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

/**
 * Gets activation function
 */
function getActivation(type: ActivationType): (x: number) => number {
  switch (type) {
    case 'sigmoid':
      return sigmoid;
    case 'tanh':
      return tanh;
    case 'relu':
      return relu;
    case 'leaky-relu':
      return leakyRelu;
    case 'softmax':
      throw new Error('Softmax is vector-based, use applyActivation');
  }
}

/**
 * Gets activation derivative
 */
function getActivationDerivative(type: ActivationType): (x: number) => number {
  switch (type) {
    case 'sigmoid':
      return sigmoidDerivative;
    case 'tanh':
      return tanhDerivative;
    case 'relu':
      return reluDerivative;
    case 'leaky-relu':
      return leakyReluDerivative;
    case 'softmax':
      throw new Error('Softmax derivative computed differently');
  }
}

/**
 * Applies activation function to vector
 */
function applyActivation(vec: Vector, type: ActivationType): Vector {
  if (type === 'softmax') {
    return softmax(vec);
  }
  const activation = getActivation(type);
  return vec.map(activation);
}

// ============================================================================
// NEURAL NETWORK CLASS
// ============================================================================

/**
 * Feedforward Neural Network
 *
 * @example
 * const network = new NeuralNetwork([
 *   { size: 2, activation: 'relu' },    // Input layer
 *   { size: 4, activation: 'relu' },    // Hidden layer
 *   { size: 1, activation: 'sigmoid' }  // Output layer
 * ]);
 *
 * const data = [
 *   { input: [0, 0], target: [0] },
 *   { input: [0, 1], target: [1] },
 *   { input: [1, 0], target: [1] },
 *   { input: [1, 1], target: [0] }, // XOR
 * ];
 *
 * network.train(data, {
 *   learningRate: 0.1,
 *   epochs: 10000,
 *   batchSize: 4,
 * });
 *
 * console.log(network.predict([1, 1])); // Should be close to 0
 */
export class NeuralNetwork {
  private readonly layers: ReadonlyArray<LayerConfig>;
  private weights: number[][][]; // weights[l][j][i]: weight from neuron i in layer l to neuron j in layer l+1
  private biases: number[][]; // biases[l][j]: bias for neuron j in layer l+1

  constructor(layers: ReadonlyArray<LayerConfig>) {
    if (layers.length < 2) {
      throw new Error('NeuralNetwork: At least 2 layers required (input + output)');
    }

    this.layers = layers;
    this.weights = [];
    this.biases = [];

    this.initializeWeights();
  }

  /**
   * Initializes weights using Xavier initialization
   */
  private initializeWeights(): void {
    for (let l = 0; l < this.layers.length - 1; l++) {
      const currentLayer = this.layers[l];
      const nextLayer = this.layers[l + 1];

      if (!currentLayer || !nextLayer) continue;

      const layerWeights: number[][] = [];
      const layerBiases: number[] = [];

      // Xavier initialization: scale = sqrt(2 / (inputSize + outputSize))
      const scale = Math.sqrt(2 / (currentLayer.size + nextLayer.size));

      for (let j = 0; j < nextLayer.size; j++) {
        const neuronWeights: number[] = [];
        for (let i = 0; i < currentLayer.size; i++) {
          // Random initialization with Xavier scaling
          neuronWeights.push((Math.random() * 2 - 1) * scale);
        }
        layerWeights.push(neuronWeights);
        layerBiases.push(0); // Initialize biases to 0
      }

      this.weights.push(layerWeights);
      this.biases.push(layerBiases);
    }
  }

  /**
   * Forward propagation
   *
   * @param input - Input vector
   * @returns Array of activations for each layer
   */
  private forward(input: Vector): ReadonlyArray<Vector> {
    const activations: Vector[] = [input];

    for (let l = 0; l < this.weights.length; l++) {
      const prevActivation = activations[l];
      const layerWeights = this.weights[l];
      const layerBiases = this.biases[l];
      const nextLayerConfig = this.layers[l + 1];

      if (!prevActivation || !layerWeights || !layerBiases || !nextLayerConfig) continue;

      const z: number[] = [];

      // Compute weighted sum: z = Wx + b
      for (let j = 0; j < layerWeights.length; j++) {
        const neuronWeights = layerWeights[j];
        const bias = layerBiases[j];
        if (!neuronWeights || bias === undefined) continue;

        let sum = bias;
        for (let i = 0; i < neuronWeights.length; i++) {
          const weight = neuronWeights[i];
          const activation = prevActivation[i];
          if (weight !== undefined && activation !== undefined) {
            sum += weight * activation;
          }
        }
        z.push(sum);
      }

      // Apply activation function
      const activation = applyActivation(z, nextLayerConfig.activation);
      activations.push(activation);
    }

    return activations;
  }

  /**
   * Backward propagation
   *
   * @param activations - Forward pass activations
   * @param target - Target output
   * @param lambda - L2 regularization parameter
   * @returns Gradients for weights and biases
   */
  private backward(
    activations: ReadonlyArray<Vector>,
    target: Vector,
    lambda = 0,
  ): {
    readonly weightGradients: number[][][];
    readonly biasGradients: number[][];
  } {
    const weightGradients: number[][][] = this.weights.map((layer) =>
      layer.map((neuron) => neuron.map(() => 0)),
    );
    const biasGradients: number[][] = this.biases.map((layer) => layer.map(() => 0));

    // Output layer error (delta)
    const output = activations[activations.length - 1] ?? [];
    const outputLayer = this.layers[this.layers.length - 1];

    if (!outputLayer) {
      throw new Error('backward: Output layer not found');
    }

    // For softmax + cross-entropy, delta is simply (output - target)
    // For other activations with MSE, delta is (output - target) * activation'
    let delta: number[];

    if (outputLayer.activation === 'softmax') {
      delta = output.map((o, i) => o - (target[i] ?? 0));
    } else {
      const activationDeriv = getActivationDerivative(outputLayer.activation);
      delta = output.map((o, i) => (o - (target[i] ?? 0)) * activationDeriv(o));
    }

    // Backpropagate through layers
    for (let l = this.weights.length - 1; l >= 0; l--) {
      const prevActivation = activations[l];
      const layerWeights = this.weights[l];
      const layerConfig = this.layers[l + 1];

      if (!prevActivation || !layerWeights || !layerConfig) continue;

      // Compute gradients for this layer
      for (let j = 0; j < delta.length; j++) {
        const d = delta[j];
        if (d === undefined) continue;

        for (let i = 0; i < prevActivation.length; i++) {
          const activation = prevActivation[i];
          if (activation !== undefined) {
            const weightLayer = weightGradients[l];
            const weightNeuron = weightLayer?.[j];
            if (weightLayer && weightNeuron && weightNeuron[i] !== undefined) {
              // Add L2 regularization term
              const regularization = lambda * (layerWeights[j]?.[i] ?? 0);
              weightNeuron[i] = d * activation + regularization;
            }
          }
        }

        const biasLayer = biasGradients[l];
        if (biasLayer && biasLayer[j] !== undefined) {
          biasLayer[j] = d;
        }
      }

      // Propagate error to previous layer
      if (l > 0) {
        const prevLayerConfig = this.layers[l];
        if (!prevLayerConfig) continue;

        const nextDelta: number[] = new Array(prevActivation.length).fill(0);
        const activationDeriv = getActivationDerivative(prevLayerConfig.activation);

        for (let i = 0; i < prevActivation.length; i++) {
          let error = 0;
          for (let j = 0; j < delta.length; j++) {
            const d = delta[j];
            const weight = layerWeights[j]?.[i];
            if (d !== undefined && weight !== undefined) {
              error += d * weight;
            }
          }
          const activation = prevActivation[i];
          if (activation !== undefined) {
            nextDelta[i] = error * activationDeriv(activation);
          }
        }

        delta = nextDelta;
      }
    }

    return { weightGradients, biasGradients };
  }

  /**
   * Trains the network using mini-batch gradient descent
   *
   * @param data - Training data
   * @param config - Training configuration
   */
  train(data: ReadonlyArray<TrainingData>, config: TrainingConfig): void {
    const { learningRate, epochs, batchSize, lambda = 0, shuffle = true } = config;

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle data
      let shuffledData: ReadonlyArray<TrainingData> = data;
      if (shuffle) {
        const arr = [...data];
        for (let j = arr.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [arr[j], arr[k]] = [arr[k]!, arr[j]!];
        }
        shuffledData = arr;
      }

      // Mini-batch training
      for (let i = 0; i < shuffledData.length; i += batchSize) {
        const batch = shuffledData.slice(i, i + batchSize);

        // Accumulate gradients over batch
        const accWeightGrad: number[][][] = this.weights.map((layer) =>
          layer.map((neuron) => neuron.map(() => 0)),
        );
        const accBiasGrad: number[][] = this.biases.map((layer) => layer.map(() => 0));

        for (const sample of batch) {
          const activations = this.forward(sample.input);
          const { weightGradients, biasGradients } = this.backward(
            activations,
            sample.target,
            lambda,
          );

          // Accumulate gradients
          for (let l = 0; l < weightGradients.length; l++) {
            const layerGrad = weightGradients[l];
            if (!layerGrad) continue;

            for (let j = 0; j < layerGrad.length; j++) {
              const neuronGrad = layerGrad[j];
              if (!neuronGrad) continue;

              for (let k = 0; k < neuronGrad.length; k++) {
                const grad = neuronGrad[k];
                if (grad !== undefined) {
                  const accLayer = accWeightGrad[l];
                  const accNeuron = accLayer?.[j];
                  if (accLayer && accNeuron) {
                    const currentVal = accNeuron[k];
                    if (currentVal !== undefined) {
                      accNeuron[k] = currentVal + grad;
                    }
                  }
                }
              }
            }
          }

          for (let l = 0; l < biasGradients.length; l++) {
            const layerBiasGrad = biasGradients[l];
            if (!layerBiasGrad) continue;

            for (let j = 0; j < layerBiasGrad.length; j++) {
              const grad = layerBiasGrad[j];
              if (grad !== undefined) {
                const accLayer = accBiasGrad[l];
                if (accLayer) {
                  const currentVal = accLayer[j];
                  if (currentVal !== undefined) {
                    accLayer[j] = currentVal + grad;
                  }
                }
              }
            }
          }
        }

        // Update weights and biases
        const batchSizeActual = batch.length;
        for (let l = 0; l < this.weights.length; l++) {
          const layerWeights = this.weights[l];
          const layerGrad = accWeightGrad[l];
          if (!layerWeights || !layerGrad) continue;

          for (let j = 0; j < layerWeights.length; j++) {
            const neuronWeights = layerWeights[j];
            const neuronGrad = layerGrad[j];
            if (!neuronWeights || !neuronGrad) continue;

            for (let k = 0; k < neuronWeights.length; k++) {
              const grad = neuronGrad[k];
              if (grad !== undefined) {
                neuronWeights[k] =
                  (neuronWeights[k] ?? 0) - (learningRate * grad) / batchSizeActual;
              }
            }
          }

          const layerBiases = this.biases[l];
          const layerBiasGrad = accBiasGrad[l];
          if (!layerBiases || !layerBiasGrad) continue;

          for (let j = 0; j < layerBiases.length; j++) {
            const grad = layerBiasGrad[j];
            if (grad !== undefined) {
              layerBiases[j] = (layerBiases[j] ?? 0) - (learningRate * grad) / batchSizeActual;
            }
          }
        }
      }

      // Optional: log progress via callback
      if (config.onProgress && epoch % (config.logInterval ?? 100) === 0) {
        const loss = this.computeLoss(data);
        config.onProgress(epoch, loss);
      }
    }
  }

  /**
   * Makes prediction on input
   *
   * @param input - Input vector
   * @returns Output vector
   */
  predict(input: Vector): Vector {
    const activations = this.forward(input);
    return activations[activations.length - 1] ?? [];
  }

  /**
   * Computes mean squared error loss
   *
   * @param data - Training data
   * @returns Average loss
   */
  private computeLoss(data: ReadonlyArray<TrainingData>): number {
    let totalLoss = 0;

    for (const sample of data) {
      const output = this.predict(sample.input);
      for (let i = 0; i < output.length; i++) {
        const error = (output[i] ?? 0) - (sample.target[i] ?? 0);
        totalLoss += error * error;
      }
    }

    return totalLoss / (2 * data.length);
  }

  /**
   * Exports network weights for serialization
   */
  exportWeights(): {
    readonly weights: number[][][];
    readonly biases: number[][];
  } {
    return {
      weights: this.weights.map((layer) => layer.map((neuron) => [...neuron])),
      biases: this.biases.map((layer) => [...layer]),
    };
  }

  /**
   * Imports network weights
   */
  importWeights(data: { readonly weights: number[][][]; readonly biases: number[][] }): void {
    this.weights = data.weights.map((layer) => layer.map((neuron) => [...neuron]));
    this.biases = data.biases.map((layer) => [...layer]);
  }
}
