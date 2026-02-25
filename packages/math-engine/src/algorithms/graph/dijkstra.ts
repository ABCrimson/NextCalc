/**
 * Graph Algorithms: Shortest Paths
 *
 * Implementations of classic shortest path algorithms:
 * - Dijkstra's algorithm (single-source, non-negative weights)
 * - A* search (with heuristic)
 * - Bellman-Ford (handles negative weights)
 * - Floyd-Warshall (all-pairs shortest paths)
 *
 * @module algorithms/graph/dijkstra
 */

/**
 * Graph edge representation
 */
export interface GraphEdge {
  /** Source vertex */
  readonly from: number;
  /** Destination vertex */
  readonly to: number;
  /** Edge weight */
  readonly weight: number;
}

/**
 * Graph representation as adjacency list
 */
export type Graph = ReadonlyMap<number, ReadonlyArray<GraphEdge>>;

/**
 * Path result
 */
export interface PathResult {
  /** Distance from source to each vertex */
  readonly distances: ReadonlyMap<number, number>;
  /** Previous vertex in shortest path */
  readonly previous: ReadonlyMap<number, number | null>;
  /** Reconstructed path from source to target (undefined if no target specified or no path found) */
  readonly path?: ReadonlyArray<number>;
  /** Total path distance (undefined if infinite distance or no target) */
  readonly distance: number | undefined;
}

// ============================================================================
// DIJKSTRA'S ALGORITHM
// ============================================================================

/**
 * Dijkstra's algorithm for single-source shortest paths
 *
 * Finds shortest paths from source to all vertices in weighted graph.
 * Works only with non-negative edge weights.
 *
 * Time Complexity: O((V + E) log V) with binary heap
 * Space Complexity: O(V)
 *
 * @param graph - Adjacency list representation
 * @param source - Source vertex
 * @param target - Optional target vertex (if specified, stops when reached)
 * @returns Distance and previous vertex maps
 *
 * @example
 * const graph = new Map([
 *   [0, [{ from: 0, to: 1, weight: 4 }, { from: 0, to: 2, weight: 1 }]],
 *   [1, [{ from: 1, to: 3, weight: 1 }]],
 *   [2, [{ from: 2, to: 1, weight: 2 }, { from: 2, to: 3, weight: 5 }]],
 *   [3, []],
 * ]);
 * const result = dijkstra(graph, 0, 3);
 * console.log(result.distance); // 4 (path: 0 -> 2 -> 1 -> 3)
 */
export function dijkstra(graph: Graph, source: number, target?: number): PathResult {
  const distances = new Map<number, number>();
  const previous = new Map<number, number | null>();
  const visited = new Set<number>();

  // Initialize distances
  for (const vertex of graph.keys()) {
    distances.set(vertex, Infinity);
    previous.set(vertex, null);
  }
  distances.set(source, 0);

  // Min-heap (priority queue) using array
  const pq = new MinHeap<{ vertex: number; distance: number }>(
    (a, b) => a.distance - b.distance
  );
  pq.insert({ vertex: source, distance: 0 });

  while (!pq.isEmpty()) {
    const current = pq.extractMin();
    if (!current) break;

    const { vertex, distance: dist } = current;

    // Skip if already visited
    if (visited.has(vertex)) continue;
    visited.add(vertex);

    // Early exit if target reached
    if (target !== undefined && vertex === target) break;

    // Relax edges
    const edges = graph.get(vertex) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const newDist = dist + edge.weight;
      const currentDist = distances.get(edge.to) ?? Infinity;

      if (newDist < currentDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, vertex);
        pq.insert({ vertex: edge.to, distance: newDist });
      }
    }
  }

  // Reconstruct path if target specified
  if (target !== undefined) {
    const path = reconstructPath(previous, source, target);
    const targetDistance = distances.get(target);

    return {
      distances,
      previous,
      path,
      distance: targetDistance !== Infinity ? targetDistance : undefined,
    };
  }

  return { distances, previous, distance: undefined };
}

/**
 * A* search algorithm
 *
 * Informed search using heuristic to guide exploration.
 * Guaranteed to find optimal path if heuristic is admissible (never overestimates).
 *
 * Time Complexity: O(E) in worst case, much better with good heuristic
 *
 * @param graph - Adjacency list
 * @param source - Start vertex
 * @param target - Goal vertex
 * @param heuristic - Heuristic function h(v) estimating distance to goal
 * @returns Path and distance
 *
 * @example
 * // Grid graph with Manhattan distance heuristic
 * const result = aStarSearch(
 *   gridGraph,
 *   start,
 *   goal,
 *   (v) => Math.abs(v.x - goal.x) + Math.abs(v.y - goal.y)
 * );
 */
