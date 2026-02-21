import type { Metadata } from 'next';
import Link from 'next/link';
import { SymbolicPanel } from '@/components/calculator/symbolic-panel';

export const metadata: Metadata = {
  title: 'Symbolic Mathematics',
  description: 'Symbolic differentiation and calculus operations with NextCalc Pro',
};

export default function SymbolicPage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Symbolic Mathematics</h1>
          <p className="text-lg text-muted-foreground">
            Differentiate functions symbolically with step-by-step calculations
          </p>
        </header>

        <SymbolicPanel />

        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-semibold">Features</h2>

          {/* Taylor Series Visualizer - New feature card */}
          <div className="mb-6">
            <Link
              href="/symbolic/taylor"
              className="group block p-6 rounded-lg bg-gradient-to-br from-orange-950/30 to-red-950/30 border border-orange-500/30 hover:border-orange-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold mb-1 flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">~</span>
                    <span className="shrink-0">Taylor Series Visualizer</span>
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded border border-orange-500/30 shrink-0">
                      New
                    </span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Animate Taylor and Maclaurin series approximations for sin, cos, e^x, ln(1+x), and more.
                    Interactive term-by-term visualization with error analysis.
                  </p>
                </div>
                <span className="text-muted-foreground group-hover:text-orange-400 transition-colors shrink-0">
                  &rarr;
                </span>
              </div>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Differentiation - Implemented */}
            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-blue-950/30 to-indigo-950/30 border border-blue-500/30 hover:border-blue-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] overflow-hidden">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative min-w-0">
                <h3 className="text-lg font-semibold mb-2 flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">∂</span>
                  <span className="shrink-0">Differentiation</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 shrink-0">
                    ✓ Available
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Compute derivatives symbolically using chain rule, product rule, and quotient rule.
                  Supports trigonometric, exponential, and logarithmic functions.
                </p>
              </div>
            </div>

            {/* Integration - Symbolic + Numerical */}
            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-purple-950/30 to-pink-950/30 border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] overflow-hidden">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative min-w-0">
                <h3 className="text-lg font-semibold mb-2 flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">∫</span>
                  <span className="shrink-0">Integration</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 shrink-0">
                    ✓ Symbolic
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Symbolic antiderivatives for polynomials, trig, inverse trig (arcsin, arccos, arctan),
                  hyperbolic (sinh, cosh, tanh), exponentials, and logarithms. Integration by parts with LIATE heuristic.
                  Numerical methods: Adaptive Simpson, Gauss-Kronrod, Romberg, Monte Carlo.
                </p>
              </div>
            </div>

            {/* Equation Solving - Implemented */}
            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-emerald-950/30 to-teal-950/30 border border-emerald-500/30 hover:border-emerald-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] overflow-hidden">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative min-w-0">
                <h3 className="text-lg font-semibold mb-2 flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">=</span>
                  <span className="shrink-0">Equation Solving</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 shrink-0">
                    ✓ Available
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Solve linear, quadratic, polynomial, and transcendental equations.
                  Automatic method selection with support for complex numbers and multiple solutions.
                </p>
              </div>
            </div>

            {/* Simplification - Implemented */}
            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-amber-950/30 to-orange-950/30 border border-amber-500/30 hover:border-amber-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] overflow-hidden">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative min-w-0">
                <h3 className="text-lg font-semibold mb-2 flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">∑</span>
                  <span className="shrink-0">Simplification</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 shrink-0">
                    ✓ Available
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Algebraic simplification with expand, factor, and substitute operations.
                  Includes identity rules, constant folding, and polynomial manipulation.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Example Usage</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border shadow-sm overflow-hidden">
              <div className="font-mono text-sm text-foreground/80 overflow-x-auto whitespace-nowrap">
                <span className="text-blue-400 font-semibold">Input:</span> x^2 + sin(x)
              </div>
              <div className="font-mono text-sm mt-2 text-foreground/80 overflow-x-auto whitespace-nowrap">
                <span className="text-blue-400 font-semibold">d/dx:</span> 2*x + cos(x)
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border shadow-sm overflow-hidden">
              <div className="font-mono text-sm text-foreground/80 overflow-x-auto whitespace-nowrap">
                <span className="text-indigo-400 font-semibold">Input:</span> exp(x^2)
              </div>
              <div className="font-mono text-sm mt-2 text-foreground/80 overflow-x-auto whitespace-nowrap">
                <span className="text-indigo-400 font-semibold">d/dx:</span> 2*x*exp(x^2)
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border shadow-sm overflow-hidden">
              <div className="font-mono text-sm text-foreground/80 overflow-x-auto whitespace-nowrap">
                <span className="text-purple-400 font-semibold">Input:</span> ln(x) * sin(x)
              </div>
              <div className="font-mono text-sm mt-2 text-foreground/80 overflow-x-auto whitespace-nowrap">
                <span className="text-purple-400 font-semibold">d/dx:</span> sin(x)/x + ln(x)*cos(x)
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
