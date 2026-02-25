/**
 * Transformer Block
 *
 * Complete transformer encoder and decoder blocks.
 * Combines multi-head attention, feed-forward networks, and normalization.
 *
 * "Attention Is All You Need" - Vaswani et al., 2017
 */

import type { Matrix } from './attention';
import {
  multiHeadSelfAttention,
  multiHeadCrossAttention,
  maskedMultiHeadAttention,
  type MultiHeadWeights,
  type MultiHeadAttentionConfig,
} from './multi-head-attention';

/**
 * Feed-forward network configuration
 */
export interface FFNConfig {
  /** Model dimension */
  readonly modelDim: number;
  /** Hidden dimension (typically 4× model dim) */
  readonly hiddenDim: number;
  /** Dropout probability */
  readonly dropout?: number;
}

/**
 * Feed-forward network weights
 */
export interface FFNWeights {
  /** First layer weights (modelDim → hiddenDim) */
  readonly w1: Matrix;
  /** First layer bias */
  readonly b1: ReadonlyArray<number>;
  /** Second layer weights (hiddenDim → modelDim) */
  readonly w2: Matrix;
  /** Second layer bias */
  readonly b2: ReadonlyArray<number>;
}

/**
 * Transformer encoder block configuration
 */
export interface EncoderBlockConfig {
  /** Model dimension */
  readonly modelDim: number;
  /** Number of attention heads */
  readonly numHeads: number;
  /** Feed-forward hidden dimension */
  readonly ffnHiddenDim: number;
  /** Dropout probability */
  readonly dropout?: number;
}

/**
 * Transformer encoder block weights
 */
export interface EncoderBlockWeights {
  /** Multi-head attention weights */
  readonly attention: MultiHeadWeights;
  /** Feed-forward network weights */
  readonly ffn: FFNWeights;
  /** Layer normalization parameters */
  readonly norm1: LayerNormParams;
  readonly norm2: LayerNormParams;
}

/**
 * Layer normalization parameters
 */
export interface LayerNormParams {
  /** Gain (scale) */
  readonly gamma: ReadonlyArray<number>;
  /** Bias (shift) */
  readonly beta: ReadonlyArray<number>;
}

/**
 * Position-wise Feed-Forward Network
 *
 * FFN(x) = max(0, x×W₁ + b₁)×W₂ + b₂
 *
 * Applied to each position independently and identically.
 */
export function feedForwardNetwork(
  input: Matrix,
  weights: FFNWeights,
  config: FFNConfig
): Matrix {
  const { dropout = 0 } = config;
  const seqLen = input.length;

  // First layer with ReLU activation
  const hidden: number[][] = [];
  for (let i = 0; i < seqLen; i++) {
    hidden[i] = [];
    for (let j = 0; j < weights.w1[0]!.length; j++) {
      let sum = weights.b1[j] || 0;
      for (let k = 0; k < input[i]!.length; k++) {
        sum += (input[i]?.[k] || 0) * (weights.w1[k]?.[j] || 0);
      }
      // ReLU activation
      hidden[i]![j] = Math.max(0, sum);
    }
  }

  // Apply dropout
  const droppedHidden = applyDropout(hidden, dropout);

  // Second layer
  const output: number[][] = [];
  for (let i = 0; i < seqLen; i++) {
    output[i] = [];
    for (let j = 0; j < weights.w2[0]!.length; j++) {
      let sum = weights.b2[j] || 0;
      for (let k = 0; k < droppedHidden[i]!.length; k++) {
        sum += (droppedHidden[i]?.[k] || 0) * (weights.w2[k]?.[j] || 0);
      }
      output[i]![j] = sum;
    }
  }

  return output;
}

/**
 * Layer Normalization
 *
 * LayerNorm(x) = γ × (x - μ) / √(σ² + ε) + β
 *
 * Normalizes across features (not batch like BatchNorm).
 */
export function layerNorm(
  input: Matrix,
  params: LayerNormParams,
  epsilon = 1e-6
): Matrix {
  const seqLen = input.length;
  const dim = input[0]?.length || 0;
  const output: number[][] = [];

  for (let i = 0; i < seqLen; i++) {
    const row = input[i]!;

    // Compute mean
    const mean = row.reduce((sum, val) => sum + val, 0) / dim;

    // Compute variance
    const variance = row.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dim;

    // Normalize
    output[i] = [];
    for (let j = 0; j < dim; j++) {
      const normalized = (row[j]! - mean) / Math.sqrt(variance + epsilon);
      output[i]![j] = params.gamma[j]! * normalized + (params.beta[j] || 0);
    }
  }

  return output;
}

/**
 * Transformer Encoder Block
 *
 * Architecture:
 * 1. Multi-head self-attention
 * 2. Add & Norm (residual connection + layer normalization)
 * 3. Feed-forward network
 * 4. Add & Norm
 */