export function aStarSearch(
  graph: Graph,
  source: number,
  target: number,
  heuristic: (vertex: number) => number
): PathResult {
  const distances = new Map<number, number>(); // g(v): actual distance from source
  const fScores = new Map<number, number>(); // f(v) = g(v) + h(v)
  const previous = new Map<number, number | null>();
  const visited = new Set<number>();

  // Initialize
  for (const vertex of graph.keys()) {
    distances.set(vertex, Infinity);
    fScores.set(vertex, Infinity);
    previous.set(vertex, null);
  }
  distances.set(source, 0);
  fScores.set(source, heuristic(source));

  const pq = new MinHeap<{ vertex: number; fScore: number }>(
    (a, b) => a.fScore - b.fScore
  );
  pq.insert({ vertex: source, fScore: fScores.get(source) ?? 0 });

  while (!pq.isEmpty()) {
    const current = pq.extractMin();
    if (!current) break;

    const { vertex } = current;

    if (vertex === target) {
      const path = reconstructPath(previous, source, target);
      const targetDistance = distances.get(target);
      return {
        distances,
        previous,
        path,
        distance: targetDistance !== Infinity ? targetDistance : undefined,
      };
    }

    if (visited.has(vertex)) continue;
    visited.add(vertex);

    const edges = graph.get(vertex) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const newDist = (distances.get(vertex) ?? Infinity) + edge.weight;
      const currentDist = distances.get(edge.to) ?? Infinity;

      if (newDist < currentDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, vertex);
        const fScore = newDist + heuristic(edge.to);
        fScores.set(edge.to, fScore);
        pq.insert({ vertex: edge.to, fScore });
      }
    }
  }

  // No path found
  return { distances, previous, distance: undefined };
}

// ============================================================================
// BELLMAN-FORD ALGORITHM
// ============================================================================

/**
 * Bellman-Ford algorithm for single-source shortest paths
 *
 * Handles negative edge weights and detects negative cycles.
 * Slower than Dijkstra but more general.
 *
 * Time Complexity: O(VE)
 * Space Complexity: O(V)
 *
 * @param graph - Adjacency list
 * @param source - Source vertex
 * @returns Path result with negative cycle detection
 *
 * @example
 * const result = bellmanFord(graph, 0);
 * if (result.hasNegativeCycle) {
 *   console.log('Graph contains negative cycle');
 * }
 */
export function bellmanFord(
  graph: Graph,
  source: number
): PathResult & { readonly hasNegativeCycle: boolean } {
  const vertices = [...graph.keys()];
  const distances = new Map<number, number>();
  const previous = new Map<number, number | null>();

  // Initialize
  for (const vertex of vertices) {
    distances.set(vertex, Infinity);
    previous.set(vertex, null);
  }
  distances.set(source, 0);

  // Relax edges |V| - 1 times
  for (let i = 0; i < vertices.length - 1; i++) {
    for (const vertex of vertices) {
      const edges = graph.get(vertex) ?? [];
      const dist = distances.get(vertex) ?? Infinity;

      for (const edge of edges) {
        const newDist = dist + edge.weight;
        const currentDist = distances.get(edge.to) ?? Infinity;

        if (newDist < currentDist) {
          distances.set(edge.to, newDist);
          previous.set(edge.to, vertex);
        }
      }
    }
  }

  // Check for negative cycles
  let hasNegativeCycle = false;
  for (const vertex of vertices) {
    const edges = graph.get(vertex) ?? [];
    const dist = distances.get(vertex) ?? Infinity;

    for (const edge of edges) {
      const newDist = dist + edge.weight;
      const currentDist = distances.get(edge.to) ?? Infinity;

      if (newDist < currentDist) {
        hasNegativeCycle = true;
        break;
      }
    }
    if (hasNegativeCycle) break;
  }

  return { distances, previous, hasNegativeCycle, distance: undefined };
}

// ============================================================================
// FLOYD-WARSHALL ALGORITHM
// ============================================================================

/**
 * Floyd-Warshall algorithm for all-pairs shortest paths
 *
 * Computes shortest paths between all pairs of vertices.
 * Works with negative weights but not negative cycles.
 *
 * Time Complexity: O(V³)
 * Space Complexity: O(V²)
 *
 * @param graph - Adjacency list or adjacency matrix
 * @param numVertices - Number of vertices
 * @returns Distance matrix and next vertex matrix for path reconstruction
 *
 * @example
 * const result = floydWarshall(graph, 4);
 * console.log(result.distances[0][3]); // Distance from vertex 0 to 3
 * const path = reconstructFloydWarshallPath(result.next, 0, 3);
 */
