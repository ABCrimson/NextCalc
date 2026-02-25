import type { Metadata } from 'next';
import { ComplexPanel } from '@/components/calculator/complex-panel';

export const metadata: Metadata = {
  title: 'Complex Numbers',
  description:
    'Complex number calculator with support for rectangular, polar, and exponential forms. Perform arithmetic, functions, and visualize on the Argand diagram.',
};

export default function ComplexPage() {
  return (
    <main className="relative min-h-screen">
      {/* Animated gradient background matching other pages */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

        {/* Animated orb - top right: blue/indigo for real part */}
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.22 264 / 0.12) 0%, oklch(0.55 0.27 264 / 0.06) 60%, transparent 100%)',
            animation: 'float 18s ease-in-out infinite',
          }}
        />

        {/* Animated orb - bottom left: purple for imaginary part */}
        <div
          className="absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.63 0.20 300 / 0.12) 0%, oklch(0.58 0.22 300 / 0.06) 60%, transparent 100%)',
            animation: 'float 22s ease-in-out infinite reverse',
          }}
        />

        {/* Animated orb - center: emerald for magnitude */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.18 155 / 0.07) 0%, transparent 70%)',
            animation: 'float 28s ease-in-out infinite 6s',
          }}
        />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(0.55 0.02 250 / 0.15) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="container mx-auto max-w-5xl py-12 px-4 relative">
        {/* Page header */}
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-3">
            {/* Icon badge */}
            <div
              className="p-3 rounded-2xl border"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.2), oklch(0.58 0.22 300 / 0.2))',
                borderColor: 'oklch(0.65 0.22 264 / 0.3)',
              }}
            >
              <span
                className="text-3xl font-mono leading-none select-none"
                style={{ color: 'oklch(0.75 0.22 264)' }}
                aria-hidden="true"
              >
                &#x2102;
              </span>
            </div>

            <div>
              <h1
                className="text-4xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, oklch(0.75 0.22 264), oklch(0.68 0.22 300), oklch(0.72 0.20 155))',
                }}
              >
                Complex Number Calculator
              </h1>
              <p className="text-base text-muted-foreground mt-1">
                Arithmetic, functions, and Argand diagram visualization for complex numbers
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: 'Rectangular & Polar', color: '264' },
              { label: 'Argand Diagram', color: '300' },
              { label: 'LaTeX Rendering', color: '155' },
              { label: 'Operation History', color: '30' },
            ].map(({ label, color }) => (
              <span
                key={label}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: `oklch(0.65 0.18 ${color} / 0.10)`,
                  borderColor: `oklch(0.65 0.18 ${color} / 0.35)`,
                  color: `oklch(0.78 0.18 ${color})`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </header>

        {/* Main calculator panel */}
        <ComplexPanel />

        {/* Supplementary info panels */}
        <section className="mt-14 space-y-8" aria-labelledby="operations-heading">
          <h2
            id="operations-heading"
            className="text-2xl font-semibold"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.65 0.22 264))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Supported Operations
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Binary operations */}
            <div className="group relative p-6 rounded-xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.18 0.03 264 / 0.5), oklch(0.16 0.025 264 / 0.4))',
                borderColor: 'oklch(0.65 0.22 264 / 0.4)',
                boxShadow: '0 0 20px oklch(0.55 0.27 264 / 0.15)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.06), transparent)',
                }}
              />
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.65 0.22 264 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.65 0.22 264)', boxShadow: '0 0 8px oklch(0.65 0.22 264 / 0.8)' }} />
                  <h3 className="text-lg font-semibold" style={{ color: 'oklch(0.78 0.18 264)' }}>
                    Binary Operations
                  </h3>
                </div>
                <ul className="text-sm space-y-1.5" style={{ color: 'oklch(0.75 0.08 264)' }}>
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.80 0.18 264)' }}>+</span>
                    Addition: z&#x2081; + z&#x2082;
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.80 0.18 264)' }}>&minus;</span>
                    Subtraction: z&#x2081; &minus; z&#x2082;
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.80 0.18 264)' }}>&times;</span>
                    Multiplication: z&#x2081; &times; z&#x2082;
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.80 0.18 264)' }}>&divide;</span>
                    Division: z&#x2081; &divide; z&#x2082;
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.80 0.18 264)' }}>^</span>
                    Power: z&#x2081; ^ z&#x2082; (general complex power)
                  </li>
                </ul>
              </div>
            </div>

            {/* Unary functions */}
            <div className="group relative p-6 rounded-xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.18 0.03 300 / 0.5), oklch(0.16 0.025 300 / 0.4))',
                borderColor: 'oklch(0.63 0.20 300 / 0.4)',
                boxShadow: '0 0 20px oklch(0.58 0.22 300 / 0.15)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.63 0.20 300 / 0.06), transparent)',
                }}
              />
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.63 0.20 300 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.63 0.20 300)', boxShadow: '0 0 8px oklch(0.63 0.20 300 / 0.8)' }} />
                  <h3 className="text-lg font-semibold" style={{ color: 'oklch(0.78 0.16 300)' }}>
                    Unary Functions
                  </h3>
                </div>
                <ul className="text-sm space-y-1.5" style={{ color: 'oklch(0.75 0.08 300)' }}>
                  <li>Conjugate &#x7a;&#x305;, Negate &minus;z</li>
                  <li>Modulus |z|, Argument arg(z)</li>
                  <li>Square root &#x221a;z (principal branch)</li>
                  <li>Exponential e^z, Natural log ln(z)</li>
                  <li>Trigonometric sin(z), cos(z)</li>
                </ul>
              </div>
            </div>

            {/* Number forms */}
            <div className="group relative p-6 rounded-xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.18 0.03 155 / 0.5), oklch(0.16 0.025 155 / 0.4))',
                borderColor: 'oklch(0.65 0.18 155 / 0.4)',
                boxShadow: '0 0 20px oklch(0.65 0.18 155 / 0.15)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.65 0.18 155 / 0.06), transparent)',
                }}
              />
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.65 0.18 155 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.65 0.18 155)', boxShadow: '0 0 8px oklch(0.65 0.18 155 / 0.8)' }} />
                  <h3 className="text-lg font-semibold" style={{ color: 'oklch(0.78 0.15 155)' }}>
                    Number Forms
                  </h3>
                </div>
                <ul className="text-sm space-y-1.5" style={{ color: 'oklch(0.75 0.07 155)' }}>
                  <li>Rectangular: a + bi</li>
                  <li>Polar: r &ang; &theta;&deg;</li>
                  <li>Exponential: r &middot; e^(i&theta;)</li>
                  <li>Automatic conversion between all forms</li>
                  <li>KaTeX-rendered LaTeX output</li>
                </ul>
              </div>
            </div>

            {/* Argand diagram */}
            <div className="group relative p-6 rounded-xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.18 0.03 30 / 0.5), oklch(0.16 0.025 30 / 0.4))',
                borderColor: 'oklch(0.65 0.20 30 / 0.4)',
                boxShadow: '0 0 20px oklch(0.65 0.20 30 / 0.15)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.65 0.20 30 / 0.06), transparent)',
                }}
              />
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.65 0.20 30 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.65 0.20 30)', boxShadow: '0 0 8px oklch(0.65 0.20 30 / 0.8)' }} />
                  <h3 className="text-lg font-semibold" style={{ color: 'oklch(0.78 0.16 30)' }}>
                    Argand Diagram
                  </h3>
                </div>
                <ul className="text-sm space-y-1.5" style={{ color: 'oklch(0.75 0.07 30)' }}>
                  <li>SVG complex plane visualization</li>
                  <li>Vectors from origin to each number</li>
                  <li>Projection lines to real and imaginary axes</li>
                  <li>Auto-scaling to fit all points</li>
                  <li>Color-coded operands and results</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Example calculations */}
        <section className="mt-14" aria-labelledby="examples-heading">
          <h2
            id="examples-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.65 0.22 264))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Example Calculations
          </h2>
          <div className="space-y-3">
            {[
              {
                accent: '264',
                label: 'Multiplication',
                expression: '(3+4i) \u00d7 (1\u22122i)',
                result: '11\u22122i',
                detail: '|z| = \u221a125 \u2248 11.18 \u00a0|\u00a0 arg \u2248 \u221210.3\u00b0',
              },
              {
                accent: '300',
                label: 'Division',
                expression: '(1+i) \u00f7 (1\u2212i)',
                result: 'i',
                detail: '|z| = 1 \u00a0|\u00a0 arg = 90\u00b0',
              },
              {
                accent: '155',
                label: "Euler's Identity",
                expression: 'e^(i\u03c0) using exp on 0+\u03c0i',
                result: '\u22121 + 0i',
                detail: 'The most beautiful equation in mathematics',
              },
              {
                accent: '30',
                label: 'Square Root of -1',
                expression: '\u221a(\u22121) = i',
                result: '0+i',
                detail: 'Polar: 1 \u2220 90\u00b0',
              },
            ].map(({ accent, label, expression, result, detail }) => (
              <div
                key={label}
                className="group relative p-4 rounded-xl border transition-all duration-200 hover:scale-[1.005]"
                style={{
                  background:
                    `linear-gradient(135deg, oklch(0.18 0.02 ${accent} / 0.3), oklch(0.14 0.015 250 / 0.6))`,
                  borderColor: `oklch(0.65 0.18 ${accent} / 0.25)`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: `oklch(0.75 0.18 ${accent})` }}
                    >
                      {label}
                    </span>
                    <p className="font-mono text-sm text-foreground/80 mt-1">{expression}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className="font-mono text-sm font-bold"
                      style={{ color: `oklch(0.82 0.18 ${accent})` }}
                    >
                      = {result}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">{detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips section */}
        <section className="mt-14" aria-labelledby="tips-heading">
          <h2
            id="tips-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.65 0.22 264))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Tips
          </h2>
          <div
            className="relative p-6 rounded-xl border overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, oklch(0.18 0.025 264 / 0.4), oklch(0.16 0.02 300 / 0.3))',
              borderColor: 'oklch(0.60 0.18 264 / 0.3)',
            }}
          >
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at top left, oklch(0.65 0.22 264 / 0.06), transparent 60%)',
              }}
            />
            <div className="relative space-y-3">
              {[
                {
                  title: 'Input Format',
                  body: (
                    <>
                      Enter rectangular numbers as{' '}
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.82 0.18 264)' }}>3+4i</code>,{' '}
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.82 0.18 264)' }}>-2-i</code>,{' '}
                      or{' '}
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 264 / 0.15)', color: 'oklch(0.82 0.18 264)' }}>5i</code>
                    </>
                  ),
                },
                {
                  title: 'Polar Input',
                  body: 'Switch to r\u2220\u03b8 mode and enter magnitude and angle in degrees',
                },
                {
                  title: 'Mode Conversion',
                  body: 'Click a+bi or r\u2220\u03b8 to switch mode \u2014 values are automatically converted',
                },
                {
                  title: 'Power',
                  body: "Integer powers use De Moivre's theorem; fractional/complex powers use the general formula e^(z\u2082 ln z\u2081)",
                },
                {
                  title: 'Results',
                  body: 'Click the copy icon on any form to copy the plain-text value to clipboard',
                },
              ].map(({ title, body }) => (
                <p key={title} className="text-sm" style={{ color: 'oklch(0.75 0.05 264)' }}>
                  <strong style={{ color: 'oklch(0.82 0.15 264)' }}>{title}:</strong>{' '}
                  {body}
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
