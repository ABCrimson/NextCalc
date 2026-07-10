import { Brain } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { TransformerVisualizerLazy } from './transformer-visualizer-lazy';

/**
 * Transformers Algorithm Page
 *
 * Interactive visualization of transformer attention mechanisms.
 * Shows query, key, and value matrix operations in real-time.
 *
 * Server Component — page-level strings are translated on the server and
 * passed to the client `AlgorithmPage` shell as plain props. The visualizer
 * is client-side lazy-loaded via `transformer-visualizer-lazy.tsx`.
 */
export default async function TransformersPage() {
  const [t, ta] = await Promise.all([
    getTranslations('algorithms.transformers'),
    getTranslations('algorithms'),
  ]);

  return (
    <AlgorithmPage
      title={t('title')}
      icon={<Brain />}
      category="machine-learning"
      difficulty="intermediate"
      timeComplexity="O(n²d)"
      spaceComplexity="O(n²)"
      yearIntroduced={2017}
      tags={['attention', 'neural networks', 'NLP', 'deep learning']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=machine-learning' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
      applications={[
        'Natural Language Processing (GPT, BERT, T5)',
        'Machine Translation (Google Translate)',
        'Text Summarization',
        'Question Answering',
        'Image Processing (Vision Transformers)',
        'Protein Folding (AlphaFold)',
      ]}
      references={[
        {
          title: 'Attention Is All You Need',
          authors: 'Vaswani et al.',
          year: 2017,
          url: 'https://arxiv.org/abs/1706.03762',
        },
        {
          title: 'The Illustrated Transformer',
          authors: 'Jay Alammar',
          url: 'http://jalammar.github.io/illustrated-transformer/',
        },
      ]}
      relatedAlgorithms={[
        {
          title: 'Meta-Learning (MAML)',
          href: '/algorithms/meta-learning',
        },
      ]}
    >
      <TransformerVisualizerLazy showExplanations={true} />
    </AlgorithmPage>
  );
}
