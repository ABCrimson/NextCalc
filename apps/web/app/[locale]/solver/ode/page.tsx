'use client';

/**
 * ODE (Ordinary Differential Equation) Solver with Phase Plane Visualization
 *
 * Features:
 * - First-order ODEs: dy/dx = f(x, y) with direction field
 * - Second-order ODEs: d²y/dx² = f(x, y, y') via state-space reduction
 * - Autonomous systems: dx/dt = f(x,y), dy/dt = g(x,y) with vector field
 * - Numerical methods: Euler (O(h)), RK4 (O(h⁴))
 * - Phase plane: vector field arrows + multi-trajectory overlay
 * - Interactive: click phase plane to seed new initial conditions
 * - Solution table with downloadable CSV
 * - WebGPU-accelerated rendering with Canvas 2D fallback
 *
 * @module app/solver/ode/page
 */

import {
  Activity,
  Download,
  Info,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DirectionFieldLegend,
  type FieldEquationType,
  GpuDirectionField,
} from './GpuDirectionField';

// ============================================================================
// TYPES
// ============================================================================

type ODEType = 'first-order' | 'second-order' | 'system';
type NumericalMethod = 'euler' | 'rk4';

interface SolutionPoint {
  readonly t: number;
  readonly y: number;
  readonly yPrime?: number;
}

