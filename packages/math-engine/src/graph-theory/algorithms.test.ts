/**
 * Comprehensive Tests for Graph Theory Algorithms
 *
 * Test Coverage:
 * - Minimum Spanning Tree (Kruskal, Prim)
 * - Topological Sort (DFS and Kahn)
 * - Strongly Connected Components (Tarjan, Kosaraju)
 * - Graph Coloring
 * - Maximum Flow (Ford-Fulkerson)
 * - Traveling Salesman Problem
 * - Cycle Detection
 * - Edge cases and performance
 *
 * @module graph-theory/algorithms.test
 */

import { describe, it, expect } from 'vitest';
import {
  kruskal,
  prim,
  topologicalSort,
  topologicalSortKahn,
  tarjanSCC,
  kosarajuSCC,
  graphColoring,
  isBipartite,
  maxFlow,
  tsp,
  hasCycleDirected,
  hasCycleUndirected,
  type Graph,
  type MST,
} from './algorithms';

// ============================================================================
// TEST GRAPHS
// ============================================================================

const simpleGraph: Graph = {
  vertices: 4,
  edges: [
    [0, 1, 10],
    [0, 2, 6],
    [0, 3, 5],
    [1, 3, 15],
    [2, 3, 4],
  ],
};

const disconnectedGraph: Graph = {
  vertices: 5,
  edges: [
    [0, 1, 1],
    [2, 3, 1],
  ],
};

const dag: Graph = {
  vertices: 6,
  edges: [
    [5, 2, 1],
    [5, 0, 1],
    [4, 0, 1],
    [4, 1, 1],
    [2, 3, 1],
    [3, 1, 1],
  ],
  directed: true,
};

const cyclicGraph: Graph = {
  vertices: 4,
  edges: [
    [0, 1, 1],
    [1, 2, 1],
    [2, 3, 1],
    [3, 0, 1],
  ],
  directed: true,
};

const stronglyConnectedGraph: Graph = {
  vertices: 5,
  edges: [
    [0, 1, 1],
    [1, 2, 1],
    [2, 0, 1],
    [1, 3, 1],
    [3, 4, 1],
  ],
  directed: true,
};

const bipartiteGraph: Graph = {
  vertices: 4,
  edges: [
    [0, 2, 1],
    [0, 3, 1],
    [1, 2, 1],
    [1, 3, 1],
  ],
};

const flowGraph: Graph = {
  vertices: 6,
  edges: [
    [0, 1, 16],
    [0, 2, 13],
    [1, 2, 10],
    [1, 3, 12],
    [2, 1, 4],
    [2, 4, 14],
    [3, 2, 9],
    [3, 5, 20],
    [4, 3, 7],
    [4, 5, 4],
  ],
  directed: true,
};

const completeGraph: Graph = {
  vertices: 4,
  edges: [
    [0, 1, 10],
    [0, 2, 15],
    [0, 3, 20],
    [1, 2, 35],
    [1, 3, 25],
    [2, 3, 30],
  ],
};

// ============================================================================
// MINIMUM SPANNING TREE TESTS
// ============================================================================

describe('Kruskal Algorithm', () => {
  it('should find MST of simple graph', () => {
    const mst = kruskal(simpleGraph);

    expect(mst.edges.length).toBe(3);
    expect(mst.totalWeight).toBe(19); // 4 + 5 + 10
    expect(mst.isConnected).toBe(true);
  });

  it('should detect disconnected graph', () => {
    const mst = kruskal(disconnectedGraph);

    expect(mst.edges.length).toBeLessThan(disconnectedGraph.vertices - 1);
    expect(mst.isConnected).toBe(false);
  });

  it('should handle single vertex', () => {
    const graph: Graph = { vertices: 1, edges: [] };
    const mst = kruskal(graph);

    expect(mst.edges.length).toBe(0);
    expect(mst.totalWeight).toBe(0);
  });

  it('should handle empty graph', () => {
    const graph: Graph = { vertices: 0, edges: [] };
    const mst = kruskal(graph);

    expect(mst.edges.length).toBe(0);
    expect(mst.isConnected).toBe(false);
  });

  it('should select minimum weight edges', () => {
    const mst = kruskal(simpleGraph);
    const weights = mst.edges.map(e => e[2]);

    // Should include edges with weights 4, 5, 10 (not 6 or 15)
    expect(weights).toContain(4);
    expect(weights).toContain(5);
    expect(weights).toContain(10);
  });

  it('should avoid cycles', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 1],
        [1, 2, 2],
        [2, 0, 3],
      ],
    };

    const mst = kruskal(graph);
    expect(mst.edges.length).toBe(2); // Not 3 (would create cycle)
  });
});

