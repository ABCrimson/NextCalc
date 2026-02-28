/**
 * Tests for ODE and PDE solvers
 */

import { describe, it, expect } from 'vitest';

import {
  eulerMethod,
  improvedEuler,
  rungeKutta4,
  adaptiveRK4,
  solveExponentialGrowth,
  solveHarmonicOscillator,
  solveLogisticGrowth,
  solvePredatorPrey,
} from './ode-solvers';

import {
  solveHeatEquationExplicit,
  solveHeatEquationImplicit,
  solveWaveEquation,
  solveLaplaceEquation,
  solveLaplaceEquationGaussSeidel,
  solvePoissonEquation,
  exportSolutionToString,
} from './pde-solvers';

// ============================================================================
// ODE SOLVERS
// ============================================================================

describe('eulerMethod - basic structure', () => {
  it('returns an ODESolution with correct method name', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const sol = eulerMethod(f, 0, 1, 1, 0.1);
    expect(sol.method).toBe('Euler');
    expect(sol.stepSize).toBe(0.1);
    expect(sol.steps).toBeGreaterThan(0);
  });

  it('first point is the initial condition', () => {
    const f = (_t: number, _y: number | readonly number[]) => 0;
    const sol = eulerMethod(f, 0, 5, 1, 0.25);
    expect(sol.points[0]!.t).toBe(0);
    expect(sol.points[0]!.y).toBe(5);
  });

  it('constant ODE (y\' = 0) keeps y constant', () => {
    const f = (_t: number, _y: number | readonly number[]) => 0;
    const sol = eulerMethod(f, 0, 42, 1, 0.1);
    for (const pt of sol.points) {
      expect(pt.y as number).toBeCloseTo(42, 10);
    }
  });

  it('produces the right number of steps', () => {
    const f = (_t: number, y: number | readonly number[]) => -(y as number);
    const sol = eulerMethod(f, 0, 1, 1, 0.1);
    // numSteps = ceil((1-0)/0.1) = 10, so 11 points
    expect(sol.points.length).toBe(sol.steps + 1);
  });

  it('approximates exponential decay y\' = -y with acceptable error', () => {
    const f = (_t: number, y: number | readonly number[]) => -(y as number);
    const sol = eulerMethod(f, 0, 1, 1, 0.01);
    const last = sol.points[sol.points.length - 1]!;
    const expected = Math.exp(-1); // ~0.3679
    // Euler is first-order; 1% step -> ~1% error
    expect(last.y as number).toBeCloseTo(expected, 1);
  });
});

describe('improvedEuler (Heun) - accuracy', () => {
  it('returns Improved Euler method name', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const sol = improvedEuler(f, 0, 1, 1, 0.1);
    expect(sol.method).toBe('Improved Euler (Heun)');
  });

  it('first point is the initial condition', () => {
    const f = (_t: number, _y: number | readonly number[]) => 0;
    const sol = improvedEuler(f, 0, 7, 1, 0.25);
    expect(sol.points[0]!.y).toBe(7);
  });

  it('constant ODE stays constant', () => {
    const f = (_t: number, _y: number | readonly number[]) => 0;
    const sol = improvedEuler(f, 0, 3, 1, 0.1);
    for (const pt of sol.points) {
      expect(pt.y as number).toBeCloseTo(3, 10);
    }
  });

  it('is more accurate than Euler for exponential growth', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number; // y' = y -> y = e^t
    const h = 0.1;
    const eulerSol = eulerMethod(f, 0, 1, 1, h);
    const heunSol = improvedEuler(f, 0, 1, 1, h);

    const expected = Math.E; // e^1
    const eulerFinal = eulerSol.points[eulerSol.points.length - 1]!.y as number;
    const heunFinal = heunSol.points[heunSol.points.length - 1]!.y as number;

    const eulerErr = Math.abs(eulerFinal - expected);
    const heunErr = Math.abs(heunFinal - expected);

    expect(heunErr).toBeLessThan(eulerErr);
  });
});

