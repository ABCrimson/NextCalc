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
import { schema, createDataLoaders, rateLimit, RateLimitError } from '@nextcalc/api/server';
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

/**
 * Rate limiting for SSE endpoint.
 * 200 req/min authenticated, 50 req/min anonymous.
 * Lower than the main GraphQL endpoint since subscriptions are long-lived.
 * Fails open if Redis is unavailable.
 */
async function enforceRateLimit(req: Request): Promise<Response | null> {
  const session = await auth();
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'anonymous';
  const identifier = session?.user?.id || ip;
  const limit = session?.user?.id ? 200 : 50;
  const window = 60;

  try {
    const result = await rateLimit(identifier, limit, window);

    if (!result.allowed) {
      const retryAfter = Math.ceil(
        (result.resetAt.getTime() - Date.now()) / 1000,
      );
      return new Response(
        JSON.stringify({
          errors: [
            {
              message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
              extensions: {
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter,
              },
            },
          ],
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({
          errors: [{ message: error.message, extensions: error.extensions }],
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Redis down — fail open
    console.error('SSE rate limit check failed:', error);
  }

  return null;
}

export const GET = async (req: Request) => {
  try {
    const rateLimitResponse = await enforceRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    return await handler(req);
  } catch (err) {
    console.error('GraphQL SSE error:', err);
    return new Response(null, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  try {
    const rateLimitResponse = await enforceRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    return await handler(req);
  } catch (err) {
    console.error('GraphQL SSE error:', err);
    return new Response(null, { status: 500 });
  }
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
