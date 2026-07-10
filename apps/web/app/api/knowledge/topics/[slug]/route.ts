/**
 * Topic Details API
 *
 * GET /api/knowledge/topics/[slug] - Get topic details
 */

import { cacheLife, cacheTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseManager } from '@/lib/cms/knowledge-base';

/**
 * Cached read of a single topic (plus breadcrumb path), keyed by slug.
 *
 * Reference content — cached hourly and invalidatable via the `knowledge`
 * tag.
 */
async function getTopicDetail(slug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('knowledge');

  const topic = await KnowledgeBaseManager.getTopicBySlug(slug);
  if (!topic) {
    return null;
  }

  // Get topic path (breadcrumbs)
  const path = await KnowledgeBaseManager.getTopicPath(topic.id);

  return { ...topic, path };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { params } = context;
  try {
    const { slug } = await params;

    const data = await getTopicDetail(slug);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Topic not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data,
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
