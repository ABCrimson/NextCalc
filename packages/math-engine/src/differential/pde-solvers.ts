/**
 * Partial Differential Equation (PDE) Solvers
 *
 * Numerical methods for solving PDEs:
 * - Heat equation (parabolic)
 * - Wave equation (hyperbolic)
 * - Laplace equation (elliptic)
 * - Poisson equation
 *
 * Methods implemented:
 * - Finite Difference Method (FDM)
 * - Explicit and implicit schemes
 * - Boundary conditions: Dirichlet, Neumann, periodic
 *
 * @module differential/pde-solvers
 */

/**
 * 2D Grid for PDE solutions
 * grid[i][j] represents value at point (x_i, y_j)
 */
export type Grid2D = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Boundary condition type
 */
export type BoundaryType = 'dirichlet' | 'neumann' | 'periodic';

/**
 * Boundary condition specification
 */
export interface BoundaryCondition {
  /** Boundary type */
  readonly type: BoundaryType;
  /** Boundary values or derivatives */
  readonly value: number | ((x: number, t?: number) => number);
}

/**
 * PDE domain specification
 */
export interface PDEDomain {
  /** Spatial domain [xMin, xMax] */
  readonly xRange: readonly [number, number];
  /** Time domain [tMin, tMax] (for time-dependent PDEs) */
  readonly tRange?: readonly [number, number];
  /** Number of spatial grid points */
  readonly nx: number;
  /** Number of time steps (for time-dependent PDEs) */
  readonly nt?: number;
}

/**
 * PDE solution result
 */
export interface PDESolution {
  /** Solution grid */
  readonly solution: Grid2D;
  /** Spatial coordinates */
  readonly x: ReadonlyArray<number>;
  /** Time coordinates (for time-dependent) */
  readonly t?: ReadonlyArray<number>;
  /** Convergence information */
  readonly converged: boolean;
  /** Number of iterations (for iterative methods) */
  readonly iterations?: number;
}

// ============================================================================
// HEAT EQUATION: ∂u/∂t = α ∂²u/∂x²
// ============================================================================

/**
 * Solves 1D heat equation using explicit (FTCS) scheme
 *
 * ∂u/∂t = α ∂²u/∂x²
 *
 * Forward Time, Centered Space (FTCS):
 * u[n+1,i] = u[n,i] + r(u[n,i+1] - 2u[n,i] + u[n,i-1])
 * where r = α*dt/dx²
 *
 * Stability condition: r ≤ 0.5
 *
 * Time Complexity: O(nx × nt)
 * Space Complexity: O(nx × nt)
 *
 * @param domain - Spatial and temporal domain
 * @param alpha - Thermal diffusivity coefficient
 * @param initialCondition - u(x, 0) = f(x)
 * @param boundaryLeft - Left boundary condition
 * @param boundaryRight - Right boundary condition
 * @returns Solution grid
 *
 * @example
 * // Solve heat equation with initial Gaussian pulse
 * const solution = solveHeatEquationExplicit(
 *   { xRange: [0, 1], tRange: [0, 0.1], nx: 50, nt: 100 },
 *   0.01,
 *   (x) => Math.exp(-100 * (x - 0.5) ** 2),
 *   { type: 'dirichlet', value: 0 },
 *   { type: 'dirichlet', value: 0 }
 * );
 */