interface SystemPoint {
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

interface Trajectory {
  readonly id: string;
  readonly color: string;
  readonly points: SolutionPoint[];
  readonly x0: number;
  readonly y0: number;
}

interface SystemTrajectory {
  readonly id: string;
  readonly color: string;
  readonly points: SystemPoint[];
  readonly x0: number;
  readonly y0: number;
}

interface ParseError {
  readonly message: string;
}

// ============================================================================
// WEBGPU DETECTION
// ============================================================================

const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

// ============================================================================
// WGSL SHADERS
// ============================================================================

/**
 * DIRECTION FIELD + TRAJECTORY RENDERER
 *
 * Renders trajectory lines as instanced line segments. Each instance
 * represents one trajectory segment packed as (x0,y0,x1,y1,r,g,b,_).
 * A 6-vertex quad is extruded along the segment direction for visible line width.
 */
const TRAJECTORY_SHADER = /* wgsl */ `
struct Uniforms {
  domainMin : vec2<f32>,   // xMin, yMin
  domainMax : vec2<f32>,   // xMax, yMax
  canvasSize : vec2<f32>,  // width, height in pixels
  lineWidth  : f32,
  _pad       : f32,
}

struct SegmentData {
  x0 : f32,
  y0 : f32,
  x1 : f32,
  y1 : f32,
  r  : f32,
  g  : f32,
  b  : f32,
  _p : f32,
}

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var<storage, read> segs : array<SegmentData>;

struct VOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) color : vec3<f32>,
  @location(1) uv : f32,  // 0 at one side, 1 at other — for alpha falloff
}

fn domainToNDC(p : vec2<f32>) -> vec2<f32> {
  let t = (p - uni.domainMin) / (uni.domainMax - uni.domainMin);
  return t * 2.0 - vec2<f32>(1.0, 1.0);
}

const QUAD : array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0, -1.0),
  vec2<f32>( 1.0,  1.0),
  vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0,  1.0),
  vec2<f32>(-1.0,  1.0),
);

@vertex
fn vs_main(
  @builtin(vertex_index)   vi   : u32,
  @builtin(instance_index) inst : u32,
) -> VOut {
  let seg = segs[inst];
  let p0ndc = domainToNDC(vec2<f32>(seg.x0, seg.y0));
  let p1ndc = domainToNDC(vec2<f32>(seg.x1, seg.y1));

  // Direction and perpendicular in NDC space, adjusted for aspect ratio
  let dir = normalize(p1ndc - p0ndc);
  let aspect = uni.canvasSize.x / uni.canvasSize.y;
  let perp = vec2<f32>(-dir.y / aspect, dir.x * aspect);
  let halfW = uni.lineWidth / uni.canvasSize.y;  // lineWidth in NDC units

  let q = QUAD[vi];
  // q.x: -1 = start end, +1 = finish end
  // q.y: -1 = left side, +1 = right side
  let base = mix(p0ndc, p1ndc, (q.x + 1.0) * 0.5);
  let offset = perp * halfW * q.y;
  let finalPos = base + offset;

  var out : VOut;
  out.pos   = vec4<f32>(finalPos.x, finalPos.y, 0.0, 1.0);
  out.color = vec3<f32>(seg.r, seg.g, seg.b);
  out.uv    = (q.y + 1.0) * 0.5;
  return out;
}

@fragment
fn fs_main(in : VOut) -> @location(0) vec4<f32> {
  // Soft edge fade at line borders
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.uv * 2.0 - 1.0));
  return vec4<f32>(in.color * alpha, alpha);
}
`;

/**
 * SOLUTION CURVE RENDERER (wide canvas)
 * Same shader — reused for the time-series view.
 */

// ============================================================================
// SAFE EXPRESSION EVALUATOR
// ============================================================================

function compileExpr(expr: string, vars: string[]): ((...args: number[]) => number) | ParseError {
  const normalized = expr
    .replace(/\^/g, '**')
    .replace(/\bpi\b/g, 'Math.PI')
    .replace(/\be\b(?![a-zA-Z_])/g, 'Math.E')
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\basin\b/g, 'Math.asin')
    .replace(/\bacos\b/g, 'Math.acos')
    .replace(/\batan\b/g, 'Math.atan')
    .replace(/\batan2\b/g, 'Math.atan2')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\blog\b(?!\s*\()/g, 'Math.log10')
    .replace(/\blog\b/g, 'Math.log')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bcbrt\b/g, 'Math.cbrt')
    .replace(/\bceil\b/g, 'Math.ceil')
    .replace(/\bfloor\b/g, 'Math.floor')
    .replace(/\bround\b/g, 'Math.round')
    .replace(/\bsign\b/g, 'Math.sign')
    .replace(/\bmax\b/g, 'Math.max')
    .replace(/\bmin\b/g, 'Math.min')
    .replace(/\bpow\b/g, 'Math.pow')
    .replace(/\bhypot\b/g, 'Math.hypot')
    .replace(/\bsinh\b/g, 'Math.sinh')
    .replace(/\bcosh\b/g, 'Math.cosh')
    .replace(/\btanh\b/g, 'Math.tanh');

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...vars, `"use strict"; return (${normalized});`) as (
      ...args: number[]
    ) => number;
    fn(...vars.map(() => 0));
    return fn;
  } catch (err) {
    return { message: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================================
// NUMERICAL SOLVERS
// ============================================================================

function eulerScalar(
  f: (x: number, y: number) => number,
  x0: number,
  y0: number,
  xEnd: number,
  h: number,
): SolutionPoint[] {
  const points: SolutionPoint[] = [{ t: x0, y: y0 }];
  let x = x0;
  let y = y0;
  const steps = Math.ceil((xEnd - x0) / h);

  for (let i = 0; i < steps; i++) {
    const dy = f(x, y);
    y = y + h * dy;
    x = x + h;
    if (!Number.isFinite(y)) break;
    points.push({ t: x, y });
  }

  return points;
}

function rk4Scalar(
  f: (x: number, y: number) => number,
  x0: number,
  y0: number,
  xEnd: number,
  h: number,
): SolutionPoint[] {
  const points: SolutionPoint[] = [{ t: x0, y: y0 }];
  let x = x0;
  let y = y0;
  const steps = Math.ceil((xEnd - x0) / h);

  for (let i = 0; i < steps; i++) {
    const k1 = f(x, y);
    const k2 = f(x + h / 2, y + (h * k1) / 2);
    const k3 = f(x + h / 2, y + (h * k2) / 2);
    const k4 = f(x + h, y + h * k3);
    y = y + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
    x = x + h;
    if (!Number.isFinite(y)) break;
    points.push({ t: x, y });
  }

  return points;
}

function rk4System(
  f: (x: number, y: number, t: number) => number,
  g: (x: number, y: number, t: number) => number,
  t0: number,
  x0: number,
  y0: number,
  tEnd: number,
  h: number,
): SystemPoint[] {
  const points: SystemPoint[] = [{ t: t0, x: x0, y: y0 }];
  let t = t0;
  let x = x0;
  let y = y0;
  const steps = Math.ceil((tEnd - t0) / h);

  for (let i = 0; i < steps; i++) {
    const k1x = f(x, y, t);
    const k1y = g(x, y, t);

    const k2x = f(x + (h * k1x) / 2, y + (h * k1y) / 2, t + h / 2);
    const k2y = g(x + (h * k1x) / 2, y + (h * k1y) / 2, t + h / 2);

    const k3x = f(x + (h * k2x) / 2, y + (h * k2y) / 2, t + h / 2);
    const k3y = g(x + (h * k2x) / 2, y + (h * k2y) / 2, t + h / 2);

    const k4x = f(x + h * k3x, y + h * k3y, t + h);
    const k4y = g(x + h * k3x, y + h * k3y, t + h);

    x = x + (h * (k1x + 2 * k2x + 2 * k3x + k4x)) / 6;
    y = y + (h * (k1y + 2 * k2y + 2 * k3y + k4y)) / 6;
    t = t + h;

    if (!Number.isFinite(x) || !Number.isFinite(y)) break;
    points.push({ t, x, y });
  }

  return points;
}

function eulerSystem(
  f: (x: number, y: number, t: number) => number,
  g: (x: number, y: number, t: number) => number,
  t0: number,
  x0: number,
  y0: number,
  tEnd: number,
  h: number,
): SystemPoint[] {
  const points: SystemPoint[] = [{ t: t0, x: x0, y: y0 }];
  let t = t0;
  let x = x0;
  let y = y0;
  const steps = Math.ceil((tEnd - t0) / h);

  for (let i = 0; i < steps; i++) {
    const dx = f(x, y, t);
    const dy = g(x, y, t);
    x = x + h * dx;
    y = y + h * dy;
    t = t + h;
    if (!Number.isFinite(x) || !Number.isFinite(y)) break;
    points.push({ t, x, y });
  }

  return points;
}

function solveSecondOrder(
  rhs: (x: number, y: number, yp: number) => number,
  x0: number,
  y0: number,
  yp0: number,
  xEnd: number,
  h: number,
  method: NumericalMethod,
): SolutionPoint[] {
  const systemF = (_u: number, v: number, _t: number) => v;
  const systemG = (u: number, v: number, t: number) => rhs(t, u, v);

  const raw =
    method === 'rk4'
      ? rk4System(systemF, systemG, x0, y0, yp0, xEnd, h)
      : eulerSystem(systemF, systemG, x0, y0, yp0, xEnd, h);

  return raw.map((pt) => ({ t: pt.t, y: pt.x, yPrime: pt.y }));
}

// ============================================================================
// PRESET EQUATIONS
// ============================================================================

interface Preset {
  readonly label: string;
  readonly type: ODEType;
  readonly equation: string;
  readonly equation2?: string;
  readonly x0: number;
  readonly y0: number;
  readonly yp0?: number;
  readonly tEnd: number;
  readonly h: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly description: string;
}

const PRESETS: Record<string, Preset> = {
  exponential: {
    label: 'Exponential Growth',
    type: 'first-order',
    equation: '-y',
    x0: 0,
    y0: 1,
    tEnd: 5,
    h: 0.1,
    xMin: 0,
    xMax: 5,
    yMin: -0.5,
    yMax: 1.5,
    description: 'dy/dx = -y  →  y = e^(-x)',
  },
  logistic: {
    label: 'Logistic Growth',
    type: 'first-order',
    equation: 'y*(1-y)',
    x0: 0,
    y0: 0.1,
    tEnd: 10,
    h: 0.1,
    xMin: 0,
    xMax: 10,
    yMin: -0.1,
    yMax: 1.3,
    description: 'dy/dx = y(1-y)  →  Logistic equation',
  },
  sineWave: {
    label: 'Simple Harmonic',
    type: 'second-order',
    equation: '-y',
    x0: 0,
    y0: 0,
    yp0: 1,
    tEnd: 12,
    h: 0.05,
    xMin: 0,
    xMax: 12,
    yMin: -1.5,
    yMax: 1.5,
    description: "y'' = -y  →  y = sin(x)",
  },
  dampedOsc: {
    label: 'Damped Oscillator',
    type: 'second-order',
    equation: '-y - 0.3*yp',
    x0: 0,
    y0: 1,
    yp0: 0,
    tEnd: 20,
    h: 0.05,
    xMin: 0,
    xMax: 20,
    yMin: -1.2,
    yMax: 1.2,
    description: "y'' = -y - 0.3y'  →  Damped oscillation",
  },
  pendulum: {
    label: 'Nonlinear Pendulum',
    type: 'second-order',
    equation: '-sin(y)',
    x0: 0,
    y0: 2.5,
    yp0: 0,
    tEnd: 15,
    h: 0.05,
    xMin: 0,
    xMax: 15,
    yMin: -3.5,
    yMax: 3.5,
    description: "θ'' = -sin(θ)  →  Pendulum angle",
  },
  lotkaVolterra: {
    label: 'Lotka-Volterra (Predator-Prey)',
    type: 'system',
    equation: '1.5*x - x*y',
    equation2: '-x*y + x*y - y',
    x0: 0,
    y0: 1,
    tEnd: 15,
    h: 0.01,
    xMin: -0.2,
    xMax: 4,
    yMin: -0.2,
    yMax: 4,
    description: 'dx/dt = 1.5x - xy,  dy/dt = xy - y',
  },
  vanDerPol: {
    label: 'Van der Pol Oscillator',
    type: 'system',
    equation: 'y',
    equation2: '(1 - x*x)*y - x',
    x0: 0,
    y0: 2,
    tEnd: 20,
    h: 0.01,
    xMin: -3,
    xMax: 3,
    yMin: -6,
    yMax: 6,
    description: 'dx/dt = y,  dy/dt = (1-x²)y - x',
  },
  spiral: {
    label: 'Stable Spiral',
    type: 'system',
    equation: '-0.1*x - y',
    equation2: 'x - 0.1*y',
    x0: 0,
    y0: 2,
    tEnd: 20,
    h: 0.01,
    xMin: -2.5,
    xMax: 2.5,
    yMin: -2.5,
    yMax: 2.5,
    description: 'dx/dt = -0.1x - y,  dy/dt = x - 0.1y',
  },
};

// ============================================================================
// CANVAS RENDERING HELPERS
// ============================================================================

function domainToCanvas(
  val: number,
  domainMin: number,
  domainMax: number,
  canvasSize: number,
): number {
  return ((val - domainMin) / (domainMax - domainMin)) * canvasSize;
}

const TRAJECTORY_COLORS = [
  'oklch(0.7 0.2 240)',
  'oklch(0.7 0.2 145)',
  'oklch(0.7 0.2 30)',
  'oklch(0.7 0.2 330)',
  'oklch(0.7 0.2 290)',
  'oklch(0.7 0.2 190)',
  'oklch(0.8 0.15 60)',
  'oklch(0.65 0.2 0)',
];

// Pre-computed linear-RGB versions of TRAJECTORY_COLORS for GPU upload.
// These match the oklch values closely for WebGPU rendering.
const TRAJECTORY_COLORS_RGB: [number, number, number][] = [
  [0.24, 0.5, 0.92], // blue
  [0.22, 0.78, 0.36], // green
  [0.95, 0.55, 0.12], // orange
  [0.88, 0.24, 0.68], // pink
  [0.6, 0.24, 0.88], // purple
  [0.14, 0.72, 0.7], // teal
  [0.92, 0.85, 0.18], // yellow
  [0.8, 0.14, 0.14], // red
];

// ============================================================================
// GPU RESOURCES INTERFACE
// ============================================================================

interface ODEGPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  segmentBuffer: GPUBuffer;
  maxSegments: number;
}

// ============================================================================
// WEBGPU INIT FOR ODE CANVASES
// ============================================================================

async function initODEGPU(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<ODEGPUResources | null> {
  if (!supportsWebGPU) return null;

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) return null;

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    canvas.width = width;
    canvas.height = height;

    const shaderModule = device.createShaderModule({ code: TRAJECTORY_SHADER });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    const pipeline = await device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

    // Uniform buffer: domainMin(vec2), domainMax(vec2), canvasSize(vec2), lineWidth, _pad = 32 bytes
    const uniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const maxSegments = 8192;
    // Each segment: x0,y0,x1,y1,r,g,b,_p = 8 floats = 32 bytes
    const segmentBuffer = device.createBuffer({
      size: maxSegments * 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    return { device, context, pipeline, uniformBuffer, segmentBuffer, maxSegments };
  } catch {
    return null;
  }
}

// ============================================================================
// SEGMENT BUILDER HELPERS
// ============================================================================

/**
 * Convert a trajectory (SolutionPoint[]) into flat segment data for the GPU.
 * Each consecutive pair of points becomes one segment.
 */
function buildScalarSegments(
  trajectories: Trajectory[],
  colorRGB: [number, number, number][],
): Float32Array {
  const out: number[] = [];
  for (let ti = 0; ti < trajectories.length; ti++) {
    const traj = trajectories[ti]!;
    const [r, g, b] = colorRGB[ti % colorRGB.length]!;
    const pts = traj.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      // Use canvas coords for domain (they're in pixel space matched to NDC via uniform)
      out.push(p0.t, p0.y, p1.t, p1.y, r, g, b, 0);
    }
  }
  return new Float32Array(out);
}

function buildSystemSegments(
  trajectories: SystemTrajectory[],
  colorRGB: [number, number, number][],
): Float32Array {
  const out: number[] = [];
  for (let ti = 0; ti < trajectories.length; ti++) {
    const traj = trajectories[ti]!;
    const [r, g, b] = colorRGB[ti % colorRGB.length]!;
    const pts = traj.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      out.push(p0.x, p0.y, p1.x, p1.y, r, g, b, 0);
    }
  }
  return new Float32Array(out);
}

