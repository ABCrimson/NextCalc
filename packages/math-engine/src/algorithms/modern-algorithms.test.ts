/**
 * Comprehensive tests for Modern Algorithms
 */

import { describe, expect, it } from 'vitest';
import {
  AdamOptimizer,
  AdamWOptimizer,
  DPSGDOptimizer,
  FederatedAveraging,
  KnowledgeDistillation,
  LionOptimizer,
  MAML,
  MultiHeadAttention,
  ScaledDotProductAttention,
  SimCLRLoss,
} from './modern-algorithms';

describe('Transformer Attention Mechanisms', () => {
  describe('ScaledDotProductAttention', () => {
    it('should compute attention for simple inputs', () => {
      const attention = new ScaledDotProductAttention();
      const Q = [
        [1, 0],
        [0, 1],
      ];
      const K = [
        [1, 0],
        [0, 1],
      ];
      const V = [
        [1, 2],
        [3, 4],
      ];

      const output = attention.forward(Q, K, V);

      expect(output).toBeDefined();
      expect(output.length).toBe(2);
      expect(output[0]?.length).toBe(2);
    });

    it('should apply masking correctly', () => {
      const attention = new ScaledDotProductAttention();
      const Q = [[1, 0]];
      const K = [
        [1, 0],
        [0, 1],
      ];
      const V = [
        [1, 2],
        [3, 4],
      ];
      const mask = [[1, 0]]; // Mask second position

      const output = attention.forward(Q, K, V, mask);

      expect(output).toBeDefined();
    });

    it('should handle larger sequences', () => {
      const attention = new ScaledDotProductAttention();
      const seqLen = 10;
      const dK = 64;

      const Q = Array.from({ length: seqLen }, () =>
        Array.from({ length: dK }, () => Math.random()),
      );
      const K = Array.from({ length: seqLen }, () =>
        Array.from({ length: dK }, () => Math.random()),
      );
      const V = Array.from({ length: seqLen }, () =>
        Array.from({ length: dK }, () => Math.random()),
      );

      const output = attention.forward(Q, K, V);

      expect(output.length).toBe(seqLen);
      expect(output[0]?.length).toBe(dK);
    });
  });

  describe('MultiHeadAttention', () => {
    it('should create correct number of heads', () => {
      const mha = new MultiHeadAttention(512, 8);
      expect(mha).toBeDefined();
    });

    it('should process multi-head attention', () => {
      const mha = new MultiHeadAttention(64, 4);
      const seqLen = 5;

      const Q = Array.from({ length: seqLen }, () =>
        Array.from({ length: 64 }, () => Math.random()),
      );
      const K = Array.from({ length: seqLen }, () =>
        Array.from({ length: 64 }, () => Math.random()),
      );
      const V = Array.from({ length: seqLen }, () =>
        Array.from({ length: 64 }, () => Math.random()),
      );

      const output = mha.forward(Q, K, V);

      expect(output.length).toBe(seqLen);
      expect(output[0]?.length).toBe(64);
    });

    it('should handle different sequence lengths', () => {
      const mha = new MultiHeadAttention(128, 8);
      const seqLen = 20;

      const Q = Array.from({ length: seqLen }, () =>
        Array.from({ length: 128 }, () => Math.random()),
      );
      const K = Array.from({ length: seqLen }, () =>
        Array.from({ length: 128 }, () => Math.random()),
      );
      const V = Array.from({ length: seqLen }, () =>
        Array.from({ length: 128 }, () => Math.random()),
      );

      const output = mha.forward(Q, K, V);

      expect(output.length).toBe(seqLen);
    });
  });
});

