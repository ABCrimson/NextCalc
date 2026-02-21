'use client';

import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Network, Route, Trash2, Plus, MousePointer2, Info, Sparkles, BookOpen } from 'lucide-react';
import { kruskal, prim } from '@nextcalc/math-engine/graph-theory';

// ============================================================================
// EDGE FLOW PARTICLE SYSTEM
// ============================================================================

interface Particle {
  /** Edge index this particle travels along */
  edgeIndex: number;
  /** Progress along the edge: 0 = source, 1 = target */
  t: number;
  /** Speed: fraction of edge length per millisecond */
  speed: number;
  /** Opacity 0-1 */
  opacity: number;
  /** Radius in SVG units */
  radius: number;
  /** CSS colour string */
  color: string;
  /** Direction: 1 = forward, -1 = backward (undirected oscillation) */
  direction: 1 | -1;
  /** Trail history: last N positions in [t] order */
  trail: number[];
}

interface Ripple {
  nodeId: string;
  /** SVG-space centre */
  x: number;
  y: number;
  /** Current radius in SVG units */
  radius: number;
  /** Max radius */
  maxRadius: number;
  opacity: number;
  color: string;
}

interface ParticleSystemState {
  particles: Particle[];
  ripples: Ripple[];
}

/** Maximum total particles across all edges */
const MAX_PARTICLES = 500;
/** Trail length in t-space samples */
const TRAIL_LENGTH = 6;

/** Derive the highlight colour for a given algorithm */
function getAlgorithmColor(algoId: AlgorithmId): string {
  switch (algoId) {
    case 'bfs':         return 'rgba(96, 165, 250, 0.85)';   // blue
    case 'dfs':         return 'rgba(167, 139, 250, 0.85)';  // violet
    case 'dijkstra':    return 'rgba(52, 211, 153, 0.85)';   // emerald
    case 'astar':       return 'rgba(251, 191, 36, 0.85)';   // amber
    case 'bellman-ford':return 'rgba(248, 113, 113, 0.85)';  // red
    case 'floyd':       return 'rgba(99, 102, 241, 0.85)';   // indigo
    case 'kruskal':     return 'rgba(52, 211, 153, 0.85)';   // emerald
    case 'prim':        return 'rgba(34, 197, 94, 0.85)';    // green
    case 'topo-sort':   return 'rgba(192, 132, 252, 0.85)';  // purple
    case 'tarjan-scc':  return 'rgba(251, 146, 60, 0.85)';   // orange
  }
}

/** Quadratic bezier point at parameter t */
function bezierPoint(
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

/** Compute bezier control point matching getEdgePath curvature=0.15 */
function getEdgeControlPoint(
  fromNode: GraphNode,
  toNode: GraphNode,
): { cx: number; cy: number } {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = (-dy / len) * 0.15 * len;
  const perpY = (dx / len) * 0.15 * len;
  return {
    cx: (fromNode.x + toNode.x) / 2 + perpX,
    cy: (fromNode.y + toNode.y) / 2 + perpY,
  };
}

/**
 * Compute particle speed for an edge.
 * - BFS/DFS/topo: constant medium speed
 * - Dijkstra/A-star/Bellman-Ford: faster = lighter weight
 * - Kruskal/Prim: speed inversely proportional to weight
 */
function computeParticleSpeed(algoId: AlgorithmId, edgeWeight: number): number {
  const w = Math.max(0.1, edgeWeight);
  switch (algoId) {
    case 'bfs':
    case 'dfs':
    case 'topo-sort':
    case 'tarjan-scc':
      return 0.0006;
    case 'dijkstra':
    case 'astar':
    case 'bellman-ford':
      // heavier weight = slower
      return Math.max(0.0002, 0.0009 / Math.sqrt(w));
    case 'floyd':
      return 0.0004;
    case 'kruskal':
    case 'prim':
      return Math.max(0.0002, 0.0007 / Math.sqrt(w));
  }
}

/** Determine how many particles to spawn per active edge */
function particlesPerEdge(algoId: AlgorithmId, edgeWeight: number, totalEdges: number): number {
  const base = Math.max(1, Math.floor(MAX_PARTICLES / Math.max(1, totalEdges)));
  const capped = Math.min(base, algoId === 'floyd' ? 2 : 4);
  void edgeWeight;
  return capped;
}

/** Build the particle system state given current algorithm result */
function buildParticles(
  algoId: AlgorithmId,
  nodes: GraphNode[],
  edges: GraphEdge[],
  result: GraphResult | null,
  color: string,
  existingParticles: Particle[],
): Particle[] {
  if (!result) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  /** Determine which edges are active/highlighted */
  function isEdgeActive(edge: GraphEdge, index: number): boolean {
    void index;
    if (!result) return false;
    if (result.type === 'traversal' && result.order) {
      // Mark edges whose both endpoints are in the traversal order
      return (
        result.order.includes(edge.from) &&
        result.order.includes(edge.to)
      );
    }
    if ((result.type === 'shortest-path') && result.path) {
      for (let i = 0; i < result.path.length - 1; i++) {
        if (
          (result.path[i] === edge.from && result.path[i + 1] === edge.to) ||
          (result.path[i] === edge.to   && result.path[i + 1] === edge.from)
        ) return true;
      }
      return false;
    }
    if (result.type === 'mst' && result.edges) {
      return result.edges.some(
        (e) =>
          (e.from === edge.from && e.to === edge.to) ||
          (e.from === edge.to   && e.to === edge.from),
      );
    }
    if (result.type === 'topological' && result.order) {
      return (
        result.order.includes(edge.from) &&
        result.order.includes(edge.to)
      );
    }
    if (result.type === 'scc') {
      // All edges participate
      return true;
    }
    if (result.type === 'all-pairs') {
      // All edges participate (Floyd-Warshall processed every edge)
      return true;
    }
    return false;
  }

  const activeEdges = edges
    .map((e, i) => ({ edge: e, index: i, active: isEdgeActive(e, i) }))
    .filter(({ active }) => active);

  if (activeEdges.length === 0) return [];

  // Preserve existing particles that are still on active edges so animation is smooth
  const existingMap = new Map<number, Particle[]>();
  for (const p of existingParticles) {
    const list = existingMap.get(p.edgeIndex) ?? [];
    list.push(p);
    existingMap.set(p.edgeIndex, list);
  }

  const newParticles: Particle[] = [];
  const perEdge = particlesPerEdge(algoId, 1, activeEdges.length);

  for (const { edge, index } of activeEdges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) continue;

    const existing = existingMap.get(index) ?? [];
    const needed = perEdge - existing.length;

    // Keep existing particles for continuity
    for (const p of existing) {
      newParticles.push(p);
    }

    const speed = computeParticleSpeed(algoId, edge.weight ?? 1);
    const isDirected = edge.directed ?? false;

    for (let k = 0; k < needed && newParticles.length < MAX_PARTICLES; k++) {
      // Stagger initial positions so particles don't bunch up
      const tOffset = (existing.length + k) / (perEdge + 1);
      newParticles.push({
        edgeIndex: index,
        t: tOffset,
        speed,
        opacity: 0.65 + Math.random() * 0.2,
        radius: 2 + Math.random() * 1,
        color,
        direction: isDirected ? 1 : (Math.random() > 0.5 ? 1 : -1),
        trail: [],
      });
    }
  }

  return newParticles;
}

// ============================================================================
// TYPES
// ============================================================================

interface GraphNode {
  id: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  directed?: boolean;
}

interface GraphResult {
  type: 'shortest-path' | 'mst' | 'all-pairs' | 'traversal' | 'topological' | 'scc';
  path?: string[];
  distance?: number;
  edges?: GraphEdge[];
  matrix?: number[][];
  order?: string[];
  components?: string[][];
}

type NodeState = 'unvisited' | 'visiting' | 'visited';

type ContextMenuTarget =
  | { kind: 'node'; id: string; x: number; y: number }
  | { kind: 'edge'; index: number; x: number; y: number }
  | null;

type AlgorithmId =
  | 'bfs'
  | 'dfs'
  | 'dijkstra'
  | 'astar'
  | 'bellman-ford'
  | 'floyd'
  | 'kruskal'
  | 'prim'
  | 'topo-sort'
  | 'tarjan-scc';

// SVG canvas dimensions
const SVG_WIDTH = 540;
const SVG_HEIGHT = 340;
const NODE_RADIUS = 22;
const GRID_SIZE = 20;

// ============================================================================
// ALGORITHM METADATA
// ============================================================================
interface AlgorithmMeta {
  id: AlgorithmId;
  label: string;
  complexity: string;
  description: string;
  needsStart: boolean;
  needsEnd: boolean;
  needsWeights: boolean;
  directed: boolean;
}

const ALGORITHMS: AlgorithmMeta[] = [
  {
    id: 'bfs',
    label: 'BFS — Breadth-First Search',
    complexity: 'O(V + E)',
    description:
      'Explores all neighbors at the current depth before moving to the next level. Finds shortest paths in unweighted graphs.',
    needsStart: true,
    needsEnd: false,
    needsWeights: false,
    directed: false,
  },
  {
    id: 'dfs',
    label: 'DFS — Depth-First Search',
    complexity: 'O(V + E)',
    description:
      'Explores as far as possible along each branch before backtracking. Used for cycle detection, connectivity, and ordering.',
    needsStart: true,
    needsEnd: false,
    needsWeights: false,
    directed: false,
  },
  {
    id: 'dijkstra',
    label: "Dijkstra — Shortest Path",
    complexity: 'O((V+E) log V)',
    description:
      "Greedy algorithm finding shortest paths from a source in weighted graphs with non-negative edge weights. Foundation of GPS routing.",
    needsStart: true,
    needsEnd: true,
    needsWeights: true,
    directed: false,
  },
  {
    id: 'astar',
    label: 'A* — Heuristic Search',
    complexity: 'O(E log V)',
    description:
      'Uses a heuristic (Euclidean distance) to guide search toward the goal. Faster than Dijkstra when a good heuristic exists.',
    needsStart: true,
    needsEnd: true,
    needsWeights: true,
    directed: false,
  },
  {
    id: 'bellman-ford',
    label: 'Bellman-Ford — Negative Weights',
    complexity: 'O(V·E)',
    description:
      'Finds shortest paths even with negative edge weights. Detects negative-weight cycles. Slower than Dijkstra but more general.',
    needsStart: true,
    needsEnd: true,
    needsWeights: true,
    directed: false,
  },
  {
    id: 'floyd',
    label: 'Floyd-Warshall — All Pairs',
    complexity: 'O(V³)',
    description:
      'Computes shortest paths between every pair of nodes using dynamic programming. Handles negative weights but not negative cycles.',
    needsStart: false,
    needsEnd: false,
    needsWeights: true,
    directed: false,
  },
  {
    id: 'kruskal',
    label: "Kruskal — MST",
    complexity: 'O(E log E)',
    description:
      "Greedy MST algorithm sorting edges by weight and adding them if they don't create a cycle. Uses union-find data structure.",
    needsStart: false,
    needsEnd: false,
    needsWeights: true,
    directed: false,
  },
  {
    id: 'prim',
    label: "Prim — MST",
    complexity: 'O(E log V)',
    description:
      "Builds the MST by greedily adding the cheapest edge connecting the current tree to a new vertex. Efficient on dense graphs.",
    needsStart: true,
    needsEnd: false,
    needsWeights: true,
    directed: false,
  },
  {
    id: 'topo-sort',
    label: 'Topological Sort',
    complexity: 'O(V + E)',
    description:
      'Orders vertices of a directed acyclic graph (DAG) such that every directed edge u→v has u before v. Used for task scheduling.',
    needsStart: false,
    needsEnd: false,
    needsWeights: false,
    directed: true,
  },
  {
    id: 'tarjan-scc',
    label: "Tarjan's SCC",
    complexity: 'O(V + E)',
    description:
      "Finds all strongly connected components in a directed graph using a single DFS pass with a stack. Linear time complexity.",
    needsStart: false,
    needsEnd: false,
    needsWeights: false,
    directed: true,
  },
];

