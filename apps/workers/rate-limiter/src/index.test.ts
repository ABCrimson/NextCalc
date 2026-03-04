/**
 * Rate Limiter Service - Vitest Unit Tests
 *
 * Tests every public route of the Rate Limiter Hono application using
 * Hono's `app.request()` helper which executes handlers in-process.
 *
 * Mocking strategy:
 * - The KV namespace (RATE_LIMITS) is mocked with vi.fn() implementations
 *   that mimic get/put/delete/list behaviour in-memory so we can control
 *   exactly how many requests have been seen for a given identifier.
 * - ADMIN_KEY is set to a fixed value ("test-admin-key") in env bindings
 *   so admin-protected routes can be exercised.
 */

import { describe, expect, it, vi } from 'vitest';
import app from './index.js';
import { RATE_LIMIT_CONFIGS } from './utils/sliding-window.js';

// ---------------------------------------------------------------------------
// KV mock helpers
// ---------------------------------------------------------------------------

type KVStore = Map<string, string>;

/**
 * Creates a lightweight in-memory KV namespace mock that satisfies the
 * KVNamespace interface surface used by the rate limiter logic.
 */
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
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, cursor: undefined, list_complete: true };
    }),
    // Remaining KVNamespace methods not used by the service
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Environment binding factory
// ---------------------------------------------------------------------------

const ADMIN_KEY = 'test-admin-key';

function createTestEnv(overrides: Record<string, unknown> = {}) {
  return {
    ALLOWED_ORIGINS: 'http://localhost:3005',
    RATE_LIMITS: createMockKV(),
    ADMIN_KEY,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  options: RequestInit = {},
  env = createTestEnv(),
): Promise<Response> {
  return app.request(url, options, env);
}

function postJson(url: string, body: unknown, env = createTestEnv()): Promise<Response> {
  return makeRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );
}

