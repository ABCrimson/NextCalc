'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { DijkstraVisualizer } from '@/components/algorithms/DijkstraVisualizer';
import { Navigation } from 'lucide-react';

/**
 * Dijkstra's Algorithm Page
 *
 * Interactive visualization of Dijkstra's shortest path algorithm.
 * Demonstrates optimal pathfinding in weighted graphs.
 */
export default function DijkstraPage() {
  return (
    <AlgorithmPage
      title="Dijkstra's Shortest Path Algorithm"
      icon={Navigation}
      category="graph-theory"
      difficulty="intermediate"
      timeComplexity="O((V+E) log V)"
      spaceComplexity="O(V)"
      yearIntroduced={1956}
      tags={['graph theory', 'shortest path', 'greedy', 'priority queue']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Graph Theory', href: '/algorithms?category=graph-theory' },
        { label: 'Dijkstra' },
      ]}
      description="Dijkstra's algorithm finds the shortest path between nodes in a weighted graph. It uses a greedy approach with a priority queue to efficiently explore paths, guaranteeing optimal results for graphs with non-negative edge weights."
      applications={[
        'GPS Navigation Systems',
        'Network Routing Protocols',
        'Social Network Analysis',
        'Robot Path Planning',
        'Telecommunication Networks',
        'Flight Route Optimization',
      ]}
      references={[
        {
          title: 'A Note on Two Problems in Connexion with Graphs',
          authors: 'Edsger W. Dijkstra',
          year: 1959,
          url: 'https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm',
        },
        {
          title: 'Introduction to Algorithms (CLRS)',
          authors: 'Cormen, Leiserson, Rivest, Stein',
          year: 2009,
          url: 'https://mitpress.mit.edu/books/introduction-algorithms',
        },
      ]}
    >
      <DijkstraVisualizer />
    </AlgorithmPage>
  );
}
