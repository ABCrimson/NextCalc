/**
 * Self-Attention Mechanism
 *
 * Core building block of transformer architectures.
 * Allows the model to weigh the importance of different parts of the input
 * when processing each element.
 *
 * "Attention Is All You Need" - Vaswani et al., 2017
 * Reference: https://arxiv.org/abs/1706.03762
 *
 * Time Complexity: O(n² × d) where n is sequence length, d is embedding dimension
 * Space Complexity: O(n² + n×d)
 */

/**
 * Matrix type (2D array)
 */
export type Matrix = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Vector type
 */
export type Vector = ReadonlyArray<number>;

/**
 * Attention configuration
 */
export interface AttentionConfig {
  /** Embedding dimension */
  readonly embedDim: number;
  /** Whether to use scaled dot-product attention */
  readonly scaled?: boolean;
  /** Dropout probability (0-1) */
  readonly dropout?: number;
}

/**
 * Attention output
 */
export interface AttentionOutput {
  /** Output values after applying attention */
  readonly output: Matrix;
  /** Attention weights (for visualization) */
  readonly weights: Matrix;
}

/**
 * Scaled Dot-Product Attention
 *
 * Attention(Q, K, V) = softmax(Q×Kᵀ / √d_k) × V
 *
 * Where:
 * - Q: Query matrix (n × d_k)
 * - K: Key matrix (m × d_k)
 * - V: Value matrix (m × d_v)
 * - n: target sequence length
 * - m: source sequence length
 * - d_k: key/query dimension
 * - d_v: value dimension
 *
 * @param queries - Query vectors
 * @param keys - Key vectors
 * @param values - Value vectors
 * @param config - Attention configuration
 * @returns Attention output with weights
 */
export function scaledDotProductAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  config: AttentionConfig
): AttentionOutput {
  const { embedDim, scaled = true, dropout = 0 } = config;

  const n = queries.length; // Target sequence length
  const m = keys.length;    // Source sequence length

  // Validate dimensions
  if (keys.length !== values.length) {
    throw new Error('Keys and values must have same sequence length');
  }

  // Step 1: Compute attention scores (Q × Kᵀ)
  const scores: number[][] = [];
  for (let i = 0; i < n; i++) {
    scores[i] = [];
    for (let j = 0; j < m; j++) {
      let score = 0;
      for (let k = 0; k < embedDim; k++) {
        score += (queries[i]?.[k] || 0) * (keys[j]?.[k] || 0);
      }

      // Scale by √d_k to prevent softmax saturation
      if (scaled) {
        score /= Math.sqrt(embedDim);
      }

      scores[i]![j] = score;
    }
  }

  // Step 2: Apply softmax to get attention weights
  const weights = softmax2D(scores);

  // Step 3: Apply dropout (during training)
  const droppedWeights = applyDropout(weights, dropout);

  // Step 4: Compute weighted sum of values
  const output: number[][] = [];
  const valueDim = values[0]?.length || 0;

  for (let i = 0; i < n; i++) {
    output[i] = new Array(valueDim).fill(0);
    for (let j = 0; j < m; j++) {
      const weight = droppedWeights[i]?.[j] || 0;
      for (let k = 0; k < valueDim; k++) {
        const currentVal = output[i]?.[k];
        if (currentVal !== undefined) {
          output[i]![k] = currentVal + weight * (values[j]?.[k] || 0);
        }
      }
    }
  }

  return { output, weights };
}

/**
 * Self-Attention
 *
 * Special case where Q, K, V come from the same sequence.
 * Used in encoder layers.
 *
 * @param input - Input sequence
 * @param wq - Query weight matrix
 * @param wk - Key weight matrix
 * @param wv - Value weight matrix
 * @param config - Attention configuration
 */
export function selfAttention(
  input: Matrix,
  wq: Matrix,
  wk: Matrix,
  wv: Matrix,
  config: AttentionConfig
): AttentionOutput {
  // Project input to Q, K, V
  const queries = matmul(input, wq);
  const keys = matmul(input, wk);
  const values = matmul(input, wv);

  return scaledDotProductAttention(queries, keys, values, config);
}

/**
 * Additive Attention (Bahdanau Attention)
 *
 * An alternative to dot-product attention.
 * score(q, k) = v^T × tanh(W₁×q + W₂×k)
 *
 * @param queries - Query vectors
 * @param keys - Key vectors
 * @param values - Value vectors
 * @param w1 - Query projection weights
 * @param w2 - Key projection weights
 * @param v - Combination weights
 */