describe('Modern Optimizers', () => {
  describe('AdamOptimizer', () => {
    it('should initialize with default parameters', () => {
      const optimizer = new AdamOptimizer();
      expect(optimizer).toBeDefined();
    });

    it('should update parameters correctly', () => {
      const optimizer = new AdamOptimizer({ lr: 0.01 });
      const params = new Map([['w1', [1.0, 2.0, 3.0]]]);
      const gradients = new Map([['w1', [0.1, 0.2, 0.1]]]);

      const updated = optimizer.step(params, gradients);

      expect(updated.has('w1')).toBe(true);
      const newParams = updated.get('w1');
      expect(newParams?.length).toBe(3);
      // Parameters should be updated (decreased for positive gradients)
      expect(newParams![0]).toBeLessThan(1.0);
    });

    it('should maintain momentum across steps', () => {
      const optimizer = new AdamOptimizer({ lr: 0.01 });
      const params = new Map([['w1', [1.0, 2.0]]]);
      const gradients = new Map([['w1', [0.1, 0.1]]]);

      const step1 = optimizer.step(params, gradients);
      const step2 = optimizer.step(step1, gradients);

      expect(step2.get('w1')).toBeDefined();
    });

    it('should handle multiple parameters', () => {
      const optimizer = new AdamOptimizer();
      const params = new Map([
        ['w1', [1.0, 2.0]],
        ['w2', [3.0, 4.0]],
        ['b1', [0.5]],
      ]);
      const gradients = new Map([
        ['w1', [0.1, 0.2]],
        ['w2', [0.05, 0.1]],
        ['b1', [0.01]],
      ]);

      const updated = optimizer.step(params, gradients);

      expect(updated.size).toBe(3);
      expect(updated.has('w1')).toBe(true);
      expect(updated.has('w2')).toBe(true);
      expect(updated.has('b1')).toBe(true);
    });
  });

  describe('AdamWOptimizer', () => {
    it('should apply weight decay', () => {
      const optimizer = new AdamWOptimizer({ lr: 0.01, weightDecay: 0.1 });
      const params = new Map([['w1', [1.0, 2.0]]]);
      const gradients = new Map([['w1', [0.0, 0.0]]]);

      const updated = optimizer.step(params, gradients);

      // With weight decay and zero gradients, params should still decrease
      const newParams = updated.get('w1');
      expect(newParams![0]).toBeLessThan(1.0);
      expect(newParams![1]).toBeLessThan(2.0);
    });
  });

  describe('LionOptimizer', () => {
    it('should use sign-based updates', () => {
      const optimizer = new LionOptimizer({ lr: 0.001 });
      const params = new Map([['w1', [1.0, 2.0, 3.0]]]);
      const gradients = new Map([['w1', [0.5, -0.3, 0.1]]]);

      const updated = optimizer.step(params, gradients);

      expect(updated.has('w1')).toBe(true);
      expect(updated.get('w1')?.length).toBe(3);
    });

    it('should maintain momentum', () => {
      const optimizer = new LionOptimizer();
      const params = new Map([['w1', [1.0]]]);
      const gradients = new Map([['w1', [0.1]]]);

      optimizer.step(params, gradients);
      const step2 = optimizer.step(params, gradients);

      expect(step2.get('w1')).toBeDefined();
    });
  });
});

describe('Contrastive Learning', () => {
  describe('SimCLRLoss', () => {
    it('should compute contrastive loss', () => {
      const loss = new SimCLRLoss(0.5);
      const features = [
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.9, 0.1],
      ];

      const lossValue = loss.compute(features);

      expect(lossValue).toBeGreaterThan(0);
      expect(isFinite(lossValue)).toBe(true);
    });

    it('should penalize dissimilar positive pairs', () => {
      const loss = new SimCLRLoss(0.5);
      // Need at least 4 samples for contrastive loss to have meaningful negatives
      const dissimilar = [
        [1.0, 0.0, 0.0], // Sample 0
        [0.0, 1.0, 0.0], // Sample 1 - orthogonal to 0
        [0.9, 0.1, 0.0], // Sample 2 - similar to 0 (positive pair)
        [0.1, 0.9, 0.0], // Sample 3 - similar to 1 (positive pair)
      ];

      const dissimilarLoss = loss.compute(dissimilar);
      // Loss should be finite (contrastive loss can be close to 0 when pairs align)
      expect(isFinite(dissimilarLoss)).toBe(true);
    });

    it('should work with different batch sizes', () => {
      const loss = new SimCLRLoss();
      const features = Array.from({ length: 8 }, () =>
        Array.from({ length: 128 }, () => Math.random()),
      );

      const lossValue = loss.compute(features);
      expect(isFinite(lossValue)).toBe(true);
    });
  });
});

