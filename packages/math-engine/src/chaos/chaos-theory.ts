/**
 * Chaos Theory and Dynamical Systems
 *
 * Implementation of chaotic systems and nonlinear dynamics:
 * - Logistic map and bifurcation diagrams
 * - Lorenz attractor
 * - Rössler attractor
 * - Lyapunov exponents
 * - Strange attractors
 * - Fractal dimensions
 * - Poincaré maps
 *
 * @module chaos-theory
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Simulate Lorenz attractor
 * const lorenz = new LorenzAttractor();
 * const trajectory = lorenz.simulate(1000, 0.01);
 *
 * // Compute Lyapunov exponent
 * const logistic = new LogisticMap(3.8);
 * const lyapunov = logistic.lyapunovExponent(1000);
 *
 * // Generate bifurcation diagram
 * const bifurcation = logistic.bifurcationDiagram(2.5, 4.0, 1000);
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * 3D point in phase space
 */
export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Time series data
 */
export type TimeSeries = ReadonlyArray<number>;

/**
 * Trajectory in phase space
 */
export type Trajectory = ReadonlyArray<Point3D>;

/**
 * Bifurcation diagram data point
 */
export interface BifurcationPoint {
  readonly parameter: number;
  readonly value: number;
}

/**
 * Lyapunov exponent result
 */
export interface LyapunovResult {
  readonly exponent: number;
  readonly convergence: ReadonlyArray<number>;
  readonly chaotic: boolean;
}

// ============================================================================
// LOGISTIC MAP
// ============================================================================

/**
 * Logistic map: x_{n+1} = r * x_n * (1 - x_n)
 *
 * Classic example of chaotic dynamics
 */
export class LogisticMap {
  private readonly r: number; // Growth parameter

  constructor(r = 3.5) {
    this.r = r;
  }

  /**
   * Iterate the logistic map
   */
  iterate(x: number): number {
    return this.r * x * (1 - x);
  }

  /**
   * Generate time series
   */
  timeSeries(initial: number, steps: number, transient = 100): TimeSeries {
    let x = initial;

    // Discard transient
    for (let i = 0; i < transient; i++) {
      x = this.iterate(x);
    }

    // Collect data
    const series: number[] = [];
    for (let i = 0; i < steps; i++) {
      series.push(x);
      x = this.iterate(x);
    }

    return series;
  }

  /**
   * Generate bifurcation diagram
   */
  bifurcationDiagram(
    rMin: number,
    rMax: number,
    steps: number,
    iterations = 1000,
    samples = 100
  ): Array<BifurcationPoint> {
    const points: Array<BifurcationPoint> = [];
    const dr = (rMax - rMin) / steps;

    for (let i = 0; i < steps; i++) {
      const r = rMin + i * dr;
      const map = new LogisticMap(r);
      const series = map.timeSeries(0.5, samples, iterations);

      for (const value of series) {
        points.push({ parameter: r, value });
      }
    }

    return points;
  }

  /**
   * Compute Lyapunov exponent
   */
  lyapunovExponent(iterations = 10000, x0 = 0.5): LyapunovResult {
    let x = x0;
    let sum = 0;
    const convergence: number[] = [];

    for (let i = 1; i <= iterations; i++) {
      x = this.iterate(x);

      // Derivative of f(x) = r*x*(1-x) is r*(1-2x)
      const derivative = Math.abs(this.r * (1 - 2 * x));

      if (derivative > 0) {
        sum += Math.log(derivative);
      }

      if (i % 100 === 0) {
        convergence.push(sum / i);
      }
    }

    const exponent = sum / iterations;

    return {
      exponent,
      convergence,
      chaotic: exponent > 0,
    };
  }

  /**
   * Find periodic orbits
   */
  findPeriodicOrbits(period: number, tolerance = 1e-6): Array<TimeSeries> {
    const orbits: Array<TimeSeries> = [];
    const samples = 1000;

    for (let i = 0; i < samples; i++) {
      const x0 = i / samples;
      let x = x0;

      // Iterate to get on attractor
      for (let j = 0; j < 1000; j++) {
        x = this.iterate(x);
      }

      // Check if periodic
      const orbit: number[] = [x];
      for (let j = 1; j < period; j++) {
        x = this.iterate(x);
        orbit.push(x);
      }

      x = this.iterate(x);
      if (Math.abs(x - orbit[0]!) < tolerance) {
        // Check if this orbit is new
        const isNew = orbits.every(existing =>
          Math.abs(existing[0]! - orbit[0]!) > tolerance
        );

        if (isNew) {
          orbits.push(orbit);
        }
      }
    }

    return orbits;
  }
}

// ============================================================================
// LORENZ ATTRACTOR
// ============================================================================

/**
 * Lorenz system:
 * dx/dt = σ(y - x)
 * dy/dt = x(ρ - z) - y
 * dz/dt = xy - βz
 */
export class LorenzAttractor {
  private readonly sigma: number;
  private readonly rho: number;
  private readonly beta: number;

