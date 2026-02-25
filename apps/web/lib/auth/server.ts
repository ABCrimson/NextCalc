/**
 * Server-Side Authentication Utilities
 *
 * Helper functions for server components and API routes.
 * Uses NextAuth.js v5 with Next.js 16 App Router.
 */

import { auth } from '../../auth';
import type { User, UserRole } from '@nextcalc/database';
import { prisma } from '../prisma';

/**
 * Get the currently authenticated user
 *
 * @returns User object or null if not authenticated
 *
 * @example
 * ```tsx
 * // In a Server Component
 * export default async function ProfilePage() {
 *   const user = await getCurrentUser();
 *
 *   if (!user) {
 *     redirect('/auth/signin');
 *   }
 *
 *   return <div>Welcome {user.name}</div>;
 * }
 * ```
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  return user;
};

/**
 * Require authentication
 *
 * Throws an error if user is not authenticated.
 * Use in API routes or server actions.
 *
 * @returns User object
 * @throws Error if not authenticated
 *
 * @example
 * ```tsx
 * // In an API route
 * export async function POST(req: Request) {
 *   const user = await requireAuth();
 *
 *   // User is guaranteed to be authenticated here
 *   // ...
 * }
 * ```
 */
export const requireAuth = async (): Promise<User> => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
};

/**
 * Require specific role
 *
 * Throws an error if user doesn't have required role.
 *
 * @param roles Required roles (user must have one of them)
 * @returns User object
 * @throws Error if not authenticated or insufficient permissions
 *
 * @example
 * ```tsx
 * // In an API route
 * export async function DELETE(req: Request) {
 *   const user = await requireRole('ADMIN', 'MODERATOR');
 *
 *   // User is guaranteed to be admin or moderator here
 *   // ...
 * }
 * ```
 */
export const requireRole = async (...roles: UserRole[]): Promise<User> => {
  const user = await requireAuth();

  if (!roles.includes(user.role)) {
    throw new Error('Insufficient permissions');
  }

  return user;
};

/**
 * Check if user has role
 *
 * @param roles Roles to check for
 * @returns True if user has one of the roles
 *
 * @example
 * ```tsx
 * // In a Server Component
 * export default async function AdminPanel() {
 *   const isAdmin = await hasRole('ADMIN');
 *
 *   if (!isAdmin) {
 *     return <div>Access denied</div>;
 *   }
 *
 *   return <AdminControls />;
 * }
 * ```
 */
export const hasRole = async (...roles: UserRole[]): Promise<boolean> => {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  return roles.includes(user.role);
};

/**
 * Check if user is authenticated
 *
 * @returns True if user is authenticated
 *
 * @example
 * ```tsx
 * // In a Server Component
 * export default async function Header() {
 *   const isAuthenticated = await isAuth();
 *
 *   return (
 *     <nav>
 *       {isAuthenticated ? <UserMenu /> : <SignInButton />}
 *     </nav>
 *   );
 * }
 * ```
 */
export const isAuth = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};

/**
 * Get session with user
 *
 * Returns the full session object from NextAuth.
 *
 * @returns Session object or null
 *
 * @example
 * ```tsx
 * // In a Server Component
 * export default async function Page() {
 *   const session = await getSession();
 *
 *   if (!session) {
 *     return <SignInPrompt />;
 *   }
 *
 *   return <div>Hello {session.user.name}</div>;
 * }
 * ```
 */
export const getSession = async () => {
  return auth();
};

/**
 * Require ownership of a resource
 *
 * Throws an error if user is not the owner (unless admin).
 *
 * @param resourceUserId User ID of the resource owner
 * @returns User object
 * @throws Error if not authorized
 *
 * @example
 * ```tsx
 * // In an API route
 * export async function DELETE(req: Request, { params }: { params: { id: string } }) {
 *   const worksheet = await prisma.worksheet.findUnique({
 *     where: { id: params.id },
 *   });
 *
 *   if (!worksheet) {
 *     return new Response('Not found', { status: 404 });
 *   }
 *
 *   const user = await requireOwnership(worksheet.userId);
 *
 *   // User is guaranteed to be the owner or admin here
 *   // ...
 * }
 * ```
 */
export const requireOwnership = async (resourceUserId: string): Promise<User> => {
  const user = await requireAuth();

  if (user.id !== resourceUserId && user.role !== 'ADMIN') {
    throw new Error('You do not have permission to access this resource');
  }

  return user;
};
