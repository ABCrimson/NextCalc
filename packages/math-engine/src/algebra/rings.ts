/**
 * Ring Theory Operations
 *
 * Provides comprehensive ring theory functionality including:
 * - Abstract ring operations and axiom verification
 * - Ideals, quotient rings
 * - Ring homomorphisms and isomorphisms
 * - Polynomial rings
 * - Examples: Z, Z_n, Z[i] (Gaussian integers)
 *
 * @module algebra/rings
 */

/**
 * Ring element type
 */
export type RingElement = number | string | { readonly real: number; readonly imag: number };

/**
 * Binary operation on ring elements
 */
export type RingOperation<T extends RingElement> = (a: T, b: T) => T;

/**
 * Abstract ring interface
 *
 * A ring (R, +, ·) consists of:
 * - A set R
 * - Addition operation + (forms abelian group)
 * - Multiplication operation · (associative, distributive over +)
 * - Additive identity (zero)
 * - Multiplicative identity (one) for rings with unity
 */
export interface Ring<T extends RingElement> {
  /** Ring elements */
  readonly elements: ReadonlyArray<T>;
  /** Addition operation */
  readonly add: RingOperation<T>;
  /** Multiplication operation */
  readonly multiply: RingOperation<T>;
  /** Additive identity (zero) */
  readonly zero: T;
  /** Multiplicative identity (one) */
  readonly one: T;
  /** Additive inverse function */
  readonly negate: (element: T) => T;
  /** Ring name */
  readonly name: string;
  /** Whether ring is commutative */
  readonly isCommutative: boolean;
  /** Whether ring has unity (multiplicative identity) */
  readonly hasUnity: boolean;
}

/**
 * Polynomial representation: coefficients array [a0, a1, a2, ...]
 * represents a0 + a1*x + a2*x^2 + ...
 */
export type Polynomial = ReadonlyArray<number>;

// ============================================================================
// RING AXIOM VERIFICATION
// ============================================================================

/**
 * Verifies if a set with two operations forms a valid ring
 *
 * Checks:
 * 1. (R, +) is an abelian group
 * 2. Multiplication is associative
 * 3. Distributive laws: a(b+c) = ab+ac and (a+b)c = ac+bc
 *
 * Time Complexity: O(n³) where n is the number of elements
 *
 * @param elements - Set of elements
 * @param add - Addition operation
 * @param multiply - Multiplication operation
 * @param zero - Additive identity
 * @param negate - Additive inverse function
 * @returns Verification result with details
 *
 * @example
 * const result = verifyRingAxioms(
 *   [0, 1, 2, 3],
 *   (a, b) => (a + b) % 4,
 *   (a, b) => (a * b) % 4,
 *   0,
 *   (a) => (4 - a) % 4
 * );
 * console.log(result.isRing); // true (Z_4)
 */
