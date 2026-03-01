/**
 * Vector Calculus Operations
 *
 * Provides comprehensive vector calculus functionality including:
 * - Gradient (∇f)
 * - Divergence (∇·F)
 * - Curl (∇×F)
 * - Directional derivatives
 * - Line integrals
 * - Surface integrals
 * - Conservative vector fields
 *
 * @module @nextcalc/math-engine/calculus/vector-calculus
 */

import type { ExpressionNode } from '../parser/ast';
import { evaluate } from '../parser/evaluator';

/**
 * 3D Vector representation
 */
export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Vector field function type (takes position, returns vector)
 */
export type VectorField = (point: Vector3D) => Vector3D;

/**
 * Scalar field function type (takes position, returns scalar)
 */
export type ScalarField = (point: Vector3D) => number;

/**
 * Gradient configuration
 */
export interface GradientConfig {
  /** Step size for numerical differentiation (default: 1e-8) */
  readonly h?: number;
  /** Variables to differentiate with respect to */
  readonly variables?: readonly string[];
}

/**
 * Line integral configuration
 */
export interface LineIntegralConfig {
  /** Number of segments for numerical integration */
  readonly segments?: number;
  /** Parameter range [a, b] */
  readonly tRange?: readonly [number, number];
}

/**
 * Computes the gradient of a scalar field ∇f
 *
 * For f(x,y,z), gradient is: (∂f/∂x, ∂f/∂y, ∂f/∂z)
 *
 * @param expr - Scalar expression
 * @param point - Point at which to evaluate gradient
 * @param config - Configuration options
 * @returns Gradient vector
 *
 * @example
 * const expr = parse('x^2 + y^2 + z^2'); // f = x² + y² + z²
 * const grad = gradient(expr, { x: 1, y: 2, z: 3 });
 * // Returns { x: 2, y: 4, z: 6 } (gradient points away from origin)
 */
export function gradient(
  expr: ExpressionNode,
  point: Vector3D,
  config: GradientConfig = {},
): Vector3D {
  const variables = config.variables ?? ['x', 'y', 'z'];
  const h = config.h ?? 1e-8;

  if (variables.length !== 3) {
    throw new Error('Vector calculus: gradient requires exactly 3 variables');
  }

  // Compute partial derivatives numerically
  const partialX = numericalDerivative(expr, variables[0]!, point, h);
  const partialY = numericalDerivative(expr, variables[1]!, point, h);
  const partialZ = numericalDerivative(expr, variables[2]!, point, h);

  return {
    x: partialX,
    y: partialY,
    z: partialZ,
  };
}

/**
 * Computes the divergence of a vector field ∇·F
 *
 * For F = (P, Q, R), divergence is: ∂P/∂x + ∂Q/∂y + ∂R/∂z
 *
 * Physical interpretation: Measures the "outflow" of a vector field
 *
 * @param field - Vector field expressions [P, Q, R]
 * @param point - Point at which to evaluate
 * @param config - Configuration options
 * @returns Divergence (scalar value)
 *
 * @example
 * // Divergence of F = (x, y, z) is 3 everywhere
 * const field = [parse('x'), parse('y'), parse('z')];
 * const div = divergence(field, { x: 1, y: 2, z: 3 });
 * // Returns 3
 */
export function divergence(
  field: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  point: Vector3D,
  config: GradientConfig = {},
): number {
  const variables = config.variables ?? ['x', 'y', 'z'];
  const h = config.h ?? 1e-8;

  const [P, Q, R] = field;

  // ∂P/∂x
  const dPdx = numericalDerivative(P, variables[0]!, point, h);
  // ∂Q/∂y
  const dQdy = numericalDerivative(Q, variables[1]!, point, h);
  // ∂R/∂z
  const dRdz = numericalDerivative(R, variables[2]!, point, h);

  return dPdx + dQdy + dRdz;
}

