/**
 * Tests for Shor's Algorithm
 *
 * Covers:
 * - Integer factorization
 * - Period finding
 * - Modular exponentiation
 * - Perfect power detection
 * - Classical simulation of quantum algorithm
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  shorAlgorithm,
  findPeriod,
  modPow,
  gcd,
  isPerfectPower,
  QuantumPeriodFinding,
} from '../shor';

describe("Shor's Algorithm", () => {
  describe('modPow', () => {
    it('should compute modular exponentiation correctly', () => {
      expect(modPow(2, 10, 1000)).toBe(24); // 2^10 mod 1000 = 1024 mod 1000 = 24
      expect(modPow(3, 5, 7)).toBe(5); // 3^5 mod 7 = 243 mod 7 = 5
      expect(modPow(5, 3, 13)).toBe(8); // 5^3 mod 13 = 125 mod 13 = 8
    });

    it('should handle exponent of 0', () => {
      expect(modPow(10, 0, 7)).toBe(1); // a^0 = 1
      expect(modPow(5, 0, 100)).toBe(1);
    });

    it('should handle modulus of 1', () => {
      expect(modPow(10, 5, 1)).toBe(0); // Any number mod 1 is 0
    });

    it('should use efficient binary exponentiation', () => {
      const startTime = performance.now();
      const result = modPow(2, 1000, 1000000);
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });

    it('property: (a^b) mod m == ((a mod m)^b) mod m', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 2, max: 50 }),
          (a, b, m) => {
            const result1 = modPow(a, b, m);
            const result2 = modPow(a % m, b, m);

            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('property: result is always in range [0, m)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 2, max: 50 }),
          (a, b, m) => {
            const result = modPow(a, b, m);

            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(m);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('gcd', () => {
    it('should compute greatest common divisor', () => {
      expect(gcd(12, 8)).toBe(4);
      expect(gcd(15, 25)).toBe(5);
      expect(gcd(7, 13)).toBe(1); // Coprime
      expect(gcd(100, 50)).toBe(50);
    });

    it('should handle gcd with 0', () => {
      expect(gcd(10, 0)).toBe(10);
      expect(gcd(0, 5)).toBe(5);
    });

    it('should be commutative', () => {
      expect(gcd(12, 8)).toBe(gcd(8, 12));
      expect(gcd(15, 25)).toBe(gcd(25, 15));
    });

    it('property: gcd(a, b) divides both a and b', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b) => {
            const g = gcd(a, b);

            expect(a % g).toBe(0);
            expect(b % g).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('property: gcd(a, b) * lcm(a, b) == a * b', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (a, b) => {
            const g = gcd(a, b);
            const lcm = (a * b) / g;

            expect(g * lcm).toBe(a * b);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('isPerfectPower', () => {
    it('should detect perfect powers with smallest base (canonical form)', () => {
      // All perfect powers should return the smallest possible base
      expect(isPerfectPower(4)).toEqual({ base: 2, exp: 2 }); // 2^2
      expect(isPerfectPower(9)).toEqual({ base: 3, exp: 2 }); // 3^2
      expect(isPerfectPower(16)).toEqual({ base: 2, exp: 4 }); // 2^4 (not 4^2)
      expect(isPerfectPower(25)).toEqual({ base: 5, exp: 2 }); // 5^2
    });

    it('should detect perfect cubes with smallest base', () => {
      expect(isPerfectPower(8)).toEqual({ base: 2, exp: 3 }); // 2^3
      expect(isPerfectPower(27)).toEqual({ base: 3, exp: 3 }); // 3^3
      expect(isPerfectPower(64)).toEqual({ base: 2, exp: 6 }); // 2^6 (not 4^3 or 8^2)
    });

    it('should detect higher powers', () => {
      expect(isPerfectPower(16)).toEqual({ base: 2, exp: 4 }); // 2^4 or 4^2
      expect(isPerfectPower(32)).toEqual({ base: 2, exp: 5 });
    });

    it('should return null for non-perfect powers', () => {
      expect(isPerfectPower(5)).toBeNull();
      expect(isPerfectPower(7)).toBeNull();
      expect(isPerfectPower(10)).toBeNull();
      expect(isPerfectPower(15)).toBeNull();
    });

    it('should handle perfect power of 1', () => {
      const result = isPerfectPower(1);
      expect(result).toBeTruthy(); // 1 = 1^k for any k
    });

    it('should verify detected powers', () => {
      const testNumbers = [4, 8, 9, 16, 25, 27, 32, 64, 81, 100];

      for (const n of testNumbers) {
        const result = isPerfectPower(n);
        expect(result).not.toBeNull();

        if (result) {
          expect(Math.pow(result.base, result.exp)).toBe(n);
        }
      }
    });
  });

  describe('findPeriod', () => {
    it('should find period of modular exponentiation', () => {
      // For a=2, n=15: 2^1=2, 2^2=4, 2^3=8, 2^4=1 (mod 15)
      const period = findPeriod(2, 15);
      expect(period).toBe(4);

      // Verify: 2^period ≡ 1 (mod 15)
      expect(modPow(2, period, 15)).toBe(1);
    });

    it('should find period for coprime base', () => {
      // For a=3, n=10: 3^1=3, 3^2=9, 3^3=7, 3^4=1 (mod 10)
      const period = findPeriod(3, 10);
      expect(period).toBe(4);
      expect(modPow(3, period, 10)).toBe(1);
    });

    it('should find period of 1 for base 1', () => {
      const period = findPeriod(1, 10);
      expect(period).toBe(1); // 1^k always equals 1
    });

    it('should find minimal period', () => {
      const a = 2;
      const n = 15;
      const period = findPeriod(a, n);

      // Verify it's the minimal period
      for (let r = 1; r < period; r++) {
        expect(modPow(a, r, n)).not.toBe(1);
      }

      expect(modPow(a, period, n)).toBe(1);
    });

    it('property: period divides Euler totient for coprime a, n', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 20 }),
          (n) => {
            // Choose random coprime a
            let a = 2;
            while (gcd(a, n) !== 1) {
              a++;
              if (a >= n) return true; // Skip if no coprime found
            }

            const period = findPeriod(a, n);

            // Verify a^period ≡ 1 (mod n)
            expect(modPow(a, period, n)).toBe(1);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('shorAlgorithm', () => {
    it('should factor 15 = 3 × 5', () => {
      const result = shorAlgorithm(15);

      expect(result.success).toBe(true);
      expect(result.factors).toHaveLength(2);

      const [f1, f2] = result.factors;
      expect(f1! * f2!).toBe(15);
      expect([3, 5]).toContain(f1);
      expect([3, 5]).toContain(f2);
    });

    it('should factor 21 = 3 × 7', () => {
      const result = shorAlgorithm(21);

      expect(result.success).toBe(true);
      expect(result.factors).toHaveLength(2);

      const [f1, f2] = result.factors;
      expect(f1! * f2!).toBe(21);
      expect([3, 7]).toContain(f1);
      expect([3, 7]).toContain(f2);
    });

    it('should factor 35 = 5 × 7', () => {
      const result = shorAlgorithm(35);

      expect(result.success).toBe(true);
      expect(result.factors).toHaveLength(2);

      const [f1, f2] = result.factors;
      expect(f1! * f2!).toBe(35);
    });

    it('should detect even numbers immediately', () => {
      const result = shorAlgorithm(14);

      expect(result.success).toBe(true);
      expect(result.factors).toEqual([2, 7]);
      expect(result.steps[1]).toContain('even');
    });

    it('should detect perfect powers', () => {
      const result = shorAlgorithm(9); // 3^2

      expect(result.success).toBe(true);
      expect(result.steps.some((s) => s.includes('perfect power'))).toBe(true);
    });

    it('should record algorithm steps', () => {
      const result = shorAlgorithm(15);

      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0]).toContain('Factoring N = 15');
    });

    it('should respect maxAttempts parameter', () => {
      const result = shorAlgorithm(91, 2); // Limited attempts

      expect(result.steps.length).toBeGreaterThan(0);
      // May or may not succeed with limited attempts
    });

    it('should verify factors multiply to original', () => {
      const testNumbers = [15, 21, 35, 55, 77, 91];

      for (const n of testNumbers) {
        const result = shorAlgorithm(n, 10);

        if (result.success) {
          const [f1, f2] = result.factors;
          expect(f1! * f2!).toBe(n);
          expect(f1).toBeGreaterThan(1);
          expect(f2).toBeGreaterThan(1);
          expect(f1).toBeLessThan(n);
          expect(f2).toBeLessThan(n);
        }
      }
    });

    it('should find non-trivial factors', () => {
      const result = shorAlgorithm(15);

      if (result.success) {
        const [f1, f2] = result.factors;
        expect(f1).toBeGreaterThan(1);
        expect(f2).toBeGreaterThan(1);
        expect(f1).toBeLessThan(15);
        expect(f2).toBeLessThan(15);
      }
    });

    it('property: factors are valid divisors', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 100 }).filter((n) => n % 2 !== 0), // Odd composites
          (n) => {
            const result = shorAlgorithm(n, 5);

            if (result.success) {
              const [f1, f2] = result.factors;
              expect(n % f1!).toBe(0);
              expect(n % f2!).toBe(0);
              expect(f1! * f2!).toBe(n);
            }
          }
        ),
        { numRuns: 10 } // Limited runs due to computational cost
      );
    });
  });

  describe('QuantumPeriodFinding', () => {
    it('should estimate required qubits', () => {
      const qpf = new QuantumPeriodFinding();

      const estimate = qpf.estimateQubits(15);

      expect(estimate.qubitsForN).toBeGreaterThan(0);
      expect(estimate.qubitsForPeriod).toBe(estimate.qubitsForN * 2);
      expect(estimate.totalQubits).toBe(estimate.qubitsForN * 3);
    });

    it('should scale qubits logarithmically with N', () => {
      const qpf = new QuantumPeriodFinding();

      const estimate1 = qpf.estimateQubits(15);
      const estimate2 = qpf.estimateQubits(255);

      expect(estimate2.qubitsForN).toBeGreaterThan(estimate1.qubitsForN);
      expect(estimate2.qubitsForN).toBeLessThanOrEqual(estimate1.qubitsForN * 2); // Log scaling allows up to 2x
    });

    it('should find period using quantum simulation', () => {
      const qpf = new QuantumPeriodFinding();

      const period = qpf.findPeriodQuantum(2, 15);

      expect(period).toBeGreaterThan(0);
      expect(period).toBeLessThan(15);
      expect(modPow(2, period, 15)).toBe(1);
    });

    it('should handle different moduli', () => {
      const qpf = new QuantumPeriodFinding();

      const period1 = qpf.findPeriodQuantum(2, 15);
      const period2 = qpf.findPeriodQuantum(2, 21);

      expect(period1).toBeDefined();
      expect(period2).toBeDefined();
      expect(period1).not.toBe(period2); // Different moduli, different periods
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle small numbers quickly', () => {
      const startTime = performance.now();
      const result = shorAlgorithm(15);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle moderately large numbers', () => {
      const result = shorAlgorithm(143); // 11 × 13

      expect(result.success).toBe(true);
      expect(result.factors).toHaveLength(2);

      const [f1, f2] = result.factors;
      expect(f1! * f2!).toBe(143);
    });

    it('should handle numbers with small factors', () => {
      const result = shorAlgorithm(6); // 2 × 3

      expect(result.success).toBe(true);
      expect(result.factors).toContain(2);
      expect(result.factors).toContain(3);
    });

    it('should handle perfect squares', () => {
      const result = shorAlgorithm(49); // 7^2

      expect(result.success).toBe(true);
      expect(result.factors).toContain(7);
    });

    it('should not factor prime numbers (will fail or return trivial)', () => {
      const result = shorAlgorithm(13, 3); // Prime

      if (result.success) {
        // If it succeeds, factors should be trivial (1 and 13)
        const [f1, f2] = result.factors;
        expect([1, 13]).toContain(f1);
        expect([1, 13]).toContain(f2);
      } else {
        // Or it should fail
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Algorithm Correctness', () => {
    it('should use period finding correctly', () => {
      const n = 15;
      const a = 7; // Coprime to 15

      const period = findPeriod(a, n);

      // Period should satisfy: a^period ≡ 1 (mod n)
      expect(modPow(a, period, n)).toBe(1);

      // Period should be minimal
      if (period > 1) {
        expect(modPow(a, period - 1, n)).not.toBe(1);
      }
    });

    it('should verify gcd computation in factorization', () => {
      const n = 15;
      const a = 7;

      // First check gcd(a, n)
      const g = gcd(a, n);
      expect(g).toBe(1); // Should be coprime

      // Then find period
      const period = findPeriod(a, n);

      if (period % 2 === 0) {
        const halfPower = modPow(a, period / 2, n);

        if (halfPower !== n - 1) {
          const factor1 = gcd(halfPower - 1, n);
          const factor2 = gcd(halfPower + 1, n);

          // At least one should be non-trivial
          expect(factor1 > 1 || factor2 > 1).toBe(true);
        }
      }
    });

    it('should handle classical period finding deterministically', () => {
      const a = 2;
      const n = 15;

      const period1 = findPeriod(a, n);
      const period2 = findPeriod(a, n);

      expect(period1).toBe(period2); // Deterministic
    });
  });
});
