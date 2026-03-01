/**
 * Topics API
 *
 * GET /api/knowledge/topics - Get topic hierarchy
 */

import type { Category } from '@nextcalc/database';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { KnowledgeBaseManager } from '@/lib/cms/knowledge-base';
import { TopicQuerySchema } from '@/lib/validations/learning';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const queryParams = {
      category: searchParams.get('category'),
    };

    const { category } = TopicQuerySchema.parse(queryParams);

    // Get topic tree
    const topicTree = await KnowledgeBaseManager.getTopicTree(category as Category | undefined);

    return NextResponse.json({
      success: true,
      data: topicTree,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 },
      );
    }

    console.error('Error fetching topics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
