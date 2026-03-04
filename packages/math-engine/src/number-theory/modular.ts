/**
 * Modular Arithmetic
 *
 * Comprehensive modular arithmetic operations:
 * - Modular exponentiation, inverse
 * - Chinese Remainder Theorem
 * - Euler's totient function φ(n)
 * - Primitive roots
 * - Quadratic residues and Legendre symbol
 * - Discrete logarithm
 *
 * @module number-theory/modular
 */

import { isPrime, trialDivision } from './primes';

// ============================================================================
// BASIC MODULAR OPERATIONS
// ============================================================================

/**
 * Modular addition: (a + b) mod m
 *
 * @param a - First operand
 * @param b - Second operand
 * @param m - Modulus
 * @returns (a + b) mod m
 */
export function modAdd(a: number, b: number, m: number): number {
  return ((a % m) + (b % m)) % m;
}

/**
 * Modular subtraction: (a - b) mod m
 *
 * @param a - First operand
 * @param b - Second operand
 * @param m - Modulus
 * @returns (a - b) mod m
 */
export function modSub(a: number, b: number, m: number): number {
  return ((((a % m) - (b % m)) % m) + m) % m;
}

/**
 * Modular multiplication: (a × b) mod m
 *
 * @param a - First operand
 * @param b - Second operand
 * @param m - Modulus
 * @returns (a × b) mod m
 */
export function modMul(a: number, b: number, m: number): number {
  return ((a % m) * (b % m)) % m;
}

/**
 * Modular exponentiation: (base^exp) mod m
 *
 * Uses binary exponentiation for efficiency
 * Time Complexity: O(log exp)
 *
 * @param base - Base
 * @param exp - Exponent (non-negative)
 * @param m - Modulus
 * @returns (base^exp) mod m
 *
 * @example
 * modPow(2, 10, 1000); // 24 (2^10 = 1024 ≡ 24 mod 1000)
 * modPow(3, 5, 7); // 5 (3^5 = 243 ≡ 5 mod 7)
 */
export function modPow(base: number, exp: number, m: number): number {
  if (exp < 0) throw new Error('modPow: Exponent must be non-negative');
  if (m <= 0) throw new Error('modPow: Modulus must be positive');

  let b = BigInt(((base % m) + m) % m);
  let e = BigInt(exp);
  const mod = BigInt(m);
  let result = 1n;

  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }

  return Number(result);
}

/**
 * Extended Euclidean Algorithm
 *
 * Finds integers x, y such that ax + by = gcd(a, b)
 *
 * @param a - First number
 * @param b - Second number
 * @returns {gcd, x, y} where ax + by = gcd
 *
 * @example
 * extendedGCD(30, 21); // {gcd: 3, x: -2, y: 3} (30×-2 + 21×3 = 3)
 */
export function extendedGCD(
  a: number,
  b: number,
): { readonly gcd: number; readonly x: number; readonly y: number } {
  if (b === 0) {
    return { gcd: a, x: 1, y: 0 };
  }

  const { gcd, x: x1, y: y1 } = extendedGCD(b, a % b);
  const x = y1;
  const y = x1 - Math.floor(a / b) * y1;

  return { gcd, x, y };
}

/**
 * Modular multiplicative inverse: finds x such that (a × x) ≡ 1 (mod m)
 *
 * Uses Extended Euclidean Algorithm
 * Time Complexity: O(log m)
 *
 * @param a - Number to invert
 * @param m - Modulus
 * @returns Inverse of a modulo m
 * @throws Error if gcd(a, m) ≠ 1
 *
 * @example
 * modInverse(3, 7); // 5 (3×5 = 15 ≡ 1 mod 7)
 * modInverse(10, 17); // 12 (10×12 = 120 ≡ 1 mod 17)
 */
export function modInverse(a: number, m: number): number {
  if (m <= 0) throw new Error('modInverse: Modulus must be positive');

  a = ((a % m) + m) % m;
  const { gcd, x } = extendedGCD(a, m);

  if (gcd !== 1) {
    throw new Error(`modInverse: ${a} has no inverse modulo ${m} (gcd = ${gcd})`);
  }

  return ((x % m) + m) % m;
}

// ============================================================================
// CHINESE REMAINDER THEOREM
// ============================================================================