export function floydWarshall(
  graph: Graph,
  numVertices: number
): {
  readonly distances: ReadonlyArray<ReadonlyArray<number>>;
  readonly next: ReadonlyArray<ReadonlyArray<number | null>>;
} {
  // Initialize distance matrix
  const dist: number[][] = Array.from({ length: numVertices }, (_, i) =>
    Array.from({ length: numVertices }, (_, j) => (i === j ? 0 : Infinity))
  );

  // Initialize next matrix for path reconstruction
  const next: (number | null)[][] = Array.from({ length: numVertices }, () =>
    Array(numVertices).fill(null)
  );

  // Fill in edge weights
  for (const [from, edges] of graph.entries()) {
    const distRow = dist[from];
    const nextRow = next[from];
    if (distRow && nextRow) {
      for (const edge of edges) {
        distRow[edge.to] = edge.weight;
        nextRow[edge.to] = edge.to;
      }
    }
  }

  // Floyd-Warshall main loop
  for (let k = 0; k < numVertices; k++) {
    for (let i = 0; i < numVertices; i++) {
      for (let j = 0; j < numVertices; j++) {
        const distIk = dist[i]?.[k] ?? Infinity;
        const distKj = dist[k]?.[j] ?? Infinity;
        const distIj = dist[i]?.[j] ?? Infinity;

        if (distIk + distKj < distIj) {
          const distRow = dist[i];
          const nextRow = next[i];
          if (distRow && nextRow) {
            distRow[j] = distIk + distKj;
            nextRow[j] = next[i]?.[k] ?? null;
          }
        }
      }
    }
  }

  return { distances: dist, next };
}

/**
 * Reconstructs path from Floyd-Warshall next matrix
 *
 * @param next - Next vertex matrix from Floyd-Warshall
 * @param source - Start vertex
 * @param target - End vertex
 * @returns Path from source to target
 */
export function reconstructFloydWarshallPath(
  next: ReadonlyArray<ReadonlyArray<number | null>>,
  source: number,
  target: number
): ReadonlyArray<number> {
  const nextVal = next[source]?.[target];
  if (nextVal === null || nextVal === undefined) {
    return []; // No path
  }

  const path = [source];
  let current = source;

  while (current !== target) {
    const nextVertex = next[current]?.[target];
    if (nextVertex === null || nextVertex === undefined) break;
    path.push(nextVertex);
    current = nextVertex;
  }

  return path;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Reconstructs path from previous vertex map
 *
 * @param previous - Map of previous vertices
 * @param source - Start vertex
 * @param target - End vertex
 * @returns Path from source to target
 */
function reconstructPath(
  previous: ReadonlyMap<number, number | null>,
  source: number,
  target: number
): ReadonlyArray<number> {
  const path: number[] = [];
  let current: number | null = target;

  while (current !== null && current !== source) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }

  if (current === source) {
    path.unshift(source);
    return path;
  }

  return []; // No path found
}

/**
 * Creates graph from edge list
 *
 * @param edges - Array of edges
 * @param directed - Whether graph is directed
 * @returns Graph adjacency list
 */
export function createGraph(edges: ReadonlyArray<GraphEdge>, directed = true): Graph {
  const graph = new Map<number, GraphEdge[]>();

  for (const edge of edges) {
    if (!graph.has(edge.from)) {
      graph.set(edge.from, []);
    }
    graph.get(edge.from)?.push(edge);

    // Add reverse edge for undirected graph
    if (!directed) {
      if (!graph.has(edge.to)) {
        graph.set(edge.to, []);
      }
      graph.get(edge.to)?.push({ from: edge.to, to: edge.from, weight: edge.weight });
    }
  }

  return graph;
}

// ============================================================================
// MIN-HEAP IMPLEMENTATION
// ============================================================================

/**
 * Binary min-heap for priority queue
 */
class MinHeap<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  insert(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  extractMin(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    const last = this.heap.pop();
    if (last !== undefined && this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      const current = this.heap[index];

      if (parent === undefined || current === undefined) break;

      if (this.compare(current, parent) < 0) {
        [this.heap[index], this.heap[parentIndex]] = [parent, current];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      const current = this.heap[index];
      const left = this.heap[leftChild];
      const right = this.heap[rightChild];

      if (left !== undefined && current !== undefined && this.compare(left, current) < 0) {
        smallest = leftChild;
      }

      const smallestItem = this.heap[smallest];
      if (right !== undefined && smallestItem !== undefined && this.compare(right, smallestItem) < 0) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        const temp = this.heap[index];
        const swap = this.heap[smallest];
        if (temp !== undefined && swap !== undefined) {
          [this.heap[index], this.heap[smallest]] = [swap, temp];
        }
        index = smallest;
      } else {
        break;
      }
    }
  }
}
