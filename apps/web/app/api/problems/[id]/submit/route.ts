/**
 * Problem Submission API
 *
 * POST /api/problems/[id]/submit - Submit solution to a problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SubmissionSchema = z.object({
  answer: z.string(),
  timeSpent: z.number().int().min(0).default(0),
  hintsUsed: z.number().int().min(0).default(0)
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id: problemId } = await context.params;
    const body = await request.json();
    const data = SubmissionSchema.parse(body);

    // Get the problem with test cases
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { order: 'asc' }
        },
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

    // Simple answer validation - check if answer matches expected
    // In production, this would use a more sophisticated validation engine
    const isCorrect = problem.testCases.length > 0
      ? problem.testCases.some(tc =>
          tc.expected.trim().toLowerCase() === data.answer.trim().toLowerCase()
        )
      : true; // No test cases = accept any answer for now

    // Get or create user progress
    let userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id }
    });

    if (!userProgress) {
      userProgress = await prisma.userProgress.create({
        data: { userId: session.user.id }
      });
    }

    // Calculate points earned
    const hintPenalty = data.hintsUsed * 5;
    const pointsEarned = isCorrect ? Math.max(0, problem.points - hintPenalty) : 0;

    // Create attempt record
    const attempt = await prisma.attempt.create({
      data: {
        userProgressId: userProgress.id,
        problemId,
        submission: data.answer,
        correct: isCorrect,
        timeSpent: data.timeSpent,
        hintsUsed: data.hintsUsed,
        pointsEarned,
        feedback: isCorrect
          ? 'Correct! Well done.'
          : 'Incorrect. Try again or use a hint.'
      }
    });

    // Update user progress if this is first correct attempt
    if (isCorrect) {
      const previousSuccess = await prisma.attempt.findFirst({
        where: {
          userProgressId: userProgress.id,
          problemId,
          correct: true,
          id: { not: attempt.id }
        }
      });

      if (!previousSuccess) {
        // Update user stats
        await prisma.userProgress.update({
          where: { id: userProgress.id },
          data: {
            problemsSolved: { increment: 1 },
            totalPoints: { increment: pointsEarned },
            experience: { increment: pointsEarned },
            lastActive: new Date()
          }
        });

        // Update topic progress
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
              lastPracticed: new Date(),
              masteryLevel: { increment: 0.05 } // Increase mastery
            },
            create: {
              userProgressId: userProgress.id,
              topicId: pt.topicId,
              problemsSolved: 1,
              timeSpent: data.timeSpent,
              masteryLevel: 0.1
            }
          });
        }
      }
    }

    // Update problem popularity
    await prisma.problem.update({
      where: { id: problemId },
      data: {
        popularity: { increment: 1 }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        correct: isCorrect,
        pointsEarned,
        feedback: attempt.feedback,
        attemptId: attempt.id
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

    console.error('Error submitting solution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
