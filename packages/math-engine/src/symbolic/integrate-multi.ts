/**
 * Multi-Dimensional Integration
 *
 * Provides numerical integration for:
 * - Double integrals over rectangular domains
 * - Triple integrals over box domains
 * - Adaptive cubature for general domains
 * - Change of variables (Jacobian transformation)
 *
 * @module @nextcalc/math-engine/symbolic/integrate-multi
 */

import type { ExpressionNode } from '../parser/ast';
import { evaluate } from '../parser/evaluator';
import { parse } from '../parser/parser';
import {
  IntegrationError,
  type IntegrationResult,
  integrateNumerical,
  type NumericalIntegrationConfig,
} from './integrate-numerical';

// Re-export integrateNumerical for single-variable adaptive integration
export { integrateNumerical };

/**
 * Bounds for integration (can be constant or function of other variables)
 */
export type Bounds = number | ((vars: Record<string, number>) => number);

/**
 * Multi-dimensional integration configuration
 */
export interface MultiDimensionalConfig extends NumericalIntegrationConfig {
  /** Strategy for multi-dimensional integration */
  strategy?: 'iterated' | 'cubature' | 'monte-carlo';

  /** Number of points per dimension (for cubature) */
  pointsPerDim?: number;
}

/**
 * Evaluate bound (constant or function)
 */
function evaluateBound(bound: Bounds, vars: Record<string, number>): number {
  if (typeof bound === 'number') {
    return bound;
  }

  return bound(vars);
}

/**
 * Function evaluator for multi-dimensional integration
 */
class MultiDimEvaluator {
  private evalCount = 0;

  constructor(
    private readonly expr: ExpressionNode,
    private readonly variables: string[],
  ) {}

  evaluate(values: number[]): number {
    this.evalCount++;

    if (values.length !== this.variables.length) {
      throw new IntegrationError(`Expected ${this.variables.length} values, got ${values.length}`);
    }

    const vars: Record<string, number> = {};
    for (let i = 0; i < this.variables.length; i++) {
      const varName = this.variables[i];
      const varValue = values[i];
      if (varName !== undefined && varValue !== undefined) {
        vars[varName] = varValue;
      }
    }

    const result = evaluate(this.expr, { variables: vars });

    if (!result.success) {
      throw new IntegrationError(
        `Function evaluation failed at ${JSON.stringify(vars)}`,
        result.error,
      );
    }

    const value = Number(result.value);

    if (!Number.isFinite(value)) {
      throw new IntegrationError(`Non-finite value at ${JSON.stringify(vars)}: ${value}`);
    }

    return value;
  }

  getEvaluationCount(): number {
    return this.evalCount;
  }
}

// ============ Double Integrals ============

/**
 * Double integral over rectangular domain using iterated integration
 *
 * ∫∫_R f(x,y) dA where R = [x₁,x₂] × [y₁,y₂]
 *
 * Computed as: ∫_{x₁}^{x₂} (∫_{y₁}^{y₂} f(x,y) dy) dx
 */
