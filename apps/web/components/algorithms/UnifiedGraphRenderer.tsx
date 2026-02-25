'use client';

/**
 * Unified GPU-Accelerated Graph Renderer
 *
 * Rendering path:
 * 1. WebGPU (preferred):
 *    - Compute shader runs force-directed physics in parallel across all nodes.
 *    - Render pipeline draws anti-aliased circles for nodes and lines for edges.
 * 2. Canvas 2D fallback: full existing implementation, unchanged.
 *
 * Edge flow particles are rendered on a separate overlay canvas in the Canvas 2D
 * path. They are not rendered in WebGPU mode (fallback only) since the overlay
 * canvas sits on top regardless.
 */

import { useRef, useEffect, useState, useCallback, useMemo, type MouseEvent, type WheelEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Particle System Types
// ============================================================================

interface RendererParticle {
  /** Index into the edges array */
  edgeIndex: number;
  /** Progress along edge: 0 = source node, 1 = target node */
  t: number;
  /** Fraction of edge length per millisecond */
  speed: number;
  opacity: number;
  /** Radius in canvas-world units (before pan/zoom) */
  radius: number;
  color: string;
  direction: 1 | -1;
  trail: number[];
}

interface RendererRipple {
  nodeId: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  color: string;
}

interface ParticleSystemState {
  particles: RendererParticle[];
  ripples: RendererRipple[];
}

const RENDERER_TRAIL_LENGTH = 6;
const RENDERER_MAX_PARTICLES = 500;

function rendererGetEdgeColor(state: GraphEdge['state']): string {
  switch (state) {
    case 'current': return 'rgba(251, 191, 36, 0.85)';
    case 'path':    return 'rgba(74, 222, 128, 0.85)';
    case 'visited': return 'rgba(167, 139, 250, 0.85)';
    default:        return 'rgba(148, 163, 184, 0.4)';
  }
}

function rendererBezierPoint(
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

/** Straight-line midpoint perpendicular offset for a slight curve matching the
 *  simple straight edges the renderer draws. Since the renderer uses straight
 *  lines (not bezier), cx/cy are just the midpoint with zero offset. */
function rendererEdgeControl(
  sx: number, sy: number,
  tx: number, ty: number,
): { cx: number; cy: number } {
  return { cx: (sx + tx) / 2, cy: (sy + ty) / 2 };
}

// ============================================================================
// Types and Interfaces
// ============================================================================

export type NodeId = string;
export type EdgeId = string;

export interface GraphNode {
  id: NodeId;
  label: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  state?: 'unvisited' | 'current' | 'visited' | 'path' | 'start' | 'end';
  weight?: number;
  heuristic?: number;
  distance?: number;
}

export interface GraphEdge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  weight?: number;
  directed?: boolean;
  state?: 'unvisited' | 'current' | 'visited' | 'path';
  flow?: number;
}

export interface GraphConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeRadius?: number;
  showLabels?: boolean;
  showEdgeWeights?: boolean;
  showArrows?: boolean;
  enablePhysics?: boolean;
  forceStrength?: number;
}

export interface GraphInteraction {
  type: 'node-click' | 'node-drag-start' | 'node-drag' | 'node-drag-end' | 'canvas-click';
  nodeId?: NodeId;
  position?: { x: number; y: number };
}

export interface UnifiedGraphRendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  config?: GraphConfig;
  onInteraction?: (interaction: GraphInteraction) => void;
  onNodeClick?: (nodeId: NodeId) => void;
  className?: string;
  /** Enable/disable edge flow particles and node ripple effects */
  showParticles?: boolean;
}

// ============================================================================
// Color Palette
// ============================================================================

const COLORS = {
  node: {
    unvisited: { fill: 'rgba(147, 197, 253, 0.9)', stroke: 'rgba(96, 165, 250, 1)', glow: 'rgba(96, 165, 250, 0.4)' },
    current:   { fill: 'rgba(251, 191, 36, 0.95)',  stroke: 'rgba(245, 158, 11, 1)', glow: 'rgba(245, 158, 11, 0.6)' },
    visited:   { fill: 'rgba(196, 181, 253, 0.9)',  stroke: 'rgba(167, 139, 250, 1)', glow: 'rgba(167, 139, 250, 0.3)' },
    path:      { fill: 'rgba(134, 239, 172, 0.95)', stroke: 'rgba(74, 222, 128, 1)',  glow: 'rgba(74, 222, 128, 0.5)' },
    start:     { fill: 'rgba(252, 165, 165, 0.95)', stroke: 'rgba(248, 113, 113, 1)', glow: 'rgba(248, 113, 113, 0.5)' },
    end:       { fill: 'rgba(134, 239, 172, 0.95)', stroke: 'rgba(34, 197, 94, 1)',   glow: 'rgba(34, 197, 94, 0.6)' },
  },
  edge: {
    unvisited: 'rgba(148, 163, 184, 0.5)',
    current:   'rgba(251, 191, 36, 0.9)',
    visited:   'rgba(167, 139, 250, 0.7)',
    path:      'rgba(74, 222, 128, 0.9)',
  },
  label: {
    text: '#1e293b',
    background: 'rgba(255, 255, 255, 0.95)',
    border: 'rgba(148, 163, 184, 0.3)',
  },
};

// ============================================================================
// WebGPU detection
// ============================================================================

const supportsWebGPU =
  typeof navigator !== 'undefined' && 'gpu' in navigator;

// ============================================================================
// WGSL shaders
// ============================================================================

/**
 * Compute shader: one workgroup invocation per node.
 * Reads positions + velocities, applies charge repulsion + spring attraction,
 * writes back updated positions.
 */
