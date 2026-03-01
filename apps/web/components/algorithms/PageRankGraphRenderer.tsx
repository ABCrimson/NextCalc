'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react';
import type { GraphEdge, GraphNode, NodeId, PageRankScore } from './types';

/**
 * Configuration for graph renderer
 */
export interface GraphRendererConfig {
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Enable physics simulation */
  enablePhysics: boolean;
  /** Node size scaling factor */
  nodeSizeScale: number;
  /** Edge opacity */
  edgeOpacity: number;
  /** Show labels */
  showLabels: boolean;
  /** Background color */
  backgroundColor: string;
  /** Node color scheme */
  nodeColorScheme: 'rank' | 'selection' | 'custom';
  /** Enable anti-aliasing */
  antialias: boolean;
  /** Enable zoom limits */
  minZoom: number;
  maxZoom: number;
}

/**
 * Graph interaction events
 */
export interface GraphInteraction {
  type: 'click' | 'hover' | 'drag' | 'zoom' | 'pan';
  nodeId?: NodeId;
  position?: { x: number; y: number };
}

/**
 * Props for PageRankGraphRenderer
 */
export interface PageRankGraphRendererProps {
  /** Graph nodes */
  nodes: ReadonlyArray<GraphNode>;
  /** Graph edges */
  edges: ReadonlyArray<GraphEdge>;
  /** Currently selected node */
  selectedNode?: NodeId | null;
  /** Node ranks (for visual scaling) */
  ranks: Map<NodeId, PageRankScore>;
  /** Renderer configuration */
  config?: Partial<GraphRendererConfig>;
  /** Interaction callback */
  onInteraction?: (interaction: GraphInteraction) => void;
  /** Node position update callback */
  onNodePositionUpdate?: (nodeId: NodeId, position: { x: number; y: number }) => void;
  /** Custom CSS class */
  className?: string;
}

// ---------------------------------------------------------------------------
// Force-directed layout physics simulation
// ---------------------------------------------------------------------------

class ForceSimulation {
  private nodes: Map<NodeId, { x: number; y: number; vx: number; vy: number; fixed: boolean }>;
  private edges: Array<{ source: NodeId; target: NodeId; weight: number }>;
  private width: number;
  private height: number;

  private readonly springStrength = 0.008;
  private readonly springLength = 120;
  private readonly repulsionStrength = 3500;
  private readonly damping = 0.78;
  private readonly centeringForce = 0.003;

  constructor(
    nodes: ReadonlyArray<GraphNode>,
    edges: ReadonlyArray<GraphEdge>,
    width: number,
    height: number,
  ) {
    this.width = width;
    this.height = height;
    this.nodes = new Map(
      nodes.map((node) => [
        node.id,
        { x: node.position.x, y: node.position.y, vx: 0, vy: 0, fixed: false },
      ]),
    );
    this.edges = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }));
  }

  tick(): void {
    for (const [, node] of Array.from(this.nodes)) {
      if (!node.fixed) {
        node.vx = 0;
        node.vy = 0;
      }
    }

    const nodeArray = Array.from(this.nodes.entries());

    // Repulsion
    for (let i = 0; i < nodeArray.length; i++) {
      const [, node1] = nodeArray[i]!;
      if (node1.fixed) continue;
      for (let j = i + 1; j < nodeArray.length; j++) {
        const [, node2] = nodeArray[j]!;
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const distSq = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(distSq);
        const force = this.repulsionStrength / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        node1.vx -= fx;
        node1.vy -= fy;
        if (!node2.fixed) {
          node2.vx += fx;
          node2.vy += fy;
        }
      }
    }

    // Spring forces
    for (const edge of this.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = (dist - this.springLength * edge.weight) * this.springStrength;
      const fx = (dx / dist) * displacement;
      const fy = (dy / dist) * displacement;
      if (!source.fixed) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.fixed) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Centering
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    for (const [, node] of Array.from(this.nodes)) {
      if (node.fixed) continue;
      node.vx += (centerX - node.x) * this.centeringForce;
      node.vy += (centerY - node.y) * this.centeringForce;
    }

    // Integrate
    for (const [, node] of Array.from(this.nodes)) {
      if (node.fixed) continue;
      const maxVel = 8;
      node.vx = Math.max(-maxVel, Math.min(maxVel, node.vx * this.damping));
      node.vy = Math.max(-maxVel, Math.min(maxVel, node.vy * this.damping));
      node.x += node.vx;
      node.y += node.vy;
      const margin = 60;
      if (node.x < margin) node.x = margin;
      if (node.x > this.width - margin) node.x = this.width - margin;
      if (node.y < margin) node.y = margin;
      if (node.y > this.height - margin) node.y = this.height - margin;
    }
  }

  getPositions(): Map<NodeId, { x: number; y: number }> {
    const positions = new Map<NodeId, { x: number; y: number }>();
    for (const [id, node] of Array.from(this.nodes)) {
      positions.set(id, { x: node.x, y: node.y });
    }
    return positions;
  }

  fixNode(nodeId: NodeId, fixed: boolean): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.fixed = fixed;
      if (!fixed) {
        node.vx = 0;
        node.vy = 0;
      }
    }
  }

  setNodePosition(nodeId: NodeId, x: number, y: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
    }
  }

  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/** Map normalised rank (0..1) to an OKLCH hue for the cool→vivid palette */