describe('Prim Algorithm', () => {
  it('should find same MST as Kruskal', () => {
    const kruskalMST = kruskal(simpleGraph);
    const primMST = prim(simpleGraph, 0);

    expect(primMST.totalWeight).toBe(kruskalMST.totalWeight);
    expect(primMST.edges.length).toBe(kruskalMST.edges.length);
    expect(primMST.isConnected).toBe(kruskalMST.isConnected);
  });

  it('should work from different start vertices', () => {
    const mst0 = prim(simpleGraph, 0);
    const mst1 = prim(simpleGraph, 1);
    const mst2 = prim(simpleGraph, 2);

    // All should produce same total weight
    expect(mst0.totalWeight).toBe(mst1.totalWeight);
    expect(mst1.totalWeight).toBe(mst2.totalWeight);
  });

  it('should handle invalid start vertex', () => {
    const mst = prim(simpleGraph, 10);
    expect(mst.edges.length).toBe(0);
  });

  it('should detect disconnected graph', () => {
    const mst = prim(disconnectedGraph, 0);
    expect(mst.isConnected).toBe(false);
  });
});

// ============================================================================
// TOPOLOGICAL SORT TESTS
// ============================================================================

describe('Topological Sort (DFS)', () => {
  it('should sort DAG', () => {
    const order = topologicalSort(dag);

    expect(order.length).toBe(dag.vertices);

    // Verify ordering: for each edge u->v, u comes before v
    const position = new Map(order.map((v, i) => [v, i]));

    for (const [u, v] of dag.edges) {
      expect(position.get(u)!).toBeLessThan(position.get(v)!);
    }
  });

  it('should detect cycle', () => {
    expect(() => topologicalSort(cyclicGraph)).toThrow(/cycle/i);
  });

  it('should require directed graph', () => {
    expect(() => topologicalSort(simpleGraph)).toThrow(/directed/i);
  });

  it('should handle single vertex', () => {
    const graph: Graph = { vertices: 1, edges: [], directed: true };
    const order = topologicalSort(graph);

    expect(order).toEqual([0]);
  });

  it('should handle disconnected DAG', () => {
    const graph: Graph = {
      vertices: 4,
      edges: [
        [0, 1, 1],
        [2, 3, 1],
      ],
      directed: true,
    };

    const order = topologicalSort(graph);
    expect(order.length).toBe(4);

    // 0 before 1, 2 before 3
    const pos = new Map(order.map((v, i) => [v, i]));
    expect(pos.get(0)!).toBeLessThan(pos.get(1)!);
    expect(pos.get(2)!).toBeLessThan(pos.get(3)!);
  });
});

describe('Topological Sort (Kahn)', () => {
  it('should produce valid ordering', () => {
    const order = topologicalSortKahn(dag);

    expect(order.length).toBe(dag.vertices);

    const position = new Map(order.map((v, i) => [v, i]));
    for (const [u, v] of dag.edges) {
      expect(position.get(u)!).toBeLessThan(position.get(v)!);
    }
  });

  it('should detect cycle', () => {
    expect(() => topologicalSortKahn(cyclicGraph)).toThrow(/cycle/i);
  });

  it('should match DFS result validity', () => {
    const dfsOrder = topologicalSort(dag);
    const kahnOrder = topologicalSortKahn(dag);

    // Both should be valid (but may differ)
    expect(dfsOrder.length).toBe(kahnOrder.length);
  });
});

