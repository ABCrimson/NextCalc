'use client';

import { m } from 'framer-motion';
import {
  ChevronRight,
  Info,
  Maximize2,
  Network,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
// Note: Using local computePageRank implementation that's tightly coupled with
// the component's Graph/NodeId types. The math-engine's pageRank function
// expects a sparse adjacency matrix format which would require type conversion.
import { type GraphInteraction, PageRankGraphRenderer } from './PageRankGraphRenderer';
import {
  ANIMATION_DURATIONS,
  type AnimationSpeed,
  createEdgeId,
  createNodeId,
  createPageRankScore,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type NodeId,
  type PageRankScore,
} from './types';

/**
 * Props for PageRankExplorer component
 */
export interface PageRankExplorerProps {
  /**
   * Initial graph configuration
   */
  initialGraph?: Partial<Graph>;

  /**
   * Whether to show educational explanations
   */
  showExplanations?: boolean;

  /**
   * Animation speed preset
   */
  animationSpeed?: AnimationSpeed;

  /**
   * Callback when PageRank computation completes
   */
  onRankComputed?: (ranks: Map<NodeId, PageRankScore>) => void;

  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Compute PageRank for a graph
 */
function computePageRank(graph: Graph, iterations: number = 20): Map<NodeId, PageRankScore> {
  const { nodes, edges, dampingFactor } = graph;
  const n = nodes.length;

  if (n === 0) {
    return new Map();
  }

  // Initialize ranks
  const ranks = new Map<NodeId, number>();
  const newRanks = new Map<NodeId, number>();

  nodes.forEach((node) => {
    ranks.set(node.id, 1 / n);
    newRanks.set(node.id, 0);
  });

  // Build adjacency list
  const outgoing = new Map<NodeId, Array<{ target: NodeId; weight: number }>>();
  const outgoingSum = new Map<NodeId, number>();

  edges.forEach((edge) => {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, []);
    }
    outgoing.get(edge.source)!.push({ target: edge.target, weight: edge.weight });

    const currentSum = outgoingSum.get(edge.source) ?? 0;
    outgoingSum.set(edge.source, currentSum + edge.weight);
  });

  // PageRank iteration
  for (let iter = 0; iter < iterations; iter++) {
    // Reset new ranks
    nodes.forEach((node) => newRanks.set(node.id, (1 - dampingFactor) / n));

    // Distribute rank
    nodes.forEach((node) => {
      const nodeRank = ranks.get(node.id) ?? 0;
      const outLinks = outgoing.get(node.id) ?? [];
      const totalWeight = outgoingSum.get(node.id) ?? 1;

      outLinks.forEach(({ target, weight }) => {
        const contribution = (nodeRank * dampingFactor * weight) / totalWeight;
        const currentRank = newRanks.get(target) ?? 0;
        newRanks.set(target, currentRank + contribution);
      });
    });

    // Swap ranks
    nodes.forEach((node) => {
      ranks.set(node.id, newRanks.get(node.id) ?? 0);
    });
  }

  // Normalize and convert to PageRankScore
  const total = Array.from(ranks.values()).reduce((sum, r) => sum + r, 0);
  const normalized = new Map<NodeId, PageRankScore>();

  ranks.forEach((rank, nodeId) => {
    const raw = total > 0 ? rank / total : 0;
    const safe = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    normalized.set(nodeId, createPageRankScore(safe));
  });

  return normalized;
}

/**
 * Generate a large random graph for stress testing
 */
function generateLargeGraph(
  numNodes: number,
  edgeProbability: number = 0.1,
): {
  nodeLabels: string[];
  edgeList: Array<[number, number, number]>;
} {
  const nodeLabels: string[] = [];
  const edgeList: Array<[number, number, number]> = [];

  // Generate node labels
  for (let i = 0; i < numNodes; i++) {
    if (i < 26) {
      nodeLabels.push(String.fromCharCode(65 + i)); // A-Z
    } else {
      nodeLabels.push(`N${i}`);
    }
  }

  // Generate random edges
  for (let i = 0; i < numNodes; i++) {
    for (let j = 0; j < numNodes; j++) {
      if (i !== j && Math.random() < edgeProbability) {
        edgeList.push([i, j, 1]);
      }
    }

    // Ensure each node has at least one outgoing edge
    if (!edgeList.some(([source]) => source === i)) {
      const target = (i + 1) % numNodes;
      edgeList.push([i, target, 1]);
    }
  }

  return { nodeLabels, edgeList };
}

