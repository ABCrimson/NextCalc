import type { DifficultyLevel } from '@/components/ui/difficulty-badge';
import type { MathTopic } from '@/components/ui/topic-tag';

/**
 * Problem status types
 */
export type ProblemStatus = 'unattempted' | 'attempted' | 'completed';

/**
 * Problem interface
 */
export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  topics: MathTopic[];
  status?: ProblemStatus;
  isFavorite?: boolean;
  attempts?: number;
  successRate?: number;
  averageTime?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Problem filter options
 */
export interface ProblemFilters {
  topics?: MathTopic[];
  difficulties?: DifficultyLevel[];
  status?: ProblemStatus[];
  search?: string;
  isFavorite?: boolean;
}

/**
 * Sort options for problems
 */
export type ProblemSortBy = 'difficulty' | 'topic' | 'recent' | 'popular' | 'title';
export type SortDirection = 'asc' | 'desc';

/**
 * Problem solution step
 */
export interface SolutionStep {
  id: string;
  stepNumber: number;
  title: string;
  content: string;
  mathExpression?: string;
  explanation?: string;
  hints?: string[];
}

/**
 * Problem solution
 */
export interface ProblemSolution {
  problemId: string;
  steps: SolutionStep[];
  finalAnswer: string;
  approach: string;
  complexity?: {
    time?: string;
    space?: string;
  };
}

/**
 * User problem attempt
 */
export interface ProblemAttempt {
  id: string;
  problemId: string;
  userId?: string;
  startedAt: Date;
  completedAt?: Date;
  isCorrect?: boolean;
  timeSpent?: number; // in seconds
  hintsUsed?: number;
  userSolution?: string;
}