  constructor(sigma = 10, rho = 28, beta = 8 / 3) {
    this.sigma = sigma;
    this.rho = rho;
    this.beta = beta;
  }

  /**
   * Compute derivatives
   */
  private derivatives(state: Point3D): Point3D {
    return {
      x: this.sigma * (state.y - state.x),
      y: state.x * (this.rho - state.z) - state.y,
      z: state.x * state.y - this.beta * state.z,
    };
  }

  /**
   * Runge-Kutta 4th order integration step
   */
  private rk4Step(state: Point3D, dt: number): Point3D {
    const k1 = this.derivatives(state);

    const k2 = this.derivatives({
      x: state.x + 0.5 * dt * k1.x,
      y: state.y + 0.5 * dt * k1.y,
      z: state.z + 0.5 * dt * k1.z,
    });

    const k3 = this.derivatives({
      x: state.x + 0.5 * dt * k2.x,
      y: state.y + 0.5 * dt * k2.y,
      z: state.z + 0.5 * dt * k2.z,
    });

    const k4 = this.derivatives({
      x: state.x + dt * k3.x,
      y: state.y + dt * k3.y,
      z: state.z + dt * k3.z,
    });

    return {
      x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      z: state.z + (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
    };
  }

  /**
   * Simulate Lorenz attractor
   */
  simulate(
    steps: number,
    dt = 0.01,
    initial: Point3D = { x: 1, y: 1, z: 1 }
  ): Trajectory {
    const trajectory: Point3D[] = [initial];
    let state = initial;

    for (let i = 0; i < steps; i++) {
      state = this.rk4Step(state, dt);
      trajectory.push(state);
    }

    return trajectory;
  }

  /**
   * Compute Lyapunov exponents (largest)
   */
  lyapunovExponent(
    steps = 10000,
    dt = 0.01,
    initial: Point3D = { x: 1, y: 1, z: 1 }
  ): LyapunovResult {
    const epsilon = 1e-8;
    let state1 = initial;
    let state2 = {
      x: initial.x + epsilon,
      y: initial.y,
      z: initial.z,
    };

    let sum = 0;
    const convergence: number[] = [];

    for (let i = 1; i <= steps; i++) {
      state1 = this.rk4Step(state1, dt);
      state2 = this.rk4Step(state2, dt);

      // Compute separation
      const dx = state2.x - state1.x;
      const dy = state2.y - state1.y;
      const dz = state2.z - state1.z;
      const separation = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Accumulate log of separation rate
      sum += Math.log(separation / epsilon);

      // Renormalize
      const scale = epsilon / separation;
      state2 = {
        x: state1.x + dx * scale,
        y: state1.y + dy * scale,
        z: state1.z + dz * scale,
      };

      if (i % 100 === 0) {
        convergence.push(sum / (i * dt));
      }
    }

    const exponent = sum / (steps * dt);

    return {
      exponent,
      convergence,
      chaotic: exponent > 0,
    };
  }

  /**
   * Compute Poincaré section (z = z0 plane)
   */
  poincareSection(z0 = 27, steps = 100000, dt = 0.01): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    let state = { x: 1, y: 1, z: 1 };
    let prevZ = state.z;

    for (let i = 0; i < steps; i++) {
      state = this.rk4Step(state, dt);

      // Check for crossing
      if ((prevZ - z0) * (state.z - z0) < 0) {
        // Linear interpolation to find exact crossing
        const t = (z0 - prevZ) / (state.z - prevZ);
        points.push({
          x: state.x * t + prevZ * (1 - t),
          y: state.y * t + prevZ * (1 - t),
        });
      }

      prevZ = state.z;
    }

    return points;
  }
}

// ============================================================================
// RÖSSLER ATTRACTOR
// ============================================================================

/**
 * Rössler system:
 * dx/dt = -y - z
 * dy/dt = x + ay
 * dz/dt = b + z(x - c)
 */
export class RosslerAttractor {
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;

  constructor(a = 0.2, b = 0.2, c = 5.7) {
    this.a = a;
    this.b = b;
    this.c = c;
  }

  /**
   * Compute derivatives
   */
  private derivatives(state: Point3D): Point3D {
    return {
      x: -state.y - state.z,
      y: state.x + this.a * state.y,
      z: this.b + state.z * (state.x - this.c),
    };
  }

