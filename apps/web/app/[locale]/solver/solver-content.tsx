'use client';

import { motion } from 'framer-motion';
import { SolverPanel } from '@/components/calculator/solver-panel';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
} as const;

const headerVariants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
} as const;

// ---------------------------------------------------------------------------
// Feature card data
// ---------------------------------------------------------------------------

interface FeatureCard {
  formula: string;
  title: string;
  description: string;
  accentHue: number;
  accentChroma: number;
}

const featureCards: FeatureCard[] = [
  {
    formula: 'ax + b = c',
    title: 'Linear Equations',
    description:
      'Solve first-degree equations in one variable. Automatically detects and solves linear forms.',
    accentHue: 200,
    accentChroma: 0.22,
  },
  {
    formula: 'ax\u00b2 + bx + c = 0',
    title: 'Quadratic Equations',
    description:
      'Uses the quadratic formula. Handles real and complex solutions automatically.',
    accentHue: 300,
    accentChroma: 0.20,
  },
  {
    formula: 'f(x) = 0',
    title: 'Transcendental Equations',
    description:
      'Uses Newton\u2013Raphson for equations involving trigonometric, exponential, and logarithmic functions.',
    accentHue: 155,
    accentChroma: 0.18,
  },
  {
    formula: '\u2102 — Complex Solutions',
    title: 'Complex Solutions',
    description:
      'Automatically handles complex numbers when real solutions don\u2019t exist. Displays in a\u202f+\u202fbi form.',
    accentHue: 30,
    accentChroma: 0.20,
  },
];

// ---------------------------------------------------------------------------
// Example row data
// ---------------------------------------------------------------------------

interface Example {
  accentHue: number;
  label: string;
  equation: string;
  solution: string;
}

const examples: Example[] = [
  {
    accentHue: 200,
    label: 'Linear',
    equation: '2*x + 5 = 13',
    solution: 'x = 4',
  },
  {
    accentHue: 300,
    label: 'Quadratic',
    equation: 'x^2 \u2212 5*x + 6 = 0',
    solution: 'x = 2, x = 3',
  },
  {
    accentHue: 30,
    label: 'Complex',
    equation: 'x^2 + 1 = 0',
    solution: 'x = i, x = \u2212i',
  },
  {
    accentHue: 155,
    label: 'Transcendental',
    equation: 'sin(x) \u2212 0.5 = 0',
    solution: 'x \u2248 0.5236 (Newton\u2013Raphson)',
  },
];

// ---------------------------------------------------------------------------
// Tip data
// ---------------------------------------------------------------------------

const tips: { title: string; body: string }[] = [
  {
    title: 'Format',
    body: 'Enter equations as \u201cexpression = value\u201d (e.g., x^2 + 2*x = 3)',
  },
  {
    title: 'Variable',
    body: "Default variable is 'x', but you can specify others",
  },
  {
    title: 'Complex',
    body: 'Solutions with imaginary parts are displayed as a\u202f+\u202fbi',
  },
  {
    title: 'Precision',
    body: 'Numerical methods use 10 iterations for convergence',
  },
];

// ---------------------------------------------------------------------------
// Feature card component
// ---------------------------------------------------------------------------

