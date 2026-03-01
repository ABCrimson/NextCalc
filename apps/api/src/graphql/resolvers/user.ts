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
     * Get user's worksheets with optional filtering
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
      if (requestingUser?.id !== parent.id && requestingUser?.role !== 'ADMIN') {
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
     * Get user's folders
     */
    folders: async (parent: User, _args: unknown, context: GraphQLContext) => {
      return context.prisma.folder.findMany({
        where: { userId: parent.id },
        orderBy: { name: 'asc' },
      });
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
     * Get user's forum posts
     */
    forumPosts: async (
      parent: User,
      args: { limit?: number; offset?: number },
      context: GraphQLContext,
    ) => {
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
