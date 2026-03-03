/**
 * Redis Caching & Rate Limiting Layer (Upstash REST)
 *
 * Uses @upstash/redis 1.37.0-rc.12 with modern features:
 * - Redis.fromEnv() for credential management
 * - Automatic JSON serialization/deserialization (no manual JSON.stringify/parse)
 * - Auto-pipelining for concurrent command batching
 * - Exponential backoff retry for resilience
 * - Per-request AbortSignal timeouts
 * - Latency logging in development
 * - Graceful degradation when credentials are missing
 *
 * @see https://upstash.com/docs/redis
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

const isConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const isDev = process.env.NODE_ENV !== 'production';

if (!isConfigured) {
  logger.warn('Upstash Redis not configured — caching and rate limiting disabled', {
    missingVars: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  });
}

/**
 * Redis client — configured with all modern options.
 * Null when credentials are absent (graceful degradation).
 */
export const redis = isConfigured
  ? Redis.fromEnv({
      automaticDeserialization: true,
      enableAutoPipelining: true,
      latencyLogging: isDev,
      enableTelemetry: false,
      retry: {
        retries: 5,
        backoff: (retryCount) => Math.exp(retryCount) * 50,
      },
      signal: () => AbortSignal.timeout(5000),
    })
  : null;

// ---------------------------------------------------------------------------
// Rate Limiting (@upstash/ratelimit sliding window)
// ---------------------------------------------------------------------------

const rateLimiters = new Map<string, Ratelimit>();

function getRateLimiter(limit: number, windowSeconds: number): Ratelimit | null {
  if (!redis) return null;

  const key = `${limit}:${windowSeconds}`;
  let limiter = rateLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: '@nextcalc/ratelimit',
      ephemeralCache: new Map(),
    });
    rateLimiters.set(key, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(limit, windowSeconds);
  if (!limiter) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }

  const { success, remaining, reset, pending } = await limiter.limit(identifier);

  // Fire-and-forget analytics
  if (pending) {
    pending.catch((err: unknown) =>
      logger.error('Ratelimit analytics error', {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return { allowed: success, remaining, resetAt: new Date(reset) };
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export interface RedisHealthCheck {
  status: string;
  latency?: number;
  error?: string;
}

export async function redisHealthCheck(): Promise<RedisHealthCheck> {
  if (!redis) return { status: 'unconfigured' };

  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// Query Cache (used by resolvers)
// ---------------------------------------------------------------------------

export const queryCache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      // automaticDeserialization handles JSON parsing
      return await redis.get<T>(key);
    } catch (error) {
      logger.error('queryCache.get error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!redis) return;
    try {
      // automaticDeserialization handles JSON stringifying
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
      logger.error('queryCache.set error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async invalidate(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('queryCache.invalidate error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Cache Key Helpers
// ---------------------------------------------------------------------------

export const CACHE_KEYS = {
  USER: 'user',
  WORKSHEET: 'worksheet',
  FOLDER: 'folder',
  FORUM_POST: 'post',
  COMMENT: 'comment',
  UPVOTE_COUNT: 'upvote',
  COMMENT_COUNT: 'comment-count',
  SESSION: 'session',
} as const;

export const CACHE_TTL = {
  USER: 30 * 60,
  WORKSHEET: 60 * 60,
  FOLDER: 60 * 60,
  FORUM_POST: 5 * 60,
  COMMENT: 2 * 60,
  UPVOTE_COUNT: 1 * 60,
  SESSION: 30 * 24 * 60 * 60,
} as const;

export function cacheKey(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

// ---------------------------------------------------------------------------
// Entity Cache Helpers (no manual JSON — automatic serialization)
// ---------------------------------------------------------------------------

export async function cacheUser(userId: string, data: unknown): Promise<void> {
  if (!redis) return;
  await redis.set(cacheKey(CACHE_KEYS.USER, userId), data, { ex: CACHE_TTL.USER });
}

export async function getCachedUser<T = unknown>(userId: string): Promise<T | null> {
  if (!redis) return null;
  return redis.get<T>(cacheKey(CACHE_KEYS.USER, userId));
}

export async function cacheWorksheet(worksheetId: string, data: unknown): Promise<void> {
  if (!redis) return;
  await redis.set(cacheKey(CACHE_KEYS.WORKSHEET, worksheetId), data, {
    ex: CACHE_TTL.WORKSHEET,
  });
}

export async function getCachedWorksheet<T = unknown>(worksheetId: string): Promise<T | null> {
  if (!redis) return null;
  return redis.get<T>(cacheKey(CACHE_KEYS.WORKSHEET, worksheetId));
}

export async function cacheForumPost(postId: string, data: unknown): Promise<void> {
  if (!redis) return;
  await redis.set(cacheKey(CACHE_KEYS.FORUM_POST, postId), data, {
    ex: CACHE_TTL.FORUM_POST,
  });
}

export async function getCachedForumPost<T = unknown>(postId: string): Promise<T | null> {
  if (!redis) return null;
  return redis.get<T>(cacheKey(CACHE_KEYS.FORUM_POST, postId));
}

export async function invalidateCache(prefix: string, id: string): Promise<void> {
  if (!redis) return;
  await redis.del(cacheKey(prefix, id));
}

export async function invalidateCaches(keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  await redis.del(...keys);
}

export async function cacheUpvoteCount(targetId: string, count: number): Promise<void> {
  if (!redis) return;
  await redis.set(cacheKey(CACHE_KEYS.UPVOTE_COUNT, targetId), count, {
    ex: CACHE_TTL.UPVOTE_COUNT,
  });
}

export async function getCachedUpvoteCount(targetId: string): Promise<number | null> {
  if (!redis) return null;
  return redis.get<number>(cacheKey(CACHE_KEYS.UPVOTE_COUNT, targetId));
}

export async function incrementUpvoteCount(targetId: string): Promise<void> {
  if (!redis) return;
  const key = cacheKey(CACHE_KEYS.UPVOTE_COUNT, targetId);
  await redis.pipeline().incr(key).expire(key, CACHE_TTL.UPVOTE_COUNT).exec();
}

export async function decrementUpvoteCount(targetId: string): Promise<void> {
  if (!redis) return;
  const key = cacheKey(CACHE_KEYS.UPVOTE_COUNT, targetId);
  await redis.pipeline().decr(key).expire(key, CACHE_TTL.UPVOTE_COUNT).exec();
}

export async function cacheCommentCount(postId: string, count: number): Promise<void> {
  if (!redis) return;
  await redis.set(cacheKey(CACHE_KEYS.COMMENT_COUNT, postId), count, {
    ex: CACHE_TTL.COMMENT,
  });
}

export async function getCachedCommentCount(postId: string): Promise<number | null> {
  if (!redis) return null;
  return redis.get<number>(cacheKey(CACHE_KEYS.COMMENT_COUNT, postId));
}

export async function checkRedisConnection(): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('Redis connection check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
