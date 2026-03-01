/**
 * Game Theory Algorithms
 *
 * Comprehensive implementation of game-theoretic concepts:
 * - Normal form games
 * - Nash equilibrium computation
 * - Dominant strategy elimination
 * - Minimax algorithm for zero-sum games
 * - Game tree analysis
 * - Evolutionary game theory
 *
 * @module game-theory
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Define a game (Prisoner's Dilemma)
 * const game = new NormalFormGame(
 *   [[-1, -1], [-3, 0]],
 *   [[-1, -1], [0, -3]]
 * );
 *
 * // Find Nash equilibrium
 * const equilibria = game.findNashEquilibria();
 *
 * // Minimax for zero-sum game
 * const minimax = new MinimaxSolver();
 * const bestMove = minimax.solve(gameTree, depth);
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Payoff matrix type (rows × columns)
 */
export type PayoffMatrix = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Mixed strategy (probability distribution over actions)
 */
export type MixedStrategy = ReadonlyArray<number>;

/**
 * Pure strategy (single action index)
 */
export type PureStrategy = number;

/**
 * Strategy profile (one strategy per player)
 */
export type StrategyProfile = ReadonlyArray<PureStrategy | MixedStrategy>;

/**
 * Nash equilibrium result
 */
export interface NashEquilibrium {
  /** Strategy for each player */
  readonly strategies: StrategyProfile;
  /** Expected payoff for each player */
  readonly payoffs: ReadonlyArray<number>;
  /** Whether this is a pure strategy equilibrium */
  readonly isPure: boolean;
  /** Confidence/stability measure */
  readonly stability: number;
}

/**
 * Game tree node
 */
export interface GameNode {
  /** Current player (0, 1, or -1 for terminal) */
  readonly player: number;
  /** Available actions */
  readonly actions: ReadonlyArray<string>;
  /** Child nodes for each action */
  readonly children?: ReadonlyArray<GameNode>;
  /** Payoffs if terminal node */
  readonly payoffs?: ReadonlyArray<number>;
  /** Node value (for minimax) */
  value?: number;
}

/**
 * Evolutionary strategy
 */
export interface EvolutionaryStrategy {
  /** Strategy type name */
  readonly type: string;
  /** Fitness value */
  readonly fitness: number;
  /** Population proportion */
  readonly proportion: number;
}

// ============================================================================
// NORMAL FORM GAMES
// ============================================================================

/**
 * Normal form (strategic form) game
 */
export class NormalFormGame {
  private readonly payoffs: ReadonlyArray<PayoffMatrix>;
  private readonly numActions: ReadonlyArray<number>;

  /**
   * Create a normal form game
   *
   * @param payoffs - Payoff matrices for each player (2-player game)
   */
  constructor(...payoffs: PayoffMatrix[]) {
    this.payoffs = payoffs;
    this.numActions = payoffs.map((p) => p.length);
  }

  /**
   * Get payoff for a strategy profile
   */
  getPayoff(strategies: StrategyProfile, player: number): number {
    const payoffMatrix = this.payoffs[player];
    if (!payoffMatrix) return 0;

    const strategy1 = strategies[0];
    const strategy2 = strategies[1];

    if (typeof strategy1 === 'number' && typeof strategy2 === 'number') {
      // Pure strategies
      return payoffMatrix[strategy1]?.[strategy2] ?? 0;
    }

    // Mixed strategies
    let expectedPayoff = 0;
    const mixed1: ReadonlyArray<number> =
      typeof strategy1 === 'number' ? [0, 0] : (strategy1 ?? [0, 0]);
    const mixed2: ReadonlyArray<number> =
      typeof strategy2 === 'number' ? [0, 0] : (strategy2 ?? [0, 0]);

    for (let i = 0; i < payoffMatrix.length; i++) {
      for (let j = 0; j < (payoffMatrix[i]?.length ?? 0); j++) {
        const prob = (mixed1[i] ?? 0) * (mixed2[j] ?? 0);
        const payoff = payoffMatrix[i]?.[j] ?? 0;
        expectedPayoff += prob * payoff;
      }
    }

    return expectedPayoff;
  }

