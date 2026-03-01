'use client';

import { Brain } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { TransformerVisualizer } from '@/components/algorithms/TransformerVisualizer';

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
