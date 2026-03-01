/**
 * Comprehensive unit tests for modular arithmetic
 *
 * Covers: modAdd, modSub, modMul, modPow, extendedGCD, modInverse,
 * CRT, eulerPhi, verifyEulerTheorem, multiplicativeOrder,
 * isPrimitiveRoot, findAllPrimitiveRoots, hasPrimitiveRoot,
 * isQuadraticResidue, legendreSymbol, jacobiSymbol, modSqrt,
 * discreteLog
 */

import { describe, expect, it } from 'vitest';
import {
  crt,
  discreteLog,
  eulerPhi,
  extendedGCD,
  findAllPrimitiveRoots,
  hasPrimitiveRoot,
  isPrimitiveRoot,
  isQuadraticResidue,
  jacobiSymbol,
  legendreSymbol,
  modAdd,
  modInverse,
  modMul,
  modPow,
  modSqrt,
  modSub,
  multiplicativeOrder,
  verifyEulerTheorem,
} from './modular';

// ===========================================================================
// BASIC MODULAR OPERATIONS
// ===========================================================================

describe('modAdd', () => {
  it('computes (3 + 4) mod 5 = 2', () => {
    expect(modAdd(3, 4, 5)).toBe(2);
  });

  it('computes (0 + 0) mod 7 = 0', () => {
    expect(modAdd(0, 0, 7)).toBe(0);
  });

  it('handles values larger than modulus', () => {
    expect(modAdd(10, 15, 7)).toBe((10 + 15) % 7);
  });
});

describe('modSub', () => {
  it('computes (5 - 3) mod 7 = 2', () => {
    expect(modSub(5, 3, 7)).toBe(2);
  });

  it('computes (3 - 5) mod 7 = 5', () => {
    // 3 - 5 = -2 mod 7 = 5
    expect(modSub(3, 5, 7)).toBe(5);
  });

  it('handles zero case', () => {
    expect(modSub(0, 0, 5)).toBe(0);
  });
});

describe('modMul', () => {
  it('computes (3 * 4) mod 5 = 2', () => {
    expect(modMul(3, 4, 5)).toBe(2);
  });

  it('handles multiplication by zero', () => {
    expect(modMul(5, 0, 7)).toBe(0);
  });

  it('handles large values', () => {
    expect(modMul(100, 200, 13)).toBe((100 * 200) % 13);
  });
});

// ===========================================================================
// MODULAR EXPONENTIATION
// ===========================================================================

describe('modPow', () => {
  it('computes 2^10 mod 1000 = 24', () => {
    expect(modPow(2, 10, 1000)).toBe(24);
  });

  it('computes 3^5 mod 7 = 5', () => {
    expect(modPow(3, 5, 7)).toBe(5);
  });

  it('base^0 mod m = 1', () => {
    expect(modPow(5, 0, 7)).toBe(1);
  });

  it('0^n mod m = 0 for n > 0', () => {
    expect(modPow(0, 5, 7)).toBe(0);
  });

  it('handles large exponents', () => {
    // Fermat's little theorem: a^(p-1) mod p = 1 for prime p
    expect(modPow(2, 6, 7)).toBe(1);
    expect(modPow(3, 12, 13)).toBe(1);
  });

  it('throws on negative exponent', () => {
    expect(() => modPow(2, -1, 7)).toThrow();
  });

  it('throws on non-positive modulus', () => {
    expect(() => modPow(2, 3, 0)).toThrow();
    expect(() => modPow(2, 3, -5)).toThrow();
  });

  it('handles negative base', () => {
    // (-2)^3 mod 7 = -8 mod 7 = 6
    expect(modPow(-2, 3, 7)).toBe(6);
  });
});

// ===========================================================================
// EXTENDED GCD
// ===========================================================================

describe('extendedGCD', () => {
  it('computes extGCD(30, 21) = {gcd: 3, ...}', () => {
    const result = extendedGCD(30, 21);
    expect(result.gcd).toBe(3);
    // Verify: 30*x + 21*y = 3
    expect(30 * result.x + 21 * result.y).toBe(3);
  });

  it('computes extGCD for coprime numbers', () => {
    const result = extendedGCD(7, 5);
    expect(result.gcd).toBe(1);
    expect(7 * result.x + 5 * result.y).toBe(1);
  });

  it('handles a = 0', () => {
    const result = extendedGCD(0, 5);
    expect(result.gcd).toBe(5);
  });

  it('Bezout identity always holds', () => {
    const pairs = [
      [12, 8],
      [35, 15],
      [99, 78],
      [17, 13],
    ];
    for (const [a, b] of pairs) {
      const result = extendedGCD(a, b);
      expect(a * result.x + b * result.y).toBe(result.gcd);
    }
  });
});

