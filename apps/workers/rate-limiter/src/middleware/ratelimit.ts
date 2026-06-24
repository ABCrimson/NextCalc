/**
 * Rate limiting middleware for Hono applications.
 *
 * Integrates sliding-window rate limiting into the Hono request pipeline via
 * Durable Objects. Each identifier is routed to its own DO instance, which
 * serialises concurrent requests and guarantees atomic counter updates.
 */

import type { Context, Next } from 'hono';
import type { RateLimiterDurableObject } from '../durable-objects/rate-limiter-do.js';
import type { RateLimitStatus, UserTier } from '../utils/sliding-window.js';

// ---------------------------------------------------------------------------
// Middleware options
// ---------------------------------------------------------------------------

export interface RateLimitOptions {
  /**
   * Function to extract user identifier from request.
   * Can use IP address, user ID, API key, etc.
   */
  getIdentifier: (c: Context) => string | Promise<string>;

  /**
   * Function to determine user tier.
   * Can check authentication, subscription status, etc.
   */
  getTier: (c: Context) => UserTier | Promise<UserTier>;

  /**
   * Custom response when rate limit is exceeded.
   */
  onRateLimitExceeded?: (c: Context, status: RateLimitStatus) => Response | Promise<Response>;

  /**
   * Skip rate limiting for certain requests.
   */
  skip?: (c: Context) => boolean | Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Core middleware factory
// ---------------------------------------------------------------------------

/**
 * Creates rate limiting middleware backed by a Durable Object namespace.
 *
 * @param doNamespace - DO namespace for the RateLimiterDurableObject.
 * @param options     - Middleware options.
 * @returns Hono middleware function.
 */
export function rateLimitMiddleware(
  doNamespace: DurableObjectNamespace<RateLimiterDurableObject>,
  options: RateLimitOptions,
) {
  return async (c: Context, next: Next) => {
    if (options.skip && (await options.skip(c))) {
      return next();
    }

    const identifier = await options.getIdentifier(c);

    if (!identifier) {
      return c.json(
        {
          success: false,
          error: { message: 'Unable to identify request', code: 'IDENTIFICATION_ERROR' },
        },
        400,
      );
    }

    const tier = await options.getTier(c);

    const stub = doNamespace.get(doNamespace.idFromName(identifier));
    const status = await stub.check(tier);

    c.header('X-RateLimit-Limit', status.limit.toString());
    c.header('X-RateLimit-Remaining', status.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(status.resetAt).toISOString());
    c.header('X-RateLimit-Tier', status.tier);

    if (!status.allowed) {
      if (status.retryAfter !== undefined) {
        c.header('Retry-After', status.retryAfter.toString());
      }

      if (options.onRateLimitExceeded) {
        return options.onRateLimitExceeded(c, status);
      }

      return c.json(
        {
          success: false,
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: status.limit,
              resetAt: new Date(status.resetAt).toISOString(),
              retryAfter: status.retryAfter,
              tier: status.tier,
            },
          },
        },
        429,
      );
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// Convenience factories
// ---------------------------------------------------------------------------

/**
 * IP-based rate limiting middleware.
 * Uses Cloudflare's CF-Connecting-IP header.
 */
export function ipRateLimitMiddleware(
  doNamespace: DurableObjectNamespace<RateLimiterDurableObject>,
  tier: UserTier = 'free',
) {
  return rateLimitMiddleware(doNamespace, {
    getIdentifier: (c) => {
      return (
        c.req.header('CF-Connecting-IP') ||
        c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown'
      );
    },
    getTier: () => tier,
  });
}

/**
 * API key-based rate limiting middleware.
 * Extracts API key from the Authorization header.
 */
export function apiKeyRateLimitMiddleware(
  doNamespace: DurableObjectNamespace<RateLimiterDurableObject>,
  getUserTier: (apiKey: string) => UserTier | Promise<UserTier>,
) {
  return rateLimitMiddleware(doNamespace, {
    getIdentifier: (c) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader) return 'anonymous';
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      return match?.[1] ?? authHeader;
    },
    getTier: async (c) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader) return 'free';
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      const apiKey = match?.[1] ?? authHeader;
      return getUserTier(apiKey);
    },
  });
}

/**
 * User ID-based rate limiting middleware.
 * Assumes user ID is available in Hono context (from auth middleware).
 */
export function userRateLimitMiddleware(
  doNamespace: DurableObjectNamespace<RateLimiterDurableObject>,
  options: {
    userIdKey?: string;
    tierKey?: string;
    defaultTier?: UserTier;
  } = {},
) {
  const { userIdKey = 'userId', tierKey = 'userTier', defaultTier = 'free' } = options;

  return rateLimitMiddleware(doNamespace, {
    getIdentifier: (c) => {
      const userId = c.get(userIdKey) as string | undefined;
      return userId ?? 'anonymous';
    },
    getTier: (c) => {
      const tier = c.get(tierKey) as UserTier | undefined;
      return tier ?? defaultTier;
    },
  });
}
