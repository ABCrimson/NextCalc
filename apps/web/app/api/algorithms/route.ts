/**
 * Algorithms API
 *
 * GET /api/algorithms - Get algorithms with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlgorithmRepository } from '@/lib/cms/algorithm-repository';
import type { AlgorithmCategory } from '@nextcalc/database';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = _request.nextUrl;

    const categoryParam = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Number(searchParams.get('limit')) || 50;
    const offset = Number(searchParams.get('offset')) || 0;

    const filters: Parameters<typeof AlgorithmRepository.getAlgorithms>[0] = {};

    if (categoryParam) filters.category = categoryParam as AlgorithmCategory;
    if (search) filters.search = search;
    if (limit) filters.limit = limit;
    if (offset) filters.offset = offset;

    const result = await AlgorithmRepository.getAlgorithms(filters);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching algorithms:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
