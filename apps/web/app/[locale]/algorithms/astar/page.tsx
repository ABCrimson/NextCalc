'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { AStarVisualizer } from '@/components/algorithms/AStarVisualizer';
import { Compass } from 'lucide-react';

/**
 * A* Search Algorithm Page
 *
 * Interactive visualization of A* pathfinding with heuristic guidance.
 * Shows how heuristics improve search efficiency.
 */
export default function AStarPage() {
  return (
    <AlgorithmPage
      title="A* Search Algorithm"
      icon={Compass}
      category="graph-theory"
      difficulty="advanced"
      timeComplexity="O(b^d)"
      spaceComplexity="O(b^d)"
      yearIntroduced={1968}
      tags={['graph theory', 'pathfinding', 'heuristic search', 'AI']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Graph Theory', href: '/algorithms?category=graph-theory' },
        { label: 'A* Search' },
      ]}
      description="A* (A-star) is an informed search algorithm that uses heuristics to find optimal paths efficiently. It combines the benefits of Dijkstra's algorithm (guaranteed optimality) with greedy best-first search (speed through heuristics), making it ideal for pathfinding in games and robotics."
      applications={[
        'Video Game Pathfinding',
        'Robot Navigation',
        'Puzzle Solving',
        'Map Applications',
        'AI Planning Systems',
        'Logistics Optimization',
      ]}
      references={[
        {
          title: 'A Formal Basis for the Heuristic Determination of Minimum Cost Paths',
          authors: 'Hart, Nilsson, Raphael',
          year: 1968,
          url: 'https://ieeexplore.ieee.org/document/4082128',
        },
        {
          title: 'Artificial Intelligence: A Modern Approach',
          authors: 'Russell & Norvig',
          year: 2020,
          url: 'http://aima.cs.berkeley.edu/',
        },
      ]}
    >
      <AStarVisualizer />
    </AlgorithmPage>
  );
}
