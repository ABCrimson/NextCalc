/**
 * Forum Post Resolvers
 *
 * Handles forum post CRUD operations with soft delete support.
 */

import type { ForumPost, Prisma } from '@nextcalc/database';
import type { GraphQLContext } from '../../lib/context';
import { requireAuth, requireOwnership } from '../../lib/context';
import {
  buildConnection,
  buildCursorParams,
  type CursorPaginationArgs,
} from '../../lib/cursor-pagination';
import { NotFoundError } from '../../lib/errors';
import { createForumPostSchema, updateForumPostSchema, validate } from '../../lib/validation';

export const forumResolvers = {
  Query: {
    forumPost: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const post = await context.prisma.forumPost.findUnique({
        where: { id: args.id },
      });

      if (!post || post.deletedAt) {
        throw new NotFoundError('ForumPost', args.id);
      }

      // Fire-and-forget view increment — keeps query as a pure read
      context.prisma.forumPost
        .update({ where: { id: args.id }, data: { views: { increment: 1 } } })
        .catch(() => {});

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
      context: GraphQLContext,
    ) => {
      const limit = Math.min(args.limit ?? 20, 100);
      const offset = args.offset ?? 0;

      const where: Prisma.ForumPostWhereInput = { deletedAt: null };

      if (args.tags?.length) {
        where.tags = { hasSome: args.tags };
      }

      if (args.searchQuery) {
        where.OR = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { content: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      const [totalCount, posts] = await Promise.all([
        context.prisma.forumPost.count({ where }),
        context.prisma.forumPost.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

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

    /**
     * Cursor-paginated forum posts (Relay-style)
     */
    forumPostsConnection: async (
      _parent: unknown,
      args: CursorPaginationArgs & {
        tags?: string[];
        searchQuery?: string;
      },
      context: GraphQLContext,
    ) => {
      const where: Prisma.ForumPostWhereInput = { deletedAt: null };

      if (args.tags?.length) {
        where.tags = { hasSome: args.tags };
      }

      if (args.searchQuery) {
        where.OR = [
          { title: { contains: args.searchQuery, mode: 'insensitive' } },
          { content: { contains: args.searchQuery, mode: 'insensitive' } },
        ];
      }

      const params = buildCursorParams(args);

      const [items, totalCount] = await Promise.all([
        context.prisma.forumPost.findMany({
          where,
          take: params.take,
          skip: params.skip,
          ...(params.cursor ? { cursor: params.cursor } : {}),
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        }),
        context.prisma.forumPost.count({ where }),
      ]);

      return buildConnection(items, params, totalCount);
    },
  },

  Mutation: {
    createForumPost: async (
      _parent: unknown,
      args: { input: { title: string; content: string; tags: string[] } },
      context: GraphQLContext,
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
      context: GraphQLContext,
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
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
        },
      });
    },

    deleteForumPost: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
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

      // Audit log runs in parallel with any other post-mutation work
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
      context: GraphQLContext,
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

    commentCount: async (parent: ForumPost, _args: unknown, context: GraphQLContext) => {
      return context.loaders.commentCountByPostId.load(parent.id);
    },

    upvoteCount: async (parent: ForumPost, _args: unknown, context: GraphQLContext) => {
      return context.loaders.upvoteCountByTargetId.load(parent.id);
    },

    hasUpvoted: async (parent: ForumPost, _args: unknown, context: GraphQLContext) => {
      if (!context.user) return false;
      return context.loaders.hasUpvoted.load(`${context.user.id}:${parent.id}:POST`);
    },
  },
};
