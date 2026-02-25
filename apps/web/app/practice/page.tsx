'use client';

import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PracticeMode, type PracticeMetrics } from '@/components/math/practice-mode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Timer, Zap, TrendingUp, Play, Settings } from 'lucide-react';
import {
  getAllProblems,
  getProblemsByTopic,
  DifficultyLevel,
  type Problem,
} from '@nextcalc/math-engine/problems';
import type { MathTopic } from '@nextcalc/math-engine/knowledge';

/**
 * Practice configuration state
 */
interface PracticeConfig {
  topic: MathTopic | 'all';
  difficulty: number | 'all';
  questionCount: number;
  timeLimit: number;
  adaptiveDifficulty: boolean;
}

// ─── Animation Variants ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
} as const;

const heroVariants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
} as const;

// ─── Stat Card Data ────────────────────────────────────────────────────────────

interface StatCardData {
  label: string;
  value: string;
  subLabel: string;
  Icon: typeof Target;
  /** OKLCH hue for the icon accent */
  hue: number;
  /** OKLCH chroma for the icon accent */
  chroma: number;
}

const STAT_CARDS: StatCardData[] = [
  {
    label: 'Your Best',
    value: '95%',
    subLabel: 'Accuracy',
    Icon: Target,
    hue: 55,
    chroma: 0.22,
  },
  {
    label: 'Sessions',
    value: '23',
    subLabel: 'Completed',
    Icon: Timer,
    hue: 25,
    chroma: 0.22,
  },
  {
    label: 'Streak',
    value: '7',
    subLabel: 'Days',
    Icon: Zap,
    hue: 300,
    chroma: 0.20,
  },
  {
    label: 'Improvement',
    value: '+15%',
    subLabel: 'This week',
    Icon: TrendingUp,
    hue: 145,
    chroma: 0.20,
  },
];

// ─── Animated Background Orbs ─────────────────────────────────────────────────

function AnimatedBackground({ prefersReduced }: { prefersReduced: boolean }) {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Orb 1 — orange, top-left quadrant */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.72 0.22 55 / 0.18) 0%, transparent 70%)',
          top: '-10%',
          left: '-5%',
        }}
        {...(prefersReduced
          ? {}
          : {
              animate: {
                x: [0, 40, -20, 0],
                y: [0, -30, 20, 0],
              },
              transition: {
                duration: 18,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            })}
      />

      {/* Orb 2 — amber/rose, bottom-right quadrant */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.70 0.20 25 / 0.14) 0%, transparent 70%)',
          bottom: '-15%',
          right: '-10%',
        }}
        {...(prefersReduced
          ? {}
          : {
              animate: {
                x: [0, -50, 30, 0],
                y: [0, 40, -25, 0],
              },
              transition: {
                duration: 22,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 3,
              },
            })}
      />

      {/* Orb 3 — rose/pink, center-upper area */}
      <motion.div
        className="absolute w-[380px] h-[380px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.68 0.18 0 / 0.12) 0%, transparent 70%)',
          top: '35%',
          left: '45%',
        }}
        {...(prefersReduced
          ? {}
          : {
              animate: {
                x: [0, 30, -40, 0],
                y: [0, -20, 35, 0],
              },
              transition: {
                duration: 26,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 7,
              },
            })}
      />

      {/* SVG noise texture overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.03, mixBlendMode: 'overlay' }}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <filter id="practice-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={4}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#practice-noise)" />
      </svg>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ data }: { data: StatCardData }) {
  const { Icon, label, value, subLabel, hue, chroma } = data;

  const iconBg = `oklch(0.72 ${chroma} ${hue} / 0.15)`;
  const iconBorder = `oklch(0.72 ${chroma} ${hue} / 0.25)`;
  const iconColor = `oklch(0.72 ${chroma} ${hue})`;
  const hoverGlow = `0 0 28px oklch(0.72 ${chroma} ${hue} / 0.20)`;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Card
        className="backdrop-blur-md bg-card/50 border-border hover:border-border/80 transition-all duration-300"
        style={
          {
            '--hover-glow': hoverGlow,
          } as CSSProperties
        }
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = hoverGlow;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 font-semibold">
            {/* Icon with gradient background */}
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{
                background: iconBg,
                border: `1px solid ${iconBorder}`,
              }}
              aria-hidden="true"
            >
              <Icon
                className="h-4 w-4"
                style={{ color: iconColor }}
              />
            </span>
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{value}</div>
          <p className="text-sm text-muted-foreground mt-1">{subLabel}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Practice Page ─────────────────────────────────────────────────────────────

/**
 * Practice Mode Page
 *
 * Client component for practice session setup and execution.
 *
 * Accessibility:
 * - Keyboard navigation through all form controls
 * - Focus rings on all interactive elements (focus-visible)
 * - Respects prefers-reduced-motion for all animations
 * - Semantic form structure with associated labels
 * - Screen reader announcements via aria-live on the empty-state region
 */
