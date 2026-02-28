/**
 * WebGPU 2D Renderer for Mathematical Plots
 *
 * Implements the same IRenderer interface as WebGL2DRenderer using the
 * WebGPU API.  Pipeline architecture:
 *
 *   - One GPUDevice per renderer instance
 *   - GPUCanvasContext with preferred format (bgra8unorm or rgba8unorm)
 *   - Per-shader-type GPURenderPipeline objects, created once at init time
 *   - Two-tier bind group system:
 *       Group 0 – SceneUniforms (mvpMatrix[64] + resolution[8] + time[4] + pad[4])
 *                 Created ONCE per frame, cached until view/resize changes
 *       Group 1 – DrawUniforms (color[16] + misc floats/ints packed to 48 bytes)
 *                 Created per draw call
 *   - Dynamic vertex data uploaded via writeBuffer every frame
 *   - Context loss recovery via device.lost promise chain
 *   - Render pass uses loadOp:'clear' + storeOp:'store'
 *
 * Supported 2D plot types: Cartesian, Polar, Parametric, Implicit, VectorField
 * 3D types are rejected with a helpful error (handled by WebGL3DRenderer).
 *
 * @module renderers/webgpu-2d
 */

import type {
  IRenderer,
  RenderBackend,
  PerformanceMetrics,
  PlotConfig,
  Plot2DCartesianConfig,
  Plot2DPolarConfig,
  Plot2DParametricConfig,
  Plot2DImplicitConfig,
  Plot2DVectorFieldConfig,
  Point2D,
  Viewport,
} from '../types/index';
import { parseColor } from '../utils/color';
import { ortho, multiply, scaling, translation } from '../utils/matrix';
import { marchingSquares } from '../utils/marching-squares';
import {
  cartesianLineShaderWGSL,
  polarLineShaderWGSL,
  gridShaderWGSL,
  axisShaderWGSL,
} from './wgsl-shaders';
import type { WGSLShaderSource } from './wgsl-shaders';

// ---------------------------------------------------------------------------
// Uniform buffer layout constants (must match WGSL struct definitions)
// ---------------------------------------------------------------------------

/**
 * SceneUniforms buffer layout (bytes):
 *   mvpMatrix  : mat4x4<f32> = 64 bytes
 *   resolution : vec2<f32>   =  8 bytes
 *   time       : f32         =  4 bytes
 *   _pad0      : f32         =  4 bytes
 * Total: 80 bytes
 */
const SCENE_UNIFORM_BYTES = 80;

/**
 * DrawUniforms buffer layout (bytes):
 *   color            : vec4<f32> = 16 bytes  (offset 0)
 *   lineWidth        : f32       =  4 bytes  (offset 16)
 *   feather          : f32       =  4 bytes  (offset 20)
 *   dashLength       : f32       =  4 bytes  (offset 24)
 *   gapLength        : f32       =  4 bytes  (offset 28)
 *   dashOffset       : f32       =  4 bytes  (offset 32)
 *   minValue         : f32       =  4 bytes  (offset 36)
 *   maxValue         : f32       =  4 bytes  (offset 40)
 *   colorScheme      : i32       =  4 bytes  (offset 44)
 *   pointSize        : f32       =  4 bytes  (offset 48)
 *   shape            : i32       =  4 bytes  (offset 52)
 *   contourValue     : f32       =  4 bytes  (offset 56)
 *   contourThickness : f32       =  4 bytes  (offset 60)
 * Total: 64 bytes (padded to next 16-byte boundary)
 */
const DRAW_UNIFORM_BYTES = 64;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * A compiled WebGPU pipeline ready to use in a render pass.
 */
interface CompiledPipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
}

/**
 * Vertex buffer with associated byte length for this frame.
 */
interface FrameBuffer {
  gpuBuffer: GPUBuffer;
  capacity: number; // current allocated capacity in bytes
}

// ---------------------------------------------------------------------------
// WebGPU 2D Renderer
// ---------------------------------------------------------------------------

/**
 * WebGPU-backed 2D mathematical plot renderer.
 * Implements IRenderer with progressive enhancement — call initialize() first,
 * then render() for each frame.
 */
export class WebGPU2DRenderer implements IRenderer {
  readonly backend: RenderBackend = 'webgpu';
  readonly canvas: HTMLCanvasElement;

  // Core WebGPU objects
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private preferredFormat: GPUTextureFormat = 'bgra8unorm';

  // Pipeline cache: one pipeline per shader type
  private pipelines: Map<string, CompiledPipeline> = new Map();

  // Shared bind group layouts (2-tier: scene per-frame, draw per-call)
  private sceneBindGroupLayout: GPUBindGroupLayout | null = null;
  private drawBindGroupLayout: GPUBindGroupLayout | null = null;
  private frameSceneBindGroup: GPUBindGroup | null = null;
  private sceneUniformsDirty = true;