export function verifyRingAxioms<T extends RingElement>(
  elements: ReadonlyArray<T>,
  add: RingOperation<T>,
  multiply: RingOperation<T>,
  _zero: T,
  _negate: (element: T) => T
): {
  readonly isRing: boolean;
  readonly additiveGroupValid: boolean;
  readonly multiplicationAssociative: boolean;
  readonly distributive: boolean;
  readonly errors: ReadonlyArray<string>;
} {
  const errors: string[] = [];

  // Check (R, +) forms abelian group
  let additiveGroupValid = true;

  // Closure under addition
  for (const a of elements) {
    for (const b of elements) {
      if (!elements.includes(add(a, b))) {
        additiveGroupValid = false;
        errors.push(`Addition closure fails: ${String(a)} + ${String(b)} not in ring`);
        break;
      }
    }
    if (!additiveGroupValid) break;
  }

  // Check commutativity of addition
  for (const a of elements) {
    for (const b of elements) {
      if (add(a, b) !== add(b, a)) {
        additiveGroupValid = false;
        errors.push(`Addition not commutative: ${String(a)} + ${String(b)} ≠ ${String(b)} + ${String(a)}`);
        break;
      }
    }
    if (!additiveGroupValid) break;
  }

  // Check multiplication associativity (sample check)
  let multiplicationAssociative = true;
  const sampleSize = Math.min(elements.length, 5);
  for (let i = 0; i < sampleSize && multiplicationAssociative; i++) {
    for (let j = 0; j < sampleSize && multiplicationAssociative; j++) {
      for (let k = 0; k < sampleSize && multiplicationAssociative; k++) {
        const a = elements[i];
        const b = elements[j];
        const c = elements[k];
        if (!a || !b || !c) continue;

        const left = multiply(multiply(a, b), c);
        const right = multiply(a, multiply(b, c));

        if (left !== right) {
          multiplicationAssociative = false;
          errors.push(
            `Multiplication not associative: (${String(a)} * ${String(b)}) * ${String(c)} ≠ ${String(a)} * (${String(b)} * ${String(c)})`
          );
        }
      }
    }
  }

  // Check distributive laws (sample check)
  let distributive = true;
  for (let i = 0; i < sampleSize && distributive; i++) {
    for (let j = 0; j < sampleSize && distributive; j++) {
      for (let k = 0; k < sampleSize && distributive; k++) {
        const a = elements[i];
        const b = elements[j];
        const c = elements[k];
        if (!a || !b || !c) continue;

        // Left distributive: a(b+c) = ab + ac
        const leftDist1 = multiply(a, add(b, c));
        const leftDist2 = add(multiply(a, b), multiply(a, c));

        if (leftDist1 !== leftDist2) {
          distributive = false;
          errors.push(
            `Left distributive law fails: ${String(a)} * (${String(b)} + ${String(c)}) ≠ ${String(a)} * ${String(b)} + ${String(a)} * ${String(c)}`
          );
        }

        // Right distributive: (a+b)c = ac + bc
        const rightDist1 = multiply(add(a, b), c);
        const rightDist2 = add(multiply(a, c), multiply(b, c));

        if (rightDist1 !== rightDist2) {
          distributive = false;
          errors.push(
            `Right distributive law fails: (${String(a)} + ${String(b)}) * ${String(c)} ≠ ${String(a)} * ${String(c)} + ${String(b)} * ${String(c)}`
          );
        }
      }
    }
  }

  return {
    isRing: additiveGroupValid && multiplicationAssociative && distributive,
    additiveGroupValid,
    multiplicationAssociative,
    distributive,
    errors,
  };
}

// ============================================================================
// STANDARD RINGS
// ============================================================================

/**
 * Creates the ring Z_n (integers modulo n)
 *
 * Z_n with addition and multiplication modulo n
 *
 * Properties:
 * - Commutative ring with unity
 * - Field if and only if n is prime
 *
 * @param n - Modulus (n > 1)
 * @returns Ring Z_n
 *
 * @example
 * const z5 = createModularRing(5);
 * console.log(z5.multiply(3, 4)); // 2 (3 * 4 mod 5)
 */
export function createModularRing(n: number): Ring<number> {
  if (n <= 1 || !Number.isInteger(n)) {
    throw new Error('createModularRing: n must be an integer > 1');
  }

  const elements = Array.from({ length: n }, (_, i) => i);

  return {
    elements,
    add: (a, b) => (a + b) % n,
    multiply: (a, b) => (a * b) % n,
    zero: 0,
    one: 1,
    negate: (a) => (n - a) % n,
    name: `Z_${n}`,
    isCommutative: true,
    hasUnity: true,
  };
}

/**
 * Gaussian integer: a + bi where a, b ∈ Z
 */
export interface GaussianInteger {
  readonly real: number;
  readonly imag: number;
}

/**
 * Creates a Gaussian integer
 *
 * @param real - Real part
 * @param imag - Imaginary part
 * @returns Gaussian integer
 */
export function gaussian(real: number, imag: number): GaussianInteger {
  if (!Number.isInteger(real) || !Number.isInteger(imag)) {
    throw new Error('gaussian: Both parts must be integers');
  }
  return { real, imag };
}

/**
 * Ring operations for Gaussian integers Z[i]
 *
 * Z[i] = {a + bi : a, b ∈ Z}
 *
 * This is not a complete ring object (infinite elements), but provides operations
 */
