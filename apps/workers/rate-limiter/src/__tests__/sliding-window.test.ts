/**
 * Comprehensive unit tests for the sliding window rate limiting algorithm
 *
 * Tests cover:
 * - Rate limit configuration validation
 * - Sliding window: creation, counting, expiration, rotation
 * - Rate limit checking: under/at/over limit
 * - Token bucket alternative algorithm
 * - Tier recommendation logic
 * - KV interaction (get/put/delete/list)
 * - Edge cases: empty windows, boundary values, tier changes
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  checkRateLimit,
  checkRateLimitTokenBucket,
  getRateLimitStatus,
  getRecommendedTier,
  listRateLimitKeys,
  RATE_LIMIT_CONFIGS,
  resetRateLimit,
  type RateLimitStatus,
  type SlidingWindowData,
  type UserTier,
} from '../utils/sliding-window.js';

// ---------------------------------------------------------------------------
// KV mock factory
// ---------------------------------------------------------------------------

type KVStore = Map<string, string>;

function createMockKV(initialData: Record<string, unknown> = {}): KVNamespace {
  const store: KVStore = new Map(
    Object.entries(initialData).map(([k, v]) => [k, JSON.stringify(v)]),
  );

  return {
    get: vi.fn(async (key: string, type?: string) => {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (type === 'json') return JSON.parse(raw);
      return raw;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string; cursor?: string }) => {
      const prefix = options?.prefix ?? '';
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, cursor: undefined, list_complete: true };
    }),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Rate Limit Configuration
// ---------------------------------------------------------------------------

describe('RATE_LIMIT_CONFIGS', () => {
  it('has correct free tier limits', () => {
    expect(RATE_LIMIT_CONFIGS.free.tier).toBe('free');
    expect(RATE_LIMIT_CONFIGS.free.requestsPerHour).toBe(100);
    expect(RATE_LIMIT_CONFIGS.free.burstLimit).toBe(20);
  });

  it('has correct pro tier limits', () => {
    expect(RATE_LIMIT_CONFIGS.pro.tier).toBe('pro');
    expect(RATE_LIMIT_CONFIGS.pro.requestsPerHour).toBe(1000);
    expect(RATE_LIMIT_CONFIGS.pro.burstLimit).toBe(50);
  });

  it('has unlimited enterprise tier with high burst', () => {
    expect(RATE_LIMIT_CONFIGS.enterprise.tier).toBe('enterprise');
    expect(RATE_LIMIT_CONFIGS.enterprise.requestsPerHour).toBe(Number.MAX_SAFE_INTEGER);
    expect(RATE_LIMIT_CONFIGS.enterprise.burstLimit).toBe(1000);
  });

  it('has strictly increasing requestsPerHour across tiers', () => {
    expect(RATE_LIMIT_CONFIGS.free.requestsPerHour).toBeLessThan(
      RATE_LIMIT_CONFIGS.pro.requestsPerHour,
    );
    expect(RATE_LIMIT_CONFIGS.pro.requestsPerHour).toBeLessThan(
      RATE_LIMIT_CONFIGS.enterprise.requestsPerHour,
    );
  });

  it('has strictly increasing burstLimit across tiers', () => {
    expect(RATE_LIMIT_CONFIGS.free.burstLimit).toBeLessThan(
      RATE_LIMIT_CONFIGS.pro.burstLimit,
    );
    expect(RATE_LIMIT_CONFIGS.pro.burstLimit).toBeLessThan(
      RATE_LIMIT_CONFIGS.enterprise.burstLimit,
    );
  });

  it('covers all three tier types', () => {
    const tiers: UserTier[] = ['free', 'pro', 'enterprise'];
    for (const tier of tiers) {
      expect(RATE_LIMIT_CONFIGS[tier]).toBeDefined();
      expect(RATE_LIMIT_CONFIGS[tier].tier).toBe(tier);
    }
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — sliding window algorithm
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('allows the first request from a fresh identifier', async () => {
    const result = await checkRateLimit(kv, 'user-1', 'free');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('free');
    expect(result.limit).toBe(100);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('stores the request timestamp in KV after allowing', async () => {
    await checkRateLimit(kv, 'user-store', 'free');

    expect(kv.put).toHaveBeenCalledTimes(1);
    const putCall = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(putCall?.[0]).toBe('ratelimit:user-store');

    const stored = JSON.parse(putCall?.[1] as string) as SlidingWindowData;
    expect(stored.requests.length).toBe(1);
    expect(stored.tier).toBe('free');
  });

  it('does not call kv.put when the request is denied', async () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const timestamps = Array.from({ length: limit }, (_, i) => now - i * 100);

    const fullKV = createMockKV({
      'ratelimit:exhausted': {
        requests: timestamps,
        tier: 'free',
        lastUpdated: now,
      },
    });

    await checkRateLimit(fullKV, 'exhausted', 'free');

    // The put should NOT have been called because the request was denied
    expect(fullKV.put).not.toHaveBeenCalled();
  });

  it('decrements remaining on successive calls', async () => {
    const result1 = await checkRateLimit(kv, 'user-dec', 'free');
    const result2 = await checkRateLimit(kv, 'user-dec', 'free');

    expect(result2.remaining).toBe(result1.remaining - 1);
  });

  it('denies requests when the limit is reached (with safety margin)', async () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    // Fill with limit - 1 timestamps (the safety margin means < limit - 1 is the check)
    // With 99 requests, allowed = 99 < 99 = false
    const timestamps = Array.from({ length: limit - 1 }, (_, i) => now - i * 100);

    const fullKV = createMockKV({
      'ratelimit:at-limit': {
        requests: timestamps,
        tier: 'free',
        lastUpdated: now,
      },
    });

    const result = await checkRateLimit(fullKV, 'at-limit', 'free');

    expect(result.allowed).toBe(false);
    // remaining = max(0, limit - currentCount - 0) = max(0, 100 - 99) = 1
    // The safety margin means denial happens 1 request early, leaving 1 "remaining"
    expect(result.remaining).toBe(1);
  });

  it('provides retryAfter when denied', async () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const timestamps = Array.from({ length: limit }, (_, i) => now - i * 100);

    const fullKV = createMockKV({
      'ratelimit:retry-user': {
        requests: timestamps,
        tier: 'free',
        lastUpdated: now,
      },
    });

    const result = await checkRateLimit(fullKV, 'retry-user', 'free');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('does not include retryAfter when allowed', async () => {
    const result = await checkRateLimit(kv, 'fresh-user', 'free');

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('removes expired requests outside the 1-hour window', async () => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    // All timestamps are older than 1 hour
    const staleTimestamps = Array.from(
      { length: 50 },
      (_, i) => now - oneHourMs - (i + 1) * 1000,
    );

    const staleKV = createMockKV({
      'ratelimit:stale-user': {
        requests: staleTimestamps,
        tier: 'free',
        lastUpdated: now - oneHourMs,
      },
    });

    const result = await checkRateLimit(staleKV, 'stale-user', 'free');

    expect(result.allowed).toBe(true);
    // After expiring all old requests and adding one new one:
    // remaining = limit - 0 (expired) - 1 (new) = 99
    expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  it('resets the window when tier changes', async () => {
    const now = Date.now();
    const proKV = createMockKV({
      'ratelimit:tier-change': {
        requests: Array.from({ length: 10 }, (_, i) => now - i * 1000),
        tier: 'pro',
        lastUpdated: now,
      },
    });

    // Request as 'free' tier while stored data says 'pro' — should reset
    const result = await checkRateLimit(proKV, 'tier-change', 'free');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('free');
    // After reset, only the current request counts
    expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  it('immediately allows enterprise tier without KV access', async () => {
    const result = await checkRateLimit(kv, 'enterprise-user', 'enterprise');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.tier).toBe('enterprise');
    // Enterprise tier skips KV entirely
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('sets KV expiration TTL on put', async () => {
    await checkRateLimit(kv, 'ttl-user', 'free');

    const putCall = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = putCall?.[2] as { expirationTtl: number } | undefined;
    expect(options).toBeDefined();
    expect(options?.expirationTtl).toBeGreaterThan(0);
    // Should be ~7200 seconds (1h window + 1h buffer = 2h)
    expect(options?.expirationTtl).toBe(7200);
  });

  it('uses the correct KV key format', async () => {
    await checkRateLimit(kv, 'my-special-user', 'free');

    expect(kv.get).toHaveBeenCalledWith('ratelimit:my-special-user', 'json');
  });

  it('handles an empty existing requests array', async () => {
    const emptyKV = createMockKV({
      'ratelimit:empty-user': {
        requests: [],
        tier: 'free',
        lastUpdated: Date.now() - 1000,
      },
    });

    const result = await checkRateLimit(emptyKV, 'empty-user', 'free');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  it('correctly computes resetAt from the oldest request', async () => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const oldest = now - 30 * 60 * 1000; // 30 minutes ago

    const dataKV = createMockKV({
      'ratelimit:reset-user': {
        requests: [oldest, now - 10000, now - 5000],
        tier: 'free',
        lastUpdated: now,
      },
    });

    const result = await checkRateLimit(dataKV, 'reset-user', 'free');

    // resetAt should be oldest request + 1 hour
    expect(result.resetAt).toBe(oldest + oneHourMs);
  });

  it('handles pro tier with its correct limit', async () => {
    const result = await checkRateLimit(kv, 'pro-user', 'pro');

    expect(result.limit).toBe(1000);
    expect(result.tier).toBe('pro');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// getRateLimitStatus — read-only status check
// ---------------------------------------------------------------------------

describe('getRateLimitStatus', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('returns full remaining for a fresh identifier', async () => {
    const result = await getRateLimitStatus(kv, 'fresh', 'free');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
    expect(result.limit).toBe(100);
    expect(result.tier).toBe('free');
  });

  it('does not write to KV (read-only)', async () => {
    await getRateLimitStatus(kv, 'readonly', 'free');

    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it('reflects existing request count', async () => {
    const now = Date.now();
    const dataKV = createMockKV({
      'ratelimit:counted': {
        requests: Array.from({ length: 25 }, (_, i) => now - i * 1000),
        tier: 'free',
        lastUpdated: now,
      },
    });

    const result = await getRateLimitStatus(dataKV, 'counted', 'free');

    expect(result.remaining).toBe(75); // 100 - 25
    expect(result.allowed).toBe(true);
  });

  it('reports not allowed when at limit', async () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const dataKV = createMockKV({
      'ratelimit:full': {
        requests: Array.from({ length: limit }, (_, i) => now - i * 100),
        tier: 'free',
        lastUpdated: now,
      },
    });

    const result = await getRateLimitStatus(dataKV, 'full', 'free');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('excludes expired timestamps from the count', async () => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const dataKV = createMockKV({
      'ratelimit:mixed': {
        requests: [
          // 5 recent (within window)
          ...Array.from({ length: 5 }, (_, i) => now - i * 1000),
          // 10 expired (outside window)
          ...Array.from({ length: 10 }, (_, i) => now - oneHourMs - (i + 1) * 1000),
        ],
        tier: 'free',
        lastUpdated: now,
      },
    });

    const result = await getRateLimitStatus(dataKV, 'mixed', 'free');

    // Only the 5 recent timestamps count
    expect(result.remaining).toBe(95); // 100 - 5
  });
});

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------

describe('resetRateLimit', () => {
  it('deletes the correct KV key', async () => {
    const kv = createMockKV({
      'ratelimit:target': { requests: [Date.now()], tier: 'free', lastUpdated: Date.now() },
    });

    await resetRateLimit(kv, 'target');

    expect(kv.delete).toHaveBeenCalledWith('ratelimit:target');
  });

  it('does not throw for a nonexistent identifier', async () => {
    const kv = createMockKV();

    await expect(resetRateLimit(kv, 'nonexistent')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listRateLimitKeys
// ---------------------------------------------------------------------------

describe('listRateLimitKeys', () => {
  it('returns all keys with the ratelimit: prefix', async () => {
    const kv = createMockKV({
      'ratelimit:a': { requests: [], tier: 'free', lastUpdated: 0 },
      'ratelimit:b': { requests: [], tier: 'pro', lastUpdated: 0 },
      'other:key': 'value',
    });

    const keys = await listRateLimitKeys(kv);

    expect(keys).toHaveLength(2);
    expect(keys).toContain('ratelimit:a');
    expect(keys).toContain('ratelimit:b');
    expect(keys).not.toContain('other:key');
  });

  it('returns empty array when no keys exist', async () => {
    const kv = createMockKV();

    const keys = await listRateLimitKeys(kv);

    expect(keys).toEqual([]);
  });

  it('supports custom prefix parameter', async () => {
    const kv = createMockKV({
      'ratelimit:bucket:x': { tokens: 10, lastRefill: 0, tier: 'free' },
      'ratelimit:y': { requests: [], tier: 'free', lastUpdated: 0 },
    });

    const keys = await listRateLimitKeys(kv, 'ratelimit:bucket:');

    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe('ratelimit:bucket:x');
  });
});

// ---------------------------------------------------------------------------
// checkRateLimitTokenBucket
// ---------------------------------------------------------------------------

describe('checkRateLimitTokenBucket', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('allows the first request from a fresh bucket', async () => {
    const result = await checkRateLimitTokenBucket(kv, 'bucket-user', 'free');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('free');
    expect(result.limit).toBe(RATE_LIMIT_CONFIGS.free.burstLimit);
  });

  it('starts with full capacity and decrements by 1', async () => {
    const result = await checkRateLimitTokenBucket(kv, 'bucket-dec', 'free');

    // Initial capacity is burstLimit (20 for free), minus 1 consumed
    expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.free.burstLimit - 1);
  });

  it('denies when tokens are exhausted', async () => {
    const now = Date.now();
    const exhaustedKV = createMockKV({
      'ratelimit:bucket:empty-bucket': {
        tokens: 0.5, // Less than 1 token remaining
        lastRefill: now,
        tier: 'free',
      },
    });

    const result = await checkRateLimitTokenBucket(exhaustedKV, 'empty-bucket', 'free');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('refills tokens over time', async () => {
    const now = Date.now();
    // 10 seconds ago, 0 tokens
    const refillKV = createMockKV({
      'ratelimit:bucket:refill-user': {
        tokens: 0,
        lastRefill: now - 10000, // 10 seconds ago
        tier: 'free',
      },
    });

    const result = await checkRateLimitTokenBucket(refillKV, 'refill-user', 'free');

    // Free tier: 100 requests/hour = 100/3600 tokens/sec
    // 10 seconds = ~0.277 tokens. This is < 1, so should be denied
    // But check that the math is correct
    const expectedTokens = 10 * (100 / 3600);
    if (expectedTokens >= 1) {
      expect(result.allowed).toBe(true);
    } else {
      expect(result.allowed).toBe(false);
    }
  });

  it('caps tokens at bucket capacity', async () => {
    const now = Date.now();
    // A very long time ago with 0 tokens — refill should cap at capacity
    const capKV = createMockKV({
      'ratelimit:bucket:cap-user': {
        tokens: 0,
        lastRefill: now - 10 * 60 * 60 * 1000, // 10 hours ago
        tier: 'free',
      },
    });

    const result = await checkRateLimitTokenBucket(capKV, 'cap-user', 'free');

    expect(result.allowed).toBe(true);
    // Should be capped at burstLimit - 1 (consumed one)
    expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.free.burstLimit - 1);
  });

  it('stores updated bucket state in KV after allowing', async () => {
    await checkRateLimitTokenBucket(kv, 'store-bucket', 'free');

    expect(kv.put).toHaveBeenCalledTimes(1);
    const putCall = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(putCall?.[0]).toBe('ratelimit:bucket:store-bucket');

    const stored = JSON.parse(putCall?.[1] as string) as {
      tokens: number;
      lastRefill: number;
      tier: string;
    };
    expect(stored.tier).toBe('free');
    expect(stored.tokens).toBeLessThan(RATE_LIMIT_CONFIGS.free.burstLimit);
  });

  it('uses the correct KV key format for token bucket', async () => {
    await checkRateLimitTokenBucket(kv, 'key-test', 'pro');

    expect(kv.get).toHaveBeenCalledWith('ratelimit:bucket:key-test', 'json');
  });
});

// ---------------------------------------------------------------------------
// getRecommendedTier
// ---------------------------------------------------------------------------

describe('getRecommendedTier', () => {
  it('recommends free for 0 requests/hour', () => {
    expect(getRecommendedTier(0)).toBe('free');
  });

  it('recommends free for usage at the free-tier boundary', () => {
    expect(getRecommendedTier(100)).toBe('free');
  });

  it('recommends free for low usage', () => {
    expect(getRecommendedTier(50)).toBe('free');
  });

  it('recommends pro for usage just above free tier', () => {
    expect(getRecommendedTier(101)).toBe('pro');
  });

  it('recommends pro for mid-range usage', () => {
    expect(getRecommendedTier(500)).toBe('pro');
  });

  it('recommends pro for usage at the pro-tier boundary', () => {
    expect(getRecommendedTier(1000)).toBe('pro');
  });

  it('recommends enterprise for usage above pro tier', () => {
    expect(getRecommendedTier(1001)).toBe('enterprise');
  });

  it('recommends enterprise for very high usage', () => {
    expect(getRecommendedTier(100000)).toBe('enterprise');
  });
});