// ============================================================================
// GRAPH ALGORITHMS IMPLEMENTATIONS
// ============================================================================

function bfs(
  adj: Map<string, Array<{ node: string; weight: number }>>,
  start: string,
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const neighbors = adj.get(current) ?? [];
    for (const { node: neighbor } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

function dfs(
  adj: Map<string, Array<{ node: string; weight: number }>>,
  start: string,
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfsVisit(nodeId: string): void {
    visited.add(nodeId);
    order.push(nodeId);
    const neighbors = adj.get(nodeId) ?? [];
    for (const { node: neighbor } of neighbors) {
      if (!visited.has(neighbor)) {
        dfsVisit(neighbor);
      }
    }
  }

  dfsVisit(start);
  return order;
}

function dijkstra(
  adj: Map<string, Array<{ node: string; weight: number }>>,
  start: string,
  end: string,
): { path: string[]; distance: number } {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const node of adj.keys()) {
    distances.set(node, node === start ? 0 : Infinity);
    previous.set(node, null);
    unvisited.add(node);
  }

  while (unvisited.size > 0) {
    let current: string | null = null;
    let minDist = Infinity;
    for (const node of unvisited) {
      const dist = distances.get(node) ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        current = node;
      }
    }

    if (current === null || minDist === Infinity) break;
    unvisited.delete(current);

    const neighbors = adj.get(current) ?? [];
    for (const { node: neighbor, weight } of neighbors) {
      if (!unvisited.has(neighbor)) continue;
      const altDist = (distances.get(current) ?? Infinity) + weight;
      if (altDist < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, altDist);
        previous.set(neighbor, current);
      }
    }
  }

  const path: string[] = [];
  let curr: string | null = end;
  while (curr !== null) {
    path.unshift(curr);
    if (curr === start) break;
    curr = previous.get(curr) ?? null;
  }

  return {
    path: path.length > 1 && path[0] === start ? path : [],
    distance: distances.get(end) ?? Infinity,
  };
}

function astar(
  adj: Map<string, Array<{ node: string; weight: number }>>,
  nodes: GraphNode[],
  start: string,
  end: string,
): { path: string[]; distance: number } {
  const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));

  function heuristic(a: string, b: string): number {
    const na = nodeMap.get(a);
    const nb = nodeMap.get(b);
    if (!na || !nb) return 0;
    const dx = na.x - nb.x;
    const dy = na.y - nb.y;
    return Math.sqrt(dx * dx + dy * dy) / 60; // scale to approximate weight units
  }

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const openSet = new Set<string>();

  for (const node of adj.keys()) {
    gScore.set(node, node === start ? 0 : Infinity);
    fScore.set(node, node === start ? heuristic(start, end) : Infinity);
    previous.set(node, null);
  }
  openSet.add(start);

  while (openSet.size > 0) {
    let current: string | null = null;
    let minF = Infinity;
    for (const node of openSet) {
      const f = fScore.get(node) ?? Infinity;
      if (f < minF) {
        minF = f;
        current = node;
      }
    }

    if (current === null) break;
    if (current === end) break;

    openSet.delete(current);

    const neighbors = adj.get(current) ?? [];
    for (const { node: neighbor, weight } of neighbors) {
      const tentativeG = (gScore.get(current) ?? Infinity) + weight;
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        previous.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + heuristic(neighbor, end));
        openSet.add(neighbor);
      }
    }
  }

  const path: string[] = [];
  let curr: string | null = end;
  while (curr !== null) {
    path.unshift(curr);
    if (curr === start) break;
    curr = previous.get(curr) ?? null;
  }

  return {
    path: path.length > 1 && path[0] === start ? path : [],
    distance: gScore.get(end) ?? Infinity,
  };
}

function bellmanFord(
  _adj: Map<string, Array<{ node: string; weight: number }>>,
  nodeIds: string[],
  edges: GraphEdge[],
  start: string,
  end: string,
): { path: string[]; distance: number; hasNegativeCycle: boolean } {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();

  for (const id of nodeIds) {
    distances.set(id, id === start ? 0 : Infinity);
    previous.set(id, null);
  }

  // Relax edges V-1 times
  for (let i = 0; i < nodeIds.length - 1; i++) {
    for (const edge of edges) {
      const u = edge.from;
      const v = edge.to;
      const w = edge.weight;
      const du = distances.get(u) ?? Infinity;
      const dv = distances.get(v) ?? Infinity;
      if (du !== Infinity && du + w < dv) {
        distances.set(v, du + w);
        previous.set(v, u);
      }
      // Undirected: also relax reverse
      const dv2 = distances.get(v) ?? Infinity;
      const du2 = distances.get(u) ?? Infinity;
      if (dv2 !== Infinity && dv2 + w < du2) {
        distances.set(u, dv2 + w);
        previous.set(u, v);
      }
    }
  }

  // Check for negative cycles
  let hasNegativeCycle = false;
  for (const edge of edges) {
    const du = distances.get(edge.from) ?? Infinity;
    const dv = distances.get(edge.to) ?? Infinity;
    if (du !== Infinity && du + edge.weight < dv) {
      hasNegativeCycle = true;
    }
  }

  const path: string[] = [];
  let curr: string | null = end;
  while (curr !== null) {
    path.unshift(curr);
    if (curr === start) break;
    curr = previous.get(curr) ?? null;
  }

  return {
    path: path.length > 1 && path[0] === start ? path : [],
    distance: distances.get(end) ?? Infinity,
    hasNegativeCycle,
  };
}

function floydWarshall(
  adj: Map<string, Array<{ node: string; weight: number }>>,
  nodeIds: string[],
): number[][] {
  const n = nodeIds.length;
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    const row = dist[i];
    if (row) row[i] = 0;
  }

  for (let i = 0; i < n; i++) {
    const node = nodeIds[i];
    if (!node) continue;
    const neighbors = adj.get(node) ?? [];
    for (const { node: neighbor, weight } of neighbors) {
      const j = nodeIds.indexOf(neighbor);
      const row = dist[i];
      if (j !== -1 && row) row[j] = weight;
    }
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dik = dist[i]?.[k];
        const dkj = dist[k]?.[j];
        const dij = dist[i]?.[j];
        if (dik !== undefined && dkj !== undefined && dij !== undefined) {
          const row = dist[i];
          if (dik + dkj < dij && row) row[j] = dik + dkj;
        }
      }
    }
  }

  return dist;
}

function topologicalSort(
  directedAdj: Map<string, string[]>,
  nodeIds: string[],
): { order: string[]; hasCycle: boolean } {
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) inDegree.set(id, 0);

  for (const [, neighbors] of Array.from(directedAdj)) {
    for (const n of neighbors) {
      inDegree.set(n, (inDegree.get(n) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of Array.from(inDegree)) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    const neighbors = directedAdj.get(node) ?? [];
    for (const n of neighbors) {
      const newDeg = (inDegree.get(n) ?? 0) - 1;
      inDegree.set(n, newDeg);
      if (newDeg === 0) queue.push(n);
    }
  }

  return {
    order,
    hasCycle: order.length !== nodeIds.length,
  };
}

function tarjanSCC(
  directedAdj: Map<string, string[]>,
  nodeIds: string[],
): string[][] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  function strongconnect(v: string): void {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.set(v, true);

    const neighbors = directedAdj.get(v) ?? [];
    for (const w of neighbors) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0));
      } else if (onStack.get(w)) {
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, index.get(w) ?? 0));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.set(w, false);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const id of nodeIds) {
    if (!index.has(id)) {
      strongconnect(id);
    }
  }

  return sccs;
}

// ============================================================================
// HELPERS
// ============================================================================
function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getNodeState(nodeId: string, result: GraphResult | null): NodeState {
  if (!result) return 'unvisited';
  if (result.type === 'shortest-path' && result.path) {
    if (result.path.includes(nodeId)) return 'visited';
  }
  if (result.type === 'mst' && result.edges) {
    const inMst = result.edges.some((e) => e.from === nodeId || e.to === nodeId);
    if (inMst) return 'visited';
  }
  if (result.type === 'traversal' && result.order) {
    if (result.order.includes(nodeId)) return 'visited';
  }
  if (result.type === 'topological' && result.order) {
    if (result.order.includes(nodeId)) return 'visited';
  }
  return 'unvisited';
}

function isEdgeHighlighted(edge: GraphEdge, result: GraphResult | null): boolean {
  if (!result) return false;
  if (result.type === 'shortest-path' && result.path) {
    for (let i = 0; i < result.path.length - 1; i++) {
      if (
        (result.path[i] === edge.from && result.path[i + 1] === edge.to) ||
        (result.path[i] === edge.to && result.path[i + 1] === edge.from)
      ) {
        return true;
      }
    }
  }
  if (result.type === 'mst' && result.edges) {
    return result.edges.some(
      (e) =>
        (e.from === edge.from && e.to === edge.to) ||
        (e.from === edge.to && e.to === edge.from),
    );
  }
  return false;
}

function getSCCColor(nodeId: string, result: GraphResult | null): string | null {
  if (!result || result.type !== 'scc' || !result.components) return null;
  const colors = [
    'oklch(0.65 0.18 155)',
    'oklch(0.65 0.2 30)',
    'oklch(0.65 0.2 280)',
    'oklch(0.65 0.2 60)',
    'oklch(0.65 0.2 200)',
    'oklch(0.65 0.2 340)',
  ];
  for (let i = 0; i < result.components.length; i++) {
    if (result.components[i]?.includes(nodeId)) {
      return colors[i % colors.length] ?? 'oklch(0.65 0.18 155)';
    }
  }
  return null;
}

