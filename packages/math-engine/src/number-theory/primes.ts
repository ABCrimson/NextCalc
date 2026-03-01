/**
 * Prime Number Theory
 *
 * Comprehensive prime number operations:
 * - Prime generation (Sieve of Eratosthenes, Sieve of Atkin)
 * - Primality testing (deterministic and probabilistic)
 * - Prime factorization (Trial division, Pollard's rho)
 * - Prime counting function π(x)
 * - Goldbach conjecture verification
 * - Twin primes, prime gaps
 *
 * @module number-theory/primes
 */

/**
 * Prime factorization result
 */
export interface PrimeFactorization {
  /** Prime factors and their exponents: Map<prime, exponent> */
  readonly factors: ReadonlyMap<number, number>;
  /** Original number */
  readonly n: number;
}

// ============================================================================
// PRIMALITY TESTING
// ============================================================================

/**
 * Deterministic primality test using trial division
 *
 * Time Complexity: O(√n)
 * Space Complexity: O(1)
 *
 * Suitable for small numbers (n < 10^9)
 *
 * @param n - Number to test
 * @returns True if n is prime
 *
 * @example
 * isPrime(17); // true
 * isPrime(18); // false
 * isPrime(2); // true
 */
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n === 2 || n === 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;

  // Check divisibility by numbers of form 6k ± 1 up to √n
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }

  return true;
}

/**
 * Miller-Rabin probabilistic primality test
 *
 * Time Complexity: O(k log³ n) where k is number of rounds
 * Error probability: 4^(-k)
 *
 * Suitable for large numbers
 *
 * @param n - Number to test
 * @param rounds - Number of test rounds (higher = more accurate)
 * @returns True if n is probably prime
 *
 * @example
 * millerRabin(561, 5); // false (561 is Carmichael number)
 * millerRabin(7919, 5); // true
 */
export function millerRabin(n: number, rounds = 5): boolean {
  if (n < 2) return false;
  if (n === 2 || n === 3) return true;
  if (n % 2 === 0) return false;

  // Write n-1 as 2^r * d
  let d = n - 1;
  let r = 0;
  while (d % 2 === 0) {
    d /= 2;
    r++;
  }

  // Witness loop
  witnessLoop: for (let i = 0; i < rounds; i++) {
    const a = 2 + Math.floor(Math.random() * (n - 3));
    let x = modPow(a, d, n);

    if (x === 1 || x === n - 1) continue;

    for (let j = 0; j < r - 1; j++) {
      x = modPow(x, 2, n);
      if (x === n - 1) continue witnessLoop;
    }

    return false; // Composite
  }

  return true; // Probably prime
}

/**
 * Modular exponentiation: (base^exp) mod mod
 *
 * Uses BigInt to avoid overflow for large numbers.
 * Time Complexity: O(log exp)
 */
function modPow(base: number, exp: number, mod: number): number {
  let b = BigInt(base) % BigInt(mod);
  let e = BigInt(exp);
  const m = BigInt(mod);
  let result = 1n;

  while (e > 0n) {
    if (e & 1n) {
      result = (result * b) % m;
    }
    e >>= 1n;
    b = (b * b) % m;
  }

  return Number(result);
}

/**
 * Lucas-Lehmer primality test for Mersenne numbers
 *
 * Tests if 2^p - 1 is prime (requires p to be prime).
 * Uses BigInt for correctness with large exponents.
 *
 * Time Complexity: O(p²) with optimizations
 *
 * @param p - Exponent (must be prime)
 * @returns True if 2^p - 1 is prime
 *
 * @example
 * lucasLehmer(3); // true (2³ - 1 = 7 is prime)
 * lucasLehmer(5); // true (2⁵ - 1 = 31 is prime)
 * lucasLehmer(11); // false (2¹¹ - 1 = 2047 = 23 × 89)
 */
export function lucasLehmer(p: number): boolean {
  if (!isPrime(p)) return false;
  if (p === 2) return true;

  const m = 2n ** BigInt(p) - 1n;
  let s = 4n;

  for (let i = 0; i < p - 2; i++) {
    s = (s * s - 2n) % m;
  }

  return s === 0n;
}

// ============================================================================
// PRIME GENERATION
// ============================================================================

/**
 * Sieve of Eratosthenes - generates all primes up to n
 *
 * Time Complexity: O(n log log n)
 * Space Complexity: O(n)
 *
 * Most efficient for generating many primes
 *
 * @param n - Upper limit
 * @returns Array of all primes ≤ n
 *
 * @example
 * sieveOfEratosthenes(20); // [2, 3, 5, 7, 11, 13, 17, 19]
 */