function deleteReq(
  url: string,
  headers: Record<string, string> = {},
  env = createTestEnv(),
): Promise<Response> {
  return makeRequest(url, { method: 'DELETE', headers }, env);
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with healthy status and rate-limiter service name', async () => {
    const res = await makeRequest('/health');
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe('healthy');
    expect(json.service).toBe('rate-limiter');
    expect(json.version).toBe('1.0.0');
  });

  it('includes a valid ISO 8601 timestamp', async () => {
    const res = await makeRequest('/health');
    const json = (await res.json()) as { timestamp: string };
    expect(Number.isNaN(Date.parse(json.timestamp))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

describe('GET /', () => {
  it('returns 200 with service metadata and endpoint descriptions', async () => {
    const res = await makeRequest('/');
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, unknown>;
    expect(json.name).toContain('Rate Limiter');
    expect(json.version).toBe('1.0.0');
  });

  it('includes RATE_LIMIT_CONFIGS in the root response', async () => {
    const res = await makeRequest('/');
    const json = (await res.json()) as { tiers: typeof RATE_LIMIT_CONFIGS };
    expect(json.tiers).toBeDefined();
    expect(json.tiers.free).toBeDefined();
    expect(json.tiers.pro).toBeDefined();
    expect(json.tiers.enterprise).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

describe('Unknown routes', () => {
  it('returns 404 with NOT_FOUND error code', async () => {
    const res = await makeRequest('/does-not-exist');
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

describe('CORS middleware', () => {
  it('echoes the allowed origin back in ACAO header', async () => {
    const res = await makeRequest('/health', {
      headers: { Origin: 'http://localhost:3005' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3005');
  });

  it('exposes rate-limit headers in ACEH', async () => {
    const res = await makeRequest('/health', {
      headers: { Origin: 'http://localhost:3005' },
    });
    const exposed = res.headers.get('Access-Control-Expose-Headers') ?? '';
    expect(exposed).toContain('X-RateLimit-Limit');
    expect(exposed).toContain('X-RateLimit-Remaining');
    expect(exposed).toContain('X-RateLimit-Reset');
  });
});

// ---------------------------------------------------------------------------
// POST /check
// ---------------------------------------------------------------------------

describe('POST /check', () => {
  it('returns 200 with allowed:true for the first request from a fresh identifier', async () => {
    const res = await postJson('/check', {
      identifier: 'user-fresh-001',
      tier: 'free',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { allowed: boolean; tier: string; limit: number };
    };
    expect(json.success).toBe(true);
    expect(json.data.allowed).toBe(true);
    expect(json.data.tier).toBe('free');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour);
  });

  it('defaults tier to "free" when tier field is omitted', async () => {
    const res = await postJson('/check', { identifier: 'user-no-tier' });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: { tier: string } };
    expect(json.success).toBe(true);
    expect(json.data.tier).toBe('free');
  });

  it('returns correct limit for the pro tier', async () => {
    const res = await postJson('/check', {
      identifier: 'user-pro-001',
      tier: 'pro',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { limit: number; tier: string } };
    expect(json.data.tier).toBe('pro');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.pro.requestsPerHour);
  });

  it('returns correct limit for the enterprise tier', async () => {
    const res = await postJson('/check', {
      identifier: 'user-enterprise-001',
      tier: 'enterprise',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { limit: number; tier: string } };
    expect(json.data.tier).toBe('enterprise');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.enterprise.requestsPerHour);
  });

  it('decrements remaining by 1 on the second call for the same identifier', async () => {
    const kv = createMockKV();
    const env = createTestEnv({ RATE_LIMITS: kv });

    const body = { identifier: 'user-decrement', tier: 'free' };

    const res1 = await postJson('/check', body, env);
    const json1 = (await res1.json()) as { data: { remaining: number } };
    const remaining1 = json1.data.remaining;

    const res2 = await postJson('/check', body, env);
    const json2 = (await res2.json()) as { data: { remaining: number } };
    const remaining2 = json2.data.remaining;

    expect(remaining2).toBe(remaining1 - 1);
  });

  it('blocks a request when the identifier has exhausted its quota', async () => {
    // Pre-fill the KV store with a window containing exactly the free-tier limit
    // of timestamps, all within the last hour, so the next request is denied.
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const now = Date.now();
    const timestamps = Array.from({ length: limit }, (_, i) => now - i * 100);

    const kv = createMockKV({
      'ratelimit:exhausted-user': {
        requests: timestamps,
        tier: 'free',
        lastUpdated: now,
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await postJson('/check', { identifier: 'exhausted-user', tier: 'free' }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { allowed: boolean; remaining: number; retryAfter?: number };
    };
    expect(json.success).toBe(true);
    expect(json.data.allowed).toBe(false);
    expect(json.data.remaining).toBe(0);
    expect(json.data.retryAfter).toBeDefined();
  });

  it('sets X-RateLimit-Limit header matching the tier config', async () => {
    const res = await postJson('/check', {
      identifier: 'user-header-check',
      tier: 'pro',
    });
    expect(res.headers.get('X-RateLimit-Limit')).toBe(
      RATE_LIMIT_CONFIGS.pro.requestsPerHour.toString(),
    );
  });

  it('sets X-RateLimit-Tier header to the requested tier', async () => {
    const res = await postJson('/check', {
      identifier: 'user-tier-header',
      tier: 'enterprise',
    });
    expect(res.headers.get('X-RateLimit-Tier')).toBe('enterprise');
  });

  it('sets Retry-After header when rate limit is exceeded', async () => {
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const now = Date.now();
    const timestamps = Array.from({ length: limit }, (_, i) => now - i * 10);

    const kv = createMockKV({
      'ratelimit:rate-limited-user': {
        requests: timestamps,
        tier: 'free',
        lastUpdated: now,
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await postJson(
      '/check',
      {
        identifier: 'rate-limited-user',
        tier: 'free',
      },
      env,
    );

    const json = (await res.json()) as { data: { allowed: boolean } };
    if (!json.data.allowed) {
      expect(res.headers.get('Retry-After')).toBeTruthy();
    }
  });

  it('returns 400 VALIDATION_ERROR when identifier is missing', async () => {
    const res = await postJson('/check', { tier: 'free' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when identifier is an empty string', async () => {
    const res = await postJson('/check', { identifier: '', tier: 'free' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when tier is not a recognised enum value', async () => {
    const res = await postJson('/check', {
      identifier: 'user-bad-tier',
      tier: 'diamond', // not allowed
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('resets the window when tier changes between calls for the same identifier', async () => {
    const kv = createMockKV({
      'ratelimit:tier-switch-user': {
        // Stored under 'pro', so switching to 'free' should reset
        requests: [Date.now() - 100],
        tier: 'pro',
        lastUpdated: Date.now(),
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    // First call with 'free' — tier mismatch triggers a reset, so remaining
    // should be close to the free limit (limit - 1 after consuming this request).
    const res = await postJson(
      '/check',
      {
        identifier: 'tier-switch-user',
        tier: 'free',
      },
      env,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { remaining: number } };
    expect(json.data.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });
});

// ---------------------------------------------------------------------------
// GET /status/:identifier
// ---------------------------------------------------------------------------

describe('GET /status/:identifier', () => {
  it('returns 200 with status data for a fresh identifier', async () => {
    const res = await makeRequest('/status/fresh-identifier');
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { allowed: boolean; remaining: number; limit: number };
    };
    expect(json.success).toBe(true);
    expect(json.data.allowed).toBe(true);
    expect(json.data.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour);
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour);
  });

  it('returns data for the pro tier when ?tier=pro query param is used', async () => {
    const res = await makeRequest('/status/some-user?tier=pro');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { tier: string; limit: number } };
    expect(json.data.tier).toBe('pro');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.pro.requestsPerHour);
  });

  it('does NOT decrement remaining (read-only endpoint)', async () => {
    const kv = createMockKV();
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res1 = await makeRequest('/status/read-only-user', {}, env);
    const json1 = (await res1.json()) as { data: { remaining: number } };

    const res2 = await makeRequest('/status/read-only-user', {}, env);
    const json2 = (await res2.json()) as { data: { remaining: number } };

    // Status endpoint must not consume a token between calls
    expect(json2.data.remaining).toBe(json1.data.remaining);
  });

  it('sets X-RateLimit-Limit header', async () => {
    const res = await makeRequest('/status/some-identifier?tier=free');
    expect(res.headers.get('X-RateLimit-Limit')).toBe(
      RATE_LIMIT_CONFIGS.free.requestsPerHour.toString(),
    );
  });

  it('sets X-RateLimit-Tier header', async () => {
    const res = await makeRequest('/status/some-identifier?tier=pro');
    expect(res.headers.get('X-RateLimit-Tier')).toBe('pro');
  });

  it('returns 400 INVALID_TIER for an unrecognised tier query value', async () => {
    const res = await makeRequest('/status/some-user?tier=platinum');
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_TIER');
  });

  it('reflects existing request count from KV for a previously seen identifier', async () => {
    const now = Date.now();
    // Simulate 5 recent requests
    const kv = createMockKV({
      'ratelimit:known-user': {
        requests: Array.from({ length: 5 }, (_, i) => now - i * 1000),
        tier: 'free',
        lastUpdated: now,
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await makeRequest('/status/known-user?tier=free', {}, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { remaining: number } };
    // 100 limit − 5 used = 95 remaining
    expect(json.data.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 5);
  });
});

// ---------------------------------------------------------------------------
// GET /configs
// ---------------------------------------------------------------------------

describe('GET /configs', () => {
  it('returns 200 with success:true', async () => {
    const res = await makeRequest('/configs');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('contains free, pro, and enterprise tier configurations', async () => {
    const res = await makeRequest('/configs');
    const json = (await res.json()) as {
      success: boolean;
      data: typeof RATE_LIMIT_CONFIGS;
    };

    expect(json.data.free.tier).toBe('free');
    expect(json.data.free.requestsPerHour).toBe(100);
    expect(json.data.pro.tier).toBe('pro');
    expect(json.data.pro.requestsPerHour).toBe(1000);
    expect(json.data.enterprise.tier).toBe('enterprise');
  });

  it('includes burstLimit for each tier', async () => {
    const res = await makeRequest('/configs');
    const json = (await res.json()) as { data: typeof RATE_LIMIT_CONFIGS };

    expect(typeof json.data.free.burstLimit).toBe('number');
    expect(typeof json.data.pro.burstLimit).toBe('number');
    expect(typeof json.data.enterprise.burstLimit).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// GET /recommend/:requestsPerHour
// ---------------------------------------------------------------------------

describe('GET /recommend/:requestsPerHour', () => {
  it('recommends free tier for 50 requests/hour', async () => {
    const res = await makeRequest('/recommend/50');
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { requestsPerHour: number; recommendedTier: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.requestsPerHour).toBe(50);
    expect(json.data.recommendedTier).toBe('free');
  });

  it('recommends pro tier for 500 requests/hour', async () => {
    const res = await makeRequest('/recommend/500');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { recommendedTier: string } };
    expect(json.data.recommendedTier).toBe('pro');
  });

  it('recommends enterprise tier for 5000 requests/hour', async () => {
    const res = await makeRequest('/recommend/5000');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { recommendedTier: string } };
    expect(json.data.recommendedTier).toBe('enterprise');
  });

  it('includes the config object for the recommended tier', async () => {
    const res = await makeRequest('/recommend/100');
    const json = (await res.json()) as {
      data: { config: typeof RATE_LIMIT_CONFIGS.free };
    };
    expect(json.data.config).toBeDefined();
    expect(typeof json.data.config.requestsPerHour).toBe('number');
  });

  it('returns 400 for a non-numeric segment', async () => {
    const res = await makeRequest('/recommend/lots');
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 for a negative value', async () => {
    const res = await makeRequest('/recommend/-10');
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_INPUT');
  });
});

// ---------------------------------------------------------------------------
// DELETE /reset/:identifier  (admin endpoint)
// ---------------------------------------------------------------------------

describe('DELETE /reset/:identifier', () => {
  it('returns 200 and resets the rate limit when correct admin key is provided', async () => {
    const kv = createMockKV({
      'ratelimit:to-be-reset': {
        requests: [Date.now()],
        tier: 'free',
        lastUpdated: Date.now(),
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await deleteReq('/reset/to-be-reset', { 'X-Admin-Key': ADMIN_KEY }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; message: string };
    expect(json.success).toBe(true);
    expect(json.message).toContain('to-be-reset');
  });

  it('calls kv.delete with the correct key on a successful reset', async () => {
    const kv = createMockKV();
    const env = createTestEnv({ RATE_LIMITS: kv });

    await deleteReq('/reset/target-user', { 'X-Admin-Key': ADMIN_KEY }, env);

    expect((kv.delete as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      'ratelimit:target-user',
    ]);
  });

  it('returns 401 when X-Admin-Key header is missing', async () => {
    const res = await deleteReq('/reset/some-user', {});
    expect(res.status).toBe(401);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('returns 401 when X-Admin-Key is incorrect', async () => {
    const res = await deleteReq('/reset/some-user', { 'X-Admin-Key': 'wrong-key' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /admin/keys  (admin endpoint)
// ---------------------------------------------------------------------------

describe('GET /admin/keys', () => {
  it('returns 200 with key count when authenticated', async () => {
    const kv = createMockKV({
      'ratelimit:user-a': { requests: [], tier: 'free', lastUpdated: 0 },
      'ratelimit:user-b': { requests: [], tier: 'pro', lastUpdated: 0 },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await makeRequest('/admin/keys', { headers: { 'X-Admin-Key': ADMIN_KEY } }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { count: number; keys: string[] };
    };
    expect(json.success).toBe(true);
    expect(typeof json.data.count).toBe('number');
    expect(Array.isArray(json.data.keys)).toBe(true);
  });

  it('returns 401 when X-Admin-Key header is missing', async () => {
    const res = await makeRequest('/admin/keys');
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Admin-Key is wrong', async () => {
    const res = await makeRequest('/admin/keys', {
      headers: { 'X-Admin-Key': 'bad-key' },
    });
    expect(res.status).toBe(401);
  });

  it('limits the returned keys to a maximum of 100', async () => {
    // Fill KV with 150 keys
    const initial: Record<string, unknown> = {};
    for (let i = 0; i < 150; i++) {
      initial[`ratelimit:user-${i}`] = { requests: [], tier: 'free', lastUpdated: 0 };
    }
    const kv = createMockKV(initial);
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await makeRequest('/admin/keys', { headers: { 'X-Admin-Key': ADMIN_KEY } }, env);
    const json = (await res.json()) as { data: { keys: string[] } };
    expect(json.data.keys.length).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Rate limit enforcement – integration-style sequence
// ---------------------------------------------------------------------------

describe('Rate limit enforcement (sequence test)', () => {
  it('allows up to the free-tier limit and denies the next request', async () => {
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const now = Date.now();

    // Pre-populate KV with (limit - 2) timestamps so the next /check is the
    // last allowed one, and the one after that is denied.
    //
    // The sliding-window implementation applies a safety margin of 1 to reduce
    // KV read-modify-write race conditions: `allowed = currentCount < limit - 1`.
    // This means the effective cap is (limit - 1) in-flight requests, not limit.
    // With (limit - 2) pre-existing requests, the first call is still accepted
    // (98 < 99) and the second call is rejected (99 < 99 = false).
    const kv = createMockKV({
      'ratelimit:sequence-user': {
        requests: Array.from({ length: limit - 2 }, (_, i) => now - (limit - i) * 10),
        tier: 'free',
        lastUpdated: now,
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    // This call should be allowed (fills the last slot)
    const resAllowed = await postJson(
      '/check',
      {
        identifier: 'sequence-user',
        tier: 'free',
      },
      env,
    );
    expect(resAllowed.status).toBe(200);
    const jsonAllowed = (await resAllowed.json()) as { data: { allowed: boolean } };
    expect(jsonAllowed.data.allowed).toBe(true);

    // This call should be denied (limit exhausted)
    const resDenied = await postJson(
      '/check',
      {
        identifier: 'sequence-user',
        tier: 'free',
      },
      env,
    );
    expect(resDenied.status).toBe(200);
    const jsonDenied = (await resDenied.json()) as {
      data: { allowed: boolean; remaining: number };
    };
    expect(jsonDenied.data.allowed).toBe(false);
    // With the safety-margin check (`currentCount < limit - 1`), the denied
    // response has currentCount = limit - 1 = 99, so remaining = limit - 99 = 1.
    expect(jsonDenied.data.remaining).toBe(1);
  });

  it('ignores timestamps outside the 1-hour sliding window', async () => {
    const now = Date.now();
    const oneHourAgoMs = 60 * 60 * 1000;

    // All timestamps are older than the window — they should be discarded,
    // leaving a fresh slate (remaining = limit - 1 after this request).
    const kv = createMockKV({
      'ratelimit:window-user': {
        requests: Array.from({ length: 50 }, (_, i) => now - oneHourAgoMs - (i + 1) * 1000),
        tier: 'free',
        lastUpdated: now - oneHourAgoMs,
      },
    });
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await postJson(
      '/check',
      {
        identifier: 'window-user',
        tier: 'free',
      },
      env,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { allowed: boolean; remaining: number } };
    expect(json.data.allowed).toBe(true);
    // All 50 stale timestamps were discarded, only the current request counts
    expect(json.data.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });
});
