'use client';

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

interface CategoryCard {
  icon: string;
  label: string;
  description: string;
  unitCount: number;
  exampleUnits: string;
  colorClasses: string;
  headingClasses: string;
  textClasses: string;
  countClasses: string;
}

interface UnitsClientProps {
  categoryCards: CategoryCard[];
}

/** Stagger container: children animate in sequence at 70 ms intervals. */
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

/** Individual card entrance: fade up from 20 px with a subtle scale. */
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

/**
 * Animated background layer: three blurred OKLCH orbs that float gently,
 * a dot-grid, and an SVG feTurbulence noise overlay.
 * Rendered as a fixed layer behind all page content.
 */
export function UnitsBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

      {/* Orb 1 — top right: blue-cyan for length/data categories */}
      <motion.div
        className="absolute -top-40 -right-40 w-[650px] h-[650px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.65 0.22 230 / 0.13) 0%, oklch(0.55 0.27 230 / 0.06) 60%, transparent 100%)',
        }}
        animate={{
          y: [0, -18, 0],
          x: [0, 8, 0],
          transition: {
            duration: 18,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'loop',
          },
        }}
      />

      {/* Orb 2 — bottom left: cyan-emerald for conversion theme */}
      <motion.div
        className="absolute -bottom-48 -left-48 w-[750px] h-[750px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.65 0.18 175 / 0.12) 0%, oklch(0.58 0.20 175 / 0.05) 60%, transparent 100%)',
        }}
        animate={{
          y: [0, 14, 0],
          x: [0, -10, 0],
          transition: {
            duration: 22,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'loop',
            delay: 3,
          },
        }}
      />

      {/* Orb 3 — center: subtle indigo accent */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.62 0.16 264 / 0.07) 0%, transparent 70%)',
        }}
        animate={{
          y: [0, -10, 0],
          x: [0, 6, 0],
          transition: {
            duration: 28,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'loop',
            delay: 6,
          },
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

      {/* SVG feTurbulence noise texture overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="units-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#units-noise)" />
      </svg>
    </div>
  );
}

/**
 * Staggered animated category card grid.
 * Cards entrance-animate in sequence on initial mount.
 * Each card's content scales slightly on group hover.
 */
export function UnitsCategories({ categoryCards }: UnitsClientProps) {
  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 md:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {categoryCards.map((card) => (
        <motion.div
          key={card.label}
          variants={cardVariants}
          className={`group relative p-5 rounded-xl bg-gradient-to-br ${card.colorClasses} border backdrop-blur-md transition-all duration-300`}
        >
          {/* Hover shimmer overlay */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Corner accent glow */}
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-10 bg-gradient-to-bl from-white to-transparent" />

          {/* Content scales on hover per requirement */}
          <div className="relative transition-transform duration-300 group-hover:scale-[1.02]">
            <h3
              className={`text-base font-semibold mb-1 flex items-center gap-2 ${card.headingClasses}`}
            >
              <span
                className="text-xl w-7 h-7 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {card.icon}
              </span>
              {card.label}
            </h3>
            <p className={`text-xs mb-2 ${card.textClasses}`}>{card.description}</p>
            <p className={`text-xs font-mono ${card.countClasses}`}>{card.exampleUnits}</p>
            <p className={`text-xs mt-1 ${card.countClasses}`}>{card.unitCount} units</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
