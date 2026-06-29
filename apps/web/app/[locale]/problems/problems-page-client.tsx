'use client';

import { m, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import type { ActionResult, ToggleFavoriteResult } from '@/app/actions/problems';
import { toggleFavorite } from '@/app/actions/problems';
import { ProblemBrowser } from '@/components/problems/problem-browser';
import { useRouter } from '@/i18n/navigation';
import type { Problem } from '@/types/problems';

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

export interface ProblemsPageStats {
  problems: number;
  topics: number;
  difficulties: number;
}

export interface ProblemsPageClientProps {
  problems: Problem[];
  stats: ProblemsPageStats;
}

// ---------------------------------------------------------------------------
// Helper: build the three glass-pill badge descriptors from real stats
// ---------------------------------------------------------------------------

function buildStatBadges(stats: ProblemsPageStats) {
  return [
    {
      label: `${stats.problems} Problem${stats.problems === 1 ? '' : 's'}`,
      color: 'oklch(0.65 0.22 264)',
    },
    {
      label: `${stats.topics} Topic${stats.topics === 1 ? '' : 's'}`,
      color: 'oklch(0.70 0.20 220)',
    },
    {
      label: `${stats.difficulties} Difficulty Level${stats.difficulties === 1 ? '' : 's'}`,
      color: 'oklch(0.72 0.18 200)',
    },
  ] as const;
}

// ---------------------------------------------------------------------------
// Client Component
// ---------------------------------------------------------------------------

/**
 * ProblemsPageClient
 *
 * Receives pre-fetched, mapped problems and real stats from the Server
 * Component wrapper. All animated UI, framer-motion, useRouter, and the
 * toggleFavorite server-action hook live here.
 *
 * Accessibility:
 * - All animations are disabled when the user prefers reduced motion.
 * - Decorative elements are aria-hidden.
 * - Landmark regions are properly labelled.
 */
export default function ProblemsPageClient({ problems, stats }: ProblemsPageClientProps) {
  const t = useTranslations('problems');
  const router = useRouter();
  const [_favoriteState, toggleFavoriteAction] = useActionState<
    ActionResult<ToggleFavoriteResult>,
    FormData
  >(toggleFavorite, { success: false });

  const prefersReducedMotion = useReducedMotion();

  const heroInitial = {
    opacity: 0,
    ...(prefersReducedMotion ? {} : { y: 24 }),
  };

  const heroAnimate = {
    opacity: 1,
    ...(prefersReducedMotion ? {} : { y: 0 }),
  };

  const heroTransition = prefersReducedMotion
    ? { duration: 0.2 }
    : { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

  const orbAnimate1 = prefersReducedMotion
    ? {}
    : { x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.15, 0.95, 1] };

  const orbAnimate2 = prefersReducedMotion
    ? {}
    : { x: [0, -60, 80, 0], y: [0, 80, -30, 0], scale: [1, 1.1, 1.2, 1] };

  const orbAnimate3 = prefersReducedMotion
    ? {}
    : { x: [0, 40, -80, 0], y: [0, -40, 60, 0], scale: [1, 0.9, 1.1, 1] };

  const quickStats = buildStatBadges(stats);

  return (
    <div className="relative min-h-screen">
      {/* ----------------------------------------------------------------
          Animated background layer — fixed, pointer-events-none
      ---------------------------------------------------------------- */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Base dark-to-transparent gradient so orbs sit on the page bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

        {/* Orb 1 — indigo, top-right quadrant */}
        <m.div
          className="absolute top-[-10%] right-[-5%] w-[560px] h-[560px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.55 0.27 264 / 0.18) 0%, oklch(0.55 0.27 264 / 0.04) 60%, transparent 100%)',
          }}
          animate={orbAnimate1}
          transition={
            prefersReducedMotion
              ? {}
              : {
                  duration: 22,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }
          }
        />

        {/* Orb 2 — blue, bottom-left quadrant */}
        <m.div
          className="absolute bottom-[-15%] left-[-10%] w-[640px] h-[640px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.60 0.22 230 / 0.16) 0%, oklch(0.60 0.22 230 / 0.04) 60%, transparent 100%)',
          }}
          animate={orbAnimate2}
          transition={
            prefersReducedMotion
              ? {}
              : {
                  duration: 28,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }
          }
        />

        {/* Orb 3 — cyan, center */}
        <m.div
          className="absolute top-[35%] left-[40%] w-[420px] h-[420px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.70 0.18 200 / 0.12) 0%, oklch(0.70 0.18 200 / 0.03) 60%, transparent 100%)',
          }}
          animate={orbAnimate3}
          transition={
            prefersReducedMotion
              ? {}
              : {
                  duration: 18,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }
          }
        />

        {/* SVG noise texture overlay at 3% opacity */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.03, mixBlendMode: 'overlay' }}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <filter id="problems-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={4}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#problems-noise)" />
        </svg>
      </div>

      {/* ----------------------------------------------------------------
          Page content
      ---------------------------------------------------------------- */}
      <div className="container mx-auto py-10 px-4 relative">
        {/* Hero section — glass morphism card with entrance animation */}
        <m.div
          initial={heroInitial}
          animate={heroAnimate}
          transition={heroTransition}
          className="mb-10"
        >
          <div
            className="backdrop-blur-md bg-card/50 border border-border rounded-2xl p-8"
            style={{
              boxShadow:
                '0 4px 32px oklch(0.55 0.27 264 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.06)',
            }}
          >
            {/* Heading */}
            <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, oklch(0.72 0.20 264) 0%, oklch(0.70 0.20 230) 50%, oklch(0.75 0.18 200) 100%)',
                }}
              >
                {t('title')}
              </span>
            </h1>

            {/* Gradient underline accent */}
            <div
              className="h-0.5 w-28 mb-4 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, oklch(0.72 0.20 264), oklch(0.70 0.20 230), oklch(0.75 0.18 200))',
              }}
              aria-hidden="true"
            />

            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mb-6">
              {t('heroDescription')}
            </p>

            {/* Quick stats badges — populated from real DB data */}
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Library statistics">
              {quickStats.map(({ label, color }) => (
                <li
                  key={label}
                  className="inline-flex items-center text-sm font-medium px-4 py-1.5 rounded-full border"
                  style={{
                    background: `${color.replace(')', ' / 0.10)')}`,
                    borderColor: `${color.replace(')', ' / 0.28)')}`,
                    color,
                  }}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </m.div>

        {/* ProblemBrowser wrapped in a glass morphism card */}
        <m.div
          initial={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 32 }) }}
          animate={{ opacity: 1, ...(prefersReducedMotion ? {} : { y: 0 }) }}
          transition={
            prefersReducedMotion
              ? { duration: 0.2 }
              : {
                  duration: 0.6,
                  delay: 0.15,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                }
          }
        >
          <div
            className="backdrop-blur-md bg-card/30 border border-border rounded-2xl p-6"
            style={{
              boxShadow:
                '0 4px 24px oklch(0.55 0.27 264 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.04)',
            }}
          >
            <ProblemBrowser
              problems={problems}
              onProblemSelect={(problem) => {
                router.push(`/problems/${problem.id}`);
              }}
              onToggleFavorite={(problemId) => {
                const fd = new FormData();
                fd.set('problemId', problemId);
                toggleFavoriteAction(fd);
              }}
              showFavorites
            />
          </div>
        </m.div>
      </div>
    </div>
  );
}
