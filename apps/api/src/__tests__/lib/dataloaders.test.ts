/**
 * DataLoaders Unit Tests
 *
 * Tests all 11 DataLoader instances returned by createDataLoaders() by:
 * - Mocking PrismaClient with vi.fn() for each model method used
 * - Verifying correct data mapping for single and batched IDs
 * - Ensuring null/empty defaults for missing records
 * - Verifying ID-order preservation in results
 * - Testing compound key parsing for hasUpvoted
 * - Testing DataLoader's built-in deduplication
 */

import DataLoader from 'dataloader';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataLoaders } from '../../lib/dataloaders';
import { createDataLoaders } from '../../lib/dataloaders';

// ---------------------------------------------------------------------------
// Mock PrismaClient factory
// ---------------------------------------------------------------------------

/**
 * Builds a mock PrismaClient that exposes vi.fn() stubs for every model
 * method that dataloaders.ts calls. Typed so we never need `as any`.
 */
function createMockPrisma() {
  return {
    user: {
      findMany: vi.fn(),
    },
    folder: {
      findMany: vi.fn(),
    },
    worksheetShare: {
      findMany: vi.fn(),
    },
    worksheet: {
      findMany: vi.fn(),
    },
    upvote: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    forumPost: {
      findMany: vi.fn(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-04T00:00:00.000Z');

function makeUser(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    name: `User ${id}`,
    image: null,
    bio: null,
    role: 'USER' as const,
    emailVerified: null,
    tokenVersion: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeFolder(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Folder ${id}`,
    description: null,
    parentId: null,
    userId: 'user1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeWorksheetShare(id: string, worksheetId: string) {
  return {
    id,
    worksheetId,
    sharedWith: `shared-${id}@example.com`,
    permission: 'VIEW' as const,
    createdAt: NOW,
  };
}

function makeForumPost(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Post ${id}`,
    content: `Content for post ${id}`,
    tags: ['test'],
    views: 0,
    isPinned: false,
    isClosed: false,
    userId: 'user1',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function makeComment(id: string, postId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    content: `Comment ${id}`,
    postId,
    userId: 'user1',
    parentId: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function makeWorksheet(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Worksheet ${id}`,
    description: null,
    content: { cells: [] },
    visibility: 'PRIVATE' as const,
    folderId: null,
    userId: 'user1',
    views: 0,
    version: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createDataLoaders', () => {
  let prisma: MockPrisma;
  let loaders: DataLoaders;

  beforeEach(() => {
    prisma = createMockPrisma();
    // PrismaClient type requires many models we don't use in dataloaders;
    // cast through unknown to satisfy the function signature without `as any`.
    loaders = createDataLoaders(prisma as unknown as Parameters<typeof createDataLoaders>[0]);
  });

  // =========================================================================
  // userById
  // =========================================================================

  describe('userById', () => {
    it('returns the correct user for a single ID', async () => {
      const user = makeUser('u1');
      prisma.user.findMany.mockResolvedValueOnce([user]);

      const result = await loaders.userById.load('u1');

      expect(result).toEqual(user);
      expect(prisma.user.findMany).toHaveBeenCalledOnce();
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1'] } },
      });
    });

    it('batches multiple IDs into a single query', async () => {
      const u1 = makeUser('u1');
      const u2 = makeUser('u2');
      const u3 = makeUser('u3');
      prisma.user.findMany.mockResolvedValueOnce([u2, u1, u3]);

      const [r1, r2, r3] = await Promise.all([
        loaders.userById.load('u1'),
        loaders.userById.load('u2'),
        loaders.userById.load('u3'),
      ]);

      expect(r1).toEqual(u1);
      expect(r2).toEqual(u2);
      expect(r3).toEqual(u3);
      // DataLoader batches into a single findMany call
      expect(prisma.user.findMany).toHaveBeenCalledOnce();
    });

    it('preserves ID order and returns null for missing IDs', async () => {
      const u1 = makeUser('u1');
      // u2 does not exist in the database
      prisma.user.findMany.mockResolvedValueOnce([u1]);

      const [r1, r2] = await Promise.all([
        loaders.userById.load('u1'),
        loaders.userById.load('u2'),
      ]);

      expect(r1).toEqual(u1);
      expect(r2).toBeNull();
    });

    it('deduplicates identical IDs within the same batch', async () => {
      const u1 = makeUser('u1');
      prisma.user.findMany.mockResolvedValueOnce([u1]);

      const [r1, r2] = await Promise.all([
        loaders.userById.load('u1'),
        loaders.userById.load('u1'),
      ]);

      expect(r1).toEqual(u1);
      expect(r2).toEqual(u1);
      expect(prisma.user.findMany).toHaveBeenCalledOnce();
      // DataLoader deduplicates, so `in` array should contain 'u1' only once
      const callArgs = prisma.user.findMany.mock.calls[0]?.[0] as {
        where: { id: { in: string[] } };
      };
      expect(callArgs.where.id.in).toHaveLength(1);
    });
  });

  // =========================================================================
  // folderById
  // =========================================================================

  describe('folderById', () => {
    it('returns the correct folder for a single ID', async () => {
      const folder = makeFolder('f1');
      prisma.folder.findMany.mockResolvedValueOnce([folder]);

      const result = await loaders.folderById.load('f1');

      expect(result).toEqual(folder);
    });

    it('batches and preserves order, returning null for missing IDs', async () => {
      const f1 = makeFolder('f1');
      const f3 = makeFolder('f3');
      // f2 is missing
      prisma.folder.findMany.mockResolvedValueOnce([f3, f1]);

      const [r1, r2, r3] = await Promise.all([
        loaders.folderById.load('f1'),
        loaders.folderById.load('f2'),
        loaders.folderById.load('f3'),
      ]);

      expect(r1).toEqual(f1);
      expect(r2).toBeNull();
      expect(r3).toEqual(f3);
      expect(prisma.folder.findMany).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // worksheetSharesByWorksheetId
  // =========================================================================

  describe('worksheetSharesByWorksheetId', () => {
    it('returns shares grouped by worksheetId', async () => {
      const s1 = makeWorksheetShare('s1', 'ws1');
      const s2 = makeWorksheetShare('s2', 'ws1');
      const s3 = makeWorksheetShare('s3', 'ws2');
      prisma.worksheetShare.findMany.mockResolvedValueOnce([s1, s2, s3]);

      const [r1, r2] = await Promise.all([
        loaders.worksheetSharesByWorksheetId.load('ws1'),
        loaders.worksheetSharesByWorksheetId.load('ws2'),
      ]);

      expect(r1).toEqual([s1, s2]);
      expect(r2).toEqual([s3]);
    });

    it('returns empty array for worksheets with no shares', async () => {
      prisma.worksheetShare.findMany.mockResolvedValueOnce([]);

      const result = await loaders.worksheetSharesByWorksheetId.load('ws-none');

      expect(result).toEqual([]);
    });

    it('batches into a single query', async () => {
      prisma.worksheetShare.findMany.mockResolvedValueOnce([]);

      await Promise.all([
        loaders.worksheetSharesByWorksheetId.load('ws1'),
        loaders.worksheetSharesByWorksheetId.load('ws2'),
        loaders.worksheetSharesByWorksheetId.load('ws3'),
      ]);

      expect(prisma.worksheetShare.findMany).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // childFoldersByParentId
  // =========================================================================

  describe('childFoldersByParentId', () => {
    it('returns child folders grouped by parentId', async () => {
      const c1 = makeFolder('c1', { parentId: 'p1', name: 'Alpha' });
      const c2 = makeFolder('c2', { parentId: 'p1', name: 'Beta' });
      const c3 = makeFolder('c3', { parentId: 'p2', name: 'Gamma' });
      prisma.folder.findMany.mockResolvedValueOnce([c1, c2, c3]);

      const [r1, r2] = await Promise.all([
        loaders.childFoldersByParentId.load('p1'),
        loaders.childFoldersByParentId.load('p2'),
      ]);

      expect(r1).toEqual([c1, c2]);
      expect(r2).toEqual([c3]);
    });

    it('returns empty array for parentIds with no children', async () => {
      prisma.folder.findMany.mockResolvedValueOnce([]);

      const result = await loaders.childFoldersByParentId.load('p-empty');

      expect(result).toEqual([]);
    });

    it('requests results ordered by name ascending', async () => {
      prisma.folder.findMany.mockResolvedValueOnce([]);

      await loaders.childFoldersByParentId.load('p1');

      expect(prisma.folder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('filters out folders with null parentId', async () => {
      // Edge case: findMany could return a folder with parentId: null
      // if the query engine is loose. The loader filters these out.
      const withParent = makeFolder('c1', { parentId: 'p1' });
      const withoutParent = makeFolder('c2', { parentId: null });
      prisma.folder.findMany.mockResolvedValueOnce([withParent, withoutParent]);

      const result = await loaders.childFoldersByParentId.load('p1');

      expect(result).toEqual([withParent]);
    });
  });

  // =========================================================================
  // upvoteCountByTargetId
  // =========================================================================

  describe('upvoteCountByTargetId', () => {
    it('returns the upvote count for a single target', async () => {
      prisma.upvote.groupBy.mockResolvedValueOnce([
        { targetId: 't1', _count: { id: 5 } },
      ]);

      const result = await loaders.upvoteCountByTargetId.load('t1');

      expect(result).toBe(5);
    });

    it('batches and returns 0 for targets with no upvotes', async () => {
      prisma.upvote.groupBy.mockResolvedValueOnce([
        { targetId: 't1', _count: { id: 3 } },
        // t2 is missing from results
      ]);

      const [r1, r2] = await Promise.all([
        loaders.upvoteCountByTargetId.load('t1'),
        loaders.upvoteCountByTargetId.load('t2'),
      ]);

      expect(r1).toBe(3);
      expect(r2).toBe(0);
      expect(prisma.upvote.groupBy).toHaveBeenCalledOnce();
    });

    it('uses groupBy with the correct parameters', async () => {
      prisma.upvote.groupBy.mockResolvedValueOnce([]);

      await loaders.upvoteCountByTargetId.load('t1');

      expect(prisma.upvote.groupBy).toHaveBeenCalledWith({
        by: ['targetId'],
        where: { targetId: { in: ['t1'] } },
        _count: { id: true },
      });
    });
  });

  // =========================================================================
  // commentCountByPostId
  // =========================================================================

  describe('commentCountByPostId', () => {
    it('returns the comment count for a single post', async () => {
      prisma.comment.groupBy.mockResolvedValueOnce([
        { postId: 'p1', _count: { id: 12 } },
      ]);

      const result = await loaders.commentCountByPostId.load('p1');

      expect(result).toBe(12);
    });

    it('batches and returns 0 for posts with no comments', async () => {
      prisma.comment.groupBy.mockResolvedValueOnce([
        { postId: 'p1', _count: { id: 7 } },
      ]);

      const [r1, r2] = await Promise.all([
        loaders.commentCountByPostId.load('p1'),
        loaders.commentCountByPostId.load('p2'),
      ]);

      expect(r1).toBe(7);
      expect(r2).toBe(0);
      expect(prisma.comment.groupBy).toHaveBeenCalledOnce();
    });

    it('filters for non-deleted comments (deletedAt: null)', async () => {
      prisma.comment.groupBy.mockResolvedValueOnce([]);

      await loaders.commentCountByPostId.load('p1');

      expect(prisma.comment.groupBy).toHaveBeenCalledWith({
        by: ['postId'],
        where: { postId: { in: ['p1'] }, deletedAt: null },
        _count: { id: true },
      });
    });
  });

  // =========================================================================
  // forumPostById
  // =========================================================================

  describe('forumPostById', () => {
    it('returns the correct forum post for a single ID', async () => {
      const post = makeForumPost('fp1');
      prisma.forumPost.findMany.mockResolvedValueOnce([post]);

      const result = await loaders.forumPostById.load('fp1');

      expect(result).toEqual(post);
    });

    it('batches and preserves order, returning null for missing posts', async () => {
      const fp1 = makeForumPost('fp1');
      const fp3 = makeForumPost('fp3');
      prisma.forumPost.findMany.mockResolvedValueOnce([fp3, fp1]);

      const [r1, r2, r3] = await Promise.all([
        loaders.forumPostById.load('fp1'),
        loaders.forumPostById.load('fp2'),
        loaders.forumPostById.load('fp3'),
      ]);

      expect(r1).toEqual(fp1);
      expect(r2).toBeNull();
      expect(r3).toEqual(fp3);
      expect(prisma.forumPost.findMany).toHaveBeenCalledOnce();
    });

    it('deduplicates identical IDs', async () => {
      const fp1 = makeForumPost('fp1');
      prisma.forumPost.findMany.mockResolvedValueOnce([fp1]);

      const [r1, r2] = await Promise.all([
        loaders.forumPostById.load('fp1'),
        loaders.forumPostById.load('fp1'),
      ]);

      expect(r1).toEqual(fp1);
      expect(r2).toEqual(fp1);
      expect(prisma.forumPost.findMany).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // commentById
  // =========================================================================

  describe('commentById', () => {
    it('returns the correct comment for a single ID', async () => {
      const comment = makeComment('c1', 'p1');
      prisma.comment.findMany.mockResolvedValueOnce([comment]);

      const result = await loaders.commentById.load('c1');

      expect(result).toEqual(comment);
    });

    it('batches and returns null for missing comments', async () => {
      const c1 = makeComment('c1', 'p1');
      prisma.comment.findMany.mockResolvedValueOnce([c1]);

      const [r1, r2] = await Promise.all([
        loaders.commentById.load('c1'),
        loaders.commentById.load('c2'),
      ]);

      expect(r1).toEqual(c1);
      expect(r2).toBeNull();
      expect(prisma.comment.findMany).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // repliesByParentCommentId
  // =========================================================================

  describe('repliesByParentCommentId', () => {
    it('returns replies grouped by parentId', async () => {
      const r1 = makeComment('r1', 'p1', { parentId: 'parent1' });
      const r2 = makeComment('r2', 'p1', { parentId: 'parent1' });
      const r3 = makeComment('r3', 'p1', { parentId: 'parent2' });
      prisma.comment.findMany.mockResolvedValueOnce([r1, r2, r3]);

      const [result1, result2] = await Promise.all([
        loaders.repliesByParentCommentId.load('parent1'),
        loaders.repliesByParentCommentId.load('parent2'),
      ]);

      expect(result1).toEqual([r1, r2]);
      expect(result2).toEqual([r3]);
    });

    it('returns empty array for parent comments with no replies', async () => {
      prisma.comment.findMany.mockResolvedValueOnce([]);

      const result = await loaders.repliesByParentCommentId.load('parent-no-replies');

      expect(result).toEqual([]);
    });

    it('filters for non-deleted replies and orders by createdAt asc', async () => {
      prisma.comment.findMany.mockResolvedValueOnce([]);

      await loaders.repliesByParentCommentId.load('parent1');

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('filters out replies with null parentId', async () => {
      const withParent = makeComment('r1', 'p1', { parentId: 'parent1' });
      const orphan = makeComment('r2', 'p1', { parentId: null });
      prisma.comment.findMany.mockResolvedValueOnce([withParent, orphan]);

      const result = await loaders.repliesByParentCommentId.load('parent1');

      expect(result).toEqual([withParent]);
    });
  });

  // =========================================================================
  // worksheetsByFolderId
  // =========================================================================

  describe('worksheetsByFolderId', () => {
    it('returns worksheets grouped by folderId', async () => {
      const w1 = makeWorksheet('w1', { folderId: 'f1' });
      const w2 = makeWorksheet('w2', { folderId: 'f1' });
      const w3 = makeWorksheet('w3', { folderId: 'f2' });
      prisma.worksheet.findMany.mockResolvedValueOnce([w1, w2, w3]);

      const [r1, r2] = await Promise.all([
        loaders.worksheetsByFolderId.load('f1'),
        loaders.worksheetsByFolderId.load('f2'),
      ]);

      expect(r1).toEqual([w1, w2]);
      expect(r2).toEqual([w3]);
    });

    it('returns empty array for folders with no worksheets', async () => {
      prisma.worksheet.findMany.mockResolvedValueOnce([]);

      const result = await loaders.worksheetsByFolderId.load('f-empty');

      expect(result).toEqual([]);
    });

    it('filters for non-deleted worksheets and orders by updatedAt desc', async () => {
      prisma.worksheet.findMany.mockResolvedValueOnce([]);

      await loaders.worksheetsByFolderId.load('f1');

      expect(prisma.worksheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('filters out worksheets with null folderId', async () => {
      const inFolder = makeWorksheet('w1', { folderId: 'f1' });
      const noFolder = makeWorksheet('w2', { folderId: null });
      prisma.worksheet.findMany.mockResolvedValueOnce([inFolder, noFolder]);

      const result = await loaders.worksheetsByFolderId.load('f1');

      expect(result).toEqual([inFolder]);
    });
  });

  // =========================================================================
  // hasUpvoted
  // =========================================================================

  describe('hasUpvoted', () => {
    it('returns true when the user has upvoted the target', async () => {
      prisma.upvote.findMany.mockResolvedValueOnce([
        { userId: 'u1', targetId: 't1', targetType: 'POST' },
      ]);

      const result = await loaders.hasUpvoted.load('u1:t1:POST');

      expect(result).toBe(true);
    });

    it('returns false when the user has not upvoted the target', async () => {
      prisma.upvote.findMany.mockResolvedValueOnce([]);

      const result = await loaders.hasUpvoted.load('u1:t1:POST');

      expect(result).toBe(false);
    });

    it('correctly parses compound keys with userId:targetId:targetType format', async () => {
      prisma.upvote.findMany.mockResolvedValueOnce([
        { userId: 'user-abc', targetId: 'post-123', targetType: 'POST' },
      ]);

      const result = await loaders.hasUpvoted.load('user-abc:post-123:POST');

      expect(result).toBe(true);
      expect(prisma.upvote.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ['user-abc'] },
          targetId: { in: ['post-123'] },
        },
        select: { userId: true, targetId: true, targetType: true },
      });
    });

    it('batches multiple hasUpvoted checks into a single query', async () => {
      prisma.upvote.findMany.mockResolvedValueOnce([
        { userId: 'u1', targetId: 't1', targetType: 'POST' },
        { userId: 'u2', targetId: 't2', targetType: 'COMMENT' },
      ]);

      const [r1, r2, r3] = await Promise.all([
        loaders.hasUpvoted.load('u1:t1:POST'),
        loaders.hasUpvoted.load('u2:t2:COMMENT'),
        loaders.hasUpvoted.load('u1:t3:POST'), // u1 has not upvoted t3
      ]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(false);
      expect(prisma.upvote.findMany).toHaveBeenCalledOnce();
    });

    it('deduplicates unique user and target IDs in the query', async () => {
      prisma.upvote.findMany.mockResolvedValueOnce([
        { userId: 'u1', targetId: 't1', targetType: 'POST' },
        { userId: 'u1', targetId: 't2', targetType: 'POST' },
      ]);

      await Promise.all([
        loaders.hasUpvoted.load('u1:t1:POST'),
        loaders.hasUpvoted.load('u1:t2:POST'),
      ]);

      // Both keys share userId 'u1', so unique user IDs should contain it once
      const callArgs = prisma.upvote.findMany.mock.calls[0]?.[0] as {
        where: { userId: { in: string[] }; targetId: { in: string[] } };
      };
      expect(callArgs.where.userId.in).toEqual(['u1']);
      expect(callArgs.where.targetId.in).toHaveLength(2);
      expect(callArgs.where.targetId.in).toContain('t1');
      expect(callArgs.where.targetId.in).toContain('t2');
    });

    it('distinguishes between POST and COMMENT target types', async () => {
      // Same user and target but different types
      prisma.upvote.findMany.mockResolvedValueOnce([
        { userId: 'u1', targetId: 't1', targetType: 'POST' },
        // u1:t1:COMMENT is NOT in the results
      ]);

      const [postUpvote, commentUpvote] = await Promise.all([
        loaders.hasUpvoted.load('u1:t1:POST'),
        loaders.hasUpvoted.load('u1:t1:COMMENT'),
      ]);

      expect(postUpvote).toBe(true);
      expect(commentUpvote).toBe(false);
    });

    it('handles mixed results across multiple users and targets', async () => {
      prisma.upvote.findMany.mockResolvedValueOnce([
        { userId: 'u1', targetId: 'p1', targetType: 'POST' },
        { userId: 'u2', targetId: 'c1', targetType: 'COMMENT' },
        { userId: 'u3', targetId: 'p1', targetType: 'POST' },
      ]);

      const keys = [
        'u1:p1:POST',     // exists
        'u1:c1:COMMENT',  // not exists (u1 didn't upvote c1)
        'u2:c1:COMMENT',  // exists
        'u2:p1:POST',     // not exists (u2 didn't upvote p1)
        'u3:p1:POST',     // exists
        'u3:p2:POST',     // not exists (p2 not in results)
      ];

      const results = await Promise.all(keys.map((k) => loaders.hasUpvoted.load(k)));

      expect(results).toEqual([true, false, true, false, true, false]);
    });
  });

  // =========================================================================
  // Cross-cutting: DataLoader caching within a single instance
  // =========================================================================

  describe('DataLoader per-request caching', () => {
    it('caches results within the same DataLoader instance (no re-fetch)', async () => {
      const user = makeUser('u1');
      prisma.user.findMany.mockResolvedValueOnce([user]);

      // First load triggers the batch function
      const first = await loaders.userById.load('u1');
      // Second load should return the cached value without a new query
      const second = await loaders.userById.load('u1');

      expect(first).toEqual(user);
      expect(second).toEqual(user);
      expect(prisma.user.findMany).toHaveBeenCalledOnce();
    });

    it('fresh DataLoader instances do not share cache', async () => {
      const user = makeUser('u1');
      prisma.user.findMany.mockResolvedValue([user]);

      // Load from first set of loaders
      await loaders.userById.load('u1');

      // Create a new set of loaders (simulating a new request)
      const freshLoaders = createDataLoaders(
        prisma as unknown as Parameters<typeof createDataLoaders>[0],
      );
      await freshLoaders.userById.load('u1');

      // Both sets should have issued their own query
      expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Structure validation
  // =========================================================================

  describe('createDataLoaders return structure', () => {
    it('returns an object with all 11 DataLoader instances', () => {
      const loaderKeys: (keyof DataLoaders)[] = [
        'userById',
        'folderById',
        'worksheetSharesByWorksheetId',
        'childFoldersByParentId',
        'upvoteCountByTargetId',
        'commentCountByPostId',
        'forumPostById',
        'commentById',
        'repliesByParentCommentId',
        'worksheetsByFolderId',
        'hasUpvoted',
      ];

      for (const key of loaderKeys) {
        expect(loaders[key]).toBeDefined();
        expect(loaders[key]).toBeInstanceOf(DataLoader);
      }
    });
  });
});