// Quadratic bezier control point for curved edges
function getEdgePath(
  fromNode: GraphNode,
  toNode: GraphNode,
  curvature = 0.15,
): { path: string; midX: number; midY: number } {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  const perpX = (-dy / len) * curvature * len;
  const perpY = (dx / len) * curvature * len;

  const mx = (fromNode.x + toNode.x) / 2 + perpX;
  const my = (fromNode.y + toNode.y) / 2 + perpY;

  const path = `M ${fromNode.x} ${fromNode.y} Q ${mx} ${my} ${toNode.x} ${toNode.y}`;
  return { path, midX: mx, midY: my };
}

// ============================================================================
// PROOF CONTENT GENERATOR
// ============================================================================

interface ProofSection {
  title: string;
  steps: string[];
  explanation: string;
}

function getProofContent(
  result: GraphResult,
  algoId: AlgorithmId,
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): ProofSection {
  const nodeIds = graphNodes.map((n) => n.id);
  const edgeWeightMap = new Map<string, number>();
  for (const e of graphEdges) {
    edgeWeightMap.set(`${e.from}->${e.to}`, e.weight);
    if (!e.directed) {
      edgeWeightMap.set(`${e.to}->${e.from}`, e.weight);
    }
  }

  function getWeight(from: string, to: string): number {
    return edgeWeightMap.get(`${from}->${to}`) ?? edgeWeightMap.get(`${to}->${from}`) ?? 1;
  }

  switch (result.type) {
    case 'shortest-path': {
      const path = result.path ?? [];
      const dist = result.distance ?? Infinity;
      if (path.length === 0) {
        return {
          title: `${algoId === 'bellman-ford' ? 'Bellman-Ford' : algoId === 'astar' ? 'A*' : 'Dijkstra'} Relaxation Trace`,
          steps: ['No path exists between the selected nodes.'],
          explanation: 'The algorithm explored all reachable nodes and could not find a connection to the target.',
        };
      }
      const steps: string[] = [];
      steps.push(`Starting from node ${path[0]} with distance 0.`);
      let cumulative = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i]!;
        const to = path[i + 1]!;
        const w = getWeight(from, to);
        cumulative += w;
        steps.push(
          `Relaxing edge ${from}\u2192${to}: d[${to}] = d[${from}] + w(${from},${to}) = ${cumulative - w} + ${w} = ${cumulative}.`,
        );
      }
      steps.push(`Final shortest path: ${path.join(' \u2192 ')} with total distance ${dist}.`);
      const algoName = algoId === 'bellman-ford' ? 'Bellman-Ford' : algoId === 'astar' ? 'A*' : 'Dijkstra';
      return {
        title: `${algoName} Relaxation Trace`,
        steps,
        explanation:
          algoId === 'bellman-ford'
            ? 'Bellman-Ford relaxes every edge V\u22121 times. If no negative-weight cycle exists, each node is finalized with its shortest distance.'
            : algoId === 'astar'
              ? 'A* combines actual path cost g(n) with a heuristic estimate h(n). With an admissible heuristic, the first path found to the goal is optimal.'
              : 'By the greedy property of Dijkstra\u2019s algorithm, each node is finalized with its shortest distance when extracted from the priority queue.',
      };
    }

    case 'traversal': {
      const order = result.order ?? [];
      if (algoId === 'bfs') {
        // Build level-by-level breakdown
        const adj = new Map<string, string[]>();
        for (const e of graphEdges) {
          if (!adj.has(e.from)) adj.set(e.from, []);
          if (!adj.has(e.to)) adj.set(e.to, []);
          adj.get(e.from)!.push(e.to);
          if (!e.directed) adj.get(e.to)!.push(e.from);
        }
        const visited = new Set<string>();
        const levels: string[][] = [];
        if (order.length > 0) {
          let currentLevel = [order[0]!];
          visited.add(order[0]!);
          levels.push(currentLevel);
          while (currentLevel.length > 0) {
            const nextLevel: string[] = [];
            for (const node of currentLevel) {
              for (const neighbor of adj.get(node) ?? []) {
                if (!visited.has(neighbor)) {
                  visited.add(neighbor);
                  nextLevel.push(neighbor);
                }
              }
            }
            if (nextLevel.length > 0) levels.push(nextLevel);
            currentLevel = nextLevel;
          }
        }
        const steps = levels.map(
          (level, i) => `Level ${i}: {${level.join(', ')}}.`,
        );
        return {
          title: 'BFS Level-by-Level Traversal',
          steps,
          explanation:
            'BFS guarantees that nodes are discovered in order of their distance (unweighted) from the source. Each level contains nodes exactly one hop further than the previous level.',
        };
      }
      // DFS
      const steps: string[] = [];
      const visited = new Set<string>();
      const adj = new Map<string, string[]>();
      for (const e of graphEdges) {
        if (!adj.has(e.from)) adj.set(e.from, []);
        if (!adj.has(e.to)) adj.set(e.to, []);
        adj.get(e.from)!.push(e.to);
        if (!e.directed) adj.get(e.to)!.push(e.from);
      }
      function traceDfs(node: string): void {
        visited.add(node);
        steps.push(`Visit ${node}.`);
        for (const neighbor of adj.get(node) ?? []) {
          if (!visited.has(neighbor)) {
            traceDfs(neighbor);
            steps.push(`Backtrack to ${node}.`);
          }
        }
      }
      if (order.length > 0) traceDfs(order[0]!);
      return {
        title: 'DFS Discovery & Backtracking Trace',
        steps,
        explanation:
          'DFS explores as far as possible along each branch before backtracking. It uses a stack (implicit via recursion) and visits nodes in depth-first order.',
      };
    }

    case 'mst': {
      const mstEdges = result.edges ?? [];
      // Sort all graph edges by weight for Kruskal explanation
      const sorted = [...graphEdges].sort((a, b) => a.weight - b.weight);
      const mstSet = new Set(
        mstEdges.map((e) => `${e.from}-${e.to}`),
      );
      const mstSetReverse = new Set(
        mstEdges.map((e) => `${e.to}-${e.from}`),
      );
      const steps: string[] = [];
      steps.push(
        `Edges sorted by weight: ${sorted.map((e) => `(${e.from}\u2014${e.to}, ${e.weight})`).join(', ')}.`,
      );
      for (const e of sorted) {
        const key = `${e.from}-${e.to}`;
        const keyRev = `${e.to}-${e.from}`;
        if (mstSet.has(key) || mstSetReverse.has(key) || mstSet.has(keyRev) || mstSetReverse.has(keyRev)) {
          steps.push(`Edge (${e.from}\u2014${e.to}, ${e.weight}): adds to MST (no cycle formed).`);
        } else {
          steps.push(`Edge (${e.from}\u2014${e.to}, ${e.weight}): SKIP (would create a cycle).`);
        }
      }
      const totalWeight = mstEdges.reduce((s, e) => s + e.weight, 0);
      steps.push(`MST total weight: ${totalWeight}.`);
      const isKruskal = algoId === 'kruskal';
      return {
        title: isKruskal ? "Kruskal\u2019s Edge Selection Trace" : "Prim\u2019s Growth Trace",
        steps,
        explanation: isKruskal
          ? 'Kruskal\u2019s algorithm uses a Union-Find data structure to efficiently detect cycles. Each edge is considered in weight order; if its endpoints are in different components, it is added to the MST.'
          : 'Prim\u2019s algorithm grows the MST from a starting vertex, always adding the cheapest edge that connects the current tree to a new vertex.',
      };
    }

    case 'topological': {
      const order = result.order ?? [];
      const steps: string[] = [];
      steps.push(`Topological ordering: ${order.join(' \u2192 ')}.`);
      // Verify each edge
      const violations: string[] = [];
      for (const e of graphEdges) {
        if (e.directed) {
          const uIdx = order.indexOf(e.from);
          const vIdx = order.indexOf(e.to);
          if (uIdx !== -1 && vIdx !== -1) {
            if (uIdx < vIdx) {
              steps.push(`Edge ${e.from}\u2192${e.to}: ${e.from} at position ${uIdx} < ${e.to} at position ${vIdx}. \u2713`);
            } else {
              violations.push(`${e.from}\u2192${e.to}`);
            }
          }
        }
      }
      if (violations.length > 0) {
        steps.push(`Violations found: ${violations.join(', ')} (graph may contain a cycle).`);
      }
      return {
        title: 'Topological Order Verification',
        steps,
        explanation:
          'For each directed edge u\u2192v in the graph, u appears before v in the ordering. This is guaranteed by the DFS-based (Kahn\u2019s) algorithm that processes nodes with in-degree zero first.',
      };
    }

    case 'scc': {
      const components = result.components ?? [];
      const steps: string[] = [];
      for (let i = 0; i < components.length; i++) {
        const comp = components[i]!;
        steps.push(
          `Component ${i + 1}: {${comp.join(', ')}} \u2014 every node can reach every other node in this set.`,
        );
      }
      if (components.length === nodeIds.length) {
        steps.push('All components are singletons: no strongly connected cycles exist.');
      }
      return {
        title: "Tarjan\u2019s SCC Discovery",
        steps,
        explanation:
          'Tarjan\u2019s algorithm uses a single DFS pass with a stack. Each node receives an index (discovery time) and a lowlink (lowest index reachable). When a node\u2019s lowlink equals its index, it is the root of a strongly connected component, and all nodes above it on the stack form that SCC.',
      };
    }

    case 'all-pairs': {
      const steps: string[] = [];
      steps.push(
        'Floyd-Warshall initialises d[i][j] = w(i,j) if edge exists, \u221E otherwise, and 0 on the diagonal.',
      );
      for (const node of nodeIds) {
        steps.push(
          `Considering ${node} as intermediate vertex: for each pair (i,j), d[i][j] = min(d[i][j], d[i][${node}] + d[${node}][j]).`,
        );
      }
      steps.push('After all V iterations, d[i][j] contains the shortest path from i to j (or \u221E if unreachable).');
      return {
        title: 'Floyd-Warshall Distance Matrix Evolution',
        steps,
        explanation:
          'Floyd-Warshall uses dynamic programming to consider every possible intermediate vertex. After iteration k, d[i][j] holds the shortest path from i to j using only vertices {1, \u2026, k} as intermediaries. The algorithm runs in O(V\u00B3) time.',
      };
    }
  }
}

// ============================================================================
// PRESET GRAPHS
// ============================================================================
type PresetId =
  | 'simple-path'
  | 'complete-k5'
  | 'binary-tree'
  | 'grid-3x3'
  | 'petersen'
  | 'random-sparse'
  | 'dag'
  | 'bipartite-k33'
  | 'weighted-network'
  | 'disconnected';

