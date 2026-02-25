'use client';

import { ProblemBrowser } from '@/components/problems/problem-browser';
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Problem } from '@/types/problems';

/**
 * Mock problem data - In production, fetch from API
 */
const mockProblems: Problem[] = [
  {
    id: '1',
    title: 'Quadratic Equation Solver',
    description: 'Find the roots of a quadratic equation using the quadratic formula.',
    difficulty: 'beginner',
    topics: ['algebra'],
    status: 'completed',
    isFavorite: true,
    attempts: 150,
    successRate: 85,
    averageTime: 180,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: '2',
    title: 'Derivative of Composite Functions',
    description: 'Apply the chain rule to find derivatives of composite functions.',
    difficulty: 'intermediate',
    topics: ['calculus'],
    status: 'attempted',
    isFavorite: false,
    attempts: 98,
    successRate: 72,
    averageTime: 240,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: '3',
    title: 'Topological Spaces',
    description: 'Prove basic properties of topological spaces and continuous functions.',
    difficulty: 'master',
    topics: ['topology'],
    status: 'unattempted',
    isFavorite: false,
    attempts: 45,
    successRate: 58,
    averageTime: 600,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '4',
    title: 'Matrix Eigenvalues',
    description: 'Calculate eigenvalues and eigenvectors of a given matrix.',
    difficulty: 'advanced',
    topics: ['linear-algebra'],
    status: 'unattempted',
    isFavorite: true,
    attempts: 120,
    successRate: 65,
    averageTime: 420,
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-22'),
  },
  {
    id: '5',
    title: 'Combinatorial Counting',
    description: 'Solve counting problems using permutations and combinations.',
    difficulty: 'intermediate',
    topics: ['combinatorics'],
    status: 'completed',
    isFavorite: false,
    attempts: 200,
    successRate: 78,
    averageTime: 300,
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-25'),
  },
  {
    id: '6',
    title: 'Number Theory: Primes',
    description: 'Prove theorems about prime numbers and divisibility.',
    difficulty: 'advanced',
    topics: ['number-theory'],
    status: 'attempted',
    isFavorite: true,
    attempts: 85,
    successRate: 60,
    averageTime: 480,
    createdAt: new Date('2024-01-07'),
    updatedAt: new Date('2024-01-19'),
  },
];

/**
 * Quick stats displayed as glass-morphism pill badges beneath the heading.
 */
const QUICK_STATS = [
  { label: '6 Problems', color: 'oklch(0.65 0.22 264)' },
  { label: '4 Topics', color: 'oklch(0.70 0.20 220)' },
  { label: '4 Difficulty Levels', color: 'oklch(0.72 0.18 200)' },
] as const;

/**
 * Problems Browser Page
 *
 * Client component with animated background orbs, SVG noise texture overlay,
 * glass-morphism hero section, and entrance animations.
 *
 * Accessibility:
 * - All animations are disabled when the user prefers reduced motion.
 * - Decorative elements are aria-hidden.
 * - Landmark regions are properly labelled.
 */
export default function ProblemsPage() {
  const problems = useMemo(() => mockProblems, []);
  const prefersReducedMotion = useReducedMotion();

  // When the user prefers reduced motion we skip translate animations entirely
  // but still fade in (opacity is generally safe). We use the spread pattern
  // required by TypeScript 6.0 exactOptionalPropertyTypes.
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

  // Floating orb animation — disabled for reduced-motion users
  const orbAnimate1 = prefersReducedMotion
    ? {}
    : { x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.15, 0.95, 1] };

  const orbAnimate2 = prefersReducedMotion
    ? {}
    : { x: [0, -60, 80, 0], y: [0, 80, -30, 0], scale: [1, 1.1, 1.2, 1] };

  const orbAnimate3 = prefersReducedMotion
    ? {}
    : { x: [0, 40, -80, 0], y: [0, -40, 60, 0], scale: [1, 0.9, 1.1, 1] };

  return (
    <div className="relative min-h-screen">
      {/* ----------------------------------------------------------------
          Animated background layer — fixed, pointer-events-none
      ---------------------------------------------------------------- */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {/* Base dark-to-transparent gradient so orbs sit on the page bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

        {/* Orb 1 — indigo, top-right quadrant */}
        <motion.div
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
        <motion.div
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
        <motion.div
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
        <motion.div
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
                Problem Library
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
              Explore our comprehensive collection of mathematical problems. Filter by topic,
              difficulty, and type to find the perfect challenge.
            </p>

            {/* Quick stats badges */}
            <div
              className="flex flex-wrap gap-2"
              aria-label="Library statistics"
            >
              {QUICK_STATS.map(({ label, color }) => (
                <span
                  key={label}
                  className="inline-flex items-center text-sm font-medium px-4 py-1.5 rounded-full border"
                  style={{
                    background: `${color.replace(')', ' / 0.10)')}`,
                    borderColor: `${color.replace(')', ' / 0.28)')}`,
                    color,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ProblemBrowser wrapped in a glass morphism card */}
        <motion.div
          initial={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 32 }) }}
          animate={{ opacity: 1, ...(prefersReducedMotion ? {} : { y: 0 }) }}
          transition={
            prefersReducedMotion
              ? { duration: 0.2 }
              : { duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
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
                window.location.href = `/problems/${problem.id}`;
              }}
              onToggleFavorite={(_problemId) => {
                // TODO: integrate bookmark toggle with auth/database
              }}
              showFavorites
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
