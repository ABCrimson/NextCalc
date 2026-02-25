/**
 * GraphQL SSE Subscription Endpoint
 *
 * Uses graphql-sse to serve GraphQL subscriptions over Server-Sent Events.
 * This works on Vercel (serverless) unlike WebSocket-based subscriptions.
 *
 * Endpoint: /api/graphql/stream
 *
 * @see https://github.com/enisdenjo/graphql-sse
 */

import { createHandler } from 'graphql-sse/lib/use/fetch';
import { schema, createDataLoaders } from '@nextcalc/api/server';
import type { GraphQLContext } from '@nextcalc/api/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * graphql-sse handler for SSE-based subscriptions.
 *
 * The context function builds a full GraphQLContext for each operation,
 * identical to the one used by the Apollo Server route handler.
 * graphql-sse passes this as `contextValue` to GraphQL execution.
 */
const handler = createHandler({
  schema,
  context: async () => {
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

    return {
      user,
      prisma,
      loaders: createDataLoaders(prisma),
      req: { headers: {} },
    } satisfies GraphQLContext;
  },
});

export const GET = async (req: Request) => {
  try {
    return await handler(req);
  } catch (err) {
    console.error('GraphQL SSE error:', err);
    return new Response(null, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  try {
    return await handler(req);
  } catch (err) {
    console.error('GraphQL SSE error:', err);
    return new Response(null, { status: 500 });
  }
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