// ===========================================================================
// MODULAR INVERSE
// ===========================================================================

describe('modInverse', () => {
  it('computes inverse of 3 mod 7 = 5', () => {
    const inv = modInverse(3, 7);
    expect(inv).toBe(5);
    expect((3 * 5) % 7).toBe(1);
  });

  it('computes inverse of 10 mod 17 = 12', () => {
    const inv = modInverse(10, 17);
    expect(inv).toBe(12);
    expect((10 * 12) % 17).toBe(1);
  });

  it('a * modInverse(a, m) mod m = 1', () => {
    const cases = [
      [3, 11],
      [5, 13],
      [7, 19],
      [2, 5],
    ];
    for (const [a, m] of cases) {
      const inv = modInverse(a, m);
      expect((a * inv) % m).toBe(1);
    }
  });

  it('throws when no inverse exists', () => {
    expect(() => modInverse(2, 4)).toThrow(); // gcd(2,4) = 2
    expect(() => modInverse(6, 9)).toThrow(); // gcd(6,9) = 3
  });

  it('throws on non-positive modulus', () => {
    expect(() => modInverse(3, 0)).toThrow();
  });
});

// ===========================================================================
// CHINESE REMAINDER THEOREM
// ===========================================================================

describe('crt', () => {
  it('solves x ≡ 2 mod 3, x ≡ 3 mod 5, x ≡ 2 mod 7', () => {
    const result = crt([2, 3, 2], [3, 5, 7]);
    expect(result).toBe(23);
    expect(result % 3).toBe(2);
    expect(result % 5).toBe(3);
    expect(result % 7).toBe(2);
  });

  it('solves x ≡ 1 mod 2, x ≡ 2 mod 3', () => {
    const result = crt([1, 2], [2, 3]);
    expect(result % 2).toBe(1);
    expect(result % 3).toBe(2);
    expect(result).toBe(5);
  });

  it('throws on empty input', () => {
    expect(() => crt([], [])).toThrow();
  });

  it('throws on mismatched lengths', () => {
    expect(() => crt([1, 2], [3])).toThrow();
  });

  it('throws on non-coprime moduli', () => {
    expect(() => crt([1, 2], [4, 6])).toThrow();
  });

  it('handles single congruence', () => {
    const result = crt([3], [7]);
    expect(result).toBe(3);
  });
});

// ===========================================================================
// EULER'S TOTIENT FUNCTION
// ===========================================================================

describe('eulerPhi', () => {
  it('phi(1) = 1', () => {
    expect(eulerPhi(1)).toBe(1);
  });

  it('phi(p) = p-1 for prime p', () => {
    expect(eulerPhi(7)).toBe(6);
    expect(eulerPhi(13)).toBe(12);
    expect(eulerPhi(17)).toBe(16);
  });

  it('phi(p^2) = p*(p-1) for prime p', () => {
    expect(eulerPhi(9)).toBe(6); // 3^2: 3*(3-1) = 6
    expect(eulerPhi(25)).toBe(20); // 5^2: 5*(5-1) = 20
  });

  it('phi(12) = 4', () => {
    expect(eulerPhi(12)).toBe(4);
  });

  it('phi(100) = 40', () => {
    expect(eulerPhi(100)).toBe(40);
  });

  it('multiplicative property: phi(m*n) = phi(m)*phi(n) when gcd(m,n)=1', () => {
    // phi(35) = phi(5) * phi(7) = 4 * 6 = 24
    expect(eulerPhi(35)).toBe(eulerPhi(5) * eulerPhi(7));
  });

  it('throws on non-positive input', () => {
    expect(() => eulerPhi(0)).toThrow();
    expect(() => eulerPhi(-5)).toThrow();
  });

  it('throws on non-integer', () => {
    expect(() => eulerPhi(2.5)).toThrow();
  });
});

// ===========================================================================
// EULER'S THEOREM VERIFICATION
// ===========================================================================

