/**
 * Resolver Unit Tests
 *
 * Tests all GraphQL resolver modules in isolation by:
 * - Mocking @prisma/client so no real database is required
 * - Mocking cache and subscription helpers so side-effects are silent
 * - Constructing lightweight GraphQLContext objects per auth scenario
 * - Calling resolver functions directly (no HTTP / Apollo overhead)
 *
 * Conventions used throughout:
 * - "user context"  = authenticated regular user
 * - "admin context" = authenticated admin user
 * - "anon context"  = unauthenticated (context.user is null)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks  (must be declared before any import that uses them)
// ---------------------------------------------------------------------------

// Silence PubSub and subscription publish helpers so worksheet mutations
// don't fail because there is no real event bus.
vi.mock('../lib/subscription', () => ({
  pubsub: { asyncIterableIterator: vi.fn(), publish: vi.fn() },
  SUBSCRIPTION_EVENTS: {
    WORKSHEET_UPDATED: 'WORKSHEET_UPDATED',
    USER_WORKSHEETS_CHANGED: 'USER_WORKSHEETS_CHANGED',
    CALCULATION_COMPLETED: 'CALCULATION_COMPLETED',
  },
  publishWorksheetUpdate: vi.fn().mockResolvedValue(undefined),
  publishUserWorksheetsChanged: vi.fn().mockResolvedValue(undefined),
  publishCalculationCompleted: vi.fn().mockResolvedValue(undefined),
  subscriptionFilters: {
    worksheetUpdated: vi.fn().mockReturnValue(true),
    userWorksheetsChanged: vi.fn().mockReturnValue(true),
  },
}));

// Silence Redis cache so cache/rate-limit calls are no-ops in tests.
vi.mock('../lib/cache', () => ({
  queryCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  },
  redisHealthCheck: vi.fn().mockResolvedValue({ status: 'healthy', latency: 1 }),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: new Date() }),
}));

// ---------------------------------------------------------------------------
// Resolver imports (after mocks are registered)
// ---------------------------------------------------------------------------
import { userResolvers } from '../graphql/resolvers/user';
import { worksheetResolvers } from '../graphql/resolvers/worksheet';
import { folderResolvers } from '../graphql/resolvers/folder';
import { calculationResolvers } from '../graphql/resolvers/calculation';
import { forumResolvers } from '../graphql/resolvers/forum';
import { commentResolvers } from '../graphql/resolvers/comment';
import { upvoteResolvers } from '../graphql/resolvers/upvote';
import type { GraphQLContext } from '../lib/context';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-18T00:00:00.000Z');

/** A minimal User record that matches the Prisma User model */
const mockUser = {
  id: 'user1',
  email: 'user@example.com',
  name: 'Test User',
  image: null,
  bio: null,
  role: 'USER' as const,
  emailVerified: null,
  tokenVersion: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

const mockAdmin = {
  ...mockUser,
  id: 'admin1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN' as const,
};

const mockOtherUser = {
  ...mockUser,
  id: 'user2',
  email: 'other@example.com',
  name: 'Other User',
};

const mockWorksheet = {
  id: 'ws1',
  title: 'My Worksheet',
  description: 'A test worksheet',
  content: { cells: [] },
  visibility: 'PRIVATE' as const,
  folderId: null,
  userId: 'user1',
  views: 0,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  user: mockUser,
  shares: [],
  folder: null,
};

const mockFolder = {
  id: 'folder1',
  name: 'My Folder',
  description: 'A test folder',
  parentId: null,
  userId: 'user1',
  createdAt: NOW,
  updatedAt: NOW,
  worksheets: [],
  children: [],
};

// CUIDs must be used anywhere Zod's z.cuid() validates them (createCommentSchema.postId/parentId)
const CUID_POST = 'clh4k2x3w0000qzrmabcd1234';
const CUID_COMMENT = 'clh4k2x3w0001qzrmefgh5678';
const CUID_PARENT_COMMENT = 'clh4k2x3w0002qzrmijkl9012';

const mockForumPost = {
  id: CUID_POST,
  title: 'My Forum Post',
  // Minimum 10 chars required by validation schema
  content: 'This is forum post content that is long enough',
  tags: ['math', 'calculus'],
  views: 0,
  isPinned: false,
  isClosed: false,
  userId: 'user1',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const mockComment = {
  id: CUID_COMMENT,
  content: 'A test comment',
  postId: CUID_POST,
  userId: 'user1',
  parentId: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const mockUpvote = {
  id: 'upvote1',
  userId: 'user1',
  targetId: CUID_POST,
  targetType: 'POST' as const,
  createdAt: NOW,
};

// ---------------------------------------------------------------------------
// Mock Prisma client factory
// Returned from createMockPrisma() so each test gets a fresh set of vi.fn()
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    worksheet: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    worksheetShare: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
    },
    folder: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    forumPost: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    upvote: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit1' }),
    },
  };
}

/** Mock DataLoaders – each loader exposes a .load() spy */
function createMockLoaders() {
  return {
    userById: { load: vi.fn().mockResolvedValue(mockUser) },
    folderById: { load: vi.fn().mockResolvedValue(mockFolder) },
    worksheetSharesByWorksheetId: { load: vi.fn().mockResolvedValue([]) },
    childFoldersByParentId: { load: vi.fn().mockResolvedValue([]) },
    upvoteCountByTargetId: { load: vi.fn().mockResolvedValue(0) },
  };
}

/** Build a full GraphQLContext from partial overrides */
function makeContext(
  overrides: Partial<GraphQLContext> & { user?: GraphQLContext['user'] } = {}
): GraphQLContext {
  return {
    user: overrides.user !== undefined ? overrides.user : mockUser,
    prisma: overrides.prisma ?? (createMockPrisma() as unknown as GraphQLContext['prisma']),
    loaders: overrides.loaders ?? (createMockLoaders() as unknown as GraphQLContext['loaders']),
    req: overrides.req ?? { headers: {}, ip: '127.0.0.1' },
  };
}

// Convenience context builders
const anonContext = () => makeContext({ user: null });
const userContext = (prisma?: ReturnType<typeof createMockPrisma>) =>
  makeContext({ user: mockUser, prisma: prisma as unknown as GraphQLContext['prisma'] });
const adminContext = (prisma?: ReturnType<typeof createMockPrisma>) =>
  makeContext({ user: mockAdmin, prisma: prisma as unknown as GraphQLContext['prisma'] });

// ---------------------------------------------------------------------------
// Helper to pull mock functions from a context's prisma
// ---------------------------------------------------------------------------
function prismaOf(ctx: GraphQLContext) {
  return ctx.prisma as unknown as ReturnType<typeof createMockPrisma>;
}

// ===========================================================================
// USER RESOLVERS
// ===========================================================================

