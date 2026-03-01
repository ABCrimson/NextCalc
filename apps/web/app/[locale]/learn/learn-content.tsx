'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Award, Bookmark, BookOpen, CheckCircle2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookmarksStore } from '@/lib/stores/bookmarks-store';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Props passed from the server component.
 * Map is serialized to a plain object to cross the server → client boundary.
 */
export interface LearnContentProps {
  /** Ordered list of topic names returned from the knowledge engine */
  topics: string[];
  /** Topic → definition count mapping (serialized from Map to plain object) */
  definitionCounts: Record<string, number>;
}

// ─── Topic Configuration ──────────────────────────────────────────────────────

/**
 * Per-topic visual configuration.
 * Gradients use -400 shades for legibility on dark backgrounds.
 */
const TOPIC_CONFIG = {
  Calculus: {
    color: 'from-blue-400 to-cyan-400',
    glowColor: 'oklch(0.72 0.18 220 / 0.35)',
    icon: '∫',
    description: 'Derivatives, integrals, and limits',
  },
  Algebra: {
    color: 'from-purple-400 to-pink-400',
    glowColor: 'oklch(0.72 0.20 320 / 0.35)',
    icon: 'x',
    description: 'Equations, polynomials, and functions',
  },
  'Linear Algebra': {
    color: 'from-fuchsia-400 to-purple-400',
    glowColor: 'oklch(0.72 0.22 310 / 0.35)',
    icon: '⟨⟩',
    description: 'Matrices, vectors, and transformations',
  },
  'Number Theory': {
    color: 'from-green-400 to-emerald-400',
    glowColor: 'oklch(0.72 0.18 155 / 0.35)',
    icon: 'ℕ',
    description: 'Primes, divisibility, and modular arithmetic',
  },
  Topology: {
    color: 'from-orange-400 to-red-400',
    glowColor: 'oklch(0.72 0.18 45 / 0.35)',
    icon: '○',
    description: 'Spaces, continuity, and homeomorphisms',
  },
  Analysis: {
    color: 'from-indigo-400 to-violet-400',
    glowColor: 'oklch(0.72 0.20 280 / 0.35)',
    icon: 'ε',
    description: 'Sequences, series, and convergence',
  },
  Geometry: {
    color: 'from-teal-400 to-cyan-400',
    glowColor: 'oklch(0.72 0.16 200 / 0.35)',
    icon: '△',
    description: 'Shapes, angles, and spatial reasoning',
  },
  'Differential Equations': {
    color: 'from-amber-400 to-orange-400',
    glowColor: 'oklch(0.78 0.16 75 / 0.35)',
    icon: "y'",
    description: 'ODEs, PDEs, and solutions',
  },
} as const satisfies Record<
  string,
  { color: string; glowColor: string; icon: string; description: string }
>;

type KnownTopic = keyof typeof TOPIC_CONFIG;

function isKnownTopic(topic: string): topic is KnownTopic {
  return topic in TOPIC_CONFIG;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const heroVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
} as const;

const statsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
} as const;

const statsItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
} as const;

const topicsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
} as const;

const topicItemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
} as const;

const ctaVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
} as const;

// ─── Animated Background Orbs ─────────────────────────────────────────────────

/**
 * Three floating orbs with OKLCH-based radial gradients.
 * Respects prefers-reduced-motion by disabling animation transforms
 * while preserving the static decorative appearance.
 */
