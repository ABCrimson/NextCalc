/**
 * Rate limiting middleware for Hono applications
 * Integrates sliding window rate limiting into request pipeline
 */

import type { Context, Next } from 'hono';
import {
  checkRateLimit,
  type UserTier,
  type RateLimitStatus,
} from '../utils/sliding-window.js';

/**
 * Rate limit middleware options
 */
export interface RateLimitOptions {
  /**
   * Function to extract user identifier from request
   * Can use IP address, user ID, API key, etc.
   */
  getIdentifier: (c: Context) => string | Promise<string>;

  /**
   * Function to determine user tier
   * Can check authentication, subscription status, etc.
   */
  getTier: (c: Context) => UserTier | Promise<UserTier>;

  /**
   * Custom response when rate limit is exceeded
   */
  onRateLimitExceeded?: (
    c: Context,
    status: RateLimitStatus
  ) => Response | Promise<Response>;

  /**
   * Skip rate limiting for certain requests
   */
  skip?: (c: Context) => boolean | Promise<boolean>;
}

/**
 * Creates rate limiting middleware
 *
 * @param kv - Cloudflare KV namespace
 * @param options - Middleware options
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { rateLimitMiddleware } from './middleware/ratelimit';
 *
 * app.use('*', rateLimitMiddleware(env.RATE_LIMITS, {
 *   getIdentifier: (c) => c.req.header('x-user-id') || c.env.ip,
 *   getTier: (c) => c.get('userTier') || 'free',
 * }));
 * ```
 */
export function rateLimitMiddleware(
  kv: KVNamespace,
  options: RateLimitOptions
) {
  return async (c: Context, next: Next) => {
    // Check if we should skip rate limiting
    if (options.skip && (await options.skip(c))) {
      return next();
    }

    // Get user identifier
    const identifier = await options.getIdentifier(c);

    if (!identifier) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Unable to identify request',
            code: 'IDENTIFICATION_ERROR',
          },
        },
        400
      );
    }

    // Get user tier
    const tier = await options.getTier(c);

    // Check rate limit
    const status = await checkRateLimit(kv, identifier, tier);

    // Add rate limit headers to response
    c.header('X-RateLimit-Limit', status.limit.toString());
    c.header('X-RateLimit-Remaining', status.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(status.resetAt).toISOString());
    c.header('X-RateLimit-Tier', status.tier);

    // If rate limit exceeded, return error
    if (!status.allowed) {
      if (status.retryAfter) {
        c.header('Retry-After', status.retryAfter.toString());
      }

      // Use custom handler if provided
      if (options.onRateLimitExceeded) {
        return options.onRateLimitExceeded(c, status);
      }

      // Default rate limit exceeded response
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
        429
      );
    }

    // Rate limit check passed, continue to next middleware
    return next();
  };
}

/**
 * IP-based rate limiting middleware
 * Uses Cloudflare's CF-Connecting-IP header
 *
 * @param kv - KV namespace
 * @param tier - Default tier for IP-based limiting
 * @returns Middleware function
 */
export function ipRateLimitMiddleware(kv: KVNamespace, tier: UserTier = 'free') {
  return rateLimitMiddleware(kv, {
    getIdentifier: (c) => {
      // Cloudflare provides the client IP in CF-Connecting-IP header
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
 * API key-based rate limiting middleware
 * Extracts API key from Authorization header
 *
 * @param kv - KV namespace
 * @param getUserTier - Function to get tier from API key
 * @returns Middleware function
 */
export function apiKeyRateLimitMiddleware(
  kv: KVNamespace,
  getUserTier: (apiKey: string) => UserTier | Promise<UserTier>
) {
  return rateLimitMiddleware(kv, {
    getIdentifier: (c) => {
      const authHeader = c.req.header('Authorization');

      if (!authHeader) {
        return 'anonymous';
      }

      // Extract API key from "Bearer <key>" format
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      return match?.[1] || authHeader;
    },
    getTier: async (c) => {
      const authHeader = c.req.header('Authorization');

      if (!authHeader) {
        return 'free';
      }

      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      const apiKey = match?.[1] || authHeader;

      return getUserTier(apiKey);
    },
  });
}

/**
 * User ID-based rate limiting middleware
 * Assumes user ID is available in context (from auth middleware)
 *
 * @param kv - KV namespace
 * @param options - Additional options
 * @returns Middleware function
 */
export function userRateLimitMiddleware(
  kv: KVNamespace,
  options: {
    userIdKey?: string;
    tierKey?: string;
    defaultTier?: UserTier;
  } = {}
) {
  const {
    userIdKey = 'userId',
    tierKey = 'userTier',
    defaultTier = 'free',
  } = options;

  return rateLimitMiddleware(kv, {
    getIdentifier: (c) => {
      const userId = c.get(userIdKey);
      return userId || 'anonymous';
    },
    getTier: (c) => {
      const tier = c.get(tierKey);
      return tier || defaultTier;
    },
  });
}

/**
 * Combined rate limiting strategy
 * Checks both IP and user-based limits
 *
 * @param kv - KV namespace
 * @returns Middleware function
 */
export function combinedRateLimitMiddleware(kv: KVNamespace) {
  return async (c: Context, next: Next) => {
    // First check IP-based rate limit
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown';

    const ipStatus = await checkRateLimit(kv, `ip:${ip}`, 'free');

    if (!ipStatus.allowed) {
      c.header('X-RateLimit-Limit', ipStatus.limit.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', new Date(ipStatus.resetAt).toISOString());

      return c.json(
        {
          success: false,
          error: {
            message: 'IP rate limit exceeded',
            code: 'IP_RATE_LIMIT_EXCEEDED',
            details: {
              retryAfter: ipStatus.retryAfter,
            },
          },
        },
        429
      );
    }

    // Then check user-based rate limit if authenticated
    const userId = c.get('userId');

    if (userId) {
      const tier = c.get('userTier') || 'free';
      const userStatus = await checkRateLimit(kv, `user:${userId}`, tier);

      if (!userStatus.allowed) {
        c.header('X-RateLimit-Limit', userStatus.limit.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', new Date(userStatus.resetAt).toISOString());

        return c.json(
          {
            success: false,
            error: {
              message: 'User rate limit exceeded',
              code: 'USER_RATE_LIMIT_EXCEEDED',
              details: {
                retryAfter: userStatus.retryAfter,
              },
            },
          },
          429
        );
      }

      // Add user rate limit headers
      c.header('X-RateLimit-Limit', userStatus.limit.toString());
      c.header('X-RateLimit-Remaining', userStatus.remaining.toString());
      c.header('X-RateLimit-Reset', new Date(userStatus.resetAt).toISOString());
    }

    return next();
  };
}