/**
 * Chinese Remainder Theorem (CRT)
 *
 * Solves system of congruences:
 *   x ≡ a₁ (mod m₁)
 *   x ≡ a₂ (mod m₂)
 *   ...
 *   x ≡ aₙ (mod mₙ)
 *
 * where m₁, m₂, ..., mₙ are pairwise coprime
 *
 * Time Complexity: O(n log M) where M = product of moduli
 *
 * @param remainders - Array of remainders [a₁, a₂, ..., aₙ]
 * @param moduli - Array of moduli [m₁, m₂, ..., mₙ]
 * @returns Solution x (mod M) where M = m₁ × m₂ × ... × mₙ
 *
 * @example
 * crt([2, 3, 2], [3, 5, 7]); // 23 (x ≡ 2 mod 3, x ≡ 3 mod 5, x ≡ 2 mod 7)
 */
export function crt(remainders: ReadonlyArray<number>, moduli: ReadonlyArray<number>): number {
  if (remainders.length !== moduli.length) {
    throw new Error('crt: remainders and moduli must have same length');
  }

  if (remainders.length === 0) {
    throw new Error('crt: Empty input');
  }

  // Check pairwise coprimality
  for (let i = 0; i < moduli.length; i++) {
    for (let j = i + 1; j < moduli.length; j++) {
      const mi = moduli[i];
      const mj = moduli[j];
      if (mi !== undefined && mj !== undefined && gcd(mi, mj) !== 1) {
        throw new Error(`crt: Moduli must be pairwise coprime (gcd(${mi}, ${mj}) ≠ 1)`);
      }
    }
  }

  const M = moduli.reduce((prod, m) => prod * m, 1);
  const bigM = BigInt(M);
  let x = 0n;

  for (let i = 0; i < remainders.length; i++) {
    const ai = remainders[i];
    const mi = moduli[i];
    if (ai === undefined || mi === undefined) continue;

    const Mi = BigInt(M) / BigInt(mi);
    const yi = BigInt(modInverse(Number(Mi % BigInt(mi)), mi));
    x = (x + BigInt(ai) * Mi * yi) % bigM;
  }

  return Number(((x % bigM) + bigM) % bigM);
}

/**
 * GCD using Euclidean algorithm
 */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return Math.abs(a);
}

// ============================================================================
// EULER'S TOTIENT FUNCTION
// ============================================================================

/**
 * Euler's totient function φ(n)
 *
 * Counts integers k in 1 ≤ k ≤ n where gcd(k, n) = 1
 *
 * Uses prime factorization: φ(n) = n ∏(1 - 1/p) for prime p | n
 * Time Complexity: O(√n)
 *
 * @param n - Positive integer
 * @returns φ(n)
 *
 * @example
 * eulerPhi(9); // 6 (1,2,4,5,7,8 are coprime to 9)
 * eulerPhi(12); // 4 (1,5,7,11 are coprime to 12)
 */
export function eulerPhi(n: number): number {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new Error('eulerPhi: n must be a positive integer');
  }

  if (n === 1) return 1;

  const { factors } = trialDivision(n);
  let result = n;

  for (const [prime] of factors) {
    result = (result * (prime - 1)) / prime;
  }

  return Math.floor(result);
}

/**
 * Euler's theorem: a^φ(n) ≡ 1 (mod n) for gcd(a, n) = 1
 *
 * Verifies Euler's theorem for given a and n
 *
 * @param a - Base
 * @param n - Modulus
 * @returns True if a^φ(n) ≡ 1 (mod n)
 */
export function verifyEulerTheorem(a: number, n: number): boolean {
  if (gcd(a, n) !== 1) return false;
  const phi = eulerPhi(n);
  return modPow(a, phi, n) === 1;
}

/**
 * Finds multiplicative order of a modulo n
 *
 * ord_n(a) = smallest k > 0 such that a^k ≡ 1 (mod n)
 *
 * @param a - Base
 * @param n - Modulus
 * @returns Multiplicative order
 *
 * @example
 * multiplicativeOrder(2, 7); // 3 (2^3 = 8 ≡ 1 mod 7)
 * multiplicativeOrder(3, 7); // 6 (3 is primitive root mod 7)
 */
export function multiplicativeOrder(a: number, n: number): number {
  if (gcd(a, n) !== 1) {
    throw new Error('multiplicativeOrder: a and n must be coprime');
  }

  const phi = eulerPhi(n);
  let order = 1;
  let power = BigInt(a) % BigInt(n);
  const bn = BigInt(n);

  while (power !== 1n && order <= phi) {
    power = (power * BigInt(a)) % bn;
    order++;
  }

  return order;
}

