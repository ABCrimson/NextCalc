import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { AStarVisualizer } from '@/components/algorithms/AStarVisualizer';

/**
 * A* Search Algorithm Page
 *
 * Interactive visualization of A* pathfinding with heuristic guidance.
 * Shows how heuristics improve search efficiency.
 *
 * Server Component — page-level strings are translated on the server and
 * passed to the client `AlgorithmPage` shell as plain props.
 */
export default async function AStarPage() {
  const [t, ta] = await Promise.all([
    getTranslations('algorithms.astar'),
    getTranslations('algorithms'),
  ]);

  return (
    <AlgorithmPage
      title={t('title')}
      icon={<Compass />}
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
