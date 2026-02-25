/**
 * Property-based tests for evaluator using fast-check
 * Tests algebraic properties to ensure correctness
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parse } from './parser';
import { evaluate } from './evaluator';

describe('Evaluator - Property-Based Tests', () => {
  describe('Commutativity', () => {
    it('addition is commutative: a + b = b + a', () => {
      fc.assert(
        fc.property(fc.float(), fc.float(), (a, b) => {
          if (!Number.isFinite(a) || !Number.isFinite(b)) return;

          const result1 = evaluate(`${a} + ${b}`);
          const result2 = evaluate(`${b} + ${a}`);

          if (result1.success && result2.success) {
            expect(result1.value).toBeCloseTo(result2.value as number, 10);
          }
        })
      );
    });

    it('multiplication is commutative: a * b = b * a', () => {
      fc.assert(
        fc.property(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 }), (a, b) => {
          if (!Number.isFinite(a) || !Number.isFinite(b)) return;

          const result1 = evaluate(`${a} * ${b}`);
          const result2 = evaluate(`${b} * ${a}`);

          if (result1.success && result2.success) {
            expect(result1.value).toBeCloseTo(result2.value as number, 8);
          }
        })
      );
    });
  });

  describe('Associativity', () => {
    it('addition is associative: (a + b) + c = a + (b + c)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 100 }),
          fc.float({ min: -100, max: 100 }),
          fc.float({ min: -100, max: 100 }),
          (a, b, c) => {
            if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return;

            const result1 = evaluate(`(${a} + ${b}) + ${c}`);
            const result2 = evaluate(`${a} + (${b} + ${c})`);

            if (result1.success && result2.success) {
              expect(result1.value).toBeCloseTo(result2.value as number, 8);
            }
          }
        )
      );
    });

    it('multiplication is associative: (a * b) * c = a * (b * c)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -10, max: 10 }),
          fc.float({ min: -10, max: 10 }),
          fc.float({ min: -10, max: 10 }),
          (a, b, c) => {
            if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return;

            const result1 = evaluate(`(${a} * ${b}) * ${c}`);
            const result2 = evaluate(`${a} * (${b} * ${c})`);

            if (result1.success && result2.success) {
              expect(result1.value).toBeCloseTo(result2.value as number, 6);
            }
          }
        )
      );
    });
  });

  describe('Identity', () => {
    it('additive identity: a + 0 = a', () => {
      fc.assert(
        fc.property(fc.float(), (a) => {
          if (!Number.isFinite(a)) return;

          const result = evaluate(`${a} + 0`);

          if (result.success) {
            expect(result.value).toBeCloseTo(a, 10);
          }
        })
      );
    });

    it('multiplicative identity: a * 1 = a', () => {
      fc.assert(
        fc.property(fc.float(), (a) => {
          if (!Number.isFinite(a)) return;

          const result = evaluate(`${a} * 1`);

          if (result.success) {
            expect(result.value).toBeCloseTo(a, 10);
          }
        })
      );
    });
  });

  describe('Distributivity', () => {
    it('multiplication distributes over addition: a * (b + c) = (a * b) + (a * c)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -10, max: 10 }),
          fc.float({ min: -10, max: 10 }),
          fc.float({ min: -10, max: 10 }),
          (a, b, c) => {
            if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return;

            const result1 = evaluate(`${a} * (${b} + ${c})`);
            const result2 = evaluate(`(${a} * ${b}) + (${a} * ${c})`);

            if (result1.success && result2.success) {
              expect(result1.value).toBeCloseTo(result2.value as number, 6);
            }
          }
        )
      );
    });
  });

  describe('Inverse', () => {
    it('additive inverse: a + (-a) = 0', () => {
      fc.assert(
        fc.property(fc.float({ min: -100, max: 100 }), (a) => {
          if (!Number.isFinite(a)) return;

          const result = evaluate(`${a} + (${-a})`);

          if (result.success) {
            expect(result.value).toBeCloseTo(0, 8);
          }
        })
      );
    });

    it('multiplicative inverse: a * (1/a) = 1 for a ≠ 0', () => {
      fc.assert(
        fc.property(fc.float({ min: -100, max: 100 }).filter(a => Math.abs(a) > 0.01), (a) => {
          if (!Number.isFinite(a)) return;

          const result = evaluate(`${a} * (1/${a})`);

          if (result.success) {
            expect(result.value).toBeCloseTo(1, 6);
          }
        })
      );
    });
  });

  describe('Trigonometric Identities', () => {
    it('Pythagorean identity: sin²(x) + cos²(x) = 1', () => {
      fc.assert(
        fc.property(fc.float({ min: -10, max: 10 }), (x) => {
          if (!Number.isFinite(x)) return;

          const result = evaluate(`sin(${x})^2 + cos(${x})^2`);

          if (result.success) {
            expect(result.value).toBeCloseTo(1, 10);
          }
        })
      );
    });
  });
});
