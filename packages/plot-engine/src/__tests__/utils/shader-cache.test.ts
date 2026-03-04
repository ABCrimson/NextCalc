import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ShaderCache } from '../../utils/shader-cache';
import type { ShaderSource, CompiledShader } from '../../utils/shader-cache';

/**
 * Creates a mock WebGL2RenderingContext that tracks calls and returns
 * distinguishable objects for programs and shaders.
 */
function createMockGL(overrides: Record<string, unknown> = {}) {
  let shaderId = 0;
  let programId = 0;
  let uniformId = 0;

  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    LINK_STATUS: 0x8b82,
    COMPILE_STATUS: 0x8b81,
    ACTIVE_ATTRIBUTES: 0x8b89,
    ACTIVE_UNIFORMS: 0x8b86,

    createShader: vi.fn(() => ({ __shaderId: ++shaderId })),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),

    createProgram: vi.fn(() => ({ __programId: ++programId })),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((program: unknown, pname: number) => {
      if (pname === 0x8b82) return true; // LINK_STATUS
      if (pname === 0x8b89) return 1; // ACTIVE_ATTRIBUTES
      if (pname === 0x8b86) return 1; // ACTIVE_UNIFORMS
      return 0;
    }),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),

    getActiveAttrib: vi.fn((_prog: unknown, index: number) => ({
      name: `aPosition_${index}`,
      type: 0x8b50,
      size: 1,
    })),
    getAttribLocation: vi.fn((_prog: unknown, _name: string) => 0),

    getActiveUniform: vi.fn((_prog: unknown, index: number) => ({
      name: `uMatrix_${index}`,
      type: 0x8b5c,
      size: 1,
    })),
    getUniformLocation: vi.fn(() => ({ __uniformId: ++uniformId })),

    ...overrides,
  };

  return gl as unknown as WebGL2RenderingContext;
}

const sampleSource: ShaderSource = {
  vertex: 'attribute vec4 aPosition; void main() { gl_Position = aPosition; }',
  fragment: 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }',
};