const PHYSICS_COMPUTE = /* wgsl */ `
struct Node {
  x   : f32,
  y   : f32,
  vx  : f32,
  vy  : f32,
  fx  : f32,  // >= 0 = pinned (fx/fy hold fixed position)
  fy  : f32,
  _p0 : f32,
  _p1 : f32,
};

struct Edge {
  src : u32,
  dst : u32,
  _p0 : u32,
  _p1 : u32,
};

struct Params {
  nodeCount   : u32,
  edgeCount   : u32,
  width       : f32,
  height      : f32,
  forceStrength: f32,
  alpha       : f32,
  _p0         : u32,
  _p1         : u32,
};

@group(0) @binding(0) var<storage, read_write> nodes : array<Node>;
@group(0) @binding(1) var<storage, read>       edges : array<Edge>;
@group(0) @binding(2) var<uniform>             params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= params.nodeCount) { return; }

  var node = nodes[i];

  // If pinned, snap to fixed position
  if (node.fx >= 0.0) {
    node.x  = node.fx;
    node.y  = node.fy;
    node.vx = 0.0;
    node.vy = 0.0;
    nodes[i] = node;
    return;
  }

  var dvx = 0.0;
  var dvy = 0.0;

  // Charge repulsion
  for (var j : u32 = 0u; j < params.nodeCount; j++) {
    if (j == i) { continue; }
    let other = nodes[j];
    let dx = other.x - node.x;
    let dy = other.y - node.y;
    let dist2 = dx * dx + dy * dy + 0.01;
    let dist  = sqrt(dist2);
    let force = (params.forceStrength * 100.0) / dist2;
    dvx -= (dx / dist) * force * params.alpha;
    dvy -= (dy / dist) * force * params.alpha;
  }

  // Spring attraction along edges
  for (var e : u32 = 0u; e < params.edgeCount; e++) {
    let edge = edges[e];
    var other : Node;
    var sign   = 1.0;
    if (edge.src == i) {
      other = nodes[edge.dst];
    } else if (edge.dst == i) {
      other = nodes[edge.src];
      sign  = 1.0;
    } else {
      continue;
    }
    let dx   = other.x - node.x;
    let dy   = other.y - node.y;
    let dist = max(sqrt(dx * dx + dy * dy), 0.01);
    let targetDist = 100.0;
    let force = (dist - targetDist) * 0.1 * params.forceStrength;
    dvx += sign * (dx / dist) * force * params.alpha;
    dvy += sign * (dy / dist) * force * params.alpha;
  }

  // Center force
  dvx += (params.width  / 2.0 - node.x) * 0.01 * params.alpha;
  dvy += (params.height / 2.0 - node.y) * 0.01 * params.alpha;

  node.vx = (node.vx + dvx) * 0.9;
  node.vy = (node.vy + dvy) * 0.9;
  node.x  = clamp(node.x + node.vx, 50.0, params.width  - 50.0);
  node.y  = clamp(node.y + node.vy, 50.0, params.height - 50.0);
  nodes[i] = node;
}
`;

/**
 * Render pipeline: draws node circles as screen-space quads using instance_index.
 * Anti-aliased circles via SDF in the fragment shader.
 */
const NODE_RENDER = /* wgsl */ `
struct Node {
  x   : f32, y   : f32,
  vx  : f32, vy  : f32,
  fx  : f32, fy  : f32,
  _p0 : f32, _p1 : f32,
};

struct NodeMeta {
  r : f32, g : f32, b : f32,  // fill colour
  radius : f32,
};

struct Camera {
  panX    : f32,
  panY    : f32,
  zoom    : f32,
  canvasW : f32,
  canvasH : f32,
  _p0     : u32,
  _p1     : u32,
  _p2     : u32,
};

@group(0) @binding(0) var<storage, read> nodes     : array<Node>;
@group(0) @binding(1) var<storage, read> nodeMetas : array<NodeMeta>;
@group(0) @binding(2) var<uniform>       camera    : Camera;

struct VOut {
  @builtin(position) pos    : vec4<f32>,
  @location(0)       uv     : vec2<f32>,
  @location(1)       colour : vec3<f32>,
};

const QUAD = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
  vec2<f32>( 1.0, -1.0), vec2<f32>(1.0,  1.0), vec2<f32>(-1.0, 1.0),
);

@vertex
fn vs_main(
  @builtin(vertex_index)   vi   : u32,
  @builtin(instance_index) inst : u32,
) -> VOut {
  var out : VOut;
  let node   = nodes[inst];
  let meta   = nodeMetas[inst];
  let radius = meta.radius;

  // World → screen
  let sx = (node.x * camera.zoom + camera.panX);
  let sy = (node.y * camera.zoom + camera.panY);

  let local = QUAD[vi] * radius * camera.zoom;
  let cx = sx + local.x;
  let cy = sy + local.y;

  let ndcX = (cx / camera.canvasW) * 2.0 - 1.0;
  let ndcY = 1.0 - (cy / camera.canvasH) * 2.0;

  out.pos    = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.uv     = QUAD[vi];
  out.colour = vec3<f32>(meta.r, meta.g, meta.b);
  return out;
}

@fragment
fn fs_main(@location(0) uv : vec2<f32>, @location(1) colour : vec3<f32>) -> @location(0) vec4<f32> {
  let dist = length(uv);
  if (dist > 1.0) { discard; }
  // Anti-aliased edge
  let alpha = 1.0 - smoothstep(0.88, 1.0, dist);
  return vec4<f32>(colour, alpha);
}
`;

/**
 * Compute shader: advances particle positions along edges on the GPU.
 * Each invocation updates one particle's t (progress) and direction
 * based on speed, direction, and whether the edge is directed.
 */
