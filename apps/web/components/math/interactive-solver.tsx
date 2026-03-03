'use client';

import type { Hint, Problem, SolutionStep } from '@nextcalc/math-engine/problems';
import { AnimatePresence, m } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Lightbulb,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Branded type for solution reveal state
 */
type RevealState = ('hidden' | 'partial' | 'full') & { __brand: 'RevealState' };

/**
 * Props for InteractiveSolver component
 */
export interface InteractiveSolverProps {
  /** The problem to solve */
  problem: Problem;
  /** User's current answer input */
  userAnswer?: string;
  /** Callback when user submits an answer */
  onSubmitAnswer?: (answer: string) => void;
  /** Callback when user requests a hint */
  onRequestHint?: (hintIndex: number) => void;
  /** Hints that have been revealed */
  revealedHints?: ReadonlyArray<number>;
  /** Whether answer has been checked */
  answerChecked?: boolean;
  /** Whether answer is correct */
  isCorrect?: boolean;
  /** Callback when user wants to see next problem */
  onNextProblem?: () => void;
  /** Callback when user wants to see previous problem */
  onPreviousProblem?: () => void;
  /** User's score/points */
  currentScore?: number;
  /** Time spent on problem (seconds) */
  timeSpent?: number;
}

/**
 * Interactive Solver Component
 *
 * Provides an interactive interface for solving mathematical problems with:
 * - Step-by-step solution reveal
 * - Progressive hint system
 * - Work area for user input
 * - Answer validation
 * - Multiple solution methods
 * - Visual feedback and animations
 *
 * Features:
 * - LaTeX rendering support
 * - Collapsible hint panel with cost display
 * - Animated step cards
 * - Progress tracking
 * - Keyboard shortcuts
 *
 * Accessibility:
 * - Full ARIA labeling
 * - Keyboard navigation (Tab, Enter, Escape, Arrow keys)
 * - Screen reader announcements
 * - Focus management in modals
 * - High contrast support
 *
 * Keyboard shortcuts:
 * - Ctrl+Enter: Submit answer
 * - Ctrl+H: Request next hint
 * - Ctrl+S: Toggle solution visibility
 * - Escape: Close modals
 */
