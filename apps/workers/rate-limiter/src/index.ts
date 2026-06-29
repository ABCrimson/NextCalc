/**
 * NextCalc Pro - Rate Limiter Service
 *
 * A Cloudflare Worker providing atomic sliding-window rate limiting via
 * Durable Objects. Each identifier is mapped to a single DO instance via
 * idFromName(identifier), serialising concurrent requests and eliminating
 * the KV read-modify-write race condition.
 *
 * Storage layout:
 *   RATE_LIMITER  — DurableObjectNamespace, one instance per identifier.
 *                   Holds the sliding-window timestamp log in SQLite.
 *   RATE_LIMITS   — KVNamespace, used ONLY as an identifier index so that
 *                   /admin/keys can enumerate active identifiers. The counter
 *                   itself always lives in the DO.
 *
 * @author NextCalc Pro Team
 * @version 2.0.0
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import type { RateLimiterDurableObject } from './durable-objects/rate-limiter-do.js';
import { ipRateLimitMiddleware } from './middleware/ratelimit.js';
import { getRecommendedTier, RATE_LIMIT_CONFIGS, type UserTier } from './utils/sliding-window.js';

// Re-export the DO class so Wrangler can locate it as a named export of the
// entrypoint module. Workers require the DO class to be exported from the
// same module that is declared as `main` in wrangler.toml.
export { RateLimiterDurableObject } from './durable-objects/rate-limiter-do.js';

// ---------------------------------------------------------------------------
// Environment bindings
// ---------------------------------------------------------------------------

type Bindings = {
  /** DO namespace — one instance per identifier, holds the rate-limit state. */
  RATE_LIMITER: DurableObjectNamespace<RateLimiterDurableObject>;
  /**
   * KV namespace — used exclusively as an identifier index for /admin/keys.
   * The rate-limit counter is never stored here; the DO owns all counters.
   */
  RATE_LIMITS: KVNamespace;
  ALLOWED_ORIGINS: string;
  ADMIN_KEY: string;
};

// ---------------------------------------------------------------------------
// Timing-safe string comparison
// ---------------------------------------------------------------------------

