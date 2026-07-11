/**
 * Tests for the step-by-step solver: ruleId tagging (i18n addressability),
 * the rational-equation path, and limitWithSteps.
 */

import { describe, expect, it } from 'vitest';
import { Complex, type Solution } from '../solver/solve';
import type { TraceRuleId } from '../trace/step-trace';
import { limitWithSteps, type SolutionStep, StepCategory, solveWithSteps } from './step-solver';

function ruleIds(steps: ReadonlyArray<SolutionStep>): ReadonlyArray<TraceRuleId | undefined> {
  return steps.map((s) => s.ruleId);
}

function numericValues(answer: unknown): number[] {
  const solutions = answer as ReadonlyArray<Solution>;
  return solutions
    .map((s) => s.value)
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => a - b);
}

describe('solveWithSteps — ruleId tagging', () => {
  it("tags every step of the linear equation '2*x + 3 = 7'", () => {
    const solution = solveWithSteps('2*x + 3 = 7');

    // Every equation step is i18n-addressable
    for (const step of solution.steps) {
      expect(step.ruleId, `step ${step.stepNumber} (${step.operation})`).toBeDefined();
      expect(step.params).toBeDefined();
    }

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('equation.start');
    expect(ids).toContain('equation.moveTermsLeft');
    expect(ids).toContain('equation.classify.linear');
    expect(ids).toContain('linear.coefficients');
    expect(ids).toContain('linear.isolate');
    expect(ids).toContain('linear.divide');
    expect(ids).toContain('answer.single');

    expect(numericValues(solution.answer)).toEqual([2]);
  });

  it("traces factoring for 'x^2 + 5*x + 6 = 0'", () => {
    const solution = solveWithSteps('x^2 + 5*x + 6 = 0');

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('equation.classify.quadratic');
    expect(ids).toContain('quadratic.coefficients');
    expect(ids).toContain('quadratic.factor');
    expect(ids).toContain('quadratic.zeroProduct');
    expect(ids).toContain('quadratic.solveFactors');
    expect(ids).toContain('answer.multiple');

    expect(numericValues(solution.answer)).toEqual([-3, -2]);
  });

  it("traces the quadratic formula for 'x^2 - 3*x + 1 = 0'", () => {
    const solution = solveWithSteps('x^2 - 3*x + 1 = 0');

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('quadratic.formula');
    expect(ids).toContain('quadratic.evaluateRoots');
    // Irrational roots — factoring must NOT be claimed
    expect(ids).not.toContain('quadratic.factor');

    const values = numericValues(solution.answer);
    expect(values[0]).toBeCloseTo((3 - Math.sqrt(5)) / 2, 8);
    expect(values[1]).toBeCloseTo((3 + Math.sqrt(5)) / 2, 8);
  });

  it("traces complex roots for 'x^2 + 1 = 0'", () => {
    const solution = solveWithSteps('x^2 + 1 = 0');

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('quadratic.complexRoots');

    const solutions = solution.answer as ReadonlyArray<Solution>;
    expect(solutions).toHaveLength(2);
    expect(solutions[0]?.value).toBeInstanceOf(Complex);
  });
});

describe('solveWithSteps — rational equations', () => {
  it("solves '1/(x - 2) + 3 = 5' with domain and LCD steps", () => {
    const solution = solveWithSteps('1/(x - 2) + 3 = 5');

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('equation.classify.rational');
    expect(ids).toContain('rational.domain');
    expect(ids).toContain('rational.multiplyLcd');
    expect(ids).toContain('rational.checkExtraneous');
    // Root 2.5 does not zero the denominator — nothing is extraneous
    expect(ids).not.toContain('rational.extraneousExcluded');

    expect(numericValues(solution.answer)).toEqual([2.5]);
  });

  it("excludes the extraneous root of 'x/(x - 2) - 2/(x - 2) = 0'", () => {
    const solution = solveWithSteps('x/(x - 2) - 2/(x - 2) = 0');

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('equation.classify.rational');
    expect(ids).toContain('rational.domain');
    expect(ids).toContain('rational.extraneousExcluded');
    expect(ids).toContain('answer.none');

    const excluded = solution.steps.find((s) => s.ruleId === 'rational.extraneousExcluded');
    expect(excluded?.params?.['root']).toBe('2');

    expect(solution.answer).toEqual([]);
  });
});