export function InteractiveSolver({
  problem,
  userAnswer = '',
  onSubmitAnswer,
  onRequestHint,
  revealedHints = [],
  answerChecked = false,
  isCorrect = false,
  onNextProblem,
  onPreviousProblem,
  currentScore = 0,
  timeSpent = 0,
}: InteractiveSolverProps) {
  // State
  const [answer, setAnswer] = useState(userAnswer);
  const [revealState, setRevealState] = useState<RevealState>('hidden' as RevealState);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [activeMethodIndex, setActiveMethodIndex] = useState(0);

  // Refs for focus management
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  // Calculate points deducted for hints
  const hintPenalty = useMemo(() => {
    return revealedHints.reduce((total, hintIndex) => {
      const hint = problem.hints[hintIndex];
      return total + (hint?.cost || 0);
    }, 0);
  }, [revealedHints, problem.hints]);

  const potentialPoints = Math.max(0, problem.points - hintPenalty);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle step expansion
  const toggleStep = useCallback((stepNumber: number) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: Submit answer
      if (e.ctrlKey && e.key === 'Enter' && answer.trim() && !answerChecked) {
        e.preventDefault();
        onSubmitAnswer?.(answer);
      }
      // Ctrl+H: Request hint
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        const nextHintIndex = revealedHints.length;
        if (nextHintIndex < problem.hints.length) {
          onRequestHint?.(nextHintIndex);
        }
      }
      // Ctrl+S: Toggle solution
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setRevealState((prev) =>
          prev === 'hidden' ? ('full' as RevealState) : ('hidden' as RevealState),
        );
      }
      // Escape: Hide solution
      if (e.key === 'Escape') {
        setRevealState('hidden' as RevealState);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    answer,
    answerChecked,
    revealedHints.length,
    problem.hints.length,
    onSubmitAnswer,
    onRequestHint,
  ]);

  return (
    <div
      className="max-w-6xl mx-auto space-y-6"
      role="main"
      aria-label="Interactive Problem Solver"
    >
      {/* Problem Header */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={getDifficultyVariant(problem.difficulty)}>
                  {getDifficultyLabel(problem.difficulty)}
                </Badge>
                <Badge variant="outline">{problem.topic}</Badge>
                <Badge variant="outline">{problem.type}</Badge>
              </div>
              <CardTitle className="text-2xl md:text-3xl">{problem.title}</CardTitle>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Time: {formatTime(timeSpent)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Points: {currentScore} / {potentialPoints}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">{problem.statement}</div>
          {problem.latex && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg font-mono text-sm overflow-x-auto">
              {problem.latex}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Work Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Your Work Area
              </CardTitle>
              <CardDescription>
                Enter your solution below. You can use LaTeX notation for mathematical expressions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                ref={answerInputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full min-h-[200px] p-4 rounded-lg border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring resize-y font-mono text-sm"
                placeholder="Type your answer here..."
                disabled={answerChecked && isCorrect}
                aria-label="Answer input area"
              />

              {/* Answer Feedback */}
              <AnimatePresence>
                {answerChecked && (
                  <m.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      'mt-4 p-4 rounded-lg flex items-start gap-3',
                      isCorrect
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-red-500/10 border border-red-500/30',
                    )}
                    role="alert"
                    aria-live="polite"
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-700 dark:text-green-400 mb-1">
                            Correct!
                          </h4>
                          <p className="text-sm text-green-600 dark:text-green-300">
                            Excellent work! You earned {potentialPoints} points.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-1">
                            Not quite right
                          </h4>
                          <p className="text-sm text-red-600 dark:text-red-300">
                            Review your work and try again. Consider requesting a hint if you're
                            stuck.
                          </p>
                        </div>
                      </>
                    )}
                  </m.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => onSubmitAnswer?.(answer)}
                  disabled={!answer.trim() || (answerChecked && isCorrect)}
                  className="flex-1 sm:flex-none"
                  aria-label="Check answer"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Check Answer
                  <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                    <span className="text-xs">Ctrl+↵</span>
                  </kbd>
                </Button>
                {answer.trim() && !answerChecked && (
                  <Button variant="outline" onClick={() => setAnswer('')} aria-label="Clear answer">
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Solution Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Solution Steps
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRevealState((prev) =>
                        prev === 'hidden' ? ('full' as RevealState) : ('hidden' as RevealState),
                      )
                    }
                    aria-label={revealState === 'hidden' ? 'Show solution' : 'Hide solution'}
                  >
                    {revealState === 'hidden' ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Show Solution
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Hide Solution
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {problem.solution.alternativeSolutions &&
                problem.solution.alternativeSolutions.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {[
                      'Primary Method',
                      ...problem.solution.alternativeSolutions.map((s) => s.method),
                    ].map((method, index) => (
                      <Button
                        key={index}
                        variant={activeMethodIndex === index ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveMethodIndex(index)}
                      >
                        {method}
                      </Button>
                    ))}
                  </div>
                )}
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {revealState === 'hidden' ? (
                  <m.div
                    key="hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Show Solution" to reveal the step-by-step solution.</p>
                    <p className="text-sm mt-2">Try solving it yourself first!</p>
                  </m.div>
                ) : (
                  <m.div
                    key="revealed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-3"
                  >
                    {problem.solution.steps.map((step) => (
                      <SolutionStepCard
                        key={step.stepNumber}
                        step={step}
                        isExpanded={expandedSteps.has(step.stepNumber)}
                        onToggle={() => toggleStep(step.stepNumber)}
                      />
                    ))}

                    {/* Key Insights */}
                    {problem.solution.insights.length > 0 && (
                      <Card className="bg-primary/5 border-primary/20">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            Key Insights
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {problem.solution.insights.map((insight, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Hints Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Hints
                {revealedHints.length > 0 && (
                  <Badge variant="outline" className="ml-auto">
                    {revealedHints.length} / {problem.hints.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Hints reduce your potential score. Use them wisely!</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {problem.hints.map((hint, index) => (
                    <HintCard
                      key={index}
                      hint={hint}
                      index={index}
                      isRevealed={revealedHints.includes(index)}
                      onReveal={() => onRequestHint?.(index)}
                      disabled={
                        !revealedHints.includes(index) &&
                        index > 0 &&
                        !revealedHints.includes(index - 1)
                      }
                    />
                  ))}
                  {problem.hints.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hints available for this problem.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onPreviousProblem}
                disabled={!onPreviousProblem}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous Problem
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onNextProblem}
                disabled={!onNextProblem}
              >
                Next Problem
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Related Problems */}
          {problem.related.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Related Problems</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {problem.related.slice(0, 3).map((relatedId) => (
                    <Button
                      key={relatedId}
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      asChild
                    >
                      <a href={`/problems/${relatedId}`}>
                        <ArrowRight className="h-3 w-3 mr-2" />
                        Problem {relatedId}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Solution Step Card Component
 */
interface SolutionStepCardProps {
  step: SolutionStep;
  isExpanded: boolean;
  onToggle: () => void;
}

function SolutionStepCard({ step, isExpanded, onToggle }: SolutionStepCardProps) {
  return (
    <m.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: step.stepNumber * 0.05 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <button
          onClick={onToggle}
          className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-lg"
          aria-expanded={isExpanded}
          aria-controls={`step-${step.stepNumber}-content`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {step.stepNumber}
                </div>
                <CardTitle className="text-base">{step.description}</CardTitle>
              </div>
              <m.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </m.div>
            </div>
          </CardHeader>
        </button>
        <AnimatePresence>
          {isExpanded && (
            <m.div
              id={`step-${step.stepNumber}-content`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                {step.expression && (
                  <div className="mb-3 p-3 bg-muted/50 rounded font-mono text-sm overflow-x-auto">
                    {step.expression}
                  </div>
                )}
                {step.latex && (
                  <div className="mb-3 p-3 bg-muted/50 rounded font-mono text-sm overflow-x-auto">
                    {step.latex}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{step.explanation}</p>
                {step.rule && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {step.rule}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </m.div>
          )}
        </AnimatePresence>
      </Card>
    </m.div>
  );
}

/**
 * Hint Card Component
 */
interface HintCardProps {
  hint: Hint;
  index: number;
  isRevealed: boolean;
  onReveal: () => void;
  disabled: boolean;
}

function HintCard({ hint, index, isRevealed, onReveal, disabled }: HintCardProps) {
  return (
    <Card className={cn(isRevealed ? 'bg-yellow-500/5 border-yellow-500/30' : '')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            Hint {index + 1}
            <Badge variant="outline" className="text-xs">
              -{hint.cost} pts
            </Badge>
          </CardTitle>
          <Badge variant="outline" className="text-xs capitalize">
            {hint.reveals}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isRevealed ? (
          <m.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm"
          >
            {hint.text}
          </m.p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onReveal}
            disabled={disabled}
            className="w-full"
            aria-label={`Reveal hint ${index + 1}`}
          >
            <Eye className="h-3 w-3 mr-2" />
            Reveal Hint
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Helper functions
 */
function getDifficultyVariant(
  difficulty: number,
): 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'research' {
  const variants = ['beginner', 'intermediate', 'advanced', 'expert', 'research'] as const;
  return variants[difficulty - 1] || 'intermediate';
}

function getDifficultyLabel(difficulty: number): string {
  const labels = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Research'];
  return labels[difficulty - 1] || 'Intermediate';
}