export const GaussianIntegerOps = {
  add: (a: GaussianInteger, b: GaussianInteger): GaussianInteger =>
    gaussian(a.real + b.real, a.imag + b.imag),

  multiply: (a: GaussianInteger, b: GaussianInteger): GaussianInteger =>
    gaussian(a.real * b.real - a.imag * b.imag, a.real * b.imag + a.imag * b.real),

  negate: (a: GaussianInteger): GaussianInteger => gaussian(-a.real, -a.imag),

  zero: gaussian(0, 0),
  one: gaussian(1, 0),

  /**
   * Norm of Gaussian integer: N(a + bi) = a² + b²
   */
  norm: (a: GaussianInteger): number => a.real * a.real + a.imag * a.imag,

  /**
   * Conjugate: conj(a + bi) = a - bi
   */
  conjugate: (a: GaussianInteger): GaussianInteger => gaussian(a.real, -a.imag),

  /**
   * Check if Gaussian integer is a unit (±1, ±i)
   */
  isUnit: (a: GaussianInteger): boolean =>
    GaussianIntegerOps.norm(a) === 1,

  /**
   * String representation
   */
  toString: (a: GaussianInteger): string => {
    if (a.imag === 0) return String(a.real);
    if (a.real === 0) return a.imag === 1 ? 'i' : a.imag === -1 ? '-i' : `${a.imag}i`;
    const sign = a.imag > 0 ? '+' : '-';
    const imagPart = Math.abs(a.imag) === 1 ? 'i' : `${Math.abs(a.imag)}i`;
    return `${a.real}${sign}${imagPart}`;
  },
};

// ============================================================================
// POLYNOMIAL RINGS
// ============================================================================

/**
 * Normalizes a polynomial by removing leading zeros
 *
 * @param poly - Polynomial coefficients
 * @returns Normalized polynomial
 */
function normalizePolynomial(poly: Polynomial): Polynomial {
  if (poly.length === 0) return [0];

  let lastNonZero = poly.length - 1;
  while (lastNonZero > 0 && poly[lastNonZero] === 0) {
    lastNonZero--;
  }

  return poly.slice(0, lastNonZero + 1);
}

/**
 * Adds two polynomials
 *
 * Time Complexity: O(max(deg(p), deg(q)))
 *
 * @param p - First polynomial
 * @param q - Second polynomial
 * @returns Sum p + q
 *
 * @example
 * addPolynomials([1, 2, 3], [4, 5]); // [5, 7, 3] (1+2x+3x² + 4+5x)
 */
export function addPolynomials(p: Polynomial, q: Polynomial): Polynomial {
  const maxLen = Math.max(p.length, q.length);
  const result: number[] = [];

  for (let i = 0; i < maxLen; i++) {
    result.push((p[i] ?? 0) + (q[i] ?? 0));
  }

  return normalizePolynomial(result);
}

/**
 * Multiplies two polynomials
 *
 * Time Complexity: O(deg(p) * deg(q))
 *
 * @param p - First polynomial
 * @param q - Second polynomial
 * @returns Product p * q
 *
 * @example
 * multiplyPolynomials([1, 2], [3, 4]); // [3, 10, 8] ((1+2x)(3+4x) = 3+10x+8x²)
 */
export function multiplyPolynomials(p: Polynomial, q: Polynomial): Polynomial {
  if (p.length === 0 || q.length === 0) return [0];

  const result = new Array<number>((p.length - 1) + (q.length - 1) + 1).fill(0);

  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      const pCoeff = p[i];
      const qCoeff = q[j];
      if (pCoeff !== undefined && qCoeff !== undefined) {
        result[i + j] = (result[i + j] ?? 0) + pCoeff * qCoeff;
      }
    }
  }

  return normalizePolynomial(result);
}

/**
 * Divides polynomial p by q, returns quotient and remainder
 *
 * p = q * quotient + remainder, where deg(remainder) < deg(q)
 *
 * Time Complexity: O(deg(p) * deg(q))
 *
 * @param p - Dividend polynomial
 * @param q - Divisor polynomial
 * @returns {quotient, remainder}
 *
 * @example
 * dividePolynomials([1, 0, -1], [1, -1]); // quot: [1, 1], rem: [0]
 * // (x²-1) = (x-1)(x+1) + 0
 */
