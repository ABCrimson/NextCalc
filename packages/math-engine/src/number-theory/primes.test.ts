/**
 * Comprehensive unit tests for the primes module
 *
 * Covers: isPrime, millerRabin, lucasLehmer, sieveOfEratosthenes,
 * segmentedSieve, firstNPrimes, nextPrime, previousPrime,
 * trialDivision, primeFactorize, primeCount, twin primes,
 * Goldbach conjecture, and divisor functions.
 */

import { describe, expect, it } from 'vitest';
import {
  factorizationToString,
  findTwinPrimes,
  firstNPrimes,
  goldbachPairs,
  isPerfectNumber,
  isPrime,
  isTwinPrime,
  lucasLehmer,
  maxPrimeGap,
  millerRabin,
  nextPrime,
  nthPrimeApprox,
  numberOfDivisors,
  previousPrime,
  primeCount,
  primeCountApprox,
  primeFactorize,
  primeGap,
  satisfiesGoldbach,
  segmentedSieve,
  sieveOfEratosthenes,
  sumOfDivisors,
  trialDivision,
} from './primes';

// ===========================================================================
// isPrime
// ===========================================================================

describe('isPrime', () => {
  it('identifies small primes', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(3)).toBe(true);
    expect(isPrime(5)).toBe(true);
    expect(isPrime(7)).toBe(true);
    expect(isPrime(11)).toBe(true);
    expect(isPrime(13)).toBe(true);
  });

  it('rejects small composites', () => {
    expect(isPrime(4)).toBe(false);
    expect(isPrime(6)).toBe(false);
    expect(isPrime(8)).toBe(false);
    expect(isPrime(9)).toBe(false);
    expect(isPrime(10)).toBe(false);
    expect(isPrime(15)).toBe(false);
  });

  it('rejects edge cases', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(-1)).toBe(false);
    expect(isPrime(-7)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isPrime(2.5)).toBe(false);
    expect(isPrime(7.1)).toBe(false);
  });

  it('identifies larger primes', () => {
    expect(isPrime(97)).toBe(true);
    expect(isPrime(101)).toBe(true);
    expect(isPrime(7919)).toBe(true);
    expect(isPrime(104729)).toBe(true);
  });

  it('rejects larger composites', () => {
    expect(isPrime(100)).toBe(false);
    expect(isPrime(1000)).toBe(false);
    expect(isPrime(561)).toBe(false); // Carmichael number
  });
});

// ===========================================================================
// millerRabin
// ===========================================================================

describe('millerRabin', () => {
  it('identifies known primes', () => {
    expect(millerRabin(2)).toBe(true);
    expect(millerRabin(3)).toBe(true);
    expect(millerRabin(7919)).toBe(true);
  });

  it('rejects known composites', () => {
    expect(millerRabin(4)).toBe(false);
    expect(millerRabin(100)).toBe(false);
  });

  it('rejects edge cases', () => {
    expect(millerRabin(0)).toBe(false);
    expect(millerRabin(1)).toBe(false);
  });

  it('rejects even numbers', () => {
    expect(millerRabin(6)).toBe(false);
    expect(millerRabin(1000)).toBe(false);
  });

  it('handles Carmichael number 561 with enough rounds', () => {
    // 561 = 3 * 11 * 17 is composite; with 10 rounds should detect it
    expect(millerRabin(561, 10)).toBe(false);
  });
});

// ===========================================================================
// lucasLehmer
// ===========================================================================

describe('lucasLehmer', () => {
  it('confirms M2 = 3 is Mersenne prime', () => {
    expect(lucasLehmer(2)).toBe(true);
  });

  it('confirms M3 = 7 is Mersenne prime', () => {
    expect(lucasLehmer(3)).toBe(true);
  });

  it('confirms M5 = 31 is Mersenne prime', () => {
    expect(lucasLehmer(5)).toBe(true);
  });

  it('confirms M7 = 127 is Mersenne prime', () => {
    expect(lucasLehmer(7)).toBe(true);
  });

  it('rejects M11 = 2047 (23 * 89)', () => {
    expect(lucasLehmer(11)).toBe(false);
  });

  it('rejects non-prime exponents', () => {
    expect(lucasLehmer(4)).toBe(false);
    expect(lucasLehmer(6)).toBe(false);
  });

  it('confirms M13 = 8191 is Mersenne prime', () => {
    expect(lucasLehmer(13)).toBe(true);
  });
});

// ===========================================================================
// sieveOfEratosthenes
// ===========================================================================

