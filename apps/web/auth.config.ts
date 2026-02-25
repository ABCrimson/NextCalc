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
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

// Only include providers whose credentials are configured
const providers: Provider[] = [];

if (process.env['GITHUB_CLIENT_ID'] && process.env['GITHUB_CLIENT_SECRET']) {
  providers.push(
    GitHub({
      clientId: process.env['GITHUB_CLIENT_ID'],
      clientSecret: process.env['GITHUB_CLIENT_SECRET'],
    }),
  );
}

if (process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']) {
  providers.push(
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID'],
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
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
  secret: (process.env['AUTH_SECRET'] || process.env['NEXTAUTH_SECRET'])!,
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
