'use server';

/**
 * Server Actions for Learning Bookmarks
 *
 * Toggles definition bookmarks using the polymorphic Favorite model.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { BookmarkToggleSchema } from '@/lib/validations/learning';
import type { ActionResult } from './problems';
import { getOrCreateUserProgress } from './problems';

// ---------------------------------------------------------------------------
// toggleBookmark
// ---------------------------------------------------------------------------

export interface ToggleBookmarkResult {
  isBookmarked: boolean;
}

export async function toggleBookmark(
  _prevState: ActionResult<ToggleBookmarkResult>,
  formData: FormData,
): Promise<ActionResult<ToggleBookmarkResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = BookmarkToggleSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save bookmarks' };
    }

    const userProgress = await getOrCreateUserProgress(session.user.id);

    // Check if already bookmarked
    const existing = await prisma.favorite.findUnique({
      where: {
        userProgressId_definitionId: {
          userProgressId: userProgress.id,
          definitionId: data.definitionId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidatePath('/learn');
      return { success: true, data: { isBookmarked: false } };
    }

    await prisma.favorite.create({
      data: {
        userProgressId: userProgress.id,
        resourceType: 'DEFINITION',
        definitionId: data.definitionId,
      },
    });

    revalidatePath('/learn');
    return { success: true, data: { isBookmarked: true } };
  } catch (error) {
    console.error('toggleBookmark error:', error);
    return { success: false, error: 'Failed to toggle bookmark' };
  }
}