/**
 * Timing-safe string comparison using SHA-256 digests via the Web Crypto API.
 *
 * A plain `===` comparison leaks information through execution time differences
 * (short-circuit on first mismatched byte). Hashing both values first produces
 * fixed-length byte arrays so the XOR loop always runs for the same number of
 * iterations regardless of where the strings diverge, eliminating the timing
 * side-channel.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  if (viewA.length !== viewB.length) return false;
  // Use DataView to avoid noUncheckedIndexedAccess non-null assertions.
  const dvA = new DataView(hashA);
  const dvB = new DataView(hashB);
  let diff = 0;
  for (let i = 0; i < dvA.byteLength; i++) {
    diff |= dvA.getUint8(i) ^ dvB.getUint8(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// DO helper — obtain a stub for the given identifier
// ---------------------------------------------------------------------------

function getDoStub(env: Bindings, identifier: string): DurableObjectStub<RateLimiterDurableObject> {
  return env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(identifier));
}

// ---------------------------------------------------------------------------
// KV index helpers (identifier enumeration only)
// ---------------------------------------------------------------------------

const KV_INDEX_PREFIX = 'index:';
const KV_INDEX_TTL = 7 * 24 * 60 * 60; // 7 days — refresh on each /check

async function recordIdentifierInIndex(kv: KVNamespace, identifier: string): Promise<void> {
  await kv.put(`${KV_INDEX_PREFIX}${identifier}`, '1', { expirationTtl: KV_INDEX_TTL });
}

async function listIndexedIdentifiers(kv: KVNamespace): Promise<string[]> {
  const identifiers: string[] = [];
  let cursor: string | undefined;

  do {
    const result: KVNamespaceListResult<unknown, string> = await kv.list({
      prefix: KV_INDEX_PREFIX,
      ...(cursor !== undefined ? { cursor } : {}),
    });
    for (const key of result.keys) {
      identifiers.push(key.name.slice(KV_INDEX_PREFIX.length));
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor !== undefined);

  return identifiers;
}

// ---------------------------------------------------------------------------
// Hono application
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use('/*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') ?? [];

  const corsMiddleware = cors({
    origin: (requestOrigin: string) =>
      allowedOrigins.includes(requestOrigin) ? requestOrigin : null,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-RateLimit-Tier',
      'Retry-After',
    ],
    maxAge: 86400,
    credentials: true,
  });

  return corsMiddleware(c, next);
});

app.use('*', logger());

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    },
    500,
  );
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'rate-limiter',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

app.get('/', (c) => {
  return c.json({
    name: 'NextCalc Pro - Rate Limiter Service',
    version: '2.0.0',
    description:
      'Atomic distributed rate limiting via Durable Objects with sliding-window algorithm',
    endpoints: {
      check: 'POST /check - Check rate limit and consume request',
      status: 'GET /status/:identifier - Get rate limit status',
      reset: 'DELETE /reset/:identifier - Reset rate limit (admin)',
      configs: 'GET /configs - Get tier configurations',
      health: 'GET /health - Health check',
    },
    tiers: RATE_LIMIT_CONFIGS,
    documentation: 'https://docs.nextcalc.pro/api/rate-limiter',
  });
});

// ---------------------------------------------------------------------------
// POST /check
// ---------------------------------------------------------------------------

const checkSchema = z.object({
  identifier: z.string().min(1).max(200),
  tier: z.enum(['free', 'pro', 'enterprise']).optional().default('free'),
});

app.post('/check', async (c) => {
  try {
    const body = await c.req.json();
    const validated = checkSchema.parse(body);

    const stub = getDoStub(c.env, validated.identifier);
    const status = await stub.check(validated.tier);

    // Record the identifier in the KV index so /admin/keys can enumerate it.
    // Fire-and-forget — a failure here must not block the rate-limit response.
    // executionCtx is only available in the Cloudflare runtime, not in node test
    // environments, so we guard before accessing it.
    try {
      c.executionCtx.waitUntil(recordIdentifierInIndex(c.env.RATE_LIMITS, validated.identifier));
    } catch {
      // No ExecutionContext in test environments — schedule the index write
      // as a detached promise so it doesn't block the response.
      void recordIdentifierInIndex(c.env.RATE_LIMITS, validated.identifier);
    }

    c.header('X-RateLimit-Limit', status.limit.toString());
    c.header('X-RateLimit-Remaining', status.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(status.resetAt).toISOString());
    c.header('X-RateLimit-Tier', status.tier);

    if (!status.allowed && status.retryAfter !== undefined) {
      c.header('Retry-After', status.retryAfter.toString());
    }

    return c.json({ success: true, data: status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: { message: 'Validation error', code: 'VALIDATION_ERROR', details: error.issues },
        },
        400,
      );
    }

    console.error('Error in /check:', error);
    return c.json(
      {
        success: false,
        error: { message: 'Failed to check rate limit', code: 'CHECK_ERROR' },
      },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /status/:identifier
// ---------------------------------------------------------------------------

app.get('/status/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');
    const tierParam = c.req.query('tier') ?? 'free';

    if (!(['free', 'pro', 'enterprise'] as const).includes(tierParam as UserTier)) {
      return c.json(
        { success: false, error: { message: 'Invalid tier', code: 'INVALID_TIER' } },
        400,
      );
    }

    const tier = tierParam as UserTier;
    const stub = getDoStub(c.env, identifier);
    const status = await stub.status(tier);

    c.header('X-RateLimit-Limit', status.limit.toString());
    c.header('X-RateLimit-Remaining', status.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(status.resetAt).toISOString());
    c.header('X-RateLimit-Tier', status.tier);

    return c.json({ success: true, data: status });
  } catch (error) {
    console.error('Error in /status:', error);
    return c.json(
      { success: false, error: { message: 'Failed to get status', code: 'STATUS_ERROR' } },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /reset/:identifier  (admin)
// ---------------------------------------------------------------------------

app.delete('/reset/:identifier', async (c) => {
  try {
    const adminKey = c.req.header('X-Admin-Key') ?? '';
    if (!(await timingSafeEqual(adminKey, c.env.ADMIN_KEY))) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const identifier = c.req.param('identifier');

    const stub = getDoStub(c.env, identifier);
    await stub.reset();

    // Also remove from the KV index.
    await c.env.RATE_LIMITS.delete(`${KV_INDEX_PREFIX}${identifier}`);

    return c.json({ success: true, message: `Rate limit reset for ${identifier}` });
  } catch (error) {
    console.error('Error in /reset:', error);
    return c.json(
      { success: false, error: { message: 'Failed to reset rate limit', code: 'RESET_ERROR' } },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /configs
// ---------------------------------------------------------------------------

app.get('/configs', (c) => {
  return c.json({ success: true, data: RATE_LIMIT_CONFIGS });
});

// ---------------------------------------------------------------------------
// GET /recommend/:requestsPerHour
// ---------------------------------------------------------------------------

app.get('/recommend/:requestsPerHour', (c) => {
  try {
    const requestsPerHour = parseInt(c.req.param('requestsPerHour'), 10);

    if (Number.isNaN(requestsPerHour) || requestsPerHour < 0) {
      return c.json(
        {
          success: false,
          error: { message: 'Invalid requests per hour', code: 'INVALID_INPUT' },
        },
        400,
      );
    }

    const recommendedTier = getRecommendedTier(requestsPerHour);

    return c.json({
      success: true,
      data: {
        requestsPerHour,
        recommendedTier,
        config: RATE_LIMIT_CONFIGS[recommendedTier],
      },
    });
  } catch (error) {
    console.error('Error in /recommend:', error);
    return c.json(
      {
        success: false,
        error: { message: 'Failed to get recommendation', code: 'RECOMMEND_ERROR' },
      },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /admin/keys  (admin)
//
// Design note: DOs cannot be enumerated — there is no "list all DO instances"
// API. Instead, /check writes a lightweight KV index entry for every identifier
// it sees. This endpoint reads that index to return known active identifiers.
//
// Trade-off: identifiers that were only ever seen before the DO migration, or
// that were directly reset without going through /check again, may not appear
// in the index. New identifiers are indexed on first /check call.
// ---------------------------------------------------------------------------

app.get('/admin/keys', async (c) => {
  try {
    const adminKey = c.req.header('X-Admin-Key') ?? '';
    if (!(await timingSafeEqual(adminKey, c.env.ADMIN_KEY))) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const identifiers = await listIndexedIdentifiers(c.env.RATE_LIMITS);

    return c.json({
      success: true,
      data: {
        count: identifiers.length,
        keys: identifiers.slice(0, 100),
        note: 'Lists identifiers indexed by the DO backend. Only identifiers seen via POST /check appear here.',
      },
    });
  } catch (error) {
    console.error('Error in /admin/keys:', error);
    return c.json(
      { success: false, error: { message: 'Failed to list keys', code: 'LIST_ERROR' } },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Example protected route (IP-based rate limiting)
// ---------------------------------------------------------------------------

app.get(
  '/example/protected',
  async (c, next) => {
    const middleware = ipRateLimitMiddleware(c.env.RATE_LIMITER, 'free');
    return middleware(c, next);
  },
  (c) => {
    return c.json({ success: true, message: 'This endpoint is rate limited' });
  },
);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { message: 'Endpoint not found', code: 'NOT_FOUND', path: c.req.path },
    },
    404,
  );
});

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default app;
