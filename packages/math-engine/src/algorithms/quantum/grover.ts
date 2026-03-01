/**
 * Grover's Algorithm Simulation
 *
 * Grover's algorithm is a quantum algorithm for unstructured search that finds
 * with high probability the unique input to a black box function that produces
 * a particular output value.
 *
 * Classical search requires O(N) queries, but Grover's algorithm requires only
 * O(√N) queries - a quadratic speedup.
 *
 * This is a classical simulation of quantum gates and operations.
 *
 * Published by Lov Grover in 1996.
 * Reference: https://arxiv.org/abs/quant-ph/9605043
 */

/**
 * Complex number for quantum amplitudes
 */
export class Complex {
  constructor(
    public readonly real: number,
    public readonly imag: number,
  ) {}

  /** Add complex numbers */
  add(other: Complex): Complex {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  /** Multiply complex numbers */
  multiply(other: Complex): Complex {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real,
    );
  }

  /** Multiply by scalar */
  scale(scalar: number): Complex {
    return new Complex(this.real * scalar, this.imag * scalar);
  }

  /** Magnitude squared */
  magnitudeSquared(): number {
    return this.real * this.real + this.imag * this.imag;
  }

  /** Magnitude */
  magnitude(): number {
    return Math.sqrt(this.magnitudeSquared());
  }

  toString(): string {
    if (this.imag >= 0) {
      return `${this.real.toFixed(4)} + ${this.imag.toFixed(4)}i`;
    }
    return `${this.real.toFixed(4)} - ${Math.abs(this.imag).toFixed(4)}i`;
  }
}

/**
 * Quantum state vector
 * Represents superposition of basis states
 */
export class QuantumState {
  /** Amplitudes for each basis state */
  private amplitudes: Complex[];

  /** Number of qubits */
  public readonly numQubits: number;

  /** Number of basis states (2^numQubits) */
  public readonly numStates: number;

  constructor(numQubits: number) {
    this.numQubits = numQubits;
    this.numStates = 2 ** numQubits;
    this.amplitudes = new Array(this.numStates).fill(null).map(() => new Complex(0, 0));
  }

  /** Get amplitude for basis state */
  getAmplitude(state: number): Complex {
    return this.amplitudes[state]!;
  }

  /** Set amplitude for basis state */
  setAmplitude(state: number, amplitude: Complex): void {
    this.amplitudes[state] = amplitude;
  }

  /** Initialize to uniform superposition (Hadamard on all qubits) */
  uniformSuperposition(): void {
    const amplitude = 1 / Math.sqrt(this.numStates);
    for (let i = 0; i < this.numStates; i++) {
      this.amplitudes[i] = new Complex(amplitude, 0);
    }
  }

  /** Get probability of measuring each state */
  getProbabilities(): ReadonlyArray<number> {
    return this.amplitudes.map((amp) => amp.magnitudeSquared());
  }

  /** Measure state (collapses to basis state) */
  measure(): number {
    const probabilities = this.getProbabilities();
    const random = Math.random();

    let cumulative = 0;
    for (let i = 0; i < this.numStates; i++) {
      cumulative += probabilities[i]!;
      if (random < cumulative) {
        return i;
      }
    }

    return this.numStates - 1;
  }

  /** Apply oracle (flip phase of target state) */
  applyOracle(targetState: number): void {
    const currentAmp = this.amplitudes[targetState]!;
    this.amplitudes[targetState] = currentAmp.scale(-1);
  }

  /** Apply diffusion operator (inversion about average) */
  applyDiffusion(): void {
    // Compute average amplitude
    let sumReal = 0;
    let sumImag = 0;

    for (const amp of this.amplitudes) {
      sumReal += amp.real;
      sumImag += amp.imag;
    }

    const avgReal = sumReal / this.numStates;
    const avgImag = sumImag / this.numStates;

    // Inversion about average: amplitude_new = 2×average - amplitude_old
    for (let i = 0; i < this.numStates; i++) {
      const oldAmp = this.amplitudes[i]!;
      this.amplitudes[i] = new Complex(2 * avgReal - oldAmp.real, 2 * avgImag - oldAmp.imag);
    }
  }

