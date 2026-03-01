'use client';

/**
 * Graph Traversal Visualizer (BFS & DFS)
 *
 * Interactive visualization comparing Breadth-First Search and Depth-First Search.
 * Features side-by-side comparison, beautiful animations, and educational insights.
 *
 * Algorithms:
 * - BFS: O(V + E) time, O(V) space
 * - DFS: O(V + E) time, O(V) space
 *
 * @example
 * ```tsx
 * <GraphTraversalVisualizer />
 * ```
 */

import { motion } from 'framer-motion';
import {
  GitBranch,
  Info,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  TrendingDown,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type GraphEdge,
  type GraphNode,
  type NodeId,
  UnifiedGraphRenderer,
} from './UnifiedGraphRenderer';

// ============================================================================
// Types
// ============================================================================

type TraversalType = 'bfs' | 'dfs';

interface TraversalState {
  visited: Set<NodeId>;
  queue: NodeId[];
  current: NodeId | null;
  order: NodeId[];
  finished: boolean;
  level?: number; // For BFS levels
}

interface PresetGraph {
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Preset Graphs
// ============================================================================

const PRESET_GRAPHS: PresetGraph[] = [
  {
    name: 'Binary Tree',
    description: 'Classic tree structure',
    nodes: [
      { id: '1', label: '1', x: 400, y: 100 },
      { id: '2', label: '2', x: 250, y: 220 },
      { id: '3', label: '3', x: 550, y: 220 },
      { id: '4', label: '4', x: 150, y: 340 },
      { id: '5', label: '5', x: 350, y: 340 },
      { id: '6', label: '6', x: 450, y: 340 },
      { id: '7', label: '7', x: 650, y: 340 },
    ],
    edges: [
      { id: '1-2', source: '1', target: '2', directed: true },
      { id: '1-3', source: '1', target: '3', directed: true },
      { id: '2-4', source: '2', target: '4', directed: true },
      { id: '2-5', source: '2', target: '5', directed: true },
      { id: '3-6', source: '3', target: '6', directed: true },
      { id: '3-7', source: '3', target: '7', directed: true },
    ],
  },
  {
    name: 'Cyclic Graph',
    description: 'Graph with cycles',
    nodes: [
      { id: 'A', label: 'A', x: 200, y: 250 },
      { id: 'B', label: 'B', x: 350, y: 150 },
      { id: 'C', label: 'C', x: 500, y: 250 },
      { id: 'D', label: 'D', x: 350, y: 400 },
      { id: 'E', label: 'E', x: 600, y: 350 },
    ],
    edges: [
      { id: 'A-B', source: 'A', target: 'B', directed: true },
      { id: 'B-C', source: 'B', target: 'C', directed: true },
      { id: 'C-D', source: 'C', target: 'D', directed: true },
      { id: 'D-A', source: 'D', target: 'A', directed: true },
      { id: 'C-E', source: 'C', target: 'E', directed: true },
      { id: 'E-D', source: 'E', target: 'D', directed: true },
    ],
  },
  {
    name: 'Complex Network',
    description: 'Multi-level graph',
    nodes: [
      { id: '0', label: '0', x: 400, y: 100 },
      { id: '1', label: '1', x: 250, y: 200 },
      { id: '2', label: '2', x: 550, y: 200 },
      { id: '3', label: '3', x: 150, y: 300 },
      { id: '4', label: '4', x: 350, y: 300 },
      { id: '5', label: '5', x: 450, y: 300 },
      { id: '6', label: '6', x: 650, y: 300 },
      { id: '7', label: '7', x: 200, y: 400 },
      { id: '8', label: '8', x: 600, y: 400 },
    ],
    edges: [
      { id: '0-1', source: '0', target: '1', directed: true },
      { id: '0-2', source: '0', target: '2', directed: true },
      { id: '1-3', source: '1', target: '3', directed: true },
      { id: '1-4', source: '1', target: '4', directed: true },
      { id: '2-5', source: '2', target: '5', directed: true },
      { id: '2-6', source: '2', target: '6', directed: true },
      { id: '3-7', source: '3', target: '7', directed: true },
      { id: '4-7', source: '4', target: '7', directed: true },
      { id: '5-8', source: '5', target: '8', directed: true },
      { id: '6-8', source: '6', target: '8', directed: true },
    ],
  },
];

// ============================================================================
// Traversal Algorithm Implementations
// ============================================================================

function* bfsGenerator(
  _nodes: GraphNode[],
  edges: GraphEdge[],
  startId: NodeId,
): Generator<TraversalState> {
  const visited = new Set<NodeId>();
  const queue: NodeId[] = [startId];
  const order: NodeId[] = [];
  const levels = new Map<NodeId, number>();
  levels.set(startId, 0);

  // Build adjacency list
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) continue;

