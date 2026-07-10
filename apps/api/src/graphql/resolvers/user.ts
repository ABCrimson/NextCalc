/**
 * User Resolvers
 *
 * Handles user-related queries and field resolvers.
 */

import type { User } from '@nextcalc/database';
import type { GraphQLContext } from '../../lib/context';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export const userResolvers = {
  Query: {
    /**
     * Get currently authenticated user
     */
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.user) {
        return null;
      }
      return context.user;
    },

    /**
     * Get user by ID
     * Only admins or the user themselves can view full profile
     */
    user: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const requestingUser = context.user;

      const user = await context.prisma.user.findUnique({
        where: { id: args.id },
      });

      if (!user) {
        throw new NotFoundError('User', args.id);
      }

      // Only allow viewing if:
      // 1. Requesting user is an admin
      // 2. Requesting user is viewing their own profile
      if (requestingUser?.role === 'ADMIN' || requestingUser?.id === args.id) {
        return user;
      }

      throw new ForbiddenError('You do not have permission to view this user');
    },
  },

  User: {
    /**
     * Get user's worksheets with optional filtering.
     *
     * The `limit`/`offset`/`visibility` args are schema-default-filled
     * (limit: Int = 20, offset: Int = 0), so "default args" means the
     * caller didn't override any of them. That path is batched via the
     * worksheetsByUserId DataLoader (N+1 prevention when resolving many
     * User.worksheets fields, e.g. a forum author list). Custom args
     * (explicit pagination or an explicit visibility filter) fall back to
     * a direct, per-call Prisma query since those can't be batched behind
     * a single DataLoader key without losing correctness.
     */
    worksheets: async (
      parent: User,
      args: {
        limit?: number;
        offset?: number;
        visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      },
      context: GraphQLContext,
    ) => {
      const requestingUser = context.user;
      const isOwnerOrAdmin = requestingUser?.id === parent.id || requestingUser?.role === 'ADMIN';

      const usesDefaultArgs =
        (args.limit ?? 20) === 20 && (args.offset ?? 0) === 0 && !args.visibility;

      if (usesDefaultArgs) {
        const scope = isOwnerOrAdmin ? 'all' : 'public';
        return context.loaders.worksheetsByUserId.load(`${parent.id}:${scope}`);
      }

      // Build where clause based on visibility and permissions
      const where: {
        userId: string;
        deletedAt: null;
        visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      } = {
        userId: parent.id,
        deletedAt: null,
      };

      // If not the owner or admin, only show PUBLIC worksheets
      if (!isOwnerOrAdmin) {
        where.visibility = 'PUBLIC';
      } else if (args.visibility) {
        where.visibility = args.visibility;
      }

      return context.prisma.worksheet.findMany({
        where,
        take: args.limit || 20,
        skip: args.offset || 0,
        orderBy: { updatedAt: 'desc' },
      });
    },

    /**
     * Get user's folders (batched via DataLoader — no pagination args on
     * this field, so it's always eligible for batching)
     */
    folders: async (parent: User, _args: unknown, context: GraphQLContext) => {
      return context.loaders.foldersByUserId.load(parent.id);
    },

    /**
     * Get total worksheet count
     */
    worksheetCount: async (parent: User, _args: unknown, context: GraphQLContext) => {
      return context.prisma.worksheet.count({
        where: {
          userId: parent.id,
          deletedAt: null,
        },
      });
    },

    /**
     * Get user's forum posts. Default-args path is batched via the
     * forumPostsByUserId DataLoader; custom limit/offset falls back to a
     * direct query (see worksheets() above for the same rationale).
     */
    forumPosts: async (
      parent: User,
      args: { limit?: number; offset?: number },
      context: GraphQLContext,
    ) => {
      const usesDefaultArgs = (args.limit ?? 20) === 20 && (args.offset ?? 0) === 0;

      if (usesDefaultArgs) {
        return context.loaders.forumPostsByUserId.load(parent.id);
      }

      return context.prisma.forumPost.findMany({
        where: {
          userId: parent.id,
          deletedAt: null,
        },
        take: args.limit ?? 20,
        skip: args.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      });
    },
  },
};