describe('rungeKutta4 - scalar', () => {
  it('returns Runge-Kutta 4 method name', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const sol = rungeKutta4(f, 0, 1, 1, 0.1);
    expect(sol.method).toBe('Runge-Kutta 4');
  });

  it('first point is the initial condition', () => {
    const f = (_t: number, _y: number | readonly number[]) => 1;
    const sol = rungeKutta4(f, 0, 0, 1, 0.25);
    expect(sol.points[0]!.t).toBe(0);
    expect(sol.points[0]!.y).toBe(0);
  });

  it('solves y\' = y exactly with RK4 precision', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const sol = rungeKutta4(f, 0, 1, 2, 0.01);
    const last = sol.points[sol.points.length - 1]!;
    expect(last.y as number).toBeCloseTo(Math.exp(2), 4);
  });

  it('solves constant ODE y\' = c accurately', () => {
    const c = 3;
    const f = (_t: number, _y: number | readonly number[]) => c;
    const sol = rungeKutta4(f, 0, 0, 2, 0.1);
    const last = sol.points[sol.points.length - 1]!;
    // y = c*t, so at t=2, y=6
    expect(last.y as number).toBeCloseTo(6, 5);
  });

  it('solves y\' = -y with RK4 precision', () => {
    const f = (_t: number, y: number | readonly number[]) => -(y as number);
    const sol = rungeKutta4(f, 0, 1, 1, 0.01);
    const last = sol.points[sol.points.length - 1]!;
    expect(last.y as number).toBeCloseTo(Math.exp(-1), 5);
  });
});

describe('rungeKutta4 - vector', () => {
  it('solves a 2-component system', () => {
    // Coupled system: y1' = y2, y2' = -y1 (harmonic oscillator y'' = -y)
    // Exact: y1 = cos(t), y2 = -sin(t)  with IC [1, 0]
    const f = (_t: number, y: number | readonly number[]) => {
      const arr = y as readonly number[];
      return [arr[1]!, -arr[0]!];
    };
    // Use stepSize = Math.PI / 100 so the final step lands exactly at t = Math.PI
    const sol = rungeKutta4(f, 0, [1, 0], Math.PI, Math.PI / 100);
    const last = sol.points[sol.points.length - 1]!;
    const yVec = last.y as readonly number[];
    // At t = pi: cos(pi) = -1, -sin(pi) = 0 (RK4 is accurate to ~4 decimal places)
    expect(yVec[0]!).toBeCloseTo(-1, 3);
    expect(yVec[1]!).toBeCloseTo(0, 2);
  });
});

describe('adaptiveRK4', () => {
  it('returns Adaptive RK4 method name', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const sol = adaptiveRK4(f, 0, 1, 1);
    expect(sol.method).toBe('Adaptive RK4');
  });

  it('first point is the initial condition', () => {
    const f = (_t: number, _y: number | readonly number[]) => 0;
    const sol = adaptiveRK4(f, 0, 5, 1);
    expect(sol.points[0]!.y).toBe(5);
  });

  it('solves y\' = y with tight tolerance', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const sol = adaptiveRK4(f, 0, 1, 1, 1e-8);
    const last = sol.points[sol.points.length - 1]!;
    expect(last.y as number).toBeCloseTo(Math.E, 5);
  });

  it('adapts step count based on tolerance', () => {
    const f = (_t: number, y: number | readonly number[]) => y as number;
    const looseSol = adaptiveRK4(f, 0, 1, 1, 1e-2);
    const tightSol = adaptiveRK4(f, 0, 1, 1, 1e-8);
    // Tight tolerance -> more steps
    expect(tightSol.steps).toBeGreaterThanOrEqual(looseSol.steps);
  });
});

// ============================================================================
// HIGH-LEVEL ODE HELPERS
// ============================================================================

describe('solveExponentialGrowth', () => {
  it('grows correctly with k=1 using RK4', () => {
    const sol = solveExponentialGrowth(1, 1, 2, 'rk4', 0.01);
    const last = sol.points[sol.points.length - 1]!;
    expect(last.y as number).toBeCloseTo(Math.exp(2), 3);
  });

  it('decays correctly with k=-1 using Euler', () => {
    const sol = solveExponentialGrowth(-1, 1, 1, 'euler', 0.01);
    const last = sol.points[sol.points.length - 1]!;
    expect(last.y as number).toBeCloseTo(Math.exp(-1), 1);
  });

  it('uses Heun method when specified', () => {
    const sol = solveExponentialGrowth(1, 1, 1, 'heun', 0.1);
    expect(sol.method).toBe('Improved Euler (Heun)');
  });

  it('initial value y(0) equals y0', () => {
    const sol = solveExponentialGrowth(2, 5, 1, 'rk4', 0.1);
    expect(sol.points[0]!.y as number).toBe(5);
  });
});

