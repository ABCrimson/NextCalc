import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/worksheets/:id — Soft-delete a worksheet
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const worksheet = await prisma.worksheet.findUnique({
    where: { id },
    select: { userId: true, deletedAt: true },
  });

  if (!worksheet || worksheet.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (worksheet.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.worksheet.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
