/**
 * NextCalc Pro - Rate Limiter Service
 *
 * A Cloudflare Worker providing comprehensive rate limiting:
 * - Sliding window algorithm for accurate limiting
 * - Multi-tier support (Free, Pro, Enterprise)
 * - IP-based and user-based limiting
 * - Real-time quota management
 *
 * Uses Cloudflare KV for distributed rate limit tracking.
 *
 * @author NextCalc Pro Team
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { ipRateLimitMiddleware } from './middleware/ratelimit.js';
import {
  checkRateLimit,
  getRateLimitStatus,
  getRecommendedTier,
  listRateLimitKeys,
  RATE_LIMIT_CONFIGS,
  resetRateLimit,
  type UserTier,
} from './utils/sliding-window.js';

/**
 * Cloudflare Worker environment bindings
 */
type Bindings = {
  RATE_LIMITS: KVNamespace;
  ALLOWED_ORIGINS: string;
  ADMIN_KEY: string;
};

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
  // SHA-256 always produces 32 bytes; the length check is a safety guard.
  if (viewA.length !== viewB.length) return false;
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i]! ^ viewB[i]!;
  }
  return diff === 0;
}

/**
 * Initialize Hono application with type-safe bindings
 */
const app = new Hono<{ Bindings: Bindings }>();

/**
 * Middleware configuration
 */

// CORS configuration
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

// Request logging
app.use('*', logger());

/**
 * Global error handler
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  return c.json(
    {
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    },
    500,
  );
});

/**
 * Health check endpoint
 *
 * @route GET /health
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'rate-limiter',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root endpoint - API information
 *
 * @route GET /
 */
app.get('/', (c) => {
  return c.json({
    name: 'NextCalc Pro - Rate Limiter Service',
    version: '1.0.0',
    description: 'Distributed rate limiting service with sliding window algorithm',
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

/**
 * Check rate limit and consume a request
 *
 * @route POST /check
 * @body {identifier: string, tier?: UserTier}
 * @returns Rate limit status
 *
 * @example
 * POST /check
 * {
 *   "identifier": "user-123",
 *   "tier": "pro"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "allowed": true,
 *     "remaining": 999,
 *     "resetAt": 1234567890,
 *     "limit": 1000,
 *     "tier": "pro"
 *   }
 * }
 */
app.post('/check', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const schema = z.object({
      identifier: z.string().min(1).max(200),
      tier: z.enum(['free', 'pro', 'enterprise']).optional().default('free'),
    });

    const validated = schema.parse(body);

    // Check rate limit
    const status = await checkRateLimit(c.env.RATE_LIMITS, validated.identifier, validated.tier);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', status.limit.toString());
    c.header('X-RateLimit-Remaining', status.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(status.resetAt).toISOString());
    c.header('X-RateLimit-Tier', status.tier);

    if (!status.allowed && status.retryAfter) {
      c.header('Retry-After', status.retryAfter.toString());
    }

    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: error.issues,
          },
        },
        400,
      );
    }

    console.error('Error in /check:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to check rate limit',
          code: 'CHECK_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Get rate limit status without consuming a request
 *
 * @route GET /status/:identifier
 * @param identifier - User/IP identifier
 * @query tier - User tier (default: free)
 * @returns Current rate limit status
 *
 * @example
 * GET /status/user-123?tier=pro
 */
app.get('/status/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');
    const tier = (c.req.query('tier') || 'free') as UserTier;

    if (!['free', 'pro', 'enterprise'].includes(tier)) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Invalid tier',
            code: 'INVALID_TIER',
          },
        },
        400,
      );
    }

    // Get status without consuming
    const status = await getRateLimitStatus(c.env.RATE_LIMITS, identifier, tier);

    // Set headers
    c.header('X-RateLimit-Limit', status.limit.toString());
    c.header('X-RateLimit-Remaining', status.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(status.resetAt).toISOString());
    c.header('X-RateLimit-Tier', status.tier);

    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error in /status:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to get status',
          code: 'STATUS_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Reset rate limit for an identifier (admin endpoint)
 *
 * @route DELETE /reset/:identifier
 * @param identifier - Identifier to reset
 * @returns Success confirmation
 *
 * @example
 * DELETE /reset/user-123
 */
app.delete('/reset/:identifier', async (c) => {
  try {
    const adminKey = c.req.header('X-Admin-Key') ?? '';
    if (!(await timingSafeEqual(adminKey, c.env.ADMIN_KEY))) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const identifier = c.req.param('identifier');

    await resetRateLimit(c.env.RATE_LIMITS, identifier);

    return c.json({
      success: true,
      message: `Rate limit reset for ${identifier}`,
    });
  } catch (error) {
    console.error('Error in /reset:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to reset rate limit',
          code: 'RESET_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Get tier configurations
 *
 * @route GET /configs
 * @returns Rate limit configurations for all tiers
 */
app.get('/configs', (c) => {
  return c.json({
    success: true,
    data: RATE_LIMIT_CONFIGS,
  });
});

/**
 * Get recommended tier based on usage
 *
 * @route GET /recommend/:requestsPerHour
 * @param requestsPerHour - Average requests per hour
 * @returns Recommended tier
 *
 * @example
 * GET /recommend/500
 */
app.get('/recommend/:requestsPerHour', (c) => {
  try {
    const requestsPerHour = parseInt(c.req.param('requestsPerHour'), 10);

    if (Number.isNaN(requestsPerHour) || requestsPerHour < 0) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Invalid requests per hour',
            code: 'INVALID_INPUT',
          },
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
        error: {
          message: 'Failed to get recommendation',
          code: 'RECOMMEND_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * List all rate limit keys (admin/debug endpoint)
 *
 * @route GET /admin/keys
 * @returns List of all rate limit keys
 *
 * WARNING: This can be expensive on large datasets
 * Should be protected with authentication in production
 */
app.get('/admin/keys', async (c) => {
  try {
    const adminKey = c.req.header('X-Admin-Key') ?? '';
    if (!(await timingSafeEqual(adminKey, c.env.ADMIN_KEY))) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const keys = await listRateLimitKeys(c.env.RATE_LIMITS);

    return c.json({
      success: true,
      data: {
        count: keys.length,
        keys: keys.slice(0, 100), // Limit to first 100 for safety
      },
    });
  } catch (error) {
    console.error('Error in /admin/keys:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to list keys',
          code: 'LIST_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Example of using rate limit middleware on a protected route
 *
 * @route GET /example/protected
 */
app.get(
  '/example/protected',
  async (c, next) => {
    const middleware = ipRateLimitMiddleware(c.env.RATE_LIMITS, 'free');
    return middleware(c, next);
  },
  (c) => {
    return c.json({
      success: true,
      message: 'This endpoint is rate limited',
    });
  },
);

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        message: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: c.req.path,
      },
    },
    404,
  );
});

/**
 * Export the Hono app
 */
export default app;
