/**
 * Arbitrary-Model Regression (Desmos-style tilde fitting)
 *
 * Fits user-supplied models of the form `y1 ~ a*exp(b*x1)` to columnar data
 * using damped Levenberg-Marquardt with analytic Jacobians obtained from the
 * symbolic differentiation engine. The tilde is split in this module — it is
 * never fed to the expression parser (mathjs has no `~` operator).
 *
 * Honesty contract: a fit NEVER silently succeeds. `FitResult` is a
 * discriminated union whose failure arm carries an explicit status
 * ('invalid-model' | 'insufficient-data' | 'singular' | 'diverged'), and the
 * success arm reports 'converged' vs 'max-iterations' plus structured
 * warnings (dropped rows, parameters pinned at bounds, zero variance).
 *
 * @module stats/fit
 */

import { solveLinearSystem } from '../matrix';
import {
  type EvaluationResult,
  type ExpressionNode,
  evaluate,
  extractVariables,
  isFunctionNode,
  parse,
} from '../parser';
import { differentiate, simplifyDerivative } from '../symbolic/differentiate';
import { mean, median } from './descriptive';
import { linearRegression } from './regression';

/** Valid column / parameter identifier (also mirrored by the web data table). */
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Error codes produced by {@link parseTildeModel}. */
export type TildeModelErrorCode =
  | 'no-tilde'
  | 'multiple-tildes'
  | 'invalid-dependent'
  | 'parse-error'
  | 'no-parameters';

/** Successfully parsed tilde model (the `ok: true` arm of {@link ParsedModel}). */
export interface TildeModel {
  /** Column name on the left of the tilde (the dependent variable). */
  readonly dependent: string;
  /** Parsed AST of the right-hand side. */
  readonly rhsAst: ExpressionNode;
  /** Trimmed right-hand-side source text. */
  readonly rhsText: string;
  /** Free parameters to fit (symbols that are neither columns nor built-in constants), sorted. */
  readonly parameters: readonly string[];
  /** Data columns referenced on the right-hand side, sorted. */
  readonly regressors: readonly string[];
}

/**
 * Result of parsing a tilde model expression.
 * A discriminated union so UI callers can render error state without try/catch.
 */
export type ParsedModel =
  | ({ readonly ok: true } & TildeModel)
  | { readonly ok: false; readonly code: TildeModelErrorCode; readonly message: string };

/**
 * Splits a tilde model like `y1 ~ a*exp(b*x1)` into dependent column,
 * right-hand-side AST, fit parameters and regressors.
 *
 * @param input - Full model text containing exactly one `~`
 * @param columns - Data column names; the LHS must be one of these
 */
export function parseTildeModel(input: string, columns: readonly string[]): ParsedModel {
  const parts = input.split('~');
  if (parts.length === 1) {
    return {
      ok: false,
      code: 'no-tilde',
      message: 'Model must contain a "~" separating the dependent column from the formula',
    };
  }
  if (parts.length > 2) {
    return {
      ok: false,
      code: 'multiple-tildes',
      message: 'Model must contain exactly one "~"',
    };
  }

  const dependent = (parts[0] ?? '').trim();
  const rhsText = (parts[1] ?? '').trim();

  if (!IDENTIFIER_PATTERN.test(dependent) || !columns.includes(dependent)) {
    return {
      ok: false,
      code: 'invalid-dependent',
      message: `Left side of "~" must be a data column (one of: ${columns.join(', ')})`,
    };
  }

  let rhsAst: ExpressionNode;
  try {
    rhsAst = parse(rhsText);
  } catch (error) {
    return {
      ok: false,
      code: 'parse-error',
      message: error instanceof Error ? error.message : `Failed to parse formula: ${rhsText}`,
    };
  }

  // extractVariables already excludes built-in constants (pi/π, e, tau/τ, i, phi/φ).
  const symbols = extractVariables(rhsAst);
  const columnSet = new Set(columns);
  const parameters = [...symbols].filter((s) => !columnSet.has(s)).sort();
  const regressors = [...symbols].filter((s) => columnSet.has(s)).sort();

  if (parameters.length === 0) {
    return {
      ok: false,
      code: 'no-parameters',
      message: 'Formula has no free parameters to fit — every symbol is a data column',
    };
  }

  return { ok: true, dependent, rhsAst, rhsText, parameters, regressors };
}