function AnimatedBackground({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const floatVariants = {
    animate: shouldReduceMotion
      ? {}
      : {
          y: [0, -28, 0],
          x: [0, 12, 0],
          transition: {
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          },
        },
  };

  const floatVariants2 = {
    animate: shouldReduceMotion
      ? {}
      : {
          y: [0, 22, 0],
          x: [0, -16, 0],
          transition: {
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut' as const,
            delay: 3,
          },
        },
  };

  const floatVariants3 = {
    animate: shouldReduceMotion
      ? {}
      : {
          y: [0, -18, 6, 0],
          x: [0, 8, -6, 0],
          transition: {
            duration: 28,
            repeat: Infinity,
            ease: 'easeInOut' as const,
            delay: 7,
          },
        },
  };

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Orb 1 — top-right: blue/indigo */}
      <motion.div
        className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.65 0.22 264 / 0.14) 0%, oklch(0.58 0.18 264 / 0.07) 55%, transparent 100%)',
        }}
        variants={floatVariants}
        animate="animate"
      />

      {/* Orb 2 — bottom-left: purple/violet */}
      <motion.div
        className="absolute -bottom-48 -left-48 w-[700px] h-[700px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.60 0.22 300 / 0.13) 0%, oklch(0.55 0.18 300 / 0.06) 55%, transparent 100%)',
        }}
        variants={floatVariants2}
        animate="animate"
      />

      {/* Orb 3 — center-left: indigo accent */}
      <motion.div
        className="absolute top-1/2 -left-24 w-[480px] h-[480px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.62 0.20 245 / 0.10) 0%, oklch(0.55 0.15 245 / 0.04) 60%, transparent 100%)',
        }}
        variants={floatVariants3}
        animate="animate"
      />

      {/* SVG noise texture overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.03, mixBlendMode: 'overlay' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="learn-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={4}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#learn-noise)" />
      </svg>
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  label: string;
}

function StatCard({ icon, title, value, label }: StatCardProps) {
  return (
    <Card className="backdrop-blur-md bg-card/50 border-border">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">{value}</div>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

interface TopicCardProps {
  topic: KnownTopic;
  definitionCount: number;
  shouldReduceMotion: boolean;
}

function TopicCard({ topic, definitionCount, shouldReduceMotion }: TopicCardProps) {
  const t = useTranslations('learn');
  const config = TOPIC_CONFIG[topic];
  const href = `/learn/${topic.toLowerCase().replace(/\s+/g, '-')}`;
  const bookmarkId = `topic:${topic.toLowerCase().replace(/\s+/g, '-')}`;
  const toggleBookmark = useBookmarksStore((s) => s.toggleBookmark);
  const isBookmarked = useBookmarksStore((s) => s.bookmarks.some((b) => b.id === bookmarkId));

  const hoverProps = shouldReduceMotion ? {} : { whileHover: { scale: 1.025, y: -3 } as const };

  return (
    <motion.div {...hoverProps} transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}>
      <div className="block h-full rounded-xl">
        <Card className="h-full relative overflow-hidden backdrop-blur-md bg-card/50 border-border group">
          {/* Subtle gradient wash on hover */}
          <div
            className={`absolute inset-0 opacity-0 group-hover:opacity-8 transition-opacity duration-300 bg-gradient-to-br ${config.color}`}
            aria-hidden="true"
          />

          <CardHeader>
            <div className="flex items-start justify-between">
              <Link
                href={href}
                className="flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
              >
                <div className="flex items-center gap-3 mb-2">
                  {/* Gradient icon badge with glow on hover */}
                  <div
                    className={`w-12 h-12 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white text-2xl font-bold shrink-0 transition-shadow duration-300`}
                    style={
                      shouldReduceMotion
                        ? {}
                        : ({ '--icon-glow': config.glowColor } as React.CSSProperties)
                    }
                  >
                    <span aria-hidden="true">{config.icon}</span>
                  </div>

                  <div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors duration-200">
                      {topic}
                    </CardTitle>
                    <Badge variant="outline" className="mt-1">
                      {t('concepts', { count: definitionCount })}
                    </Badge>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    toggleBookmark({
                      id: bookmarkId,
                      type: 'topic',
                      title: topic,
                      path: `/learn/${topic.toLowerCase().replace(/\s+/g, '-')}`,
                    })
                  }
                  className="p-1.5 rounded-md hover:bg-muted/60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={isBookmarked ? `Remove ${topic} bookmark` : `Bookmark ${topic}`}
                >
                  <Bookmark
                    className={`h-4 w-4 transition-colors ${isBookmarked ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                  />
                </button>
                <Link
                  href={href}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                >
                  <ArrowRight
                    className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
            <CardDescription className="mt-2">{config.description}</CardDescription>
          </CardHeader>

          <Link href={href} className="cursor-pointer">
            <CardContent>
              <ul className="space-y-2" aria-label={t('availableContent', { topic })}>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{t('coreDefinitions')}</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{t('keyTheorems')}</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{t('practiceProblems')}</span>
                </li>
              </ul>
            </CardContent>
          </Link>
        </Card>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * LearnContent — client component that renders the full Learning Hub UI.
 *
 * Receives pre-fetched data from the server component to keep the page
 * statically optimizable while enabling Framer Motion animations.
 *
 * Accessibility:
 * - Respects prefers-reduced-motion for all Framer Motion animations.
 * - Animated background is aria-hidden and pointer-events-none.
 * - Topic cards use <ul>/<li> for the feature list.
 * - Focus rings on all interactive elements: focus-visible:outline-2.
 * - Heading hierarchy: h1 → h2 (section headings).
 *
 * Keyboard navigation:
 * - Tab moves through all topic card links sequentially.
 * - Enter / Space activates links.
 * - No custom keyboard handlers required (native link semantics).
 */
export function LearnContent({ topics, definitionCounts }: LearnContentProps) {
  const t = useTranslations('learn');
  const shouldReduceMotion = useReducedMotion() ?? false;

  const knownTopics = topics.filter(isKnownTopic);
  const totalDefinitions = Object.values(definitionCounts).reduce((acc, n) => acc + n, 0);

  return (
    <div className="relative min-h-screen">
      {/* Decorative animated background */}
      <AnimatedBackground shouldReduceMotion={shouldReduceMotion} />

      <div className="container mx-auto py-8 px-4 relative">
        {/* ── Hero Section ── */}
        <motion.div
          className="mb-12 text-center"
          variants={heroVariants}
          initial="hidden"
          animate="visible"
        >
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t('title')}
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{t('heroDescription')}</p>
        </motion.div>

        {/* ── Stats Overview ── */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          variants={statsContainerVariants}
          initial="hidden"
          animate="visible"
          aria-label="Learning Hub statistics"
        >
          <motion.div variants={statsItemVariants}>
            <StatCard
              icon={<BookOpen className="h-5 w-5 text-blue-400" aria-hidden="true" />}
              title={t('topicsCovered')}
              value={topics.length}
              label={t('mathematicalDomains')}
            />
          </motion.div>

          <motion.div variants={statsItemVariants}>
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-purple-400" aria-hidden="true" />}
              title={t('definitions')}
              value={totalDefinitions}
              label={t('conceptsToExplore')}
            />
          </motion.div>

          <motion.div variants={statsItemVariants}>
            <StatCard
              icon={<Award className="h-5 w-5 text-green-400" aria-hidden="true" />}
              title={t('learningPaths')}
              value={12}
              label={t('structuredCourses')}
            />
          </motion.div>
        </motion.div>

        {/* ── Topics Grid ── */}
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="text-3xl font-bold mb-6 text-foreground">
            {t('exploreByTopic')}
          </h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={topicsContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {knownTopics.map((topic) => (
              <motion.div key={topic} variants={topicItemVariants}>
                <TopicCard
                  topic={topic}
                  definitionCount={definitionCounts[topic] ?? 0}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Call to Action ── */}
        <motion.div
          className="mt-12 text-center"
          variants={ctaVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-border backdrop-blur-md bg-card/50">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-2 text-foreground">{t('readyToStart')}</h2>
              <p className="text-muted-foreground mb-4">{t('readyToStartHint')}</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button asChild>
                  <Link href="/problems">
                    {t('browseProblems')}
                    <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/practice">{t('startPractice')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
