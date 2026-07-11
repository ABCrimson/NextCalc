/**
 * Expression equivalence checking.
 *
 * `checkEquivalence(student, canonical)` decides whether two expression
 * strings are mathematically equivalent:
 *
 * 1. **Symbolic**: simplify(student − canonical) via the rule-based
 *    simplifier and the CAS — a literal constant `0` proves equivalence.
 * 2. **Numeric probing fallback**: deterministic seeded sampling of the
 *    shared variables; every valid sample must agree within a mixed
 *    absolute/relative tolerance. A single mismatch rejects; too few
 *    valid samples yields `inconclusive` (never a false "equivalent").
 *
 * `checkGradedAnswer(answer, graded)` grades free-form student input
 * against a {@link GradedAnswer} produced by the template engine:
 * multi-solution lists ("x = 2 or x = 3", "2; 3"), numeric values
 * (accepting expressions like `1/2` or `16*pi`), labeled assignments
 * ("x = 2, y = 3"), and canonical expressions (with `+ C` stripping).
 *
 * Determinism: no `Math.random` anywhere — probing uses the seeded RNG,
 * keyed by the input pair by default, so identical inputs always probe
 * identical points.
 */

import { ComputerAlgebraSystem } from '../cas';
import { evaluate, extractVariables, parse } from '../parser';
import { createOperatorNode, type ExpressionNode, isConstantNode } from '../parser/ast';
import { createSeededRandom } from '../problems/templates/seeded-rng';
import type { GradedAnswer } from '../problems/templates/template-engine';
import { simplify } from '../symbolic/simplify';

export type { GradedAnswer };

/** Options for {@link checkEquivalence}. */
export interface EquivalenceOptions {
  /** Probe-point seed. Defaults to `${student}|${canonical}` (deterministic). */
  seed?: string;
  /** Number of probe points (default 24). */
  samples?: number;
  /** Sampling domain for probe points (default [-5, 5]). */
  domain?: readonly [number, number];
  /** Mixed abs/rel tolerance: |a−b| ≤ tol·max(1,|a|,|b|) (default 1e-9). */
  tolerance?: number;
}

/** Why an equivalence verdict was reached. */
export type EquivalenceReason =
  | 'parse-error'
  | 'simplified-to-zero'
  | 'numeric-agreement'
  | 'counterexample'
  | 'inconclusive';

/** Result of {@link checkEquivalence}. */
export interface EquivalenceResult {
  equivalent: boolean;
  method: 'symbolic' | 'numeric';
  /** Fraction of probe points that evaluated cleanly (1 for symbolic). */
  confidence: number;
  reason?: EquivalenceReason;
}

/** Result of {@link checkGradedAnswer}. */
export interface GradedCheckResult {
  correct: boolean;
  method: 'symbolic' | 'numeric';
}

const MIN_VALID_SAMPLES = 8;
const DEFAULT_SAMPLES = 24;
const DEFAULT_TOLERANCE = 1e-9;
const SOLUTION_TOLERANCE = 1e-6;
const SINGULARITY_CUTOFF = 1e12;

/** Mixed absolute/relative comparison: |a−b| ≤ tol·max(1, |a|, |b|). */
function approxEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** True when a node is the literal constant 0 (number or bigint). */
function isZeroConstant(node: ExpressionNode): boolean {
  if (!isConstantNode(node)) return false;
  if (typeof node.value === 'number') return node.value === 0;
  if (typeof node.value === 'bigint') return node.value === 0n;
  return false;
}

/**
 * Evaluate an AST to a finite number, or null when evaluation fails,
 * produces a non-finite value, or exceeds the singularity cutoff.
 */
function evalNumber(ast: ExpressionNode, variables: Record<string, number>): number | null {
  const result = evaluate(ast, { variables, mode: 'approximate' });
  if (!result.success) return null;
  const value = typeof result.value === 'bigint' ? Number(result.value) : result.value;
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || Math.abs(value) > SINGULARITY_CUTOFF) return null;
  return value;
}

/** Evaluate a constant (variable-free) expression string to a number. */
function evalConstant(expression: string): number | null {
  try {
    const ast = parse(expression);
    if (extractVariables(ast).size > 0) return null;
    return evalNumber(ast, {});
  } catch {
    return null;
  }
}

/**
 * Strip a leading assignment prefix such as `x =`, `y =`, `f(x) =`,
 * or `f'(x) =` from a student answer.
 */
