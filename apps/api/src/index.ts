/**
 * Apollo Server 5.4.0 — Next.js Route Handler
 *
 * Provides a createHandler() factory that accepts an auth function,
 * enabling the real NextAuth auth() to be injected at runtime from
 * the web app's route handler.
 *
 * Dependencies:
 * - @apollo/server 5.4.0
 * - @as-integrations/next 4.1.0
 * - graphql 16.12.0
 * - Prisma 7.5.0-dev.14
 */

import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { server } from './server';
import { prisma } from './lib/prisma';
import { rateLimit } from './lib/cache';
import type { GraphQLContext } from './lib/context';
import { createDataLoaders } from './lib/dataloaders';
import { auth as authStub, setAuthFunction } from './lib/auth-stub';
import { RateLimitError } from './lib/errors';

interface NextRequest {
	headers: Headers;
	ip?: string;
}

interface RouteContext {
	params: Promise<Record<string, string>>;
}

/**
 * Create GraphQL context for each request.
 * Uses the configured auth function (real or stub).
 */
async function createContext(req: NextRequest): Promise<GraphQLContext> {
	try {
		const session = await authStub();

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
			req.ip ||
			req.headers.get('x-forwarded-for') ||
			req.headers.get('x-real-ip') ||
			undefined;

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
		console.error('Context creation error:', error);
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
 * 1000 req/min authenticated, 100 req/min anonymous.
 * Fails open if Redis is unavailable.
 */
async function rateLimitMiddleware(
	_req: NextRequest,
	context: GraphQLContext,
): Promise<void> {
	const identifier = context.user?.id || context.req.ip || 'anonymous';
	const limit = context.user ? 1000 : 100;
	const window = 60;

	try {
		const result = await rateLimit(identifier, limit, window);

		if (!result.allowed) {
			const retryAfter = Math.ceil(
				(result.resetAt.getTime() - Date.now()) / 1000,
			);
			throw new RateLimitError(
				retryAfter,
				`Rate limit exceeded. Try again in ${retryAfter} seconds.`,
			);
		}
	} catch (error) {
		if (error instanceof RateLimitError) throw error;
		// Redis down — fail open
		console.error('Rate limit check failed:', error);
	}
}

/**
 * Build the Next.js route handler with context factory and rate limiting.
 */
function buildHandler() {
	// biome-ignore lint/suspicious/noExplicitAny: @as-integrations/next type signatures don't match our NextRequest type
	return (startServerAndCreateNextHandler as any)(server, {
		context: async (req: NextRequest): Promise<GraphQLContext> => {
			const context = await createContext(req);
			await rateLimitMiddleware(req, context);
			return context;
		},
	});
}

// Default handler (uses stub auth — for testing or standalone use)
const defaultHandler = buildHandler();

/**
 * Default GET/POST exports for backward compatibility.
 * These use the stub auth (always returns null user).
 */
export const GET = (req: NextRequest, _ctx: RouteContext): Promise<Response> =>
	defaultHandler.GET(req);
export const POST = (req: NextRequest, _ctx: RouteContext): Promise<Response> =>
	defaultHandler.POST(req);

/**
 * Handler factory with auth injection.
 *
 * Usage in apps/web/app/api/graphql/route.ts:
 * ```ts
 * import { createHandler } from '@nextcalc/api';
 * import { auth } from '@/auth';
 * export const { GET, POST } = createHandler({ auth });
 * ```
 */
export interface HandlerOptions {
	auth: () => Promise<{
		user?: {
			id: string;
			email?: string | null;
			name?: string | null;
			image?: string | null;
		};
		expires?: string;
	} | null>;
}

export function createHandler(options: HandlerOptions) {
	// Inject the real auth function
	setAuthFunction(options.auth);

	const handler = buildHandler();

	return {
		GET: (req: NextRequest, _ctx: RouteContext): Promise<Response> =>
			handler.GET(req),
		POST: (req: NextRequest, _ctx: RouteContext): Promise<Response> =>
			handler.POST(req),
	};
}

/** Re-exports for external use */
export { server } from './server';
export type { GraphQLContext } from './lib/context';
