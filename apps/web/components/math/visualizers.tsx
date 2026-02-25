'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw, Zap, Code, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SolutionStep } from '@nextcalc/math-engine/problems';

/**
 * Step Visualizer Component
 *
 * Visual representation of solution steps with animations
 */
export interface StepVisualizerProps {
  steps: ReadonlyArray<SolutionStep>;
  currentStep: number;
  onStepChange?: (step: number) => void;
  autoPlay?: boolean;
  playbackSpeed?: number;
}

export function StepVisualizer({
  steps,
  currentStep,
  onStepChange,
  autoPlay = false,
  playbackSpeed = 1,
}: StepVisualizerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(playbackSpeed);

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        onStepChange?.(currentStep + 1);
      } else {
        setIsPlaying(false);
      }
    }, 2000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, currentStep, steps.length, speed, onStepChange]);

  const currentStepData = steps[currentStep]!;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onStepChange?.(Math.min(currentStep + 1, steps.length - 1))}
                disabled={currentStep >= steps.length - 1}
                aria-label="Next step"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  onStepChange?.(0);
                  setIsPlaying(false);
                }}
                aria-label="Reset"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-2">
                Step {currentStep + 1} of {steps.length}
              </div>
              <input
                type="range"
                min="0"
                max={steps.length - 1}
                value={currentStep}
                onChange={(e) => onStepChange?.(Number(e.target.value))}
                className="w-full"
                aria-label="Step slider"
              />
            </div>

            <div className="w-32">
              <div className="text-sm text-muted-foreground mb-2">Speed</div>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full px-2 py-1 rounded border bg-background text-sm"
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold">
                    {currentStep + 1}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{currentStepData.description}</CardTitle>
                    {currentStepData.rule && (
                      <CardDescription className="mt-1">
                        <Badge variant="outline" className="mt-1">
                          {currentStepData.rule}
                        </Badge>
                      </CardDescription>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Expression */}
              {currentStepData.expression && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-2">Expression</div>
                  <div className="font-mono text-lg">{currentStepData.expression}</div>
                </div>
              )}

              {/* LaTeX */}
              {currentStepData.latex && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-2">LaTeX</div>
                  <div className="font-mono text-sm overflow-x-auto">{currentStepData.latex}</div>
                </div>
              )}

              {/* Explanation */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p>{currentStepData.explanation}</p>
              </div>

              {/* Progress */}
              <div className="pt-4 border-t">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Progress</span>
                  <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    className="h-full bg-gradient-to-r from-primary to-primary/60"
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* All Steps Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">All Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <button
                key={step.stepNumber}
                onClick={() => onStepChange?.(index)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg transition-colors',
                  index === currentStep
                    ? 'bg-primary/10 border-l-4 border-l-primary'
                    : 'hover:bg-accent',
                  index < currentStep && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {step.stepNumber}
                  </span>
                  <span className="text-sm flex-1">{step.description}</span>
                  {index < currentStep && (
                    <Badge variant="outline" className="text-xs">
                      Completed
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Algorithm Visualizer Component
 *
 * Interactive algorithm visualization with step-by-step execution
 */
export interface AlgorithmStep {
  readonly line: number;
  readonly description: string;
  readonly variables: ReadonlyMap<string, unknown>;
  readonly highlight?: ReadonlyArray<string>;
}

export interface Algorithm {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly code: string;
  readonly complexity: {
    time: string;
    space: string;
  };
  readonly steps: ReadonlyArray<AlgorithmStep>;
}

export interface AlgorithmVisualizerProps {
  algorithm: Algorithm;
  currentStep: number;
  onStepChange?: (step: number) => void;
  autoPlay?: boolean;
}

export function AlgorithmVisualizer({
  algorithm,
  currentStep,
  onStepChange,
  autoPlay = false,
}: AlgorithmVisualizerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [speed, _setSpeed] = useState(1);

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (currentStep < algorithm.steps.length - 1) {
        onStepChange?.(currentStep + 1);
      } else {
        setIsPlaying(false);
      }
    }, 1500 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, currentStep, algorithm.steps.length, speed, onStepChange]);

  const currentStepData = algorithm.steps[currentStep]!;
  const codeLines = algorithm.code.split('\n');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Code View */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  {algorithm.name}
                </CardTitle>
                <CardDescription className="mt-1">{algorithm.description}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  Time: {algorithm.complexity.time}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Space: {algorithm.complexity.space}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              {codeLines.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    'px-2 py-1 -mx-2 transition-colors',
                    currentStepData.line === index + 1 && 'bg-primary/20 border-l-4 border-l-primary'
                  )}
                >
                  <span className="text-muted-foreground mr-4">{index + 1}</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onStepChange?.(Math.min(currentStep + 1, algorithm.steps.length - 1))}
                  disabled={currentStep >= algorithm.steps.length - 1}
                  aria-label="Next step"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    onStepChange?.(0);
                    setIsPlaying(false);
                  }}
                  aria-label="Reset"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1">
                <div className="text-sm text-muted-foreground mb-2">
                  Step {currentStep + 1} / {algorithm.steps.length}
                </div>
                <input
                  type="range"
                  min="0"
                  max={algorithm.steps.length - 1}
                  value={currentStep}
                  onChange={(e) => onStepChange?.(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: State View */}
      <div className="space-y-4">
        {/* Current Step Info */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Current Step
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
          </CardContent>
        </Card>

        {/* Variable State */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {Array.from(currentStepData.variables.entries()).map(([name, value]) => (
                  <motion.div
                    key={name}
                    layout
                    className={cn(
                      'p-3 rounded-lg border',
                      currentStepData.highlight?.includes(name)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-sm">{name}</span>
                      <Badge variant="outline" className="font-mono">
                        {String(value)}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Complexity Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Complexity Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Time Complexity</div>
              <Badge variant="outline" className="font-mono">
                {algorithm.complexity.time}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Space Complexity</div>
              <Badge variant="outline" className="font-mono">
                {algorithm.complexity.space}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Re-export Taylor series visualizer so consumers can import from this module
export { TaylorSeriesVisualizer } from './taylor-series-visualizer';
export type { TaylorTerm, TaylorComputationResult, FunctionPreset } from './taylor-series-visualizer';
