/**
 * DataLoaders for N+1 Query Prevention
 *
 * Batches and caches database queries within a single request.
 * Each request gets fresh DataLoader instances (no cross-request caching).
 *
 * @see https://github.com/graphql/dataloader
 */

import type { Folder, PrismaClient, User, WorksheetShare } from '@nextcalc/database';
import DataLoader from 'dataloader';

export interface DataLoaders {
  userById: DataLoader<string, User | null>;
  folderById: DataLoader<string, Folder | null>;
  worksheetSharesByWorksheetId: DataLoader<string, WorksheetShare[]>;
  childFoldersByParentId: DataLoader<string, Folder[]>;
  upvoteCountByTargetId: DataLoader<string, number>;
}

export function createDataLoaders(prisma: PrismaClient): DataLoaders {
  return {
    userById: new DataLoader<string, User | null>(async (ids) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...ids] } },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => userMap.get(id) ?? null);
    }),

    folderById: new DataLoader<string, Folder | null>(async (ids) => {
      const folders = await prisma.folder.findMany({
        where: { id: { in: [...ids] } },
      });
      const folderMap = new Map(folders.map((f) => [f.id, f]));
      return ids.map((id) => folderMap.get(id) ?? null);
    }),

    worksheetSharesByWorksheetId: new DataLoader<string, WorksheetShare[]>(async (worksheetIds) => {
      const shares = await prisma.worksheetShare.findMany({
        where: { worksheetId: { in: [...worksheetIds] } },
      });
      const shareMap = new Map<string, WorksheetShare[]>();
      for (const share of shares) {
        const existing = shareMap.get(share.worksheetId) ?? [];
        existing.push(share);
        shareMap.set(share.worksheetId, existing);
      }
      return worksheetIds.map((id) => shareMap.get(id) ?? []);
    }),

    childFoldersByParentId: new DataLoader<string, Folder[]>(async (parentIds) => {
      const folders = await prisma.folder.findMany({
        where: { parentId: { in: [...parentIds] } },
        orderBy: { name: 'asc' },
      });
      const folderMap = new Map<string, Folder[]>();
      for (const folder of folders) {
        if (folder.parentId) {
          const existing = folderMap.get(folder.parentId) ?? [];
          existing.push(folder);
          folderMap.set(folder.parentId, existing);
        }
      }
      return parentIds.map((id) => folderMap.get(id) ?? []);
    }),

    upvoteCountByTargetId: new DataLoader<string, number>(async (targetIds) => {
      const counts = await prisma.upvote.groupBy({
        by: ['targetId'],
        where: { targetId: { in: [...targetIds] } },
        _count: { id: true },
      });
      const countMap = new Map(counts.map((c) => [c.targetId, c._count.id]));
      return targetIds.map((id) => countMap.get(id) ?? 0);
    }),
  };
}