/** Canned model families with prebaked formulas and smart initial guesses. */
export type CannedModelKind =
  | 'linear'
  | 'quadratic'
  | 'exponential'
  | 'logarithmic'
  | 'logistic'
  | 'sinusoidal';

/**
 * Builds the model string for a canned model family over the given columns.
 *
 * @example buildCannedModel('exponential', 'x1', 'y1') // 'y1 ~ a*exp(b*x1)'
 */
export function buildCannedModel(kind: CannedModelKind, xColumn: string, yColumn: string): string {
  switch (kind) {
    case 'linear':
      return `${yColumn} ~ m*${xColumn} + b`;
    case 'quadratic':
      return `${yColumn} ~ a*${xColumn}^2 + b*${xColumn} + c`;
    case 'exponential':
      return `${yColumn} ~ a*exp(b*${xColumn})`;
    case 'logarithmic':
      return `${yColumn} ~ a + b*ln(${xColumn})`;
    case 'logistic':
      return `${yColumn} ~ L/(1 + exp(-k*(${xColumn} - x0)))`;
    case 'sinusoidal':
      return `${yColumn} ~ a*sin(b*${xColumn} + c) + d`;
  }
}

/** Optional per-parameter box constraints. */
export interface ParameterBounds {
  readonly min?: number;
  readonly max?: number;
}

/** Options for {@link fitModel}. */
export interface FitOptions {
  /** Maximum Levenberg-Marquardt iterations (default 100). */
  readonly maxIterations?: number;
  /** Relative convergence tolerance on SSR decrease and step size (default 1e-10). */
  readonly tolerance?: number;
  /** Initial LM damping factor λ (default 1e-3). */
  readonly lambdaInit?: number;
  /** Per-parameter starting values; wins over the built-in smart seeds. */
  readonly initialGuess?: Readonly<Record<string, number>>;
  /** Per-parameter box bounds; trial steps are clamped and a warning recorded. */
  readonly bounds?: Readonly<Record<string, ParameterBounds>>;
}

/**
 * Structured, translatable warning attached to a successful fit.
 * (Structured rather than plain strings so UIs can localize with ICU args.)
 */
export type FitWarning =
  | { readonly code: 'dropped-rows'; readonly count: number }
  | { readonly code: 'bound-hit'; readonly name: string }
  | { readonly code: 'zero-variance' };

/** Successful fit. */
export interface FitSuccess {
  readonly ok: true;
  /** Fitted parameter values keyed by parameter name. */
  readonly parameters: Record<string, number>;
  /** Asymptotic standard errors (omitted when JᵀJ is singular or n ≤ p). */
  readonly standardErrors?: Record<string, number>;
  /** Coefficient of determination in the original data space. */
  readonly r2: number;
  /** Root mean squared error √(SSR/n). */
  readonly rmse: number;
  /** Per-row residuals yᵢ − ŷᵢ (rows with non-finite inputs are excluded). */
  readonly residuals: number[];
  /** Per-row model predictions ŷᵢ. */
  readonly predicted: number[];
  /** LM iterations executed. */
  readonly iterations: number;
  /** 'converged' or 'max-iterations' — the latter is a visible caution, never silent. */
  readonly status: 'converged' | 'max-iterations';
  readonly warnings: FitWarning[];
  /** The parsed model that was fitted. */
  readonly model: TildeModel;
  /** Evaluates the fitted model at arbitrary regressor values (NaN on domain errors). */
  readonly predict: (vars: Record<string, number>) => number;
}

/** Failed fit — always carries an explicit machine-readable status. */
export interface FitFailure {
  readonly ok: false;
  readonly status: 'invalid-model' | 'insufficient-data' | 'singular' | 'diverged';
  readonly message: string;
  readonly issues?: string[];
}

/** Discriminated fit result: check `.ok` before reading fit statistics. */
export type FitResult = FitSuccess | FitFailure;

