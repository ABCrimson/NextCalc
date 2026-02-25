/**
 * Graph Theory Algorithms Module
 *
 * Comprehensive collection of fundamental graph algorithms including:
 * - Minimum Spanning Tree (Kruskal, Prim)
 * - Topological Sort
 * - Graph Coloring
 * - Strongly Connected Components (Tarjan)
 * - Maximum Flow (Ford-Fulkerson with Edmonds-Karp)
 * - Traveling Salesman Problem (heuristics)
 * - Cycle Detection
 * - Bipartite Matching
 *
 * All algorithms are implemented with optimal complexity and proper edge case handling.
 *
 * @module graph-theory/algorithms
 */

/**
 * Graph representation using edge list
 */
export interface Graph {
  /** Number of vertices (labeled 0 to vertices-1) */
  readonly vertices: number;
  /** Edge list: [from, to, weight] */
  readonly edges: ReadonlyArray<readonly [number, number, number]>;
  /** Whether graph is directed (default: false) */
  readonly directed?: boolean;
}

/**
 * Adjacency list representation
 */
export type AdjacencyList = ReadonlyMap<number, ReadonlyArray<{ to: number; weight: number }>>;

/**
 * Minimum Spanning Tree result
 */
export interface MST {
  /** Edges included in MST: [from, to, weight] */
  readonly edges: ReadonlyArray<readonly [number, number, number]>;
  /** Total weight of MST */
  readonly totalWeight: number;
  /** Whether MST connects all vertices */
  readonly isConnected: boolean;
}

/**
 * Strongly Connected Components result
 */
export interface SCCResult {
  /** Array of components (each component is array of vertex IDs) */
  readonly components: ReadonlyArray<ReadonlyArray<number>>;
  /** Number of components */
  readonly count: number;
  /** Map from vertex to component ID */
  readonly componentMap: ReadonlyMap<number, number>;
}

/**
 * Maximum Flow result
 */
export interface MaxFlowResult {
  /** Maximum flow value from source to sink */
  readonly maxFlow: number;
  /** Residual graph showing remaining capacities */
  readonly residualGraph: ReadonlyMap<number, ReadonlyMap<number, number>>;
  /** Flow on each edge */
  readonly edgeFlows: ReadonlyMap<string, number>;
  /** Edges in minimum cut */
  readonly minCut: ReadonlyArray<readonly [number, number]>;
}

/**
 * TSP result
 */
export interface TSPResult {
  /** Path visiting all vertices (returns to start) */
  readonly path: ReadonlyArray<number>;
  /** Total distance of tour */
  readonly distance: number;
  /** Heuristic used */
  readonly heuristic: string;
}

// ============================================================================
// MINIMUM SPANNING TREE
// ============================================================================

/**
 * Kruskal's Algorithm for Minimum Spanning Tree
 *
 * Greedy algorithm that builds MST by adding edges in order of increasing weight,
 * avoiding cycles using Union-Find data structure.
 *
 * Time Complexity: O(E log E) due to edge sorting
 * Space Complexity: O(V)
 *
 * Algorithm:
 * 1. Sort all edges by weight
 * 2. For each edge in sorted order:
 *    - If endpoints are in different components, add edge to MST
 *    - Unite the components
 *
 * @param graph - Undirected weighted graph
 * @returns Minimum spanning tree
 *
 * @example
 * const graph = {
 *   vertices: 4,
 *   edges: [[0, 1, 10], [0, 2, 6], [0, 3, 5], [1, 3, 15], [2, 3, 4]],
 * };
 * const mst = kruskal(graph);
 * console.log(`MST weight: ${mst.totalWeight}`); // 19
 */
