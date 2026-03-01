/**
 * Core type definitions for the NextCalc Pro plot engine
 * @module types
 */

/** 2D point in Cartesian coordinates */
export interface Point2D {
  x: number;
  y: number;
}

/** 3D point in Cartesian coordinates */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** 2D point in polar coordinates */
export interface PolarPoint {
  r: number;
  theta: number;
}

/** Parametric curve point with parameter value */
export interface ParametricPoint2D extends Point2D {
  t: number;
}

/** Parametric surface point with parameter values */
export interface ParametricPoint3D extends Point3D {
  u: number;
  v: number;
}

/** Plot types discriminated union */
export type PlotType =
  | '2d-cartesian'
  | '2d-polar'
  | '2d-parametric'
  | '2d-implicit'
  | '2d-vector-field'
  | '3d-surface'
  | '3d-parametric'
  | '3d-curve'
  | '3d-parametric-curve';

/** Coordinate system types */
export type CoordinateSystem = 'cartesian' | 'polar' | 'parametric';

/** Rendering backend types */
export type RenderBackend = 'webgl2' | 'webgpu' | 'canvas2d';

/** Color representation (RGB or hex) */
export type Color = string | { r: number; g: number; b: number; a?: number };

/** Line style options */
export interface LineStyle {
  width: number;
  color: Color;
  dashPattern?: number[];
  opacity?: number;
}

/** Point marker style */
export interface MarkerStyle {
  enabled: boolean;
  size: number;
  shape: 'circle' | 'square' | 'triangle' | 'cross';
  color: Color;
  opacity?: number;
}

/** Plot style configuration */
export interface PlotStyle {
  line: LineStyle;
  marker?: MarkerStyle;
  fill?: {
    enabled: boolean;
    color: Color;
    opacity: number;
  };
}

/** Viewport bounds */
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin?: number;
  zMax?: number;
}

/** Axis configuration */
export interface AxisConfig {
  label: string;
  min: number;
  max: number;
  scale: 'linear' | 'logarithmic';
  grid: {
    enabled: boolean;
    majorStep: number;
    minorStep?: number;
    color: Color;
    opacity: number;
  };
  ticks: {
    enabled: boolean;
    format: (value: number) => string;
  };
}