/** Coerces an evaluator result to a finite number, or null on any failure. */
function toFiniteNumber(result: EvaluationResult): number | null {
  if (!result.success) return null;
  const raw = result.value;
  const value = typeof raw === 'bigint' ? Number(raw) : raw;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** True when the AST contains a function call with the given name. */
function containsFunction(node: ExpressionNode, fn: string): boolean {
  if (isFunctionNode(node) && node.fn === fn) return true;
  return node.args?.some((arg) => containsFunction(arg, fn)) ?? false;
}

/** Largest absolute value in a non-empty array. */
function maxAbs(values: readonly number[]): number {
  let max = 0;
  for (const v of values) {
    const a = Math.abs(v);
    if (a > max) max = a;
  }
  return max;
}

/**
 * Smart initial guesses keyed off the canned model shapes; every parameter
 * defaults to 1 when no heuristic applies.
 *
 * Note: the sinusoidal frequency seed b = 2π/(xMax − xMin) is a heuristic —
 * sinusoidal fits are strongly guess-sensitive; pass `initialGuess` when the
 * frequency is roughly known.
 */
function defaultSeeds(
  model: TildeModel,
  x: readonly number[] | null,
  y: readonly number[],
): Record<string, number> {
  const seeds: Record<string, number> = {};
  for (const p of model.parameters) seeds[p] = 1;
  const paramSet = new Set(model.parameters);

  if (paramSet.has('L') && paramSet.has('k') && paramSet.has('x0')) {
    // Logistic L/(1 + exp(-k*(x - x0)))
    seeds['L'] = 1.05 * Math.max(...y);
    seeds['k'] = 1;
    seeds['x0'] = x && x.length > 0 ? median([...x]) : 0;
  } else if (
    paramSet.has('a') &&
    paramSet.has('b') &&
    paramSet.has('c') &&
    paramSet.has('d') &&
    containsFunction(model.rhsAst, 'sin')
  ) {
    // Sinusoidal a*sin(b*x + c) + d
    const yMax = Math.max(...y);
    const yMin = Math.min(...y);
    seeds['a'] = (yMax - yMin) / 2 || 1;
    seeds['d'] = mean([...y]);
    seeds['c'] = 0;
    if (x && x.length > 1) {
      const xMax = Math.max(...x);
      const xMin = Math.min(...x);
      seeds['b'] = xMax > xMin ? (2 * Math.PI) / (xMax - xMin) : 1;
    }
  } else if (paramSet.has('a') && paramSet.has('b') && containsFunction(model.rhsAst, 'exp')) {
    // Exponential-family a*exp(b*x): seed from log-linear regression when possible.
    let seeded = false;
    if (x && x.length >= 2 && y.every((v) => v > 0)) {
      try {
        const logFit = linearRegression([...x], y.map(Math.log));
        if (Number.isFinite(logFit.slope) && Number.isFinite(logFit.intercept)) {
          seeds['a'] = Math.exp(logFit.intercept);
          seeds['b'] = logFit.slope;
          seeded = true;
        }
      } catch {
        // degenerate x — fall through to the magnitude seed
      }
    }
    if (!seeded) {
      seeds['a'] = maxAbs(y) || 1;
      seeds['b'] = 0.1;
    }
  }

  return seeds;
}

/** One fully evaluated LM point: predictions, Jacobian and SSR. */
interface EvalPoint {
  readonly f: number[];
  readonly jacobian: number[][];
  readonly ssr: number;
}

/**
 * Fits `model` (tilde syntax) to columnar `data` with damped Levenberg-Marquardt.
 *
 * - Analytic Jacobians via symbolic differentiation (no finite differences).
 * - Rows containing non-finite values in any used column are dropped (warned).
 * - Trial steps are clamped to `options.bounds` (warned once per parameter).
 * - Never returns a silent bad fit: failures carry an explicit status, and a
 *   non-converged success is flagged 'max-iterations'.
 */
export function fitModel(
  data: Readonly<Record<string, readonly number[]>>,
  model: string,
  options?: FitOptions,
): FitResult {
  const columns = Object.keys(data);
  const parsed = parseTildeModel(model, columns);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 'invalid-model',
      message: parsed.message,
      issues: [parsed.code],
    };
  }

  const maxIterations = options?.maxIterations ?? 100;
  const tolerance = options?.tolerance ?? 1e-10;
  let lambda = options?.lambdaInit ?? 1e-3;

  // Analytic Jacobian ASTs, computed once per parameter.
  const parameters = parsed.parameters;
  const p = parameters.length;
  let jacobianAsts: ExpressionNode[];
  try {
    jacobianAsts = parameters.map((name) => simplifyDerivative(differentiate(parsed.rhsAst, name)));
  } catch (error) {
    return {
      ok: false,
      status: 'invalid-model',
      message: `Model is not differentiable with respect to its parameters: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  // Assemble finite rows over the used columns.
  const usedColumns = [parsed.dependent, ...parsed.regressors];
  const rowCount = Math.min(...usedColumns.map((c) => data[c]?.length ?? 0));
  const rows: Record<string, number>[] = [];
  const y: number[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, number> = {};
    let finite = true;
    for (const c of usedColumns) {
      const v = data[c]?.[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        finite = false;
        break;
      }
      row[c] = v;
    }
    if (!finite) continue;
    rows.push(row);
    y.push(row[parsed.dependent] ?? Number.NaN);
  }

  const warnings: FitWarning[] = [];
  const dropped = rowCount - rows.length;
  if (dropped > 0) {
    warnings.push({ code: 'dropped-rows', count: dropped });
  }

  const n = rows.length;
  if (n <= p) {
    return {
      ok: false,
      status: 'insufficient-data',
      message: `Need more than ${p} finite data rows to fit ${p} parameter${p === 1 ? '' : 's'} (got ${n})`,
    };
  }

  // Initial parameter vector: user guess > smart seeds > 1, clamped into bounds.
  const firstRegressor = parsed.regressors[0];
  const xForSeeds =
    firstRegressor === undefined ? null : rows.map((row) => row[firstRegressor] ?? Number.NaN);
  const seeds = defaultSeeds(parsed, xForSeeds, y);
  const boundsFor = (name: string): ParameterBounds | undefined => options?.bounds?.[name];
  const clamp = (name: string, value: number): number => {
    const b = boundsFor(name);
    let v = value;
    if (b?.min !== undefined && v < b.min) v = b.min;
    if (b?.max !== undefined && v > b.max) v = b.max;
    return v;
  };
  let params = parameters.map((name) =>
    clamp(name, options?.initialGuess?.[name] ?? seeds[name] ?? 1),
  );

  const toParamRecord = (vec: readonly number[]): Record<string, number> => {
    const record: Record<string, number> = {};
    parameters.forEach((name, j) => {
      record[name] = vec[j] ?? Number.NaN;
    });
    return record;
  };

  /** Evaluates model + Jacobian at a parameter vector; string on failure. */
  const evalPoint = (vec: readonly number[]): EvalPoint | string => {
    const paramRecord = toParamRecord(vec);
    const f: number[] = [];
    const jacobian: number[][] = [];
    let ssr = 0;
    for (let i = 0; i < n; i++) {
      const variables = { ...rows[i], ...paramRecord };
      const fi = toFiniteNumber(evaluate(parsed.rhsAst, { variables }));
      if (fi === null) {
        return `model evaluation failed at data row ${i + 1}`;
      }
      const grad: number[] = [];
      for (let j = 0; j < p; j++) {
        const ast = jacobianAsts[j];
        const gj = ast === undefined ? null : toFiniteNumber(evaluate(ast, { variables }));
        if (gj === null) {
          return `derivative with respect to "${parameters[j]}" failed at data row ${i + 1}`;
        }
        grad.push(gj);
      }
      f.push(fi);
      jacobian.push(grad);
      const r = (y[i] ?? Number.NaN) - fi;
      ssr += r * r;
    }
    return { f, jacobian, ssr };
  };

  let current = evalPoint(params);
  if (typeof current === 'string') {
    return {
      ok: false,
      status: 'diverged',
      message: `Model could not be evaluated at the initial guess: ${current}`,
    };
  }

  let iterations = 0;
  let status: 'converged' | 'max-iterations' = 'max-iterations';
  let consecutiveSingular = 0;
  const boundHits = new Set<string>();

  for (let iter = 1; iter <= maxIterations; iter++) {
    iterations = iter;

    // Normal equations: (JᵀJ + λ·diag(JᵀJ))·δ = Jᵀr
    const jtj: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const jtr = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i++) {
      const gradRow = current.jacobian[i];
      const fi = current.f[i];
      if (gradRow === undefined || fi === undefined) continue;
      const ri = (y[i] ?? Number.NaN) - fi;
      for (let j = 0; j < p; j++) {
        const gj = gradRow[j] ?? 0;
        jtr[j] = (jtr[j] ?? 0) + gj * ri;
        const jtjRow = jtj[j];
        if (jtjRow === undefined) continue;
        for (let k = j; k < p; k++) {
          jtjRow[k] = (jtjRow[k] ?? 0) + gj * (gradRow[k] ?? 0);
        }
      }
    }
    // Mirror the upper triangle.
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < j; k++) {
        const upper = jtj[k]?.[j];
        const rowJ = jtj[j];
        if (rowJ !== undefined && upper !== undefined) rowJ[k] = upper;
      }
    }

    const damped = jtj.map((row, j) =>
      row.map((v, k) => (j === k ? v + lambda * Math.max(v, 1e-12) : v)),
    );

    const delta = solveLinearSystem(damped, jtr);
    if (delta === null) {
      consecutiveSingular += 1;
      if (consecutiveSingular >= 5) {
        return {
          ok: false,
          status: 'singular',
          message:
            'Normal equations are singular — parameters are likely not identifiable from this data (e.g. all x values identical or redundant parameters)',
        };
      }
      lambda = Math.min(lambda * 8, 1e14);
      continue;
    }
    consecutiveSingular = 0;

    // Trial step, clamped to bounds.
    const trial = params.map((v, j) => {
      const name = parameters[j];
      const stepped = v + (delta[j] ?? 0);
      if (name === undefined) return stepped;
      const clamped = clamp(name, stepped);
      if (clamped !== stepped) boundHits.add(name);
      return clamped;
    });
    if (trial.some((v) => !Number.isFinite(v))) {
      lambda = Math.min(lambda * 8, 1e14);
      continue;
    }

    const stepTiny = trial.every(
      (v, j) =>
        Math.abs(v - (params[j] ?? 0)) <= tolerance * (Math.abs(params[j] ?? 0) + tolerance),
    );

    const trialPoint = evalPoint(trial);
    if (typeof trialPoint === 'string') {
      // Reject steps into non-evaluable territory; keep the last accepted point.
      lambda = Math.min(lambda * 8, 1e14);
      continue;
    }

    if (trialPoint.ssr <= current.ssr) {
      const ssrDrop = current.ssr - trialPoint.ssr;
      params = trial;
      current = trialPoint;
      lambda = Math.max(lambda * 0.3, 1e-14);
      if (ssrDrop <= tolerance * (current.ssr + tolerance) || stepTiny) {
        status = 'converged';
        break;
      }
    } else {
      lambda = Math.min(lambda * 8, 1e14);
      if (stepTiny) {
        // The proposed step is negligible and does not improve SSR: local minimum.
        status = 'converged';
        break;
      }
    }
  }

  // Fit statistics in the original data space.
  const ssr = current.ssr;
  const yMean = mean(y);
  let tss = 0;
  for (const yi of y) tss += (yi - yMean) ** 2;
  let r2: number;
  if (tss === 0) {
    r2 = 0;
    warnings.push({ code: 'zero-variance' });
  } else {
    r2 = 1 - ssr / tss;
  }
  const rmse = Math.sqrt(ssr / n);
  const predicted = [...current.f];
  const residuals = y.map((yi, i) => yi - (predicted[i] ?? Number.NaN));

  for (const name of [...boundHits].sort()) {
    warnings.push({ code: 'bound-hit', name });
  }

  // Asymptotic standard errors from (JᵀJ)⁻¹ · SSR/(n − p), when invertible.
  let standardErrors: Record<string, number> | undefined;
  if (n > p) {
    const jtj: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (let i = 0; i < n; i++) {
      const gradRow = current.jacobian[i];
      if (gradRow === undefined) continue;
      for (let j = 0; j < p; j++) {
        const jtjRow = jtj[j];
        if (jtjRow === undefined) continue;
        for (let k = 0; k < p; k++) {
          jtjRow[k] = (jtjRow[k] ?? 0) + (gradRow[j] ?? 0) * (gradRow[k] ?? 0);
        }
      }
    }
    const variance = ssr / (n - p);
    const errors: Record<string, number> = {};
    let invertible = true;
    for (let j = 0; j < p; j++) {
      const unit = new Array<number>(p).fill(0);
      unit[j] = 1;
      const col = solveLinearSystem(jtj, unit);
      const diag = col?.[j];
      if (col === null || diag === undefined || diag < 0) {
        invertible = false;
        break;
      }
      const name = parameters[j];
      if (name !== undefined) errors[name] = Math.sqrt(diag * variance);
    }
    if (invertible) standardErrors = errors;
  }

  const finalParams = toParamRecord(params);
  const predict = (vars: Record<string, number>): number => {
    const result = evaluate(parsed.rhsAst, { variables: { ...vars, ...finalParams } });
    return toFiniteNumber(result) ?? Number.NaN;
  };

  return {
    ok: true,
    parameters: finalParams,
    ...(standardErrors !== undefined ? { standardErrors } : {}),
    r2,
    rmse,
    residuals,
    predicted,
    iterations,
    status,
    warnings,
    model: parsed,
    predict,
  };
}
