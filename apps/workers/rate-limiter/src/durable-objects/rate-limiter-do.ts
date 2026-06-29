/**
 * RateLimiterDurableObject
 *
 * A per-identifier Durable Object that stores the sliding-window request log
 * in its SQLite-backed storage. Because every Durable Object instance is
 * single-threaded, concurrent requests routed to the same instance are
 * automatically serialised — eliminating the KV read-modify-write race.
 *
 * Binding name:  RATE_LIMITER
 * Class name:    RateLimiterDurableObject  (exported from entrypoint)
 * Migration tag: v1  (new_sqlite_classes)
 *
 * Each instance is looked up via  env.RATE_LIMITER.idFromName(identifier),
 * so the instance implicitly owns data for exactly one identifier.
 */

import { DurableObject } from 'cloudflare:workers';
import {
  evaluateSlidingWindow,
  RATE_LIMIT_CONFIGS,
  type RateLimitStatus,
  type UserTier,
} from '../utils/sliding-window.js';

// ---------------------------------------------------------------------------
// Storage key used inside the DO's SQLite store
// ---------------------------------------------------------------------------

const REQUESTS_KEY = 'requests';
const TIER_KEY = 'tier';

// ---------------------------------------------------------------------------
// Env type — the DO only needs its own storage; no extra bindings required.
// The Env generic is declared here so the class compiles; the actual Worker
// Env (with RATE_LIMITER, RATE_LIMITS, etc.) is only used by index.ts.
// ---------------------------------------------------------------------------

export type RateLimiterDOEnv = Record<string, never>;

// ---------------------------------------------------------------------------
// Helper: read timestamps array from DO storage
// ---------------------------------------------------------------------------

async function readRequests(storage: DurableObjectStorage): Promise<number[]> {
  const raw = await storage.get<number[]>(REQUESTS_KEY);
  return raw ?? [];
}

// ---------------------------------------------------------------------------
// Durable Object class
// ---------------------------------------------------------------------------

export class RateLimiterDurableObject extends DurableObject<RateLimiterDOEnv> {
  // -------------------------------------------------------------------------
  // check(tier)
  //
  // Atomically evaluates the sliding-window algorithm and records the request
  // if allowed. Returns a RateLimitStatus to the caller.
  //
  // Atomicity: DOs are single-threaded. This async method runs to completion
  // before any other RPC to this instance starts, so the read–evaluate–write
  // sequence cannot interleave with a concurrent request for the same identifier.
  // -------------------------------------------------------------------------
  async check(tier: UserTier): Promise<RateLimitStatus> {
    const config = RATE_LIMIT_CONFIGS[tier];

    // Enterprise tier is unlimited — skip storage entirely.
    if (config.requestsPerHour === Number.MAX_SAFE_INTEGER) {
      const now = Date.now();
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: now + 60 * 60 * 1000,
        limit: Number.MAX_SAFE_INTEGER,
        tier,
      };
    }

    const now = Date.now();

    // Read stored tier to detect tier changes (reset the window if changed).
    const [storedRequests, storedTier] = await Promise.all([
      readRequests(this.ctx.storage),
      this.ctx.storage.get<UserTier>(TIER_KEY),
    ]);

    // If the tier changed, start with an empty window.
    const requests = storedTier !== undefined && storedTier !== tier ? [] : storedRequests;

    const { status, nextRequests } = evaluateSlidingWindow(requests, now, tier);

    // Persist the updated request log and tier together.
    await Promise.all([
      this.ctx.storage.put(REQUESTS_KEY, nextRequests),
      this.ctx.storage.put(TIER_KEY, tier),
    ]);

    return status;
  }

  // -------------------------------------------------------------------------
  // status(tier)
  //
  // Read-only view of the current rate limit state — does NOT consume a slot.
  // -------------------------------------------------------------------------
  async status(tier: UserTier): Promise<RateLimitStatus> {
    const config = RATE_LIMIT_CONFIGS[tier];

    if (config.requestsPerHour === Number.MAX_SAFE_INTEGER) {
      const now = Date.now();
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: now + 60 * 60 * 1000,
        limit: Number.MAX_SAFE_INTEGER,
        tier,
      };
    }

    const now = Date.now();
    const requests = await readRequests(this.ctx.storage);

    // Pass consuming=false: read-only path — do not append now or subtract 1.
    const { status } = evaluateSlidingWindow(requests, now, tier, 60 * 60 * 1000, false);

    return status;
  }

  // -------------------------------------------------------------------------
  // reset()
  //
  // Wipes all stored data for this identifier. Used by the admin reset endpoint.
  // -------------------------------------------------------------------------
  async reset(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
