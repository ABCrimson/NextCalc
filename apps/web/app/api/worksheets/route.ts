import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/worksheets — List current user's worksheets
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ worksheets: [] });
  }

  const worksheets = await prisma.worksheet.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      views: true,
      version: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const mapped = worksheets.map((w) => ({
    id: w.id,
    title: w.title,
    description: w.description,
    visibility: w.visibility,
    views: w.views,
    version: w.version,
    cellCount: Array.isArray(w.content) ? w.content.length : 0,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }));

  return NextResponse.json({ worksheets: mapped });
}
