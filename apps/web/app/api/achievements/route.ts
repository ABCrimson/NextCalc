/**
 * Achievements API
 *
 * GET /api/achievements - Get all achievements and user progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    // Get all achievements
    const achievements = await prisma.achievement.findMany({
      orderBy: {
        points: 'asc'
      }
    });

    // If authenticated, include user's earned achievements
    let userAchievements: string[] = [];
    if (session?.user?.id) {
      const userProgress = await prisma.userProgress.findUnique({
        where: { userId: session.user.id },
        include: {
          achievements: {
            select: {
              achievementId: true
            }
          }
        }
      });

      if (userProgress) {
        userAchievements = userProgress.achievements.map((a) => a.achievementId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        achievements: achievements.map((achievement) => ({
          ...achievement,
          earned: userAchievements.includes(achievement.id)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