describe('solveHarmonicOscillator', () => {
  it('returns a solution with vector state', () => {
    const sol = solveHarmonicOscillator(1, 1, 0, 2 * Math.PI, 0.01);
    expect(sol.points.length).toBeGreaterThan(0);
    const first = sol.points[0]!.y as readonly number[];
    expect(first[0]).toBe(1); // y0
    expect(first[1]).toBe(0); // v0
  });

  it('completes one period with cos initial conditions', () => {
    // omega=1, y(0)=1, y'(0)=0 -> y(t)=cos(t)
    // At t=2*pi, y should be back near 1
    const sol = solveHarmonicOscillator(1, 1, 0, 2 * Math.PI, 0.01);
    const last = sol.points[sol.points.length - 1]!;
    const yVec = last.y as readonly number[];
    expect(yVec[0]!).toBeCloseTo(1, 2);
  });

  it('conserves energy approximately', () => {
    // Energy E = 0.5*(v^2 + omega^2 * y^2) should be conserved
    const omega = 2;
    const sol = solveHarmonicOscillator(omega, 1, 0, 10, 0.01);
    const E0 = 0.5 * (0 * 0 + omega * omega * 1 * 1);
    const last = sol.points[sol.points.length - 1]!;
    const yVec = last.y as readonly number[];
    const Ef = 0.5 * (yVec[1]! * yVec[1]! + omega * omega * yVec[0]! * yVec[0]!);
    expect(Ef).toBeCloseTo(E0, 1);
  });
});

describe('solveLogisticGrowth', () => {
  it('starts at y0', () => {
    const sol = solveLogisticGrowth(1, 100, 10, 10);
    expect(sol.points[0]!.y as number).toBe(10);
  });

  it('approaches carrying capacity K over time', () => {
    const K = 100;
    const sol = solveLogisticGrowth(2, K, 1, 20, 0.05);
    const last = sol.points[sol.points.length - 1]!;
    // Should be close to K after long time
    expect(last.y as number).toBeGreaterThan(K * 0.9);
    expect(last.y as number).toBeLessThan(K * 1.1);
  });

  it('solution is monotonically increasing when y0 < K', () => {
    const sol = solveLogisticGrowth(1, 100, 10, 5, 0.1);
    for (let i = 1; i < sol.points.length; i++) {
      expect(sol.points[i]!.y as number).toBeGreaterThanOrEqual(sol.points[i - 1]!.y as number);
    }
  });
});

