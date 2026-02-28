import { type ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Formula Library | NextCalc Pro',
  description:
    'Searchable reference library of 60+ mathematical and physics formulas spanning Algebra, Trigonometry, Calculus, Linear Algebra, Statistics, Physics, and Geometry. LaTeX-rendered with copy support.',
  keywords: [
    'formula library',
    'math formulas',
    'algebra',
    'trigonometry',
    'calculus',
    'linear algebra',
    'statistics',
    'physics formulas',
    'geometry',
    'LaTeX',
    'quadratic formula',
    'integration by parts',
  ],
  openGraph: {
    title: 'Formula Library | NextCalc Pro',
    description:
      'Searchable reference library of 60+ mathematical and physics formulas with LaTeX rendering.',
    type: 'website',
  },
};

export default function FormulasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#formulas-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to formula library
      </a>
      <main id="formulas-main">
        {children}
      </main>
    </div>
  );
}
