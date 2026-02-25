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
  scaledDotProductAttention,
  selfAttention,
  additiveAttention,
  causalAttention,
  visualizeAttention,
  randomWeights,
  type Matrix,
  type Vector,
  type AttentionConfig,
  type AttentionOutput,
} from './attention';

// Multi-head attention
export {
  multiHeadAttention,
  multiHeadSelfAttention,
  multiHeadCrossAttention,
  maskedMultiHeadAttention,
  initializeMultiHeadWeights,
  computeAttentionStats,
  type MultiHeadAttentionConfig,
  type MultiHeadWeights,
  type MultiHeadOutput,
} from './multi-head-attention';

// Positional encoding
export {
  generatePositionalEncoding,
  addPositionalEncoding,
  applyRotaryEmbedding,
  visualizePositionalEncoding,
  LearnedPositionalEmbedding,
  RelativePositionalEncoding,
  ALiBiPositionalBias,
} from './positional-encoding';

// Transformer blocks
export {
  transformerEncoderBlock,
  transformerDecoderBlock,
  feedForwardNetwork,
  layerNorm,
  initializeEncoderWeights,
  type EncoderBlockConfig,
  type EncoderBlockWeights,
  type DecoderBlockWeights,
  type FFNConfig,
  type FFNWeights,
  type LayerNormParams,
} from './transformer-block';
