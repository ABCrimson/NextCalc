/**
 * Unit tests for the pure sliding-window algorithm (evaluateSlidingWindow)
 * and the supporting utilities (RATE_LIMIT_CONFIGS, getRecommendedTier).
 *
 * All tests are node-based and require no Cloudflare runtime environment —
 * the functions under test are side-effect-free and accept plain arrays.
 *
 * Coverage goals:
 *  - Every branch of evaluateSlidingWindow (allow / deny / expiry / tier)
 *  - Exact admission check: currentCount < limit  (no magic -1 margin)
 *  - Tier configuration invariants
 *  - Tier recommendation boundaries
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateSlidingWindow,
  getRecommendedTier,
  RATE_LIMIT_CONFIGS,
  type UserTier,
} from '../utils/sliding-window.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Build an array of `count` timestamps, all within the sliding window,
 * spread evenly over the last 30 minutes.
 */
function recentTimestamps(count: number, now: number): number[] {
  return Array.from({ length: count }, (_, i) => now - (count - i) * 100);
}

/**
 * Build an array of `count` timestamps that are all outside the 1-hour window.
 */
function staleTimestamps(count: number, now: number): number[] {
  return Array.from({ length: count }, (_, i) => now - ONE_HOUR_MS - (i + 1) * 1000);
}

// ---------------------------------------------------------------------------
// RATE_LIMIT_CONFIGS — static invariants
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
    expect(RATE_LIMIT_CONFIGS.free.burstLimit).toBeLessThan(RATE_LIMIT_CONFIGS.pro.burstLimit);
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
// evaluateSlidingWindow — core algorithm
// ---------------------------------------------------------------------------

describe('evaluateSlidingWindow', () => {
  it('allows the first request from an empty window', () => {
    const now = Date.now();
    const { allowed, status } = evaluateSlidingWindow([], now, 'free');

    expect(allowed).toBe(true);
    expect(status.allowed).toBe(true);
    expect(status.tier).toBe('free');
    expect(status.limit).toBe(100);
    expect(status.remaining).toBe(99);
  });

  it('appends now to nextRequests when allowed', () => {
    const now = Date.now();
    const { allowed, nextRequests } = evaluateSlidingWindow([], now, 'free');

    expect(allowed).toBe(true);
    expect(nextRequests).toHaveLength(1);
    expect(nextRequests[0]).toBe(now);
  });

  it('does not append to nextRequests when denied', () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const full = recentTimestamps(limit, now);

    const { allowed, nextRequests } = evaluateSlidingWindow(full, now, 'free');

    expect(allowed).toBe(false);
    expect(nextRequests).toHaveLength(limit); // pruned but not extended
  });

  it('denies exactly at the limit: currentCount === limit should be denied', () => {
    // This verifies the strict < check (no -1 band-aid).
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour; // 100
    const full = recentTimestamps(limit, now);

    const { allowed } = evaluateSlidingWindow(full, now, 'free');

    expect(allowed).toBe(false);
  });

  it('allows at currentCount === limit - 1 (last available slot)', () => {
    // With the correct < check, the 100th request (index 99) must be allowed.
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const almostFull = recentTimestamps(limit - 1, now);

    const { allowed } = evaluateSlidingWindow(almostFull, now, 'free');

    expect(allowed).toBe(true);
  });

  it('decrements remaining on each successive evaluation', () => {
    const now = Date.now();
    const r1 = evaluateSlidingWindow([], now, 'free');
    const r2 = evaluateSlidingWindow(r1.nextRequests, now + 1, 'free');

    expect(r2.status.remaining).toBe(r1.status.remaining - 1);
  });

  it('prunes expired timestamps before evaluating', () => {
    const now = Date.now();
    const stale = staleTimestamps(50, now);

    const { allowed, status } = evaluateSlidingWindow(stale, now, 'free');

    expect(allowed).toBe(true);
    // All stale timestamps discarded; only the current request counts.
    expect(status.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  it('correctly mixes stale and fresh timestamps', () => {
    const now = Date.now();
    const stale = staleTimestamps(10, now);
    const fresh = recentTimestamps(5, now);

    const { allowed, status } = evaluateSlidingWindow([...stale, ...fresh], now, 'free');

    expect(allowed).toBe(true);
    // 5 fresh survive; after adding now: 6 used, 94 remaining.
    expect(status.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 6);
  });

  it('includes retryAfter in status when denied', () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const { status } = evaluateSlidingWindow(recentTimestamps(limit, now), now, 'free');

    expect(status.allowed).toBe(false);
    expect(status.retryAfter).toBeDefined();
    expect(status.retryAfter).toBeGreaterThan(0);
  });

  it('does not include retryAfter when allowed', () => {
    const now = Date.now();
    const { status } = evaluateSlidingWindow([], now, 'free');

    expect(status.allowed).toBe(true);
    expect(status.retryAfter).toBeUndefined();
  });

  it('computes resetAt as oldest request + windowMs', () => {
    const now = Date.now();
    const oldest = now - 30 * 60 * 1000; // 30 minutes ago

    const requests = [oldest, now - 10_000, now - 5_000];
    const { status } = evaluateSlidingWindow(requests, now, 'free');

    expect(status.resetAt).toBe(oldest + ONE_HOUR_MS);
  });

  it('sets resetAt to now + windowMs when window is empty', () => {
    const now = Date.now();
    const { status } = evaluateSlidingWindow([], now, 'free');

    // After appending now, oldest = now, so resetAt = now + 1h.
    // But the function computes resetAt from active (before appending now).
    // With empty active, oldest falls back to now.
    expect(status.resetAt).toBe(now + ONE_HOUR_MS);
  });

  it('handles pro tier with its correct limit', () => {
    const now = Date.now();
    const { status } = evaluateSlidingWindow([], now, 'pro');

    expect(status.limit).toBe(1000);
    expect(status.tier).toBe('pro');
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(999);
  });

  it('respects a custom windowMs parameter', () => {
    const now = Date.now();
    const customWindow = 60_000; // 1 minute

    // Timestamp from 90 seconds ago — inside 1-hour default but outside 1-minute custom.
    const requests = [now - 90_000];
    const { allowed, status } = evaluateSlidingWindow(requests, now, 'free', customWindow);

    expect(allowed).toBe(true);
    // The 90-second-old entry was pruned; remaining = limit - 1.
    expect(status.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  it('correctly returns remaining = 0 when denied', () => {
    const now = Date.now();
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const { status } = evaluateSlidingWindow(recentTimestamps(limit, now), now, 'free');

    expect(status.remaining).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Atomicity / correctness proof
  // -------------------------------------------------------------------------

  it('admits exactly `limit` requests in a sequence — no over-admission', () => {
    // Simulate `limit + 2` sequential requests through the pure function.
    // Exactly `limit` must be allowed; all subsequent must be denied.
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    let requests: number[] = [];
    let allowed = 0;
    let denied = 0;
    const start = Date.now();

    for (let i = 0; i < limit + 2; i++) {
      const now = start + i; // each call is 1 ms apart
      const result = evaluateSlidingWindow(requests, now, 'free');
      requests = result.nextRequests;
      if (result.allowed) {
        allowed++;
      } else {
        denied++;
      }
    }

    expect(allowed).toBe(limit);
    expect(denied).toBe(2);
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
    expect(getRecommendedTier(100_000)).toBe('enterprise');
  });
});
