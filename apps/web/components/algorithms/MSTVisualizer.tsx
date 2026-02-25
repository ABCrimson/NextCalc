'use client';

/**
 * Minimum Spanning Tree Visualizer (Kruskal's Algorithm)
 *
 * Interactive visualization of Kruskal's algorithm for finding the
 * minimum spanning tree of a weighted undirected graph.
 *
 * Algorithm Complexity:
 * - Time: O(E log E) due to edge sorting
 * - Space: O(V) for union-find structure
 *
 * @example
 * ```tsx
 * <MSTVisualizer />
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
  type EdgeId,
} from './UnifiedGraphRenderer';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface MSTState {
  sortedEdges: GraphEdge[];
  mstEdges: Set<EdgeId>;
  currentEdge: EdgeId | null;
  rejectedEdges: Set<EdgeId>;
  parent: Map<NodeId, NodeId>;
  rank: Map<NodeId, number>;
  totalWeight: number;
  finished: boolean;
}

interface PresetGraph {
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Union-Find (Disjoint Set) Data Structure
// ============================================================================

class UnionFind {
  parent: Map<NodeId, NodeId>;
  rank: Map<NodeId, number>;

  constructor(nodes: GraphNode[]) {
    this.parent = new Map();
    this.rank = new Map();

    for (const node of nodes) {
      this.parent.set(node.id, node.id);
      this.rank.set(node.id, 0);
    }
  }

  find(x: NodeId): NodeId {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: NodeId, y: NodeId): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) {
      return false; // Already in same set (would create cycle)
    }

    // Union by rank
    const rankX = this.rank.get(rootX) ?? 0;
    const rankY = this.rank.get(rootY) ?? 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }

    return true;
  }

  getState(): { parent: Map<NodeId, NodeId>; rank: Map<NodeId, number> } {
    return {
      parent: new Map(this.parent),
      rank: new Map(this.rank),
    };
  }
}

// ============================================================================
// Preset Graphs
// ============================================================================

const PRESET_GRAPHS: PresetGraph[] = [
  {
    name: 'Simple Network',
    description: '6-node weighted graph',
    nodes: [
      { id: 'A', label: 'A', x: 200, y: 250 },
      { id: 'B', label: 'B', x: 350, y: 150 },
      { id: 'C', label: 'C', x: 500, y: 250 },
      { id: 'D', label: 'D', x: 200, y: 400 },
      { id: 'E', label: 'E', x: 350, y: 500 },
      { id: 'F', label: 'F', x: 500, y: 400 },
    ],
    edges: [
      { id: 'A-B', source: 'A', target: 'B', weight: 4, directed: false },
      { id: 'A-D', source: 'A', target: 'D', weight: 2, directed: false },
      { id: 'B-C', source: 'B', target: 'C', weight: 3, directed: false },
      { id: 'B-D', source: 'B', target: 'D', weight: 5, directed: false },
      { id: 'C-F', source: 'C', target: 'F', weight: 6, directed: false },
      { id: 'D-E', source: 'D', target: 'E', weight: 1, directed: false },
      { id: 'E-F', source: 'E', target: 'F', weight: 7, directed: false },
      { id: 'B-E', source: 'B', target: 'E', weight: 8, directed: false },
    ],
  },
  {
    name: 'Complex Network',
    description: '8-node weighted graph',
    nodes: [
      { id: '0', label: '0', x: 150, y: 200 },
      { id: '1', label: '1', x: 300, y: 150 },
      { id: '2', label: '2', x: 450, y: 200 },
      { id: '3', label: '3', x: 600, y: 150 },
      { id: '4', label: '4', x: 150, y: 400 },
      { id: '5', label: '5', x: 300, y: 450 },
      { id: '6', label: '6', x: 450, y: 400 },
      { id: '7', label: '7', x: 600, y: 450 },
    ],
    edges: [
      { id: '0-1', source: '0', target: '1', weight: 10, directed: false },
      { id: '0-4', source: '0', target: '4', weight: 3, directed: false },
      { id: '1-2', source: '1', target: '2', weight: 5, directed: false },
      { id: '1-5', source: '1', target: '5', weight: 8, directed: false },
      { id: '2-3', source: '2', target: '3', weight: 12, directed: false },
      { id: '2-6', source: '2', target: '6', weight: 7, directed: false },
      { id: '3-7', source: '3', target: '7', weight: 4, directed: false },
      { id: '4-5', source: '4', target: '5', weight: 6, directed: false },
      { id: '5-6', source: '5', target: '6', weight: 2, directed: false },
      { id: '6-7', source: '6', target: '7', weight: 9, directed: false },
      { id: '1-4', source: '1', target: '4', weight: 15, directed: false },
      { id: '2-5', source: '2', target: '5', weight: 11, directed: false },
    ],
  },
  {
    name: 'Dense Graph',
    description: '7-node highly connected graph',
    nodes: [
      { id: 'A', label: 'A', x: 400, y: 100 },
      { id: 'B', label: 'B', x: 250, y: 250 },
      { id: 'C', label: 'C', x: 550, y: 250 },
      { id: 'D', label: 'D', x: 150, y: 450 },
      { id: 'E', label: 'E', x: 400, y: 500 },
      { id: 'F', label: 'F', x: 650, y: 450 },
      { id: 'G', label: 'G', x: 400, y: 300 },
    ],
    edges: [
      { id: 'A-B', source: 'A', target: 'B', weight: 7, directed: false },
      { id: 'A-C', source: 'A', target: 'C', weight: 5, directed: false },
      { id: 'A-G', source: 'A', target: 'G', weight: 2, directed: false },
      { id: 'B-D', source: 'B', target: 'D', weight: 9, directed: false },
      { id: 'B-G', source: 'B', target: 'G', weight: 4, directed: false },
      { id: 'C-F', source: 'C', target: 'F', weight: 6, directed: false },
      { id: 'C-G', source: 'C', target: 'G', weight: 3, directed: false },
      { id: 'D-E', source: 'D', target: 'E', weight: 1, directed: false },
      { id: 'D-G', source: 'D', target: 'G', weight: 10, directed: false },
      { id: 'E-F', source: 'E', target: 'F', weight: 8, directed: false },
      { id: 'E-G', source: 'E', target: 'G', weight: 5, directed: false },
      { id: 'F-G', source: 'F', target: 'G', weight: 2, directed: false },
    ],
  },
];

// ============================================================================
// Kruskal's Algorithm Implementation
// ============================================================================

function* kruskalGenerator(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Generator<MSTState> {
  const uf = new UnionFind(nodes);
  const mstEdges = new Set<EdgeId>();
  const rejectedEdges = new Set<EdgeId>();
  let totalWeight = 0;

  // Sort edges by weight
  const sortedEdges = edges.slice().sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));

  // Process each edge
  for (const edge of sortedEdges) {
    const { parent, rank } = uf.getState();

    // Yield state before processing edge
    yield {
      sortedEdges: [...sortedEdges],
      mstEdges: new Set(mstEdges),
      currentEdge: edge.id,
      rejectedEdges: new Set(rejectedEdges),
      parent,
      rank,
      totalWeight,
      finished: false,
    };

    // Try to add edge to MST
    if (uf.union(edge.source, edge.target)) {
      mstEdges.add(edge.id);
      totalWeight += edge.weight ?? 0;

      // Yield state after accepting edge
      const { parent: newParent, rank: newRank } = uf.getState();
      yield {
        sortedEdges: [...sortedEdges],
        mstEdges: new Set(mstEdges),
        currentEdge: edge.id,
        rejectedEdges: new Set(rejectedEdges),
        parent: newParent,
        rank: newRank,
        totalWeight,
        finished: false,
      };
    } else {
      // Edge would create cycle, reject it
      rejectedEdges.add(edge.id);

      const { parent, rank } = uf.getState();
      yield {
        sortedEdges: [...sortedEdges],
        mstEdges: new Set(mstEdges),
        currentEdge: edge.id,
        rejectedEdges: new Set(rejectedEdges),
        parent,
        rank,
        totalWeight,
        finished: false,
      };
    }

    // Stop if MST is complete (V-1 edges)
    if (mstEdges.size === nodes.length - 1) {
      break;
    }
  }

  // Final state
  const { parent, rank } = uf.getState();
  yield {
    sortedEdges: [...sortedEdges],
    mstEdges: new Set(mstEdges),
    currentEdge: null,
    rejectedEdges: new Set(rejectedEdges),
    parent,
    rank,
    totalWeight,
    finished: true,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function MSTVisualizer() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [currentStep, setCurrentStep] = useState(0);
  const [algorithmState, setAlgorithmState] = useState<MSTState | null>(null);

  const preset = PRESET_GRAPHS[selectedPreset]!;

  // Generate algorithm steps
  const algorithmSteps = useMemo(() => {
    const steps: MSTState[] = [];
    const generator = kruskalGenerator(preset.nodes, preset.edges);

    for (const state of generator) {
      steps.push(state);
    }

    return steps;
  }, [preset]);

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

    // All nodes are part of MST eventually
    return preset.nodes.map((node) => ({
      ...node,
      state: 'visited' as const,
    }));
  }, [preset.nodes, algorithmState]);

  const visualEdges: GraphEdge[] = useMemo(() => {
    if (!algorithmState) return preset.edges;

    return preset.edges.map((edge) => {
      let state: GraphEdge['state'] = 'unvisited';

      if (algorithmState.mstEdges.has(edge.id)) {
        state = 'path'; // Green for MST edges
      } else if (edge.id === algorithmState.currentEdge) {
        state = 'current'; // Yellow for current edge
      } else if (algorithmState.rejectedEdges.has(edge.id)) {
        state = 'visited'; // Purple for rejected edges
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
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              Minimum Spanning Tree (Kruskal's Algorithm)
            </h2>
            <p className="text-muted-foreground mt-2">
              Find the minimum cost subset of edges that connects all nodes
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Zap className="h-3 w-3 mr-1" />
              O(E log E)
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
                ? `MST complete! Total weight: ${algorithmState.totalWeight}`
                : `Step ${currentStep + 1} of ${algorithmSteps.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] rounded-lg border bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
              <UnifiedGraphRenderer
                nodes={visualNodes}
                edges={visualEdges}
                config={{
                  showLabels: true,
                  showEdgeWeights: true,
                  showArrows: false,
                  enablePhysics: false,
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
              {/* Graph Preset */}
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
                    <Label>Speed</Label>
                    <span className="text-sm text-muted-foreground">{speed}ms</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => v !== undefined && setSpeed(v)}
                    min={200}
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
                Algorithm Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {algorithmState && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">MST Edges</span>
                    <Badge variant="outline">{algorithmState.mstEdges.size}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rejected Edges</span>
                    <Badge variant="outline">{algorithmState.rejectedEdges.size}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Weight</span>
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {algorithmState.totalWeight.toFixed(1)}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Edge List */}
                  {algorithmState.sortedEdges.length > 0 && (
                    <div className="space-y-2">
                      <Label>Edges (sorted by weight)</Label>
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        {algorithmState.sortedEdges.map((edge) => {
                          const inMST = algorithmState.mstEdges.has(edge.id);
                          const rejected = algorithmState.rejectedEdges.has(edge.id);
                          const current = algorithmState.currentEdge === edge.id;

                          return (
                            <div
                              key={edge.id}
                              className={cn(
                                'flex items-center justify-between p-2 rounded text-sm',
                                current && 'bg-amber-500/20 ring-2 ring-amber-500',
                                inMST && !current && 'bg-emerald-500/10',
                                rejected && !current && 'bg-purple-500/10 opacity-60'
                              )}
                            >
                              <span className="font-mono">
                                {edge.source} - {edge.target}
                              </span>
                              <Badge variant="outline" className="ml-2">
                                {edge.weight?.toFixed(1)}
                              </Badge>
                            </div>
                          );
                        })}
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