describe('User Resolvers', () => {
  describe('Query.me', () => {
    it('returns the authenticated user', async () => {
      const ctx = userContext();
      const result = await userResolvers.Query.me(null, {}, ctx);
      expect(result).toEqual(mockUser);
    });

    it('returns null for unauthenticated requests', async () => {
      const result = await userResolvers.Query.me(null, {}, anonContext());
      expect(result).toBeNull();
    });
  });

  describe('Query.user', () => {
    it('allows an admin to fetch any user profile', async () => {
      const prisma = createMockPrisma();
      prisma.user.findUnique.mockResolvedValue(mockOtherUser);
      const ctx = adminContext(prisma);

      const result = await userResolvers.Query.user(null, { id: 'user2' }, ctx);
      expect(result).toEqual(mockOtherUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user2' } });
    });

    it('allows a user to fetch their own profile', async () => {
      const prisma = createMockPrisma();
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const ctx = userContext(prisma);

      const result = await userResolvers.Query.user(null, { id: 'user1' }, ctx);
      expect(result).toEqual(mockUser);
    });

    it('throws when a regular user tries to fetch another user', async () => {
      const prisma = createMockPrisma();
      prisma.user.findUnique.mockResolvedValue(mockOtherUser);
      const ctx = userContext(prisma);

      await expect(
        userResolvers.Query.user(null, { id: 'user2' }, ctx)
      ).rejects.toThrow('Insufficient permissions to view this user');
    });

    it('throws when the target user does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.user.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        userResolvers.Query.user(null, { id: 'nonexistent' }, ctx)
      ).rejects.toThrow('User not found');
    });
  });

  describe('User field resolvers', () => {
    it('worksheets – returns all worksheets for owner', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findMany.mockResolvedValue([mockWorksheet]);
      const ctx = userContext(prisma);

      const result = await userResolvers.User.worksheets(mockUser, {}, ctx);
      expect(result).toEqual([mockWorksheet]);
      // Owner: no visibility filter added
      expect(prisma.worksheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user1', deletedAt: null }) })
      );
    });

    it('worksheets – restricts to PUBLIC when viewed by another user', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = makeContext({ user: mockOtherUser, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await userResolvers.User.worksheets(mockUser, {}, ctx);

      const callArg = (prisma.worksheet.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.visibility).toBe('PUBLIC');
    });

    it('worksheets – respects visibility filter for owner', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = userContext(prisma);

      await userResolvers.User.worksheets(mockUser, { visibility: 'UNLISTED' }, ctx);

      const callArg = (prisma.worksheet.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.visibility).toBe('UNLISTED');
    });

    it('worksheets – uses default limit of 20 when not specified', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = userContext(prisma);

      await userResolvers.User.worksheets(mockUser, {}, ctx);

      const callArg = (prisma.worksheet.findMany as Mock).mock.calls[0]![0];
      expect(callArg.take).toBe(20);
      expect(callArg.skip).toBe(0);
    });

    it('folders – returns user folders ordered by name', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findMany.mockResolvedValue([mockFolder]);
      const ctx = userContext(prisma);

      const result = await userResolvers.User.folders(mockUser, {}, ctx);
      expect(result).toEqual([mockFolder]);
      expect(prisma.folder.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        orderBy: { name: 'asc' },
      });
    });

    it('worksheetCount – returns total non-deleted worksheet count', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(7);
      const ctx = userContext(prisma);

      const result = await userResolvers.User.worksheetCount(mockUser, {}, ctx);
      expect(result).toBe(7);
      expect(prisma.worksheet.count).toHaveBeenCalledWith({
        where: { userId: 'user1', deletedAt: null },
      });
    });

    it('forumPosts – returns user posts with pagination defaults', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findMany.mockResolvedValue([mockForumPost]);
      const ctx = userContext(prisma);

      const result = await userResolvers.User.forumPosts(mockUser, {}, ctx);
      expect(result).toEqual([mockForumPost]);
      const callArg = (prisma.forumPost.findMany as Mock).mock.calls[0]![0];
      expect(callArg.take).toBe(20);
      expect(callArg.skip).toBe(0);
      expect(callArg.where.deletedAt).toBeNull();
    });
  });
});

// ===========================================================================
// WORKSHEET RESOLVERS
// ===========================================================================

