/**
 * Problem System Types
 *
 * Type definitions for the mathematical problem system including:
 * - Problem structure
 * - Solutions
 * - Hints
 * - Difficulty levels
 * - Topics
 */

import type { MathTopic } from '../knowledge/definitions';

/**
 * Problem difficulty level
 */
export enum DifficultyLevel {
  Beginner = 1,
  Intermediate = 2,
  Advanced = 3,
  Expert = 4,
  Research = 5,
}

/**
 * Problem type
 */
export enum ProblemType {
  Computation = 'Computation',
  Proof = 'Proof',
  Application = 'Application',
  Conceptual = 'Conceptual',
  MultiStep = 'Multi-Step',
}

/**
 * Mathematical problem
 */
export interface Problem {
  /** Unique identifier */
  readonly id: string;
  /** Problem title */
  readonly title: string;
  /** Topic category */
  readonly topic: MathTopic;
  /** Difficulty level */
  readonly difficulty: DifficultyLevel;
  /** Problem type */
  readonly type: ProblemType;
  /** Problem statement */
  readonly statement: string;
  /** LaTeX formatted statement */
  readonly latex?: string;
  /** Solution */
  readonly solution: Solution;
  /** Hints (ordered from least to most revealing) */
  readonly hints: ReadonlyArray<Hint>;
  /** Prerequisites */
  readonly prerequisites: ReadonlyArray<string>;
  /** Related problems */
  readonly related: ReadonlyArray<string>;
  /** Tags for searching */
  readonly tags: ReadonlyArray<string>;
  /** Estimated time to solve (minutes) */
  readonly estimatedTime: number;
  /** Point value (for gamification) */
  readonly points: number;
}

/**
 * Problem solution
 */
export interface Solution {
  /** Solution answer */
  readonly answer: string | number | ReadonlyArray<number>;
  /** Detailed explanation */
  readonly explanation: string;
  /** Step-by-step solution */
  readonly steps: ReadonlyArray<SolutionStep>;
  /** Alternative solutions */
  readonly alternativeSolutions?: ReadonlyArray<{
    method: string;
    explanation: string;
  }>;
  /** Key insights */
  readonly insights: ReadonlyArray<string>;
}

/**
 * Solution step
 */
export interface SolutionStep {
  /** Step number */
  readonly stepNumber: number;
  /** Step description */
  readonly description: string;
  /** Mathematical expression */
  readonly expression?: string;
  /** LaTeX formatted expression */
  readonly latex?: string;
  /** Explanation */
  readonly explanation?: string;
  /** Rule or theorem used */
  readonly rule?: string;
}

/**
 * Hint for problem solving
 */
export interface Hint {
  /** Hint order (1 = least revealing) */
  readonly order: number;
  /** Hint text */
  readonly text: string;
  /** What this hint reveals */
  readonly reveals: 'approach' | 'technique' | 'formula' | 'partial-solution';
  /** Cost in points (for gamification) */
  readonly cost: number;
}

/**
 * User attempt at solving a problem
 */
export interface ProblemAttempt {
  /** Problem ID */
  readonly problemId: string;
  /** User answer */
  readonly answer: unknown;
  /** Is correct */
  readonly correct: boolean;
  /** Feedback */
  readonly feedback: string;
  /** Hints used */
  readonly hintsUsed: number;
  /** Time taken (seconds) */
  readonly timeSeconds: number;
  /** Timestamp */
  readonly timestamp: Date;
}

/**
 * Problem set
 */
export interface ProblemSet {
  /** Set ID */
  readonly id: string;
  /** Set name */
  readonly name: string;
  /** Description */
  readonly description: string;
  /** Problems in this set */
  readonly problemIds: ReadonlyArray<string>;
  /** Topic */
  readonly topic: MathTopic;
  /** Target difficulty range */
  readonly difficultyRange: [DifficultyLevel, DifficultyLevel];
  /** Prerequisites */
  readonly prerequisites: ReadonlyArray<string>;
  /** Estimated total time */
  readonly totalTime: number;
}

/**
 * Problem filter criteria
 */
export interface ProblemFilter {
  /** Topics to include */
  readonly topics?: ReadonlyArray<MathTopic>;
  /** Difficulty range */
  readonly difficulty?: {
    min: DifficultyLevel;
    max: DifficultyLevel;
  };
  /** Problem types */
  readonly types?: ReadonlyArray<ProblemType>;
  /** Search query */
  readonly query?: string;
  /** Tags */
  readonly tags?: ReadonlyArray<string>;
  /** Time limit (minutes) */
  readonly maxTime?: number;
}

/**
 * Problem statistics
 */
export interface ProblemStatistics {
  /** Total attempts */
  readonly totalAttempts: number;
  /** Successful attempts */
  readonly successfulAttempts: number;
  /** Success rate */
  readonly successRate: number;
  /** Average time (seconds) */
  readonly averageTime: number;
  /** Average hints used */
  readonly averageHints: number;
}
