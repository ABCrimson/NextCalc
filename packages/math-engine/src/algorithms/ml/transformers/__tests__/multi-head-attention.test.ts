/**
 * Tests for Multi-Head Attention
 *
 * Covers:
 * - Multi-head attention mechanism
 * - Head initialization and concatenation
 * - Self-attention, cross-attention, masked attention variants
 * - Attention statistics and diversity
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  multiHeadAttention,
  initializeMultiHeadWeights,
  multiHeadSelfAttention,
  multiHeadCrossAttention,
  maskedMultiHeadAttention,
  computeAttentionStats,
  type MultiHeadAttentionConfig,
  type Matrix,
} from '../multi-head-attention';

describe('Multi-Head Attention', () => {
  describe('multiHeadAttention', () => {
    it('should compute multi-head attention with correct dimensions', () => {
      const modelDim = 12;
      const numHeads = 3;
      const seqLen = 4;

      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: modelDim }, () => Math.random())
      );
      const keys: Matrix = [...queries];
      const values: Matrix = [...queries];

      const result = multiHeadAttention(queries, keys, values, weights, config);

      expect(result.output).toHaveLength(seqLen);
      expect(result.output[0]).toHaveLength(modelDim);
      expect(result.headWeights).toHaveLength(numHeads);
    });

    it('should throw error if modelDim not divisible by numHeads', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 13, numHeads: 4 };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]];
      const keys: Matrix = [...queries];
      const values: Matrix = [...queries];

      expect(() => multiHeadAttention(queries, keys, values, weights, config)).toThrow(
        'Model dimension 13 must be divisible by number of heads 4'
      );
    });

    it('should have each head process different subspace', () => {
      const modelDim = 8;
      const numHeads = 2;
      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8]];
      const keys: Matrix = [[8, 7, 6, 5, 4, 3, 2, 1]];
      const values: Matrix = [[1, 1, 1, 1, 1, 1, 1, 1]];

      const result = multiHeadAttention(queries, keys, values, weights, config);

      // Each head should produce attention weights
      expect(result.headWeights).toHaveLength(numHeads);
      for (const headWeight of result.headWeights) {
        expect(headWeight).toHaveLength(1); // 1 query
        expect(headWeight[0]).toHaveLength(1); // 1 key
      }
    });

    it('property: output dimension equals model dimension', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 16 }).chain((d) =>
            fc.record({
              modelDim: fc.constant(d),
              numHeads: fc.constantFrom(...[1, 2, 4].filter((h) => d % h === 0)),
              seqLen: fc.integer({ min: 1, max: 5 }),
            })
          ),
          ({ modelDim, numHeads, seqLen }) => {
            const config: MultiHeadAttentionConfig = { modelDim, numHeads };
            const weights = initializeMultiHeadWeights(config);

            const queries: Matrix = Array.from({ length: seqLen }, () =>
              Array.from({ length: modelDim }, () => Math.random())
            );
            const keys: Matrix = [...queries];
            const values: Matrix = [...queries];

            const result = multiHeadAttention(queries, keys, values, weights, config);

            expect(result.output).toHaveLength(seqLen);
            expect(result.output[0]).toHaveLength(modelDim);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should apply dropout when specified', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 8, numHeads: 2, dropout: 0.5 };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8]];
      const keys: Matrix = [...queries];
      const values: Matrix = [...queries];

      const result = multiHeadAttention(queries, keys, values, weights, config);

      // With dropout, results may vary but should still be valid
      expect(result.output).toHaveLength(1);
      expect(result.output[0]).toHaveLength(8);
    });
  });

  describe('initializeMultiHeadWeights', () => {
    it('should initialize weights with correct structure', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 12, numHeads: 3 };
      const weights = initializeMultiHeadWeights(config);

      expect(weights.wq).toHaveLength(3);
      expect(weights.wk).toHaveLength(3);
      expect(weights.wv).toHaveLength(3);

      // Each head weight should be modelDim × headDim
      const headDim = 12 / 3;
      expect(weights.wq[0]).toHaveLength(12);
      expect(weights.wq[0]![0]).toHaveLength(headDim);

      // Output projection should be modelDim × modelDim
      expect(weights.wo).toHaveLength(12);
      expect(weights.wo[0]).toHaveLength(12);
    });

    it('should create different weight matrices each time', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 8, numHeads: 2 };
      const w1 = initializeMultiHeadWeights(config);
      const w2 = initializeMultiHeadWeights(config);

      // Highly unlikely to be identical
      expect(w1.wq[0]).not.toEqual(w2.wq[0]);
      expect(w1.wo).not.toEqual(w2.wo);
    });

    it('should scale initialization appropriately', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 16, numHeads: 4 };
      const weights = initializeMultiHeadWeights(config);

      // Weights should be small (Xavier initialization)
      const flatWeights = weights.wo.flat();
      const maxWeight = Math.max(...flatWeights.map(Math.abs));
      expect(maxWeight).toBeLessThan(1.0); // Reasonable bound
    });
  });

  describe('multiHeadSelfAttention', () => {
    it('should apply self-attention (Q=K=V from same input)', () => {
      const modelDim = 8;
      const numHeads = 2;
      const seqLen = 3;

      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const input: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: modelDim }, () => Math.random())
      );

      const result = multiHeadSelfAttention(input, weights, config);

      expect(result.output).toHaveLength(seqLen);
      expect(result.headWeights).toHaveLength(numHeads);

      // Self-attention: each position attends to all positions
      for (const headWeight of result.headWeights) {
        expect(headWeight).toHaveLength(seqLen);
        expect(headWeight[0]).toHaveLength(seqLen);
      }
    });

    it('should have square attention weight matrices', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 12, numHeads: 3 };
      const weights = initializeMultiHeadWeights(config);

      const input: Matrix = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      ];

      const result = multiHeadSelfAttention(input, weights, config);

      for (const headWeight of result.headWeights) {
        expect(headWeight).toHaveLength(2); // n × n
        expect(headWeight[0]).toHaveLength(2);
      }
    });
  });

  describe('multiHeadCrossAttention', () => {
    it('should apply cross-attention (Q from decoder, K/V from encoder)', () => {
      const modelDim = 8;
      const numHeads = 2;

      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8]]; // Decoder
      const context: Matrix = [
        [8, 7, 6, 5, 4, 3, 2, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2],
      ]; // Encoder output

      const result = multiHeadCrossAttention(queries, context, weights, config);

      expect(result.output).toHaveLength(1); // Same as queries
      expect(result.output[0]).toHaveLength(modelDim);

      // Attention weights: 1 (queries) × 3 (context)
      for (const headWeight of result.headWeights) {
        expect(headWeight).toHaveLength(1);
        expect(headWeight[0]).toHaveLength(3);
      }
    });

    it('should allow different sequence lengths for queries and context', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 8, numHeads: 2 };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = [
        [1, 2, 3, 4, 5, 6, 7, 8],
        [8, 7, 6, 5, 4, 3, 2, 1],
      ]; // Length 2
      const context: Matrix = [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4],
      ]; // Length 4

      const result = multiHeadCrossAttention(queries, context, weights, config);

      expect(result.output).toHaveLength(2);

      // Attention: 2 × 4
      for (const headWeight of result.headWeights) {
        expect(headWeight).toHaveLength(2);
        expect(headWeight[0]).toHaveLength(4);
      }
    });
  });

  describe('maskedMultiHeadAttention', () => {
    it('should apply causal masking (prevent attending to future)', () => {
      const modelDim = 8;
      const numHeads = 2;
      const seqLen = 4;

      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const queries: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: modelDim }, () => Math.random())
      );
      const keys: Matrix = [...queries];
      const values: Matrix = [...queries];

      const result = maskedMultiHeadAttention(queries, keys, values, weights, config);

      // Check each head has causal pattern
      for (const headWeight of result.headWeights) {
        for (let i = 0; i < seqLen; i++) {
          for (let j = i + 1; j < seqLen; j++) {
            // Future positions should have ~0 weight
            expect(headWeight[i]![j]).toBeLessThan(0.01);
          }
        }
      }
    });

    it('should still sum attention weights to 1 per position', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 8, numHeads: 2 };
      const weights = initializeMultiHeadWeights(config);

      const seqLen = 3;
      const queries: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: 8 }, () => Math.random())
      );
      const keys: Matrix = [...queries];
      const values: Matrix = [...queries];

      const result = maskedMultiHeadAttention(queries, keys, values, weights, config);

      for (const headWeight of result.headWeights) {
        for (let i = 0; i < seqLen; i++) {
          const sum = headWeight[i]!.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1.0, 4);
        }
      }
    });
  });

  describe('computeAttentionStats', () => {
    it('should compute average entropy of attention distribution', () => {
      const headWeights: Matrix[] = [
        [
          [0.5, 0.5], // Uniform: high entropy
          [1.0, 0.0], // Peaked: low entropy
        ],
      ];

      const stats = computeAttentionStats(headWeights);

      expect(stats.avgEntropy).toBeGreaterThan(0);
      expect(stats.avgEntropy).toBeLessThan(1); // For 2 elements, max entropy is 1
    });

    it('should compute maximum attention weight per head', () => {
      const headWeights: Matrix[] = [
        [[0.7, 0.3]],
        [[0.2, 0.8]],
      ];

      const stats = computeAttentionStats(headWeights);

      expect(stats.maxAttention).toHaveLength(2);
      expect(stats.maxAttention[0]).toBeCloseTo(0.7, 5);
      expect(stats.maxAttention[1]).toBeCloseTo(0.8, 5);
    });

    it('should measure head diversity', () => {
      // Similar heads: low diversity
      const similarHeads: Matrix[] = [
        [[0.5, 0.5]],
        [[0.5, 0.5]],
      ];

      const similarStats = computeAttentionStats(similarHeads);
      expect(similarStats.headDiversity).toBeCloseTo(0, 1);

      // Different heads: higher diversity
      const differentHeads: Matrix[] = [
        [[1.0, 0.0]],
        [[0.0, 1.0]],
      ];

      const differentStats = computeAttentionStats(differentHeads);
      expect(differentStats.headDiversity).toBeGreaterThan(similarStats.headDiversity);
    });

    it('should return 0 diversity for single head', () => {
      const headWeights: Matrix[] = [[[0.3, 0.7]]];

      const stats = computeAttentionStats(headWeights);

      expect(stats.headDiversity).toBe(0);
    });
  });

  describe('Performance and Integration', () => {
    it('should handle large models efficiently', () => {
      const modelDim = 64;
      const numHeads = 8;
      const seqLen = 20;

      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const input: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: modelDim }, () => Math.random())
      );

      const startTime = performance.now();
      const result = multiHeadSelfAttention(input, weights, config);
      const endTime = performance.now();

      expect(result.output).toHaveLength(seqLen);
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
    });

    it('should maintain numerical stability with many heads', () => {
      const modelDim = 16;
      const numHeads = 16; // Many heads!

      const config: MultiHeadAttentionConfig = { modelDim, numHeads };
      const weights = initializeMultiHeadWeights(config);

      const input: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]];

      const result = multiHeadSelfAttention(input, weights, config);

      expect(result.output).toHaveLength(1);
      expect(result.headWeights).toHaveLength(16);

      // Check for NaN or Inf
      for (const val of result.output[0]!) {
        expect(isNaN(val)).toBe(false);
        expect(isFinite(val)).toBe(true);
      }
    });

    it('property: concatenation preserves information from all heads', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 12 }).chain((d) =>
            fc.record({
              modelDim: fc.constant(d),
              numHeads: fc.constantFrom(...[1, 2, 4].filter((h) => d % h === 0)),
            })
          ),
          ({ modelDim, numHeads }) => {
            const config: MultiHeadAttentionConfig = { modelDim, numHeads };
            const weights = initializeMultiHeadWeights(config);

            const input: Matrix = [[...Array.from({ length: modelDim }, (_, i) => i)]];

            const result = multiHeadSelfAttention(input, weights, config);

            // Output dimension should equal input dimension
            expect(result.output[0]).toHaveLength(modelDim);

            // Number of heads should match
            expect(result.headWeights).toHaveLength(numHeads);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle single token sequence', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 8, numHeads: 2 };
      const weights = initializeMultiHeadWeights(config);

      const input: Matrix = [[1, 2, 3, 4, 5, 6, 7, 8]];

      const result = multiHeadSelfAttention(input, weights, config);

      expect(result.output).toHaveLength(1);

      // Single token can only attend to itself
      for (const headWeight of result.headWeights) {
        expect(headWeight[0]![0]).toBeCloseTo(1.0, 5);
      }
    });

    it('should handle zero vectors in input', () => {
      const config: MultiHeadAttentionConfig = { modelDim: 4, numHeads: 2 };
      const weights = initializeMultiHeadWeights(config);

      const input: Matrix = [
        [0, 0, 0, 0],
        [1, 2, 3, 4],
      ];

      const result = multiHeadSelfAttention(input, weights, config);

      expect(result.output).toHaveLength(2);
      expect(result.output[0]).toHaveLength(4);

      // Should not produce NaN
      for (const row of result.output) {
        for (const val of row) {
          expect(isNaN(val)).toBe(false);
        }
      }
    });
  });
});