interface PresetDef {
  label: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const PRESETS: Record<PresetId, PresetDef> = {
  'simple-path': {
    label: 'Simple Path',
    description: '5 nodes in a linear chain',
    nodes: [
      { id: 'A', x: 80, y: 170 },
      { id: 'B', x: 180, y: 100 },
      { id: 'C', x: 280, y: 170 },
      { id: 'D', x: 380, y: 100 },
      { id: 'E', x: 460, y: 170 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 2 },
      { from: 'B', to: 'C', weight: 3 },
      { from: 'C', to: 'D', weight: 1 },
      { from: 'D', to: 'E', weight: 4 },
    ],
  },
  'complete-k5': {
    label: 'Complete Graph K5',
    description: 'Every node connected to every other',
    nodes: [
      { id: 'A', x: 270, y: 60 },
      { id: 'B', x: 440, y: 170 },
      { id: 'C', x: 380, y: 290 },
      { id: 'D', x: 160, y: 290 },
      { id: 'E', x: 100, y: 170 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 3 },
      { from: 'A', to: 'C', weight: 5 },
      { from: 'A', to: 'D', weight: 4 },
      { from: 'A', to: 'E', weight: 2 },
      { from: 'B', to: 'C', weight: 2 },
      { from: 'B', to: 'D', weight: 6 },
      { from: 'B', to: 'E', weight: 5 },
      { from: 'C', to: 'D', weight: 1 },
      { from: 'C', to: 'E', weight: 7 },
      { from: 'D', to: 'E', weight: 3 },
    ],
  },
  'binary-tree': {
    label: 'Binary Tree',
    description: 'Complete binary tree with 7 nodes',
    nodes: [
      { id: 'A', x: 270, y: 60 },
      { id: 'B', x: 160, y: 150 },
      { id: 'C', x: 380, y: 150 },
      { id: 'D', x: 100, y: 250 },
      { id: 'E', x: 220, y: 250 },
      { id: 'F', x: 320, y: 250 },
      { id: 'G', x: 440, y: 250 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'A', to: 'C', weight: 1 },
      { from: 'B', to: 'D', weight: 2 },
      { from: 'B', to: 'E', weight: 3 },
      { from: 'C', to: 'F', weight: 2 },
      { from: 'C', to: 'G', weight: 4 },
    ],
  },
  'grid-3x3': {
    label: 'Grid Graph 3×3',
    description: '9 nodes in a 3×3 grid',
    nodes: [
      { id: 'A', x: 140, y: 100 },
      { id: 'B', x: 270, y: 100 },
      { id: 'C', x: 400, y: 100 },
      { id: 'D', x: 140, y: 190 },
      { id: 'E', x: 270, y: 190 },
      { id: 'F', x: 400, y: 190 },
      { id: 'G', x: 140, y: 280 },
      { id: 'H', x: 270, y: 280 },
      { id: 'I', x: 400, y: 280 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 1 },
      { from: 'D', to: 'E', weight: 1 },
      { from: 'E', to: 'F', weight: 1 },
      { from: 'G', to: 'H', weight: 1 },
      { from: 'H', to: 'I', weight: 1 },
      { from: 'A', to: 'D', weight: 1 },
      { from: 'B', to: 'E', weight: 1 },
      { from: 'C', to: 'F', weight: 1 },
      { from: 'D', to: 'G', weight: 1 },
      { from: 'E', to: 'H', weight: 1 },
      { from: 'F', to: 'I', weight: 1 },
    ],
  },
  petersen: {
    label: 'Petersen Graph',
    description: 'Classic 3-regular graph on 10 vertices',
    nodes: [
      { id: 'A', x: 270, y: 50 },
      { id: 'B', x: 440, y: 175 },
      { id: 'C', x: 375, y: 300 },
      { id: 'D', x: 165, y: 300 },
      { id: 'E', x: 100, y: 175 },
      { id: 'F', x: 270, y: 130 },
      { id: 'G', x: 360, y: 195 },
      { id: 'H', x: 325, y: 250 },
      { id: 'I', x: 215, y: 250 },
      { id: 'J', x: 180, y: 195 },
    ],
    edges: [
      // Outer pentagon
      { from: 'A', to: 'B', weight: 2 },
      { from: 'B', to: 'C', weight: 2 },
      { from: 'C', to: 'D', weight: 2 },
      { from: 'D', to: 'E', weight: 2 },
      { from: 'E', to: 'A', weight: 2 },
      // Inner pentagram spokes
      { from: 'A', to: 'F', weight: 1 },
      { from: 'B', to: 'G', weight: 1 },
      { from: 'C', to: 'H', weight: 1 },
      { from: 'D', to: 'I', weight: 1 },
      { from: 'E', to: 'J', weight: 1 },
      // Inner pentagram edges
      { from: 'F', to: 'H', weight: 3 },
      { from: 'H', to: 'J', weight: 3 },
      { from: 'J', to: 'G', weight: 3 },
      { from: 'G', to: 'I', weight: 3 },
      { from: 'I', to: 'F', weight: 3 },
    ],
  },
  'random-sparse': {
    label: 'Random Sparse',
    description: '8 nodes with sparse random connections',
    nodes: [
      { id: 'A', x: 120, y: 100 },
      { id: 'B', x: 300, y: 80 },
      { id: 'C', x: 460, y: 130 },
      { id: 'D', x: 200, y: 220 },
      { id: 'E', x: 380, y: 250 },
      { id: 'F', x: 100, y: 280 },
      { id: 'G', x: 480, y: 290 },
      { id: 'H', x: 280, y: 300 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 4 },
      { from: 'A', to: 'D', weight: 7 },
      { from: 'B', to: 'C', weight: 2 },
      { from: 'B', to: 'E', weight: 5 },
      { from: 'C', to: 'G', weight: 3 },
      { from: 'D', to: 'F', weight: 1 },
      { from: 'D', to: 'H', weight: 6 },
      { from: 'E', to: 'G', weight: 2 },
      { from: 'F', to: 'H', weight: 3 },
      { from: 'H', to: 'E', weight: 4 },
    ],
  },
  dag: {
    label: 'DAG',
    description: 'Directed acyclic graph for topological sort',
    nodes: [
      { id: 'A', x: 100, y: 170 },
      { id: 'B', x: 230, y: 100 },
      { id: 'C', x: 230, y: 240 },
      { id: 'D', x: 360, y: 100 },
      { id: 'E', x: 360, y: 240 },
      { id: 'F', x: 460, y: 170 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 1, directed: true },
      { from: 'A', to: 'C', weight: 2, directed: true },
      { from: 'B', to: 'D', weight: 3, directed: true },
      { from: 'C', to: 'E', weight: 1, directed: true },
      { from: 'D', to: 'F', weight: 2, directed: true },
      { from: 'E', to: 'F', weight: 4, directed: true },
      { from: 'B', to: 'E', weight: 2, directed: true },
    ],
  },
  'bipartite-k33': {
    label: 'Bipartite K₃,₃',
    description: 'Complete bipartite graph with 3+3 nodes',
    nodes: [
      { id: 'L1', x: 120, y: 80 },
      { id: 'L2', x: 120, y: 170 },
      { id: 'L3', x: 120, y: 260 },
      { id: 'R1', x: 420, y: 80 },
      { id: 'R2', x: 420, y: 170 },
      { id: 'R3', x: 420, y: 260 },
    ],
    edges: [
      { from: 'L1', to: 'R1', weight: 2 },
      { from: 'L1', to: 'R2', weight: 5 },
      { from: 'L1', to: 'R3', weight: 3 },
      { from: 'L2', to: 'R1', weight: 4 },
      { from: 'L2', to: 'R2', weight: 1 },
      { from: 'L2', to: 'R3', weight: 6 },
      { from: 'L3', to: 'R1', weight: 7 },
      { from: 'L3', to: 'R2', weight: 3 },
      { from: 'L3', to: 'R3', weight: 2 },
    ],
  },
  'weighted-network': {
    label: 'Weighted Network',
    description: '7 nodes with varied edge weights for shortest path',
    nodes: [
      { id: 'S', x: 80, y: 170 },
      { id: 'A', x: 200, y: 80 },
      { id: 'B', x: 200, y: 260 },
      { id: 'C', x: 320, y: 130 },
      { id: 'D', x: 320, y: 220 },
      { id: 'E', x: 430, y: 170 },
      { id: 'T', x: 520, y: 170 },
    ],
    edges: [
      { from: 'S', to: 'A', weight: 4 },
      { from: 'S', to: 'B', weight: 2 },
      { from: 'A', to: 'C', weight: 5 },
      { from: 'A', to: 'D', weight: 10 },
      { from: 'B', to: 'D', weight: 3 },
      { from: 'B', to: 'A', weight: 1 },
      { from: 'C', to: 'E', weight: 3 },
      { from: 'D', to: 'E', weight: 4 },
      { from: 'D', to: 'C', weight: 2 },
      { from: 'E', to: 'T', weight: 1 },
    ],
  },
  disconnected: {
    label: 'Disconnected Components',
    description: '2 separate components: triangle + square',
    nodes: [
      { id: 'A', x: 100, y: 100 },
      { id: 'B', x: 220, y: 80 },
      { id: 'C', x: 160, y: 220 },
      { id: 'P', x: 340, y: 90 },
      { id: 'Q', x: 460, y: 90 },
      { id: 'R', x: 460, y: 230 },
      { id: 'S', x: 340, y: 230 },
    ],
    edges: [
      { from: 'A', to: 'B', weight: 3 },
      { from: 'B', to: 'C', weight: 4 },
      { from: 'C', to: 'A', weight: 2 },
      { from: 'P', to: 'Q', weight: 5 },
      { from: 'Q', to: 'R', weight: 1 },
      { from: 'R', to: 'S', weight: 6 },
      { from: 'S', to: 'P', weight: 3 },
    ],
  },
};

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================
interface ContextMenuProps {
  target: ContextMenuTarget;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (index: number) => void;
  onClose: () => void;
}

function ContextMenu({ target, onDeleteNode, onDeleteEdge, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!target) return null;

  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-label={target.kind === 'node' ? `Node ${target.id} context menu` : 'Edge context menu'}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      style={{ left: target.x, top: target.y }}
      className="absolute z-50 min-w-36 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden"
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        {target.kind === 'node' ? `Node ${target.id}` : 'Edge'}
      </div>
      <button
        role="menuitem"
        onClick={() => {
          if (target.kind === 'node') onDeleteNode(target.id);
          else onDeleteEdge(target.index);
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete {target.kind === 'node' ? 'node' : 'edge'}
      </button>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function GraphAlgorithmsPage() {
  const prefersReducedMotion = useReducedMotion();
  const gradientId = useId();
  const pathGradientId = useId();
  const filterBlurId = useId();

  // Graph state
  const [nodes, setNodes] = useState<GraphNode[]>([
    { id: 'A', x: 140, y: 120 },
    { id: 'B', x: 340, y: 100 },
    { id: 'C', x: 220, y: 250 },
    { id: 'D', x: 400, y: 240 },
  ]);
  const [edges, setEdges] = useState<GraphEdge[]>([
    { from: 'A', to: 'B', weight: 4 },
    { from: 'A', to: 'C', weight: 2 },
    { from: 'B', to: 'C', weight: 1 },
    { from: 'B', to: 'D', weight: 5 },
    { from: 'C', to: 'D', weight: 3 },
  ]);

  // Algorithm state
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('dijkstra');
  const [startNode, setStartNode] = useState('A');
  const [endNode, setEndNode] = useState('D');
  const [result, setResult] = useState<GraphResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interaction state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [edgeDragFrom, setEdgeDragFrom] = useState<string | null>(null);
  const [edgeDragPos, setEdgeDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget>(null);
  const [newEdgeWeight, setNewEdgeWeight] = useState(5);
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');
  const [addingNode, setAddingNode] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  // Particle system
  const [showParticles, setShowParticles] = useState(true);
  const particleStateRef = useRef<ParticleSystemState>({ particles: [], ripples: [] });
  const particleRafRef = useRef<number | undefined>(undefined);
  const lastFrameTimeRef = useRef<number>(0);
  // Track which nodes were activated so we can fire ripples
  const prevResultRef = useRef<GraphResult | null>(null);
  // Mutable refs for latest nodes/edges — read by animation loop without stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const currentAlgoMeta = ALGORITHMS.find((a) => a.id === algorithm) ?? ALGORITHMS[0]!;

  // -------------------------------------------------------------------------
  // Particle system: rebuild particles when result changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!showParticles) {
      particleStateRef.current.particles = [];
      prevResultRef.current = null;
      return;
    }
    if (result === prevResultRef.current) return;
    prevResultRef.current = result;

    const color = getAlgorithmColor(algorithm);
    const newParticles = buildParticles(
      algorithm,
      nodes,
      edges,
      result,
      color,
      particleStateRef.current.particles,
    );
    particleStateRef.current.particles = newParticles;

    // Fire ripples for nodes that became active
    if (result) {
      const activeNodes = new Set<string>();
      if ((result.type === 'traversal' || result.type === 'topological') && result.order) {
        for (const id of result.order) activeNodes.add(id);
      }
      if (result.type === 'shortest-path' && result.path) {
        for (const id of result.path) activeNodes.add(id);
      }
      if (result.type === 'mst' && result.edges) {
        for (const e of result.edges) { activeNodes.add(e.from); activeNodes.add(e.to); }
      }
      if (result.type === 'scc') {
        for (const n of nodes) activeNodes.add(n.id);
      }
      if (result.type === 'all-pairs') {
        for (const n of nodes) activeNodes.add(n.id);
      }

      const newRipples: Ripple[] = [];
      for (const nodeId of activeNodes) {
        const n = nodes.find((nd) => nd.id === nodeId);
        if (!n) continue;
        newRipples.push({
          nodeId,
          x: n.x,
          y: n.y,
          radius: NODE_RADIUS,
          maxRadius: NODE_RADIUS * 3.2,
          opacity: 0.7,
          color,
        });
      }
      particleStateRef.current.ripples = newRipples;
    } else {
      particleStateRef.current.ripples = [];
    }
  }, [result, algorithm, nodes, edges, showParticles]);

  // -------------------------------------------------------------------------
  // Particle animation loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;

    function resizeCanvas(): void {
      const c = particleCanvasRef.current;
      const svg = svgRef.current;
      if (!c || !svg) return;
      const rect = svg.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
    }

    resizeCanvas();

    // Observe SVG size changes
    const observer = new ResizeObserver(resizeCanvas);
    const svg = svgRef.current;
    if (svg) observer.observe(svg);

    function animate(now: number): void {
      particleRafRef.current = requestAnimationFrame(animate);

      const canvas = particleCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;

      // Scale from SVG viewBox coords to canvas CSS pixels
      const scaleX = cssW / SVG_WIDTH;
      const scaleY = cssH / SVG_HEIGHT;

      const dt = Math.min(now - (lastFrameTimeRef.current || now - 16), 50);
      lastFrameTimeRef.current = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      if (!showParticles) return;

      const state = particleStateRef.current;
      const nodeMap = new Map<string, GraphNode>();
      // Use mutable refs to get latest nodes/edges without stale closures
      for (const n of nodesRef.current) nodeMap.set(n.id, n);

      // ---- Draw ripples ----
      const survivingRipples: Ripple[] = [];
      for (const ripple of state.ripples) {
        ripple.radius += dt * 0.055;
        ripple.opacity -= dt * 0.0008;

        if (ripple.opacity > 0 && ripple.radius < ripple.maxRadius) {
          survivingRipples.push(ripple);
          const rx = ripple.x * scaleX;
          const ry = ripple.y * scaleY;
          const rr = ripple.radius * Math.min(scaleX, scaleY);
          ctx.beginPath();
          ctx.arc(rx, ry, rr, 0, Math.PI * 2);
          ctx.strokeStyle = ripple.color.replace(/[\d.]+\)$/, `${Math.max(0, ripple.opacity)})`);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      state.ripples = survivingRipples;

      // ---- Draw particles ----
      for (const particle of state.particles) {
        const edge = edgesRef.current[particle.edgeIndex];
        if (!edge) continue;
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) continue;

        // Advance position
        particle.t += particle.speed * dt * particle.direction;

        // Reverse direction at ends (for undirected oscillation) or wrap for directed
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

        const { cx, cy } = getEdgeControlPoint(from, to);

        // Update trail
        particle.trail.push(particle.t);
        if (particle.trail.length > TRAIL_LENGTH) {
          particle.trail.shift();
        }

        // Draw trail
        for (let i = 0; i < particle.trail.length - 1; i++) {
          const trailT = particle.trail[i]!;
          const trailPt = bezierPoint(from.x, from.y, cx, cy, to.x, to.y, trailT);
          const trailOpacity = particle.opacity * (i / TRAIL_LENGTH) * 0.4;
          const trailRadius = particle.radius * (0.4 + 0.6 * (i / TRAIL_LENGTH)) * Math.min(scaleX, scaleY);
          ctx.beginPath();
          ctx.arc(
            trailPt.x * scaleX,
            trailPt.y * scaleY,
            Math.max(0.5, trailRadius),
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${Math.max(0, trailOpacity)})`);
          ctx.fill();
        }

        // Draw particle head with glow
        const pt = bezierPoint(from.x, from.y, cx, cy, to.x, to.y, particle.t);
        const px = pt.x * scaleX;
        const py = pt.y * scaleY;
        const pr = particle.radius * Math.min(scaleX, scaleY);

        // Glow
        ctx.save();
        ctx.shadowBlur = pr * 3.5;
        ctx.shadowColor = particle.color;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.8, pr), 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${particle.opacity})`);
        ctx.fill();
        ctx.restore();
      }
    }

    particleRafRef.current = requestAnimationFrame(animate);

    return () => {
      if (particleRafRef.current !== undefined) {
        cancelAnimationFrame(particleRafRef.current);
      }
      observer.disconnect();
    };
    // nodes/edges are read via nodesRef/edgesRef which are updated on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParticles]);

  // -------------------------------------------------------------------------
  // SVG coordinate conversion
  // -------------------------------------------------------------------------
  const getSvgCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
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

  // -------------------------------------------------------------------------
  // Adjacency lists
  // -------------------------------------------------------------------------
  const buildAdjacencyList = useCallback((): Map<string, Array<{ node: string; weight: number }>> => {
    const adj = new Map<string, Array<{ node: string; weight: number }>>();
    for (const node of nodes) adj.set(node.id, []);
    for (const edge of edges) {
      adj.get(edge.from)?.push({ node: edge.to, weight: edge.weight });
      if (!edge.directed) {
        adj.get(edge.to)?.push({ node: edge.from, weight: edge.weight });
      }
    }
    return adj;
  }, [nodes, edges]);

  const buildDirectedAdjacency = useCallback((): Map<string, string[]> => {
    const adj = new Map<string, string[]>();
    for (const node of nodes) adj.set(node.id, []);
    for (const edge of edges) {
      adj.get(edge.from)?.push(edge.to);
      if (!edge.directed) {
        adj.get(edge.to)?.push(edge.from);
      }
    }
    return adj;
  }, [nodes, edges]);

  // -------------------------------------------------------------------------
  // Click on canvas to add node
  // -------------------------------------------------------------------------
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!addingNode) return;
      if ((e.target as SVGElement).closest('[data-node]') || (e.target as SVGElement).closest('[data-edge]')) return;

      const coords = getSvgCoords(e.clientX, e.clientY);
      const x = clamp(snapToGrid(coords.x), NODE_RADIUS + 5, SVG_WIDTH - NODE_RADIUS - 5);
      const y = clamp(snapToGrid(coords.y), NODE_RADIUS + 5, SVG_HEIGHT - NODE_RADIUS - 5);

      const tooClose = nodes.some((n) => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS * 2.5;
      });
      if (tooClose) return;

