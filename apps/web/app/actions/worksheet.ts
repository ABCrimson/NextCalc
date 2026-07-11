'use server';

/**
 * Server Actions for Worksheet Database Persistence
 *
 * - saveWorksheet: autosave with optimistic concurrency (version check)
 * - loadWorksheet: load from DB with permission check
 * - deleteWorksheet: soft delete
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  DeleteWorksheetSchema,
  LoadWorksheetSchema,
  SaveWorksheetSchema,
  SetWorksheetVisibilitySchema,
} from '@/lib/validations/learning';
import type { ActionResult } from './problems';

// ---------------------------------------------------------------------------
// saveWorksheet
// ---------------------------------------------------------------------------

export interface SaveWorksheetResult {
  worksheetId: string;
  version: number;
  conflict?: boolean;
  serverVersion?: number;
}

export async function saveWorksheet(
  _prevState: ActionResult<SaveWorksheetResult>,
  formData: FormData,
): Promise<ActionResult<SaveWorksheetResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = SaveWorksheetSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to save worksheets' };
    }

    let cells: unknown;
    try {
      cells = JSON.parse(data.cells);
    } catch {
      return { success: false, error: 'Invalid cells JSON' };
    }

    if (!Array.isArray(cells)) {
      return { success: false, error: 'Cells must be an array' };
    }

    // Create new worksheet
    if (!data.worksheetId) {
      const worksheet = await prisma.worksheet.create({
        data: {
          title: data.title,
          content: cells,
          userId: session.user.id,
          version: 0,
        },
      });

      revalidatePath('/[locale]/worksheet', 'page');
      return {
        success: true,
        data: { worksheetId: worksheet.id, version: 0 },
      };
    }

    // Atomic update with ownership + version check in WHERE clause (prevents TOCTOU)
    try {
      const updated = await prisma.worksheet.update({
        where: {
          id: data.worksheetId,
          userId: session.user.id,
          version: data.expectedVersion,
          deletedAt: null,
        },
        data: {
          title: data.title,
          content: cells,
          version: { increment: 1 },
        },
      });

      return {
        success: true,
        data: { worksheetId: updated.id, version: updated.version },
      };
    } catch (e) {
      // Prisma P2025: record not found (version mismatch, deleted, or wrong owner)
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === 'P2025'
      ) {
        const current = await prisma.worksheet.findUnique({
          where: { id: data.worksheetId },
          select: { version: true },
        });
        if (current) {
          return {
            success: false,
            error: 'Worksheet was modified elsewhere',
            data: {
              worksheetId: data.worksheetId,
              version: current.version,
              conflict: true,
              serverVersion: current.version,
            },
          };
        }
        return { success: false, error: 'Worksheet not found' };
      }
      throw e;
    }
  } catch (error) {
    console.error('saveWorksheet error:', error);
    return { success: false, error: 'Failed to save worksheet' };
  }
}

// ---------------------------------------------------------------------------
// loadWorksheet
// ---------------------------------------------------------------------------

export interface LoadWorksheetResult {
  worksheetId: string;
  title: string;
  cells: unknown;
  version: number;
  /** True when the requesting session owns this worksheet (fork-on-open cue) */
  isOwner: boolean;
  /** Current gallery visibility (seeds the Publish toggle state) */
  visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
}

export async function loadWorksheet(
  _prevState: ActionResult<LoadWorksheetResult>,
  formData: FormData,
): Promise<ActionResult<LoadWorksheetResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = LoadWorksheetSchema.parse(raw);

    const worksheet = await prisma.worksheet.findUnique({
      where: { id: data.worksheetId },
      select: {
        id: true,
        title: true,
        content: true,
        version: true,
        visibility: true,
        userId: true,
        deletedAt: true,
        shares: { select: { sharedWith: true, permission: true } },
      },
    });

    if (!worksheet || worksheet.deletedAt) {
      return { success: false, error: 'Worksheet not found' };
    }

    // Check access
    const session = await auth();
    const userId = session?.user?.id;

    if (worksheet.visibility === 'PRIVATE') {
      if (!userId || worksheet.userId !== userId) {
        // Check shares
        const hasShare = userId && worksheet.shares.some((s) => s.sharedWith === userId);
        if (!hasShare) {
          return { success: false, error: 'Worksheet not found' };
        }
      }
    }

    return {
      success: true,
      data: {
        worksheetId: worksheet.id,
        title: worksheet.title,
        cells: worksheet.content,
        version: worksheet.version,
        isOwner: userId !== undefined && worksheet.userId === userId,
        visibility: worksheet.visibility,
      },
    };
  } catch (error) {
    console.error('loadWorksheet error:', error);
    return { success: false, error: 'Failed to load worksheet' };
  }
}

// ---------------------------------------------------------------------------
// deleteWorksheet
// ---------------------------------------------------------------------------

export interface DeleteWorksheetResult {
  worksheetId: string;
}

export async function deleteWorksheet(
  _prevState: ActionResult<DeleteWorksheetResult>,
  formData: FormData,
): Promise<ActionResult<DeleteWorksheetResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = DeleteWorksheetSchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to delete worksheets' };
    }

    const worksheet = await prisma.worksheet.findUnique({
      where: { id: data.worksheetId },
      select: { userId: true, deletedAt: true },
    });

    if (!worksheet || worksheet.deletedAt) {
      return { success: false, error: 'Worksheet not found' };
    }

    if (worksheet.userId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.worksheet.update({
      where: { id: data.worksheetId },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/[locale]/worksheet', 'page');
    return {
      success: true,
      data: { worksheetId: data.worksheetId },
    };
  } catch (error) {
    console.error('deleteWorksheet error:', error);
    return { success: false, error: 'Failed to delete worksheet' };
  }
}

// ---------------------------------------------------------------------------
// setWorksheetVisibility (publish / unpublish to the GPU Lab gallery)
// ---------------------------------------------------------------------------

export interface SetWorksheetVisibilityResult {
  worksheetId: string;
  visibility: 'PUBLIC' | 'PRIVATE';
}

export async function setWorksheetVisibility(
  _prevState: ActionResult<SetWorksheetVisibilityResult>,
  formData: FormData,
): Promise<ActionResult<SetWorksheetVisibilityResult>> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const data = SetWorksheetVisibilitySchema.parse(raw);

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Sign in to publish worksheets' };
    }

    // Atomic ownership check in the WHERE clause (same shape as saveWorksheet)
    try {
      const updated = await prisma.worksheet.update({
        where: {
          id: data.worksheetId,
          userId: session.user.id,
          deletedAt: null,
        },
        data: { visibility: data.visibility },
        select: { id: true },
      });

      // The public gallery lists PUBLIC worksheets — refresh it.
      revalidatePath('/[locale]/gpu-lab', 'page');

      return {
        success: true,
        data: { worksheetId: updated.id, visibility: data.visibility },
      };
    } catch (e) {
      // Prisma P2025: record not found (wrong owner or deleted)
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === 'P2025'
      ) {
        return { success: false, error: 'Worksheet not found' };
      }
      throw e;
    }
  } catch (error) {
    console.error('setWorksheetVisibility error:', error);
    return { success: false, error: 'Failed to update visibility' };
  }
}
