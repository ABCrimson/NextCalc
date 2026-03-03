/**
 * Upvote Resolvers
 *
 * Handles toggling upvotes on posts and comments.
 * Uses a transaction to prevent race conditions on concurrent requests.
 */

import type { UpvoteTarget } from '@nextcalc/database';
import type { GraphQLContext } from '../../lib/context';
import { requireAuth } from '../../lib/context';
import { NotFoundError } from '../../lib/errors';

export const upvoteResolvers = {
  Mutation: {
    toggleUpvote: async (
      _parent: unknown,
      args: { targetId: string; targetType: UpvoteTarget },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      // Verify target exists
      if (args.targetType === 'POST') {
        const post = await context.prisma.forumPost.findUnique({
          where: { id: args.targetId },
          select: { id: true, deletedAt: true },
        });
        if (!post || post.deletedAt) {
          throw new NotFoundError('ForumPost', args.targetId);
        }
      } else {
        const comment = await context.prisma.comment.findUnique({
          where: { id: args.targetId },
          select: { id: true, deletedAt: true },
        });
        if (!comment || comment.deletedAt) {
          throw new NotFoundError('Comment', args.targetId);
        }
      }

      // Atomic toggle + count inside a transaction
      const result = await context.prisma.$transaction(async (tx) => {
        const existing = await tx.upvote.findUnique({
          where: {
            userId_targetId_targetType: {
              userId: user.id,
              targetId: args.targetId,
              targetType: args.targetType,
            },
          },
        });

        if (existing) {
          await tx.upvote.delete({ where: { id: existing.id } });
        } else {
          await tx.upvote.create({
            data: {
              userId: user.id,
              targetId: args.targetId,
              targetType: args.targetType,
            },
          });
        }

        const upvoteCount = await tx.upvote.count({
          where: {
            targetId: args.targetId,
            targetType: args.targetType,
          },
        });

        return { upvoted: !existing, upvoteCount };
      });

      return result;
    },
  },
};
