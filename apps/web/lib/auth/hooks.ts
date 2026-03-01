/**
 * Authentication Hooks
 *
 * Client-side hooks for managing authentication state.
 * Compatible with Next.js 16 and NextAuth.js v5.
 *
 * @see https://next-auth.js.org/getting-started/client
 */

'use client';

import type { UserRole } from '@nextcalc/database';
import { useEffect, useState } from 'react';

/**
 * Session type from NextAuth
 */
export interface Session {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
    role: UserRole;
  };
  expires: string;
}

/**
 * Session status
 */
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Use Session Hook
 *
 * Returns the current session and loading state.
 * Automatically refreshes when session changes.
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
export const useSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data && data.user) {
            setSession(data as Session);
            setStatus('authenticated');
          } else {
            setSession(null);
            setStatus('unauthenticated');
          }
        } else {
          setSession(null);
          setStatus('unauthenticated');
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        setSession(null);
        setStatus('unauthenticated');
      }
    };

    fetchSession();

    // Poll for session changes every 5 minutes
    const interval = setInterval(fetchSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { session, status };
};

/**
 * Use User Hook
 *
 * Returns the current authenticated user or null.
 * Shorthand for accessing session.user.
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useUser();
 *
 *   if (!user) return <div>Please sign in</div>;
 *
 *   return <div>Hello {user.name}</div>;
 * }
 * ```
 */
export const useUser = () => {
  const { session } = useSession();
  return session?.user || null;
};

/**
 * Use Required Auth Hook
 *
 * Redirects to sign-in page if user is not authenticated.
 * Useful for protected pages.
 *
 * @param redirectUrl URL to redirect to after sign in (default: current page)
 *
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const user = useRequireAuth();
 *
 *   // User is guaranteed to be authenticated here
 *   return <div>Welcome {user.name}</div>;
 * }
 * ```
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

  if (status === 'loading' || isRedirecting) {
    return null;
  }

  return session?.user || null;
};

/**
 * Use Role Check Hook
 *
 * Checks if the current user has a specific role.
 *
 * @param requiredRoles Roles to check for
 * @returns True if user has one of the required roles
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const isAdmin = useHasRole('ADMIN');
 *   const canModerate = useHasRole('ADMIN', 'MODERATOR');
 *
 *   if (!isAdmin) return <div>Access denied</div>;
 *
 *   return <div>Admin controls...</div>;
 * }
 * ```
 */
export const useHasRole = (...requiredRoles: UserRole[]) => {
  const user = useUser();

  if (!user) return false;

  return requiredRoles.includes(user.role);
};

/**
 * Sign In Function
 *
 * Redirects to sign-in page with callback URL.
 *
 * @param callbackUrl URL to redirect to after sign in
 *
 * @example
 * ```tsx
 * function LoginButton() {
 *   return (
 *     <button onClick={() => signIn('/dashboard')}>
 *       Sign in
 *     </button>
 *   );
 * }
 * ```
 */
export const signIn = (callbackUrl = '/dashboard') => {
  window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
};

/**
 * Sign Out Function
 *
 * Signs out the current user and redirects to home page.
 *
 * @param callbackUrl URL to redirect to after sign out (default: home page)
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   return (
 *     <button onClick={() => signOut()}>
 *       Sign out
 *     </button>
 *   );
 * }
 * ```
 */
export const signOut = async (callbackUrl = '/') => {
  try {
    // Call sign-out endpoint
    await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Redirect to callback URL
    window.location.href = callbackUrl;
  } catch (error) {
    console.error('Sign out error:', error);
  }
};

/**
 * Use Auth Loading Hook
 *
 * Returns true while authentication state is being determined.
 * Useful for showing loading states.
 *
 * @example
 * ```tsx
 * function App() {
 *   const isLoading = useAuthLoading();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return <MainContent />;
 * }
 * ```
 */
export const useAuthLoading = () => {
  const { status } = useSession();
  return status === 'loading';
};

/**
 * Use Is Authenticated Hook
 *
 * Returns true if user is authenticated.
 *
 * @example
 * ```tsx
 * function NavBar() {
 *   const isAuthenticated = useIsAuthenticated();
 *
 *   return (
 *     <nav>
 *       {isAuthenticated ? (
 *         <UserMenu />
 *       ) : (
 *         <button onClick={() => signIn()}>Sign in</button>
 *       )}
 *     </nav>
 *   );
 * }
 * ```
 */
export const useIsAuthenticated = () => {
  const { status } = useSession();
  return status === 'authenticated';
};
