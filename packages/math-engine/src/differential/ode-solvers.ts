/**
 * Ordinary Differential Equation (ODE) Solvers
 *
 * Numerical methods for solving ODEs:
 * - Euler's Method (1st order)
 * - Improved Euler (Heun's Method, 2nd order)
 * - Runge-Kutta 4th Order (RK4, industry standard)
 * - Adaptive Step Size Methods
 *
 * For initial value problems: dy/dt = f(t, y), y(t₀) = y₀
 */

/**
 * ODE function type: dy/dt = f(t, y)
 */
export type ODEFunction = (
  t: number,
  y: number | ReadonlyArray<number>,
) => number | ReadonlyArray<number>;

/**
 * Solution point
 */
export interface SolutionPoint {
  readonly t: number;
  readonly y: number | ReadonlyArray<number>;
}

/**
 * ODE Solution
 */
export interface ODESolution {
  /** Array of solution points */
  readonly points: ReadonlyArray<SolutionPoint>;
  /** Method used */
  readonly method: string;
  /** Step size used */
  readonly stepSize: number;
  /** Number of steps */
  readonly steps: number;
}

// ============================================================================
// EULER'S METHOD
// ============================================================================

/**
 * Euler's Method - Forward Euler
 *
 * The simplest method for solving ODEs. Uses tangent line approximation.
 *
 * Formula: yₙ₊₁ = yₙ + h·f(tₙ, yₙ)
 *
 * Time Complexity: O(n) where n is number of steps
 * Accuracy: O(h) - First order method
 *
 * Pros: Simple, easy to understand
 * Cons: Large error, unstable for stiff equations
 *
 * @param f - ODE function dy/dt = f(t, y)
 * @param t0 - Initial time
 * @param y0 - Initial value
 * @param tEnd - End time
 * @param stepSize - Time step
 */
export function eulerMethod(
  f: ODEFunction,
  t0: number,
  y0: number,
  tEnd: number,
  stepSize: number,
): ODESolution {
  const points: SolutionPoint[] = [];
  let t = t0;
  let y = y0;

  points.push({ t, y });

  const numSteps = Math.ceil((tEnd - t0) / stepSize);

  for (let i = 0; i < numSteps; i++) {
    // Euler step: y_{n+1} = y_n + h * f(t_n, y_n)
    const dy = f(t, y) as number;
    y = y + stepSize * dy;
    t = t + stepSize;

    points.push({ t, y });
  }

  return {
    points,
    method: 'Euler',
    stepSize,
    steps: numSteps,
  };
}

// ============================================================================
// IMPROVED EULER (HEUN'S METHOD)
// ============================================================================

/**
 * Improved Euler Method (Heun's Method)
 *
 * Predictor-corrector method that averages slopes at start and end of interval.
 *
 * Formula:
 * - k₁ = f(tₙ, yₙ)
 * - k₂ = f(tₙ + h, yₙ + h·k₁)
 * - yₙ₊₁ = yₙ + h·(k₁ + k₂)/2
 *
 * Accuracy: O(h²) - Second order method
 *
 * Better accuracy than Euler with modest computational cost increase.
 */
export function improvedEuler(
  f: ODEFunction,
  t0: number,
  y0: number,
  tEnd: number,
  stepSize: number,
): ODESolution {
  const points: SolutionPoint[] = [];
  let t = t0;
  let y = y0;

  points.push({ t, y });

  const numSteps = Math.ceil((tEnd - t0) / stepSize);

  for (let i = 0; i < numSteps; i++) {
    // Predictor step
    const k1 = f(t, y) as number;
    const yPredict = y + stepSize * k1;

    // Corrector step
    const k2 = f(t + stepSize, yPredict) as number;

    // Average the slopes
    y = y + (stepSize * (k1 + k2)) / 2;
    t = t + stepSize;

    points.push({ t, y });
  }

  return {
    points,
    method: 'Improved Euler (Heun)',
    stepSize,
    steps: numSteps,
  };
}

// ============================================================================
// RUNGE-KUTTA 4TH ORDER (RK4)
// ============================================================================

