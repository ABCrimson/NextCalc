/**
 * Problem Hints API
 *
 * GET /api/problems/[id]/hints - Get hints for a problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: problemId } = await context.params;

    // Optionally require authentication for hints
    const session = await auth();

    // Get hints for the problem
    const hints = await prisma.hint.findMany({
      where: { problemId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        content: true,
        order: true,
        pointCost: true
      }
    });

    // If user is authenticated, track which hints they've used
    let usedHintIds: string[] = [];
    if (session?.user?.id) {
      const userProgress = await prisma.userProgress.findUnique({
        where: { userId: session.user.id }
      });

      if (userProgress) {
        // Get user's attempts for this problem to check hints used
        const attempts = await prisma.attempt.findMany({
          where: {
            userProgressId: userProgress.id,
            problemId,
            hintsUsed: { gt: 0 }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        });

        // Approximate which hints were used based on hintsUsed count
        const maxHintsUsed = attempts[0]?.hintsUsed ?? 0;
        usedHintIds = hints.slice(0, maxHintsUsed).map(h => h.id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        hints: hints.map((hint, index) => ({
          ...hint,
          // Only show content for hints the user has "unlocked"
          content: usedHintIds.includes(hint.id) || index === 0
            ? hint.content
            : null, // Hide content until unlocked
          isUnlocked: usedHintIds.includes(hint.id) || index === 0
        })),
        totalHints: hints.length
      }
    });
  } catch (error) {
    console.error('Error fetching hints:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
