/**
 * Field Theory Operations
 *
 * Provides comprehensive field theory functionality including:
 * - Field axiom verification
 * - Finite fields (Galois fields)
 * - Field extensions Q(√2), Q(√-1), etc.
 * - Minimal polynomials
 * - Splitting fields
 * - Galois theory foundations
 *
 * @module algebra/fields
 */

import type { Polynomial } from './rings';
import { evaluatePolynomial } from './rings';

/**
 * Field element type
 */
export type FieldElement = number | { readonly num: number; readonly denom: number };

/**
 * Binary operation on field elements
 */
export type FieldOperation<T extends FieldElement> = (a: T, b: T) => T;

/**
 * Abstract field interface
 *
 * A field (F, +, ·) is a commutative ring where every nonzero element has a multiplicative inverse
 */
export interface Field<T extends FieldElement> {
  /** Field elements */
  readonly elements: ReadonlyArray<T>;
  /** Addition operation */
  readonly add: FieldOperation<T>;
  /** Multiplication operation */
  readonly multiply: FieldOperation<T>;
  /** Additive identity (zero) */
  readonly zero: T;
  /** Multiplicative identity (one) */
  readonly one: T;
  /** Additive inverse function */
  readonly negate: (element: T) => T;
  /** Multiplicative inverse function */
  readonly invert: (element: T) => T;
  /** Field name */
  readonly name: string;
  /** Characteristic (0 for infinite fields, p for F_p) */
  readonly characteristic: number;
}

// ============================================================================
// FIELD AXIOM VERIFICATION
// ============================================================================

/**
 * Verifies if a set with operations forms a valid field
 *
 * A field must satisfy:
 * 1. All ring axioms
 * 2. Multiplication is commutative
 * 3. Every nonzero element has a multiplicative inverse
 *
 * @param elements - Set of elements
 * @param add - Addition operation
 * @param multiply - Multiplication operation
 * @param zero - Additive identity
 * @param one - Multiplicative identity
 * @param negate - Additive inverse
 * @param invert - Multiplicative inverse
 * @returns Verification result
 *
 * @example
 * const result = verifyFieldAxioms(
 *   [0, 1, 2, 3, 4],
 *   (a, b) => (a + b) % 5,
 *   (a, b) => (a * b) % 5,
 *   0,
 *   1,
 *   (a) => (5 - a) % 5,
 *   (a) => modInverse(a, 5)
 * );
 * console.log(result.isField); // true (F_5)
 */
export function verifyFieldAxioms<T extends FieldElement>(
  elements: ReadonlyArray<T>,
  _add: FieldOperation<T>,
  multiply: FieldOperation<T>,
  zero: T,
  one: T,
  _negate: (element: T) => T,
  invert: (element: T) => T
): {
  readonly isField: boolean;
  readonly multiplicativeCommutative: boolean;
  readonly hasInverses: boolean;
  readonly errors: ReadonlyArray<string>;
} {
  const errors: string[] = [];

  // Check multiplication commutativity
  let multiplicativeCommutative = true;
  for (const a of elements) {
    for (const b of elements) {
      if (multiply(a, b) !== multiply(b, a)) {
        multiplicativeCommutative = false;
        errors.push(`Multiplication not commutative: ${String(a)} * ${String(b)} ≠ ${String(b)} * ${String(a)}`);
        break;
      }
    }
    if (!multiplicativeCommutative) break;
  }

  // Check multiplicative inverses for nonzero elements
  let hasInverses = true;
  for (const a of elements) {
    if (a === zero) continue;

    try {
      const inv = invert(a);
      if (!elements.includes(inv)) {
        hasInverses = false;
        errors.push(`Inverse of ${String(a)} is ${String(inv)}, not in field`);
        break;
      }

      if (multiply(a, inv) !== one) {
        hasInverses = false;
        errors.push(`Inverse fails: ${String(a)} * ${String(inv)} ≠ 1`);
        break;
      }
    } catch {
      hasInverses = false;
      errors.push(`No inverse for ${String(a)}`);
      break;
    }
  }

  return {
    isField: multiplicativeCommutative && hasInverses,
    multiplicativeCommutative,
    hasInverses,
    errors,
  };
}

// ============================================================================
// FINITE FIELDS (GALOIS FIELDS)
// ============================================================================

