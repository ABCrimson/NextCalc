import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    template: '%s | Algorithms | NextCalc Pro',
    default: 'Algorithms | NextCalc Pro',
  },
  description:
    'Interactive algorithm visualizations including transformers, zero-knowledge proofs, quantum computing, PageRank, and meta-learning. Learn by exploring.',
  keywords: [
    'algorithms',
    'machine learning',
    'cryptography',
    'quantum computing',
    'graph theory',
    'transformers',
    'attention mechanism',
    'zero-knowledge proofs',
    'quantum circuits',
    'PageRank',
    'meta-learning',
    'MAML',
    'interactive visualization',
    'educational tools',
  ],
  openGraph: {
    title: 'Interactive Algorithm Visualizations | NextCalc Pro',
    description:
      'Explore advanced algorithms through interactive visualizations: transformers, ZKPs, quantum computing, PageRank, and meta-learning.',
    type: 'website',
  },
};

/**
 * Algorithms Section Layout
 *
 * Shared layout for all algorithm visualization pages.
 * Provides consistent structure, metadata, and accessibility features.
 *
 * Accessibility:
 * - Semantic HTML5 structure
 * - Proper heading hierarchy
 * - Skip links for keyboard navigation
 * - ARIA landmarks
 *
 * @param children - Child route components
 */
export default async function AlgorithmsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('algorithms');

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        {t('skipToContent')}
      </a>

      {/* Main content area */}
      <main
        id="main-content"
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}
