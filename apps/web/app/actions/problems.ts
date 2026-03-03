'use server';

/**
 * Server Actions for Problem Submission, Hints, and Favorites
 *
 * Replaces the REST API routes with direct Prisma calls.
 * Each action validates input via Zod, checks auth, and returns a typed result.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  AnswerSubmissionSchema,
  FavoriteToggleSchema,
  HintRequestSchema,
} from '@/lib/validations/learning';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helper: get-or-create UserProgress
// ---------------------------------------------------------------------------

export async function getOrCreateUserProgress(userId: string) {
  return prisma.userProgress.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

// ---------------------------------------------------------------------------
// submitAnswer
// ---------------------------------------------------------------------------

export interface SubmitAnswerResult {
  correct: boolean;
  pointsEarned: number;
  feedback: string;
  attemptId: string;
}

export async function submitAnswer(
  _prevState: ActionResult<SubmitAnswerResult>,
  formData: FormData,
): Promise<ActionResult<SubmitAnswerResult>> {
  try {
    // Parse and validate
    const raw = Object.fromEntries(formData.entries());
    const data = AnswerSubmissionSchema.parse(raw);

    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save your progress' };
    }

    // Load problem with test cases and topics
    const problem = await prisma.problem.findUnique({
      where: { id: data.problemId },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { order: 'asc' },
        },
        topics: true,
      },
    });

    if (!problem) {
      return { success: false, error: 'Problem not found' };
    }

    // Validate answer against test cases
    const isCorrect =
      problem.testCases.length > 0
        ? problem.testCases.some(
            (tc) => tc.expected.trim().toLowerCase() === data.answer.trim().toLowerCase(),
          )
        : true;

    // Get or create user progress
    const userProgress = await getOrCreateUserProgress(session.user.id);

    // Calculate points (deduct hint penalty)
    const hintPenalty = data.hintsUsed * 5;
    const pointsEarned = isCorrect ? Math.max(0, problem.points - hintPenalty) : 0;

    const feedback = isCorrect ? 'Correct! Well done.' : 'Incorrect. Try again or use a hint.';

    // Create attempt record
    const attempt = await prisma.attempt.create({
      data: {
        userProgressId: userProgress.id,
        problemId: data.problemId,
        submission: data.answer,
        correct: isCorrect,
        timeSpent: data.timeSpent,
        hintsUsed: data.hintsUsed,
        pointsEarned,
        feedback,
      },
    });

    // On first correct answer: update progress
    if (isCorrect) {
      const previousSuccess = await prisma.attempt.findFirst({
        where: {
          userProgressId: userProgress.id,
          problemId: data.problemId,
          correct: true,
          id: { not: attempt.id },
        },
      });

      if (!previousSuccess) {
        await prisma.userProgress.update({
          where: { id: userProgress.id },
          data: {
            problemsSolved: { increment: 1 },
            totalPoints: { increment: pointsEarned },
            experience: { increment: pointsEarned },
            lastActive: new Date(),
          },
        });

        for (const pt of problem.topics) {
          await prisma.topicProgress.upsert({
            where: {
              userProgressId_topicId: {
                userProgressId: userProgress.id,
                topicId: pt.topicId,
              },
            },
            update: {
              problemsSolved: { increment: 1 },
              timeSpent: { increment: data.timeSpent },
              lastPracticed: new Date(),
              masteryLevel: { increment: 0.05 },
            },
            create: {
              userProgressId: userProgress.id,
              topicId: pt.topicId,
              problemsSolved: 1,
              timeSpent: data.timeSpent,
              masteryLevel: 0.1,
            },
          });
        }
      }
    }

    // Update problem popularity
    await prisma.problem.update({
      where: { id: data.problemId },
      data: { popularity: { increment: 1 } },
    });

    revalidatePath('/[locale]/problems/[id]', 'page');

    return {
      success: true,
      data: {
        correct: isCorrect,
        pointsEarned,
        feedback,
        attemptId: attempt.id,
      },
    };
  } catch (error) {
    console.error('submitAnswer error:', error);
    return { success: false, error: 'Failed to submit answer' };
  }
}

// ---------------------------------------------------------------------------
// requestHint
// ---------------------------------------------------------------------------

export interface RequestHintResult {
  content: string;
  pointCost: number;
  order: number;
}

export async function requestHint(
  _prevState: ActionResult<RequestHintResult>,
  formData: FormData,
): Promise<ActionResult<RequestHintResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' };
    }

    const raw = Object.fromEntries(formData.entries());
    const data = HintRequestSchema.parse(raw);

    // Load the requested hint
    const hint = await prisma.hint.findFirst({
      where: {
        problemId: data.problemId,
        order: data.hintOrder,
      },
    });

    if (!hint) {
      return { success: false, error: 'Hint not found' };
    }

    return {
      success: true,
      data: {
        content: hint.content,
        pointCost: hint.pointCost,
        order: hint.order,
      },
    };
  } catch (error) {
    console.error('requestHint error:', error);
    return { success: false, error: 'Failed to load hint' };
  }
}

// ---------------------------------------------------------------------------
// toggleFavorite
// ---------------------------------------------------------------------------

export interface ToggleFavoriteResult {
  isFavorite: boolean;
}

export async function toggleFavorite(
  _prevState: ActionResult<ToggleFavoriteResult>,
  formData: FormData,
): Promise<ActionResult<ToggleFavoriteResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = FavoriteToggleSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save favorites' };
    }

    const userProgress = await getOrCreateUserProgress(session.user.id);

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userProgressId_problemId: {
          userProgressId: userProgress.id,
          problemId: data.problemId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidatePath('/[locale]/problems', 'page');
      return { success: true, data: { isFavorite: false } };
    }

    await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        resourceType: 'PROBLEM',
        problemId: data.problemId,
      },
    });

    revalidatePath('/problems');
    return { success: true, data: { isFavorite: true } };
  } catch (error) {
    console.error('toggleFavorite error:', error);
    return { success: false, error: 'Failed to toggle favorite' };
  }
}
