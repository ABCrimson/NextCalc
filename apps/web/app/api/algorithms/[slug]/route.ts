/**
 * Algorithm Details API
 *
 * GET /api/algorithms/[slug] - Get algorithm details
 */

import { cacheLife, cacheTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { AlgorithmRepository } from '@/lib/cms/algorithm-repository';

/**
 * Cached read of a single algorithm (plus recommendations), keyed by slug.
 *
 * Reference content — cached hourly and invalidatable via the `algorithms`
 * tag.
 */
async function getAlgorithmDetail(slug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('algorithms');

  const algorithm = await AlgorithmRepository.getAlgorithmBySlug(slug);
  if (!algorithm) {
    return null;
  }

  // Get recommended similar algorithms
  const recommended = await AlgorithmRepository.getRecommendedAlgorithms(
    algorithm.category,
    algorithm.id,
    5,
  );

  return { ...algorithm, recommended };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { params } = context;
  try {
    const { slug } = await params;

    const data = await getAlgorithmDetail(slug);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Algorithm not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching algorithm:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