  /**
   * Find all pure strategy Nash equilibria
   */
  findPureNashEquilibria(): Array<NashEquilibrium> {
    const equilibria: Array<NashEquilibrium> = [];

    for (let i = 0; i < this.numActions[0]!; i++) {
      for (let j = 0; j < this.numActions[1]!; j++) {
        if (this.isPureNashEquilibrium([i, j])) {
          const payoffs = this.payoffs.map((_, player) => this.getPayoff([i, j], player));

          equilibria.push({
            strategies: [i, j],
            payoffs,
            isPure: true,
            stability: 1.0,
          });
        }
      }
    }

    return equilibria;
  }

  /**
   * Check if a pure strategy profile is a Nash equilibrium
   */
  private isPureNashEquilibrium(profile: [number, number]): boolean {
    const [s1, s2] = profile;

    // Check if player 1 can improve by deviating
    for (let i = 0; i < this.numActions[0]!; i++) {
      if (i !== s1) {
        const currentPayoff = this.getPayoff([s1, s2], 0);
        const deviationPayoff = this.getPayoff([i, s2], 0);
        if (deviationPayoff > currentPayoff) {
          return false;
        }
      }
    }

    // Check if player 2 can improve by deviating
    for (let j = 0; j < this.numActions[1]!; j++) {
      if (j !== s2) {
        const currentPayoff = this.getPayoff([s1, s2], 1);
        const deviationPayoff = this.getPayoff([s1, j], 1);
        if (deviationPayoff > currentPayoff) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Find mixed strategy Nash equilibrium (2x2 games only)
   */
  findMixedNashEquilibrium(): NashEquilibrium | null {
    if (this.numActions[0] !== 2 || this.numActions[1] !== 2) {
      throw new Error('Mixed Nash equilibrium computation only supports 2x2 games');
    }

    const p1 = this.payoffs[0]!;
    const p2 = this.payoffs[1]!;

    // For player 2's mixed strategy to make player 1 indifferent:
    // p1[0][0] * q + p1[0][1] * (1-q) = p1[1][0] * q + p1[1][1] * (1-q)
    const denomQ = p1[0]![0]! - p1[0]![1]! - p1[1]![0]! + p1[1]![1]!;
    const q = denomQ !== 0 ? (p1[1]![1]! - p1[0]![1]!) / denomQ : 0.5;

    // For player 1's mixed strategy to make player 2 indifferent:
    const denomP = p2[0]![0]! - p2[1]![0]! - p2[0]![1]! + p2[1]![1]!;
    const p = denomP !== 0 ? (p2[1]![1]! - p2[1]![0]!) / denomP : 0.5;

    // Validate probabilities
    if (p < 0 || p > 1 || q < 0 || q > 1) {
      return null; // No valid mixed equilibrium
    }

    const strategy1: MixedStrategy = [p, 1 - p];
    const strategy2: MixedStrategy = [q, 1 - q];

    const payoffs = [
      this.getPayoff([strategy1, strategy2], 0),
      this.getPayoff([strategy1, strategy2], 1),
    ];

    return {
      strategies: [strategy1, strategy2],
      payoffs,
      isPure: false,
      stability: Math.min(p, 1 - p, q, 1 - q) * 4, // Rough stability measure
    };
  }

  /**
   * Find all Nash equilibria (pure and mixed)
   */
  findNashEquilibria(): Array<NashEquilibrium> {
    const equilibria = this.findPureNashEquilibria();

    if (this.numActions[0] === 2 && this.numActions[1] === 2) {
      const mixed = this.findMixedNashEquilibrium();
      if (mixed) {
        equilibria.push(mixed);
      }
    }

    return equilibria;
  }

  /**
   * Eliminate strictly dominated strategies
   */
  eliminateDominatedStrategies(): {
    game: NormalFormGame;
    eliminated: Array<{ player: number; strategy: number }>;
    reducedPayoffA: PayoffMatrix;
    reducedPayoffB: PayoffMatrix;
  } {
    const eliminated: Array<{ player: number; strategy: number }> = [];
    let currentGame: NormalFormGame = this;
    let changed = true;

    while (changed) {
      changed = false;

      // Check player 1's strategies
      for (let i = 0; i < currentGame.numActions[0]!; i++) {
        if (currentGame.isStrictlyDominated(0, i)) {
          eliminated.push({ player: 0, strategy: i });
          currentGame = currentGame.removeStrategy(0, i) as NormalFormGame;
          changed = true;
          break;
        }
      }

      // Check player 2's strategies
      if (!changed) {
        for (let j = 0; j < currentGame.numActions[1]!; j++) {
          if (currentGame.isStrictlyDominated(1, j)) {
            eliminated.push({ player: 1, strategy: j });
            currentGame = currentGame.removeStrategy(1, j) as NormalFormGame;
            changed = true;
            break;
          }
        }
      }
    }

    return {
      game: currentGame,
      eliminated,
      reducedPayoffA: currentGame.payoffs[0] ?? [],
      reducedPayoffB: currentGame.payoffs[1] ?? [],
    };
  }

  /**
   * Check if a strategy is strictly dominated
   */
  private isStrictlyDominated(player: number, strategy: number): boolean {
    const payoffMatrix = this.payoffs[player];
    if (!payoffMatrix) return false;

    const otherPlayer = 1 - player;

    // Check against each other strategy
    for (let other = 0; other < this.numActions[player]!; other++) {
      if (other === strategy) continue;

      let dominates = true;

      // Check all possible opponent strategies
      for (let opp = 0; opp < this.numActions[otherPlayer]!; opp++) {
        const profile1 = player === 0 ? [strategy, opp] : [opp, strategy];
        const profile2 = player === 0 ? [other, opp] : [opp, other];

        const payoff1 = this.getPayoff(profile1 as [number, number], player);
        const payoff2 = this.getPayoff(profile2 as [number, number], player);

        if (payoff1 >= payoff2) {
          dominates = false;
          break;
        }
      }

      if (dominates) return true;
    }

    return false;
  }

  /**
   * Remove a strategy from the game
   */
  private removeStrategy(player: number, strategy: number): NormalFormGame {
    const newPayoffs = this.payoffs.map((matrix, p) => {
      if (p === player) {
        // Remove row
        return matrix.filter((_, i) => i !== strategy);
      }

      if (player === 1) {
        // Remove column
        return matrix.map((row) => row.filter((_, j) => j !== strategy));
      }

      return matrix;
    });

    return new NormalFormGame(...newPayoffs);
  }
}

// ============================================================================
// MINIMAX ALGORITHM
// ============================================================================

/**
 * Minimax solver for zero-sum games
 */
export class MinimaxSolver {
  /**
   * Solve game tree using minimax algorithm
   *
   * @param node - Current game tree node
   * @param depth - Maximum search depth
   * @param maximizingPlayer - Whether current player is maximizing
   * @param alpha - Alpha value for alpha-beta pruning
   * @param beta - Beta value for alpha-beta pruning
   * @returns Best value for current player
   */
  solve(
    node: GameNode,
    depth: number,
    maximizingPlayer = true,
    alpha = -Infinity,
    beta = Infinity,
  ): number {
    // Terminal node or depth limit
    if (depth === 0 || node.player === -1) {
      return node.payoffs?.[0] ?? 0;
    }

    if (maximizingPlayer) {
      let maxEval = -Infinity;

      for (const child of node.children ?? []) {
        const evaluation = this.solve(child, depth - 1, false, alpha, beta);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);

        if (beta <= alpha) {
          break; // Beta cutoff
        }
      }

      return maxEval;
    }

    let minEval = Infinity;

    for (const child of node.children ?? []) {
      const evaluation = this.solve(child, depth - 1, true, alpha, beta);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);

      if (beta <= alpha) {
        break; // Alpha cutoff
      }
    }

    return minEval;
  }

  /**
   * Find best move from current position
   */
  findBestMove(
    node: GameNode,
    depth: number,
  ): {
    action: string;
    value: number;
  } | null {
    if (!node.children || node.children.length === 0) {
      return null;
    }

    let bestValue = -Infinity;
    let bestAction = node.actions[0] ?? '';

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const value = this.solve(child, depth - 1, false);

      if (value > bestValue) {
        bestValue = value;
        bestAction = node.actions[i] ?? '';
      }
    }

    return { action: bestAction, value: bestValue };
  }
}

