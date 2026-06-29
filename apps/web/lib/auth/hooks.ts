/**
 * Authentication Hooks
 *
 * Client-side auth helpers for NextCalc, built as a thin, ergonomic layer over
 * NextAuth (Auth.js v5) `next-auth/react`. The provider lives in
 * `@/components/providers/session-provider` and is mounted in the locale layout,
 * so every `useSession()` call shares ONE session context (a single
 * `/api/auth/session` request with built-in refetch / focus revalidation)
 * rather than each component fetching and polling on its own.
 *
 * @see https://authjs.dev/getting-started/session-management/get-session
 */

'use client';

import type { UserRole } from '@nextcalc/database';
import type { Session } from 'next-auth';
import { signOut as nextAuthSignOut, useSession as useNextAuthSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * Session type — re-exported from NextAuth so the augmented `user` shape
 * (id / email / name / image / role, see `types/next-auth.d.ts`) is the single
 * source of truth.
 */
export type { Session };

/**
 * Session status
 */
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Use Session Hook
 *
 * Returns the current session and loading state from the shared NextAuth
 * `SessionProvider` context. Keeps the project's `{ session, status }` shape
 * (NextAuth's native hook exposes the session as `data`).
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { session, status } = useSession();
 *
 *   if (status === 'loading') return <div>Loading...</div>;
 *   if (status === 'unauthenticated') return <div>Not signed in</div>;
 *
 *   return <div>Welcome {session.user.name}</div>;
 * }
 * ```
 */
export const useSession = (): { session: Session | null; status: SessionStatus } => {
  const { data, status } = useNextAuthSession();
  return { session: data, status };
};

/**
 * Use User Hook
 *
 * Returns the current authenticated user or null.
 * Shorthand for accessing session.user.
 */
export const useUser = () => {
  const { session } = useSession();
  return session?.user ?? null;
};

/**
 * Use Required Auth Hook
 *
 * Redirects to sign-in page if user is not authenticated.
 * Useful for protected pages.
 *
 * @param redirectUrl URL to redirect to after sign in (default: current page)
 */
export const useRequireAuth = (redirectUrl?: string) => {
  const { session, status } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated' && !isRedirecting) {
      setIsRedirecting(true);
      const callbackUrl = redirectUrl || window.location.pathname;
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
  }, [status, redirectUrl, isRedirecting]);

  if (status === 'loading' || status === 'unauthenticated' || isRedirecting) {
    return null;
  }

  return session?.user ?? null;
};

/**
 * Use Role Check Hook
 *
 * Checks if the current user has one of the given roles.
 */
export const useHasRole = (...requiredRoles: UserRole[]) => {
  const user = useUser();
  if (!user) return false;
  return requiredRoles.includes(user.role);
};

/**
 * Sign In Function
 *
 * Redirects to the app's custom sign-in page with a callback URL.
 *
 * @param callbackUrl URL to redirect to after sign in
 */
export const signIn = (callbackUrl = '/') => {
  window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
};

/**
 * Sign Out Function
 *
 * Signs out the current user via NextAuth and redirects.
 *
 * @param callbackUrl URL to redirect to after sign out (default: home page)
 */
export const signOut = async (callbackUrl = '/') => {
  await nextAuthSignOut({ callbackUrl });
};

/**
 * Use Auth Loading Hook
 *
 * Returns true while authentication state is being determined.
 */
export const useAuthLoading = () => {
  const { status } = useSession();
  return status === 'loading';
};

/**
 * Use Is Authenticated Hook
 *
 * Returns true if user is authenticated.
 */
export const useIsAuthenticated = () => {
  const { status } = useSession();
  return status === 'authenticated';
};
