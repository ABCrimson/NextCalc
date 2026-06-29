/**
 * Rate Limiter Service — Integration tests for the Hono application.
 *
 * Vitest environment: node (not @cloudflare/vitest-pool-workers).
 * The Durable Object is not available in node mode, so we mock the DO
 * namespace + stub with vi.fn(). The pure algorithm is already covered by
 * sliding-window.test.ts; these tests focus on HTTP routing, validation,
 * header setting, and auth enforcement.
 *
 * Mock strategy:
 *  - createMockDoNamespace() returns an object that satisfies the
 *    DurableObjectNamespace<RateLimiterDurableObject> surface used by the
 *    Worker. Each created stub holds an in-memory state so sequential /check
 *    calls against the same identifier decrement remaining correctly.
 *  - createMockKV() returns an in-memory KV for the identifier index that
 *    /admin/keys reads.
 */

import { describe, expect, it, vi } from 'vitest';
import app from './index.js';
import type { RateLimitStatus, UserTier } from './utils/sliding-window.js';
import { evaluateSlidingWindow, RATE_LIMIT_CONFIGS } from './utils/sliding-window.js';

// ---------------------------------------------------------------------------
// In-memory DO stub
// ---------------------------------------------------------------------------

/**
 * Minimal in-memory stub that mirrors RateLimiterDurableObject.
 * State is kept per-identifier in the parent namespace factory.
 */
function createDoStub(initialRequests: number[] = [], initialTier?: UserTier) {
  let requests = initialRequests;
  let storedTier: UserTier | undefined = initialTier;

  return {
    check: vi.fn(async (tier: UserTier): Promise<RateLimitStatus> => {
      const now = Date.now();
      // Mirror the DO's enterprise short-circuit (no storage churn).
      if (RATE_LIMIT_CONFIGS[tier].requestsPerHour === Number.MAX_SAFE_INTEGER) {
        return {
          allowed: true,
          remaining: Number.MAX_SAFE_INTEGER,
          resetAt: now + 60 * 60 * 1000,
          limit: Number.MAX_SAFE_INTEGER,
          tier,
        };
      }
      // Reset on tier change (mirrors DO logic)
      if (storedTier !== undefined && storedTier !== tier) {
        requests = [];
      }
      storedTier = tier;
      const { status, nextRequests } = evaluateSlidingWindow(requests, now, tier);
      requests = nextRequests;
      return status;
    }),
    status: vi.fn(async (tier: UserTier): Promise<RateLimitStatus> => {
      const now = Date.now();
      // consuming=false: read-only path, do not count current request.
      const { status } = evaluateSlidingWindow(requests, now, tier, 60 * 60 * 1000, false);
      return status;
    }),
    reset: vi.fn(async (): Promise<void> => {
      requests = [];
      storedTier = undefined;
    }),
  };
}

type DoStub = ReturnType<typeof createDoStub>;

/**
 * Creates a mock DurableObjectNamespace that maps identifier strings to
 * in-memory DO stubs. Pre-populated stubs can be injected via `initialStubs`.
 */
function createMockDoNamespace(
  initialStubs: Record<string, { requests?: number[]; tier?: UserTier }> = {},
) {
  // Map from name → stub
  const stubs = new Map<string, DoStub>();

  for (const [name, opts] of Object.entries(initialStubs)) {
    stubs.set(name, createDoStub(opts.requests ?? [], opts.tier));
  }

  function getOrCreate(name: string): DoStub {
    const existing = stubs.get(name);
    if (existing !== undefined) return existing;
    const stub = createDoStub();
    stubs.set(name, stub);
    return stub;
  }

  return {
    idFromName: vi.fn((name: string) => ({ name, toString: () => name })),
    get: vi.fn((id: { name: string }): DoStub => getOrCreate(id.name)),
    // expose stubs map for assertions
    _stubs: stubs,
  } as unknown as DurableObjectNamespace<
    import('./durable-objects/rate-limiter-do.js').RateLimiterDurableObject
  > & { _stubs: Map<string, DoStub> };
}