// ============================================================================
// EVOLUTIONARY GAME THEORY
// ============================================================================

/**
 * Evolutionary game dynamics
 */
export class EvolutionaryGameDynamics {
  private readonly payoffMatrix: PayoffMatrix;
  private readonly strategies: Array<string>;

  constructor(payoffMatrix: PayoffMatrix, strategies: Array<string>) {
    this.payoffMatrix = payoffMatrix;
    this.strategies = strategies;
  }

  /**
   * Compute fitness for a strategy given population distribution
   */
  computeFitness(strategy: number, population: MixedStrategy): number {
    let fitness = 0;

    for (let j = 0; j < population.length; j++) {
      const payoff = this.payoffMatrix[strategy]?.[j] ?? 0;
      const proportion = population[j] ?? 0;
      fitness += payoff * proportion;
    }

    return fitness;
  }

  /**
   * Find evolutionarily stable strategy (ESS)
   */
  findESS(): EvolutionaryStrategy | null {
    const n = this.strategies.length;

    // Check each pure strategy
    for (let i = 0; i < n; i++) {
      if (this.isESS(i)) {
        const population = Array(n).fill(0);
        population[i] = 1;

        return {
          type: this.strategies[i]!,
          fitness: this.computeFitness(i, population),
          proportion: 1.0,
        };
      }
    }

    return null;
  }

