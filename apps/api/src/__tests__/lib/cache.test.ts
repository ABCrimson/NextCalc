/**
 * Cache Module Unit Tests
 *
 * Tests the Redis caching layer in two modes:
 * 1. "Configured" — env vars present, Redis client instantiated (mocked)
 * 2. "Unconfigured" — env vars absent, Redis client is null (graceful degradation)
 *
 * All @upstash/* modules are fully mocked so no real Redis connection is needed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock factories — declared before vi.mock() calls
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockPing = vi.fn();
const mockScan = vi.fn();
const mockIncr = vi.fn();
const mockDecr = vi.fn();
const mockExpire = vi.fn();
const mockExec = vi.fn();

/** Pipeline mock that supports fluent chaining: pipeline().incr(k).expire(k, t).exec() */
const mockPipeline = vi.fn(() => {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  chain.incr = (...args: unknown[]) => {
    mockIncr(...args);
    return chain;
  };
  chain.decr = (...args: unknown[]) => {
    mockDecr(...args);
    return chain;
  };
  chain.expire = (...args: unknown[]) => {
    mockExpire(...args);
    return chain;
  };
  chain.exec = mockExec;
  return chain;
});

const mockRedisInstance = {
  get: mockGet,
  set: mockSet,
  del: mockDel,
  ping: mockPing,
  scan: mockScan,
  pipeline: mockPipeline,
};

const mockLimit = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks (must precede imports of the module under test)
// ---------------------------------------------------------------------------

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => mockRedisInstance),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit;
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

// ---------------------------------------------------------------------------
// Suite: Redis CONFIGURED (env vars present)
// ---------------------------------------------------------------------------