  // Persistent uniform buffers (re-written every frame)
  private sceneUniformBuffer: GPUBuffer | null = null;
  private drawUniformBuffer: GPUBuffer | null = null;

  // Re-usable vertex staging buffer pool
  private vertexBuffers: FrameBuffer[] = [];

  // Transformation matrices
  private viewMatrix: Float32Array | null = null;
  private projectionMatrix: Float32Array | null = null;

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

  private frameCount = 0;
  private fpsUpdateTime = 0;
  private lastFrameTime = 0;

  // Context loss recovery
  private isLost = false;
  private deviceLostCallback: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // ---------------------------------------------------------------------------
  // IRenderer.initialize
  // ---------------------------------------------------------------------------

  /**
   * Initialises the WebGPU device, canvas context, pipelines, and uniform buffers.
   * Must be awaited before calling render().
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();

    if (!('gpu' in navigator)) {
      throw new Error('WebGPU is not supported in this browser.');
    }

    // Request adapter (prefer high-performance GPU)
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!adapter) {
      throw new Error('No WebGPU adapter found. Ensure you are using a supported browser/OS/GPU combination.');
    }

    // Request device with required limits
    this.device = await adapter.requestDevice({
      label: 'NextCalc-WebGPU-2D',
      requiredLimits: {
        maxBufferSize: 256 * 1024 * 1024, // 256 MB
        maxVertexBufferArrayStride: 32,
      },
    });

    // Set up context loss recovery
    this.watchDeviceLost();

    // Configure canvas context
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!this.context) {
      throw new Error('Could not get WebGPU canvas context.');
    }

    this.preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.preferredFormat,
      alphaMode: 'premultiplied',
    });

    // Allocate persistent uniform buffers
    this.sceneUniformBuffer = this.device.createBuffer({
      label: 'SceneUniforms',
      size: SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.drawUniformBuffer = this.device.createBuffer({
      label: 'DrawUniforms',
      size: DRAW_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create shared bind group layouts for 2-tier system
    this.sceneBindGroupLayout = this.device.createBindGroupLayout({
      label: 'scene-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });

    this.drawBindGroupLayout = this.device.createBindGroupLayout({
      label: 'draw-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });

    // Compile all pipelines eagerly
    await this.compilePipelines();

    // Initialise projection matrix
    this.updateProjectionMatrix();

    this.metrics.initTime = performance.now() - startTime;
    console.log(`WebGPU 2D Renderer initialised in ${this.metrics.initTime.toFixed(2)} ms`);
  }

  // ---------------------------------------------------------------------------
  // Device loss recovery
  // ---------------------------------------------------------------------------

  private watchDeviceLost(): void {
    if (!this.device) return;

    this.device.lost.then((info) => {
      this.isLost = true;
      console.warn(`WebGPU device lost (reason: ${info.reason}): ${info.message}`);

      if (info.reason !== 'destroyed') {
        console.log('Attempting WebGPU device recovery…');
        this.initialize().then(() => {
          this.isLost = false;
          console.log('WebGPU device recovered.');
          this.deviceLostCallback?.();
        }).catch((err) => {
          console.error('WebGPU device recovery failed:', err);
        });
      }
    }).catch(() => {
      // Promise rejection from device.lost is expected on device destruction
    });
  }

  // ---------------------------------------------------------------------------
  // Pipeline compilation
  // ---------------------------------------------------------------------------

  private async compilePipelines(): Promise<void> {
    if (!this.device) return;

    const shadersToCompile: WGSLShaderSource[] = [
      cartesianLineShaderWGSL,
      polarLineShaderWGSL,
      gridShaderWGSL,
      axisShaderWGSL,
    ];

    for (const shader of shadersToCompile) {
      const compiled = this.createLinePipeline(shader);
      this.pipelines.set(shader.name, compiled);
    }
  }

  /**
   * Creates a render pipeline for a simple line shader.
   * Vertex format: two f32 components (x, y) per vertex.
   */
  private createLinePipeline(shader: WGSLShaderSource): CompiledPipeline {
    const device = this.device!;

    const pipelineLayout = device.createPipelineLayout({
      label: `${shader.name}-layout`,
      bindGroupLayouts: [this.sceneBindGroupLayout!, this.drawBindGroupLayout!],
    });

    const vertModule = device.createShaderModule({
      label: `${shader.name}-vert`,
      code: shader.vertex,
    });

    const fragModule = device.createShaderModule({
      label: `${shader.name}-frag`,
      code: shader.fragment,
    });

    const pipeline = device.createRenderPipeline({
      label: shader.name,
      layout: pipelineLayout,
      vertex: {
        module: vertModule,
        entryPoint: 'vsMain',
        buffers: [
          {
            // position: vec2<f32> only – 8 bytes per vertex
            arrayStride: 8,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
            ],
          },
        ],
      },
      fragment: {
        module: fragModule,
        entryPoint: 'fsMain',
        targets: [
          {
            format: this.preferredFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'line-strip',
      },
    });

    return { pipeline, bindGroupLayout: this.drawBindGroupLayout! };
  }

  /**
   * Creates a render pipeline that uses LINES topology (for grid rendering).
   * Vertex format: two f32 components.
   */
  private createLineListPipeline(shader: WGSLShaderSource): CompiledPipeline {
    const device = this.device!;

    const pipelineLayout = device.createPipelineLayout({
      label: `${shader.name}-lines-layout`,
      bindGroupLayouts: [this.sceneBindGroupLayout!, this.drawBindGroupLayout!],
    });

    const vertModule = device.createShaderModule({
      label: `${shader.name}-lines-vert`,
      code: shader.vertex,
    });

    const fragModule = device.createShaderModule({
      label: `${shader.name}-lines-frag`,
      code: shader.fragment,
    });

    const pipeline = device.createRenderPipeline({
      label: `${shader.name}-lines`,
      layout: pipelineLayout,
      vertex: {
        module: vertModule,
        entryPoint: 'vsMain',
        buffers: [
          {
            arrayStride: 8,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
            ],
          },
        ],
      },
      fragment: {
        module: fragModule,
        entryPoint: 'fsMain',
        targets: [
          {
            format: this.preferredFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'line-list',
      },
    });

    return { pipeline, bindGroupLayout: this.drawBindGroupLayout! };
  }

  // ---------------------------------------------------------------------------
  // IRenderer.render
  // ---------------------------------------------------------------------------

  render(config: PlotConfig): void {
    if (!this.device || !this.context) {
      throw new Error('WebGPU2DRenderer: not initialized. Call initialize() first.');
    }

    if (this.isLost) {
      console.warn('WebGPU2DRenderer: device lost, skipping frame.');
      return;
    }

    const startTime = performance.now();
    this.metrics.drawCalls = 0;
    this.metrics.pointCount = 0;

    // Acquire swap-chain texture
    let currentTexture: GPUTexture;
    try {
      currentTexture = this.context.getCurrentTexture();
    } catch {
      console.warn('WebGPU2DRenderer: failed to acquire swap-chain texture.');
      return;
    }

    const view = currentTexture.createView();

    // Build a command encoder for this frame
    const encoder = this.device.createCommandEncoder({ label: 'frame-encoder' });

    // Begin render pass with clear
    const renderPass = encoder.beginRenderPass({
      label: 'main-pass',
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    // Build per-frame scene bind group (cached until view/resize changes)
    this.ensureFrameSceneBindGroup();

    try {
      switch (config.type) {
        case '2d-cartesian':
          this.renderCartesian(renderPass, config);
          break;
        case '2d-polar':
          this.renderPolar(renderPass, config);
          break;
        case '2d-parametric':
          this.renderParametric(renderPass, config);
          break;
        case '2d-implicit':
          this.renderImplicit(renderPass, config);
          break;
        case '2d-vector-field':
          this.renderVectorField(renderPass, config);
          break;
        default: {
          throw new Error(
            `WebGPU2DRenderer: unsupported plot type "${(config as PlotConfig).type}". ` +
            '3D plots must use WebGL3DRenderer.'
          );
        }
      }
    } finally {
      renderPass.end();
    }

    // Submit commands
    this.device.queue.submit([encoder.finish()]);

    this.metrics.renderTime = performance.now() - startTime;
    this.updateFPS();
  }

  // ---------------------------------------------------------------------------
  // Plot type renderers
  // ---------------------------------------------------------------------------

  private renderCartesian(pass: GPURenderPassEncoder, config: Plot2DCartesianConfig): void {
    this.updateViewMatrix(config.viewport);

    // Grid
    this.drawGrid(pass, config.viewport, config.xAxis.grid.majorStep, config.xAxis.grid.color, config.xAxis.grid.opacity);

    // Axes
    this.drawAxes(pass, config.viewport);

    // Functions
    const defaultColors = ['#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#ef4444'];
    for (let i = 0; i < config.functions.length; i++) {
      const func = config.functions[i];
      if (!func) continue;
      const colorStr = func.style?.line?.color
        ? (typeof func.style.line.color === 'string' ? func.style.line.color : '#06b6d4')
        : (defaultColors[i % defaultColors.length] ?? '#06b6d4');

      this.drawFunction2D(pass, func.fn, config.viewport, colorStr, func.style?.line?.width ?? 2.0);
    }
  }

  private renderPolar(pass: GPURenderPassEncoder, config: Plot2DPolarConfig): void {
    const cx = config.center?.x ?? 0;
    const cy = config.center?.y ?? 0;
    const viewport: Viewport = {
      xMin: cx - config.rRange.max,
      xMax: cx + config.rRange.max,
      yMin: cy - config.rRange.max,
      yMax: cy + config.rRange.max,
    };
    this.updateViewMatrix(viewport);

    this.drawPolarGrid(pass, config.rRange.max);

    const defaultColors = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b'];
    for (let i = 0; i < config.functions.length; i++) {
      const func = config.functions[i];
      if (!func) continue;
      const colorStr = func.style?.line?.color
        ? (typeof func.style.line.color === 'string' ? func.style.line.color : '#a855f7')
        : (defaultColors[i % defaultColors.length] ?? '#a855f7');

      this.drawPolarFunction(pass, func.fn, config.thetaRange, colorStr, func.style?.line?.width ?? 2.0);
    }
  }

  private renderParametric(pass: GPURenderPassEncoder, config: Plot2DParametricConfig): void {
    this.updateViewMatrix(config.viewport);
    this.drawSimpleGrid(pass, config.viewport);

    const defaultColors = ['#10b981', '#06b6d4', '#a855f7', '#f59e0b'];
    for (let i = 0; i < config.functions.length; i++) {
      const func = config.functions[i];
      if (!func) continue;
      const colorStr = func.style?.line?.color
        ? (typeof func.style.line.color === 'string' ? func.style.line.color : '#10b981')
        : (defaultColors[i % defaultColors.length] ?? '#10b981');

      this.drawParametricCurve(pass, func.x, func.y, config.tRange, colorStr, func.style?.line?.width ?? 2.0);
    }
  }

  private renderImplicit(pass: GPURenderPassEncoder, config: Plot2DImplicitConfig): void {
    const { fn, viewport, resolution = { x: 200, y: 200 }, style } = config;
    this.updateViewMatrix(viewport);

    if (config.xAxis && config.yAxis) {
      this.drawGrid(pass, viewport, config.xAxis.grid.majorStep, config.xAxis.grid.color, config.xAxis.grid.opacity);
      this.drawAxes(pass, viewport);
    }

    // Sample function on grid
    const dx = (viewport.xMax - viewport.xMin) / resolution.x;
    const dy = (viewport.yMax - viewport.yMin) / resolution.y;
    const grid: number[][] = [];

    for (let i = 0; i <= resolution.y; i++) {
      grid[i] = [];
      for (let j = 0; j <= resolution.x; j++) {
        const x = viewport.xMin + j * dx;
        const y = viewport.yMin + i * dy;
        try {
          const val = fn(x, y);
          grid[i]![j] = Number.isFinite(val) ? val : 0;
        } catch {
          grid[i]![j] = 0;
        }
      }
    }

    const contours = marchingSquares(grid, 0, dx, dy, viewport);

    const colorStr = style?.line?.color
      ? (typeof style.line.color === 'string' ? style.line.color : '#f59e0b')
      : '#f59e0b';
    const width = style?.line?.width ?? 2.0;

    for (const contour of contours) {
      if (contour.points.length >= 2) {
        this.drawLineStrip(pass, contour.points, 'cartesian-line', colorStr, width);
        this.metrics.pointCount += contour.points.length;
      }
    }
  }

  private renderVectorField(pass: GPURenderPassEncoder, config: Plot2DVectorFieldConfig): void {
    const { field, viewport, resolution = { x: 20, y: 20 }, style } = config;
    this.updateViewMatrix(viewport);

    if (config.xAxis && config.yAxis) {
      this.drawGrid(pass, viewport, config.xAxis.grid.majorStep, config.xAxis.grid.color, config.xAxis.grid.opacity);
      this.drawAxes(pass, viewport);
    }

    const dx = (viewport.xMax - viewport.xMin) / resolution.x;
    const dy = (viewport.yMax - viewport.yMin) / resolution.y;
    const scale = style?.arrow?.scale ?? 0.5;
    const normalize = style?.arrow?.normalize ?? false;
    const headSize = style?.arrow?.headSize ?? 0.2;
    const color = style?.arrow?.color ?? '#2563eb';

    let arrowCount = 0;

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

        let arrowScale: number;
        if (normalize) {
          const mag = Math.sqrt(vx * vx + vy * vy);
          arrowScale = mag > 0 ? (scale * Math.min(dx, dy)) / mag : scale * Math.min(dx, dy);
        } else {
          arrowScale = scale * Math.min(dx, dy);
        }

        const endX = x + vx * arrowScale;
        const endY = y + vy * arrowScale;

        this.drawArrow(pass, x, y, endX, endY, color, headSize);
        arrowCount++;
      }
    }

    this.metrics.pointCount += arrowCount;
  }

  // ---------------------------------------------------------------------------
  // Primitive drawing helpers
  // ---------------------------------------------------------------------------

  /**
   * Evaluates fn(x) over the viewport x range, then draws the resulting
   * polyline using the cartesian-line pipeline.
   */
  private drawFunction2D(
    pass: GPURenderPassEncoder,
    fn: (x: number) => number,
    viewport: Viewport,
    colorStr: string,
    _lineWidth: number
  ): void {
    const samples = 1000;
    const dx = (viewport.xMax - viewport.xMin) / samples;
    const points: Point2D[] = [];

    for (let i = 0; i <= samples; i++) {
      const x = viewport.xMin + i * dx;
      try {
        const y = fn(x);
        if (Number.isFinite(y)) points.push({ x, y });
      } catch {
        // skip discontinuities
      }
    }

    if (points.length < 2) return;
    this.metrics.pointCount += points.length;
    this.drawLineStrip(pass, points, 'cartesian-line', colorStr, _lineWidth);
  }

  /**
   * Evaluates polar function r = fn(theta), then draws using cartesian-line
   * pipeline (coordinates converted on the CPU, matching the WebGL renderer
   * which only converts in the shader when using the polar-line shader).
   * We convert here because WebGPU line-strip draws in Cartesian clip space.
   */
  private drawPolarFunction(
    pass: GPURenderPassEncoder,
    fn: (theta: number) => number,
    thetaRange: { min: number; max: number },
    colorStr: string,
    lineWidth: number
  ): void {
    const samples = 1000;
    const dTheta = (thetaRange.max - thetaRange.min) / samples;
    const points: Point2D[] = [];

    for (let i = 0; i <= samples; i++) {
      const theta = thetaRange.min + i * dTheta;
      try {
        const r = fn(theta);
        if (Number.isFinite(r)) {
          points.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
        }
      } catch {
        // skip
      }
    }

    if (points.length < 2) return;
    this.metrics.pointCount += points.length;
    this.drawLineStrip(pass, points, 'cartesian-line', colorStr, lineWidth);
  }

  /**
   * Evaluates x(t), y(t) over tRange and draws the parametric curve.
   */
  private drawParametricCurve(
    pass: GPURenderPassEncoder,
    xFn: (t: number) => number,
    yFn: (t: number) => number,
    tRange: { min: number; max: number },
    colorStr: string,
    lineWidth: number
  ): void {
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
        // skip
      }
    }

    if (points.length < 2) return;
    this.metrics.pointCount += points.length;
    this.drawLineStrip(pass, points, 'cartesian-line', colorStr, lineWidth);
  }