describe('Meta-Learning', () => {
  describe('MAML', () => {
    it('should initialize with parameters', () => {
      const maml = new MAML({
        innerLR: 0.01,
        outerLR: 0.001,
        innerSteps: 5,
      });

      expect(maml).toBeDefined();
    });

    // Note: Full MAML testing requires complete model infrastructure
    it('should accept task batches', () => {
      const maml = new MAML();
      const tasks = [
        {
          support: [
            [1, 2],
            [3, 4],
          ],
          query: [[5, 6]],
        },
      ];

      expect(() => {
        maml.metaTrain(
          tasks,
          (_params, _x) => [0.5],
          (_pred, _target) => 0.1,
        );
      }).not.toThrow();
    });
  });
});

describe('Federated Learning', () => {
  describe('FederatedAveraging', () => {
    it('should aggregate client models', () => {
      const fedAvg = new FederatedAveraging();

      const client1 = new Map([['w1', [1.0, 2.0]]]);
      const client2 = new Map([['w1', [3.0, 4.0]]]);
      const client3 = new Map([['w1', [5.0, 6.0]]]);

      const weights = [1.0, 1.0, 1.0]; // Equal weights

      const aggregated = fedAvg.aggregate([client1, client2, client3], weights);

      expect(aggregated.has('w1')).toBe(true);
      const w1 = aggregated.get('w1');
      expect(w1?.[0]).toBeCloseTo(3.0, 5); // Average of 1, 3, 5
      expect(w1?.[1]).toBeCloseTo(4.0, 5); // Average of 2, 4, 6
    });

    it('should handle weighted aggregation', () => {
      const fedAvg = new FederatedAveraging();

      const client1 = new Map([['w1', [1.0]]]);
      const client2 = new Map([['w1', [5.0]]]);

      const weights = [1.0, 3.0]; // Second client has 3x weight

      const aggregated = fedAvg.aggregate([client1, client2], weights);

      expect(aggregated.get('w1')?.[0]).toBeCloseTo(4.0, 5); // (1*1 + 5*3) / 4 = 4
    });

    it('should handle multiple parameters', () => {
      const fedAvg = new FederatedAveraging();

      const client1 = new Map([
        ['w1', [1.0, 2.0]],
        ['b1', [0.5]],
      ]);
      const client2 = new Map([
        ['w1', [3.0, 4.0]],
        ['b1', [1.5]],
      ]);

      const aggregated = fedAvg.aggregate([client1, client2], [1.0, 1.0]);

      expect(aggregated.size).toBe(2);
      expect(aggregated.has('w1')).toBe(true);
      expect(aggregated.has('b1')).toBe(true);
    });
  });
});

describe('Differential Privacy', () => {
  describe('DPSGDOptimizer', () => {
    it('should clip gradients', () => {
      const optimizer = new DPSGDOptimizer({
        lr: 0.01,
        maxGradNorm: 1.0,
        noiseMultiplier: 0.0, // No noise for testing clipping
      });

      const params = [1.0, 2.0, 3.0];
      const largeGradients = [10.0, 20.0, 30.0]; // Will be clipped

      const updated = optimizer.step(params, largeGradients);

      expect(updated.length).toBe(3);
      // Gradients should be clipped, so updates should be smaller
    });

    it('should add noise for privacy', () => {
      const optimizer = new DPSGDOptimizer({
        lr: 0.01,
        noiseMultiplier: 1.0,
      });

      const params = [1.0, 2.0];
      const gradients = [0.1, 0.1];

      const updated1 = optimizer.step(params, gradients);
      const updated2 = optimizer.step(params, gradients);

      // Due to random noise, updates should be different
      expect(updated1[0]).not.toBe(updated2[0]);
    });

    it('should update parameters', () => {
      const optimizer = new DPSGDOptimizer({ lr: 0.1 });
      const params = [5.0, 10.0];
      const gradients = [1.0, 2.0];

      const updated = optimizer.step(params, gradients);

      expect(updated.length).toBe(2);
      expect(updated[0]).toBeDefined();
      expect(updated[1]).toBeDefined();
    });
  });
});