// ============================================================================
// STRONGLY CONNECTED COMPONENTS TESTS
// ============================================================================

describe('Tarjan SCC', () => {
  it('should find SCCs', () => {
    const result = tarjanSCC(stronglyConnectedGraph);

    expect(result.count).toBeGreaterThan(0);
    expect(result.components.length).toBe(result.count);

    // Every vertex should be in exactly one component
    const vertexCount = result.components.reduce((sum, c) => sum + c.length, 0);
    expect(vertexCount).toBe(stronglyConnectedGraph.vertices);
  });

  it('should identify single-vertex components', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [[0, 1, 1], [1, 2, 1]],
      directed: true,
    };

    const result = tarjanSCC(graph);
    expect(result.count).toBe(3); // Each vertex is its own SCC
  });

  it('should find strongly connected triangle', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 1],
        [1, 2, 1],
        [2, 0, 1],
      ],
      directed: true,
    };

    const result = tarjanSCC(graph);
    expect(result.count).toBe(1); // All in one SCC
    expect(result.components[0]?.length).toBe(3);
  });

  it('should build component map correctly', () => {
    const result = tarjanSCC(stronglyConnectedGraph);

    for (const [vertex, componentId] of result.componentMap) {
      expect(componentId).toBeGreaterThanOrEqual(0);
      expect(componentId).toBeLessThan(result.count);
      expect(result.components[componentId]).toContain(vertex);
    }
  });
});

describe('Kosaraju SCC', () => {
  it('should find same SCCs as Tarjan', () => {
    const tarjanResult = tarjanSCC(stronglyConnectedGraph);
    const kosarajuResult = kosarajuSCC(stronglyConnectedGraph);

    expect(kosarajuResult.count).toBe(tarjanResult.count);

    // Components may be in different order, but should match
    const tarjanSizes = tarjanResult.components.map(c => c.length).sort();
    const kosarajuSizes = kosarajuResult.components.map(c => c.length).sort();

    expect(kosarajuSizes).toEqual(tarjanSizes);
  });

  it('should handle single SCC', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 1],
        [1, 2, 1],
        [2, 0, 1],
      ],
      directed: true,
    };

    const result = kosarajuSCC(graph);
    expect(result.count).toBe(1);
  });
});

// ============================================================================
// GRAPH COLORING TESTS
// ============================================================================

describe('Graph Coloring', () => {
  it('should color graph', () => {
    const coloring = graphColoring(simpleGraph);

    expect(coloring.size).toBe(simpleGraph.vertices);

    // Check that no two adjacent vertices have same color
    for (const [u, v] of simpleGraph.edges) {
      expect(coloring.get(u)).not.toBe(coloring.get(v));
    }
  });

  it('should use minimum colors for bipartite graph', () => {
    const coloring = graphColoring(bipartiteGraph);

    const numColors = new Set(coloring.values()).size;
    expect(numColors).toBeLessThanOrEqual(2);
  });

  it('should handle complete graph', () => {
    const graph: Graph = {
      vertices: 4,
      edges: [
        [0, 1, 1], [0, 2, 1], [0, 3, 1],
        [1, 2, 1], [1, 3, 1],
        [2, 3, 1],
      ],
    };

    const coloring = graphColoring(graph);
    const numColors = new Set(coloring.values()).size;

    // Complete graph K4 needs 4 colors
    expect(numColors).toBe(4);
  });

  it('should handle empty graph', () => {
    const graph: Graph = { vertices: 3, edges: [] };
    const coloring = graphColoring(graph);

    // All vertices can have same color
    expect(new Set(coloring.values()).size).toBe(1);
  });
});

