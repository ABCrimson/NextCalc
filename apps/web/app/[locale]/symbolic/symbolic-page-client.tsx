'use client';

import { m } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { SymbolicPanel } from '@/components/calculator/symbolic-panel';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
} as const;

const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
} as const;

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
// Animated background orbs
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

      {/* Orb 1 - top-right: violet */}
      <m.div
        className="absolute -top-40 -right-40 w-[650px] h-[650px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.62 0.22 295 / 0.14) 0%, oklch(0.55 0.25 295 / 0.07) 60%, transparent 100%)',
        }}
        animate={{
          y: [0, -28, 0],
          x: [0, 14, 0],
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orb 2 - bottom-left: fuchsia */}
      <m.div
        className="absolute -bottom-48 -left-48 w-[720px] h-[720px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.60 0.24 330 / 0.13) 0%, oklch(0.55 0.22 330 / 0.06) 60%, transparent 100%)',
        }}
        animate={{
          y: [0, 32, 0],
          x: [0, -18, 0],
          scale: [1, 1.06, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
      />

      {/* Orb 3 - center: pink accent */}
      <m.div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, oklch(0.65 0.20 355 / 0.08) 0%, transparent 70%)',
        }}
        animate={{
          y: [0, -20, 0],
          x: [0, 24, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 8,
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
        {/* Header */}
        <m.header
          className="mb-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <m.div className="flex items-center gap-4 mb-3" variants={fadeUpVariants}>
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
          </m.div>

          {/* Feature badges */}
          <m.div className="flex flex-wrap gap-2 mt-4" variants={fadeUpVariants}>
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
          </m.div>
        </m.header>

        {/* Main calculator panel */}
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <SymbolicPanel />
        </m.div>

        {/* Features section */}
        <section className="mt-14 space-y-6" aria-labelledby="features-heading">
          <m.h2
            id="features-heading"
            className="text-2xl font-semibold"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.62 0.22 295))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            Features
          </m.h2>

          {/* Taylor Series — featured link card */}
          <m.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
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
          </m.div>

          {/* 2-column feature grid */}
          <m.div
            className="grid gap-6 md:grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {FEATURE_CARDS.map((card) => (
              <m.div
                key={card.title}
                variants={cardVariants}
                className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md bg-card/50 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, oklch(0.18 0.03 ${card.hue} / 0.45), oklch(0.16 0.025 ${card.hue} / 0.35))`,
                  borderColor: `oklch(0.62 0.20 ${card.hue} / 0.35)`,
                  boxShadow: `0 0 18px oklch(0.55 0.22 ${card.hue} / 0.14)`,
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
              </m.div>
            ))}
          </m.div>
        </section>

        {/* Example Usage section */}
        <section className="mt-14" aria-labelledby="examples-heading">
          <m.h2
            id="examples-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.62 0.22 295))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            Example Usage
          </m.h2>

          <m.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {EXAMPLES.map(({ hue, label, input, output }) => (
              <m.div
                key={input}
                variants={cardVariants}
                className="group relative p-4 rounded-xl border backdrop-blur-md bg-card/50 transition-all duration-200 hover:scale-[1.005]"
                style={{
                  background: `linear-gradient(135deg, oklch(0.18 0.02 ${hue} / 0.30), oklch(0.14 0.015 250 / 0.55))`,
                  borderColor: `oklch(0.62 0.18 ${hue} / 0.25)`,
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
              </m.div>
            ))}
          </m.div>
        </section>
      </div>
    </main>
  );
}
