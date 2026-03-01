/**
 * Graph Theory Algorithms Performance Benchmarks
 *
 * Run with: tsx benchmarks/graph-theory.ts
 */

import {
  type Graph,
  graphColoring,
  kruskal,
  maxFlow,
  prim,
  tarjanSCC,
  topologicalSort,
} from '../src/graph-theory/algorithms';

console.log('='.repeat(70));
console.log('GRAPH THEORY ALGORITHMS PERFORMANCE BENCHMARKS');
console.log('='.repeat(70));

// Helper: Generate random graph
function generateRandomGraph(vertices: number, edges: number, directed = false): Graph {
  const edgeList: Array<[number, number, number]> = [];
  const edgeSet = new Set<string>();

  while (edgeList.length < edges) {
    const u = Math.floor(Math.random() * vertices);
    const v = Math.floor(Math.random() * vertices);

    if (u !== v) {
      const key = `${u}-${v}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edgeList.push([u, v, Math.random()]);
      }
    }
  }

  return { vertices, edges: edgeList, directed };
}

// Benchmark 1: Minimum Spanning Tree
console.log('\n1. Minimum Spanning Tree Performance (Kruskal vs Prim)\n');
console.log('Vertices\tEdges\t\tKruskal (ms)\tPrim (ms)');
console.log('-'.repeat(70));

const mstSizes = [
  { v: 100, e: 300 },
  { v: 500, e: 1500 },
  { v: 1000, e: 3000 },
  { v: 5000, e: 15000 },
];

mstSizes.forEach(({ v, e }) => {
  const graph = generateRandomGraph(v, e);

  const kStart = performance.now();
  kruskal(graph);
  const kTime = performance.now() - kStart;

  const pStart = performance.now();
  prim(graph);
  const pTime = performance.now() - pStart;

  console.log(`${v}\t\t${e}\t\t${kTime.toFixed(2)}\t\t${pTime.toFixed(2)}`);
});

// Benchmark 2: Topological Sort
console.log('\n2. Topological Sort Performance (DAG)\n');
console.log('Vertices\tEdges\t\tTime (ms)');
console.log('-'.repeat(50));

const topSizes = [
  { v: 1000, e: 2000 },
  { v: 5000, e: 10000 },
  { v: 10000, e: 20000 },
  { v: 50000, e: 100000 },
];

topSizes.forEach(({ v, e }) => {
  // Generate DAG (forward edges only)
  const edgeList: Array<[number, number, number]> = [];
  for (let i = 0; i < e; i++) {
    const u = Math.floor(Math.random() * (v - 1));
    const vx = u + 1 + Math.floor(Math.random() * (v - u - 1));
    edgeList.push([u, vx, 1]);
  }

  const graph: Graph = { vertices: v, edges: edgeList, directed: true };

  const start = performance.now();
  topologicalSort(graph);
  const time = performance.now() - start;

  console.log(`${v}\t\t${e}\t\t${time.toFixed(2)}`);
});

// Benchmark 3: Strongly Connected Components
console.log('\n3. Strongly Connected Components (Tarjan)\n');
console.log('Vertices\tEdges\t\tTime (ms)\tComponents');
console.log('-'.repeat(60));

const sccSizes = [
  { v: 500, e: 1500 },
  { v: 1000, e: 3000 },
  { v: 5000, e: 15000 },
  { v: 10000, e: 30000 },
];

sccSizes.forEach(({ v, e }) => {
  const graph = generateRandomGraph(v, e, true);

  const start = performance.now();
  const result = tarjanSCC(graph);
  const time = performance.now() - start;

  console.log(`${v}\t\t${e}\t\t${time.toFixed(2)}\t\t${result.count}`);
});

// Benchmark 4: Graph Coloring
console.log('\n4. Graph Coloring Performance\n');
console.log('Vertices\tEdges\t\tTime (ms)\tColors Used');
console.log('-'.repeat(60));

const colorSizes = [
  { v: 100, e: 300 },
  { v: 500, e: 1500 },
  { v: 1000, e: 3000 },
  { v: 5000, e: 15000 },
];

colorSizes.forEach(({ v, e }) => {
  const graph = generateRandomGraph(v, e);

  const start = performance.now();
  const coloring = graphColoring(graph);
  const time = performance.now() - start;

  const numColors = new Set(coloring.values()).size;

  console.log(`${v}\t\t${e}\t\t${time.toFixed(2)}\t\t${numColors}`);
});

// Benchmark 5: Maximum Flow
console.log('\n5. Maximum Flow Performance (Ford-Fulkerson/Edmonds-Karp)\n');
console.log('Vertices\tEdges\t\tTime (ms)\tMax Flow');
console.log('-'.repeat(60));

const flowSizes = [
  { v: 20, e: 50 },
  { v: 50, e: 150 },
  { v: 100, e: 300 },
  { v: 200, e: 600 },
];

flowSizes.forEach(({ v, e }) => {
  const graph = generateRandomGraph(v, e, true);

  // Modify edge weights to be integers (capacities)
  const capacityGraph: Graph = {
    ...graph,
    edges: graph.edges.map(
      ([u, vx, _]) => [u, vx, Math.floor(Math.random() * 100) + 1] as [number, number, number],
    ),
  };

  const source = 0;
  const sink = v - 1;

  const start = performance.now();
  const result = maxFlow(capacityGraph, source, sink);
  const time = performance.now() - start;

  console.log(`${v}\t\t${e}\t\t${time.toFixed(2)}\t\t${result.maxFlow}`);
});

// Benchmark 6: Scalability Test
console.log('\n6. Scalability Analysis (Linear Growth Test)\n');
console.log('Algorithm\t\tN=100\t\tN=200\t\tN=400\t\tN=800');
console.log('-'.repeat(70));

const scaleFactors = [100, 200, 400, 800];

// Kruskal scalability
const kruskalTimes: number[] = [];
scaleFactors.forEach((n) => {
  const graph = generateRandomGraph(n, n * 3);
  const start = performance.now();
  kruskal(graph);
  kruskalTimes.push(performance.now() - start);
});
console.log(`Kruskal\t\t\t${kruskalTimes.map((t) => t.toFixed(2)).join('\t\t')}`);

// Tarjan scalability
const tarjanTimes: number[] = [];
scaleFactors.forEach((n) => {
  const graph = generateRandomGraph(n, n * 3, true);
  const start = performance.now();
  tarjanSCC(graph);
  tarjanTimes.push(performance.now() - start);
});
console.log(`Tarjan SCC\t\t${tarjanTimes.map((t) => t.toFixed(2)).join('\t\t')}`);

console.log('\n' + '='.repeat(70));
console.log('BENCHMARKS COMPLETE');
console.log('='.repeat(70));

// Print complexity verification
console.log('\nComplexity Verification:');
console.log(
  '- Kruskal doubling ratio:',
  (kruskalTimes[3]! / kruskalTimes[2]!).toFixed(2),
  '(expected: ~2.0 for O(E log E))',
);
console.log(
  '- Tarjan doubling ratio:',
  (tarjanTimes[3]! / tarjanTimes[2]!).toFixed(2),
  '(expected: ~2.0 for O(V+E))',
);
