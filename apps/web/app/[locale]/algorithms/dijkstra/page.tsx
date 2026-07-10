import { Navigation } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { DijkstraVisualizer } from '@/components/algorithms/DijkstraVisualizer';

/**
 * Dijkstra's Algorithm Page
 *
 * Interactive visualization of Dijkstra's shortest path algorithm.
 * Demonstrates optimal pathfinding in weighted graphs.
 *
 * Server Component — page-level strings are translated on the server and
 * passed to the client `AlgorithmPage` shell as plain props.
 */
export default async function DijkstraPage() {
  const [t, ta] = await Promise.all([
    getTranslations('algorithms.dijkstra'),
    getTranslations('algorithms'),
  ]);

  return (
    <AlgorithmPage
      title={t('title')}
      icon={<Navigation />}
      category="graph-theory"
      difficulty="intermediate"
      timeComplexity="O((V+E) log V)"
      spaceComplexity="O(V)"
      yearIntroduced={1956}
      tags={['graph theory', 'shortest path', 'greedy', 'priority queue']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=graph-theory' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
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