  /**
   * Runge-Kutta 4th order step
   */
  private rk4Step(state: Point3D, dt: number): Point3D {
    const k1 = this.derivatives(state);

    const k2 = this.derivatives({
      x: state.x + 0.5 * dt * k1.x,
      y: state.y + 0.5 * dt * k1.y,
      z: state.z + 0.5 * dt * k1.z,
    });

    const k3 = this.derivatives({
      x: state.x + 0.5 * dt * k2.x,
      y: state.y + 0.5 * dt * k2.y,
      z: state.z + 0.5 * dt * k2.z,
    });

    const k4 = this.derivatives({
      x: state.x + dt * k3.x,
      y: state.y + dt * k3.y,
      z: state.z + dt * k3.z,
    });

    return {
      x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      z: state.z + (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
    };
  }

  /**
   * Simulate Rössler attractor
   */
  simulate(
    steps: number,
    dt = 0.01,
    initial: Point3D = { x: 1, y: 1, z: 1 }
  ): Trajectory {
    const trajectory: Point3D[] = [initial];
    let state = initial;

    for (let i = 0; i < steps; i++) {
      state = this.rk4Step(state, dt);
      trajectory.push(state);
    }

    return trajectory;
  }
}

// ============================================================================
// FRACTAL DIMENSIONS
// ============================================================================

/**
 * Compute box-counting (Minkowski) dimension
 */
export function boxCountingDimension(
  points: Trajectory,
  minBoxSize: number,
  maxBoxSize: number,
  steps = 10
): number {
  const logSizes: number[] = [];
  const logCounts: number[] = [];

  const scale = Math.log(maxBoxSize / minBoxSize) / steps;

  for (let i = 0; i < steps; i++) {
    const boxSize = minBoxSize * Math.exp(i * scale);
    const count = countBoxes(points, boxSize);

    logSizes.push(Math.log(1 / boxSize));
    logCounts.push(Math.log(count));
  }

  // Linear regression to find slope
  return linearRegressionSlope(logSizes, logCounts);
}

/**
 * Count boxes occupied by points
 */
function countBoxes(points: Trajectory, boxSize: number): number {
  const boxes = new Set<string>();

  for (const point of points) {
    const ix = Math.floor(point.x / boxSize);
    const iy = Math.floor(point.y / boxSize);
    const iz = Math.floor(point.z / boxSize);
    boxes.add(`${ix},${iy},${iz}`);
  }

  return boxes.size;
}

/**
 * Linear regression slope
 */
function linearRegressionSlope(x: number[], y: number[]): number {
  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i]!;
    sumY += y[i]!;
    sumXY += x[i]! * y[i]!;
    sumXX += x[i]! * x[i]!;
  }

  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

// ============================================================================
// HENON MAP
// ============================================================================

/**
 * Hénon map (2D discrete chaotic system)
 * x_{n+1} = 1 - a*x_n^2 + y_n
 * y_{n+1} = b*x_n
 */
export class HenonMap {
  private readonly a: number;
  private readonly b: number;

  constructor(a = 1.4, b = 0.3) {
    this.a = a;
    this.b = b;
  }

  /**
   * Single iteration
   */
  iterate(x: number, y: number): { x: number; y: number } {
    return {
      x: 1 - this.a * x * x + y,
      y: this.b * x,
    };
  }

  /**
   * Generate trajectory
   */
  trajectory(
    steps: number,
    initial: { x: number; y: number } = { x: 0, y: 0 }
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [initial];
    let current = initial;

    for (let i = 0; i < steps; i++) {
      current = this.iterate(current.x, current.y);
      points.push(current);
    }

    return points;
  }

  /**
   * Lyapunov exponent
   */
  lyapunovExponent(iterations = 10000): LyapunovResult {
    const epsilon = 1e-8;
    let x1 = 0;
    let y1 = 0;
    let x2 = epsilon;
    let y2 = 0;

    let sum = 0;
    const convergence: number[] = [];

    for (let i = 1; i <= iterations; i++) {
      const next1 = this.iterate(x1, y1);
      const next2 = this.iterate(x2, y2);

      x1 = next1.x;
      y1 = next1.y;
      x2 = next2.x;
      y2 = next2.y;

      // Compute separation
      const dx = x2 - x1;
      const dy = y2 - y1;
      const separation = Math.sqrt(dx * dx + dy * dy);

      sum += Math.log(separation / epsilon);

      // Renormalize
      const scale = epsilon / separation;
      x2 = x1 + dx * scale;
      y2 = y1 + dy * scale;

      if (i % 100 === 0) {
        convergence.push(sum / i);
      }
    }

    const exponent = sum / iterations;

    return {
      exponent,
      convergence,
      chaotic: exponent > 0,
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Compute autocorrelation of a time series
 */
export function autocorrelation(series: TimeSeries, maxLag: number): number[] {
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;

  const autocorr: number[] = [];

  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += ((series[i]! - mean) * (series[i + lag]! - mean)) / variance;
    }
    autocorr.push(sum / (n - lag));
  }

  return autocorr;
}

/**
 * Compute power spectrum using FFT approximation
 */
export function powerSpectrum(series: TimeSeries): number[] {
  const n = series.length;
  const spectrum: number[] = [];

  // Simplified DFT (not optimized FFT)
  for (let k = 0; k < n / 2; k++) {
    let real = 0;
    let imag = 0;

    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      real += (series[t]! * Math.cos(angle));
      imag -= (series[t]! * Math.sin(angle));
    }

    spectrum.push(real * real + imag * imag);
  }

  return spectrum;
}

// Export all chaos theory algorithms
export const ChaosTheoryAlgorithms = {
  LogisticMap,
  LorenzAttractor,
  RosslerAttractor,
  HenonMap,
  boxCountingDimension,
  autocorrelation,
  powerSpectrum,
};