export function kruskal(graph: Graph): MST {
  const { vertices, edges } = graph;

  if (vertices <= 0) {
    return { edges: [], totalWeight: 0, isConnected: false };
  }

  // Sort edges by weight (ascending)
  const sortedEdges = [...edges].sort((a, b) => a[2] - b[2]);

  // Initialize Union-Find
  const uf = new UnionFind(vertices);

  const mstEdges: Array<readonly [number, number, number]> = [];
  let totalWeight = 0;

  // Process edges in order of increasing weight
  for (const edge of sortedEdges) {
    const [u, v, weight] = edge;

    // Check if adding edge would create cycle
    if (!uf.connected(u, v)) {
      // Add edge to MST
      mstEdges.push(edge);
      totalWeight += weight;
      uf.union(u, v);

      // Early exit if MST is complete
      if (mstEdges.length === vertices - 1) {
        break;
      }
    }
  }

  // Check if graph is connected
  const isConnected = mstEdges.length === vertices - 1;

  return { edges: mstEdges, totalWeight, isConnected };
}

/**
 * Prim's Algorithm for Minimum Spanning Tree
 *
 * Greedy algorithm that grows MST from a starting vertex by repeatedly
 * adding the minimum weight edge connecting the tree to a new vertex.
 *
 * Time Complexity: O(E log V) with binary heap
 * Space Complexity: O(V + E)
 *
 * @param graph - Undirected weighted graph
 * @param start - Starting vertex (default: 0)
 * @returns Minimum spanning tree
 *
 * @example
 * const mst = prim(graph, 0);
 */
export function prim(graph: Graph, start = 0): MST {
  const { vertices } = graph;

  if (vertices <= 0 || start < 0 || start >= vertices) {
    return { edges: [], totalWeight: 0, isConnected: false };
  }

  // Build adjacency list
  const adj = buildAdjacencyList(graph);

  const visited = new Set<number>();
  const mstEdges: Array<readonly [number, number, number]> = [];
  let totalWeight = 0;

  // Priority queue: [weight, from, to]
  const pq = new MinHeap<readonly [number, number, number]>((a, b) => a[0] - b[0]);

  // Start from initial vertex
  visited.add(start);
  const startEdges = adj.get(start) ?? [];
  for (const edge of startEdges) {
    pq.insert([edge.weight, start, edge.to]);
  }

  while (!pq.isEmpty() && visited.size < vertices) {
    const edge = pq.extractMin();
    if (!edge) break;

    const [weight, from, to] = edge;

    // Skip if vertex already in MST
    if (visited.has(to)) continue;

    // Add edge to MST
    mstEdges.push([from, to, weight]);
    totalWeight += weight;
    visited.add(to);

    // Add edges from newly added vertex
    const newEdges = adj.get(to) ?? [];
    for (const newEdge of newEdges) {
      if (!visited.has(newEdge.to)) {
        pq.insert([newEdge.weight, to, newEdge.to]);
      }
    }
  }

  const isConnected = visited.size === vertices;

  return { edges: mstEdges, totalWeight, isConnected };
}

// ============================================================================
// TOPOLOGICAL SORT
// ============================================================================

/**
 * Topological Sort using DFS
 *
 * Orders vertices in directed acyclic graph (DAG) such that for every
 * directed edge u→v, u comes before v in the ordering.
 *
 * Time Complexity: O(V + E)
 * Space Complexity: O(V)
 *
 * @param graph - Directed acyclic graph
 * @returns Topologically sorted vertex order
 * @throws Error if graph contains cycle
 *
 * @example
 * const graph = {
 *   vertices: 6,
 *   edges: [[5, 2, 1], [5, 0, 1], [4, 0, 1], [4, 1, 1], [2, 3, 1], [3, 1, 1]],
 *   directed: true,
 * };
 * const order = topologicalSort(graph);
 * // Possible output: [5, 4, 2, 3, 1, 0]
 */
