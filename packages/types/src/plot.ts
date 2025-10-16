/**
 * Plotting and visualization types
 */

// Plot configuration
export type PlotType = '2d' | '3d' | 'parametric' | 'polar';

export interface PlotConfig {
  readonly type: PlotType;
  readonly functions: readonly PlotFunction[];
  readonly viewport: Viewport;
  readonly style: PlotStyle;
}

export interface PlotFunction {
  readonly expression: string;
  readonly color: string;
  readonly label?: string;
}

export interface Viewport {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin?: number;
  readonly zMax?: number;
}

export interface PlotStyle {
  readonly lineWidth: number;
  readonly showGrid: boolean;
  readonly showAxes: boolean;
  readonly backgroundColor: string;
}

// Plot data
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Point3D extends Point2D {
  readonly z: number;
}

// Sampling configuration
export interface SamplingConfig {
  readonly xMin: number;
  readonly xMax: number;
  readonly tolerance: number;
  readonly maxDepth: number;
}
