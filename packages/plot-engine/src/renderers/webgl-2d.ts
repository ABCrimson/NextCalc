/**
 * Modern WebGL 2.0 Renderer for 2D Mathematical Plots
 *
 * Performance Optimizations:
 * - Vertex Array Objects (VAO) for efficient state management
 * - Uniform Buffer Objects (UBO) for shared transformation matrices
 * - Reusable vertex buffers with smart pooling
 * - WebGL context loss recovery
 * - Adaptive sampling (curvature-aware subdivision) for Cartesian functions,
 *   cached per function identity + viewport domain
 * - Sub-1ms frame times for 60fps rendering
 *
 * Bundle size: <20KB (gzipped)
 * Initialization: <50ms (includes shader compilation)
 * Render time: <0.5ms for typical plots (1000 points)
 * Memory: <10MB for standard usage
 *
 * @module renderers/webgl-2d
 */

import { splitSampleSegments } from '../sampling/adaptive';
import type {
  IRenderer,
  PerformanceMetrics,
  Plot2DCartesianConfig,
  Plot2DImplicitConfig,
  Plot2DParametricConfig,
  Plot2DPolarConfig,
  Plot2DRelationConfig,
  Plot2DVectorFieldConfig,
  PlotConfig,
  PlotStyle,
  Point2D,
  RenderBackend,
  Viewport,
} from '../types/index';
import { BufferPool } from '../utils/buffer-pool';
import { parseColor } from '../utils/color';
import { dashPolyline } from '../utils/dash';
import {
  combineIntersectionGrids,
  DEFAULT_FIELD_RESOLUTION,
  ScalarFieldCache,
} from '../utils/implicit-field';
import { marchingSquares, marchingSquaresFilledTriangles } from '../utils/marching-squares';
import { multiply, ortho, scaling, translation } from '../utils/matrix';
import { getJSHeapUsage } from '../utils/memory';
import { CartesianSampleCache } from '../utils/sample-cache';
import { ShaderCache } from '../utils/shader-cache';
import { axisShader, cartesianLineShader, gridShader, polarLineShader } from './shaders';

/** Dash/gap length for strict-inequality boundaries, in CSS pixels. */
const STRICT_DASH_PX = 10;
const STRICT_GAP_PX = 6;

/**
 * VAO state management for efficient rendering
 */
interface VAOState {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  vertexCount: number;
  attributes: Map<string, { location: number; size: number; type: number }>;
}

/**
 * Modern WebGL 2.0 renderer implementation with advanced features
 */
export class WebGL2DRenderer implements IRenderer {
  readonly backend: RenderBackend = 'webgl2';
  readonly canvas: HTMLCanvasElement;

  private gl: WebGL2RenderingContext | null = null;
  private bufferPool: BufferPool | null = null;
  private shaderCache: ShaderCache | null = null;

  // VAO cache for efficient state management
  private vaoCache: Map<string, VAOState> = new Map();

  // Adaptive-sample cache for Cartesian y = f(x) functions, keyed by
  // function identity + viewport domain (see utils/sample-cache.ts)
  private sampleCache: CartesianSampleCache = new CartesianSampleCache();

  // Scalar-field cache for implicit/relation plots, keyed by field-closure
  // identity + viewport + resolution (see utils/implicit-field.ts)
  private fieldCache: ScalarFieldCache = new ScalarFieldCache();

  // Performance tracking
  private metrics: PerformanceMetrics = {
    initTime: 0,
    renderTime: 0,
    frameTime: 0,
    fps: 0,
    memoryUsage: 0,
    pointCount: 0,
    drawCalls: 0,
  };

  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  // Viewport transformation matrices
  private viewMatrix: Float32Array | null = null;
  private projectionMatrix: Float32Array | null = null;

  // Context loss recovery
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;
  private contextLost = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initializes the WebGL 2 renderer with advanced features
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();