  /**
   * Check if a strategy is an ESS
   */
  private isESS(strategy: number): boolean {
    const n = this.strategies.length;
    const ownFitness = this.payoffMatrix[strategy]?.[strategy] ?? 0;

    for (let other = 0; other < n; other++) {
      if (other === strategy) continue;

      const otherVsSelf = this.payoffMatrix[other]?.[strategy] ?? 0;
      const otherVsOther = this.payoffMatrix[other]?.[other] ?? 0;
      const selfVsOther = this.payoffMatrix[strategy]?.[other] ?? 0;

      // ESS condition: either u(s,s) > u(s',s) or u(s,s) = u(s',s) and u(s,s') > u(s',s')
      if (ownFitness < otherVsSelf) {
        return false;
      }

      if (ownFitness === otherVsSelf && selfVsOther <= otherVsOther) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simulate replicator dynamics
   */
  replicatorDynamics(
    initialPopulation: MixedStrategy,
    steps: number,
    dt = 0.1,
  ): Array<MixedStrategy> {
    const trajectory: Array<MixedStrategy> = [initialPopulation];
    let current = [...initialPopulation];

    for (let t = 0; t < steps; t++) {
      const fitnesses = current.map((_, i) => this.computeFitness(i, current));
      const avgFitness = fitnesses.reduce((sum, f, i) => sum + f * (current[i] ?? 0), 0);

      const next = current.map((xi, i) => {
        const fi = fitnesses[i] ?? 0;
        return Math.max(0, xi + dt * xi * (fi - avgFitness));
      });

      // Normalize
      const sum = next.reduce((a, b) => a + b, 0);
      current = next.map((x) => x / sum);

      trajectory.push([...current]);
    }

    return trajectory;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a symmetric game (same payoff matrix for both players)
 */
export function createSymmetricGame(payoffMatrix: PayoffMatrix): NormalFormGame {
  return new NormalFormGame(payoffMatrix, payoffMatrix);
}

/**
 * Create Prisoner's Dilemma game
 */
export function createPrisonersDilemma(): NormalFormGame {
  // (Cooperate, Defect) × (Cooperate, Defect)
  const p1 = [
    [-1, -3], // Cooperate: (-1, -1) or (-3, 0)
    [0, -2], // Defect: (0, -3) or (-2, -2)
  ];

  const p2 = [
    [-1, 0], // Cooperate: (-1, -1) or (0, -3)
    [-3, -2], // Defect: (-3, 0) or (-2, -2)
  ];

  return new NormalFormGame(p1, p2);
}

/**
 * Create Battle of the Sexes game
 */
export function createBattleOfSexes(): NormalFormGame {
  const p1 = [
    [2, 0],
    [0, 1],
  ];

  const p2 = [
    [1, 0],
    [0, 2],
  ];

  return new NormalFormGame(p1, p2);
}

/**
 * Create Matching Pennies (zero-sum) game
 */
export function createMatchingPennies(): NormalFormGame {
  const p1 = [
    [1, -1],
    [-1, 1],
  ];

  const p2 = [
    [-1, 1],
    [1, -1],
  ];

  return new NormalFormGame(p1, p2);
}

// Export all game theory algorithms
export const GameTheoryAlgorithms = {
  NormalFormGame,
  MinimaxSolver,
  EvolutionaryGameDynamics,
  createSymmetricGame,
  createPrisonersDilemma,
  createBattleOfSexes,
  createMatchingPennies,
};
