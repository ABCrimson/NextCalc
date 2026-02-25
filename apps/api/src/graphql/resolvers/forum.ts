/**
 * Forum Post Resolvers
 *
 * Handles forum post CRUD operations with soft delete support.
 */

import type { GraphQLContext } from '../../lib/context';
import { requireAuth, requireOwnership } from '../../lib/context';
import type { ForumPost } from '@nextcalc/database';
import { NotFoundError } from '../../lib/errors';
import { validate, createForumPostSchema, updateForumPostSchema } from '../../lib/validation';

export const forumResolvers = {
  Query: {
    forumPost: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const post = await context.prisma.forumPost.findUnique({
        where: { id: args.id },
      });

      if (!post || post.deletedAt) {
        throw new NotFoundError('ForumPost', args.id);
      }

      // Increment views
      await context.prisma.forumPost.update({
        where: { id: args.id },
        data: { views: { increment: 1 } },
      });

      return post;
    },

    forumPosts: async (
      _parent: unknown,
      args: {
        limit?: number;
        offset?: number;
        tags?: string[];
        searchQuery?: string;
      },
      context: GraphQLContext
    ) => {
      const limit = Math.min(args.limit ?? 20, 100);
      const offset = args.offset ?? 0;

      const where: Record<string, unknown> = { deletedAt: null };

      if (args.tags?.length) {
        where['tags'] = { hasSome: args.tags };
      }

      if (args.searchQuery) {
        where['OR'] = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { content: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      const totalCount = await context.prisma.forumPost.count({ where });

      const posts = await context.prisma.forumPost.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        nodes: posts,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          totalCount,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    },
  },

  Mutation: {
    createForumPost: async (
      _parent: unknown,
      args: { input: { title: string; content: string; tags: string[] } },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const input = validate(createForumPostSchema, args.input);

      return context.prisma.forumPost.create({
        data: {
          title: input.title,
          content: input.content,
          tags: input.tags,
          userId: user.id,
        },
      });
    },

    updateForumPost: async (
      _parent: unknown,
      args: { id: string; input: { title?: string; content?: string; tags?: string[] } },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const input = validate(updateForumPostSchema, args.input);

      const post = await context.prisma.forumPost.findUnique({
        where: { id: args.id },
      });

      if (!post || post.deletedAt) {
        throw new NotFoundError('ForumPost', args.id);
      }

      requireOwnership(context, post.userId);

      return context.prisma.forumPost.update({
        where: { id: args.id },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.content ? { content: input.content } : {}),
          ...(input.tags ? { tags: input.tags } : {}),
        },
      });
    },

    deleteForumPost: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      const post = await context.prisma.forumPost.findUnique({
        where: { id: args.id },
      });

      if (!post || post.deletedAt) {
        throw new NotFoundError('ForumPost', args.id);
      }

      requireOwnership(context, post.userId);

      await context.prisma.forumPost.update({
        where: { id: args.id },
        data: { deletedAt: new Date() },
      });

      await context.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'delete',
          entity: 'forumPost',
          entityId: args.id,
          metadata: { title: post.title },
        },
      });

      return true;
    },
  },

  ForumPost: {
    user: async (parent: ForumPost, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.userId);
    },

    comments: async (
      parent: ForumPost,
      args: { limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      return context.prisma.comment.findMany({
        where: {
          postId: parent.id,
          parentId: null, // Top-level comments only
          deletedAt: null,
        },
        take: args.limit ?? 20,
        skip: args.offset ?? 0,
        orderBy: { createdAt: 'asc' },
      });
    },

    upvoteCount: async (parent: ForumPost, _args: unknown, context: GraphQLContext) => {
      return context.loaders.upvoteCountByTargetId.load(parent.id);
    },

    hasUpvoted: async (parent: ForumPost, _args: unknown, context: GraphQLContext) => {
      if (!context.user) return false;
      const upvote = await context.prisma.upvote.findUnique({
        where: {
          userId_targetId_targetType: {
            userId: context.user.id,
            targetId: parent.id,
            targetType: 'POST',
          },
        },
      });
      return !!upvote;
    },
  },
};
