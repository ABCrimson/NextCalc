import { Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { MetaLearningPlayground } from '@/components/algorithms/MetaLearningPlayground';

/**
 * Meta-Learning (MAML) Page
 *
 * Server Component — page-level strings are translated on the server and
 * passed to the client `AlgorithmPage` shell as plain props.
 */
export default async function MetaLearningPage() {
  const [t, ta] = await Promise.all([
    getTranslations('algorithms.metaLearning'),
    getTranslations('algorithms'),
  ]);

  return (
    <AlgorithmPage
      title={t('title')}
      icon={<Sparkles />}
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
