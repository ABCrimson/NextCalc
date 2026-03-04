'use client';

import dynamic from 'next/dynamic';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Dynamic import — defers ~300KB (math-engine, KaTeX, Radix, Framer Motion)
// ---------------------------------------------------------------------------

const SymbolicPanel = dynamic(
  () => import('@/components/calculator/symbolic-panel').then((m) => ({ default: m.SymbolicPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-card p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded-lg w-full" />
        <div className="space-y-4">
          <div className="h-5 bg-muted rounded w-32" />
          <div className="h-10 bg-muted rounded-lg w-full" />
          <div className="h-5 bg-muted rounded w-24" />
          <div className="h-10 bg-muted rounded-lg w-full" />
        </div>
      </div>
    ),
  },
);

// ---------------------------------------------------------------------------
// Feature card data
// ---------------------------------------------------------------------------

interface FeatureCard {
  symbol: string;
  title: string;
  badge: string;
  badgeHue: number;
  description: string;
  hue: number;
}

const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    symbol: '∂',
    title: 'Differentiation',
    badge: 'Available',
    badgeHue: 155,
    description:
      'Compute derivatives symbolically using chain rule, product rule, and quotient rule. Supports trigonometric, exponential, and logarithmic functions.',
    hue: 264,
  },
  {
    symbol: '∫',
    title: 'Integration',
    badge: 'Symbolic',
    badgeHue: 155,
    description:
      'Symbolic antiderivatives for polynomials, trig, inverse trig (arcsin, arccos, arctan), hyperbolic (sinh, cosh, tanh), exponentials, and logarithms. Integration by parts with LIATE heuristic. Numerical methods: Adaptive Simpson, Gauss-Kronrod, Romberg, Monte Carlo.',
    hue: 300,
  },
  {
    symbol: '=',
    title: 'Equation Solving',
    badge: 'Available',
    badgeHue: 155,
    description:
      'Solve linear, quadratic, polynomial, and transcendental equations. Automatic method selection with support for complex numbers and multiple solutions.',
    hue: 155,
  },
  {
    symbol: '∑',
    title: 'Simplification',
    badge: 'Available',
    badgeHue: 155,
    description:
      'Algebraic simplification with expand, factor, and substitute operations. Includes identity rules, constant folding, and polynomial manipulation.',
    hue: 45,
  },
] as const;

interface ExampleRow {
  hue: number;
  label: string;
  input: string;
  output: string;
}

const EXAMPLES: readonly ExampleRow[] = [
  { hue: 264, label: 'd/dx', input: 'x^2 + sin(x)', output: '2*x + cos(x)' },
  { hue: 300, label: 'd/dx', input: 'exp(x^2)', output: '2*x*exp(x^2)' },
  { hue: 340, label: 'd/dx', input: 'ln(x) * sin(x)', output: 'sin(x)/x + ln(x)*cos(x)' },
] as const;

