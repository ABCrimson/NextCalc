/**
 * Upvote Resolvers
 *
 * Handles toggling upvotes on posts and comments.
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
        });
        if (!post || post.deletedAt) {
          throw new NotFoundError('ForumPost', args.targetId);
        }
      } else {
        const comment = await context.prisma.comment.findUnique({
          where: { id: args.targetId },
        });
        if (!comment || comment.deletedAt) {
          throw new NotFoundError('Comment', args.targetId);
        }
      }

      // Check if already upvoted
      const existing = await context.prisma.upvote.findUnique({
        where: {
          userId_targetId_targetType: {
            userId: user.id,
            targetId: args.targetId,
            targetType: args.targetType,
          },
        },
      });

      if (existing) {
        // Remove upvote
        await context.prisma.upvote.delete({
          where: { id: existing.id },
        });
      } else {
        // Add upvote
        await context.prisma.upvote.create({
          data: {
            userId: user.id,
            targetId: args.targetId,
            targetType: args.targetType,
          },
        });
      }

      // Get new count
      const upvoteCount = await context.prisma.upvote.count({
        where: {
          targetId: args.targetId,
          targetType: args.targetType,
        },
      });

      return {
        upvoted: !existing,
        upvoteCount,
      };
    },
  },
};
