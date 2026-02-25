'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { MetaLearningPlayground } from '@/components/algorithms/MetaLearningPlayground';
import { Sparkles } from 'lucide-react';

export default function MetaLearningPage() {
  return (
    <AlgorithmPage
      title="Meta-Learning (MAML)"
      icon={Sparkles}
      category="machine-learning"
      difficulty="advanced"
      timeComplexity="O(kT)"
      spaceComplexity="O(m)"
      yearIntroduced={2017}
      tags={['meta-learning', 'few-shot', 'transfer learning', 'optimization']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Machine Learning', href: '/algorithms?category=machine-learning' },
        { label: 'Meta-Learning' },
      ]}
      description="Model-Agnostic Meta-Learning (MAML) trains models to quickly adapt to new tasks with minimal data. Instead of learning a specific task, MAML learns an initialization that can be rapidly fine-tuned."
      applications={[
        'Few-Shot Image Classification',
        'Rapid Robot Adaptation',
        'Personalized Recommendations',
        'Drug Discovery',
        'Language Model Fine-Tuning',
        'Adaptive Control Systems',
      ]}
      references={[
        {
          title: 'Model-Agnostic Meta-Learning for Fast Adaptation of Deep Networks',
          authors: 'Finn et al.',
          year: 2017,
          url: 'https://arxiv.org/abs/1703.03400',
        },
      ]}
      relatedAlgorithms={[
        {
          title: 'Transformer Attention',
          href: '/algorithms/transformers',
        },
      ]}
    >
      <MetaLearningPlayground />
    </AlgorithmPage>
  );
}
