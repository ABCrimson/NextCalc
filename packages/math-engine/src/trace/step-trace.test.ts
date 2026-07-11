/**
 * Tests for the StepTrace module: collector semantics and trace curation
 * (display whitelist, no-op drop, consecutive-simplify merge).
 */

import { describe, expect, it } from 'vitest';
import { createConstantNode, createSymbolNode } from '../parser/ast';
import { parse } from '../parser/parser';
import {
  curateTrace,
  DISPLAY_RULES,
  formatTraceNumber,
  RULE_IDS,
  TraceCollector,
  type TraceRuleId,
  type TraceStep,
} from './step-trace';

const x = createSymbolNode('x');
const one = createConstantNode(1);
const two = createConstantNode(2);

function step(ruleId: TraceRuleId, before = x, after = x): TraceStep {
  return { ruleId, params: {}, before, after };
}

describe('TraceCollector', () => {
  it('accumulates typed steps in emission order', () => {
    const trace = new TraceCollector();
    expect(trace.steps).toHaveLength(0);

    trace.emit('equation.start', x, x);
    trace.emit('linear.divide', x, two, { a: '2', solution: '2' });

    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[0]?.ruleId).toBe('equation.start');
    expect(trace.steps[0]?.params).toEqual({});
    expect(trace.steps[1]?.ruleId).toBe('linear.divide');
    expect(trace.steps[1]?.params).toEqual({ a: '2', solution: '2' });
    expect(trace.steps[1]?.before).toBe(x);
    expect(trace.steps[1]?.after).toBe(two);
  });
});

describe('curateTrace', () => {
  it('drops non-whitelisted (internal) rule ids', () => {
    const curated = curateTrace([
      step('limit.setup'),
      step('limit.lhopitalIterationCheck'),
      step('limit.seriesTermProbe'),
      step('simplify.rewrite', one, two),
      step('limit.lhopitalResult', x, one),
    ]);

    expect(curated.map((s) => s.ruleId)).toEqual(['limit.setup', 'limit.lhopitalResult']);
  });

  it('drops no-op transformation steps (before ≡ after)', () => {
    const sinOverX = parse('sin(x)/x');
    const sameAst = parse('sin(x)/x');

    const curated = curateTrace([
      step('limit.simplify', sinOverX, sameAst), // no-op transform → dropped
      step('limit.lhopitalDifferentiate', sinOverX, sameAst), // no-op transform → dropped
      step('limit.simplify', sinOverX, parse('1')), // real transform → kept
    ]);

    expect(curated.map((s) => s.ruleId)).toEqual(['limit.simplify']);
    expect(curated[0]?.after).toEqual(parse('1'));
  });

  it('keeps narrative steps even when before ≡ after', () => {
    const curated = curateTrace([
      step('equation.start'),
      step('equation.classify.linear'),
      step('limit.setup'),
      step('limit.indeterminate'),
    ]);

    expect(curated).toHaveLength(4);
  });

  it('merges consecutive limit.simplify runs keeping first.before / last.after', () => {
    const a = parse('(x^2 - 1)/(x - 1)');
    const b = parse('(x + 1) * (x - 1)/(x - 1)');
    const c = parse('x + 1');

    const curated = curateTrace([
      step('limit.setup'),
      step('limit.simplify', a, b),
      step('limit.simplify', b, c),
      step('limit.direct', c, two),
    ]);

    expect(curated.map((s) => s.ruleId)).toEqual(['limit.setup', 'limit.simplify', 'limit.direct']);
    const merged = curated[1];
    expect(merged?.before).toEqual(a);
    expect(merged?.after).toEqual(c);
  });

  it('does not merge non-consecutive runs', () => {
    const a = parse('x + 1');
    const b = parse('x + 2');
    const curated = curateTrace([
      step('limit.simplify', a, b),
      step('limit.indeterminate'),
      step('limit.simplify', b, a),
    ]);
    expect(curated.map((s) => s.ruleId)).toEqual([
      'limit.simplify',
      'limit.indeterminate',
      'limit.simplify',
    ]);
  });
});

describe('DISPLAY_RULES', () => {
  it('contains every display-grade ruleId emitted by the solver and limits paths', () => {
    const displayGrade: TraceRuleId[] = [
      'equation.start',
      'equation.moveTermsLeft',
      'equation.classify.linear',
      'equation.classify.quadratic',
      'equation.classify.cubic',
      'equation.classify.rational',
      'equation.classify.trigonometric',
      'equation.classify.exponential',
      'equation.classify.logarithmic',
      'equation.classify.transcendental',
      'equation.classify.higherPolynomial',
      'linear.coefficients',
      'linear.isolate',
      'linear.divide',
      'linear.noSolution',
      'linear.allReals',
      'quadratic.coefficients',
      'quadratic.factor',
      'quadratic.zeroProduct',
      'quadratic.solveFactors',
      'quadratic.repeatedRoot',
      'quadratic.formula',
      'quadratic.evaluateRoots',
      'quadratic.complexRoots',
      'cubic.coefficients',
      'cubic.depress',
      'cubic.discriminant',
      'cubic.roots',
      'trig.identify',
      'trig.isolate',
      'trig.inverse',
      'trig.principal',
      'rational.domain',
      'rational.multiplyLcd',
      'rational.checkExtraneous',
      'rational.extraneousExcluded',
      'numeric.newton',
      'numeric.converged',
      'numeric.failed',
      'answer.single',
      'answer.multiple',
      'answer.none',
      'limit.setup',
      'limit.pattern',
      'limit.direct',
      'limit.indeterminate',
      'limit.simplify',
      'limit.lhopital',
      'limit.lhopitalDifferentiate',
      'limit.lhopitalResult',
      'limit.series',
      'limit.seriesResult',
      'limit.numerical',
      'limit.numericalResult',
      'limit.value',
      'limit.infinite',
      'limit.dne',
    ];

    for (const ruleId of displayGrade) {
      expect(DISPLAY_RULES.has(ruleId), `${ruleId} should be display-grade`).toBe(true);
    }
  });

  it('excludes internal bookkeeping rules', () => {
    expect(DISPLAY_RULES.has('limit.lhopitalIterationCheck')).toBe(false);
    expect(DISPLAY_RULES.has('limit.seriesTermProbe')).toBe(false);
    expect(DISPLAY_RULES.has('simplify.rewrite')).toBe(false);
  });

  it('is derived from RULE_IDS (no orphan entries)', () => {
    for (const ruleId of DISPLAY_RULES) {
      expect(RULE_IDS).toContain(ruleId);
    }
  });
});

describe('formatTraceNumber', () => {
  it('formats compactly without trailing zeros', () => {
    expect(formatTraceNumber(2)).toBe('2');
    expect(formatTraceNumber(2.5)).toBe('2.5');
    expect(formatTraceNumber(1 / 3)).toBe('0.333333');
    expect(formatTraceNumber(-0.5)).toBe('-0.5');
  });

  it('handles non-finite values without LaTeX or braces', () => {
    expect(formatTraceNumber(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatTraceNumber(Number.NEGATIVE_INFINITY)).toBe('-∞');
    expect(formatTraceNumber(Number.NaN)).toBe('NaN');
  });
});