function rankToOklch(normalizedRank: number): { l: number; c: number; h: number } {
  // Low rank = deep blue (hue 260), high rank = vivid rose-violet (hue 310)
  const h = 260 + normalizedRank * 50;
  const c = 0.12 + normalizedRank * 0.16;
  const l = 0.42 + normalizedRank * 0.22;
  return { l, c, h };
}

function oklchStr(l: number, c: number, h: number, a?: number): string {
  return a !== undefined
    ? `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${a.toFixed(2)})`
    : `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: GraphRendererConfig = {
  width: 800,
  height: 600,
  enablePhysics: true,
  nodeSizeScale: 1.0,
  edgeOpacity: 0.55,
  showLabels: true,
  backgroundColor: '#0d0f1a',
  nodeColorScheme: 'rank',
  antialias: true,
  minZoom: 0.25,
  maxZoom: 4.0,
};

// ---------------------------------------------------------------------------
// SVG-based PageRank Graph Renderer
// ---------------------------------------------------------------------------

/**
 * SVG-based force-directed PageRank graph renderer.
 *
 * Replaces the previous Three.js WebGPU implementation with a lightweight,
 * visually rich SVG renderer that eliminates all WebGPU disposal crashes
 * and compatibility issues while providing superior aesthetics for 2D graphs.
 *
 * Features:
 * - OKLCH-aligned gradient node fills with glow halos
 * - SVG filter-based bloom for nodes
 * - Animated edge arrows with proper SVG markers
 * - Drag-to-reposition nodes with force simulation
 * - Pan (drag on background) and zoom (scroll wheel) via viewBox
 * - Crisp text labels at any zoom level
 * - Animated selection ring pulse
 * - requestAnimationFrame-driven physics
 */
export function PageRankGraphRenderer({
  nodes,
  edges,
  selectedNode,
  ranks,
  config: userConfig,
  onInteraction,
  onNodePositionUpdate,
  className,
}: PageRankGraphRendererProps) {
  const prefersReduced = useReducedMotion();
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<ForceSimulation | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Positions state drives re-renders on each physics tick
  const [positions, setPositions] = useState<Map<NodeId, { x: number; y: number }>>(new Map());

  // Camera: viewBox offset + zoom
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1.0 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Drag state (refs to avoid stale closures)
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<NodeId | null>(null);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Hover state
  const [hoveredNode, setHoveredNode] = useState<NodeId | null>(null);

  // ── Simulation lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    simulationRef.current = new ForceSimulation(nodes, edges, config.width, config.height);
    // Prime positions immediately
    setPositions(simulationRef.current.getPositions());
  }, [nodes, edges, config.width, config.height]);

  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.setDimensions(config.width, config.height);
    }
  }, [config.width, config.height]);

  // ── Animation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    const tick = () => {
      if (!isMountedRef.current) return;
      if (config.enablePhysics && simulationRef.current && !isDraggingRef.current) {
        simulationRef.current.tick();
      }
      if (simulationRef.current) {
        setPositions(simulationRef.current.getPositions());
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      isMountedRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [config.enablePhysics]);

  // ── Derived data ────────────────────────────────────────────────────────
  const maxRank = useMemo(
    () => Math.max(...Array.from(ranks.values()).map((r) => r as number), 0.001),
    [ranks],
  );

  // ── ViewBox ─────────────────────────────────────────────────────────────
  const viewBox = useMemo(() => {
    const w = config.width / camera.zoom;
    const h = config.height / camera.zoom;
    const x = camera.x - w / 2;
    const y = camera.y - h / 2;
    return `${x} ${y} ${w} ${h}`;
  }, [config.width, config.height, camera]);

  // Center camera on first layout
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (hasCenteredRef.current || positions.size === 0) return;
    hasCenteredRef.current = true;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const pos of Array.from(positions.values())) {
      if (pos.x < minX) minX = pos.x;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
    }
    setCamera((prev) => ({ ...prev, x: (minX + maxX) / 2, y: (minY + maxY) / 2 }));
  }, [positions]);

  // ── Pointer → SVG coordinate conversion ─────────────────────────────────
  const pointerToSVG = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // ── Interaction handlers ────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const target = event.target as SVGElement;
      const nodeId = target
        .closest('[data-node-id]')
        ?.getAttribute('data-node-id') as NodeId | null;

      if (nodeId) {
        isDraggingRef.current = true;
        draggedNodeRef.current = nodeId;
        simulationRef.current?.fixNode(nodeId, true);
        onInteraction?.({ type: 'click', nodeId });
        (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
      } else {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
      }
    },
    [onInteraction],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (isDraggingRef.current && draggedNodeRef.current) {
        const svgPos = pointerToSVG(event.clientX, event.clientY);
        simulationRef.current?.setNodePosition(draggedNodeRef.current, svgPos.x, svgPos.y);
        onNodePositionUpdate?.(draggedNodeRef.current, svgPos);
        onInteraction?.({ type: 'drag', nodeId: draggedNodeRef.current, position: svgPos });
      } else if (isPanningRef.current) {
        const dx = event.clientX - lastPointerRef.current.x;
        const dy = event.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        setCamera((prev) => ({
          ...prev,
          x: prev.x - dx / prev.zoom,
          y: prev.y - dy / prev.zoom,
        }));
        onInteraction?.({ type: 'pan' });
      }
    },
    [pointerToSVG, onInteraction, onNodePositionUpdate],
  );

  const handlePointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (draggedNodeRef.current) {
      simulationRef.current?.fixNode(draggedNodeRef.current, false);
    }
    isDraggingRef.current = false;
    draggedNodeRef.current = null;
    isPanningRef.current = false;
    (event.currentTarget as SVGSVGElement).releasePointerCapture(event.pointerId);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.88 : 1.14;
      setCamera((prev) => {
        const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, prev.zoom * factor));
        return { ...prev, zoom: newZoom };
      });
      onInteraction?.({ type: 'zoom' });
    },
    [config.minZoom, config.maxZoom, onInteraction],
  );

  // ── Render ──────────────────────────────────────────────────────────────
  const edgePairs = useMemo(
    () =>
      edges.map((e) => ({
        edge: e,
        key: `${e.source}-${e.target}`,
      })),
    [edges],
  );

  return (
    <div
      className={className}
      style={{
        width: config.width,
        height: config.height,
        position: 'relative',
        touchAction: 'none',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        width={config.width}
        height={config.height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* ── SVG Defs: gradients, filters, markers ────────────────────── */}
        <defs>
          {/* Bloom glow filter for nodes */}
          <filter id="pr-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" type="saturate" values="2.5" result="saturated" />
            <feMerge>
              <feMergeNode in="saturated" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle glow for selected node pulse ring */}
          <filter id="pr-selection-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" type="saturate" values="3" result="sat" />
            <feMerge>
              <feMergeNode in="sat" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Edge glow filter */}
          <filter id="pr-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Node gradients */}
          {nodes.map((node) => {
            const rank = (ranks.get(node.id) as number) ?? 0;
            const nr = rank / maxRank;
            const { l, c, h } = rankToOklch(nr);
            return (
              <radialGradient key={`ng-${node.id}`} id={`ng-${node.id}`} cx="35%" cy="30%" r="65%">
                <stop
                  offset="0%"
                  stopColor={oklchStr(Math.min(l + 0.22, 0.9), Math.min(c + 0.04, 0.35), h)}
                />
                <stop offset="55%" stopColor={oklchStr(l, c, h)} />
                <stop offset="100%" stopColor={oklchStr(Math.max(l - 0.14, 0.15), c, h)} />
              </radialGradient>
            );
          })}

          {/* Node outer glow gradients (used for halo) */}
          {nodes.map((node) => {
            const rank = (ranks.get(node.id) as number) ?? 0;
            const nr = rank / maxRank;
            const { l, c, h } = rankToOklch(nr);
            return (
              <radialGradient key={`nh-${node.id}`} id={`nh-${node.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={oklchStr(l + 0.1, c + 0.06, h, 0.35)} />
                <stop offset="100%" stopColor={oklchStr(l, c, h, 0)} />
              </radialGradient>
            );
          })}

          {/* Edge arrow markers — one per edge colored by source rank */}
          {edgePairs.map(({ edge, key }) => {
            const srcRank = (ranks.get(edge.source) as number) ?? 0;
            const nr = srcRank / maxRank;
            const { l, c, h } = rankToOklch(nr);
            return (
              <marker
                key={`am-${key}`}
                id={`am-${key}`}
                markerWidth="10"
                markerHeight="8"
                refX="9"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <polygon
                  points="0,0.5 10,4 0,7.5"
                  fill={oklchStr(l + 0.15, c, h, config.edgeOpacity + 0.2)}
                />
              </marker>
            );
          })}
        </defs>

        {/* ── Background grid (subtle) ────────────────────────────────── */}
        <rect x={-5000} y={-5000} width={10000} height={10000} fill={config.backgroundColor} />
        {/* Dot grid */}
        <g opacity="0.06">
          {Array.from({ length: 41 }, (_, i) => {
            const x = (i - 20) * 40;
            return Array.from({ length: 31 }, (_, j) => {
              const y = (j - 15) * 40;
              return <circle key={`dot-${i}-${j}`} cx={x} cy={y} r="1" fill="white" />;
            });
          })}
        </g>

        {/* ── Edges ───────────────────────────────────────────────────── */}
        <g>
          {edgePairs.map(({ edge, key }) => {
            const sourcePos = positions.get(edge.source);
            const targetPos = positions.get(edge.target);
            if (!sourcePos || !targetPos) return null;

            const srcRank = (ranks.get(edge.source) as number) ?? 0;
            const tgtRank = (ranks.get(edge.target) as number) ?? 0;
            const srcNr = srcRank / maxRank;
            const tgtNr = tgtRank / maxRank;
            const srcRadius = (18 + srcNr * 36) * config.nodeSizeScale;
            const tgtRadius = (18 + tgtNr * 36) * config.nodeSizeScale;

            const dx = targetPos.x - sourcePos.x;
            const dy = targetPos.y - sourcePos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const dirX = dx / dist;
            const dirY = dy / dist;

            const sx = sourcePos.x + dirX * (srcRadius + 2);
            const sy = sourcePos.y + dirY * (srcRadius + 2);
            const ex = targetPos.x - dirX * (tgtRadius + 14);
            const ey = targetPos.y - dirY * (tgtRadius + 14);

            const { l, c, h } = rankToOklch(srcNr);

            return (
              <line
                key={key}
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                stroke={oklchStr(l + 0.12, c * 0.8, h, config.edgeOpacity)}
                strokeWidth="2.5"
                strokeLinecap="round"
                markerEnd={`url(#am-${key})`}
                filter="url(#pr-edge-glow)"
              />
            );
          })}
        </g>

        {/* ── Nodes ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            const rank = (ranks.get(node.id) as number) ?? 0;
            const nr = rank / maxRank;
            const radius = (18 + nr * 36) * config.nodeSizeScale;
            const isSelected = selectedNode === node.id;
            const isHovered = hoveredNode === node.id;
            const { l, c, h } = rankToOklch(nr);

            return (
              <motion.g
                key={node.id}
                data-node-id={node.id}
                {...(prefersReduced
                  ? {}
                  : { initial: { scale: 0, opacity: 0 }, exit: { scale: 0, opacity: 0 } })}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 22 }
                }
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => {
                  setHoveredNode(node.id);
                  onInteraction?.({ type: 'hover', nodeId: node.id });
                }}
                onPointerLeave={() => setHoveredNode(null)}
              >
                {/* Outer glow halo */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius * 1.8}
                  fill={`url(#nh-${node.id})`}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Selection pulse ring */}
                {isSelected && (
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius + 8}
                    fill="none"
                    stroke={oklchStr(l + 0.25, c + 0.05, h, 0.7)}
                    strokeWidth="3"
                    filter="url(#pr-selection-glow)"
                    initial={{ r: radius + 4, opacity: 0.9 }}
                    animate={{
                      r: [radius + 6, radius + 12, radius + 6],
                      opacity: [0.8, 0.3, 0.8],
                    }}
                    transition={
                      prefersReduced
                        ? { duration: 0 }
                        : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                    }
                  />
                )}

                {/* Main node circle */}
                <circle
                  data-node-id={node.id}
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? radius * 1.06 : radius}
                  fill={`url(#ng-${node.id})`}
                  stroke={oklchStr(Math.min(l + 0.28, 0.92), c * 0.9, h, isSelected ? 0.9 : 0.5)}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  filter="url(#pr-glow)"
                  style={{
                    transition: 'r 0.15s ease-out, stroke-width 0.15s ease-out',
                  }}
                />

                {/* Specular highlight */}
                <ellipse
                  cx={pos.x - radius * 0.2}
                  cy={pos.y - radius * 0.25}
                  rx={radius * 0.45}
                  ry={radius * 0.35}
                  fill="white"
                  opacity="0.12"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Node label */}
                {config.showLabels && (
                  <>
                    <text
                      x={pos.x}
                      y={pos.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max(10, Math.min(14, radius * 0.5))}
                      fontWeight="700"
                      fill="white"
                      style={{ pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                    >
                      {node.label}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + radius + 16}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill={oklchStr(l + 0.3, c * 0.6, h)}
                      style={{ pointerEvents: 'none' }}
                    >
                      {rank.toFixed(3)}
                    </text>
                  </>
                )}
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>

      {/* Zoom indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          padding: '4px 10px',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'monospace',
          userSelect: 'none',
        }}
      >
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}