function FeatureCard({ card }: { card: FeatureCard }) {
  const { formula, title, description, accentHue, accentChroma } = card;
  const baseColor = `oklch(0.65 ${accentChroma} ${accentHue})`;
  const darkBg = `oklch(0.18 0.03 ${accentHue} / 0.5)`;
  const darkBg2 = `oklch(0.16 0.025 ${accentHue} / 0.4)`;
  const borderColor = `oklch(0.65 ${accentChroma} ${accentHue} / 0.4)`;
  const glowColor = `oklch(0.55 ${accentChroma + 0.05} ${accentHue} / 0.15)`;
  const hoverBg = `oklch(0.65 ${accentChroma} ${accentHue} / 0.06)`;
  const titleColor = `oklch(0.78 ${accentChroma - 0.04} ${accentHue})`;
  const textColor = `oklch(0.75 0.07 ${accentHue})`;
  const tagBg = `oklch(0.65 ${accentChroma} ${accentHue} / 0.15)`;
  const tagColor = `oklch(0.80 ${accentChroma - 0.02} ${accentHue})`;

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.025, y: -3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md cursor-default"
      style={{
        background: `linear-gradient(135deg, ${darkBg}, ${darkBg2})`,
        borderColor,
        boxShadow: `0 0 20px ${glowColor}`,
      }}
    >
      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
        style={{ background: `linear-gradient(135deg, ${hoverBg}, transparent)` }}
        aria-hidden="true"
      />

      {/* Corner accent */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
        style={{
          background: `radial-gradient(circle at top right, ${baseColor.replace(')', ' / 0.4)')} , transparent)`,
        }}
        aria-hidden="true"
      />

      <div className="relative min-w-0">
        {/* Accent dot + formula */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: baseColor, boxShadow: `0 0 8px ${baseColor.replace(')', ' / 0.8)')}` }}
            aria-hidden="true"
          />
          <div className="overflow-x-auto">
            <h3
              className="text-lg font-semibold font-mono whitespace-nowrap"
              style={{ color: tagColor }}
            >
              {formula}
            </h3>
          </div>
        </div>

        {/* Type badge */}
        <p
          className="text-xs font-semibold mb-2 px-2 py-0.5 rounded-full inline-block border"
          style={{
            background: tagBg,
            borderColor,
            color: titleColor,
          }}
        >
          {title}
        </p>

        {/* Description */}
        <p className="text-sm mt-2" style={{ color: textColor }}>
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function SolverPageContent() {
  return (
    <main className="relative min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Animated background                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

        {/* Orb 1 — emerald, top-right */}
        <motion.div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.18 155 / 0.13) 0%, oklch(0.55 0.14 155 / 0.06) 60%, transparent 100%)',
          }}
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orb 2 — teal/cyan, bottom-left */}
        <motion.div
          className="absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.20 200 / 0.13) 0%, oklch(0.58 0.16 200 / 0.06) 60%, transparent 100%)',
          }}
          animate={{ y: [0, 25, 0], x: [0, -12, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />

        {/* Orb 3 — purple, center */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.60 0.14 300 / 0.07) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        />

        {/* Noise texture overlay via SVG feTurbulence */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.03] mix-blend-overlay pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="solver-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={4}
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#solver-noise)" />
        </svg>

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(0.55 0.02 200 / 0.15) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Page content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="container mx-auto max-w-4xl py-12 px-4 relative">

        {/* Header */}
        <motion.header
          className="mb-10"
          variants={headerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center gap-4 mb-3">
            {/* Icon badge */}
            <div
              className="p-3 rounded-2xl border shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.65 0.18 155 / 0.20), oklch(0.65 0.20 200 / 0.20))',
                borderColor: 'oklch(0.65 0.18 155 / 0.35)',
              }}
            >
              <span
                className="text-3xl font-mono leading-none select-none"
                style={{ color: 'oklch(0.75 0.18 155)' }}
                aria-hidden="true"
              >
                &#x3D;
              </span>
            </div>

            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Equation Solver
              </h1>
              <p className="text-base text-muted-foreground mt-1">
                Solve equations automatically with step-by-step solution methods
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: 'Linear & Quadratic', hue: 155 },
              { label: 'Newton\u2013Raphson', hue: 200 },
              { label: 'Complex Roots', hue: 300 },
              { label: 'Step-by-Step', hue: 30 },
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
        </motion.header>

        {/* Solver panel — wrapped for entry animation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <SolverPanel />
        </motion.div>

        {/* ---------------------------------------------------------------- */}
        {/* Supported equation types                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-14" aria-labelledby="equation-types-heading">
          <motion.h2
            id="equation-types-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 200), oklch(0.65 0.18 155))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Supported Equation Types
          </motion.h2>

          <motion.div
            className="grid gap-5 md:grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {featureCards.map((card) => (
              <FeatureCard key={card.title} card={card} />
            ))}
          </motion.div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Example equations                                                 */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-14" aria-labelledby="examples-heading">
          <motion.h2
            id="examples-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 200), oklch(0.65 0.18 155))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Example Equations
          </motion.h2>

          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            {examples.map(({ accentHue, label, equation, solution }) => (
              <motion.div
                key={label}
                variants={itemVariants}
                whileHover={{ scale: 1.008 }}
                transition={{ duration: 0.15 }}
                className="group relative p-4 rounded-xl border overflow-hidden backdrop-blur-md"
                style={{
                  background: `linear-gradient(135deg, oklch(0.18 0.02 ${accentHue} / 0.35), oklch(0.14 0.015 200 / 0.55))`,
                  borderColor: `oklch(0.65 0.18 ${accentHue} / 0.28)`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: `oklch(0.75 0.18 ${accentHue})` }}
                    >
                      {label}
                    </span>
                    <p className="font-mono text-sm text-foreground/80 mt-1 overflow-x-auto whitespace-nowrap">
                      {equation}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="font-mono text-sm font-bold"
                      style={{ color: `oklch(0.82 0.18 ${accentHue})` }}
                    >
                      {solution}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Tips                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-14" aria-labelledby="tips-heading">
          <motion.h2
            id="tips-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 200), oklch(0.65 0.18 155))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Tips
          </motion.h2>

          <motion.div
            className="relative p-6 rounded-xl border overflow-hidden backdrop-blur-md"
            style={{
              background:
                'linear-gradient(135deg, oklch(0.18 0.025 155 / 0.40), oklch(0.16 0.02 200 / 0.30))',
              borderColor: 'oklch(0.60 0.18 155 / 0.30)',
              boxShadow: '0 0 20px oklch(0.55 0.18 155 / 0.10)',
            }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            {/* Radial accent */}
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at top left, oklch(0.65 0.18 155 / 0.07), transparent 60%)',
              }}
              aria-hidden="true"
            />

            <div className="relative space-y-3">
              {tips.map(({ title, body }) => (
                <p key={title} className="text-sm" style={{ color: 'oklch(0.75 0.05 155)' }}>
                  <strong style={{ color: 'oklch(0.82 0.15 155)' }}>{title}:</strong>{' '}
                  {body}
                </p>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
