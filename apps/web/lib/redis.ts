/**
 * Redis Client (Upstash REST — @upstash/redis 1.37.0-rc.12)
 *
 * Modern features enabled:
 * - Redis.fromEnv() for credential management
 * - Automatic JSON serialization/deserialization (no manual JSON.stringify/parse)
 * - Auto-pipelining batches concurrent commands into single HTTP requests
 * - Exponential backoff retry for transient failures
 * - Per-request AbortSignal timeouts (5 s)
 * - Latency logging in development
 * - Graceful degradation when credentials are missing
 *
 * @see https://upstash.com/docs/redis
 */

import { Redis } from '@upstash/redis';

const isConfigured = !!(
  process.env['UPSTASH_REDIS_REST_URL'] && process.env['UPSTASH_REDIS_REST_TOKEN']
);
const isDev = process.env['NODE_ENV'] !== 'production';

if (!isConfigured) {
  console.warn('Upstash Redis not configured. Caching and rate limiting disabled.');
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
// Cache Helpers (automatic JSON — no manual stringify/parse)
// ---------------------------------------------------------------------------

export const cacheSet = async <T>(key: string, value: T, ttlSeconds = 300): Promise<boolean> => {
  if (!redis) return false;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error('Redis cache set error:', error);
    return false;
  }
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
};

export const cacheDel = async (...keys: string[]): Promise<number> => {
  if (!redis || keys.length === 0) return 0;
  try {
    return await redis.del(...keys);
  } catch (error) {
    console.error('Redis cache delete error:', error);
    return 0;
  }
};

// ---------------------------------------------------------------------------
// Batch Operations (leverages auto-pipelining for concurrent requests)
// ---------------------------------------------------------------------------

export const cacheGetMany = async <T>(...keys: string[]): Promise<(T | null)[]> => {
  if (!redis || keys.length === 0) return keys.map(() => null);
  try {
    return await redis.mget<(T | null)[]>(...keys);
  } catch (error) {
    console.error('Redis mget error:', error);
    return keys.map(() => null);
  }
};

export const cacheSetMany = async (
  entries: Record<string, unknown>,
  ttlSeconds?: number,
): Promise<boolean> => {
  if (!redis) return false;
  try {
    if (ttlSeconds) {
      // mset doesn't support TTL; use pipeline for set+ex in one HTTP request
      const pipeline = redis.pipeline();
      for (const [key, value] of Object.entries(entries)) {
        pipeline.set(key, value, { ex: ttlSeconds });
      }
      await pipeline.exec();
    } else {
      await redis.mset(entries);
    }
    return true;
  } catch (error) {
    console.error('Redis mset error:', error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Cache-aside Pattern
// ---------------------------------------------------------------------------

export const cacheGetOrSet = async <T>(
  key: string,
  fallback: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> => {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const value = await fallback();
  cacheSet(key, value, ttlSeconds).catch((error) =>
    console.error('Background cache set failed:', error),
  );
  return value;
};

// ---------------------------------------------------------------------------
// Rate Limiting (sliding window via sorted sets)
// ---------------------------------------------------------------------------

export const rateLimit = async (
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  total: number;
}> => {
  if (!redis) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
      total: 1,
    };
  }

  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Pipeline: single HTTP request for all 4 commands
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, { score: now, member: `${now}` });
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const count = (results[1] as number) || 0;
    const allowed = count < limit;

    return {
      allowed,
      remaining: Math.max(0, limit - count - 1),
      resetAt: new Date(now + windowSeconds * 1000),
      total: count + 1,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fail open — allow request if Redis is down
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
      total: 1,
    };
  }
};

// ---------------------------------------------------------------------------
// Health & Availability
// ---------------------------------------------------------------------------

export const isRedisAvailable = async (): Promise<boolean> => {
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
};

export const redisHealthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy' | 'unconfigured';
  latency?: number;
  error?: string;
}> => {
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
};

// ---------------------------------------------------------------------------
// Session Cache Helpers
// ---------------------------------------------------------------------------

export const sessionCache = {
  set: async (sessionToken: string, session: unknown, ttlSeconds = 1800) =>
    cacheSet(`session:${sessionToken}`, session, ttlSeconds),

  get: async <T = unknown>(sessionToken: string) => cacheGet<T>(`session:${sessionToken}`),

  delete: async (sessionToken: string) => cacheDel(`session:${sessionToken}`),
};

// ---------------------------------------------------------------------------
// Query Cache Helpers
// ---------------------------------------------------------------------------

export const queryCache = {
  key: (queryName: string, variables?: Record<string, unknown>) => {
    const varHash = variables
      ? JSON.stringify(variables, Object.keys(variables).sort())
      : '';
    return `query:${queryName}:${varHash}`;
  },

  set: async (
    queryName: string,
    variables: Record<string, unknown> | undefined,
    result: unknown,
    ttlSeconds = 300,
  ) => cacheSet(queryCache.key(queryName, variables), result, ttlSeconds),

  get: async <T = unknown>(queryName: string, variables?: Record<string, unknown>) =>
    cacheGet<T>(queryCache.key(queryName, variables)),

  invalidate: async (queryName: string, variables?: Record<string, unknown>) => {
    await cacheDel(queryCache.key(queryName, variables));
  },
};
