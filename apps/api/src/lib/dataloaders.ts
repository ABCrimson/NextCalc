/**
 * DataLoaders for N+1 Query Prevention
 *
 * Batches and caches database queries within a single request.
 * Each request gets fresh DataLoader instances (no cross-request caching).
 *
 * @see https://github.com/graphql/dataloader
 */

import type {
  Comment,
  Folder,
  ForumPost,
  PrismaClient,
  Upvote,
  User,
  Worksheet,
  WorksheetShare,
} from '@nextcalc/database';
import DataLoader from 'dataloader';

/**
 * Compound key for hasUpvoted DataLoader: "userId:targetId:targetType"
 */
function upvoteKey(userId: string, targetId: string, targetType: string): string {
  return `${userId}:${targetId}:${targetType}`;
}

export interface DataLoaders {
  userById: DataLoader<string, User | null>;
  folderById: DataLoader<string, Folder | null>;
  worksheetSharesByWorksheetId: DataLoader<string, WorksheetShare[]>;
  childFoldersByParentId: DataLoader<string, Folder[]>;
  upvoteCountByTargetId: DataLoader<string, number>;
  commentCountByPostId: DataLoader<string, number>;
  forumPostById: DataLoader<string, ForumPost | null>;
  commentById: DataLoader<string, Comment | null>;
  repliesByParentCommentId: DataLoader<string, Comment[]>;
  worksheetsByFolderId: DataLoader<string, Worksheet[]>;
  /** Batched hasUpvoted check. Key format: "userId:targetId:targetType" */
  hasUpvoted: DataLoader<string, boolean>;
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

    commentCountByPostId: new DataLoader<string, number>(async (postIds) => {
      const counts = await prisma.comment.groupBy({
        by: ['postId'],
        where: { postId: { in: [...postIds] }, deletedAt: null },
        _count: { id: true },
      });
      const countMap = new Map(counts.map((c) => [c.postId, c._count.id]));
      return postIds.map((id) => countMap.get(id) ?? 0);
    }),

    forumPostById: new DataLoader<string, ForumPost | null>(async (ids) => {
      const posts = await prisma.forumPost.findMany({
        where: { id: { in: [...ids] } },
      });
      const postMap = new Map(posts.map((p) => [p.id, p]));
      return ids.map((id) => postMap.get(id) ?? null);
    }),

    commentById: new DataLoader<string, Comment | null>(async (ids) => {
      const comments = await prisma.comment.findMany({
        where: { id: { in: [...ids] } },
      });
      const commentMap = new Map(comments.map((c) => [c.id, c]));
      return ids.map((id) => commentMap.get(id) ?? null);
    }),

    repliesByParentCommentId: new DataLoader<string, Comment[]>(async (parentIds) => {
      const replies = await prisma.comment.findMany({
        where: { parentId: { in: [...parentIds] }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      const repliesMap = new Map<string, Comment[]>();
      for (const reply of replies) {
        if (reply.parentId) {
          const existing = repliesMap.get(reply.parentId) ?? [];
          existing.push(reply);
          repliesMap.set(reply.parentId, existing);
        }
      }
      return parentIds.map((id) => repliesMap.get(id) ?? []);
    }),

    worksheetsByFolderId: new DataLoader<string, Worksheet[]>(async (folderIds) => {
      const worksheets = await prisma.worksheet.findMany({
        where: { folderId: { in: [...folderIds] }, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      const worksheetMap = new Map<string, Worksheet[]>();
      for (const worksheet of worksheets) {
        if (worksheet.folderId) {
          const existing = worksheetMap.get(worksheet.folderId) ?? [];
          existing.push(worksheet);
          worksheetMap.set(worksheet.folderId, existing);
        }
      }
      return folderIds.map((id) => worksheetMap.get(id) ?? []);
    }),

    hasUpvoted: new DataLoader<string, boolean>(async (keys) => {
      // Parse compound keys back to components
      const parsed = keys.map((k) => {
        const [userId, targetId, targetType] = k.split(':') as [string, string, string];
        return { userId, targetId, targetType };
      });

      // Batch query: find all upvotes matching any (userId, targetId, targetType) combo
      // Group by unique userId to minimize queries
      const uniqueUserIds = [...new Set(parsed.map((p) => p.userId))];
      const uniqueTargetIds = [...new Set(parsed.map((p) => p.targetId))];

      const upvotes = await prisma.upvote.findMany({
        where: {
          userId: { in: uniqueUserIds },
          targetId: { in: uniqueTargetIds },
        },
        select: { userId: true, targetId: true, targetType: true },
      });

      const upvoteSet = new Set(
        upvotes.map((u: Pick<Upvote, 'userId' | 'targetId' | 'targetType'>) =>
          upvoteKey(u.userId, u.targetId, u.targetType),
        ),
      );

      return keys.map((k) => upvoteSet.has(k));
    }),
  };
}