describe('Worksheet Resolvers', () => {
  describe('Query.worksheet', () => {
    it('returns a PUBLIC worksheet to unauthenticated users', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, visibility: 'PUBLIC' });
      const ctx = anonContext();
      // Replace the prisma in the anon context
      const fullCtx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await worksheetResolvers.Query.worksheet(null, { id: 'ws1' }, fullCtx);
      expect(result).toMatchObject({ id: 'ws1', visibility: 'PUBLIC' });
    });

    it('returns a PRIVATE worksheet to its owner', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, shares: [] });
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Query.worksheet(null, { id: 'ws1' }, ctx);
      expect(result).toMatchObject({ id: 'ws1', userId: 'user1' });
    });

    it('throws ForbiddenError when a user tries to access a PRIVATE worksheet they do not own', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({
        ...mockWorksheet,
        visibility: 'PRIVATE',
        userId: 'user2',
        shares: [],
      });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Query.worksheet(null, { id: 'ws1' }, ctx)
      ).rejects.toThrow('You do not have permission to access this worksheet');
    });

    it('allows access when user email is in shares list', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({
        ...mockWorksheet,
        visibility: 'PRIVATE',
        userId: 'user2',
        shares: [{ id: 'share1', sharedWith: 'user@example.com', permission: 'VIEW' }],
      });
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Query.worksheet(null, { id: 'ws1' }, ctx);
      expect(result).toBeTruthy();
    });

    it('throws NotFoundError for a soft-deleted worksheet', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, deletedAt: NOW });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Query.worksheet(null, { id: 'ws1' }, ctx)
      ).rejects.toThrow('not found');
    });

    it('throws NotFoundError when worksheet does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Query.worksheet(null, { id: 'nonexistent' }, ctx)
      ).rejects.toThrow('not found');
    });
  });

  describe('Query.worksheets (paginated)', () => {
    it('requires authentication', async () => {
      await expect(
        worksheetResolvers.Query.worksheets(null, {}, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('returns paginated worksheet list for the authenticated user', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(1);
      prisma.worksheet.findMany.mockResolvedValue([mockWorksheet]);
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Query.worksheets(null, { limit: 10, offset: 0 }, ctx);
      expect(result.nodes).toEqual([mockWorksheet]);
      expect(result.pageInfo.totalCount).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('caps limit at 100 regardless of input', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(0);
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = userContext(prisma);

      await worksheetResolvers.Query.worksheets(null, { limit: 9999 }, ctx);

      const callArg = (prisma.worksheet.findMany as Mock).mock.calls[0]![0];
      expect(callArg.take).toBe(100);
    });

    it('computes hasNextPage correctly when there are more items', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(50);
      prisma.worksheet.findMany.mockResolvedValue([mockWorksheet]);
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Query.worksheets(null, { limit: 20, offset: 0 }, ctx);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it('computes hasPreviousPage correctly when offset is non-zero', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(50);
      prisma.worksheet.findMany.mockResolvedValue([mockWorksheet]);
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Query.worksheets(null, { limit: 20, offset: 20 }, ctx);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('applies searchQuery OR filter', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(0);
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = userContext(prisma);

      await worksheetResolvers.Query.worksheets(null, { searchQuery: 'algebra' }, ctx);

      const callArg = (prisma.worksheet.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.OR).toBeDefined();
    });

    it('applies folderId filter when provided', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(0);
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = userContext(prisma);

      await worksheetResolvers.Query.worksheets(null, { folderId: 'folder1' }, ctx);

      const callArg = (prisma.worksheet.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.folderId).toBe('folder1');
    });
  });

  describe('Query.publicWorksheets', () => {
    it('returns public worksheets without requiring auth', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.count.mockResolvedValue(2);
      prisma.worksheet.findMany.mockResolvedValue([{ ...mockWorksheet, visibility: 'PUBLIC' }]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await worksheetResolvers.Query.publicWorksheets(null, {}, ctx);
      expect(result.nodes).toHaveLength(1);
      expect(result.pageInfo.totalCount).toBe(2);
    });
  });

  describe('Mutation.createWorksheet', () => {
    it('requires authentication', async () => {
      await expect(
        worksheetResolvers.Mutation.createWorksheet(null, { input: { title: 'Test', content: {} } }, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('creates a worksheet and returns it', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.create.mockResolvedValue(mockWorksheet);
      prisma.worksheet.findMany.mockResolvedValue([]);
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Mutation.createWorksheet(
        null,
        { input: { title: 'New Worksheet', content: { cells: [] } } },
        ctx
      );
      expect(result).toEqual(mockWorksheet);
      expect(prisma.worksheet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'New Worksheet', userId: 'user1', visibility: 'PRIVATE' }),
        })
      );
    });

    it('validates that folderId belongs to the authenticated user', async () => {
      const prisma = createMockPrisma();
      // Folder belongs to a different user
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.createWorksheet(
          null,
          { input: { title: 'X', content: {}, folderId: 'folder1' } },
          ctx
        )
      ).rejects.toThrow('Invalid folder');
    });

    it('throws when folderId does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.createWorksheet(
          null,
          { input: { title: 'X', content: {}, folderId: 'folder_missing' } },
          ctx
        )
      ).rejects.toThrow('Invalid folder');
    });
  });

  describe('Mutation.updateWorksheet', () => {
    it('requires authentication', async () => {
      await expect(
        worksheetResolvers.Mutation.updateWorksheet(null, { id: 'ws1', input: {} }, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('updates and returns the worksheet', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(mockWorksheet);
      const updated = { ...mockWorksheet, title: 'Updated Title' };
      prisma.worksheet.update.mockResolvedValue(updated);
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Mutation.updateWorksheet(
        null,
        { id: 'ws1', input: { title: 'Updated Title' } },
        ctx
      );
      expect(result).toEqual(updated);
    });

    it('throws when the worksheet does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.updateWorksheet(null, { id: 'missing', input: {} }, ctx)
      ).rejects.toThrow('Worksheet not found');
    });

    it('throws when the worksheet is soft-deleted', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, deletedAt: NOW });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.updateWorksheet(null, { id: 'ws1', input: {} }, ctx)
      ).rejects.toThrow('Worksheet not found');
    });

    it('throws when the user does not own the worksheet', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.updateWorksheet(null, { id: 'ws1', input: {} }, ctx)
      ).rejects.toThrow('permission');
    });
  });

  describe('Mutation.deleteWorksheet (soft delete)', () => {
    it('requires authentication', async () => {
      await expect(
        worksheetResolvers.Mutation.deleteWorksheet(null, { id: 'ws1' }, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('soft-deletes the worksheet and returns true', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(mockWorksheet);
      prisma.worksheet.update.mockResolvedValue({ ...mockWorksheet, deletedAt: NOW });
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Mutation.deleteWorksheet(null, { id: 'ws1' }, ctx);
      expect(result).toBe(true);

      // Verify soft delete – sets deletedAt, does not call .delete()
      expect(prisma.worksheet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
      );
      expect(prisma.worksheet.delete).not.toHaveBeenCalled();
    });

    it('creates an audit log entry on delete', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(mockWorksheet);
      prisma.worksheet.update.mockResolvedValue({ ...mockWorksheet, deletedAt: NOW });
      const ctx = userContext(prisma);

      await worksheetResolvers.Mutation.deleteWorksheet(null, { id: 'ws1' }, ctx);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'delete', entity: 'worksheet', entityId: 'ws1' }),
        })
      );
    });

    it('throws when the worksheet is not found', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.deleteWorksheet(null, { id: 'ws1' }, ctx)
      ).rejects.toThrow('Worksheet not found');
    });

    it('throws when non-owner tries to delete', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.deleteWorksheet(null, { id: 'ws1' }, ctx)
      ).rejects.toThrow('permission');
    });
  });

  describe('Mutation.shareWorksheet', () => {
    it('creates a share record and returns it', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(mockWorksheet);
      const share = { id: 'share1', worksheetId: 'ws1', sharedWith: 'collab@test.com', permission: 'VIEW', createdAt: NOW, worksheet: mockWorksheet };
      prisma.worksheetShare.create.mockResolvedValue(share);
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Mutation.shareWorksheet(
        null,
        { input: { worksheetId: 'ws1', sharedWith: 'collab@test.com' } },
        ctx
      );
      expect(result).toEqual(share);
    });

    it('requires authentication', async () => {
      await expect(
        worksheetResolvers.Mutation.shareWorksheet(
          null,
          { input: { worksheetId: 'ws1', sharedWith: 'x@test.com' } },
          anonContext()
        )
      ).rejects.toThrow('Authentication required');
    });

    it('throws when the worksheet is not found', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.shareWorksheet(
          null,
          { input: { worksheetId: 'ws_missing', sharedWith: 'x@test.com' } },
          ctx
        )
      ).rejects.toThrow('Worksheet not found');
    });

    it('throws when non-owner tries to share', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue({ ...mockWorksheet, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        worksheetResolvers.Mutation.shareWorksheet(
          null,
          { input: { worksheetId: 'ws1', sharedWith: 'x@test.com' } },
          ctx
        )
      ).rejects.toThrow('permission');
    });
  });

  describe('Mutation.unshareWorksheet', () => {
    it('deletes the share and returns true', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findUnique.mockResolvedValue(mockWorksheet);
      prisma.worksheetShare.delete.mockResolvedValue({ id: 'share1' });
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Mutation.unshareWorksheet(
        null,
        { worksheetId: 'ws1', shareId: 'share1' },
        ctx
      );
      expect(result).toBe(true);
      expect(prisma.worksheetShare.delete).toHaveBeenCalledWith({ where: { id: 'share1' } });
    });
  });

  describe('Mutation.incrementWorksheetViews', () => {
    it('increments views and returns true', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.update.mockResolvedValue({ ...mockWorksheet, views: 1 });
      const ctx = userContext(prisma);

      const result = await worksheetResolvers.Mutation.incrementWorksheetViews(null, { id: 'ws1' }, ctx);
      expect(result).toBe(true);
      expect(prisma.worksheet.update).toHaveBeenCalledWith({
        where: { id: 'ws1' },
        data: { views: { increment: 1 } },
      });
    });
  });

  describe('Worksheet field resolvers', () => {
    it('user – loads owner via DataLoader', async () => {
      const loaders = createMockLoaders();
      loaders.userById.load.mockResolvedValue(mockUser);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      const result = await worksheetResolvers.Worksheet.user(mockWorksheet, {}, ctx);
      expect(result).toEqual(mockUser);
      expect(loaders.userById.load).toHaveBeenCalledWith('user1');
    });

    it('folder – returns null when folderId is absent', async () => {
      const ctx = makeContext();
      const result = await worksheetResolvers.Worksheet.folder(mockWorksheet, {}, ctx);
      expect(result).toBeNull();
    });

    it('folder – loads folder via DataLoader when folderId is present', async () => {
      const loaders = createMockLoaders();
      loaders.folderById.load.mockResolvedValue(mockFolder);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      const result = await worksheetResolvers.Worksheet.folder(
        { ...mockWorksheet, folderId: 'folder1' },
        {},
        ctx
      );
      expect(result).toEqual(mockFolder);
      expect(loaders.folderById.load).toHaveBeenCalledWith('folder1');
    });

    it('shares – loads shares via DataLoader', async () => {
      const shareEntry = [{ id: 'share1', sharedWith: 'collab@test.com', permission: 'VIEW' }];
      const loaders = createMockLoaders();
      loaders.worksheetSharesByWorksheetId.load.mockResolvedValue(shareEntry);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      const result = await worksheetResolvers.Worksheet.shares(mockWorksheet, {}, ctx);
      expect(result).toEqual(shareEntry);
      expect(loaders.worksheetSharesByWorksheetId.load).toHaveBeenCalledWith('ws1');
    });
  });
});