describe('sieveOfEratosthenes', () => {
  it('returns empty for n < 2', () => {
    expect(sieveOfEratosthenes(0)).toEqual([]);
    expect(sieveOfEratosthenes(1)).toEqual([]);
  });

  it('returns [2] for n = 2', () => {
    expect(sieveOfEratosthenes(2)).toEqual([2]);
  });

  it('returns primes up to 20', () => {
    expect(sieveOfEratosthenes(20)).toEqual([2, 3, 5, 7, 11, 13, 17, 19]);
  });

  it('returns 25 primes up to 100', () => {
    const primes = sieveOfEratosthenes(100);
    expect(primes.length).toBe(25);
    expect(primes[0]).toBe(2);
    expect(primes[primes.length - 1]).toBe(97);
  });

  it('all results are actually prime', () => {
    const primes = sieveOfEratosthenes(200);
    for (const p of primes) {
      expect(isPrime(p)).toBe(true);
    }
  });
});

// ===========================================================================
// segmentedSieve
// ===========================================================================

describe('segmentedSieve', () => {
  it('returns primes in a range', () => {
    const primes = segmentedSieve(10, 30);
    expect(primes).toEqual([11, 13, 17, 19, 23, 29]);
  });

  it('handles low < 2', () => {
    const primes = segmentedSieve(0, 10);
    expect(primes).toEqual([2, 3, 5, 7]);
  });

  it('returns empty for high < 2', () => {
    expect(segmentedSieve(0, 1)).toEqual([]);
  });

  it('results match full sieve', () => {
    const full = sieveOfEratosthenes(100);
    const segment = segmentedSieve(2, 100);
    expect(segment).toEqual(full);
  });

  it('finds primes near 100', () => {
    const primes = segmentedSieve(90, 110);
    expect(primes).toEqual([97, 101, 103, 107, 109]);
  });
});

// ===========================================================================
// firstNPrimes
// ===========================================================================

