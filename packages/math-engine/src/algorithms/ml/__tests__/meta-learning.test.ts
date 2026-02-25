/**
 * Tests for Meta-Learning Algorithms
 *
 * Covers:
 * - MAML (Model-Agnostic Meta-Learning)
 * - Prototypical Networks
 * - Matching Networks
 * - Reptile
 * - Few-shot learning scenarios
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  maml,
  prototypicalNetworks,
  matchingNetworks,
  reptile,
  cosineSimilarity,
  type Task,
  type Parameters,
  type ModelFunction,
  type LossFunction,
} from '../meta-learning';

describe('Meta-Learning Algorithms', () => {
  // Helper: Simple linear model
  const linearModel: ModelFunction = (input, params) => {
    return [input.reduce((sum, x, i) => sum + x * (params[i] || 0), params[params.length - 1] || 0)];
  };

  // Helper: Mean squared error loss
  const mseLoss: LossFunction = (prediction, label) => {
    return (prediction[0]! - label) ** 2;
  };

  // Helper: Create simple task
  const createSimpleTask = (slope: number, intercept: number): Task => {
    const support = {
      inputs: [
        [1],
        [2],
        [3],
      ],
      labels: [slope * 1 + intercept, slope * 2 + intercept, slope * 3 + intercept],
    };

    const query = {
      inputs: [
        [4],
        [5],
      ],
      labels: [slope * 4 + intercept, slope * 5 + intercept],
    };

    return { support, query };
  };

  describe('maml', () => {
    it('should meta-learn initialization for quick adaptation', () => {
      const tasks: Task[] = [createSimpleTask(2, 1), createSimpleTask(3, -1), createSimpleTask(1, 2)];

      const initialParams: Parameters = [0, 0]; // [slope, intercept]

      const config = {
        innerLR: 0.01,
        outerLR: 0.001,
        innerSteps: 3,
        outerSteps: 5,
      };

      const metaParams = maml(tasks, initialParams, linearModel, mseLoss, config);

      expect(metaParams).toHaveLength(2);

      // Meta-learned parameters should be different from initial
      expect(metaParams).not.toEqual(initialParams);
    });

    it('should handle multiple tasks in meta-training', () => {
      const numTasks = 5;
      const tasks: Task[] = Array.from({ length: numTasks }, (_, i) => createSimpleTask(i + 1, i));

      const initialParams: Parameters = [1, 0];

      const config = {
        innerLR: 0.01,
        outerLR: 0.001,
        innerSteps: 2,
        outerSteps: 3,
      };

      const metaParams = maml(tasks, initialParams, linearModel, mseLoss, config);

      expect(metaParams).toHaveLength(2);
    });

    it('should adapt parameters in inner loop', () => {
      const task = createSimpleTask(2, 3);

      const initialParams: Parameters = [0, 0];

      const config = {
        innerLR: 0.1,
        outerLR: 0.01,
        innerSteps: 10,
        outerSteps: 1,
      };

      const metaParams = maml([task], initialParams, linearModel, mseLoss, config);

      // With many inner steps, should adapt toward task
      expect(metaParams[0]).not.toBe(0);
    });

    it('property: output parameters have same dimension as input', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (paramDim) => {
          const task = createSimpleTask(1, 0);
          const initialParams: Parameters = Array(paramDim).fill(0);

          const config = {
            innerLR: 0.01,
            outerLR: 0.001,
            innerSteps: 1,
            outerSteps: 1,
          };

          const metaParams = maml([task], initialParams, linearModel, mseLoss, config);

          expect(metaParams).toHaveLength(paramDim);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('prototypicalNetworks', () => {
    it('should classify based on nearest prototype', () => {
      // Helper: identity embedding (no transformation)
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [1, 0], // Class 0
            [0, 1], // Class 1
            [1.1, 0.1], // Class 0
            [0.1, 1.1], // Class 1
          ],
          labels: [0, 1, 0, 1],
        },
        query: {
          inputs: [
            [0.9, 0], // Should be class 0
            [0, 0.9], // Should be class 1
          ],
          labels: [0, 1],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions).toHaveLength(2);
      expect(predictions[0]).toBe(0);
      expect(predictions[1]).toBe(1);
    });

    it('should compute class prototypes as centroids', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [1, 1],
            [2, 2], // Class 0: centroid at (1.5, 1.5)
            [10, 10],
            [11, 11], // Class 1: centroid at (10.5, 10.5)
          ],
          labels: [0, 0, 1, 1],
        },
        query: {
          inputs: [
            [1.5, 1.5], // Near class 0
            [10.5, 10.5], // Near class 1
          ],
          labels: [0, 1],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
      expect(predictions[1]).toBe(1);
    });

    it('should handle multiple classes', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
          labels: [0, 1, 2],
        },
        query: {
          inputs: [
            [0.9, 0.1, 0],
            [0, 0.9, 0.1],
            [0.1, 0, 0.9],
          ],
          labels: [0, 1, 2],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
      expect(predictions[1]).toBe(1);
      expect(predictions[2]).toBe(2);
    });

    it('should work with learned embeddings', () => {
      // Simple embedding: double the input
      const embedModel = (input: ReadonlyArray<number>) => input.map((x) => x * 2);

      const task: Task = {
        support: {
          inputs: [
            [1, 0],
            [0, 1],
          ],
          labels: [0, 1],
        },
        query: {
          inputs: [[1.1, 0]],
          labels: [0],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
    });
  });

  describe('matchingNetworks', () => {
    it('should use attention mechanism for classification', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;
      const attentionKernel = cosineSimilarity;

      const task: Task = {
        support: {
          inputs: [
            [1, 0],
            [0, 1],
          ],
          labels: [0, 1],
        },
        query: {
          inputs: [[1, 0]],
          labels: [0],
        },
      };

      const predictions = matchingNetworks(task, embedModel, attentionKernel);

      expect(predictions).toHaveLength(1);
      expect(predictions[0]).toBe(0); // Should match [1, 0]
    });

    it('should weight support examples by similarity', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;
      const attentionKernel = cosineSimilarity;

      const task: Task = {
        support: {
          inputs: [
            [1, 0], // Very similar to query
            [0, 1], // Not similar
            [0.9, 0.1], // Similar to query
          ],
          labels: [0, 1, 0],
        },
        query: {
          inputs: [[1, 0]],
          labels: [0],
        },
      };

      const predictions = matchingNetworks(task, embedModel, attentionKernel);

      expect(predictions[0]).toBe(0); // Should favor class 0
    });

    it('should handle ties gracefully', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;
      const attentionKernel = cosineSimilarity;

      const task: Task = {
        support: {
          inputs: [
            [1, 0],
            [0, 1],
          ],
          labels: [0, 1],
        },
        query: {
          inputs: [[0.5, 0.5]], // Equidistant
          labels: [0],
        },
      };

      const predictions = matchingNetworks(task, embedModel, attentionKernel);

      expect(predictions).toHaveLength(1);
      expect([0, 1]).toContain(predictions[0]!); // Either class is reasonable
    });
  });

  describe('reptile', () => {
    it('should meta-learn through parameter interpolation', () => {
      const tasks: Task[] = [createSimpleTask(2, 1), createSimpleTask(3, -1)];

      const initialParams: Parameters = [0, 0];

      const config = {
        innerLR: 0.01,
        outerLR: 0.1,
        innerSteps: 5,
        outerSteps: 3,
      };

      const metaParams = reptile(tasks, initialParams, linearModel, mseLoss, config);

      expect(metaParams).toHaveLength(2);
      expect(metaParams).not.toEqual(initialParams);
    });

    it('should move toward adapted parameters', () => {
      const task = createSimpleTask(2, 0);

      const initialParams: Parameters = [0, 0];

      const config = {
        innerLR: 0.1,
        outerLR: 0.5,
        innerSteps: 10,
        outerSteps: 5,
      };

      const metaParams = reptile([task], initialParams, linearModel, mseLoss, config);

      // Should move toward target (slope=2, intercept=0)
      expect(Math.abs(metaParams[0]! - 2)).toBeLessThan(Math.abs(initialParams[0]! - 2));
    });

    it('property: interpolates between initial and adapted parameters', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1 }), (outerLR) => {
          const task = createSimpleTask(1, 0);
          const initialParams: Parameters = [0, 0];

          const config = {
            innerLR: 0.01,
            outerLR,
            innerSteps: 1,
            outerSteps: 1,
          };

          const metaParams = reptile([task], initialParams, linearModel, mseLoss, config);

          expect(metaParams).toHaveLength(2);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('cosineSimilarity', () => {
    it('should compute cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      const sim = cosineSimilarity(a, b);

      expect(sim).toBeCloseTo(1.0, 5); // Identical vectors
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];

      const sim = cosineSimilarity(a, b);

      expect(sim).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0];
      const b = [-1, 0];

      const sim = cosineSimilarity(a, b);

      expect(sim).toBeCloseTo(-1, 5);
    });

    it('should be symmetric', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];

      const sim1 = cosineSimilarity(a, b);
      const sim2 = cosineSimilarity(b, a);

      expect(sim1).toBeCloseTo(sim2, 5);
    });

    it('property: similarity is in range [-1, 1]', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -10, max: 10 }), { minLength: 2, maxLength: 5 }),
          fc.array(fc.float({ min: -10, max: 10 }), { minLength: 2, maxLength: 5 }),
          (a, b) => {
            if (a.length !== b.length) return true;

            const sim = cosineSimilarity(a, b);

            if (isNaN(sim)) return true; // Skip zero vectors

            expect(sim).toBeGreaterThanOrEqual(-1);
            expect(sim).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Few-Shot Learning Scenarios', () => {
    it('should handle 1-shot learning (single example per class)', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [1, 0], // Class 0: 1 example
            [0, 1], // Class 1: 1 example
          ],
          labels: [0, 1],
        },
        query: {
          inputs: [
            [0.9, 0.1],
            [0.1, 0.9],
          ],
          labels: [0, 1],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
      expect(predictions[1]).toBe(1);
    });

    it('should handle 5-shot learning (five examples per class)', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            ...Array(5).fill([1, 0]),
            ...Array(5).fill([0, 1]),
          ].map((v) => v.map((x: number) => x + (Math.random() - 0.5) * 0.1)),
          labels: [...Array(5).fill(0), ...Array(5).fill(1)],
        },
        query: {
          inputs: [[1, 0]],
          labels: [0],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
    });

    it('should handle imbalanced support sets', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [1, 0],
            [1.1, 0], // 2 examples for class 0
            [0, 1], // 1 example for class 1
          ],
          labels: [0, 0, 1],
        },
        query: {
          inputs: [[1, 0]],
          labels: [0],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle high-dimensional embeddings', () => {
      const dim = 128;
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            Array(dim).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
            Array(dim).fill(0).map((_, i) => (i === 1 ? 1 : 0)),
          ],
          labels: [0, 1],
        },
        query: {
          inputs: [Array(dim).fill(0).map((_, i) => (i === 0 ? 1 : 0))],
          labels: [0],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
    });

    it('should handle single-class tasks', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [1, 0],
            [1.1, 0.1],
          ],
          labels: [0, 0], // All same class
        },
        query: {
          inputs: [[1, 0]],
          labels: [0],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions[0]).toBe(0);
    });

    it('should handle zero vectors gracefully', () => {
      const embedModel = (input: ReadonlyArray<number>) => input;

      const task: Task = {
        support: {
          inputs: [
            [0, 0],
            [1, 1],
          ],
          labels: [0, 1],
        },
        query: {
          inputs: [[0, 0]],
          labels: [0],
        },
      };

      const predictions = prototypicalNetworks(task, embedModel);

      expect(predictions).toHaveLength(1);
      expect([0, 1]).toContain(predictions[0]!);
    });
  });
});
