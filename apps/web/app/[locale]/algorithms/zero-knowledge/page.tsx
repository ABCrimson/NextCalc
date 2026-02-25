'use client';

import { useState } from 'react';
import { AlgorithmPage } from '@/components/algorithms/AlgorithmPage';
import { ZKPDemo } from '@/components/algorithms/ZKPDemo';
import { ZKPComputeVisualizer } from '@/components/algorithms/ZKPComputeVisualizer';
import { Shield, Zap, Cpu } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Glass-morphism card style used across NextCalc chaos/algorithm pages. */
const GLASS_CARD =
  'bg-gradient-to-br from-background/60 via-card/50 to-background/60 ' +
  'backdrop-blur-md border border-border ' +
  'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]';

function ZeroKnowledgeContent() {
  const [activeTab, setActiveTab] = useState<'interactive' | 'gpu'>('interactive');

  return (
    <div className="space-y-6">
      {/* GPU acceleration callout */}
      <div
        className={`${GLASS_CARD} rounded-2xl p-4 flex items-start gap-3`}
        role="note"
        aria-label="GPU acceleration feature note"
      >
        <div className="p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/25 shrink-0">
          <Zap className="w-4 h-4 text-indigo-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            WebGPU Compute Acceleration Available
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            The &ldquo;GPU Acceleration&rdquo; tab runs Schnorr batch verification entirely on the
            GPU using WebGPU compute shaders — parallelising modular exponentiation across
            all rounds simultaneously. Falls back to CPU automatically if unavailable.
          </p>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as 'interactive' | 'gpu')}
      >
        <TabsList
          className="grid w-full grid-cols-2 h-auto p-1 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(10,8,28,0.55) 0%, rgba(18,14,42,0.55) 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(90,70,180,0.25)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.06)',
          }}
        >
          <TabsTrigger
            value="interactive"
            className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
          >
            <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Interactive Protocols
          </TabsTrigger>
          <TabsTrigger
            value="gpu"
            className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
          >
            <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            GPU Acceleration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interactive" className="mt-6">
          <ZKPDemo animationSpeed="normal" />
        </TabsContent>

        <TabsContent value="gpu" className="mt-6">
          <ZKPComputeVisualizer
            roundCount={64}
            injectFailures={true}
          />

          {/* Backend comparison info */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <div
              className={`${GLASS_CARD} rounded-xl p-4`}
              aria-label="GPU backend description"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">
                  WebGPU Compute (Primary)
                </span>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground list-none">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                  WGSL compute shader: <code className="text-emerald-300">batch_verify</code>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                  256 rounds per workgroup dispatch
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                  32-bit mulmod with 16-bit split to avoid WGSL overflow
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                  Square-and-multiply modular exponentiation in WGSL
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                  GPU storage buffer readback via <code className="text-emerald-300">mapAsync</code>
                </li>
              </ul>
            </div>

            <div
              className={`${GLASS_CARD} rounded-xl p-4`}
              aria-label="CPU fallback description"
            >
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">
                  CPU Fallback (TypeScript)
                </span>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground list-none">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                  Pure TypeScript BigInt square-and-multiply
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                  Sequential evaluation — one round at a time
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                  Identical correctness, used for timing comparison
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                  Auto-activated when WebGPU adapter unavailable
                </li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ZeroKnowledgePage() {
  return (
    <AlgorithmPage
      title="Zero-Knowledge Proofs"
      icon={Shield}
      category="cryptography"
      difficulty="advanced"
      timeComplexity="O(1)"
      spaceComplexity="O(1)"
      yearIntroduced={1989}
      tags={['cryptography', 'privacy', 'blockchain', 'Schnorr', 'WebGPU']}
      breadcrumbs={[
        { label: 'Algorithms', href: '/algorithms' },
        { label: 'Cryptography', href: '/algorithms?category=cryptography' },
        { label: 'Zero-Knowledge Proofs' },
      ]}
      description="Zero-knowledge proofs allow one party (the prover) to prove to another party (the verifier) that they know a value, without revealing any information about the value itself. This page includes an interactive step-by-step protocol demo and a WebGPU-accelerated batch verifier that runs modular exponentiation in parallel across all rounds simultaneously."
      applications={[
        'Cryptocurrency Privacy (Zcash, Monero)',
        'Anonymous Authentication',
        'Privacy-Preserving Voting',
        'Confidential Transactions',
        'Identity Verification',
        'Secure Multi-Party Computation',
        'zkRollup Layer-2 Scaling',
        'Verifiable Computation',
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
        {
          title: 'Bulletproofs: Short Proofs for Confidential Transactions and More',
          authors: 'Bunz, Bootle, Boneh, Poelstra, Wuille, Maxwell',
          year: 2018,
          url: 'https://eprint.iacr.org/2017/1066.pdf',
        },
      ]}
      relatedAlgorithms={[
        { title: 'Quantum Computing', href: '/algorithms/quantum' },
        { title: 'Cryptographic Primitives', href: '/algorithms/crypto' },
      ]}
    >
      <ZeroKnowledgeContent />
    </AlgorithmPage>
  );
}
