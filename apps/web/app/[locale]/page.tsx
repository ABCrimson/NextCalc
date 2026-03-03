'use client';

import { m } from 'framer-motion';
import { Grid3x3, Infinity, Ruler, Sparkles, Square, TrendingUp, Variable } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { type CSSProperties, Suspense } from 'react';
import { Link } from '@/i18n/navigation';

const InstallPWA = dynamic(
  () => import('@/components/install-pwa').then((mod) => ({ default: mod.InstallPWA })),
  {
    ssr: false,
  },
);

// Dynamic import for Calculator with client-only rendering
// This prevents Radix UI tabs from generating different IDs on server vs client
const Calculator = dynamic(
  () => import('@/components/calculator/calculator').then((mod) => ({ default: mod.Calculator })),
  {
    ssr: false,
    loading: () => (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-xl" />
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    ),
  },
);

type FeatureCard = {
  href: string;
  icon: typeof TrendingUp;
  titleKey: string;
  subtitleKey: string;
  accentClass: string;
  iconBg: string;
  glowColor: string;
};

const featureCards: FeatureCard[] = [
  {
    href: '/plot',
    icon: TrendingUp,
    titleKey: 'home.feature.plotFunctions',
    subtitleKey: 'home.feature.plotFunctionsSubtitle',
    accentClass: 'text-blue-300',
    iconBg: 'bg-blue-500/20 group-hover:bg-blue-500/30',
    glowColor: 'rgba(59,130,246,0.35)',
  },
  {
    href: '/symbolic',
    icon: Variable,
    titleKey: 'home.feature.symbolicMath',
    subtitleKey: 'home.feature.symbolicMathSubtitle',
    accentClass: 'text-purple-300',
    iconBg: 'bg-purple-500/20 group-hover:bg-purple-500/30',
    glowColor: 'rgba(168,85,247,0.35)',
  },
  {
    href: '/matrix',
    icon: Grid3x3,
    titleKey: 'home.feature.matrixOps',
    subtitleKey: 'home.feature.matrixOpsSubtitle',
    accentClass: 'text-emerald-300',
    iconBg: 'bg-emerald-500/20 group-hover:bg-emerald-500/30',
    glowColor: 'rgba(16,185,129,0.35)',
  },
  {
    href: '/solver',
    icon: Square,
    titleKey: 'home.feature.equationSolver',
    subtitleKey: 'home.feature.equationSolverSubtitle',
    accentClass: 'text-rose-300',
    iconBg: 'bg-rose-500/20 group-hover:bg-rose-500/30',
    glowColor: 'rgba(244,63,94,0.35)',
  },
  {
    href: '/units',
    icon: Ruler,
    titleKey: 'home.feature.unitConverter',
    subtitleKey: 'home.feature.unitConverterSubtitle',
    accentClass: 'text-amber-300',
    iconBg: 'bg-amber-500/20 group-hover:bg-amber-500/30',
    glowColor: 'rgba(245,158,11,0.35)',
  },
  {
    href: '/algorithms',
    icon: Sparkles,
    titleKey: 'home.feature.algorithms',
    subtitleKey: 'home.feature.algorithmsSubtitle',
    accentClass: 'text-cyan-300',
    iconBg: 'bg-cyan-500/20 group-hover:bg-cyan-500/30',
    glowColor: 'rgba(6,182,212,0.35)',
  },
  {
    href: '/complex',
    icon: Infinity,
    titleKey: 'home.feature.complexNumbers',
    subtitleKey: 'home.feature.complexNumbersSubtitle',
    accentClass: 'text-violet-300',
    iconBg: 'bg-violet-500/20 group-hover:bg-violet-500/30',
    glowColor: 'rgba(139,92,246,0.35)',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 18,
    },
  },
};