/**
 * Computes the curl of a vector field ∇×F
 *
 * For F = (P, Q, R), curl is:
 * (∂R/∂y - ∂Q/∂z, ∂P/∂z - ∂R/∂x, ∂Q/∂x - ∂P/∂y)
 *
 * Physical interpretation: Measures the "rotation" of a vector field
 *
 * @param field - Vector field expressions [P, Q, R]
 * @param point - Point at which to evaluate
 * @param config - Configuration options
 * @returns Curl vector
 *
 * @example
 * // Curl of F = (-y, x, 0) is (0, 0, 2) - rotation about z-axis
 * const field = [parse('-y'), parse('x'), parse('0')];
 * const curlF = curl(field, { x: 1, y: 1, z: 0 });
 * // Returns { x: 0, y: 0, z: 2 }
 */
export function curl(
  field: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  point: Vector3D,
  config: GradientConfig = {},
): Vector3D {
  const variables = config.variables ?? ['x', 'y', 'z'];
  const h = config.h ?? 1e-8;

  const [P, Q, R] = field;

  // ∂R/∂y
  const dRdy = numericalPartial(R, variables[1]!, point, h);
  // ∂Q/∂z
  const dQdz = numericalPartial(Q, variables[2]!, point, h);
  // ∂P/∂z
  const dPdz = numericalPartial(P, variables[2]!, point, h);
  // ∂R/∂x
  const dRdx = numericalPartial(R, variables[0]!, point, h);
  // ∂Q/∂x
  const dQdx = numericalPartial(Q, variables[0]!, point, h);
  // ∂P/∂y
  const dPdy = numericalPartial(P, variables[1]!, point, h);

  return {
    x: dRdy - dQdz,
    y: dPdz - dRdx,
    z: dQdx - dPdy,
  };
}

/**
 * Computes the Laplacian of a scalar field ∇²f = ∇·(∇f)
 *
 * For f(x,y,z), Laplacian is: ∂²f/∂x² + ∂²f/∂y² + ∂²f/∂z²
 *
 * @param expr - Scalar expression
 * @param point - Point at which to evaluate
 * @param config - Configuration options
 * @returns Laplacian (scalar value)
 *
 * @example
 * const expr = parse('x^2 + y^2 + z^2');
 * const lap = laplacian(expr, { x: 1, y: 2, z: 3 });
 * // Returns 6 (sum of second derivatives)
 */
export function laplacian(
  expr: ExpressionNode,
  point: Vector3D,
  config: GradientConfig = {},
): number {
  // For second derivatives the optimal step size is h ~ eps^(1/4) ≈ 1e-4
  // (balancing O(h²) truncation error with O(eps/h²) round-off error).
  // The default 1e-8 used for first derivatives causes catastrophic
  // cancellation in the central-difference second-derivative stencil.
  const h = config.h ?? 1e-4;

  // Compute ∂²f/∂x² + ∂²f/∂y² + ∂²f/∂z²
  const d2fdx2 = secondDerivative(expr, 'x', point, h);
  const d2fdy2 = secondDerivative(expr, 'y', point, h);
  const d2fdz2 = secondDerivative(expr, 'z', point, h);

  return d2fdx2 + d2fdy2 + d2fdz2;
}

/**
 * Computes directional derivative of f in direction of vector u
 *
 * D_u f = ∇f · û (where û is unit vector)
 *
 * @param expr - Scalar expression
 * @param point - Point at which to evaluate
 * @param direction - Direction vector (will be normalized)
 * @param config - Configuration options
 * @returns Directional derivative
 *
 * @example
 * const expr = parse('x^2 + y^2');
 * const dir = { x: 1, y: 1, z: 0 }; // Northeast direction
 * const Duf = directionalDerivative(expr, { x: 1, y: 1, z: 0 }, dir);
 */
export function directionalDerivative(
  expr: ExpressionNode,
  point: Vector3D,
  direction: Vector3D,
  config: GradientConfig = {},
): number {
  // Normalize direction vector
  const magnitude = Math.sqrt(
    direction.x * direction.x + direction.y * direction.y + direction.z * direction.z,
  );

  if (magnitude === 0) {
    throw new Error('Vector calculus: direction vector cannot be zero');
  }

  const unitDir: Vector3D = {
    x: direction.x / magnitude,
    y: direction.y / magnitude,
    z: direction.z / magnitude,
  };

  // Compute gradient
  const grad = gradient(expr, point, config);

  // Dot product: ∇f · û
  return grad.x * unitDir.x + grad.y * unitDir.y + grad.z * unitDir.z;
}

