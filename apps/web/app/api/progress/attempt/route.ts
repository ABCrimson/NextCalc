/**
 * Attempt Progress API
 *
 * POST /api/progress/attempt - Record a problem attempt
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const AttemptSchema = z.object({
  problemId: z.string(),
  submission: z.string(),
  correct: z.boolean(),
  timeSpent: z.number().int().min(0).default(0),
  hintsUsed: z.number().int().min(0).default(0)
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required'
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = AttemptSchema.parse(body);

    // Get or create user progress
    let userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id }
    });

    if (!userProgress) {
      userProgress = await prisma.userProgress.create({
        data: { userId: session.user.id }
      });
    }

    // Get problem for points calculation
    const problem = await prisma.problem.findUnique({
      where: { id: data.problemId },
      include: {
        topics: {
          include: { topic: true }
        }
      }
    });

    if (!problem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Problem not found'
        },
        { status: 404 }
      );
    }

    // Calculate points earned (deduct for hints used)
    const hintPenalty = data.hintsUsed * 5;
    const pointsEarned = data.correct ? Math.max(0, problem.points - hintPenalty) : 0;

    // Create attempt record
    const attempt = await prisma.attempt.create({
      data: {
        userProgressId: userProgress.id,
        problemId: data.problemId,
        submission: data.submission,
        correct: data.correct,
        timeSpent: data.timeSpent,
        hintsUsed: data.hintsUsed,
        pointsEarned
      }
    });

    // Update user progress if correct
    if (data.correct) {
      // Check if this is first successful attempt
      const previousSuccess = await prisma.attempt.findFirst({
        where: {
          userProgressId: userProgress.id,
          problemId: data.problemId,
          correct: true,
          id: { not: attempt.id }
        }
      });

      if (!previousSuccess) {
        // First time solving - update stats
        await prisma.userProgress.update({
          where: { id: userProgress.id },
          data: {
            problemsSolved: { increment: 1 },
            totalPoints: { increment: pointsEarned },
            experience: { increment: pointsEarned },
            lastActive: new Date()
          }
        });

        // Update topic progress for each related topic
        for (const pt of problem.topics) {
          await prisma.topicProgress.upsert({
            where: {
              userProgressId_topicId: {
                userProgressId: userProgress.id,
                topicId: pt.topicId
              }
            },
            update: {
              problemsSolved: { increment: 1 },
              timeSpent: { increment: data.timeSpent },
              lastPracticed: new Date()
            },
            create: {
              userProgressId: userProgress.id,
              topicId: pt.topicId,
              problemsSolved: 1,
              timeSpent: data.timeSpent
            }
          });
        }
      }
    }

    // Update problem success rate
    const totalAttempts = await prisma.attempt.count({
      where: { problemId: data.problemId }
    });
    const successfulAttempts = await prisma.attempt.count({
      where: { problemId: data.problemId, correct: true }
    });

    await prisma.problem.update({
      where: { id: data.problemId },
      data: {
        successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : null
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          correct: attempt.correct,
          pointsEarned: attempt.pointsEarned
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.issues
        },
        { status: 400 }
      );
    }

    console.error('Error recording attempt:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