  /**
   * Draws a Cartesian grid using line-list topology.
   */
  private drawGrid(
    pass: GPURenderPassEncoder,
    viewport: Viewport,
    gridStep: number,
    gridColor: unknown,
    gridOpacity: number
  ): void {
    const lines: Point2D[] = [];

    const xStart = Math.ceil(viewport.xMin / gridStep) * gridStep;
    for (let x = xStart; x <= viewport.xMax; x += gridStep) {
      lines.push({ x, y: viewport.yMin }, { x, y: viewport.yMax });
    }

    const yStart = Math.ceil(viewport.yMin / gridStep) * gridStep;
    for (let y = yStart; y <= viewport.yMax; y += gridStep) {
      lines.push({ x: viewport.xMin, y }, { x: viewport.xMax, y });
    }

    if (lines.length === 0) return;

    const colorStr = typeof gridColor === 'string' ? gridColor : '#334155';
    const parsedColor = parseColor(colorStr);
    const r = Math.min(parsedColor.r * 4.0 + 0.15, 1.0);
    const g = Math.min(parsedColor.g * 4.0 + 0.15, 1.0);
    const b = Math.min(parsedColor.b * 4.0 + 0.25, 1.0);
    const a = gridOpacity * 0.6;

    this.drawLineList(pass, lines, 'grid', [r, g, b, a]);
  }