/**
 * Preset graph templates
 */
const PRESET_GRAPHS: Record<
  string,
  Omit<Graph, 'nodes' | 'edges'> & {
    nodeLabels: string[];
    edgeList: Array<[number, number, number]>;
  }
> = {
  linear: {
    dampingFactor: 0.85,
    nodeLabels: ['A', 'B', 'C', 'D'],
    edgeList: [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
    ],
  },
  star: {
    dampingFactor: 0.85,
    nodeLabels: ['Hub', 'A', 'B', 'C', 'D'],
    edgeList: [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
      [1, 0, 1],
      [2, 0, 1],
      [3, 0, 1],
      [4, 0, 1],
    ],
  },
  cycle: {
    dampingFactor: 0.85,
    nodeLabels: ['A', 'B', 'C', 'D', 'E'],
    edgeList: [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
      [3, 4, 1],
      [4, 0, 1],
    ],
  },
  web: {
    dampingFactor: 0.85,
    nodeLabels: ['Home', 'About', 'Blog', 'Contact', 'Products'],
    edgeList: [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
      [1, 0, 1],
      [2, 0, 1],
      [2, 4, 1],
      [3, 0, 1],
      [4, 2, 1],
    ],
  },
  large50: {
    dampingFactor: 0.85,
    ...generateLargeGraph(50, 0.08),
  },
  large100: {
    dampingFactor: 0.85,
    ...generateLargeGraph(100, 0.04),
  },
};

/**
 * Interactive PageRank Explorer Component
 *
 * Build and visualize graphs with real-time PageRank computation
 * and interactive node/edge manipulation.
 *
 * @example
 * ```tsx
 * <PageRankExplorer
 *   showExplanations={true}
 *   animationSpeed="normal"
 *   onRankComputed={(ranks) => console.log('PageRank:', ranks)}
 * />
 * ```
 */
