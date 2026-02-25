'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { PageRankExplorer } from '@/components/algorithms/PageRankExplorer';
import { Network } from 'lucide-react';

export default function PageRankPage() {
  return (
    <AlgorithmPage
      title="PageRank Algorithm"
      icon={Network}
      category="graph-theory"
      difficulty="intermediate"
      timeComplexity="O(kn)"
      spaceComplexity="O(n²)"
      yearIntroduced={1998}
      tags={['graph theory', 'link analysis', 'eigenvectors', 'markov chains']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Graph Theory', href: '/algorithms?category=graph-theory' },
        { label: 'PageRank' },
      ]}
      description="PageRank is the algorithm that powered Google's early search engine. It assigns importance scores to web pages based on link structure, treating the web as a graph where links are edges. Pages linked by many important pages receive higher scores."
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