/** Plot configuration for 2D Cartesian plots */
export interface Plot2DCartesianConfig {
  type: '2d-cartesian';
  functions: Array<{
    fn: (x: number) => number;
    label?: string;
    style?: Partial<PlotStyle>;
  }>;
  viewport: Omit<Viewport, 'zMin' | 'zMax'>;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  title?: string;
  legend?: {
    enabled: boolean;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
}

/** Plot configuration for 2D polar plots */
export interface Plot2DPolarConfig {
  type: '2d-polar';
  functions: Array<{
    fn: (theta: number) => number;
    label?: string;
    style?: Partial<PlotStyle>;
  }>;
  thetaRange: { min: number; max: number };
  rRange: { min: number; max: number };
  /** Center offset for panning the polar plot (defaults to {x:0, y:0}) */
  center?: { x: number; y: number };
  title?: string;
}

/** Plot configuration for 2D parametric curves */
export interface Plot2DParametricConfig {
  type: '2d-parametric';
  functions: Array<{
    x: (t: number) => number;
    y: (t: number) => number;
    label?: string;
    style?: Partial<PlotStyle>;
  }>;
  tRange: { min: number; max: number };
  viewport: Omit<Viewport, 'zMin' | 'zMax'>;
  title?: string;
}

/** Plot configuration for 3D surface plots */
export interface Plot3DSurfaceConfig {
  type: '3d-surface';
  fn: (x: number, y: number) => number;
  viewport: Viewport;
  resolution: { x: number; y: number };
  colorMap?:
    | 'viridis'
    | 'plasma'
    | 'turbo'
    | 'rainbow'
    | 'inferno'
    | 'coolwarm'
    | 'cividis'
    | 'magma'
    | 'spectral';
  wireframe?: boolean;
  title?: string;
}

/** Plot configuration for 3D parametric surfaces */
export interface Plot3DParametricSurfaceConfig {
  type: '3d-parametric';
  functions: {
    x: (u: number, v: number) => number;
    y: (u: number, v: number) => number;
    z: (u: number, v: number) => number;
  };
  uRange: { min: number; max: number };
  vRange: { min: number; max: number };
  resolution: { u: number; v: number };
  colorMap?:
    | 'viridis'
    | 'plasma'
    | 'turbo'
    | 'rainbow'
    | 'inferno'
    | 'coolwarm'
    | 'cividis'
    | 'magma'
    | 'spectral';
  title?: string;
}

/** Plot configuration for 3D parametric curves */
export interface Plot3DCurveConfig {
  type: '3d-curve';
  functions: {
    x: (t: number) => number;
    y: (t: number) => number;
    z: (t: number) => number;
  };
  tRange: { min: number; max: number };
  style?: Partial<PlotStyle>;
  title?: string;
}

/**
 * Plot configuration for 2D implicit plots f(x,y) = 0
 * Uses marching squares algorithm to find contours where f(x,y) ≈ 0
 * Examples: x² + y² = 25 (circle), x²/16 + y²/9 = 1 (ellipse)
 */
export interface Plot2DImplicitConfig {
  type: '2d-implicit';
  /** Implicit function that returns f(x,y). Zero contour will be plotted */
  fn: (x: number, y: number) => number;
  /** Viewport bounds for sampling the function */
  viewport: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  /** Grid resolution for marching squares (default: 200x200) */
  resolution?: { x: number; y: number };
  /** Tolerance for considering values close to zero (default: 0.1) */
  tolerance?: number;
  /** Visual styling for the contour line */
  style?: {
    line?: LineStyle;
  };
  /** X-axis configuration */
  xAxis?: AxisConfig;
  /** Y-axis configuration */
  yAxis?: AxisConfig;
  title?: string;
}

/**
 * Plot configuration for 2D vector fields
 * Visualizes vector-valued functions F(x,y) = (P(x,y), Q(x,y))
 * Useful for differential equations, fluid dynamics, gradient fields
 */
export interface Plot2DVectorFieldConfig {
  type: '2d-vector-field';
  /** Vector field components */
  field: {
    /** x-component of vector field: dx/dt or P(x,y) */
    x: (x: number, y: number) => number;
    /** y-component of vector field: dy/dt or Q(x,y) */
    y: (x: number, y: number) => number;
  };
  /** Viewport bounds for the vector field */
  viewport: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  /** Number of sample points in each direction (default: 20x20) */
  resolution?: { x: number; y: number };
  /** Visual styling for arrows */
  style?: {
    arrow?: {
      /** Arrow color */
      color?: string;
      /** Scale factor for arrow length (default: 0.5) */
      scale?: number;
      /** Normalize all arrows to same length (default: false) */
      normalize?: boolean;
      /** Arrow head size relative to shaft (default: 0.2) */
      headSize?: number;
    };
  };
  /** X-axis configuration */
  xAxis?: AxisConfig;
  /** Y-axis configuration */
  yAxis?: AxisConfig;
  title?: string;
}

/**
 * Plot configuration for 3D parametric curves
 * Renders space curves defined by x(t), y(t), z(t)
 * Examples: helices, knots, Lissajous curves
 */
export interface Plot3DParametricCurveConfig {
  type: '3d-parametric-curve';
  /** Parametric functions defining the curve */
  functions: {
    x: (t: number) => number;
    y: (t: number) => number;
    z: (t: number) => number;
  };
  /** Parameter range */
  tRange: { min: number; max: number };
  /** Number of samples along the curve (default: 1000) */
  samples?: number;
  /** Visual styling */
  style?: {
    line?: {
      /** Line width (limited by WebGL) */
      width?: number;
      /** Line color */
      color?: string;
    };
    /** Tube rendering for better 3D visualization */
    tube?: {
      /** Enable tube geometry instead of line */
      enabled: boolean;
      /** Tube radius (default: 0.05) */
      radius?: number;
      /** Number of radial segments (default: 8) */
      radialSegments?: number;
    };
  };
  title?: string;
}

/** Discriminated union of all plot configurations */
export type PlotConfig =
  | Plot2DCartesianConfig
  | Plot2DPolarConfig
  | Plot2DParametricConfig
  | Plot2DImplicitConfig
  | Plot2DVectorFieldConfig
  | Plot3DSurfaceConfig
  | Plot3DParametricSurfaceConfig
  | Plot3DCurveConfig
  | Plot3DParametricCurveConfig;

/** Adaptive sampling configuration */
export interface SamplingConfig {
  initialSamples: number;
  maxDepth: number;
  angleTolerance: number;
  method: 'recursive-subdivision' | 'curvature-based' | 'uniform';
  useGPU?: boolean;
}

/** Renderer initialization options */
export interface RendererOptions {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  backend?: RenderBackend;
}

/** Camera configuration for 3D plots */
export interface CameraConfig {
  position: Point3D;
  target: Point3D;
  fov: number;
  near: number;
  far: number;
}

/** Lighting configuration for 3D plots */
export interface LightingConfig {
  ambient: {
    color: Color;
    intensity: number;
  };
  directional: Array<{
    color: Color;
    intensity: number;
    position: Point3D;
  }>;
}

/** Export options for PNG */
export interface ExportPNGOptions {
  width: number;
  height: number;
  scale?: number;
  backgroundColor?: Color;
  transparent?: boolean;
}

/** Export options for SVG */
export interface ExportSVGOptions {
  width: number;
  height: number;
  embedFonts?: boolean;
  backgroundColor?: Color;
}

/** Export options for CSV */
export interface ExportCSVOptions {
  delimiter?: string;
  includeHeader?: boolean;
  precision?: number;
}

/** Performance metrics */
export interface PerformanceMetrics {
  initTime: number;
  renderTime: number;
  frameTime: number;
  fps: number;
  memoryUsage: number;
  pointCount: number;
  drawCalls: number;
}

/** Renderer interface that all renderers must implement */
export interface IRenderer {
  readonly backend: RenderBackend;
  readonly canvas: HTMLCanvasElement;