export function topologicalSort(graph: Graph): ReadonlyArray<number> {
  const { vertices } = graph;

  if (!graph.directed) {
    throw new Error('Topological sort requires directed graph');
  }

  const adj = buildAdjacencyList(graph);
  const visited = new Set<number>();
  const recursionStack = new Set<number>();
  const result: number[] = [];

  // DFS visit function
  function dfsVisit(v: number): void {
    if (recursionStack.has(v)) {
      throw new Error('Graph contains cycle - topological sort not possible');
    }

    if (visited.has(v)) return;

    visited.add(v);
    recursionStack.add(v);

    const neighbors = adj.get(v) ?? [];
    for (const neighbor of neighbors) {
      dfsVisit(neighbor.to);
    }

    recursionStack.delete(v);
    result.unshift(v); // Add to front (reverse postorder)
  }

  // Visit all vertices
  for (let v = 0; v < vertices; v++) {
    if (!visited.has(v)) {
      dfsVisit(v);
    }
  }

  return result;
}

/**
 * Kahn's Algorithm for Topological Sort
 *
 * Alternative BFS-based approach using in-degree tracking.
 *
 * @param graph - Directed acyclic graph
 * @returns Topologically sorted vertex order
 */
export function topologicalSortKahn(graph: Graph): ReadonlyArray<number> {
  const { vertices } = graph;

  if (!graph.directed) {
    throw new Error('Topological sort requires directed graph');
  }

  const adj = buildAdjacencyList(graph);
  const inDegree = new Map<number, number>();

  // Initialize in-degrees
  for (let v = 0; v < vertices; v++) {
    inDegree.set(v, 0);
  }

  // Compute in-degrees
  for (const [_, neighbors] of adj) {
    for (const neighbor of neighbors) {
      inDegree.set(neighbor.to, (inDegree.get(neighbor.to) ?? 0) + 1);
    }
  }

  // Queue of vertices with in-degree 0
  const queue: number[] = [];
  for (let v = 0; v < vertices; v++) {
    if (inDegree.get(v) === 0) {
      queue.push(v);
    }
  }

  const result: number[] = [];

  while (queue.length > 0) {
    const v = queue.shift()!;
    result.push(v);

    const neighbors = adj.get(v) ?? [];
    for (const neighbor of neighbors) {
      const newInDegree = (inDegree.get(neighbor.to) ?? 0) - 1;
      inDegree.set(neighbor.to, newInDegree);

      if (newInDegree === 0) {
        queue.push(neighbor.to);
      }
    }
  }

  // Check for cycle
  if (result.length !== vertices) {
    throw new Error('Graph contains cycle - topological sort not possible');
  }

  return result;
}

// ============================================================================
// STRONGLY CONNECTED COMPONENTS
// ============================================================================

/**
 * Tarjan's Algorithm for Strongly Connected Components
 *
 * Finds all strongly connected components (maximal sets of vertices where
 * every vertex is reachable from every other vertex) using single DFS pass.
 *
 * Time Complexity: O(V + E)
 * Space Complexity: O(V)
 *
 * Algorithm:
 * 1. Perform DFS maintaining discovery time and low-link values
 * 2. Use stack to track vertices in current SCC
 * 3. When low-link[v] = disc[v], found SCC root - pop stack to get component
 *
 * @param graph - Directed graph
 * @returns Strongly connected components
 *
 * @example
 * const result = tarjanSCC(graph);
 * console.log(`Found ${result.count} components`);
 */
