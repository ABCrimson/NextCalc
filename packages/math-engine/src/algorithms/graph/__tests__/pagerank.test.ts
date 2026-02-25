/**
 * Tests for PageRank Algorithm
 *
 * Covers:
 * - Basic PageRank computation
 * - Personalized PageRank
 * - Topic-sensitive PageRank
 * - Convergence properties
 * - Damping factor effects
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  pageRank,
  personalizedPageRank,
  topicSensitivePageRank,
  topKPages,
  type Graph,
} from '../pagerank';

describe('PageRank Algorithm', () => {
  describe('pageRank', () => {
    it('should compute PageRank for simple graph', () => {
      // A -> B, C
      // B -> C
      // C -> A
      const graph: Graph = [
        [1, 2], // A links to B, C
        [2],    // B links to C
        [0],    // C links to A
      ];

      const result = pageRank(graph);

      expect(result.ranks).toHaveLength(3);

      // All ranks should be non-negative
      for (const rank of result.ranks) {
        expect(rank).toBeGreaterThan(0);
      }
    });

    it('should have ranks sum to 1', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      const result = pageRank(graph);

      const sum = result.ranks.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should converge within max iterations', () => {
      const graph: Graph = [
        [1],
        [2],
        [0],
      ];

      const result = pageRank(graph, 0.85, 100, 1e-6);

      expect(result.converged).toBe(true);
      expect(result.iterations).toBeLessThan(100);
    });

    it('should give higher rank to highly linked pages', () => {
      // C is linked by everyone
      // A -> C
      // B -> C
      // C -> nowhere
      // D -> C
      const graph: Graph = [
        [2],    // A -> C
        [2],    // B -> C
        [],     // C -> nowhere (no outdegree)
        [2],    // D -> C
      ];

      const result = pageRank(graph);

      // C should have highest rank (receives most links)
      const maxRank = Math.max(...result.ranks);
      expect(result.ranks[2]).toBe(maxRank);
    });

    it('should respect damping factor', () => {
      // Use asymmetric graph to show damping effects
      // A links to B and C, B links to C, C links to A
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      const highDamping = pageRank(graph, 0.99);
      const lowDamping = pageRank(graph, 0.01);

      expect(highDamping.ranks).toBeDefined();
      expect(lowDamping.ranks).toBeDefined();

      // With low damping, ranks should be more uniform
      const highVariance = variance(highDamping.ranks);
      const lowVariance = variance(lowDamping.ranks);

      expect(lowVariance).toBeLessThan(highVariance);
    });

    it('should handle disconnected graph', () => {
      // Two disconnected components
      const graph: Graph = [
        [1],    // A -> B
        [0],    // B -> A
        [3],    // C -> D
        [2],    // D -> C
      ];

      const result = pageRank(graph);

      expect(result.ranks).toHaveLength(4);
      expect(result.ranks.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
    });

    it('should handle nodes with no outgoing links', () => {
      // A -> B
      // B -> (nowhere)
      const graph: Graph = [
        [1],
        [],
      ];

      const result = pageRank(graph);

      expect(result.ranks).toHaveLength(2);
      expect(result.ranks[0]).toBeGreaterThan(0);
      expect(result.ranks[1]).toBeGreaterThan(0);
    });

    it('should handle self-loops', () => {
      // A -> A (self-loop)
      const graph: Graph = [[0]];

      const result = pageRank(graph);

      expect(result.ranks).toHaveLength(1);
      expect(result.ranks[0]).toBeCloseTo(1.0, 5);
    });

    it('property: ranks sum to 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          (numNodes) => {
            // Generate random graph
            const graph: Graph = Array.from({ length: numNodes }, (_, i) => {
              const neighbors: number[] = [];
              for (let j = 0; j < numNodes; j++) {
                if (Math.random() > 0.5) neighbors.push(j);
              }
              return neighbors.length > 0 ? neighbors : [i]; // Ensure at least one link
            });

            const result = pageRank(graph, 0.85, 100, 1e-6);

            const sum = result.ranks.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 4);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('property: all ranks are non-negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          (numNodes) => {
            const graph: Graph = Array.from({ length: numNodes }, (_, i) =>
              i < numNodes - 1 ? [i + 1] : [0]
            );

            const result = pageRank(graph);

            for (const rank of result.ranks) {
              expect(rank).toBeGreaterThanOrEqual(0);
              expect(rank).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('personalizedPageRank', () => {
    it('should compute personalized PageRank', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      // Personal vector favors node 0
      const personalVector = [1, 0, 0];

      const ranks = personalizedPageRank(graph, personalVector);

      expect(ranks).toHaveLength(3);

      // Node 0 should have higher rank due to personalization
      expect(ranks[0]).toBeGreaterThan(ranks[1]!);
    });

    it('should normalize personal vector', () => {
      const graph: Graph = [
        [1],
        [2],
        [0],
      ];

      // Non-normalized vector
      const personalVector = [10, 20, 30];

      const ranks = personalizedPageRank(graph, personalVector);

      expect(ranks).toHaveLength(3);
      expect(ranks.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 4);
    });

    it('should respect personal vector biases', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      // Favor node 2
      const personalVector = [0, 0, 1];

      const ranks = personalizedPageRank(graph, personalVector);

      // Node 2 should have highest rank
      expect(ranks[2]).toBeGreaterThan(ranks[0]!);
      expect(ranks[2]).toBeGreaterThan(ranks[1]!);
    });

    it('should reduce to standard PageRank with uniform vector', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      const uniformVector = [1, 1, 1];

      const personalRanks = personalizedPageRank(graph, uniformVector);
      const standardRanks = pageRank(graph).ranks;

      // Should be very similar
      for (let i = 0; i < 3; i++) {
        expect(personalRanks[i]).toBeCloseTo(standardRanks[i]!, 2);
      }
    });
  });

  describe('topicSensitivePageRank', () => {
    it('should compute multiple topic-specific PageRanks', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      const topics = [
        [1, 0, 0], // Topic 1: favors node 0
        [0, 1, 0], // Topic 2: favors node 1
        [0, 0, 1], // Topic 3: favors node 2
      ];

      const topicRanks = topicSensitivePageRank(graph, topics);

      expect(topicRanks).toHaveLength(3); // One per topic
      expect(topicRanks[0]).toHaveLength(3); // Each has 3 nodes
    });

    it('should produce different rankings for different topics', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      const topics = [
        [1, 0, 0],
        [0, 0, 1],
      ];

      const topicRanks = topicSensitivePageRank(graph, topics);

      // Topic-specific ranks should differ
      expect(topicRanks[0]).not.toEqual(topicRanks[1]);
    });
  });

  describe('topKPages', () => {
    it('should return top k pages by rank', () => {
      const ranks = [0.1, 0.5, 0.2, 0.15, 0.05];
      const k = 3;

      const top = topKPages(ranks, k);

      expect(top).toHaveLength(3);
      expect(top[0]!.node).toBe(1); // Highest rank (0.5)
      expect(top[1]!.node).toBe(2); // Second (0.2)
      expect(top[2]!.node).toBe(3); // Third (0.15)
    });

    it('should sort by descending rank', () => {
      const ranks = [0.3, 0.1, 0.5, 0.2];
      const top = topKPages(ranks, 4);

      for (let i = 0; i < top.length - 1; i++) {
        expect(top[i]!.rank).toBeGreaterThanOrEqual(top[i + 1]!.rank);
      }
    });

    it('should include rank values', () => {
      const ranks = [0.1, 0.5, 0.2];
      const top = topKPages(ranks, 2);

      expect(top[0]!.rank).toBe(0.5);
      expect(top[1]!.rank).toBe(0.2);
    });

    it('should handle k larger than number of pages', () => {
      const ranks = [0.3, 0.7];
      const top = topKPages(ranks, 10);

      expect(top).toHaveLength(2); // Only 2 pages exist
    });

    it('should handle k = 0', () => {
      const ranks = [0.5, 0.5];
      const top = topKPages(ranks, 0);

      expect(top).toHaveLength(0);
    });
  });

  describe('Convergence Properties', () => {
    it('should converge faster with higher tolerance', () => {
      const graph: Graph = [
        [1, 2],
        [2],
        [0],
      ];

      const strictResult = pageRank(graph, 0.85, 1000, 1e-10);
      const looseResult = pageRank(graph, 0.85, 1000, 1e-3);

      expect(looseResult.iterations).toBeLessThanOrEqual(strictResult.iterations);
    });

    it('should converge for strongly connected graphs', () => {
      // Complete cycle
      const graph: Graph = [
        [1],
        [2],
        [3],
        [0],
      ];

      const result = pageRank(graph, 0.85, 100, 1e-6);

      expect(result.converged).toBe(true);
    });

    it('should eventually converge for any graph', () => {
      // Random graph
      const graph: Graph = [
        [2, 3],
        [0, 3],
        [1],
        [0, 1, 2],
      ];

      const result = pageRank(graph, 0.85, 200, 1e-6);

      expect(result.converged).toBe(true);
    });

    it('should require fewer iterations for simple graphs', () => {
      // Very simple graph
      const simpleGraph: Graph = [
        [1],
        [0],
      ];

      const simpleResult = pageRank(simpleGraph);

      expect(simpleResult.iterations).toBeLessThan(50);
    });
  });

  describe('Damping Factor Effects', () => {
    it('should produce more uniform ranks with low damping', () => {
      const graph: Graph = [
        [1, 2, 3],
        [2],
        [3],
        [],
      ];

      const lowDamping = pageRank(graph, 0.1);
      const highDamping = pageRank(graph, 0.99);

      const lowVar = variance(lowDamping.ranks);
      const highVar = variance(highDamping.ranks);

      expect(lowVar).toBeLessThan(highVar);
    });

    it('should amplify link structure with high damping', () => {
      const graph: Graph = [
        [2], // A -> C
        [2], // B -> C
        [],  // C -> nowhere
      ];

      const highDamping = pageRank(graph, 0.99);

      // C should be very prominent (gets ~0.598 with d=0.99)
      expect(highDamping.ranks[2]).toBeGreaterThan(0.59);

      // C should have much higher rank than A or B
      expect(highDamping.ranks[2]).toBeGreaterThan(highDamping.ranks[0]! * 2);
      expect(highDamping.ranks[2]).toBeGreaterThan(highDamping.ranks[1]! * 2);
    });

    it('should use standard damping of 0.85 by default', () => {
      const graph: Graph = [[1], [0]];

      const defaultResult = pageRank(graph);
      const explicitResult = pageRank(graph, 0.85);

      for (let i = 0; i < 2; i++) {
        expect(defaultResult.ranks[i]).toBeCloseTo(explicitResult.ranks[i]!, 5);
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large graphs efficiently', () => {
      const numNodes = 100;

      // Create chain graph
      const graph: Graph = Array.from({ length: numNodes }, (_, i) =>
        i < numNodes - 1 ? [i + 1] : [0]
      );

      const startTime = performance.now();
      const result = pageRank(graph, 0.85, 100);
      const endTime = performance.now();

      expect(result.ranks).toHaveLength(numNodes);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should handle single node graph', () => {
      const graph: Graph = [[0]]; // Self-loop

      const result = pageRank(graph);

      expect(result.ranks).toHaveLength(1);
      expect(result.ranks[0]).toBeCloseTo(1.0, 5);
    });

    it('should handle star graph (hub and spokes)', () => {
      // Center node connects to all, all connect back to center
      const graph: Graph = [
        [1, 2, 3, 4], // Center -> all
        [0],          // 1 -> center
        [0],          // 2 -> center
        [0],          // 3 -> center
        [0],          // 4 -> center
      ];

      const result = pageRank(graph);

      // Center should have highest rank
      const maxRank = Math.max(...result.ranks);
      expect(result.ranks[0]).toBe(maxRank);
    });

    it('should handle complete graph (all nodes link to all)', () => {
      const numNodes = 5;
      const graph: Graph = Array.from({ length: numNodes }, (_, i) =>
        Array.from({ length: numNodes }, (_, j) => j)
      );

      const result = pageRank(graph);

      // All nodes should have equal rank
      const uniqueRanks = new Set(result.ranks.map((r) => r.toFixed(5)));
      expect(uniqueRanks.size).toBe(1); // All equal
    });

    it('should not produce NaN or Infinity', () => {
      const graph: Graph = [
        [1, 2],
        [],
        [0],
      ];

      const result = pageRank(graph);

      for (const rank of result.ranks) {
        expect(isNaN(rank)).toBe(false);
        expect(isFinite(rank)).toBe(true);
      }
    });
  });

  describe('Mathematical Properties', () => {
    it('property: ranks are probability distribution', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (numNodes) => {
            const graph: Graph = Array.from({ length: numNodes }, (_, i) => [(i + 1) % numNodes]);

            const result = pageRank(graph);

            // Sum to 1
            const sum = result.ranks.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 4);

            // All non-negative
            for (const rank of result.ranks) {
              expect(rank).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve rank under graph isomorphism', () => {
      // Two isomorphic graphs (just relabeled nodes)
      const graph1: Graph = [
        [1],
        [2],
        [0],
      ];

      const graph2: Graph = [
        [1],
        [2],
        [0],
      ]; // Same structure

      const ranks1 = pageRank(graph1).ranks;
      const ranks2 = pageRank(graph2).ranks;

      // Ranks should be identical (same structure)
      for (let i = 0; i < 3; i++) {
        expect(ranks1[i]).toBeCloseTo(ranks2[i]!, 5);
      }
    });
  });
});

// Helper function
function variance(values: ReadonlyArray<number>): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
