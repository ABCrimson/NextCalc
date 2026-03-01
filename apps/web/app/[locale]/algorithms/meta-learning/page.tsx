'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { MetaLearningPlayground } from '@/components/algorithms/MetaLearningPlayground';

export default function MetaLearningPage() {
  const t = useTranslations('algorithms.metaLearning');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={Sparkles}
      category="machine-learning"
      difficulty="advanced"
      timeComplexity="O(kT)"
      spaceComplexity="O(m)"
      yearIntroduced={2017}
      tags={['meta-learning', 'few-shot', 'transfer learning', 'optimization']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=machine-learning' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
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
