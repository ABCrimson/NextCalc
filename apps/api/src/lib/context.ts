/**
 * GraphQL Context Type & Auth Helpers
 *
 * Context object available to all resolvers.
 * Uses AS5 proper GraphQL error classes for structured error responses
 * with HTTP status codes and error codes.
 */

import type { PrismaClient, User } from '@nextcalc/database';
import type { DataLoaders } from './dataloaders';
import { AuthenticationError, ForbiddenError } from './errors';

export interface GraphQLContext {
  /** Authenticated user (null if not authenticated) */
  user: User | null;

  /** Prisma database client */
  prisma: PrismaClient;

  /** DataLoaders for batched queries (prevents N+1) */
  loaders: DataLoaders;

  /** Request metadata */
  req: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
  };
}

/**
 * Require authenticated user.
 * Throws AuthenticationError (UNAUTHENTICATED / 401) if not signed in.
 */
export const requireAuth = (context: GraphQLContext): User => {
  if (!context.user) {
    throw new AuthenticationError('You must be signed in to perform this action');
  }
  return context.user;
};

/**
 * Require specific role(s).
 * Throws ForbiddenError (FORBIDDEN / 403) if role doesn't match.
 */
export const requireRole = (
  context: GraphQLContext,
  ...roles: Array<'USER' | 'MODERATOR' | 'ADMIN'>
): User => {
  const user = requireAuth(context);
  if (!roles.includes(user.role)) {
    throw new ForbiddenError('Insufficient permissions for this action');
  }
  return user;
};

/**
 * Require resource ownership or ADMIN role.
 * Throws ForbiddenError (FORBIDDEN / 403) if not owner and not admin.
 */
export const requireOwnership = (context: GraphQLContext, resourceUserId: string): User => {
  const user = requireAuth(context);
  if (user.id !== resourceUserId && user.role !== 'ADMIN') {
    throw new ForbiddenError('You do not have permission to access this resource');
  }
  return user;
};
