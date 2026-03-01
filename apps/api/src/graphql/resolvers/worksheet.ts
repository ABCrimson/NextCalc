/**
 * Modern Worksheet Resolvers for Apollo Server v5
 *
 * Handles worksheet CRUD operations, sharing, and real-time subscriptions.
 * Features:
 * - Proper authorization with custom error classes
 * - Cache invalidation strategies
 * - Real-time subscriptions via PubSub
 * - Enhanced error handling and logging
 */

import type { SharePermission, Worksheet, WorksheetVisibility } from '@nextcalc/database';
import { queryCache } from '../../lib/cache';
import type { GraphQLContext } from '../../lib/context';
import { requireAuth, requireOwnership } from '../../lib/context';
import {
  buildConnection,
  buildCursorParams,
  type CursorPaginationArgs,
} from '../../lib/cursor-pagination';
import { AuthenticationError, ForbiddenError, NotFoundError } from '../../lib/errors';
import {
  publishUserWorksheetsChanged,
  publishWorksheetUpdate,
  pubsub,
  SUBSCRIPTION_EVENTS,
  subscriptionFilters,
} from '../../lib/subscription';
import {
  createWorksheetSchema,
  shareWorksheetSchema,
  updateWorksheetSchema,
  validate,
} from '../../lib/validation';