describe('Bipartite Detection', () => {
  it('should identify bipartite graph', () => {
    expect(isBipartite(bipartiteGraph)).toBe(true);
  });

  it('should detect non-bipartite graph', () => {
    const triangle: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 1],
        [1, 2, 1],
        [2, 0, 1],
      ],
    };

    expect(isBipartite(triangle)).toBe(false);
  });

  it('should handle disconnected graph', () => {
    const graph: Graph = {
      vertices: 6,
      edges: [
        [0, 1, 1], [1, 2, 1], // Bipartite component
        [3, 4, 1], [4, 5, 1], [5, 3, 1], // Triangle (not bipartite)
      ],
    };

    expect(isBipartite(graph)).toBe(false);
  });

  it('should handle tree as bipartite', () => {
    const tree: Graph = {
      vertices: 5,
      edges: [
        [0, 1, 1],
        [0, 2, 1],
        [1, 3, 1],
        [1, 4, 1],
      ],
    };

    expect(isBipartite(tree)).toBe(true);
  });
});

// ============================================================================
// MAXIMUM FLOW TESTS
// ============================================================================

describe('Maximum Flow (Ford-Fulkerson)', () => {
  it('should compute max flow', () => {
    const result = maxFlow(flowGraph, 0, 5);

    expect(result.maxFlow).toBe(23); // Known max flow for this graph
  });

  it('should find min cut', () => {
    const result = maxFlow(flowGraph, 0, 5);

    expect(result.minCut.length).toBeGreaterThan(0);

    // Min cut capacity should equal max flow
    let cutCapacity = 0;
    for (const [u, v] of result.minCut) {
      const edge = flowGraph.edges.find(e => e[0] === u && e[1] === v);
      if (edge) cutCapacity += edge[2];
    }

    expect(cutCapacity).toBe(result.maxFlow);
  });

  it('should handle no path from source to sink', () => {
    const graph: Graph = {
      vertices: 4,
      edges: [
        [0, 1, 10],
        [2, 3, 10],
      ],
      directed: true,
    };

    const result = maxFlow(graph, 0, 3);
    expect(result.maxFlow).toBe(0);
  });

  it('should throw on invalid vertices', () => {
    expect(() => maxFlow(flowGraph, -1, 5)).toThrow(/invalid/i);
    expect(() => maxFlow(flowGraph, 0, 10)).toThrow(/invalid/i);
  });

  it('should throw when source equals sink', () => {
    expect(() => maxFlow(flowGraph, 0, 0)).toThrow(/different/i);
  });

  it('should handle single edge', () => {
    const graph: Graph = {
      vertices: 2,
      edges: [[0, 1, 10]],
      directed: true,
    };

    const result = maxFlow(graph, 0, 1);
    expect(result.maxFlow).toBe(10);
  });
});

// ============================================================================
// TRAVELING SALESMAN PROBLEM TESTS
// ============================================================================

describe('Traveling Salesman Problem', () => {
  it('should find tour visiting all vertices', () => {
    const tour = tsp(completeGraph, 'nearest');

    expect(tour.path.length).toBe(completeGraph.vertices + 1); // +1 for return to start
    expect(tour.path[0]).toBe(tour.path[tour.path.length - 1]); // Returns to start
    expect(tour.distance).toBeGreaterThan(0);
  });

  it('should visit each vertex exactly once', () => {
    const tour = tsp(completeGraph, 'nearest');
    const vertices = tour.path.slice(0, -1); // Exclude return to start

    const uniqueVertices = new Set(vertices);
    expect(uniqueVertices.size).toBe(completeGraph.vertices);
  });

  it('should work with greedy heuristic', () => {
    const tour = tsp(completeGraph, 'greedy');

    expect(tour.path.length).toBeGreaterThan(0);
    expect(tour.heuristic).toBe('greedy');
  });

  it('should handle small graphs', () => {
    const graph: Graph = {
      vertices: 2,
      edges: [[0, 1, 10]],
    };

    const tour = tsp(graph);
    expect(tour.distance).toBeGreaterThanOrEqual(0);
  });

  it('should handle single vertex', () => {
    const graph: Graph = {
      vertices: 1,
      edges: [],
    };

    const tour = tsp(graph);
    expect(tour.path).toEqual([0]);
    expect(tour.distance).toBe(0);
  });
});

