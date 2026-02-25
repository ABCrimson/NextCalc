/**
 * Favorites API
 *
 * GET /api/favorites - Get user's favorites
 * POST /api/favorites - Add a favorite
 * DELETE /api/favorites - Remove a favorite
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const FavoriteSchema = z.object({
  problemId: z.string()
});

export async function GET(_request: NextRequest) {
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

    const userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id },
      include: {
        favorites: {
          include: {
            problem: {
              select: {
                id: true,
                title: true,
                slug: true,
                difficulty: true,
                description: true,
                estimatedTime: true,
                points: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        favorites: userProgress?.favorites.map((f) => f.problem) ?? []
      }
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

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
    const { problemId } = FavoriteSchema.parse(body);

    // Get or create user progress
    let userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id }
    });

    if (!userProgress) {
      userProgress = await prisma.userProgress.create({
        data: { userId: session.user.id }
      });
    }

    // Check if problem exists
    const problem = await prisma.problem.findUnique({
      where: { id: problemId }
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

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userProgressId_problemId: {
          userProgressId: userProgress.id,
          problemId
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Already favorited'
        },
        { status: 409 }
      );
    }

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        resourceType: 'PROBLEM',
        problemId
      },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        favorite: favorite.problem
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

    console.error('Error adding favorite:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { problemId } = FavoriteSchema.parse(body);

    const userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id }
    });

    if (!userProgress) {
      return NextResponse.json(
        {
          success: false,
          error: 'User progress not found'
        },
        { status: 404 }
      );
    }

    // Delete favorite
    await prisma.favorite.delete({
      where: {
        userProgressId_problemId: {
          userProgressId: userProgress.id,
          problemId
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Favorite removed'
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

    console.error('Error removing favorite:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