// ============================================================================
// PRIMITIVE ROOTS
// ============================================================================

/**
 * Checks if a is a primitive root modulo n
 *
 * a is a primitive root mod n if ord_n(a) = φ(n)
 *
 * @param a - Candidate primitive root
 * @param n - Modulus
 * @returns True if a is a primitive root mod n
 *
 * @example
 * isPrimitiveRoot(3, 7); // true
 * isPrimitiveRoot(2, 7); // false
 */
export function isPrimitiveRoot(a: number, n: number): boolean {
  if (gcd(a, n) !== 1) return false;
  return multiplicativeOrder(a, n) === eulerPhi(n);
}

/**
 * Finds all primitive roots modulo n
 *
 * Primitive roots exist for n = 1, 2, 4, p^k, 2p^k (p odd prime)
 *
 * @param n - Modulus
 * @returns Array of primitive roots modulo n
 *
 * @example
 * findAllPrimitiveRoots(7); // [3, 5]
 * findAllPrimitiveRoots(9); // [2, 5]
 */
export function findAllPrimitiveRoots(n: number): ReadonlyArray<number> {
  if (!hasPrimitiveRoot(n)) {
    return [];
  }

  const roots: number[] = [];
  const phi = eulerPhi(n);

  for (let a = 1; a < n; a++) {
    if (gcd(a, n) === 1 && multiplicativeOrder(a, n) === phi) {
      roots.push(a);
    }
  }

  return roots;
}

/**
 * Checks if n has primitive roots
 *
 * Primitive roots exist only for n = 1, 2, 4, p^k, 2p^k (p odd prime)
 *
 * @param n - Modulus
 * @returns True if primitive roots exist mod n
 */
export function hasPrimitiveRoot(n: number): boolean {
  if (n === 1 || n === 2 || n === 4) return true;

  // Check if n = p^k for odd prime p
  const { factors } = trialDivision(n);

  if (factors.size === 1) {
    const { value: firstEntry, done } = factors.entries().next();
    if (!done && firstEntry) {
      const [prime] = firstEntry;
      return prime !== 2;
    }
  }

  // Check if n = 2p^k for odd prime p
  if (factors.size === 2) {
    const iter = factors.entries();
    const { value: firstEntry } = iter.next();
    const { value: secondEntry } = iter.next();
    if (firstEntry && secondEntry) {
      const [p1, e1] = firstEntry;
      const [p2, e2] = secondEntry;
      if (p1 === 2 && e1 === 1 && p2 !== 2) return true;
      if (p2 === 2 && e2 === 1 && p1 !== 2) return true;
    }
  }

  return false;
}

// ============================================================================
// QUADRATIC RESIDUES
// ============================================================================

/**
 * Checks if a is a quadratic residue modulo p
 *
 * a is a QR mod p if ∃x: x² ≡ a (mod p)
 *
 * @param a - Number to test
 * @param p - Prime modulus
 * @returns True if a is a quadratic residue mod p
 *
 * @example
 * isQuadraticResidue(4, 7); // true (2² ≡ 4 mod 7)
 * isQuadraticResidue(3, 7); // false
 */
export function isQuadraticResidue(a: number, p: number): boolean {
  if (!isPrime(p)) throw new Error('isQuadraticResidue: p must be prime');

  a = ((a % p) + p) % p;
  if (a === 0) return true;

  return legendreSymbol(a, p) === 1;
}

/**
 * Legendre symbol (a/p)
 *
 * Returns:
 *   1 if a is QR mod p
 *  -1 if a is QNR mod p
 *   0 if p | a
 *
 * Uses Euler's criterion: (a/p) ≡ a^((p-1)/2) (mod p)
 *
 * @param a - Numerator
 * @param p - Prime denominator
 * @returns Legendre symbol value
 *
 * @example
 * legendreSymbol(4, 7); // 1
 * legendreSymbol(3, 7); // -1
 */
export function legendreSymbol(a: number, p: number): -1 | 0 | 1 {
  if (!isPrime(p)) throw new Error('legendreSymbol: p must be prime');

  a = ((a % p) + p) % p;
  if (a === 0) return 0;

  const result = modPow(a, (p - 1) / 2, p);
  return result === 1 ? 1 : -1;
}

