'use server';

/**
 * Server Actions for Profile
 *
 * - setAvatarIcon: owner-only (role ADMIN) — sets one of the whitelisted
 *   level icons (`/icons/levels/*.svg`) as the user's avatar (`User.image`).
 */

import { UserRole } from '@nextcalc/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAvatarIconPath } from '@/lib/profile/avatar-icons';
import type { ActionResult } from './problems';

// ---------------------------------------------------------------------------
// setAvatarIcon
// ---------------------------------------------------------------------------

const SetAvatarIconSchema = z.object({
  // Whitelist, not a sanitizer: anything that is not exactly one of the
  // catalogued /icons/levels/*.svg paths is rejected outright.
  iconPath: z.string().refine(isAvatarIconPath, 'Not a whitelisted avatar icon path'),
});

export interface SetAvatarIconResult {
  image: string;
}

export async function setAvatarIcon(iconPath: string): Promise<ActionResult<SetAvatarIconResult>> {
  try {
    const parsed = SetAvatarIconSchema.safeParse({ iconPath });
    if (!parsed.success) {
      return { success: false, error: 'Invalid avatar icon' };
    }

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to change your avatar' };
    }

    // Server-side ADMIN gate — the role is read fresh from the database,
    // never from anything the client (or even the session token) supplied.
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser?.role !== UserRole.ADMIN) {
      return { success: false, error: 'Only the site owner can set an avatar icon' };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: parsed.data.iconPath },
    });

    revalidatePath('/[locale]/profile', 'page');
    return { success: true, data: { image: parsed.data.iconPath } };
  } catch (error) {
    console.error('setAvatarIcon error:', error);
    return { success: false, error: 'Failed to update avatar icon' };
  }
}
