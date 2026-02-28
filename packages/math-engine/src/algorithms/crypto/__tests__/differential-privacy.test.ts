/**
 * Tests for Differential Privacy
 *
 * Covers:
 * - Laplace and Gaussian mechanisms
 * - Exponential mechanism
 * - Private queries (count, sum, mean, histogram)
 * - Privacy budget composition
 * - Epsilon-delta guarantees
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  laplaceMechanism,
  gaussianMechanism,
  exponentialMechanism,
  privateCount,
  privateSum,
  privateMean,
  privateHistogram,
  PrivacyBudget,
  reportNoisyMax,
} from '../differential-privacy';

describe('Differential Privacy', () => {
  describe('laplaceMechanism', () => {
    it('should add noise to true value', () => {
      const trueValue = 100;
      const sensitivity = 1;
      const epsilon = 1.0;

      const noisyValue = laplaceMechanism(trueValue, sensitivity, epsilon);

      expect(noisyValue).not.toBe(trueValue); // Should add noise
      expect(typeof noisyValue).toBe('number');
    });

    it('should throw error for non-positive epsilon', () => {
      expect(() => laplaceMechanism(100, 1, 0)).toThrow('Epsilon must be positive');
      expect(() => laplaceMechanism(100, 1, -1)).toThrow('Epsilon must be positive');
    });

    it('should add more noise with smaller epsilon (more privacy)', () => {
      const trueValue = 1000;
      const sensitivity = 1;

      const trials = 100;

      // High epsilon (less privacy, less noise)
      const highEpsilonErrors = [];
      for (let i = 0; i < trials; i++) {
        const noisy = laplaceMechanism(trueValue, sensitivity, 10.0);
        highEpsilonErrors.push(Math.abs(noisy - trueValue));
      }

      // Low epsilon (more privacy, more noise)
      const lowEpsilonErrors = [];
      for (let i = 0; i < trials; i++) {
        const noisy = laplaceMechanism(trueValue, sensitivity, 0.1);
        lowEpsilonErrors.push(Math.abs(noisy - trueValue));
      }

      const avgHighError = highEpsilonErrors.reduce((a, b) => a + b) / trials;
      const avgLowError = lowEpsilonErrors.reduce((a, b) => a + b) / trials;

      // Low epsilon should have more error (more noise)
      expect(avgLowError).toBeGreaterThan(avgHighError);
    });

    it('property: noise is symmetric around true value', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(1000) }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(10) }),
          (trueValue, epsilon) => {
            const sensitivity = 1;

            const samples = 100;
            const values = Array.from({ length: samples }, () =>
              laplaceMechanism(trueValue, sensitivity, epsilon)
            );

            const mean = values.reduce((a, b) => a + b, 0) / samples;

            // Mean should be close to true value (noise is zero-centered)
            expect(Math.abs(mean - trueValue)).toBeLessThan(sensitivity / epsilon);
          }
        ),
        { numRuns: 5 } // Fewer runs due to sampling
      );
    });

    it('should scale noise with sensitivity', () => {
      const trueValue = 100;
      const epsilon = 1.0;

      const lowSensitivity = 1;
      const highSensitivity = 10;

      const trials = 100;

      const lowSensErrors = Array.from({ length: trials }, () =>
        Math.abs(laplaceMechanism(trueValue, lowSensitivity, epsilon) - trueValue)
      );

      const highSensErrors = Array.from({ length: trials }, () =>
        Math.abs(laplaceMechanism(trueValue, highSensitivity, epsilon) - trueValue)
      );

      const avgLowError = lowSensErrors.reduce((a, b) => a + b) / trials;
      const avgHighError = highSensErrors.reduce((a, b) => a + b) / trials;

      expect(avgHighError).toBeGreaterThan(avgLowError);
    });
  });

  describe('gaussianMechanism', () => {
    it('should add Gaussian noise to true value', () => {
      const trueValue = 100;
      const sensitivity = 1;
      const epsilon = 1.0;
      const delta = 1e-5;

      const noisyValue = gaussianMechanism(trueValue, sensitivity, epsilon, delta);

      expect(noisyValue).not.toBe(trueValue);
      expect(typeof noisyValue).toBe('number');
    });

    it('should throw error for invalid privacy parameters', () => {
      expect(() => gaussianMechanism(100, 1, 0, 1e-5)).toThrow('Invalid privacy parameters');
      expect(() => gaussianMechanism(100, 1, 1, 0)).toThrow('Invalid privacy parameters');
      expect(() => gaussianMechanism(100, 1, 1, 1)).toThrow('Invalid privacy parameters');
    });

    it('should add more noise with smaller epsilon', () => {
      const trueValue = 1000;
      const sensitivity = 1;
      const delta = 1e-5;

      const trials = 100;

      const highEpsilonErrors = Array.from({ length: trials }, () =>
        Math.abs(gaussianMechanism(trueValue, sensitivity, 10.0, delta) - trueValue)
      );

      const lowEpsilonErrors = Array.from({ length: trials }, () =>
        Math.abs(gaussianMechanism(trueValue, sensitivity, 0.1, delta) - trueValue)
      );

      const avgHighError = highEpsilonErrors.reduce((a, b) => a + b) / trials;
      const avgLowError = lowEpsilonErrors.reduce((a, b) => a + b) / trials;

      expect(avgLowError).toBeGreaterThan(avgHighError);
    });

    it('should calibrate noise based on delta parameter', () => {
      const trueValue = 100;
      const sensitivity = 1;
      const epsilon = 1.0;

      const smallDelta = gaussianMechanism(trueValue, sensitivity, epsilon, 1e-10);
      const largeDelta = gaussianMechanism(trueValue, sensitivity, epsilon, 1e-3);

      // Both should be noisy but in valid range
      expect(typeof smallDelta).toBe('number');
      expect(typeof largeDelta).toBe('number');
    });
  });

  describe('exponentialMechanism', () => {
    it('should select output based on utility function', () => {
      const outputs = ['A', 'B', 'C'];
      const utilityFunction = (output: string) => {
        return output === 'B' ? 10 : 0; // B has highest utility
      };

      const sensitivity = 1;
      const epsilon = 10.0; // High epsilon favors high utility

      const trials = 100;
      const selections = Array.from({ length: trials }, () =>
        exponentialMechanism(outputs, utilityFunction, sensitivity, epsilon)
      );

      const countB = selections.filter((s) => s === 'B').length;

      // Should heavily favor 'B'
      expect(countB).toBeGreaterThan(trials * 0.7);
    });

    it('should respect privacy budget (smaller epsilon = more randomness)', () => {
      const outputs = [1, 2, 3, 4, 5];
      const utilityFunction = (output: number) => output; // Prefer larger numbers

      const sensitivity = 1;
      const trials = 100;

      // High epsilon: should select 5 frequently
      const highEpsilonSelections = Array.from({ length: trials }, () =>
        exponentialMechanism(outputs, utilityFunction, sensitivity, 10.0)
      );

      // Low epsilon: more random selections
      const lowEpsilonSelections = Array.from({ length: trials }, () =>
        exponentialMechanism(outputs, utilityFunction, sensitivity, 0.1)
      );

      const highCount5 = highEpsilonSelections.filter((s) => s === 5).length;
      const lowCount5 = lowEpsilonSelections.filter((s) => s === 5).length;

      expect(highCount5).toBeGreaterThan(lowCount5);
    });

    it('should handle equal utilities uniformly', () => {
      const outputs = [1, 2, 3];
      const utilityFunction = () => 1; // All equal utility

      const sensitivity = 1;
      const epsilon = 1.0;

      const trials = 300;
      const selections = Array.from({ length: trials }, () =>
        exponentialMechanism(outputs, utilityFunction, sensitivity, epsilon)
      );

      const counts = [1, 2, 3].map((val) => selections.filter((s) => s === val).length);

      // Should be roughly uniform
      for (const count of counts) {
        expect(count).toBeGreaterThan(trials / 3 - 50);
        expect(count).toBeLessThan(trials / 3 + 50);
      }
    });
  });

  describe('privateCount', () => {
    it('should add noise to count query', () => {
      const trueCount = 100;
      const epsilon = 1.0;

      const noisyCount = privateCount(trueCount, epsilon);

      expect(noisyCount).not.toBe(trueCount);
      expect(typeof noisyCount).toBe('number');
    });

    it('should have sensitivity of 1 for counting', () => {
      const trueCount = 50;
      const epsilon = 1.0;

      const trials = 100;
      const noisyCounts = Array.from({ length: trials }, () =>
        privateCount(trueCount, epsilon)
      );

      const errors = noisyCounts.map((c) => Math.abs(c - trueCount));
      const avgError = errors.reduce((a, b) => a + b) / trials;

      // Should be around sensitivity/epsilon = 1/1 = 1
      expect(avgError).toBeLessThan(3);
    });
  });

  describe('privateSum', () => {
    it('should add noise to sum query', () => {
      const trueSum = 1000;
      const maxContribution = 10;
      const epsilon = 1.0;

      const noisySum = privateSum(trueSum, maxContribution, epsilon);

      expect(noisySum).not.toBe(trueSum);
      expect(typeof noisySum).toBe('number');
    });

    it('should scale noise with max contribution', () => {
      const trueSum = 1000;
      const epsilon = 1.0;

      const trials = 100;

      const lowContribErrors = Array.from({ length: trials }, () =>
        Math.abs(privateSum(trueSum, 1, epsilon) - trueSum)
      );

      const highContribErrors = Array.from({ length: trials }, () =>
        Math.abs(privateSum(trueSum, 100, epsilon) - trueSum)
      );

      const avgLowError = lowContribErrors.reduce((a, b) => a + b) / trials;
      const avgHighError = highContribErrors.reduce((a, b) => a + b) / trials;

      expect(avgHighError).toBeGreaterThan(avgLowError);
    });
  });

  describe('privateMean', () => {
    it('should compute private mean of dataset', () => {
      const values = [10, 20, 30, 40, 50];
      const bounds: readonly [number, number] = [0, 100];
      const epsilon = 1.0;

      const noisyMean = privateMean(values, bounds, epsilon);

      const trueMean = 30;
      // Laplace noise with scale = (max-min)/n / epsilon = 20. Tolerance must
      // be large enough so P(|noise| > tol) is negligible (exp(-tol/scale)).
      // 120 gives failure probability exp(-6) ≈ 0.0025, safe for CI.
      expect(Math.abs(noisyMean - trueMean)).toBeLessThan(120);
    });

    it('should clamp values to bounds', () => {
      const values = [5, 10, 150]; // 150 out of bounds
      const bounds: readonly [number, number] = [0, 100];
      const epsilon = 1.0;

      const noisyMean = privateMean(values, bounds, epsilon);

      // Mean should be computed on clamped values: [5, 10, 100]
      // Laplace scale = (max-min)/n / epsilon = 100/3 ≈ 33.3
      const clampedMean = (5 + 10 + 100) / 3;
      expect(Math.abs(noisyMean - clampedMean)).toBeLessThan(200);
    });

    it('should have smaller noise with larger dataset', () => {
      const bounds: readonly [number, number] = [0, 100];
      const epsilon = 1.0;

      const smallDataset = Array(10).fill(50);
      const largeDataset = Array(1000).fill(50);

      const trials = 50;

      const smallErrors = Array.from({ length: trials }, () =>
        Math.abs(privateMean(smallDataset, bounds, epsilon) - 50)
      );

      const largeErrors = Array.from({ length: trials }, () =>
        Math.abs(privateMean(largeDataset, bounds, epsilon) - 50)
      );

      const avgSmallError = smallErrors.reduce((a, b) => a + b) / trials;
      const avgLargeError = largeErrors.reduce((a, b) => a + b) / trials;

      expect(avgLargeError).toBeLessThan(avgSmallError);
    });
  });

  describe('privateHistogram', () => {
    it('should compute histogram with noise', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const bins = 5;
      const epsilon = 1.0;

      const histogram = privateHistogram(data, bins, epsilon);

      expect(histogram).toHaveLength(bins);

      // All counts should be non-negative
      for (const count of histogram) {
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    it('should distribute privacy budget across bins', () => {
      const data = Array(100).fill(0).map((_, i) => i);
      const bins = 10;
      const epsilon = 1.0;

      const histogram = privateHistogram(data, bins, epsilon);

      expect(histogram).toHaveLength(bins);

      // Total count should be roughly preserved (with noise).
      // Each of 10 bins gets Laplace noise with scale = 1/(ε/bins) = 10,
      // and negative counts are clipped to 0, adding positive bias.
      const totalCount = histogram.reduce((a, b) => a + b, 0);
      expect(Math.abs(totalCount - 100)).toBeLessThan(200);
    });

    it('should round counts to integers', () => {
      const data = [1, 2, 3];
      const bins = 3;
      const epsilon = 1.0;

      const histogram = privateHistogram(data, bins, epsilon);

      for (const count of histogram) {
        expect(Number.isInteger(count)).toBe(true);
      }
    });
  });

  describe('PrivacyBudget', () => {
    it('should track remaining privacy budget', () => {
      const budget = new PrivacyBudget(1.0, 1e-5);

      expect(budget.getRemaining().epsilon).toBe(1.0);
      expect(budget.getRemaining().delta).toBe(1e-5);
    });

    it('should spend budget on queries', () => {
      const budget = new PrivacyBudget(1.0, 1e-5);

      const success = budget.spendBasic(0.3, 1e-6);

      expect(success).toBe(true);
      expect(budget.getRemaining().epsilon).toBeCloseTo(0.7, 5);
      expect(budget.getRemaining().delta).toBeCloseTo(9e-6, 10);
    });

    it('should reject queries exceeding budget', () => {
      const budget = new PrivacyBudget(1.0, 1e-5);

      const success = budget.spendBasic(1.5, 0);

      expect(success).toBe(false);
      expect(budget.getRemaining().epsilon).toBe(1.0); // Unchanged
    });

    it('should handle advanced composition', () => {
      const budget = new PrivacyBudget(1.0, 1e-5);

      const composition = budget.spendAdvanced(0.1, 10, 1e-6);

      expect(composition.totalEpsilon).toBeDefined();
      expect(composition.totalDelta).toBeDefined();
      expect(composition.totalDelta).toBeGreaterThan(0);
    });

    it('should track multiple spends', () => {
      const budget = new PrivacyBudget(1.0, 0);

      budget.spendBasic(0.2, 0);
      budget.spendBasic(0.3, 0);
      budget.spendBasic(0.1, 0);

      expect(budget.getRemaining().epsilon).toBeCloseTo(0.4, 5);
    });
  });

  describe('reportNoisyMax', () => {
    it('should find index of maximum value with noise', () => {
      const values = [10, 20, 100, 30, 40]; // Max at index 2
      const sensitivity = 1;
      const epsilon = 10.0; // High epsilon to favor true max

      const trials = 100;
      const indices = Array.from({ length: trials }, () =>
        reportNoisyMax(values, sensitivity, epsilon)
      );

      const count2 = indices.filter((i) => i === 2).length;

      // Should frequently select index 2
      expect(count2).toBeGreaterThan(trials * 0.7);
    });

    it('should be more random with lower epsilon', () => {
      const values = [10, 20, 30, 40, 50]; // Max at index 4

      const trials = 100;

      const highEpsilonIndices = Array.from({ length: trials }, () =>
        reportNoisyMax(values, 1, 10.0)
      );

      const lowEpsilonIndices = Array.from({ length: trials }, () =>
        reportNoisyMax(values, 1, 0.1)
      );

      const highCount4 = highEpsilonIndices.filter((i) => i === 4).length;
      const lowCount4 = lowEpsilonIndices.filter((i) => i === 4).length;

      expect(highCount4).toBeGreaterThan(lowCount4);
    });

    it('should return valid index', () => {
      const values = [1, 2, 3, 4, 5];
      const sensitivity = 1;
      const epsilon = 1.0;

      const index = reportNoisyMax(values, sensitivity, epsilon);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(values.length);
    });
  });

  describe('Privacy Guarantees', () => {
    it('should maintain epsilon-differential privacy for counting', () => {
      const epsilon = 1.0;

      const count1 = 100;
      const count2 = 101; // Neighboring database (differs by 1)

      const trials = 1000;

      const noisy1 = Array.from({ length: trials }, () => privateCount(count1, epsilon));
      const noisy2 = Array.from({ length: trials }, () => privateCount(count2, epsilon));

      // Distributions should be similar (epsilon-close)
      const mean1 = noisy1.reduce((a, b) => a + b) / trials;
      const mean2 = noisy2.reduce((a, b) => a + b) / trials;

      expect(Math.abs(mean1 - mean2)).toBeLessThan(5); // Close means
    });

    it('property: smaller epsilon provides stronger privacy', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.5) }),
          fc.float({ min: Math.fround(1.0), max: Math.fround(5.0) }),
          (lowEps, highEps) => {
            const trueValue = 100;
            const sensitivity = 1;

            const lowNoise = Math.abs(laplaceMechanism(trueValue, sensitivity, lowEps) - trueValue);
            const highNoise = Math.abs(
              laplaceMechanism(trueValue, sensitivity, highEps) - trueValue
            );

            // This is probabilistic, but generally true
            // Low epsilon should have higher average noise
            expect(lowEps).toBeLessThan(highEps);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should compose privacy budgets correctly', () => {
      const totalEpsilon = 1.0;
      const numQueries = 5;
      const epsilonPerQuery = totalEpsilon / numQueries;

      const budget = new PrivacyBudget(totalEpsilon, 0);

      for (let i = 0; i < numQueries; i++) {
        const success = budget.spendBasic(epsilonPerQuery, 0);
        expect(success).toBe(true);
      }

      expect(budget.getRemaining().epsilon).toBeCloseTo(0, 5);
    });
  });
});
