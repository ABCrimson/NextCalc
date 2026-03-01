/**
 * Sliding window rate limiting algorithm
 * Provides accurate rate limiting with smooth token consumption
 */

/**
 * User tier with associated rate limits
 */
export type UserTier = 'free' | 'pro' | 'enterprise';

/**
 * Rate limit configuration per tier
 */
export interface RateLimitConfig {
  tier: UserTier;
  requestsPerHour: number;
  burstLimit: number;
}

/**
 * Rate limit status for a user
 */
export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  tier: UserTier;
  retryAfter?: number;
}

/**
 * Sliding window data stored in KV
 */
export interface SlidingWindowData {
  requests: number[];
  tier: UserTier;
  lastUpdated: number;
}

/**
 * Default rate limit configurations by tier
 */
export const RATE_LIMIT_CONFIGS: Record<UserTier, RateLimitConfig> = {
  free: {
    tier: 'free',
    requestsPerHour: 100,
    burstLimit: 20,
  },
  pro: {
    tier: 'pro',
    requestsPerHour: 1000,
    burstLimit: 50,
  },
  enterprise: {
    tier: 'enterprise',
    requestsPerHour: Number.MAX_SAFE_INTEGER,
    burstLimit: 1000,
  },
};

/**
 * Implements sliding window rate limiting algorithm
 *
 * The sliding window algorithm:
 * 1. Stores timestamps of all requests in the past hour
 * 2. On each request, removes expired timestamps (older than 1 hour)
 * 3. Checks if remaining count is below the limit
 * 4. Adds current timestamp if allowed
 *
 * Advantages:
 * - More accurate than fixed window
 * - Prevents burst attacks
 * - Fair distribution over time
 *
 * @param kv - Cloudflare KV namespace
 * @param identifier - Unique identifier (user ID, IP address, API key)
 * @param tier - User tier
 * @returns Rate limit status
 */
export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  tier: UserTier,
): Promise<RateLimitStatus> {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour in milliseconds
  const config = RATE_LIMIT_CONFIGS[tier];
  const limit = config.requestsPerHour;

  // Skip KV storage entirely for unlimited tiers
  if (limit === Number.MAX_SAFE_INTEGER) {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      resetAt: now + windowMs,
      limit,
      tier,
    };
  }

  // Generate KV key
  const kvKey = `ratelimit:${identifier}`;

  // Get existing data from KV
  const existingData = await kv.get<SlidingWindowData>(kvKey, 'json');

  // Initialize or use existing data
  let requests: number[] = existingData?.requests || [];
  const currentTier = existingData?.tier || tier;

  // Update tier if changed
  if (currentTier !== tier) {
    // Tier changed - reset rate limit
    requests = [];
  }

  // Remove expired requests (older than window)
  const windowStart = now - windowMs;
  requests = requests.filter((timestamp) => timestamp > windowStart);

  // Check if limit exceeded
  const currentCount = requests.length;
  const allowed = currentCount < limit;

  // If allowed, add current timestamp
  if (allowed) {
    requests.push(now);

    // Store updated data in KV with expiration
    const updatedData: SlidingWindowData = {
      requests,
      tier,
      lastUpdated: now,
    };

    // Expire KV entry after the window + 1 hour buffer
    const expirationTtl = Math.ceil((windowMs + 3600000) / 1000);

    await kv.put(kvKey, JSON.stringify(updatedData), {
      expirationTtl,
    });
  }

  // Calculate when the oldest request will expire
  const oldestRequest = requests[0] || now;
  const resetAt = oldestRequest + windowMs;

  return {
    allowed,
    remaining: Math.max(0, limit - currentCount - (allowed ? 1 : 0)),
    resetAt,
    limit,
    tier,
    ...(!allowed && { retryAfter: Math.ceil((resetAt - now) / 1000) }),
  };
}

