/**
 * Progress API
 *
 * GET /api/progress - Get user progress and statistics
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 },
      );
    }

    // Get or create user progress
    let userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id },
      include: {
        topicProgress: {
          include: {
            topic: {
              select: {
                id: true,
                name: true,
                slug: true,
                category: true,
              },
            },
          },
        },
        achievements: {
          include: {
            achievement: true,
          },
        },
        favorites: {
          where: { resourceType: 'PROBLEM' },
          include: {
            problem: {
              select: {
                id: true,
                title: true,
                slug: true,
                difficulty: true,
              },
            },
          },
        },
      },
    });

    // Create progress record if it doesn't exist
    if (!userProgress) {
      userProgress = await prisma.userProgress.create({
        data: {
          userId: session.user.id,
        },
        include: {
          topicProgress: {
            include: {
              topic: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: true,
                },
              },
            },
          },
          achievements: {
            include: {
              achievement: true,
            },
          },
          favorites: {
            where: { resourceType: 'PROBLEM' },
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      });
    }

    // Get recent attempts
    const recentAttempts = await prisma.attempt.findMany({
      where: { userProgressId: userProgress.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        progress: {
          problemsSolved: userProgress.problemsSolved,
          totalPoints: userProgress.totalPoints,
          streak: userProgress.streak,
          longestStreak: userProgress.longestStreak,
          level: userProgress.level,
          experience: userProgress.experience,
          lastActive: userProgress.lastActive,
        },
        topicProgress: userProgress.topicProgress.map((tp) => ({
          topic: tp.topic,
          masteryLevel: tp.masteryLevel,
          problemsSolved: tp.problemsSolved,
          timeSpent: tp.timeSpent,
          lastPracticed: tp.lastPracticed,
        })),
        achievements: userProgress.achievements.map((ua) => ({
          ...ua.achievement,
          earnedAt: ua.earnedAt,
        })),
        favorites: userProgress.favorites.map((f) => f.problem),
        recentAttempts,
      },
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