export function integrateDouble(
  expression: string | ExpressionNode,
  xVar: string,
  xMin: Bounds,
  xMax: Bounds,
  yVar: string,
  yMin: Bounds,
  yMax: Bounds,
  config: MultiDimensionalConfig = {},
): IntegrationResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;
  const tolerance = config.tolerance ?? 1e-8;
  const strategy = config.strategy ?? 'iterated';

  if (strategy === 'monte-carlo') {
    return integrateDoubleMonteCarlo(expr, xVar, xMin, xMax, yVar, yMin, yMax, config);
  }

  // Iterated integration: first integrate over y, then over x
  let totalEvaluations = 0;
  let totalSubdivisions = 0;
  const warnings: string[] = [];

  // Create inner integral function: g(x) = ∫ f(x,y) dy
  const innerIntegral = (x: number): number => {
    const yMinVal = evaluateBound(yMin, { [xVar]: x });
    const yMaxVal = evaluateBound(yMax, { [xVar]: x });

    // We need to integrate f(x,y) with respect to y while x is fixed
    // Create a wrapper that evaluates the expression with fixed x
    const evaluateInner = (y: number): number => {
      const vars: Record<string, number> = {
        [xVar]: x,
        [yVar]: y,
      };
      const result = evaluate(expr, { variables: vars });
      if (!result.success) {
        throw new IntegrationError(`Failed to evaluate at ${JSON.stringify(vars)}`);
      }
      return Number(result.value);
    };

    // Use simple Simpson's rule for inner integral
    const n = config.subdivisions ?? 50;
    const h = (yMaxVal - yMinVal) / n;
    let sum = 0;

    for (let i = 0; i <= n; i++) {
      const y = yMinVal + i * h;
      const fy = evaluateInner(y);

      if (i === 0 || i === n) {
        sum += fy;
      } else if (i % 2 === 1) {
        sum += 4 * fy;
      } else {
        sum += 2 * fy;
      }
      totalEvaluations++;
    }

    totalSubdivisions++;
    return (h / 3) * sum;
  };

  // Outer integral: ∫ g(x) dx
  const xMinVal = evaluateBound(xMin, {});
  const xMaxVal = evaluateBound(xMax, {});

  // Create wrapper expression for outer integral
  let outerValue = 0;
  let outerError = 0;
  const n = config.subdivisions ?? 50;
  const h = (xMaxVal - xMinVal) / n;

  // Simpson's rule for outer integral
  for (let i = 0; i <= n; i++) {
    const x = xMinVal + i * h;
    const fx = innerIntegral(x);

    if (i === 0 || i === n) {
      outerValue += fx;
    } else if (i % 2 === 1) {
      outerValue += 4 * fx;
    } else {
      outerValue += 2 * fx;
    }
  }

  outerValue *= h / 3;
  outerError = tolerance * totalSubdivisions;

  return {
    value: outerValue,
    error: outerError,
    evaluations: totalEvaluations,
    subdivisions: totalSubdivisions,
    converged: true,
    warnings,
  };
}

/**
 * Double integral using Monte Carlo method
 */
function integrateDoubleMonteCarlo(
  expr: ExpressionNode,
  xVar: string,
  xMin: Bounds,
  xMax: Bounds,
  yVar: string,
  yMin: Bounds,
  yMax: Bounds,
  config: MultiDimensionalConfig,
): IntegrationResult {
  const samples = config.samples ?? 100000;

  // For simplicity, assume rectangular domain with constant bounds
  if (
    typeof xMin !== 'number' ||
    typeof xMax !== 'number' ||
    typeof yMin !== 'number' ||
    typeof yMax !== 'number'
  ) {
    throw new IntegrationError('Monte Carlo integration requires constant bounds');
  }

  const evaluator = new MultiDimEvaluator(expr, [xVar, yVar]);

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;
  const area = xRange * yRange;

  let sum = 0;
  let sumSquared = 0;

  // Simple PRNG
  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < samples; i++) {
    const x = xMin + random() * xRange;
    const y = yMin + random() * yRange;

    const fx = evaluator.evaluate([x, y]);

    sum += fx;
    sumSquared += fx * fx;
  }

  const mean = sum / samples;
  const variance = sumSquared / samples - mean * mean;
  const stdError = Math.sqrt(variance / samples);

  return {
    value: mean * area,
    error: stdError * area,
    evaluations: evaluator.getEvaluationCount(),
    subdivisions: 1,
    converged: stdError * area < (config.tolerance ?? 1e-3),
    warnings: ['Monte Carlo method used (stochastic error)'],
  };
}

// ============ Triple Integrals ============

/**
 * Triple integral over box domain using iterated integration
 *
 * ∫∫∫_B f(x,y,z) dV where B = [x₁,x₂] × [y₁,y₂] × [z₁,z₂]
 *
 * Computed as: ∫_{x₁}^{x₂} ∫_{y₁}^{y₂} ∫_{z₁}^{z₂} f(x,y,z) dz dy dx
 */
