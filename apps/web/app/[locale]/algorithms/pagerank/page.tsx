'use client';

import { Network } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { PageRankExplorer } from '@/components/algorithms/PageRankExplorer';

export default function PageRankPage() {
  const t = useTranslations('algorithms.pagerank');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={Network}
      category="graph-theory"
      difficulty="intermediate"
      timeComplexity="O(kn)"
      spaceComplexity="O(n²)"
      yearIntroduced={1998}
      tags={['graph theory', 'link analysis', 'eigenvectors', 'markov chains']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=graph-theory' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
      applications={[
        'Web Search Ranking (Google)',
        'Social Network Analysis',
        'Citation Analysis',
        'Recommendation Systems',
        'Traffic Flow Analysis',
        'Protein Interaction Networks',
      ]}
      references={[
        {
          title: 'The PageRank Citation Ranking: Bringing Order to the Web',
          authors: 'Page, Brin, Motwani, Winograd',
          year: 1998,
          url: 'http://ilpubs.stanford.edu:8090/422/1/1999-66.pdf',
        },
        {
          title: 'The Anatomy of a Large-Scale Hypertextual Web Search Engine',
          authors: 'Brin & Page',
          year: 1998,
          url: 'http://infolab.stanford.edu/~backrub/google.html',
        },
      ]}
    >
      <PageRankExplorer />
    </AlgorithmPage>
  );
}