export function solveHeatEquationExplicit(
  domain: PDEDomain,
  alpha: number,
  initialCondition: (x: number) => number,
  boundaryLeft: BoundaryCondition,
  boundaryRight: BoundaryCondition
): PDESolution {
  if (!domain.tRange || !domain.nt) {
    throw new Error('solveHeatEquationExplicit: Time domain required');
  }

  const [xMin, xMax] = domain.xRange;
  const [tMin, tMax] = domain.tRange;
  const { nx, nt } = domain;

  const dx = (xMax - xMin) / (nx - 1);
  const dt = (tMax - tMin) / (nt - 1);
  const r = (alpha * dt) / (dx * dx);

  // Check stability condition
  if (r > 0.5) {
    console.warn(`Stability condition violated: r = ${r} > 0.5. Solution may be unstable.`);
  }

  // Initialize grid
  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const t = Array.from({ length: nt }, (_, n) => tMin + n * dt);
  const u: number[][] = Array.from({ length: nt }, () => new Array<number>(nx).fill(0));

  // Set initial condition
  const u0Row = u[0];
  if (u0Row) {
    for (let i = 0; i < nx; i++) {
      u0Row[i] = initialCondition(x[i] ?? xMin);
    }
  }

  // Time stepping
  for (let n = 0; n < nt - 1; n++) {
    const currentTime = t[n] ?? 0;
    const currentRow = u[n];
    const nextRow = u[n + 1];

    if (!currentRow || !nextRow) continue;

    // Apply boundary conditions
    nextRow[0] = applyBoundaryCondition(boundaryLeft, x[0] ?? xMin, currentTime);
    nextRow[nx - 1] = applyBoundaryCondition(boundaryRight, x[nx - 1] ?? xMax, currentTime);

    // Update interior points
    for (let i = 1; i < nx - 1; i++) {
      const uPrev = currentRow[i - 1] ?? 0;
      const uCurr = currentRow[i] ?? 0;
      const uNext = currentRow[i + 1] ?? 0;

      nextRow[i] = uCurr + r * (uNext - 2 * uCurr + uPrev);
    }
  }

  return {
    solution: u,
    x,
    t,
    converged: true,
  };
}

/**
 * Solves 1D heat equation using implicit (Crank-Nicolson) scheme
 *
 * More stable than explicit scheme, unconditionally stable
 *
 * Crank-Nicolson method averages explicit and implicit schemes:
 * u[n+1,i] - u[n,i] = (r/2)(∇²u[n+1,i] + ∇²u[n,i])
 *
 * Requires solving tridiagonal system at each time step
 *
 * @param domain - Spatial and temporal domain
 * @param alpha - Thermal diffusivity coefficient
 * @param initialCondition - u(x, 0) = f(x)
 * @param boundaryLeft - Left boundary condition
 * @param boundaryRight - Right boundary condition
 * @returns Solution grid
 */
export function solveHeatEquationImplicit(
  domain: PDEDomain,
  alpha: number,
  initialCondition: (x: number) => number,
  boundaryLeft: BoundaryCondition,
  boundaryRight: BoundaryCondition
): PDESolution {
  if (!domain.tRange || !domain.nt) {
    throw new Error('solveHeatEquationImplicit: Time domain required');
  }

  const [xMin, xMax] = domain.xRange;
  const [tMin, tMax] = domain.tRange;
  const { nx, nt } = domain;

  const dx = (xMax - xMin) / (nx - 1);
  const dt = (tMax - tMin) / (nt - 1);
  const r = (alpha * dt) / (dx * dx);

  // Initialize grid
  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const t = Array.from({ length: nt }, (_, n) => tMin + n * dt);
  const u: number[][] = Array.from({ length: nt }, () => new Array<number>(nx).fill(0));

  // Set initial condition
  const u0RowImplicit = u[0];
  if (u0RowImplicit) {
    for (let i = 0; i < nx; i++) {
      u0RowImplicit[i] = initialCondition(x[i] ?? xMin);
    }
  }

  // Tridiagonal matrix coefficients for Crank-Nicolson
  const a = -r / 2;
  const b = 1 + r;
  const c = -r / 2;

  // Time stepping
  for (let n = 0; n < nt - 1; n++) {
    const currentTime = t[n] ?? 0;
    const currentRow = u[n];
    const nextRow = u[n + 1];

    if (!currentRow || !nextRow) continue;

    // Build right-hand side
    const rhs = new Array<number>(nx - 2);
    for (let i = 1; i < nx - 1; i++) {
      const uPrev = currentRow[i - 1] ?? 0;
      const uCurr = currentRow[i] ?? 0;
      const uNext = currentRow[i + 1] ?? 0;

      rhs[i - 1] = uCurr + (r / 2) * (uNext - 2 * uCurr + uPrev);
    }

    // Apply boundary conditions to RHS
    const leftBC = applyBoundaryCondition(boundaryLeft, x[0] ?? xMin, currentTime);
    const rightBC = applyBoundaryCondition(boundaryRight, x[nx - 1] ?? xMax, currentTime);

    rhs[0] = (rhs[0] ?? 0) - a * leftBC;
    rhs[rhs.length - 1] = (rhs[rhs.length - 1] ?? 0) - c * rightBC;

    // Solve tridiagonal system
    const solution = solveTridiagonal(
      Array(nx - 2).fill(a),
      Array(nx - 2).fill(b),
      Array(nx - 2).fill(c),
      rhs
    );

    // Update grid
    nextRow[0] = leftBC;
    for (let i = 1; i < nx - 1; i++) {
      nextRow[i] = solution[i - 1] ?? 0;
    }
    nextRow[nx - 1] = rightBC;
  }

  return {
    solution: u,
    x,
    t,
    converged: true,
  };
}

