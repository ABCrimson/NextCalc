/**
 * Canvas 2D Renderer — minimal fallback for browsers without WebGL2/WebGPU.
 *
 * Supports 2D Cartesian, polar, and parametric plots using the Canvas 2D API.
 * No shader compilation required — works on every browser, including legacy
 * mobile devices and environments where GPU acceleration is disabled.
 *
 * Limitations vs GPU renderers:
 * - No instanced grid rendering (drawn line-by-line instead)
 * - No implicit/vector-field support (throws descriptive error)
 * - Lower throughput for high-density plots (>10k points)
 *
 * @module renderers/canvas-2d
 */

import type {
  IRenderer,
  RenderBackend,
  PerformanceMetrics,
  PlotConfig,
  Plot2DCartesianConfig,
  Plot2DPolarConfig,
  Plot2DParametricConfig,
  Viewport,
  Color,
} from '../types/index';

/** Resolve a Color union to a CSS string */
function colorToCSS(c: Color | undefined, fallback: string): string {
  if (!c) return fallback;
  if (typeof c === 'string') return c;
  const a = c.a ?? 1;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

export class Canvas2DRenderer implements IRenderer {
  readonly backend: RenderBackend = 'canvas2d';
  readonly canvas: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D | null = null;
  private initTime = 0;
  private lastRenderTime = 0;
  private lastFrameTime = 0;
  private pointCount = 0;
  private drawCalls = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
    const start = performance.now();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable — rendering is not possible in this environment.');
    }
    this.ctx = ctx;
    this.initTime = performance.now() - start;
  }

  render(config: PlotConfig): void {
    if (!this.ctx) throw new Error('Canvas2DRenderer not initialized');
    const start = performance.now();
    this.pointCount = 0;
    this.drawCalls = 0;

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
      default:
        throw new Error(`Canvas2DRenderer: plot type "${config.type}" is not supported in fallback mode. Use a WebGL-capable browser for full functionality.`);
    }

    this.lastRenderTime = performance.now() - start;
    this.lastFrameTime = this.lastRenderTime;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  dispose(): void {
    this.ctx = null;
  }

  getMetrics(): PerformanceMetrics {
    return {
      initTime: this.initTime,
      renderTime: this.lastRenderTime,
      frameTime: this.lastFrameTime,
      fps: this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 0,
      memoryUsage: 0,
      pointCount: this.pointCount,
      drawCalls: this.drawCalls,
    };
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  /** Map a world X coordinate to canvas pixel X */
  private worldToCanvasX(x: number, vp: Omit<Viewport, 'zMin' | 'zMax'>): number {
    return ((x - vp.xMin) / (vp.xMax - vp.xMin)) * this.canvas.width;
  }

  /** Map a world Y coordinate to canvas pixel Y (Y-axis inverted for canvas) */
  private worldToCanvasY(y: number, vp: Omit<Viewport, 'zMin' | 'zMax'>): number {
    return this.canvas.height - ((y - vp.yMin) / (vp.yMax - vp.yMin)) * this.canvas.height;
  }

  /** Clear canvas with background color */
  private clear(bgColor?: string): void {
    const ctx = this.ctx!;
    ctx.fillStyle = bgColor ?? '#0a0a0a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawCalls++;
  }

  /** Draw grid lines */
  private drawGrid(vp: Omit<Viewport, 'zMin' | 'zMax'>, gridColor: string, gridOpacity: number, majorStepX: number, majorStepY: number): void {
    const ctx = this.ctx!;
    ctx.strokeStyle = gridColor;
    ctx.globalAlpha = gridOpacity;
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    const startX = Math.ceil(vp.xMin / majorStepX) * majorStepX;
    for (let x = startX; x <= vp.xMax; x += majorStepX) {
      const cx = this.worldToCanvasX(x, vp);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, this.canvas.height);
      ctx.stroke();
      this.drawCalls++;
    }

    // Horizontal grid lines
    const startY = Math.ceil(vp.yMin / majorStepY) * majorStepY;
    for (let y = startY; y <= vp.yMax; y += majorStepY) {
      const cy = this.worldToCanvasY(y, vp);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(this.canvas.width, cy);
      ctx.stroke();
      this.drawCalls++;
    }

    ctx.globalAlpha = 1;
  }

  /** Draw axes */
  private drawAxes(vp: Omit<Viewport, 'zMin' | 'zMax'>, color: string): void {
    const ctx = this.ctx!;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // X axis (if in viewport)
    if (vp.yMin <= 0 && vp.yMax >= 0) {
      const y0 = this.worldToCanvasY(0, vp);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(this.canvas.width, y0);
      ctx.stroke();
      this.drawCalls++;
    }

    // Y axis (if in viewport)
    if (vp.xMin <= 0 && vp.xMax >= 0) {
      const x0 = this.worldToCanvasX(0, vp);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, this.canvas.height);
      ctx.stroke();
      this.drawCalls++;
    }
  }

  // ---------------------------------------------------------------------------
  // Cartesian
  // ---------------------------------------------------------------------------

  private renderCartesian(config: Plot2DCartesianConfig): void {
    const ctx = this.ctx!;
    const vp = config.viewport;

    this.clear();

    // Grid
    if (config.xAxis.grid.enabled) {
      this.drawGrid(
        vp,
        colorToCSS(config.xAxis.grid.color, 'rgba(255,255,255,0.1)'),
        config.xAxis.grid.opacity,
        config.xAxis.grid.majorStep,
        config.yAxis.grid.majorStep,
      );
    }

    // Axes
    this.drawAxes(vp, 'rgba(255,255,255,0.6)');

    // Functions
    const defaultColors = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#f87171'] as const;
    let colorIdx = 0;
    for (const fn of config.functions) {
      const lineColor = colorToCSS(fn.style?.line?.color, defaultColors[colorIdx % defaultColors.length] ?? '#38bdf8');
      colorIdx++;
      const lineWidth = fn.style?.line?.width ?? 2;

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const steps = Math.max(this.canvas.width, 500);
      let started = false;

      for (let i = 0; i <= steps; i++) {
        const x = vp.xMin + (i / steps) * (vp.xMax - vp.xMin);
        const y = fn.fn(x);
        this.pointCount++;

        if (!Number.isFinite(y)) {
          started = false;
          continue;
        }

        const cx = this.worldToCanvasX(x, vp);
        const cy = this.worldToCanvasY(y, vp);

        if (!started) {
          ctx.moveTo(cx, cy);
          started = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }

      ctx.stroke();
      this.drawCalls++;
    }

    // Tick labels
    this.drawTickLabels(vp, config.xAxis, config.yAxis);
  }

  /** Draw tick labels for axes */
  private drawTickLabels(
    vp: Omit<Viewport, 'zMin' | 'zMax'>,
    xAxis: Plot2DCartesianConfig['xAxis'],
    yAxis: Plot2DCartesianConfig['yAxis'],
  ): void {
    const ctx = this.ctx!;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X tick labels
    if (xAxis.ticks.enabled) {
      const y0 = Math.min(Math.max(this.worldToCanvasY(0, vp), 0), this.canvas.height - 15);
      const startX = Math.ceil(vp.xMin / xAxis.grid.majorStep) * xAxis.grid.majorStep;
      for (let x = startX; x <= vp.xMax; x += xAxis.grid.majorStep) {
        if (Math.abs(x) < 1e-10) continue;
        const cx = this.worldToCanvasX(x, vp);
        ctx.fillText(xAxis.ticks.format(x), cx, y0 + 4);
      }
    }

    // Y tick labels
    if (yAxis.ticks.enabled) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const x0 = Math.min(Math.max(this.worldToCanvasX(0, vp), 15), this.canvas.width);
      const startY = Math.ceil(vp.yMin / yAxis.grid.majorStep) * yAxis.grid.majorStep;
      for (let y = startY; y <= vp.yMax; y += yAxis.grid.majorStep) {
        if (Math.abs(y) < 1e-10) continue;
        const cy = this.worldToCanvasY(y, vp);
        ctx.fillText(yAxis.ticks.format(y), x0 - 4, cy);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Polar
  // ---------------------------------------------------------------------------

  private renderPolar(config: Plot2DPolarConfig): void {
    const ctx = this.ctx!;
    const rMax = config.rRange.max;
    const cx = config.center?.x ?? 0;
    const cy = config.center?.y ?? 0;
    const vp = { xMin: cx - rMax, xMax: cx + rMax, yMin: cy - rMax, yMax: cy + rMax };

    this.clear();
    this.drawAxes(vp, 'rgba(255,255,255,0.3)');

    const defaultPolarColors = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399'] as const;
    let pColorIdx = 0;
    for (const fn of config.functions) {
      ctx.strokeStyle = colorToCSS(fn.style?.line?.color, defaultPolarColors[pColorIdx % defaultPolarColors.length] ?? '#38bdf8');
      pColorIdx++;
      ctx.lineWidth = fn.style?.line?.width ?? 2;
      ctx.beginPath();

      const steps = 720;
      let started = false;

      for (let i = 0; i <= steps; i++) {
        const theta = config.thetaRange.min + (i / steps) * (config.thetaRange.max - config.thetaRange.min);
        const r = fn.fn(theta);
        this.pointCount++;

        if (!Number.isFinite(r)) { started = false; continue; }

        const wx = cx + r * Math.cos(theta);
        const wy = cy + r * Math.sin(theta);
        const px = this.worldToCanvasX(wx, vp);
        const py = this.worldToCanvasY(wy, vp);

        if (!started) { ctx.moveTo(px, py); started = true; }
        else { ctx.lineTo(px, py); }
      }

      ctx.stroke();
      this.drawCalls++;
    }
  }

  // ---------------------------------------------------------------------------
  // Parametric
  // ---------------------------------------------------------------------------

  private renderParametric(config: Plot2DParametricConfig): void {
    const ctx = this.ctx!;
    const vp = config.viewport;

    this.clear();
    this.drawGrid(vp, 'rgba(255,255,255,0.1)', 0.3, 1, 1);
    this.drawAxes(vp, 'rgba(255,255,255,0.6)');

    const defaultParamColors = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399'] as const;
    let paramColorIdx = 0;
    for (const fn of config.functions) {
      ctx.strokeStyle = colorToCSS(fn.style?.line?.color, defaultParamColors[paramColorIdx % defaultParamColors.length] ?? '#38bdf8');
      paramColorIdx++;
      ctx.lineWidth = fn.style?.line?.width ?? 2;
      ctx.beginPath();

      const steps = 1000;
      let started = false;

      for (let i = 0; i <= steps; i++) {
        const t = config.tRange.min + (i / steps) * (config.tRange.max - config.tRange.min);
        const x = fn.x(t);
        const y = fn.y(t);
        this.pointCount++;

        if (!Number.isFinite(x) || !Number.isFinite(y)) { started = false; continue; }

        const px = this.worldToCanvasX(x, vp);
        const py = this.worldToCanvasY(y, vp);

        if (!started) { ctx.moveTo(px, py); started = true; }
        else { ctx.lineTo(px, py); }
      }

      ctx.stroke();
      this.drawCalls++;
    }
  }
}