  /**
   * Draws a simple Cartesian grid (for parametric plots that lack axis config).
   */
  private drawSimpleGrid(pass: GPURenderPassEncoder, viewport: Viewport): void {
    const gridStep = Math.max(
      (viewport.xMax - viewport.xMin) / 10,
      (viewport.yMax - viewport.yMin) / 10
    );

    const lines: Point2D[] = [];

    const xStart = Math.ceil(viewport.xMin / gridStep) * gridStep;
    for (let x = xStart; x <= viewport.xMax; x += gridStep) {
      lines.push({ x, y: viewport.yMin }, { x, y: viewport.yMax });
    }

    const yStart = Math.ceil(viewport.yMin / gridStep) * gridStep;
    for (let y = yStart; y <= viewport.yMax; y += gridStep) {
      lines.push({ x: viewport.xMin, y }, { x: viewport.xMax, y });
    }

    if (viewport.yMin <= 0 && viewport.yMax >= 0) {
      lines.push({ x: viewport.xMin, y: 0 }, { x: viewport.xMax, y: 0 });
    }
    if (viewport.xMin <= 0 && viewport.xMax >= 0) {
      lines.push({ x: 0, y: viewport.yMin }, { x: 0, y: viewport.yMax });
    }

    if (lines.length === 0) return;
    this.drawLineList(pass, lines, 'grid', [0.4, 0.8, 1.0, 0.4]);
  }

