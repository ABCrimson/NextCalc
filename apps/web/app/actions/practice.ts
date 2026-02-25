'use server';

/**
 * Server Actions for Practice Mode Persistence
 *
 * - savePracticeAttempt: saves each answer during a session (lazy-creates the session)
 * - completePracticeSession: finalises session with aggregate metrics
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  PracticeAttemptSchema,
  PracticeSessionCompleteSchema,
} from '@/lib/validations/learning';
import type { ActionResult } from './problems';

// ---------------------------------------------------------------------------
// savePracticeAttempt
// ---------------------------------------------------------------------------

export interface PracticeAttemptResult {
  sessionId: string;
  attemptId: string;
  correct: boolean;
  pointsEarned: number;
}

export async function savePracticeAttempt(
  _prevState: ActionResult<PracticeAttemptResult>,
  formData: FormData,
): Promise<ActionResult<PracticeAttemptResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    // Boolean and optional fields need manual coercion from FormData strings
    const parsed = PracticeAttemptSchema.parse({
      ...raw,
      correct: raw['correct'] === 'true',
      ...(raw['adaptive'] !== undefined ? { adaptive: raw['adaptive'] === 'true' } : {}),
    });

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save practice progress' };
    }

    // Get or create user progress
    let userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id },
    });

    if (!userProgress) {
      userProgress = await prisma.userProgress.create({
        data: { userId: session.user.id },
      });
    }

    // Lazy-create PracticeSession on first attempt
    let sessionId = parsed.sessionId;

    if (!sessionId) {
      const practiceSession = await prisma.practiceSession.create({
        data: {
          userProgressId: userProgress.id,
          ...(parsed.topic ? { topic: parsed.topic } : {}),
          ...(parsed.difficulty ? { difficulty: parsed.difficulty } : {}),
          questionCount: parsed.questionCount,
          ...(parsed.timeLimit !== undefined ? { timeLimit: parsed.timeLimit } : {}),
          adaptive: parsed.adaptive,
        },
      });
      sessionId = practiceSession.id;
    }

    // Calculate points
    const problem = await prisma.problem.findUnique({
      where: { id: parsed.problemId },
      select: { points: true, topics: true },
    });

    const pointsEarned = parsed.correct ? (problem?.points ?? 10) : 0;

    // Create attempt linked to session
    const attempt = await prisma.attempt.create({
      data: {
        userProgressId: userProgress.id,
        problemId: parsed.problemId,
        practiceSessionId: sessionId,
        submission: parsed.answer,
        correct: parsed.correct,
        timeSpent: parsed.timeSpent,
        hintsUsed: 0,
        pointsEarned,
      },
    });

    // Update topic progress incrementally
    if (parsed.correct && problem?.topics) {
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
            timeSpent: { increment: parsed.timeSpent },
            lastPracticed: new Date(),
          },
          create: {
            userProgressId: userProgress.id,
            topicId: pt.topicId,
            problemsSolved: 1,
            timeSpent: parsed.timeSpent,
          },
        });
      }
    }

    return {
      success: true,
      data: {
        sessionId,
        attemptId: attempt.id,
        correct: parsed.correct,
        pointsEarned,
      },
    };
  } catch (error) {
    console.error('savePracticeAttempt error:', error);
    return { success: false, error: 'Failed to save practice attempt' };
  }
}

// ---------------------------------------------------------------------------
// completePracticeSession
// ---------------------------------------------------------------------------

export interface PracticeSessionResult {
  sessionId: string;
  score: number;
  accuracy: number;
  bestStreak: number;
  totalTime: number;
  pointsEarned: number;
}

export async function completePracticeSession(
  _prevState: ActionResult<PracticeSessionResult>,
  formData: FormData,
): Promise<ActionResult<PracticeSessionResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = PracticeSessionCompleteSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save practice results' };
    }

    // Verify session belongs to user
    const practiceSession = await prisma.practiceSession.findUnique({
      where: { id: data.sessionId },
      include: { userProgress: true },
    });

    if (!practiceSession) {
      return { success: false, error: 'Practice session not found' };
    }

    if (practiceSession.userProgress.userId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Finalise session
    await prisma.practiceSession.update({
      where: { id: data.sessionId },
      data: {
        score: data.score,
        accuracy: data.accuracy,
        bestStreak: data.bestStreak,
        totalTime: data.totalTime,
        pointsEarned: data.pointsEarned,
        completedAt: new Date(),
      },
    });

    // Update user progress totals
    await prisma.userProgress.update({
      where: { id: practiceSession.userProgressId },
      data: {
        totalPoints: { increment: data.pointsEarned },
        experience: { increment: data.pointsEarned },
        lastActive: new Date(),
      },
    });

    return {
      success: true,
      data: {
        sessionId: data.sessionId,
        score: data.score,
        accuracy: data.accuracy,
        bestStreak: data.bestStreak,
        totalTime: data.totalTime,
        pointsEarned: data.pointsEarned,
      },
    };
  } catch (error) {
    console.error('completePracticeSession error:', error);
    return { success: false, error: 'Failed to save practice session' };
  }
}