export function PageRankExplorer({
  initialGraph,
  showExplanations = true,
  animationSpeed = 'normal',
  onRankComputed,
  className,
}: PageRankExplorerProps) {
  // Build the 'web' preset graph synchronously for the initial state so the
  // renderer has nodes on first mount and does not require a selection to appear.
  const [graph, setGraph] = useState<Graph>(() => {
    if (initialGraph?.nodes && initialGraph.nodes.length > 0) {
      return {
        nodes: initialGraph.nodes,
        edges: initialGraph.edges ?? [],
        dampingFactor: initialGraph.dampingFactor ?? 0.85,
      };
    }

    // Default: 'web' preset laid out on a 800x600 canvas
    const defaultWidth = 800;
    const defaultHeight = 600;
    const preset = PRESET_GRAPHS['web'];

    // Guard: preset must exist (it always does, but the Record type is wide)
    if (!preset) {
      return { nodes: [], edges: [], dampingFactor: 0.85 };
    }

    const numNodes = preset.nodeLabels.length;
    const centerX = defaultWidth / 2;
    const centerY = defaultHeight / 2;
    const radius = Math.min(defaultWidth, defaultHeight) / 3;

    const defaultNodes: GraphNode[] = preset.nodeLabels.map((label, i) => {
      const angle = (2 * Math.PI * i) / numNodes;
      return {
        id: createNodeId(`node-${i}`),
        label,
        rank: createPageRankScore(1 / numNodes),
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        },
      };
    });

    const defaultEdges: GraphEdge[] = preset.edgeList.map(([source, target, weight], i) => ({
      id: createEdgeId(`edge-${i}`),
      source: defaultNodes[source]!.id,
      target: defaultNodes[target]!.id,
      weight,
    }));

    return {
      nodes: defaultNodes,
      edges: defaultEdges,
      dampingFactor: preset.dampingFactor,
    };
  });

  const [ranks, setRanks] = useState<Map<NodeId, PageRankScore>>(new Map());
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentIteration, setCurrentIteration] = useState<number>(0);
  const [iterations, setIterations] = useState<number>(20);
  const [convergenceHistory, setConvergenceHistory] = useState<
    Array<{ iteration: number; change: number }>
  >([]);
  const [useWebGLRenderer, setUseWebGLRenderer] = useState<boolean>(true);
  const [rendererDimensions, setRendererDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const animationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute PageRank whenever graph changes (instant)
  const computeRanks = useCallback(() => {
    setIsAnimating(false);
    const newRanks = computePageRank(graph, iterations);
    setRanks(newRanks);
    setCurrentIteration(iterations);
    setConvergenceHistory([]);
    onRankComputed?.(newRanks);
  }, [graph, iterations, onRankComputed]);

  // Animate PageRank computation iteration by iteration
  const animateRanks = useCallback(() => {
    setIsAnimating(true);
    setCurrentIteration(0);
    setConvergenceHistory([]);

    // Initialize ranks
    const n = graph.nodes.length;
    if (n === 0) {
      setIsAnimating(false);
      return;
    }

    const rankHistory = new Map<NodeId, number[]>();
    const currentRanks = new Map<NodeId, number>();
    graph.nodes.forEach((node) => {
      currentRanks.set(node.id, 1 / n);
      rankHistory.set(node.id, []);
    });

    // Build adjacency list
    const outgoing = new Map<NodeId, Array<{ target: NodeId; weight: number }>>();
    const outgoingSum = new Map<NodeId, number>();

    graph.edges.forEach((edge) => {
      if (!outgoing.has(edge.source)) {
        outgoing.set(edge.source, []);
      }
      outgoing.get(edge.source)!.push({ target: edge.target, weight: edge.weight });

      const currentSum = outgoingSum.get(edge.source) ?? 0;
      outgoingSum.set(edge.source, currentSum + edge.weight);
    });

    const convergence: Array<{ iteration: number; change: number }> = [];
    let iter = 0;

    // Clear any existing animation interval before starting a new one
    if (animationIntervalRef.current !== null) {
      clearInterval(animationIntervalRef.current);
    }

    const animationInterval = setInterval(() => {
      if (iter >= iterations) {
        setIsAnimating(false);
        clearInterval(animationInterval);
        animationIntervalRef.current = null;
        return;
      }

      // Compute one iteration
      const newRanks = new Map<NodeId, number>();
      graph.nodes.forEach((node) => newRanks.set(node.id, (1 - graph.dampingFactor) / n));

      graph.nodes.forEach((node) => {
        const nodeRank = currentRanks.get(node.id) ?? 0;
        const outLinks = outgoing.get(node.id) ?? [];
        const totalWeight = outgoingSum.get(node.id) ?? 1;

        outLinks.forEach(({ target, weight }) => {
          const contribution = (nodeRank * graph.dampingFactor * weight) / totalWeight;
          const currentRank = newRanks.get(target) ?? 0;
          newRanks.set(target, currentRank + contribution);
        });
      });

      // Calculate change
      let maxChange = 0;
      graph.nodes.forEach((node) => {
        const oldRank = currentRanks.get(node.id) ?? 0;
        const newRank = newRanks.get(node.id) ?? 0;
        maxChange = Math.max(maxChange, Math.abs(newRank - oldRank));
        currentRanks.set(node.id, newRank);
      });

      convergence.push({ iteration: iter + 1, change: maxChange });

      // Update displayed ranks (clamp to [0,1] to guard against Infinity/NaN)
      const displayRanks = new Map<NodeId, PageRankScore>();
      currentRanks.forEach((rank, nodeId) => {
        const safeRank = Number.isFinite(rank) ? Math.max(0, Math.min(1, rank)) : 0;
        displayRanks.set(nodeId, createPageRankScore(safeRank));
      });

      setRanks(displayRanks);
      setCurrentIteration(iter + 1);
      setConvergenceHistory([...convergence]);

      iter++;
    }, ANIMATION_DURATIONS[animationSpeed]);

    animationIntervalRef.current = animationInterval;
  }, [graph, iterations, animationSpeed]);

  // Stop animation
  const stopAnimation = useCallback(() => {
    if (animationIntervalRef.current !== null) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setIsAnimating(false);
    computeRanks(); // Compute final ranks
  }, [computeRanks]);

  // Auto-compute on graph change
  useEffect(() => {
    if (graph.nodes.length > 0) {
      computeRanks();
    }
  }, [graph, computeRanks]);

  // Handle renderer interactions
  const handleGraphInteraction = useCallback((interaction: GraphInteraction) => {
    if (interaction.type === 'click' && interaction.nodeId) {
      setSelectedNode(interaction.nodeId);
    }
  }, []);

  // Handle node position updates from renderer
  const handleNodePositionUpdate = useCallback(
    (nodeId: NodeId, position: { x: number; y: number }) => {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
      }));
    },
    [],
  );

  // Update renderer dimensions on container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setRendererDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Clean up animation interval on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current !== null) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  // Add node
  const addNode = useCallback(() => {
    const nodeId = createNodeId(`node-${graph.nodes.length}`);
    const label = String.fromCharCode(65 + graph.nodes.length); // A, B, C, ...

    const containerWidth = containerRef.current?.clientWidth ?? 600;
    const containerHeight = containerRef.current?.clientHeight ?? 400;

    const newNode: GraphNode = {
      id: nodeId,
      label,
      rank: createPageRankScore(1 / (graph.nodes.length + 1)),
      position: {
        x: Math.random() * (containerWidth - 100) + 50,
        y: Math.random() * (containerHeight - 100) + 50,
      },
    };

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
  }, [graph.nodes.length]);

  // Remove node
  const removeNode = useCallback(
    (nodeId: NodeId) => {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== nodeId),
        edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      }));
      if (selectedNode === nodeId) {
        setSelectedNode(null);
      }
    },
    [selectedNode],
  );

  // Add edge
  const addEdge = useCallback((source: NodeId, target: NodeId, weight: number = 1) => {
    if (source === target) return; // No self-loops

    const edgeId = createEdgeId(`edge-${source}-${target}`);
    const newEdge: GraphEdge = {
      id: edgeId,
      source,
      target,
      weight,
    };

    setGraph((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
  }, []);

  // Remove edge (currently unused but available for future features)
  // const removeEdge = useCallback((edgeId: EdgeId) => {
  //   setGraph(prev => ({
  //     ...prev,
  //     edges: prev.edges.filter(e => e.id !== edgeId),
  //   }));
  // }, []);

  // Load preset graph
  const loadPreset = useCallback(
    (presetName: string) => {
      const preset = PRESET_GRAPHS[presetName];
      if (!preset) return;

      // Prefer measured container dimensions, fall back to renderer dimensions
      const containerWidth = containerRef.current?.clientWidth || rendererDimensions.width;
      const containerHeight = containerRef.current?.clientHeight || rendererDimensions.height;

      // Create nodes in circle layout
      const numNodes = preset.nodeLabels.length;
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;
      const radius = Math.min(containerWidth, containerHeight) / 3;

      const nodes: GraphNode[] = preset.nodeLabels.map((label, i) => {
        const angle = (2 * Math.PI * i) / numNodes;
        return {
          id: createNodeId(`node-${i}`),
          label,
          rank: createPageRankScore(1 / numNodes),
          position: {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          },
        };
      });

      const edges: GraphEdge[] = preset.edgeList.map(([source, target, weight], i) => ({
        id: createEdgeId(`edge-${i}`),
        source: nodes[source]!.id,
        target: nodes[target]!.id,
        weight,
      }));

      setGraph({
        nodes,
        edges,
        dampingFactor: preset.dampingFactor,
      });
    },
    [rendererDimensions.width, rendererDimensions.height],
  );

  // Reset graph
  const reset = useCallback(() => {
    // Clear running animation interval before resetting state
    if (animationIntervalRef.current !== null) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setIsAnimating(false);
    setCurrentIteration(0);
    setConvergenceHistory([]);
    setGraph({
      nodes: [],
      edges: [],
      dampingFactor: 0.85,
    });
    setRanks(new Map());
    setSelectedNode(null);
  }, []);

  // Get node by ID
  const getNode = useCallback(
    (nodeId: NodeId) => graph.nodes.find((n) => n.id === nodeId),
    [graph.nodes],
  );

  // Calculate statistics
  const statistics = useMemo(() => {
    if (ranks.size === 0) {
      return { maxRank: 0, minRank: 0, avgRank: 0, totalNodes: 0, totalEdges: 0 };
    }

    const rankValues = Array.from(ranks.values()).map((r) => r as number);
    return {
      maxRank: Math.max(...rankValues),
      minRank: Math.min(...rankValues),
      avgRank: rankValues.reduce((sum, r) => sum + r, 0) / rankValues.length,
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
    };
  }, [ranks, graph]);

  // Sort nodes by rank
  const sortedNodes = useMemo(() => {
    return [...graph.nodes].sort((a, b) => {
      const rankA = (ranks.get(a.id) as number) ?? 0;
      const rankB = (ranks.get(b.id) as number) ?? 0;
      return rankB - rankA;
    });
  }, [graph.nodes, ranks]);

  return (
    <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold flex items-center gap-2">
                <Network className="h-8 w-8 text-primary" />
                PageRank Explorer
              </CardTitle>
              <CardDescription>
                Build interactive graphs and visualize PageRank algorithm in real-time
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{statistics.totalNodes} Nodes</Badge>
              <Badge variant="outline">{statistics.totalEdges} Edges</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualization Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Graph Canvas */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Graph Visualization
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={useWebGLRenderer ? 'default' : 'outline'} className="text-xs">
                    {useWebGLRenderer ? 'WebGL' : 'SVG'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseWebGLRenderer(!useWebGLRenderer)}
                    title={`Switch to ${useWebGLRenderer ? 'SVG' : 'WebGL'} renderer`}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={containerRef}
                className="relative w-full h-[600px] rounded-xl overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.13 0.02 264) 0%, oklch(0.10 0.015 250) 100%)',
                  border: '1px solid oklch(0.28 0.04 264 / 0.6)',
                  boxShadow:
                    '0 0 0 1px oklch(0.55 0.27 264 / 0.08), 0 8px 32px oklch(0.10 0.02 264 / 0.5)',
                }}
              >
                {graph.nodes.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Network className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-sm">No nodes in graph. Add nodes or load a preset.</p>
                    </div>
                  </div>
                ) : useWebGLRenderer ? (
                  <PageRankGraphRenderer
                    nodes={graph.nodes}
                    edges={graph.edges}
                    ranks={ranks}
                    selectedNode={selectedNode}
                    config={{
                      width: rendererDimensions.width,
                      height: rendererDimensions.height,
                      enablePhysics: !isAnimating,
                      nodeSizeScale: 1.0,
                      edgeOpacity: 0.55,
                      showLabels: true,
                      backgroundColor: '#0d0f1a',
                      nodeColorScheme: 'rank',
                      antialias: true,
                      minZoom: 0.25,
                      maxZoom: 4.0,
                    }}
                    onInteraction={handleGraphInteraction}
                    onNodePositionUpdate={handleNodePositionUpdate}
                    className="w-full h-full"
                  />
                ) : (
                  /* SVG fallback renderer with improved aesthetics */
                  <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                    <defs>
                      {graph.nodes.map((node) => {
                        const rank = (ranks.get(node.id) as number) ?? 0;
                        const nr = rank / (statistics.maxRank || 1);
                        const hue = Math.round(230 + nr * 90);
                        const sat = Math.round(50 + nr * 35);
                        const lit = Math.round(35 + nr * 25);
                        return (
                          <radialGradient
                            key={`grad-${node.id}`}
                            id={`nodegrad-${node.id}`}
                            cx="35%"
                            cy="30%"
                            r="65%"
                          >
                            <stop
                              offset="0%"
                              stopColor={`hsl(${hue},${Math.min(sat + 15, 100)}%,${Math.min(lit + 22, 85)}%)`}
                            />
                            <stop offset="55%" stopColor={`hsl(${hue},${sat}%,${lit}%)`} />
                            <stop
                              offset="100%"
                              stopColor={`hsl(${hue},${sat}%,${Math.max(lit - 14, 10)}%)`}
                            />
                          </radialGradient>
                        );
                      })}
                      {graph.edges.map((edge) => (
                        <marker
                          key={`arrow-${edge.id}`}
                          id={`arrow-${edge.id}`}
                          markerWidth="8"
                          markerHeight="8"
                          refX="7"
                          refY="4"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,1 L0,7 L7,4 Z" fill="oklch(0.65 0.22 264 / 0.75)" />
                        </marker>
                      ))}
                    </defs>

                    {/* Edges */}
                    {graph.edges.map((edge) => {
                      const source = getNode(edge.source);
                      const target = getNode(edge.target);
                      if (!source || !target) return null;

                      const dx = target.position.x - source.position.x;
                      const dy = target.position.y - source.position.y;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                      const dirX = dx / dist;
                      const dirY = dy / dist;
                      const srcRank = (ranks.get(edge.source) as number) ?? 0;
                      const srcRadius = 20 + (srcRank / (statistics.maxRank || 1)) * 30;
                      const tgtRank = (ranks.get(edge.target) as number) ?? 0;
                      const tgtRadius = 20 + (tgtRank / (statistics.maxRank || 1)) * 30;
                      const sx = source.position.x + dirX * (srcRadius + 2);
                      const sy = source.position.y + dirY * (srcRadius + 2);
                      const ex = target.position.x - dirX * (tgtRadius + 12);
                      const ey = target.position.y - dirY * (tgtRadius + 12);

                      return (
                        <line
                          key={edge.id}
                          x1={sx}
                          y1={sy}
                          x2={ex}
                          y2={ey}
                          stroke="oklch(0.60 0.18 264 / 0.6)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          markerEnd={`url(#arrow-${edge.id})`}
                        />
                      );
                    })}

                    {/* Nodes */}
                    {graph.nodes.map((node) => {
                      const rank = (ranks.get(node.id) as number) ?? 0;
                      const nr = rank / (statistics.maxRank || 1);
                      const radius = 20 + nr * 30;
                      const isSelected = selectedNode === node.id;
                      const hue = Math.round(230 + nr * 90);

                      return (
                        <g
                          key={node.id}
                          onClick={() => setSelectedNode(node.id)}
                          className="cursor-pointer"
                        >
                          {isSelected && (
                            <circle
                              cx={node.position.x}
                              cy={node.position.y}
                              r={radius + 7}
                              fill="none"
                              stroke={`hsl(${hue},80%,65%)`}
                              strokeWidth="3"
                              opacity="0.7"
                            />
                          )}
                          <m.circle
                            cx={node.position.x}
                            cy={node.position.y}
                            r={radius}
                            fill={`url(#nodegrad-${node.id})`}
                            stroke={`hsl(${hue},70%,${isSelected ? 72 : 55}%)`}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.08 }}
                          />
                          <text
                            x={node.position.x}
                            y={node.position.y + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={Math.max(10, Math.min(14, radius * 0.5))}
                            fontWeight="700"
                            fill="#ffffff"
                            style={{
                              pointerEvents: 'none',
                              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                            }}
                          >
                            {node.label}
                          </text>
                          <text
                            x={node.position.x}
                            y={node.position.y + radius + 14}
                            textAnchor="middle"
                            fontSize="10"
                            fill="oklch(0.70 0.08 264)"
                            style={{ pointerEvents: 'none' }}
                          >
                            {rank.toFixed(3)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              {/* Selected Node Actions */}
              {selectedNode && (
                <div className="mt-4 flex gap-2">
                  <Badge variant="secondary">Selected: {getNode(selectedNode)?.label}</Badge>
                  {graph.nodes.map((node) => {
                    if (node.id === selectedNode) return null;
                    const edgeExists = graph.edges.some(
                      (e) => e.source === selectedNode && e.target === node.id,
                    );

                    return (
                      <Button
                        key={node.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addEdge(selectedNode, node.id)}
                        disabled={edgeExists}
                      >
                        Link to {node.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rankings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Node Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedNodes.map((node, index) => {
                  const rank = (ranks.get(node.id) as number) ?? 0;
                  const maxRank = statistics.maxRank;
                  const barWidth =
                    maxRank > 0 && Number.isFinite(rank / maxRank) ? (rank / maxRank) * 100 : 0;

                  return (
                    <m.div
                      key={node.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 text-sm font-bold text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div className="w-12 text-sm font-semibold">{node.label}</div>
                      <div className="flex-1">
                        <div className="relative h-8 bg-muted rounded overflow-hidden">
                          <m.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.5 }}
                          />
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-mono font-semibold mix-blend-difference text-white">
                              {rank.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNode(node.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </m.div>
                  );
                })}
              </div>

              {graph.nodes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No nodes to display</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="space-y-6">
          {/* Graph Building */}
          <Card>
            <CardHeader>
              <CardTitle>Build Graph</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={addNode}>
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="damping">Damping Factor</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {graph.dampingFactor.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="damping"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[graph.dampingFactor]}
                  onValueChange={([value]: number[]) =>
                    setGraph((prev) => ({ ...prev, dampingFactor: value ?? 0.85 }))
                  }
                  disabled={isAnimating}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="iterations">Iterations</Label>
                  <span className="text-sm font-mono text-muted-foreground">{iterations}</span>
                </div>
                <Slider
                  id="iterations"
                  min={5}
                  max={50}
                  step={5}
                  value={[iterations]}
                  onValueChange={([value]: number[]) => setIterations(value ?? 20)}
                  disabled={isAnimating}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Animation</Label>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={isAnimating ? 'destructive' : 'default'}
                    onClick={isAnimating ? stopAnimation : animateRanks}
                    disabled={graph.nodes.length === 0}
                  >
                    {isAnimating ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Animate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={computeRanks}
                    disabled={isAnimating || graph.nodes.length === 0}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                {isAnimating && (
                  <div className="text-xs text-muted-foreground text-center">
                    Iteration {currentIteration} / {iterations}
                  </div>
                )}
              </div>

              {/* Convergence Chart */}
              {convergenceHistory.length > 0 && (
                <>
                  <Separator />
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-sm">Convergence</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 flex items-end gap-1">
                        {convergenceHistory.map((point, i) => {
                          const maxChange = Math.max(...convergenceHistory.map((p) => p.change));
                          const height = maxChange > 0 ? (point.change / maxChange) * 100 : 0;
                          return (
                            <m.div
                              key={i}
                              className="flex-1 bg-primary rounded-t"
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              transition={{ duration: 0.2 }}
                              title={`Iteration ${point.iteration}: ${point.change.toFixed(6)}`}
                            />
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground text-center">
                        Max change:{' '}
                        {convergenceHistory[convergenceHistory.length - 1]?.change.toFixed(6) ??
                          '0'}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              <Separator />

              <Button variant="outline" className="w-full" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear Graph
              </Button>
            </CardContent>
          </Card>

          {/* Preset Graphs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preset Graphs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(PRESET_GRAPHS).map((key) => {
                const isLarge = key.startsWith('large');
                const displayName =
                  key === 'large50'
                    ? 'Large (50 nodes)'
                    : key === 'large100'
                      ? 'Large (100 nodes)'
                      : key.charAt(0).toUpperCase() + key.slice(1);

                return (
                  <Button
                    key={key}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => loadPreset(key)}
                  >
                    <ChevronRight className="h-4 w-4 mr-2" />
                    {displayName}
                    {isLarge && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Performance Test
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Rank:</span>
                <span className="font-mono font-semibold">{statistics.maxRank.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Rank:</span>
                <span className="font-mono font-semibold">{statistics.minRank.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Rank:</span>
                <span className="font-mono font-semibold">{statistics.avgRank.toFixed(4)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Density:</span>
                <span className="font-mono font-semibold">
                  {statistics.totalNodes > 1
                    ? (
                        statistics.totalEdges /
                        (statistics.totalNodes * (statistics.totalNodes - 1))
                      ).toFixed(3)
                    : '0.000'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Educational Explanation */}
      {showExplanations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Understanding PageRank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="concept">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="concept">Concept</TabsTrigger>
                <TabsTrigger value="algorithm">Algorithm</TabsTrigger>
                <TabsTrigger value="interpretation">Interpretation</TabsTrigger>
                <TabsTrigger value="tips">Tips</TabsTrigger>
              </TabsList>

              <TabsContent value="concept" className="space-y-3 text-sm break-words">
                <p className="break-words overflow-wrap-break-word">
                  <strong>PageRank</strong> is the algorithm Google used to rank web pages. It
                  measures the importance of nodes based on the link structure of the graph.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 break-words">
                  <li className="break-words">
                    A node is important if it's linked to by important nodes
                  </li>
                  <li className="break-words">Links from high-rank nodes carry more weight</li>
                  <li className="break-words">
                    The algorithm simulates a random surfer clicking links
                  </li>
                  <li className="break-words">Node size represents PageRank score</li>
                </ul>
              </TabsContent>

              <TabsContent value="algorithm" className="space-y-3 text-sm font-mono break-words">
                <p className="break-words">
                  <strong>PageRank Formula:</strong>
                </p>
                <div className="bg-muted p-4 rounded-lg text-xs break-words overflow-x-auto">
                  <code className="break-words">PR(A) = (1-d)/N + d × Σ(PR(Ti)/C(Ti))</code>
                </div>
                <ul className="list-disc list-inside space-y-1 ml-4 text-xs break-words">
                  <li className="break-words">d = damping factor (typically 0.85)</li>
                  <li className="break-words">N = total number of nodes</li>
                  <li className="break-words">Ti = nodes that link to A</li>
                  <li className="break-words">C(Ti) = number of outbound links from Ti</li>
                </ul>
              </TabsContent>

              <TabsContent value="interpretation" className="space-y-3 text-sm break-words">
                <p className="break-words">
                  <strong>What the ranks mean:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 break-words">
                  <li className="break-words">
                    <strong>High rank:</strong> Central, authoritative, well-connected
                  </li>
                  <li className="break-words">
                    <strong>Low rank:</strong> Peripheral, less referenced
                  </li>
                  <li className="break-words">
                    <strong>Damping factor:</strong> Probability of following a link vs. random jump
                  </li>
                  <li className="break-words">Rankings are relative within the graph</li>
                </ul>
              </TabsContent>

              <TabsContent value="tips" className="space-y-3 text-sm break-words">
                <p className="break-words">
                  <strong>Try these experiments:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 break-words">
                  <li className="break-words">
                    Load the Star graph to see how a hub becomes highly ranked
                  </li>
                  <li className="break-words">Create a cycle and observe equal distribution</li>
                  <li className="break-words">
                    Add a node that links to everyone but receives no links
                  </li>
                  <li className="break-words">
                    Adjust damping factor to see its effect on rankings
                  </li>
                  <li className="break-words">
                    Build a simple web structure with bidirectional links
                  </li>
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
