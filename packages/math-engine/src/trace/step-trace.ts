/**
 * StepTrace — structured, opt-in tracing for solver / CAS paths.
 *
 * A `TraceCollector` is passed explicitly (never ambiently) into engine
 * entry points that support tracing. Instrumented code emits via
 * `trace?.emit(...)`, so untraced hot paths pay exactly one undefined
 * check per emission site and allocate nothing.
 *
 * Traces are raw by design: they include internal bookkeeping rules
 * (per-iteration L'Hôpital checks, series term probes, no-op rewrites).
 * `curateTrace()` reduces a raw trace to textbook-grade steps:
 *   1. keep only whitelisted display rules,
 *   2. drop no-op transformations (before ≡ after),
 *   3. merge consecutive runs of the same simplification rule.
 */

import type { ExpressionNode } from '../parser/ast';
import { astEquals } from '../symbolic/simplify';

/**
 * Every rule id the engine can emit. Dot-namespaced; the segments double
 * as the i18n key path (`solver.stepRules.<ruleId>.{title,detail}`).
 *
 * Single source of truth: `TraceRuleId`, `DISPLAY_RULES` and the web
 * localization keys are all derived from this list.
 */
export const RULE_IDS = [
  // — equation narrative —
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
  // — linear equations —
  'linear.coefficients',
  'linear.isolate',
  'linear.divide',
  'linear.noSolution',
  'linear.allReals',
  // — quadratic equations —
  'quadratic.coefficients',
  'quadratic.factor',
  'quadratic.zeroProduct',
  'quadratic.solveFactors',
  'quadratic.repeatedRoot',
  'quadratic.formula',
  'quadratic.evaluateRoots',
  'quadratic.complexRoots',
  // — cubic equations —
  'cubic.coefficients',
  'cubic.depress',
  'cubic.discriminant',
  'cubic.roots',
  // — trigonometric equations —
  'trig.identify',
  'trig.isolate',
  'trig.inverse',
  'trig.principal',
  // — rational equations —
  'rational.domain',
  'rational.multiplyLcd',
  'rational.checkExtraneous',
  'rational.extraneousExcluded',
  // — numerical solving —
  'numeric.newton',
  'numeric.converged',
  'numeric.failed',
  // — final answers —
  'answer.single',
  'answer.multiple',
  'answer.none',
  // — limits —
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
  // — internal bookkeeping (never displayed; filtered by curateTrace) —
  'limit.lhopitalIterationCheck',
  'limit.seriesTermProbe',
  'simplify.rewrite',
] as const;

/** String-literal union of every emittable rule id. */
export type TraceRuleId = (typeof RULE_IDS)[number];

/**
 * Plain-value parameters attached to a trace step.
 *
 * Values MUST be pre-formatted plain strings or numbers (formatDecimal /
 * astToString output) — never LaTeX. Braces and backslashes break ICU
 * MessageFormat interpolation on the web layer.
 */
export type TraceParams = Readonly<Record<string, string | number>>;

/** One recorded transformation: `before` —(ruleId, params)→ `after`. */
export interface TraceStep {
  readonly ruleId: TraceRuleId;
  readonly params: TraceParams;
  readonly before: ExpressionNode;
  readonly after: ExpressionNode;
}

/**
 * Accumulates trace steps. Construct one and pass it via the `trace`
 * option of a traceable entry point (`solve`, `limit`, `limitWithSteps`).
 */
export class TraceCollector {
  readonly steps: TraceStep[] = [];

  emit(
    ruleId: TraceRuleId,
    before: ExpressionNode,
    after: ExpressionNode,
    params: TraceParams = {},
  ): void {
    this.steps.push({ ruleId, params, before, after });
  }
}

/** Internal bookkeeping rules — never textbook material. */
const INTERNAL_RULES: ReadonlySet<TraceRuleId> = new Set<TraceRuleId>([
  'limit.lhopitalIterationCheck',
  'limit.seriesTermProbe',
  'simplify.rewrite',
]);

/**
 * Whitelist of textbook-grade rules. Everything the engine emits that is
 * NOT in this set is internal noise and removed by `curateTrace()`.
 */
export const DISPLAY_RULES: ReadonlySet<TraceRuleId> = new Set(
  RULE_IDS.filter((id) => !INTERNAL_RULES.has(id)),
);

/**
 * Rules whose entire purpose is an AST transformation. A step with one of
 * these ids that did not change the AST (before ≡ after) is a no-op and is
 * dropped. All other display rules are narrative (announcements, classifications,
 * parameter extraction) and legitimately carry `before === after`.
 */
const TRANSFORM_RULES: ReadonlySet<TraceRuleId> = new Set<TraceRuleId>([
  'equation.moveTermsLeft',
  'linear.divide',
  'rational.multiplyLcd',
  'limit.simplify',
  'limit.lhopitalDifferentiate',
  'simplify.rewrite',
]);

/** Consecutive runs of these rules collapse into a single merged step. */
const MERGEABLE_RULES: ReadonlySet<TraceRuleId> = new Set<TraceRuleId>([
  'limit.simplify',
  'simplify.rewrite',
]);

/**
 * Reduce a raw trace to textbook-shaped steps:
 * whitelist-filter → no-op drop → consecutive-simplify merge.
 *
 * Merging keeps the first step's `before` and the last step's `after`
 * (params of the first step win — they are informational only for
 * simplification runs).
 */
export function curateTrace(steps: readonly TraceStep[]): TraceStep[] {
  const curated: TraceStep[] = [];

  for (const step of steps) {
    if (!DISPLAY_RULES.has(step.ruleId)) continue;
    if (TRANSFORM_RULES.has(step.ruleId) && astEquals(step.before, step.after)) continue;

    const previous = curated[curated.length - 1];
    if (previous && MERGEABLE_RULES.has(step.ruleId) && previous.ruleId === step.ruleId) {
      curated[curated.length - 1] = { ...previous, after: step.after };
      continue;
    }

    curated.push(step);
  }

  return curated;
}

/**
 * Compact decimal formatting for trace params — no trailing zeros, never
 * LaTeX. Shared by the solver and limits emitters.
 */
export function formatTraceNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : 'NaN';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6).replace(/\.?0+$/, '');
}
