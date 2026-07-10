import type { Metadata } from 'next';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { type WorksheetSummary, WorksheetsPageClient } from './worksheets-page-client';

export const metadata: Metadata = {
  title: 'My Worksheets',
  description: 'Your saved mathematical notebooks — search, organize, and manage worksheets.',
};

/**
 * My Worksheets page — Server Component.
 *
 * Loads the current user's worksheets directly on the server (mirroring
 * GET /api/worksheets) and seeds the interactive client shell with the data,
 * eliminating the client-side fetch waterfall.
 */
export default async function WorksheetsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  let worksheets: WorksheetSummary[] = [];

  if (userId) {
    const rows = await prisma.worksheet.findMany({
      where: {
        userId,
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

    worksheets = rows.map((w) => ({
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
  }

  return (
    <WorksheetsPageClient
      initialWorksheets={worksheets}
      user={userId ? { id: userId, name: session?.user?.name ?? null } : null}
    />
  );
}