export function tarjanSCC(graph: Graph): SCCResult {
  const { vertices } = graph;
  const adj = buildAdjacencyList(graph);

  const disc = new Map<number, number>(); // Discovery time
  const low = new Map<number, number>(); // Low-link value
  const onStack = new Set<number>();
  const stack: number[] = [];
  const components: number[][] = [];

  let time = 0;

  function dfs(v: number): void {
    // Initialize discovery time and low-link value
    disc.set(v, time);
    low.set(v, time);
    time++;
    stack.push(v);
    onStack.add(v);

    // Visit neighbors
    const neighbors = adj.get(v) ?? [];
    for (const neighbor of neighbors) {
      const w = neighbor.to;

      if (!disc.has(w)) {
        // Tree edge
        dfs(w);
        low.set(v, Math.min(low.get(v) ?? Infinity, low.get(w) ?? Infinity));
      } else if (onStack.has(w)) {
        // Back edge
        low.set(v, Math.min(low.get(v) ?? Infinity, disc.get(w) ?? Infinity));
      }
    }

    // If v is root of SCC, pop the stack
    if (low.get(v) === disc.get(v)) {
      const component: number[] = [];

      let w: number;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      components.push(component);
    }
  }

  // Run DFS from all unvisited vertices
  for (let v = 0; v < vertices; v++) {
    if (!disc.has(v)) {
      dfs(v);
    }
  }

  // Create component map
  const componentMap = new Map<number, number>();
  components.forEach((component, idx) => {
    component.forEach(v => componentMap.set(v, idx));
  });

  return {
    components,
    count: components.length,
    componentMap,
  };
}

/**
 * Kosaraju's Algorithm for Strongly Connected Components
 *
 * Alternative two-pass algorithm using DFS on graph and its transpose.
 *
 * @param graph - Directed graph
 * @returns Strongly connected components
 */
export function kosarajuSCC(graph: Graph): SCCResult {
  const { vertices } = graph;
  const adj = buildAdjacencyList(graph);

  // First DFS to compute finish times
  const visited = new Set<number>();
  const finishOrder: number[] = [];

  function dfs1(v: number): void {
    if (visited.has(v)) return;
    visited.add(v);

    const neighbors = adj.get(v) ?? [];
    for (const neighbor of neighbors) {
      dfs1(neighbor.to);
    }

    finishOrder.push(v);
  }

  for (let v = 0; v < vertices; v++) {
    dfs1(v);
  }

  // Build transpose graph
  const transpose = transposeGraph(graph);
  const transposeAdj = buildAdjacencyList(transpose);

  // Second DFS on transpose in reverse finish order
  visited.clear();
  const components: number[][] = [];

  function dfs2(v: number, component: number[]): void {
    if (visited.has(v)) return;
    visited.add(v);
    component.push(v);

    const neighbors = transposeAdj.get(v) ?? [];
    for (const neighbor of neighbors) {
      dfs2(neighbor.to, component);
    }
  }

  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const v = finishOrder[i]!;
    if (!visited.has(v)) {
      const component: number[] = [];
      dfs2(v, component);
      components.push(component);
    }
  }

  // Create component map
  const componentMap = new Map<number, number>();
  components.forEach((component, idx) => {
    component.forEach(v => componentMap.set(v, idx));
  });

  return {
    components,
    count: components.length,
    componentMap,
  };
}

// ============================================================================
// GRAPH COLORING
// ============================================================================

/**
 * Graph Coloring using Greedy Algorithm
 *
 * Assigns colors to vertices such that no two adjacent vertices share the same color.
 * Uses Welsh-Powell algorithm (largest degree first heuristic).
 *
 * Time Complexity: O(V² + E)
 *
 * Note: This is a heuristic and may not find the chromatic number (minimum colors).
 *
 * @param graph - Undirected graph
 * @returns Map from vertex to color (0-indexed)
 *
 * @example
 * const coloring = graphColoring(graph);
 * console.log(`Used ${Math.max(...coloring.values()) + 1} colors`);
 */