export function transformerEncoderBlock(
  input: Matrix,
  weights: EncoderBlockWeights,
  config: EncoderBlockConfig
): Matrix {
  const { modelDim, numHeads, ffnHiddenDim, dropout = 0 } = config;

  // 1. Multi-head self-attention
  const attnConfig: MultiHeadAttentionConfig = {
    modelDim,
    numHeads,
    dropout,
  };

  const { output: attnOutput } = multiHeadSelfAttention(
    input,
    weights.attention,
    attnConfig
  );

  // 2. Add & Norm (post-norm variant)
  const attnResidual = addResidual(input, attnOutput);
  const norm1Output = layerNorm(attnResidual, weights.norm1);

  // 3. Feed-forward network
  const ffnConfig: FFNConfig = {
    modelDim,
    hiddenDim: ffnHiddenDim,
    dropout,
  };

  const ffnOutput = feedForwardNetwork(norm1Output, weights.ffn, ffnConfig);

  // 4. Add & Norm
  const ffnResidual = addResidual(norm1Output, ffnOutput);
  const output = layerNorm(ffnResidual, weights.norm2);

  return output;
}

/**
 * Transformer Decoder Block
 *
 * Architecture:
 * 1. Masked multi-head self-attention
 * 2. Add & Norm
 * 3. Multi-head cross-attention (with encoder output)
 * 4. Add & Norm
 * 5. Feed-forward network
 * 6. Add & Norm
 */
export interface DecoderBlockWeights {
  readonly selfAttention: MultiHeadWeights;
  readonly crossAttention: MultiHeadWeights;
  readonly ffn: FFNWeights;
  readonly norm1: LayerNormParams;
  readonly norm2: LayerNormParams;
  readonly norm3: LayerNormParams;
}

export function transformerDecoderBlock(
  input: Matrix,
  encoderOutput: Matrix,
  weights: DecoderBlockWeights,
  config: EncoderBlockConfig
): Matrix {
  const { modelDim, numHeads, ffnHiddenDim, dropout = 0 } = config;

  const attnConfig: MultiHeadAttentionConfig = {
    modelDim,
    numHeads,
    dropout,
  };

  // 1. Masked self-attention
  const { output: selfAttnOutput } = maskedMultiHeadAttention(
    input,
    input,
    input,
    weights.selfAttention,
    attnConfig
  );

  const residual1 = addResidual(input, selfAttnOutput);
  const norm1Output = layerNorm(residual1, weights.norm1);

  // 2. Cross-attention with encoder output
  const { output: crossAttnOutput } = multiHeadCrossAttention(
    norm1Output,
    encoderOutput,
    weights.crossAttention,
    attnConfig
  );

  const residual2 = addResidual(norm1Output, crossAttnOutput);
  const norm2Output = layerNorm(residual2, weights.norm2);

  // 3. Feed-forward network
  const ffnConfig: FFNConfig = {
    modelDim,
    hiddenDim: ffnHiddenDim,
    dropout,
  };

  const ffnOutput = feedForwardNetwork(norm2Output, weights.ffn, ffnConfig);

  const residual3 = addResidual(norm2Output, ffnOutput);
  const output = layerNorm(residual3, weights.norm3);

  return output;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Add residual connection
 */
function addResidual(input: Matrix, output: Matrix): Matrix {
  const seqLen = input.length;
  const dim = input[0]?.length || 0;
  const result: number[][] = [];

  for (let i = 0; i < seqLen; i++) {
    result[i] = [];
    for (let j = 0; j < dim; j++) {
      result[i]![j] = (input[i]?.[j] || 0) + (output[i]?.[j] || 0);
    }
  }

  return result;
}

/**
 * Apply dropout
 */
function applyDropout(matrix: Matrix, probability: number): Matrix {
  if (probability === 0) return matrix as Matrix;

  const scale = 1 / (1 - probability);
  return matrix.map(row =>
    row.map(val => (Math.random() < probability ? 0 : val * scale))
  );
}

/**
 * Initialize encoder block weights
 */
export function initializeEncoderWeights(config: EncoderBlockConfig): EncoderBlockWeights {
  const { modelDim, ffnHiddenDim } = config;

  // Multi-head attention weights (imported function handles this)
  const attention: MultiHeadWeights = {
    wq: [],
    wk: [],
    wv: [],
    wo: randomMatrix(modelDim, modelDim),
  };

  // Feed-forward network weights
  const ffn: FFNWeights = {
    w1: randomMatrix(modelDim, ffnHiddenDim),
    b1: new Array(ffnHiddenDim).fill(0),
    w2: randomMatrix(ffnHiddenDim, modelDim),
    b2: new Array(modelDim).fill(0),
  };

  // Layer norm parameters
  const norm1: LayerNormParams = {
    gamma: new Array(modelDim).fill(1),
    beta: new Array(modelDim).fill(0),
  };

  const norm2: LayerNormParams = {
    gamma: new Array(modelDim).fill(1),
    beta: new Array(modelDim).fill(0),
  };

  return { attention, ffn, norm1, norm2 };
}

/**
 * Random matrix initialization
 */
function randomMatrix(rows: number, cols: number): Matrix {
  const scale = Math.sqrt(2 / (rows + cols));
  const matrix: number[][] = [];

  for (let i = 0; i < rows; i++) {
    matrix[i] = [];
    for (let j = 0; j < cols; j++) {
      matrix[i]![j] = (Math.random() * 2 - 1) * scale;
    }
  }

  return matrix;
}
