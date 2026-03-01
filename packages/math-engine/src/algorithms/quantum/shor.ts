/**
 * Shor's Algorithm (Classical Simulation)
 *
 * Quantum algorithm for integer factorization.
 * Can factor N-bit numbers in O(N³) time, exponentially faster than
 * classical algorithms like the General Number Field Sieve.
 *
 * Published by Peter Shor in 1994.
 * Reference: https://arxiv.org/abs/quant-ph/9508027
 *
 * Note: This implements the classical subroutines. The quantum period-finding
 * subroutine is simulated classically (which loses the speed advantage).
 *
 * Time Complexity: O(N³) quantum, O(2^N) classical simulation
 * Space Complexity: O(N)
 */

/**
 * Shor's algorithm result
 */
export interface ShorResult {
  /** Input number to factor */
  readonly n: number;
  /** Factors found */
  readonly factors: ReadonlyArray<number>;
  /** Whether factorization succeeded */
  readonly success: boolean;
  /** Steps taken */
  readonly steps: ReadonlyArray<string>;
}

/**
 * Shor's Algorithm for Integer Factorization
 *
 * Algorithm:
 * 1. Check if N is even
 * 2. Check if N is a perfect power
 * 3. Choose random a < N
 * 4. Compute gcd(a, N)
 * 5. Find period r of f(x) = a^x mod N using quantum subroutine
 * 6. If r is even and a^(r/2) ≢ -1 (mod N), compute factors
 * 7. Check if factors are non-trivial
 *
 * @param n - Number to factor
 * @param maxAttempts - Maximum attempts (default: 10)
 * @returns Factorization result
 */
export function shorAlgorithm(n: number, maxAttempts = 10): ShorResult {
  const steps: string[] = [];

  steps.push(`Factoring N = ${n}`);

  // Step 1: Check if even
  if (n % 2 === 0) {
    steps.push(`N is even: 2 × ${n / 2}`);
    return {
      n,
      factors: [2, n / 2],
      success: true,
      steps,
    };
  }

  // Step 2: Check if perfect power
  const powerCheck = isPerfectPower(n);
  if (powerCheck) {
    const { base, exp } = powerCheck;
    steps.push(`N is a perfect power: ${base}^${exp}`);
    // Factor the base recursively if needed
    return {
      n,
      factors: [base, n / base],
      success: true,
      steps,
    };
  }

  // Steps 3-7: Quantum period finding
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    steps.push(`\nAttempt ${attempt}:`);

    // Choose random a
    const a = randomInt(2, n - 1);
    steps.push(`  Chose random a = ${a}`);

    // Compute gcd(a, N)
    const g = gcd(a, n);
    if (g > 1) {
      steps.push(`  gcd(${a}, ${n}) = ${g} (found factor!)`);
      return {
        n,
        factors: [g, n / g],
        success: true,
        steps,
      };
    }

    steps.push(`  gcd(${a}, ${n}) = 1 (coprime)`);

    // Find period using quantum period finding (simulated classically)
    steps.push(`  Finding period of f(x) = ${a}^x mod ${n}...`);
    const r = findPeriod(a, n);
    steps.push(`  Period r = ${r}`);

    // Check if period is even
    if (r % 2 !== 0) {
      steps.push(`  Period is odd, try again`);
      continue;
    }

    // Compute a^(r/2) mod N
    const halfPower = modPow(a, r / 2, n);
    steps.push(`  ${a}^${r / 2} mod ${n} = ${halfPower}`);

    // Check if a^(r/2) ≢ -1 (mod N)
    if (halfPower === n - 1) {
      steps.push(`  ${a}^${r / 2} ≡ -1 (mod ${n}), try again`);
      continue;
    }

    // Compute factors
    const factor1 = gcd(halfPower - 1, n);
    const factor2 = gcd(halfPower + 1, n);

    steps.push(`  gcd(${halfPower} - 1, ${n}) = ${factor1}`);
    steps.push(`  gcd(${halfPower} + 1, ${n}) = ${factor2}`);

    // Check if factors are non-trivial
    if (factor1 > 1 && factor1 < n) {
      steps.push(`  Success! Found factors: ${factor1} × ${n / factor1}`);
      return {
        n,
        factors: [factor1, n / factor1],
        success: true,
        steps,
      };
    }

    if (factor2 > 1 && factor2 < n) {
      steps.push(`  Success! Found factors: ${factor2} × ${n / factor2}`);
      return {
        n,
        factors: [factor2, n / factor2],
        success: true,
        steps,
      };
    }

    steps.push(`  Factors are trivial, try again`);
  }

  steps.push(`\nFailed after ${maxAttempts} attempts`);
  return {
    n,
    factors: [],
    success: false,
    steps,
  };
}

