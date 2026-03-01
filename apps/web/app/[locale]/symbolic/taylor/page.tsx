import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TaylorSeriesVisualizer } from '@/components/math/taylor-series-visualizer';

export const metadata: Metadata = {
  title: 'Taylor Series Visualizer',
  description:
    'Interactive visualization of Taylor and Maclaurin series expansions. Animate term-by-term approximation of sin, cos, exp, ln, arctan, and custom functions.',
};

export default async function TaylorSeriesPage() {
  const t = await getTranslations('symbolic');
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl select-none" aria-hidden>
              ~
            </span>
            <h1 className="text-4xl font-bold">{t('taylorTitle')}</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">{t('taylorSubtitle')}</p>
        </header>

        <TaylorSeriesVisualizer />

        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-semibold">{t('taylorFormula')}</h2>

          {/* General formula card */}
          <div
            className="p-6 rounded-xl border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
              bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md"
          >
            <p className="text-sm text-muted-foreground mb-4">{t('taylorFormulaDesc')}</p>
            <div className="font-mono text-sm bg-muted/30 rounded-lg p-4 overflow-x-auto border border-border/40">
              f(x) = f(a) + f&apos;(a)(x-a) + f&apos;&apos;(a)/2! &middot; (x-a)&sup2; +
              f&apos;&apos;&apos;(a)/3! &middot; (x-a)&sup3; + &hellip;
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              When a = 0 this is called a <strong>Maclaurin series</strong>. The approximation
              improves as more terms are added, and the series converges within the radius of
              convergence R of the function.
            </p>
          </div>

          {/* Reference grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'sin(x)',
                color: '#60a5fa',
                formula: 'x − x³/3! + x⁵/5! − x⁷/7! + ⋯',
                convergence: 'R = ∞ (converges everywhere)',
              },
              {
                name: 'cos(x)',
                color: '#34d399',
                formula: '1 − x²/2! + x⁴/4! − x⁶/6! + ⋯',
                convergence: 'R = ∞ (converges everywhere)',
              },
              {
                name: 'eˣ',
                color: '#fb923c',
                formula: '1 + x + x²/2! + x³/3! + x⁴/4! + ⋯',
                convergence: 'R = ∞ (converges everywhere)',
              },
              {
                name: 'ln(1+x)',
                color: '#c084fc',
                formula: 'x − x²/2 + x³/3 − x⁴/4 + ⋯',
                convergence: 'R = 1 (converges for |x| < 1)',
              },
              {
                name: 'arctan(x)',
                color: '#f472b6',
                formula: 'x − x³/3 + x⁵/5 − x⁷/7 + ⋯',
                convergence: 'R = 1 (converges for |x| ≤ 1)',
              },
              {
                name: '1/(1−x)',
                color: '#fbbf24',
                formula: '1 + x + x² + x³ + x⁴ + ⋯',
                convergence: 'R = 1 (converges for |x| < 1)',
              },
              {
                name: 'sinh(x)',
                color: '#f472b6',
                formula: 'x + x³/3! + x⁵/5! + x⁷/7! + ⋯',
                convergence: 'R = ∞ (converges everywhere)',
              },
              {
                name: 'cosh(x)',
                color: '#facc15',
                formula: '1 + x²/2! + x⁴/4! + x⁶/6! + ⋯',
                convergence: 'R = ∞ (converges everywhere)',
              },
              {
                name: '√(1+x)',
                color: '#4ade80',
                formula: '1 + x/2 − x²/8 + x³/16 − ⋯',
                convergence: 'R = 1 (binomial, n=½)',
              },
              {
                name: 'tan(x)',
                color: '#22d3ee',
                formula: 'x + x³/3 + 2x⁵/15 + 17x⁷/315 + ⋯',
                convergence: 'R = π/2',
              },
              {
                name: '(1+x)²',
                color: '#a78bfa',
                formula: '1 + 2x + x² (exact, finite)',
                convergence: 'R = ∞ (polynomial)',
              },
            ].map((item) => (
              <div
                key={item.name}
                className="p-4 rounded-xl border border-border shadow-[0_4px_16px_0_rgba(0,0,0,0.22)]
                  bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md
                  hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-shadow duration-300"
              >
                <h3 className="font-semibold mb-2 font-mono text-sm" style={{ color: item.color }}>
                  {item.name}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">{item.formula}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{item.convergence}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