export const worksheetResolvers = {
  Query: {
    /**
     * Get worksheet by ID
     * Checks visibility and sharing permissions
     */
    worksheet: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const worksheet = await context.prisma.worksheet.findUnique({
        where: { id: args.id },
        include: {
          user: true,
          shares: true,
        },
      });

      if (!worksheet || worksheet.deletedAt) {
        throw new NotFoundError('Worksheet', args.id);
      }

      // Check access permissions
      const canAccess =
        worksheet.visibility === 'PUBLIC' ||
        worksheet.visibility === 'UNLISTED' ||
        worksheet.userId === context.user?.id ||
        context.user?.role === 'ADMIN' ||
        worksheet.shares.some((share) => share.sharedWith === context.user?.email);

      if (!canAccess) {
        throw new ForbiddenError('You do not have permission to access this worksheet');
      }

      return worksheet;
    },

    /**
     * Get paginated worksheets with filtering
     */
    worksheets: async (
      _parent: unknown,
      args: {
        limit?: number;
        offset?: number;
        visibility?: WorksheetVisibility;
        userId?: string;
        folderId?: string;
        searchQuery?: string;
      },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const limit = Math.min(args.limit || 20, 100);
      const offset = args.offset || 0;

      // Build where clause
      const where: Record<string, unknown> = {
        deletedAt: null,
        userId: args.userId || user.id,
      };

      if (args.visibility) {
        where.visibility = args.visibility;
      }

      if (args.folderId) {
        where.folderId = args.folderId;
      }

      if (args.searchQuery) {
        where.OR = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { description: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      // Get total count for pagination
      const totalCount = await context.prisma.worksheet.count({ where });

      // Get worksheets
      const worksheets = await context.prisma.worksheet.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: true,
          folder: true,
        },
      });

      return {
        nodes: worksheets,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          totalCount,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    },

    /**
     * Get public worksheets (gallery view)
     */
    publicWorksheets: async (
      _parent: unknown,
      args: {
        limit?: number;
        offset?: number;
        searchQuery?: string;
      },
      context: GraphQLContext,
    ) => {
      const limit = Math.min(args.limit || 20, 100);
      const offset = args.offset || 0;

      const where: Record<string, unknown> = {
        deletedAt: null,
        visibility: 'PUBLIC',
      };

      if (args.searchQuery) {
        where.OR = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { description: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      const totalCount = await context.prisma.worksheet.count({ where });

      const worksheets = await context.prisma.worksheet.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ views: 'desc' }, { updatedAt: 'desc' }],
        include: {
          user: true,
        },
      });

      return {
        nodes: worksheets,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          totalCount,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    },

    /**
     * Cursor-paginated worksheets with filtering (Relay-style)
     */
    worksheetsConnection: async (
      _parent: unknown,
      args: CursorPaginationArgs & {
        visibility?: WorksheetVisibility;
        userId?: string;
        folderId?: string;
        searchQuery?: string;
      },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const where: Record<string, unknown> = {
        deletedAt: null,
        userId: args.userId || user.id,
      };

      if (args.visibility) {
        where.visibility = args.visibility;
      }

      if (args.folderId) {
        where.folderId = args.folderId;
      }

      if (args.searchQuery) {
        where.OR = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { description: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      const params = buildCursorParams(args);

      const [items, totalCount] = await Promise.all([
        context.prisma.worksheet.findMany({
          where,
          take: params.take,
          skip: params.skip,
          ...(params.cursor ? { cursor: params.cursor } : {}),
          orderBy: { updatedAt: 'desc' },
          include: { user: true, folder: true },
        }),
        context.prisma.worksheet.count({ where }),
      ]);

      return buildConnection(items, params, totalCount);
    },

    /**
     * Cursor-paginated public worksheets (Relay-style)
     */
    publicWorksheetsConnection: async (
      _parent: unknown,
      args: CursorPaginationArgs & {
        searchQuery?: string;
      },
      context: GraphQLContext,
    ) => {
      const where: Record<string, unknown> = {
        deletedAt: null,
        visibility: 'PUBLIC',
      };

      if (args.searchQuery) {
        where.OR = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { description: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      const params = buildCursorParams(args);

      const [items, totalCount] = await Promise.all([
        context.prisma.worksheet.findMany({
          where,
          take: params.take,
          skip: params.skip,
          ...(params.cursor ? { cursor: params.cursor } : {}),
          orderBy: [{ views: 'desc' }, { updatedAt: 'desc' }],
          include: { user: true },
        }),
        context.prisma.worksheet.count({ where }),
      ]);

      return buildConnection(items, params, totalCount);
    },
  },

  Mutation: {
    /**
     * Create a new worksheet
     */
    createWorksheet: async (
      _parent: unknown,
      args: {
        input: {
          title: string;
          description?: string;
          content: unknown;
          visibility?: WorksheetVisibility;
          folderId?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const input = validate(createWorksheetSchema, args.input);

      // Validate folder ownership if provided
      if (input.folderId) {
        const folder = await context.prisma.folder.findUnique({
          where: { id: input.folderId },
        });

        if (!folder || folder.userId !== user.id) {
          throw new NotFoundError('Folder', input.folderId);
        }
      }

      const worksheet = await context.prisma.worksheet.create({
        data: {
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          content: input.content as object,
          visibility: input.visibility || 'PRIVATE',
          ...(input.folderId ? { folderId: input.folderId } : {}),
          userId: user.id,
        },
        include: {
          user: true,
          folder: true,
        },
      });

      // Invalidate user's worksheet cache
      await queryCache.invalidate('worksheets');
      await queryCache.invalidate('userWorksheetsChanged');

      // Publish subscription event for real-time updates
      const userWorksheets = await context.prisma.worksheet.findMany({
        where: { userId: user.id, deletedAt: null },
      });
      await publishUserWorksheetsChanged(user.id, userWorksheets);

      return worksheet;
    },

    /**
     * Update worksheet
     */
    updateWorksheet: async (
      _parent: unknown,
      args: {
        id: string;
        input: {
          title?: string;
          description?: string;
          content?: unknown;
          visibility?: WorksheetVisibility;
          folderId?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      const input = validate(updateWorksheetSchema, args.input);

      const worksheet = await context.prisma.worksheet.findUnique({
        where: { id: args.id },
      });

      if (!worksheet || worksheet.deletedAt) {
        throw new NotFoundError('Worksheet', args.id);
      }

      requireOwnership(context, worksheet.userId);

      const updated = await context.prisma.worksheet.update({
        where: { id: args.id },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.content ? { content: input.content as object } : {}),
          ...(input.visibility ? { visibility: input.visibility } : {}),
          ...(input.folderId ? { folderId: input.folderId } : {}),
        },
        include: {
          user: true,
          folder: true,
          shares: true,
        },
      });

      // Invalidate caches
      await queryCache.invalidate('worksheet');
      await queryCache.invalidate('worksheets');

      // Publish subscription event for real-time updates
      await publishWorksheetUpdate(args.id, updated);

      return updated;
    },

    /**
     * Delete worksheet (soft delete)
     */
    deleteWorksheet: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);

      const worksheet = await context.prisma.worksheet.findUnique({
        where: { id: args.id },
      });

      if (!worksheet || worksheet.deletedAt) {
        throw new NotFoundError('Worksheet', args.id);
      }

      requireOwnership(context, worksheet.userId);

      await context.prisma.worksheet.update({
        where: { id: args.id },
        data: { deletedAt: new Date() },
      });

      // Invalidate caches
      await queryCache.invalidate('worksheets');

      // Create audit log
      await context.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'delete',
          entity: 'worksheet',
          entityId: args.id,
          metadata: { title: worksheet.title },
        },
      });

      return true;
    },

    /**
     * Share worksheet with another user
     */
    shareWorksheet: async (
      _parent: unknown,
      args: {
        input: {
          worksheetId: string;
          sharedWith: string;
          permission?: SharePermission;
        };
      },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      const input = validate(shareWorksheetSchema, args.input);

      const worksheet = await context.prisma.worksheet.findUnique({
        where: { id: input.worksheetId },
      });

      if (!worksheet || worksheet.deletedAt) {
        throw new NotFoundError('Worksheet', input.worksheetId);
      }

      requireOwnership(context, worksheet.userId);

      const share = await context.prisma.worksheetShare.create({
        data: {
          worksheetId: input.worksheetId,
          sharedWith: input.sharedWith,
          permission: input.permission || 'VIEW',
        },
        include: {
          worksheet: true,
        },
      });

      return share;
    },

    /**
     * Remove worksheet share
     */
    unshareWorksheet: async (
      _parent: unknown,
      args: { worksheetId: string; shareId: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);

      const worksheet = await context.prisma.worksheet.findUnique({
        where: { id: args.worksheetId },
      });

      if (!worksheet || worksheet.deletedAt) {
        throw new NotFoundError('Worksheet', args.worksheetId);
      }

      requireOwnership(context, worksheet.userId);

      await context.prisma.worksheetShare.delete({
        where: { id: args.shareId },
      });

      return true;
    },

    /**
     * Increment worksheet view count
     */
    incrementWorksheetViews: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      await context.prisma.worksheet.update({
        where: { id: args.id },
        data: { views: { increment: 1 } },
      });

      return true;
    },
  },

  Subscription: {
    /**
     * Subscribe to worksheet updates for real-time collaboration
     * Filters updates to only send events for the specific worksheet being watched
     */
    worksheetUpdated: {
      subscribe: (_parent: unknown, _args: { worksheetId: string }, context: GraphQLContext) => {
        requireAuth(context);
        return pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.WORKSHEET_UPDATED]);
      },
      resolve: (
        payload: { worksheetUpdated: Worksheet; worksheetId: string },
        args: { worksheetId: string },
      ) => {
        // Use subscription filter to only send updates for the specific worksheet
        if (subscriptionFilters.worksheetUpdated(payload, args)) {
          return payload.worksheetUpdated;
        }
        return null;
      },
    },

    /**
     * Subscribe to user's worksheet list changes
     * Provides real-time updates when worksheets are added, modified, or deleted
     */
    userWorksheetsChanged: {
      subscribe: (_parent: unknown, args: { userId: string }, context: GraphQLContext) => {
        // Ensure user is authenticated
        if (!context.user) {
          throw new AuthenticationError('You must be logged in to subscribe to worksheet changes');
        }

        // Ensure user can only subscribe to their own worksheets
        if (context.user.id !== args.userId && context.user.role !== 'ADMIN') {
          throw new ForbiddenError('You can only subscribe to your own worksheet changes');
        }

        return pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.USER_WORKSHEETS_CHANGED]);
      },
      resolve: (
        payload: { userWorksheetsChanged: Worksheet[]; userId: string },
        args: { userId: string },
        context: GraphQLContext,
      ) => {
        // Use subscription filter with context for auth check
        if (subscriptionFilters.userWorksheetsChanged(payload, args, context)) {
          return payload.userWorksheetsChanged;
        }
        return null;
      },
    },
  },

  Worksheet: {
    /**
     * Resolve worksheet owner (batched via DataLoader)
     */
    user: async (parent: Worksheet, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.userId);
    },

    /**
     * Resolve worksheet folder (batched via DataLoader)
     */
    folder: async (parent: Worksheet, _args: unknown, context: GraphQLContext) => {
      if (!parent.folderId) return null;
      return context.loaders.folderById.load(parent.folderId);
    },

    /**
     * Resolve worksheet shares (batched via DataLoader)
     */
    shares: async (parent: Worksheet, _args: unknown, context: GraphQLContext) => {
      return context.loaders.worksheetSharesByWorksheetId.load(parent.id);
    },
  },
};