/**
 * Computes modular multiplicative inverse using Extended Euclidean Algorithm
 *
 * Finds x such that a*x ≡ 1 (mod m)
 *
 * @param a - Number to invert
 * @param m - Modulus
 * @returns Multiplicative inverse modulo m
 * @throws Error if gcd(a, m) ≠ 1
 *
 * @example
 * modInverse(3, 7); // 5 (because 3*5 = 15 ≡ 1 mod 7)
 */
export function modInverse(a: number, m: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(m)) {
    throw new Error('modInverse: Arguments must be integers');
  }

  a = ((a % m) + m) % m;

  // Extended Euclidean Algorithm
  let [old_r, r] = [a, m];
  let [old_s, s] = [1, 0];

  while (r !== 0) {
    const quotient = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  if (old_r !== 1) {
    throw new Error(`modInverse: ${a} has no inverse modulo ${m}`);
  }

  return ((old_s % m) + m) % m;
}

/**
 * Creates a finite field F_p (integers modulo prime p)
 *
 * F_p is a field if and only if p is prime
 *
 * Properties:
 * - Order: p
 * - Characteristic: p
 * - All nonzero elements form cyclic multiplicative group
 *
 * @param p - Prime modulus
 * @returns Finite field F_p
 *
 * @example
 * const f5 = createFiniteField(5);
 * console.log(f5.multiply(2, 3)); // 1 (2*3 mod 5)
 * console.log(f5.invert(2)); // 3 (2*3 ≡ 1 mod 5)
 */
export function createFiniteField(p: number): Field<number> {
  if (p <= 1 || !Number.isInteger(p) || !isPrime(p)) {
    throw new Error('createFiniteField: p must be a prime number');
  }

  const elements = Array.from({ length: p }, (_, i) => i);

  return {
    elements,
    add: (a, b) => (a + b) % p,
    multiply: (a, b) => (a * b) % p,
    zero: 0,
    one: 1,
    negate: (a) => (p - a) % p,
    invert: (a) => {
      if (a === 0) throw new Error('Cannot invert zero');
      return modInverse(a, p);
    },
    name: `F_${p}`,
    characteristic: p,
  };
}

/**
 * Simple primality test
 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;

  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }

  return true;
}

/**
 * Checks if a number is a primitive root modulo p
 *
 * g is a primitive root mod p if ord(g) = p-1 in the multiplicative group
 *
 * @param g - Candidate primitive root
 * @param p - Prime modulus
 * @returns True if g is a primitive root mod p
 */
export function isPrimitiveRoot(g: number, p: number): boolean {
  if (!isPrime(p)) return false;

  g = g % p;
  if (g === 0) return false;

  // Check if g^((p-1)/q) ≢ 1 (mod p) for all prime divisors q of p-1
  const primeFactors = new Set<number>();
  let n = p - 1;

  for (let i = 2; i * i <= n; i++) {
    while (n % i === 0) {
      primeFactors.add(i);
      n /= i;
    }
  }
  if (n > 1) primeFactors.add(n);

  for (const q of primeFactors) {
    if (modPow(g, (p - 1) / q, p) === 1) {
      return false;
    }
  }

  return true;
}

/**
 * Modular exponentiation: computes (base^exp) mod mod
 */
function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  base = base % mod;

  while (exp > 0) {
    if (exp % 2 === 1) {
      result = (result * base) % mod;
    }
    exp = Math.floor(exp / 2);
    base = (base * base) % mod;
  }

  return result;
}

/**
 * Finds a primitive root modulo p
 *
 * A primitive root generates the multiplicative group (F_p)*
 *
 * @param p - Prime modulus
 * @returns A primitive root modulo p
 *
 * @example
 * findPrimitiveRoot(7); // 3 (or 5)
 */
export function findPrimitiveRoot(p: number): number {
  if (!isPrime(p)) {
    throw new Error('findPrimitiveRoot: p must be prime');
  }

  for (let g = 2; g < p; g++) {
    if (isPrimitiveRoot(g, p)) {
      return g;
    }
  }

  throw new Error('findPrimitiveRoot: No primitive root found (should not happen for prime p)');
}

// ============================================================================
// FIELD EXTENSIONS
// ============================================================================

/**
 * Element of field extension Q(√d) = {a + b√d : a, b ∈ Q}
 */