// ===========================================================================
// FOLDER RESOLVERS
// ===========================================================================

describe('Folder Resolvers', () => {
  describe('Query.folder', () => {
    it('returns the folder for its owner', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(mockFolder);
      const ctx = userContext(prisma);

      const result = await folderResolvers.Query.folder(null, { id: 'folder1' }, ctx);
      expect(result).toEqual(mockFolder);
    });

    it('allows admin to access any folder', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, userId: 'user2' });
      const ctx = adminContext(prisma);

      const result = await folderResolvers.Query.folder(null, { id: 'folder1' }, ctx);
      expect(result).toBeTruthy();
    });

    it('throws when unauthenticated', async () => {
      await expect(
        folderResolvers.Query.folder(null, { id: 'folder1' }, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('throws when folder is not found', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Query.folder(null, { id: 'missing' }, ctx)
      ).rejects.toThrow('Folder not found');
    });

    it('throws when user does not own the folder', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Query.folder(null, { id: 'folder1' }, ctx)
      ).rejects.toThrow('permission');
    });
  });

  describe('Query.folders', () => {
    it('returns own folders when no userId provided', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findMany.mockResolvedValue([mockFolder]);
      const ctx = userContext(prisma);

      const result = await folderResolvers.Query.folders(null, {}, ctx);
      expect(result).toEqual([mockFolder]);
    });

    it('throws when a non-admin requests another user folders', async () => {
      const ctx = userContext();
      await expect(
        folderResolvers.Query.folders(null, { userId: 'user2' }, ctx)
      ).rejects.toThrow('Insufficient permissions');
    });

    it('allows admin to list another user folders', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findMany.mockResolvedValue([{ ...mockFolder, userId: 'user2' }]);
      const ctx = adminContext(prisma);

      const result = await folderResolvers.Query.folders(null, { userId: 'user2' }, ctx);
      expect(result).toHaveLength(1);
    });
  });

  describe('Mutation.createFolder', () => {
    it('creates a root-level folder successfully', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findFirst.mockResolvedValue(null); // No duplicate
      prisma.folder.create.mockResolvedValue(mockFolder);
      const ctx = userContext(prisma);

      const result = await folderResolvers.Mutation.createFolder(
        null,
        { input: { name: 'My Folder' } },
        ctx
      );
      expect(result).toEqual(mockFolder);
      expect(prisma.folder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'My Folder', userId: 'user1' }),
        })
      );
    });

    it('throws when a folder with the same name already exists in the same location', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findFirst.mockResolvedValue(mockFolder); // Duplicate found
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.createFolder(null, { input: { name: 'My Folder' } }, ctx)
      ).rejects.toThrow('already exists');
    });

    it('validates parentId – throws when parent does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(null); // Parent not found
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.createFolder(null, { input: { name: 'Child', parentId: 'nonexistent' } }, ctx)
      ).rejects.toThrow('Invalid parent folder');
    });

    it('validates parentId – throws when parent belongs to another user', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.createFolder(null, { input: { name: 'Child', parentId: 'folder1' } }, ctx)
      ).rejects.toThrow('Invalid parent folder');
    });

    it('throws when unauthenticated', async () => {
      await expect(
        folderResolvers.Mutation.createFolder(null, { input: { name: 'X' } }, anonContext())
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Mutation.updateFolder', () => {
    it('renames a folder successfully', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(mockFolder);
      prisma.folder.findFirst.mockResolvedValue(null); // No duplicate for new name
      const renamed = { ...mockFolder, name: 'Renamed' };
      prisma.folder.update.mockResolvedValue(renamed);
      const ctx = userContext(prisma);

      const result = await folderResolvers.Mutation.updateFolder(
        null,
        { id: 'folder1', input: { name: 'Renamed' } },
        ctx
      );
      expect(result).toEqual(renamed);
    });

    it('throws when trying to set folder as its own parent', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(mockFolder);
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.updateFolder(null, { id: 'folder1', input: { parentId: 'folder1' } }, ctx)
      ).rejects.toThrow('cannot be its own parent');
    });

    it('throws when trying to move folder into one of its descendants', async () => {
      const prisma = createMockPrisma();
      // folder1 -> child2 -> grandchild3
      const child = { ...mockFolder, id: 'child2', parentId: 'folder1' };
      // First call = find the folder being updated
      // Second call = find the proposed new parent (child2)
      // Third call = find child2's parent (folder1) — triggers the cycle check
      prisma.folder.findUnique
        .mockResolvedValueOnce(mockFolder)           // the folder being updated
        .mockResolvedValueOnce(child)                // proposed new parent
        .mockResolvedValueOnce(null);                // child's parent (already folder1, so check triggers)
      // Override so that child.parentId === args.id is true
      const childWithCycle = { ...mockFolder, id: 'child2', parentId: 'folder1' };
      const prisma2 = createMockPrisma();
      prisma2.folder.findUnique
        .mockResolvedValueOnce(mockFolder)           // folder being updated
        .mockResolvedValueOnce(childWithCycle);      // proposed parent – its parentId IS args.id
      const ctx = userContext(prisma2);

      await expect(
        folderResolvers.Mutation.updateFolder(
          null,
          { id: 'folder1', input: { parentId: 'child2' } },
          ctx
        )
      ).rejects.toThrow('descendant');
    });

    it('throws when the folder is not found', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.updateFolder(null, { id: 'missing', input: { name: 'X' } }, ctx)
      ).rejects.toThrow('Folder not found');
    });
  });

  describe('Mutation.deleteFolder', () => {
    it('deletes an empty folder and returns true', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, worksheets: [], children: [] });
      prisma.folder.delete.mockResolvedValue(mockFolder);
      const ctx = userContext(prisma);

      const result = await folderResolvers.Mutation.deleteFolder(null, { id: 'folder1' }, ctx);
      expect(result).toBe(true);
      expect(prisma.folder.delete).toHaveBeenCalledWith({ where: { id: 'folder1' } });
    });

    it('creates an audit log entry on delete', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, worksheets: [], children: [] });
      prisma.folder.delete.mockResolvedValue(mockFolder);
      const ctx = userContext(prisma);

      await folderResolvers.Mutation.deleteFolder(null, { id: 'folder1' }, ctx);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'delete', entity: 'folder', entityId: 'folder1' }),
        })
      );
    });

    it('throws when folder contains worksheets', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({
        ...mockFolder,
        worksheets: [mockWorksheet],
        children: [],
      });
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.deleteFolder(null, { id: 'folder1' }, ctx)
      ).rejects.toThrow('containing worksheets');
    });

    it('throws when folder contains subfolders', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({
        ...mockFolder,
        worksheets: [],
        children: [{ ...mockFolder, id: 'child1', parentId: 'folder1' }],
      });
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.deleteFolder(null, { id: 'folder1' }, ctx)
      ).rejects.toThrow('containing subfolders');
    });

    it('throws when folder is not found', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.deleteFolder(null, { id: 'missing' }, ctx)
      ).rejects.toThrow('Folder not found');
    });

    it('throws when non-owner tries to delete', async () => {
      const prisma = createMockPrisma();
      prisma.folder.findUnique.mockResolvedValue({ ...mockFolder, userId: 'user2', worksheets: [], children: [] });
      const ctx = userContext(prisma);

      await expect(
        folderResolvers.Mutation.deleteFolder(null, { id: 'folder1' }, ctx)
      ).rejects.toThrow('permission');
    });
  });

  describe('Folder field resolvers', () => {
    it('user – loads owner via DataLoader', async () => {
      const loaders = createMockLoaders();
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      await folderResolvers.Folder.user(mockFolder, {}, ctx);
      expect(loaders.userById.load).toHaveBeenCalledWith('user1');
    });

    it('parent – returns null when parentId is absent', async () => {
      const ctx = makeContext();
      const result = await folderResolvers.Folder.parent(mockFolder, {}, ctx);
      expect(result).toBeNull();
    });

    it('parent – loads parent folder via DataLoader when parentId is set', async () => {
      const loaders = createMockLoaders();
      const parentFolder = { ...mockFolder, id: 'parent1' };
      loaders.folderById.load.mockResolvedValue(parentFolder);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      const result = await folderResolvers.Folder.parent({ ...mockFolder, parentId: 'parent1' }, {}, ctx);
      expect(result).toEqual(parentFolder);
      expect(loaders.folderById.load).toHaveBeenCalledWith('parent1');
    });

    it('children – loads child folders via DataLoader', async () => {
      const loaders = createMockLoaders();
      loaders.childFoldersByParentId.load.mockResolvedValue([]);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      await folderResolvers.Folder.children(mockFolder, {}, ctx);
      expect(loaders.childFoldersByParentId.load).toHaveBeenCalledWith('folder1');
    });

    it('worksheets – queries non-deleted worksheets for the folder', async () => {
      const prisma = createMockPrisma();
      prisma.worksheet.findMany.mockResolvedValue([mockWorksheet]);
      const ctx = userContext(prisma);

      const result = await folderResolvers.Folder.worksheets(mockFolder, {}, ctx);
      expect(result).toEqual([mockWorksheet]);
      expect(prisma.worksheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { folderId: 'folder1', deletedAt: null } })
      );
    });
  });
});

