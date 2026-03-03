/**
 * NextAuth.js v5 (next-auth@5.0.0-beta.30) Main Configuration
 *
 * Integrates with Prisma 7.5.0-dev.33 adapter and extends session with custom user data.
 *
 * @see https://authjs.dev/getting-started/session-management
 */

import { PrismaAdapter } from '@auth/prisma-adapter';
import type { UserRole } from '@nextcalc/database';
import NextAuth from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  // biome-ignore lint/suspicious/noExplicitAny: Generated PrismaClient type differs from @auth/prisma-adapter's expected type
  adapter: PrismaAdapter(prisma as any),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in - add user data to token
      if (user) {
        token.id = user.id!;
        token.role = ((user as unknown as { role?: string }).role || 'USER') as UserRole;
        token.email = user.email!;
        token.name = user.name!;
        token.picture = user.image!;
        token.version = 0;
      }

      // Handle token refresh - check if token is still valid
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tokenVersion: true, role: true },
          });

          // Invalidate token if version doesn't match (user logged out all sessions)
          if (dbUser && dbUser.tokenVersion !== (token.version || 0)) {
            return null as unknown as typeof token;
          }

          // Update role in token if changed
          if (dbUser) {
            token.role = dbUser.role;
          }
        } catch (error) {
          // Database not available - continue with token data
          console.warn('Database not available for token refresh:', error);
        }
      }

      // Handle session update
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser, profile }) {
      if (user.id) {
        try {
          // Sync name and image from the latest OAuth provider profile
          if (!isNewUser && profile) {
            const providerName = profile.name as string | undefined;
            const providerImage = (profile.picture ?? profile.avatar_url) as string | undefined;
            const updates: Record<string, string> = {};
            if (providerName && providerName !== user.name) {
              updates.name = providerName;
            }
            if (providerImage && providerImage !== user.image) {
              updates.image = providerImage;
            }
            if (Object.keys(updates).length > 0) {
              await prisma.user.update({
                where: { id: user.id },
                data: updates,
              });
            }
          }

          // Log sign-in event
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: isNewUser ? 'register' : 'signin',
              entity: 'user',
              entityId: user.id,
              metadata: {
                email: user.email,
                provider: 'oauth',
              },
            },
          });
        } catch (error) {
          // Database not available - skip audit log
          console.warn('Database not available for audit log:', error);
        }
      }
    },
    async signOut(params) {
      // Log sign-out event
      const token = 'token' in params ? params.token : null;
      if (token?.id) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: token.id as string,
              action: 'signout',
              entity: 'user',
              entityId: token.id as string,
            },
          });
        } catch (error) {
          // Database not available - skip audit log
          console.warn('Database not available for audit log:', error);
        }
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
});
