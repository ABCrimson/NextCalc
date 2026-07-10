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
  worksheetById: DataLoader<string, Worksheet | null>;
  worksheetSharesByWorksheetId: DataLoader<string, WorksheetShare[]>;
  childFoldersByParentId: DataLoader<string, Folder[]>;
  upvoteCountByTargetId: DataLoader<string, number>;
  commentCountByPostId: DataLoader<string, number>;
  forumPostById: DataLoader<string, ForumPost | null>;
  commentById: DataLoader<string, Comment | null>;
  repliesByParentCommentId: DataLoader<string, Comment[]>;
  worksheetsByFolderId: DataLoader<string, Worksheet[]>;
  foldersByUserId: DataLoader<string, Folder[]>;
  forumPostsByUserId: DataLoader<string, ForumPost[]>;
  commentsByPostId: DataLoader<string, Comment[]>;
  /**
   * Batched User.worksheets default-args listing.
   * Key format: "userId:scope" where scope is "all" (owner/admin — every
   * non-deleted worksheet) or "public" (any other viewer — PUBLIC only).
   * The scope must be part of the key (rather than filtered client-side
   * after an unscoped fetch) so that a viewer restricted to PUBLIC results
   * doesn't miss public worksheets that fall outside the target's most
   * recent N non-public-filtered rows.
   */
  worksheetsByUserId: DataLoader<string, Worksheet[]>;
  /** Batched hasUpvoted check. Key format: "userId:targetId:targetType" */
  hasUpvoted: DataLoader<string, boolean>;
}

/** Default page size mirrored from the GraphQL schema's `limit: Int = 20` args. */
const DEFAULT_PAGE_SIZE = 20;

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

    worksheetById: new DataLoader<string, Worksheet | null>(async (ids) => {
      const worksheets = await prisma.worksheet.findMany({
        where: { id: { in: [...ids] } },
      });
      const worksheetMap = new Map(worksheets.map((w) => [w.id, w]));
      return ids.map((id) => worksheetMap.get(id) ?? null);
    }),

    worksheetSharesByWorksheetId: new DataLoader<string, WorksheetShare[]>(async (worksheetIds) => {
      const shares = await prisma.worksheetShare.findMany({
        where: { worksheetId: { in: [...worksheetIds] } },
      });
      const shareMap = Map.groupBy(shares, (s) => s.worksheetId);
      return worksheetIds.map((id) => shareMap.get(id) ?? []);
    }),

    childFoldersByParentId: new DataLoader<string, Folder[]>(async (parentIds) => {
      const folders = await prisma.folder.findMany({
        where: { parentId: { in: [...parentIds] } },
        orderBy: { name: 'asc' },
      });
      const folderMap = Map.groupBy(
        folders.filter((f): f is Folder & { parentId: string } => f.parentId !== null),
        (f) => f.parentId,
      );
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
      const repliesMap = Map.groupBy(
        replies.filter((r): r is Comment & { parentId: string } => r.parentId !== null),
        (r) => r.parentId,
      );
      return parentIds.map((id) => repliesMap.get(id) ?? []);
    }),

    worksheetsByFolderId: new DataLoader<string, Worksheet[]>(async (folderIds) => {
      const worksheets = await prisma.worksheet.findMany({
        where: { folderId: { in: [...folderIds] }, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      const worksheetMap = Map.groupBy(
        worksheets.filter((w): w is Worksheet & { folderId: string } => w.folderId !== null),
        (w) => w.folderId,
      );
      return folderIds.map((id) => worksheetMap.get(id) ?? []);
    }),

    foldersByUserId: new DataLoader<string, Folder[]>(async (userIds) => {
      const folders = await prisma.folder.findMany({
        where: { userId: { in: [...userIds] } },
        orderBy: { name: 'asc' },
      });
      const folderMap = Map.groupBy(folders, (f) => f.userId);
      return userIds.map((id) => (folderMap.get(id) ?? []).slice(0, 200));
    }),

    forumPostsByUserId: new DataLoader<string, ForumPost[]>(async (userIds) => {
      const posts = await prisma.forumPost.findMany({
        where: { userId: { in: [...userIds] }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      const postMap = Map.groupBy(posts, (p) => p.userId);
      return userIds.map((id) => (postMap.get(id) ?? []).slice(0, DEFAULT_PAGE_SIZE));
    }),

    commentsByPostId: new DataLoader<string, Comment[]>(async (postIds) => {
      const comments = await prisma.comment.findMany({
        where: { postId: { in: [...postIds] }, parentId: null, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      const commentMap = Map.groupBy(comments, (c) => c.postId);
      return postIds.map((id) => (commentMap.get(id) ?? []).slice(0, DEFAULT_PAGE_SIZE));
    }),

    worksheetsByUserId: new DataLoader<string, Worksheet[]>(async (compoundKeys) => {
      const parsed = compoundKeys.map((k) => {
        const [userId, scope] = k.split(':') as [string, 'all' | 'public'];
        return { userId, scope };
      });

      const allUserIds = [...new Set(parsed.filter((p) => p.scope === 'all').map((p) => p.userId))];
      const publicUserIds = [
        ...new Set(parsed.filter((p) => p.scope === 'public').map((p) => p.userId)),
      ];

      const [allWorksheets, publicWorksheets] = await Promise.all([
        allUserIds.length
          ? prisma.worksheet.findMany({
              where: { userId: { in: allUserIds }, deletedAt: null },
              orderBy: { updatedAt: 'desc' },
            })
          : [],
        publicUserIds.length
          ? prisma.worksheet.findMany({
              where: { userId: { in: publicUserIds }, deletedAt: null, visibility: 'PUBLIC' },
              orderBy: { updatedAt: 'desc' },
            })
          : [],
      ]);

      const allMap = Map.groupBy(allWorksheets, (w) => w.userId);
      const publicMap = Map.groupBy(publicWorksheets, (w) => w.userId);

      return compoundKeys.map((key) => {
        const [userId, scope] = key.split(':') as [string, 'all' | 'public'];
        const map = scope === 'all' ? allMap : publicMap;
        return (map.get(userId) ?? []).slice(0, DEFAULT_PAGE_SIZE);
      });
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
