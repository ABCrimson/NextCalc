/**
 * NextAuth.js v5 (next-auth@5.0.0-beta.30) Configuration
 *
 * This file contains the core authentication configuration including:
 * - OAuth providers (Google, GitHub) — only enabled when credentials are set
 * - JWT session strategy
 * - Prisma adapter for database sessions
 * - Custom callbacks for user data
 *
 * @see https://authjs.dev/getting-started
 */

import type { NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

// Only include providers whose credentials are configured.
// Accept multiple env-var naming conventions (AUTH_*, *_CLIENT_*, legacy *_ID/*_SECRET).
const providers: Provider[] = [];

const githubId = (
  process.env['AUTH_GITHUB_ID'] || process.env['GITHUB_CLIENT_ID'] || process.env['GITHUB_ID'] || ''
).trim();
const githubSecret = (
  process.env['AUTH_GITHUB_SECRET'] ||
  process.env['GITHUB_CLIENT_SECRET'] ||
  process.env['GITHUB_SECRET'] || ''
).trim();

if (githubId && githubSecret) {
  providers.push(
    GitHub({
      clientId: githubId,
      clientSecret: githubSecret,
    }),
  );
}

const googleId = (
  process.env['AUTH_GOOGLE_ID'] || process.env['GOOGLE_CLIENT_ID'] || process.env['GOOGLE_ID'] || ''
).trim();
const googleSecret = (
  process.env['AUTH_GOOGLE_SECRET'] ||
  process.env['GOOGLE_CLIENT_SECRET'] ||
  process.env['GOOGLE_SECRET'] || ''
).trim();

if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  );
}

export const authConfig = {
  secret: (process.env['AUTH_SECRET'] || process.env['NEXTAUTH_SECRET'] || '').trim(),
  providers,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