/**
 * Find period of modular exponentiation (classical simulation)
 *
 * Find smallest r > 0 such that a^r ≡ 1 (mod n)
 *
 * Note: In real Shor's algorithm, this is done on a quantum computer
 * using quantum Fourier transform in O(log³ n) time.
 * Classical simulation is O(n), losing the advantage.
 */
export function findPeriod(a: number, n: number): number {
  let current = a % n;

  for (let r = 1; r < n; r++) {
    if (current === 1) {
      return r;
    }
    current = (current * a) % n;
  }

  return n; // Should not happen if gcd(a,n) = 1
}

/**
 * Modular exponentiation: a^b mod m
 *
 * Uses binary exponentiation for efficiency.
 * Time complexity: O(log b)
 */
export function modPow(a: number, b: number, m: number): number {
  let result = 1;
  a = a % m;

  while (b > 0) {
    if (b % 2 === 1) {
      result = (result * a) % m;
    }
    b = Math.floor(b / 2);
    a = (a * a) % m;
  }

  return result;
}

/**
 * Greatest common divisor
 */
export function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Check if n is a perfect power
 *
 * Returns the smallest base (canonical form) if n = base^exp where exp >= 2.
 * For example: 64 = 2^6 = 4^3 = 8^2, returns {base: 2, exp: 6}
 */
export function isPerfectPower(n: number): { base: number; exp: number } | null {
  // Special case: 1 = 1^k for any k >= 2
  if (n === 1) {
    return { base: 1, exp: 2 };
  }

  // Track the best (smallest base, largest exponent) found
  let bestBase = n;
  let bestExp = 1;

  // Check all possible exponents from 2 up to log₂(n)
  const maxExp = Math.floor(Math.log2(n));

  for (let exp = 2; exp <= maxExp; exp++) {
    const base = Math.round(n ** (1 / exp));

    // Verify base^exp === n (accounting for floating-point precision)
    if (base ** exp === n) {
      // Keep the representation with smallest base
      if (base < bestBase) {
        bestBase = base;
        bestExp = exp;
      }
    }
  }

  // If no perfect power found, return null
  return bestBase === n ? null : { base: bestBase, exp: bestExp };
}

/**
 * Random integer in range [min, max)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Demonstrate Shor's algorithm
 */
export function demonstrateShorAlgorithm(): void {
  console.log("=== Shor's Algorithm Demo ===\n");

  const testCases = [15, 21, 35, 91];

  for (const n of testCases) {
    console.log(`Factoring N = ${n}:`);
    console.log('─'.repeat(50));

    const result = shorAlgorithm(n, 5);

    if (result.success) {
      const [f1, f2] = result.factors;
      if (f1 === undefined || f2 === undefined) throw new Error('Factors missing despite success');
      console.log(`\nFactors: ${f1} × ${f2} = ${f1 * f2}`);

      // Verify
      if (f1 * f2 === n) {
        console.log('Verification: PASSED ✓');
      } else {
        console.log('Verification: FAILED ✗');
      }
    } else {
      console.log('\nFactorization failed');
    }

    console.log('\n');
  }

  console.log("Note: Real Shor's algorithm runs on quantum computers");
  console.log('and can factor large numbers exponentially faster!');
  console.log('\nQuantum speedup:');
  console.log('  Classical: ~O(exp(n^(1/3))) for n-bit numbers');
  console.log('  Quantum (Shor): O(n³) operations');
}

/**
 * Quantum Period Finding (Conceptual)
 *
 * This is where the quantum advantage comes from.
 * On a quantum computer:
 * 1. Create superposition of all x values
 * 2. Compute f(x) = a^x mod N in superposition
 * 3. Apply Quantum Fourier Transform
 * 4. Measure to get a value related to period
 * 5. Use continued fractions to extract period
 */
export class QuantumPeriodFinding {
  /**
   * Simulate quantum period finding result
   * (Without actually implementing QFT)
   */
  findPeriodQuantum(a: number, n: number): number {
    // In reality, this would use:
    // - Quantum Fourier Transform (QFT)
    // - Modular exponentiation in superposition
    // - Measurement and classical post-processing
    //
    // For simulation, we just use classical period finding
    return findPeriod(a, n);
  }

  /**
   * Estimate required qubits for factoring n
   */
  estimateQubits(n: number): {
    qubitsForN: number;
    qubitsForPeriod: number;
    totalQubits: number;
  } {
    const bitsInN = Math.ceil(Math.log2(n));

    return {
      qubitsForN: bitsInN,
      qubitsForPeriod: 2 * bitsInN, // For QFT precision
      totalQubits: 3 * bitsInN, // Approximate total
    };
  }
}
