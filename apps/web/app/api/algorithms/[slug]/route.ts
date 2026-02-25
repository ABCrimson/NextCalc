/**
 * Algorithm Details API
 *
 * GET /api/algorithms/[slug] - Get algorithm details
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlgorithmRepository } from '@/lib/cms/algorithm-repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { params } = context;
  try {
    const { slug } = await params;

    const algorithm = await AlgorithmRepository.getAlgorithmBySlug(slug);

    if (!algorithm) {
      return NextResponse.json(
        {
          success: false,
          error: 'Algorithm not found'
        },
        { status: 404 }
      );
    }

    // Get recommended similar algorithms
    const recommended = await AlgorithmRepository.getRecommendedAlgorithms(
      algorithm.category,
      algorithm.id,
      5
    );

    return NextResponse.json({
      success: true,
      data: {
        ...algorithm,
        recommended
      }
    });
  } catch (error) {
    console.error('Error fetching algorithm:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
