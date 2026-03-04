import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BufferPool } from '../../utils/buffer-pool';
import type { PooledBuffer } from '../../utils/buffer-pool';

/**
 * Creates a mock WebGL2RenderingContext with the methods used by BufferPool.
 * Each call to createBuffer() returns a unique object so identity checks work.
 */
function createMockGL() {
  let bufferId = 0;
  return {
    createBuffer: vi.fn(() => ({ __id: ++bufferId })),
    deleteBuffer: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

describe('BufferPool', () => {
  let gl: WebGL2RenderingContext;

  beforeEach(() => {
    gl = createMockGL();
  });

  // ── Construction ──────────────────────────────────────────────────

  it('should construct with default parameters', () => {
    const pool = new BufferPool(gl);
    const stats = pool.getStats();
    expect(stats.total).toBe(0);
    expect(stats.inUse).toBe(0);
    expect(stats.available).toBe(0);
  });

  it('should construct with custom maxPoolSize and maxBufferAge', () => {
    const pool = new BufferPool(gl, 8, 5000);
    // Pool is empty at construction time regardless of limits
    expect(pool.getStats().total).toBe(0);
  });

  // ── Acquire ───────────────────────────────────────────────────────

  it('should create a new buffer when pool is empty', () => {
    const pool = new BufferPool(gl);
    const buf = pool.acquire(1024);

    expect(buf).toBeDefined();
    expect(buf.inUse).toBe(true);
    expect(buf.size).toBe(1024);
    expect(gl.createBuffer).toHaveBeenCalledTimes(1);
    expect(pool.getStats()).toEqual({ total: 1, inUse: 1, available: 0 });
  });

  it('should reuse an available buffer that is large enough', () => {
    const pool = new BufferPool(gl);
    const buf1 = pool.acquire(2048);
    pool.release(buf1);

    // Requesting a smaller-or-equal size should reuse buf1
    const buf2 = pool.acquire(1024);
    expect(buf2.buffer).toBe(buf1.buffer);
    expect(buf2.inUse).toBe(true);
    // Only one createBuffer call total — reused existing
    expect(gl.createBuffer).toHaveBeenCalledTimes(1);
  });

  it('should NOT reuse a buffer that is too small', () => {
    const pool = new BufferPool(gl);
    const buf1 = pool.acquire(512);
    pool.release(buf1);

    const buf2 = pool.acquire(1024);
    expect(buf2.buffer).not.toBe(buf1.buffer);
    expect(gl.createBuffer).toHaveBeenCalledTimes(2);
    expect(pool.getStats().total).toBe(2);
  });

  it('should create buffers up to maxPoolSize', () => {
    const pool = new BufferPool(gl, 3);
    const bufs: PooledBuffer[] = [];
    for (let i = 0; i < 3; i++) {
      bufs.push(pool.acquire(256));
    }
    expect(pool.getStats().total).toBe(3);
    expect(gl.createBuffer).toHaveBeenCalledTimes(3);
  });

  it('should reuse oldest available buffer when pool is full and no buffer is large enough', () => {
    const pool = new BufferPool(gl, 2);
    const buf1 = pool.acquire(64);
    const buf2 = pool.acquire(128);

    // Release both so they are available
    pool.release(buf1);
    pool.release(buf2);

    // Pool is full (2/2). Requesting 256 — neither buf (64 or 128) is >= 256,
    // so the find-available path fails and we fall through to the
    // "pool full, reuse oldest" code path, which picks buf1 (oldest).
    const buf3 = pool.acquire(256);
    expect(buf3.buffer).toBe(buf1.buffer);
    expect(buf3.inUse).toBe(true);
    // Size should be updated to the requested size in the reuse-oldest path
    expect(buf3.size).toBe(256);
  });

  it('should create a temporary (non-pooled) buffer when pool is full and all in use', () => {
    const pool = new BufferPool(gl, 2);
    pool.acquire(128);
    pool.acquire(256);

    // All buffers in use, pool full — a temporary buffer is created
    const temp = pool.acquire(512);
    expect(temp).toBeDefined();
    expect(temp.inUse).toBe(true);
    // The temporary buffer is NOT tracked in the pool
    expect(pool.getStats().total).toBe(2);
    expect(gl.createBuffer).toHaveBeenCalledTimes(3);
  });

  it('should throw when createBuffer returns null', () => {
    const badGL = {
      createBuffer: vi.fn(() => null),
      deleteBuffer: vi.fn(),
    } as unknown as WebGL2RenderingContext;

    const pool = new BufferPool(badGL);
    expect(() => pool.acquire(256)).toThrow('Failed to create WebGL buffer');
  });

  it('should throw for temporary buffer when createBuffer returns null', () => {
    let callCount = 0;
    const mixedGL = {
      createBuffer: vi.fn(() => {
        callCount++;
        // First two succeed, third fails
        if (callCount <= 2) return { __id: callCount };
        return null;
      }),
      deleteBuffer: vi.fn(),
    } as unknown as WebGL2RenderingContext;

    const pool = new BufferPool(mixedGL, 2);
    pool.acquire(128);
    pool.acquire(256);

    // Now pool is full with all in use — tries to create temp buffer, gets null
    expect(() => pool.acquire(512)).toThrow('Failed to create WebGL buffer');
  });

  // ── Release ───────────────────────────────────────────────────────

  it('should mark a pooled buffer as not in use on release', () => {
    const pool = new BufferPool(gl);
    const buf = pool.acquire(512);
    expect(buf.inUse).toBe(true);

    pool.release(buf);
    expect(buf.inUse).toBe(false);
    expect(pool.getStats()).toEqual({ total: 1, inUse: 0, available: 1 });
  });

  it('should delete a temporary (non-pooled) buffer on release', () => {
    const pool = new BufferPool(gl, 1);
    pool.acquire(128); // fills pool

    // All in use, creates temporary buffer
    const temp = pool.acquire(256);
    pool.release(temp);

    // temp was not in the pool array, so it should be deleted
    expect(gl.deleteBuffer).toHaveBeenCalledWith(temp.buffer);
  });

  // ── Cleanup ───────────────────────────────────────────────────────

  it('should clean up old unused buffers beyond maxBufferAge', () => {
    const pool = new BufferPool(gl, 32, 1000); // 1s max age
    const buf = pool.acquire(256);
    pool.release(buf);

    // Simulate passage of time by adjusting lastUsed
    // We need to access the internal state — we'll use getStats to verify
    // Fast-forward time
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);

    pool.cleanup();
    expect(gl.deleteBuffer).toHaveBeenCalledWith(buf.buffer);
    expect(pool.getStats().total).toBe(0);
  });

  it('should NOT clean up buffers that are still in use', () => {
    const pool = new BufferPool(gl, 32, 1000);
    const buf = pool.acquire(256);
    // Do NOT release — it is still in use

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    pool.cleanup();

    expect(gl.deleteBuffer).not.toHaveBeenCalled();
    expect(pool.getStats().total).toBe(1);
  });

  it('should NOT clean up buffers that are recently used', () => {
    const pool = new BufferPool(gl, 32, 5000);
    const buf = pool.acquire(256);
    pool.release(buf);

    // Only 100 ms has passed, within the 5000 ms max age
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 100);
    pool.cleanup();

    expect(gl.deleteBuffer).not.toHaveBeenCalled();
    expect(pool.getStats().total).toBe(1);
  });

  it('should clean up multiple old buffers in one pass', () => {
    const pool = new BufferPool(gl, 32, 500);
    const bufs: PooledBuffer[] = [];
    for (let i = 0; i < 5; i++) {
      bufs.push(pool.acquire(64));
    }
    for (const b of bufs) {
      pool.release(b);
    }

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
    pool.cleanup();

    expect(gl.deleteBuffer).toHaveBeenCalledTimes(5);
    expect(pool.getStats().total).toBe(0);
  });

  // ── Dispose ───────────────────────────────────────────────────────

  it('should dispose all buffers', () => {
    const pool = new BufferPool(gl);
    pool.acquire(128);
    pool.acquire(256);
    pool.acquire(512);

    pool.dispose();
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(3);
    expect(pool.getStats().total).toBe(0);
  });

  it('should dispose via Symbol.dispose', () => {
    const pool = new BufferPool(gl);
    pool.acquire(128);
    pool.acquire(256);

    pool[Symbol.dispose]();
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(2);
    expect(pool.getStats().total).toBe(0);
  });

  // ── getStats ──────────────────────────────────────────────────────

  it('should report correct stats with mixed in-use and available buffers', () => {
    const pool = new BufferPool(gl);
    const buf1 = pool.acquire(128);
    pool.acquire(256);
    const buf3 = pool.acquire(512);

    pool.release(buf1);
    pool.release(buf3);

    expect(pool.getStats()).toEqual({ total: 3, inUse: 1, available: 2 });
  });

  it('should report zero stats after dispose', () => {
    const pool = new BufferPool(gl);
    pool.acquire(128);
    pool.dispose();
    expect(pool.getStats()).toEqual({ total: 0, inUse: 0, available: 0 });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('should handle acquire-release-acquire cycle', () => {
    const pool = new BufferPool(gl);
    const buf = pool.acquire(1024);
    pool.release(buf);
    const buf2 = pool.acquire(512);

    // Should reuse (1024 >= 512)
    expect(buf2.buffer).toBe(buf.buffer);
    expect(pool.getStats().total).toBe(1);
  });

  it('should handle maxPoolSize of 1', () => {
    const pool = new BufferPool(gl, 1);
    const buf1 = pool.acquire(256);
    pool.release(buf1);

    const buf2 = pool.acquire(128);
    expect(buf2.buffer).toBe(buf1.buffer);
    expect(pool.getStats().total).toBe(1);
  });
});
