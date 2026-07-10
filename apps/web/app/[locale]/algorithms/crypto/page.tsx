import { Shield } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { ZKPDemo } from '@/components/algorithms/ZKPDemo';

/**
 * Crypto/Zero-Knowledge Proofs Page
 *
 * This is an alias route to /algorithms/zero-knowledge for easier discovery.
 * Demonstrates zero-knowledge proofs using the Schnorr protocol.
 *
 * Server Component — page-level strings are translated on the server and
 * passed to the client `AlgorithmPage` shell as plain props.
 */
export default async function CryptoPage() {
  const [t, ta] = await Promise.all([
    getTranslations('algorithms.zkp'),
    getTranslations('algorithms'),
  ]);

  return (
    <AlgorithmPage
      title={t('title')}
      icon={<Shield />}
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