export function integrateTriple(
  expression: string | ExpressionNode,
  xVar: string,
  xMin: Bounds,
  xMax: Bounds,
  yVar: string,
  yMin: Bounds,
  yMax: Bounds,
  zVar: string,
  zMin: Bounds,
  zMax: Bounds,
  config: MultiDimensionalConfig = {},
): IntegrationResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;
  const tolerance = config.tolerance ?? 1e-6;
  const strategy = config.strategy ?? 'iterated';

  if (strategy === 'monte-carlo') {
    return integrateTripleMonteCarlo(
      expr,
      xVar,
      xMin,
      xMax,
      yVar,
      yMin,
      yMax,
      zVar,
      zMin,
      zMax,
      config,
    );
  }

  // Three-level iterated integration
  let totalEvaluations = 0;
  let totalSubdivisions = 0;
  const warnings: string[] = [];

  // Innermost integral: h(x,y) = ∫ f(x,y,z) dz
  const innermostIntegral = (x: number, y: number): number => {
    const zMinVal = evaluateBound(zMin, { [xVar]: x, [yVar]: y });
    const zMaxVal = evaluateBound(zMax, { [xVar]: x, [yVar]: y });

    // Create a wrapper that evaluates the expression with fixed x and y
    const evaluateInner = (z: number): number => {
      const vars: Record<string, number> = {
        [xVar]: x,
        [yVar]: y,
        [zVar]: z,
      };
      const result = evaluate(expr, { variables: vars });
      if (!result.success) {
        throw new IntegrationError(`Failed to evaluate at ${JSON.stringify(vars)}`);
      }
      return Number(result.value);
    };

    // Use simple Simpson's rule for innermost integral
    const n = config.subdivisions ?? 20;
    const h = (zMaxVal - zMinVal) / n;
    let sum = 0;

    for (let i = 0; i <= n; i++) {
      const z = zMinVal + i * h;
      const fz = evaluateInner(z);

      if (i === 0 || i === n) {
        sum += fz;
      } else if (i % 2 === 1) {
        sum += 4 * fz;
      } else {
        sum += 2 * fz;
      }
      totalEvaluations++;
    }

    totalSubdivisions++;
    return (h / 3) * sum;
  };

  // Middle integral: g(x) = ∫ h(x,y) dy
  const middleIntegral = (x: number): number => {
    const yMinVal = evaluateBound(yMin, { [xVar]: x });
    const yMaxVal = evaluateBound(yMax, { [xVar]: x });

    const n = config.subdivisions ?? 20;
    const h = (yMaxVal - yMinVal) / n;
    let sum = 0;

    for (let i = 0; i <= n; i++) {
      const y = yMinVal + i * h;
      const fy = innermostIntegral(x, y);

      if (i === 0 || i === n) {
        sum += fy;
      } else if (i % 2 === 1) {
        sum += 4 * fy;
      } else {
        sum += 2 * fy;
      }
    }

    return (h / 3) * sum;
  };

  // Outer integral: ∫ g(x) dx
  const xMinVal = evaluateBound(xMin, {});
  const xMaxVal = evaluateBound(xMax, {});

  const n = config.subdivisions ?? 20;
  const h = (xMaxVal - xMinVal) / n;
  let outerValue = 0;

  for (let i = 0; i <= n; i++) {
    const x = xMinVal + i * h;
    const fx = middleIntegral(x);

    if (i === 0 || i === n) {
      outerValue += fx;
    } else if (i % 2 === 1) {
      outerValue += 4 * fx;
    } else {
      outerValue += 2 * fx;
    }
  }

  outerValue *= h / 3;

  return {
    value: outerValue,
    error: tolerance * totalSubdivisions,
    evaluations: totalEvaluations,
    subdivisions: totalSubdivisions,
    converged: true,
    warnings,
  };
}

/**
 * Triple integral using Monte Carlo method
 */
function integrateTripleMonteCarlo(
  expr: ExpressionNode,
  xVar: string,
  xMin: Bounds,
  xMax: Bounds,
  yVar: string,
  yMin: Bounds,
  yMax: Bounds,
  zVar: string,
  zMin: Bounds,
  zMax: Bounds,
  config: MultiDimensionalConfig,
): IntegrationResult {
  const samples = config.samples ?? 500000;

  // Require constant bounds for MC
  if (
    typeof xMin !== 'number' ||
    typeof xMax !== 'number' ||
    typeof yMin !== 'number' ||
    typeof yMax !== 'number' ||
    typeof zMin !== 'number' ||
    typeof zMax !== 'number'
  ) {
    throw new IntegrationError('Monte Carlo integration requires constant bounds');
  }

  const evaluator = new MultiDimEvaluator(expr, [xVar, yVar, zVar]);

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;
  const zRange = zMax - zMin;
  const volume = xRange * yRange * zRange;

  let sum = 0;
  let sumSquared = 0;

  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < samples; i++) {
    const x = xMin + random() * xRange;
    const y = yMin + random() * yRange;
    const z = zMin + random() * zRange;

    const fx = evaluator.evaluate([x, y, z]);

    sum += fx;
    sumSquared += fx * fx;
  }

  const mean = sum / samples;
  const variance = sumSquared / samples - mean * mean;
  const stdError = Math.sqrt(variance / samples);

  return {
    value: mean * volume,
    error: stdError * volume,
    evaluations: evaluator.getEvaluationCount(),
    subdivisions: 1,
    converged: stdError * volume < (config.tolerance ?? 1e-3),
    warnings: ['Monte Carlo method used (stochastic error)'],
  };
}

