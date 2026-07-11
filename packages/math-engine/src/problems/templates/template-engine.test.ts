/**
 * Template engine tests: seeded determinism, constraint satisfaction,
 * and solver-exactness of CAS-computed graded answers.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { evaluate } from '../../parser';
import { allTemplates, registerAllTemplates } from './index';
import { createSeededRandom, randomSeedString } from './seeded-rng';
import { narrow, templateEngine } from './template-engine';

beforeAll(() => {
  registerAllTemplates();
});

const templateIds = allTemplates.map((t) => t.id);
const SWEEP_SEEDS = Array.from({ length: 100 }, (_, i) => `sweep-${i}`);

describe('seeded-rng', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createSeededRandom('seed-1');
    const b = createSeededRandom('seed-1');
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, createSeededRandom('a'));
    const b = Array.from({ length: 10 }, createSeededRandom('b'));
    expect(a).not.toEqual(b);
  });

  it('yields values in [0, 1)', () => {
    const rng = createSeededRandom('range-check');
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('mints seed strings from the CSPRNG with the expected shape', () => {
    const seed = randomSeedString();
    expect(seed).toMatch(/^[a-z2-9]{8}$/);
    expect(randomSeedString(16)).toHaveLength(16);
    // Two mints are (overwhelmingly) distinct
    expect(randomSeedString()).not.toBe(randomSeedString());
  });
});

describe('deterministic generation', () => {
  it.each(templateIds)('%s: same seed → identical instance', (id) => {
    const first = templateEngine.generate(id, 'seed-1');
    const second = templateEngine.generate(id, 'seed-1');
    expect(second.statement).toEqual(first.statement);
    expect(second.parameters).toEqual(first.parameters);
    expect(second.hints).toEqual(first.hints);
    expect(second.solution).toEqual(first.solution);
    expect(second.graded).toEqual(first.graded);
    expect(second.seed).toBe('seed-1');
  });

  it.each(templateIds)('%s: different seeds vary the parameters', (id) => {
    const base = templateEngine.generate(id, 'vary-0');
    const anyDiffers = ['vary-1', 'vary-2', 'vary-3', 'vary-4', 'vary-5'].some(
      (seed) =>
        JSON.stringify(templateEngine.generate(id, seed).parameters) !==
        JSON.stringify(base.parameters),
    );
    expect(anyDiffers).toBe(true);
  });

  it('round-trips the seed stored on the instance', () => {
    const instance = templateEngine.generate('quadratic-equation-basic', 'url-seed');
    const reproduced = templateEngine.generate('quadratic-equation-basic', instance.seed);
    expect(reproduced.statement).toBe(instance.statement);
    expect(reproduced.parameters).toEqual(instance.parameters);
  });

  it('accepts numeric seeds by stringifying them', () => {
    const a = templateEngine.generate('linear-equation-basic', 42);
    const b = templateEngine.generate('linear-equation-basic', '42');
    expect(a.parameters).toEqual(b.parameters);
    expect(a.seed).toBe('42');
  });

  it('generateBatch derives reproducible per-item seeds', () => {
    const batchA = templateEngine.generateBatch('linear-equation-basic', 5, 'batch');
    const batchB = templateEngine.generateBatch('linear-equation-basic', 5, 'batch');
    expect(batchA.map((p) => p.parameters)).toEqual(batchB.map((p) => p.parameters));
    expect(batchA[0]!.seed).toBe('batch:0');

    // Default baseSeed is the template id
    const defaulted = templateEngine.generateBatch('linear-equation-basic', 2);
    expect(defaulted[1]!.seed).toBe('linear-equation-basic:1');
  });
});

describe('constraint satisfaction (100-seed sweep)', () => {
  it.each(SWEEP_SEEDS)('quadratic discriminant ≥ 0 (%s)', (seed) => {
    const { parameters } = templateEngine.generate('quadratic-equation-basic', seed);
    const { a, b, c } = narrow<{ a: number; b: number; c: number }>(parameters);
    expect(b * b - 4 * a * c).toBeGreaterThanOrEqual(0);
  });

  it.each(SWEEP_SEEDS)('2x2 system determinant ≠ 0 (%s)', (seed) => {
    const { parameters } = templateEngine.generate('system-linear-2x2', seed);
    const { a1, b1, a2, b2 } = narrow<{ a1: number; b1: number; a2: number; b2: number }>(
      parameters,
    );
    expect(a1 * b2 - a2 * b1).not.toBe(0);
  });

  it.each(SWEEP_SEEDS)('factorization has an integer factor pair (%s)', (seed) => {
    const { parameters } = templateEngine.generate('polynomial-factorization', seed);
    const { b, c } = narrow<{ b: number; c: number }>(parameters);
    let found = false;
    for (let i = -20; i <= 20 && !found; i++) {
      if (i !== 0 && c % i === 0 && i + c / i === b) found = true;
    }
    expect(found).toBe(true);
  });

  it.each(SWEEP_SEEDS)('combinations/permutations keep r ≤ n (%s)', (seed) => {
    for (const id of ['combinations-basic', 'permutations-basic']) {
      const { parameters } = templateEngine.generate(id, seed);
      const { n, r } = narrow<{ n: number; r: number }>(parameters);
      expect(r).toBeLessThanOrEqual(n);
    }
  });

  const statementSeeds = SWEEP_SEEDS.slice(0, 10);
  it.each(templateIds)('%s: no unsubstituted placeholders remain', (id) => {
    for (const seed of statementSeeds) {
      const { statement } = templateEngine.generate(id, seed);
      expect(statement).not.toContain('{{');
    }
  });
});

describe('graded answers stay exact (solver back-substitution)', () => {
  /** Original-equation builders: LHS/RHS as parseable strings per template. */
  const originalEquations: Record<
    string,
    (params: Record<string, number>) => { lhs: string; rhs: string }
  > = {
    'linear-equation-basic': ({ a, b, c }) => ({ lhs: `${a}*x + ${b}`, rhs: `${c}` }),
    'quadratic-equation-basic': ({ a, b, c }) => ({
      lhs: `${a}*x^2 + ${b}*x + ${c}`,
      rhs: '0',
    }),
    'absolute-value-equation': ({ a, b }) => ({ lhs: `abs(x + ${a})`, rhs: `${b}` }),
    'radical-equation-square': ({ a, b }) => ({ lhs: `sqrt(x + ${a})`, rhs: `${b}` }),
  };

  const solutionTemplateIds = Object.keys(originalEquations);
  const exactnessSeeds = SWEEP_SEEDS.slice(0, 25);

  it.each(solutionTemplateIds)('%s: every graded root satisfies the ORIGINAL equation', (id) => {
    for (const seed of exactnessSeeds) {
      const instance = templateEngine.generate(id, seed);
      expect(instance.graded, `graded missing for ${id} @ ${seed}`).toBeDefined();
      const graded = instance.graded!;
      expect(graded.kind).toBe('solutions');
      if (graded.kind !== 'solutions') continue;
      expect(graded.values.length).toBeGreaterThan(0);

      const numericParams: Record<string, number> = {};
      for (const [k, v] of Object.entries(instance.parameters)) {
        if (typeof v === 'number') numericParams[k] = v;
      }
      const { lhs, rhs } = originalEquations[id]!(numericParams);

      for (const value of graded.values) {
        const left = evaluate(lhs, { variables: { x: value }, mode: 'approximate' });
        const right = evaluate(rhs, { variables: { x: value }, mode: 'approximate' });
        expect(left.success && right.success).toBe(true);
        if (left.success && right.success) {
          expect(Math.abs(Number(left.value) - Number(right.value))).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('system-linear-2x2: graded assignments satisfy both equations', () => {
    for (const seed of exactnessSeeds) {
      const instance = templateEngine.generate('system-linear-2x2', seed);
      const graded = instance.graded;
      expect(graded?.kind).toBe('assignments');
      if (graded?.kind !== 'assignments') continue;
      const { a1, b1, c1, a2, b2, c2 } = narrow<{
        a1: number;
        b1: number;
        c1: number;
        a2: number;
        b2: number;
        c2: number;
      }>(instance.parameters);
      const [x, y] = graded.values;
      expect(graded.variables).toEqual(['x', 'y']);
      expect(Math.abs(a1 * x! + b1 * y! - c1)).toBeLessThan(1e-9);
      expect(Math.abs(a2 * x! + b2 * y! - c2)).toBeLessThan(1e-9);
    }
  });

  it('number-kind graded values match the template arithmetic', () => {
    for (const seed of exactnessSeeds) {
      const limit = templateEngine.generate('limit-basic', seed);
      const lp = narrow<{ a: number; b: number; c: number }>(limit.parameters);
      expect(limit.graded).toEqual({ kind: 'number', value: lp.b * lp.a + lp.c });

      const probability = templateEngine.generate('probability-basic', seed);
      const pp = narrow<{ red: number; blue: number }>(probability.parameters);
      expect(probability.graded).toEqual({
        kind: 'number',
        value: pp.red / (pp.red + pp.blue),
      });

      const modular = templateEngine.generate('modular-arithmetic-basic', seed);
      const mp = narrow<{ a: number; m: number }>(modular.parameters);
      expect(modular.graded).toEqual({ kind: 'number', value: mp.a % mp.m });
    }
  });

  it('expression-kind canonical strings are parseable', () => {
    const expressionTemplates = allTemplates.filter((t) => t.canonical);
    for (const template of expressionTemplates) {
      for (const seed of exactnessSeeds.slice(0, 5)) {
        const instance = templateEngine.generate(template.id, seed);
        if (instance.graded?.kind !== 'expression') continue;
        const result = evaluate(instance.graded.expression, {
          variables: { x: 1.2345 },
          mode: 'approximate',
        });
        expect(result.success, `${template.id} canonical failed to evaluate`).toBe(true);
      }
    }
  });

  it('templates without machine-gradable answers omit graded (never guess)', () => {
    for (const id of ['prime-factorization', 'linear-inequality']) {
      const instance = templateEngine.generate(id, 'no-graded');
      expect(instance.graded).toBeUndefined();
    }
  });
});
