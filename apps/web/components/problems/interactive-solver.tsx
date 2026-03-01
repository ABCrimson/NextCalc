'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lightbulb,
  Pause,
  Play,
  Send,
  X,
} from 'lucide-react';
import { type ComponentType, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DisplayMath } from '@/components/ui/math-renderer';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Problem, ProblemSolution } from '@/types/problems';

/**
 * InteractiveSolver Component
 *
 * Interactive problem solver with step-by-step solutions, hints, and visualizations.
 *
 * @example
 * ```tsx
 * <InteractiveSolver
 *   problem={problem}
 *   solution={solution}
 *   onSubmit={(answer) => console.log('Submitted:', answer)}
 * />
 * ```
 *
 * Features:
 * - Step-by-step solution display with animations
 * - Progressive hint system
 * - Work checking with immediate feedback
 * - Visualization panel for graphs/diagrams
 * - Scratchpad/notes area
 * - LaTeX math rendering
 * - Code syntax highlighting
 * - Auto-save of user work
 *
 * Accessibility:
 * - Keyboard navigation (Arrow keys, Tab)
 * - Screen reader announcements for step changes
 * - Focus management
 * - ARIA landmarks and labels
 */

export interface InteractiveSolverProps {
  /** Problem to solve */
  problem: Problem;

  /** Solution with steps */
  solution: ProblemSolution;

  /** Callback when solution is submitted */
  onSubmit?: (answer: string) => void;

  /** Callback when hint is revealed */
  onHintRevealed?: (hintIndex: number) => void;

  /** Enable visualization panel */
  showVisualization?: boolean;

  /** Visualization renderer component */
  VisualizationComponent?: ComponentType<{ problemId: string; step: number }>;

  /** Additional CSS classes */
  className?: string;
}

