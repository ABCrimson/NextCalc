/**
 * Topics API
 *
 * GET /api/knowledge/topics - Get topic hierarchy
 */

import type { Category } from '@nextcalc/database';
import { cacheLife, cacheTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { KnowledgeBaseManager, type TopicNode } from '@/lib/cms/knowledge-base';
import { TopicQuerySchema } from '@/lib/validations/learning';

/**
 * Cached read of the full topic tree.
 *
 * The knowledge base is static reference content, so the complete tree is
 * cached (`'use cache'` + hourly revalidation, invalidatable via the
 * `knowledge` tag) while category filtering stays per-request.
 */
async function getFullTopicTree(): Promise<TopicNode[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('knowledge');

  return KnowledgeBaseManager.getTopicTree();
}

/**
 * Prune the cached tree to a single category. Mirrors the DB-level filter in
 * `getTopicTree(category)`: only topics of the category are kept, so a branch
 * ends as soon as a node stops matching.
 */
function pruneTreeByCategory(nodes: TopicNode[], category: Category): TopicNode[] {
  return nodes
    .filter((node) => node.category === category)
    .map((node) => ({ ...node, children: pruneTreeByCategory(node.children, category) }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const queryParams = {
      category: searchParams.get('category'),
    };

    const { category } = TopicQuerySchema.parse(queryParams);

    const fullTree = await getFullTopicTree();
    const topicTree = category ? pruneTreeByCategory(fullTree, category as Category) : fullTree;

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
