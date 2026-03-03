'use client';

import { m } from 'framer-motion';

interface FeatureCard {
  symbol: string;
  symbolIsMono: boolean;
  title: string;
  description: string;
  color: string;
  hue: number;
  shadowRgb: string;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    symbol: '+',
    symbolIsMono: false,
    title: 'Basic Operations',
    description: 'Add, subtract, and scalar multiply matrices. Supports matrices of any size.',
    color: 'blue',
    hue: 264,
    shadowRgb: '59,130,246',
  },
  {
    symbol: '×',
    symbolIsMono: false,
    title: 'Matrix Multiplication',
    description: 'Compute matrix products with automatic dimension checking.',
    color: 'purple',
    hue: 300,
    shadowRgb: '168,85,247',
  },
  {
    symbol: '|A|',
    symbolIsMono: true,
    title: 'Determinant',
    description: 'Calculate determinants using LU decomposition for square matrices.',
    color: 'emerald',
    hue: 155,
    shadowRgb: '16,185,129',
  },
  {
    symbol: 'A⁻¹',
    symbolIsMono: true,
    title: 'Matrix Inverse',
    description:
      'Find inverses using Gauss-Jordan elimination. Handles singular matrices gracefully.',
    color: 'rose',
    hue: 0,
    shadowRgb: '244,63,94',
  },
  {
    symbol: 'Aᵀ',
    symbolIsMono: true,
    title: 'Transpose',
    description: 'Transpose matrices to swap rows and columns.',
    color: 'amber',
    hue: 60,
    shadowRgb: '245,158,11',
  },
  {
    symbol: 'I',
    symbolIsMono: false,
    title: 'Special Matrices',
    description: 'Create identity, zero, ones, and random matrices.',
    color: 'cyan',
    hue: 200,
    shadowRgb: '6,182,212',
  },
];

/** Stagger container: reveals children one-by-one on mount */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/** Individual card: fades up into place */
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

export function MatrixFeatureCards() {
  return (
    <m.div
      className="grid gap-6 md:grid-cols-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {FEATURE_CARDS.map((card) => (
        <m.div
          key={card.title}
          variants={cardVariants}
          className="group relative p-6 rounded-xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 backdrop-blur-md"
          style={{
            background: `linear-gradient(135deg, oklch(0.18 0.03 ${card.hue} / 0.5), oklch(0.16 0.025 ${card.hue} / 0.4))`,
            borderColor: `oklch(0.65 0.20 ${card.hue} / 0.4)`,
            boxShadow: `0 0 20px rgba(${card.shadowRgb}, 0.18)`,
          }}
        >
          {/* Hover shimmer overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
            style={{
              background: `linear-gradient(135deg, oklch(0.65 0.20 ${card.hue} / 0.07), transparent)`,
            }}
          />

          {/* Corner accent radial */}
          <div
            className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle at top right, oklch(0.65 0.20 ${card.hue} / 0.5), transparent)`,
            }}
          />

          {/* Content */}
          <div className="relative min-w-0">
            {/* Glowing dot + title */}
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: `oklch(0.65 0.20 ${card.hue})`,
                  boxShadow: `0 0 8px oklch(0.65 0.20 ${card.hue} / 0.8)`,
                }}
              />
              <span
                className={`text-lg font-mono font-bold shrink-0${card.symbolIsMono ? '' : ' not-italic'}`}
                style={{ color: `oklch(0.75 0.20 ${card.hue})` }}
                aria-hidden="true"
              >
                {card.symbol}
              </span>
              <h3
                className="text-base font-semibold truncate"
                style={{ color: `oklch(0.80 0.16 ${card.hue})` }}
              >
                {card.title}
              </h3>
            </div>

            <p
              className="text-sm leading-relaxed"
              style={{ color: `oklch(0.74 0.08 ${card.hue})` }}
            >
              {card.description}
            </p>
          </div>
        </m.div>
      ))}
    </m.div>
  );
}
