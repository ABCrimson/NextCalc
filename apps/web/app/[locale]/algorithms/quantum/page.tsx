import { Atom } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { QuantumSimulator } from '@/components/algorithms/QuantumSimulator';

/**
 * Quantum Computing Page
 *
 * Server Component — page-level strings are translated on the server and
 * passed to the client `AlgorithmPage` shell as plain props.
 */
export default async function QuantumPage() {
  const t = await getTranslations('algorithms');

  return (
    <AlgorithmPage
      title={t('quantumTitle')}
      icon={<Atom />}
      category="quantum"
      difficulty="expert"
      timeComplexity="O(2ⁿ)"
      spaceComplexity="O(2ⁿ)"
      yearIntroduced={1980}
      tags={['quantum', 'qubits', 'superposition', 'entanglement', 'gates']}
      breadcrumbs={[
        { label: t('title'), href: '/algorithms' },
        { label: t('quantumBreadcrumbCategory'), href: '/algorithms?category=quantum' },
        { label: t('quantumBreadcrumbCurrent') },
      ]}
      description={t('quantumDescription')}
      applications={[
        'Quantum Cryptography (QKD)',
        "Quantum Search (Grover's Algorithm)",
        "Integer Factorization (Shor's Algorithm)",
        'Quantum Simulation',
        'Quantum Machine Learning',
        'Optimization Problems (QAOA)',
      ]}
      references={[
        {
          title: 'Quantum Computation and Quantum Information',
          authors: 'Nielsen & Chuang',
          year: 2000,
          url: 'http://mmrc.amss.cas.cn/tlb/201702/W020170224608149940643.pdf',
        },
        {
          title: 'Simulating Physics with Computers',
          authors: 'Richard Feynman',
          year: 1982,
          url: 'https://link.springer.com/article/10.1007/BF02650179',
        },
      ]}
    >
      <QuantumSimulator />
    </AlgorithmPage>
  );
}