export function sieveOfEratosthenes(n: number): ReadonlyArray<number> {
  if (n < 2) return [];

  const isPrimeArr = new Array<boolean>(n + 1).fill(true);
  isPrimeArr[0] = false;
  isPrimeArr[1] = false;

  for (let i = 2; i * i <= n; i++) {
    if (isPrimeArr[i]) {
      for (let j = i * i; j <= n; j += i) {
        isPrimeArr[j] = false;
      }
    }
  }

  const primes: number[] = [];
  for (let i = 2; i <= n; i++) {
    if (isPrimeArr[i]) {
      primes.push(i);
    }
  }

  return primes;
}

/**
 * Segmented Sieve - memory-efficient for very large ranges
 *
 * Generates primes in range [low, high] using O(√high) space
 *
 * @param low - Lower bound
 * @param high - Upper bound
 * @returns Array of primes in [low, high]
 *
 * @example
 * segmentedSieve(100, 150); // Primes between 100 and 150
 */
export function segmentedSieve(low: number, high: number): ReadonlyArray<number> {
  if (high < 2) return [];
  if (low < 2) low = 2;

  // Get primes up to √high
  const limit = Math.floor(Math.sqrt(high));
  const basePrimes = sieveOfEratosthenes(limit);

  const size = high - low + 1;
  const isPrimeArr = new Array<boolean>(size).fill(true);

  for (const prime of basePrimes) {
    // Find first multiple of prime in [low, high]
    const start = Math.max(prime * prime, Math.ceil(low / prime) * prime);

    for (let j = start; j <= high; j += prime) {
      isPrimeArr[j - low] = false;
    }
  }

  const primes: number[] = [];
  for (let i = 0; i < size; i++) {
    if (isPrimeArr[i] && low + i >= 2) {
      primes.push(low + i);
    }
  }

  return primes;
}

/**
 * Generates the first n primes
 *
 * @param n - Number of primes to generate
 * @returns Array of first n primes
 *
 * @example
 * firstNPrimes(10); // [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
 */
export function firstNPrimes(n: number): ReadonlyArray<number> {
  if (n <= 0) return [];

  const primes: number[] = [];
  let candidate = 2;

  while (primes.length < n) {
    if (isPrime(candidate)) {
      primes.push(candidate);
    }
    candidate++;
  }

  return primes;
}

/**
 * Finds next prime greater than n
 *
 * @param n - Starting number
 * @returns Next prime after n
 *
 * @example
 * nextPrime(10); // 11
 * nextPrime(14); // 17
 */
