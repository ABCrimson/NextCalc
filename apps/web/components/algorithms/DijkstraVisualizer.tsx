'use client';

/**
 * Dijkstra's Algorithm Visualizer
 *
 * Interactive visualization of Dijkstra's shortest path algorithm.
 * Features beautiful GPU-accelerated rendering, step-by-step animation,
 * and educational explanations.
 *
 * Algorithm Complexity:
 * - Time: O((V + E) log V) with binary heap
 * - Space: O(V)
 *
 * @example
 * ```tsx
 * <DijkstraVisualizer />
 * ```
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Zap,
  Info,
} from 'lucide-react';
import {
  UnifiedGraphRenderer,
  type GraphNode,
  type GraphEdge,
  type NodeId,
} from './UnifiedGraphRenderer';

// ============================================================================
// Types
// ============================================================================

interface DijkstraState {
  visited: Set<NodeId>;
  distances: Map<NodeId, number>;
  previous: Map<NodeId, NodeId | null>;
  current: NodeId | null;
  queue: Array<{ nodeId: NodeId; distance: number }>;
  path: NodeId[];
  finished: boolean;
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
    name: 'Simple Path',
    description: 'Basic 5-node graph for learning',
    nodes: [
      { id: 'A', label: 'A', x: 200, y: 300, state: 'start' },
      { id: 'B', label: 'B', x: 350, y: 200 },
      { id: 'C', label: 'C', x: 350, y: 400 },
      { id: 'D', label: 'D', x: 500, y: 300 },
      { id: 'E', label: 'E', x: 650, y: 300, state: 'end' },
    ],
    edges: [
      { id: 'A-B', source: 'A', target: 'B', weight: 4, directed: false },
      { id: 'A-C', source: 'A', target: 'C', weight: 2, directed: false },
      { id: 'B-D', source: 'B', target: 'D', weight: 3, directed: false },
      { id: 'C-D', source: 'C', target: 'D', weight: 1, directed: false },
      { id: 'D-E', source: 'D', target: 'E', weight: 2, directed: false },
    ],
  },
  {
    name: 'City Network',
    description: '8-node city connection graph',
    nodes: [
      { id: 'NYC', label: 'NYC', x: 150, y: 200, state: 'start' },
      { id: 'BOS', label: 'BOS', x: 250, y: 100 },
      { id: 'PHI', label: 'PHI', x: 100, y: 350 },
      { id: 'DC', label: 'DC', x: 300, y: 400 },
      { id: 'ATL', label: 'ATL', x: 450, y: 500 },
      { id: 'CHI', label: 'CHI', x: 400, y: 200 },
      { id: 'DEN', label: 'DEN', x: 600, y: 300 },
      { id: 'LA', label: 'LA', x: 750, y: 350, state: 'end' },
    ],
    edges: [
      { id: 'NYC-BOS', source: 'NYC', target: 'BOS', weight: 3, directed: false },
      { id: 'NYC-PHI', source: 'NYC', target: 'PHI', weight: 2, directed: false },
      { id: 'NYC-CHI', source: 'NYC', target: 'CHI', weight: 12, directed: false },
      { id: 'PHI-DC', source: 'PHI', target: 'DC', weight: 2, directed: false },
      { id: 'DC-ATL', source: 'DC', target: 'ATL', weight: 8, directed: false },
      { id: 'BOS-CHI', source: 'BOS', target: 'CHI', weight: 14, directed: false },
      { id: 'CHI-DEN', source: 'CHI', target: 'DEN', weight: 10, directed: false },
      { id: 'DEN-LA', source: 'DEN', target: 'LA', weight: 15, directed: false },
      { id: 'ATL-LA', source: 'ATL', target: 'LA', weight: 18, directed: false },
    ],
  },
  {
    name: 'Complex Network',
    description: '10-node graph with multiple paths',
    nodes: [
      { id: '0', label: '0', x: 100, y: 300, state: 'start' },
      { id: '1', label: '1', x: 200, y: 150 },
      { id: '2', label: '2', x: 200, y: 450 },
      { id: '3', label: '3', x: 350, y: 100 },
      { id: '4', label: '4', x: 350, y: 300 },
      { id: '5', label: '5', x: 350, y: 500 },
      { id: '6', label: '6', x: 500, y: 200 },
      { id: '7', label: '7', x: 500, y: 400 },
      { id: '8', label: '8', x: 650, y: 250 },
      { id: '9', label: '9', x: 750, y: 300, state: 'end' },
    ],
    edges: [
      { id: '0-1', source: '0', target: '1', weight: 4, directed: false },
      { id: '0-2', source: '0', target: '2', weight: 1, directed: false },
      { id: '1-3', source: '1', target: '3', weight: 3, directed: false },
      { id: '1-4', source: '1', target: '4', weight: 2, directed: false },
      { id: '2-4', source: '2', target: '4', weight: 5, directed: false },
      { id: '2-5', source: '2', target: '5', weight: 2, directed: false },
      { id: '3-6', source: '3', target: '6', weight: 2, directed: false },
      { id: '4-6', source: '4', target: '6', weight: 3, directed: false },
      { id: '4-7', source: '4', target: '7', weight: 1, directed: false },
      { id: '5-7', source: '5', target: '7', weight: 4, directed: false },
      { id: '6-8', source: '6', target: '8', weight: 5, directed: false },
      { id: '7-8', source: '7', target: '8', weight: 2, directed: false },
      { id: '8-9', source: '8', target: '9', weight: 3, directed: false },
    ],
  },
];

// ============================================================================
// Dijkstra's Algorithm Implementation
// ============================================================================

function* dijkstraGenerator(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: NodeId,
  endId: NodeId
): Generator<DijkstraState> {
  // Initialize
  const visited = new Set<NodeId>();
  const distances = new Map<NodeId, number>();
  const previous = new Map<NodeId, NodeId | null>();
  const queue: Array<{ nodeId: NodeId; distance: number }> = [];

  // Build adjacency list
  const adjacency = new Map<NodeId, Array<{ target: NodeId; weight: number }>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);

    adjacency.get(edge.source)!.push({ target: edge.target, weight: edge.weight ?? 1 });
    // Undirected graph - add reverse edge
    if (!edge.directed) {
      adjacency.get(edge.target)!.push({ target: edge.source, weight: edge.weight ?? 1 });
    }
  }

  // Initialize distances and queue
  for (const node of nodes) {
    distances.set(node.id, node.id === startId ? 0 : Infinity);
    previous.set(node.id, null);
    if (node.id === startId) {
      queue.push({ nodeId: node.id, distance: 0 });
    }
  }

  // Dijkstra's algorithm
  while (queue.length > 0) {
    // Sort queue by distance (simple implementation - could use priority queue)
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (!current) break;

    const { nodeId: currentId, distance: currentDistance } = current;

    // Skip if already visited
    if (visited.has(currentId)) continue;

    // Mark as visited
    visited.add(currentId);

    // Yield current state
    yield {
      visited: new Set(visited),
      distances: new Map(distances),
      previous: new Map(previous),
      current: currentId,
      queue: [...queue],
      path: [],
      finished: false,
    };

    // Found target
    if (currentId === endId) {
      // Reconstruct path
      const path: NodeId[] = [];
      let pathNode: NodeId | null = endId;
      while (pathNode !== null) {
        path.unshift(pathNode);
        pathNode = previous.get(pathNode) ?? null;
      }

      yield {
        visited: new Set(visited),
        distances: new Map(distances),
        previous: new Map(previous),
        current: null,
        queue: [],
        path,
        finished: true,
      };
      return;
    }

    // Check neighbors
    const neighbors = adjacency.get(currentId) ?? [];
    for (const { target, weight } of neighbors) {
      if (visited.has(target)) continue;

      const newDistance = currentDistance + weight;
      const oldDistance = distances.get(target) ?? Infinity;

      if (newDistance < oldDistance) {
        distances.set(target, newDistance);
        previous.set(target, currentId);
        queue.push({ nodeId: target, distance: newDistance });

        // Yield state after updating distance
        yield {
          visited: new Set(visited),
          distances: new Map(distances),
          previous: new Map(previous),
          current: currentId,
          queue: [...queue],
          path: [],
          finished: false,
        };
      }
    }
  }

  // No path found
  yield {
    visited: new Set(visited),
    distances: new Map(distances),
    previous: new Map(previous),
    current: null,
    queue: [],
    path: [],
    finished: true,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function DijkstraVisualizer() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [currentStep, setCurrentStep] = useState(0);
  const [algorithmState, setAlgorithmState] = useState<DijkstraState | null>(null);
  const [startNode, setStartNode] = useState<NodeId>('A');
  const [endNode, _setEndNode] = useState<NodeId>('E');

  const preset = PRESET_GRAPHS[selectedPreset]!;

  // Generate all algorithm steps
  const algorithmSteps = useMemo(() => {
    const steps: DijkstraState[] = [];
    const generator = dijkstraGenerator(preset.nodes, preset.edges, startNode, endNode);

    for (const state of generator) {
      steps.push(state);
    }

    return steps;
  }, [preset, startNode, endNode]);

  // Update current state based on step
  useEffect(() => {
    if (algorithmSteps.length > 0) {
      setAlgorithmState(algorithmSteps[Math.min(currentStep, algorithmSteps.length - 1)]!);
    }
  }, [currentStep, algorithmSteps]);

  // Auto-play animation
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

      if (algorithmState.path.includes(node.id)) {
        state = 'path';
      } else if (node.id === algorithmState.current) {
        state = 'current';
      } else if (algorithmState.visited.has(node.id)) {
        state = 'visited';
      }

      // Override for start/end nodes
      if (node.id === startNode) state = 'start';
      if (node.id === endNode) state = 'end';

      const distance = algorithmState.distances.get(node.id);

      return {
        ...node,
        state,
        ...(distance !== undefined && { distance }),
      };
    });
  }, [preset.nodes, algorithmState, startNode, endNode]);

  const visualEdges: GraphEdge[] = useMemo(() => {
    if (!algorithmState) return preset.edges;

    return preset.edges.map((edge) => {
      let state: GraphEdge['state'] = 'unvisited';

      // Check if edge is in path
      const pathEdges = new Set<string>();
      for (let i = 0; i < algorithmState.path.length - 1; i++) {
        const a = algorithmState.path[i];
        const b = algorithmState.path[i + 1];
        pathEdges.add(`${a}-${b}`);
        pathEdges.add(`${b}-${a}`);
      }

      if (pathEdges.has(`${edge.source}-${edge.target}`)) {
        state = 'path';
      } else if (
        algorithmState.visited.has(edge.source) ||
        algorithmState.visited.has(edge.target)
      ) {
        state = 'visited';
      }

      const flow = state === 'path' ? (currentStep % 60) / 60 : undefined;

      return {
        ...edge,
        state,
        ...(flow !== undefined && { flow }),
      };
    });
  }, [preset.edges, algorithmState, currentStep]);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleStepForward = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, algorithmSteps.length - 1));
  }, [algorithmSteps]);

  const handleNodeClick = useCallback(
    (nodeId: NodeId) => {
      if (algorithmState?.finished) {
        // Toggle start/end node
        if (startNode === nodeId) {
          // Don't allow removing start node
          return;
        }
        if (endNode === nodeId) {
          // Don't allow removing end node
          return;
        }

        // Set as new start or end
        if (!preset.nodes.find((n) => n.id === nodeId)?.state) {
          setStartNode(nodeId);
          handleReset();
        }
      }
    },
    [algorithmState, startNode, endNode, preset, handleReset]
  );

  const totalDistance = algorithmState?.distances.get(endNode);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dijkstra's Shortest Path Algorithm
            </h2>
            <p className="text-muted-foreground mt-2">
              Find the shortest path between two nodes in a weighted graph
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <Zap className="h-3 w-3 mr-1" />
              O((V+E) log V)
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Interactive Visualization</CardTitle>
            <CardDescription>
              {algorithmState?.finished
                ? algorithmState.path.length > 0
                  ? `Shortest path found! Distance: ${totalDistance?.toFixed(1)}`
                  : 'No path exists between start and end nodes'
                : `Step ${currentStep + 1} of ${algorithmSteps.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] rounded-lg border bg-gradient-to-br from-background to-blue-50 dark:from-background dark:to-blue-950">
              <UnifiedGraphRenderer
                nodes={visualNodes}
                edges={visualEdges}
                config={{
                  showLabels: true,
                  showEdgeWeights: true,
                  showArrows: false,
                  enablePhysics: false,
                }}
                onNodeClick={handleNodeClick}
              />
            </div>
          </CardContent>
        </Card>

        {/* Controls and Info */}
        <div className="space-y-4">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset Selection */}
              <div className="space-y-2">
                <Label>Graph Preset</Label>
                <Tabs
                  value={selectedPreset.toString()}
                  onValueChange={(v) => {
                    setSelectedPreset(parseInt(v, 10));
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
                    <Label>Animation Speed</Label>
                    <span className="text-sm text-muted-foreground">{speed}ms</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => v !== undefined && setSpeed(v)}
                    min={100}
                    max={2000}
                    step={100}
                    className="w-full"
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
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Algorithm Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Algorithm Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {algorithmState && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Node</span>
                      <Badge variant="outline">{algorithmState.current ?? 'None'}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Visited Nodes</span>
                      <Badge variant="outline">{algorithmState.visited.size}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Queue Size</span>
                      <Badge variant="outline">{algorithmState.queue.length}</Badge>
                    </div>

                    {totalDistance !== undefined && totalDistance !== Infinity && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Distance</span>
                        <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">
                          {totalDistance.toFixed(1)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Path */}
                  {algorithmState.path.length > 0 && (
                    <div className="space-y-2">
                      <Label>Shortest Path</Label>
                      <div className="flex flex-wrap gap-1">
                        {algorithmState.path.map((nodeId, i) => (
                          <div key={nodeId} className="flex items-center">
                            <Badge variant="outline" className="bg-green-500/10">
                              {nodeId}
                            </Badge>
                            {i < algorithmState.path.length - 1 && (
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
        </div>
      </div>
    </div>
  );
}