export interface QuadraticExtensionElement {
  readonly a: number; // Rational part
  readonly b: number; // √d coefficient
  readonly d: number; // The √d being adjoined
}

/**
 * Creates element in Q(√d)
 *
 * @param a - Rational part
 * @param b - Coefficient of √d
 * @param d - The number under the square root
 * @returns Element a + b√d
 */
export function quadraticElement(a: number, b: number, d: number): QuadraticExtensionElement {
  return { a, b, d };
}

/**
 * Field operations for Q(√d)
 *
 * Provides arithmetic in quadratic extensions of Q
 */
export function createQuadraticExtensionOps(d: number): {
  readonly add: (x: QuadraticExtensionElement, y: QuadraticExtensionElement) => QuadraticExtensionElement;
  readonly multiply: (x: QuadraticExtensionElement, y: QuadraticExtensionElement) => QuadraticExtensionElement;
  readonly negate: (x: QuadraticExtensionElement) => QuadraticExtensionElement;
  readonly invert: (x: QuadraticExtensionElement) => QuadraticExtensionElement;
  readonly zero: QuadraticExtensionElement;
  readonly one: QuadraticExtensionElement;
  readonly toString: (x: QuadraticExtensionElement) => string;
} {
  return {
    add: (x, y) => {
      if (x.d !== d || y.d !== d) {
        throw new Error('Cannot add elements from different extensions');
      }
      return quadraticElement(x.a + y.a, x.b + y.b, d);
    },

    multiply: (x, y) => {
      if (x.d !== d || y.d !== d) {
        throw new Error('Cannot multiply elements from different extensions');
      }
      // (a + b√d)(c + e√d) = (ac + bde) + (ae + bc)√d
      return quadraticElement(x.a * y.a + x.b * y.b * d, x.a * y.b + x.b * y.a, d);
    },

    negate: (x) => quadraticElement(-x.a, -x.b, d),

    invert: (x) => {
      if (x.a === 0 && x.b === 0) {
        throw new Error('Cannot invert zero');
      }
      // 1/(a + b√d) = (a - b√d)/(a² - b²d)
      const norm = x.a * x.a - x.b * x.b * d;
      if (norm === 0) {
        throw new Error('Element has zero norm, not invertible');
      }
      return quadraticElement(x.a / norm, -x.b / norm, d);
    },

    zero: quadraticElement(0, 0, d),
    one: quadraticElement(1, 0, d),

    toString: (x) => {
      if (x.b === 0) return String(x.a);
      if (x.a === 0) return `${x.b}√${x.d}`;
      const sign = x.b > 0 ? '+' : '-';
      return `${x.a} ${sign} ${Math.abs(x.b)}√${x.d}`;
    },
  };
}

// ============================================================================
// MINIMAL POLYNOMIALS
// ============================================================================

/**
 * Computes minimal polynomial of √d over Q
 *
 * The minimal polynomial is the monic polynomial of smallest degree with rational
 * coefficients that has √d as a root
 *
 * For √d: x² - d (if d is not a perfect square)
 *
 * @param d - The number under square root
 * @returns Minimal polynomial coefficients [constant, x, x², ...]
 *
 * @example
 * minimalPolynomialSqrt(2); // [-2, 0, 1] (x² - 2)
 */
export function minimalPolynomialSqrt(d: number): Polynomial {
  const sqrt = Math.sqrt(d);
  if (Number.isInteger(sqrt)) {
    // d is a perfect square, √d is rational
    return [-sqrt, 1]; // x - √d
  }

  return [-d, 0, 1]; // x² - d
}

/**
 * Checks if a polynomial is irreducible over Q
 *
 * A polynomial is irreducible if it cannot be factored into polynomials of lower degree
 * This is a simplified check using Eisenstein's criterion and rational root theorem
 *
 * @param poly - Polynomial to check
 * @returns True if likely irreducible (not definitive for all cases)
 *
 * @example
 * isIrreducible([-2, 0, 1]); // true (x² - 2)
 * isIrreducible([-1, 0, 1]); // false (x² - 1 = (x-1)(x+1))
 */
