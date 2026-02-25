'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { TransformerVisualizer } from '@/components/algorithms/TransformerVisualizer';
import { Brain } from 'lucide-react';

/**
 * Transformers Algorithm Page
 *
 * Interactive visualization of transformer attention mechanisms.
 * Shows query, key, and value matrix operations in real-time.
 */
export default function TransformersPage() {
  return (
    <AlgorithmPage
      title="Transformer Attention"
      icon={Brain}
      category="machine-learning"
      difficulty="intermediate"
      timeComplexity="O(n²d)"
      spaceComplexity="O(n²)"
      yearIntroduced={2017}
      tags={['attention', 'neural networks', 'NLP', 'deep learning']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Machine Learning', href: '/algorithms?category=machine-learning' },
        { label: 'Transformers' },
      ]}
      description="The transformer architecture revolutionized natural language processing and sequence modeling. At its heart is the self-attention mechanism, which allows the model to weigh the importance of different positions in a sequence when processing each element."
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
