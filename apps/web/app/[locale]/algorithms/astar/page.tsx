'use client';

import { Compass } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { AStarVisualizer } from '@/components/algorithms/AStarVisualizer';

/**
 * A* Search Algorithm Page
 *
 * Interactive visualization of A* pathfinding with heuristic guidance.
 * Shows how heuristics improve search efficiency.
 */
export default function AStarPage() {
  const t = useTranslations('algorithms.astar');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={Compass}
      category="graph-theory"
      difficulty="advanced"
      timeComplexity="O(b^d)"
      spaceComplexity="O(b^d)"
      yearIntroduced={1968}
      tags={['graph theory', 'pathfinding', 'heuristic search', 'AI']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=graph-theory' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
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