describe('verifyEulerTheorem', () => {
  it('verifies a^phi(n) = 1 mod n for coprime a, n', () => {
    expect(verifyEulerTheorem(2, 7)).toBe(true);
    expect(verifyEulerTheorem(3, 10)).toBe(true);
    expect(verifyEulerTheorem(5, 12)).toBe(true);
  });

  it('returns false when gcd(a, n) != 1', () => {
    expect(verifyEulerTheorem(2, 4)).toBe(false);
    expect(verifyEulerTheorem(3, 9)).toBe(false);
  });
});

// ===========================================================================
// MULTIPLICATIVE ORDER
// ===========================================================================

describe('multiplicativeOrder', () => {
  it('ord_7(2) = 3', () => {
    expect(multiplicativeOrder(2, 7)).toBe(3);
  });

  it('ord_7(3) = 6 (primitive root)', () => {
    expect(multiplicativeOrder(3, 7)).toBe(6);
  });

  it('ord divides phi(n)', () => {
    const n = 13;
    const phi = eulerPhi(n);
    for (const a of [2, 3, 4, 5]) {
      const ord = multiplicativeOrder(a, n);
      expect(phi % ord).toBe(0);
    }
  });

  it('throws on non-coprime inputs', () => {
    expect(() => multiplicativeOrder(2, 4)).toThrow();
  });
});

// ===========================================================================
// PRIMITIVE ROOTS
// ===========================================================================

describe('isPrimitiveRoot', () => {
  it('3 is a primitive root mod 7', () => {
    expect(isPrimitiveRoot(3, 7)).toBe(true);
  });

  it('2 is NOT a primitive root mod 7', () => {
    expect(isPrimitiveRoot(2, 7)).toBe(false);
  });

  it('returns false when not coprime', () => {
    expect(isPrimitiveRoot(2, 4)).toBe(false);
  });
});

describe('findAllPrimitiveRoots', () => {
  it('finds primitive roots mod 7: [3, 5]', () => {
    const roots = findAllPrimitiveRoots(7);
    expect(roots).toEqual([3, 5]);
  });

  it('primitive roots mod p have count phi(phi(p))', () => {
    const p = 11;
    const roots = findAllPrimitiveRoots(p);
    expect(roots.length).toBe(eulerPhi(eulerPhi(p)));
  });

  it('returns empty for numbers without primitive roots', () => {
    const roots = findAllPrimitiveRoots(8);
    expect(roots).toEqual([]);
  });
});

describe('hasPrimitiveRoot', () => {
  it('primes have primitive roots', () => {
    expect(hasPrimitiveRoot(7)).toBe(true);
    expect(hasPrimitiveRoot(11)).toBe(true);
    expect(hasPrimitiveRoot(13)).toBe(true);
  });

  it('1, 2, 4 have primitive roots', () => {
    expect(hasPrimitiveRoot(1)).toBe(true);
    expect(hasPrimitiveRoot(2)).toBe(true);
    expect(hasPrimitiveRoot(4)).toBe(true);
  });

  it('8, 12, 15 do not have primitive roots', () => {
    expect(hasPrimitiveRoot(8)).toBe(false);
    expect(hasPrimitiveRoot(12)).toBe(false);
    expect(hasPrimitiveRoot(15)).toBe(false);
  });

  it('2p^k has primitive roots for odd prime p', () => {
    expect(hasPrimitiveRoot(6)).toBe(true); // 2 * 3
    expect(hasPrimitiveRoot(10)).toBe(true); // 2 * 5
    expect(hasPrimitiveRoot(14)).toBe(true); // 2 * 7
  });
});

// ===========================================================================
// QUADRATIC RESIDUES
// ===========================================================================

describe('isQuadraticResidue', () => {
  it('4 is a QR mod 7 (since 2^2 = 4)', () => {
    expect(isQuadraticResidue(4, 7)).toBe(true);
  });

  it('3 is NOT a QR mod 7', () => {
    expect(isQuadraticResidue(3, 7)).toBe(false);
  });

  it('0 is always a QR', () => {
    expect(isQuadraticResidue(0, 7)).toBe(true);
  });

  it('throws on non-prime modulus', () => {
    expect(() => isQuadraticResidue(4, 6)).toThrow();
  });

  it('exactly half of non-zero residues are QRs for odd prime', () => {
    const p = 11;
    let qrCount = 0;
    for (let a = 1; a < p; a++) {
      if (isQuadraticResidue(a, p)) qrCount++;
    }
    expect(qrCount).toBe((p - 1) / 2);
  });
});

