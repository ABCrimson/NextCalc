/**
 * Apollo Client — React Server Component Client
 *
 * Registered client for use in Server Components and Server Actions.
 * Uses registerApolloClient from @apollo/client-integration-nextjs
 * to provide getClient(), query(), and PreloadQuery for RSC usage.
 *
 * Execution is IN-PROCESS via SchemaLink over the same executable schema the
 * /api/graphql route handler serves — not an HTTP self-fetch. A self-fetch
 * needs an absolute self-origin, which is unreliable on Vercel (VERCEL_URL is
 * deployment-protected and returns a 401 challenge to anonymous
 * server-to-server requests; env-configured origins are unset on previews).
 * See ssr-schema-link.server.ts for the full write-up.
 *
 * Unlike the anonymous streaming-SSR link, this client runs in a request
 * context where NextAuth is available, so it builds an AUTHENTICATED context
 * (same shape as app/api/graphql/stream/route.ts).
 *
 * Important: RSC queries are NOT updated in the browser when cache changes.
 * Use Client Component hooks (useQuery/useSuspenseQuery) for dynamic data.
 * Reserve RSC queries for static or initial page data.
 */

import { SchemaLink } from '@apollo/client/link/schema';
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs';
import { createDataLoaders, type GraphQLContext, schema } from '@nextcalc/api/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const { getClient, query, PreloadQuery } = registerApolloClient(async () => {
  // Resolve the NextAuth session once per request-scoped client so resolvers
  // see the signed-in user (cookie-based auth, previously forwarded over HTTP).
  const session = await auth();

  let user: GraphQLContext['user'] = null;
  if (session?.user?.id) {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        image: true,
        bio: true,
        role: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new SchemaLink({
      schema,
      // Per-operation context: DataLoaders must be fresh for every operation
      // so their caches never leak across operations.
      context: (): GraphQLContext => ({
        user,
        prisma,
        loaders: createDataLoaders(prisma),
        req: { headers: {} },
      }),
    }),
  });
});
