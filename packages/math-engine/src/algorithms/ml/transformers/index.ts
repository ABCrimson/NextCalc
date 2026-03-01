/**
 * Transformer Architecture Components
 *
 * Complete implementation of transformer building blocks:
 * - Attention mechanisms (scaled dot-product, multi-head)
 * - Positional encodings (sinusoidal, learned, rotary, ALiBi)
 * - Transformer blocks (encoder, decoder)
 * - Feed-forward networks
 * - Layer normalization
 *
 * Reference: "Attention Is All You Need" - Vaswani et al., 2017
 */

// Attention mechanisms
export {
  type AttentionConfig,
  type AttentionOutput,
  additiveAttention,
  causalAttention,
  type Matrix,
  randomWeights,
  scaledDotProductAttention,
  selfAttention,
  type Vector,
  visualizeAttention,
} from './attention';

// Multi-head attention
export {
  computeAttentionStats,
  initializeMultiHeadWeights,
  type MultiHeadAttentionConfig,
  type MultiHeadOutput,
  type MultiHeadWeights,
  maskedMultiHeadAttention,
  multiHeadAttention,
  multiHeadCrossAttention,
  multiHeadSelfAttention,
} from './multi-head-attention';

// Positional encoding
export {
  ALiBiPositionalBias,
  addPositionalEncoding,
  applyRotaryEmbedding,
  generatePositionalEncoding,
  LearnedPositionalEmbedding,
  RelativePositionalEncoding,
  visualizePositionalEncoding,
} from './positional-encoding';

// Transformer blocks
export {
  type DecoderBlockWeights,
  type EncoderBlockConfig,
  type EncoderBlockWeights,
  type FFNConfig,
  type FFNWeights,
  feedForwardNetwork,
  initializeEncoderWeights,
  type LayerNormParams,
  layerNorm,
  transformerDecoderBlock,
  transformerEncoderBlock,
} from './transformer-block';