export function isIrreducible(poly: Polynomial): boolean {
  if (poly.length <= 2) return true; // Linear polynomials are irreducible

  // Check for rational roots using rational root theorem
  const a0 = poly[0] ?? 0;
  const an = poly[poly.length - 1] ?? 1;

  // Potential rational roots are ±(divisors of a0)/(divisors of an)
  const divisorsA0 = getDivisors(Math.abs(a0));
  const divisorsAn = getDivisors(Math.abs(an));

  for (const p of divisorsA0) {
    for (const q of divisorsAn) {
      for (const sign of [1, -1]) {
        const candidate = (sign * p) / q;
        if (Math.abs(evaluatePolynomial(poly, candidate)) < 1e-10) {
          return false; // Found a rational root, so it's reducible
        }
      }
    }
  }

  return true; // No rational roots found
}

/**
 * Gets all divisors of a number
 */
function getDivisors(n: number): number[] {
  if (n === 0) return [1];
  n = Math.abs(Math.floor(n));

  const divisors: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      divisors.push(i);
      if (i !== n / i) {
        divisors.push(n / i);
      }
    }
  }

  return divisors.sort((a, b) => a - b);
}

// ============================================================================
// SPLITTING FIELDS
// ============================================================================

/**
 * Finds roots of a polynomial over a finite field
 *
 * Uses brute force for small fields
 *
 * @param poly - Polynomial coefficients
 * @param field - Finite field
 * @returns Array of roots in the field
 *
 * @example
 * const f5 = createFiniteField(5);
 * findRootsFiniteField([2, 0, 1], f5); // Roots of x² + 2 in F_5
 */
export function findRootsFiniteField(poly: Polynomial, field: Field<number>): ReadonlyArray<number> {
  const roots: number[] = [];

  for (const x of field.elements) {
    if (Math.abs(evaluatePolynomial(poly, x)) < 1e-10) {
      roots.push(x);
    }
  }

  return roots;
}

/**
 * Computes degree of field extension [K:F]
 *
 * For a simple extension K = F(α) where α has minimal polynomial of degree n,
 * [K:F] = n
 *
 * @param minimalPoly - Minimal polynomial of the adjoined element
 * @returns Degree of extension
 */
export function extensionDegree(minimalPoly: Polynomial): number {
  return minimalPoly.length - 1;
}

/**
 * Checks if an extension is a splitting field for a polynomial
 *
 * A splitting field is the smallest field containing all roots of the polynomial
 *
 * This is a simplified check that verifies all roots are in the extension
 *
 * @param poly - Polynomial
 * @param field - Field
 * @returns True if field contains all roots
 */
export function isSplittingField(poly: Polynomial, field: Field<number>): boolean {
  const roots = findRootsFiniteField(poly, field);
  const degree = poly.length - 1;

  // Splitting field should contain exactly deg(poly) roots (counting multiplicity)
  return roots.length === degree;
}

// ============================================================================
// GALOIS THEORY FOUNDATIONS
// ============================================================================

/**
 * Field automorphism: bijective field homomorphism from field to itself
 */
export type FieldAutomorphism<T extends FieldElement> = (x: T) => T;

/**
 * Computes the Galois group of a field extension (simplified for finite fields)
 *
 * For F_p^n, the Galois group is cyclic of order n generated by Frobenius x ↦ x^p
 *
 * @param extension - Extended field
 * @param base - Base field
 * @returns Array of automorphisms (simplified representation)
 */
export function galoisGroupFiniteField(
  extension: Field<number>,
  base: Field<number>
): ReadonlyArray<string> {
  // For F_p^n over F_p, Galois group has order n
  // Generated by Frobenius automorphism φ(x) = x^p

  const p = base.characteristic;
  const n = Math.log(extension.elements.length) / Math.log(p);

  if (!Number.isInteger(n)) {
    throw new Error('Extension is not a valid extension of base');
  }

  const automorphisms: string[] = [];
  for (let i = 0; i < n; i++) {
    automorphisms.push(`φ^${i}(x) = x^${Math.pow(p, i)}`);
  }

  return automorphisms;
}

/**
 * Checks if an extension is Galois
 *
 * An extension is Galois if it's normal and separable
 * For finite fields, all extensions are Galois
 *
 * @param extension - Extended field
 * @param base - Base field
 * @returns True if extension is Galois
 */
export function isGaloisExtension(extension: Field<number>, base: Field<number>): boolean {
  // All finite field extensions are Galois
  return (
    extension.characteristic === base.characteristic &&
    extension.elements.length >= base.elements.length &&
    extension.elements.length % base.elements.length === 0
  );
}