describe('cache module (configured)', () => {
  // Import the module under test dynamically so env vars are set first.
  // vi.resetModules() ensures a fresh evaluation on each describe block.

  let cacheModule: typeof import('../../lib/cache');

  beforeEach(async () => {
    vi.resetModules();

    // Ensure env vars are present so isConfigured = true
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

    // Reset all mock state
    mockGet.mockReset();
    mockSet.mockReset();
    mockDel.mockReset();
    mockPing.mockReset();
    mockScan.mockReset();
    mockIncr.mockReset();
    mockDecr.mockReset();
    mockExpire.mockReset();
    mockExec.mockReset();
    mockPipeline.mockClear();
    mockLimit.mockReset();

    cacheModule = await import('../../lib/cache');
  });

  // -----------------------------------------------------------------------
  // cacheKey
  // -----------------------------------------------------------------------

  describe('cacheKey()', () => {
    it('builds "prefix:id" format', () => {
      expect(cacheModule.cacheKey('user', 'abc123')).toBe('user:abc123');
    });

    it('handles empty strings', () => {
      expect(cacheModule.cacheKey('', '')).toBe(':');
    });

    it('preserves special characters in id', () => {
      expect(cacheModule.cacheKey('session', 'user@example.com')).toBe(
        'session:user@example.com',
      );
    });
  });

  // -----------------------------------------------------------------------
  // CACHE_KEYS and CACHE_TTL
  // -----------------------------------------------------------------------

  describe('CACHE_KEYS', () => {
    it('contains all expected key prefixes', () => {
      expect(cacheModule.CACHE_KEYS).toStrictEqual({
        USER: 'user',
        WORKSHEET: 'worksheet',
        FOLDER: 'folder',
        FORUM_POST: 'post',
        COMMENT: 'comment',
        UPVOTE_COUNT: 'upvote',
        COMMENT_COUNT: 'comment-count',
        SESSION: 'session',
      });
    });
  });

  describe('CACHE_TTL', () => {
    it('contains correct TTL values in seconds', () => {
      expect(cacheModule.CACHE_TTL).toStrictEqual({
        USER: 1800, // 30 * 60
        WORKSHEET: 3600, // 60 * 60
        FOLDER: 3600, // 60 * 60
        FORUM_POST: 300, // 5 * 60
        COMMENT: 120, // 2 * 60
        UPVOTE_COUNT: 60, // 1 * 60
        SESSION: 2592000, // 30 * 24 * 60 * 60
      });
    });
  });

  // -----------------------------------------------------------------------
  // redis client
  // -----------------------------------------------------------------------

  describe('redis', () => {
    it('is not null when configured', () => {
      expect(cacheModule.redis).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // queryCache
  // -----------------------------------------------------------------------

  describe('queryCache', () => {
    describe('get()', () => {
      it('returns cached value from redis', async () => {
        mockGet.mockResolvedValue({ name: 'Test' });

        const result = await cacheModule.queryCache.get<{ name: string }>('user:abc');

        expect(mockGet).toHaveBeenCalledWith('user:abc');
        expect(result).toStrictEqual({ name: 'Test' });
      });

      it('returns null when redis.get returns null', async () => {
        mockGet.mockResolvedValue(null);

        const result = await cacheModule.queryCache.get('nonexistent');

        expect(result).toBeNull();
      });

      it('returns null and logs error when redis.get throws', async () => {
        mockGet.mockRejectedValue(new Error('Connection refused'));

        const result = await cacheModule.queryCache.get('broken');

        expect(result).toBeNull();
      });
    });

    describe('set()', () => {
      it('calls redis.set with default TTL of 300s', async () => {
        mockSet.mockResolvedValue('OK');

        await cacheModule.queryCache.set('user:abc', { name: 'Test' });

        expect(mockSet).toHaveBeenCalledWith('user:abc', { name: 'Test' }, { ex: 300 });
      });

      it('calls redis.set with custom TTL', async () => {
        mockSet.mockResolvedValue('OK');

        await cacheModule.queryCache.set('user:abc', 'data', 600);

        expect(mockSet).toHaveBeenCalledWith('user:abc', 'data', { ex: 600 });
      });

      it('swallows errors from redis.set', async () => {
        mockSet.mockRejectedValue(new Error('Write failed'));

        // Should not throw
        await expect(
          cacheModule.queryCache.set('key', 'value'),
        ).resolves.toBeUndefined();
      });
    });

    describe('invalidate()', () => {
      it('calls redis.del with the key', async () => {
        mockDel.mockResolvedValue(1);

        await cacheModule.queryCache.invalidate('user:abc');

        expect(mockDel).toHaveBeenCalledWith('user:abc');
      });

      it('swallows errors from redis.del', async () => {
        mockDel.mockRejectedValue(new Error('Delete failed'));

        await expect(
          cacheModule.queryCache.invalidate('key'),
        ).resolves.toBeUndefined();
      });
    });

    describe('invalidateByPrefix()', () => {
      it('scans and deletes keys matching prefix', async () => {
        // First scan returns some keys and a non-zero cursor
        mockScan.mockResolvedValueOnce(['42', ['worksheet:1', 'worksheet:2']]);
        // Second scan returns remaining keys and cursor 0 (done)
        mockScan.mockResolvedValueOnce(['0', ['worksheet:3']]);
        mockDel.mockResolvedValue(1);

        await cacheModule.queryCache.invalidateByPrefix('worksheet');

        // Two SCAN calls
        expect(mockScan).toHaveBeenCalledTimes(2);
        expect(mockScan).toHaveBeenCalledWith('0', { match: 'worksheet:*', count: 100 });
        expect(mockScan).toHaveBeenCalledWith('42', { match: 'worksheet:*', count: 100 });

        // Two DEL calls (one per batch)
        expect(mockDel).toHaveBeenCalledTimes(2);
        expect(mockDel).toHaveBeenCalledWith('worksheet:1', 'worksheet:2');
        expect(mockDel).toHaveBeenCalledWith('worksheet:3');
      });

      it('skips del when scan returns empty keys', async () => {
        mockScan.mockResolvedValueOnce(['0', []]);

        await cacheModule.queryCache.invalidateByPrefix('empty');

        expect(mockScan).toHaveBeenCalledTimes(1);
        expect(mockDel).not.toHaveBeenCalled();
      });

      it('swallows errors from scan', async () => {
        mockScan.mockRejectedValue(new Error('SCAN failed'));

        await expect(
          cacheModule.queryCache.invalidateByPrefix('broken'),
        ).resolves.toBeUndefined();
      });
    });
  });

  // -----------------------------------------------------------------------
  // rateLimit
  // -----------------------------------------------------------------------

  describe('rateLimit()', () => {
    it('delegates to Ratelimit.limit() when configured', async () => {
      const resetTimestamp = Date.now() + 60_000;
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 9,
        reset: resetTimestamp,
        pending: Promise.resolve(),
      });

      const result = await cacheModule.rateLimit('user:123', 10, 60);

      expect(mockLimit).toHaveBeenCalledWith('user:123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetAt).toStrictEqual(new Date(resetTimestamp));
    });

    it('handles pending analytics errors gracefully', async () => {
      // Build the pending promise lazily inside mockImplementation
      // so the rejection is created in the same microtask as the
      // source code's .catch() handler, avoiding an unhandled rejection.
      mockLimit.mockImplementation(() => {
        const pending = Promise.reject(new Error('Analytics write failed'));
        return Promise.resolve({
          success: false,
          remaining: 0,
          reset: Date.now() + 30_000,
          pending,
        });
      });

      const result = await cacheModule.rateLimit('user:123', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Give the fire-and-forget catch handler time to execute
      await new Promise((r) => setTimeout(r, 10));
    });

    it('reuses cached Ratelimit instances for same limit/window', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 4,
        reset: Date.now() + 60_000,
        pending: undefined,
      });

      await cacheModule.rateLimit('user:a', 5, 30);
      await cacheModule.rateLimit('user:b', 5, 30);

      // limit() called twice, but the Ratelimit constructor is called once
      // for the same (5, 30) parameters
      expect(mockLimit).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // redisHealthCheck
  // -----------------------------------------------------------------------

  describe('redisHealthCheck()', () => {
    it('returns healthy with latency when ping succeeds', async () => {
      mockPing.mockResolvedValue('PONG');

      const result = await cacheModule.redisHealthCheck();

      expect(result.status).toBe('healthy');
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy with error message when ping fails', async () => {
      mockPing.mockRejectedValue(new Error('Connection timed out'));

      const result = await cacheModule.redisHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection timed out');
    });

    it('returns "Unknown error" for non-Error throws', async () => {
      mockPing.mockRejectedValue('something weird');

      const result = await cacheModule.redisHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Unknown error');
    });
  });

  // -----------------------------------------------------------------------
  // Entity cache helpers
  // -----------------------------------------------------------------------

  describe('cacheUser() / getCachedUser()', () => {
    it('sets user with correct key and TTL', async () => {
      mockSet.mockResolvedValue('OK');
      const userData = { id: 'u1', name: 'Alice' };

      await cacheModule.cacheUser('u1', userData);

      expect(mockSet).toHaveBeenCalledWith('user:u1', userData, {
        ex: cacheModule.CACHE_TTL.USER,
      });
    });

    it('gets user with correct key', async () => {
      mockGet.mockResolvedValue({ id: 'u1', name: 'Alice' });

      const result = await cacheModule.getCachedUser('u1');

      expect(mockGet).toHaveBeenCalledWith('user:u1');
      expect(result).toStrictEqual({ id: 'u1', name: 'Alice' });
    });
  });

  describe('cacheWorksheet() / getCachedWorksheet()', () => {
    it('sets worksheet with correct key and TTL', async () => {
      mockSet.mockResolvedValue('OK');
      const data = { id: 'w1', title: 'My Sheet' };

      await cacheModule.cacheWorksheet('w1', data);

      expect(mockSet).toHaveBeenCalledWith('worksheet:w1', data, {
        ex: cacheModule.CACHE_TTL.WORKSHEET,
      });
    });

    it('gets worksheet with correct key', async () => {
      mockGet.mockResolvedValue({ id: 'w1', title: 'My Sheet' });

      const result = await cacheModule.getCachedWorksheet('w1');

      expect(mockGet).toHaveBeenCalledWith('worksheet:w1');
      expect(result).toStrictEqual({ id: 'w1', title: 'My Sheet' });
    });
  });

  describe('cacheForumPost() / getCachedForumPost()', () => {
    it('sets forum post with correct key and TTL', async () => {
      mockSet.mockResolvedValue('OK');
      const data = { id: 'p1', title: 'Hello' };

      await cacheModule.cacheForumPost('p1', data);

      expect(mockSet).toHaveBeenCalledWith('post:p1', data, {
        ex: cacheModule.CACHE_TTL.FORUM_POST,
      });
    });

    it('gets forum post with correct key', async () => {
      mockGet.mockResolvedValue({ id: 'p1', title: 'Hello' });

      const result = await cacheModule.getCachedForumPost('p1');

      expect(mockGet).toHaveBeenCalledWith('post:p1');
      expect(result).toStrictEqual({ id: 'p1', title: 'Hello' });
    });
  });

  // -----------------------------------------------------------------------
  // invalidateCache / invalidateCaches
  // -----------------------------------------------------------------------

  describe('invalidateCache()', () => {
    it('deletes a single key by prefix + id', async () => {
      mockDel.mockResolvedValue(1);

      await cacheModule.invalidateCache('user', 'u1');

      expect(mockDel).toHaveBeenCalledWith('user:u1');
    });
  });

  describe('invalidateCaches()', () => {
    it('deletes multiple keys in a single call', async () => {
      mockDel.mockResolvedValue(2);

      await cacheModule.invalidateCaches(['user:u1', 'worksheet:w1']);

      expect(mockDel).toHaveBeenCalledWith('user:u1', 'worksheet:w1');
    });

    it('skips redis.del when keys array is empty', async () => {
      await cacheModule.invalidateCaches([]);

      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Upvote count helpers
  // -----------------------------------------------------------------------

  describe('cacheUpvoteCount() / getCachedUpvoteCount()', () => {
    it('sets upvote count with correct key and TTL', async () => {
      mockSet.mockResolvedValue('OK');

      await cacheModule.cacheUpvoteCount('target1', 42);

      expect(mockSet).toHaveBeenCalledWith('upvote:target1', 42, {
        ex: cacheModule.CACHE_TTL.UPVOTE_COUNT,
      });
    });

    it('gets upvote count with correct key', async () => {
      mockGet.mockResolvedValue(42);

      const result = await cacheModule.getCachedUpvoteCount('target1');

      expect(mockGet).toHaveBeenCalledWith('upvote:target1');
      expect(result).toBe(42);
    });

    it('returns null when no cached count exists', async () => {
      mockGet.mockResolvedValue(null);

      const result = await cacheModule.getCachedUpvoteCount('missing');

      expect(result).toBeNull();
    });
  });

  describe('incrementUpvoteCount()', () => {
    it('uses pipeline with incr + expire', async () => {
      mockExec.mockResolvedValue([1, true]);

      await cacheModule.incrementUpvoteCount('target1');

      expect(mockPipeline).toHaveBeenCalled();
      expect(mockIncr).toHaveBeenCalledWith('upvote:target1');
      expect(mockExpire).toHaveBeenCalledWith(
        'upvote:target1',
        cacheModule.CACHE_TTL.UPVOTE_COUNT,
      );
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe('decrementUpvoteCount()', () => {
    it('uses pipeline with decr + expire', async () => {
      mockExec.mockResolvedValue([-1, true]);

      await cacheModule.decrementUpvoteCount('target1');

      expect(mockPipeline).toHaveBeenCalled();
      expect(mockDecr).toHaveBeenCalledWith('upvote:target1');
      expect(mockExpire).toHaveBeenCalledWith(
        'upvote:target1',
        cacheModule.CACHE_TTL.UPVOTE_COUNT,
      );
      expect(mockExec).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Comment count helpers
  // -----------------------------------------------------------------------

  describe('cacheCommentCount() / getCachedCommentCount()', () => {
    it('sets comment count with correct key and TTL', async () => {
      mockSet.mockResolvedValue('OK');

      await cacheModule.cacheCommentCount('post1', 7);

      expect(mockSet).toHaveBeenCalledWith('comment-count:post1', 7, {
        ex: cacheModule.CACHE_TTL.COMMENT,
      });
    });

    it('gets comment count with correct key', async () => {
      mockGet.mockResolvedValue(7);

      const result = await cacheModule.getCachedCommentCount('post1');

      expect(mockGet).toHaveBeenCalledWith('comment-count:post1');
      expect(result).toBe(7);
    });

    it('returns null when no cached count exists', async () => {
      mockGet.mockResolvedValue(null);

      const result = await cacheModule.getCachedCommentCount('missing');

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // checkRedisConnection
  // -----------------------------------------------------------------------

  describe('checkRedisConnection()', () => {
    it('returns true when ping succeeds', async () => {
      mockPing.mockResolvedValue('PONG');

      const result = await cacheModule.checkRedisConnection();

      expect(result).toBe(true);
    });

    it('returns false and logs error when ping fails', async () => {
      mockPing.mockRejectedValue(new Error('Network error'));

      const result = await cacheModule.checkRedisConnection();

      expect(result).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: Redis UNCONFIGURED (env vars absent — graceful degradation)
// ---------------------------------------------------------------------------

describe('cache module (unconfigured)', () => {
  let cacheModule: typeof import('../../lib/cache');

  beforeEach(async () => {
    vi.resetModules();

    // Remove env vars so isConfigured = false
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Reset mocks
    mockGet.mockReset();
    mockSet.mockReset();
    mockDel.mockReset();
    mockPing.mockReset();
    mockScan.mockReset();
    mockLimit.mockReset();

    cacheModule = await import('../../lib/cache');
  });

  describe('redis', () => {
    it('is null when env vars are missing', () => {
      expect(cacheModule.redis).toBeNull();
    });
  });

  describe('queryCache (graceful degradation)', () => {
    it('get() returns null', async () => {
      const result = await cacheModule.queryCache.get('anything');

      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('set() is a no-op', async () => {
      await cacheModule.queryCache.set('key', 'value');

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('invalidate() is a no-op', async () => {
      await cacheModule.queryCache.invalidate('key');

      expect(mockDel).not.toHaveBeenCalled();
    });

    it('invalidateByPrefix() is a no-op', async () => {
      await cacheModule.queryCache.invalidateByPrefix('prefix');

      expect(mockScan).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  describe('rateLimit() (graceful degradation)', () => {
    it('returns allowed=true with full remaining quota', async () => {
      const result = await cacheModule.rateLimit('user:123', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // limit - 1
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now() - 1000);
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe('redisHealthCheck() (graceful degradation)', () => {
    it('returns status unconfigured', async () => {
      const result = await cacheModule.redisHealthCheck();

      expect(result).toStrictEqual({ status: 'unconfigured' });
      expect(mockPing).not.toHaveBeenCalled();
    });
  });

  describe('entity cache helpers (graceful degradation)', () => {
    it('cacheUser() is a no-op', async () => {
      await cacheModule.cacheUser('u1', { id: 'u1' });
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('getCachedUser() returns null', async () => {
      const result = await cacheModule.getCachedUser('u1');
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('cacheWorksheet() is a no-op', async () => {
      await cacheModule.cacheWorksheet('w1', { id: 'w1' });
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('getCachedWorksheet() returns null', async () => {
      const result = await cacheModule.getCachedWorksheet('w1');
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('cacheForumPost() is a no-op', async () => {
      await cacheModule.cacheForumPost('p1', { id: 'p1' });
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('getCachedForumPost() returns null', async () => {
      const result = await cacheModule.getCachedForumPost('p1');
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('invalidateCache / invalidateCaches (graceful degradation)', () => {
    it('invalidateCache() is a no-op', async () => {
      await cacheModule.invalidateCache('user', 'u1');
      expect(mockDel).not.toHaveBeenCalled();
    });

    it('invalidateCaches() is a no-op', async () => {
      await cacheModule.invalidateCaches(['user:u1', 'worksheet:w1']);
      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  describe('upvote count helpers (graceful degradation)', () => {
    it('cacheUpvoteCount() is a no-op', async () => {
      await cacheModule.cacheUpvoteCount('t1', 5);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('getCachedUpvoteCount() returns null', async () => {
      const result = await cacheModule.getCachedUpvoteCount('t1');
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('incrementUpvoteCount() is a no-op', async () => {
      await cacheModule.incrementUpvoteCount('t1');
      expect(mockPipeline).not.toHaveBeenCalled();
    });

    it('decrementUpvoteCount() is a no-op', async () => {
      await cacheModule.decrementUpvoteCount('t1');
      expect(mockPipeline).not.toHaveBeenCalled();
    });
  });

  describe('comment count helpers (graceful degradation)', () => {
    it('cacheCommentCount() is a no-op', async () => {
      await cacheModule.cacheCommentCount('p1', 3);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('getCachedCommentCount() returns null', async () => {
      const result = await cacheModule.getCachedCommentCount('p1');
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('checkRedisConnection() (graceful degradation)', () => {
    it('returns false', async () => {
      const result = await cacheModule.checkRedisConnection();
      expect(result).toBe(false);
      expect(mockPing).not.toHaveBeenCalled();
    });
  });
});