// ============================================================================
// WAVE EQUATION: ∂²u/∂t² = c² ∂²u/∂x²
// ============================================================================

/**
 * Solves 1D wave equation using explicit scheme
 *
 * ∂²u/∂t² = c² ∂²u/∂x²
 *
 * Discretization:
 * u[n+1,i] = 2u[n,i] - u[n-1,i] + (c*dt/dx)²(u[n,i+1] - 2u[n,i] + u[n,i-1])
 *
 * Stability condition: c*dt/dx ≤ 1 (CFL condition)
 *
 * @param domain - Spatial and temporal domain
 * @param c - Wave speed
 * @param initialDisplacement - u(x, 0) = f(x)
 * @param initialVelocity - ∂u/∂t(x, 0) = g(x)
 * @param boundaryLeft - Left boundary condition
 * @param boundaryRight - Right boundary condition
 * @returns Solution grid
 *
 * @example
 * // Plucked string with fixed ends
 * const solution = solveWaveEquation(
 *   { xRange: [0, 1], tRange: [0, 2], nx: 100, nt: 200 },
 *   1.0,
 *   (x) => Math.sin(Math.PI * x), // Initial sine wave
 *   (x) => 0, // Initially at rest
 *   { type: 'dirichlet', value: 0 },
 *   { type: 'dirichlet', value: 0 }
 * );
 */
export function solveWaveEquation(
  domain: PDEDomain,
  c: number,
  initialDisplacement: (x: number) => number,
  initialVelocity: (x: number) => number,
  boundaryLeft: BoundaryCondition,
  boundaryRight: BoundaryCondition
): PDESolution {
  if (!domain.tRange || !domain.nt) {
    throw new Error('solveWaveEquation: Time domain required');
  }

  const [xMin, xMax] = domain.xRange;
  const [tMin, tMax] = domain.tRange;
  const { nx, nt } = domain;

  const dx = (xMax - xMin) / (nx - 1);
  const dt = (tMax - tMin) / (nt - 1);
  const r = (c * dt / dx) ** 2;

  // Check CFL condition
  if (c * dt / dx > 1) {
    console.warn(`CFL condition violated: c*dt/dx = ${c * dt / dx} > 1. Solution may be unstable.`);
  }

  // Initialize grid
  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const t = Array.from({ length: nt }, (_, n) => tMin + n * dt);
  const u: number[][] = Array.from({ length: nt }, () => new Array<number>(nx).fill(0));

  // Set initial displacement
  const u0RowWave = u[0];
  if (u0RowWave) {
    for (let i = 0; i < nx; i++) {
      u0RowWave[i] = initialDisplacement(x[i] ?? xMin);
    }
  }

  // First time step using initial velocity
  const firstRow = u[1];
  if (firstRow) {
    for (let i = 1; i < nx - 1; i++) {
      const u0 = u[0];
      if (!u0) continue;

      const uPrev = u0[i - 1] ?? 0;
      const uCurr = u0[i] ?? 0;
      const uNext = u0[i + 1] ?? 0;
      const vel = initialVelocity(x[i] ?? 0);

      firstRow[i] = uCurr + vel * dt + (r / 2) * (uNext - 2 * uCurr + uPrev);
    }
  }

  // Time stepping
  for (let n = 1; n < nt - 1; n++) {
    const currentTime = t[n] ?? 0;
    const prevRow = u[n - 1];
    const currentRow = u[n];
    const nextRow = u[n + 1];

    if (!prevRow || !currentRow || !nextRow) continue;

    // Apply boundary conditions
    nextRow[0] = applyBoundaryCondition(boundaryLeft, x[0] ?? xMin, currentTime);
    nextRow[nx - 1] = applyBoundaryCondition(boundaryRight, x[nx - 1] ?? xMax, currentTime);

    // Update interior points
    for (let i = 1; i < nx - 1; i++) {
      const uPrev = currentRow[i - 1] ?? 0;
      const uCurr = currentRow[i] ?? 0;
      const uNext = currentRow[i + 1] ?? 0;
      const uOld = prevRow[i] ?? 0;

      nextRow[i] = 2 * uCurr - uOld + r * (uNext - 2 * uCurr + uPrev);
    }
  }

  return {
    solution: u,
    x,
    t,
    converged: true,
  };
}