/**
 * Jacobi symbol (a/n) - generalization of Legendre symbol
 *
 * Computed using quadratic reciprocity
 *
 * @param a - Numerator
 * @param n - Odd denominator
 * @returns Jacobi symbol value
 */
export function jacobiSymbol(a: number, n: number): -1 | 0 | 1 {
  if (n <= 0 || n % 2 === 0) {
    throw new Error('jacobiSymbol: n must be odd and positive');
  }

  a = ((a % n) + n) % n;
  let result = 1;

  while (a !== 0) {
    while (a % 2 === 0) {
      a /= 2;
      if (n % 8 === 3 || n % 8 === 5) {
        result = -result;
      }
    }

    [a, n] = [n, a];

    if (a % 4 === 3 && n % 4 === 3) {
      result = -result;
    }

    a = a % n;
  }

  return n === 1 ? (result as -1 | 0 | 1) : 0;
}

/**
 * Tonelli-Shanks algorithm for modular square root
 *
 * Finds x such that x² ≡ a (mod p) for prime p
 *
 * @param a - Number to find square root of
 * @param p - Prime modulus
 * @returns Square root modulo p
 * @throws Error if a is not a quadratic residue
 *
 * @example
 * modSqrt(4, 7); // 2 (or 5, both valid)
 */
export function modSqrt(a: number, p: number): number {
  if (!isPrime(p)) throw new Error('modSqrt: p must be prime');

  a = ((a % p) + p) % p;

  if (legendreSymbol(a, p) !== 1) {
    throw new Error(`modSqrt: ${a} is not a quadratic residue mod ${p}`);
  }

  // Special case p ≡ 3 (mod 4)
  if (p % 4 === 3) {
    return modPow(a, (p + 1) / 4, p);
  }

  // Tonelli-Shanks for general case
  // Find Q, S such that p - 1 = Q × 2^S with Q odd
  let Q = p - 1;
  let S = 0;
  while (Q % 2 === 0) {
    Q /= 2;
    S++;
  }

  // Find quadratic non-residue z
  let z = 2;
  while (legendreSymbol(z, p) !== -1) {
    z++;
  }

  let M = S;
  let c = modPow(z, Q, p);
  let t = modPow(a, Q, p);
  let R = modPow(a, (Q + 1) / 2, p);

  let maxIter = 1000;
  while (maxIter-- > 0) {
    if (t === 0) return 0;
    if (t === 1) return R;

    // Find least i such that t^(2^i) = 1
    let i = 1;
    const bp = BigInt(p);
    let temp = (BigInt(t) * BigInt(t)) % bp;
    while (temp !== 1n) {
      temp = (temp * temp) % bp;
      i++;
    }

    const b = modPow(c, 2 ** (M - i - 1), p);
    M = i;
    c = (b * b) % p;
    t = (t * c) % p;
    R = (R * b) % p;
  }
  throw new Error('modSqrt: Tonelli-Shanks failed to converge');
}

// ============================================================================
// DISCRETE LOGARITHM
// ============================================================================

/**
 * Baby-step giant-step algorithm for discrete logarithm
 *
 * Finds x such that a^x ≡ b (mod p) where a is a primitive root
 *
 * Time Complexity: O(√p)
 * Space Complexity: O(√p)
 *
 * @param a - Base (primitive root)
 * @param b - Target
 * @param p - Prime modulus
 * @returns x such that a^x ≡ b (mod p), or -1 if no solution
 *
 * @example
 * discreteLog(3, 13, 17); // 4 (3^4 ≡ 13 mod 17)
 */
export function discreteLog(a: number, b: number, p: number): number {
  if (!isPrime(p)) throw new Error('discreteLog: p must be prime');

  a = ((a % p) + p) % p;
  b = ((b % p) + p) % p;

  const m = Math.ceil(Math.sqrt(p));

  // Baby step: compute a^j for j = 0, 1, ..., m-1
  const table = new Map<number, number>();
  let power = 1;

  for (let j = 0; j < m; j++) {
    table.set(power, j);
    power = (power * a) % p;
  }

  // Giant step: compute b * (a^-m)^i for i = 0, 1, ...
  const factor = modPow(modInverse(a, p), m, p);
  let gamma = b;

  for (let i = 0; i < m; i++) {
    if (table.has(gamma)) {
      const j = table.get(gamma);
      if (j !== undefined) {
        return i * m + j;
      }
    }
    gamma = (gamma * factor) % p;
  }

  return -1; // No solution found
}
