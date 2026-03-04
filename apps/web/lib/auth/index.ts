/**
 * Authentication Utilities
 *
 * Helper functions for authentication and authorization.
 */

import type { UserRole } from '@nextcalc/database';
import { cache } from 'react';
import { auth } from '../../auth';
import { prisma } from '../prisma';
import { ROLE_HIERARCHY } from './roles';

/**
 * Get the current authenticated user session
 *
 * @returns Session object or null if not authenticated
 */
export async function getSession() {
  return await auth();
}

/**
 * Get the current authenticated user
 *
 * @returns User object or null if not authenticated
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      bio: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
});

/**
 * Require authentication - throw error if not authenticated
 *
 * @returns User session
 * @throws Error if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized - authentication required');
  }
  return session;
}

/**
 * Check if current user has required role
 *
 * @param requiredRole - Minimum role required
 * @returns True if user has required role or higher
 */
export async function hasRole(requiredRole: UserRole): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?.role) {
    return false;
  }

  return ROLE_HIERARCHY[session.user.role] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Require specific role - throw error if not authorized
 *
 * @param requiredRole - Minimum role required
 * @throws Error if user doesn't have required role
 */
export async function requireRole(requiredRole: UserRole) {
  const session = await requireAuth();
  const authorized = await hasRole(requiredRole);

  if (!authorized) {
    throw new Error(
      `Forbidden - ${requiredRole} role required, but user has ${session.user.role} role`,
    );
  }

  return session;
}

/**
 * Invalidate all user sessions by incrementing token version
 *
 * @param userId - User ID to invalidate sessions for
 */
export async function invalidateAllSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: {
        increment: 1,
      },
    },
  });
}
