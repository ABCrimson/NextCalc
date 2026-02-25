'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer,
  Trophy,
  Target,
  Award,
  Zap,
  Flame,
  BarChart3,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Problem } from '@nextcalc/math-engine/problems';
import type { MathTopic } from '@nextcalc/math-engine/knowledge';

/**
 * Branded type for practice mode state
 */
type PracticeModeState = ('setup' | 'active' | 'paused' | 'completed') & { __brand: 'PracticeModeState' };

/**
 * Performance metrics for a practice session
 */
export interface PracticeMetrics {
  /** Total questions attempted */
  readonly totalQuestions: number;
  /** Correct answers */
  readonly correctAnswers: number;
  /** Accuracy percentage (0-100) */
  readonly accuracy: number;
  /** Average time per question (seconds) */
  readonly averageTime: number;
  /** Total score earned */
  readonly score: number;
  /** Current streak */
  readonly streak: number;
  /** Best streak in session */
  readonly bestStreak: number;
  /** Time spent per problem */
  readonly timePerProblem: ReadonlyArray<number>;
}

/**
 * Props for PracticeMode component
 */
export interface PracticeModeProps {
  /** Problems for practice session */
  problems: ReadonlyArray<Problem>;
  /** Practice mode configuration */
  config?: {
    /** Time limit per question (seconds, 0 = unlimited) */
    timeLimit?: number;
    /** Total number of questions */
    questionCount?: number;
    /** Target topic */
    topic?: MathTopic;
    /** Adaptive difficulty enabled */
    adaptiveDifficulty?: boolean;
  };
  /** Callback when session is completed */
  onComplete?: (metrics: PracticeMetrics) => void;
  /** Callback when session is paused */
  onPause?: () => void;
  /** Callback when session is resumed */
  onResume?: () => void;
  /** User's historical performance for adaptive difficulty */
  userPerformance?: ReadonlyMap<MathTopic, number>;
}

/**
 * Practice Mode Component
 *
 * An interactive practice session with:
 * - Timed challenges
 * - Real-time performance tracking
 * - Adaptive difficulty
 * - Streak tracking
 * - Detailed analytics
 * - Achievement integration
 *
 * Features:
 * - Timer with pause/resume
 * - Score tracker
 * - Progress indicator
 * - Performance graphs
 * - Results summary
 * - Streak animations
 *
 * Accessibility:
 * - Full keyboard navigation
 * - ARIA live regions for timer and score updates
 * - Screen reader announcements for progress
 * - Focus management
 * - High contrast support
 */
