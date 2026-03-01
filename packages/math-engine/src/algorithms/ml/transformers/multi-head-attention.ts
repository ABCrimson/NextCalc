/**
 * Multi-Head Attention
 *
 * Runs multiple attention mechanisms in parallel and combines their outputs.
 * Allows the model to jointly attend to information from different representation
 * subspaces at different positions.
 *
 * "Attention Is All You Need" - Vaswani et al., 2017
 *
 * Time Complexity: O(h × n² × d_k) where h is number of heads
 * Space Complexity: O(h × n² + n×d)
 */

import {
  type AttentionConfig,
  type AttentionOutput,
  type Matrix,
  randomWeights,
  scaledDotProductAttention,
} from './attention';

/**
 * Multi-head attention configuration
 */
export interface MultiHeadAttentionConfig {
  /** Model dimension (must be divisible by numHeads) */
  readonly modelDim: number;
  /** Number of attention heads */
  readonly numHeads: number;
  /** Dropout probability */
  readonly dropout?: number;
}

/**
 * Multi-head attention weights
 */
export interface MultiHeadWeights {
  /** Query projection weights for each head */
  readonly wq: ReadonlyArray<Matrix>;
  /** Key projection weights for each head */
  readonly wk: ReadonlyArray<Matrix>;
  /** Value projection weights for each head */
  readonly wv: ReadonlyArray<Matrix>;
  /** Output projection weights */
  readonly wo: Matrix;
}

/**
 * Multi-head attention output
 */
export interface MultiHeadOutput {
  /** Combined output from all heads */
  readonly output: Matrix;
  /** Attention weights from each head */
  readonly headWeights: ReadonlyArray<Matrix>;
}

/**
 * Multi-Head Attention
 *
 * Algorithm:
 * 1. Project Q, K, V to h different subspaces (heads)
 * 2. Run scaled dot-product attention in parallel for each head
 * 3. Concatenate all head outputs
 * 4. Project concatenated output back to model dimension
 *
 * MultiHead(Q, K, V) = Concat(head₁, ..., headₕ) × Wᵒ
 * where headᵢ = Attention(Q×Wᵢᵠ, K×Wᵢᵏ, V×Wᵢᵛ)
 *
 * @param queries - Query matrix (n × d_model)
 * @param keys - Key matrix (m × d_model)
 * @param values - Value matrix (m × d_model)
 * @param weights - Pre-initialized weight matrices
 * @param config - Multi-head configuration
 * @returns Output and attention weights from all heads
 */
export function multiHeadAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  weights: MultiHeadWeights,
  config: MultiHeadAttentionConfig,
): MultiHeadOutput {
  const { modelDim, numHeads, dropout = 0 } = config;

  // Validate configuration
  if (modelDim % numHeads !== 0) {
    throw new Error(`Model dimension ${modelDim} must be divisible by number of heads ${numHeads}`);
  }

  const headDim = modelDim / numHeads;

  // Store outputs and weights from each head
  const headOutputs: Matrix[] = [];
  const headWeights: Matrix[] = [];

  // Process each head in parallel (conceptually)
  for (let h = 0; h < numHeads; h++) {
    // Project to head-specific subspace
    const qHead = matmul(queries, weights.wq[h]!);
    const kHead = matmul(keys, weights.wk[h]!);
    const vHead = matmul(values, weights.wv[h]!);

    // Run attention for this head
    const attentionConfig: AttentionConfig = {
      embedDim: headDim,
      scaled: true,
      dropout,
    };

    const { output, weights: attnWeights } = scaledDotProductAttention(
      qHead,
      kHead,
      vHead,
      attentionConfig,
    );

    headOutputs.push(output);
    headWeights.push(attnWeights);
  }

  // Concatenate all head outputs
  const concatenated = concatenateHeads(headOutputs);

  // Final projection
  const output = matmul(concatenated, weights.wo);

  return {
    output,
    headWeights,
  };
}

/**
 * Initialize weights for multi-head attention
 *
 * Uses Xavier/Glorot initialization scaled by √(2/n)
 */
export function initializeMultiHeadWeights(config: MultiHeadAttentionConfig): MultiHeadWeights {
  const { modelDim, numHeads } = config;
  const headDim = modelDim / numHeads;

  const scale = Math.sqrt(2 / modelDim);

  // Initialize projection weights for each head
  const wq: Matrix[] = [];
  const wk: Matrix[] = [];
  const wv: Matrix[] = [];

  for (let h = 0; h < numHeads; h++) {
    wq.push(randomWeights(modelDim, headDim, scale));
    wk.push(randomWeights(modelDim, headDim, scale));
    wv.push(randomWeights(modelDim, headDim, scale));
  }

  // Output projection: concatenated dimension (modelDim) → modelDim
  const wo = randomWeights(modelDim, modelDim, scale);

  return { wq, wk, wv, wo };
}

/**
 * Multi-Head Self-Attention
 *
 * Special case where Q = K = V (same input sequence)
 */
export function multiHeadSelfAttention(
  input: Matrix,
  weights: MultiHeadWeights,
  config: MultiHeadAttentionConfig,
): MultiHeadOutput {
  return multiHeadAttention(input, input, input, weights, config);
}

/**
 * Cross-Attention (Encoder-Decoder Attention)
 *
 * Q comes from decoder, K and V come from encoder output.
 * Used in transformer decoder to attend to encoder representations.
 */
