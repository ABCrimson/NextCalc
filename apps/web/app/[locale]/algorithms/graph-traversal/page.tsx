'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { GraphTraversalVisualizer } from '@/components/algorithms/GraphTraversalVisualizer';
import { GitBranch } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Graph Traversal Page (BFS & DFS)
 *
 * Interactive comparison of breadth-first and depth-first search.
 * Educational visualization showing the differences between the two approaches.
 */
export default function GraphTraversalPage() {
  const t = useTranslations('algorithms.graphTraversal');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={GitBranch}
      category="graph-theory"
      difficulty="beginner"
      timeComplexity="O(V + E)"
      spaceComplexity="O(V)"
      yearIntroduced={1959}
      tags={['graph theory', 'traversal', 'search', 'fundamentals']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=graph-theory' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
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