/**
 * Computes line integral of vector field along a curve
 *
 * ∫_C F · dr = ∫_a^b F(r(t)) · r'(t) dt
 *
 * @param field - Vector field [P, Q, R]
 * @param curve - Parametric curve r(t) = (x(t), y(t), z(t))
 * @param config - Configuration options
 * @returns Line integral value
 *
 * @example
 * // Integrate F = (y, -x, 0) along circle x = cos(t), y = sin(t)
 * const field = [parse('y'), parse('-x'), parse('0')];
 * const curve = [parse('cos(t)'), parse('sin(t)'), parse('0')];
 * const result = lineIntegral(field, curve, { tRange: [0, 2 * Math.PI] });
 * // Returns -2π (circulation around unit circle)
 */
export function lineIntegral(
  field: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  curve: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  config: LineIntegralConfig = {},
): number {
  const segments = config.segments ?? 1000;
  const [a, b] = config.tRange ?? [0, 1];

  const dt = (b - a) / segments;
  let integral = 0;

  for (let i = 0; i < segments; i++) {
    const t = a + i * dt;
    const tNext = t + dt;

    // Evaluate curve at t
    const r = evaluateParametricCurve(curve, t);
    const rNext = evaluateParametricCurve(curve, tNext);

    // Compute dr = r(t+dt) - r(t)
    const dr: Vector3D = {
      x: rNext.x - r.x,
      y: rNext.y - r.y,
      z: rNext.z - r.z,
    };

    // Evaluate field at r(t)
    const F = evaluateVectorField(field, r);

    // F · dr
    const dotProduct = F.x * dr.x + F.y * dr.y + F.z * dr.z;

    integral += dotProduct;
  }

  return integral;
}

/**
 * Checks if a vector field is conservative
 *
 * A field F is conservative if ∇×F = 0 (curl is zero everywhere)
 *
 * @param field - Vector field [P, Q, R]
 * @param testPoints - Points to test (default: sample grid)
 * @param tolerance - Maximum allowed curl magnitude
 * @returns True if field is conservative
 *
 * @example
 * // F = (y, x, 0) has curl (0, 0, 0), so it's conservative
 * const field = [parse('y'), parse('x'), parse('0')];
 * const isConservative = isConservativeField(field);
 * // Returns true
 */
