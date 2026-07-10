/**
 * Tests for the function-closure identity registry.
 * @module utils/fn-identity.test
 */

import { describe, expect, it } from 'vitest';
import { getFunctionId } from './fn-identity';

describe('getFunctionId', () => {
  it('returns the same id for the same function reference on repeated calls', () => {
    const fn = (x: number) => x + 1;
    const first = getFunctionId(fn);
    const second = getFunctionId(fn);
    expect(second).toBe(first);
  });

  it('returns different ids for different function references with identical source', () => {
    // Intentionally two separate closures sharing the same source body.
    const fnA = (x: number) => x * 2;
    const fnB = (x: number) => x * 2;

    expect(getFunctionId(fnA)).not.toBe(getFunctionId(fnB));
  });

  it('returns different ids for two closures capturing different free variables', () => {
    const makeAdder = (n: number) => (x: number) => x + n;
    const addOne = makeAdder(1);
    const addTwo = makeAdder(2);

    expect(getFunctionId(addOne)).not.toBe(getFunctionId(addTwo));
  });

  it('returns a positive integer id', () => {
    const id = getFunctionId(() => 0);
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
  });

  it('assigns monotonically distinct ids across many functions', () => {
    const ids = new Set<number>();
    for (let i = 0; i < 50; i++) {
      // A fresh closure every iteration.
      ids.add(getFunctionId((x: number) => x + i));
    }
    expect(ids.size).toBe(50);
  });
});
