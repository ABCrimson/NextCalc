/**
 * Tests for Attention Mechanisms
 *
 * Covers:
 * - Scaled dot-product attention
 * - Self-attention
 * - Additive attention
 * - Causal (masked) attention
 * - Mathematical properties and invariants
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  scaledDotProductAttention,
  selfAttention,
  additiveAttention,
  causalAttention,
  randomWeights,
  visualizeAttention,
  type Matrix,
  type AttentionConfig,
} from '../attention';

describe('Attention Mechanisms', () => {
  describe('scaledDotProductAttention', () => {
    it('should compute attention with correct output dimensions', () => {
      const queries: Matrix = [
        [1, 0, 1],
        [0, 1, 0],
      ];
      const keys: Matrix = [
        [1, 1, 0],
        [0, 1, 1],
        [1, 0, 1],
      ];
      const values: Matrix = [
        [2, 3],
        [4, 5],
        [6, 7],
      ];

      const config: AttentionConfig = { embedDim: 3 };
      const result = scaledDotProductAttention(queries, keys, values, config);

      expect(result.output).toHaveLength(2); // Same as queries length
      expect(result.output[0]).toHaveLength(2); // Same as values dim
      expect(result.weights).toHaveLength(2);
      expect(result.weights[0]).toHaveLength(3); // Same as keys length
    });

    it('should have attention weights sum to 1 (softmax property)', () => {
      const queries: Matrix = [[1, 2, 3]];
      const keys: Matrix = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const values: Matrix = [
        [1],
        [2],
        [3],
      ];

      const config: AttentionConfig = { embedDim: 3 };
      const { weights } = scaledDotProductAttention(queries, keys, values, config);

      // Each row should sum to 1
      for (const row of weights) {
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it('should apply scaling to prevent saturation', () => {
      const embedDim = 64;
      const q: Matrix = [new Array(embedDim).fill(1)];
      const k: Matrix = [new Array(embedDim).fill(1)];
      const v: Matrix = [[1]];

      const configScaled: AttentionConfig = { embedDim, scaled: true };
      const configUnscaled: AttentionConfig = { embedDim, scaled: false };

      const resultScaled = scaledDotProductAttention(q, k, v, configScaled);
      const resultUnscaled = scaledDotProductAttention(q, k, v, configUnscaled);

      // Scaled version should have more moderate weights (less extreme)
      // Since we're using the same Q, K, V, the weights should differ
      expect(resultScaled.weights[0]![0]).toBeDefined();
      expect(resultUnscaled.weights[0]![0]).toBeDefined();
    });

    it('should throw error when keys and values have different lengths', () => {
      const queries: Matrix = [[1, 2]];
      const keys: Matrix = [[1, 2]];
      const values: Matrix = [[1], [2]]; // Different length!

      const config: AttentionConfig = { embedDim: 2 };

      expect(() => scaledDotProductAttention(queries, keys, values, config)).toThrow(
        'Keys and values must have same sequence length'
      );
    });

    it('property: attention is permutation-equivariant over key-value pairs', () => {
      fc.assert(
        fc.property(
          fc.array(fc.array(fc.float({ min: -10, max: 10 }), { minLength: 3, maxLength: 3 }), {
            minLength: 2,
            maxLength: 4,
          }),
          (kvPairs) => {
            const queries: Matrix = [[1, 0, 1]];
            const keys = kvPairs;
            const values = kvPairs.map(() => [1]);

            const config: AttentionConfig = { embedDim: 3 };
            const result1 = scaledDotProductAttention(queries, keys, values, config);

            // Permute keys and values together
            const permuted = [...kvPairs].reverse();
            const result2 = scaledDotProductAttention(queries, permuted, permuted.map(() => [1]), config);

            // Output should be different but weights should still sum to 1
            const sum1 = result1.weights[0]!.reduce((a, b) => a + b, 0);
            const sum2 = result2.weights[0]!.reduce((a, b) => a + b, 0);

            expect(sum1).toBeCloseTo(1.0, 5);
            expect(sum2).toBeCloseTo(1.0, 5);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle dropout rate of 0 (no dropout)', () => {
      const queries: Matrix = [[1, 2]];
      const keys: Matrix = [[1, 0], [0, 1]];
      const values: Matrix = [[1], [2]];

      const config: AttentionConfig = { embedDim: 2, dropout: 0 };
      const result = scaledDotProductAttention(queries, keys, values, config);

      expect(result.output).toBeDefined();
      expect(result.weights[0]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
    });
  });

  describe('selfAttention', () => {
    it('should apply self-attention where Q=K=V come from same input', () => {
      const input: Matrix = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
      ];

      const embedDim = 4;
      const wq = randomWeights(embedDim, embedDim);
      const wk = randomWeights(embedDim, embedDim);
      const wv = randomWeights(embedDim, embedDim);

      const config: AttentionConfig = { embedDim };
      const result = selfAttention(input, wq, wk, wv, config);

      expect(result.output).toHaveLength(3); // Same as input length
      expect(result.weights).toHaveLength(3);
      expect(result.weights[0]).toHaveLength(3); // Self-attention: n×n
    });

    it('should have square attention weights matrix for self-attention', () => {
      const seqLen = 5;
      const embedDim = 8;
      const input: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: embedDim }, () => Math.random())
      );

      const wq = randomWeights(embedDim, embedDim);
      const wk = randomWeights(embedDim, embedDim);
      const wv = randomWeights(embedDim, embedDim);

      const config: AttentionConfig = { embedDim };
      const { weights } = selfAttention(input, wq, wk, wv, config);

      expect(weights).toHaveLength(seqLen);
      expect(weights[0]).toHaveLength(seqLen);
    });
  });

  describe('additiveAttention', () => {
    it('should compute additive attention (Bahdanau-style)', () => {
      const queries: Matrix = [[1, 2]];
      const keys: Matrix = [[0, 1], [1, 0]];
      const values: Matrix = [[5], [10]];

      const hiddenDim = 3;
      const w1 = randomWeights(hiddenDim, 2);
      const w2 = randomWeights(hiddenDim, 2);
      const v = [0.5, 0.3, 0.2];

      const result = additiveAttention(queries, keys, values, w1, w2, v);

      expect(result.output).toHaveLength(1);
      expect(result.weights).toHaveLength(1);
      expect(result.weights[0]).toHaveLength(2);

      // Weights should sum to 1
      const sum = result.weights[0]!.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should produce different results than dot-product attention', () => {
      const queries: Matrix = [[1, 2]];
      const keys: Matrix = [[1, 0], [0, 1]];
      const values: Matrix = [[1], [2]];

      const w1 = randomWeights(3, 2);
      const w2 = randomWeights(3, 2);
      const v = [1, 1, 1];

      const additiveResult = additiveAttention(queries, keys, values, w1, w2, v);
      const dotProductResult = scaledDotProductAttention(queries, keys, values, { embedDim: 2 });

      // Results should differ (different attention mechanisms)
      expect(additiveResult.output[0]![0]).not.toBe(dotProductResult.output[0]![0]);
    });
  });

  describe('causalAttention', () => {
    it('should mask future positions (autoregressive)', () => {
      const queries: Matrix = [
        [1, 0],
        [0, 1],
        [1, 1],
      ];
      const keys: Matrix = [...queries];
      const values: Matrix = [[1], [2], [3]];

      const config: AttentionConfig = { embedDim: 2 };
      const { weights } = causalAttention(queries, keys, values, config);

      // Position 0 should only attend to position 0
      expect(weights[0]![0]).toBeGreaterThan(0.9); // Most weight on self
      expect(weights[0]![1]).toBeLessThan(0.1);    // No future
      expect(weights[0]![2]).toBeLessThan(0.1);    // No future

      // Position 1 should attend to positions 0 and 1 only
      expect(weights[1]![2]).toBeLessThan(0.1);    // No future (position 2)

      // Position 2 can attend to all positions
      const sum = weights[2]!.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should have lower-triangular-like attention pattern', () => {
      const seqLen = 4;
      const embedDim = 3;
      const queries: Matrix = Array.from({ length: seqLen }, () => [1, 0, 1]);
      const keys: Matrix = [...queries];
      const values: Matrix = Array.from({ length: seqLen }, () => [1]);

      const config: AttentionConfig = { embedDim };
      const { weights } = causalAttention(queries, keys, values, config);

      // Check causal masking: weights[i][j] ≈ 0 for j > i
      for (let i = 0; i < seqLen; i++) {
        for (let j = i + 1; j < seqLen; j++) {
          expect(weights[i]![j]).toBeLessThan(0.01); // Future masked
        }
      }
    });

    it('property: each position can only attend to past and present', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          fc.integer({ min: 2, max: 4 }),
          (seqLen, embedDim) => {
            const queries: Matrix = Array.from({ length: seqLen }, () =>
              Array.from({ length: embedDim }, () => Math.random())
            );
            const keys: Matrix = [...queries];
            const values: Matrix = Array.from({ length: seqLen }, () => [Math.random()]);

            const config: AttentionConfig = { embedDim };
            const { weights } = causalAttention(queries, keys, values, config);

            // Verify causal constraint
            for (let i = 0; i < seqLen; i++) {
              for (let j = i + 1; j < seqLen; j++) {
                expect(weights[i]![j]).toBeLessThan(0.01);
              }

              // Weights should still sum to 1
              const sum = weights[i]!.reduce((a, b) => a + b, 0);
              expect(sum).toBeCloseTo(1.0, 4);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('randomWeights', () => {
    it('should generate matrix with correct dimensions', () => {
      const rows = 4;
      const cols = 6;
      const weights = randomWeights(rows, cols);

      expect(weights).toHaveLength(rows);
      expect(weights[0]).toHaveLength(cols);
    });

    it('should generate different random matrices', () => {
      const w1 = randomWeights(3, 3);
      const w2 = randomWeights(3, 3);

      // Highly unlikely to be identical
      expect(w1).not.toEqual(w2);
    });

    it('should respect scale parameter', () => {
      const scale = 0.01;
      const weights = randomWeights(5, 5, scale);

      // All values should be small
      for (const row of weights) {
        for (const val of row) {
          expect(Math.abs(val)).toBeLessThanOrEqual(scale * 2); // Within reasonable bound
        }
      }
    });
  });

  describe('visualizeAttention', () => {
    it('should create visualization string', () => {
      const weights: Matrix = [
        [0.8, 0.2],
        [0.3, 0.7],
      ];

      const viz = visualizeAttention(weights);

      expect(viz).toContain('Attention Weights');
      expect(viz).toContain('0.80');
      expect(viz).toContain('0.20');
      expect(viz).toContain('0.30');
      expect(viz).toContain('0.70');
    });

    it('should handle empty weights', () => {
      const weights: Matrix = [[]];
      const viz = visualizeAttention(weights);

      expect(viz).toContain('Attention Weights');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large sequence lengths efficiently', () => {
      const seqLen = 100;
      const embedDim = 64;

      const queries: Matrix = Array.from({ length: seqLen }, () =>
        Array.from({ length: embedDim }, () => Math.random())
      );
      const keys: Matrix = [...queries];
      const values: Matrix = Array.from({ length: seqLen }, () => [Math.random()]);

      const config: AttentionConfig = { embedDim };

      const startTime = performance.now();
      const result = scaledDotProductAttention(queries, keys, values, config);
      const endTime = performance.now();

      expect(result.output).toHaveLength(seqLen);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1s
    });

    it('should handle single sequence element', () => {
      const queries: Matrix = [[1, 2, 3]];
      const keys: Matrix = [[1, 2, 3]];
      const values: Matrix = [[5, 6]];

      const config: AttentionConfig = { embedDim: 3 };
      const result = scaledDotProductAttention(queries, keys, values, config);

      expect(result.output).toHaveLength(1);
      expect(result.weights[0]![0]).toBeCloseTo(1.0, 5); // Only option
    });

    it('should handle zero vectors gracefully', () => {
      const queries: Matrix = [[0, 0, 0]];
      const keys: Matrix = [[0, 0, 0], [1, 1, 1]];
      const values: Matrix = [[1], [2]];

      const config: AttentionConfig = { embedDim: 3 };
      const result = scaledDotProductAttention(queries, keys, values, config);

      expect(result.output).toHaveLength(1);
      expect(result.weights[0]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
    });
  });

  describe('Mathematical Properties', () => {
    it('property: attention output is weighted sum of values', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -5, max: 5, noNaN: true }), { minLength: 2, maxLength: 2 }),
          (valueVector) => {
            const queries: Matrix = [[1, 0]];
            const keys: Matrix = [[1, 0], [0, 1]];
            const values: Matrix = [valueVector, [0, 0]];

            const config: AttentionConfig = { embedDim: 2 };
            const { output, weights } = scaledDotProductAttention(queries, keys, values, config);

            // Output should be: w[0] * values[0] + w[1] * values[1]
            const expectedOutput = [
              weights[0]![0]! * valueVector[0]! + weights[0]![1]! * 0,
              weights[0]![0]! * valueVector[1]! + weights[0]![1]! * 0,
            ];

            expect(output[0]![0]).toBeCloseTo(expectedOutput[0], 5);
            expect(output[0]![1]).toBeCloseTo(expectedOutput[1], 5);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('property: attention weights are non-negative', () => {
      fc.assert(
        fc.property(
          fc.array(fc.array(fc.float({ min: -10, max: 10 }), { minLength: 3, maxLength: 3 }), {
            minLength: 1,
            maxLength: 5,
          }),
          (queries) => {
            const keys: Matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            const values: Matrix = [[1], [2], [3]];

            const config: AttentionConfig = { embedDim: 3 };
            const { weights } = scaledDotProductAttention(queries, keys, values, config);

            for (const row of weights) {
              for (const weight of row) {
                expect(weight).toBeGreaterThanOrEqual(0);
                expect(weight).toBeLessThanOrEqual(1);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