    visited.add(current);
    order.push(current);

    const level = levels.get(current);
    yield {
      visited: new Set(visited),
      queue: [...queue],
      current,
      order: [...order],
      finished: false,
      ...(level !== undefined && { level }),
    };

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && !queue.includes(neighbor)) {
        queue.push(neighbor);
        if (!levels.has(neighbor)) {
          levels.set(neighbor, (levels.get(current) ?? 0) + 1);
        }
      }
    }
  }

  yield {
    visited: new Set(visited),
    queue: [],
    current: null,
    order: [...order],
    finished: true,
  };
}

function* dfsGenerator(
  _nodes: GraphNode[],
  edges: GraphEdge[],
  startId: NodeId,
): Generator<TraversalState> {
  const visited = new Set<NodeId>();
  const stack: NodeId[] = [startId];
  const order: NodeId[] = [];

  // Build adjacency list
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (visited.has(current)) continue;

    visited.add(current);
    order.push(current);

    yield {
      visited: new Set(visited),
      queue: [...stack],
      current,
      order: [...order],
      finished: false,
    };

    // Add neighbors in reverse order for correct DFS ordering
    const neighbors = (adjacency.get(current) ?? []).slice().reverse();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  yield {
    visited: new Set(visited),
    queue: [],
    current: null,
    order: [...order],
    finished: true,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function GraphTraversalVisualizer() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [traversalType, setTraversalType] = useState<TraversalType>('bfs');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [currentStep, setCurrentStep] = useState(0);
  const [algorithmState, setAlgorithmState] = useState<TraversalState | null>(null);
  const [startNode, setStartNode] = useState<NodeId>('1');

  const preset = PRESET_GRAPHS[selectedPreset]!;

  // Generate algorithm steps
  const algorithmSteps = useMemo(() => {
    const steps: TraversalState[] = [];
    const generator =
      traversalType === 'bfs'
        ? bfsGenerator(preset.nodes, preset.edges, startNode)
        : dfsGenerator(preset.nodes, preset.edges, startNode);

    for (const state of generator) {
      steps.push(state);
    }

    return steps;
  }, [preset, startNode, traversalType]);

  // Update current state
  useEffect(() => {
    if (algorithmSteps.length > 0) {
      setAlgorithmState(algorithmSteps[Math.min(currentStep, algorithmSteps.length - 1)]!);
    }
  }, [currentStep, algorithmSteps]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= algorithmSteps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, algorithmSteps]);

  // Prepare visualization data
  const visualNodes: GraphNode[] = useMemo(() => {
    if (!algorithmState) return preset.nodes;

    return preset.nodes.map((node) => {
      let state: GraphNode['state'] = 'unvisited';

      if (node.id === algorithmState.current) {
        state = 'current';
      } else if (algorithmState.visited.has(node.id)) {
        state = 'visited';
      } else if (algorithmState.queue.includes(node.id)) {
        state = 'path'; // Use path color for queued nodes
      }

      if (node.id === startNode) state = 'start';

      return {
        ...node,
        state,
        label: `${node.label}${algorithmState.order.includes(node.id) ? `\n(${algorithmState.order.indexOf(node.id) + 1})` : ''}`,
      };
    });
  }, [preset.nodes, algorithmState, startNode]);

  const visualEdges: GraphEdge[] = useMemo(() => {
    if (!algorithmState) return preset.edges;

    return preset.edges.map((edge) => {
      let state: GraphEdge['state'] = 'unvisited';

      if (algorithmState.visited.has(edge.source) && algorithmState.visited.has(edge.target)) {
        state = 'visited';
      } else if (algorithmState.current === edge.source || algorithmState.current === edge.target) {
        state = 'current';
      }

      return { ...edge, state };
    });
  }, [preset.edges, algorithmState]);

  // Control handlers
  const handlePlayPause = useCallback(() => setIsPlaying((prev) => !prev), []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleStepForward = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, algorithmSteps.length - 1));
  }, [algorithmSteps]);

  const handleNodeClick = useCallback(
    (nodeId: NodeId) => {
      setStartNode(nodeId);
      handleReset();
    },
    [handleReset],
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              Graph Traversal: BFS vs DFS
            </h2>
            <p className="text-muted-foreground mt-2">
              Compare breadth-first and depth-first search algorithms
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300">
              {traversalType === 'bfs' ? (
                <>
                  <Layers className="h-3 w-3 mr-1" />
                  BFS
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 mr-1" />
                  DFS
                </>
              )}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {traversalType === 'bfs' ? 'Breadth-First Search' : 'Depth-First Search'}
            </CardTitle>
            <CardDescription>
              {algorithmState?.finished
                ? `Traversal complete! Visited ${algorithmState.visited.size} nodes`
                : `Step ${currentStep + 1} of ${algorithmSteps.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] rounded-lg border bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
              <UnifiedGraphRenderer
                nodes={visualNodes}
                edges={visualEdges}
                config={{
                  showLabels: true,
                  showEdgeWeights: false,
                  showArrows: true,
                  enablePhysics: false,
                }}
                onNodeClick={handleNodeClick}
              />
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Algorithm Selection */}
              <div className="space-y-2">
                <Label>Algorithm</Label>
                <Tabs
                  value={traversalType}
                  onValueChange={(v) => {
                    setTraversalType(v as TraversalType);
                    handleReset();
                  }}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="bfs">
                      <Layers className="h-4 w-4 mr-2" />
                      BFS
                    </TabsTrigger>
                    <TabsTrigger value="dfs">
                      <TrendingDown className="h-4 w-4 mr-2" />
                      DFS
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Graph Preset */}
              <div className="space-y-2">
                <Label>Graph Structure</Label>
                <Tabs
                  value={selectedPreset.toString()}
                  onValueChange={(v) => {
                    setSelectedPreset(parseInt(v, 10));
                    setStartNode(PRESET_GRAPHS[parseInt(v, 10)]!.nodes[0]!.id);
                    handleReset();
                  }}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    {PRESET_GRAPHS.map((_, i) => (
                      <TabsTrigger key={i} value={i.toString()}>
                        {i + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <p className="text-sm text-muted-foreground">{preset.description}</p>
              </div>

              <Separator />

              {/* Playback Controls */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    onClick={handlePlayPause}
                    className="flex-1"
                    variant={isPlaying ? 'default' : 'outline'}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Play
                      </>
                    )}
                  </Button>

                  <Button onClick={handleStepForward} variant="outline" size="icon">
                    <SkipForward className="h-4 w-4" />
                  </Button>

                  <Button onClick={handleReset} variant="outline" size="icon">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Speed Control */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Speed</Label>
                    <span className="text-sm text-muted-foreground">{speed}ms</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => v !== undefined && setSpeed(v)}
                    min={100}
                    max={2000}
                    step={100}
                  />
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Progress</Label>
                    <span className="text-sm text-muted-foreground">
                      {currentStep + 1} / {algorithmSteps.length}
                    </span>
                  </div>
                  <Slider
                    value={[currentStep]}
                    onValueChange={([v]) => v !== undefined && setCurrentStep(v)}
                    min={0}
                    max={algorithmSteps.length - 1}
                    step={1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {algorithmState && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Visited Nodes</span>
                    <Badge variant="outline">{algorithmState.visited.size}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {traversalType === 'bfs' ? 'Queue' : 'Stack'} Size
                    </span>
                    <Badge variant="outline">{algorithmState.queue.length}</Badge>
                  </div>

                  {traversalType === 'bfs' && algorithmState.level !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Level</span>
                      <Badge variant="outline">{algorithmState.level}</Badge>
                    </div>
                  )}

                  <Separator />

                  {/* Traversal Order */}
                  {algorithmState.order.length > 0 && (
                    <div className="space-y-2">
                      <Label>Traversal Order</Label>
                      <div className="flex flex-wrap gap-1">
                        {algorithmState.order.map((nodeId, i) => (
                          <div key={nodeId} className="flex items-center">
                            <Badge variant="outline" className="bg-green-500/10">
                              {nodeId}
                            </Badge>
                            {i < algorithmState.order.length - 1 && (
                              <span className="mx-1 text-muted-foreground">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Algorithm Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                BFS vs DFS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Layers className="h-4 w-4 mt-1 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">BFS (Breadth-First)</p>
                    <p className="text-xs text-muted-foreground">
                      Explores level by level. Finds shortest path. Uses queue (FIFO).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <TrendingDown className="h-4 w-4 mt-1 text-teal-600" />
                  <div>
                    <p className="font-medium text-sm">DFS (Depth-First)</p>
                    <p className="text-xs text-muted-foreground">
                      Goes deep first. Memory efficient. Uses stack (LIFO).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
