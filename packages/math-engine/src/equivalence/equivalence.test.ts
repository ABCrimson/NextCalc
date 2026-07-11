/**
 * Equivalence module tests: symbolic hits, numeric-probing fallback,
 * negatives, parse errors, determinism, tolerance edges, and
 * graded-answer checking.
 */

import { describe, expect, it } from 'vitest';
import { checkEquivalence, checkGradedAnswer, normalizeAnswerExpression } from './equivalence';

describe('checkEquivalence — equivalent forms', () => {
  it.each([
    ['(x+1)^2', 'x^2 + 2*x + 1'],
    ['sin(x)^2 + cos(x)^2', '1'],
    ['2*x + 3 - x', 'x + 3'],
    ['(x - 2)*(x - 3)', 'x^2 - 5*x + 6'],
    ['2/4', '1/2'],
    ['x/2 + x/2', 'x'],
    ['exp(x) * exp(x)', 'exp(2*x)'],
  ])('%s ≡ %s', (student, canonical) => {
    const result = checkEquivalence(student, canonical);
    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('proves trivially-cancelling differences symbolically', () => {
    const result = checkEquivalence('x - x', '0');
    expect(result.equivalent).toBe(true);
    expect(result.method).toBe('symbolic');
    expect(result.reason).toBe('simplified-to-zero');
    expect(result.confidence).toBe(1);
  });

  it('falls back to numeric probing across a removable singularity', () => {
    // (x^2-1)/(x-1) ≡ x+1 everywhere except x = 1 — the singular probe
    // point is skipped, and ≥ 8 valid samples must remain.
    const result = checkEquivalence('(x^2 - 1)/(x - 1)', 'x + 1');
    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('handles sqrt/log domain restrictions via positive-domain samples', () => {
    const result = checkEquivalence('sqrt(x)*sqrt(x)', 'x');
    expect(result.equivalent).toBe(true);
  });
});

describe('checkEquivalence — non-equivalent and edge cases', () => {
  it.each([
    ['x^2', 'x^3'],
    ['x + 1', 'x - 1'],
    ['2*x', 'x^2'],
    ['(x+1)^2', 'x^2 + 1'],
    ['3/4', '2/3'],
  ])('%s ≢ %s', (student, canonical) => {
    const result = checkEquivalence(student, canonical);
    expect(result.equivalent).toBe(false);
    expect(result.reason).toBe('counterexample');
  });

  it('reports parse errors without guessing', () => {
    const result = checkEquivalence('(x + ', 'x');
    expect(result.equivalent).toBe(false);
    expect(result.method).toBe('symbolic');
    expect(result.reason).toBe('parse-error');
    expect(result.confidence).toBe(1);
  });

  it('never claims equivalence with too few valid samples (inconclusive)', () => {
    // Both sides are undefined for every real probe point, so no sample
    // is valid — the checker must refuse rather than claim equivalence.
    const result = checkEquivalence('sqrt(-25 - x^2) + 1', 'sqrt(-25 - x^2) + 2');
    expect(result.equivalent).toBe(false);
    expect(result.reason).toBe('inconclusive');
  });

  it('is deterministic: identical calls produce identical result objects', () => {
    const a = checkEquivalence('(x^2 - 1)/(x - 1)', 'x + 1');
    const b = checkEquivalence('(x^2 - 1)/(x - 1)', 'x + 1');
    expect(b).toEqual(a);

    const negA = checkEquivalence('sin(x)', 'cos(x)');
    const negB = checkEquivalence('sin(x)', 'cos(x)');
    expect(negB).toEqual(negA);
  });

  it('respects the seed option deterministically', () => {
    const a = checkEquivalence('x^2 + x', 'x*(x + 1)', { seed: 'probe-seed' });
    const b = checkEquivalence('x^2 + x', 'x*(x + 1)', { seed: 'probe-seed' });
    expect(b).toEqual(a);
    expect(a.equivalent).toBe(true);
  });

  it('tolerance edges: rejects offsets above tolerance, absorbs float dust', () => {
    // 1e-6 offset is far above the default 1e-9 mixed tolerance
    expect(checkEquivalence('x + 0.000001', 'x').equivalent).toBe(false);
    // 1e-15 is float dust — within mixed tolerance by design
    expect(checkEquivalence('x + 1e-15', 'x').equivalent).toBe(true);
    // Custom tolerance widens acceptance explicitly
    expect(checkEquivalence('x + 0.000001', 'x', { tolerance: 1e-4 }).equivalent).toBe(true);
  });

  it('compares constant expressions with a single evaluation', () => {
    const result = checkEquivalence('2 + 3', '5');
    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBe(1);

    expect(checkEquivalence('2 + 3', '6').equivalent).toBe(false);
  });

  it('never claims numeric agreement when floor/ceil/round is involved, even if every probe point matches', () => {
    // floor(abs(x)/6) is 0 across the entire [-5, 5] probe window, so the
    // two expressions agree everywhere sampled — but diverge for |x| >= 6.
    // Agreement on a finite sample of a step function proves nothing.
    const result = checkEquivalence('x', 'x + floor(abs(x)/6)*100');
    expect(result.equivalent).toBe(false);
    expect(result.reason).toBe('inconclusive');
  });
});

describe('checkGradedAnswer — solutions kind', () => {
  const graded = {
    kind: 'solutions',
    equation: 'x^2 - 5*x + 6 = 0',
    variable: 'x',
    values: [2, 3],
  } as const;

  it.each([
    ['x = 3 or x = 2'],
    ['x = 2 or x = 3'],
    ['x=2, x=-3'.replace('-3', '3')],
    ['2, 3'],
    ['3; 2'],
    ['2 and 3'],
    ['x = 6/3, x = 3'],
  ])('accepts "%s"', (answer) => {
    expect(checkGradedAnswer(answer, graded).correct).toBe(true);
  });

  it.each([['2'], ['x = 2'], ['2, 4'], ['2, 3, 4'], ['banana'], ['']])('rejects "%s"', (answer) => {
    expect(checkGradedAnswer(answer, graded).correct).toBe(false);
  });

  it('treats a double root written once or twice as correct', () => {
    const doubleRoot = {
      kind: 'solutions',
      equation: 'x^2 - 6*x + 9 = 0',
      variable: 'x',
      values: [3],
    } as const;
    expect(checkGradedAnswer('x = 3', doubleRoot).correct).toBe(true);
    expect(checkGradedAnswer('3, 3', doubleRoot).correct).toBe(true);
    expect(checkGradedAnswer('3, 4', doubleRoot).correct).toBe(false);
  });

  it('rejects a duplicate-padded distinct root as a stand-in for a real extra answer', () => {
    // 2x^2 + 3x + 1 = 0 has two DISTINCT roots (-1, -0.5) — repeating one
    // of them should not let a 3-answer submission pass a 2-root problem.
    const distinctRoots = {
      kind: 'solutions',
      equation: '2*x^2 + 3*x + 1 = 0',
      variable: 'x',
      values: [-1, -0.5],
    } as const;
    expect(checkGradedAnswer('-1, -1, -0.5', distinctRoots).correct).toBe(false);
    expect(checkGradedAnswer('-1, -1, 5', distinctRoots).correct).toBe(false);
    expect(checkGradedAnswer('-1, -0.5', distinctRoots).correct).toBe(true);
  });
});

describe('checkGradedAnswer — number kind', () => {
  it('accepts equivalent numeric expressions', () => {
    const graded = { kind: 'number', value: 0.5 } as const;
    expect(checkGradedAnswer('1/2', graded).correct).toBe(true);
    expect(checkGradedAnswer('0.5', graded).correct).toBe(true);
    expect(checkGradedAnswer('x = 0.5', graded).correct).toBe(true);
    expect(checkGradedAnswer('0.51', graded).correct).toBe(false);
    expect(checkGradedAnswer('not-a-number', graded).correct).toBe(false);
  });

  it('applies the per-answer tolerance for π-style values', () => {
    const graded = { kind: 'number', value: Math.PI * 16, tolerance: 1e-3 } as const;
    expect(checkGradedAnswer('16*pi', graded).correct).toBe(true);
    expect(checkGradedAnswer('50.27', graded).correct).toBe(true); // 2-dp rounding
    expect(checkGradedAnswer('50.9', graded).correct).toBe(false);
  });
});

describe('checkGradedAnswer — assignments kind', () => {
  const graded = {
    kind: 'assignments',
    variables: ['x', 'y'],
    values: [2, 3],
  } as const;

  it('accepts labeled assignments in any order', () => {
    expect(checkGradedAnswer('x = 2, y = 3', graded).correct).toBe(true);
    expect(checkGradedAnswer('y = 3, x = 2', graded).correct).toBe(true);
    expect(checkGradedAnswer('x=2; y=3', graded).correct).toBe(true);
  });

  it('rejects swapped labeled values (never grades by luck)', () => {
    expect(checkGradedAnswer('x = 3, y = 2', graded).correct).toBe(false);
  });

  it('interprets unlabeled input in declared variable order', () => {
    expect(checkGradedAnswer('2, 3', graded).correct).toBe(true);
    expect(checkGradedAnswer('3, 2', graded).correct).toBe(false);
  });

  it('rejects wrong arity', () => {
    expect(checkGradedAnswer('2', graded).correct).toBe(false);
    expect(checkGradedAnswer('2, 3, 4', graded).correct).toBe(false);
  });
});

describe('checkGradedAnswer — expression kind', () => {
  const graded = { kind: 'expression', expression: '(3/4)*x^4', variable: 'x' } as const;

  it('accepts equivalent forms and strips a trailing + C', () => {
    expect(checkGradedAnswer('3*x^4/4 + C', graded).correct).toBe(true);
    expect(checkGradedAnswer('0.75*x^4', graded).correct).toBe(true);
    expect(checkGradedAnswer('F(x) = 3*x^4/4 + C', graded).correct).toBe(true);
  });

  it('rejects non-equivalent expressions', () => {
    expect(checkGradedAnswer('3*x^3/4', graded).correct).toBe(false);
    expect(checkGradedAnswer('x^4', graded).correct).toBe(false);
    expect(checkGradedAnswer('', graded).correct).toBe(false);
  });

  it('accepts factored vs expanded polynomial forms', () => {
    const poly = { kind: 'expression', expression: 'x^2 + 5*x + 6', variable: 'x' } as const;
    expect(checkGradedAnswer('(x + 2)*(x + 3)', poly).correct).toBe(true);
    expect(checkGradedAnswer('(x + 1)*(x + 6)', poly).correct).toBe(false);
  });
});

describe('normalizeAnswerExpression', () => {
  it('strips assignment prefixes but leaves a trailing "+ C" alone by default', () => {
    // The + C strip is only valid for indefinite-integral problems; by
    // default (no opt-in) it must not run, or a legitimate trailing "+ c"
    // term (e.g. a perimeter formula) or a student's spurious "+ C" on a
    // non-integral answer would be silently altered.
    expect(normalizeAnswerExpression("f'(x) = 6*x + C")).toBe('6*x + C');
    expect(normalizeAnswerExpression('y = x^2')).toBe('x^2');
    expect(normalizeAnswerExpression('  x + 1  ')).toBe('x + 1');
    expect(normalizeAnswerExpression('a + b + c')).toBe('a + b + c');
  });

  it('strips a trailing "+ C" only when explicitly allowed', () => {
    expect(normalizeAnswerExpression("f'(x) = 6*x + C", true)).toBe('6*x');
    expect(normalizeAnswerExpression('6*x + c', true)).toBe('6*x');
    // Once opted in the strip is still a blind pattern match — callers
    // must only pass `true` for genuine indefinite-integral problems.
    expect(normalizeAnswerExpression('a + b + c', true)).toBe('a + b');
  });
});