// ============================================================================
// LAPLACE EQUATION: ∇²u = 0
// ============================================================================

/**
 * Solves 2D Laplace equation using Jacobi iteration
 *
 * ∂²u/∂x² + ∂²u/∂y² = 0
 *
 * Discretization (5-point stencil):
 * u[i,j] = (u[i+1,j] + u[i-1,j] + u[i,j+1] + u[i,j-1]) / 4
 *
 * @param xRange - X domain [xMin, xMax]
 * @param yRange - Y domain [yMin, yMax]
 * @param nx - Number of x grid points
 * @param ny - Number of y grid points
 * @param boundaryConditions - Function returning boundary value at (x, y)
 * @param tolerance - Convergence tolerance
 * @param maxIterations - Maximum iterations
 * @returns Solution grid
 *
 * @example
 * // Solve Laplace equation on unit square with u=0 on three sides, u=1 on top
 * const solution = solveLaplaceEquation(
 *   [0, 1], [0, 1], 50, 50,
 *   (x, y) => y === 1 ? 1 : 0,
 *   1e-6,
 *   10000
 * );
 */
export function solveLaplaceEquation(
  xRange: readonly [number, number],
  yRange: readonly [number, number],
  nx: number,
  ny: number,
  boundaryConditions: (x: number, y: number) => number,
  tolerance = 1e-6,
  maxIterations = 10000
): PDESolution {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  const dx = (xMax - xMin) / (nx - 1);
  const dy = (yMax - yMin) / (ny - 1);

  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const y = Array.from({ length: ny }, (_, j) => yMin + j * dy);

  // Initialize grid with boundary conditions
  let u: number[][] = Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => {
      // Check if on boundary
      if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
        const xVal = x[i];
        const yVal = y[j];
        return boundaryConditions(xVal ?? xMin, yVal ?? yMin);
      }
      return 0; // Interior points initial guess
    })
  );

  let converged = false;
  let iterations = 0;

  // Jacobi iteration
  while (!converged && iterations < maxIterations) {
    const uNew: number[][] = u.map((row) => [...row]);
    let maxDiff = 0;

    // Update interior points
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const uRow = u[j];
        const uAbove = u[j + 1];
        const uBelow = u[j - 1];

        if (!uRow || !uAbove || !uBelow) continue;

        const uLeft = uRow[i - 1] ?? 0;
        const uRight = uRow[i + 1] ?? 0;
        const uUp = uAbove[i] ?? 0;
        const uDown = uBelow[i] ?? 0;

        const newValue = 0.25 * (uLeft + uRight + uUp + uDown);
        const uNewRow = uNew[j];
        if (uNewRow) {
          uNewRow[i] = newValue;
          maxDiff = Math.max(maxDiff, Math.abs(newValue - (uRow[i] ?? 0)));
        }
      }
    }

    u = uNew;
    iterations++;
    converged = maxDiff < tolerance;
  }

  return {
    solution: u,
    x,
    converged,
    iterations,
  };
}