// ===========================================================================
// CALCULATION RESOLVERS
// ===========================================================================

describe('Calculation Resolvers', () => {
  describe('Query.calculate', () => {
    it('evaluates a simple arithmetic expression', async () => {
      const ctx = makeContext();
      const result = await calculationResolvers.Query.calculate(
        null,
        { input: { expression: '2 + 3' } },
        ctx
      );
      expect(result.result).toBe('5');
      expect(result.formatted).toBe('5');
      expect(result.input).toBe('2 + 3');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('evaluates expressions with variables', async () => {
      const ctx = makeContext();
      const result = await calculationResolvers.Query.calculate(
        null,
        { input: { expression: 'a * b', variables: { a: 3, b: 7 } } },
        ctx
      );
      expect(result.result).toBe('21');
    });

    it('evaluates floating-point expressions', async () => {
      const ctx = makeContext();
      const result = await calculationResolvers.Query.calculate(
        null,
        { input: { expression: '1 / 4' } },
        ctx
      );
      expect(result.result).toBe('0.25');
    });

    it('evaluates trigonometric functions', async () => {
      const ctx = makeContext();
      const result = await calculationResolvers.Query.calculate(
        null,
        { input: { expression: 'sin(0)' } },
        ctx
      );
      expect(result.result).toBe('0');
    });

    it('throws a Calculation error for invalid expressions', async () => {
      const ctx = makeContext();
      await expect(
        calculationResolvers.Query.calculate(null, { input: { expression: 'invalid!!expr' } }, ctx)
      ).rejects.toThrow('Calculation error');
    });

    it('includes empty variables object when none provided', async () => {
      const ctx = makeContext();
      const result = await calculationResolvers.Query.calculate(
        null,
        { input: { expression: '10' } },
        ctx
      );
      expect(result.variables).toEqual({});
    });

    it('passes provided variables back in the response', async () => {
      const ctx = makeContext();
      const result = await calculationResolvers.Query.calculate(
        null,
        { input: { expression: 'x + 1', variables: { x: 5 } } },
        ctx
      );
      expect(result.variables).toEqual({ x: 5 });
    });
  });

  describe('Query.calculationHistory', () => {
    it('requires authentication', async () => {
      await expect(
        calculationResolvers.Query.calculationHistory(null, {}, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('returns an empty array for authenticated users', async () => {
      const result = await calculationResolvers.Query.calculationHistory(null, {}, userContext());
      expect(result).toEqual([]);
    });
  });

  describe('Query.health', () => {
    it('returns healthy status when both db and redis are up', async () => {
      const prisma = createMockPrisma();
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const ctx = makeContext({ prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await calculationResolvers.Query.health(null, {}, ctx);
      expect(result.status).toBe('healthy');
      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('healthy');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('returns degraded status when database is unreachable', async () => {
      const prisma = createMockPrisma();
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      const ctx = makeContext({ prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await calculationResolvers.Query.health(null, {}, ctx);
      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('unhealthy');
      expect(result.database.error).toBe('Connection refused');
    });

    it('exposes database latency when healthy', async () => {
      const prisma = createMockPrisma();
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const ctx = makeContext({ prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await calculationResolvers.Query.health(null, {}, ctx);
      expect(typeof result.database.latency).toBe('number');
    });
  });

  describe('Mutation.saveCalculation', () => {
    it('requires authentication', async () => {
      await expect(
        calculationResolvers.Mutation.saveCalculation(
          null,
          { input: { expression: '1+1' } },
          anonContext()
        )
      ).rejects.toThrow('Authentication required');
    });

    it('evaluates the expression and returns a saved calculation object', async () => {
      const ctx = userContext();
      const result = await calculationResolvers.Mutation.saveCalculation(
        null,
        { input: { expression: '4 * 4' } },
        ctx
      );
      expect(result.result).toBe('16');
      expect(result.expression).toBe('4 * 4');
      expect(result.userId).toBe('user1');
      expect(result.id).toMatch(/^calc_/);
    });

    it('throws a Calculation error when expression is invalid', async () => {
      const ctx = userContext();
      await expect(
        calculationResolvers.Mutation.saveCalculation(
          null,
          { input: { expression: '???' } },
          ctx
        )
      ).rejects.toThrow('Calculation error');
    });
  });

  describe('Mutation.clearCalculationHistory', () => {
    it('requires authentication', async () => {
      await expect(
        calculationResolvers.Mutation.clearCalculationHistory(null, {}, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('returns true for authenticated users', async () => {
      const result = await calculationResolvers.Mutation.clearCalculationHistory(
        null,
        {},
        userContext()
      );
      expect(result).toBe(true);
    });
  });
});

// ===========================================================================
// FORUM RESOLVERS
// ===========================================================================

describe('Forum Resolvers', () => {
  describe('Query.forumPost', () => {
    it('returns a post and increments view count', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.forumPost.update.mockResolvedValue({ ...mockForumPost, views: 1 });
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await forumResolvers.Query.forumPost(null, { id: 'post1' }, ctx);
      expect(result).toEqual(mockForumPost);
      expect(prisma.forumPost.update).toHaveBeenCalledWith({
        where: { id: 'post1' },
        data: { views: { increment: 1 } },
      });
    });

    it('throws NotFoundError when post does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(null);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await expect(
        forumResolvers.Query.forumPost(null, { id: 'missing' }, ctx)
      ).rejects.toThrow('not found');
    });

    it('throws NotFoundError for soft-deleted posts', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue({ ...mockForumPost, deletedAt: NOW });
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await expect(
        forumResolvers.Query.forumPost(null, { id: 'post1' }, ctx)
      ).rejects.toThrow('not found');
    });
  });

  describe('Query.forumPosts', () => {
    it('returns paginated posts without requiring auth', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.count.mockResolvedValue(5);
      prisma.forumPost.findMany.mockResolvedValue([mockForumPost]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await forumResolvers.Query.forumPosts(null, {}, ctx);
      expect(result.nodes).toEqual([mockForumPost]);
      expect(result.pageInfo.totalCount).toBe(5);
    });

    it('applies tags filter when provided', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.count.mockResolvedValue(0);
      prisma.forumPost.findMany.mockResolvedValue([]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await forumResolvers.Query.forumPosts(null, { tags: ['math'] }, ctx);

      const callArg = (prisma.forumPost.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.tags).toEqual({ hasSome: ['math'] });
    });

    it('applies searchQuery OR filter', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.count.mockResolvedValue(0);
      prisma.forumPost.findMany.mockResolvedValue([]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await forumResolvers.Query.forumPosts(null, { searchQuery: 'calculus' }, ctx);

      const callArg = (prisma.forumPost.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.OR).toBeDefined();
    });

    it('caps limit at 100', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.count.mockResolvedValue(0);
      prisma.forumPost.findMany.mockResolvedValue([]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await forumResolvers.Query.forumPosts(null, { limit: 999 }, ctx);

      const callArg = (prisma.forumPost.findMany as Mock).mock.calls[0]![0];
      expect(callArg.take).toBe(100);
    });
  });

  describe('Mutation.createForumPost', () => {
    it('creates a post for an authenticated user', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.create.mockResolvedValue(mockForumPost);
      const ctx = userContext(prisma);

      const result = await forumResolvers.Mutation.createForumPost(
        null,
        {
          input: {
            title: 'My Forum Post',
            content: 'This is forum post content that is long enough',
            tags: ['math'],
          },
        },
        ctx
      );
      expect(result).toEqual(mockForumPost);
      expect(prisma.forumPost.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user1' }) })
      );
    });

    it('requires authentication', async () => {
      await expect(
        forumResolvers.Mutation.createForumPost(
          null,
          { input: { title: 'X', content: 'Long enough content here', tags: ['a'] } },
          anonContext()
        )
      ).rejects.toThrow('Authentication required');
    });

    it('throws a validation error when title is too short', async () => {
      const ctx = userContext();
      await expect(
        forumResolvers.Mutation.createForumPost(
          null,
          // Title must be at least 3 chars; content at least 10
          { input: { title: 'AB', content: 'This is valid content text', tags: ['math'] } },
          ctx
        )
      ).rejects.toThrow('Validation failed');
    });

    it('throws a validation error when content is too short', async () => {
      const ctx = userContext();
      await expect(
        forumResolvers.Mutation.createForumPost(
          null,
          { input: { title: 'Valid Title', content: 'short', tags: ['math'] } },
          ctx
        )
      ).rejects.toThrow('Validation failed');
    });

    it('throws a validation error when no tags are provided', async () => {
      const ctx = userContext();
      await expect(
        forumResolvers.Mutation.createForumPost(
          null,
          { input: { title: 'Valid Title', content: 'This is valid content text', tags: [] } },
          ctx
        )
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('Mutation.updateForumPost', () => {
    it('updates a post successfully', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      const updated = { ...mockForumPost, title: 'Updated Title' };
      prisma.forumPost.update.mockResolvedValue(updated);
      const ctx = userContext(prisma);

      const result = await forumResolvers.Mutation.updateForumPost(
        null,
        { id: 'post1', input: { title: 'Updated Title' } },
        ctx
      );
      expect(result).toEqual(updated);
    });

    it('requires authentication', async () => {
      await expect(
        forumResolvers.Mutation.updateForumPost(null, { id: 'post1', input: {} }, anonContext())
      ).rejects.toThrow('Authentication required');
    });

    it('throws when post is not found', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        forumResolvers.Mutation.updateForumPost(null, { id: 'missing', input: {} }, ctx)
      ).rejects.toThrow('not found');
    });

    it('throws when non-owner tries to update', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue({ ...mockForumPost, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        forumResolvers.Mutation.updateForumPost(null, { id: 'post1', input: { title: 'Hijack' } }, ctx)
      ).rejects.toThrow('permission');
    });
  });

  describe('Mutation.deleteForumPost (soft delete)', () => {
    it('soft-deletes the post and returns true', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.forumPost.update.mockResolvedValue({ ...mockForumPost, deletedAt: NOW });
      const ctx = userContext(prisma);

      const result = await forumResolvers.Mutation.deleteForumPost(null, { id: 'post1' }, ctx);
      expect(result).toBe(true);
      expect(prisma.forumPost.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
      );
      // The resolver uses update (soft delete), never the hard-delete method
      expect(prisma.forumPost.update).toHaveBeenCalledTimes(1);
    });

    it('creates an audit log on delete', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.forumPost.update.mockResolvedValue({ ...mockForumPost, deletedAt: NOW });
      const ctx = userContext(prisma);

      await forumResolvers.Mutation.deleteForumPost(null, { id: 'post1' }, ctx);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'delete', entity: 'forumPost', entityId: 'post1' }),
        })
      );
    });

    it('throws when post does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        forumResolvers.Mutation.deleteForumPost(null, { id: 'missing' }, ctx)
      ).rejects.toThrow('not found');
    });

    it('throws when non-owner tries to delete', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue({ ...mockForumPost, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        forumResolvers.Mutation.deleteForumPost(null, { id: 'post1' }, ctx)
      ).rejects.toThrow('permission');
    });

    it('requires authentication', async () => {
      await expect(
        forumResolvers.Mutation.deleteForumPost(null, { id: 'post1' }, anonContext())
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('ForumPost field resolvers', () => {
    it('user – loads poster via DataLoader', async () => {
      const loaders = createMockLoaders();
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      await forumResolvers.ForumPost.user(mockForumPost, {}, ctx);
      expect(loaders.userById.load).toHaveBeenCalledWith('user1');
    });

    it('comments – returns top-level comments only', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findMany.mockResolvedValue([mockComment]);
      const ctx = userContext(prisma);

      const result = await forumResolvers.ForumPost.comments(mockForumPost, {}, ctx);
      expect(result).toEqual([mockComment]);
      const callArg = (prisma.comment.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.parentId).toBeNull();
    });

    it('upvoteCount – loads count via DataLoader', async () => {
      const loaders = createMockLoaders();
      loaders.upvoteCountByTargetId.load.mockResolvedValue(42);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      const result = await forumResolvers.ForumPost.upvoteCount(mockForumPost, {}, ctx);
      expect(result).toBe(42);
      expect(loaders.upvoteCountByTargetId.load).toHaveBeenCalledWith(CUID_POST);
    });

    it('hasUpvoted – returns false when user is not authenticated', async () => {
      const ctx = anonContext();
      const result = await forumResolvers.ForumPost.hasUpvoted(mockForumPost, {}, ctx);
      expect(result).toBe(false);
    });

    it('hasUpvoted – returns true when upvote record exists', async () => {
      const prisma = createMockPrisma();
      prisma.upvote.findUnique.mockResolvedValue(mockUpvote);
      const ctx = userContext(prisma);

      const result = await forumResolvers.ForumPost.hasUpvoted(mockForumPost, {}, ctx);
      expect(result).toBe(true);
    });

    it('hasUpvoted – returns false when no upvote record exists', async () => {
      const prisma = createMockPrisma();
      prisma.upvote.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      const result = await forumResolvers.ForumPost.hasUpvoted(mockForumPost, {}, ctx);
      expect(result).toBe(false);
    });
  });
});

// ===========================================================================
// COMMENT RESOLVERS
// ===========================================================================

describe('Comment Resolvers', () => {
  describe('Query.comments', () => {
    it('returns top-level comments for a post', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findMany.mockResolvedValue([mockComment]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      const result = await commentResolvers.Query.comments(
        null,
        { postId: CUID_POST },
        ctx
      );
      expect(result).toEqual([mockComment]);
      const callArg = (prisma.comment.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.parentId).toBeNull();
      expect(callArg.where.postId).toBe(CUID_POST);
    });

    it('respects pagination arguments', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findMany.mockResolvedValue([]);
      const ctx = makeContext({ user: null, prisma: prisma as unknown as GraphQLContext['prisma'] });

      await commentResolvers.Query.comments(null, { postId: CUID_POST, limit: 5, offset: 10 }, ctx);

      const callArg = (prisma.comment.findMany as Mock).mock.calls[0]![0];
      expect(callArg.take).toBe(5);
      expect(callArg.skip).toBe(10);
    });
  });

  describe('Mutation.createComment', () => {
    it('creates a top-level comment on an open post', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.comment.create.mockResolvedValue(mockComment);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Mutation.createComment(
        null,
        // postId must be a valid CUID for the createCommentSchema – use a realistic one
        { input: { postId: mockForumPost.id, content: 'A test comment' } },
        ctx
      );
      expect(result).toEqual(mockComment);
      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user1', postId: mockForumPost.id }),
        })
      );
    });

    it('requires authentication', async () => {
      await expect(
        commentResolvers.Mutation.createComment(
          null,
          { input: { postId: mockForumPost.id, content: 'hello' } },
          anonContext()
        )
      ).rejects.toThrow('Authentication required');
    });

    it('throws when the forum post does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.createComment(
          null,
          { input: { postId: mockForumPost.id, content: 'A test comment' } },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws when the forum post is closed', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue({ ...mockForumPost, isClosed: true });
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.createComment(
          null,
          { input: { postId: mockForumPost.id, content: 'A test comment' } },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws when the forum post is soft-deleted', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue({ ...mockForumPost, deletedAt: NOW });
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.createComment(
          null,
          { input: { postId: mockForumPost.id, content: 'A test comment' } },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('creates a reply when a valid parentId is provided', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      const parentComment = { ...mockComment, id: CUID_PARENT_COMMENT };
      prisma.comment.findUnique.mockResolvedValue(parentComment);
      const reply = { ...mockComment, id: 'reply1', parentId: CUID_PARENT_COMMENT };
      prisma.comment.create.mockResolvedValue(reply);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Mutation.createComment(
        null,
        { input: { postId: mockForumPost.id, content: 'A reply', parentId: CUID_PARENT_COMMENT } },
        ctx
      );
      expect(result).toEqual(reply);
    });

    it('throws when the parent comment does not belong to the post', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      // parentId comment belongs to a different post
      prisma.comment.findUnique.mockResolvedValue({ ...mockComment, postId: 'different_post' });
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.createComment(
          null,
          { input: { postId: mockForumPost.id, content: 'A reply', parentId: CUID_PARENT_COMMENT } },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws validation error when content is empty', async () => {
      const ctx = userContext();
      await expect(
        commentResolvers.Mutation.createComment(
          null,
          { input: { postId: mockForumPost.id, content: '' } },
          ctx
        )
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('Mutation.updateComment', () => {
    it('updates comment content for the owner', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(mockComment);
      const updated = { ...mockComment, content: 'Updated content' };
      prisma.comment.update.mockResolvedValue(updated);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Mutation.updateComment(
        null,
        { id: 'comment1', input: { content: 'Updated content' } },
        ctx
      );
      expect(result).toEqual(updated);
    });

    it('requires authentication', async () => {
      await expect(
        commentResolvers.Mutation.updateComment(
          null,
          { id: 'comment1', input: { content: 'X' } },
          anonContext()
        )
      ).rejects.toThrow('Authentication required');
    });

    it('throws when comment is not found', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.updateComment(
          null,
          { id: 'missing', input: { content: 'X' } },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws when comment is soft-deleted', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue({ ...mockComment, deletedAt: NOW });
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.updateComment(
          null,
          { id: 'comment1', input: { content: 'X' } },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws when non-owner tries to update', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue({ ...mockComment, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.updateComment(
          null,
          { id: 'comment1', input: { content: 'Hijack' } },
          ctx
        )
      ).rejects.toThrow('permission');
    });
  });

  describe('Mutation.deleteComment (soft delete)', () => {
    it('soft-deletes the comment and returns true', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(mockComment);
      prisma.comment.update.mockResolvedValue({ ...mockComment, deletedAt: NOW });
      const ctx = userContext(prisma);

      const result = await commentResolvers.Mutation.deleteComment(null, { id: 'comment1' }, ctx);
      expect(result).toBe(true);
      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
      );
    });

    it('creates an audit log on delete', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(mockComment);
      prisma.comment.update.mockResolvedValue({ ...mockComment, deletedAt: NOW });
      const ctx = userContext(prisma);

      await commentResolvers.Mutation.deleteComment(null, { id: 'comment1' }, ctx);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'delete', entity: 'comment', entityId: 'comment1' }),
        })
      );
    });

    it('throws when comment is not found', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.deleteComment(null, { id: 'missing' }, ctx)
      ).rejects.toThrow('not found');
    });

    it('throws when non-owner tries to delete', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue({ ...mockComment, userId: 'user2' });
      const ctx = userContext(prisma);

      await expect(
        commentResolvers.Mutation.deleteComment(null, { id: 'comment1' }, ctx)
      ).rejects.toThrow('permission');
    });
  });

  describe('Comment field resolvers', () => {
    it('user – loads author via DataLoader', async () => {
      const loaders = createMockLoaders();
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      await commentResolvers.Comment.user(mockComment, {}, ctx);
      expect(loaders.userById.load).toHaveBeenCalledWith('user1');
    });

    it('post – fetches the associated forum post', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Comment.post(mockComment, {}, ctx);
      expect(result).toEqual(mockForumPost);
      expect(prisma.forumPost.findUnique).toHaveBeenCalledWith({ where: { id: CUID_POST } });
    });

    it('parent – returns null when parentId is absent', async () => {
      const ctx = makeContext();
      const result = await commentResolvers.Comment.parent(mockComment, {}, ctx);
      expect(result).toBeNull();
    });

    it('parent – fetches parent comment when parentId is present', async () => {
      const prisma = createMockPrisma();
      const parentComment = { ...mockComment, id: 'parent1' };
      prisma.comment.findUnique.mockResolvedValue(parentComment);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Comment.parent(
        { ...mockComment, parentId: 'parent1' },
        {},
        ctx
      );
      expect(result).toEqual(parentComment);
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({ where: { id: 'parent1' } });
    });

    it('replies – fetches non-deleted child comments', async () => {
      const prisma = createMockPrisma();
      const reply = { ...mockComment, id: 'reply1', parentId: CUID_COMMENT };
      prisma.comment.findMany.mockResolvedValue([reply]);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Comment.replies(mockComment, {}, ctx);
      expect(result).toEqual([reply]);
      const callArg = (prisma.comment.findMany as Mock).mock.calls[0]![0];
      expect(callArg.where.parentId).toBe(CUID_COMMENT);
      expect(callArg.where.deletedAt).toBeNull();
    });

    it('upvoteCount – loads count via DataLoader', async () => {
      const loaders = createMockLoaders();
      loaders.upvoteCountByTargetId.load.mockResolvedValue(5);
      const ctx = makeContext({ loaders: loaders as unknown as GraphQLContext['loaders'] });

      const result = await commentResolvers.Comment.upvoteCount(mockComment, {}, ctx);
      expect(result).toBe(5);
      expect(loaders.upvoteCountByTargetId.load).toHaveBeenCalledWith(CUID_COMMENT);
    });

    it('hasUpvoted – returns false for unauthenticated requests', async () => {
      const ctx = anonContext();
      const result = await commentResolvers.Comment.hasUpvoted(mockComment, {}, ctx);
      expect(result).toBe(false);
    });

    it('hasUpvoted – returns true when upvote exists', async () => {
      const prisma = createMockPrisma();
      prisma.upvote.findUnique.mockResolvedValue({ ...mockUpvote, targetId: 'comment1', targetType: 'COMMENT' });
      const ctx = userContext(prisma);

      const result = await commentResolvers.Comment.hasUpvoted(mockComment, {}, ctx);
      expect(result).toBe(true);
    });

    it('hasUpvoted – returns false when no upvote exists', async () => {
      const prisma = createMockPrisma();
      prisma.upvote.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      const result = await commentResolvers.Comment.hasUpvoted(mockComment, {}, ctx);
      expect(result).toBe(false);
    });
  });
});