export default function Home() {
  const t = useTranslations();

  return (
    <main className="min-h-screen py-12 px-4 relative overflow-hidden">
      {/* Mesh gradient background with animated layers */}
      <div
        className="fixed inset-0 -z-10 animate-mesh"
        style={{
          background: `
            radial-gradient(at 20% 30%, oklch(0.55 0.27 264 / 0.08) 0%, transparent 50%),
            radial-gradient(at 80% 70%, oklch(0.58 0.22 300 / 0.06) 0%, transparent 50%),
            radial-gradient(at 50% 50%, oklch(0.65 0.20 155 / 0.05) 0%, transparent 50%)
          `,
        }}
      />
      {/* Noise texture overlay */}
      <div className="fixed inset-0 -z-10 noise pointer-events-none" />

      <div className="container mx-auto max-w-7xl">
        {/* Hero Section */}
        <m.header
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="inline-block mb-4 relative">
            <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-calculator-operator to-calculator-equals bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              {t('home.hero.title' as Parameters<typeof t>[0])}
            </h1>
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-calculator-operator to-calculator-equals rounded-full mt-3 shadow-lg shadow-primary/50 animate-pulse" />
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.rich('home.hero.subtitle' as Parameters<typeof t>[0], {
              react: () => <span className="font-semibold text-foreground">React 19.3.0</span>,
              nextjs: () => <span className="font-semibold text-foreground">Next.js 16.2.0</span>,
            })}
          </p>

          {/* Tech Badges with staggered entrance and shimmer */}
          <m.div
            className="flex flex-wrap items-center justify-center gap-3 mt-6 text-sm font-medium"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <m.div
              variants={badgeVariants}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/60 transition-all duration-300 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="relative z-10">{t('common.live' as Parameters<typeof t>[0])}</span>
            </m.div>
            <m.div
              variants={badgeVariants}
              className="group relative px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <span className="relative z-10">TypeScript 6.0</span>
            </m.div>
            <m.div
              variants={badgeVariants}
              className="group relative px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/60 transition-all duration-300 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <span className="relative z-10">Tailwind 4.2.0</span>
            </m.div>
            <m.div
              variants={badgeVariants}
              className="group relative px-4 py-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-600 text-white shadow-lg shadow-rose-500/40 hover:shadow-xl hover:shadow-rose-500/60 transition-all duration-300 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <span className="relative z-10">Turbopack</span>
            </m.div>
          </m.div>
        </m.header>

        {/* Suspense boundary for calculator */}
        <Suspense
          fallback={
            <div className="max-w-3xl mx-auto p-6">
              <div className="animate-pulse space-y-6">
                <div className="h-32 bg-muted rounded-xl" />
                <div className="grid grid-cols-5 gap-3">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted rounded-2xl" />
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <Calculator />
        </Suspense>

        {/* Quick Links to Advanced Features - Bento Grid */}
        <div className="mt-12 flex flex-col items-center gap-6">
          <m.div
            className="text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-2xl font-semibold mb-2">
              {t('home.explore.title' as Parameters<typeof t>[0])}
            </h2>
            <p className="text-muted-foreground">
              {t('home.explore.subtitle' as Parameters<typeof t>[0])}
            </p>
          </m.div>

          {/* Bento grid with varying card sizes */}
          <m.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl auto-rows-[minmax(120px,auto)]"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {featureCards.map((card, index) => {
              const Icon = card.icon;
              // First two cards span wider on larger screens for bento layout variation
              const isLarge = index < 2;
              return (
                <m.div
                  key={card.href}
                  variants={cardVariants}
                  className={isLarge ? 'lg:col-span-1' : ''}
                >
                  <Link
                    href={card.href}
                    className="group relative block h-full p-6 rounded-2xl glass-heavy noise cursor-pointer
                      transition-all duration-500 ease-out
                      hover:shadow-[0_0_30px_var(--_glow)] hover:-translate-y-1"
                    style={
                      {
                        '--_glow': card.glowColor,
                      } as CSSProperties
                    }
                  >
                    {/* Animated glow border on hover */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{
                        boxShadow: `inset 0 0 0 1px ${card.glowColor}, 0 0 20px ${card.glowColor}`,
                      }}
                    />
                    <div className="relative flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl ${card.iconBg} transition-colors duration-300`}
                      >
                        <Icon
                          className={`h-6 w-6 ${card.accentClass} group-hover:scale-110 transition-transform duration-300`}
                        />
                      </div>
                      <div className="flex flex-col items-start">
                        <span
                          className={`font-semibold ${card.accentClass} group-hover:brightness-125 transition-all duration-300`}
                        >
                          {t(card.titleKey as Parameters<typeof t>[0])}
                        </span>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {t(card.subtitleKey as Parameters<typeof t>[0])}
                        </span>
                      </div>
                    </div>
                  </Link>
                </m.div>
              );
            })}
          </m.div>
        </div>

        {/* Modern minimal footer with gradient divider */}
        <footer className="mt-16">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent mb-6" />
          <p className="text-center text-sm text-muted-foreground">
            {t('app.footer' as Parameters<typeof t>[0])}
          </p>
        </footer>
      </div>

      {/* PWA Install Prompt */}
      <InstallPWA />
    </main>
  );
}