export function InteractiveSolver({
  problem,
  solution,
  onSubmit,
  onHintRevealed,
  showVisualization = false,
  VisualizationComponent,
  className,
}: InteractiveSolverProps) {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const totalSteps = solution.steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Auto-play through steps
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 3000); // 3 seconds per step

    return () => clearInterval(interval);
  }, [isPlaying, totalSteps]);

  // Auto-save notes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userNotes) {
        localStorage.setItem(`problem-notes-${problem.id}`, userNotes);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [userNotes, problem.id]);

  // Load saved notes
  useEffect(() => {
    const saved = localStorage.getItem(`problem-notes-${problem.id}`);
    if (saved) setUserNotes(saved);
  }, [problem.id]);

  const handleNextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const handlePreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleRevealHint = useCallback(
    (hintIndex: number) => {
      setRevealedHints((prev) => new Set([...prev, hintIndex]));
      onHintRevealed?.(hintIndex);
    },
    [onHintRevealed],
  );

  const handleSubmit = useCallback(() => {
    if (!userAnswer.trim()) {
      setFeedback({ type: 'error', message: 'Please enter your answer' });
      return;
    }

    // Simple answer checking (in production, this would call an API)
    const isCorrect = userAnswer.trim().toLowerCase() === solution.finalAnswer.toLowerCase();

    setFeedback({
      type: isCorrect ? 'success' : 'error',
      message: isCorrect
        ? 'Correct! Well done!'
        : 'Not quite right. Try again or reveal more hints.',
    });

    onSubmit?.(userAnswer);
  }, [userAnswer, solution.finalAnswer, onSubmit]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          handleNextStep();
          break;
        case 'ArrowLeft':
          handlePreviousStep();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNextStep, handlePreviousStep]);

  const currentStepData = solution.steps[currentStep];

  return (
    <div
      className={cn('space-y-6', className)}
      role="region"
      aria-label="Interactive problem solver"
    >
      {/* Problem Statement */}
      <Card>
        <CardHeader>
          <CardTitle>{problem.title}</CardTitle>
          <CardDescription>{problem.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              variant={showSolution ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowSolution(!showSolution)}
              aria-label={showSolution ? 'Hide solution' : 'Show solution'}
              aria-pressed={showSolution}
            >
              {showSolution ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="ml-2">{showSolution ? 'Hide' : 'Show'} Solution</span>
            </Button>
            <Badge variant="outline">{solution.approach}</Badge>
            {solution.complexity?.time && (
              <Badge variant="secondary">Time: {solution.complexity.time}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Solution Steps Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Step {currentStep + 1} of {totalSteps}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    aria-label={isPlaying ? 'Pause auto-play' : 'Play auto-play'}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
              <Progress
                value={progress}
                className="mt-2"
                aria-label={`Progress: ${Math.round(progress)}%`}
              />
            </CardHeader>
          </Card>

          {showSolution && currentStepData && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{currentStepData.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Step content */}
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-sm text-muted-foreground">{currentStepData.content}</p>
                    </div>

                    {/* Math expression */}
                    {currentStepData.mathExpression && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <DisplayMath expression={currentStepData.mathExpression} />
                      </div>
                    )}

                    {/* Explanation */}
                    {currentStepData.explanation && (
                      <div className="p-4 border-l-4 border-primary bg-primary/5 rounded">
                        <p className="text-sm">{currentStepData.explanation}</p>
                      </div>
                    )}

                    {/* Hints */}
                    {currentStepData.hints && currentStepData.hints.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Lightbulb className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                          <span>Hints</span>
                        </div>
                        {currentStepData.hints.map((hint, index) => (
                          <HintCard
                            key={index}
                            hint={hint}
                            index={index}
                            isRevealed={revealedHints.has(index)}
                            onReveal={() => handleRevealHint(index)}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Step Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              aria-label="Previous step"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="ml-2">Previous</span>
            </Button>

            <span className="text-sm text-muted-foreground" aria-live="polite">
              Step {currentStep + 1} of {totalSteps}
            </span>

            <Button
              variant="outline"
              onClick={handleNextStep}
              disabled={currentStep === totalSteps - 1}
              aria-label="Next step"
            >
              <span className="mr-2">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Work Area Panel */}
        <div className="space-y-4">
          <Tabs defaultValue="answer" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="answer">Your Answer</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              {showVisualization && <TabsTrigger value="visualization">Visualization</TabsTrigger>}
            </TabsList>

            {/* Answer Tab */}
            <TabsContent value="answer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Submit Your Answer</CardTitle>
                  <CardDescription>Enter your solution and check your work</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="min-h-[120px] font-mono"
                    aria-label="Your answer"
                  />

                  <Button onClick={handleSubmit} className="w-full" size="lg">
                    <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                    Submit Answer
                  </Button>

                  {/* Feedback */}
                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          'p-4 rounded-lg flex items-center gap-2',
                          feedback.type === 'success'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                        )}
                        role="alert"
                        aria-live="polite"
                      >
                        {feedback.type === 'success' ? (
                          <Check className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <X className="h-5 w-5" aria-hidden="true" />
                        )}
                        <span className="font-medium">{feedback.message}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Final Answer Display */}
                  {showSolution && currentStep === totalSteps - 1 && (
                    <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                      <div className="text-sm font-medium mb-2">Final Answer:</div>
                      <div className="font-mono text-lg">{solution.finalAnswer}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Scratchpad</CardTitle>
                  <CardDescription>Your notes are auto-saved</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Take notes, work through the problem..."
                    className="min-h-[400px] font-mono"
                    aria-label="Scratchpad notes"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Visualization Tab */}
            {showVisualization && VisualizationComponent && (
              <TabsContent value="visualization">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Visualization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VisualizationComponent problemId={problem.id} step={currentStep} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">←</kbd>
              <span>Previous step</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">→</kbd>
              <span>Next step</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">Space</kbd>
              <span>Play/Pause</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Hint Card Component with progressive disclosure
 */
function HintCard({
  hint,
  index,
  isRevealed,
  onReveal,
}: {
  hint: string;
  index: number;
  isRevealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {!isRevealed ? (
        <Button
          variant="ghost"
          className="w-full justify-start p-4 h-auto"
          onClick={onReveal}
          aria-label={`Reveal hint ${index + 1}`}
        >
          <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" aria-hidden="true" />
          <span>Click to reveal hint {index + 1}</span>
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="p-4 bg-yellow-50 dark:bg-yellow-900/20"
        >
          <div className="flex items-start gap-2">
            <Lightbulb
              className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm">{hint}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
