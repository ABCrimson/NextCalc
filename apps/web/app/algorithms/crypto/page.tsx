'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { ZKPDemo } from '@/components/algorithms/ZKPDemo';
import { Shield } from 'lucide-react';

/**
 * Crypto/Zero-Knowledge Proofs Page
 *
 * This is an alias route to /algorithms/zero-knowledge for easier discovery.
 * Demonstrates zero-knowledge proofs using the Schnorr protocol.
 */
export default function CryptoPage() {
  return (
    <AlgorithmPage
      title="Zero-Knowledge Proofs"
      icon={Shield}
      category="cryptography"
      difficulty="advanced"
      timeComplexity="O(1)"
      spaceComplexity="O(1)"
      yearIntroduced={1989}
      tags={['cryptography', 'privacy', 'blockchain', 'Schnorr']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Cryptography', href: '/algorithms?category=cryptography' },
        { label: 'Zero-Knowledge Proofs' },
      ]}
      description="Zero-knowledge proofs allow one party (the prover) to prove to another party (the verifier) that they know a value, without revealing any information about the value itself. This powerful cryptographic primitive enables privacy-preserving authentication and verification."
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