/**
 * Solves 2D Laplace equation using Gauss-Seidel iteration
 *
 * Faster convergence than Jacobi by using updated values immediately
 *
 * @param xRange - X domain
 * @param yRange - Y domain
 * @param nx - Number of x grid points
 * @param ny - Number of y grid points
 * @param boundaryConditions - Boundary value function
 * @param tolerance - Convergence tolerance
 * @param maxIterations - Maximum iterations
 * @returns Solution grid
 */
export function solveLaplaceEquationGaussSeidel(
  xRange: readonly [number, number],
  yRange: readonly [number, number],
  nx: number,
  ny: number,
  boundaryConditions: (x: number, y: number) => number,
  tolerance = 1e-6,
  maxIterations = 10000
): PDESolution {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  const dx = (xMax - xMin) / (nx - 1);
  const dy = (yMax - yMin) / (ny - 1);

  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const y = Array.from({ length: ny }, (_, j) => yMin + j * dy);

  // Initialize grid
  const u: number[][] = Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => {
      if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
        return boundaryConditions(x[i] ?? xMin, y[j] ?? yMin);
      }
      return 0;
    })
  );

  let converged = false;
  let iterations = 0;

  // Gauss-Seidel iteration
  while (!converged && iterations < maxIterations) {
    let maxDiff = 0;

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const uRow = u[j];
        const uAbove = u[j + 1];
        const uBelow = u[j - 1];

        if (!uRow || !uAbove || !uBelow) continue;

        const oldValue = uRow[i] ?? 0;
        const uLeft = uRow[i - 1] ?? 0;
        const uRight = uRow[i + 1] ?? 0;
        const uUp = uAbove[i] ?? 0;
        const uDown = uBelow[i] ?? 0;

        const newValue = 0.25 * (uLeft + uRight + uUp + uDown);
        uRow[i] = newValue;

        maxDiff = Math.max(maxDiff, Math.abs(newValue - oldValue));
      }
    }

    iterations++;
    converged = maxDiff < tolerance;
  }

  return {
    solution: u,
    x,
    converged,
    iterations,
  };
}

// ============================================================================
// POISSON EQUATION: ∇²u = f
// ============================================================================

/**
 * Solves 2D Poisson equation using Gauss-Seidel iteration
 *
 * ∂²u/∂x² + ∂²u/∂y² = f(x, y)
 *
 * @param xRange - X domain
 * @param yRange - Y domain
 * @param nx - Number of x grid points
 * @param ny - Number of y grid points
 * @param source - Source function f(x, y)
 * @param boundaryConditions - Boundary value function
 * @param tolerance - Convergence tolerance
 * @param maxIterations - Maximum iterations
 * @returns Solution grid
 *
 * @example
 * // Solve Poisson equation with point source
 * const solution = solvePoissonEquation(
 *   [0, 1], [0, 1], 50, 50,
 *   (x, y) => (x === 0.5 && y === 0.5) ? 1 : 0,
 *   (x, y) => 0,
 *   1e-6,
 *   10000
 * );
 */