describe('firstNPrimes', () => {
  it('returns empty for n <= 0', () => {
    expect(firstNPrimes(0)).toEqual([]);
    expect(firstNPrimes(-1)).toEqual([]);
  });

  it('returns [2] for n = 1', () => {
    expect(firstNPrimes(1)).toEqual([2]);
  });

  it('returns first 10 primes', () => {
    expect(firstNPrimes(10)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });

  it('returns correct count', () => {
    expect(firstNPrimes(25).length).toBe(25);
  });
});

// ===========================================================================
// nextPrime / previousPrime
// ===========================================================================

describe('nextPrime', () => {
  it('finds next prime after 10', () => {
    expect(nextPrime(10)).toBe(11);
  });

  it('finds next prime after a prime', () => {
    expect(nextPrime(7)).toBe(11);
  });

  it('finds next prime after 1', () => {
    expect(nextPrime(1)).toBe(2);
  });

  it('finds next prime after 0', () => {
    expect(nextPrime(0)).toBe(2);
  });

  it('finds next prime after 100', () => {
    expect(nextPrime(100)).toBe(101);
  });
});

describe('previousPrime', () => {
  it('finds previous prime before 10', () => {
    expect(previousPrime(10)).toBe(7);
  });

  it('finds previous prime before 14', () => {
    expect(previousPrime(14)).toBe(13);
  });

  it('returns -1 when no previous prime exists', () => {
    expect(previousPrime(2)).toBe(-1);
  });

  it('finds previous prime before 100', () => {
    expect(previousPrime(100)).toBe(97);
  });
});

// ===========================================================================
// trialDivision
// ===========================================================================

describe('trialDivision', () => {
  it('factors small primes', () => {
    const result = trialDivision(7);
    expect(result.n).toBe(7);
    expect(result.factors.get(7)).toBe(1);
    expect(result.factors.size).toBe(1);
  });

  it('factors 12 = 2^2 * 3', () => {
    const result = trialDivision(12);
    expect(result.factors.get(2)).toBe(2);
    expect(result.factors.get(3)).toBe(1);
    expect(result.factors.size).toBe(2);
  });

  it('factors 60 = 2^2 * 3 * 5', () => {
    const result = trialDivision(60);
    expect(result.factors.get(2)).toBe(2);
    expect(result.factors.get(3)).toBe(1);
    expect(result.factors.get(5)).toBe(1);
  });

  it('factors 1024 = 2^10', () => {
    const result = trialDivision(1024);
    expect(result.factors.get(2)).toBe(10);
    expect(result.factors.size).toBe(1);
  });

  it('factors product reconstructs original', () => {
    const n = 360; // 2^3 * 3^2 * 5
    const result = trialDivision(n);
    let product = 1;
    for (const [prime, exp] of result.factors) {
      product *= prime ** exp;
    }
    expect(product).toBe(n);
  });

  it('throws on non-positive input', () => {
    expect(() => trialDivision(0)).toThrow();
    expect(() => trialDivision(-5)).toThrow();
  });

  it('throws on non-integer input', () => {
    expect(() => trialDivision(2.5)).toThrow();
  });

  it('factors 1 correctly (empty factorization)', () => {
    const result = trialDivision(1);
    expect(result.factors.size).toBe(0);
  });
});

// ===========================================================================
// primeFactorize (Pollard's rho)
// ===========================================================================

describe('primeFactorize', () => {
  it('factors primes', () => {
    const result = primeFactorize(17);
    expect(result.factors.get(17)).toBe(1);
    expect(result.factors.size).toBe(1);
  });

  it('factors small composites', () => {
    const result = primeFactorize(12);
    expect(result.factors.get(2)).toBe(2);
    expect(result.factors.get(3)).toBe(1);
  });

  it('throws on n <= 1', () => {
    expect(() => primeFactorize(1)).toThrow();
    expect(() => primeFactorize(0)).toThrow();
  });
});

// ===========================================================================
// factorizationToString
// ===========================================================================

describe('factorizationToString', () => {
  it('formats single prime', () => {
    const result = factorizationToString(trialDivision(7));
    expect(result).toBe('7');
  });

  it('formats prime with exponent', () => {
    const result = factorizationToString(trialDivision(8));
    expect(result).toBe('2^3');
  });

  it('formats composite with multiple primes', () => {
    const result = factorizationToString(trialDivision(60));
    // Should be sorted: 2^2 x 3 x 5
    expect(result).toContain('2^2');
    expect(result).toContain('3');
    expect(result).toContain('5');
  });

  it('formats 1 as "1"', () => {
    const result = factorizationToString(trialDivision(1));
    expect(result).toBe('1');
  });
});

// ===========================================================================
// primeCount
// ===========================================================================

describe('primeCount', () => {
  it('pi(0) = 0', () => {
    expect(primeCount(0)).toBe(0);
  });

  it('pi(1) = 0', () => {
    expect(primeCount(1)).toBe(0);
  });

  it('pi(2) = 1', () => {
    expect(primeCount(2)).toBe(1);
  });

  it('pi(10) = 4', () => {
    expect(primeCount(10)).toBe(4);
  });

  it('pi(100) = 25', () => {
    expect(primeCount(100)).toBe(25);
  });
});

// ===========================================================================
// primeCountApprox
// ===========================================================================

describe('primeCountApprox', () => {
  it('returns 0 for x < 2', () => {
    expect(primeCountApprox(0)).toBe(0);
    expect(primeCountApprox(1)).toBe(0);
  });

  it('approximates pi(100) reasonably', () => {
    const approx = primeCountApprox(100);
    const exact = 25;
    // Should be within 30% of exact for small values
    expect(Math.abs(approx - exact) / exact).toBeLessThan(0.3);
  });
});

// ===========================================================================
// nthPrimeApprox
// ===========================================================================

describe('nthPrimeApprox', () => {
  it('throws on n < 1', () => {
    expect(() => nthPrimeApprox(0)).toThrow();
  });

  it('returns 2 for n = 1', () => {
    expect(nthPrimeApprox(1)).toBe(2);
  });

  it('gives reasonable approximation for n = 10', () => {
    const approx = nthPrimeApprox(10);
    const actual = 29; // 10th prime
    // Should be in the right ballpark
    expect(approx).toBeGreaterThan(10);
    expect(approx).toBeLessThan(100);
  });
});

// ===========================================================================
// Twin Primes
// ===========================================================================

describe('isTwinPrime', () => {
  it('identifies twin prime pairs', () => {
    expect(isTwinPrime(3)).toBe(true); // (3, 5)
    expect(isTwinPrime(5)).toBe(true); // (5, 7)
    expect(isTwinPrime(11)).toBe(true); // (11, 13)
    expect(isTwinPrime(17)).toBe(true); // (17, 19)
    expect(isTwinPrime(29)).toBe(true); // (29, 31)
  });

  it('rejects non-twin primes', () => {
    expect(isTwinPrime(7)).toBe(false); // 9 is not prime
    expect(isTwinPrime(23)).toBe(false); // 25 is not prime
  });

  it('rejects non-primes', () => {
    expect(isTwinPrime(4)).toBe(false);
    expect(isTwinPrime(10)).toBe(false);
  });
});

describe('findTwinPrimes', () => {
  it('finds twin primes up to 20', () => {
    const twins = findTwinPrimes(20);
    expect(twins).toEqual([
      [3, 5],
      [5, 7],
      [11, 13],
      [17, 19],
    ]);
  });

  it('returns empty for n < 3', () => {
    expect(findTwinPrimes(2)).toEqual([]);
  });
});

// ===========================================================================
// Prime Gaps
// ===========================================================================

describe('primeGap', () => {
  it('gap after 2 is 1', () => {
    expect(primeGap(2)).toBe(1);
  });

  it('gap after 7 is 4', () => {
    expect(primeGap(7)).toBe(4);
  });

  it('gap after 23 is 6', () => {
    expect(primeGap(23)).toBe(6);
  });

  it('throws on non-prime', () => {
    expect(() => primeGap(10)).toThrow();
  });
});

describe('maxPrimeGap', () => {
  it('max gap up to 30 is between 23 and 29 (gap = 6)', () => {
    const result = maxPrimeGap(30);
    expect(result.gap).toBe(6);
    expect(result.afterPrime).toBe(23);
  });
});

// ===========================================================================
// Goldbach Conjecture
// ===========================================================================

describe('goldbachPairs', () => {
  it('finds pairs for 10', () => {
    const pairs = goldbachPairs(10);
    // 10 = 3+7 = 5+5
    expect(pairs).toEqual([
      [3, 7],
      [5, 5],
    ]);
  });

  it('finds pairs for 4', () => {
    const pairs = goldbachPairs(4);
    expect(pairs).toEqual([[2, 2]]);
  });

  it('finds at least one pair for small even numbers', () => {
    for (const n of [4, 6, 8, 10, 20, 30, 50]) {
      const pairs = goldbachPairs(n);
      expect(pairs.length).toBeGreaterThan(0);
    }
  });

  it('throws on odd numbers', () => {
    expect(() => goldbachPairs(7)).toThrow();
  });

  it('throws on numbers <= 2', () => {
    expect(() => goldbachPairs(2)).toThrow();
  });
});

describe('satisfiesGoldbach', () => {
  it('returns true for even numbers > 2', () => {
    expect(satisfiesGoldbach(4)).toBe(true);
    expect(satisfiesGoldbach(20)).toBe(true);
  });

  it('returns false for odd numbers', () => {
    expect(satisfiesGoldbach(7)).toBe(false);
  });

  it('returns false for 2', () => {
    expect(satisfiesGoldbach(2)).toBe(false);
  });
});

// ===========================================================================
// Divisor Functions
// ===========================================================================

describe('sumOfDivisors', () => {
  it('sigma(1) = 1', () => {
    expect(sumOfDivisors(1)).toBe(1);
  });

  it('sigma(6) = 12 (1+2+3+6)', () => {
    expect(sumOfDivisors(6)).toBe(12);
  });

  it('sigma(12) = 28 (1+2+3+4+6+12)', () => {
    expect(sumOfDivisors(12)).toBe(28);
  });

  it('sigma(p) = p+1 for prime p', () => {
    expect(sumOfDivisors(7)).toBe(8);
    expect(sumOfDivisors(13)).toBe(14);
  });
});

describe('numberOfDivisors', () => {
  it('tau(1) = 1', () => {
    expect(numberOfDivisors(1)).toBe(1);
  });

  it('tau(12) = 6', () => {
    expect(numberOfDivisors(12)).toBe(6);
  });

  it('tau(p) = 2 for prime p', () => {
    expect(numberOfDivisors(7)).toBe(2);
    expect(numberOfDivisors(13)).toBe(2);
  });

  it('tau(p^k) = k+1', () => {
    expect(numberOfDivisors(8)).toBe(4); // 2^3: tau = 4
    expect(numberOfDivisors(16)).toBe(5); // 2^4: tau = 5
  });
});

describe('isPerfectNumber', () => {
  it('6 is perfect', () => {
    expect(isPerfectNumber(6)).toBe(true);
  });

  it('28 is perfect', () => {
    expect(isPerfectNumber(28)).toBe(true);
  });

  it('496 is perfect', () => {
    expect(isPerfectNumber(496)).toBe(true);
  });

  it('12 is not perfect', () => {
    expect(isPerfectNumber(12)).toBe(false);
  });

  it('10 is not perfect', () => {
    expect(isPerfectNumber(10)).toBe(false);
  });
});
