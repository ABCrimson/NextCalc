/**
 * NextAuth.js v5 (next-auth@5.0.0-beta.31) Main Configuration
 *
 * Integrates with the Prisma 7 adapter and extends session with custom user data.
 *
 * @see https://authjs.dev/getting-started/session-management
 */

import { PrismaAdapter } from '@auth/prisma-adapter';
import { UserRole } from '@nextcalc/database';
import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';

/**
 * Type guard validating that an unknown value is a {@link UserRole}.
 * Used to safely narrow the role carried on the authenticated user/profile
 * without resorting to unchecked type assertions.
 */
function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (Object.values(UserRole) as string[]).includes(value);
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  // @auth/prisma-adapter is typed against its own bundled @prisma/client; our Prisma 7
  // client (@nextcalc/database) is structurally identical but a distinct nominal type, so
  // we cast to the adapter's exact expected parameter type (not `any`). Upstream type-only
  // incompatibility — safe at runtime.
  adapter: PrismaAdapter(prisma as Parameters<typeof PrismaAdapter>[0]),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }): Promise<JWT | null> {
      // Initial sign in - add user data to token
      if (user) {
        // user.id is `string | undefined` on the base User type; it is always
        // present for the AdapterUser at initial sign-in. Guard instead of
        // asserting so a missing id can't silently become an empty token.id.
        if (user.id) token.id = user.id;
        token.role = isUserRole(user.role) ? user.role : UserRole.USER;
        // email/name/image are legitimately nullable (OAuth profiles may omit
        // them); the JWT fields are typed `string | null`, so coalesce any
        // `undefined` to `null` to match the declared field type exactly.
        token.email = user.email ?? null;
        token.name = user.name ?? null;
        token.picture = user.image ?? null;
        token.version = 0;
      }

      // Handle token refresh - check if token is still valid
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { tokenVersion: true, role: true },
          });

          // Invalidate token if version doesn't match (user logged out all sessions)
          if (dbUser && dbUser.tokenVersion !== (token.version || 0)) {
            return null;
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
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.email = token.email ?? '';
        session.user.name = token.name ?? '';
        session.user.image = token.picture ?? '';
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
            const providerImage = (profile.picture ?? profile['avatar_url']) as string | undefined;
            const updates: Record<string, string> = {};
            if (providerName && providerName !== user.name) {
              updates['name'] = providerName;
            }
            // Custom same-origin avatars (paths like /icons/levels/*.svg) are user-curated and must survive OAuth sign-ins.
            const imageIsSyncable = !user.image || user.image.startsWith('http');
            if (providerImage && imageIsSyncable && providerImage !== user.image) {
              updates['image'] = providerImage;
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
              userId: token.id,
              action: 'signout',
              entity: 'user',
              entityId: token.id,
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
