/**
 * PageRank Algorithm
 *
 * Ranks web pages (or nodes in a graph) based on their link structure.
 * Core algorithm behind Google's original search engine.
 *
 * Algorithm by Larry Page and Sergey Brin, 1996
 *
 * Time Complexity: O(iterations × edges)
 * Space Complexity: O(nodes)
 */

/**
 * Graph represented as adjacency list
 */
export type Graph = ReadonlyArray<ReadonlyArray<number>>;

/**
 * PageRank result
 */
export interface PageRankResult {
  /** PageRank score for each node */
  readonly ranks: ReadonlyArray<number>;
  /** Number of iterations performed */
  readonly iterations: number;
  /** Whether algorithm converged */
  readonly converged: boolean;
}

/**
 * PageRank Algorithm
 *
 * PR(u) = (1-d)/N + d × Σ(PR(v) / outdegree(v))
 *
 * Where:
 * - PR(u) = PageRank of page u
 * - d = damping factor (typically 0.85)
 * - N = total number of pages
 * - Sum is over all pages v that link to u
 *
 * @param graph - Adjacency list (graph[i] = list of nodes that i links to)
 * @param dampingFactor - Probability of following a link (default: 0.85)
 * @param maxIterations - Maximum iterations
 * @param tolerance - Convergence threshold
 * @returns PageRank scores
 */
export function pageRank(
  graph: Graph,
  dampingFactor = 0.85,
  maxIterations = 100,
  tolerance = 1e-6,
): PageRankResult {
  const n = graph.length;

  // Initialize ranks uniformly
  let ranks = new Float64Array(n).fill(1 / n);
  let newRanks = new Float64Array(n);

  // Compute outdegrees
  const outdegrees = graph.map((neighbors) => neighbors.length);

  let converged = false;
  let iter = 0;

  for (iter = 0; iter < maxIterations; iter++) {
    // Calculate dangling node contribution (nodes with no outlinks)
    let danglingSum = 0;
    for (let j = 0; j < n; j++) {
      if (outdegrees[j] === 0) {
        danglingSum += ranks[j]!;
      }
    }

    // Compute new ranks
    for (let i = 0; i < n; i++) {
      let sum = 0;

      // Sum contributions from all nodes linking to i
      for (let j = 0; j < n; j++) {
        if (graph[j]!.includes(i) && outdegrees[j]! > 0) {
          sum += ranks[j]! / outdegrees[j]!;
        }
      }

      // Add base rank + link contributions + dangling node distribution
      newRanks[i] = (1 - dampingFactor) / n + dampingFactor * (sum + danglingSum / n);
    }

    // Check convergence
    const diff = ranks.reduce((acc, r, i) => acc + Math.abs(r - newRanks[i]!), 0);

    if (diff < tolerance) {
      converged = true;
      // Use the newly computed ranks, not the old ones
      ranks = newRanks;
      break;
    }

    // Swap arrays
    [ranks, newRanks] = [newRanks, ranks];
  }

  return {
    ranks: Array.from(ranks),
    iterations: iter,
    converged,
  };
}

/**
 * Personalized PageRank
 *
 * Biased random walk that restarts at specific nodes.
 * Used for recommendation systems.
 *
 * @param graph - Adjacency list
 * @param personalVector - Probability of restarting at each node
 * @param dampingFactor - Damping factor
 * @returns Personalized PageRank scores
 */
export function personalizedPageRank(
  graph: Graph,
  personalVector: ReadonlyArray<number>,
  dampingFactor = 0.85,
  maxIterations = 100,
): ReadonlyArray<number> {
  const n = graph.length;

  // Normalize personal vector
  const sum = personalVector.reduce((a, b) => a + b, 0);
  const normalized = personalVector.map((v) => v / sum);

  let ranks = [...normalized];
  let newRanks = new Array<number>(n).fill(0);

  const outdegrees = graph.map((neighbors) => neighbors.length);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Calculate dangling node contribution
    let danglingSum = 0;
    for (let j = 0; j < n; j++) {
      if (outdegrees[j] === 0) {
        danglingSum += ranks[j]!;
      }
    }

    for (let i = 0; i < n; i++) {
      let linkSum = 0;

      for (let j = 0; j < n; j++) {
        if (graph[j]!.includes(i) && outdegrees[j]! > 0) {
          linkSum += ranks[j]! / outdegrees[j]!;
        }
      }

      // Distribute dangling nodes according to personal vector
      newRanks[i] =
        (1 - dampingFactor) * normalized[i]! +
        dampingFactor * (linkSum + danglingSum * normalized[i]!);
    }

    [ranks, newRanks] = [newRanks, ranks];
  }

  return ranks;
}

/**
 * Topic-Sensitive PageRank
 *
 * Compute multiple PageRank vectors for different topics.
 */
export function topicSensitivePageRank(
  graph: Graph,
  topics: ReadonlyArray<ReadonlyArray<number>>,
  dampingFactor = 0.85,
): ReadonlyArray<ReadonlyArray<number>> {
  return topics.map((topic) => personalizedPageRank(graph, topic, dampingFactor));
}

/**
 * Find top-k pages by PageRank
 */
export function topKPages(
  ranks: ReadonlyArray<number>,
  k: number,
): ReadonlyArray<{
  node: number;
  rank: number;
}> {
  const indexed = ranks.map((rank, node) => ({ node, rank }));
  indexed.sort((a, b) => b.rank - a.rank);
  return indexed.slice(0, k);
}

/**
 * Demonstrate PageRank on a simple web graph
 */
export function demonstratePageRank(): void {
  console.log('=== PageRank Demo ===\n');

  // Simple web graph:
  // A -> B, C
  // B -> C
  // C -> A
  // D -> C
  const graph: Graph = [
    [1, 2], // A links to B, C
    [2], // B links to C
    [0], // C links to A
    [2], // D links to C
  ];

  const nodes = ['A', 'B', 'C', 'D'];

  console.log('Graph structure:');
  for (let i = 0; i < graph.length; i++) {
    const links = graph[i]!.map((j) => nodes[j]).join(', ');
    console.log(`  ${nodes[i]} -> ${links || '(none)'}`);
  }

  const result = pageRank(graph);

  console.log(`\nPageRank scores (after ${result.iterations} iterations):`);
  const ranked = topKPages(result.ranks, 4);

  for (const { node, rank } of ranked) {
    console.log(`  ${nodes[node]}: ${rank.toFixed(4)}`);
  }

  console.log(`\nConverged: ${result.converged ? 'Yes' : 'No'}`);
  console.log('\nNote: C has highest rank because it receives links from A, B, and D');
}
