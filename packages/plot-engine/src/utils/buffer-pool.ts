/**
 * Buffer pool for efficient GPU memory management
 * Reuses WebGL buffers to avoid frequent allocation/deallocation
 * @module utils/buffer-pool
 */

export interface PooledBuffer {
  buffer: WebGLBuffer;
  size: number;
  inUse: boolean;
  lastUsed: number;
}

export class BufferPool {
  private gl: WebGL2RenderingContext;
  private buffers: PooledBuffer[] = [];
  private maxPoolSize: number;
  private maxBufferAge: number;

  /**
   * Creates a new buffer pool
   * @param gl WebGL2 rendering context
   * @param maxPoolSize Maximum number of buffers to keep in pool (default: 32)
   * @param maxBufferAge Maximum age of unused buffers in ms (default: 30000)
   */
  constructor(gl: WebGL2RenderingContext, maxPoolSize = 32, maxBufferAge = 30000) {
    this.gl = gl;
    this.maxPoolSize = maxPoolSize;
    this.maxBufferAge = maxBufferAge;
  }

  /**
   * Acquires a buffer from the pool or creates a new one
   * @param size Minimum size in bytes
   * @returns Pooled buffer object
   */
  acquire(size: number): PooledBuffer {
    // Find available buffer with sufficient size
    const available = this.buffers.find(
      (b) => !b.inUse && b.size >= size
    );

    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available;
    }

    // Create new buffer if pool not full
    if (this.buffers.length < this.maxPoolSize) {
      const buffer = this.gl.createBuffer();
      if (!buffer) {
        throw new Error('Failed to create WebGL buffer');
      }

      const pooled: PooledBuffer = {
        buffer,
        size,
        inUse: true,
        lastUsed: Date.now(),
      };

      this.buffers.push(pooled);
      return pooled;
    }

    // Pool full: reuse oldest available buffer
    const oldest = this.buffers
      .filter((b) => !b.inUse)
      .sort((a, b) => a.lastUsed - b.lastUsed)[0];

    if (oldest) {
      oldest.inUse = true;
      oldest.lastUsed = Date.now();
      oldest.size = size;
      return oldest;
    }

    // All buffers in use: create temporary buffer (not pooled)
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create WebGL buffer');
    }

    return {
      buffer,
      size,
      inUse: true,
      lastUsed: Date.now(),
    };
  }

  /**
   * Returns a buffer to the pool
   * @param pooledBuffer Buffer to release
   */
  release(pooledBuffer: PooledBuffer): void {
    const index = this.buffers.indexOf(pooledBuffer);
    if (index !== -1) {
      this.buffers[index]!.inUse = false;
      this.buffers[index]!.lastUsed = Date.now();
    } else {
      // Temporary buffer not in pool: delete immediately
      this.gl.deleteBuffer(pooledBuffer.buffer);
    }
  }

  /**
   * Cleans up old unused buffers
   * Should be called periodically (e.g., in animation frame)
   */
  cleanup(): void {
    const now = Date.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.buffers.length; i++) {
      const buffer = this.buffers[i];
      if (buffer && !buffer.inUse && now - buffer.lastUsed > this.maxBufferAge) {
        this.gl.deleteBuffer(buffer.buffer);
        toRemove.push(i);
      }
    }

    // Remove in reverse order to maintain indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const index = toRemove[i];
      if (index !== undefined) {
        this.buffers.splice(index, 1);
      }
    }
  }

  /**
   * Disposes all buffers in the pool
   */
  dispose(): void {
    for (const pooled of this.buffers) {
      this.gl.deleteBuffer(pooled.buffer);
    }
    this.buffers = [];
  }

  /**
   * Gets statistics about the buffer pool
   */
  getStats(): { total: number; inUse: number; available: number } {
    const inUse = this.buffers.filter((b) => b.inUse).length;
    return {
      total: this.buffers.length,
      inUse,
      available: this.buffers.length - inUse,
    };
  }
}
