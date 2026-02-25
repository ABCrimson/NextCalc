/**
 * Validation Schemas for Learning Platform API
 *
 * Zod schemas for runtime validation of API requests
 */

import { z } from 'zod';

// ============================================================================
// Problem Schemas
// ============================================================================

export const ProblemListQuerySchema = z.object({
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MASTER']).optional(),
  topicIds: z.string().optional().transform(val => val ? val.split(',') : undefined),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['popularity', 'difficulty', 'createdAt', 'points']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const ProblemSubmissionSchema = z.object({
  submission: z.string().min(1),
  timeSpent: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0)
});

// ============================================================================
// Progress Schemas
// ============================================================================

export const AttemptCreateSchema = z.object({
  problemId: z.string(),
  correct: z.boolean(),
  timeSpent: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0),
  submission: z.string(),
  feedback: z.string().optional()
});

export const FavoriteCreateSchema = z.object({
  problemId: z.string()
});

// ============================================================================
// Knowledge Base Schemas
// ============================================================================

export const TopicQuerySchema = z.object({
  category: z.enum([
    'CALCULUS', 'ALGEBRA', 'TOPOLOGY', 'ANALYSIS', 'GEOMETRY',
    'NUMBER_THEORY', 'ALGORITHMS', 'GAME_THEORY', 'CHAOS_THEORY',
    'CRYPTOGRAPHY', 'QUANTUM', 'OPTIMIZATION', 'PROBABILITY', 'STATISTICS'
  ]).optional()
});

export const SearchQuerySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

// ============================================================================
// Type Exports
// ============================================================================

export type ProblemListQuery = z.infer<typeof ProblemListQuerySchema>;
export type ProblemSubmission = z.infer<typeof ProblemSubmissionSchema>;
export type AttemptCreate = z.infer<typeof AttemptCreateSchema>;
export type FavoriteCreate = z.infer<typeof FavoriteCreateSchema>;
export type TopicQuery = z.infer<typeof TopicQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