export function additiveAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  w1: Matrix,
  w2: Matrix,
  v: Vector
): AttentionOutput {
  const n = queries.length;
  const m = keys.length;

  // Compute attention scores
  const scores: number[][] = [];

  for (let i = 0; i < n; i++) {
    scores[i] = [];
    const q = queries[i]!;

    for (let j = 0; j < m; j++) {
      const k = keys[j]!;

      // W₁×q + W₂×k
      const combined = new Array(w1.length).fill(0);
      for (let d = 0; d < w1.length; d++) {
        let sum = 0;
        for (let e = 0; e < q.length; e++) {
          sum += (w1[d]?.[e] || 0) * (q[e] || 0);
        }
        for (let e = 0; e < k.length; e++) {
          sum += (w2[d]?.[e] || 0) * (k[e] || 0);
        }
        combined[d] = Math.tanh(sum);
      }

      // v^T × tanh(...)
      let score = 0;
      for (let d = 0; d < v.length; d++) {
        score += (v[d] || 0) * combined[d]!;
      }

      scores[i]![j] = score;
    }
  }

  // Apply softmax
  const weights = softmax2D(scores);

  // Compute weighted values
  const output: number[][] = [];
  const valueDim = values[0]?.length || 0;

  for (let i = 0; i < n; i++) {
    output[i] = new Array(valueDim).fill(0);
    for (let j = 0; j < m; j++) {
      const weight = weights[i]?.[j] || 0;
      for (let k = 0; k < valueDim; k++) {
        const currentVal = output[i]?.[k];
        if (currentVal !== undefined) {
          output[i]![k] = currentVal + weight * (values[j]?.[k] || 0);
        }
      }
    }
  }

  return { output, weights };
}

/**
 * Causal (Masked) Attention
 *
 * Prevents positions from attending to subsequent positions.
 * Used in decoder layers for autoregressive generation.
 *
 * @param queries - Query vectors
 * @param keys - Key vectors
 * @param values - Value vectors
 * @param config - Attention configuration
 */
export function causalAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  config: AttentionConfig
): AttentionOutput {
  const { embedDim, scaled = true } = config;

  const n = queries.length;
  const m = keys.length;

  // Compute scores with causal mask
  const scores: number[][] = [];
  const maskValue = -1e9; // Large negative value for softmax

  for (let i = 0; i < n; i++) {
    scores[i] = [];
    for (let j = 0; j < m; j++) {
      // Mask future positions (j > i)
      if (j > i) {
        scores[i]![j] = maskValue;
        continue;
      }

      let score = 0;
      for (let k = 0; k < embedDim; k++) {
        score += (queries[i]?.[k] || 0) * (keys[j]?.[k] || 0);
      }

      if (scaled) {
        score /= Math.sqrt(embedDim);
      }

      scores[i]![j] = score;
    }
  }

  // Apply softmax (masked positions will have ~0 weight)
  const weights = softmax2D(scores);

  // Compute output
  const output: number[][] = [];
  const valueDim = values[0]?.length || 0;

  for (let i = 0; i < n; i++) {
    output[i] = new Array(valueDim).fill(0);
    for (let j = 0; j < m; j++) {
      const weight = weights[i]?.[j] || 0;
      for (let k = 0; k < valueDim; k++) {
        const currentVal = output[i]?.[k];
        if (currentVal !== undefined) {
          output[i]![k] = currentVal + weight * (values[j]?.[k] || 0);
        }
      }
    }
  }

  return { output, weights };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Apply softmax to 2D array (row-wise)
 */
function softmax2D(matrix: number[][]): number[][] {
  return matrix.map(row => {
    const maxVal = Math.max(...row);
    const exps = row.map(x => Math.exp(x - maxVal)); // Numerical stability
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
  });
}

/**
 * Apply dropout to matrix
 */
function applyDropout(matrix: number[][], probability: number): number[][] {
  if (probability === 0) return matrix;

  const scale = 1 / (1 - probability);
  return matrix.map(row =>
    row.map(val => {
      // During inference, we don't apply dropout
      // During training, randomly zero out elements
      if (Math.random() < probability) {
        return 0;
      }
      return val * scale; // Scale to maintain expected value
    })
  );
}

/**
 * Matrix multiplication
 */
function matmul(a: Matrix, b: Matrix): Matrix {
  const m = a.length;
  const n = b[0]?.length || 0;
  const p = b.length;

  if (a[0]?.length !== p) {
    throw new Error(`Matrix dimensions don't match: ${a[0]?.length} !== ${p}`);
  }

  const result: number[][] = [];

  for (let i = 0; i < m; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += (a[i]?.[k] || 0) * (b[k]?.[j] || 0);
      }
      result[i]![j] = sum;
    }
  }

  return result;
}

/**
 * Visualize attention weights
 *
 * Useful for debugging and interpretation
 */
export function visualizeAttention(weights: Matrix): string {
  let output = 'Attention Weights:\n';
  output += '  ';

  // Column headers
  for (let j = 0; j < weights[0]!.length; j++) {
    output += ` ${j.toString().padStart(4)}`;
  }
  output += '\n';

  // Rows
  for (let i = 0; i < weights.length; i++) {
    output += `${i.toString().padStart(2)}: `;
    for (let j = 0; j < weights[i]!.length; j++) {
      const val = weights[i]![j]!;
      const str = val.toFixed(2);
      output += ` ${str.padStart(4)}`;
    }
    output += '\n';
  }

  return output;
}

/**
 * Create random weight matrix for initialization
 */
export function randomWeights(rows: number, cols: number, scale = 0.1): Matrix {
  const weights: number[][] = [];
  for (let i = 0; i < rows; i++) {
    weights[i] = [];
    for (let j = 0; j < cols; j++) {
      // Xavier/Glorot initialization
      weights[i]![j] = (Math.random() * 2 - 1) * scale;
    }
  }
  return weights;
}