  initialize(): Promise<void>;
  render(config: PlotConfig): void;
  resize(width: number, height: number): void;
  dispose(): void;
  getMetrics(): PerformanceMetrics;
}

/** Control event types */
export interface ControlEvent {
  type: 'zoom' | 'pan' | 'rotate' | 'reset';
  data: unknown;
}

/** Interaction controller interface */
export interface IInteractionController {
  enable(): void;
  disable(): void;
  reset(): void;
  addEventListener(type: string, handler: (event: ControlEvent) => void): void;
  removeEventListener(type: string, handler: (event: ControlEvent) => void): void;
}

/** Type guard for 2D plot configurations */
export function is2DPlot(
  config: PlotConfig,
): config is
  | Plot2DCartesianConfig
  | Plot2DPolarConfig
  | Plot2DParametricConfig
  | Plot2DImplicitConfig
  | Plot2DVectorFieldConfig {
  return config.type.startsWith('2d-');
}

/** Type guard for 3D plot configurations */
export function is3DPlot(
  config: PlotConfig,
): config is
  | Plot3DSurfaceConfig
  | Plot3DParametricSurfaceConfig
  | Plot3DCurveConfig
  | Plot3DParametricCurveConfig {
  return config.type.startsWith('3d-');
}

/** Type guard for parametric plots */
export function isParametricPlot(
  config: PlotConfig,
): config is
  | Plot2DParametricConfig
  | Plot3DParametricSurfaceConfig
  | Plot3DCurveConfig
  | Plot3DParametricCurveConfig {
  return config.type.includes('parametric') || config.type === '3d-curve';
}

/** Type guard for surface plots */
export function isSurfacePlot(
  config: PlotConfig,
): config is Plot3DSurfaceConfig | Plot3DParametricSurfaceConfig {
  return config.type === '3d-surface' || config.type === '3d-parametric';
}

/** Type guard for implicit plots */
export function isImplicitPlot(config: PlotConfig): config is Plot2DImplicitConfig {
  return config.type === '2d-implicit';
}

/** Type guard for vector field plots */
export function isVectorFieldPlot(config: PlotConfig): config is Plot2DVectorFieldConfig {
  return config.type === '2d-vector-field';
}