// ---------------------------------------------------------------------------
// Animated background orbs — pure CSS (compositor-thread, no JS)
// ---------------------------------------------------------------------------

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

      {/* Noise texture overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="symbolic-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#symbolic-noise)" />
      </svg>

      {/* Orb 1 - top-right: violet — CSS animation instead of Framer Motion */}
      <div
        className="absolute -top-40 -right-40 w-[650px] h-[650px] rounded-full blur-3xl animate-[symbolic-orb1_20s_ease-in-out_infinite]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.62 0.22 295 / 0.14) 0%, oklch(0.55 0.25 295 / 0.07) 60%, transparent 100%)',
        }}
      />

      {/* Orb 2 - bottom-left: fuchsia */}
      <div
        className="absolute -bottom-48 -left-48 w-[720px] h-[720px] rounded-full blur-3xl animate-[symbolic-orb2_25s_ease-in-out_4s_infinite]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.60 0.24 330 / 0.13) 0%, oklch(0.55 0.22 330 / 0.06) 60%, transparent 100%)',
        }}
      />

      {/* Orb 3 - center: pink accent */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full blur-3xl animate-[symbolic-orb3_30s_ease-in-out_8s_infinite]"
        style={{
          background: 'radial-gradient(circle, oklch(0.65 0.20 355 / 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, oklch(0.55 0.02 295 / 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* CSS keyframes — compositor-only transforms, no main thread work */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS keyframes only
        dangerouslySetInnerHTML={{
          __html: `
@keyframes symbolic-orb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(14px, -28px) scale(1.04); }
}
@keyframes symbolic-orb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-18px, 32px) scale(1.06); }
}
@keyframes symbolic-orb3 {
  0%, 100% { transform: translate(-50%, -50%) translate(0, 0); }
  50% { transform: translate(-50%, -50%) translate(24px, -20px); }
}
@keyframes symbolic-fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes symbolic-card-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
`,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function SymbolicPageClient() {
  return (
    <main className="relative min-h-screen">
      <AnimatedBackground />

      <div className="container mx-auto max-w-4xl py-12 px-4 relative">
        {/* Header — CSS fade-up animation */}
        <header className="mb-10">
          <div
            className="flex items-center gap-4 mb-3"
            style={{ animation: 'symbolic-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            {/* Icon badge */}
            <div
              className="p-3 rounded-2xl border shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.62 0.22 295 / 0.20), oklch(0.60 0.24 330 / 0.20))',
                borderColor: 'oklch(0.62 0.22 295 / 0.35)',
              }}
            >
              <span
                className="text-3xl font-mono leading-none select-none"
                style={{ color: 'oklch(0.78 0.22 295)' }}
                aria-hidden="true"
              >
                ∂
              </span>
            </div>

            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                Symbolic Mathematics
              </h1>
              <p className="text-base text-muted-foreground mt-1">
                Differentiate functions symbolically with step-by-step calculations
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div
            className="flex flex-wrap gap-2 mt-4"
            style={{
              animation: 'symbolic-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.12s both',
            }}
          >
            {[
              { label: 'Symbolic Diff', hue: 295 },
              { label: 'Integration', hue: 330 },
              { label: 'Equation Solver', hue: 155 },
              { label: 'Taylor Series', hue: 45 },
            ].map(({ label, hue }) => (
              <span
                key={label}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: `oklch(0.65 0.18 ${hue} / 0.10)`,
                  borderColor: `oklch(0.65 0.18 ${hue} / 0.35)`,
                  color: `oklch(0.78 0.18 ${hue})`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </header>

        {/* Main calculator panel — dynamically imported */}
        <div
          style={{
            animation: 'symbolic-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.25s both',
          }}
        >
          <SymbolicPanel />
        </div>

        {/* Features section */}
        <section className="mt-14 space-y-6" aria-labelledby="features-heading">
          <h2
            id="features-heading"
            className="text-2xl font-semibold"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.62 0.22 295))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Features
          </h2>

          {/* Taylor Series — featured link card */}
          <div>
            <Link
              href="/symbolic/taylor"
              className="group block p-6 rounded-xl backdrop-blur-md bg-card/50 border border-border hover:border-orange-400/60 transition-all duration-300 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{
                boxShadow: '0 0 15px oklch(0.65 0.22 45 / 0.15)',
              }}
            >
              {/* hover glow layer */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.65 0.22 45 / 0.06), transparent)',
                }}
              />
              <div className="relative flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold mb-1 flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0" aria-hidden="true">
                      ~
                    </span>
                    <span className="shrink-0">Taylor Series Visualizer</span>
                    <span
                      className="text-xs px-2 py-1 rounded border shrink-0"
                      style={{
                        background: 'oklch(0.65 0.22 45 / 0.15)',
                        borderColor: 'oklch(0.65 0.22 45 / 0.35)',
                        color: 'oklch(0.78 0.20 45)',
                      }}
                    >
                      New
                    </span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Animate Taylor and Maclaurin series approximations for sin, cos, e^x, ln(1+x),
                    and more. Interactive term-by-term visualization with error analysis.
                  </p>
                </div>
                <span
                  className="text-muted-foreground group-hover:translate-x-1 transition-transform duration-200 shrink-0 text-lg"
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              </div>
            </Link>
          </div>

          {/* 2-column feature grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURE_CARDS.map((card, idx) => (
              <div
                key={card.title}
                className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md bg-card/50 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, oklch(0.18 0.03 ${card.hue} / 0.45), oklch(0.16 0.025 ${card.hue} / 0.35))`,
                  borderColor: `oklch(0.62 0.20 ${card.hue} / 0.35)`,
                  boxShadow: `0 0 18px oklch(0.55 0.22 ${card.hue} / 0.14)`,
                  animation: `symbolic-card-up 0.45s cubic-bezier(0.22,1,0.36,1) ${idx * 0.12}s both`,
                }}
              >
                {/* Hover shimmer */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, oklch(0.65 0.20 ${card.hue} / 0.07), transparent)`,
                  }}
                />
                {/* Corner accent */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at top right, oklch(0.65 0.20 ${card.hue} / 0.45), transparent)`,
                  }}
                />

                <div className="relative min-w-0">
                  {/* Card header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: `oklch(0.65 0.20 ${card.hue})`,
                        boxShadow: `0 0 8px oklch(0.65 0.20 ${card.hue} / 0.80)`,
                      }}
                    />
                    <h3
                      className="text-lg font-semibold flex flex-wrap items-center gap-2 min-w-0"
                      style={{ color: `oklch(0.78 0.16 ${card.hue})` }}
                    >
                      <span className="shrink-0" aria-hidden="true">
                        {card.symbol}
                      </span>
                      <span className="shrink-0">{card.title}</span>
                      <span
                        className="text-xs px-2 py-1 rounded border shrink-0"
                        style={{
                          background: `oklch(0.65 0.20 ${card.badgeHue} / 0.15)`,
                          borderColor: `oklch(0.65 0.20 ${card.badgeHue} / 0.35)`,
                          color: `oklch(0.78 0.18 ${card.badgeHue})`,
                        }}
                      >
                        {card.badge}
                      </span>
                    </h3>
                  </div>

                  <p className="text-sm" style={{ color: `oklch(0.72 0.06 ${card.hue})` }}>
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Example Usage section */}
        <section className="mt-14" aria-labelledby="examples-heading">
          <h2
            id="examples-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.62 0.22 295))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Example Usage
          </h2>

          <div className="space-y-3">
            {EXAMPLES.map(({ hue, label, input, output }, idx) => (
              <div
                key={input}
                className="group relative p-4 rounded-xl border backdrop-blur-md bg-card/50 transition-all duration-200 hover:scale-[1.005]"
                style={{
                  background: `linear-gradient(135deg, oklch(0.18 0.02 ${hue} / 0.30), oklch(0.14 0.015 250 / 0.55))`,
                  borderColor: `oklch(0.62 0.18 ${hue} / 0.25)`,
                  animation: `symbolic-card-up 0.45s cubic-bezier(0.22,1,0.36,1) ${idx * 0.12}s both`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-mono text-sm text-foreground/80 overflow-x-auto">
                    <span className="font-semibold" style={{ color: `oklch(0.78 0.18 ${hue})` }}>
                      Input:
                    </span>{' '}
                    {input}
                  </div>
                  <div className="font-mono text-sm text-foreground/80 overflow-x-auto">
                    <span className="font-semibold" style={{ color: `oklch(0.78 0.18 ${hue})` }}>
                      {label}:
                    </span>{' '}
                    {output}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