describe('solvePredatorPrey', () => {
  it('returns a solution with 2-component vector state', () => {
    const sol = solvePredatorPrey(1, 0.1, 1.5, 0.075, 10, 5, 10, 0.01);
    expect(sol.points.length).toBeGreaterThan(0);
    const first = sol.points[0]!.y as readonly number[];
    expect(first.length).toBe(2);
    expect(first[0]).toBe(10); // x0
    expect(first[1]).toBe(5);  // y0
  });

  it('both populations remain positive', () => {
    const sol = solvePredatorPrey(1, 0.1, 1.5, 0.075, 10, 5, 20, 0.01);
    for (const pt of sol.points) {
      const yVec = pt.y as readonly number[];
      expect(yVec[0]!).toBeGreaterThan(0);
      expect(yVec[1]!).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// PDE SOLVERS
// ============================================================================

describe('solveHeatEquationExplicit', () => {
  const domain = {
    xRange: [0, 1] as readonly [number, number],
    tRange: [0, 0.04] as readonly [number, number],
    nx: 11,
    nt: 41,
  };

  it('returns a solution with correct shape', () => {
    const sol = solveHeatEquationExplicit(
      domain,
      0.01,
      (_x) => 1,
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    expect(sol.x.length).toBe(domain.nx);
    expect(sol.solution.length).toBe(domain.nt);
    expect(sol.converged).toBe(true);
  });

  it('satisfies Dirichlet zero boundary conditions at all times', () => {
    const sol = solveHeatEquationExplicit(
      domain,
      0.01,
      (_x) => Math.sin(Math.PI * _x),
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    for (const row of sol.solution) {
      expect(row[0]).toBeCloseTo(0, 10);
      expect(row[row.length - 1]).toBeCloseTo(0, 10);
    }
  });

  it('initial condition is preserved at t=0', () => {
    const ic = (x: number) => Math.sin(Math.PI * x);
    const sol = solveHeatEquationExplicit(
      domain,
      0.01,
      ic,
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    const firstRow = sol.solution[0]!;
    for (let i = 0; i < domain.nx; i++) {
      const x = sol.x[i]!;
      expect(firstRow[i]!).toBeCloseTo(ic(x), 5);
    }
  });

  it('heat dissipates over time (max decreases)', () => {
    const sol = solveHeatEquationExplicit(
      domain,
      0.01,
      (_x) => Math.sin(Math.PI * _x),
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    const firstMax = Math.max(...(sol.solution[0] as number[]));
    const lastMax = Math.max(...(sol.solution[sol.solution.length - 1] as number[]));
    expect(lastMax).toBeLessThan(firstMax);
  });

  it('throws when time domain is missing', () => {
    expect(() =>
      solveHeatEquationExplicit(
        { xRange: [0, 1], nx: 10 }, // no tRange, no nt
        0.01,
        (_x) => 0,
        { type: 'dirichlet', value: 0 },
        { type: 'dirichlet', value: 0 }
      )
    ).toThrow();
  });

  it('supports functional boundary conditions', () => {
    const sol = solveHeatEquationExplicit(
      domain,
      0.01,
      (_x) => 1,
      { type: 'dirichlet', value: (x, _t) => x },
      { type: 'dirichlet', value: 1 }
    );
    expect(sol.converged).toBe(true);
  });
});

describe('solveHeatEquationImplicit (Crank-Nicolson)', () => {
  const domain = {
    xRange: [0, 1] as readonly [number, number],
    tRange: [0, 0.1] as readonly [number, number],
    nx: 11,
    nt: 11,
  };

  it('returns a converged solution', () => {
    const sol = solveHeatEquationImplicit(
      domain,
      0.01,
      (x) => Math.sin(Math.PI * x),
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    expect(sol.converged).toBe(true);
    expect(sol.x.length).toBe(domain.nx);
    expect(sol.solution.length).toBe(domain.nt);
  });

  it('satisfies zero boundary conditions', () => {
    const sol = solveHeatEquationImplicit(
      domain,
      0.01,
      (x) => x * (1 - x),
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    for (const row of sol.solution) {
      expect(row[0]).toBeCloseTo(0, 5);
      expect(row[row.length - 1]).toBeCloseTo(0, 5);
    }
  });

  it('throws when time domain is missing', () => {
    expect(() =>
      solveHeatEquationImplicit(
        { xRange: [0, 1], nx: 10 },
        0.01,
        (_x) => 0,
        { type: 'dirichlet', value: 0 },
        { type: 'dirichlet', value: 0 }
      )
    ).toThrow();
  });
});

describe('solveWaveEquation', () => {
  const domain = {
    xRange: [0, 1] as readonly [number, number],
    tRange: [0, 1] as readonly [number, number],
    nx: 51,
    nt: 101,
  };

  it('returns a solution with correct shape', () => {
    const sol = solveWaveEquation(
      domain,
      0.5, // c < dx/dt = 0.5, so CFL satisfied
      (x) => Math.sin(Math.PI * x),
      (_x) => 0,
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    expect(sol.x.length).toBe(domain.nx);
    expect(sol.solution.length).toBe(domain.nt);
    expect(sol.converged).toBe(true);
  });

  it('enforces fixed endpoint boundary conditions', () => {
    const sol = solveWaveEquation(
      domain,
      0.4,
      (x) => Math.sin(Math.PI * x),
      (_x) => 0,
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    for (const row of sol.solution) {
      expect(row[0]).toBeCloseTo(0, 10);
      expect(row[row.length - 1]).toBeCloseTo(0, 10);
    }
  });

  it('initial displacement is preserved at t=0', () => {
    const ic = (x: number) => Math.sin(Math.PI * x);
    const sol = solveWaveEquation(
      domain,
      0.4,
      ic,
      (_x) => 0,
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    const firstRow = sol.solution[0]!;
    for (let i = 0; i < domain.nx; i++) {
      expect(firstRow[i]!).toBeCloseTo(ic(sol.x[i]!), 5);
    }
  });

  it('throws when time domain is missing', () => {
    expect(() =>
      solveWaveEquation(
        { xRange: [0, 1], nx: 10 },
        1,
        (_x) => 0,
        (_x) => 0,
        { type: 'dirichlet', value: 0 },
        { type: 'dirichlet', value: 0 }
      )
    ).toThrow();
  });
});

describe('solveLaplaceEquation (Jacobi)', () => {
  it('returns a converged solution for simple case', () => {
    const sol = solveLaplaceEquation(
      [0, 1],
      [0, 1],
      10,
      10,
      (_x, y) => (y >= 1 ? 1 : 0),
      1e-4,
      5000
    );
    expect(sol.converged).toBe(true);
    expect(sol.x.length).toBe(10);
  });

  it('boundary values are respected', () => {
    // u = 0 on all boundaries except top = 1
    const sol = solveLaplaceEquation(
      [0, 1],
      [0, 1],
      10,
      10,
      (_x, y) => (y >= 1 ? 1 : 0),
      1e-4,
      5000
    );
    // Bottom row (j=0) should be 0
    const bottom = sol.solution[0]!;
    for (let i = 0; i < bottom.length; i++) {
      expect(bottom[i]).toBeCloseTo(0, 5);
    }
    // Top row (j=ny-1) should be 1
    const top = sol.solution[sol.solution.length - 1]!;
    for (let i = 0; i < top.length; i++) {
      expect(top[i]).toBeCloseTo(1, 5);
    }
  });

  it('interior values are between 0 and 1 for [0,1] boundary', () => {
    const sol = solveLaplaceEquation(
      [0, 1],
      [0, 1],
      8,
      8,
      (_x, y) => (y >= 1 ? 1 : 0),
      1e-4,
      5000
    );
    for (let j = 1; j < 7; j++) {
      for (let i = 1; i < 7; i++) {
        const val = sol.solution[j]![i]!;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('records iteration count', () => {
    const sol = solveLaplaceEquation(
      [0, 1],
      [0, 1],
      8,
      8,
      () => 0,
      1e-6,
      100
    );
    expect(typeof sol.iterations).toBe('number');
  });
});

describe('solveLaplaceEquationGaussSeidel', () => {
  it('converges for zero-everywhere boundary', () => {
    const sol = solveLaplaceEquationGaussSeidel(
      [0, 1],
      [0, 1],
      8,
      8,
      () => 0,
      1e-8,
      5000
    );
    expect(sol.converged).toBe(true);
    // All interior values should be 0
    for (let j = 1; j < 7; j++) {
      for (let i = 1; i < 7; i++) {
        expect(sol.solution[j]![i]!).toBeCloseTo(0, 5);
      }
    }
  });

  it('Gauss-Seidel converges faster than Jacobi (fewer iterations)', () => {
    const tol = 1e-4;
    const bc = (_x: number, y: number) => (y >= 1 ? 1 : 0);

    const jacobi = solveLaplaceEquation([0, 1], [0, 1], 10, 10, bc, tol, 10000);
    const gs = solveLaplaceEquationGaussSeidel([0, 1], [0, 1], 10, 10, bc, tol, 10000);

    // Both should converge
    expect(jacobi.converged).toBe(true);
    expect(gs.converged).toBe(true);

    // Gauss-Seidel typically needs fewer iterations
    expect(gs.iterations!).toBeLessThanOrEqual(jacobi.iterations!);
  });
});

describe('solvePoissonEquation', () => {
  it('returns a converged solution for zero source', () => {
    // With zero source, Poisson reduces to Laplace
    const sol = solvePoissonEquation(
      [0, 1],
      [0, 1],
      8,
      8,
      () => 0,
      () => 0,
      1e-6,
      5000
    );
    expect(sol.converged).toBe(true);
    // All values should be 0 (same as Laplace with zero boundary)
    for (let j = 1; j < 7; j++) {
      for (let i = 1; i < 7; i++) {
        expect(sol.solution[j]![i]!).toBeCloseTo(0, 4);
      }
    }
  });

  it('solution with constant source is symmetric for symmetric domain', () => {
    const sol = solvePoissonEquation(
      [0, 1],
      [0, 1],
      9,
      9,
      () => -1, // uniform source
      () => 0,
      1e-7,
      20000
    );
    expect(sol.converged).toBe(true);
    // By symmetry, solution should be approximately symmetric about x=0.5.
    // Gauss-Seidel sweeps left-to-right so exact symmetry is not guaranteed;
    // we verify approximate symmetry to 2 decimal places after tight convergence.
    const midRow = sol.solution[4]!; // middle row (j=4)
    for (let i = 1; i < 4; i++) {
      expect(midRow[i]!).toBeCloseTo(midRow[8 - i]!, 2);
    }
  });
});

describe('exportSolutionToString', () => {
  it('produces a string for a time-dependent solution', () => {
    const domain = {
      xRange: [0, 1] as readonly [number, number],
      tRange: [0, 0.1] as readonly [number, number],
      nx: 5,
      nt: 3,
    };
    const sol = solveHeatEquationExplicit(
      domain,
      0.01,
      (_x) => 1,
      { type: 'dirichlet', value: 0 },
      { type: 'dirichlet', value: 0 }
    );
    const output = exportSolutionToString(sol);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    // Should have a header line with t
    expect(output.startsWith('t,')).toBe(true);
  });

  it('produces a string for a steady-state solution', () => {
    const sol = solveLaplaceEquation(
      [0, 1],
      [0, 1],
      4,
      4,
      () => 0,
      1e-6,
      100
    );
    const output = exportSolutionToString(sol);
    expect(typeof output).toBe('string');
    // Steady-state header starts differently
    expect(output.startsWith('y\\x,')).toBe(true);
  });
});
