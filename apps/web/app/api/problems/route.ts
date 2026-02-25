/**
 * Problems API - List Problems
 *
 * GET /api/problems - List problems with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProblemManager } from '@/lib/cms/problem-manager';
import { ProblemListQuerySchema } from '@/lib/validations/learning';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Parse and validate query parameters
    const queryParams = {
      difficulty: searchParams.get('difficulty'),
      topicIds: searchParams.get('topicIds'),
      search: searchParams.get('search'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder')
    };

    const filters = ProblemListQuerySchema.parse(queryParams);

    // Get problems from database
    const result = await ProblemManager.getProblems(filters);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues
        },
        { status: 400 }
      );
    }

    console.error('Error fetching problems:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