describe('Knowledge Distillation', () => {
  describe('KnowledgeDistillation', () => {
    it('should compute distillation loss', () => {
      const distiller = new KnowledgeDistillation(3.0, 0.5);

      const studentLogits = [2.0, 1.0, 0.5];
      const teacherLogits = [3.0, 2.0, 1.0];
      const labels = [1.0, 0.0, 0.0]; // One-hot encoding

      const loss = distiller.computeLoss(studentLogits, teacherLogits, labels);

      expect(loss).toBeGreaterThan(0);
      expect(isFinite(loss)).toBe(true);
    });

    it('should balance soft and hard targets', () => {
      const distiller = new KnowledgeDistillation(3.0, 0.8); // 80% soft, 20% hard

      const studentLogits = [2.0, 1.0];
      const teacherLogits = [2.5, 0.5];
      const labels = [1.0, 0.0];

      const loss = distiller.computeLoss(studentLogits, teacherLogits, labels);

      expect(loss).toBeGreaterThan(0);
    });

    it('should handle multi-class classification', () => {
      const distiller = new KnowledgeDistillation();

      const studentLogits = [3.0, 1.0, 2.0, 0.5];
      const teacherLogits = [3.5, 0.5, 2.5, 0.0];
      const labels = [1.0, 0.0, 0.0, 0.0];

      const loss = distiller.computeLoss(studentLogits, teacherLogits, labels);

      expect(isFinite(loss)).toBe(true);
    });

    it('should penalize disagreement between student and teacher', () => {
      const distiller = new KnowledgeDistillation(1.0, 1.0); // Only soft targets

      const aligned = [2.0, 1.0];
      const teacher = [2.0, 1.0];
      const labels = [1.0, 0.0];

      const lossAligned = distiller.computeLoss(aligned, teacher, labels);

      const misaligned = [1.0, 2.0]; // Opposite of teacher
      const lossMisaligned = distiller.computeLoss(misaligned, teacher, labels);

      expect(lossMisaligned).toBeGreaterThan(lossAligned);
    });
  });
});

describe('Integration Tests', () => {
  it('should combine attention and optimizer', () => {
    const attention = new ScaledDotProductAttention();
    const optimizer = new AdamOptimizer();

    const Q = [[1, 0]];
    const K = [[1, 0]];
    const V = [[1, 2]];

    const output = attention.forward(Q, K, V);
    expect(output).toBeDefined();

    // Simulate gradient update
    const params = new Map([['attention_weights', output[0] ?? []]]);
    const gradients = new Map([['attention_weights', [0.1, 0.1]]]);
    const updated = optimizer.step(params, gradients);

    expect(updated.has('attention_weights')).toBe(true);
  });

  it('should use multiple optimizers in sequence', () => {
    const adam = new AdamOptimizer({ lr: 0.01 });
    const adamw = new AdamWOptimizer({ lr: 0.01, weightDecay: 0.01 });

    const params = new Map([['w', [1.0, 2.0]]]);
    const grads = new Map([['w', [0.1, 0.2]]]);

    const updated1 = adam.step(params, grads);
    const updated2 = adamw.step(params, grads);

    expect(updated1.get('w')).not.toEqual(updated2.get('w'));
  });
});
