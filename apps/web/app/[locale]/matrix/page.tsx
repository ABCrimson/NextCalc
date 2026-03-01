import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EigenPanel } from '@/components/calculator/eigen-panel';
import { MatrixFeatureCards } from '@/components/calculator/matrix-feature-cards';
import { MatrixPanel } from '@/components/calculator/matrix-panel';

export const metadata: Metadata = {
  title: 'Matrix Operations',
  description:
    'Linear algebra with matrices - add, multiply, determinant, inverse, eigenvalues, and more',
};

export default async function MatrixPage() {
  const t = await getTranslations('matrix');
  return (
    <main className="relative min-h-screen">
      {/* ─── Animated gradient background ─────────────────────────────── */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

        {/* Noise texture overlay using SVG feTurbulence */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="matrix-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#matrix-noise)" />
        </svg>

        {/* Orb 1 – top-right: blue/indigo */}
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.22 264 / 0.14) 0%, oklch(0.55 0.27 264 / 0.07) 60%, transparent 100%)',
            animation: 'float 20s ease-in-out infinite',
          }}
        />

        {/* Orb 2 – bottom-left: indigo/purple */}
        <div
          className="absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.60 0.22 290 / 0.12) 0%, oklch(0.55 0.24 290 / 0.06) 60%, transparent 100%)',
            animation: 'float 26s ease-in-out infinite reverse',
          }}
        />

        {/* Orb 3 – center: subtle violet */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, oklch(0.62 0.18 275 / 0.08) 0%, transparent 70%)',
            animation: 'float 32s ease-in-out infinite 8s',
          }}
        />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(0.55 0.02 264 / 0.14) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* ─── Page content ──────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-6xl py-12 px-4 relative">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-3">
            {/* Icon badge */}
            <div
              className="p-3 rounded-2xl border shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.2), oklch(0.60 0.22 290 / 0.2))',
                borderColor: 'oklch(0.65 0.22 264 / 0.35)',
              }}
            >
              <span
                className="text-3xl font-mono font-bold leading-none select-none"
                style={{ color: 'oklch(0.75 0.22 264)' }}
                aria-hidden="true"
              >
                M
              </span>
            </div>

            <div>
              {/* Gradient heading */}
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {t('pageTitle')}
              </h1>
              <p className="text-base text-muted-foreground mt-1">{t('pageSubtitle')}</p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(
              [
                { label: t('badge.lu'), hue: 264 },
                { label: t('badge.eigen'), hue: 290 },
                { label: t('badge.gaussJordan'), hue: 155 },
                { label: t('badge.complex'), hue: 30 },
              ] as const
            ).map(({ label, hue }) => (
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

        {/* Main matrix panel with glass morphism card wrapper */}
        <div className="rounded-xl border border-border backdrop-blur-md bg-card/50 shadow-lg overflow-hidden">
          <MatrixPanel />
        </div>

        {/* Eigenvalue & Eigenvector Section */}
        <section className="mt-10" aria-labelledby="eigen-section-heading">
          <h2
            id="eigen-section-heading"
            className="text-2xl font-semibold mb-4 flex items-center gap-2"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 264), oklch(0.65 0.22 290))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm font-bold"
              style={{ color: 'white' }}
              aria-hidden="true"
            >
              λ
            </span>
            {t('eigenSection')}
          </h2>
          {/* Glass morphism wrapper for eigen panel */}
          <div className="rounded-xl border border-border backdrop-blur-md bg-card/50 shadow-lg overflow-hidden">
            <EigenPanel />
          </div>
        </section>

        {/* Features section with staggered Framer Motion cards */}
        <section className="mt-12 space-y-6">
          <h2
            className="text-2xl font-semibold"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 264), oklch(0.65 0.22 264))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('features')}
          </h2>

          {/* Client component: staggered Framer Motion entrance animations */}
          <MatrixFeatureCards />
        </section>

        {/* Example Usage section */}
        <section className="mt-12" aria-labelledby="examples-heading">
          <h2
            id="examples-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 264), oklch(0.65 0.22 290))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('exampleUsage')}
          </h2>

          <div className="space-y-3">
            {(
              [
                {
                  hue: 290,
                  label: 'Matrix Multiplication',
                  lines: [
                    { accent: 290, prefix: 'Matrix A:', value: '[[1, 2], [3, 4]]' },
                    { accent: 290, prefix: 'Matrix B:', value: '[[5, 6], [7, 8]]' },
                    { accent: 290, prefix: 'A × B:', value: '[[19, 22], [43, 50]]' },
                  ],
                },
                {
                  hue: 155,
                  label: 'Determinant',
                  lines: [
                    { accent: 155, prefix: 'Matrix A:', value: '[[1, 2], [3, 4]]' },
                    { accent: 155, prefix: 'det(A):', value: '-2' },
                  ],
                },
                {
                  hue: 0,
                  label: 'Matrix Inverse',
                  lines: [
                    { accent: 0, prefix: 'Matrix A:', value: '[[1, 2], [3, 4]]' },
                    { accent: 0, prefix: 'A⁻¹:', value: '[[-2, 1], [1.5, -0.5]]' },
                  ],
                },
              ] as const
            ).map(({ hue, label, lines }) => (
              <div
                key={label}
                className="group relative p-4 rounded-xl border transition-all duration-200 hover:scale-[1.005] backdrop-blur-md bg-card/50"
                style={{
                  background: `linear-gradient(135deg, oklch(0.18 0.02 ${hue} / 0.35), oklch(0.14 0.015 264 / 0.55))`,
                  borderColor: `oklch(0.65 0.18 ${hue} / 0.25)`,
                }}
              >
                <span
                  className="text-xs font-semibold uppercase tracking-wider block mb-2"
                  style={{ color: `oklch(0.75 0.18 ${hue})` }}
                >
                  {label}
                </span>
                {lines.map(({ prefix, value }, i) => (
                  <div
                    key={i}
                    className="font-mono text-sm text-foreground/80 overflow-x-auto whitespace-nowrap"
                    style={{ marginTop: i > 0 ? '0.25rem' : undefined }}
                  >
                    <span className="font-semibold" style={{ color: `oklch(0.75 0.18 ${hue})` }}>
                      {prefix}
                    </span>{' '}
                    {value}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
