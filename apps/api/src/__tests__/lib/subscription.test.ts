/**
 * Hybrid PubSub Unit Tests
 *
 * Verifies the actual cross-instance delivery mechanism that replaced the
 * previously-dead "publish to a Redis Stream that nothing ever reads" code:
 * - hybridPublish always delivers locally (same-instance, via localPubSub)
 * - hybridPublish also XADDs to a Redis Stream, tagged with this process's
 *   instance ID, when Upstash is configured
 * - hybridPublish degrades to local-only delivery when Redis is unavailable
 * - pubsub.asyncIterableIterator merges local (push) delivery with a
 *   periodic XRANGE poll for cross-instance events
 * - stream entries tagged with this process's own instance ID are skipped
 *   during polling (already delivered locally — prevents duplicate delivery)
 * - the poll timer and local subscriptions are torn down on `.return()`
 *
 * All @upstash/* modules are mocked so no real Redis connection is needed —
 * pattern matches src/__tests__/lib/cache.test.ts (configured/unconfigured
 * suites via vi.resetModules() + dynamic import).
 *
 * IMPORTANT — mocks encode the REAL client contract: cache.ts constructs the
 * Upstash client with automaticDeserialization: true, so XADD serializes
 * non-string field values via JSON.stringify and XRANGE/XREVRANGE results
 * arrive with every field value already JSON.parsed (strings that aren't
 * valid JSON fall back to the raw string). Mocks that resolved
 * `payload: JSON.stringify(...)` previously masked a double-parse bug that
 * dropped every cross-instance event.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockXadd = vi.fn();
const mockXrange = vi.fn();
const mockXrevrange = vi.fn();

const mockRedisInstance = {
  xadd: mockXadd,
  xrange: mockXrange,
  xrevrange: mockXrevrange,
};

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => mockRedisInstance),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = vi.fn();
    static slidingWindow = vi.fn((limit: number, window: string) => ({
      type: 'slidingWindow',
      limit,
      window,
    }));
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

afterEach(() => {
  // Safety net in case a test forgets to restore real timers.
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Suite: Redis CONFIGURED — hybrid local + Redis Stream delivery
// ---------------------------------------------------------------------------

describe('hybrid subscription pubsub (Redis configured)', () => {
  let subscriptionModule: typeof import('../../lib/subscription');

  beforeEach(async () => {
    vi.resetModules();

    process.env['UPSTASH_REDIS_REST_URL'] = 'https://fake-redis.upstash.io';
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'fake-token';

    mockXadd.mockReset().mockResolvedValue('1700000000000-0');
    mockXrange.mockReset().mockResolvedValue({});
    // Empty stream by default — the lazy cursor init resolves to '0'.
    mockXrevrange.mockReset().mockResolvedValue({});

    subscriptionModule = await import('../../lib/subscription');
  });

  it('publish() delivers to local subscribers immediately', async () => {
    const { pubsub } = subscriptionModule;
    const received: unknown[] = [];
    const subId = await pubsub.subscribe('TEST_EVENT', (payload: unknown) =>
      received.push(payload),
    );

    await pubsub.publish('TEST_EVENT', { hello: 'world' });

    expect(received).toEqual([{ hello: 'world' }]);
    pubsub.unsubscribe(subId);
  });

  it('publish() XADDs to the Redis Stream tagged with an instanceId', async () => {
    const { pubsub } = subscriptionModule;

    await pubsub.publish('WORKSHEET_UPDATED', { worksheetId: 'ws1' });

    // The payload object is passed as-is — the Upstash client's own
    // serializer JSON.stringifies non-string field values on XADD.
    expect(mockXadd).toHaveBeenCalledWith(
      '@nextcalc/pubsub:WORKSHEET_UPDATED',
      '*',
      expect.objectContaining({
        payload: { worksheetId: 'ws1' },
        instanceId: expect.any(String),
      }),
      expect.objectContaining({ trim: expect.any(Object) }),
    );
  });

  it('merged async iterator delivers local publishes without waiting for a poll', async () => {
    const { pubsub } = subscriptionModule;
    const iterator = pubsub.asyncIterableIterator<{ n: number }>('LOCAL_ONLY_EVENT');

    const nextPromise = iterator.next();
    await pubsub.publish('LOCAL_ONLY_EVENT', { n: 1 });

    await expect(nextPromise).resolves.toEqual({ value: { n: 1 }, done: false });

    await iterator.return?.();
  });

  it('delivers cross-instance payloads that arrive as already-deserialized objects', async () => {
    // Regression guard for the double-parse bug: the real client
    // (automaticDeserialization) hands back `payload` as a parsed OBJECT.
    // JSON.parse-ing it again threw and silently dropped every
    // cross-instance event.
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;

    // An entry published by a DIFFERENT instance should be delivered.
    mockXrange.mockResolvedValueOnce({
      '1700000000000-0': {
        payload: { from: 'other-instance' },
        instanceId: 'some-other-instance-id',
      },
    });

    const iterator = pubsub.asyncIterableIterator<{ from: string }>('CROSS_INSTANCE_EVENT');
    const nextPromise = iterator.next();

    await vi.advanceTimersByTimeAsync(2000);

    await expect(nextPromise).resolves.toEqual({
      value: { from: 'other-instance' },
      done: false,
    });

    await iterator.return?.();
    vi.useRealTimers();
  });

  it('initializes the cursor lazily from the stream tip (XREVRANGE) without delivering old entries', async () => {
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;

    // A pre-existing entry from another instance — published BEFORE this
    // subscription existed, so it must only anchor the cursor, never be
    // delivered.
    mockXrevrange.mockResolvedValueOnce({
      '1700000000123-7': {
        payload: { stale: true },
        instanceId: 'some-other-instance-id',
      },
    });

    const iterator = pubsub.asyncIterableIterator<unknown>('LAZY_CURSOR_EVENT');
    let delivered: IteratorResult<unknown> | undefined;
    const nextPromise = iterator.next().then((r) => {
      delivered = r;
    });

    await vi.advanceTimersByTimeAsync(2000);

    // Cursor init reads the current tip (COUNT 1, newest first)...
    expect(mockXrevrange).toHaveBeenCalledWith('@nextcalc/pubsub:LAZY_CURSOR_EVENT', '+', '-', 1);
    // ...the pre-subscribe entry is NOT delivered...
    expect(delivered).toBeUndefined();
    // ...and the first real poll resumes exclusively after the tip ID.
    expect(mockXrange).toHaveBeenCalledWith(
      '@nextcalc/pubsub:LAZY_CURSOR_EVENT',
      '(1700000000123-7',
      '+',
    );

    await iterator.return?.();
    await nextPromise;
    vi.useRealTimers();
  });

  it('does not overlap polls when an XRANGE round-trip exceeds the poll interval', async () => {
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;

    // First XRANGE stalls for 3s (longer than the 2s poll interval). A
    // setInterval-based poller would fire again mid-flight and re-read the
    // same cursor (duplicate delivery); the self-scheduling loop must not.
    mockXrange.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({}), 3000)),
    );

    const iterator = pubsub.asyncIterableIterator<unknown>('SLOW_POLL_EVENT');

    // t=2000: first XRANGE starts (its response lands at t=5000).
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockXrange).toHaveBeenCalledTimes(1);

    // t=4500: setInterval would have ticked again at t=4000 — no new call.
    await vi.advanceTimersByTimeAsync(2500);
    expect(mockXrange).toHaveBeenCalledTimes(1);

    // t=7000: the slow poll settled at t=5000 and rescheduled for t=7000.
    await vi.advanceTimersByTimeAsync(2500);
    expect(mockXrange).toHaveBeenCalledTimes(2);

    await iterator.return?.();
    vi.useRealTimers();
  });

  it("skips stream entries tagged with this process's own instance ID", async () => {
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;

    // Publish once to learn this process's own instanceId.
    await pubsub.publish('SELF_TAGGED_EVENT', { n: 1 });
    const [, , fields] = mockXadd.mock.calls[0] as [string, string, { instanceId: string }];
    const ownInstanceId = fields.instanceId;

    mockXrange.mockResolvedValueOnce({
      '1700000000001-0': {
        payload: { n: 999 },
        instanceId: ownInstanceId, // same instance — already delivered locally
      },
    });

    const iterator = pubsub.asyncIterableIterator<{ n: number }>('SELF_TAGGED_EVENT');
    let delivered: IteratorResult<{ n: number }> | undefined;
    const nextPromise = iterator.next().then((r) => {
      delivered = r;
    });

    await vi.advanceTimersByTimeAsync(2000);

    // Nothing should have arrived from the poll — the own-instance entry
    // was skipped, so the iterator is still waiting.
    expect(delivered).toBeUndefined();

    await iterator.return?.();
    await nextPromise;
    vi.useRealTimers();
  });

  it('.return() stops the poll timer (no further XRANGE calls after disposal)', async () => {
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;
    const iterator = pubsub.asyncIterableIterator<unknown>('DISPOSABLE_EVENT');

    await vi.advanceTimersByTimeAsync(2000);
    const callsBeforeDispose = mockXrange.mock.calls.length;
    expect(callsBeforeDispose).toBeGreaterThan(0);

    await iterator.return?.();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockXrange.mock.calls.length).toBe(callsBeforeDispose);
    vi.useRealTimers();
  });

  it('delivers non-JSON string payloads as-is (client deserializer fallback)', async () => {
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;

    // Field values that aren't valid JSON pass through the client's
    // deserializer as raw strings — deliver them untouched, exactly as a
    // local subscriber would have received the original published value.
    mockXrange.mockResolvedValueOnce({
      '1700000000002-0': {
        payload: 'plain string payload',
        instanceId: 'some-other-instance-id',
      },
    });

    const iterator = pubsub.asyncIterableIterator<unknown>('STRING_PAYLOAD_EVENT');
    const nextPromise = iterator.next();

    await vi.advanceTimersByTimeAsync(2000);

    await expect(nextPromise).resolves.toEqual({
      value: 'plain string payload',
      done: false,
    });

    await iterator.return?.();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Suite: Redis UNCONFIGURED — local-only delivery, no polling
// ---------------------------------------------------------------------------

describe('hybrid subscription pubsub (Redis unconfigured)', () => {
  let subscriptionModule: typeof import('../../lib/subscription');

  beforeEach(async () => {
    vi.resetModules();

    delete process.env['UPSTASH_REDIS_REST_URL'];
    delete process.env['UPSTASH_REDIS_REST_TOKEN'];

    mockXadd.mockReset();
    mockXrange.mockReset();
    mockXrevrange.mockReset();

    subscriptionModule = await import('../../lib/subscription');
  });

  it('publish() delivers locally without touching Redis', async () => {
    const { pubsub } = subscriptionModule;
    const received: unknown[] = [];
    const subId = await pubsub.subscribe('LOCAL_ONLY', (payload: unknown) =>
      received.push(payload),
    );

    await pubsub.publish('LOCAL_ONLY', { ok: true });

    expect(received).toEqual([{ ok: true }]);
    expect(mockXadd).not.toHaveBeenCalled();
    pubsub.unsubscribe(subId);
  });

  it('asyncIterableIterator never polls Redis when unconfigured', async () => {
    vi.useFakeTimers();
    const { pubsub } = subscriptionModule;
    const iterator = pubsub.asyncIterableIterator<unknown>('NO_REDIS_EVENT');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockXrevrange).not.toHaveBeenCalled();
    expect(mockXrange).not.toHaveBeenCalled();

    await iterator.return?.();
    vi.useRealTimers();
  });
});