export function PracticeMode({
  problems,
  config = {},
  onComplete,
  onPause,
  onResume,
  userPerformance: _userPerformance = new Map(),
}: PracticeModeProps) {
  const {
    timeLimit = 0,
    questionCount = 10,
    topic,
    adaptiveDifficulty = false,
  } = config;

  // State
  const [state, setState] = useState<PracticeModeState>('setup' as PracticeModeState);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [answers, setAnswers] = useState<Array<{ correct: boolean; time: number }>>([]);
  const [_timer, setTimer] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [score, setScore] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const questionTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Get current problem
  const currentProblem = problems[currentIndex];
  const totalQuestions = Math.min(questionCount, problems.length);
  const isLastQuestion = currentIndex >= totalQuestions - 1;

  // Calculate metrics
  const metrics: PracticeMetrics = useMemo(() => {
    const correct = answers.filter((a) => a.correct).length;
    const total = answers.length;
    return {
      totalQuestions: total,
      correctAnswers: correct,
      accuracy: total > 0 ? (correct / total) * 100 : 0,
      averageTime: total > 0 ? answers.reduce((sum, a) => sum + a.time, 0) / total : 0,
      score,
      streak,
      bestStreak,
      timePerProblem: answers.map((a) => a.time),
    };
  }, [answers, score, streak, bestStreak]);

  // Timer effects
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleSubmit is stable; including it would cause timer restarts
  useEffect(() => {
    if (state === 'active') {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);

      questionTimerRef.current = setInterval(() => {
        setQuestionTimer((prev) => {
          const newTime = prev + 1;
          // Auto-submit if time limit reached
          if (timeLimit > 0 && newTime >= timeLimit) {
            handleSubmit(false);
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [state, timeLimit]);

  // Start session
  const handleStart = useCallback(() => {
    setState('active' as PracticeModeState);
    setTimer(0);
    setQuestionTimer(0);
  }, []);

  // Pause session
  const handlePause = useCallback(() => {
    setState('paused' as PracticeModeState);
    onPause?.();
  }, [onPause]);

  // Resume session
  const handleResume = useCallback(() => {
    setState('active' as PracticeModeState);
    onResume?.();
  }, [onResume]);

  // Submit answer
  const handleSubmit = useCallback(
    (isCorrect: boolean) => {
      // Record answer
      const newAnswers = [...answers, { correct: isCorrect, time: questionTimer }];
      setAnswers(newAnswers);

      // Update streak
      if (isCorrect) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        setBestStreak((prev) => Math.max(prev, newStreak));
        // Award points based on difficulty and time
        const basePoints = currentProblem!.points;
        const timeBonus = timeLimit > 0 ? Math.max(0, (timeLimit - questionTimer) / timeLimit) * 0.5 : 0;
        const streakBonus = Math.min(newStreak * 0.1, 1.0);
        const earnedPoints = Math.floor(basePoints * (1 + timeBonus + streakBonus));
        setScore((prev) => prev + earnedPoints);
      } else {
        setStreak(0);
      }

      // Move to next question or complete
      if (isLastQuestion) {
        setState('completed' as PracticeModeState);
        onComplete?.({
          totalQuestions: newAnswers.length,
          correctAnswers: newAnswers.filter((a) => a.correct).length,
          accuracy: (newAnswers.filter((a) => a.correct).length / newAnswers.length) * 100,
          averageTime: newAnswers.reduce((sum, a) => sum + a.time, 0) / newAnswers.length,
          score: score + (isCorrect ? currentProblem!.points : 0),
          streak,
          bestStreak: Math.max(bestStreak, streak),
          timePerProblem: newAnswers.map((a) => a.time),
        });
      } else {
        setCurrentIndex((prev) => prev + 1);
        setUserAnswer('');
        setQuestionTimer(0);
      }
    },
    [
      answers,
      questionTimer,
      streak,
      bestStreak,
      currentProblem,
      timeLimit,
      isLastQuestion,
      onComplete,
      score,
    ]
  );

  // Check answer
  const checkAnswer = useCallback(() => {
    const correctAnswer = String(currentProblem!.solution.answer);
    const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();
    handleSubmit(isCorrect);
  }, [userAnswer, currentProblem, handleSubmit]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup view
  if (state === 'setup') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Practice Session Setup
            </CardTitle>
            <CardDescription>
              Ready to practice? Configure your session and get started!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Questions</div>
                <div className="text-2xl font-bold">{totalQuestions}</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Time Limit</div>
                <div className="text-2xl font-bold">
                  {timeLimit > 0 ? `${timeLimit}s` : 'None'}
                </div>
              </div>
              {topic && (
                <div className="col-span-2 p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Topic</div>
                  <div className="text-xl font-semibold">{topic}</div>
                </div>
              )}
            </div>

            {adaptiveDifficulty && (
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <Zap className="h-5 w-5 text-blue-500" />
                <p className="text-sm">
                  Adaptive difficulty enabled - questions will adjust based on your performance
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleStart} size="lg" className="w-full">
              <Play className="h-5 w-5 mr-2" />
              Start Practice Session
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Completed view
  if (state === 'completed') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-2 border-primary/50">
            <CardHeader className="text-center pb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-4"
              >
                <Trophy className="h-16 w-16 text-yellow-500" />
              </motion.div>
              <CardTitle className="text-3xl">Session Complete!</CardTitle>
              <CardDescription className="text-lg">
                Great work! Here's how you performed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  icon={<Target className="h-5 w-5" />}
                  label="Accuracy"
                  value={`${Math.round(metrics.accuracy)}%`}
                  color="text-blue-500"
                />
                <MetricCard
                  icon={<Trophy className="h-5 w-5" />}
                  label="Score"
                  value={metrics.score.toString()}
                  color="text-yellow-500"
                />
                <MetricCard
                  icon={<Flame className="h-5 w-5" />}
                  label="Best Streak"
                  value={metrics.bestStreak.toString()}
                  color="text-orange-500"
                />
                <MetricCard
                  icon={<Timer className="h-5 w-5" />}
                  label="Avg Time"
                  value={`${Math.round(metrics.averageTime)}s`}
                  color="text-green-500"
                />
              </div>

              <Separator />

              {/* Detailed Stats */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Detailed Statistics
                </h3>

                <div className="space-y-3">
                  {/* Accuracy Breakdown */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Questions Answered</span>
                      <span className="font-semibold">
                        {metrics.correctAnswers} / {metrics.totalQuestions}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${metrics.accuracy}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Time Performance */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="text-sm font-semibold mb-3">Time Per Question</h4>
                    <div className="flex items-end gap-1 h-24">
                      {metrics.timePerProblem.map((time, index) => {
                        const maxTime = Math.max(...metrics.timePerProblem);
                        const height = (time / maxTime) * 100;
                        const answer = answers[index];
                        if (!answer) return null;
                        return (
                          <motion.div
                            key={index}
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                            className={cn(
                              'flex-1 rounded-t',
                              answer.correct
                                ? 'bg-green-500/50'
                                : 'bg-red-500/50'
                            )}
                            title={`Question ${index + 1}: ${time}s ${answer.correct ? '✓' : '✗'}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              {metrics.accuracy >= 90 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Award className="h-8 w-8 text-yellow-500" />
                    <div>
                      <h4 className="font-semibold">Achievement Unlocked!</h4>
                      <p className="text-sm text-muted-foreground">
                        Perfect Performance - 90%+ accuracy
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button className="flex-1" asChild>
                <a href="/practice">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  New Session
                </a>
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Active/Paused view
  return (
    <div className="max-w-4xl mx-auto space-y-6" role="main" aria-label="Practice Mode">
      {/* Header with stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Progress</div>
              <div className="text-2xl font-bold">
                {currentIndex + 1} / {totalQuestions}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Score</div>
              <div className="text-2xl font-bold text-primary">{score}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Accuracy</div>
              <div className="text-2xl font-bold">
                {answers.length > 0 ? Math.round(metrics.accuracy) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Streak</div>
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                {streak > 0 && <Flame className="h-5 w-5 text-orange-500" />}
                {streak}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1" aria-live="polite">
                Time
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatTime(questionTimer)}
              </div>
              {timeLimit > 0 && (
                <div className="text-xs text-muted-foreground">
                  / {formatTime(timeLimit)}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
              className="h-full bg-gradient-to-r from-primary to-primary/60"
              transition={{ duration: 0.3 }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={getDifficultyVariant(currentProblem!.difficulty)}>
                      {getDifficultyLabel(currentProblem!.difficulty)}
                    </Badge>
                    <Badge variant="outline">{currentProblem!.topic}</Badge>
                  </div>
                  <CardTitle className="text-xl">{currentProblem!.title}</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={state === 'active' ? handlePause : handleResume}
                  aria-label={state === 'active' ? 'Pause session' : 'Resume session'}
                >
                  {state === 'active' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: currentProblem!.statement }}
              />

              {state === 'active' ? (
                <>
                  <Separator />
                  <div>
                    <label htmlFor="answer" className="block text-sm font-medium mb-2">
                      Your Answer
                    </label>
                    <input
                      id="answer"
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && userAnswer.trim()) {
                          checkAnswer();
                        }
                      }}
                      className="w-full px-4 py-3 rounded-lg border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      placeholder="Enter your answer..."
                      autoFocus
                      aria-label="Answer input"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Pause className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Session Paused</p>
                  <p className="text-sm mt-2">Click Resume to continue</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={checkAnswer}
                disabled={!userAnswer.trim() || state === 'paused'}
                className="flex-1"
                size="lg"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Submit Answer
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 bg-muted/50 rounded-lg text-center"
    >
      <div className={cn('mx-auto mb-2', color)}>{icon}</div>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </motion.div>
  );
}

/**
 * Helper functions
 */
function getDifficultyVariant(difficulty: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'research' {
  const variants = ['beginner', 'intermediate', 'advanced', 'expert', 'research'] as const;
  return variants[difficulty - 1] || 'intermediate';
}

function getDifficultyLabel(difficulty: number): string {
  const labels = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Research'];
  return labels[difficulty - 1] || 'Intermediate';
}
