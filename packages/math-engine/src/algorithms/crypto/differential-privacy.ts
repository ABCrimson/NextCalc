/**
 * Differential Privacy
 *
 * Provides privacy-preserving mechanisms for data analysis.
 * Implements Laplacian and Gaussian mechanisms for achieving
 * (ε, δ)-differential privacy.
 *
 * Reference: "The Algorithmic Foundations of Differential Privacy" - Dwork & Roth
 *
 * Time Complexity: O(1) for basic mechanisms
 * Space Complexity: O(1)
 */

/**
 * Laplacian Mechanism
 *
 * Adds Laplace noise calibrated to sensitivity and privacy budget (ε).
 * Achieves ε-differential privacy.
 *
 * @param trueValue - True query result
 * @param sensitivity - Global sensitivity of the query
 * @param epsilon - Privacy budget (smaller = more privacy, less utility)
 * @returns Privatized result
 */
export function laplaceMechanism(
  trueValue: number,
  sensitivity: number,
  epsilon: number
): number {
  if (epsilon <= 0) {
    throw new Error('Epsilon must be positive');
  }

  // Scale parameter: Δf / ε
  const scale = sensitivity / epsilon;

  // Sample from Laplace distribution
  const noise = sampleLaplace(scale);

  return trueValue + noise;
}

/**
 * Gaussian Mechanism
 *
 * Adds Gaussian noise calibrated to sensitivity and privacy budget.
 * Achieves (ε, δ)-differential privacy.
 *
 * @param trueValue - True query result
 * @param sensitivity - L2 sensitivity
 * @param epsilon - Privacy budget
 * @param delta - Failure probability
 * @returns Privatized result
 */
export function gaussianMechanism(
  trueValue: number,
  sensitivity: number,
  epsilon: number,
  delta: number
): number {
  if (epsilon <= 0 || delta <= 0 || delta >= 1) {
    throw new Error('Invalid privacy parameters');
  }

  // Standard deviation: Δf × √(2 ln(1.25/δ)) / ε
  const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;

  const noise = sampleGaussian(0, sigma);

  return trueValue + noise;
}

/**
 * Exponential Mechanism
 *
 * Selects output based on utility function with differential privacy.
 * Used for non-numeric queries.
 *
 * @param outputs - Possible outputs
 * @param utilityFunction - Maps each output to utility score
 * @param sensitivity - Sensitivity of utility function
 * @param epsilon - Privacy budget
 * @returns Selected output with privacy guarantee
 */
export function exponentialMechanism<T>(
  outputs: ReadonlyArray<T>,
  utilityFunction: (output: T) => number,
  sensitivity: number,
  epsilon: number
): T {
  // Compute probabilities proportional to exp(ε × utility / (2×Δu))
  const scores = outputs.map(utilityFunction);
  const maxScore = Math.max(...scores);

  const weights = scores.map(score =>
    Math.exp((epsilon * (score - maxScore)) / (2 * sensitivity))
  );

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map(w => w / totalWeight);

  // Sample according to probabilities
  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < outputs.length; i++) {
    cumulative += probabilities[i]!;
    if (random < cumulative) {
      return outputs[i]!;
    }
  }

  return outputs[outputs.length - 1]!;
}

/**
 * Count Query with Differential Privacy
 *
 * @param count - True count
 * @param epsilon - Privacy budget
 * @returns Noisy count
 */
export function privateCount(count: number, epsilon: number): number {
  // Sensitivity of counting query is 1
  return laplaceMechanism(count, 1, epsilon);
}

/**
 * Sum Query with Differential Privacy
 *
 * @param sum - True sum
 * @param maxContribution - Maximum contribution per individual
 * @param epsilon - Privacy budget
 * @returns Noisy sum
 */
export function privateSum(
  sum: number,
  maxContribution: number,
  epsilon: number
): number {
  // Sensitivity is max contribution
  return laplaceMechanism(sum, maxContribution, epsilon);
}

/**
 * Mean Query with Differential Privacy
 *
 * @param values - Dataset
 * @param bounds - [min, max] value bounds
 * @param epsilon - Privacy budget
 * @returns Noisy mean
 */
export function privateMean(
  values: ReadonlyArray<number>,
  bounds: readonly [number, number],
  epsilon: number
): number {
  const [min, max] = bounds;
  const n = values.length;

  // Clamp values to bounds
  const clampedValues = values.map(v => Math.max(min, Math.min(max, v)));

  // True mean
  const trueMean = clampedValues.reduce((sum, v) => sum + v, 0) / n;

  // Sensitivity: (max - min) / n
  const sensitivity = (max - min) / n;

  return laplaceMechanism(trueMean, sensitivity, epsilon);
}