      const newId = String.fromCharCode(65 + nodes.length % 26);
      setNodes((prev) => [...prev, { id: newId, x, y }]);
      setAddingNode(false);
    },
    [addingNode, getSvgCoords, nodes],
  );

  // -------------------------------------------------------------------------
  // Node drag
  // -------------------------------------------------------------------------
  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, nodeId: string) => {
      if (e.button === 2) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      const coords = getSvgCoords(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      if (e.shiftKey) {
        setEdgeDragFrom(nodeId);
        setEdgeDragPos({ x: coords.x, y: coords.y });
        return;
      }

      setDraggingNodeId(nodeId);
      setDragOffset({ x: coords.x - node.x, y: coords.y - node.y });
    },
    [getSvgCoords, nodes],
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const coords = getSvgCoords(e.clientX, e.clientY);

      if (edgeDragFrom) {
        setEdgeDragPos({ x: coords.x, y: coords.y });
        return;
      }

      if (draggingNodeId) {
        const x = clamp(snapToGrid(coords.x - dragOffset.x), NODE_RADIUS + 5, SVG_WIDTH - NODE_RADIUS - 5);
        const y = clamp(snapToGrid(coords.y - dragOffset.y), NODE_RADIUS + 5, SVG_HEIGHT - NODE_RADIUS - 5);
        setNodes((prev) => prev.map((n) => (n.id === draggingNodeId ? { ...n, x, y } : n)));
      }
    },
    [draggingNodeId, dragOffset, edgeDragFrom, getSvgCoords],
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (edgeDragFrom) {
        const coords = getSvgCoords(e.clientX, e.clientY);
        const targetNode = nodes.find((n) => {
          const dx = n.x - coords.x;
          const dy = n.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS + 4 && n.id !== edgeDragFrom;
        });

        if (targetNode) {
          const exists = edges.some(
            (ed) =>
              (ed.from === edgeDragFrom && ed.to === targetNode.id) ||
              (ed.from === targetNode.id && ed.to === edgeDragFrom),
          );
          if (!exists) {
            setEdges((prev) => [
              ...prev,
              {
                from: edgeDragFrom,
                to: targetNode.id,
                weight: newEdgeWeight,
                directed: currentAlgoMeta.directed,
              },
            ]);
          }
        }

        setEdgeDragFrom(null);
        setEdgeDragPos(null);
      }

      setDraggingNodeId(null);
    },
    [edgeDragFrom, edges, getSvgCoords, newEdgeWeight, nodes, currentAlgoMeta.directed],
  );

  // -------------------------------------------------------------------------
  // Context menu
  // -------------------------------------------------------------------------
  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent<SVGGElement>, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        kind: 'node',
        id: nodeId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [],
  );

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent<SVGPathElement>, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        kind: 'edge',
        index,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setResult(null);
  }, []);

  const deleteEdge = useCallback((index: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }, []);

  const updateEdgeWeight = useCallback((index: number, weight: number) => {
    setEdges((prev) => prev.map((e, i) => (i === index ? { ...e, weight } : e)));
  }, []);

  // -------------------------------------------------------------------------
  // Add edge via form
  // -------------------------------------------------------------------------
  const addEdgeFromForm = useCallback(() => {
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo || newEdgeWeight <= 0) return;
    const exists = edges.some(
      (e) =>
        (e.from === edgeFrom && e.to === edgeTo) ||
        (e.from === edgeTo && e.to === edgeFrom),
    );
    if (!exists) {
      setEdges((prev) => [
        ...prev,
        { from: edgeFrom, to: edgeTo, weight: newEdgeWeight, directed: currentAlgoMeta.directed },
      ]);
    }
    setEdgeFrom('');
    setEdgeTo('');
  }, [edgeFrom, edgeTo, newEdgeWeight, edges, currentAlgoMeta.directed]);

  // -------------------------------------------------------------------------
  // Run algorithm
  // -------------------------------------------------------------------------
  const runAlgorithm = useCallback(() => {
    setErrorMsg(null);
    try {
      const adj = buildAdjacencyList();
      const nodeIds = nodes.map((n) => n.id);

      switch (algorithm) {
        case 'bfs': {
          const order = bfs(adj, startNode);
          setResult({ type: 'traversal', order });
          break;
        }

        case 'dfs': {
          const order = dfs(adj, startNode);
          setResult({ type: 'traversal', order });
          break;
        }

        case 'dijkstra': {
          const r = dijkstra(adj, startNode, endNode);
          setResult({ type: 'shortest-path', path: r.path, distance: r.distance });
          break;
        }

        case 'astar': {
          const r = astar(adj, nodes, startNode, endNode);
          setResult({ type: 'shortest-path', path: r.path, distance: r.distance });
          break;
        }

        case 'bellman-ford': {
          const r = bellmanFord(adj, nodeIds, edges, startNode, endNode);
          if (r.hasNegativeCycle) {
            setErrorMsg('Negative-weight cycle detected. Result may be unreliable.');
          }
          setResult({ type: 'shortest-path', path: r.path, distance: r.distance });
          break;
        }

        case 'floyd': {
          const matrix = floydWarshall(adj, nodeIds);
          setResult({ type: 'all-pairs', matrix });
          break;
        }

        case 'kruskal': {
          const nodeToIndex = new Map(nodeIds.map((id, idx) => [id, idx]));
          const graphEdges: [number, number, number][] = edges.map((e) => [
            nodeToIndex.get(e.from) ?? 0,
            nodeToIndex.get(e.to) ?? 0,
            e.weight,
          ]);
          const mstResult = kruskal({ vertices: nodes.length, edges: graphEdges });
          const mstEdges: GraphEdge[] = mstResult.edges
            .map(([u, v, weight]) => ({
              from: nodeIds[u] ?? '',
              to: nodeIds[v] ?? '',
              weight,
            }))
            .filter((e) => e.from && e.to);
          setResult({ type: 'mst', edges: mstEdges });
          break;
        }

        case 'prim': {
          const nodeToIndex = new Map(nodeIds.map((id, idx) => [id, idx]));
          const graphEdges: [number, number, number][] = edges.map((e) => [
            nodeToIndex.get(e.from) ?? 0,
            nodeToIndex.get(e.to) ?? 0,
            e.weight,
          ]);
          const startIdx = nodeToIndex.get(startNode) ?? 0;
          const mstResult = prim({ vertices: nodes.length, edges: graphEdges }, startIdx);
          const mstEdges: GraphEdge[] = mstResult.edges
            .map(([u, v, weight]) => ({
              from: nodeIds[u] ?? '',
              to: nodeIds[v] ?? '',
              weight,
            }))
            .filter((e) => e.from && e.to);
          setResult({ type: 'mst', edges: mstEdges });
          break;
        }

        case 'topo-sort': {
          const dirAdj = buildDirectedAdjacency();
          const { order, hasCycle } = topologicalSort(dirAdj, nodeIds);
          if (hasCycle) {
            setErrorMsg('Graph contains a cycle — topological sort requires a DAG.');
          }
          setResult({ type: 'topological', order });
          break;
        }

        case 'tarjan-scc': {
          const dirAdj = buildDirectedAdjacency();
          const components = tarjanSCC(dirAdj, nodeIds);
          setResult({ type: 'scc', components });
          break;
        }
      }
    } catch (err) {
      console.error('Graph algorithm error:', err);
      setErrorMsg('An error occurred while running the algorithm.');
    }
  }, [algorithm, buildAdjacencyList, buildDirectedAdjacency, edges, endNode, nodes, startNode]);

  // -------------------------------------------------------------------------
  // Load preset
  // -------------------------------------------------------------------------
  const loadPreset = useCallback((presetId: PresetId) => {
    const preset = PRESETS[presetId];
    setNodes(preset.nodes);
    setEdges(preset.edges);
    setResult(null);
    setErrorMsg(null);
    // Auto-select first and last node for start/end
    if (preset.nodes.length >= 1) setStartNode(preset.nodes[0]!.id);
    if (preset.nodes.length >= 2) setEndNode(preset.nodes[preset.nodes.length - 1]!.id);
  }, []);

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  const glassPanel =
    'bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]';

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.header
          className="mb-8"
          initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <Network className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight min-w-0 break-words">Graph Algorithms</h1>
          </div>
          <p className="text-lg text-muted-foreground ml-1">
            Visualize traversal, shortest paths, spanning trees, and structural analysis
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            {ALGORITHMS.map((a) => (
              <Badge key={a.id} variant={algorithm === a.id ? 'default' : 'outline'} className="text-xs">
                {a.id === algorithm ? a.label.split(' — ')[0] : a.id === 'topo-sort' ? 'Topo Sort' : a.id === 'tarjan-scc' ? "Tarjan SCC" : a.label.split(' — ')[0]}
              </Badge>
            ))}
          </div>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* ---- CONTROL PANEL ---- */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className={glassPanel}>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Configuration</CardTitle>
                <CardDescription>Select algorithm and manage graph structure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Algorithm */}
                <div className="space-y-1.5">
                  <Label>Algorithm</Label>
                  <Select
                    value={algorithm}
                    onValueChange={(v) => {
                      setAlgorithm(v as AlgorithmId);
                      setResult(null);
                      setErrorMsg(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALGORITHMS.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Algorithm info */}
                  <div className="rounded-md bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-mono text-primary/80 mr-2">{currentAlgoMeta.complexity}</span>
                    {currentAlgoMeta.description}
                  </div>
                </div>

                {/* Node selectors */}
                {(currentAlgoMeta.needsStart || currentAlgoMeta.needsEnd) && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentAlgoMeta.needsStart && (
                      <div className="space-y-1.5">
                        <Label>Start Node</Label>
                        <Select value={startNode} onValueChange={setStartNode}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.map((n) => (
                              <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {currentAlgoMeta.needsEnd && (
                      <div className="space-y-1.5">
                        <Label>End Node</Label>
                        <Select value={endNode} onValueChange={setEndNode}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.map((n) => (
                              <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Presets */}
                <div className="space-y-1.5">
                  <Label>Preset Graphs</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(PRESETS) as PresetId[]).map((p) => (
                      <Button
                        key={p}
                        variant="outline"
                        size="sm"
                        onClick={() => loadPreset(p)}
                        className="text-xs h-8 justify-start truncate"
                        title={PRESETS[p].description}
                      >
                        {PRESETS[p].label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Run button */}
                <Button onClick={runAlgorithm} className="w-full" size="lg">
                  <Route className="w-4 h-4 mr-2" />
                  Run Algorithm
                </Button>

                {/* Error message */}
                {errorMsg && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                    {errorMsg}
                  </div>
                )}

                {/* Add Edge form */}
                <div className="space-y-1.5">
                  <Label>Add Edge</Label>
                  <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={edgeFrom} onValueChange={setEdgeFrom}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((n) => (
                            <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={edgeTo} onValueChange={setEdgeTo}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((n) => (
                            <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={newEdgeWeight}
                        onChange={(e) => setNewEdgeWeight(Number(e.target.value) || 1)}
                        className="h-8 text-xs"
                        min="1"
                        placeholder="Weight"
                        aria-label="Edge weight"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={addEdgeFromForm} className="w-full h-8">
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Add Edge
                    </Button>
                  </div>
                </div>

                {/* Edge list */}
                <div className="space-y-1.5">
                  <Label>Edges ({edges.length})</Label>
                  <div
                    className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background/40 p-2 space-y-1.5"
                    role="list"
                    aria-label="Edge list"
                  >
                    <AnimatePresence initial={false}>
                      {edges.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          No edges yet. Drag between nodes on the canvas.
                        </p>
                      )}
                      {edges.map((edge, index) => (
                        <motion.div
                          key={`${edge.from}-${edge.to}-${index}`}
                          role="listitem"
                          initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          {...(!prefersReducedMotion ? { exit: { opacity: 0, height: 0 } } : {})}
                          transition={{ duration: 0.18 }}
                          className="flex items-center gap-2 text-sm overflow-hidden"
                        >
                          <span className="font-mono text-xs min-w-16 text-foreground/80">
                            {edge.from} {edge.directed ? '→' : '—'} {edge.to}
                          </span>
                          <Input
                            type="number"
                            value={edge.weight}
                            onChange={(e) => updateEdgeWeight(index, Number(e.target.value) || 1)}
                            className="h-6 w-14 text-xs px-1.5"
                            min="1"
                            aria-label={`Weight for edge ${edge.from} to ${edge.to}`}
                          />
                          <button
                            type="button"
                            onClick={() => deleteEdge(index)}
                            aria-label={`Delete edge ${edge.from} to ${edge.to}`}
                            className="ml-auto flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ---- GRAPH CANVAS ---- */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className={glassPanel}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Graph Visualization</CardTitle>
                    <CardDescription className="mt-0.5">
                      {nodes.length} nodes · {edges.length} edges
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant={showParticles ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowParticles((v) => !v)}
                      aria-pressed={showParticles}
                      title={showParticles ? 'Disable edge flow particles' : 'Enable edge flow particles'}
                      aria-label={showParticles ? 'Disable edge flow particles' : 'Enable edge flow particles'}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Particles
                    </Button>
                    <Button
                      variant={addingNode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAddingNode((v) => !v)}
                      aria-pressed={addingNode}
                    >
                      {addingNode ? (
                        <>
                          <MousePointer2 className="w-3.5 h-3.5 mr-1.5" />
                          Click canvas
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Add Node
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary/60" />
                    Drag node to move
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/60" />
                    Shift+drag to connect
                  </span>
                  <span className="flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Right-click to delete
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div
                  ref={containerRef}
                  className="relative rounded-lg overflow-hidden border border-border"
                  style={{ background: 'var(--color-card)' }}
                >
                  <svg
                    ref={svgRef}
                    width={SVG_WIDTH}
                    height={SVG_HEIGHT}
                    viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                    className="w-full block"
                    style={{ cursor: addingNode ? 'crosshair' : edgeDragFrom ? 'cell' : 'default' }}
                    onClick={handleSvgClick}
                    onPointerMove={handleSvgPointerMove}
                    onPointerUp={handleSvgPointerUp}
                    aria-label="Interactive graph canvas"
                    role="img"
                  >
                    <defs>
                      <pattern id={`${gradientId}-grid`} x="0" y="0" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                        <circle cx="0.5" cy="0.5" r="0.5" fill="var(--color-border)" opacity="0.5" />
                      </pattern>

                      <radialGradient id={`${gradientId}-unvisited`} cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="var(--color-secondary)" />
                        <stop offset="100%" stopColor="var(--color-muted)" />
                      </radialGradient>
                      <radialGradient id={`${gradientId}-visiting`} cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="color-mix(in oklch, var(--color-primary) 40%, transparent)" />
                        <stop offset="100%" stopColor="color-mix(in oklch, var(--color-primary) 15%, transparent)" />
                      </radialGradient>
                      <radialGradient id={`${gradientId}-visited`} cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="oklch(0.65 0.18 155 / 0.5)" />
                        <stop offset="100%" stopColor="oklch(0.65 0.18 155 / 0.2)" />
                      </radialGradient>

                      <linearGradient id={pathGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="oklch(0.65 0.18 155)" stopOpacity="0.9" />
                      </linearGradient>

                      <filter id={filterBlurId} x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--color-primary)" floodOpacity="0.25" />
                      </filter>

                      <marker
                        id={`${gradientId}-arrow`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-border)" opacity="0.8" />
                      </marker>
                      <marker
                        id={`${gradientId}-arrow-highlight`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="oklch(0.65 0.18 155)" />
                      </marker>
                      <marker
                        id={`${gradientId}-arrow-drag`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" opacity="0.7" />
                      </marker>
                    </defs>

                    {/* Grid background */}
                    <rect
                      width={SVG_WIDTH}
                      height={SVG_HEIGHT}
                      fill={`url(#${gradientId}-grid)`}
                      opacity="0.6"
                    />

                    {/* ---- EDGES ---- */}
                    {edges.map((edge, index) => {
                      const fromNode = nodes.find((n) => n.id === edge.from);
                      const toNode = nodes.find((n) => n.id === edge.to);
                      if (!fromNode || !toNode) return null;

                      const highlighted = isEdgeHighlighted(edge, result);
                      const hovered = hoveredEdge === index;
                      const { path: dPath, midX, midY } = getEdgePath(fromNode, toNode);
                      const isDirected = edge.directed ?? currentAlgoMeta.directed;

                      return (
                        <g key={`${edge.from}-${edge.to}-${index}`} data-edge>
                          <path
                            d={dPath}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="16"
                            style={{ cursor: 'context-menu' }}
                            onContextMenu={(e) => handleEdgeContextMenu(e, index)}
                            onMouseEnter={() => setHoveredEdge(index)}
                            onMouseLeave={() => setHoveredEdge(null)}
                          />
                          <path
                            d={dPath}
                            fill="none"
                            stroke={highlighted ? `url(#${pathGradientId})` : hovered ? 'var(--color-primary)' : 'var(--color-border)'}
                            strokeWidth={highlighted ? 3 : hovered ? 2.5 : 1.8}
                            strokeLinecap="round"
                            markerEnd={isDirected
                              ? (highlighted ? `url(#${gradientId}-arrow-highlight)` : `url(#${gradientId}-arrow)`)
                              : undefined
                            }
                            style={{
                              transition: prefersReducedMotion ? 'none' : 'stroke 0.25s ease, stroke-width 0.2s ease',
                              filter: highlighted ? `drop-shadow(0 0 4px oklch(0.65 0.18 155 / 0.5))` : 'none',
                            }}
                          />
                          <rect
                            x={midX - 10}
                            y={midY - 9}
                            width="20"
                            height="16"
                            rx="4"
                            fill="var(--color-card)"
                            fillOpacity="0.85"
                            stroke={highlighted ? 'oklch(0.65 0.18 155 / 0.5)' : 'var(--color-border)'}
                            strokeWidth="1"
                          />
                          <text
                            x={midX}
                            y={midY + 1}
                            fill={highlighted ? 'oklch(0.65 0.18 155)' : 'var(--color-muted-foreground)'}
                            fontSize="10"
                            fontWeight={highlighted ? '700' : '500'}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="select-none"
                            style={{ fontFamily: 'var(--font-mono, monospace)' }}
                          >
                            {edge.weight}
                          </text>
                        </g>
                      );
                    })}

                    {/* ---- EDGE DRAG PREVIEW ---- */}
                    {edgeDragFrom && edgeDragPos && (() => {
                      const fromNode = nodes.find((n) => n.id === edgeDragFrom);
                      if (!fromNode) return null;
                      return (
                        <line
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={edgeDragPos.x}
                          y2={edgeDragPos.y}
                          stroke="var(--color-primary)"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                          markerEnd={`url(#${gradientId}-arrow-drag)`}
                          opacity="0.7"
                        />
                      );
                    })()}

                    {/* ---- NODES ---- */}
                    {nodes.map((node, _nodeIdx) => {
                      const state = getNodeState(node.id, result);
                      const isHovered = hoveredNode === node.id;
                      const isDragged = draggingNodeId === node.id;
                      const isEdgeDragTarget =
                        edgeDragFrom !== null &&
                        edgeDragFrom !== node.id &&
                        edgeDragPos !== null &&
                        (() => {
                          const dx = node.x - edgeDragPos.x;
                          const dy = node.y - edgeDragPos.y;
                          return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS + 8;
                        })();

                      // SCC coloring
                      const sccColor = getSCCColor(node.id, result);

                      // Traversal order badge
                      const traversalIndex =
                        result?.type === 'traversal' || result?.type === 'topological'
                          ? result.order?.indexOf(node.id)
                          : undefined;

                      const fillGradient = sccColor
                        ? 'none'
                        : state === 'visited'
                          ? `url(#${gradientId}-visited)`
                          : state === 'visiting'
                            ? `url(#${gradientId}-visiting)`
                            : `url(#${gradientId}-unvisited)`;

                      const strokeColor = sccColor
                        ?? (state === 'visited'
                          ? 'oklch(0.65 0.18 155)'
                          : state === 'visiting'
                            ? 'var(--color-primary)'
                            : isEdgeDragTarget
                              ? 'oklch(0.65 0.18 155)'
                              : isHovered || isDragged
                                ? 'var(--color-primary)'
                                : 'var(--color-border)');

                      return (
                        <g
                          key={node.id}
                          data-node
                          style={{
                            cursor: addingNode ? 'not-allowed' : edgeDragFrom ? 'crosshair' : isDragged ? 'grabbing' : 'grab',
                            transform: `translate(${node.x}px, ${node.y}px)`,
                            transition: isDragged || draggingNodeId ? 'none' : prefersReducedMotion ? 'none' : 'transform 0.08s ease-out',
                          }}
                          onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                          onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          role="button"
                          aria-label={`Graph node ${node.id}`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Delete' || e.key === 'Backspace') deleteNode(node.id);
                          }}
                        >
                          {isEdgeDragTarget && (
                            <circle
                              cx="0"
                              cy="0"
                              r={NODE_RADIUS + 8}
                              fill="none"
                              stroke="oklch(0.65 0.18 155)"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                              opacity="0.7"
                            />
                          )}
                          {isHovered && edgeDragFrom === null && !addingNode && (
                            <circle
                              cx="0"
                              cy="0"
                              r={NODE_RADIUS + 6}
                              fill="none"
                              stroke="var(--color-primary)"
                              strokeWidth="1.5"
                              opacity="0.35"
                            />
                          )}
                          {state === 'visited' && !sccColor && (
                            <circle
                              cx="0"
                              cy="0"
                              r={NODE_RADIUS + 4}
                              fill="oklch(0.65 0.18 155 / 0.12)"
                              stroke="none"
                            />
                          )}
                          {sccColor && (
                            <circle
                              cx="0"
                              cy="0"
                              r={NODE_RADIUS + 5}
                              fill={`${sccColor.replace(')', ' / 0.15)')}`}
                              stroke="none"
                            />
                          )}
                          <circle
                            cx="0"
                            cy="0"
                            r={NODE_RADIUS}
                            fill={sccColor ? `${sccColor.replace(')', ' / 0.35)')}` : fillGradient}
                            stroke={strokeColor}
                            strokeWidth={state !== 'unvisited' || isHovered || isDragged || isEdgeDragTarget || sccColor ? 2.5 : 1.5}
                            style={{
                              filter: sccColor
                                ? `drop-shadow(0 0 6px ${sccColor.replace(')', ' / 0.5)')})`
                                : state === 'visited'
                                  ? `drop-shadow(0 0 6px oklch(0.65 0.18 155 / 0.5))`
                                  : isDragged
                                    ? `url(#${filterBlurId})`
                                    : 'none',
                              transition: prefersReducedMotion ? 'none' : 'stroke 0.2s ease, filter 0.3s ease',
                            }}
                          />
                          <text
                            x="0"
                            y="0"
                            fill={
                              sccColor
                                ? sccColor
                                : state === 'visited'
                                  ? 'oklch(0.65 0.18 155)'
                                  : state === 'visiting'
                                    ? 'var(--color-primary)'
                                    : 'var(--color-foreground)'
                            }
                            fontSize="15"
                            fontWeight="700"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="select-none"
                            style={{ fontFamily: 'var(--font-sans, system-ui)' }}
                          >
                            {node.id}
                          </text>

                          {/* Traversal order badge */}
                          {traversalIndex !== undefined && traversalIndex >= 0 && (
                            <g>
                              <circle
                                cx={NODE_RADIUS - 4}
                                cy={-(NODE_RADIUS - 4)}
                                r="9"
                                fill="oklch(0.65 0.18 155)"
                                stroke="var(--color-card)"
                                strokeWidth="1.5"
                              />
                              <text
                                x={NODE_RADIUS - 4}
                                y={-(NODE_RADIUS - 4) + 1}
                                fontSize="8"
                                fontWeight="700"
                                fill="oklch(0.98 0.01 155)"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="select-none"
                              >
                                {traversalIndex + 1}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {addingNode && (
                      <text
                        x={SVG_WIDTH / 2}
                        y={SVG_HEIGHT - 14}
                        textAnchor="middle"
                        fill="var(--color-muted-foreground)"
                        fontSize="11"
                        className="select-none"
                      >
                        Click anywhere on canvas to place a node
                      </text>
                    )}
                  </svg>

                  {/* Particle overlay canvas — pointer-events:none so SVG interactions still work */}
                  <canvas
                    ref={particleCanvasRef}
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ mixBlendMode: 'screen' }}
                  />

                  <AnimatePresence>
                    {contextMenu && (
                      <ContextMenu
                        target={contextMenu}
                        onDeleteNode={deleteNode}
                        onDeleteEdge={deleteEdge}
                        onClose={() => setContextMenu(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ---- RESULTS ---- */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              {...(!prefersReducedMotion ? { exit: { opacity: 0, y: 8 } } : {})}
              transition={{ duration: 0.35 }}
              className="mt-6"
            >
              <Card className={glassPanel}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-emerald-500 dark:text-emerald-400">
                    Algorithm Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.type === 'shortest-path' && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/25">
                      <p className="text-sm font-semibold text-emerald-500 mb-3">Shortest Path</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground w-24">Path:</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {result.path && result.path.length > 0 ? result.path.map((nodeId, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 font-mono font-bold text-sm">
                                  {nodeId}
                                </span>
                                {i < (result.path?.length ?? 0) - 1 && (
                                  <span className="text-emerald-500/50 text-xs">→</span>
                                )}
                              </span>
                            )) : (
                              <span className="text-destructive text-xs">No path found</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-24">Total distance:</span>
                          <span className="font-mono font-bold text-emerald-500">
                            {result.distance === Infinity ? '∞ (unreachable)' : result.distance?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.type === 'traversal' && result.order && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/25">
                      <p className="text-sm font-semibold text-emerald-500 mb-3">
                        {algorithm === 'bfs' ? 'BFS' : 'DFS'} Traversal Order
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {result.order.map((nodeId, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 font-mono font-bold text-sm">
                              {nodeId}
                            </span>
                            {i < result.order!.length - 1 && (
                              <span className="text-emerald-500/50 text-xs">→</span>
                            )}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Visited {result.order.length} of {nodes.length} nodes
                      </p>
                    </div>
                  )}

                  {result.type === 'topological' && result.order && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/25">
                      <p className="text-sm font-semibold text-purple-500 mb-3">Topological Order</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {result.order.map((nodeId, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-500 font-mono font-bold text-sm">
                              {nodeId}
                            </span>
                            {i < result.order!.length - 1 && (
                              <span className="text-purple-500/50 text-xs">→</span>
                            )}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Load the DAG preset for a clean example
                      </p>
                    </div>
                  )}

                  {result.type === 'scc' && result.components && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/25">
                      <p className="text-sm font-semibold text-primary mb-3">
                        Strongly Connected Components ({result.components.length})
                      </p>
                      <div className="space-y-2">
                        {result.components.map((component, i) => {
                          const colors = [
                            'text-emerald-500 bg-emerald-500/20 border-emerald-500/40',
                            'text-orange-500 bg-orange-500/20 border-orange-500/40',
                            'text-purple-500 bg-purple-500/20 border-purple-500/40',
                            'text-yellow-500 bg-yellow-500/20 border-yellow-500/40',
                            'text-cyan-500 bg-cyan-500/20 border-cyan-500/40',
                            'text-rose-500 bg-rose-500/20 border-rose-500/40',
                          ];
                          const colorClass = colors[i % colors.length] ?? colors[0]!;
                          return (
                            <div key={i} className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground w-16">SCC {i + 1}:</span>
                              {component.map((nodeId) => (
                                <span
                                  key={nodeId}
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full border font-mono font-bold text-sm ${colorClass}`}
                                >
                                  {nodeId}
                                </span>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {result.type === 'mst' && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/25">
                      <p className="text-sm font-semibold text-primary mb-3">Minimum Spanning Tree</p>
                      <div className="space-y-1.5">
                        {result.edges?.map((edge, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm font-mono">
                            <span className="text-foreground/70">{edge.from} — {edge.to}</span>
                            <span className="ml-auto text-primary font-semibold">{edge.weight}</span>
                          </div>
                        ))}
                        <div className="mt-3 pt-2.5 border-t border-primary/20 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Total weight:</span>
                          <span className="font-bold text-primary font-mono">
                            {result.edges?.reduce((sum, e) => sum + e.weight, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.type === 'all-pairs' && result.matrix && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <caption className="text-xs text-muted-foreground mb-2 text-left">
                          All-pairs shortest paths (∞ = unreachable)
                        </caption>
                        <thead>
                          <tr>
                            <th className="border border-border p-2 bg-muted/30 text-xs font-medium text-muted-foreground" />
                            {nodes.map((node) => (
                              <th key={node.id} className="border border-border p-2 bg-muted/30 text-xs font-medium text-primary">
                                {node.id}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {nodes.map((fromNode, i) => (
                            <tr key={fromNode.id} className="hover:bg-muted/20 transition-colors">
                              <th className="border border-border p-2 bg-muted/30 text-xs font-medium text-primary text-left">
                                {fromNode.id}
                              </th>
                              {nodes.map((toNode, j) => {
                                const value = result.matrix?.[i]?.[j];
                                const isZero = value === 0;
                                const isInf = value === Infinity || value === undefined;
                                return (
                                  <td
                                    key={toNode.id}
                                    className={[
                                      'border border-border p-2 text-center font-mono text-xs',
                                      isZero ? 'text-muted-foreground' : isInf ? 'text-destructive/50' : 'text-foreground',
                                    ].join(' ')}
                                  >
                                    {isInf ? '∞' : value}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- DETAILED PROOF ---- */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="proof"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              {...(!prefersReducedMotion ? { exit: { opacity: 0, y: 8 } } : {})}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="mt-6"
            >
              <Card className="bg-card/30 backdrop-blur-xl border-border/50 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Detailed Proof
                  </CardTitle>
                  <CardDescription>
                    Why the algorithm produced this result
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const proof = getProofContent(result, algorithm, nodes, edges);
                    return (
                      <div className="space-y-4">
                        <p className="text-sm font-semibold text-primary">{proof.title}</p>
                        <div className="space-y-1.5 rounded-lg bg-muted/20 border border-border/40 p-4">
                          {proof.steps.map((step, i) => (
                            <p key={i} className="text-sm text-muted-foreground font-mono leading-relaxed">
                              <span className="text-primary/60 mr-2 select-none">{i + 1}.</span>
                              {step}
                            </p>
                          ))}
                        </div>
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-primary/80">Why this is correct: </span>
                            {proof.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- EDUCATIONAL CONTENT ---- */}
        <motion.section
          className="mt-12 space-y-6"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-2xl font-semibold tracking-tight">About Graph Algorithms</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Graph Traversal (BFS / DFS)',
                desc: 'BFS explores nodes level by level using a queue, finding shortest paths in unweighted graphs. DFS dives deep using a stack, ideal for connectivity checks, cycle detection, and topological ordering.',
                accent: 'blue',
              },
              {
                title: "Shortest Paths",
                desc: "Dijkstra's and A* find shortest paths greedily. A* uses a heuristic to focus search. Bellman-Ford handles negative weights. Floyd-Warshall computes all-pairs paths in O(V³).",
                accent: 'emerald',
              },
              {
                title: 'Minimum Spanning Trees',
                desc: "Kruskal's sorts edges by weight and adds cycle-free edges. Prim's grows the tree from a start vertex. Both yield the same MST but differ in efficiency characteristics.",
                accent: 'purple',
              },
              {
                title: 'Topological Sort',
                desc: 'Orders vertices of a DAG so directed edges go from earlier to later positions. Based on Kahn\'s algorithm (BFS on in-degrees). Used for build systems, task scheduling, and dependency resolution.',
                accent: 'rose',
              },
              {
                title: "Tarjan's SCC",
                desc: 'Finds all strongly connected components — maximal subgraphs where every vertex is reachable from every other. Uses a single DFS pass with a stack. Critical for web crawling and compiler analysis.',
                accent: 'amber',
              },
              {
                title: 'Applications',
                desc: 'Graph algorithms power GPS navigation, social networks, web search (PageRank), compiler optimization, network routing, circuit design, and package dependency resolution.',
                accent: 'cyan',
              },
            ].map(({ title, desc, accent }) => (
              <motion.div
                key={title}
                {...(!prefersReducedMotion ? { whileHover: { y: -2 } } : {})}
                transition={{ duration: 0.2 }}
                className={`group relative p-5 rounded-xl border transition-all duration-300
                  ${accent === 'blue' ? 'bg-gradient-to-br from-blue-500/8 to-blue-500/3 border-blue-500/20 hover:border-blue-500/40' : ''}
                  ${accent === 'emerald' ? 'bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 border-emerald-500/20 hover:border-emerald-500/40' : ''}
                  ${accent === 'purple' ? 'bg-gradient-to-br from-purple-500/8 to-purple-500/3 border-purple-500/20 hover:border-purple-500/40' : ''}
                  ${accent === 'rose' ? 'bg-gradient-to-br from-rose-500/8 to-rose-500/3 border-rose-500/20 hover:border-rose-500/40' : ''}
                  ${accent === 'amber' ? 'bg-gradient-to-br from-amber-500/8 to-amber-500/3 border-amber-500/20 hover:border-amber-500/40' : ''}
                  ${accent === 'cyan' ? 'bg-gradient-to-br from-cyan-500/8 to-cyan-500/3 border-cyan-500/20 hover:border-cyan-500/40' : ''}
                `}
              >
                <h3
                  className={`text-base font-semibold mb-2
                    ${accent === 'blue' ? 'text-blue-500 dark:text-blue-400' : ''}
                    ${accent === 'emerald' ? 'text-emerald-500 dark:text-emerald-400' : ''}
                    ${accent === 'purple' ? 'text-purple-500 dark:text-purple-400' : ''}
                    ${accent === 'rose' ? 'text-rose-500 dark:text-rose-400' : ''}
                    ${accent === 'amber' ? 'text-amber-500 dark:text-amber-400' : ''}
                    ${accent === 'cyan' ? 'text-cyan-500 dark:text-cyan-400' : ''}
                  `}
                >
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