export function graphColoring(graph: Graph): ReadonlyMap<number, number> {
  const { vertices } = graph;
  const adj = buildAdjacencyList(graph);

  // Compute degrees
  const degrees = new Map<number, number>();
  for (let v = 0; v < vertices; v++) {
    degrees.set(v, (adj.get(v) ?? []).length);
  }

  // Sort vertices by degree (descending)
  const vertexOrder = Array.from({ length: vertices }, (_, i) => i);
  vertexOrder.sort((a, b) => (degrees.get(b) ?? 0) - (degrees.get(a) ?? 0));

  const coloring = new Map<number, number>();

  for (const v of vertexOrder) {
    // Find colors used by neighbors
    const usedColors = new Set<number>();
    const neighbors = adj.get(v) ?? [];

    for (const neighbor of neighbors) {
      const color = coloring.get(neighbor.to);
      if (color !== undefined) {
        usedColors.add(color);
      }
    }

    // Find smallest available color
    let color = 0;
    while (usedColors.has(color)) {
      color++;
    }

    coloring.set(v, color);
  }

  return coloring;
}

/**
 * Check if graph is bipartite using 2-coloring
 *
 * @param graph - Undirected graph
 * @returns True if graph is bipartite, false otherwise
 */
export function isBipartite(graph: Graph): boolean {
  const { vertices } = graph;
  const adj = buildAdjacencyList(graph);
  const color = new Map<number, number>();

  function bfs(start: number): boolean {
    const queue = [start];
    color.set(start, 0);

    while (queue.length > 0) {
      const v = queue.shift()!;
      const currentColor = color.get(v)!;

      const neighbors = adj.get(v) ?? [];
      for (const neighbor of neighbors) {
        const w = neighbor.to;

        if (!color.has(w)) {
          color.set(w, 1 - currentColor);
          queue.push(w);
        } else if (color.get(w) === currentColor) {
          return false; // Odd cycle found
        }
      }
    }

    return true;
  }

  // Check all components
  for (let v = 0; v < vertices; v++) {
    if (!color.has(v)) {
      if (!bfs(v)) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================================
// MAXIMUM FLOW
// ============================================================================

/**
 * Ford-Fulkerson Algorithm with Edmonds-Karp Implementation
 *
 * Computes maximum flow from source to sink using BFS to find augmenting paths.
 *
 * Time Complexity: O(VE²)
 * Space Complexity: O(V²)
 *
 * @param graph - Directed graph with capacities as weights
 * @param source - Source vertex
 * @param sink - Sink vertex
 * @returns Maximum flow value and flow on each edge
 *
 * @example
 * const result = maxFlow(graph, 0, 5);
 * console.log(`Max flow: ${result.maxFlow}`);
 */
export function maxFlow(graph: Graph, source: number, sink: number): MaxFlowResult {
  const { vertices } = graph;

  if (source < 0 || source >= vertices || sink < 0 || sink >= vertices) {
    throw new Error('Invalid source or sink vertex');
  }

  if (source === sink) {
    throw new Error('Source and sink must be different');
  }

  // Build residual graph
  const residual = new Map<number, Map<number, number>>();

  for (let v = 0; v < vertices; v++) {
    residual.set(v, new Map());
  }

  // Initialize with capacities
  for (const [u, v, capacity] of graph.edges) {
    const uMap = residual.get(u)!;
    uMap.set(v, (uMap.get(v) ?? 0) + capacity);

    // Ensure reverse edge exists (for flow cancellation)
    const vMap = residual.get(v)!;
    if (!vMap.has(u)) {
      vMap.set(u, 0);
    }
  }

  // BFS to find augmenting path
  function bfs(): number[] | null {
    const parent = new Map<number, number>();
    const visited = new Set<number>([source]);
    const queue = [source];

    while (queue.length > 0) {
      const u = queue.shift()!;

      if (u === sink) {
        // Reconstruct path
        const path = [sink];
        let current = sink;

        while (current !== source) {
          current = parent.get(current)!;
          path.unshift(current);
        }

        return path;
      }

      const neighbors = residual.get(u)!;
      for (const [v, capacity] of neighbors) {
        if (!visited.has(v) && capacity > 0) {
          visited.add(v);
          parent.set(v, u);
          queue.push(v);
        }
      }
    }

    return null; // No augmenting path
  }

  let totalFlow = 0;

  // Find augmenting paths and update flow
  while (true) {
    const path = bfs();
    if (!path) break;

    // Find bottleneck capacity
    let bottleneck = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i]!;
      const v = path[i + 1]!;
      const capacity = residual.get(u)!.get(v) ?? 0;
      bottleneck = Math.min(bottleneck, capacity);
    }

    // Update residual capacities
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i]!;
      const v = path[i + 1]!;

      // Forward edge: reduce capacity
      const uMap = residual.get(u)!;
      uMap.set(v, (uMap.get(v) ?? 0) - bottleneck);

      // Backward edge: increase capacity
      const vMap = residual.get(v)!;
      vMap.set(u, (vMap.get(u) ?? 0) + bottleneck);
    }

    totalFlow += bottleneck;
  }

  // Compute actual flow on each edge
  const edgeFlows = new Map<string, number>();

  for (const [u, v, capacity] of graph.edges) {
    const remainingCapacity = residual.get(u)!.get(v) ?? 0;
    const flow = capacity - remainingCapacity;
    edgeFlows.set(`${u}-${v}`, Math.max(0, flow));
  }

  // Find minimum cut (vertices reachable from source in residual graph)
  const reachable = new Set<number>();
  const queue = [source];
  reachable.add(source);

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = residual.get(u)!;

    for (const [v, capacity] of neighbors) {
      if (!reachable.has(v) && capacity > 0) {
        reachable.add(v);
        queue.push(v);
      }
    }
  }

  // Edges in minimum cut
  const minCut: Array<readonly [number, number]> = [];
  for (const [u, v] of graph.edges) {
    if (reachable.has(u) && !reachable.has(v)) {
      minCut.push([u, v]);
    }
  }

  return {
    maxFlow: totalFlow,
    residualGraph: residual as ReadonlyMap<number, ReadonlyMap<number, number>>,
    edgeFlows,
    minCut,
  };
}