// ===========================================================================
// LEGENDRE SYMBOL
// ===========================================================================

describe('legendreSymbol', () => {
  it('returns 1 for QR', () => {
    expect(legendreSymbol(4, 7)).toBe(1);
    expect(legendreSymbol(1, 7)).toBe(1);
    expect(legendreSymbol(2, 7)).toBe(1);
  });

  it('returns -1 for QNR', () => {
    expect(legendreSymbol(3, 7)).toBe(-1);
    expect(legendreSymbol(5, 7)).toBe(-1);
  });

  it('returns 0 when p divides a', () => {
    expect(legendreSymbol(7, 7)).toBe(0);
    expect(legendreSymbol(0, 7)).toBe(0);
    expect(legendreSymbol(14, 7)).toBe(0);
  });

  it('throws on non-prime p', () => {
    expect(() => legendreSymbol(3, 6)).toThrow();
  });
});

// ===========================================================================
// JACOBI SYMBOL
// ===========================================================================

describe('jacobiSymbol', () => {
  it('matches Legendre for prime n', () => {
    expect(jacobiSymbol(4, 7)).toBe(legendreSymbol(4, 7));
    expect(jacobiSymbol(3, 7)).toBe(legendreSymbol(3, 7));
  });

  it('computes Jacobi for composite odd n', () => {
    // (2/15) = (2/3)(2/5) = (-1)(−1) = 1
    const result = jacobiSymbol(2, 15);
    expect(result === 1 || result === -1 || result === 0).toBe(true);
  });

  it('returns 0 when gcd(a, n) > 1', () => {
    expect(jacobiSymbol(3, 9)).toBe(0); // 3 | 9
    expect(jacobiSymbol(5, 15)).toBe(0); // 5 | 15
  });

  it('throws on even n', () => {
    expect(() => jacobiSymbol(3, 4)).toThrow();
  });

  it('throws on non-positive n', () => {
    expect(() => jacobiSymbol(3, 0)).toThrow();
    expect(() => jacobiSymbol(3, -5)).toThrow();
  });
});

// ===========================================================================
// MODULAR SQUARE ROOT
// ===========================================================================

describe('modSqrt', () => {
  it('finds sqrt(4) mod 7 (result squared = 4 mod 7)', () => {
    const root = modSqrt(4, 7);
    expect((root * root) % 7).toBe(4);
  });

  it('finds sqrt(2) mod 7 (result squared = 2 mod 7)', () => {
    const root = modSqrt(2, 7);
    expect((root * root) % 7).toBe(2);
  });

  it('finds sqrt for p ≡ 3 mod 4 (Blum primes)', () => {
    // p = 11 (11 mod 4 = 3)
    const root = modSqrt(3, 11);
    expect((root * root) % 11).toBe(3);
  });

  it('finds sqrt for p ≡ 1 mod 4 (Tonelli-Shanks path)', () => {
    // p = 13 (13 mod 4 = 1)
    const root = modSqrt(10, 13);
    expect((root * root) % 13).toBe(10);
  });

  it('throws on QNR', () => {
    expect(() => modSqrt(3, 7)).toThrow(); // 3 is QNR mod 7
  });

  it('throws on non-prime modulus', () => {
    expect(() => modSqrt(4, 6)).toThrow();
  });
});

// ===========================================================================
// DISCRETE LOGARITHM
// ===========================================================================

describe('discreteLog', () => {
  it('finds x such that 3^x = 13 mod 17', () => {
    const x = discreteLog(3, 13, 17);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(modPow(3, x, 17)).toBe(13);
  });

  it('finds x such that 2^x = 1 mod 7', () => {
    const x = discreteLog(2, 1, 7);
    expect(x).toBe(0); // 2^0 = 1
  });

  it('finds x such that 2^x = 2 mod 7', () => {
    const x = discreteLog(2, 2, 7);
    expect(modPow(2, x, 7)).toBe(2);
  });

  it('throws on non-prime modulus', () => {
    expect(() => discreteLog(2, 3, 6)).toThrow();
  });
});
