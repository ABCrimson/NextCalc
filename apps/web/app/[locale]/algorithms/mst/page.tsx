'use client';

import { GitMerge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { MSTVisualizer } from '@/components/algorithms/MSTVisualizer';

/**
 * Minimum Spanning Tree Page (Kruskal's Algorithm)
 *
 * Interactive visualization of Kruskal's algorithm for finding
 * the minimum spanning tree of a weighted graph.
 */
export default function MSTPage() {
  const t = useTranslations('algorithms.mst');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={GitMerge}
      category="graph-theory"
      difficulty="intermediate"
      timeComplexity="O(E log E)"
      spaceComplexity="O(V)"
      yearIntroduced={1956}
      tags={['graph theory', 'greedy', 'union-find', 'spanning tree']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=graph-theory' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
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
