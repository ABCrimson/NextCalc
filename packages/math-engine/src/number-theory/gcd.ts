/**
 * Greatest Common Divisor
 *
 * Canonical GCD implementation (iterative Euclidean algorithm) shared across
 * the math-engine, replacing the several near-identical private copies that
 * used to live in individual modules.
 *
 * Lives in its own file (rather than modular.ts) so that both modular.ts and
 * primes.ts can depend on it without introducing a circular import between
 * those two modules.
 *
 * @module number-theory/gcd
 */

/**
 * Greatest Common Divisor using the Euclidean algorithm.
 *
 * Inputs are rounded and made non-negative before the loop, so near-integer
 * floating point coefficients (e.g. polynomial term coefficients) still
 * terminate correctly instead of looping on fractional remainders.
 *
 * @param a - First number
 * @param b - Second number
 * @returns gcd(|round(a)|, |round(b)|)
 *
 * @example
 * gcd(12, 8); // 4
 * gcd(0, 5); // 5
 * gcd(10, 0); // 10
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}