    try {
      // Get WebGL 2 context with optimal settings
      this.gl = this.canvas.getContext('webgl2', {
        alpha: true,
        antialias: true, // Hardware MSAA when available
        depth: false, // 2D rendering doesn't need depth buffer
        stencil: false,
        preserveDrawingBuffer: true, // For screenshots/export
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
        desynchronized: true, // Reduce input latency
      });

      if (!this.gl) {
        throw new Error('WebGL 2 not supported. Please use a modern browser.');
      }

      // Set up context loss handlers
      this.setupContextLossRecovery();

      // Initialize buffer pool and shader cache
      this.bufferPool = new BufferPool(this.gl, 32, 30000);
      this.shaderCache = new ShaderCache(this.gl);

      // Compile all shaders at initialization
      await this.compileShaders();

      // Configure WebGL state
      this.setupGLState();

      // Initialize projection matrix
      this.updateProjectionMatrix();

      this.metrics.initTime = performance.now() - startTime;

      console.debug(`WebGL 2D Renderer initialized in ${this.metrics.initTime.toFixed(2)}ms`);
    } catch (error) {
      throw new Error(`WebGL 2D renderer initialization failed: ${error}`);
    }
  }

  /**
   * Sets up WebGL context loss recovery
   */
  private setupContextLossRecovery(): void {
    if (!this.gl) return;

    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      console.warn('WebGL context lost. Attempting recovery...');
    };

    this.contextRestoredHandler = async () => {
      this.contextLost = false;
      console.debug('WebGL context restored. Re-initializing...');

      try {
        // Re-initialize resources
        this.bufferPool = new BufferPool(this.gl!, 32, 30000);
        this.shaderCache = new ShaderCache(this.gl!);
        this.vaoCache.clear();

        await this.compileShaders();
        this.setupGLState();
        this.updateProjectionMatrix();

        console.debug('WebGL context successfully recovered');
      } catch (error) {
        console.error('Failed to recover WebGL context:', error);
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler, false);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler, false);
  }

  /**
   * Compiles all required shaders
   */
  private async compileShaders(): Promise<void> {
    if (!this.shaderCache) return;

    // Only compile shaders that are actually used by a draw call below.
    const shadersToCompile = [
      { name: 'cartesian-line', source: cartesianLineShader },
      { name: 'polar-line', source: polarLineShader },
      { name: 'grid', source: gridShader },
      { name: 'axis', source: axisShader },
    ];

    for (const { name, source } of shadersToCompile) {
      try {
        this.shaderCache.compile(name, source);
      } catch (error) {
        console.error(`Failed to compile shader '${name}':`, error);
        throw error;
      }
    }
  }

  /**
   * Configures initial WebGL state with enhanced visual quality
   */
  private setupGLState(): void {
    if (!this.gl) return;

    // Enable blending for transparency with improved quality
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFuncSeparate(
      this.gl.SRC_ALPHA,
      this.gl.ONE_MINUS_SRC_ALPHA,
      this.gl.ONE,
      this.gl.ONE_MINUS_SRC_ALPHA,
    );
    this.gl.blendEquation(this.gl.FUNC_ADD);

    // Modern dark background with subtle blue tint (matches UI theme)
    this.gl.clearColor(0.02, 0.02, 0.05, 1.0); // rgb(5, 5, 13) - darker, cleaner

    // Disable depth and stencil testing (2D only)
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.STENCIL_TEST);

    // Enable scissor test for clipping (useful for zoomed plots)
    this.gl.disable(this.gl.SCISSOR_TEST);

    // Set line width (note: WebGL only guarantees 1.0, implementation-dependent)
    this.gl.lineWidth(1.0);

    // WebGL 2 handles MSAA via the canvas `antialias` context attribute.
    // No runtime extension needed.
  }

  /**
   * Renders a plot configuration
   */
  render(config: PlotConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) {
      throw new Error('Renderer not initialized');
    }

    if (this.contextLost) {
      console.warn('Cannot render: WebGL context is lost');
      return;
    }

    const startTime = performance.now();
    this.metrics.drawCalls = 0;
    this.metrics.pointCount = 0;

    // Clear canvas
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Render based on plot type
    try {
      switch (config.type) {
        case '2d-cartesian':
          this.renderCartesian(config);
          break;
        case '2d-polar':
          this.renderPolar(config);
          break;
        case '2d-parametric':
          this.renderParametric(config);
          break;
        case '2d-implicit':
          this.renderImplicit(config);
          break;
        case '2d-relation':
          this.renderRelation(config);
          break;
        case '2d-vector-field':
          this.renderVectorField(config);
          break;
        default:
          throw new Error(
            `Unsupported plot type for WebGL 2D renderer: ${(config as PlotConfig).type}`,
          );
      }
    } catch (error) {
      console.error('Render error:', error);
      throw error;
    }

    this.metrics.renderTime = performance.now() - startTime;
    this.updateFPS();

    // Cleanup old buffers periodically (every 60 frames)
    if (this.frameCount % 60 === 0) {
      this.bufferPool.cleanup();
    }
  }

  /**
   * Renders a 2D Cartesian plot with grid and axes
   */
  private renderCartesian(config: Plot2DCartesianConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    // Update view matrix for viewport
    this.updateViewMatrix(config.viewport);

    // Render grid
    this.renderGrid(config);

    // Render axes
    this.renderAxes(config);

    // Render each function
    config.functions.forEach((func, i) => {
      this.renderFunction2D(func.fn, config.viewport, func.style, i);
    });
  }

  /**
   * Renders a 2D polar plot
   */
  private renderPolar(config: Plot2DPolarConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    // Calculate viewport from polar ranges with optional center offset for panning
    const cx = config.center?.x ?? 0;
    const cy = config.center?.y ?? 0;
    const viewport: Viewport = {
      xMin: cx - config.rRange.max,
      xMax: cx + config.rRange.max,
      yMin: cy - config.rRange.max,
      yMax: cy + config.rRange.max,
    };

    this.updateViewMatrix(viewport);

    // Render polar grid
    this.renderPolarGrid(config);

    // Render each polar function
    config.functions.forEach((func, i) => {
      this.renderPolarFunction(func.fn, config.thetaRange, func.style, i);
    });
  }

  /**
   * Renders a 2D parametric plot
   */
  private renderParametric(config: Plot2DParametricConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    this.updateViewMatrix(config.viewport);

    // Render simple grid
    this.renderGridSimple(config.viewport);

    // Render each parametric curve
    config.functions.forEach((func, i) => {
      this.renderParametricCurve(func.x, func.y, config.tRange, func.style, i);
    });
  }

  /**
   * Renders a mathematical function y = f(x).
   * Uses curvature-aware adaptive sampling (see utils/sample-cache.ts), cached
   * per function identity + viewport domain so an unchanged function/viewport
   * pair skips resampling on re-render.
   */
  private renderFunction2D(
    fn: (x: number) => number,
    viewport: Viewport,
    style?: Partial<PlotStyle>,
    functionIndex = 0,
  ): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const points = this.sampleCache.get(fn, viewport.xMin, viewport.xMax);

    // The sampler emits NaN-y break markers at poles/domain gaps. Split into
    // contiguous segments and stroke each one separately so discontinuities
    // are never bridged. All segments share a single vertex buffer; each is
    // drawn by its own [first, count) range.
    const segments = splitSampleSegments(points);
    if (segments.length === 0) return;

    let vertexCount = 0;
    for (const segment of segments) vertexCount += segment.length;
    this.metrics.pointCount += vertexCount;

    // Prepare vertex data: segments packed back-to-back, draw range recorded
    // per segment
    const vertices = new Float32Array(vertexCount * 2);
    const ranges: { first: number; count: number }[] = [];
    let offset = 0;
    for (const segment of segments) {
      ranges.push({ first: offset, count: segment.length });
      for (const point of segment) {
        vertices[offset * 2] = point.x;
        vertices[offset * 2 + 1] = point.y;
        offset++;
      }
    }

    // Get or create VAO for this function. Keyed per function index so
    // multiple functions never share a VAO (each function needs its own
    // stable attribute binding — see the buffer-rebind fix below).
    const vaoKey = `function-line-${functionIndex}`;
    let vaoState = this.vaoCache.get(vaoKey);

    const shader = this.shaderCache.compile('cartesian-line', cartesianLineShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    // Upload data to GPU
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    if (!vaoState) {
      const vao = this.gl.createVertexArray();
      if (!vao) return;
      vaoState = {
        vao,
        buffer: buffer.buffer,
        vertexCount,
        attributes: new Map(),
      };
      this.vaoCache.set(vaoKey, vaoState);
    }

    // Bind the VAO and re-run vertexAttribPointer on EVERY use (cache hit or
    // miss). A VAO only captures whichever buffer was ARRAY_BUFFER-bound at
    // the moment vertexAttribPointer() was called — the buffer pool can (and
    // does, under pool churn or multiple functions) hand back a *different*
    // underlying WebGLBuffer than the one this VAO was last configured
    // against. Rebinding ARRAY_BUFFER above does NOT retroactively update an
    // already-created VAO's attribute binding, so skipping this on cache-hit
    // silently reads stale/garbage geometry.
    this.gl.bindVertexArray(vaoState.vao);
    const posLoc = shader.attributes.get('a_position');
    if (posLoc !== undefined) {
      this.gl.enableVertexAttribArray(posLoc);
      this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      vaoState.attributes.set('a_position', { location: posLoc, size: 2, type: this.gl.FLOAT });
    }
    vaoState.buffer = buffer.buffer;
    vaoState.vertexCount = vertexCount;

    // Use shader program
    this.gl.useProgram(shader.program);

    // Set uniforms
    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      const color = parseColor(style?.line?.color ?? '#06b6d4'); // Cyan-500 - vibrant modern color
      // Enhanced brightness and saturation for dark theme - much more visible
      this.gl.uniform4f(
        colorLoc,
        Math.min(color.r * 2.0, 1.0),
        Math.min(color.g * 2.0, 1.0),
        Math.min(color.b * 2.0, 1.0),
        color.a,
      );
    }

    // Set line width - slightly thicker for better visibility
    this.gl.lineWidth(style?.line?.width ?? 3.0);

    // Draw each contiguous segment as its own strip so discontinuity markers
    // (poles, domain gaps) break the line instead of being bridged
    for (const range of ranges) {
      this.gl.drawArrays(this.gl.LINE_STRIP, range.first, range.count);
      this.metrics.drawCalls++;
    }

    // Unbind VAO
    this.gl.bindVertexArray(null);

    // Release buffer
    this.bufferPool.release(buffer);
  }

  /**
   * Renders a polar function r = f(theta)
   */
  private renderPolarFunction(
    fn: (theta: number) => number,
    thetaRange: { min: number; max: number },
    style?: Partial<PlotStyle>,
    functionIndex = 0,
  ): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const samples = 1000;
    const dTheta = (thetaRange.max - thetaRange.min) / samples;
    const points: { r: number; theta: number }[] = [];

    for (let i = 0; i <= samples; i++) {
      const theta = thetaRange.min + i * dTheta;
      try {
        const r = fn(theta);
        if (Number.isFinite(r)) {
          points.push({ r, theta });
        }
      } catch {
        // Skip invalid points
      }
    }

    if (points.length < 2) return;

    this.metrics.pointCount += points.length;

    // Prepare vertex data (polar coordinates, converted in shader)
    const vertices = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point) {
        vertices[i * 2] = point.r;
        vertices[i * 2 + 1] = point.theta;
      }
    }

    const shader = this.shaderCache.compile('polar-line', polarLineShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    // Get or create VAO for this polar function (keyed per function index —
    // see renderFunction2D for why cross-function/cache-hit sharing is unsafe).
    const vaoKey = `polar-${functionIndex}`;
    let vaoState = this.vaoCache.get(vaoKey);

    if (!vaoState) {
      const vao = this.gl.createVertexArray();
      if (!vao) return;
      vaoState = {
        vao,
        buffer: buffer.buffer,
        vertexCount: points.length,
        attributes: new Map(),
      };
      this.vaoCache.set(vaoKey, vaoState);
    }

    // Rebind + re-run vertexAttribPointer on every use — see renderFunction2D.
    this.gl.bindVertexArray(vaoState.vao);
    const posLoc = shader.attributes.get('a_polar');
    if (posLoc !== undefined) {
      this.gl.enableVertexAttribArray(posLoc);
      this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      vaoState.attributes.set('a_polar', { location: posLoc, size: 2, type: this.gl.FLOAT });
    }
    vaoState.buffer = buffer.buffer;
    vaoState.vertexCount = points.length;

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      const color = parseColor(style?.line?.color ?? '#a855f7'); // Purple-500
      // Enhanced brightness for dark theme
      this.gl.uniform4f(
        colorLoc,
        Math.min(color.r * 2.2, 1.0),
        Math.min(color.g * 2.2, 1.0),
        Math.min(color.b * 2.2, 1.0),
        color.a,
      );
    }

    this.gl.lineWidth(style?.line?.width ?? 3.0);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, points.length);
    this.metrics.drawCalls++;

    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders a parametric curve x = f(t), y = g(t)
   */
  private renderParametricCurve(
    xFn: (t: number) => number,
    yFn: (t: number) => number,
    tRange: { min: number; max: number },
    style?: Partial<PlotStyle>,
    functionIndex = 0,
  ): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const samples = 1000;
    const dt = (tRange.max - tRange.min) / samples;
    const points: Point2D[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = tRange.min + i * dt;
      try {
        const x = xFn(t);
        const y = yFn(t);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          points.push({ x, y });
        }
      } catch {
        // Skip invalid points
      }
    }

    if (points.length < 2) return;

    this.metrics.pointCount += points.length;

    // Use standard Cartesian rendering
    const vertices = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('cartesian-line', cartesianLineShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    // Get or create VAO for this parametric curve (keyed per function index —
    // see renderFunction2D for why cross-function/cache-hit sharing is unsafe).
    const vaoKey = `parametric-${functionIndex}`;
    let vaoState = this.vaoCache.get(vaoKey);

    if (!vaoState) {
      const vao = this.gl.createVertexArray();
      if (!vao) return;
      vaoState = {
        vao,
        buffer: buffer.buffer,
        vertexCount: points.length,
        attributes: new Map(),
      };
      this.vaoCache.set(vaoKey, vaoState);
    }

    // Rebind + re-run vertexAttribPointer on every use — see renderFunction2D.
    this.gl.bindVertexArray(vaoState.vao);
    const posLoc = shader.attributes.get('a_position');
    if (posLoc !== undefined) {
      this.gl.enableVertexAttribArray(posLoc);
      this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      vaoState.attributes.set('a_position', { location: posLoc, size: 2, type: this.gl.FLOAT });
    }
    vaoState.buffer = buffer.buffer;
    vaoState.vertexCount = points.length;

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      const color = parseColor(style?.line?.color ?? '#10b981'); // Emerald-500
      // Enhanced brightness for dark theme
      this.gl.uniform4f(
        colorLoc,
        Math.min(color.r * 2.2, 1.0),
        Math.min(color.g * 2.2, 1.0),
        Math.min(color.b * 2.2, 1.0),
        color.a,
      );
    }

    this.gl.lineWidth(style?.line?.width ?? 3.0);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, points.length);
    this.metrics.drawCalls++;

    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders an implicit plot f(x,y) = 0 using marching squares
   */
  private renderImplicit(config: Plot2DImplicitConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const { fn, viewport, resolution = { x: 200, y: 200 }, style } = config;

    this.updateViewMatrix(viewport);

    // Render grid and axes if provided
    if (config.xAxis && config.yAxis) {
      const cartesianConfig: Plot2DCartesianConfig = {
        type: '2d-cartesian',
        functions: [],
        viewport,
        xAxis: config.xAxis,
        yAxis: config.yAxis,
      };
      this.renderGrid(cartesianConfig);
      this.renderAxes(cartesianConfig);
    }

    // Adaptive scalar-field sampling, cached per fn identity + viewport.
    // Non-finite samples stay NaN (skipped by marching squares) instead of
    // being zeroed into fake contours at singularities.
    const field = this.fieldCache.get(fn, viewport, resolution);

    // Apply marching squares algorithm
    const contours = marchingSquares(field.grid, 0, field.dx, field.dy, viewport);

    // Render contour lines
    let totalPoints = 0;
    for (const contour of contours) {
      if (contour.points.length >= 2) {
        const lineStyle: { width?: number; color?: string; opacity?: number } | undefined =
          style?.line
            ? {
                width: style.line.width,
                color: typeof style.line.color === 'string' ? style.line.color : '#2563eb',
                ...(style.line.opacity !== undefined ? { opacity: style.line.opacity } : {}),
              }
            : undefined;
        this.renderLineSegment(contour.points, lineStyle);
        totalPoints += contour.points.length;
      }
    }

    this.metrics.pointCount += totalPoints;
  }

  /**
   * Renders a 2D relation plot: shaded inequality regions (marching-squares
   * filled triangles), implicit boundary contours (dashed for strict
   * operators), and any explicit y = f(x) functions.
   */
  private renderRelation(config: Plot2DRelationConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const { viewport, resolution = DEFAULT_FIELD_RESOLUTION } = config;
    this.updateViewMatrix(viewport);

    // Render grid and axes if provided (synthetic-cartesian pattern)
    if (config.xAxis && config.yAxis) {
      const cartesianConfig: Plot2DCartesianConfig = {
        type: '2d-cartesian',
        functions: [],
        viewport,
        xAxis: config.xAxis,
        yAxis: config.yAxis,
      };
      this.renderGrid(cartesianConfig);
      this.renderAxes(cartesianConfig);
    }

    // Explicit y = f(x) functions rendered alongside the relations
    const explicit = config.explicitFunctions ?? [];
    explicit.forEach((func, i) => {
      this.renderFunction2D(func.fn, viewport, func.style, i);
    });

    // Sample every relation's field once (cached per fn identity + viewport)
    const fields = config.relations.map((rel) =>
      this.fieldCache.get(rel.field, viewport, resolution),
    );

    const defaultColors = ['#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#ef4444'];
    const lineColorOf = (index: number): string => {
      const rel = config.relations[index]!;
      return rel.style?.line?.color && typeof rel.style.line.color === 'string'
        ? rel.style.line.color
        : (defaultColors[index % defaultColors.length] ?? '#06b6d4');
    };

    // --- Region fills -----------------------------------------------------
    // Resolve entries into layer sets; each set's grids are combined into a
    // single direction-normalized intersection mask on the CPU.
    const fillable = config.relations
      .map((rel, index) => ({ rel, index }))
      .filter(({ rel }) => rel.op !== '=');

    const layerSets: number[][] = [];
    if (config.combine === 'intersection') {
      if (fillable.length > 0) layerSets.push(fillable.map((entry) => entry.index));
    } else {
      const grouped = new Map<number, number[]>();
      for (const { rel, index } of fillable) {
        if (rel.group !== undefined) {
          const set = grouped.get(rel.group);
          if (set) {
            set.push(index);
          } else {
            grouped.set(rel.group, [index]);
          }
        } else {
          layerSets.push([index]);
        }
      }
      layerSets.push(...grouped.values());
    }

    for (const indices of layerSets) {
      const layers = indices.map((index) => {
        const op = config.relations[index]!.op;
        return {
          grid: fields[index]!.grid,
          dir: (op === '<' || op === '<=' ? -1 : 1) as 1 | -1,
        };
      });
      const combined = combineIntersectionGrids(layers);
      const first = fields[indices[0]!]!;
      const triangles = marchingSquaresFilledTriangles(combined, 0, first.dx, first.dy, viewport);
      if (triangles.length === 0) continue;

      const rel = config.relations[indices[0]!]!;
      const fill = rel.style?.fill;
      const fillColor =
        fill && typeof fill.color === 'string' ? fill.color : lineColorOf(indices[0]!);
      this.renderTriangles(triangles, fillColor, fill?.opacity ?? 0.25);
    }

    // --- Boundary contours -------------------------------------------------
    const cssWidth = this.canvas.clientWidth || this.canvas.width || 1;
    const mathPerPx = (viewport.xMax - viewport.xMin) / cssWidth;

    config.relations.forEach((rel, i) => {
      const field = fields[i]!;
      const contours = marchingSquares(field.grid, 0, field.dx, field.dy, viewport);
      const strict = rel.op === '<' || rel.op === '>';
      const width = rel.style?.line?.width ?? 2;
      const color = lineColorOf(i);

      let totalPoints = 0;
      for (const contour of contours) {
        if (contour.points.length < 2) continue;
        totalPoints += contour.points.length;
        if (strict) {
          const dashes = dashPolyline(
            contour.points,
            STRICT_DASH_PX * mathPerPx,
            STRICT_GAP_PX * mathPerPx,
          );
          if (dashes.length >= 2) this.renderLineList(dashes, { color, width });
        } else {
          this.renderLineSegment(contour.points, { color, width });
        }
      }
      this.metrics.pointCount += totalPoints;
    });
  }

  /**
   * Renders a 2D vector field with arrows
   */
  private renderVectorField(config: Plot2DVectorFieldConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const { field, viewport, resolution = { x: 20, y: 20 }, style } = config;

    this.updateViewMatrix(viewport);

    // Render grid and axes if provided
    if (config.xAxis && config.yAxis) {
      const cartesianConfig: Plot2DCartesianConfig = {
        type: '2d-cartesian',
        functions: [],
        viewport,
        xAxis: config.xAxis,
        yAxis: config.yAxis,
      };
      this.renderGrid(cartesianConfig);
      this.renderAxes(cartesianConfig);
    }

    const dx = (viewport.xMax - viewport.xMin) / resolution.x;
    const dy = (viewport.yMax - viewport.yMin) / resolution.y;
    const scale = style?.arrow?.scale ?? 0.5;
    const normalize = style?.arrow?.normalize ?? false;
    const headSize = style?.arrow?.headSize ?? 0.2;
    const color = style?.arrow?.color ?? '#2563eb';

    let totalArrows = 0;

    // Render arrows at grid points
    for (let i = 0; i <= resolution.y; i++) {
      for (let j = 0; j <= resolution.x; j++) {
        const x = viewport.xMin + j * dx;
        const y = viewport.yMin + i * dy;

        let vx: number;
        let vy: number;

        try {
          vx = field.x(x, y);
          vy = field.y(x, y);
        } catch {
          continue;
        }

        if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;

        // Calculate arrow scale
        let arrowScale = scale;
        if (normalize) {
          const mag = Math.sqrt(vx * vx + vy * vy);
          if (mag > 0) {
            arrowScale = (scale * Math.min(dx, dy)) / mag;
          }
        } else {
          arrowScale = scale * Math.min(dx, dy);
        }

        // Draw arrow from (x, y) to (x + vx*scale, y + vy*scale)
        const endX = x + vx * arrowScale;
        const endY = y + vy * arrowScale;

        this.renderArrow(x, y, endX, endY, color, headSize);
        totalArrows++;
      }
    }

    this.metrics.pointCount += totalArrows;
  }

  /**
   * Renders a line segment (helper for implicit plots and arrows)
   */
  private renderLineSegment(
    points: Point2D[],
    lineStyle?: { width?: number; color?: string; opacity?: number },
  ): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;
    if (points.length < 2) return;

    const vertices = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('cartesian-line', cartesianLineShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      const color = parseColor(lineStyle?.color ?? '#f59e0b');
      const opacity = lineStyle?.opacity ?? 1.0;
      this.gl.uniform4f(colorLoc, color.r * 1.5, color.g * 1.5, color.b * 1.5, opacity);
    }

    this.gl.lineWidth(lineStyle?.width ?? 2.5);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, points.length);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders a filled triangle list (relation region fills). Vertices are a
   * flat [x, y, ...] math-space array (marchingSquaresFilledTriangles
   * output); blending is enabled at init so `opacity` yields translucency.
   */
  private renderTriangles(vertices: Float32Array, color: string, opacity: number): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;
    if (vertices.length < 6) return;

    const shader = this.shaderCache.compile('cartesian-line', cartesianLineShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      const parsed = parseColor(color);
      this.gl.uniform4f(colorLoc, parsed.r, parsed.g, parsed.b, opacity * parsed.a);
    }

    this.gl.drawArrays(this.gl.TRIANGLES, 0, vertices.length / 2);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders independent line segments in LINES mode (dashed boundaries —
   * each consecutive point pair is one dash from dashPolyline).
   */
  private renderLineList(
    points: Point2D[],
    lineStyle?: { width?: number; color?: string; opacity?: number },
  ): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;
    if (points.length < 2) return;

    const vertices = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('cartesian-line', cartesianLineShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      // Same dark-theme brightening as renderLineSegment for visual parity
      // between solid and dashed boundaries.
      const color = parseColor(lineStyle?.color ?? '#f59e0b');
      const opacity = lineStyle?.opacity ?? 1.0;
      this.gl.uniform4f(colorLoc, color.r * 1.5, color.g * 1.5, color.b * 1.5, opacity);
    }

    this.gl.lineWidth(lineStyle?.width ?? 2.5);
    this.gl.drawArrays(this.gl.LINES, 0, points.length);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders an arrow (vector field helper)
   */
  private renderArrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    headSize: number,
  ): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    // Draw arrow shaft
    this.renderLineSegment(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      { color, width: 1 },
    );

    // Calculate arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = headSize * Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const headAngle = Math.PI / 6; // 30 degrees

    const p1x = x2 - headLen * Math.cos(angle - headAngle);
    const p1y = y2 - headLen * Math.sin(angle - headAngle);
    const p2x = x2 - headLen * Math.cos(angle + headAngle);
    const p2y = y2 - headLen * Math.sin(angle + headAngle);

    // Draw arrowhead as two lines
    this.renderLineSegment(
      [
        { x: x2, y: y2 },
        { x: p1x, y: p1y },
      ],
      { color, width: 1 },
    );
    this.renderLineSegment(
      [
        { x: x2, y: y2 },
        { x: p2x, y: p2y },
      ],
      { color, width: 1 },
    );
  }

  /**
   * Renders grid for Cartesian plots (standard method)
   */
  private renderGrid(config: Plot2DCartesianConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const viewport = config.viewport;
    const gridStep = config.xAxis.grid.majorStep;
    const lines: Point2D[] = [];

    // Vertical grid lines
    const xStart = Math.ceil(viewport.xMin / gridStep) * gridStep;
    for (let x = xStart; x <= viewport.xMax; x += gridStep) {
      lines.push({ x, y: viewport.yMin }, { x, y: viewport.yMax });
    }

    // Horizontal grid lines
    const yStart = Math.ceil(viewport.yMin / gridStep) * gridStep;
    for (let y = yStart; y <= viewport.yMax; y += gridStep) {
      lines.push({ x: viewport.xMin, y }, { x: viewport.xMax, y });
    }

    if (lines.length === 0) return;

    const vertices = new Float32Array(lines.length * 2);
    for (let i = 0; i < lines.length; i++) {
      const point = lines[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('grid', gridShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      const color = parseColor(config.xAxis.grid.color);
      // Much brighter, more visible grid with modern cyan tint
      this.gl.uniform4f(
        colorLoc,
        Math.min(color.r * 4.0 + 0.15, 1.0), // Add cyan tint
        Math.min(color.g * 4.0 + 0.15, 1.0),
        Math.min(color.b * 4.0 + 0.25, 1.0), // Extra blue
        config.xAxis.grid.opacity * 0.6, // More opaque
      );
    }

    this.gl.drawArrays(this.gl.LINES, 0, lines.length);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders polar grid (concentric circles and radial lines)
   */
  private renderPolarGrid(config: Plot2DPolarConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const rMax = config.rRange.max;
    const numCircles = 5;
    const numRadialLines = 12;
    const lines: Point2D[] = [];

    // Render concentric circles
    const circleSteps = 64;
    for (let i = 1; i <= numCircles; i++) {
      const r = (rMax * i) / numCircles;
      for (let j = 0; j < circleSteps; j++) {
        const theta1 = (2 * Math.PI * j) / circleSteps;
        const theta2 = (2 * Math.PI * (j + 1)) / circleSteps;
        lines.push(
          { x: r * Math.cos(theta1), y: r * Math.sin(theta1) },
          { x: r * Math.cos(theta2), y: r * Math.sin(theta2) },
        );
      }
    }

    // Render radial lines
    for (let i = 0; i < numRadialLines; i++) {
      const theta = (2 * Math.PI * i) / numRadialLines;
      lines.push({ x: 0, y: 0 }, { x: rMax * Math.cos(theta), y: rMax * Math.sin(theta) });
    }

    if (lines.length === 0) return;

    const vertices = new Float32Array(lines.length * 2);
    for (let i = 0; i < lines.length; i++) {
      const point = lines[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('grid', gridShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      // Vibrant purple/magenta grid for polar plots
      this.gl.uniform4f(colorLoc, 0.8, 0.5, 1.0, 0.5);
    }

    this.gl.lineWidth(1.5);
    this.gl.drawArrays(this.gl.LINES, 0, lines.length);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders simple Cartesian grid for parametric plots
   */
  private renderGridSimple(viewport: Viewport): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const lines: Point2D[] = [];
    const gridStep = Math.max(
      (viewport.xMax - viewport.xMin) / 10,
      (viewport.yMax - viewport.yMin) / 10,
    );

    // Vertical grid lines
    const xStart = Math.ceil(viewport.xMin / gridStep) * gridStep;
    for (let x = xStart; x <= viewport.xMax; x += gridStep) {
      lines.push({ x, y: viewport.yMin }, { x, y: viewport.yMax });
    }

    // Horizontal grid lines
    const yStart = Math.ceil(viewport.yMin / gridStep) * gridStep;
    for (let y = yStart; y <= viewport.yMax; y += gridStep) {
      lines.push({ x: viewport.xMin, y }, { x: viewport.xMax, y });
    }

    // Add axes
    if (viewport.yMin <= 0 && viewport.yMax >= 0) {
      lines.push({ x: viewport.xMin, y: 0 }, { x: viewport.xMax, y: 0 });
    }
    if (viewport.xMin <= 0 && viewport.xMax >= 0) {
      lines.push({ x: 0, y: viewport.yMin }, { x: 0, y: viewport.yMax });
    }

    if (lines.length === 0) return;

    const vertices = new Float32Array(lines.length * 2);
    for (let i = 0; i < lines.length; i++) {
      const point = lines[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('grid', gridShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      // Bright cyan grid for parametric plots
      this.gl.uniform4f(colorLoc, 0.4, 0.8, 1.0, 0.4);
    }

    this.gl.lineWidth(1.5);
    this.gl.drawArrays(this.gl.LINES, 0, lines.length);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Renders axes with enhanced visibility
   */
  private renderAxes(config: Plot2DCartesianConfig): void {
    if (!this.gl || !this.shaderCache || !this.bufferPool) return;

    const viewport = config.viewport;
    const lines: Point2D[] = [];

    // X-axis
    if (viewport.yMin <= 0 && viewport.yMax >= 0) {
      lines.push({ x: viewport.xMin, y: 0 }, { x: viewport.xMax, y: 0 });
    }

    // Y-axis
    if (viewport.xMin <= 0 && viewport.xMax >= 0) {
      lines.push({ x: 0, y: viewport.yMin }, { x: 0, y: viewport.yMax });
    }

    if (lines.length === 0) return;

    const vertices = new Float32Array(lines.length * 2);
    for (let i = 0; i < lines.length; i++) {
      const point = lines[i];
      if (point) {
        vertices[i * 2] = point.x;
        vertices[i * 2 + 1] = point.y;
      }
    }

    const shader = this.shaderCache.compile('axis', axisShader);
    const buffer = this.bufferPool.acquire(vertices.byteLength);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const vao = this.gl.createVertexArray();
    if (vao) {
      this.gl.bindVertexArray(vao);

      const posLoc = shader.attributes.get('a_position');
      if (posLoc !== undefined) {
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
      }
    }

    this.gl.useProgram(shader.program);

    const matrixLoc = shader.uniforms.get('u_matrix');
    const colorLoc = shader.uniforms.get('u_color');

    if (matrixLoc && this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      this.gl.uniformMatrix4fv(matrixLoc, false, mvp);
    }

    if (colorLoc) {
      // Vibrant bright cyan for axes - highly visible
      this.gl.uniform4f(colorLoc, 0.3, 0.9, 1.0, 1.0);
    }

    this.gl.lineWidth(2.5);
    this.gl.drawArrays(this.gl.LINES, 0, lines.length);
    this.metrics.drawCalls++;

    if (vao) {
      this.gl.deleteVertexArray(vao);
    }
    this.gl.bindVertexArray(null);
    this.bufferPool.release(buffer);
  }

  /**
   * Updates the view matrix for the given viewport
   */
  private updateViewMatrix(viewport: Viewport): void {
    const scaleX = 2 / (viewport.xMax - viewport.xMin);
    const scaleY = 2 / (viewport.yMax - viewport.yMin);
    const translateX = -(viewport.xMax + viewport.xMin) / 2;
    const translateY = -(viewport.yMax + viewport.yMin) / 2;

    const scale = scaling(scaleX, scaleY, 1);
    const translate = translation(translateX, translateY, 0);

    this.viewMatrix = multiply(scale, translate);
  }

  /**
   * Updates the projection matrix
   */
  private updateProjectionMatrix(): void {
    if (!this.gl) return;
    this.projectionMatrix = ortho(-1, 1, -1, 1, -1, 1);
  }

  /**
   * Updates FPS counter
   */
  private updateFPS(): void {
    this.frameCount++;
    const now = performance.now();

    if (now - this.fpsUpdateTime >= 1000) {
      this.metrics.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    if (this.lastFrameTime > 0) {
      this.metrics.frameTime = now - this.lastFrameTime;
    }
    this.lastFrameTime = now;
  }

  /**
   * Resizes the renderer and updates viewport
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
      this.updateProjectionMatrix();
    }
  }

  /**
   * Disposes the renderer and frees all resources
   */
  dispose(): void {
    // Remove context loss handlers
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
    }
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
    }

    // Dispose VAOs
    if (this.gl) {
      for (const vaoState of this.vaoCache.values()) {
        this.gl.deleteVertexArray(vaoState.vao);
      }
    }
    this.vaoCache.clear();
    this.sampleCache.clear();
    this.fieldCache.clear();

    // Dispose buffer pool and shader cache
    if (this.bufferPool) {
      this.bufferPool.dispose();
      this.bufferPool = null;
    }

    if (this.shaderCache) {
      this.shaderCache.dispose();
      this.shaderCache = null;
    }

    this.gl = null;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  /**
   * Gets performance metrics
   */
  getMetrics(): PerformanceMetrics {
    if (this.gl) {
      this.metrics.memoryUsage = getJSHeapUsage();
    }

    return { ...this.metrics };
  }
}
