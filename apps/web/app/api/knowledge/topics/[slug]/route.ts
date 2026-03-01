/**
 * Topic Details API
 *
 * GET /api/knowledge/topics/[slug] - Get topic details
 */

import { type NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseManager } from '@/lib/cms/knowledge-base';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { params } = context;
  try {
    const { slug } = await params;

    const topic = await KnowledgeBaseManager.getTopicBySlug(slug);

    if (!topic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Topic not found',
        },
        { status: 404 },
      );
    }

    // Get topic path (breadcrumbs)
    const path = await KnowledgeBaseManager.getTopicPath(topic.id);

    return NextResponse.json({
      success: true,
      data: {
        ...topic,
        path,
      },
    });
  } catch (error) {
    console.error('Error fetching topic:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