export function multiHeadCrossAttention(
  queries: Matrix, // From decoder
  context: Matrix, // From encoder (used as both K and V)
  weights: MultiHeadWeights,
  config: MultiHeadAttentionConfig,
): MultiHeadOutput {
  return multiHeadAttention(queries, context, context, weights, config);
}

/**
 * Masked Multi-Head Attention
 *
 * Applies causal masking to prevent attending to future positions.
 * Used in decoder self-attention.
 */
export function maskedMultiHeadAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  weights: MultiHeadWeights,
  config: MultiHeadAttentionConfig,
): MultiHeadOutput {
  const { modelDim, numHeads, dropout = 0 } = config;
  const headDim = modelDim / numHeads;

  const headOutputs: Matrix[] = [];
  const headWeights: Matrix[] = [];

  for (let h = 0; h < numHeads; h++) {
    const qHead = matmul(queries, weights.wq[h]!);
    const kHead = matmul(keys, weights.wk[h]!);
    const vHead = matmul(values, weights.wv[h]!);

    // Apply causal masking
    const { output, weights: attnWeights } = causalMaskedAttention(qHead, kHead, vHead, {
      embedDim: headDim,
      dropout,
    });

    headOutputs.push(output);
    headWeights.push(attnWeights);
  }

  const concatenated = concatenateHeads(headOutputs);
  const output = matmul(concatenated, weights.wo);

  return { output, headWeights };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Causal masked attention (prevents attending to future)
 */
function causalMaskedAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  config: AttentionConfig,
): AttentionOutput {
  const { embedDim } = config;
  const n = queries.length;
  const m = keys.length;

  // Compute scores with masking
  const scores: number[][] = [];
  const maskValue = -1e9;

  for (let i = 0; i < n; i++) {
    scores[i] = [];
    for (let j = 0; j < m; j++) {
      if (j > i) {
        scores[i]![j] = maskValue;
      } else {
        let score = 0;
        for (let k = 0; k < embedDim; k++) {
          score += (queries[i]?.[k] || 0) * (keys[j]?.[k] || 0);
        }
        score /= Math.sqrt(embedDim);
        scores[i]![j] = score;
      }
    }
  }

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

/**
 * Concatenate outputs from all heads
 */
function concatenateHeads(heads: ReadonlyArray<Matrix>): Matrix {
  if (heads.length === 0) return [];

  const seqLen = heads[0]!.length;
  const result: number[][] = [];

  for (let i = 0; i < seqLen; i++) {
    const row: number[] = [];
    for (const head of heads) {
      row.push(...(head[i] || []));
    }
    result[i] = row;
  }

  return result;
}

/**
 * Matrix multiplication
 */
function matmul(a: Matrix, b: Matrix): Matrix {
  const m = a.length;
  const n = b[0]?.length || 0;
  const p = b.length;

  if (a[0]?.length !== p) {
    throw new Error(`Matrix dimension mismatch: ${a[0]?.length} vs ${p}`);
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
 * Softmax (row-wise)
 */
function softmax2D(matrix: number[][]): number[][] {
  return matrix.map((row) => {
    const maxVal = Math.max(...row);
    const exps = row.map((x) => Math.exp(x - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((x) => x / sum);
  });
}

/**
 * Compute attention statistics for analysis
 */
export function computeAttentionStats(headWeights: ReadonlyArray<Matrix>): {
  avgEntropy: number;
  maxAttention: ReadonlyArray<number>;
  headDiversity: number;
} {
  // Average entropy across all heads (measures attention distribution)
  let totalEntropy = 0;
  let count = 0;

  for (const weights of headWeights) {
    for (const row of weights) {
      const entropy = -row.reduce((sum, p) => {
        if (p > 0) {
          return sum + p * Math.log2(p);
        }
        return sum;
      }, 0);
      totalEntropy += entropy;
      count++;
    }
  }

  const avgEntropy = totalEntropy / count;

  // Maximum attention weight in each head
  const maxAttention = headWeights.map((weights) => Math.max(...weights.flat()));

  // Head diversity (how different are the attention patterns?)
  const headDiversity = computeHeadDiversity(headWeights);

  return {
    avgEntropy,
    maxAttention,
    headDiversity,
  };
}

/**
 * Measure diversity between attention heads
 */
function computeHeadDiversity(headWeights: ReadonlyArray<Matrix>): number {
  if (headWeights.length < 2) return 0;

  let totalDissimilarity = 0;
  let comparisons = 0;

  // Compare each pair of heads
  for (let i = 0; i < headWeights.length; i++) {
    for (let j = i + 1; j < headWeights.length; j++) {
      const head1 = headWeights[i]!;
      const head2 = headWeights[j]!;

      // Compute Jensen-Shannon divergence
      const jsd = jensenShannonDivergence(head1, head2);
      totalDissimilarity += jsd;
      comparisons++;
    }
  }

  return totalDissimilarity / comparisons;
}

/**
 * Jensen-Shannon divergence between two distributions
 */
function jensenShannonDivergence(dist1: Matrix, dist2: Matrix): number {
  let jsd = 0;

  for (let i = 0; i < dist1.length; i++) {
    const row1 = dist1[i]!;
    const row2 = dist2[i]!;

    for (let j = 0; j < row1.length; j++) {
      const p = row1[j]!;
      const q = row2[j]!;
      const m = (p + q) / 2;

      if (p > 0) {
        jsd += p * Math.log2(p / m);
      }
      if (q > 0) {
        jsd += q * Math.log2(q / m);
      }
    }
  }

  return jsd / (2 * dist1.length);
}
