/**
 * Competitive accuracy benchmark — ground-truth problems hand-verified during
 * the July 2026 competitive analysis (vs Wolfram Alpha / Symbolab / GeoGebra),
 * kept as a regression suite. Includes the edge cases where commercial
 * solvers commonly disagree (removable discontinuities, complex branch cuts).
 */
import { describe, expect, it } from 'vitest';
import { Complex } from '../complex/Complex';
import { rungeKutta4 } from '../differential/ode-solvers';
import { Matrix } from '../matrix/Matrix';
import { evaluate } from '../parser/evaluator';
import { parse } from '../parser/parser';
import { solve } from '../solver/solve';
import { mean, stdDev } from '../stats/index';
import { differentiate, simplifyDerivative } from '../symbolic/differentiate';
import { integrate, integrateDefinite } from '../symbolic/integrate';
import { limit } from '../symbolic/limits';
import { convertUnit, createQuantity, findUnit } from '../units/units';

const evalAt = (expr: ReturnType<typeof parse>, x: number): number => {
  const r = evaluate(expr, { variables: { x } });
  if (!r.success) throw r.error;
  return Number(r.value);
};

describe('competitive accuracy benchmark', () => {
  it('01a solves 2x^2 - 3x - 5 = 0 → x = 5/2, -1', () => {
    const sols = solve('2*x^2 - 3*x - 5 = 0')
      .map((s) => Number(s.value))
      .sort((a, b) => a - b);
    expect(sols).toHaveLength(2);
    expect(sols[0]).toBeCloseTo(-1, 9);
    expect(sols[1]).toBeCloseTo(2.5, 9);
  });

  it('01b solves the linear system x+y=5, 2x-y=1 → (2, 3)', () => {
    const x = new Matrix([
      [1, 1],
      [2, -1],
    ])
      .inverse()
      .multiply(new Matrix([[5], [1]]));
    expect(x.get(0, 0)).toBeCloseTo(2, 9);
    expect(x.get(1, 0)).toBeCloseTo(3, 9);
  });

  it('02a differentiates x^3 sin x correctly (verified numerically)', () => {
    const d = simplifyDerivative(differentiate(parse('x^3 * sin(x)'), 'x'));
    for (const p of [0.5, 1.3, -2.1]) {
      expect(evalAt(d, p)).toBeCloseTo(3 * p * p * Math.sin(p) + p ** 3 * Math.cos(p), 8);
    }
  });

  it('02b differentiates ln(x^2+1) correctly (verified numerically)', () => {
    const d = simplifyDerivative(differentiate(parse('log(x^2 + 1)'), 'x'));
    for (const p of [0.5, 1.3, -2.1]) {
      expect(evalAt(d, p)).toBeCloseTo((2 * p) / (p * p + 1), 8);
    }
  });

  it('03a integrates x e^x to (x-1)e^x (verified via fundamental theorem)', () => {
    const F = integrate('x * exp(x)', 'x');
    expect(evalAt(F, 1) - evalAt(F, 0)).toBeCloseTo(1, 6); // ∫₀¹ x eˣ dx = 1
  });

  it('03b evaluates ∫₀¹ x² dx = 1/3', () => {
    const v = integrateDefinite('x^2', 'x', 0, 1);
    const n = typeof v === 'number' ? v : Number.NaN;
    expect(n).toBeCloseTo(1 / 3, 9);
  });

  it('04 computes lim x→0 sin(x)/x = 1', () => {
    expect(Number(limit(parse('sin(x)/x'), 'x', { point: 0 }).value)).toBeCloseTo(1, 9);
  });

  it("05 solves y' = y, y(0) = 1 numerically → e at x = 1", () => {
    const sol = rungeKutta4((_t, y) => (typeof y === 'number' ? y : (y[0] ?? 0)), 0, 1, 1, 0.001);
    const last = sol.points.at(-1);
    expect(last).toBeDefined();
    if (!last) return;
    const yEnd = typeof last.y === 'number' ? last.y : (last.y[0] ?? Number.NaN);
    expect(yEnd).toBeCloseTo(Math.E, 6);
  });

  it('06a det of tridiagonal [[2,1,0],[1,3,1],[0,1,2]] = 8', () => {
    expect(
      new Matrix([
        [2, 1, 0],
        [1, 3, 1],
        [0, 1, 2],
      ]).determinant(),
    ).toBeCloseTo(8, 9);
  });

  it('06b inverts [[2,1],[1,1]] to [[1,-1],[-1,2]]', () => {
    const m = new Matrix([
      [2, 1],
      [1, 1],
    ]).inverse();
    expect(m.get(0, 0)).toBeCloseTo(1, 9);
    expect(m.get(0, 1)).toBeCloseTo(-1, 9);
    expect(m.get(1, 0)).toBeCloseTo(-1, 9);
    expect(m.get(1, 1)).toBeCloseTo(2, 9);
  });

  it('06c finds the dominant eigenvalue 5 of [[4,1],[2,3]]', () => {
    const { eigenvalue } = new Matrix([
      [4, 1],
      [2, 3],
    ]).powerIteration();
    expect(eigenvalue).toBeCloseTo(5, 6);
  });

  it('07 computes mean/population σ/sample s of {2,4,4,4,5,5,7,9}', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(data)).toBeCloseTo(5, 9);
    expect(stdDev(data, false)).toBeCloseTo(2, 9);
    expect(stdDev(data, true)).toBeCloseTo(Math.sqrt(32 / 7), 9);
  });

  it('08 multiplies and divides complex numbers', () => {
    const product = new Complex(3, 4).multiply(new Complex(1, -2));
    expect(product.real).toBeCloseTo(11, 9);
    expect(product.imag).toBeCloseTo(-2, 9);
    const quotient = new Complex(3, 4).divide(new Complex(1, -2));
    expect(quotient.real).toBeCloseTo(-1, 9);
    expect(quotient.imag).toBeCloseTo(2, 9);
  });

  it('09 converts 100 km/h to 250/9 m/s via compound units', () => {
    const target = findUnit('m/s');
    expect(target).not.toBeNull();
    if (!target) return;
    expect(convertUnit(createQuantity(100, 'km/h'), target).value).toBeCloseTo(250 / 9, 6);
  });

  it('EC1 computes the limit through a removable discontinuity: lim x→1 (x²-1)/(x-1) = 2', () => {
    expect(Number(limit(parse('(x^2 - 1)/(x - 1)'), 'x', { point: 1 }).value)).toBeCloseTo(2, 9);
  });

  it('EC3 computes i^i = e^(-π/2) on the principal branch', () => {
    const r = Complex.i.pow(Complex.i);
    expect(r.real).toBeCloseTo(Math.exp(-Math.PI / 2), 10);
    expect(r.imag).toBeCloseTo(0, 10);
  });
});
