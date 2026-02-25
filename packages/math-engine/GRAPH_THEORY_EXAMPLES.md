# Graph Theory Algorithms - Usage Examples

## Table of Contents
1. [Minimum Spanning Tree](#minimum-spanning-tree)
2. [Topological Sort](#topological-sort)
3. [Strongly Connected Components](#strongly-connected-components)
4. [Graph Coloring](#graph-coloring)
5. [Maximum Flow](#maximum-flow)
6. [Traveling Salesman Problem](#traveling-salesman-problem)
7. [Cycle Detection](#cycle-detection)
8. [Real-World Applications](#real-world-applications)

## Minimum Spanning Tree

### Kruskal's Algorithm

```typescript
import { kruskal, type Graph } from '@nextcalc/math-engine/graph-theory';

// Network design: Connect cities with minimum cable
const networkGraph: Graph = {
  vertices: 5,
  edges: [
    [0, 1, 10], // City A to B: 10 km
    [0, 2, 6],  // City A to C: 6 km
    [0, 3, 5],  // City A to D: 5 km
    [1, 3, 15], // City B to D: 15 km
    [2, 3, 4],  // City C to D: 4 km
    [1, 4, 8],  // City B to E: 8 km
    [3, 4, 12], // City D to E: 12 km
  ],
};

const mst = kruskal(networkGraph);

console.log('Minimum Spanning Tree:');
console.log(`Total cable needed: ${mst.totalWeight} km`);
console.log(`Connections:`);
mst.edges.forEach(([from, to, weight]) => {
  console.log(`  City ${from} to City ${to}: ${weight} km`);
});
console.log(`Network is fully connected: ${mst.isConnected}`);

// Output:
// Total cable needed: 27 km
// Connections:
//   City 2 to City 3: 4 km
//   City 0 to City 3: 5 km
//   City 0 to City 2: 6 km
//   City 1 to City 4: 8 km
```

### Prim's Algorithm

```typescript
import { prim } from '@nextcalc/math-engine/graph-theory';

// Start from different vertices
const mst1 = prim(networkGraph, 0); // Start from City A
const mst2 = prim(networkGraph, 4); // Start from City E

console.log(`MST from City 0: ${mst1.totalWeight} km`);
console.log(`MST from City 4: ${mst2.totalWeight} km`);
// Both should give same total weight (27 km)
```

### Detecting Disconnected Graphs

```typescript
import { kruskal } from '@nextcalc/math-engine/graph-theory';

const disconnectedGraph: Graph = {
  vertices: 6,
  edges: [
    [0, 1, 1], // Component 1
    [1, 2, 2],
    [3, 4, 3], // Component 2 (isolated)
  ],
};

const mst = kruskal(disconnectedGraph);

if (!mst.isConnected) {
  console.log('Warning: Graph has disconnected components!');
  console.log(`Spanning forest weight: ${mst.totalWeight}`);
  console.log(`Connected ${mst.edges.length + 1} out of ${disconnectedGraph.vertices} vertices`);
}
```

## Topological Sort

### Task Scheduling

```typescript
import { topologicalSort, type Graph } from '@nextcalc/math-engine/graph-theory';

// Build project: tasks with dependencies
const buildGraph: Graph = {
  vertices: 6,
  edges: [
    [5, 2, 1], // Task 5 must complete before Task 2
    [5, 0, 1],
    [4, 0, 1],
    [4, 1, 1],
    [2, 3, 1],
    [3, 1, 1],
  ],
  directed: true,
};

const order = topologicalSort(buildGraph);

const taskNames = [
  'Link binaries',
  'Run tests',
  'Compile core',
  'Compile utils',
  'Install deps',
  'Clean build',
];

console.log('Build order:');
order.forEach((task, i) => {
  console.log(`${i + 1}. ${taskNames[task]}`);
});

// Output:
// Build order:
// 1. Clean build
// 2. Install deps
// 3. Compile core
// 4. Compile utils
// 5. Run tests
// 6. Link binaries
```

### Cycle Detection in Dependencies

```typescript
import { topologicalSort } from '@nextcalc/math-engine/graph-theory';

const cyclicGraph: Graph = {
  vertices: 3,
  edges: [
    [0, 1, 1], // A depends on B
    [1, 2, 1], // B depends on C
    [2, 0, 1], // C depends on A (circular!)
  ],
  directed: true,
};

try {
  topologicalSort(cyclicGraph);
} catch (error) {
  console.error('Cannot build: Circular dependency detected!');
  // Find and resolve the cycle
}
```

### Kahn's Algorithm (Alternative)

```typescript
import { topologicalSortKahn } from '@nextcalc/math-engine/graph-theory';

// Same result, different algorithm
const order = topologicalSortKahn(buildGraph);
console.log('Topological order:', order);
```

## Strongly Connected Components

### Finding Components with Tarjan

```typescript
import { tarjanSCC, type Graph } from '@nextcalc/math-engine/graph-theory';

// Social network: who can reach whom
const socialGraph: Graph = {
  vertices: 8,
  edges: [
    [0, 1, 1],
    [1, 2, 1],
    [2, 0, 1], // Component 1: {0, 1, 2}
    [3, 4, 1],
    [4, 5, 1],
    [5, 3, 1], // Component 2: {3, 4, 5}
    [2, 3, 1], // Bridge between components
    [6, 7, 1], // Component 3: {6} and {7} (separate)
  ],
  directed: true,
};

const sccs = tarjanSCC(socialGraph);

console.log(`Found ${sccs.count} strongly connected components:`);
sccs.components.forEach((component, i) => {
  console.log(`Component ${i + 1}: Users [${component.join(', ')}]`);
});

// Check component membership
const user = 1;
const componentId = sccs.componentMap.get(user);
console.log(`User ${user} is in component ${componentId}`);
```

### Kosaraju's Algorithm

```typescript
import { kosarajuSCC } from '@nextcalc/math-engine/graph-theory';

const sccs = kosarajuSCC(socialGraph);
// Same components, possibly different order
console.log(`Components: ${sccs.count}`);
```

### Analyzing Network Connectivity

```typescript
import { tarjanSCC } from '@nextcalc/math-engine/graph-theory';

function analyzeNetworkResilience(graph: Graph) {
  const sccs = tarjanSCC(graph);

  // Single SCC = highly connected
  // Many SCCs = fragile network
  const resilience = 1 - (sccs.count - 1) / graph.vertices;

  console.log(`Network resilience score: ${(resilience * 100).toFixed(1)}%`);

  if (sccs.count === 1) {
    console.log('Network is strongly connected - very resilient');
  } else if (sccs.count === graph.vertices) {
    console.log('Network is acyclic - not resilient');
  } else {
    console.log('Network has multiple components - moderately resilient');
  }

  return { sccs, resilience };
}
```

## Graph Coloring

### Map Coloring

```typescript
import { graphColoring, type Graph } from '@nextcalc/math-engine/graph-theory';

// Color US states so no adjacent states share color
const usStatesGraph: Graph = {
  vertices: 5, // Simplified: CA, NV, AZ, OR, UT
  edges: [
    [0, 1, 1], // CA-NV
    [0, 2, 1], // CA-AZ
    [0, 3, 1], // CA-OR
    [1, 2, 1], // NV-AZ
    [1, 4, 1], // NV-UT
    [2, 4, 1], // AZ-UT
  ],
};

const coloring = graphColoring(usStatesGraph);

const stateNames = ['California', 'Nevada', 'Arizona', 'Oregon', 'Utah'];
const colorNames = ['Red', 'Blue', 'Green', 'Yellow'];

console.log('Map coloring:');
stateNames.forEach((state, i) => {
  const color = colorNames[coloring.get(i) ?? 0];
  console.log(`${state}: ${color}`);
});

const numColors = new Set(coloring.values()).size;
console.log(`\nUsed ${numColors} colors`);
```

### Resource Allocation

```typescript
import { graphColoring } from '@nextcalc/math-engine/graph-theory';

// Schedule exams: conflicting students can't take exams simultaneously
const examGraph: Graph = {
  vertices: 6, // 6 exams
  edges: [
    [0, 1, 1], // Exam 0 and 1 have common students
    [0, 2, 1],
    [1, 3, 1],
    [2, 3, 1],
    [3, 4, 1],
    [4, 5, 1],
  ],
};

const schedule = graphColoring(examGraph);
const timeSlots = new Set(schedule.values()).size;

console.log(`Minimum time slots needed: ${timeSlots}`);

// Group exams by time slot
const slots: number[][] = Array.from({ length: timeSlots }, () => []);
schedule.forEach((slot, exam) => {
  slots[slot]?.push(exam);
});

slots.forEach((exams, slot) => {
  console.log(`Time slot ${slot + 1}: Exams [${exams.join(', ')}]`);
});
```

### Bipartite Graph Detection

```typescript
import { isBipartite } from '@nextcalc/math-engine/graph-theory';

// Check if graph can be 2-colored
const graph: Graph = {
  vertices: 4,
  edges: [
    [0, 2, 1],
    [0, 3, 1],
    [1, 2, 1],
    [1, 3, 1],
  ],
};

if (isBipartite(graph)) {
  console.log('Graph is bipartite (can use 2 colors)');
  // E.g., job matching problem: workers to jobs
} else {
  console.log('Graph is not bipartite (needs 3+ colors)');
}
```

## Maximum Flow

### Network Flow Problem

```typescript
import { maxFlow, type Graph } from '@nextcalc/math-engine/graph-theory';

// Water distribution network
const waterNetwork: Graph = {
  vertices: 6,
  edges: [
    [0, 1, 16], // Source to pump 1: capacity 16
    [0, 2, 13], // Source to pump 2: capacity 13
    [1, 2, 10],
    [1, 3, 12],
    [2, 1, 4],
    [2, 4, 14],
    [3, 2, 9],
    [3, 5, 20], // Pump 3 to sink
    [4, 3, 7],
    [4, 5, 4],  // Pump 4 to sink
  ],
  directed: true,
};

const result = maxFlow(waterNetwork, 0, 5);

console.log(`Maximum flow from source to sink: ${result.maxFlow}`);
console.log(`\nFlow on each edge:`);

result.edgeFlows.forEach((flow, edge) => {
  const [from, to] = edge.split('-').map(Number);
  if (flow > 0) {
    console.log(`  ${from} -> ${to}: ${flow} units`);
  }
});

console.log(`\nMinimum cut edges:`);
result.minCut.forEach(([u, v]) => {
  console.log(`  ${u} -> ${v}`);
});
```

### Bipartite Matching

```typescript
import { maxFlow } from '@nextcalc/math-engine/graph-theory';

// Job assignment: match workers to jobs
function solveJobAssignment(
  workers: number,
  jobs: number,
  canDo: Array<[number, number]> // [worker, job] pairs
) {
  // Build flow network
  const source = 0;
  const sink = workers + jobs + 1;

  const edges: Array<[number, number, number]> = [];

  // Source to workers (capacity 1)
  for (let w = 1; w <= workers; w++) {
    edges.push([source, w, 1]);
  }

  // Workers to jobs (capacity 1)
  canDo.forEach(([worker, job]) => {
    edges.push([worker, workers + job, 1]);
  });

  // Jobs to sink (capacity 1)
  for (let j = 1; j <= jobs; j++) {
    edges.push([workers + j, sink, 1]);
  }

  const graph: Graph = {
    vertices: workers + jobs + 2,
    edges,
    directed: true,
  };

  const result = maxFlow(graph, source, sink);

  console.log(`Maximum matching: ${result.maxFlow} jobs assigned`);

  // Extract assignment
  const assignments: Array<[number, number]> = [];
  result.edgeFlows.forEach((flow, edge) => {
    if (flow > 0) {
      const [from, to] = edge.split('-').map(Number);
      if (from > 0 && from <= workers && to > workers && to < sink) {
        assignments.push([from, to - workers]);
      }
    }
  });

  return assignments;
}

// Example
const assignments = solveJobAssignment(
  3, // 3 workers
  3, // 3 jobs
  [[1, 1], [1, 2], [2, 2], [2, 3], [3, 1], [3, 3]]
);

console.log('Job assignments:');
assignments.forEach(([worker, job]) => {
  console.log(`  Worker ${worker} -> Job ${job}`);
});
```

## Traveling Salesman Problem

### Nearest Neighbor Heuristic

```typescript
import { tsp, type Graph } from '@nextcalc/math-engine/graph-theory';

// Delivery route optimization
const cityGraph: Graph = {
  vertices: 5,
  edges: [
    // Complete graph: all pairwise distances
    [0, 1, 10], [0, 2, 15], [0, 3, 20], [0, 4, 25],
    [1, 2, 35], [1, 3, 25], [1, 4, 30],
    [2, 3, 30], [2, 4, 10],
    [3, 4, 15],
  ],
};

const tour = tsp(cityGraph, 'nearest');

console.log(`Tour: ${tour.path.join(' -> ')}`);
console.log(`Total distance: ${tour.distance} km`);
console.log(`Heuristic used: ${tour.heuristic}`);

// Output:
// Tour: 0 -> 1 -> 2 -> 4 -> 3 -> 0
// Total distance: 95 km
```

### Comparing Heuristics

```typescript
import { tsp } from '@nextcalc/math-engine/graph-theory';

const nearestTour = tsp(cityGraph, 'nearest');
const greedyTour = tsp(cityGraph, 'greedy');

console.log('Comparison:');
console.log(`Nearest Neighbor: ${nearestTour.distance} km`);
console.log(`Greedy: ${greedyTour.distance} km`);

const better = nearestTour.distance < greedyTour.distance ? 'Nearest Neighbor' : 'Greedy';
console.log(`Better heuristic: ${better}`);
```

### Delivery Route Optimization

```typescript
import { tsp } from '@nextcalc/math-engine/graph-theory';

function optimizeDeliveryRoute(
  locations: Array<{ lat: number; lon: number }>,
  depot: number
) {
  // Build distance matrix using Haversine formula
  const n = locations.length;
  const edges: Array<[number, number, number]> = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = haversineDistance(locations[i]!, locations[j]!);
      edges.push([i, j, dist]);
    }
  }

  const graph: Graph = { vertices: n, edges };
  const tour = tsp(graph);

  // Rotate tour to start from depot
  const depotIdx = tour.path.indexOf(depot);
  const rotatedPath = [
    ...tour.path.slice(depotIdx, -1),
    ...tour.path.slice(0, depotIdx),
    depot,
  ];

  return {
    path: rotatedPath,
    distance: tour.distance,
    locations: rotatedPath.map(i => locations[i]!),
  };
}

function haversineDistance(
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number }
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
    Math.cos((p2.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

## Cycle Detection

### Deadlock Detection

```typescript
import { hasCycleDirected, type Graph } from '@nextcalc/math-engine/graph-theory';

// Resource allocation graph
const resourceGraph: Graph = {
  vertices: 4, // Processes
  edges: [
    [0, 1, 1], // Process 0 waiting for resource held by Process 1
    [1, 2, 1],
    [2, 3, 1],
    [3, 0, 1], // Circular wait!
  ],
  directed: true,
};

if (hasCycleDirected(resourceGraph)) {
  console.log('DEADLOCK DETECTED!');
  console.log('Processes are in circular wait.');
  // Implement deadlock resolution strategy
} else {
  console.log('No deadlock - system can proceed');
}
```

### Undirected Graph Cycles

```typescript
import { hasCycleUndirected } from '@nextcalc/math-engine/graph-theory';

const network: Graph = {
  vertices: 4,
  edges: [
    [0, 1, 1],
    [1, 2, 1],
    [2, 3, 1],
    [3, 0, 1], // Creates cycle
  ],
};

if (hasCycleUndirected(network)) {
  console.log('Network has redundant paths (good for reliability!)');
} else {
  console.log('Network is a tree (no redundancy)');
}
```

## Real-World Applications

### Network Reliability Analysis

```typescript
import { kruskal, tarjanSCC, isBipartite } from '@nextcalc/math-engine/graph-theory';

function analyzeNetwork(graph: Graph) {
  // Minimum backbone
  const backbone = kruskal(graph);

  // Connectivity analysis
  const sccs = tarjanSCC({
    ...graph,
    directed: true,
  });

  // Structure analysis
  const bipartite = isBipartite(graph);

  return {
    minimalCost: backbone.totalWeight,
    isConnected: backbone.isConnected,
    strongComponents: sccs.count,
    isBipartite: bipartite,
    redundancy: graph.edges.length - backbone.edges.length,
  };
}

const analysis = analyzeNetwork(networkGraph);
console.log('Network Analysis:');
console.log(`Minimal connection cost: ${analysis.minimalCost}`);
console.log(`Redundant connections: ${analysis.redundancy}`);
console.log(`Strongly connected components: ${analysis.strongComponents}`);
```

### Compiler Dependency Resolution

```typescript
import { topologicalSort } from '@nextcalc/math-engine/graph-theory';

interface Module {
  name: string;
  dependencies: string[];
}

function compileOrder(modules: Module[]): string[] {
  const nameToId = new Map(modules.map((m, i) => [m.name, i]));

  const edges: Array<[number, number, number]> = [];
  modules.forEach((mod, i) => {
    mod.dependencies.forEach(dep => {
      const depId = nameToId.get(dep);
      if (depId !== undefined) {
        edges.push([depId, i, 1]); // Dependency -> Module
      }
    });
  });

  const graph: Graph = {
    vertices: modules.length,
    edges,
    directed: true,
  };

  try {
    const order = topologicalSort(graph);
    return order.map(id => modules[id]!.name);
  } catch {
    throw new Error('Circular dependency detected in modules');
  }
}

const modules: Module[] = [
  { name: 'utils', dependencies: [] },
  { name: 'core', dependencies: ['utils'] },
  { name: 'api', dependencies: ['core', 'utils'] },
  { name: 'ui', dependencies: ['api', 'core'] },
];

const order = compileOrder(modules);
console.log('Compilation order:', order.join(' -> '));
```

## Performance Benchmarks

```typescript
import { kruskal, prim, tarjanSCC } from '@nextcalc/math-engine/graph-theory';

function benchmarkGraphAlgorithms() {
  const sizes = [100, 500, 1000, 5000];

  console.log('Graph Algorithm Performance:');
  console.log('Size\tKruskal\tPrim\tTarjan');

  sizes.forEach(n => {
    // Generate random graph
    const edges: Array<[number, number, number]> = [];
    for (let i = 0; i < n * 3; i++) {
      const u = Math.floor(Math.random() * n);
      const v = Math.floor(Math.random() * n);
      if (u !== v) edges.push([u, v, Math.random()]);
    }

    const graph: Graph = { vertices: n, edges };

    // Benchmark Kruskal
    const kStart = performance.now();
    kruskal(graph);
    const kTime = performance.now() - kStart;

    // Benchmark Prim
    const pStart = performance.now();
    prim(graph);
    const pTime = performance.now() - pStart;

    // Benchmark Tarjan
    const tStart = performance.now();
    tarjanSCC({ ...graph, directed: true });
    const tTime = performance.now() - tStart;

    console.log(`${n}\t${kTime.toFixed(1)}\t${pTime.toFixed(1)}\t${tTime.toFixed(1)}`);
  });
}

benchmarkGraphAlgorithms();
```