const PARTICLE_COMPUTE = /* wgsl */ `
struct ParticleParams {
  particleCount : u32,
  dt            : f32,
  _pad0         : u32,
  _pad1         : u32,
}

struct Particle {
  edgeIdx   : u32,    // which edge
  t         : f32,    // position [0,1]
  speed     : f32,    // travel speed
  direction : f32,    // 1.0 or -1.0
  opacity   : f32,
  radius    : f32,
  isDirected: u32,    // 1 = directed edge, 0 = undirected
  _pad      : u32,
}

@group(0) @binding(0) var<uniform>            params    : ParticleParams;
@group(0) @binding(1) var<storage, read_write> particles : array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particleCount) { return; }

  var p = particles[idx];
  p.t += p.speed * params.dt * p.direction;

  // Wrap/bounce
  if (p.direction > 0.0 && p.t >= 1.0) {
    if (p.isDirected == 1u) {
      p.t = 0.0;
    } else {
      p.t = 1.0;
      p.direction = -1.0;
    }
  } else if (p.direction < 0.0 && p.t <= 0.0) {
    p.t = 0.0;
    p.direction = 1.0;
  }

  particles[idx] = p;
}
`;

interface GPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  computePipeline: GPUComputePipeline;
  nodePipeline: GPURenderPipeline;
  nodeBuffer: GPUBuffer;      // Node structs (position, vel, fixed)
  edgeBuffer: GPUBuffer;      // Edge structs (src, dst)
  nodeMetaBuffer: GPUBuffer;  // Per-node colour + radius
  cameraBuffer: GPUBuffer;
  computeParamBuffer: GPUBuffer;
  maxNodes: number;
  maxEdges: number;
  // Particle compute resources (optional — created after physics pipeline)
  particleComputePipeline?: GPUComputePipeline;
  particleBuffer?: GPUBuffer;        // Storage buffer: array<Particle>
  particleParamBuffer?: GPUBuffer;   // Uniform buffer: ParticleParams
  particleStagingBuffer?: GPUBuffer; // MAP_READ buffer for readback
}

// ============================================================================
// Physics Simulation (CPU fallback)
// ============================================================================

function applyForces(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: Required<GraphConfig>
): void {
  const { forceStrength, width, height } = config;
  const alpha = 0.3;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = (nodes[j]!.x ?? 0) - (nodes[i]!.x ?? 0);
      const dy = (nodes[j]!.y ?? 0) - (nodes[i]!.y ?? 0);
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (forceStrength * 100) / (distance * distance);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      nodes[i]!.vx = (nodes[i]!.vx ?? 0) - fx * alpha;
      nodes[i]!.vy = (nodes[i]!.vy ?? 0) - fy * alpha;
      nodes[j]!.vx = (nodes[j]!.vx ?? 0) + fx * alpha;
      nodes[j]!.vy = (nodes[j]!.vy ?? 0) + fy * alpha;
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const dx = (target.x ?? 0) - (source.x ?? 0);
    const dy = (target.y ?? 0) - (source.y ?? 0);
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetDistance = 100;
    const force = (distance - targetDistance) * 0.1 * forceStrength;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    source.vx = (source.vx ?? 0) + fx * alpha;
    source.vy = (source.vy ?? 0) + fy * alpha;
    target.vx = (target.vx ?? 0) - fx * alpha;
    target.vy = (target.vy ?? 0) - fy * alpha;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  for (const node of nodes) {
    const dx = centerX - (node.x ?? 0);
    const dy = centerY - (node.y ?? 0);
    node.vx = (node.vx ?? 0) + dx * 0.01 * alpha;
    node.vy = (node.vy ?? 0) + dy * 0.01 * alpha;
  }

  for (const node of nodes) {
    if (node.fx !== undefined && node.fy !== undefined) {
      node.x = node.fx;
      node.y = node.fy;
    } else {
      node.x = (node.x ?? 0) + (node.vx ?? 0);
      node.y = (node.y ?? 0) + (node.vy ?? 0);
      node.x = Math.max(50, Math.min(width - 50, node.x));
      node.y = Math.max(50, Math.min(height - 50, node.y));
    }
    node.vx = (node.vx ?? 0) * 0.9;
    node.vy = (node.vy ?? 0) * 0.9;
  }
}

// Parse an rgba(r g b a) string → [r,g,b] normalised 0–1
function parseRGBA(s: string): [number, number, number] {
  const m = s.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0.5, 0.5, 0.5];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

// ============================================================================
// Main Component
// ============================================================================