  /** Display state */
  toString(): string {
    let result = 'Quantum State:\n';
    for (let i = 0; i < this.numStates; i++) {
      const prob = this.amplitudes[i]!.magnitudeSquared();
      if (prob > 0.001) {
        result += `|${i.toString(2).padStart(this.numQubits, '0')}⟩: ${this.amplitudes[i]!.toString()} (prob: ${prob.toFixed(4)})\n`;
      }
    }
    return result;
  }
}

/**
 * Grover's Algorithm Result
 */
export interface GroverResult {
  /** Target state found */
  readonly foundState: number;
  /** Number of iterations performed */
  readonly iterations: number;
  /** Probability of success */
  readonly successProbability: number;
  /** All measured probabilities */
  readonly finalProbabilities: ReadonlyArray<number>;
  /** Whether the correct state was found */
  readonly success: boolean;
}

/**
 * Grover's Algorithm Implementation
 *
 * Algorithm:
 * 1. Initialize qubits to uniform superposition (Hadamard on all)
 * 2. Repeat approximately π/4 × √N times:
 *    a. Apply oracle (marks target state)
 *    b. Apply diffusion operator (amplifies marked amplitude)
 * 3. Measure state
 *
 * Time Complexity: O(√N) queries to oracle
 * Space Complexity: O(log N) qubits for N items
 *
 * @param numQubits - Number of qubits (searches space of size 2^numQubits)
 * @param targetState - State to find (0 to 2^numQubits - 1)
 * @returns Result including found state and probabilities
 */
export function groverSearch(numQubits: number, targetState: number): GroverResult {
  const numStates = 2 ** numQubits;

  // Validate target
  if (targetState < 0 || targetState >= numStates) {
    throw new Error(`Target state ${targetState} out of range [0, ${numStates - 1}]`);
  }

  // Initialize state
  const state = new QuantumState(numQubits);
  state.uniformSuperposition();

  // Optimal number of iterations: π/4 × √N
  const optimalIterations = Math.floor((Math.PI / 4) * Math.sqrt(numStates));

  console.log(`\n=== Grover's Algorithm ===`);
  console.log(`Searching space of size: ${numStates}`);
  console.log(
    `Target state: |${targetState.toString(2).padStart(numQubits, '0')}⟩ (${targetState})`,
  );
  console.log(`Optimal iterations: ${optimalIterations}`);
  console.log(`Classical queries needed: ${numStates / 2} (average)`);
  console.log(`Quantum queries needed: ${optimalIterations}`);
  console.log(`Speedup: ${(numStates / 2 / optimalIterations).toFixed(2)}x\n`);

  // Grover iterations
  for (let iter = 0; iter < optimalIterations; iter++) {
    // Step 1: Apply oracle (mark target state)
    state.applyOracle(targetState);

    // Step 2: Apply diffusion operator (amplify marked state)
    state.applyDiffusion();
  }

  // Measure final state
  const finalProbabilities = state.getProbabilities();
  const measuredState = state.measure();

  const successProbability = finalProbabilities[targetState]!;
  const success = measuredState === targetState;

  console.log(`Final probabilities (top 5):`);
  const sortedIndices = [...Array(numStates).keys()]
    .sort((a, b) => finalProbabilities[b]! - finalProbabilities[a]!)
    .slice(0, 5);

  for (const idx of sortedIndices) {
    const prob = finalProbabilities[idx]!;
    const marker = idx === targetState ? ' ← TARGET' : '';
    console.log(`  |${idx.toString(2).padStart(numQubits, '0')}⟩: ${prob.toFixed(4)}${marker}`);
  }

  console.log(
    `\nMeasured state: |${measuredState.toString(2).padStart(numQubits, '0')}⟩ (${measuredState})`,
  );
  console.log(`Success: ${success ? 'YES ✓' : 'NO ✗'}`);

  return {
    foundState: measuredState,
    iterations: optimalIterations,
    successProbability,
    finalProbabilities,
    success,
  };
}

