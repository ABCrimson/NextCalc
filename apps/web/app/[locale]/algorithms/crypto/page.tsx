'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { ZKPDemo } from '@/components/algorithms/ZKPDemo';
import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Crypto/Zero-Knowledge Proofs Page
 *
 * This is an alias route to /algorithms/zero-knowledge for easier discovery.
 * Demonstrates zero-knowledge proofs using the Schnorr protocol.
 */
export default function CryptoPage() {
  const t = useTranslations('algorithms.zkp');
  const ta = useTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('title')}
      icon={Shield}
      category="cryptography"
      difficulty="advanced"
      timeComplexity="O(1)"
      spaceComplexity="O(1)"
      yearIntroduced={1989}
      tags={['cryptography', 'privacy', 'blockchain', 'Schnorr']}
      breadcrumbs={[
        { label: ta('title'), href: '/algorithms' },
        { label: t('breadcrumbCategory'), href: '/algorithms?category=cryptography' },
        { label: t('breadcrumbCurrent') },
      ]}
      description={t('description')}
      applications={[
        'Cryptocurrency Privacy (Zcash, Monero)',
        'Anonymous Authentication',
        'Privacy-Preserving Voting',
        'Confidential Transactions',
        'Identity Verification',
        'Secure Multi-Party Computation',
      ]}
      references={[
        {
          title: 'The Knowledge Complexity of Interactive Proof Systems',
          authors: 'Goldwasser, Micali, Rackoff',
          year: 1989,
          url: 'https://people.csail.mit.edu/silvio/Selected%20Scientific%20Papers/Proof%20Systems/The_Knowledge_Complexity_Of_Interactive_Proof_Systems.pdf',
        },
        {
          title: 'Efficient Signature Generation by Smart Cards',
          authors: 'C.P. Schnorr',
          year: 1991,
          url: 'https://link.springer.com/article/10.1007/BF00196725',
        },
      ]}
    >
      <ZKPDemo animationSpeed="normal" />
    </AlgorithmPage>
  );
}