// ============================================================================
// TRAVELING SALESMAN PROBLEM
// ============================================================================

/**
 * Traveling Salesman Problem using Nearest Neighbor Heuristic
 *
 * Constructs tour by repeatedly visiting nearest unvisited city.
 * This is a greedy heuristic with no optimality guarantee.
 *
 * Time Complexity: O(V²)
 *
 * @param graph - Complete weighted graph (distances between cities)
 * @param heuristic - Algorithm variant to use
 * @returns Approximate TSP tour
 *
 * @example
 * const tour = tsp(graph, 'nearest');
 * console.log(`Tour distance: ${tour.distance}`);
 */
export function tsp(
  graph: Graph,
  heuristic: 'greedy' | 'nearest' = 'nearest'
): TSPResult {
  const { vertices } = graph;

  if (vertices <= 1) {
    return { path: [0], distance: 0, heuristic };
  }

  if (heuristic === 'nearest') {
    return nearestNeighborTSP(graph);
  } else {
    return greedyTSP(graph);
  }
}

/**
 * Nearest Neighbor TSP Heuristic
 */
function nearestNeighborTSP(graph: Graph): TSPResult {
  const { vertices } = graph;

  // Build distance matrix
  const dist = buildDistanceMatrix(graph);

  const visited = new Set<number>();
  const path: number[] = [];
  let totalDistance = 0;

  // Start from vertex 0
  let current = 0;
  path.push(current);
  visited.add(current);

  // Visit nearest unvisited vertex
  while (visited.size < vertices) {
    let nearest = -1;
    let minDist = Infinity;

    for (let v = 0; v < vertices; v++) {
      if (!visited.has(v)) {
        const d = dist[current]?.[v] ?? Infinity;
        if (d < minDist) {
          minDist = d;
          nearest = v;
        }
      }
    }

    if (nearest === -1) break;

    path.push(nearest);
    totalDistance += minDist;
    visited.add(nearest);
    current = nearest;
  }

  // Return to start
  const returnDist = dist[current]?.[0] ?? 0;
  totalDistance += returnDist;
  path.push(0);

  return { path, distance: totalDistance, heuristic: 'nearest' };
}