function stripLeadingAssignment(input: string): string {
  return input.replace(
    /^\s*[A-Za-z][A-Za-z0-9_]*'*\s*(?:\(\s*[A-Za-z][A-Za-z0-9_]*\s*\))?\s*=\s*/,
    '',
  );
}

/** Strip a trailing constant of integration (`+ C` / `+c`). */
function stripConstantOfIntegration(input: string): string {
  return input.replace(/\s*\+\s*[Cc]\s*$/, '');
}

/**
 * Check whether two expression strings are mathematically equivalent.
 *
 * The check is conservative: it only returns `equivalent: true` when it
 * can support the claim symbolically (difference simplifies to the
 * literal constant 0) or numerically (≥ {@link MIN_VALID_SAMPLES} clean
 * probe points, all within tolerance, zero mismatches).
 */
export function checkEquivalence(
  student: string,
  canonical: string,
  options: EquivalenceOptions = {},
): EquivalenceResult {
  let studentAst: ExpressionNode;
  let canonicalAst: ExpressionNode;
  try {
    studentAst = parse(student);
    canonicalAst = parse(canonical);
  } catch {
    return { equivalent: false, method: 'symbolic', confidence: 1, reason: 'parse-error' };
  }

  // ── 1. Symbolic: simplify(student − canonical) must be literally 0 ──
  try {
    const diff = createOperatorNode('-', 'subtract', [studentAst, canonicalAst]);
    const simplified = simplify(diff);
    if (isZeroConstant(simplified)) {
      return { equivalent: true, method: 'symbolic', confidence: 1, reason: 'simplified-to-zero' };
    }
    const casSimplified = new ComputerAlgebraSystem().simplify(simplified).expression;
    if (isZeroConstant(casSimplified)) {
      return { equivalent: true, method: 'symbolic', confidence: 1, reason: 'simplified-to-zero' };
    }
  } catch {
    // Symbolic machinery failed on this shape — fall through to probing.
  }

  // ── 2. Numeric probing fallback (deterministic, seeded) ──
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const variableNames = [
    ...new Set([...extractVariables(studentAst), ...extractVariables(canonicalAst)]),
  ];

  if (variableNames.length === 0) {
    // Constant expressions: a single evaluation decides.
    const a = evalNumber(studentAst, {});
    const b = evalNumber(canonicalAst, {});
    if (a === null || b === null) {
      return { equivalent: false, method: 'numeric', confidence: 0, reason: 'inconclusive' };
    }
    const equal = approxEqual(a, b, tolerance);
    return {
      equivalent: equal,
      method: 'numeric',
      confidence: 1,
      reason: equal ? 'numeric-agreement' : 'counterexample',
    };
  }

  const samples = options.samples ?? DEFAULT_SAMPLES;
  const [lo, hi] = options.domain ?? ([-5, 5] as const);
  const rng = createSeededRandom(options.seed ?? `${student}|${canonical}`);
  // Reserve a few trailing samples for the positive domain (0.1, 3] so
  // sqrt/log expressions still collect enough valid points.
  const positiveSamples = Math.min(6, Math.max(1, Math.floor(samples / 4)));

  let valid = 0;
  for (let i = 0; i < samples; i++) {
    const usePositiveDomain = i >= samples - positiveSamples;
    const variables: Record<string, number> = {};
    for (const name of variableNames) {
      variables[name] = usePositiveDomain ? 0.1 + rng() * 2.9 : lo + rng() * (hi - lo);
    }

    const a = evalNumber(studentAst, variables);
    const b = evalNumber(canonicalAst, variables);
    if (a === null || b === null) continue; // singularity or domain error — skip point

    valid++;
    if (!approxEqual(a, b, tolerance)) {
      return {
        equivalent: false,
        method: 'numeric',
        confidence: valid / samples,
        reason: 'counterexample',
      };
    }
  }

  if (valid < MIN_VALID_SAMPLES) {
    return {
      equivalent: false,
      method: 'numeric',
      confidence: valid / samples,
      reason: 'inconclusive',
    };
  }

  return {
    equivalent: true,
    method: 'numeric',
    confidence: valid / samples,
    reason: 'numeric-agreement',
  };
}

/**
 * Parse a student's multi-solution answer into numeric values.
 * Accepts "x = 2 or x = 3", "x=2, x=-3", "2; 3", "2, 3", "1/2",
 * "sqrt(2)" — each fragment must evaluate to a variable-free number.
 * Returns null when any fragment fails to evaluate.
 */