// ============================================================================
// CYCLE DETECTION TESTS
// ============================================================================

describe('Cycle Detection', () => {
  it('should detect cycle in directed graph', () => {
    expect(hasCycleDirected(cyclicGraph)).toBe(true);
  });

  it('should detect no cycle in DAG', () => {
    expect(hasCycleDirected(dag)).toBe(false);
  });

  it('should detect self-loop', () => {
    const graph: Graph = {
      vertices: 2,
      edges: [[0, 0, 1]],
      directed: true,
    };

    expect(hasCycleDirected(graph)).toBe(true);
  });

  it('should detect cycle in undirected graph', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 1],
        [1, 2, 1],
        [2, 0, 1],
      ],
    };

    expect(hasCycleUndirected(graph)).toBe(true);
  });

  it('should detect no cycle in tree', () => {
    const tree: Graph = {
      vertices: 4,
      edges: [
        [0, 1, 1],
        [0, 2, 1],
        [1, 3, 1],
      ],
    };

    expect(hasCycleUndirected(tree)).toBe(false);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance Tests', () => {
  it('should handle large graph efficiently - Kruskal', () => {
    const vertices = 1000;
    const edges: Array<readonly [number, number, number]> = [];

    // Generate random connected graph
    for (let i = 0; i < vertices - 1; i++) {
      edges.push([i, i + 1, Math.random()]);
    }

    // Add extra edges
    for (let i = 0; i < 2000; i++) {
      const u = Math.floor(Math.random() * vertices);
      const v = Math.floor(Math.random() * vertices);
      if (u !== v) {
        edges.push([u, v, Math.random()]);
      }
    }

    const graph: Graph = { vertices, edges };

    const start = performance.now();
    const mst = kruskal(graph);
    const duration = performance.now() - start;

    expect(mst.edges.length).toBe(vertices - 1);
    expect(duration).toBeLessThan(500); // Should complete in <500ms
  });

  it('should handle large DAG efficiently - Topological Sort', () => {
    const vertices = 5000;
    const edges: Array<readonly [number, number, number]> = [];

    // Create linear DAG
    for (let i = 0; i < vertices - 1; i++) {
      edges.push([i, i + 1, 1]);
    }

    const graph: Graph = { vertices, edges, directed: true };

    const start = performance.now();
    const order = topologicalSort(graph);
    const duration = performance.now() - start;

    expect(order.length).toBe(vertices);
    expect(duration).toBeLessThan(100);
  });

  it('should handle dense graph efficiently - Prim', () => {
    const vertices = 200;
    const edges: Array<readonly [number, number, number]> = [];

    // Create near-complete graph
    for (let i = 0; i < vertices; i++) {
      for (let j = i + 1; j < Math.min(i + 20, vertices); j++) {
        edges.push([i, j, Math.random()]);
      }
    }

    const graph: Graph = { vertices, edges };

    const start = performance.now();
    const mst = prim(graph);
    const duration = performance.now() - start;

    expect(mst.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle graph with duplicate edges', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 5],
        [0, 1, 3], // Duplicate with different weight
        [1, 2, 4],
      ],
    };

    const mst = kruskal(graph);
    expect(mst.edges.length).toBeLessThanOrEqual(2);
  });

  it('should handle negative weights in MST', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, -1],
        [1, 2, -2],
        [0, 2, 5],
      ],
    };

    const mst = kruskal(graph);
    expect(mst.totalWeight).toBe(-3); // -1 + -2
  });

  it('should handle zero-weight edges', () => {
    const graph: Graph = {
      vertices: 3,
      edges: [
        [0, 1, 0],
        [1, 2, 0],
      ],
    };

    const mst = kruskal(graph);
    expect(mst.totalWeight).toBe(0);
  });

  it('should handle graph with isolated vertex', () => {
    const graph: Graph = {
      vertices: 4,
      edges: [
        [0, 1, 1],
        [1, 2, 1],
      ],
    };

    const mst = kruskal(graph);
    expect(mst.isConnected).toBe(false);
  });
});
