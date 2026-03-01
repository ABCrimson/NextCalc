'use client';

/**
 * A* Search Algorithm Visualizer
 *
 * Interactive visualization of the A* pathfinding algorithm with heuristic function.
 * Features GPU-accelerated rendering, real-time heuristic display, and grid-based pathfinding.
 *
 * Algorithm Complexity:
 * - Time: O(b^d) where b is branching factor, d is depth
 * - Space: O(b^d)
 *
 * @example
 * ```tsx
 * <AStarVisualizer />
 * ```
 */

import { motion } from 'framer-motion';
import { Compass, Info, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface AStarState {
  openSet: Set<NodeId>;
  closedSet: Set<NodeId>;
  gScore: Map<NodeId, number>;
  fScore: Map<NodeId, number>;
  cameFrom: Map<NodeId, NodeId>;
  current: NodeId | null;
  path: NodeId[];
  finished: boolean;
}

type HeuristicType = 'manhattan' | 'euclidean' | 'chebyshev';

// ============================================================================
// Grid Graph Generator
// ============================================================================

function generateGridGraph(
  rows: number,
  cols: number,
  obstacles: Set<string> = new Set(),
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const cellSize = 60;
  const offsetX = 50;
  const offsetY = 50;

  // Create nodes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${r},${c}`;
      if (obstacles.has(id)) continue;

      nodes.push({
        id,
        label: '',
        x: offsetX + c * cellSize,
        y: offsetY + r * cellSize,
      });
    }
  }

  // Create edges (4-directional)
  const directions: [number, number][] = [
    [0, 1], // right
    [1, 0], // down
    [0, -1], // left
    [-1, 0], // up
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${r},${c}`;
      if (obstacles.has(id)) continue;

      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighborId = `${nr},${nc}`;
          if (!obstacles.has(neighborId)) {
            edges.push({
              id: `${id}-${neighborId}`,
              source: id,
              target: neighborId,
              weight: 1,
              directed: false,
            });
          }
        }
      }
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Heuristic Functions
// ============================================================================

function parseNodeId(id: NodeId): { row: number; col: number } {
  const [row, col] = id.split(',').map(Number);
  return { row: row!, col: col! };
}

function manhattanDistance(a: NodeId, b: NodeId): number {
  const { row: r1, col: c1 } = parseNodeId(a);
  const { row: r2, col: c2 } = parseNodeId(b);
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function euclideanDistance(a: NodeId, b: NodeId): number {
  const { row: r1, col: c1 } = parseNodeId(a);
  const { row: r2, col: c2 } = parseNodeId(b);
  return Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2);
}

function chebyshevDistance(a: NodeId, b: NodeId): number {
  const { row: r1, col: c1 } = parseNodeId(a);
  const { row: r2, col: c2 } = parseNodeId(b);
  return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
}

function getHeuristic(type: HeuristicType): (a: NodeId, b: NodeId) => number {
  switch (type) {
    case 'manhattan':
      return manhattanDistance;
    case 'euclidean':
      return euclideanDistance;
    case 'chebyshev':
      return chebyshevDistance;
  }
}

// ============================================================================
// A* Algorithm Implementation
// ============================================================================

function* aStarGenerator(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: NodeId,
  endId: NodeId,
  heuristicType: HeuristicType,
): Generator<AStarState> {
  const heuristic = getHeuristic(heuristicType);

  // Initialize
  const openSet = new Set<NodeId>([startId]);
  const closedSet = new Set<NodeId>();
  const cameFrom = new Map<NodeId, NodeId>();
  const gScore = new Map<NodeId, number>();
  const fScore = new Map<NodeId, number>();

  // Build adjacency list
  const adjacency = new Map<NodeId, Array<{ target: NodeId; weight: number }>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);

    adjacency.get(edge.source)!.push({ target: edge.target, weight: edge.weight ?? 1 });
    if (!edge.directed) {
      adjacency.get(edge.target)!.push({ target: edge.source, weight: edge.weight ?? 1 });
    }
  }

  // Initialize scores
  for (const node of nodes) {
    gScore.set(node.id, node.id === startId ? 0 : Infinity);
    fScore.set(node.id, node.id === startId ? heuristic(startId, endId) : Infinity);
  }

  // A* algorithm
  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current: NodeId | null = null;
    let lowestF = Infinity;

    for (const nodeId of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = nodeId;
      }
    }

    if (current === null) break;

    // Yield current state
    yield {
      openSet: new Set(openSet),
      closedSet: new Set(closedSet),
      gScore: new Map(gScore),
      fScore: new Map(fScore),
      cameFrom: new Map(cameFrom),
      current,
      path: [],
      finished: false,
    };

    // Found goal
    if (current === endId) {
      const path: NodeId[] = [];
      let pathNode: NodeId = endId;

      while (cameFrom.has(pathNode)) {
        path.unshift(pathNode);
        pathNode = cameFrom.get(pathNode)!;
      }
      path.unshift(startId);

      yield {
        openSet: new Set(openSet),
        closedSet: new Set(closedSet),
        gScore: new Map(gScore),
        fScore: new Map(fScore),
        cameFrom: new Map(cameFrom),
        current: null,
        path,
        finished: true,
      };
      return;
    }

    // Move current from open to closed
    openSet.delete(current);
    closedSet.add(current);

    // Check neighbors
    const neighbors = adjacency.get(current) ?? [];
    for (const { target, weight } of neighbors) {
      if (closedSet.has(target)) continue;

      const tentativeG = (gScore.get(current) ?? Infinity) + weight;

      if (!openSet.has(target)) {
        openSet.add(target);
      } else if (tentativeG >= (gScore.get(target) ?? Infinity)) {
        continue;
      }

      // This path is better
      cameFrom.set(target, current);
      gScore.set(target, tentativeG);
      fScore.set(target, tentativeG + heuristic(target, endId));

      // Yield state after updating scores
      yield {
        openSet: new Set(openSet),
        closedSet: new Set(closedSet),
        gScore: new Map(gScore),
        fScore: new Map(fScore),
        cameFrom: new Map(cameFrom),
        current,
        path: [],
        finished: false,
      };
    }
  }

  // No path found
  yield {
    openSet: new Set(openSet),
    closedSet: new Set(closedSet),
    gScore: new Map(gScore),
    fScore: new Map(fScore),
    cameFrom: new Map(cameFrom),
    current: null,
    path: [],
    finished: true,
  };
}

// ============================================================================
// Preset Scenarios
// ============================================================================

const PRESET_SCENARIOS = [
  {
    name: 'Simple Maze',
    rows: 8,
    cols: 12,
    start: '1,1',
    end: '6,10',
    obstacles: new Set(['2,3', '2,4', '2,5', '3,5', '4,5', '5,5', '5,4', '5,3']),
  },
  {
    name: 'Complex Maze',
    rows: 10,
    cols: 12,
    start: '1,1',
    end: '8,10',
    obstacles: new Set([
      '2,2',
      '2,3',
      '2,4',
      '2,5',
      '2,6',
      '4,2',
      '4,3',
      '4,4',
      '4,5',
      '4,6',
      '6,2',
      '6,3',
      '6,4',
      '6,5',
      '6,6',
      '3,8',
      '4,8',
      '5,8',
      '6,8',
      '7,8',
    ]),
  },
  {
    name: 'Open Field',
    rows: 8,
    cols: 12,
    start: '1,1',
    end: '6,10',
    obstacles: new Set(['3,5', '4,5', '4,6']),
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function AStarVisualizer() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [heuristicType, setHeuristicType] = useState<HeuristicType>('manhattan');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const [currentStep, setCurrentStep] = useState(0);
  const [algorithmState, setAlgorithmState] = useState<AStarState | null>(null);

  const scenario = PRESET_SCENARIOS[selectedPreset]!;
  const { nodes, edges } = useMemo(
    () => generateGridGraph(scenario.rows, scenario.cols, scenario.obstacles),
    [scenario],
  );

  // Generate algorithm steps
  const algorithmSteps = useMemo(() => {
    const steps: AStarState[] = [];
    const generator = aStarGenerator(nodes, edges, scenario.start, scenario.end, heuristicType);

    for (const state of generator) {
      steps.push(state);
    }

    return steps;
  }, [nodes, edges, scenario, heuristicType]);

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
    if (!algorithmState) return nodes;

    return nodes.map((node) => {
      let state: GraphNode['state'] = 'unvisited';

      if (algorithmState.path.includes(node.id)) {
        state = 'path';
      } else if (node.id === algorithmState.current) {
        state = 'current';
      } else if (algorithmState.closedSet.has(node.id)) {
        state = 'visited';
      } else if (algorithmState.openSet.has(node.id)) {
        state = 'current';
      }

      if (node.id === scenario.start) state = 'start';
      if (node.id === scenario.end) state = 'end';

      const fScore = algorithmState.fScore.get(node.id);
      const gScore = algorithmState.gScore.get(node.id);

      return {
        ...node,
        state,
        ...(fScore !== undefined && { heuristic: fScore }),
        ...(gScore !== undefined && { distance: gScore }),
      };
    });
  }, [nodes, algorithmState, scenario]);

  const visualEdges: GraphEdge[] = useMemo(() => {
    if (!algorithmState) return edges;

    return edges.map((edge) => {
      let state: GraphEdge['state'] = 'unvisited';

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
        algorithmState.closedSet.has(edge.source) ||
        algorithmState.closedSet.has(edge.target)
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
  }, [edges, algorithmState, currentStep]);

  // Control handlers
  const handlePlayPause = useCallback(() => setIsPlaying((prev) => !prev), []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleStepForward = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, algorithmSteps.length - 1));
  }, [algorithmSteps]);

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
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              A* Search Algorithm
            </h2>
            <p className="text-muted-foreground mt-2">
              Optimal pathfinding with heuristic guidance
            </p>
          </div>

          <div className="flex gap-2">
            <Badge
              variant="outline"
              className="bg-purple-500/10 text-purple-700 dark:text-purple-300"
            >
              <Compass className="h-3 w-3 mr-1" />
              Heuristic
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Grid Pathfinding</CardTitle>
            <CardDescription>
              {algorithmState?.finished
                ? algorithmState.path.length > 0
                  ? `Path found in ${algorithmState.path.length} steps!`
                  : 'No path exists'
                : `Step ${currentStep + 1} of ${algorithmSteps.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] rounded-lg border bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
              <UnifiedGraphRenderer
                nodes={visualNodes}
                edges={visualEdges}
                config={{
                  showLabels: false,
                  showEdgeWeights: false,
                  showArrows: false,
                  enablePhysics: false,
                  nodeRadius: 20,
                }}
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
              {/* Scenario */}
              <div className="space-y-2">
                <Label>Scenario</Label>
                <Tabs
                  value={selectedPreset.toString()}
                  onValueChange={(v) => {
                    setSelectedPreset(parseInt(v, 10));
                    handleReset();
                  }}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    {PRESET_SCENARIOS.map((_, i) => (
                      <TabsTrigger key={i} value={i.toString()}>
                        {i + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Heuristic */}
              <div className="space-y-2">
                <Label>Heuristic Function</Label>
                <Select
                  value={heuristicType}
                  onValueChange={(v) => {
                    setHeuristicType(v as HeuristicType);
                    handleReset();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manhattan">Manhattan (L1)</SelectItem>
                    <SelectItem value="euclidean">Euclidean (L2)</SelectItem>
                    <SelectItem value="chebyshev">Chebyshev (L∞)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Playback */}
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

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Speed</Label>
                    <span className="text-sm text-muted-foreground">{speed}ms</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => v !== undefined && setSpeed(v)}
                    min={50}
                    max={1000}
                    step={50}
                  />
                </div>

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

          {/* Stats */}
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
                    <span className="text-sm text-muted-foreground">Open Set</span>
                    <Badge variant="outline">{algorithmState.openSet.size}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Closed Set</span>
                    <Badge variant="outline">{algorithmState.closedSet.size}</Badge>
                  </div>
                  {algorithmState.path.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Path Length</span>
                      <Badge className="bg-green-500/10 text-green-700">
                        {algorithmState.path.length}
                      </Badge>
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