function parseSolutionList(input: string): number[] | null {
  const fragments = input
    .split(/\bor\b|\band\b|[,;]/i)
    .map((fragment) => stripLeadingAssignment(fragment.trim()))
    .filter((fragment) => fragment.length > 0);

  if (fragments.length === 0) return null;

  const values: number[] = [];
  for (const fragment of fragments) {
    const value = evalConstant(fragment);
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

/** Deduplicate numeric values within tolerance (order-preserving). */
function dedupe(values: ReadonlyArray<number>, tolerance: number): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (!out.some((existing) => approxEqual(existing, value, tolerance))) {
      out.push(value);
    }
  }
  return out;
}

/** Order-insensitive multiset match within tolerance. */
function multisetMatch(
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>,
  tolerance: number,
): boolean {
  if (a.length !== b.length) return false;
  const remaining = [...b];
  for (const value of a) {
    const index = remaining.findIndex((candidate) => approxEqual(candidate, value, tolerance));
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return true;
}

/**
 * Grade a free-form student answer against a machine-gradable answer.
 *
 * - `solutions`: order-insensitive root matching (deduplicated, so a
 *   double root written once or twice both pass) with 1e-6 tolerance.
 * - `number`: single value; expression input (`1/2`, `16*pi`) accepted.
 * - `assignments`: labeled ("x = 2, y = 3", any order) or unlabeled
 *   ordered ("2, 3") variable values — swapped labeled values fail.
 * - `expression`: strips `+ C` and assignment prefixes, then delegates
 *   to {@link checkEquivalence}.
 */
export function checkGradedAnswer(studentAnswer: string, graded: GradedAnswer): GradedCheckResult {
  switch (graded.kind) {
    case 'solutions': {
      const values = parseSolutionList(studentAnswer);
      if (!values) return { correct: false, method: 'numeric' };
      const correct = multisetMatch(
        dedupe(values, SOLUTION_TOLERANCE),
        dedupe(graded.values, SOLUTION_TOLERANCE),
        SOLUTION_TOLERANCE,
      );
      return { correct, method: 'numeric' };
    }

    case 'number': {
      const value = evalConstant(stripLeadingAssignment(studentAnswer.trim()));
      if (value === null) return { correct: false, method: 'numeric' };
      const tolerance = graded.tolerance ?? SOLUTION_TOLERANCE;
      return { correct: approxEqual(value, graded.value, tolerance), method: 'numeric' };
    }

    case 'assignments': {
      const parts = studentAnswer
        .split(/\band\b|[,;]/i)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (parts.length !== graded.variables.length) {
        return { correct: false, method: 'numeric' };
      }

      const labeled = parts.every((part) => /^[A-Za-z][A-Za-z0-9_]*\s*=/.test(part));
      if (labeled) {
        const assignments = new Map<string, number>();
        for (const part of parts) {
          const match = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(part);
          if (!match || match[1] === undefined || match[2] === undefined) {
            return { correct: false, method: 'numeric' };
          }
          const value = evalConstant(match[2]);
          if (value === null || assignments.has(match[1])) {
            return { correct: false, method: 'numeric' };
          }
          assignments.set(match[1], value);
        }
        const correct = graded.variables.every((name, i) => {
          const got = assignments.get(name);
          const expected = graded.values[i];
          return (
            got !== undefined &&
            expected !== undefined &&
            approxEqual(got, expected, SOLUTION_TOLERANCE)
          );
        });
        return { correct, method: 'numeric' };
      }

      // Unlabeled: ordered interpretation in declared variable order.
      const values = parts.map((part) => evalConstant(part));
      const correct =
        values.every((value): value is number => value !== null) &&
        values.every((value, i) => {
          const expected = graded.values[i];
          return expected !== undefined && approxEqual(value, expected, SOLUTION_TOLERANCE);
        });
      return { correct, method: 'numeric' };
    }

    case 'expression': {
      const normalized = stripConstantOfIntegration(
        stripLeadingAssignment(studentAnswer.trim()),
      ).trim();
      if (normalized.length === 0) return { correct: false, method: 'symbolic' };
      const result = checkEquivalence(normalized, graded.expression);
      return { correct: result.equivalent, method: result.method };
    }

    default:
      return { correct: false, method: 'numeric' };
  }
}

/**
 * Normalize a free-form answer for expression comparison: trims,
 * strips a leading assignment prefix and a trailing `+ C`.
 * Exposed for grading call-sites (e.g. server actions).
 */
export function normalizeAnswerExpression(input: string): string {
  return stripConstantOfIntegration(stripLeadingAssignment(input.trim())).trim();
}