/**
 * Runge-Kutta 4th Order Method (RK4)
 *
 * The most widely used method for non-stiff ODEs.
 * Balances accuracy and computational efficiency.
 *
 * Formula:
 * - k₁ = f(tₙ, yₙ)
 * - k₂ = f(tₙ + h/2, yₙ + h·k₁/2)
 * - k₃ = f(tₙ + h/2, yₙ + h·k₂/2)
 * - k₄ = f(tₙ + h, yₙ + h·k₃)
 * - yₙ₊₁ = yₙ + h·(k₁ + 2k₂ + 2k₃ + k₄)/6
 *
 * Accuracy: O(h⁴) - Fourth order method
 *
 * This is the "gold standard" for general purpose ODE solving.
 *
 * @param f - ODE function dy/dt = f(t, y)
 * @param t0 - Initial time
 * @param y0 - Initial value (scalar or vector)
 * @param tEnd - End time
 * @param stepSize - Time step
 */
export function rungeKutta4(
  f: ODEFunction,
  t0: number,
  y0: number | ReadonlyArray<number>,
  tEnd: number,
  stepSize: number,
): ODESolution {
  const points: SolutionPoint[] = [];
  let t = t0;
  let y = y0;

  points.push({ t, y });

  const numSteps = Math.ceil((tEnd - t0) / stepSize);
  const h = stepSize;

  // Determine if we're working with scalar or vector
  const isVector = Array.isArray(y0);

  for (let i = 0; i < numSteps; i++) {
    if (isVector) {
      // Vector case
      const yVec = y as ReadonlyArray<number>;

      // k1 = f(t, y)
      const k1 = f(t, yVec) as ReadonlyArray<number>;

      // k2 = f(t + h/2, y + h*k1/2)
      const y2 = yVec.map((yi, idx) => yi + (h * k1[idx]!) / 2);
      const k2 = f(t + h / 2, y2) as ReadonlyArray<number>;

      // k3 = f(t + h/2, y + h*k2/2)
      const y3 = yVec.map((yi, idx) => yi + (h * k2[idx]!) / 2);
      const k3 = f(t + h / 2, y3) as ReadonlyArray<number>;

      // k4 = f(t + h, y + h*k3)
      const y4 = yVec.map((yi, idx) => yi + h * k3[idx]!);
      const k4 = f(t + h, y4) as ReadonlyArray<number>;

      // Weighted average
      y = yVec.map((yi, idx) => yi + (h * (k1[idx]! + 2 * k2[idx]! + 2 * k3[idx]! + k4[idx]!)) / 6);
    } else {
      // Scalar case
      const yScalar = y as number;

      const k1 = f(t, yScalar) as number;
      const k2 = f(t + h / 2, yScalar + (h * k1) / 2) as number;
      const k3 = f(t + h / 2, yScalar + (h * k2) / 2) as number;
      const k4 = f(t + h, yScalar + h * k3) as number;

      y = yScalar + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
    }

    t = t + h;
    points.push({ t, y });
  }

  return {
    points,
    method: 'Runge-Kutta 4',
    stepSize,
    steps: numSteps,
  };
}

// ============================================================================
// ADAPTIVE STEP SIZE RUNGE-KUTTA
// ============================================================================

/**
 * Adaptive Step Size RK4 (Runge-Kutta-Fehlberg)
 *
 * Automatically adjusts step size to maintain desired accuracy.
 * Uses two different order methods to estimate error.
 *
 * More efficient than fixed step size for varying solution behavior.
 *
 * @param f - ODE function
 * @param t0 - Initial time
 * @param y0 - Initial value
 * @param tEnd - End time
 * @param tolerance - Error tolerance
 * @param initialStepSize - Initial step size guess
 */