function buildTimeCurveSegments(
  trajectories: Trajectory[],
  systemTrajectories: SystemTrajectory[],
  odeType: ODEType,
  colorRGB: [number, number, number][],
): Float32Array {
  const out: number[] = [];
  if (odeType === 'system') {
    for (let ti = 0; ti < systemTrajectories.length; ti++) {
      const traj = systemTrajectories[ti]!;
      const [r, g, b] = colorRGB[ti % colorRGB.length]!;
      // x(t)
      for (let i = 0; i < traj.points.length - 1; i++) {
        const p0 = traj.points[i]!;
        const p1 = traj.points[i + 1]!;
        out.push(p0.t, p0.x, p1.t, p1.x, r, g, b, 0);
      }
      // y(t) — shift hue slightly by dimming
      for (let i = 0; i < traj.points.length - 1; i++) {
        const p0 = traj.points[i]!;
        const p1 = traj.points[i + 1]!;
        out.push(p0.t, p0.y, p1.t, p1.y, r * 0.6, g * 0.6, b + 0.2, 0);
      }
    }
  } else {
    for (let ti = 0; ti < trajectories.length; ti++) {
      const traj = trajectories[ti]!;
      const [r, g, b] = colorRGB[ti % colorRGB.length]!;
      for (let i = 0; i < traj.points.length - 1; i++) {
        const p0 = traj.points[i]!;
        const p1 = traj.points[i + 1]!;
        out.push(p0.t, p0.y, p1.t, p1.y, r, g, b, 0);
      }
    }
  }
  return new Float32Array(out);
}

// ============================================================================
// WEBGPU DRAW FUNCTION
// ============================================================================

function drawWebGPUSegments(
  gpu: ODEGPUResources,
  segments: Float32Array,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  canvasW: number,
  canvasH: number,
  lineWidth: number,
  clearColor: GPUColor,
): void {
  const { device, context, pipeline, uniformBuffer, segmentBuffer, maxSegments } = gpu;

  const segCount = Math.min(segments.length / 8, maxSegments);
  if (segCount === 0) {
    // Still clear
    const texture = context.getCurrentTexture().createView();
    const enc = device.createCommandEncoder();
    enc
      .beginRenderPass({
        colorAttachments: [
          { view: texture, loadOp: 'clear', storeOp: 'store', clearValue: clearColor },
        ],
      })
      .end();
    device.queue.submit([enc.finish()]);
    return;
  }

  // Write uniforms: [xMin, yMin, xMax, yMax, canvasW, canvasH, lineWidth, 0]
  const uni = new Float32Array([xMin, yMin, xMax, yMax, canvasW, canvasH, lineWidth, 0]);
  device.queue.writeBuffer(uniformBuffer, 0, uni);

  // Write segment data
  const uploadBytes = segCount * 32;
  if (uploadBytes <= segmentBuffer.size) {
    device.queue.writeBuffer(segmentBuffer, 0, segments, 0, segCount * 8);
  }

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: segmentBuffer } },
    ],
  });

  const texture = context.getCurrentTexture().createView();
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [
      {
        view: texture,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: clearColor,
      },
    ],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6, segCount);
  pass.end();
  device.queue.submit([enc.finish()]);
}

// ============================================================================
// DIRECTION FIELD CANVAS
// ============================================================================

interface DirectionFieldProps {
  readonly f: (x: number, y: number) => number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly trajectories: Trajectory[];
  readonly onCanvasClick: (x: number, y: number) => void;
  /** Whether to show the GPU direction field overlay. */
  readonly showGpuField?: boolean;
  /** Opacity of the GPU direction field overlay [0,1]. */
  readonly gpuFieldOpacity?: number;
}