  /**
   * Draws polar grid: concentric circles + radial lines.
   */
  private drawPolarGrid(pass: GPURenderPassEncoder, rMax: number): void {
    const lines: Point2D[] = [];
    const numCircles = 5;
    const numRadialLines = 12;
    const circleSteps = 64;

    for (let i = 1; i <= numCircles; i++) {
      const r = (rMax * i) / numCircles;
      for (let j = 0; j < circleSteps; j++) {
        const t1 = (2 * Math.PI * j) / circleSteps;
        const t2 = (2 * Math.PI * (j + 1)) / circleSteps;
        lines.push(
          { x: r * Math.cos(t1), y: r * Math.sin(t1) },
          { x: r * Math.cos(t2), y: r * Math.sin(t2) }
        );
      }
    }

    for (let i = 0; i < numRadialLines; i++) {
      const theta = (2 * Math.PI * i) / numRadialLines;
      lines.push({ x: 0, y: 0 }, { x: rMax * Math.cos(theta), y: rMax * Math.sin(theta) });
    }

    if (lines.length === 0) return;
    this.drawLineList(pass, lines, 'grid', [0.8, 0.5, 1.0, 0.5]);
  }

  /**
   * Draws X and Y axes (lines through origin) for the given viewport.
   */
  private drawAxes(pass: GPURenderPassEncoder, viewport: Viewport): void {
    const lines: Point2D[] = [];

    if (viewport.yMin <= 0 && viewport.yMax >= 0) {
      lines.push({ x: viewport.xMin, y: 0 }, { x: viewport.xMax, y: 0 });
    }
    if (viewport.xMin <= 0 && viewport.xMax >= 0) {
      lines.push({ x: 0, y: viewport.yMin }, { x: 0, y: viewport.yMax });
    }

    if (lines.length === 0) return;
    this.drawLineList(pass, lines, 'axis', [0.3, 0.9, 1.0, 1.0]);
  }

