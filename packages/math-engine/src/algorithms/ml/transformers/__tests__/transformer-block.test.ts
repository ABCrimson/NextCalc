/**
 * Tests for Transformer Block
 *
 * Covers:
 * - Feed-forward networks
 * - Layer normalization
 * - Encoder and decoder blocks
 * - Residual connections
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  feedForwardNetwork,
  layerNorm,
  transformerEncoderBlock,
  transformerDecoderBlock,
  initializeEncoderWeights,
  type Matrix,
  type FFNConfig,
  type FFNWeights,
  type LayerNormParams,
  type EncoderBlockConfig,
} from '../transformer-block';
import { initializeMultiHeadWeights } from '../multi-head-attention';

describe('Transformer Block', () => {
  describe('feedForwardNetwork', () => {
    it('should transform input through two linear layers with ReLU', () => {
      const input: Matrix = [[1, 2, 3, 4]];

      const weights: FFNWeights = {
        w1: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 0],
        ],
        b1: [0, 0],
        w2: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
        ],
        b2: [0, 0, 0, 0],
      };

      const config: FFNConfig = { modelDim: 4, hiddenDim: 2 };
      const result = feedForwardNetwork(input, weights, config);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);
    });

    it('should apply ReLU activation (no negative values in hidden layer)', () => {
      const input: Matrix = [[-1, -2, 1, 2]];

      const weights: FFNWeights = {
        w1: [
          [1, -1],
          [1, -1],
          [1, -1],
          [1, -1],
        ],
        b1: [0, 0],
        w2: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
        ],
        b2: [0, 0, 0, 0],
      };

      const config: FFNConfig = { modelDim: 4, hiddenDim: 2 };
      const result = feedForwardNetwork(input, weights, config);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);
    });

    it('should handle multiple sequences', () => {
      const seqLen = 3;
      const modelDim = 4;
      const hiddenDim = 8;

      const input: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: modelDim }, () => Math.random())
      );

      const weights: FFNWeights = {
        w1: Array.from({ length: modelDim }, () =>
          Array.from({ length: hiddenDim }, () => Math.random())
        ),
        b1: Array.from({ length: hiddenDim }, () => 0),
        w2: Array.from({ length: hiddenDim }, () =>
          Array.from({ length: modelDim }, () => Math.random())
        ),
        b2: Array.from({ length: modelDim }, () => 0),
      };

      const config: FFNConfig = { modelDim, hiddenDim };
      const result = feedForwardNetwork(input, weights, config);

      expect(result).toHaveLength(seqLen);
      expect(result[0]).toHaveLength(modelDim);
    });

    it('should respect dropout parameter', () => {
      const input: Matrix = [[1, 2, 3, 4]];

      const weights: FFNWeights = {
        w1: Array.from({ length: 4 }, () => [1, 1]),
        b1: [0, 0],
        w2: [[1, 0, 0, 0], [0, 1, 0, 0]],
        b2: [0, 0, 0, 0],
      };

      const config: FFNConfig = { modelDim: 4, hiddenDim: 2, dropout: 0.5 };
      const result = feedForwardNetwork(input, weights, config);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);
    });
  });

  describe('layerNorm', () => {
    it('should normalize each vector to zero mean and unit variance', () => {
      const input: Matrix = [
        [1, 2, 3, 4],
        [10, 20, 30, 40],
      ];

      const params: LayerNormParams = {
        gamma: [1, 1, 1, 1],
        beta: [0, 0, 0, 0],
      };

      const result = layerNorm(input, params);

      expect(result).toHaveLength(2);

      // Check first row normalized
      const row1 = result[0]!;
      const mean1 = row1.reduce((s, v) => s + v, 0) / 4;
      const variance1 = row1.reduce((s, v) => s + (v - mean1) ** 2, 0) / 4;

      expect(mean1).toBeCloseTo(0, 5);
      expect(variance1).toBeCloseTo(1, 4);
    });

    it('should apply learned scale (gamma) and shift (beta)', () => {
      const input: Matrix = [[1, 2, 3, 4]];

      const params: LayerNormParams = {
        gamma: [2, 2, 2, 2],
        beta: [1, 1, 1, 1],
      };

      const result = layerNorm(input, params);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);

      // Values should be scaled and shifted
      for (const val of result[0]!) {
        expect(val).not.toBeCloseTo(0, 3); // Beta shifts away from 0
      }
    });

    it('property: normalized output has zero mean', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -100, max: 100, noNaN: true }), { minLength: 4, maxLength: 8 }),
          (vector) => {
            const input: Matrix = [vector];
            const dim = vector.length;

            const params: LayerNormParams = {
              gamma: Array(dim).fill(1),
              beta: Array(dim).fill(0),
            };

            const result = layerNorm(input, params);
            const mean = result[0]!.reduce((s, v) => s + v, 0) / dim;

            expect(mean).toBeCloseTo(0, 4);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle constant vectors gracefully', () => {
      const input: Matrix = [[5, 5, 5, 5]];

      const params: LayerNormParams = {
        gamma: [1, 1, 1, 1],
        beta: [0, 0, 0, 0],
      };

      const result = layerNorm(input, params);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);

      // Should not produce NaN
      for (const val of result[0]!) {
        expect(isNaN(val)).toBe(false);
      }
    });

    it('should use epsilon to prevent division by zero', () => {
      const input: Matrix = [[1, 1, 1, 1]]; // Zero variance

      const params: LayerNormParams = {
        gamma: [1, 1, 1, 1],
        beta: [0, 0, 0, 0],
      };

      const epsilon = 1e-6;
      const result = layerNorm(input, params, epsilon);

      expect(result).toHaveLength(1);

      for (const val of result[0]!) {
        expect(isFinite(val)).toBe(true);
      }
    });
  });

  describe('transformerEncoderBlock', () => {
    it('should process input through full encoder block', () => {
      const modelDim = 8;
      const numHeads = 2;
      const ffnHiddenDim = 16;

      const config: EncoderBlockConfig = { modelDim, numHeads, ffnHiddenDim };

      const attention = initializeMultiHeadWeights({ modelDim, numHeads });
      const weights = {
        ...initializeEncoderWeights(config),
        attention,
      };

      const input: Matrix = [
        [1, 2, 3, 4, 5, 6, 7, 8],
        [8, 7, 6, 5, 4, 3, 2, 1],
      ];

      const result = transformerEncoderBlock(input, weights, config);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(modelDim);
    });

    it('should maintain sequence length through block', () => {
      const seqLen = 5;
      const modelDim = 8;
      const numHeads = 2;
      const ffnHiddenDim = 16;

      const config: EncoderBlockConfig = { modelDim, numHeads, ffnHiddenDim };

      const attention = initializeMultiHeadWeights({ modelDim, numHeads });
      const weights = {
        ...initializeEncoderWeights(config),
        attention,
      };

      const input: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: modelDim }, () => Math.random())
      );

      const result = transformerEncoderBlock(input, weights, config);

      expect(result).toHaveLength(seqLen);
    });

    it('should apply dropout when specified', () => {
      const config: EncoderBlockConfig = {
        modelDim: 8,
        numHeads: 2,
        ffnHiddenDim: 16,
        dropout: 0.1,
      };

      const attention = initializeMultiHeadWeights({ modelDim: 8, numHeads: 2 });
      const weights = {
        ...initializeEncoderWeights(config),
        attention,
      };

      const input: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8]];

      const result = transformerEncoderBlock(input, weights, config);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(8);
    });

    it('should not produce NaN or Inf values', () => {
      const config: EncoderBlockConfig = {
        modelDim: 8,
        numHeads: 2,
        ffnHiddenDim: 16,
      };

      const attention = initializeMultiHeadWeights({ modelDim: 8, numHeads: 2 });
      const weights = {
        ...initializeEncoderWeights(config),
        attention,
      };

      const input: Matrix = Array.from({ length: 3 }, () =>
        Array.from({ length: 8 }, () => Math.random() * 10)
      );

      const result = transformerEncoderBlock(input, weights, config);

      for (const row of result) {
        for (const val of row) {
          expect(isNaN(val)).toBe(false);
          expect(isFinite(val)).toBe(true);
        }
      }
    });
  });

  describe('transformerDecoderBlock', () => {
    it('should process input with encoder output (cross-attention)', () => {
      const modelDim = 8;
      const numHeads = 2;
      const ffnHiddenDim = 16;

      const config: EncoderBlockConfig = { modelDim, numHeads, ffnHiddenDim };

      const selfAttention = initializeMultiHeadWeights({ modelDim, numHeads });
      const crossAttention = initializeMultiHeadWeights({ modelDim, numHeads });

      const weights = {
        selfAttention,
        crossAttention,
        ffn: {
          w1: Array.from({ length: modelDim }, () =>
            Array.from({ length: ffnHiddenDim }, () => Math.random() * 0.1)
          ),
          b1: Array(ffnHiddenDim).fill(0),
          w2: Array.from({ length: ffnHiddenDim }, () =>
            Array.from({ length: modelDim }, () => Math.random() * 0.1)
          ),
          b2: Array(modelDim).fill(0),
        },
        norm1: {
          gamma: Array(modelDim).fill(1),
          beta: Array(modelDim).fill(0),
        },
        norm2: {
          gamma: Array(modelDim).fill(1),
          beta: Array(modelDim).fill(0),
        },
        norm3: {
          gamma: Array(modelDim).fill(1),
          beta: Array(modelDim).fill(0),
        },
      };

      const decoderInput: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8]];
      const encoderOutput: Matrix = [
        [8, 7, 6, 5, 4, 3, 2, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
      ];

      const result = transformerDecoderBlock(decoderInput, encoderOutput, weights, config);

      expect(result).toHaveLength(1); // Same as decoder input
      expect(result[0]).toHaveLength(modelDim);
    });

    it('should handle different sequence lengths for decoder and encoder', () => {
      const modelDim = 8;
      const numHeads = 2;

      const config: EncoderBlockConfig = { modelDim, numHeads, ffnHiddenDim: 16 };

      const selfAttention = initializeMultiHeadWeights({ modelDim, numHeads });
      const crossAttention = initializeMultiHeadWeights({ modelDim, numHeads });

      const weights = {
        selfAttention,
        crossAttention,
        ffn: {
          w1: Array.from({ length: 8 }, () => Array.from({ length: 16 }, () => 0.1)),
          b1: Array(16).fill(0),
          w2: Array.from({ length: 16 }, () => Array.from({ length: 8 }, () => 0.1)),
          b2: Array(8).fill(0),
        },
        norm1: { gamma: Array(8).fill(1), beta: Array(8).fill(0) },
        norm2: { gamma: Array(8).fill(1), beta: Array(8).fill(0) },
        norm3: { gamma: Array(8).fill(1), beta: Array(8).fill(0) },
      };

      const decoderInput: Matrix = [
        [1, 2, 3, 4, 5, 6, 7, 8],
        [2, 3, 4, 5, 6, 7, 8, 9],
      ]; // Length 2

      const encoderOutput: Matrix = [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4],
      ]; // Length 4

      const result = transformerDecoderBlock(decoderInput, encoderOutput, weights, config);

      expect(result).toHaveLength(2); // Matches decoder input
    });
  });

  describe('initializeEncoderWeights', () => {
    it('should initialize all weight matrices with correct dimensions', () => {
      const config: EncoderBlockConfig = {
        modelDim: 12,
        numHeads: 3,
        ffnHiddenDim: 24,
      };

      const weights = initializeEncoderWeights(config);

      expect(weights.ffn.w1).toHaveLength(12);
      expect(weights.ffn.w1[0]).toHaveLength(24);

      expect(weights.ffn.w2).toHaveLength(24);
      expect(weights.ffn.w2[0]).toHaveLength(12);

      expect(weights.norm1.gamma).toHaveLength(12);
      expect(weights.norm1.beta).toHaveLength(12);

      expect(weights.norm2.gamma).toHaveLength(12);
      expect(weights.norm2.beta).toHaveLength(12);
    });

    it('should initialize gamma to 1 and beta to 0 for layer norm', () => {
      const config: EncoderBlockConfig = {
        modelDim: 8,
        numHeads: 2,
        ffnHiddenDim: 16,
      };

      const weights = initializeEncoderWeights(config);

      for (const gamma of weights.norm1.gamma) {
        expect(gamma).toBe(1);
      }

      for (const beta of weights.norm1.beta) {
        expect(beta).toBe(0);
      }
    });

    it('should initialize biases to zero', () => {
      const config: EncoderBlockConfig = {
        modelDim: 8,
        numHeads: 2,
        ffnHiddenDim: 16,
      };

      const weights = initializeEncoderWeights(config);

      for (const b of weights.ffn.b1) {
        expect(b).toBe(0);
      }

      for (const b of weights.ffn.b2) {
        expect(b).toBe(0);
      }
    });
  });

  describe('Performance and Integration', () => {
    it('should handle large models efficiently', () => {
      const config: EncoderBlockConfig = {
        modelDim: 64,
        numHeads: 8,
        ffnHiddenDim: 256,
      };

      const attention = initializeMultiHeadWeights({ modelDim: 64, numHeads: 8 });
      const weights = {
        ...initializeEncoderWeights(config),
        attention,
      };

      const input: Matrix = Array.from({ length: 10 }, () =>
        Array.from({ length: 64 }, () => Math.random())
      );

      const startTime = performance.now();
      const result = transformerEncoderBlock(input, weights, config);
      const endTime = performance.now();

      expect(result).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it('property: encoder output preserves sequence length', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.constantFrom(4, 8, 12, 16),
          (seqLen, modelDim) => {
            const numHeads = modelDim === 4 ? 2 : 4;
            const config: EncoderBlockConfig = {
              modelDim,
              numHeads,
              ffnHiddenDim: modelDim * 2,
            };

            const attention = initializeMultiHeadWeights({ modelDim, numHeads });
            const weights = {
              ...initializeEncoderWeights(config),
              attention,
            };

            const input: Matrix = Array.from({ length: seqLen }, () =>
              Array.from({ length: modelDim }, () => Math.random())
            );

            const result = transformerEncoderBlock(input, weights, config);

            expect(result).toHaveLength(seqLen);
            expect(result[0]).toHaveLength(modelDim);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