describe('step params — ICU safety', () => {
  it('never contains braces or backslashes (LaTeX must stay out of params)', () => {
    const problems = [
      '2*x + 3 = 7',
      'x^2 + 5*x + 6 = 0',
      'x^2 - 3*x + 1 = 0',
      'x^2 + 1 = 0',
      '1/(x - 2) + 3 = 5',
      'x/(x - 2) - 2/(x - 2) = 0',
      'x^3 - 6*x^2 + 11*x - 6 = 0',
      'sin(x) - 0.5 = 0',
    ];

    const allSteps: SolutionStep[] = problems.flatMap((p) => [...solveWithSteps(p).steps]);
    allSteps.push(...limitWithSteps('sin(x)/x', 'x', { point: 0 }).steps);
    allSteps.push(...limitWithSteps('(exp(x) - 1)/x', 'x', { point: 0 }).steps);

    expect(allSteps.length).toBeGreaterThan(0);
    for (const step of allSteps) {
      for (const [key, value] of Object.entries(step.params ?? {})) {
        const text = String(value);
        expect(text, `param ${key} of ${step.ruleId}`).not.toMatch(/[{}\\]/);
      }
    }
  });
});

describe('limitWithSteps', () => {
  it('resolves sin(x)/x at 0 via the known pattern', () => {
    const solution = limitWithSteps('sin(x)/x', 'x', { point: 0 });

    expect(solution.problemType).toBe('Limit');
    expect(solution.answer).toBe(1);

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('limit.setup');
    expect(ids).toContain('limit.pattern');
    expect(ids[ids.length - 1]).toBe('limit.value');
  });

  it("resolves (exp(x) - 1)/x at 0 via L'Hôpital with a differentiate step", () => {
    const solution = limitWithSteps('(exp(x) - 1)/x', 'x', { point: 0 });

    expect(solution.answer).toBe(1);

    const ids = ruleIds(solution.steps);
    expect(ids).toContain('limit.lhopital');
    expect(ids).toContain('limit.lhopitalDifferentiate');
    expect(ids[ids.length - 1]).toBe('limit.value');
  });

  it('resolves x^2 + 1 at 2 by direct substitution', () => {
    const solution = limitWithSteps('x^2 + 1', 'x', { point: 2 });

    expect(solution.answer).toBe(5);
    expect(ruleIds(solution.steps)).toContain('limit.direct');
  });

  it('resolves 1/x at infinity to 0', () => {
    const solution = limitWithSteps('1/x', 'x', { point: 'infinity' });
    expect(solution.answer).toBe(0);
  });

  it('marks steps with the Limit category and \\lim LaTeX notation', () => {
    const solution = limitWithSteps('sin(x)/x', 'x', { point: 0 });

    const [first, ...rest] = solution.steps;
    const final = rest[rest.length - 1] ?? first;

    expect(first?.category).toBe(StepCategory.Limit);
    expect(final?.category).toBe(StepCategory.FinalAnswer);

    for (const step of solution.steps) {
      expect(step.latex).toContain('\\lim_{x \\to 0}');
    }
    expect(final?.latex).toContain('= 1');
  });

  it('renders one-sided limits with a direction superscript', () => {
    const solution = limitWithSteps('x^2 + 1', 'x', { point: 2, direction: 'right' });
    expect(solution.steps[0]?.latex).toContain('2^{+}');
    expect(solution.answer).toBe(5);
  });
});