/**
 * Run Grover's algorithm multiple times to estimate success rate
 */
export function groverExperiment(
  numQubits: number,
  targetState: number,
  trials: number,
): {
  successRate: number;
  averageIterations: number;
  results: ReadonlyArray<GroverResult>;
} {
  const results: GroverResult[] = [];
  let successCount = 0;
  let totalIterations = 0;

  for (let i = 0; i < trials; i++) {
    const result = groverSearch(numQubits, targetState);
    results.push(result);

    if (result.success) {
      successCount++;
    }
    totalIterations += result.iterations;
  }

  return {
    successRate: successCount / trials,
    averageIterations: totalIterations / trials,
    results,
  };
}

/**
 * Demonstrate quantum speedup comparison
 */
export function demonstrateGroverSpeedup(): void {
  console.log('\n=== Quantum Speedup Demonstration ===\n');

  const testCases = [
    { qubits: 3, states: 8 },
    { qubits: 4, states: 16 },
    { qubits: 5, states: 32 },
    { qubits: 6, states: 64 },
    { qubits: 8, states: 256 },
    { qubits: 10, states: 1024 },
  ];

  console.log('| Qubits | States | Classical Avg | Quantum | Speedup |');
  console.log('|--------|--------|---------------|---------|---------|');

  for (const { qubits, states } of testCases) {
    const classicalQueries = states / 2;
    const quantumQueries = Math.floor((Math.PI / 4) * Math.sqrt(states));
    const speedup = classicalQueries / quantumQueries;

    console.log(
      `| ${qubits.toString().padStart(6)} | ${states.toString().padStart(6)} | ` +
        `${classicalQueries.toString().padStart(13)} | ${quantumQueries.toString().padStart(7)} | ` +
        `${speedup.toFixed(2)}x    |`,
    );
  }

  console.log('\nNote: Speedup increases as search space grows!');
}

/**
 * Oracle function type
 * Returns true if state is the target
 */
export type OracleFunction = (state: number) => boolean;

/**
 * General Grover search with custom oracle
 * Can search for states satisfying arbitrary conditions
 */
export function groverSearchCustom(numQubits: number, oracle: OracleFunction): GroverResult {
  const numStates = 2 ** numQubits;
  const state = new QuantumState(numQubits);
  state.uniformSuperposition();

  // Find how many solutions exist (for optimal iterations)
  let numSolutions = 0;
  const solutions: number[] = [];
  for (let i = 0; i < numStates; i++) {
    if (oracle(i)) {
      numSolutions++;
      solutions.push(i);
    }
  }

  if (numSolutions === 0) {
    throw new Error('No solutions found');
  }

  // Adjust iterations for multiple solutions
  const theta = Math.asin(Math.sqrt(numSolutions / numStates));
  const optimalIterations = Math.floor(Math.PI / (4 * theta) - 0.5);

  console.log(`Found ${numSolutions} solution(s)`);
  console.log(`Optimal iterations: ${optimalIterations}`);

  // Grover iterations with custom oracle
  for (let iter = 0; iter < optimalIterations; iter++) {
    // Apply oracle to all solution states
    for (const sol of solutions) {
      state.applyOracle(sol);
    }

    state.applyDiffusion();
  }

  const finalProbabilities = state.getProbabilities();
  const measuredState = state.measure();
  const success = oracle(measuredState);
  const successProbability = solutions.reduce((sum, s) => sum + finalProbabilities[s]!, 0);

  return {
    foundState: measuredState,
    iterations: optimalIterations,
    successProbability,
    finalProbabilities,
    success,
  };
}