/**
 * Histogram with Differential Privacy
 *
 * @param data - Data points
 * @param bins - Number of bins
 * @param epsilon - Privacy budget
 * @returns Noisy histogram counts
 */
export function privateHistogram(
  data: ReadonlyArray<number>,
  bins: number,
  epsilon: number
): ReadonlyArray<number> {
  // Compute true histogram
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / bins;

  const counts = new Array(bins).fill(0);

  for (const value of data) {
    const binIndex = Math.min(
      bins - 1,
      Math.floor((value - min) / binWidth)
    );
    counts[binIndex]++;
  }

  // Add noise to each bin (parallel composition)
  // Each bin gets ε/bins privacy budget
  const epsilonPerBin = epsilon / bins;

  return counts.map(count =>
    Math.max(0, Math.round(laplaceMechanism(count, 1, epsilonPerBin)))
  );
}

/**
 * Composition Theorems
 */
export class PrivacyBudget {
  private remainingEpsilon: number;
  private remainingDelta: number;

  constructor(
    public readonly totalEpsilon: number,
    public readonly totalDelta: number = 0
  ) {
    this.remainingEpsilon = totalEpsilon;
    this.remainingDelta = totalDelta;
  }

  /**
   * Basic composition: εₜₒₜₐₗ = Σεᵢ
   */
  spendBasic(epsilon: number, delta: number = 0): boolean {
    if (this.remainingEpsilon >= epsilon && this.remainingDelta >= delta) {
      this.remainingEpsilon -= epsilon;
      this.remainingDelta -= delta;
      return true;
    }
    return false;
  }

  /**
   * Advanced composition (tighter bound for multiple queries)
   */
  spendAdvanced(
    epsilon: number,
    numQueries: number,
    delta: number
  ): { totalEpsilon: number; totalDelta: number } {
    // Advanced composition theorem
    const totalEpsilon =
      epsilon * Math.sqrt(2 * numQueries * Math.log(1 / delta)) +
      numQueries * epsilon * (Math.exp(epsilon) - 1);

    const totalDelta = numQueries * delta;

    return { totalEpsilon, totalDelta };
  }

  getRemaining(): { epsilon: number; delta: number } {
    return {
      epsilon: this.remainingEpsilon,
      delta: this.remainingDelta,
    };
  }
}

/**
 * Report Noisy Max
 *
 * Privately find the index with maximum value.
 */
export function reportNoisyMax(
  values: ReadonlyArray<number>,
  sensitivity: number,
  epsilon: number
): number {
  const noisyValues = values.map(v =>
    laplaceMechanism(v, sensitivity, epsilon)
  );

  let maxIndex = 0;
  let maxValue = noisyValues[0]!;

  for (let i = 1; i < noisyValues.length; i++) {
    if (noisyValues[i]! > maxValue) {
      maxValue = noisyValues[i]!;
      maxIndex = i;
    }
  }

  return maxIndex;
}

// ============================================================================
// SAMPLING FUNCTIONS
// ============================================================================

/**
 * Sample from Laplace distribution
 * Laplace(0, b) has PDF: (1/2b) exp(-|x|/b)
 */
function sampleLaplace(scale: number): number {
  // Inverse transform sampling
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Sample from Gaussian (normal) distribution
 * Box-Muller transform
 */
function sampleGaussian(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();

  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  return mean + stdDev * z;
}

/**
 * Demonstrate differential privacy
 */
export function demonstrateDifferentialPrivacy(): void {
  console.log('=== Differential Privacy Demo ===\n');

  // True database
  const salaries = [50000, 60000, 70000, 80000, 90000, 100000];
  const trueMean = salaries.reduce((s, v) => s + v, 0) / salaries.length;

  console.log(`True mean salary: $${trueMean.toFixed(2)}\n`);

  // Different privacy budgets
  const epsilons = [0.1, 1.0, 10.0];

  console.log('Privacy Budget (ε) | Noisy Mean | Error');
  console.log('-------------------|------------|-------');

  for (const eps of epsilons) {
    const noisyMean = privateMean(salaries, [0, 200000], eps);
    const error = Math.abs(noisyMean - trueMean);

    console.log(
      `${eps.toFixed(1).padStart(18)} | $${noisyMean.toFixed(2).padStart(9)} | $${error.toFixed(2)}`
    );
  }

  console.log('\nNote: Smaller ε = more privacy but less accuracy');
}