describe('ShaderCache', () => {
  let gl: WebGL2RenderingContext;

  beforeEach(() => {
    gl = createMockGL();
  });

  // ── Compilation ───────────────────────────────────────────────────

  it('should compile a shader program from source', () => {
    const cache = new ShaderCache(gl);
    const result = cache.compile('test', sampleSource);

    expect(result).toBeDefined();
    expect(result.program).toBeDefined();
    expect(gl.createShader).toHaveBeenCalledTimes(2); // vertex + fragment
    expect(gl.createProgram).toHaveBeenCalledTimes(1);
    expect(gl.attachShader).toHaveBeenCalledTimes(2);
    expect(gl.linkProgram).toHaveBeenCalledTimes(1);
  });

  it('should extract attributes from compiled program', () => {
    const cache = new ShaderCache(gl);
    const result = cache.compile('test', sampleSource);

    expect(result.attributes).toBeInstanceOf(Map);
    expect(result.attributes.size).toBe(1);
    expect(result.attributes.has('aPosition_0')).toBe(true);
  });

  it('should extract uniforms from compiled program', () => {
    const cache = new ShaderCache(gl);
    const result = cache.compile('test', sampleSource);

    expect(result.uniforms).toBeInstanceOf(Map);
    expect(result.uniforms.size).toBe(1);
    expect(result.uniforms.has('uMatrix_0')).toBe(true);
  });

  it('should extract multiple attributes when present', () => {
    const multiGL = createMockGL({
      getProgramParameter: vi.fn((_prog: unknown, pname: number) => {
        if (pname === 0x8b82) return true;
        if (pname === 0x8b89) return 3; // 3 attributes
        if (pname === 0x8b86) return 0; // 0 uniforms
        return 0;
      }),
    });

    const cache = new ShaderCache(multiGL);
    const result = cache.compile('multi-attr', sampleSource);
    expect(result.attributes.size).toBe(3);
  });

  it('should handle programs with no active uniforms', () => {
    const noUniformGL = createMockGL({
      getProgramParameter: vi.fn((_prog: unknown, pname: number) => {
        if (pname === 0x8b82) return true;
        if (pname === 0x8b89) return 0;
        if (pname === 0x8b86) return 0;
        return 0;
      }),
    });

    const cache = new ShaderCache(noUniformGL);
    const result = cache.compile('no-uniforms', sampleSource);
    expect(result.uniforms.size).toBe(0);
    expect(result.attributes.size).toBe(0);
  });

  // ── Caching ───────────────────────────────────────────────────────

  it('should return cached program on second compile with same name', () => {
    const cache = new ShaderCache(gl);
    const first = cache.compile('shared', sampleSource);
    const second = cache.compile('shared', sampleSource);

    expect(second).toBe(first); // same object reference
    expect(gl.createProgram).toHaveBeenCalledTimes(1); // only compiled once
  });

  it('should compile separate programs for different names', () => {
    const cache = new ShaderCache(gl);
    const a = cache.compile('shaderA', sampleSource);
    const b = cache.compile('shaderB', sampleSource);

    expect(a).not.toBe(b);
    expect(a.program).not.toBe(b.program);
    expect(gl.createProgram).toHaveBeenCalledTimes(2);
  });

  it('should return cached result even with different source on same name', () => {
    const cache = new ShaderCache(gl);
    const first = cache.compile('name', sampleSource);
    const differentSource: ShaderSource = {
      vertex: 'void main() {}',
      fragment: 'void main() {}',
    };
    const second = cache.compile('name', differentSource);

    // Cache key is the name, so it returns the first compiled version
    expect(second).toBe(first);
    expect(gl.createProgram).toHaveBeenCalledTimes(1);
  });

  // ── Error handling ────────────────────────────────────────────────

  it('should throw when createProgram returns null', () => {
    const badGL = createMockGL({ createProgram: vi.fn(() => null) });
    const cache = new ShaderCache(badGL);

    expect(() => cache.compile('test', sampleSource)).toThrow('Failed to create shader program');
  });

  it('should throw when createShader returns null', () => {
    const badGL = createMockGL({ createShader: vi.fn(() => null) });
    const cache = new ShaderCache(badGL);

    expect(() => cache.compile('test', sampleSource)).toThrow('Failed to create shader');
  });

  it('should throw on shader compilation failure', () => {
    const badGL = createMockGL({
      getShaderParameter: vi.fn(() => false),
      getShaderInfoLog: vi.fn(() => 'syntax error at line 1'),
    });
    const cache = new ShaderCache(badGL);

    expect(() => cache.compile('test', sampleSource)).toThrow('Shader compilation failed');
  });

  it('should throw on program link failure and clean up', () => {
    const badGL = createMockGL({
      getProgramParameter: vi.fn((_prog: unknown, pname: number) => {
        if (pname === 0x8b82) return false; // LINK_STATUS failed
        return 0;
      }),
      getProgramInfoLog: vi.fn(() => 'link error: varying mismatch'),
    });
    const cache = new ShaderCache(badGL);

    expect(() => cache.compile('test', sampleSource)).toThrow('Shader program link failed');
    expect(badGL.deleteProgram).toHaveBeenCalled();
    expect(badGL.deleteShader).toHaveBeenCalledTimes(2); // both shaders cleaned up
  });

  // ── Clear ─────────────────────────────────────────────────────────

  it('should clear all cached programs', () => {
    const cache = new ShaderCache(gl);
    cache.compile('a', sampleSource);
    cache.compile('b', sampleSource);

    cache.clear();

    expect(gl.deleteProgram).toHaveBeenCalledTimes(2);

    // After clearing, compiling same name should create new program
    cache.compile('a', sampleSource);
    expect(gl.createProgram).toHaveBeenCalledTimes(3);
  });

  // ── Dispose ───────────────────────────────────────────────────────

  it('should dispose via dispose()', () => {
    const cache = new ShaderCache(gl);
    cache.compile('test', sampleSource);
    cache.dispose();

    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
  });

  it('should dispose via Symbol.dispose', () => {
    const cache = new ShaderCache(gl);
    cache.compile('test', sampleSource);
    cache[Symbol.dispose]();

    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
  });

  // ── Shader cleanup ────────────────────────────────────────────────

  it('should delete vertex and fragment shaders after successful link', () => {
    const cache = new ShaderCache(gl);
    cache.compile('test', sampleSource);

    // Two shaders created, then deleted after linking
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
  });

  // ── Uniform location null handling ────────────────────────────────

  it('should skip uniforms where getUniformLocation returns null', () => {
    const nullUniformGL = createMockGL({
      getUniformLocation: vi.fn(() => null),
    });

    const cache = new ShaderCache(nullUniformGL);
    const result = cache.compile('test', sampleSource);
    expect(result.uniforms.size).toBe(0);
  });
});
