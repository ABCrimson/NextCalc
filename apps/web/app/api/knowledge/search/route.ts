/**
 * Knowledge Base Search API
 *
 * GET /api/knowledge/search - Search topics, theorems, and problems
 */

import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseManager } from '@/lib/cms/knowledge-base';
import { SearchQuerySchema } from '@/lib/validations/learning';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  try {

    const queryParams = {
      q: searchParams.get('q'),
      limit: searchParams.get('limit')
    };

    const { q, limit } = SearchQuerySchema.parse(queryParams);

    const results = await KnowledgeBaseManager.searchKnowledgeBase(q, limit);

    return NextResponse.json({
      success: true,
      data: {
        query: q,
        results,
        total: results.length
      }
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

    console.error('Error searching knowledge base:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
