/**
 * Apollo Server 5.5.1 — Next.js Route Handler
 *
 * Provides a createHandler() factory that accepts an auth function,
 * enabling the real NextAuth auth() to be injected at runtime from
 * the web app's route handler.
 *
 * Dependencies:
 * - @apollo/server 5.5.1
 * - @as-integrations/next 4.1.0
 * - graphql 17.0.1
 * - Prisma 7
 */

import { startServerAndCreateNextHandler } from '@as-integrations/next';
import type { Session } from './lib/auth-stub';
import { rateLimit } from './lib/cache';
import type { GraphQLContext } from './lib/context';
import { createDataLoaders } from './lib/dataloaders';
import { RateLimitError } from './lib/errors';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { createApolloServer } from './server';

interface NextRequest {
  headers: Headers;
  ip?: string;
}

interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Create GraphQL context for each request.
 * Uses whichever auth function the handler was built with (see buildHandler).
 */
async function createContext(
  req: NextRequest,
  authFn: () => Promise<Session | null>,
): Promise<GraphQLContext> {
  try {
    const session = await authFn();

    let user = null;
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

    const headersObj: Record<string, string | string[] | undefined> = {};
    req.headers.forEach((value: string, key: string) => {
      headersObj[key] = value;
    });

    const ip =
      req.ip || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

    return {
      user,
      prisma,
      loaders: createDataLoaders(prisma),
      req: {
        headers: headersObj,
        ...(ip ? { ip } : {}),
      },
    };
  } catch (error) {
    logger.error('Context creation error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      user: null,
      prisma,
      loaders: createDataLoaders(prisma),
      req: { headers: {} },
    };
  }
}

/**
 * Rate limiting middleware.
 * Configurable via RATE_LIMIT_AUTH and RATE_LIMIT_ANON env vars.
 * Defaults: 1000 req/min authenticated, 100 req/min anonymous.
 * Fails open if Redis is unavailable.
 */
const authRateLimit = parseInt(process.env['RATE_LIMIT_AUTH'] ?? '1000', 10);
const anonRateLimit = parseInt(process.env['RATE_LIMIT_ANON'] ?? '100', 10);

async function rateLimitMiddleware(_req: NextRequest, context: GraphQLContext): Promise<void> {
  const identifier = context.user?.id || context.req.ip || 'anonymous';
  const limit = context.user ? authRateLimit : anonRateLimit;
  const window = 60;

  try {
    const result = await rateLimit(identifier, limit, window);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
      throw new RateLimitError(
        retryAfter,
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      );
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    // Redis down — fail open
    logger.error('Rate limit check failed, failing open', {
      error: error instanceof Error ? error.message : String(error),
      identifier,
    });
  }
}

/**
 * Build the Next.js route handler with context factory and rate limiting.
 * Returns a unified handler function (not separate GET/POST) per @as-integrations/next API.
 *
 * Constructs its own ApolloServer and closes over `authFn`, so each handler
 * is fully isolated — no shared mutable module state (see HandlerOptions /
 * createHandler below). startServerAndCreateNextHandler start()s the server
 * it receives, and an ApolloServer may only be started once, so sharing one
 * module-scope instance across handlers would throw on the second build.
 */
function buildHandler(authFn: () => Promise<Session | null>) {
  const server = createApolloServer();
  // biome-ignore lint: adapter type mismatch between our NextRequest and the library's
  return (startServerAndCreateNextHandler as Function)(server, {
    context: async (req: NextRequest): Promise<GraphQLContext> => {
      const context = await createContext(req, authFn);
      await rateLimitMiddleware(req, context);
      return context;
    },
  }) as (req: NextRequest) => Promise<Response>;
}

/** Stub auth — always unauthenticated. Used by the default GET/POST exports. */
const stubAuth = async (): Promise<Session | null> => null;

// Default handler (uses stub auth — for testing or standalone use). Built
// lazily on first request so processes that only use createHandler() never
// construct (and start) a second ApolloServer.
let defaultHandler: ((req: NextRequest) => Promise<Response>) | undefined;

function getDefaultHandler(): (req: NextRequest) => Promise<Response> {
  defaultHandler ??= buildHandler(stubAuth);
  return defaultHandler;
}

/**
 * Default GET/POST exports for backward compatibility.
 * These use the stub auth (always returns null user).
 */
export const GET = (req: NextRequest, _ctx: RouteContext): Promise<Response> =>
  getDefaultHandler()(req);
export const POST = (req: NextRequest, _ctx: RouteContext): Promise<Response> =>
  getDefaultHandler()(req);

/**
 * Handler factory with auth injection.
 *
 * Each call builds its own handler closed over `options.auth` — no shared
 * mutable module state, so multiple handlers built with different auth
 * functions (e.g. in tests) never interfere with each other.
 *
 * Usage in apps/web/app/api/graphql/route.ts:
 * ```ts
 * import { createHandler } from '@nextcalc/api';
 * import { auth } from '@/auth';
 * export const { GET, POST } = createHandler({ auth });
 * ```
 */
export interface HandlerOptions {
  auth: () => Promise<Session | null>;
}

export function createHandler(options: HandlerOptions) {
  const handler = buildHandler(options.auth);

  return {
    GET: (req: NextRequest, _ctx: RouteContext): Promise<Response> => handler(req),
    POST: (req: NextRequest, _ctx: RouteContext): Promise<Response> => handler(req),
  };
}

export type { GraphQLContext } from './lib/context';