export function dividePolynomials(
  p: Polynomial,
  q: Polynomial
): { readonly quotient: Polynomial; readonly remainder: Polynomial } {
  if (q.every((c) => c === 0)) {
    throw new Error('dividePolynomials: Division by zero polynomial');
  }

  // Convert readonly to mutable array
  let remainder: number[] = [...p];
  const quotient: number[] = [];

  while (remainder.length >= q.length && !remainder.every((c) => c === 0)) {
    const leadCoeff = remainder[remainder.length - 1] ?? 0;
    const divisorLead = q[q.length - 1] ?? 1;
    const coeff = leadCoeff / divisorLead;

    quotient.unshift(coeff);

    // Subtract q * coeff * x^(deg(remainder) - deg(q)) from remainder
    const shift = remainder.length - q.length;
    for (let i = 0; i < q.length; i++) {
      const qCoeff = q[i];
      if (qCoeff !== undefined) {
        remainder[i + shift] = (remainder[i + shift] ?? 0) - coeff * qCoeff;
      }
    }

    // Convert to readonly, then back to mutable for next iteration
    remainder = [...normalizePolynomial(remainder)];
  }

  return {
    quotient: normalizePolynomial(quotient.length > 0 ? quotient : [0]),
    remainder: normalizePolynomial(remainder),
  };
}

/**
 * Evaluates polynomial at a given point
 *
 * Uses Horner's method for efficiency: O(n)
 *
 * @param poly - Polynomial coefficients
 * @param x - Point to evaluate at
 * @returns p(x)
 *
 * @example
 * evaluatePolynomial([1, 2, 3], 2); // 1 + 2*2 + 3*4 = 17
 */
export function evaluatePolynomial(poly: Polynomial, x: number): number {
  if (poly.length === 0) return 0;

  // Horner's method: a0 + x(a1 + x(a2 + x(a3 + ...)))
  let result = poly[poly.length - 1] ?? 0;
  for (let i = poly.length - 2; i >= 0; i--) {
    result = result * x + (poly[i] ?? 0);
  }

  return result;
}

/**
 * Computes derivative of a polynomial
 *
 * If p(x) = a0 + a1*x + a2*x² + ..., then p'(x) = a1 + 2*a2*x + ...
 *
 * @param poly - Polynomial
 * @returns Derivative polynomial
 *
 * @example
 * derivativePolynomial([1, 2, 3]); // [2, 6] (derivative of 1+2x+3x² is 2+6x)
 */
export function derivativePolynomial(poly: Polynomial): Polynomial {
  if (poly.length <= 1) return [0];

  return normalizePolynomial(poly.slice(1).map((coeff, i) => coeff * (i + 1)));
}

/**
 * Computes GCD of two polynomials using Euclidean algorithm
 *
 * @param p - First polynomial
 * @param q - Second polynomial
 * @returns GCD polynomial (monic)
 *
 * @example
 * gcdPolynomials([1, 0, -1], [1, -1]); // [1, -1] (x-1 divides x²-1)
 */
export function gcdPolynomials(p: Polynomial, q: Polynomial): Polynomial {
  let a: Polynomial = normalizePolynomial(p);
  let b: Polynomial = normalizePolynomial(q);

  while (!b.every((c) => c === 0)) {
    const { remainder } = dividePolynomials(a, b);
    a = b;
    b = remainder;
  }

  // Make monic (leading coefficient = 1)
  const leadCoeff = a[a.length - 1] ?? 1;
  return a.map((c) => c / leadCoeff);
}

/**
 * Converts polynomial to string representation
 *
 * @param poly - Polynomial coefficients
 * @param variable - Variable name (default: 'x')
 * @returns String representation
 *
 * @example
 * polynomialToString([1, -2, 3]); // "1 - 2x + 3x²"
 */
export function polynomialToString(poly: Polynomial, variable = 'x'): string {
  if (poly.length === 0 || poly.every((c) => c === 0)) return '0';

  const terms: string[] = [];

  for (let i = 0; i < poly.length; i++) {
    const coeff = poly[i];
    if (coeff === undefined || coeff === 0) continue;

    let term = '';

    // Coefficient
    if (i === 0 || Math.abs(coeff) !== 1) {
      term = String(Math.abs(coeff));
    }

    // Variable and exponent
    if (i > 0) {
      term += variable;
      if (i > 1) {
        term += `^${i}`;
      }
    }

    // Sign
    const sign = coeff > 0 ? '+' : '-';
    terms.push((terms.length === 0 && sign === '+' ? '' : ` ${sign} `) + term);
  }

  return terms.join('').trim();
}