// ---------------------------------------------------------------------------
// In-memory KV mock (identifier index)
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
      if (type === 'json') return JSON.parse(raw) as unknown;
      return raw;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(
      async (options?: {
        prefix?: string;
        cursor?: string;
      }): Promise<KVNamespaceListResult<unknown, string>> => {
        const prefix = options?.prefix ?? '';
        const keys = [...store.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name, expiration: undefined, metadata: undefined }));
        return { keys, cursor: '', list_complete: true };
      },
    ),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Test env factory
// ---------------------------------------------------------------------------

const ADMIN_KEY = 'test-admin-key';

function createTestEnv(
  overrides: {
    RATE_LIMITER?: ReturnType<typeof createMockDoNamespace>;
    RATE_LIMITS?: KVNamespace;
    ADMIN_KEY?: string;
    ALLOWED_ORIGINS?: string;
  } = {},
) {
  return {
    ALLOWED_ORIGINS: 'http://localhost:3005',
    RATE_LIMITER: createMockDoNamespace(),
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
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
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
  it('returns 200 with service metadata', async () => {
    const res = await makeRequest('/');
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, unknown>;
    expect(json.name).toContain('Rate Limiter');
  });

  it('includes RATE_LIMIT_CONFIGS in tiers field', async () => {
    const res = await makeRequest('/');
    const json = (await res.json()) as { tiers: typeof RATE_LIMIT_CONFIGS };
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
  it('echoes allowed origin in ACAO header', async () => {
    const res = await makeRequest('/health', { headers: { Origin: 'http://localhost:3005' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3005');
  });

  it('exposes rate-limit headers in ACEH', async () => {
    const res = await makeRequest('/health', { headers: { Origin: 'http://localhost:3005' } });
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
  it('returns 200 with allowed:true for a fresh identifier', async () => {
    const res = await postJson('/check', { identifier: 'user-fresh', tier: 'free' });
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

    const json = (await res.json()) as { data: { tier: string } };
    expect(json.data.tier).toBe('free');
  });

  it('returns correct limit for pro tier', async () => {
    const res = await postJson('/check', { identifier: 'user-pro', tier: 'pro' });
    const json = (await res.json()) as { data: { limit: number; tier: string } };
    expect(json.data.tier).toBe('pro');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.pro.requestsPerHour);
  });

  it('returns correct limit for enterprise tier (unlimited)', async () => {
    const res = await postJson('/check', { identifier: 'user-enterprise', tier: 'enterprise' });
    const json = (await res.json()) as { data: { limit: number; tier: string } };
    expect(json.data.tier).toBe('enterprise');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.enterprise.requestsPerHour);
  });

  it('decrements remaining by 1 on the second call for the same identifier', async () => {
    const ns = createMockDoNamespace();
    const env = createTestEnv({ RATE_LIMITER: ns });
    const body = { identifier: 'user-decrement', tier: 'free' };

    const res1 = await postJson('/check', body, env);
    const json1 = (await res1.json()) as { data: { remaining: number } };

    const res2 = await postJson('/check', body, env);
    const json2 = (await res2.json()) as { data: { remaining: number } };

    expect(json2.data.remaining).toBe(json1.data.remaining - 1);
  });

  it('blocks a request when the identifier has exhausted its quota', async () => {
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const now = Date.now();
    const timestamps = Array.from({ length: limit }, (_, i) => now - i * 100);

    const ns = createMockDoNamespace({
      'exhausted-user': { requests: timestamps, tier: 'free' },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res = await postJson('/check', { identifier: 'exhausted-user', tier: 'free' }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      data: { allowed: boolean; remaining: number; retryAfter?: number };
    };
    expect(json.data.allowed).toBe(false);
    expect(json.data.remaining).toBe(0);
    expect(json.data.retryAfter).toBeDefined();
  });

  it('sets X-RateLimit-Limit header matching the tier config', async () => {
    const res = await postJson('/check', { identifier: 'user-header', tier: 'pro' });
    expect(res.headers.get('X-RateLimit-Limit')).toBe(
      RATE_LIMIT_CONFIGS.pro.requestsPerHour.toString(),
    );
  });

  it('sets X-RateLimit-Tier header to the requested tier', async () => {
    const res = await postJson('/check', { identifier: 'user-tier', tier: 'enterprise' });
    expect(res.headers.get('X-RateLimit-Tier')).toBe('enterprise');
  });

  it('sets Retry-After header when rate limit is exceeded', async () => {
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const now = Date.now();
    const timestamps = Array.from({ length: limit }, (_, i) => now - i * 10);

    const ns = createMockDoNamespace({
      'rate-limited-user': { requests: timestamps, tier: 'free' },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res = await postJson('/check', { identifier: 'rate-limited-user', tier: 'free' }, env);
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
    const res = await postJson('/check', { identifier: 'user', tier: 'diamond' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('resets the window when tier changes between calls for the same identifier', async () => {
    const now = Date.now();
    const ns = createMockDoNamespace({
      'tier-switch': { requests: [now - 100], tier: 'pro' },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res = await postJson('/check', { identifier: 'tier-switch', tier: 'free' }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { remaining: number } };
    expect(json.data.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  // -------------------------------------------------------------------------
  // Admission correctness: verifies the strict < limit check (no band-aid)
  // -------------------------------------------------------------------------

  it('admits exactly the limit and denies the next request (strict < check)', async () => {
    const limit = RATE_LIMIT_CONFIGS.free.requestsPerHour;
    const now = Date.now();

    // Pre-populate with limit - 1 timestamps: the next /check must be the last allowed.
    const ns = createMockDoNamespace({
      'sequence-user': {
        requests: Array.from({ length: limit - 1 }, (_, i) => now - (limit - i) * 10),
        tier: 'free',
      },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    // This is the 100th request — must be allowed.
    const resAllowed = await postJson('/check', { identifier: 'sequence-user', tier: 'free' }, env);
    const jsonAllowed = (await resAllowed.json()) as { data: { allowed: boolean } };
    expect(jsonAllowed.data.allowed).toBe(true);

    // This is the 101st request — must be denied.
    const resDenied = await postJson('/check', { identifier: 'sequence-user', tier: 'free' }, env);
    const jsonDenied = (await resDenied.json()) as {
      data: { allowed: boolean; remaining: number };
    };
    expect(jsonDenied.data.allowed).toBe(false);
    expect(jsonDenied.data.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /status/:identifier
// ---------------------------------------------------------------------------

describe('GET /status/:identifier', () => {
  it('returns 200 with allowed:true for a fresh identifier', async () => {
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

  it('returns data for pro tier when ?tier=pro is used', async () => {
    const res = await makeRequest('/status/some-user?tier=pro');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { tier: string; limit: number } };
    expect(json.data.tier).toBe('pro');
    expect(json.data.limit).toBe(RATE_LIMIT_CONFIGS.pro.requestsPerHour);
  });

  it('does NOT decrement remaining (read-only endpoint)', async () => {
    const ns = createMockDoNamespace();
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res1 = await makeRequest('/status/read-only-user', {}, env);
    const json1 = (await res1.json()) as { data: { remaining: number } };

    const res2 = await makeRequest('/status/read-only-user', {}, env);
    const json2 = (await res2.json()) as { data: { remaining: number } };

    expect(json2.data.remaining).toBe(json1.data.remaining);
  });

  it('sets X-RateLimit-Limit header', async () => {
    const res = await makeRequest('/status/some-id?tier=free');
    expect(res.headers.get('X-RateLimit-Limit')).toBe(
      RATE_LIMIT_CONFIGS.free.requestsPerHour.toString(),
    );
  });

  it('sets X-RateLimit-Tier header', async () => {
    const res = await makeRequest('/status/some-id?tier=pro');
    expect(res.headers.get('X-RateLimit-Tier')).toBe('pro');
  });

  it('returns 400 INVALID_TIER for an unrecognised tier value', async () => {
    const res = await makeRequest('/status/some-user?tier=platinum');
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_TIER');
  });

  it('reflects existing request count for a known identifier', async () => {
    const now = Date.now();
    const ns = createMockDoNamespace({
      'known-user': {
        requests: Array.from({ length: 5 }, (_, i) => now - i * 1000),
        tier: 'free',
      },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res = await makeRequest('/status/known-user?tier=free', {}, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { remaining: number } };
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
    const json = (await res.json()) as { data: typeof RATE_LIMIT_CONFIGS };

    expect(json.data.free.requestsPerHour).toBe(100);
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
      data: { requestsPerHour: number; recommendedTier: string };
    };
    expect(json.data.requestsPerHour).toBe(50);
    expect(json.data.recommendedTier).toBe('free');
  });

  it('recommends pro tier for 500 requests/hour', async () => {
    const res = await makeRequest('/recommend/500');
    const json = (await res.json()) as { data: { recommendedTier: string } };
    expect(json.data.recommendedTier).toBe('pro');
  });

  it('recommends enterprise tier for 5000 requests/hour', async () => {
    const res = await makeRequest('/recommend/5000');
    const json = (await res.json()) as { data: { recommendedTier: string } };
    expect(json.data.recommendedTier).toBe('enterprise');
  });

  it('includes the config object for the recommended tier', async () => {
    const res = await makeRequest('/recommend/100');
    const json = (await res.json()) as { data: { config: typeof RATE_LIMIT_CONFIGS.free } };
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
// DELETE /reset/:identifier  (admin)
// ---------------------------------------------------------------------------

describe('DELETE /reset/:identifier', () => {
  it('returns 200 and resets the rate limit when correct admin key is provided', async () => {
    const ns = createMockDoNamespace({
      'to-be-reset': { requests: [Date.now()], tier: 'free' },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res = await deleteReq('/reset/to-be-reset', { 'X-Admin-Key': ADMIN_KEY }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; message: string };
    expect(json.success).toBe(true);
    expect(json.message).toContain('to-be-reset');
  });

  it('calls DO stub.reset() on a successful admin reset', async () => {
    const ns = createMockDoNamespace({ 'target-user': {} });
    const env = createTestEnv({ RATE_LIMITER: ns });

    await deleteReq('/reset/target-user', { 'X-Admin-Key': ADMIN_KEY }, env);

    // The stub for target-user should have had reset() called.
    const stub = (ns as unknown as { _stubs: Map<string, DoStub> })._stubs.get('target-user');
    expect(stub?.reset).toHaveBeenCalledTimes(1);
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
// GET /admin/keys  (admin)
// ---------------------------------------------------------------------------

describe('GET /admin/keys', () => {
  it('returns 200 with key count when authenticated', async () => {
    const kv = createMockKV({
      'index:user-a': '1',
      'index:user-b': '1',
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
    const res = await makeRequest('/admin/keys', { headers: { 'X-Admin-Key': 'bad-key' } });
    expect(res.status).toBe(401);
  });

  it('limits returned keys to a maximum of 100', async () => {
    const initial: Record<string, unknown> = {};
    for (let i = 0; i < 150; i++) {
      initial[`index:user-${i}`] = '1';
    }
    const kv = createMockKV(initial);
    const env = createTestEnv({ RATE_LIMITS: kv });

    const res = await makeRequest('/admin/keys', { headers: { 'X-Admin-Key': ADMIN_KEY } }, env);
    const json = (await res.json()) as { data: { keys: string[] } };
    expect(json.data.keys.length).toBeLessThanOrEqual(100);
  });

  it('includes a note explaining the KV index backend', async () => {
    const env = createTestEnv();
    const res = await makeRequest('/admin/keys', { headers: { 'X-Admin-Key': ADMIN_KEY } }, env);
    const json = (await res.json()) as { data: { note: string } };
    expect(typeof json.data.note).toBe('string');
    expect(json.data.note.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rate limit enforcement – integration sequence
// ---------------------------------------------------------------------------

describe('Rate limit enforcement (sequence tests)', () => {
  it('ignores timestamps outside the 1-hour sliding window', async () => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    const ns = createMockDoNamespace({
      'window-user': {
        requests: Array.from({ length: 50 }, (_, i) => now - oneHourMs - (i + 1) * 1000),
        tier: 'free',
      },
    });
    const env = createTestEnv({ RATE_LIMITER: ns });

    const res = await postJson('/check', { identifier: 'window-user', tier: 'free' }, env);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { allowed: boolean; remaining: number } };
    expect(json.data.allowed).toBe(true);
    expect(json.data.remaining).toBe(RATE_LIMIT_CONFIGS.free.requestsPerHour - 1);
  });

  it('enterprise tier always allowed, remaining = MAX_SAFE_INTEGER', async () => {
    const res = await postJson('/check', { identifier: 'enterprise-user', tier: 'enterprise' });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: { allowed: boolean; remaining: number } };
    expect(json.data.allowed).toBe(true);
    expect(json.data.remaining).toBe(Number.MAX_SAFE_INTEGER);
  });
});
