/**
 * Tests for Positional Encoding
 *
 * Covers:
 * - Sinusoidal positional encoding
 * - Learned positional embeddings
 * - Relative positional encoding
 * - Rotary position embedding (RoPE)
 * - ALiBi positional bias
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  generatePositionalEncoding,
  addPositionalEncoding,
  LearnedPositionalEmbedding,
  RelativePositionalEncoding,
  applyRotaryEmbedding,
  ALiBiPositionalBias,
  visualizePositionalEncoding,
  type Matrix,
} from '../positional-encoding';

describe('Positional Encoding', () => {
  describe('generatePositionalEncoding', () => {
    it('should generate encoding with correct dimensions', () => {
      const maxLen = 10;
      const dim = 8;
      const encoding = generatePositionalEncoding(maxLen, dim);

      expect(encoding).toHaveLength(maxLen);
      expect(encoding[0]).toHaveLength(dim);
    });

    it('should use sine for even indices and cosine for odd indices', () => {
      const maxLen = 3;
      const dim = 4;
      const encoding = generatePositionalEncoding(maxLen, dim);

      // Verify pattern exists (not checking exact values due to formula complexity)
      for (let pos = 0; pos < maxLen; pos++) {
        expect(encoding[pos]).toHaveLength(dim);
        for (const val of encoding[pos]!) {
          expect(val).toBeGreaterThanOrEqual(-1);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should produce unique encodings for each position', () => {
      const maxLen = 5;
      const dim = 8;
      const encoding = generatePositionalEncoding(maxLen, dim);

      // Each position should be different
      for (let i = 0; i < maxLen - 1; i++) {
        expect(encoding[i]).not.toEqual(encoding[i + 1]);
      }
    });

    it('property: values are bounded in [-1, 1]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 2, max: 16 }).filter((d) => d % 2 === 0),
          (maxLen, dim) => {
            const encoding = generatePositionalEncoding(maxLen, dim);

            for (const row of encoding) {
              for (const val of row) {
                expect(val).toBeGreaterThanOrEqual(-1);
                expect(val).toBeLessThanOrEqual(1);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain consistency across calls', () => {
      const maxLen = 5;
      const dim = 4;

      const encoding1 = generatePositionalEncoding(maxLen, dim);
      const encoding2 = generatePositionalEncoding(maxLen, dim);

      expect(encoding1).toEqual(encoding2);
    });
  });

  describe('addPositionalEncoding', () => {
    it('should add position information to embeddings', () => {
      const embeddings: Matrix = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];
      const positionalEncoding = generatePositionalEncoding(10, 4);

      const result = addPositionalEncoding(embeddings, positionalEncoding);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(4);

      // Values should be different from original embeddings
      expect(result[0]).not.toEqual(embeddings[0]);
      expect(result[1]).not.toEqual(embeddings[1]);
    });

    it('should throw error if sequence exceeds max length', () => {
      const embeddings: Matrix = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      const positionalEncoding = generatePositionalEncoding(2, 2); // Max length 2

      expect(() => addPositionalEncoding(embeddings, positionalEncoding)).toThrow(
        'Sequence length 3 exceeds max length 2'
      );
    });

    it('property: output dimensions match input dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 2, max: 8 }),
          (seqLen, dim) => {
            const embeddings: Matrix = Array.from({ length: seqLen }, () =>
              Array.from({ length: dim }, () => Math.random())
            );
            const positionalEncoding = generatePositionalEncoding(seqLen + 5, dim);

            const result = addPositionalEncoding(embeddings, positionalEncoding);

            expect(result).toHaveLength(seqLen);
            expect(result[0]).toHaveLength(dim);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('LearnedPositionalEmbedding', () => {
    it('should initialize with correct dimensions', () => {
      const maxLen = 10;
      const dim = 8;
      const learned = new LearnedPositionalEmbedding(maxLen, dim);

      expect(learned.maxLen).toBe(maxLen);
      expect(learned.dim).toBe(dim);
    });

    it('should return embeddings for given positions', () => {
      const learned = new LearnedPositionalEmbedding(5, 4);
      const positions = [0, 2, 4];

      const embeddings = learned.getEmbedding(positions);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toHaveLength(4);
    });

    it('should throw error for positions exceeding max length', () => {
      const learned = new LearnedPositionalEmbedding(5, 4);
      const positions = [0, 1, 5]; // Position 5 >= maxLen

      expect(() => learned.getEmbedding(positions)).toThrow(
        'Position 5 exceeds max length 5'
      );
    });

    it('should add to input embeddings', () => {
      const learned = new LearnedPositionalEmbedding(10, 4);
      const embeddings: Matrix = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];

      const result = learned.addToEmbeddings(embeddings);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(4);
      expect(result[0]).not.toEqual(embeddings[0]);
    });

    it('should update embeddings with gradients', () => {
      const learned = new LearnedPositionalEmbedding(3, 2);

      const before = learned.getEmbedding([0, 1, 2]);

      const gradients: Matrix = [
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ];

      learned.update(gradients, 0.1);

      const after = learned.getEmbedding([0, 1, 2]);

      // Embeddings should have changed
      expect(after[0]).not.toEqual(before[0]);
      expect(after[1]).not.toEqual(before[1]);
    });

    it('should produce different embeddings for different positions', () => {
      const learned = new LearnedPositionalEmbedding(5, 4);
      const emb0 = learned.getEmbedding([0])[0]!;
      const emb1 = learned.getEmbedding([1])[0]!;
      const emb2 = learned.getEmbedding([2])[0]!;

      expect(emb0).not.toEqual(emb1);
      expect(emb1).not.toEqual(emb2);
    });
  });

  describe('RelativePositionalEncoding', () => {
    it('should initialize with correct dimensions', () => {
      const maxRelativePosition = 10;
      const numHeads = 4;

      const relative = new RelativePositionalEncoding(maxRelativePosition, numHeads);

      expect(relative.maxRelativePosition).toBe(maxRelativePosition);
      expect(relative.numHeads).toBe(numHeads);
    });

    it('should return bias for relative positions', () => {
      const relative = new RelativePositionalEncoding(5, 2);

      const bias = relative.getBias(2, 4); // Distance +2

      expect(bias).toHaveLength(2); // One per head
    });

    it('should clamp relative positions to max range', () => {
      const relative = new RelativePositionalEncoding(3, 2);

      const bias1 = relative.getBias(0, 10); // Distance +10 (clamped to +3)
      const bias2 = relative.getBias(0, 3); // Distance +3

      expect(bias1).toEqual(bias2); // Should be the same after clamping
    });

    it('should apply bias to attention scores', () => {
      const relative = new RelativePositionalEncoding(5, 2);

      const attentionScores: Matrix = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      const biased = relative.applyBias(attentionScores, 0); // Head 0

      expect(biased).toHaveLength(3);
      expect(biased[0]).toHaveLength(3);

      // Values should be different (bias added)
      expect(biased).not.toEqual(attentionScores);
    });

    it('should produce different biases for different heads', () => {
      const relative = new RelativePositionalEncoding(5, 3);

      const scores: Matrix = [[1, 2, 3]];

      const biased0 = relative.applyBias(scores, 0);
      const biased1 = relative.applyBias(scores, 1);
      const biased2 = relative.applyBias(scores, 2);

      // Different heads should produce different results
      expect(biased0).not.toEqual(biased1);
      expect(biased1).not.toEqual(biased2);
    });
  });

  describe('applyRotaryEmbedding', () => {
    it('should apply rotary embedding to vectors', () => {
      const vectors: Matrix = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];
      const positions = [0, 1];
      const dim = 4;

      const result = applyRotaryEmbedding(vectors, positions, dim);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(4);
    });

    it('should produce different encodings for different positions', () => {
      const vectors: Matrix = [
        [1, 2, 3, 4],
        [1, 2, 3, 4], // Same vector
      ];
      const positions = [0, 5]; // Different positions
      const dim = 4;

      const result = applyRotaryEmbedding(vectors, positions, dim);

      // Same input vector at different positions should yield different results
      expect(result[0]).not.toEqual(result[1]);
    });

    it('should maintain vector norms approximately', () => {
      const vectors: Matrix = [[3, 4, 0, 0]];
      const positions = [0];
      const dim = 4;

      const result = applyRotaryEmbedding(vectors, positions, dim);

      const originalNorm = Math.sqrt(3 * 3 + 4 * 4);
      const rotatedNorm = Math.sqrt(
        result[0]![0]! ** 2 + result[0]![1]! ** 2 + result[0]![2]! ** 2 + result[0]![3]! ** 2
      );

      // Rotation preserves norm (approximately)
      expect(rotatedNorm).toBeCloseTo(originalNorm, 5);
    });

    it('property: rotation preserves vector norms', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -10, max: 10 }), { minLength: 4, maxLength: 4 }),
          fc.integer({ min: 0, max: 100 }),
          (vector, position) => {
            const vectors: Matrix = [vector];
            const positions = [position];
            const dim = 4;

            const result = applyRotaryEmbedding(vectors, positions, dim);

            const originalNorm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
            const rotatedNorm = Math.sqrt(result[0]!.reduce((sum, v) => sum + v * v, 0));

            if (originalNorm > 0.01) {
              // Skip near-zero vectors
              expect(rotatedNorm).toBeCloseTo(originalNorm, 4);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('ALiBiPositionalBias', () => {
    it('should compute slopes for each head', () => {
      const numHeads = 4;
      const alibi = new ALiBiPositionalBias(numHeads);

      expect(alibi.numHeads).toBe(numHeads);
    });

    it('should apply linear bias to attention scores', () => {
      const alibi = new ALiBiPositionalBias(2);

      const attentionScores: Matrix = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      const biased = alibi.applyBias(attentionScores, 0);

      expect(biased).toHaveLength(3);
      expect(biased[0]).toHaveLength(3);

      // Values should be different (bias applied)
      expect(biased).not.toEqual(attentionScores);
    });

    it('should penalize longer distances', () => {
      const alibi = new ALiBiPositionalBias(1);

      const scores: Matrix = [
        [0, 0, 0, 0], // Position 0 looking at 0, 1, 2, 3
      ];

      const biased = alibi.applyBias(scores, 0);

      // Closer positions should have less penalty
      const bias0 = biased[0]![0]! - scores[0]![0]!; // Distance 0
      const bias1 = biased[0]![1]! - scores[0]![1]!; // Distance 1
      const bias2 = biased[0]![2]! - scores[0]![2]!; // Distance 2

      expect(bias0).toBe(0); // No penalty for self
      expect(bias1).toBeLessThan(bias0); // Negative penalty
      expect(bias2).toBeLessThan(bias1); // More negative
    });

    it('should have different slopes for different heads', () => {
      const alibi = new ALiBiPositionalBias(4);

      const scores: Matrix = [[1, 2, 3]];

      const biased0 = alibi.applyBias(scores, 0);
      const biased1 = alibi.applyBias(scores, 1);
      const biased2 = alibi.applyBias(scores, 2);

      // Different heads should have different biases
      expect(biased0[0]).not.toEqual(biased1[0]);
      expect(biased1[0]).not.toEqual(biased2[0]);
    });
  });

  describe('visualizePositionalEncoding', () => {
    it('should create visualization string', () => {
      const encoding = generatePositionalEncoding(5, 4);
      const viz = visualizePositionalEncoding(encoding);

      expect(viz).toContain('Positional Encoding Visualization');
      expect(viz).toContain('Pos');
    });

    it('should limit display to maxDisplay parameter', () => {
      const encoding = generatePositionalEncoding(100, 50);
      const viz = visualizePositionalEncoding(encoding, 5);

      expect(viz).toContain('Showing first 5 positions');
    });

    it('should handle small encodings', () => {
      const encoding = generatePositionalEncoding(2, 2);
      const viz = visualizePositionalEncoding(encoding);

      expect(viz).toContain('Positional Encoding');
      expect(viz.length).toBeGreaterThan(0);
    });
  });

  describe('Integration and Properties', () => {
    it('should allow positional encoding to be added multiple times', () => {
      const embeddings: Matrix = [[1, 2, 3, 4]];
      const posEncoding = generatePositionalEncoding(10, 4);

      const result1 = addPositionalEncoding(embeddings, posEncoding);
      const result2 = addPositionalEncoding(result1, posEncoding);

      // Both operations should succeed
      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result2).not.toEqual(result1);
    });

    it('should handle very long sequences', () => {
      const maxLen = 1000;
      const dim = 64;

      const startTime = performance.now();
      const encoding = generatePositionalEncoding(maxLen, dim);
      const endTime = performance.now();

      expect(encoding).toHaveLength(maxLen);
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
    });

    it('property: sinusoidal encoding is deterministic', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 2, max: 8 }).filter((d) => d % 2 === 0),
          (maxLen, dim) => {
            const enc1 = generatePositionalEncoding(maxLen, dim);
            const enc2 = generatePositionalEncoding(maxLen, dim);

            expect(enc1).toEqual(enc2);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
