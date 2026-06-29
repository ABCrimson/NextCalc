/**
 * Sliding window rate limiting algorithm — pure functions only.
 *
 * All functions in this module are side-effect-free. They neither read nor
 * write to any storage. The Durable Object wraps these functions around its
 * SQLite storage to guarantee atomicity (single-threaded DO execution).
 */

// ---------------------------------------------------------------------------
// Types & configuration
// ---------------------------------------------------------------------------

/** User tier with associated rate limits. */
export type UserTier = 'free' | 'pro' | 'enterprise';

/** Rate limit configuration per tier. */
export interface RateLimitConfig {
  tier: UserTier;
  requestsPerHour: number;
  burstLimit: number;
}

/** Rate limit status returned to callers. */
export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  tier: UserTier;
  retryAfter?: number;
}

/** Default rate limit configurations by tier. */
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

// ---------------------------------------------------------------------------
// Pure sliding-window evaluation
// ---------------------------------------------------------------------------

/**
 * Result produced by evaluateSlidingWindow.
 *
 * `nextRequests` is the timestamp array that the caller must persist — it has
 * already been pruned of expired entries and (when allowed) includes `now`.
 */
export interface SlidingWindowResult {
  allowed: boolean;
  nextRequests: number[];
  status: RateLimitStatus;
}

/**
 * Pure, side-effect-free sliding-window evaluation.
 *
 * Algorithm:
 *  1. Discard timestamps older than `now - windowMs`.
 *  2. Count surviving timestamps.
 *  3. Allow iff `currentCount < limit` (strict less-than, no magic margins).
 *  4. When `consuming` is true (default) and allowed, append `now` to produce
 *     `nextRequests` and subtract 1 from `remaining` to reflect the slot used.
 *     When `consuming` is false (read-only status check), `nextRequests` is
 *     equal to the pruned active list and `remaining` reflects the unmodified
 *     count — i.e. how many more requests the caller could make.
 *
 * Atomicity guarantee: this function is intentionally stateless. Callers
 * (i.e., the Durable Object) are responsible for reading storage before
 * calling and writing `nextRequests` back afterwards. Because Durable Objects
 * are single-threaded per identifier, no concurrent call can observe stale
 * state — the read–evaluate–write sequence is serialised automatically.
 *
 * @param requests   - Timestamp array read from storage (may be empty).
 * @param now        - Current unix timestamp in milliseconds.
 * @param tier       - User tier that determines the limit.
 * @param windowMs   - Sliding window size in milliseconds (default: 1 hour).
 * @param consuming  - Whether this evaluation consumes a request slot.
 *                     Pass `false` for read-only status checks (default: true).
 */
export function evaluateSlidingWindow(
  requests: number[],
  now: number,
  tier: UserTier,
  windowMs = 60 * 60 * 1000,
  consuming = true,
): SlidingWindowResult {
  const config = RATE_LIMIT_CONFIGS[tier];
  const limit = config.requestsPerHour;

  // Prune expired entries.
  const windowStart = now - windowMs;
  const active = requests.filter((ts) => ts > windowStart);

  const currentCount = active.length;
  const allowed = currentCount < limit; // strict <, no band-aid margin

  // nextRequests only appends now when we are consuming a slot.
  const nextRequests = consuming && allowed ? [...active, now] : active;

  // remaining reflects what the caller will see after this call:
  //  - consuming + allowed: slot taken, so subtract 1 from available
  //  - read-only (status): report how many slots are still available
  //  - denied: 0 remaining
  const consumed = consuming && allowed ? 1 : 0;
  const remaining = Math.max(0, limit - currentCount - consumed);

  // resetAt = when the oldest surviving request will fall outside the window.
  const oldestRequest = active[0] ?? now;
  const resetAt = oldestRequest + windowMs;

  const status: RateLimitStatus = {
    allowed,
    remaining,
    resetAt,
    limit,
    tier,
    ...(!allowed ? { retryAfter: Math.ceil((resetAt - now) / 1000) } : {}),
  };

  return { allowed, nextRequests, status };
}

// ---------------------------------------------------------------------------
// Tier recommendation (pure)
// ---------------------------------------------------------------------------

/**
 * Calculates the recommended tier for a user based on usage.
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