// ===========================================================================
// UPVOTE RESOLVERS
// ===========================================================================

describe('Upvote Resolvers', () => {
  describe('Mutation.toggleUpvote – POST target', () => {
    it('requires authentication', async () => {
      await expect(
        upvoteResolvers.Mutation.toggleUpvote(
          null,
          { targetId: 'post1', targetType: 'POST' },
          anonContext()
        )
      ).rejects.toThrow('Authentication required');
    });

    it('adds an upvote when none exists (first click)', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.upvote.findUnique.mockResolvedValue(null); // Not yet upvoted
      prisma.upvote.create.mockResolvedValue(mockUpvote);
      prisma.upvote.count.mockResolvedValue(1);
      const ctx = userContext(prisma);

      const result = await upvoteResolvers.Mutation.toggleUpvote(
        null,
        { targetId: 'post1', targetType: 'POST' },
        ctx
      );

      expect(result.upvoted).toBe(true);
      expect(result.upvoteCount).toBe(1);
      expect(prisma.upvote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user1', targetId: 'post1', targetType: 'POST' }),
        })
      );
      expect(prisma.upvote.delete).not.toHaveBeenCalled();
    });

    it('removes an upvote when one already exists (toggle off)', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.upvote.findUnique.mockResolvedValue(mockUpvote); // Already upvoted
      prisma.upvote.delete.mockResolvedValue(mockUpvote);
      prisma.upvote.count.mockResolvedValue(0);
      const ctx = userContext(prisma);

      const result = await upvoteResolvers.Mutation.toggleUpvote(
        null,
        { targetId: 'post1', targetType: 'POST' },
        ctx
      );

      expect(result.upvoted).toBe(false);
      expect(result.upvoteCount).toBe(0);
      expect(prisma.upvote.delete).toHaveBeenCalledWith({ where: { id: 'upvote1' } });
      expect(prisma.upvote.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when post does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        upvoteResolvers.Mutation.toggleUpvote(
          null,
          { targetId: 'missing_post', targetType: 'POST' },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws NotFoundError when post is soft-deleted', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue({ ...mockForumPost, deletedAt: NOW });
      const ctx = userContext(prisma);

      await expect(
        upvoteResolvers.Mutation.toggleUpvote(
          null,
          { targetId: 'post1', targetType: 'POST' },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('returns accurate upvote count after toggling', async () => {
      const prisma = createMockPrisma();
      prisma.forumPost.findUnique.mockResolvedValue(mockForumPost);
      prisma.upvote.findUnique.mockResolvedValue(null);
      prisma.upvote.create.mockResolvedValue(mockUpvote);
      prisma.upvote.count.mockResolvedValue(42);
      const ctx = userContext(prisma);

      const result = await upvoteResolvers.Mutation.toggleUpvote(
        null,
        { targetId: 'post1', targetType: 'POST' },
        ctx
      );
      expect(result.upvoteCount).toBe(42);
      expect(prisma.upvote.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { targetId: 'post1', targetType: 'POST' } })
      );
    });
  });

  describe('Mutation.toggleUpvote – COMMENT target', () => {
    it('adds an upvote on a comment', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(mockComment);
      prisma.upvote.findUnique.mockResolvedValue(null);
      const commentUpvote = { ...mockUpvote, targetId: 'comment1', targetType: 'COMMENT' as const };
      prisma.upvote.create.mockResolvedValue(commentUpvote);
      prisma.upvote.count.mockResolvedValue(3);
      const ctx = userContext(prisma);

      const result = await upvoteResolvers.Mutation.toggleUpvote(
        null,
        { targetId: 'comment1', targetType: 'COMMENT' },
        ctx
      );

      expect(result.upvoted).toBe(true);
      expect(result.upvoteCount).toBe(3);
    });

    it('removes an upvote on a comment (toggle off)', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(mockComment);
      const commentUpvote = { ...mockUpvote, id: 'cupvote1', targetId: 'comment1', targetType: 'COMMENT' as const };
      prisma.upvote.findUnique.mockResolvedValue(commentUpvote);
      prisma.upvote.delete.mockResolvedValue(commentUpvote);
      prisma.upvote.count.mockResolvedValue(2);
      const ctx = userContext(prisma);

      const result = await upvoteResolvers.Mutation.toggleUpvote(
        null,
        { targetId: 'comment1', targetType: 'COMMENT' },
        ctx
      );

      expect(result.upvoted).toBe(false);
      expect(prisma.upvote.delete).toHaveBeenCalledWith({ where: { id: 'cupvote1' } });
    });

    it('throws NotFoundError when comment does not exist', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue(null);
      const ctx = userContext(prisma);

      await expect(
        upvoteResolvers.Mutation.toggleUpvote(
          null,
          { targetId: 'missing_comment', targetType: 'COMMENT' },
          ctx
        )
      ).rejects.toThrow('not found');
    });

    it('throws NotFoundError when comment is soft-deleted', async () => {
      const prisma = createMockPrisma();
      prisma.comment.findUnique.mockResolvedValue({ ...mockComment, deletedAt: NOW });
      const ctx = userContext(prisma);

      await expect(
        upvoteResolvers.Mutation.toggleUpvote(
          null,
          { targetId: 'comment1', targetType: 'COMMENT' },
          ctx
        )
      ).rejects.toThrow('not found');
    });
  });
});