export function nextPrime(n: number): number {
  let candidate = Math.floor(n) + 1;
  while (!isPrime(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Finds previous prime less than n
 *
 * @param n - Starting number
 * @returns Previous prime before n
 *
 * @example
 * previousPrime(10); // 7
 * previousPrime(14); // 13
 */
export function previousPrime(n: number): number {
  let candidate = Math.floor(n) - 1;
  while (candidate >= 2 && !isPrime(candidate)) {
    candidate--;
  }
  return candidate >= 2 ? candidate : -1;
}

// ============================================================================
// PRIME FACTORIZATION
// ============================================================================

/**
 * Trial division factorization
 *
 * Time Complexity: O(√n)
 * Suitable for numbers up to ~10^12
 *
 * @param n - Number to factor
 * @returns Prime factorization
 *
 * @example
 * trialDivision(60); // Map { 2 => 2, 3 => 1, 5 => 1 } (60 = 2² × 3 × 5)
 */
export function trialDivision(n: number): PrimeFactorization {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new Error('trialDivision: n must be a positive integer');
  }

  const factors = new Map<number, number>();
  let remaining = n;

  // Check for factor 2
  while (remaining % 2 === 0) {
    factors.set(2, (factors.get(2) ?? 0) + 1);
    remaining /= 2;
  }

  // Check odd factors
  for (let i = 3; i * i <= remaining; i += 2) {
    while (remaining % i === 0) {
      factors.set(i, (factors.get(i) ?? 0) + 1);
      remaining /= i;
    }
  }

  // If remaining > 1, it's a prime factor
  if (remaining > 1) {
    factors.set(remaining, 1);
  }

  return { factors, n };
}

/**
 * Pollard's rho algorithm for integer factorization
 *
 * Probabilistic algorithm, efficient for finding small factors
 * Time Complexity: O(n^(1/4))
 *
 * @param n - Number to factor
 * @returns A non-trivial factor of n (not necessarily prime)
 *
 * @example
 * pollardRho(8051); // Might return 97 or 83 (8051 = 83 × 97)
 */
export function pollardRho(n: number): number {
  if (n % 2 === 0) return 2;
  if (isPrime(n)) return n;

  let x = 2;
  let y = 2;
  let d = 1;

  // Polynomial: f(x) = x² + 1 mod n
  const f = (x: number) => (x * x + 1) % n;

  while (d === 1) {
    x = f(x);
    y = f(f(y));
    d = gcd(Math.abs(x - y), n);

    // Avoid infinite loop
    if (d === n) {
      // Restart with different starting point
      x = Math.floor(Math.random() * (n - 2)) + 2;
      y = x;
      d = 1;
    }
  }

  return d;
}

/**
 * Complete prime factorization using Pollard's rho
 *
 * @param n - Number to factor
 * @returns Prime factorization
 *
 * @example
 * primeFactorize(8051); // Map { 83 => 1, 97 => 1 }
 */
export function primeFactorize(n: number): PrimeFactorization {
  if (n <= 1) throw new Error('primeFactorize: n must be > 1');

  const factors = new Map<number, number>();

  const factorize = (num: number): void => {
    if (num === 1) return;
    if (isPrime(num)) {
      factors.set(num, (factors.get(num) ?? 0) + 1);
      return;
    }

    const factor = pollardRho(num);
    factorize(factor);
    factorize(num / factor);
  };

  factorize(n);
  return { factors, n };
}

/**
 * Greatest Common Divisor using Euclidean algorithm
 */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Converts factorization to readable string
 *
 * @param factorization - Prime factorization
 * @returns String representation
 *
 * @example
 * factorizationToString(trialDivision(60)); // "2² × 3 × 5"
 */
export function factorizationToString(factorization: PrimeFactorization): string {
  if (factorization.factors.size === 0) return '1';

  const terms: string[] = [];
  const sortedFactors = [...factorization.factors.entries()].sort((a, b) => a[0] - b[0]);

  for (const [prime, exp] of sortedFactors) {
    if (exp === 1) {
      terms.push(String(prime));
    } else {
      terms.push(`${prime}^${exp}`);
    }
  }

  return terms.join(' × ');
}

// ============================================================================
// PRIME COUNTING AND DISTRIBUTION
// ============================================================================

/**
 * Prime counting function π(x) - number of primes ≤ x
 *
 * Exact count using sieve
 *
 * @param x - Upper limit
 * @returns Number of primes ≤ x
 *
 * @example
 * primeCount(100); // 25
 * primeCount(1000); // 168
 */
export function primeCount(x: number): number {
  if (x < 2) return 0;
  return sieveOfEratosthenes(Math.floor(x)).length;
}

/**
 * Prime counting function approximation using prime number theorem
 *
 * π(x) ≈ x / ln(x)
 *
 * @param x - Upper limit
 * @returns Approximation of π(x)
 *
 * @example
 * primeCountApprox(1000); // ~145 (actual: 168)
 */
export function primeCountApprox(x: number): number {
  if (x < 2) return 0;
  return x / Math.log(x);
}

/**
 * nth prime approximation
 *
 * p_n ≈ n ln(n) for large n
 *
 * @param n - Index (1-based)
 * @returns Approximation of nth prime
 */
export function nthPrimeApprox(n: number): number {
  if (n < 1) throw new Error('nthPrimeApprox: n must be ≥ 1');
  if (n === 1) return 2;

  // Better approximation: p_n ≈ n(ln(n) + ln(ln(n)))
  return Math.floor(n * (Math.log(n) + Math.log(Math.log(n))));
}

// ============================================================================
// SPECIAL PRIME PATTERNS
// ============================================================================

/**
 * Checks if two consecutive odd numbers are twin primes
 *
 * Twin primes: (p, p+2) both prime
 *
 * @param p - First number
 * @returns True if (p, p+2) are twin primes
 *
 * @example
 * isTwinPrime(3); // true (3, 5)
 * isTwinPrime(11); // true (11, 13)
 * isTwinPrime(7); // false (7, 9)
 */
export function isTwinPrime(p: number): boolean {
  return isPrime(p) && isPrime(p + 2);
}

/**
 * Finds all twin prime pairs up to n
 *
 * @param n - Upper limit
 * @returns Array of twin prime pairs [p, p+2]
 *
 * @example
 * findTwinPrimes(20); // [[3,5], [5,7], [11,13], [17,19]]
 */
export function findTwinPrimes(n: number): ReadonlyArray<readonly [number, number]> {
  const primes = sieveOfEratosthenes(n);
  const primeSet = new Set(primes);
  const twins: [number, number][] = [];

  for (const p of primes) {
    if (primeSet.has(p + 2)) {
      twins.push([p, p + 2]);
    }
  }

  return twins;
}

/**
 * Prime gap: difference between consecutive primes
 *
 * @param n - Starting prime
 * @returns Gap to next prime
 *
 * @example
 * primeGap(7); // 4 (next prime is 11)
 * primeGap(23); // 6 (next prime is 29)
 */
export function primeGap(n: number): number {
  if (!isPrime(n)) throw new Error('primeGap: n must be prime');
  return nextPrime(n) - n;
}

/**
 * Finds largest prime gap in range [2, n]
 *
 * @param n - Upper limit
 * @returns {gap, afterPrime} - Largest gap and prime before it
 */
export function maxPrimeGap(n: number): { readonly gap: number; readonly afterPrime: number } {
  const primes = sieveOfEratosthenes(n);
  let maxGap = 0;
  let gapPrime = 2;

  for (let i = 0; i < primes.length - 1; i++) {
    const p1 = primes[i];
    const p2 = primes[i + 1];
    if (p1 !== undefined && p2 !== undefined) {
      const gap = p2 - p1;
      if (gap > maxGap) {
        maxGap = gap;
        gapPrime = p1;
      }
    }
  }

  return { gap: maxGap, afterPrime: gapPrime };
}

// ============================================================================
// GOLDBACH CONJECTURE
// ============================================================================

/**
 * Verifies Goldbach's conjecture for a number
 *
 * Every even integer > 2 can be expressed as sum of two primes
 *
 * @param n - Even number to test
 * @returns Array of prime pairs [p, q] where p + q = n
 *
 * @example
 * goldbachPairs(10); // [[3, 7], [5, 5]]
 * goldbachPairs(100); // Multiple pairs
 */
export function goldbachPairs(n: number): ReadonlyArray<readonly [number, number]> {
  if (n <= 2 || n % 2 !== 0) {
    throw new Error('goldbachPairs: n must be an even integer > 2');
  }

  const pairs: [number, number][] = [];
  const primes = sieveOfEratosthenes(n);
  const primeSet = new Set(primes);

  for (const p of primes) {
    if (p > n / 2) break;
    const q = n - p;
    if (primeSet.has(q)) {
      pairs.push([p, q]);
    }
  }

  return pairs;
}

/**
 * Checks if number satisfies Goldbach's conjecture
 *
 * @param n - Even number
 * @returns True if at least one representation exists
 */
export function satisfiesGoldbach(n: number): boolean {
  if (n <= 2 || n % 2 !== 0) return false;
  return goldbachPairs(n).length > 0;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sum of divisors function σ(n)
 *
 * @param n - Number
 * @returns Sum of all divisors of n
 *
 * @example
 * sumOfDivisors(12); // 28 (1+2+3+4+6+12)
 */
export function sumOfDivisors(n: number): number {
  const { factors } = trialDivision(n);
  let sum = 1;

  for (const [prime, exp] of factors) {
    // Sum of geometric series: (p^(e+1) - 1) / (p - 1)
    sum *= (prime ** (exp + 1) - 1) / (prime - 1);
  }

  return sum;
}

/**
 * Number of divisors function τ(n)
 *
 * @param n - Number
 * @returns Number of divisors of n
 *
 * @example
 * numberOfDivisors(12); // 6 (1,2,3,4,6,12)
 */
export function numberOfDivisors(n: number): number {
  const { factors } = trialDivision(n);
  let count = 1;

  for (const [, exp] of factors) {
    count *= exp + 1;
  }

  return count;
}

/**
 * Checks if number is perfect (equals sum of proper divisors)
 *
 * @param n - Number to check
 * @returns True if n is perfect
 *
 * @example
 * isPerfectNumber(6); // true (6 = 1+2+3)
 * isPerfectNumber(28); // true (28 = 1+2+4+7+14)
 */
export function isPerfectNumber(n: number): boolean {
  return sumOfDivisors(n) === 2 * n;
}
