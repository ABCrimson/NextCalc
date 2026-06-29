'use client';

/**
 * Session Provider
 *
 * Wraps the application in NextAuth (Auth.js v5) `SessionProvider` so client
 * components read auth state through the official `useSession()` from
 * `next-auth/react` — and the project's `@/lib/auth/hooks`, which is a thin
 * adapter over it.
 *
 * Using the official provider gives a single shared session context: one
 * `/api/auth/session` fetch with built-in refetch / window-focus revalidation,
 * instead of every component fetching and polling `/api/auth/session`
 * independently.
 *
 * @see https://authjs.dev/getting-started/session-management/get-session
 */

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
