/**
 * Shader program compilation and caching
 * @module utils/shader-cache
 */

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface CompiledShader {
  program: WebGLProgram;
  attributes: Map<string, number>;
  uniforms: Map<string, WebGLUniformLocation>;
}

export class ShaderCache {
  private gl: WebGL2RenderingContext;
  private cache: Map<string, CompiledShader> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Compiles a shader or retrieves it from cache
   * @param name Unique identifier for this shader
   * @param source Vertex and fragment shader source
   * @returns Compiled shader program with attribute and uniform locations
   */
  compile(name: string, source: ShaderSource): CompiledShader {
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    const compiled = this.compileShader(source);
    this.cache.set(name, compiled);
    return compiled;
  }

  /**
   * Compiles a shader program from source
   */
  private compileShader(source: ShaderSource): CompiledShader {
    const vertexShader = this.compileShaderStage(source.vertex, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShaderStage(source.fragment, this.gl.FRAGMENT_SHADER);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    // Check link status
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      this.gl.deleteShader(vertexShader);
      this.gl.deleteShader(fragmentShader);
      throw new Error(`Shader program link failed: ${info}`);
    }

    // Clean up shaders (they're now part of the program)
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    // Extract attributes and uniforms
    const attributes = this.extractAttributes(program);
    const uniforms = this.extractUniforms(program);

    return { program, attributes, uniforms };
  }

  /**
   * Compiles a single shader stage
   */
  private compileShaderStage(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
  }

  /**
   * Extracts attribute locations from compiled program
   */
  private extractAttributes(program: WebGLProgram): Map<string, number> {
    const attributes = new Map<string, number>();
    const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < count; i++) {
      const info = this.gl.getActiveAttrib(program, i);
      if (info) {
        const location = this.gl.getAttribLocation(program, info.name);
        attributes.set(info.name, location);
      }
    }

    return attributes;
  }

  /**
   * Extracts uniform locations from compiled program
   */
  private extractUniforms(program: WebGLProgram): Map<string, WebGLUniformLocation> {
    const uniforms = new Map<string, WebGLUniformLocation>();
    const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < count; i++) {
      const info = this.gl.getActiveUniform(program, i);
      if (info) {
        const location = this.gl.getUniformLocation(program, info.name);
        if (location) {
          uniforms.set(info.name, location);
        }
      }
    }

    return uniforms;
  }

  /**
   * Clears the shader cache
   */
  clear(): void {
    for (const shader of this.cache.values()) {
      this.gl.deleteProgram(shader.program);
    }
    this.cache.clear();
  }

  /**
   * Disposes the shader cache and all programs
   */
  dispose(): void {
    this.clear();
  }

  /**
   * Enables `using` declarations (TC39 Explicit Resource Management).
   * `using cache = new ShaderCache(gl)` will auto-dispose on scope exit.
   */
  [Symbol.dispose](): void {
    this.dispose();
  }
}
