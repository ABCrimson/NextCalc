import type { Metadata } from 'next';
import type { ReactNode } from 'react';

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
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:px-4 focus-visible:py-2 focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:rounded-md"
      >
        Skip to formula library
      </a>
      <main id="formulas-main">{children}</main>
    </div>
  );
}