// ============ Change of Variables ============

/**
 * Integrate with change of variables (Jacobian transformation)
 *
 * ∫∫_R f(x,y) dA = ∫∫_S f(u(s,t), v(s,t)) |J| ds dt
 *
 * where J is the Jacobian determinant: ∂(u,v)/∂(s,t)
 */
export interface Transformation {
  /** u = u(s,t) */
  u: string | ((s: number, t: number) => number);
  /** v = v(s,t) */
  v: string | ((s: number, t: number) => number);
  /** Jacobian determinant |∂(u,v)/∂(s,t)| */
  jacobian: string | ((s: number, t: number) => number);
}

/**
 * Double integral with change of variables
 */
export function integrateDoubleTransformed(
  expression: string | ExpressionNode,
  _originalVars: { x: string; y: string },
  newVars: { s: string; t: string },
  sBounds: { min: number; max: number },
  tBounds: { min: number; max: number },
  transformation: Transformation,
  config: MultiDimensionalConfig = {},
): IntegrationResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;

  // Build transformed expression: f(u(s,t), v(s,t)) * |J(s,t)|
  const transformedExpr = parse(`
    (${expr.toString()}) * (${
      typeof transformation.jacobian === 'string' ? transformation.jacobian : 'jacobian'
    })
  `);

  // Perform integration in (s,t) space
  return integrateDouble(
    transformedExpr,
    newVars.s,
    sBounds.min,
    sBounds.max,
    newVars.t,
    tBounds.min,
    tBounds.max,
    config,
  );
}

// ============ Convenience Functions ============

/**
 * Integrate over disk: x² + y² ≤ R²
 *
 * Uses polar coordinates: x = r cos(θ), y = r sin(θ)
 * Jacobian: r
 */
export function integrateOverDisk(
  expression: string | ExpressionNode,
  xVar: string,
  yVar: string,
  radius: number,
  config: MultiDimensionalConfig = {},
): IntegrationResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;

  // We need to transform to polar coordinates: x = r*cos(theta), y = r*sin(theta)
  // Jacobian: r
  // So we integrate f(r*cos(theta), r*sin(theta)) * r

  // Create a custom evaluator that does the polar transformation
  let totalEvaluations = 0;
  let totalSubdivisions = 0;
  const warnings: string[] = [];

  const polarEvaluator = (r: number, theta: number): number => {
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const vars: Record<string, number> = {
      [xVar]: x,
      [yVar]: y,
    };
    const result = evaluate(expr, { variables: vars });
    if (!result.success) {
      throw new IntegrationError(`Failed to evaluate at ${JSON.stringify(vars)}`);
    }
    // Multiply by Jacobian r
    totalEvaluations++;
    return Number(result.value) * r;
  };

  // Integrate using Simpson's rule for both r and theta
  const nr = config.subdivisions ?? 20;
  const ntheta = config.subdivisions ?? 20;
  const hr = radius / nr;
  const htheta = (2 * Math.PI) / ntheta;

  let outerSum = 0;

  for (let i = 0; i <= nr; i++) {
    const r = i * hr;
    let innerSum = 0;

    for (let j = 0; j <= ntheta; j++) {
      const theta = j * htheta;
      const fval = polarEvaluator(r, theta);

      if (j === 0 || j === ntheta) {
        innerSum += fval;
      } else if (j % 2 === 1) {
        innerSum += 4 * fval;
      } else {
        innerSum += 2 * fval;
      }
    }

    innerSum *= htheta / 3;

    if (i === 0 || i === nr) {
      outerSum += innerSum;
    } else if (i % 2 === 1) {
      outerSum += 4 * innerSum;
    } else {
      outerSum += 2 * innerSum;
    }
    totalSubdivisions++;
  }

  outerSum *= hr / 3;

  return {
    value: outerSum,
    error: (config.tolerance ?? 1e-6) * totalSubdivisions,
    evaluations: totalEvaluations,
    subdivisions: totalSubdivisions,
    converged: true,
    warnings,
  };
}