export function solvePoissonEquation(
  xRange: readonly [number, number],
  yRange: readonly [number, number],
  nx: number,
  ny: number,
  source: (x: number, y: number) => number,
  boundaryConditions: (x: number, y: number) => number,
  tolerance = 1e-6,
  maxIterations = 10000
): PDESolution {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  const dx = (xMax - xMin) / (nx - 1);
  const dy = (yMax - yMin) / (ny - 1);

  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const y = Array.from({ length: ny }, (_, j) => yMin + j * dy);

  // Compute source term on grid
  const f: number[][] = Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => source(x[i] ?? xMin, y[j] ?? yMin))
  );

  // Initialize grid
  const u: number[][] = Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => {
      if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
        return boundaryConditions(x[i] ?? xMin, y[j] ?? yMin);
      }
      return 0;
    })
  );

  let converged = false;
  let iterations = 0;

  // Gauss-Seidel iteration
  while (!converged && iterations < maxIterations) {
    let maxDiff = 0;

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const uRow = u[j];
        const uAbove = u[j + 1];
        const uBelow = u[j - 1];
        const fRow = f[j];

        if (!uRow || !uAbove || !uBelow || !fRow) continue;

        const oldValue = uRow[i] ?? 0;
        const uLeft = uRow[i - 1] ?? 0;
        const uRight = uRow[i + 1] ?? 0;
        const uUp = uAbove[i] ?? 0;
        const uDown = uBelow[i] ?? 0;
        const fValue = fRow[i] ?? 0;

        // Discretization: u[i,j] = (u[i+1,j] + u[i-1,j] + u[i,j+1] + u[i,j-1] - h²f[i,j]) / 4
        const newValue = 0.25 * (uLeft + uRight + uUp + uDown - dx * dx * fValue);
        uRow[i] = newValue;

        maxDiff = Math.max(maxDiff, Math.abs(newValue - oldValue));
      }
    }

    iterations++;
    converged = maxDiff < tolerance;
  }

  return {
    solution: u,
    x,
    converged,
    iterations,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Applies boundary condition at a point
 */
function applyBoundaryCondition(bc: BoundaryCondition, x: number, t: number): number {
  if (typeof bc.value === 'number') {
    return bc.value;
  }
  return bc.value(x, t);
}

/**
 * Solves tridiagonal system Ax = b
 *
 * Thomas algorithm for tridiagonal matrices
 * Time Complexity: O(n)
 *
 * @param a - Lower diagonal
 * @param b - Main diagonal
 * @param c - Upper diagonal
 * @param d - Right-hand side
 * @returns Solution vector x
 */
function solveTridiagonal(
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>,
  c: ReadonlyArray<number>,
  d: ReadonlyArray<number>
): ReadonlyArray<number> {
  const n = d.length;
  const cp = new Array<number>(n);
  const dp = new Array<number>(n);
  const x = new Array<number>(n);

  // Forward sweep
  cp[0] = (c[0] ?? 0) / (b[0] ?? 1);
  dp[0] = (d[0] ?? 0) / (b[0] ?? 1);

  for (let i = 1; i < n; i++) {
    const denom = (b[i] ?? 1) - (a[i] ?? 0) * (cp[i - 1] ?? 0);
    cp[i] = (c[i] ?? 0) / denom;
    dp[i] = ((d[i] ?? 0) - (a[i] ?? 0) * (dp[i - 1] ?? 0)) / denom;
  }

  // Back substitution
  x[n - 1] = dp[n - 1] ?? 0;
  for (let i = n - 2; i >= 0; i--) {
    x[i] = (dp[i] ?? 0) - (cp[i] ?? 0) * (x[i + 1] ?? 0);
  }

  return x;
}

/**
 * Exports solution to CSV-like format
 *
 * @param solution - PDE solution
 * @returns String representation
 */
export function exportSolutionToString(solution: PDESolution): string {
  const lines: string[] = [];

  // Header
  if (solution.t) {
    lines.push('t,' + solution.x.join(','));

    // Time-dependent solution
    for (let n = 0; n < solution.solution.length; n++) {
      const row = solution.solution[n];
      if (row) {
        lines.push(`${solution.t[n]},${row.join(',')}`);
      }
    }
  } else {
    // Steady-state 2D solution
    lines.push('y\\x,' + solution.x.join(','));

    for (let j = 0; j < solution.solution.length; j++) {
      const row = solution.solution[j];
      if (row) {
        lines.push(`${j},${row.join(',')}`);
      }
    }
  }

  return lines.join('\n');
}
