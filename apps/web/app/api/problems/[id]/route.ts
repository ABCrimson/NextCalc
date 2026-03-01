/**
 * Problem Details API
 *
 * GET /api/problems/[id] - Get problem details by ID or slug
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ProblemManager } from '@/lib/cms/problem-manager';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { params } = context;
  try {
    const { id } = await params;

    // Check authentication for admin features
    const session = await auth();
    const isAdmin = session?.user?.role === 'ADMIN';

    // Try to get by slug first, then by ID
    const problem =
      (await ProblemManager.getProblemBySlug(id, isAdmin)) ||
      (await ProblemManager.getProblemById(id, isAdmin));

    if (!problem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Problem not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: problem,
    });
  } catch (error) {
    console.error('Error fetching problem:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