/**
 * Gets current rate limit status without consuming a request
 *
 * @param kv - Cloudflare KV namespace
 * @param identifier - Unique identifier
 * @param tier - User tier
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  kv: KVNamespace,
  identifier: string,
  tier: UserTier,
): Promise<RateLimitStatus> {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const config = RATE_LIMIT_CONFIGS[tier];

  const kvKey = `ratelimit:${identifier}`;
  const existingData = await kv.get<SlidingWindowData>(kvKey, 'json');

  let requests: number[] = existingData?.requests || [];

  // Remove expired requests
  const windowStart = now - windowMs;
  requests = requests.filter((timestamp) => timestamp > windowStart);

  const currentCount = requests.length;
  const limit = config.requestsPerHour;
  const allowed = currentCount < limit;

  const oldestRequest = requests[0] || now;
  const resetAt = oldestRequest + windowMs;

  return {
    allowed,
    remaining: Math.max(0, limit - currentCount),
    resetAt,
    limit,
    tier,
  };
}

/**
 * Resets rate limit for a specific identifier
 * Useful for administrative actions or testing
 *
 * @param kv - Cloudflare KV namespace
 * @param identifier - Unique identifier to reset
 */
export async function resetRateLimit(kv: KVNamespace, identifier: string): Promise<void> {
  const kvKey = `ratelimit:${identifier}`;
  await kv.delete(kvKey);
}

/**
 * Gets all rate limit keys (for debugging/admin)
 * Note: KV list operations are eventually consistent
 *
 * @param kv - Cloudflare KV namespace
 * @param prefix - Optional prefix to filter keys
 * @returns List of rate limit keys
 */
export async function listRateLimitKeys(
  kv: KVNamespace,
  prefix: string = 'ratelimit:',
): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await kv.list({ prefix, cursor });
    keys.push(...result.keys.map((k) => k.name));
    cursor = result.cursor;
  } while (cursor);

  return keys;
}

/**
 * Implements token bucket rate limiting as an alternative
 * Token bucket allows for burst traffic within limits
 *
 * @param kv - Cloudflare KV namespace
 * @param identifier - Unique identifier
 * @param tier - User tier
 * @returns Rate limit status
 */
export async function checkRateLimitTokenBucket(
  kv: KVNamespace,
  identifier: string,
  tier: UserTier,
): Promise<RateLimitStatus> {
  const now = Date.now();
  const config = RATE_LIMIT_CONFIGS[tier];

  // Token bucket parameters
  const capacity = config.burstLimit;
  const refillRate = config.requestsPerHour / 3600; // tokens per second

  const kvKey = `ratelimit:bucket:${identifier}`;

  interface TokenBucketData {
    tokens: number;
    lastRefill: number;
    tier: UserTier;
  }

  // Get existing bucket data
  const existingData = await kv.get<TokenBucketData>(kvKey, 'json');

  let tokens = existingData?.tokens ?? capacity;
  let lastRefill = existingData?.lastRefill ?? now;

  // Refill tokens based on time elapsed
  const elapsed = (now - lastRefill) / 1000; // seconds
  const tokensToAdd = elapsed * refillRate;
  tokens = Math.min(capacity, tokens + tokensToAdd);
  lastRefill = now;

  // Check if we have tokens available
  const allowed = tokens >= 1;

  if (allowed) {
    tokens -= 1;

    // Update bucket in KV
    const updatedData: TokenBucketData = {
      tokens,
      lastRefill,
      tier,
    };

    await kv.put(kvKey, JSON.stringify(updatedData), {
      expirationTtl: 7200, // 2 hours
    });
  }

  // Calculate when next token will be available
  const timeToNextToken = tokens < 1 ? (1 - tokens) / refillRate : 0;
  const resetAt = now + timeToNextToken * 1000;

  return {
    allowed,
    remaining: Math.floor(tokens),
    resetAt,
    limit: capacity,
    tier,
    ...(!allowed && { retryAfter: Math.ceil(timeToNextToken) }),
  };
}

/**
 * Calculates the recommended tier for a user based on usage
 *
 * @param requestsPerHour - Average requests per hour
 * @returns Recommended tier
 */
export function getRecommendedTier(requestsPerHour: number): UserTier {
  if (requestsPerHour <= RATE_LIMIT_CONFIGS.free.requestsPerHour) {
    return 'free';
  } else if (requestsPerHour <= RATE_LIMIT_CONFIGS.pro.requestsPerHour) {
    return 'pro';
  } else {
    return 'enterprise';
  }
}