  /**
   * Draws a three-line arrow from (x1,y1) to (x2,y2).
   */
  private drawArrow(
    pass: GPURenderPassEncoder,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    colorStr: string,
    headSize: number
  ): void {
    const shaft: Point2D[] = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    this.drawLineStrip(pass, shaft, 'cartesian-line', colorStr, 1.0);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = headSize * Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const headAngle = Math.PI / 6;

    const p1x = x2 - headLen * Math.cos(angle - headAngle);
    const p1y = y2 - headLen * Math.sin(angle - headAngle);
    const p2x = x2 - headLen * Math.cos(angle + headAngle);
    const p2y = y2 - headLen * Math.sin(angle + headAngle);

    this.drawLineStrip(pass, [{ x: x2, y: y2 }, { x: p1x, y: p1y }], 'cartesian-line', colorStr, 1.0);
    this.drawLineStrip(pass, [{ x: x2, y: y2 }, { x: p2x, y: p2y }], 'cartesian-line', colorStr, 1.0);
  }

  // ---------------------------------------------------------------------------
  // Low-level GPU draw calls
  // ---------------------------------------------------------------------------

  /**
   * Uploads points to a vertex buffer and records a line-strip draw call.
   */
  private drawLineStrip(
    pass: GPURenderPassEncoder,
    points: Point2D[],
    pipelineName: string,
    colorStr: string,
    lineWidth: number
  ): void {
    if (!this.device || points.length < 2) return;

    const compiled = this.pipelines.get(pipelineName);
    if (!compiled) return;

    const vertexData = this.pointsToFloat32(points);
    const vertexBuffer = this.acquireVertexBuffer(vertexData.byteLength);
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    // Update draw uniforms (scene uniforms handled by ensureFrameSceneBindGroup)
    const color = parseColor(colorStr);
    this.writeDrawUniforms(
      [Math.min(color.r * 2.0, 1.0), Math.min(color.g * 2.0, 1.0), Math.min(color.b * 2.0, 1.0), color.a],
      lineWidth
    );

    const drawBindGroup = this.device.createBindGroup({
      layout: compiled.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.drawUniformBuffer! } },
      ],
    });

    pass.setPipeline(compiled.pipeline);
    pass.setBindGroup(0, this.frameSceneBindGroup!);
    pass.setBindGroup(1, drawBindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(points.length);

    this.metrics.drawCalls++;
  }

  /**
   * Uploads line-list vertex pairs and records a LINES draw call.
   * Each consecutive pair of points is an independent line segment.
   */
  private drawLineList(
    pass: GPURenderPassEncoder,
    points: Point2D[],
    pipelineName: string,
    rgba: [number, number, number, number]
  ): void {
    if (!this.device || points.length < 2) return;

    // Ensure we have a line-list variant of this pipeline
    const listKey = `${pipelineName}-list`;
    if (!this.pipelines.has(listKey)) {
      // Find the source shader by name, re-create with line-list topology
      const sourceShaders: Record<string, WGSLShaderSource> = {
        grid: gridShaderWGSL,
        axis: axisShaderWGSL,
        'cartesian-line': cartesianLineShaderWGSL,
      };
      const srcShader = sourceShaders[pipelineName];
      if (!srcShader) return;

      const fake: WGSLShaderSource = { ...srcShader, name: listKey };
      this.pipelines.set(listKey, this.createLineListPipeline(fake));
    }

    const compiled = this.pipelines.get(listKey);
    if (!compiled) return;

    const vertexData = this.pointsToFloat32(points);
    const vertexBuffer = this.acquireVertexBuffer(vertexData.byteLength);
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    // Update draw uniforms (scene uniforms handled by ensureFrameSceneBindGroup)
    this.writeDrawUniforms(rgba, 1.0);

    const drawBindGroup = this.device.createBindGroup({
      layout: compiled.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.drawUniformBuffer! } },
      ],
    });

    pass.setPipeline(compiled.pipeline);
    pass.setBindGroup(0, this.frameSceneBindGroup!);
    pass.setBindGroup(1, drawBindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(points.length);

    this.metrics.drawCalls++;
  }

  // ---------------------------------------------------------------------------
  // Uniform buffer writes
  // ---------------------------------------------------------------------------

  /**
   * Writes the current MVP matrix and resolution to the scene uniform buffer.
   * Must be called after updateViewMatrix().
   */
  private writeSceneUniforms(): void {
    if (!this.device || !this.sceneUniformBuffer) return;

    const data = new Float32Array(SCENE_UNIFORM_BYTES / 4);

    // mvpMatrix (16 floats = 64 bytes)
    if (this.viewMatrix && this.projectionMatrix) {
      const mvp = multiply(this.projectionMatrix, this.viewMatrix);
      data.set(mvp, 0);
    }

    // resolution (2 floats at offset 16)
    data[16] = this.canvas.width;
    data[17] = this.canvas.height;

    // time (1 float at offset 18)
    data[18] = performance.now() / 1000;

    // _pad0 at offset 19 stays zero

    this.device.queue.writeBuffer(this.sceneUniformBuffer, 0, data);
  }

  /**
   * Writes draw-call-specific parameters to the draw uniform buffer.
   */
  private writeDrawUniforms(
    rgba: [number, number, number, number],
    lineWidth: number,
    opts: {
      feather?: number;
      dashLength?: number;
      gapLength?: number;
      dashOffset?: number;
      minValue?: number;
      maxValue?: number;
      colorScheme?: number;
      pointSize?: number;
      shape?: number;
      contourValue?: number;
      contourThickness?: number;
    } = {}
  ): void {
    if (!this.device || !this.drawUniformBuffer) return;

    const data = new Float32Array(DRAW_UNIFORM_BYTES / 4);

    // color (vec4) at offset 0
    data[0] = rgba[0];
    data[1] = rgba[1];
    data[2] = rgba[2];
    data[3] = rgba[3];

    // lineWidth at offset 4
    data[4] = lineWidth;
    // feather at offset 5
    data[5] = opts.feather ?? 1.5;
    // dashLength at offset 6
    data[6] = opts.dashLength ?? 10.0;
    // gapLength at offset 7
    data[7] = opts.gapLength ?? 5.0;
    // dashOffset at offset 8
    data[8] = opts.dashOffset ?? 0.0;
    // minValue at offset 9
    data[9] = opts.minValue ?? 0.0;
    // maxValue at offset 10
    data[10] = opts.maxValue ?? 1.0;

    // colorScheme at offset 11 (written as float, read as i32 in shader via bitcast)
    const intView = new Int32Array(data.buffer);
    intView[11] = opts.colorScheme ?? 0;

    // pointSize at offset 12
    data[12] = opts.pointSize ?? 8.0;
    // shape at offset 13 (i32)
    intView[13] = opts.shape ?? 0;

    // contourValue at offset 14
    data[14] = opts.contourValue ?? 0.0;
    // contourThickness at offset 15
    data[15] = opts.contourThickness ?? 0.01;

    this.device.queue.writeBuffer(this.drawUniformBuffer, 0, data);
  }

  // ---------------------------------------------------------------------------
  // Per-frame scene bind group (cached until view changes)
  // ---------------------------------------------------------------------------

  /**
   * Creates or reuses the per-frame scene bind group.
   * Only re-creates the bind group and re-writes the scene uniform buffer
   * when the scene uniforms have been marked dirty (e.g. view/resize change).
   */
  private ensureFrameSceneBindGroup(): void {
    if (!this.device || !this.sceneBindGroupLayout || !this.sceneUniformBuffer) return;
    if (!this.sceneUniformsDirty && this.frameSceneBindGroup) return;

    this.writeSceneUniforms();
    this.frameSceneBindGroup = this.device.createBindGroup({
      layout: this.sceneBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.sceneUniformBuffer } },
      ],
    });
    this.sceneUniformsDirty = false;
  }

  // ---------------------------------------------------------------------------
  // Matrix helpers
  // ---------------------------------------------------------------------------

  private updateViewMatrix(viewport: Viewport): void {
    const scaleX = 2 / (viewport.xMax - viewport.xMin);
    const scaleY = 2 / (viewport.yMax - viewport.yMin);
    const translateX = -(viewport.xMax + viewport.xMin) / 2;
    const translateY = -(viewport.yMax + viewport.yMin) / 2;

    const scale = scaling(scaleX, scaleY, 1);
    const translate = translation(translateX, translateY, 0);
    this.viewMatrix = multiply(scale, translate);
    this.sceneUniformsDirty = true;
  }

  private updateProjectionMatrix(): void {
    this.projectionMatrix = ortho(-1, 1, -1, 1, -1, 1);
  }

  // ---------------------------------------------------------------------------
  // Vertex buffer pool
  // ---------------------------------------------------------------------------

  /**
   * Returns a GPUBuffer large enough to hold `byteLength` bytes.
   * Grows the buffer if needed; reuses existing buffer otherwise.
   */
  private acquireVertexBuffer(byteLength: number): GPUBuffer {
    if (!this.device) throw new Error('Device not initialised');

    // Find first unused buffer with sufficient capacity
    for (const fb of this.vertexBuffers) {
      if (fb.capacity >= byteLength) {
        return fb.gpuBuffer;
      }
    }

    // Allocate new buffer (round up to next 64-byte boundary for alignment)
    const alignedSize = Math.ceil(byteLength / 64) * 64;
    const gpuBuffer = this.device.createBuffer({
      label: `vertex-pool-${this.vertexBuffers.length}`,
      size: alignedSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const entry: FrameBuffer = { gpuBuffer, capacity: alignedSize };
    this.vertexBuffers.push(entry);
    return gpuBuffer;
  }

  // ---------------------------------------------------------------------------
  // IRenderer.resize
  // ---------------------------------------------------------------------------

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    // Re-configure the canvas context for the new size
    if (this.device && this.context) {
      this.context.configure({
        device: this.device,
        format: this.preferredFormat,
        alphaMode: 'premultiplied',
      });
    }

    this.updateProjectionMatrix();
    this.sceneUniformsDirty = true;
  }

  // ---------------------------------------------------------------------------
  // IRenderer.dispose
  // ---------------------------------------------------------------------------

  dispose(): void {
    // Destroy vertex buffers
    for (const fb of this.vertexBuffers) {
      fb.gpuBuffer.destroy();
    }
    this.vertexBuffers = [];

    // Destroy uniform buffers
    if (this.sceneUniformBuffer) {
      this.sceneUniformBuffer.destroy();
      this.sceneUniformBuffer = null;
    }
    if (this.drawUniformBuffer) {
      this.drawUniformBuffer.destroy();
      this.drawUniformBuffer = null;
    }

    // Pipelines and shared layouts hold no GPU memory themselves, just clear
    this.pipelines.clear();
    this.sceneBindGroupLayout = null;
    this.drawBindGroupLayout = null;
    this.frameSceneBindGroup = null;
    this.sceneUniformsDirty = true;

    // Unconfigure canvas context before destroying device
    if (this.context) {
      this.context.unconfigure();
      this.context = null;
    }

    // Mark as lost so in-flight device.lost handlers don't re-init
    this.isLost = true;

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }

  // ---------------------------------------------------------------------------
  // IRenderer.getMetrics
  // ---------------------------------------------------------------------------

  getMetrics(): PerformanceMetrics {
    if ('memory' in performance) {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      this.metrics.memoryUsage = mem?.usedJSHeapSize ?? 0;
    }
    return { ...this.metrics };
  }

  // ---------------------------------------------------------------------------
  // FPS tracking
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Converts an array of Point2D to an interleaved Float32Array suitable for
   * uploading as a vertex buffer.
   */
  private pointsToFloat32(points: Point2D[]): Float32Array {
    const data = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p) {
        data[i * 2] = p.x;
        data[i * 2 + 1] = p.y;
      }
    }
    return data;
  }

  /**
   * Optional callback invoked when the device is recovered after a loss event.
   */
  onDeviceRecovered(callback: () => void): void {
    this.deviceLostCallback = callback;
  }

}