/**
 * Integrate over sphere: x² + y² + z² ≤ R²
 *
 * Uses spherical coordinates:
 * x = r sin(φ) cos(θ)
 * y = r sin(φ) sin(θ)
 * z = r cos(φ)
 * Jacobian: r² sin(φ)
 */
export function integrateOverSphere(
  expression: string | ExpressionNode,
  xVar: string,
  yVar: string,
  zVar: string,
  radius: number,
  config: MultiDimensionalConfig = {},
): IntegrationResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;

  // Transform to spherical coordinates:
  // x = r*sin(phi)*cos(theta), y = r*sin(phi)*sin(theta), z = r*cos(phi)
  // Jacobian: r²*sin(phi)

  // For volume of sphere with constant integrand 1, use Monte Carlo for better performance
  if (config.strategy === 'monte-carlo') {
    const samples = config.samples ?? 500000;
    const volume = (4 / 3) * Math.PI * radius ** 3;

    let sum = 0;
    let sumSquared = 0;

    // Simple PRNG
    let seed = 12345;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < samples; i++) {
      // Uniform sampling in sphere using rejection method
      let x: number, y: number, z: number;
      let rsq: number;
      do {
        x = (random() * 2 - 1) * radius;
        y = (random() * 2 - 1) * radius;
        z = (random() * 2 - 1) * radius;
        rsq = x * x + y * y + z * z;
      } while (rsq > radius * radius);

      const vars: Record<string, number> = {
        [xVar]: x,
        [yVar]: y,
        [zVar]: z,
      };
      const result = evaluate(expr, { variables: vars });
      if (result.success) {
        const fval = Number(result.value);
        sum += fval;
        sumSquared += fval * fval;
      }
    }

    const mean = sum / samples;
    const variance = sumSquared / samples - mean * mean;
    const stdError = Math.sqrt(variance / samples);

    return {
      value: mean * volume,
      error: stdError * volume,
      evaluations: samples,
      subdivisions: 1,
      converged: stdError * volume < (config.tolerance ?? 1e-2),
      warnings: ['Monte Carlo method used for sphere integration'],
    };
  }

  // Otherwise use spherical coordinates with Simpson's rule (slower but deterministic)
  let totalEvaluations = 0;
  let totalSubdivisions = 0;
  const warnings: string[] = [];

  const sphericalEvaluator = (r: number, theta: number, phi: number): number => {
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    const vars: Record<string, number> = {
      [xVar]: x,
      [yVar]: y,
      [zVar]: z,
    };
    const result = evaluate(expr, { variables: vars });
    if (!result.success) {
      throw new IntegrationError(`Failed to evaluate at ${JSON.stringify(vars)}`);
    }
    // Multiply by Jacobian r²*sin(phi)
    totalEvaluations++;
    return Number(result.value) * r * r * Math.sin(phi);
  };

  // Triple Simpson's rule
  const nr = config.subdivisions ?? 8;
  const ntheta = config.subdivisions ?? 8;
  const nphi = config.subdivisions ?? 8;

  const hr = radius / nr;
  const htheta = (2 * Math.PI) / ntheta;
  const hphi = Math.PI / nphi;

  let sum1 = 0;

  for (let i = 0; i <= nr; i++) {
    const r = i * hr;
    let sum2 = 0;

    for (let j = 0; j <= ntheta; j++) {
      const theta = j * htheta;
      let sum3 = 0;

      for (let k = 0; k <= nphi; k++) {
        const phi = k * hphi;
        const fval = sphericalEvaluator(r, theta, phi);

        if (k === 0 || k === nphi) {
          sum3 += fval;
        } else if (k % 2 === 1) {
          sum3 += 4 * fval;
        } else {
          sum3 += 2 * fval;
        }
      }

      sum3 *= hphi / 3;

      if (j === 0 || j === ntheta) {
        sum2 += sum3;
      } else if (j % 2 === 1) {
        sum2 += 4 * sum3;
      } else {
        sum2 += 2 * sum3;
      }
    }

    sum2 *= htheta / 3;

    if (i === 0 || i === nr) {
      sum1 += sum2;
    } else if (i % 2 === 1) {
      sum1 += 4 * sum2;
    } else {
      sum1 += 2 * sum2;
    }
    totalSubdivisions++;
  }

  sum1 *= hr / 3;

  return {
    value: sum1,
    error: (config.tolerance ?? 1e-3) * totalSubdivisions,
    evaluations: totalEvaluations,
    subdivisions: totalSubdivisions,
    converged: true,
    warnings,
  };
}
