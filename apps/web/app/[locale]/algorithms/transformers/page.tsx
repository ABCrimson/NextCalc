'use client';

import { Brain } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';

const TransformerVisualizer = dynamic(
  () => import('@/components/algorithms/TransformerVisualizer').then((m) => ({ default: m.TransformerVisualizer })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded-lg w-48" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    ),
  },
);

/**
 * Transformers Algorithm Page
 *
 * Interactive visualization of transformer attention mechanisms.
 * Shows query, key, and value matrix operations in real-time.
 */
export default function TransformersPage() {
  const t = useTranslations('algorithms.transformers');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={Brain}
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
      <TransformerVisualizer showExplanations={true} />
    </AlgorithmPage>
  );
}
