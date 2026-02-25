'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { GraphTraversalVisualizer } from '@/components/algorithms/GraphTraversalVisualizer';
import { GitBranch } from 'lucide-react';

/**
 * Graph Traversal Page (BFS & DFS)
 *
 * Interactive comparison of breadth-first and depth-first search.
 * Educational visualization showing the differences between the two approaches.
 */
export default function GraphTraversalPage() {
  return (
    <AlgorithmPage
      title="Graph Traversal: BFS vs DFS"
      icon={GitBranch}
      category="graph-theory"
      difficulty="beginner"
      timeComplexity="O(V + E)"
      spaceComplexity="O(V)"
      yearIntroduced={1959}
      tags={['graph theory', 'traversal', 'search', 'fundamentals']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Graph Theory', href: '/algorithms?category=graph-theory' },
        { label: 'BFS & DFS' },
      ]}
      description="Graph traversal algorithms systematically visit all vertices in a graph. Breadth-First Search (BFS) explores level by level using a queue, while Depth-First Search (DFS) dives deep using a stack. Both are fundamental to many graph algorithms and have distinct use cases."
      applications={[
        'Web Crawling',
        'Social Network Friend Suggestions',
        'Maze Solving',
        'Topological Sorting',
        'Cycle Detection',
        'Connected Components',
        'Garbage Collection',
        'Dependency Resolution',
      ]}
      references={[
        {
          title: 'Introduction to Algorithms',
          authors: 'Cormen, Leiserson, Rivest, Stein',
          year: 2009,
          url: 'https://mitpress.mit.edu/books/introduction-algorithms',
        },
        {
          title: 'Algorithms',
          authors: 'Sedgewick & Wayne',
          year: 2011,
          url: 'https://algs4.cs.princeton.edu/',
        },
      ]}
    >
      <GraphTraversalVisualizer />
    </AlgorithmPage>
  );
}