export function isConservativeField(
  field: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  testPoints?: readonly Vector3D[],
  tolerance = 1e-6,
): boolean {
  // Default test points: sample a grid
  const points = testPoints ?? generateTestGrid();

  for (const point of points) {
    const curlF = curl(field, point);
    const curlMagnitude = Math.sqrt(curlF.x * curlF.x + curlF.y * curlF.y + curlF.z * curlF.z);

    if (curlMagnitude > tolerance) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Numerical partial derivative using central difference
 */
function numericalDerivative(
  expr: ExpressionNode,
  variable: string,
  point: Vector3D,
  h: number,
): number {
  const pointRecord: Record<string, number> = {
    x: point.x,
    y: point.y,
    z: point.z,
  };
  const baseValue = pointRecord[variable]!;

  // f(x + h)
  const varsPlus: Record<string, number> = { x: point.x, y: point.y, z: point.z };
  varsPlus[variable] = baseValue + h;
  const fPlus = evaluate(expr, { variables: varsPlus });

  // f(x - h)
  const varsMinus: Record<string, number> = { x: point.x, y: point.y, z: point.z };
  varsMinus[variable] = baseValue - h;
  const fMinus = evaluate(expr, { variables: varsMinus });

  if (!fPlus.success || !fMinus.success) {
    throw new Error('Vector calculus: failed to evaluate expression');
  }

  // Central difference: (f(x+h) - f(x-h)) / (2h)
  return (Number(fPlus.value) - Number(fMinus.value)) / (2 * h);
}

/**
 * Numerical partial derivative (wrapper for clarity)
 */
function numericalPartial(
  expr: ExpressionNode,
  variable: string,
  point: Vector3D,
  h: number,
): number {
  return numericalDerivative(expr, variable, point, h);
}

/**
 * Second derivative using central difference
 */
function secondDerivative(
  expr: ExpressionNode,
  variable: string,
  point: Vector3D,
  h: number,
): number {
  const pointRecord: Record<string, number> = {
    x: point.x,
    y: point.y,
    z: point.z,
  };
  const baseValue = pointRecord[variable]!;

  // f(x)
  const vars0: Record<string, number> = { x: point.x, y: point.y, z: point.z };
  const f0Result = evaluate(expr, { variables: vars0 });
  if (!f0Result.success) {
    throw new Error('Vector calculus: failed to evaluate expression');
  }
  const f0 = Number(f0Result.value);

  // f(x + h)
  const varsPlus: Record<string, number> = { x: point.x, y: point.y, z: point.z };
  varsPlus[variable] = baseValue + h;
  const fPlusResult = evaluate(expr, { variables: varsPlus });
  if (!fPlusResult.success) {
    throw new Error('Vector calculus: failed to evaluate expression');
  }
  const fPlus = Number(fPlusResult.value);

  // f(x - h)
  const varsMinus: Record<string, number> = { x: point.x, y: point.y, z: point.z };
  varsMinus[variable] = baseValue - h;
  const fMinusResult = evaluate(expr, { variables: varsMinus });
  if (!fMinusResult.success) {
    throw new Error('Vector calculus: failed to evaluate expression');
  }
  const fMinus = Number(fMinusResult.value);

  // Second derivative: (f(x+h) - 2f(x) + f(x-h)) / h²
  return (fPlus - 2 * f0 + fMinus) / (h * h);
}

/**
 * Evaluate parametric curve at parameter t
 */
function evaluateParametricCurve(
  curve: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  t: number,
): Vector3D {
  const [xExpr, yExpr, zExpr] = curve;

  const xResult = evaluate(xExpr, { variables: { t } });
  const yResult = evaluate(yExpr, { variables: { t } });
  const zResult = evaluate(zExpr, { variables: { t } });

  if (!xResult.success || !yResult.success || !zResult.success) {
    throw new Error('Vector calculus: failed to evaluate parametric curve');
  }

  return {
    x: Number(xResult.value),
    y: Number(yResult.value),
    z: Number(zResult.value),
  };
}

/**
 * Evaluate vector field at a point
 */
function evaluateVectorField(
  field: readonly [ExpressionNode, ExpressionNode, ExpressionNode],
  point: Vector3D,
): Vector3D {
  const [PExpr, QExpr, RExpr] = field;

  const vars = { x: point.x, y: point.y, z: point.z };

  const PResult = evaluate(PExpr, { variables: vars });
  const QResult = evaluate(QExpr, { variables: vars });
  const RResult = evaluate(RExpr, { variables: vars });

  if (!PResult.success || !QResult.success || !RResult.success) {
    throw new Error('Vector calculus: failed to evaluate vector field');
  }

  return {
    x: Number(PResult.value),
    y: Number(QResult.value),
    z: Number(RResult.value),
  };
}

/**
 * Generate a grid of test points
 */
function generateTestGrid(): Vector3D[] {
  const points: Vector3D[] = [];
  const range = [-2, -1, 0, 1, 2];

  for (const x of range) {
    for (const y of range) {
      for (const z of range) {
        points.push({ x, y, z });
      }
    }
  }

  return points;
}

/**
 * Utility: Dot product of two vectors
 */
export function dotProduct(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Utility: Cross product of two vectors
 */
export function crossProduct(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Utility: Vector magnitude
 */
export function magnitude(v: Vector3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Utility: Normalize vector to unit length
 */
export function normalize(v: Vector3D): Vector3D {
  const mag = magnitude(v);
  if (mag === 0) {
    throw new Error('Cannot normalize zero vector');
  }
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag,
  };
}
