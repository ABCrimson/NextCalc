/**
 * Comment Resolvers
 *
 * Handles comment CRUD with nested reply support.
 */

import type { Comment } from '@nextcalc/database';
import type { GraphQLContext } from '../../lib/context';
import { requireAuth, requireOwnership } from '../../lib/context';
import { NotFoundError } from '../../lib/errors';
import { createCommentSchema, updateCommentSchema, validate } from '../../lib/validation';

export const commentResolvers = {
  Query: {
    comments: async (
      _parent: unknown,
      args: { postId: string; limit?: number; offset?: number },
      context: GraphQLContext,
    ) => {
      return context.prisma.comment.findMany({
        where: {
          postId: args.postId,
          parentId: null, // Top-level only
          deletedAt: null,
        },
        take: args.limit ?? 20,
        skip: args.offset ?? 0,
        orderBy: { createdAt: 'asc' },
      });
    },
  },

  Mutation: {
    createComment: async (
      _parent: unknown,
      args: { input: { postId: string; content: string; parentId?: string } },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const input = validate(createCommentSchema, args.input);

      // Verify post exists
      const post = await context.prisma.forumPost.findUnique({
        where: { id: input.postId },
      });

      if (!post || post.deletedAt || post.isClosed) {
        throw new NotFoundError('ForumPost', input.postId);
      }

      // Verify parent comment if replying
      if (input.parentId) {
        const parent = await context.prisma.comment.findUnique({
          where: { id: input.parentId },
        });
        if (!parent || parent.deletedAt || parent.postId !== input.postId) {
          throw new NotFoundError('Comment', input.parentId);
        }
      }

      return context.prisma.comment.create({
        data: {
          content: input.content,
          postId: input.postId,
          ...(input.parentId ? { parentId: input.parentId } : {}),
          userId: user.id,
        },
      });
    },

    updateComment: async (
      _parent: unknown,
      args: { id: string; input: { content: string } },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      const input = validate(updateCommentSchema, args.input);

      const comment = await context.prisma.comment.findUnique({
        where: { id: args.id },
      });

      if (!comment || comment.deletedAt) {
        throw new NotFoundError('Comment', args.id);
      }

      requireOwnership(context, comment.userId);

      return context.prisma.comment.update({
        where: { id: args.id },
        data: { content: input.content },
      });
    },

    deleteComment: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);

      const comment = await context.prisma.comment.findUnique({
        where: { id: args.id },
      });

      if (!comment || comment.deletedAt) {
        throw new NotFoundError('Comment', args.id);
      }

      requireOwnership(context, comment.userId);

      await context.prisma.comment.update({
        where: { id: args.id },
        data: { deletedAt: new Date() },
      });

      await context.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'delete',
          entity: 'comment',
          entityId: args.id,
        },
      });

      return true;
    },
  },

  Comment: {
    user: async (parent: Comment, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.userId);
    },

    post: async (parent: Comment, _args: unknown, context: GraphQLContext) => {
      return context.loaders.forumPostById.load(parent.postId);
    },

    parent: async (parent: Comment, _args: unknown, context: GraphQLContext) => {
      if (!parent.parentId) return null;
      return context.loaders.commentById.load(parent.parentId);
    },

    replies: async (parent: Comment, _args: unknown, context: GraphQLContext) => {
      return context.loaders.repliesByParentCommentId.load(parent.id);
    },

    upvoteCount: async (parent: Comment, _args: unknown, context: GraphQLContext) => {
      return context.loaders.upvoteCountByTargetId.load(parent.id);
    },

    hasUpvoted: async (parent: Comment, _args: unknown, context: GraphQLContext) => {
      if (!context.user) return false;
      return context.loaders.hasUpvoted.load(`${context.user.id}:${parent.id}:COMMENT`);
    },
  },
};
