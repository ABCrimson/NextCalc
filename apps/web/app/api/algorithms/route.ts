/**
 * Algorithms API
 *
 * GET /api/algorithms - Get algorithms with filtering
 */

import type { AlgorithmCategory } from '@nextcalc/database';
import { cacheLife, cacheTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cached read of the full algorithm catalog.
 *
 * The catalog is static reference content, so the complete dataset is cached
 * (`'use cache'` + hourly revalidation, invalidatable via the `algorithms`
 * tag) while query-param filtering and pagination stay per-request.
 */
async function getAlgorithmCatalog() {
  'use cache';
  cacheLife('hours');
  cacheTag('algorithms');

  return prisma.algorithm.findMany({
    include: {
      _count: {
        select: {
          implementations: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const category = searchParams.get('category') as AlgorithmCategory | null;
    const search = searchParams.get('search')?.toLowerCase() ?? null;
    const limit = Number(searchParams.get('limit')) || 50;
    const offset = Number(searchParams.get('offset')) || 0;

    const catalog = await getAlgorithmCatalog();

    const filtered = catalog.filter((algorithm) => {
      if (category && algorithm.category !== category) return false;
      if (search) {
        return (
          algorithm.name.toLowerCase().includes(search) ||
          algorithm.description.toLowerCase().includes(search)
        );
      }
      return true;
    });

    const total = filtered.length;
    const algorithms = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        algorithms,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching algorithms:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