export default function PracticePage() {
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [problems, setProblems] = useState<ReadonlyArray<Problem>>([]);
  const [config, setConfig] = useState<PracticeConfig>({
    topic: 'all',
    difficulty: 'all',
    questionCount: 10,
    timeLimit: 60,
    adaptiveDifficulty: false,
  });

  const prefersReduced = useReducedMotion() ?? false;

  // Load problems from math-engine's in-memory problem database.
  // Applies topic and difficulty filters from the session config, then
  // randomly samples up to questionCount problems so every session feels fresh.
  const loadProblems = useCallback((): ReadonlyArray<Problem> => {
    let pool: ReadonlyArray<Problem>;

    if (config.topic !== 'all') {
      pool = getProblemsByTopic(config.topic as MathTopic);
    } else {
      pool = getAllProblems();
    }

    if (config.difficulty !== 'all') {
      pool = pool.filter(
        (p) => p.difficulty === (config.difficulty as DifficultyLevel),
      );
    }

    // Shuffle and cap at the requested question count.
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, config.questionCount);
  }, [config.topic, config.difficulty, config.questionCount]);

  const handleStartPractice = useCallback(() => {
    const loaded = loadProblems();
    setProblems(loaded);
    setIsConfiguring(false);
  }, [loadProblems]);

  const handleComplete = useCallback(
    (_metrics: PracticeMetrics) => {
      // TODO: save metrics to database and show results
      // router.push('/practice/results');
    },
    []
  );

  // ── Empty state (no matching problems) ─────────────────────────────────────
  if (!isConfiguring) {
    if (problems.length === 0) {
      return (
        <div
          className="container mx-auto py-8 px-4 text-center"
          role="status"
          aria-live="polite"
        >
          <p className="text-lg text-muted-foreground mb-4">
            No problems found for the selected filters. Try a different topic or difficulty.
          </p>
          <Button
            onClick={() => setIsConfiguring(true)}
            variant="outline"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Back to Configuration
          </Button>
        </div>
      );
    }

    return (
      <div className="container mx-auto py-8 px-4">
        <PracticeMode
          problems={problems}
          config={{
            timeLimit: config.timeLimit,
            questionCount: config.questionCount,
            ...(config.topic !== 'all' ? { topic: config.topic } : {}),
            adaptiveDifficulty: config.adaptiveDifficulty,
          }}
          onComplete={handleComplete}
          onPause={() => {}}
          onResume={() => {}}
        />
      </div>
    );
  }

  // ── Configuration UI ────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen">
      <AnimatedBackground prefersReduced={prefersReduced} />

      <div className="container mx-auto py-8 px-4">
        {/* Hero Section */}
        <motion.div
          className="mb-12 text-center"
          {...(prefersReduced
            ? {}
            : {
                initial: heroVariants.hidden,
                animate: heroVariants.visible,
              })}
        >
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border"
            style={{
              background: 'oklch(0.72 0.22 55 / 0.10)',
              borderColor: 'oklch(0.72 0.22 55 / 0.25)',
            }}
          >
            <Target
              className="h-4 w-4"
              style={{ color: 'oklch(0.72 0.22 55)' }}
              aria-hidden="true"
            />
            <span
              className="text-sm font-medium"
              style={{ color: 'oklch(0.72 0.22 55)' }}
            >
              Skill Training
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
              Practice Mode
            </span>
          </h1>

          {/* Gradient underline accent */}
          <div
            className="h-1 w-24 mx-auto rounded-full mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.72 0.22 55), oklch(0.70 0.20 25), oklch(0.68 0.18 0))',
            }}
            aria-hidden="true"
          />

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Test your skills with timed practice sessions. Track your progress and improve your problem-solving speed.
          </p>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          {...(prefersReduced
            ? {}
            : {
                initial: 'hidden',
                whileInView: 'visible',
                viewport: { once: true },
                variants: containerVariants,
              })}
          aria-label="Your practice statistics"
        >
          {STAT_CARDS.map((data) => (
            <StatCard key={data.label} data={data} />
          ))}
        </motion.div>

        {/* Configuration Form */}
        <div className="max-w-3xl mx-auto">
          <motion.div
            {...(prefersReduced
              ? {}
              : {
                  initial: 'hidden',
                  whileInView: 'visible',
                  viewport: { once: true },
                  variants: {
                    hidden: { opacity: 0, y: 32 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
                    },
                  },
                })}
          >
            <Card
              className="backdrop-blur-md bg-card/50 border-border"
              style={{
                boxShadow: '0 0 0 1px oklch(0.72 0.22 55 / 0.08) inset, 0 8px 32px oklch(0.72 0.22 55 / 0.08)',
              }}
            >
              {/* Gradient top border accent */}
              <div
                className="h-[2px] w-full rounded-t-xl"
                style={{
                  background: 'linear-gradient(90deg, oklch(0.72 0.22 55 / 0.6), oklch(0.70 0.20 25 / 0.6), oklch(0.68 0.18 0 / 0.4), transparent)',
                }}
                aria-hidden="true"
              />

              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
                    style={{
                      background: 'oklch(0.72 0.22 55 / 0.12)',
                      border: '1px solid oklch(0.72 0.22 55 / 0.25)',
                    }}
                    aria-hidden="true"
                  >
                    <Settings
                      className="h-5 w-5"
                      style={{ color: 'oklch(0.72 0.22 55)' }}
                    />
                  </span>
                  Configure Practice Session
                </CardTitle>
                <CardDescription>
                  Customize your practice session to match your learning goals
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Topic Selection */}
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Select
                    value={config.topic}
                    onValueChange={(value) =>
                      setConfig((prev) => ({ ...prev, topic: value as MathTopic | 'all' }))
                    }
                  >
                    <SelectTrigger
                      id="topic"
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      <SelectItem value="Calculus">Calculus</SelectItem>
                      <SelectItem value="Algebra">Algebra</SelectItem>
                      <SelectItem value="Linear Algebra">Linear Algebra</SelectItem>
                      <SelectItem value="Number Theory">Number Theory</SelectItem>
                      <SelectItem value="Topology">Topology</SelectItem>
                      <SelectItem value="Analysis">Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Difficulty Selection */}
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select
                    value={String(config.difficulty)}
                    onValueChange={(value) =>
                      setConfig((prev) => ({
                        ...prev,
                        difficulty: value === 'all' ? 'all' : Number(value),
                      }))
                    }
                  >
                    <SelectTrigger
                      id="difficulty"
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="1">Beginner</SelectItem>
                      <SelectItem value="2">Intermediate</SelectItem>
                      <SelectItem value="3">Advanced</SelectItem>
                      <SelectItem value="4">Expert</SelectItem>
                      <SelectItem value="5">Research</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Question Count */}
                <div className="space-y-2">
                  <Label htmlFor="questionCount">Number of Questions</Label>
                  <Select
                    value={String(config.questionCount)}
                    onValueChange={(value) =>
                      setConfig((prev) => ({ ...prev, questionCount: Number(value) }))
                    }
                  >
                    <SelectTrigger
                      id="questionCount"
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <SelectValue placeholder="Select question count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                      <SelectItem value="25">25 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Limit */}
                <div className="space-y-2">
                  <Label htmlFor="timeLimit">Time Limit per Question (seconds)</Label>
                  <Select
                    value={String(config.timeLimit)}
                    onValueChange={(value) =>
                      setConfig((prev) => ({ ...prev, timeLimit: Number(value) }))
                    }
                  >
                    <SelectTrigger
                      id="timeLimit"
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <SelectValue placeholder="Select time limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No Limit</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">60 seconds</SelectItem>
                      <SelectItem value="90">90 seconds</SelectItem>
                      <SelectItem value="120">2 minutes</SelectItem>
                      <SelectItem value="180">3 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Adaptive Difficulty */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="adaptive"
                    checked={config.adaptiveDifficulty}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, adaptiveDifficulty: e.target.checked }))
                    }
                    className="rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <Label htmlFor="adaptive" className="cursor-pointer">
                    <div>
                      <div className="font-semibold">Adaptive Difficulty</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically adjust difficulty based on your performance
                      </div>
                    </div>
                  </Label>
                </div>

                {/* Session Summary */}
                <Card
                  className="backdrop-blur-sm bg-muted/30 border-border"
                  style={{
                    boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.05)',
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Session Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Topic:</span>
                      <span className="font-semibold text-foreground">
                        {config.topic === 'all' ? 'All Topics' : config.topic}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Difficulty:</span>
                      <span className="font-semibold text-foreground">
                        {config.difficulty === 'all'
                          ? 'All Levels'
                          : ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Research'][
                              Number(config.difficulty) - 1
                            ]}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Questions:</span>
                      <span className="font-semibold text-foreground">{config.questionCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Limit:</span>
                      <span className="font-semibold text-foreground">
                        {config.timeLimit === 0
                          ? 'Unlimited'
                          : `${config.timeLimit} seconds per question`}
                      </span>
                    </div>
                    {config.adaptiveDifficulty && (
                      <motion.div
                        {...(prefersReduced
                          ? {}
                          : {
                              initial: { opacity: 0, height: 0 },
                              animate: { opacity: 1, height: 'auto' },
                              exit: { opacity: 0, height: 0 },
                              transition: { duration: 0.2 },
                            })}
                        className="flex items-center gap-2 mt-3 p-2 rounded border"
                        style={{
                          background: 'oklch(0.65 0.22 264 / 0.08)',
                          borderColor: 'oklch(0.65 0.22 264 / 0.25)',
                        }}
                      >
                        <Zap
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: 'oklch(0.65 0.22 264)' }}
                          aria-hidden="true"
                        />
                        <span className="text-sm text-foreground">Adaptive difficulty enabled</span>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                {/* Start Button */}
                <motion.div
                  {...(prefersReduced
                    ? {}
                    : {
                        whileHover: { scale: 1.01 },
                        whileTap: { scale: 0.99 },
                        transition: { duration: 0.15 },
                      })}
                >
                  <Button
                    onClick={handleStartPractice}
                    size="lg"
                    className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.60 0.22 55), oklch(0.58 0.20 25))',
                      boxShadow: '0 4px 20px oklch(0.60 0.22 55 / 0.30)',
                    }}
                  >
                    <Play className="h-5 w-5 mr-2" aria-hidden="true" />
                    Start Practice Session
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