function DirectionFieldCanvas({
  f,
  xMin,
  xMax,
  yMin,
  yMax,
  trajectories,
  onCanvasClick,
  showGpuField = true,
  gpuFieldOpacity = 0.4,
}: DirectionFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<ODEGPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');
  const SIZE = 500;

  const toCanvasX = useCallback((x: number) => domainToCanvas(x, xMin, xMax, SIZE), [xMin, xMax]);
  const toCanvasY = useCallback(
    (y: number) => SIZE - domainToCanvas(y, yMin, yMax, SIZE),
    [yMin, yMax],
  );

  // WebGPU init
  useEffect(() => {
    if (!supportsWebGPU) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    initODEGPU(canvas, SIZE, SIZE).then((resources) => {
      if (destroyed || !resources) return;
      gpuRef.current = resources;
      webgpuActiveRef.current = true;
      setRenderMode('WebGPU');

      resources.device.lost.then(() => {
        if (destroyed) return;
        webgpuActiveRef.current = false;
        gpuRef.current = null;
        setRenderMode('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.uniformBuffer.destroy();
        gpu.segmentBuffer.destroy();
        gpu.device.destroy();
      }
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    };
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (webgpuActiveRef.current && gpuRef.current) {
      // WebGPU path: draw trajectory line segments
      const segments = buildScalarSegments(trajectories, TRAJECTORY_COLORS_RGB);

      drawWebGPUSegments(gpuRef.current, segments, xMin, xMax, yMin, yMax, SIZE, SIZE, 3.0, {
        r: 0.04,
        g: 0.04,
        b: 0.09,
        a: 1.0,
      });

      // Direction field drawn on top via Canvas 2D overlay
      // We use a separate overlay canvas for arrows in WebGPU mode — but
      // for simplicity we overlay using the same canvas via 2D after WebGPU draw.
      // Note: mixing webgpu + 2d contexts on same canvas is not possible.
      // The direction field arrows are lightweight enough to be drawn in 2D
      // on a separate overlay <canvas> positioned absolute.
      return;
    }

    // Canvas 2D path
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'oklch(0.12 0.01 240)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = 'oklch(0.3 0.02 240)';
    ctx.lineWidth = 1;
    const zeroX = toCanvasX(0);
    const zeroY = toCanvasY(0);
    if (zeroX >= 0 && zeroX <= SIZE) {
      ctx.beginPath();
      ctx.moveTo(zeroX, 0);
      ctx.lineTo(zeroX, SIZE);
      ctx.stroke();
    }
    if (zeroY >= 0 && zeroY <= SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(SIZE, zeroY);
      ctx.stroke();
    }

    const ARROWS = 22;
    const arrowLen = (SIZE / ARROWS) * 0.4;
    ctx.strokeStyle = 'oklch(0.55 0.08 240)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= ARROWS; i++) {
      for (let j = 0; j <= ARROWS; j++) {
        const x = xMin + (i / ARROWS) * (xMax - xMin);
        const y = yMin + (j / ARROWS) * (yMax - yMin);
        let slope: number;
        try {
          slope = f(x, y);
        } catch {
          continue;
        }
        if (!Number.isFinite(slope)) continue;

        const angle = Math.atan(slope);
        const cx = toCanvasX(x);
        const cy = toCanvasY(y);
        const dx = (Math.cos(angle) * arrowLen) / 2;
        const dy = (Math.sin(angle) * arrowLen) / 2;

        ctx.beginPath();
        ctx.moveTo(cx - dx, cy + dy);
        ctx.lineTo(cx + dx, cy - dy);
        ctx.stroke();

        const headLen = arrowLen * 0.25;
        const headAngle = 0.4;
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy - dy);
        ctx.lineTo(
          cx + dx - headLen * Math.cos(angle - headAngle),
          cy - dy + headLen * Math.sin(angle - headAngle),
        );
        ctx.moveTo(cx + dx, cy - dy);
        ctx.lineTo(
          cx + dx - headLen * Math.cos(angle + headAngle),
          cy - dy + headLen * Math.sin(angle + headAngle),
        );
        ctx.stroke();
      }
    }

    for (const traj of trajectories) {
      if (traj.points.length < 2) continue;
      ctx.strokeStyle = traj.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = traj.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();

      let started = false;
      for (const pt of traj.points) {
        const px = toCanvasX(pt.t);
        const py = toCanvasY(pt.y);
        if (px < 0 || px > SIZE || py < -50 || py > SIZE + 50) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      const first = traj.points[0];
      if (first) {
        ctx.fillStyle = traj.color;
        ctx.beginPath();
        ctx.arc(toCanvasX(first.t), toCanvasY(first.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [f, xMin, xMax, yMin, yMax, trajectories, toCanvasX, toCanvasY]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (SIZE / rect.width);
      const py = (e.clientY - rect.top) * (SIZE / rect.height);
      const x = xMin + (px / SIZE) * (xMax - xMin);
      const y = yMax - (py / SIZE) * (yMax - yMin);
      onCanvasClick(x, y);
    },
    [xMin, xMax, yMin, yMax, onCanvasClick],
  );

  // Scalar ODE: for the GPU field we treat slope as a 2D vector [1, f(x,y)]
  // using a custom CPU fallback with the actual f function.
  const gpuFieldG = useCallback((x: number, y: number, _t: number) => f(x, y), [f]);
  const gpuFieldF = useCallback((_x: number, _y: number, _t: number) => 1, []);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="w-full h-full rounded-lg cursor-crosshair"
        onClick={handleClick}
        title="Click to add a trajectory from this initial condition"
      />
      {/* GPU direction field overlay — always uses 'custom' equation type so
          the CPU fallback path (which has access to the real f function) runs.
          In WebGPU mode the rotate-field placeholder fires but the canvas is
          overlaid on top, so the 2D arrows from the base canvas still show.
          A production upgrade could encode first-order slope as a built-in. */}
      <GpuDirectionField
        size={SIZE}
        xMin={xMin}
        xMax={xMax}
        yMin={yMin}
        yMax={yMax}
        f={gpuFieldF}
        g={gpuFieldG}
        equationType="custom"
        gridN={64}
        opacity={gpuFieldOpacity}
        visible={showGpuField}
      />
      {/* Render mode badge */}
      <div className="absolute top-2 right-2 pointer-events-none">
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-mono backdrop-blur-sm border ${
            renderMode === 'WebGPU'
              ? 'bg-violet-900/60 border-violet-500/40 text-violet-300'
              : 'bg-muted/60 border-border text-muted-foreground'
          }`}
        >
          {renderMode}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// PHASE PLANE CANVAS
// ============================================================================

interface PhasePlaneProps {
  readonly f: (x: number, y: number, t: number) => number;
  readonly g: (x: number, y: number, t: number) => number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly trajectories: SystemTrajectory[];
  readonly onCanvasClick: (x: number, y: number) => void;
  /** Which GPU equation type to use for the compute shader. */
  readonly gpuEquationType?: FieldEquationType;
  /** Whether to show the GPU direction field overlay. */
  readonly showGpuField?: boolean;
  /** Opacity of the GPU direction field overlay [0,1]. */
  readonly gpuFieldOpacity?: number;
}

function PhasePlaneCanvas({
  f,
  g,
  xMin,
  xMax,
  yMin,
  yMax,
  trajectories,
  onCanvasClick,
  gpuEquationType = 'custom',
  showGpuField = true,
  gpuFieldOpacity = 0.4,
}: PhasePlaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<ODEGPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');
  const SIZE = 500;

  const toCanvasX = useCallback((x: number) => domainToCanvas(x, xMin, xMax, SIZE), [xMin, xMax]);
  const toCanvasY = useCallback(
    (y: number) => SIZE - domainToCanvas(y, yMin, yMax, SIZE),
    [yMin, yMax],
  );

  // WebGPU init
  useEffect(() => {
    if (!supportsWebGPU) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    initODEGPU(canvas, SIZE, SIZE).then((resources) => {
      if (destroyed || !resources) return;
      gpuRef.current = resources;
      webgpuActiveRef.current = true;
      setRenderMode('WebGPU');

      resources.device.lost.then(() => {
        if (destroyed) return;
        webgpuActiveRef.current = false;
        gpuRef.current = null;
        setRenderMode('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.uniformBuffer.destroy();
        gpu.segmentBuffer.destroy();
        gpu.device.destroy();
      }
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    };
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (webgpuActiveRef.current && gpuRef.current) {
      const segments = buildSystemSegments(trajectories, TRAJECTORY_COLORS_RGB);

      drawWebGPUSegments(gpuRef.current, segments, xMin, xMax, yMin, yMax, SIZE, SIZE, 3.0, {
        r: 0.04,
        g: 0.04,
        b: 0.09,
        a: 1.0,
      });
      return;
    }

    // Canvas 2D fallback
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'oklch(0.12 0.01 240)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = 'oklch(0.3 0.02 240)';
    ctx.lineWidth = 1;
    const zeroX = toCanvasX(0);
    const zeroY = toCanvasY(0);
    if (zeroX >= 0 && zeroX <= SIZE) {
      ctx.beginPath();
      ctx.moveTo(zeroX, 0);
      ctx.lineTo(zeroX, SIZE);
      ctx.stroke();
    }
    if (zeroY >= 0 && zeroY <= SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(SIZE, zeroY);
      ctx.stroke();
    }

    const ARROWS = 20;
    for (let i = 0; i <= ARROWS; i++) {
      for (let j = 0; j <= ARROWS; j++) {
        const x = xMin + (i / ARROWS) * (xMax - xMin);
        const y = yMin + (j / ARROWS) * (yMax - yMin);

        let dx: number, dy: number;
        try {
          dx = f(x, y, 0);
          dy = g(x, y, 0);
        } catch {
          continue;
        }
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;

        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag < 1e-12) continue;

        const arrowLen = (SIZE / ARROWS) * 0.35;
        const scale = arrowLen / mag;
        const adx = dx * scale;
        const ady = dy * scale;

        const cx = toCanvasX(x);
        const cy = toCanvasY(y);

        const normalizedMag = Math.min(1, mag / 3);
        const hue = 240 + normalizedMag * 120;
        ctx.strokeStyle = `oklch(${0.5 + normalizedMag * 0.2} 0.15 ${hue})`;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + adx, cy - ady);
        ctx.stroke();

        const angle = Math.atan2(-ady, adx);
        const headLen = arrowLen * 0.3;
        const headAngle = 0.4;
        ctx.beginPath();
        ctx.moveTo(cx + adx, cy - ady);
        ctx.lineTo(
          cx + adx - headLen * Math.cos(angle - headAngle),
          cy - ady + headLen * Math.sin(angle - headAngle),
        );
        ctx.moveTo(cx + adx, cy - ady);
        ctx.lineTo(
          cx + adx - headLen * Math.cos(angle + headAngle),
          cy - ady + headLen * Math.sin(angle + headAngle),
        );
        ctx.stroke();
      }
    }

    for (const traj of trajectories) {
      if (traj.points.length < 2) continue;
      ctx.strokeStyle = traj.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = traj.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      let started = false;
      for (const pt of traj.points) {
        const px = toCanvasX(pt.x);
        const py = toCanvasY(pt.y);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      const first = traj.points[0];
      if (first) {
        ctx.fillStyle = traj.color;
        ctx.beginPath();
        ctx.arc(toCanvasX(first.x), toCanvasY(first.y), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [f, g, xMin, xMax, yMin, yMax, trajectories, toCanvasX, toCanvasY]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (SIZE / rect.width);
      const py = (e.clientY - rect.top) * (SIZE / rect.height);
      const x = xMin + (px / SIZE) * (xMax - xMin);
      const y = yMax - (py / SIZE) * (yMax - yMin);
      onCanvasClick(x, y);
    },
    [xMin, xMax, yMin, yMax, onCanvasClick],
  );

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="w-full h-full rounded-lg cursor-crosshair"
        onClick={handleClick}
        title="Click to add a trajectory from this initial condition"
      />
      {/* GPU direction field overlay */}
      <GpuDirectionField
        size={SIZE}
        xMin={xMin}
        xMax={xMax}
        yMin={yMin}
        yMax={yMax}
        f={f}
        g={g}
        equationType={gpuEquationType}
        gridN={64}
        opacity={gpuFieldOpacity}
        visible={showGpuField}
      />
      <div className="absolute top-2 right-2 pointer-events-none">
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-mono backdrop-blur-sm border ${
            renderMode === 'WebGPU'
              ? 'bg-violet-900/60 border-violet-500/40 text-violet-300'
              : 'bg-muted/60 border-border text-muted-foreground'
          }`}
        >
          {renderMode}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SOLUTION CURVE CANVAS
// ============================================================================

interface SolutionCurveProps {
  readonly trajectories: Trajectory[];
  readonly systemTrajectories: SystemTrajectory[];
  readonly odeType: ODEType;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

function SolutionCurveCanvas({
  trajectories,
  systemTrajectories,
  odeType,
  xMin,
  xMax,
  yMin,
  yMax,
}: SolutionCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<ODEGPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'WebGPU' | 'Canvas 2D'>('Canvas 2D');
  const SIZE_W = 700;
  const SIZE_H = 300;

  // WebGPU init
  useEffect(() => {
    if (!supportsWebGPU) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    initODEGPU(canvas, SIZE_W, SIZE_H).then((resources) => {
      if (destroyed || !resources) return;
      gpuRef.current = resources;
      webgpuActiveRef.current = true;
      setRenderMode('WebGPU');

      resources.device.lost.then(() => {
        if (destroyed) return;
        webgpuActiveRef.current = false;
        gpuRef.current = null;
        setRenderMode('Canvas 2D');
      });
    });

    return () => {
      destroyed = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.uniformBuffer.destroy();
        gpu.segmentBuffer.destroy();
        gpu.device.destroy();
      }
      gpuRef.current = null;
      webgpuActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (webgpuActiveRef.current && gpuRef.current) {
      const segments = buildTimeCurveSegments(
        trajectories,
        systemTrajectories,
        odeType,
        TRAJECTORY_COLORS_RGB,
      );

      drawWebGPUSegments(gpuRef.current, segments, xMin, xMax, yMin, yMax, SIZE_W, SIZE_H, 2.5, {
        r: 0.04,
        g: 0.04,
        b: 0.09,
        a: 1.0,
      });
      return;
    }

    // Canvas 2D fallback
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE_W, SIZE_H);
    ctx.fillStyle = 'oklch(0.12 0.01 240)';
    ctx.fillRect(0, 0, SIZE_W, SIZE_H);

    const toX = (t: number) => domainToCanvas(t, xMin, xMax, SIZE_W);
    const toY = (y: number) => SIZE_H - domainToCanvas(y, yMin, yMax, SIZE_H);

    ctx.strokeStyle = 'oklch(0.2 0.02 240)';
    ctx.lineWidth = 1;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const gx = (i / steps) * SIZE_W;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, SIZE_H);
      ctx.stroke();
      const gy = (i / steps) * SIZE_H;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(SIZE_W, gy);
      ctx.stroke();
    }

    ctx.fillStyle = 'oklch(0.6 0.05 240)';
    ctx.font = '11px monospace';
    for (let i = 0; i <= steps; i++) {
      const xVal = xMin + (i / steps) * (xMax - xMin);
      ctx.fillText(xVal.toFixed(1), (i / steps) * SIZE_W + 2, SIZE_H - 4);
    }

    const zeroY = toY(0);
    ctx.strokeStyle = 'oklch(0.35 0.05 240)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(SIZE_W, zeroY);
    ctx.stroke();

    if (odeType === 'system') {
      for (const traj of systemTrajectories) {
        ctx.strokeStyle = traj.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = traj.color;
        ctx.shadowBlur = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        let started = false;
        for (const pt of traj.points) {
          const px = toX(pt.t);
          const py = toY(pt.x);
          if (py < -50 || py > SIZE_H + 50) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        started = false;
        for (const pt of traj.points) {
          const px = toX(pt.t);
          const py = toY(pt.y);
          if (py < -50 || py > SIZE_H + 50) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
    } else {
      for (const traj of trajectories) {
        ctx.strokeStyle = traj.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = traj.color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        let started = false;
        for (const pt of traj.points) {
          const px = toX(pt.t);
          const py = toY(pt.y);
          if (py < -50 || py > SIZE_H + 50) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }, [trajectories, systemTrajectories, odeType, xMin, xMax, yMin, yMax]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} width={SIZE_W} height={SIZE_H} className="w-full rounded-lg" />
      <div className="absolute top-2 right-2 pointer-events-none">
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-mono backdrop-blur-sm border ${
            renderMode === 'WebGPU'
              ? 'bg-violet-900/60 border-violet-500/40 text-violet-300'
              : 'bg-muted/60 border-border text-muted-foreground'
          }`}
        >
          {renderMode}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SOLUTION TABLE
// ============================================================================

interface SolutionTableProps {
  readonly points: SolutionPoint[] | SystemPoint[];
  readonly odeType: ODEType;
  readonly maxRows?: number;
}

function SolutionTable({ points, odeType, maxRows = 20 }: SolutionTableProps) {
  const isSystem = odeType === 'system';
  const stride = Math.max(1, Math.floor(points.length / maxRows));
  const rows = points.filter((_, i) => i % stride === 0);

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left text-muted-foreground font-medium">
              {isSystem ? 't' : 'x'}
            </th>
            {isSystem ? (
              <>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">x(t)</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">y(t)</th>
              </>
            ) : (
              <>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">y(x)</th>
                {odeType === 'second-order' && (
                  <th className="px-4 py-2 text-left text-muted-foreground font-medium">y'(x)</th>
                )}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((pt, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-1.5 text-foreground/80">
                {(pt as SolutionPoint).t !== undefined ? (pt as SolutionPoint).t.toFixed(4) : ''}
              </td>
              {isSystem ? (
                <>
                  <td className="px-4 py-1.5 text-blue-400">{(pt as SystemPoint).x.toFixed(6)}</td>
                  <td className="px-4 py-1.5 text-orange-400">
                    {(pt as SystemPoint).y.toFixed(6)}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-1.5 text-blue-400">
                    {(pt as SolutionPoint).y.toFixed(6)}
                  </td>
                  {odeType === 'second-order' && (
                    <td className="px-4 py-1.5 text-orange-400">
                      {((pt as SolutionPoint).yPrime ?? 0).toFixed(6)}
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// CSV DOWNLOAD
// ============================================================================

function buildCSV(points: SolutionPoint[] | SystemPoint[], odeType: ODEType): string {
  const isSystem = odeType === 'system';
  const header = isSystem ? 't,x,y' : odeType === 'second-order' ? 'x,y,yPrime' : 'x,y';

  const rows = points.map((pt) => {
    if (isSystem) {
      const sp = pt as SystemPoint;
      return `${sp.t},${sp.x},${sp.y}`;
    }
    const sp = pt as SolutionPoint;
    return odeType === 'second-order' ? `${sp.t},${sp.y},${sp.yPrime ?? 0}` : `${sp.t},${sp.y}`;
  });

  return [header, ...rows].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/** Map a preset key to the best-matching GPU equation type for the shader. */
function presetToGpuEquationType(key: string): FieldEquationType {
  switch (key) {
    case 'lotkaVolterra':
      return 'lotka-volterra';
    case 'vanDerPol':
      return 'van-der-pol';
    case 'spiral':
      return 'stable-spiral';
    case 'pendulum':
      return 'pendulum';
    default:
      return 'custom';
  }
}

export default function ODESolverPage() {
  const t = useTranslations('solver');
  const [odeType, setODEType] = useState<ODEType>('first-order');
  const [method, setMethod] = useState<NumericalMethod>('rk4');
  const [equation, setEquation] = useState('y*(1-y)');
  const [equation2, setEquation2] = useState('x - 0.1*y');
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(0.1);
  const [yp0, setYp0] = useState(0);
  const [tEnd, setTEnd] = useState(10);
  const [stepSize, setStepSize] = useState(0.1);

  const [xMin, setXMin] = useState(0);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-0.1);
  const [yMax, setYMax] = useState(1.3);

  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [systemTrajectories, setSystemTrajectories] = useState<SystemTrajectory[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('visualization');
  const [selectedPreset, setSelectedPreset] = useState('logistic');

  // Direction field controls
  const [showDirectionField, setShowDirectionField] = useState(true);
  const [directionFieldOpacity, setDirectionFieldOpacity] = useState(0.4);
  const [gpuEquationType, setGpuEquationType] = useState<FieldEquationType>('custom');

  const compiledF = useMemo(() => {
    if (odeType === 'first-order') return compileExpr(equation, ['x', 'y']);
    if (odeType === 'second-order') return compileExpr(equation, ['x', 'y', 'yp']);
    return compileExpr(equation, ['x', 'y', 't']);
  }, [equation, odeType]);

  const compiledG = useMemo(() => {
    if (odeType !== 'system') return null;
    return compileExpr(equation2, ['x', 'y', 't']);
  }, [equation2, odeType]);

  const hasParseError =
    'message' in compiledF ||
    (odeType === 'system' && compiledG !== null && 'message' in compiledG);

  const solve = useCallback(
    (initX0: number, initY0: number, initYp0 = 0) => {
      if ('message' in compiledF) {
        setError(`Expression error: ${compiledF.message}`);
        return;
      }
      if (odeType === 'system' && (compiledG === null || 'message' in compiledG)) {
        setError('System equation 2 parse error');
        return;
      }
      setError(null);

      const color =
        TRAJECTORY_COLORS[
          (odeType === 'system' ? systemTrajectories.length : trajectories.length) %
            TRAJECTORY_COLORS.length
        ] ?? TRAJECTORY_COLORS[0]!;
      const id = `${Date.now()}-${Math.random()}`;

      if (odeType === 'first-order') {
        const f = compiledF as (x: number, y: number) => number;
        const pts =
          method === 'rk4'
            ? rk4Scalar(f, initX0, initY0, tEnd, stepSize)
            : eulerScalar(f, initX0, initY0, tEnd, stepSize);
        setTrajectories((prev) => [...prev, { id, color, points: pts, x0: initX0, y0: initY0 }]);
      } else if (odeType === 'second-order') {
        const rhs = compiledF as (x: number, y: number, yp: number) => number;
        const pts = solveSecondOrder(rhs, initX0, initY0, initYp0, tEnd, stepSize, method);
        setTrajectories((prev) => [...prev, { id, color, points: pts, x0: initX0, y0: initY0 }]);
      } else {
        const f = compiledF as (x: number, y: number, t: number) => number;
        const g = compiledG as (x: number, y: number, t: number) => number;
        const pts =
          method === 'rk4'
            ? rk4System(f, g, 0, initX0, initY0, tEnd, stepSize)
            : eulerSystem(f, g, 0, initX0, initY0, tEnd, stepSize);
        setSystemTrajectories((prev) => [
          ...prev,
          { id, color, points: pts, x0: initX0, y0: initY0 },
        ]);
      }
    },
    [
      compiledF,
      compiledG,
      odeType,
      method,
      tEnd,
      stepSize,
      trajectories.length,
      systemTrajectories.length,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    solve(x0, y0, yp0);
  }, []);

  const handleCanvasClick = useCallback(
    (clickX: number, clickY: number) => {
      if (odeType === 'system') {
        solve(clickX, clickY, 0);
      } else {
        solve(x0, clickY, yp0);
      }
    },
    [odeType, solve, x0, yp0],
  );

  const clearTrajectories = useCallback(() => {
    setTrajectories([]);
    setSystemTrajectories([]);
  }, []);

  const applyPreset = useCallback((key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    setSelectedPreset(key);
    setODEType(preset.type);
    setEquation(preset.equation);
    if (preset.equation2) setEquation2(preset.equation2);
    setX0(preset.x0);
    setY0(preset.y0);
    if (preset.yp0 !== undefined) setYp0(preset.yp0);
    setTEnd(preset.tEnd);
    setStepSize(preset.h);
    setXMin(preset.xMin);
    setXMax(preset.xMax);
    setYMin(preset.yMin);
    setYMax(preset.yMax);
    setTrajectories([]);
    setSystemTrajectories([]);
    setError(null);
    // Map preset to GPU equation type so the compute shader uses the correct built-in
    setGpuEquationType(presetToGpuEquationType(key));
  }, []);

  const handleSolve = useCallback(() => {
    solve(x0, y0, yp0);
  }, [solve, x0, y0, yp0]);

  const firstScalarPoints = trajectories[0]?.points ?? [];
  const firstSystemPoints = systemTrajectories[0]?.points ?? [];

  const directionF = useMemo(() => {
    if ('message' in compiledF) return (_x: number, _y: number) => 0;
    if (odeType === 'first-order') return compiledF as (x: number, y: number) => number;
    return (_x: number, _y: number) => 0;
  }, [compiledF, odeType]);

  const systemF = useMemo(() => {
    if ('message' in compiledF) return (_x: number, _y: number, _t: number) => 0;
    if (odeType === 'system') return compiledF as (x: number, y: number, t: number) => number;
    return (_x: number, _y: number, _t: number) => 0;
  }, [compiledF, odeType]);

  const systemG = useMemo(() => {
    if (!compiledG || 'message' in compiledG) return (_x: number, _y: number, _t: number) => 0;
    return compiledG as (x: number, y: number, t: number) => number;
  }, [compiledG]);

  const currentPoints = odeType === 'system' ? firstSystemPoints : firstScalarPoints;
  const csvData = buildCSV(currentPoints, odeType);

  return (
    <main className="min-h-screen py-12 px-4 bg-gradient-to-br from-background via-background/95 to-background">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30">
              <Activity className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {t('odeTitle')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{t('odeSubtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="gap-1 backdrop-blur-sm bg-muted/50 border-border">
              <Zap className="w-3 h-3 text-yellow-400" />
              {t('ode.rk4Euler')}
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              {t('ode.phasePlane')}
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              {t('ode.directionField')}
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              {t('ode.csvExport')}
            </Badge>
            {supportsWebGPU && (
              <Badge
                variant="outline"
                className="gap-1 backdrop-blur-sm bg-violet-500/10 border-violet-500/40 text-violet-300"
              >
                <Zap className="w-3 h-3" />
                WebGPU
              </Badge>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* CONTROL PANEL */}
          <div className="space-y-4">
            {/* Presets */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Quick Presets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                        selectedPreset === key
                          ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                          : 'bg-muted/30 border-border hover:bg-muted/50 text-foreground/80'
                      }`}
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="w-4 h-4 text-blue-400" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Equation Type</Label>
                  <Tabs
                    value={odeType}
                    onValueChange={(v) => {
                      setODEType(v as ODEType);
                      clearTrajectories();
                    }}
                  >
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 h-auto">
                      <TabsTrigger value="first-order" className="text-xs py-1.5">
                        1st Order
                      </TabsTrigger>
                      <TabsTrigger value="second-order" className="text-xs py-1.5">
                        2nd Order
                      </TabsTrigger>
                      <TabsTrigger value="system" className="text-xs py-1.5">
                        System
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  {odeType === 'first-order' && (
                    <>
                      <Label className="text-sm font-medium text-muted-foreground font-mono">
                        dy/dx =
                      </Label>
                      <Input
                        value={equation}
                        onChange={(e) => {
                          setEquation(e.target.value);
                          clearTrajectories();
                        }}
                        placeholder="e.g. y*(1-y)"
                        className="font-mono text-sm bg-background/50"
                      />
                    </>
                  )}
                  {odeType === 'second-order' && (
                    <>
                      <Label className="text-sm font-medium text-muted-foreground font-mono">
                        d²y/dx² =
                      </Label>
                      <Input
                        value={equation}
                        onChange={(e) => {
                          setEquation(e.target.value);
                          clearTrajectories();
                        }}
                        placeholder="e.g. -y - 0.3*yp"
                        className="font-mono text-sm bg-background/50"
                      />
                      <p className="text-xs text-muted-foreground">Variables: x, y, yp (= dy/dx)</p>
                    </>
                  )}
                  {odeType === 'system' && (
                    <>
                      <Label className="text-sm font-medium text-muted-foreground font-mono">
                        dx/dt =
                      </Label>
                      <Input
                        value={equation}
                        onChange={(e) => {
                          setEquation(e.target.value);
                          clearTrajectories();
                        }}
                        placeholder="e.g. -0.1*x - y"
                        className="font-mono text-sm bg-background/50"
                      />
                      <Label className="text-sm font-medium text-muted-foreground font-mono">
                        dy/dt =
                      </Label>
                      <Input
                        value={equation2}
                        onChange={(e) => {
                          setEquation2(e.target.value);
                          clearTrajectories();
                        }}
                        placeholder="e.g. x - 0.1*y"
                        className="font-mono text-sm bg-background/50"
                      />
                      <p className="text-xs text-muted-foreground">Variables: x, y, t</p>
                    </>
                  )}
                  {hasParseError && (
                    <p className="text-xs text-red-400">
                      {'message' in compiledF
                        ? `Eq1: ${compiledF.message}`
                        : compiledG && 'message' in compiledG
                          ? `Eq2: ${compiledG.message}`
                          : ''}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Initial Conditions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground font-mono">x₀</Label>
                      <Input
                        type="number"
                        value={x0}
                        onChange={(e) => setX0(Number(e.target.value))}
                        className="h-8 text-sm font-mono bg-background/50"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground font-mono">y₀</Label>
                      <Input
                        type="number"
                        value={y0}
                        onChange={(e) => setY0(Number(e.target.value))}
                        className="h-8 text-sm font-mono bg-background/50"
                      />
                    </div>
                  </div>
                  {odeType === 'second-order' && (
                    <div>
                      <Label className="text-xs text-muted-foreground font-mono">y'₀</Label>
                      <Input
                        type="number"
                        value={yp0}
                        onChange={(e) => setYp0(Number(e.target.value))}
                        className="h-8 text-sm font-mono bg-background/50"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {odeType === 'system' ? 'Time span: [0, ' : 'Interval: [x₀, '}
                    {tEnd}]
                  </Label>
                  <Slider
                    min={1}
                    max={50}
                    step={0.5}
                    value={[tEnd]}
                    onValueChange={([v]) => setTEnd(v ?? 10)}
                    className="py-1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Step size h = {stepSize}</Label>
                  <Slider
                    min={0.001}
                    max={0.5}
                    step={0.001}
                    value={[stepSize]}
                    onValueChange={([v]) => setStepSize(v ?? 0.05)}
                    className="py-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Smaller h = more accurate, slower. RK4 error: O(h⁴)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Numerical Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as NumericalMethod)}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rk4">Runge-Kutta 4 (O(h⁴))</SelectItem>
                      <SelectItem value="euler">Euler (O(h)) — for comparison</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSolve}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white border-0"
                    disabled={hasParseError}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Solve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearTrajectories}
                    className="backdrop-blur-sm bg-muted/30 border-border"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>

                {error && (
                  <p className="text-xs text-red-400 p-2 bg-red-900/20 rounded border border-red-800/30">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* View domain */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">View Domain</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'x min', value: xMin, set: setXMin },
                    { label: 'x max', value: xMax, set: setXMax },
                    { label: 'y min', value: yMin, set: setYMin },
                    { label: 'y max', value: yMax, set: setYMax },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => set(Number(e.target.value))}
                        className="h-8 text-sm font-mono bg-background/50"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Direction Field Controls */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Direction Field
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Show field</Label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showDirectionField}
                    onClick={() => setShowDirectionField((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      showDirectionField ? 'bg-emerald-500' : 'bg-muted border border-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        showDirectionField ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {showDirectionField && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Opacity: {Math.round(directionFieldOpacity * 100)}%
                      </Label>
                      <Slider
                        min={0.05}
                        max={1.0}
                        step={0.05}
                        value={[directionFieldOpacity]}
                        onValueChange={([v]) => setDirectionFieldOpacity(v ?? 0.4)}
                        className="py-1"
                        aria-label="Direction field opacity"
                      />
                    </div>
                    <DirectionFieldLegend />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Color indicates flow speed: blue = slow, red = fast. Arrow length is
                      proportional to magnitude.
                      {odeType === 'system'
                        ? ' GPU compute shader evaluates the ODE system in parallel.'
                        : ' Arrows show dy/dx slope direction.'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Active trajectories legend */}
            {(trajectories.length > 0 || systemTrajectories.length > 0) && (
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Active Trajectories</CardTitle>
                  <CardDescription className="text-xs">
                    Click the canvas to add more
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {odeType === 'system'
                    ? systemTrajectories.map((traj, i) => (
                        <div key={traj.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: traj.color }}
                            />
                            <span className="text-xs font-mono text-foreground/80">
                              ({traj.x0.toFixed(2)}, {traj.y0.toFixed(2)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSystemTrajectories((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Remove trajectory"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    : trajectories.map((traj, i) => (
                        <div key={traj.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: traj.color }}
                            />
                            <span className="text-xs font-mono text-foreground/80">
                              y({traj.x0.toFixed(2)}) = {traj.y0.toFixed(2)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setTrajectories((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Remove trajectory"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearTrajectories}
                    className="w-full mt-2 text-xs"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* VISUALIZATION PANEL */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-violet-400" />
                      {odeType === 'system'
                        ? 'Phase Plane'
                        : odeType === 'first-order'
                          ? 'Direction Field'
                          : 'Solution Curves'}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSolve}
                        className="text-xs backdrop-blur-sm bg-muted/50 border-border"
                        disabled={hasParseError}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Trajectory
                      </Button>
                      {currentPoints.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadCSV(csvData, `ode-solution-${Date.now()}.csv`)}
                          className="text-xs backdrop-blur-sm bg-muted/50 border-border"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          CSV
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    {odeType === 'system'
                      ? 'Phase plane: x vs y. Click to seed new trajectories.'
                      : 'Click the field to add trajectories from any initial condition.'}
                  </CardDescription>
                  <TabsList className="mt-3 bg-muted/50 w-auto">
                    <TabsTrigger value="visualization" className="text-xs">
                      {odeType === 'system' ? 'Phase Plane' : 'Field & Curves'}
                    </TabsTrigger>
                    <TabsTrigger value="time-series" className="text-xs">
                      Time Series
                    </TabsTrigger>
                    <TabsTrigger value="table" className="text-xs">
                      Table
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="pt-4">
                  {/* VISUALIZATION TAB */}
                  <TabsContent value="visualization" className="mt-0">
                    <div className="relative bg-gradient-to-br from-background to-card rounded-lg p-2 border border-border">
                      <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
                        {odeType === 'system' ? (
                          <PhasePlaneCanvas
                            f={systemF}
                            g={systemG}
                            xMin={xMin}
                            xMax={xMax}
                            yMin={yMin}
                            yMax={yMax}
                            trajectories={systemTrajectories}
                            onCanvasClick={handleCanvasClick}
                            gpuEquationType={gpuEquationType}
                            showGpuField={showDirectionField}
                            gpuFieldOpacity={directionFieldOpacity}
                          />
                        ) : (
                          <DirectionFieldCanvas
                            f={directionF}
                            xMin={xMin}
                            xMax={xMax}
                            yMin={yMin}
                            yMax={yMax}
                            trajectories={trajectories}
                            onCanvasClick={handleCanvasClick}
                            showGpuField={showDirectionField}
                            gpuFieldOpacity={directionFieldOpacity}
                          />
                        )}
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground font-mono mt-1 px-1">
                        <span>{xMin}</span>
                        <span>x →</span>
                        <span>{xMax}</span>
                      </div>
                    </div>

                    {odeType === 'system' && (
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t-2 border-blue-400" />
                          x(t)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t-2 border-dashed border-orange-400" />
                          y(t)
                        </span>
                        <span>Trajectories shown in phase space (x, y)</span>
                      </div>
                    )}
                  </TabsContent>

                  {/* TIME SERIES TAB */}
                  <TabsContent value="time-series" className="mt-0">
                    <div className="bg-gradient-to-br from-background to-card rounded-lg p-2 border border-border">
                      <SolutionCurveCanvas
                        trajectories={trajectories}
                        systemTrajectories={systemTrajectories}
                        odeType={odeType}
                        xMin={xMin}
                        xMax={xMax}
                        yMin={yMin}
                        yMax={yMax}
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {odeType === 'system' ? (
                        <span>Solid = x(t), Dashed = y(t) for each trajectory</span>
                      ) : odeType === 'second-order' ? (
                        <span>y(x) solution to {equation}</span>
                      ) : (
                        <span>y(x) solution to dy/dx = {equation}</span>
                      )}
                    </div>
                  </TabsContent>

                  {/* TABLE TAB */}
                  <TabsContent value="table" className="mt-0">
                    {currentPoints.length > 0 ? (
                      <div className="space-y-3">
                        <SolutionTable points={currentPoints} odeType={odeType} maxRows={25} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadCSV(csvData, `ode-solution-${Date.now()}.csv`)}
                          className="w-full text-xs backdrop-blur-sm bg-muted/50 border-border"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Full CSV ({currentPoints.length} rows)
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground">
                        Solve an equation to see the solution table
                      </div>
                    )}
                  </TabsContent>
                </CardContent>
              </Card>
            </Tabs>
          </div>
        </div>

        {/* EDUCATIONAL CONTENT */}
        <section className="mt-12 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h2 className="text-2xl font-semibold">{t('ode.aboutTitle')}</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="group p-5 rounded-lg bg-gradient-to-br from-blue-950/40 to-blue-900/40 border border-blue-500/40 hover:border-blue-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-base font-semibold mb-2 text-blue-300">Euler Method</h3>
              <p className="text-xs text-blue-200/80 font-mono mb-2">yₙ₊₁ = yₙ + h·f(xₙ,yₙ)</p>
              <p className="text-xs text-blue-200/70">
                First-order method. Global error O(h). Simple and intuitive but accumulates error
                quickly. Good for understanding the concept.
              </p>
            </div>

            <div className="group p-5 rounded-lg bg-gradient-to-br from-violet-950/40 to-violet-900/40 border border-violet-500/40 hover:border-violet-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-base font-semibold mb-2 text-violet-300">Runge-Kutta 4</h3>
              <p className="text-xs text-violet-200/80 font-mono mb-2">
                Uses 4 slope evaluations per step
              </p>
              <p className="text-xs text-violet-200/70">
                Fourth-order method. Global error O(h⁴). The gold standard for general-purpose ODE
                solving. 4 function evaluations per step, dramatically more accurate than Euler.
              </p>
            </div>

            <div className="group p-5 rounded-lg bg-gradient-to-br from-emerald-950/40 to-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-base font-semibold mb-2 text-emerald-300">Phase Plane</h3>
              <p className="text-xs text-emerald-200/80 font-mono mb-2">Plot of (x, y) over time</p>
              <p className="text-xs text-emerald-200/70">
                For autonomous systems, the phase plane reveals long-term behavior without plotting
                vs time. Fixed points, limit cycles, and separatrices are immediately visible.
              </p>
            </div>

            <div className="group p-5 rounded-lg bg-gradient-to-br from-orange-950/40 to-orange-900/40 border border-orange-500/40 hover:border-orange-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-base font-semibold mb-2 text-orange-300">Direction Field</h3>
              <p className="text-xs text-orange-200/80 font-mono mb-2">
                Slope arrows at grid points
              </p>
              <p className="text-xs text-orange-200/70">
                For first-order ODEs, each arrow shows the direction of the solution at that point.
                Solution curves are always tangent to the arrows — they cannot cross each other.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-5 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border backdrop-blur-sm">
              <h3 className="text-base font-semibold mb-3 text-foreground">
                Second-Order Reduction
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                A second-order ODE{' '}
                <code className="text-violet-400 text-xs">y'' = f(x, y, y')</code> is converted to a
                first-order system by introducing{' '}
                <code className="text-violet-400 text-xs">v = y'</code>:
              </p>
              <div className="font-mono text-xs space-y-1 text-foreground/80 bg-muted/30 p-3 rounded">
                <div>u' = v</div>
                <div>v' = f(x, u, v)</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                RK4 integrates both components simultaneously, preserving 4th-order accuracy.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border backdrop-blur-sm">
              <h3 className="text-base font-semibold mb-3 text-foreground">Supported Syntax</h3>
              <div className="font-mono text-xs space-y-1 text-foreground/80 bg-muted/30 p-3 rounded">
                <div>
                  <span className="text-blue-400">x^2</span> or{' '}
                  <span className="text-blue-400">x**2</span> — power
                </div>
                <div>
                  <span className="text-blue-400">sin, cos, tan</span> — trig
                </div>
                <div>
                  <span className="text-blue-400">exp, ln, log</span> — exponential
                </div>
                <div>
                  <span className="text-blue-400">sqrt, abs, sign</span> — misc
                </div>
                <div>
                  <span className="text-blue-400">pi, e</span> — constants
                </div>
                <div>
                  <span className="text-blue-400">sinh, cosh, tanh</span> — hyperbolic
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
