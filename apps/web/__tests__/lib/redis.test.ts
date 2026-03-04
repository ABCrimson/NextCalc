import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @upstash/redis before importing the module
const mockPipeline = {
  set: vi.fn().mockReturnThis(),
  zremrangebyscore: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  mget: vi.fn().mockResolvedValue([]),
  mset: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
  pipeline: vi.fn(() => mockPipeline),
};

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => mockRedis),
  },
}));

describe('redis module (configured)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports redis client when configured', async () => {
    const mod = await import('@/lib/redis');
    expect(mod.redis).not.toBeNull();
  });

  describe('cacheSet', () => {
    it('sets value with default TTL', async () => {
      const { cacheSet } = await import('@/lib/redis');
      const result = await cacheSet('key', 'value');
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value', { ex: 300 });
    });

    it('sets value with custom TTL', async () => {
      const { cacheSet } = await import('@/lib/redis');
      await cacheSet('key', 'value', 600);
      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value', { ex: 600 });
    });

    it('returns false on error', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('fail'));
      const { cacheSet } = await import('@/lib/redis');
      const result = await cacheSet('key', 'value');
      expect(result).toBe(false);
    });
  });

  describe('cacheGet', () => {
    it('returns cached value', async () => {
      mockRedis.get.mockResolvedValueOnce('cached');
      const { cacheGet } = await import('@/lib/redis');
      const result = await cacheGet('key');
      expect(result).toBe('cached');
    });

    it('returns null on miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const { cacheGet } = await import('@/lib/redis');
      const result = await cacheGet('key');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('fail'));
      const { cacheGet } = await import('@/lib/redis');
      const result = await cacheGet('key');
      expect(result).toBeNull();
    });
  });

  describe('cacheDel', () => {
    it('deletes keys', async () => {
      mockRedis.del.mockResolvedValueOnce(2);
      const { cacheDel } = await import('@/lib/redis');
      const result = await cacheDel('a', 'b');
      expect(result).toBe(2);
    });

    it('returns 0 for empty keys', async () => {
      const { cacheDel } = await import('@/lib/redis');
      const result = await cacheDel();
      expect(result).toBe(0);
    });

    it('returns 0 on error', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('fail'));
      const { cacheDel } = await import('@/lib/redis');
      const result = await cacheDel('key');
      expect(result).toBe(0);
    });
  });

  describe('cacheGetMany', () => {
    it('returns values from mget', async () => {
      mockRedis.mget.mockResolvedValueOnce(['a', null, 'c']);
      const { cacheGetMany } = await import('@/lib/redis');
      const result = await cacheGetMany('k1', 'k2', 'k3');
      expect(result).toEqual(['a', null, 'c']);
    });

    it('returns nulls for empty keys', async () => {
      const { cacheGetMany } = await import('@/lib/redis');
      const result = await cacheGetMany();
      expect(result).toEqual([]);
    });

    it('returns nulls on error', async () => {
      mockRedis.mget.mockRejectedValueOnce(new Error('fail'));
      const { cacheGetMany } = await import('@/lib/redis');
      const result = await cacheGetMany('k1', 'k2');
      expect(result).toEqual([null, null]);
    });
  });

  describe('cacheSetMany', () => {
    it('uses mset without TTL', async () => {
      const { cacheSetMany } = await import('@/lib/redis');
      const result = await cacheSetMany({ a: 1, b: 2 });
      expect(result).toBe(true);
      expect(mockRedis.mset).toHaveBeenCalledWith({ a: 1, b: 2 });
    });

    it('uses pipeline with TTL', async () => {
      const { cacheSetMany } = await import('@/lib/redis');
      const result = await cacheSetMany({ a: 1 }, 60);
      expect(result).toBe(true);
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.set).toHaveBeenCalledWith('a', 1, { ex: 60 });
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      mockRedis.mset.mockRejectedValueOnce(new Error('fail'));
      const { cacheSetMany } = await import('@/lib/redis');
      const result = await cacheSetMany({ a: 1 });
      expect(result).toBe(false);
    });
  });

  describe('cacheGetOrSet', () => {
    it('returns cached value when present', async () => {
      mockRedis.get.mockResolvedValueOnce('cached');
      const { cacheGetOrSet } = await import('@/lib/redis');
      const fallback = vi.fn().mockResolvedValue('fresh');
      const result = await cacheGetOrSet('key', fallback);
      expect(result).toBe('cached');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('calls fallback on cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const { cacheGetOrSet } = await import('@/lib/redis');
      const fallback = vi.fn().mockResolvedValue('fresh');
      const result = await cacheGetOrSet('key', fallback);
      expect(result).toBe('fresh');
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe('rateLimit', () => {
    it('allows request under limit', async () => {
      mockPipeline.exec.mockResolvedValueOnce([0, 3, 1, 1]);
      const { rateLimit } = await import('@/lib/redis');
      const result = await rateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(6);
    });

    it('denies request at limit', async () => {
      mockPipeline.exec.mockResolvedValueOnce([0, 10, 1, 1]);
      const { rateLimit } = await import('@/lib/redis');
      const result = await rateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('fails open on error', async () => {
      mockPipeline.exec.mockRejectedValueOnce(new Error('fail'));
      const { rateLimit } = await import('@/lib/redis');
      const result = await rateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(true);
    });
  });

  describe('isRedisAvailable', () => {
    it('returns true when ping succeeds', async () => {
      const { isRedisAvailable } = await import('@/lib/redis');
      const result = await isRedisAvailable();
      expect(result).toBe(true);
    });

    it('returns false when ping fails', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('down'));
      const { isRedisAvailable } = await import('@/lib/redis');
      const result = await isRedisAvailable();
      expect(result).toBe(false);
    });
  });

  describe('redisHealthCheck', () => {
    it('returns healthy with latency', async () => {
      const { redisHealthCheck } = await import('@/lib/redis');
      const result = await redisHealthCheck();
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeTypeOf('number');
    });

    it('returns unhealthy on error', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('timeout'));
      const { redisHealthCheck } = await import('@/lib/redis');
      const result = await redisHealthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('timeout');
    });
  });

  describe('sessionCache', () => {
    it('sets session with token key', async () => {
      const { sessionCache } = await import('@/lib/redis');
      await sessionCache.set('tok-123', { user: 'test' });
      expect(mockRedis.set).toHaveBeenCalledWith('session:tok-123', { user: 'test' }, { ex: 1800 });
    });

    it('gets session by token', async () => {
      mockRedis.get.mockResolvedValueOnce({ user: 'test' });
      const { sessionCache } = await import('@/lib/redis');
      const result = await sessionCache.get('tok-123');
      expect(result).toEqual({ user: 'test' });
    });

    it('deletes session by token', async () => {
      const { sessionCache } = await import('@/lib/redis');
      await sessionCache.delete('tok-123');
      expect(mockRedis.del).toHaveBeenCalledWith('session:tok-123');
    });
  });

  describe('queryCache', () => {
    it('generates deterministic keys', async () => {
      const { queryCache } = await import('@/lib/redis');
      const key1 = queryCache.key('getUser', { id: '1' });
      const key2 = queryCache.key('getUser', { id: '1' });
      expect(key1).toBe(key2);
      expect(key1).toContain('query:getUser:');
    });

    it('generates different keys for different variables', async () => {
      const { queryCache } = await import('@/lib/redis');
      const key1 = queryCache.key('getUser', { id: '1' });
      const key2 = queryCache.key('getUser', { id: '2' });
      expect(key1).not.toBe(key2);
    });

    it('sets and gets cached queries', async () => {
      mockRedis.get.mockResolvedValueOnce({ data: 'result' });
      const { queryCache } = await import('@/lib/redis');
      await queryCache.set('getUser', { id: '1' }, { data: 'result' });
      const result = await queryCache.get('getUser', { id: '1' });
      expect(result).toEqual({ data: 'result' });
    });

    it('invalidates cached query', async () => {
      const { queryCache } = await import('@/lib/redis');
      await queryCache.invalidate('getUser', { id: '1' });
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});

describe('redis module (unconfigured)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports null redis when not configured', async () => {
    const mod = await import('@/lib/redis');
    expect(mod.redis).toBeNull();
  });

  it('cacheSet returns false', async () => {
    const { cacheSet } = await import('@/lib/redis');
    expect(await cacheSet('key', 'val')).toBe(false);
  });

  it('cacheGet returns null', async () => {
    const { cacheGet } = await import('@/lib/redis');
    expect(await cacheGet('key')).toBeNull();
  });

  it('cacheDel returns 0', async () => {
    const { cacheDel } = await import('@/lib/redis');
    expect(await cacheDel('key')).toBe(0);
  });

  it('rateLimit allows all requests', async () => {
    const { rateLimit } = await import('@/lib/redis');
    const result = await rateLimit('user:1', 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('isRedisAvailable returns false', async () => {
    const { isRedisAvailable } = await import('@/lib/redis');
    expect(await isRedisAvailable()).toBe(false);
  });

  it('redisHealthCheck returns unconfigured', async () => {
    const { redisHealthCheck } = await import('@/lib/redis');
    const result = await redisHealthCheck();
    expect(result.status).toBe('unconfigured');
  });
});