export function UnifiedGraphRenderer({
  nodes,
  edges,
  config = {},
  onInteraction,
  onNodeClick,
  className,
  showParticles = true,
}: UnifiedGraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const gpuRef = useRef<GPUResources | null>(null);
  const webgpuActiveRef = useRef(false);
  const particleStateRef = useRef<ParticleSystemState>({ particles: [], ripples: [] });
  const lastParticleTimeRef = useRef<number>(0);
  // Track previous edge states to detect transitions
  const prevEdgeStatesRef = useRef<Map<string, GraphEdge['state']>>(new Map());
  const prevNodeStatesRef = useRef<Map<string, GraphNode['state']>>(new Map());
  /** Prevents overlapping GPU staging buffer map operations */
  const particleMappingRef = useRef(false);
  /** Generation counter incremented when particle array is mutated (spawn/despawn) */
  const particleGenRef = useRef(0);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<NodeId | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeId | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [renderMode, setRenderMode] = useState<'webgpu' | 'canvas2d' | 'detecting'>('detecting');

  const fullConfig: Required<GraphConfig> = useMemo(
    () => ({
      width: config.width ?? dimensions.width,
      height: config.height ?? dimensions.height,
      backgroundColor: config.backgroundColor ?? 'transparent',
      nodeRadius: config.nodeRadius ?? 24,
      showLabels: config.showLabels ?? true,
      showEdgeWeights: config.showEdgeWeights ?? false,
      showArrows: config.showArrows ?? true,
      enablePhysics: config.enablePhysics ?? true,
      forceStrength: config.forceStrength ?? 1,
    }),
    [config, dimensions]
  );

  const initializedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      x: node.x ?? Math.random() * fullConfig.width,
      y: node.y ?? Math.random() * fullConfig.height,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0,
    }));
  }, [nodes, fullConfig.width, fullConfig.height]);

  // -------------------------------------------------------------------------
  // Canvas 2D render (fallback – identical to original)
  // -------------------------------------------------------------------------
  const render2D = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const { width, height, nodeRadius, showLabels, showEdgeWeights, showArrows } = fullConfig;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const nodeMap = new Map(initializedNodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const sx = source.x ?? 0;
      const sy = source.y ?? 0;
      const tx = target.x ?? 0;
      const ty = target.y ?? 0;
      const state = edge.state ?? 'unvisited';
      ctx.strokeStyle = COLORS.edge[state];
      ctx.lineWidth = state === 'current' || state === 'path' ? 3 : 2;
      if (state === 'current' || state === 'path') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.strokeStyle;
      }
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (edge.directed && showArrows) {
        const angle = Math.atan2(ty - sy, tx - sx);
        const arrowLength = 15;
        const arrowWidth = 8;
        const arrowX = tx - Math.cos(angle) * (nodeRadius + 5);
        const arrowY = ty - Math.sin(angle) * (nodeRadius + 5);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle),
          arrowY - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle)
        );
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle),
          arrowY - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle)
        );
        ctx.closePath();
        ctx.fill();
      }

      if (showEdgeWeights && edge.weight !== undefined) {
        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = COLORS.label.background;
        ctx.strokeStyle = COLORS.label.border;
        ctx.lineWidth = 1;
        const text = edge.weight.toFixed(1);
        const metrics = ctx.measureText(text);
        const padding = 4;
        ctx.fillRect(midX - metrics.width / 2 - padding, midY - 10, metrics.width + padding * 2, 20);
        ctx.strokeRect(midX - metrics.width / 2 - padding, midY - 10, metrics.width + padding * 2, 20);
        ctx.fillStyle = COLORS.label.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, midX, midY);
      }

      if ((state === 'current' || state === 'path') && edge.flow !== undefined) {
        const flowX = sx + (tx - sx) * (edge.flow % 1);
        const flowY = sy + (ty - sy) * (edge.flow % 1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(flowX, flowY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (const node of initializedNodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const state = node.state ?? 'unvisited';
      const colors = COLORS.node[state];
      const isHovered = hoveredNode === node.id;
      const radius = isHovered ? nodeRadius * 1.1 : nodeRadius;
      ctx.shadowBlur = isHovered ? 20 : 12;
      ctx.shadowColor = colors.glow;
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (showLabels) {
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = COLORS.label.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, x, y);
        if (node.distance !== undefined) {
          ctx.font = '10px Inter, sans-serif';
          ctx.fillStyle = COLORS.label.text;
          ctx.fillText(`d:${node.distance.toFixed(1)}`, x, y + radius + 12);
        }
      }
    }
    ctx.restore();
  }, [initializedNodes, edges, fullConfig, zoom, pan, hoveredNode]);

  // -------------------------------------------------------------------------
  // WebGPU draw (physics on GPU + node circles rendered)
  // -------------------------------------------------------------------------
  const renderWebGPU = useCallback(() => {
    const gpu = gpuRef.current;
    const canvas = canvasRef.current;
    if (!gpu || !canvas || initializedNodes.length === 0) return;

    const { width, height, nodeRadius, forceStrength, enablePhysics } = fullConfig;

    // Pack node data into Float32Array: [x, y, vx, vy, fx, fy, _p0, _p1] * N
    const nodeF32 = new Float32Array(initializedNodes.length * 8);
    for (let i = 0; i < initializedNodes.length; i++) {
      const n = initializedNodes[i]!;
      const base = i * 8;
      nodeF32[base + 0] = n.x ?? 0;
      nodeF32[base + 1] = n.y ?? 0;
      nodeF32[base + 2] = n.vx ?? 0;
      nodeF32[base + 3] = n.vy ?? 0;
      // fx/fy: -1 means "not pinned"; >=0 means pinned
      nodeF32[base + 4] = n.fx !== undefined ? n.fx : -1;
      nodeF32[base + 5] = n.fy !== undefined ? n.fy : -1;
      nodeF32[base + 6] = 0;
      nodeF32[base + 7] = 0;
    }

    // Pack edge data: [src_u32, dst_u32, 0, 0] * E
    const nodeIndexMap = new Map(initializedNodes.map((n, i) => [n.id, i]));
    const edgeU32 = new Uint32Array(Math.max(edges.length, 1) * 4);
    for (let i = 0; i < edges.length; i++) {
      edgeU32[i * 4 + 0] = nodeIndexMap.get(edges[i]!.source) ?? 0;
      edgeU32[i * 4 + 1] = nodeIndexMap.get(edges[i]!.target) ?? 0;
    }

    // Node meta: [r, g, b, radius] * N
    const metaF32 = new Float32Array(initializedNodes.length * 4);
    for (let i = 0; i < initializedNodes.length; i++) {
      const state = initializedNodes[i]!.state ?? 'unvisited';
      const [r, g, b] = parseRGBA(COLORS.node[state].fill);
      metaF32[i * 4 + 0] = r;
      metaF32[i * 4 + 1] = g;
      metaF32[i * 4 + 2] = b;
      metaF32[i * 4 + 3] = nodeRadius;
    }

    // Upload to GPU
    if (nodeF32.byteLength <= gpu.nodeBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.nodeBuffer, 0, nodeF32);
    }
    if (edgeU32.byteLength <= gpu.edgeBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.edgeBuffer, 0, edgeU32);
    }
    if (metaF32.byteLength <= gpu.nodeMetaBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.nodeMetaBuffer, 0, metaF32);
    }

    // Camera buffer
    const camF32 = new Float32Array(8);
    camF32[0] = pan.x; camF32[1] = pan.y; camF32[2] = zoom;
    camF32[3] = width; camF32[4] = height;
    gpu.device.queue.writeBuffer(gpu.cameraBuffer, 0, camF32);

    // Compute params
    const paramF32 = new Float32Array(8);
    const paramU32 = new Uint32Array(paramF32.buffer);
    paramU32[0] = initializedNodes.length;
    paramU32[1] = edges.length;
    paramF32[2] = width;
    paramF32[3] = height;
    paramF32[4] = forceStrength;
    paramF32[5] = 0.3;
    gpu.device.queue.writeBuffer(gpu.computeParamBuffer, 0, paramF32);

    const encoder = gpu.device.createCommandEncoder();

    // Physics compute pass
    if (enablePhysics && !draggedNode) {
      const computeBG = gpu.device.createBindGroup({
        layout: gpu.computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.nodeBuffer } },
          { binding: 1, resource: { buffer: gpu.edgeBuffer } },
          { binding: 2, resource: { buffer: gpu.computeParamBuffer } },
        ],
      });
      const computePass = encoder.beginComputePass();
      computePass.setPipeline(gpu.computePipeline);
      computePass.setBindGroup(0, computeBG);
      computePass.dispatchWorkgroups(Math.ceil(initializedNodes.length / 64));
      computePass.end();
    }

    // Render nodes
    const renderBG = gpu.device.createBindGroup({
      layout: gpu.nodePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gpu.nodeBuffer } },
        { binding: 1, resource: { buffer: gpu.nodeMetaBuffer } },
        { binding: 2, resource: { buffer: gpu.cameraBuffer } },
      ],
    });

    const texture = gpu.context.getCurrentTexture();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    renderPass.setPipeline(gpu.nodePipeline);
    renderPass.setBindGroup(0, renderBG);
    renderPass.draw(6, initializedNodes.length);
    renderPass.end();

    gpu.device.queue.submit([encoder.finish()]);
  }, [initializedNodes, edges, fullConfig, zoom, pan, draggedNode]);

  // -------------------------------------------------------------------------
  // WebGPU initialisation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!supportsWebGPU) { setRenderMode('canvas2d'); return; }
    let cancelled = false;

    (async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter || cancelled) { setRenderMode('canvas2d'); return; }
        const device = await adapter.requestDevice();
        if (cancelled) { device.destroy(); return; }
        const canvas = canvasRef.current;
        if (!canvas) { device.destroy(); setRenderMode('canvas2d'); return; }
        const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!context) { device.destroy(); setRenderMode('canvas2d'); return; }

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });

        // Compute pipeline
        const computeModule = device.createShaderModule({ code: PHYSICS_COMPUTE });
        const computePipeline = await device.createComputePipelineAsync({
          layout: 'auto',
          compute: { module: computeModule, entryPoint: 'main' },
        });

        // Render pipeline
        const renderModule = device.createShaderModule({ code: NODE_RENDER });
        const nodePipeline = await device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: { module: renderModule, entryPoint: 'vs_main' },
          fragment: {
            module: renderModule, entryPoint: 'fs_main',
            targets: [{ format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'zero' } } }],
          },
          primitive: { topology: 'triangle-list' },
        });

        const maxNodes = Math.max(nodes.length, 256);
        const maxEdges = Math.max(edges.length, 1024);

        const nodeBuffer = device.createBuffer({ size: maxNodes * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const edgeBuffer = device.createBuffer({ size: maxEdges * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const nodeMetaBuffer = device.createBuffer({ size: maxNodes * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const cameraBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const computeParamBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        // Particle compute pipeline and buffers
        // 8 f32/u32 per particle struct = 32 bytes per particle
        const particleByteStride = 32;
        const particleModule = device.createShaderModule({ code: PARTICLE_COMPUTE });
        const particleComputePipeline = await device.createComputePipelineAsync({
          layout: 'auto',
          compute: { module: particleModule, entryPoint: 'main' },
        });
        const particleBuffer = device.createBuffer({
          size: RENDERER_MAX_PARTICLES * particleByteStride,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        const particleParamBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const particleStagingBuffer = device.createBuffer({
          size: RENDERER_MAX_PARTICLES * particleByteStride,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        gpuRef.current = {
          device, context, computePipeline, nodePipeline,
          nodeBuffer, edgeBuffer, nodeMetaBuffer, cameraBuffer, computeParamBuffer,
          maxNodes, maxEdges,
          particleComputePipeline, particleBuffer, particleParamBuffer, particleStagingBuffer,
        };

        void device.lost.then((info) => {
          if (info.reason !== 'destroyed') {
            gpuRef.current = null;
            webgpuActiveRef.current = false;
            setRenderMode('canvas2d');
          }
        });

        webgpuActiveRef.current = true;
        setRenderMode('webgpu');
      } catch {
        setRenderMode('canvas2d');
      }
    })();

    return () => {
      cancelled = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.nodeBuffer.destroy();
        gpu.edgeBuffer.destroy();
        gpu.nodeMetaBuffer.destroy();
        gpu.cameraBuffer.destroy();
        gpu.computeParamBuffer.destroy();
        gpu.particleBuffer?.destroy();
        gpu.particleParamBuffer?.destroy();
        gpu.particleStagingBuffer?.destroy();
        gpu.device.destroy();
        gpuRef.current = null;
      }
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Particle system: sync state from edge/node states each frame
  // -------------------------------------------------------------------------
  const updateParticles = useCallback((deltaTime: number, useGpu: boolean) => {
    if (!showParticles) {
      particleStateRef.current.particles = [];
      particleStateRef.current.ripples = [];
      prevEdgeStatesRef.current.clear();
      prevNodeStatesRef.current.clear();
      return;
    }

    const state = particleStateRef.current;

    // Detect newly activated edges → spawn particles
    const activeEdgeIndices = new Set<number>();
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i]!;
      const edgeState = edge.state ?? 'unvisited';
      const prevState = prevEdgeStatesRef.current.get(edge.id);

      if (edgeState === 'current' || edgeState === 'path') {
        activeEdgeIndices.add(i);
        // Newly activated edge — ensure we have particles on it
        const existing = state.particles.filter((p) => p.edgeIndex === i);
        const targetCount = Math.min(4, Math.max(1, Math.floor(RENDERER_MAX_PARTICLES / Math.max(1, edges.length))));
        const needed = targetCount - existing.length;
        const particleColor = rendererGetEdgeColor(edgeState);
        const isDirected = edge.directed ?? false;
        const speed = 0.0005 + Math.random() * 0.0003;

        for (let k = 0; k < needed && state.particles.length < RENDERER_MAX_PARTICLES; k++) {
          const tOff = (existing.length + k) / Math.max(1, targetCount);
          state.particles.push({
            edgeIndex: i,
            t: tOff,
            speed,
            opacity: 0.6 + Math.random() * 0.2,
            radius: 2 + Math.random() * 1.2,
            color: particleColor,
            direction: isDirected ? 1 : (Math.random() > 0.5 ? 1 : -1),
            trail: [],
          });
          particleGenRef.current++;
        }

        // Detect transition to active: newly became current/path
        if (prevState !== edgeState && (prevState === 'unvisited' || prevState === undefined)) {
          // Update color of existing particles on this edge
          for (const p of state.particles) {
            if (p.edgeIndex === i) p.color = particleColor;
          }
        }
      }

      prevEdgeStatesRef.current.set(edge.id, edgeState);
    }

    // Remove particles on edges that are no longer active
    const prevLen = state.particles.length;
    state.particles = state.particles.filter((p) => activeEdgeIndices.has(p.edgeIndex));
    if (state.particles.length !== prevLen) {
      particleGenRef.current++;
    }

    // Detect newly activated nodes → spawn ripples
    for (const node of initializedNodes) {
      const nodeState = node.state ?? 'unvisited';
      const prevState = prevNodeStatesRef.current.get(node.id);
      if (
        nodeState !== 'unvisited' &&
        nodeState !== prevState
      ) {
        const nodeColor = COLORS.node[nodeState].stroke;
        const existingRipple = state.ripples.findIndex((r) => r.nodeId === node.id);
        if (existingRipple !== -1) state.ripples.splice(existingRipple, 1);
        state.ripples.push({
          nodeId: node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          radius: fullConfig.nodeRadius,
          maxRadius: fullConfig.nodeRadius * 3.5,
          opacity: 0.75,
          color: nodeColor,
        });
      }
      prevNodeStatesRef.current.set(node.id, nodeState);
    }

    // Advance ripple animations
    const dt = Math.min(deltaTime, 50);
    state.ripples = state.ripples.filter((r) => {
      r.radius += dt * 0.06;
      r.opacity -= dt * 0.00085;
      return r.opacity > 0 && r.radius < r.maxRadius;
    });

    // Advance particle positions — CPU fallback path.
    // When useGpu is true, the GPU compute shader handles position advancement
    // via gpuAdvanceParticles; we only do trail tracking here.
    const nodeMap = new Map(initializedNodes.map((n) => [n.id, n]));
    for (const particle of state.particles) {
      const edge = edges[particle.edgeIndex];
      if (!edge) continue;
      const from = nodeMap.get(edge.source);
      const to = nodeMap.get(edge.target);
      if (!from || !to) continue;

      if (!useGpu) {
        // CPU position advancement (skipped when GPU handles it)
        particle.t += particle.speed * dt * particle.direction;

        if (particle.direction === 1 && particle.t >= 1) {
          if (edge.directed) {
            particle.t = 0;
          } else {
            particle.t = 1;
            particle.direction = -1;
          }
        } else if (particle.direction === -1 && particle.t <= 0) {
          particle.t = 0;
          particle.direction = 1;
        }
      }

      // Trail tracking always runs on CPU regardless of GPU mode
      particle.trail.push(particle.t);
      if (particle.trail.length > RENDERER_TRAIL_LENGTH) {
        particle.trail.shift();
      }
    }

    lastParticleTimeRef.current += deltaTime;
  }, [showParticles, edges, initializedNodes, fullConfig.nodeRadius]);

  // -------------------------------------------------------------------------
  // GPU particle advancement: dispatches PARTICLE_COMPUTE shader and reads
  // back updated t/direction values into CPU particle state.
  // -------------------------------------------------------------------------
  const gpuAdvanceParticles = useCallback((deltaTime: number) => {
    const gpu = gpuRef.current;
    if (
      !gpu ||
      !gpu.particleComputePipeline ||
      !gpu.particleBuffer ||
      !gpu.particleParamBuffer ||
      !gpu.particleStagingBuffer
    ) {
      return;
    }

    const pState = particleStateRef.current;
    const count = pState.particles.length;
    if (count === 0) return;

    // Skip entire dispatch+copy+readback if a previous mapAsync is still pending.
    // Writing to the staging buffer while it's mapped/pending-map is a WebGPU
    // spec violation. We'll catch the next frame instead.
    if (particleMappingRef.current) return;

    // Pack CPU particle state into the GPU buffer format:
    // struct Particle { edgeIdx:u32, t:f32, speed:f32, direction:f32,
    //                   opacity:f32, radius:f32, isDirected:u32, _pad:u32 }
    const f32 = new Float32Array(count * 8);
    const u32 = new Uint32Array(f32.buffer);
    for (let i = 0; i < count; i++) {
      const p = pState.particles[i]!;
      const edge = edges[p.edgeIndex];
      u32[i * 8]     = p.edgeIndex;
      f32[i * 8 + 1] = p.t;
      f32[i * 8 + 2] = p.speed;
      f32[i * 8 + 3] = p.direction;
      f32[i * 8 + 4] = p.opacity;
      f32[i * 8 + 5] = p.radius;
      u32[i * 8 + 6] = (edge?.directed ?? false) ? 1 : 0;
      u32[i * 8 + 7] = 0; // pad
    }
    gpu.device.queue.writeBuffer(gpu.particleBuffer, 0, f32);

    // Write particle params uniform: { particleCount:u32, dt:f32, _pad0:u32, _pad1:u32 }
    const paramData = new ArrayBuffer(16);
    const pu32 = new Uint32Array(paramData);
    const pf32 = new Float32Array(paramData);
    pu32[0] = count;
    pf32[1] = Math.min(deltaTime, 50); // dt capped same as CPU path
    pu32[2] = 0;
    pu32[3] = 0;
    gpu.device.queue.writeBuffer(gpu.particleParamBuffer, 0, paramData);

    // Dispatch compute shader
    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(gpu.particleComputePipeline);
    const bg = gpu.device.createBindGroup({
      layout: gpu.particleComputePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gpu.particleParamBuffer } },
        { binding: 1, resource: { buffer: gpu.particleBuffer } },
      ],
    });
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();

    // Copy results to staging buffer for readback
    encoder.copyBufferToBuffer(
      gpu.particleBuffer, 0,
      gpu.particleStagingBuffer, 0,
      count * 32,
    );
    gpu.device.queue.submit([encoder.finish()]);

    // Async readback — flag set before mapAsync, cleared on resolve/reject
    particleMappingRef.current = true;
    const capturedCount = count;
    const capturedGen = particleGenRef.current;
    const stagingBuf = gpu.particleStagingBuffer;
    // GPUMapMode.READ = 1 — use numeric literal for SSR safety
    stagingBuf.mapAsync(1).then(() => {
      const mapped = stagingBuf.getMappedRange();
      const result = new Float32Array(mapped.slice(0) as ArrayBuffer);
      stagingBuf.unmap();
      particleMappingRef.current = false;

      // Only apply readback if the particle array hasn't been mutated
      // (spawning/despawning) since we dispatched — indices would be stale
      if (particleGenRef.current !== capturedGen) return;

      const particles = particleStateRef.current.particles;
      const readCount = Math.min(particles.length, capturedCount);
      for (let i = 0; i < readCount; i++) {
        const particle = particles[i]!;
        particle.t = result[i * 8 + 1]!;
        const dir = result[i * 8 + 3]!;
        particle.direction = dir > 0 ? 1 : -1;
      }
    }).catch(() => {
      particleMappingRef.current = false;
    });
  }, [edges]);

  // -------------------------------------------------------------------------
  // Particle rendering on the overlay canvas
  // -------------------------------------------------------------------------
  const renderParticles = useCallback(() => {
    const canvas = particleCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!canvas || !mainCanvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!showParticles) return;

    const state = particleStateRef.current;
    const nodeMap = new Map(initializedNodes.map((n) => [n.id, n]));

    // Apply the same pan/zoom transform as the main canvas
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw ripples
    for (const ripple of state.ripples) {
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      const alpha = Math.max(0, ripple.opacity);
      ctx.strokeStyle = ripple.color.replace(/rgba?\([^)]+\)/, (m) =>
        m.replace(/[\d.]+\)$/, `${alpha})`),
      );
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    }

    // Draw particles
    for (const particle of state.particles) {
      const edge = edges[particle.edgeIndex];
      if (!edge) continue;
      const from = nodeMap.get(edge.source);
      const to = nodeMap.get(edge.target);
      if (!from || !to) continue;

      const sx = from.x ?? 0;
      const sy = from.y ?? 0;
      const tx = to.x ?? 0;
      const ty = to.y ?? 0;
      const { cx, cy } = rendererEdgeControl(sx, sy, tx, ty);

      // Draw trail
      for (let i = 0; i < particle.trail.length - 1; i++) {
        const trailT = particle.trail[i]!;
        const trailPt = rendererBezierPoint(sx, sy, cx, cy, tx, ty, trailT);
        const trailAlpha = particle.opacity * (i / RENDERER_TRAIL_LENGTH) * 0.35;
        const trailRadius = particle.radius * (0.4 + 0.6 * (i / RENDERER_TRAIL_LENGTH));
        ctx.beginPath();
        ctx.arc(trailPt.x, trailPt.y, Math.max(0.5, trailRadius), 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${Math.max(0, trailAlpha)})`);
        ctx.fill();
      }

      // Draw particle head with glow
      const pt = rendererBezierPoint(sx, sy, cx, cy, tx, ty, particle.t);

      ctx.save();
      ctx.shadowBlur = particle.radius * 3;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(0.8, particle.radius), 0, Math.PI * 2);
      ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${particle.opacity})`);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }, [showParticles, edges, initializedNodes, pan, zoom]);

  // -------------------------------------------------------------------------
  // Animation loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (!webgpuActiveRef.current) {
        if (fullConfig.enablePhysics && !draggedNode) {
          applyForces(initializedNodes, edges, fullConfig);
        }
        render2D();
      } else {
        renderWebGPU();
      }

      for (const edge of edges) {
        if (edge.state === 'current' || edge.state === 'path') {
          edge.flow = ((edge.flow ?? 0) + deltaTime * 0.001) % 1;
        }
      }

      // Update and render particles.
      // When WebGPU is active with a particle compute pipeline, the position
      // advancement (t, direction) is offloaded to the GPU compute shader.
      // CPU still handles spawning, despawning, ripples, and trail tracking.
      const gpuParticleActive = webgpuActiveRef.current && !!gpuRef.current?.particleComputePipeline;
      updateParticles(deltaTime, gpuParticleActive);
      if (gpuParticleActive) {
        gpuAdvanceParticles(deltaTime);
      }
      renderParticles();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [render2D, renderWebGPU, fullConfig, initializedNodes, edges, draggedNode, updateParticles, gpuAdvanceParticles, renderParticles]);

  // -------------------------------------------------------------------------
  // Resize observer
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        if (canvas) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
          if (!webgpuActiveRef.current) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.scale(dpr, dpr);
          }
        }
        // Also resize the particle overlay canvas
        const pCanvas = particleCanvasRef.current;
        if (pCanvas) {
          pCanvas.width = width * dpr;
          pCanvas.height = height * dpr;
          pCanvas.style.width = `${width}px`;
          pCanvas.style.height = `${height}px`;
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Mouse interaction handlers (identical to original)
  // -------------------------------------------------------------------------
  const getMousePos = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      };
    },
    [zoom, pan]
  );

  const findNodeAtPosition = useCallback(
    (x: number, y: number): GraphNode | null => {
      for (const node of initializedNodes) {
        const dx = (node.x ?? 0) - x;
        const dy = (node.y ?? 0) - y;
        if (Math.sqrt(dx * dx + dy * dy) <= fullConfig.nodeRadius) return node;
      }
      return null;
    },
    [initializedNodes, fullConfig.nodeRadius]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const node = findNodeAtPosition(pos.x, pos.y);
      if (node) {
        setDraggedNode(node.id);
        node.fx = node.x!;
        node.fy = node.y!;
        onInteraction?.({ type: 'node-drag-start', nodeId: node.id, position: pos });
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [getMousePos, findNodeAtPosition, pan, onInteraction]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      if (draggedNode) {
        const node = initializedNodes.find((n) => n.id === draggedNode);
        if (node) { node.fx = pos.x; node.fy = pos.y; }
        onInteraction?.({ type: 'node-drag', nodeId: draggedNode, position: pos });
      } else if (isDragging) {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      } else {
        const node = findNodeAtPosition(pos.x, pos.y);
        setHoveredNode(node?.id ?? null);
      }
    },
    [getMousePos, draggedNode, isDragging, dragStart, initializedNodes, findNodeAtPosition, onInteraction]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      if (draggedNode) {
        const node = initializedNodes.find((n) => n.id === draggedNode);
        if (node) { delete node.fx; delete node.fy; }
        onInteraction?.({ type: 'node-drag-end', nodeId: draggedNode, position: pos });
        setDraggedNode(null);
      } else if (!isDragging) {
        const node = findNodeAtPosition(pos.x, pos.y);
        if (node) {
          onNodeClick?.(node.id);
          onInteraction?.({ type: 'node-click', nodeId: node.id, position: pos });
        } else {
          onInteraction?.({ type: 'canvas-click', position: pos });
        }
      }
      setIsDragging(false);
    },
    [getMousePos, draggedNode, isDragging, initializedNodes, findNodeAtPosition, onNodeClick, onInteraction]
  );

  const handleWheel = useCallback((e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.1, Math.min(3, prev * delta)));
  }, []);

  const handleZoomIn = useCallback(() => setZoom((prev) => Math.min(3, prev * 1.2)), []);
  const handleZoomOut = useCallback(() => setZoom((prev) => Math.max(0.1, prev / 1.2)), []);
  const handleResetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  return (
    <div ref={containerRef} className={cn('relative w-full h-full', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        role="img"
        aria-label="Interactive graph visualization"
      />
      {/* Particle overlay canvas — pointer-events:none so main canvas interactions still work */}
      <canvas
        ref={particleCanvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Render mode badge */}
      {renderMode !== 'detecting' && (
        <div
          className="absolute top-16 right-4 px-2 py-0.5 rounded text-[9px] font-mono pointer-events-none"
          style={{
            background: renderMode === 'webgpu' ? 'rgba(16,185,129,0.18)' : 'rgba(99,102,241,0.14)',
            border: `1px solid ${renderMode === 'webgpu' ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'}`,
            color: renderMode === 'webgpu' ? '#10b981' : '#818cf8',
          }}
        >
          {renderMode === 'webgpu' ? 'WebGPU' : 'Canvas 2D'}
        </div>
      )}

      {/* Controls Overlay */}
      <motion.div
        className="absolute top-4 right-4 flex flex-col gap-2 glass-light rounded-lg p-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="hover:bg-accent transition-smooth" title="Zoom in" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="hover:bg-accent transition-smooth" title="Zoom out" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleResetView} className="hover:bg-accent transition-smooth" title="Reset view" aria-label="Reset view">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Zoom indicator */}
      <motion.div
        className="absolute bottom-4 right-4 glass-light rounded-lg px-3 py-1.5 text-sm font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {Math.round(zoom * 100)}%
      </motion.div>

      {/* Hovered node hint */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            className="absolute bottom-4 left-4 glass-heavy rounded-lg px-4 py-2 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <Hand className="h-4 w-4" />
              <span>Drag to move node • Click to select</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