export function adaptiveRK4(
  f: ODEFunction,
  t0: number,
  y0: number,
  tEnd: number,
  tolerance = 1e-6,
  initialStepSize = 0.1,
): ODESolution {
  const points: SolutionPoint[] = [];
  let t = t0;
  let y = y0;
  let h = initialStepSize;

  points.push({ t, y });

  let steps = 0;

  while (t < tEnd) {
    // Ensure we don't overshoot
    if (t + h > tEnd) {
      h = tEnd - t;
    }

    // Take one step with size h
    const k1 = f(t, y) as number;
    const k2 = f(t + h / 2, y + (h * k1) / 2) as number;
    const k3 = f(t + h / 2, y + (h * k2) / 2) as number;
    const k4 = f(t + h, y + h * k3) as number;
    const y1 = y + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;

    // Take two half steps
    const h2 = h / 2;
    let yHalf = y;

    for (let i = 0; i < 2; i++) {
      const k1h = f(t + i * h2, yHalf) as number;
      const k2h = f(t + i * h2 + h2 / 2, yHalf + (h2 * k1h) / 2) as number;
      const k3h = f(t + i * h2 + h2 / 2, yHalf + (h2 * k2h) / 2) as number;
      const k4h = f(t + i * h2 + h2, yHalf + h2 * k3h) as number;
      yHalf = yHalf + (h2 * (k1h + 2 * k2h + 2 * k3h + k4h)) / 6;
    }

    // Estimate error
    const error = Math.abs(y1 - yHalf);

    if (error < tolerance || h < 1e-10) {
      // Accept step
      y = y1;
      t = t + h;
      points.push({ t, y });
      steps++;
    }

    // Adjust step size
    if (error > 0) {
      const factor = (tolerance / error) ** 0.2;
      h = h * Math.min(2, Math.max(0.5, 0.9 * factor));
    }
  }

  return {
    points,
    method: 'Adaptive RK4',
    stepSize: initialStepSize,
    steps,
  };
}

// ============================================================================
// EXAMPLE PROBLEMS
// ============================================================================

/**
 * Solve exponential growth: dy/dt = k*y, y(0) = y0
 * Exact solution: y(t) = y0 * e^(kt)
 */
export function solveExponentialGrowth(
  k: number,
  y0: number,
  tEnd: number,
  method: 'euler' | 'heun' | 'rk4' = 'rk4',
  stepSize = 0.1,
): ODESolution {
  const f: ODEFunction = (_t: number, y: number | ReadonlyArray<number>) => k * (y as number);

  switch (method) {
    case 'euler':
      return eulerMethod(f, 0, y0, tEnd, stepSize);
    case 'heun':
      return improvedEuler(f, 0, y0, tEnd, stepSize);
    case 'rk4':
      return rungeKutta4(f, 0, y0, tEnd, stepSize);
  }
}

/**
 * Solve harmonic oscillator: d²y/dt² + ω²y = 0
 * Convert to system: dy1/dt = y2, dy2/dt = -ω²y1
 */
export function solveHarmonicOscillator(
  omega: number,
  y0: number,
  v0: number,
  tEnd: number,
  stepSize = 0.01,
): ODESolution {
  const f: ODEFunction = (_t: number, y: number | ReadonlyArray<number>) => {
    const yArr = y as ReadonlyArray<number>;
    const y1 = yArr[0];
    const y2 = yArr[1];
    if (y1 === undefined || y2 === undefined) {
      throw new Error('Invalid state vector');
    }
    return [y2, -omega * omega * y1];
  };

  return rungeKutta4(f, 0, [y0, v0], tEnd, stepSize);
}

/**
 * Solve logistic growth: dy/dt = r*y*(1 - y/K)
 */
export function solveLogisticGrowth(
  r: number,
  K: number,
  y0: number,
  tEnd: number,
  stepSize = 0.1,
): ODESolution {
  const f: ODEFunction = (_t: number, y: number | ReadonlyArray<number>) => {
    const yScalar = y as number;
    return r * yScalar * (1 - yScalar / K);
  };

  return rungeKutta4(f, 0, y0, tEnd, stepSize);
}

/**
 * Solve predator-prey (Lotka-Volterra) equations
 * dx/dt = αx - βxy (prey)
 * dy/dt = δxy - γy (predator)
 */
export function solvePredatorPrey(
  alpha: number,
  beta: number,
  gamma: number,
  delta: number,
  x0: number,
  y0: number,
  tEnd: number,
  stepSize = 0.01,
): ODESolution {
  const f: ODEFunction = (_t: number, state: number | ReadonlyArray<number>) => {
    const stateArr = state as ReadonlyArray<number>;
    const x = stateArr[0];
    const y = stateArr[1];
    if (x === undefined || y === undefined) {
      throw new Error('Invalid state vector');
    }
    return [alpha * x - beta * x * y, delta * x * y - gamma * y];
  };

  return rungeKutta4(f, 0, [x0, y0], tEnd, stepSize);
}
