'use client';

import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { QuantumSimulator } from '@/components/algorithms/QuantumSimulator';
import { Atom } from 'lucide-react';

export default function QuantumPage() {
  return (
    <AlgorithmPage
      title="Quantum Circuit Simulation"
      icon={Atom}
      category="quantum"
      difficulty="expert"
      timeComplexity="O(2ⁿ)"
      spaceComplexity="O(2ⁿ)"
      yearIntroduced={1980}
      tags={['quantum', 'qubits', 'superposition', 'entanglement', 'gates']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Quantum Computing', href: '/algorithms?category=quantum' },
        { label: 'Quantum Simulation' },
      ]}
      description="Quantum circuits are the quantum analog of classical logic circuits. They consist of quantum gates applied to qubits, enabling operations that leverage superposition and entanglement. This simulator lets you build and visualize quantum circuits."
      applications={[
        'Quantum Cryptography (QKD)',
        'Quantum Search (Grover\'s Algorithm)',
        'Integer Factorization (Shor\'s Algorithm)',
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