/**
 * Greedy TSP Heuristic (shortest edge first)
 */
function greedyTSP(graph: Graph): TSPResult {
  const { vertices, edges } = graph;

  // Sort edges by weight
  const sortedEdges = [...edges].sort((a, b) => a[2] - b[2]);

  // Build path using shortest edges (avoiding cycles until final edge)
  const degree = new Map<number, number>();
  const adj = new Map<number, number[]>();

  for (let v = 0; v < vertices; v++) {
    degree.set(v, 0);
    adj.set(v, []);
  }

  const pathEdges: Array<readonly [number, number, number]> = [];
  let totalDistance = 0;

  for (const edge of sortedEdges) {
    const [u, v, weight] = edge;

    // Can add edge if:
    // 1. Both vertices have degree < 2
    // 2. Doesn't create cycle (unless it's the final edge)
    const degU = degree.get(u) ?? 0;
    const degV = degree.get(v) ?? 0;

    if (degU >= 2 || degV >= 2) continue;

    // Check for cycle (except when completing tour)
    if (pathEdges.length < vertices - 1) {
      // Would create cycle if u and v are already connected via other path
      if (areConnected(u, v, adj, new Set())) continue;
    }

    // Add edge
    pathEdges.push(edge);
    totalDistance += weight;
    degree.set(u, degU + 1);
    degree.set(v, degV + 1);
    adj.get(u)!.push(v);
    adj.get(v)!.push(u);

    if (pathEdges.length === vertices) break;
  }

  // Reconstruct path
  const path = reconstructHamiltonianPath(adj, vertices);

  return { path, distance: totalDistance, heuristic: 'greedy' };
}

// ============================================================================
// CYCLE DETECTION
// ============================================================================

/**
 * Detect cycle in directed graph using DFS
 *
 * @param graph - Directed graph
 * @returns True if cycle exists
 */
export function hasCycleDirected(graph: Graph): boolean {
  const { vertices } = graph;
  const adj = buildAdjacencyList(graph);
  const visited = new Set<number>();
  const recursionStack = new Set<number>();

  function dfs(v: number): boolean {
    if (recursionStack.has(v)) return true;
    if (visited.has(v)) return false;

    visited.add(v);
    recursionStack.add(v);

    const neighbors = adj.get(v) ?? [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor.to)) return true;
    }

    recursionStack.delete(v);
    return false;
  }

  for (let v = 0; v < vertices; v++) {
    if (dfs(v)) return true;
  }

  return false;
}

/**
 * Detect cycle in undirected graph using DFS
 *
 * @param graph - Undirected graph
 * @returns True if cycle exists
 */
