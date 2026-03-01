/**
 * Authentication Middleware for API Routes
 *
 * Provides middleware functions to protect API routes and GraphQL resolvers.
 */

import type { UserRole } from '@nextcalc/database';
import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '../../auth';
import { can, type Permission } from './rbac';

/**
 * Route context type for Next.js 16
 */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Verify authentication in API route
 *
 * Usage:
 * ```ts
 * export async function GET() {
 *   const session = await verifyAuth();
 *   // ... handle authenticated request
 * }
 * ```
 */
export async function verifyAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized - authentication required');
  }

  return session;
}

/**
 * Verify authorization (role-based) in API route
 *
 * Usage:
 * ```ts
 * export async function DELETE() {
 *   const session = await verifyRole('ADMIN');
 *   // ... handle admin request
 * }
 * ```
 */
export async function verifyRole(requiredRole: UserRole) {
  const session = await verifyAuth();

  const roleHierarchy: Record<UserRole, number> = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
  };

  const userLevel = roleHierarchy[session.user.role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    throw new Error(
      `Forbidden - ${requiredRole} role required, but user has ${session.user.role} role`,
    );
  }

  return session;
}

/**
 * Verify permission in API route
 *
 * Usage:
 * ```ts
 * export async function POST() {
 *   const session = await verifyPermission('forum:post:create');
 *   // ... handle authorized request
 * }
 * ```
 */
export async function verifyPermission(permission: Permission) {
  const session = await verifyAuth();

  if (!can(session.user.role, permission)) {
    throw new Error(`Forbidden - ${permission} permission required`);
  }

  return session;
}

/**
 * Create authenticated API route handler
 *
 * Wraps an API route handler with authentication.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, session, context) => {
 *   // session is guaranteed to exist
 *   return Response.json({ user: session.user });
 * });
 * ```
 */
export function withAuth(
  handler: (req: NextRequest, session: Session, context: RouteContext) => Promise<Response>,
) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      const session = await verifyAuth();
      return await handler(req, session, context);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return Response.json({ error: error.message }, { status: 401 });
      }
      throw error;
    }
  };
}

/**
 * Create role-protected API route handler
 *
 * Wraps an API route handler with role-based authorization.
 *
 * Usage:
 * ```ts
 * export const DELETE = withRole('ADMIN', async (req, session, context) => {
 *   // user is guaranteed to be ADMIN
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function withRole(
  requiredRole: UserRole,
  handler: (req: NextRequest, session: Session, context: RouteContext) => Promise<Response>,
) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      const session = await verifyRole(requiredRole);
      return await handler(req, session, context);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return Response.json({ error: error.message }, { status: 401 });
        }
        if (error.message.includes('Forbidden')) {
          return Response.json({ error: error.message }, { status: 403 });
        }
      }
      throw error;
    }
  };
}

/**
 * Create permission-protected API route handler
 *
 * Wraps an API route handler with permission-based authorization.
 *
 * Usage:
 * ```ts
 * export const POST = withPermission('forum:post:create', async (req, session, context) => {
 *   // user is guaranteed to have the permission
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function withPermission(
  permission: Permission,
  handler: (req: NextRequest, session: Session, context: RouteContext) => Promise<Response>,
) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      const session = await verifyPermission(permission);
      return await handler(req, session, context);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return Response.json({ error: error.message }, { status: 401 });
        }
        if (error.message.includes('Forbidden')) {
          return Response.json({ error: error.message }, { status: 403 });
        }
      }
      throw error;
    }
  };
}