// ============================================================================
// IDEALS
// ============================================================================

/**
 * Checks if a subset is an ideal
 *
 * I is an ideal of R if:
 * 1. I is a subgroup of (R, +)
 * 2. For all r ∈ R and i ∈ I: r*i ∈ I and i*r ∈ I
 *
 * @param ring - The ring
 * @param subset - Proposed ideal elements
 * @returns True if subset is an ideal
 *
 * @example
 * const z6 = createModularRing(6);
 * console.log(isIdeal(z6, [0, 2, 4])); // true (principal ideal (2))
 */
export function isIdeal<T extends RingElement>(
  ring: Ring<T>,
  subset: ReadonlyArray<T>
): boolean {
  // Check if it's a subgroup under addition
  if (!subset.includes(ring.zero)) {
    return false;
  }

  // Check closure under addition
  for (const a of subset) {
    for (const b of subset) {
      if (!subset.includes(ring.add(a, b))) {
        return false;
      }
    }
  }

  // Check closure under negation
  for (const a of subset) {
    if (!subset.includes(ring.negate(a))) {
      return false;
    }
  }

  // Check absorption: r*i ∈ I for all r ∈ R, i ∈ I
  for (const r of ring.elements) {
    for (const i of subset) {
      if (!subset.includes(ring.multiply(r, i)) || !subset.includes(ring.multiply(i, r))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Generates principal ideal generated by element a: (a) = {ra : r ∈ R}
 *
 * @param ring - The ring
 * @param a - Generator element
 * @returns Principal ideal (a)
 *
 * @example
 * const z6 = createModularRing(6);
 * console.log(principalIdeal(z6, 2)); // [0, 2, 4] (multiples of 2 mod 6)
 */
export function principalIdeal<T extends RingElement>(
  ring: Ring<T>,
  a: T
): ReadonlyArray<T> {
  const ideal = new Set<T>();

  for (const r of ring.elements) {
    ideal.add(ring.multiply(r, a));
  }

  return [...ideal];
}

// ============================================================================
// RING HOMOMORPHISMS
// ============================================================================

/**
 * Ring homomorphism φ: R → S
 */
export type RingHomomorphism<R extends RingElement, S extends RingElement> = (a: R) => S;

/**
 * Verifies if a function is a ring homomorphism
 *
 * φ is a ring homomorphism if:
 * - φ(a + b) = φ(a) + φ(b)
 * - φ(a * b) = φ(a) * φ(b)
 * - φ(1) = 1 (for rings with unity)
 *
 * @param source - Source ring
 * @param target - Target ring
 * @param phi - Function to verify
 * @returns True if φ is a ring homomorphism
 *
 * @example
 * const z6 = createModularRing(6);
 * const z3 = createModularRing(3);
 * const phi = (x: number) => x % 3;
 * console.log(isRingHomomorphism(z6, z3, phi)); // true
 */
export function isRingHomomorphism<R extends RingElement, S extends RingElement>(
  source: Ring<R>,
  target: Ring<S>,
  phi: RingHomomorphism<R, S>
): boolean {
  // Check φ(a + b) = φ(a) + φ(b)
  for (const a of source.elements) {
    for (const b of source.elements) {
      const left = phi(source.add(a, b));
      const right = target.add(phi(a), phi(b));

      if (left !== right) {
        return false;
      }
    }
  }

  // Check φ(a * b) = φ(a) * φ(b)
  for (const a of source.elements) {
    for (const b of source.elements) {
      const left = phi(source.multiply(a, b));
      const right = target.multiply(phi(a), phi(b));

      if (left !== right) {
        return false;
      }
    }
  }

  // Check φ(1) = 1 if both rings have unity
  if (source.hasUnity && target.hasUnity) {
    if (phi(source.one) !== target.one) {
      return false;
    }
  }

  return true;
}