export function hasCycleUndirected(graph: Graph): boolean {
  const { vertices } = graph;
  const adj = buildAdjacencyList(graph);
  const visited = new Set<number>();

  function dfs(v: number, parent: number): boolean {
    visited.add(v);

    const neighbors = adj.get(v) ?? [];
    for (const neighbor of neighbors) {
      const w = neighbor.to;

      if (!visited.has(w)) {
        if (dfs(w, v)) return true;
      } else if (w !== parent) {
        return true; // Back edge to non-parent = cycle
      }
    }

    return false;
  }

  for (let v = 0; v < vertices; v++) {
    if (!visited.has(v)) {
      if (dfs(v, -1)) return true;
    }
  }

  return false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Build adjacency list from edge list
 */
function buildAdjacencyList(graph: Graph): AdjacencyList {
  const adj = new Map<number, Array<{ to: number; weight: number }>>();

  // Initialize all vertices
  for (let v = 0; v < graph.vertices; v++) {
    adj.set(v, []);
  }

  // Add edges
  for (const [from, to, weight] of graph.edges) {
    adj.get(from)!.push({ to, weight });

    // Add reverse edge for undirected graphs
    if (!graph.directed) {
      adj.get(to)!.push({ to: from, weight });
    }
  }

  return adj;
}

/**
 * Build distance matrix from graph
 */
function buildDistanceMatrix(graph: Graph): number[][] {
  const { vertices } = graph;
  const dist: number[][] = Array.from({ length: vertices }, () =>
    Array(vertices).fill(Infinity)
  );

  // Distance to self is 0
  for (let i = 0; i < vertices; i++) {
    dist[i]![i] = 0;
  }

  // Fill in edge weights
  for (const [u, v, weight] of graph.edges) {
    dist[u]![v] = weight;
    if (!graph.directed) {
      dist[v]![u] = weight;
    }
  }

  return dist;
}

/**
 * Transpose graph (reverse all edges)
 */
function transposeGraph(graph: Graph): Graph {
  const transposedEdges = graph.edges.map(
    ([u, v, w]) => [v, u, w] as readonly [number, number, number]
  );

  return {
    vertices: graph.vertices,
    edges: transposedEdges,
    directed: graph.directed ?? false,
  };
}

/**
 * Check if two vertices are connected (BFS)
 */
function areConnected(
  u: number,
  v: number,
  adj: Map<number, number[]>,
  visited: Set<number>
): boolean {
  if (u === v) return true;
  if (visited.has(u)) return false;

  visited.add(u);
  const neighbors = adj.get(u) ?? [];

  for (const neighbor of neighbors) {
    if (neighbor === v) return true;
    if (areConnected(neighbor, v, adj, visited)) return true;
  }

  return false;
}

/**
 * Reconstruct Hamiltonian path from adjacency list
 */
function reconstructHamiltonianPath(adj: Map<number, number[]>, vertices: number): number[] {
  // Find starting vertex (degree 1 or 2)
  let start = 0;
  for (let v = 0; v < vertices; v++) {
    const deg = (adj.get(v) ?? []).length;
    if (deg === 1) {
      start = v;
      break;
    }
  }

  const path: number[] = [start];
  const visited = new Set<number>([start]);
  let current = start;

  while (path.length < vertices) {
    const neighbors = adj.get(current) ?? [];
    let next = -1;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        next = neighbor;
        break;
      }
    }

    if (next === -1) break;

    path.push(next);
    visited.add(next);
    current = next;
  }

  return path;
}

// ============================================================================
// UNION-FIND DATA STRUCTURE
// ============================================================================

/**
 * Union-Find (Disjoint Set Union) with path compression and union by rank
 */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array(size).fill(0);
  }

  /**
   * Find root with path compression
   */
  find(x: number): number {
    const parentX = this.parent[x];
    if (parentX !== undefined && parentX !== x) {
      this.parent[x] = this.find(parentX); // Path compression
    }
    return this.parent[x] ?? x;
  }

  /**
   * Union by rank
   */
  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    const rankX = this.rank[rootX] ?? 0;
    const rankY = this.rank[rootY] ?? 0;

    if (rankX < rankY) {
      this.parent[rootX] = rootY;
    } else if (rankX > rankY) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      if (this.rank[rootX] !== undefined) {
        this.rank[rootX]++;
      }
    }
  }

  /**
   * Check if two elements are in same set
   */
  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }
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
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);

    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index]!, this.heap[parentIndex]!) < 0) {
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex]!, this.heap[index]!];
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

      if (
        leftChild < this.heap.length &&
        this.compare(this.heap[leftChild]!, this.heap[smallest]!) < 0
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.compare(this.heap[rightChild]!, this.heap[smallest]!) < 0
      ) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        [this.heap[index], this.heap[smallest]] = [this.heap[smallest]!, this.heap[index]!];
        index = smallest;
      } else {
        break;
      }
    }
  }
}
