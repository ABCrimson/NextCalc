'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { MSTVisualizer } from '@/components/algorithms/MSTVisualizer';
import { GitMerge } from 'lucide-react';

/**
 * Minimum Spanning Tree Page (Kruskal's Algorithm)
 *
 * Interactive visualization of Kruskal's algorithm for finding
 * the minimum spanning tree of a weighted graph.
 */
export default function MSTPage() {
  return (
    <AlgorithmPage
      title="Minimum Spanning Tree (Kruskal's Algorithm)"
      icon={GitMerge}
      category="graph-theory"
      difficulty="intermediate"
      timeComplexity="O(E log E)"
      spaceComplexity="O(V)"
      yearIntroduced={1956}
      tags={['graph theory', 'greedy', 'union-find', 'spanning tree']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Graph Theory', href: '/algorithms?category=graph-theory' },
        { label: 'MST' },
      ]}
      description="Kruskal's algorithm finds a minimum spanning tree (MST) for a weighted undirected graph. It uses a greedy approach: sort edges by weight, then add edges to the MST if they don't create a cycle. Uses the Union-Find data structure for efficient cycle detection."
      applications={[
        'Network Design (minimize cable costs)',
        'Approximation Algorithms for NP-hard problems',
        'Cluster Analysis',
        'Image Segmentation',
        'Taxonomy Construction',
        'Electric Grid Design',
      ]}
      references={[
        {
          title: 'On the Shortest Spanning Subtree of a Graph',
          authors: 'Joseph Kruskal',
          year: 1956,
          url: 'https://www.ams.org/journals/proc/1956-007-01/S0002-9939-1956-0078686-7/',
        },
        {
          title: 'Introduction to Algorithms',
          authors: 'Cormen, Leiserson, Rivest, Stein',
          year: 2009,
          url: 'https://mitpress.mit.edu/books/introduction-algorithms',
        },
      ]}
    >
      <MSTVisualizer />
    </AlgorithmPage>
  );
}
