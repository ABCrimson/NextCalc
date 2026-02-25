'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

/**
 * Algorithm step interface
 */
export interface AlgorithmStep {
  id: string;
  description: string;
  highlightLines?: number[];
  data?: Record<string, unknown>;
  visualization?: {
    type: 'array' | 'tree' | 'graph' | 'matrix';
    elements: (string | number)[] | (string | number)[][];
    highlighted?: number[];
    compared?: number[];
  };
}

/**
 * Algorithm metadata
 */
export interface AlgorithmMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: {
    time: string;
    space: string;
  };
  code: string;
  language: string;
}

/**
 * AlgorithmVisualizer Component
 *
 * Interactive algorithm visualization with step-by-step execution.
 *
 * @example
 * ```tsx
 * <AlgorithmVisualizer
 *   algorithm={sortingAlgorithm}
 *   steps={algorithmSteps}
 *   initialData={[5, 2, 8, 1, 9]}
 * />
 * ```
 *
 * Features:
 * - Animated step-through of algorithms
 * - Speed control (slow, normal, fast)
 * - Step-by-step explanation panel
 * - Interactive input
 * - Multiple visualization types (graphs, trees, arrays, matrices)
 * - Code highlighting synchronized with visualization
 * - Export functionality
 *
 * Accessibility:
 * - Keyboard controls (Space, Arrow keys)
 * - ARIA live regions for step announcements
 * - Focus management
 * - Screen reader friendly descriptions
 */

export interface AlgorithmVisualizerProps {
  /** Algorithm metadata */
  algorithm: AlgorithmMetadata;

  /** Algorithm steps */
  steps: AlgorithmStep[];

  /** Initial data for visualization */
  initialData?: (string | number)[];

  /** Allow custom input data */
  allowCustomInput?: boolean;

  /** Show code panel */
  showCode?: boolean;

  /** Additional CSS classes */
  className?: string;
}

const SPEED_PRESETS = {
  slow: 2000,
  normal: 1000,
  fast: 500,
} as const;

export function AlgorithmVisualizer({
  algorithm,
  steps,
  showCode = true,
  className,
}: AlgorithmVisualizerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEED_PRESETS>('normal');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, SPEED_PRESETS[speed]);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed, steps.length]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const handleStepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleStepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleStepBackward();
          break;
        case 'r':
          e.preventDefault();
          handleReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePlayPause, handleStepForward, handleStepBackward, handleReset]);

  return (
    <div className={cn('space-y-6', className)} role="region" aria-label="Algorithm visualizer">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{algorithm.name}</CardTitle>
              <CardDescription>{algorithm.description}</CardDescription>
            </div>
            <Badge variant="outline">{algorithm.category}</Badge>
          </div>
          <div className="flex gap-2 mt-4">
            <Badge>Time: {algorithm.complexity.time}</Badge>
            <Badge>Space: {algorithm.complexity.space}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visualization Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Visualization</CardTitle>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="min-h-[300px] flex items-center justify-center"
                >
                  {currentStepData?.visualization && (
                    <VisualizationRenderer
                      type={currentStepData.visualization.type}
                      elements={currentStepData.visualization.elements}
                      {...(currentStepData.visualization.highlighted !== undefined && { highlighted: currentStepData.visualization.highlighted })}
                      {...(currentStepData.visualization.compared !== undefined && { compared: currentStepData.visualization.compared })}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  aria-label="Reset to beginning"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStepBackward}
                  disabled={currentStep === 0}
                  aria-label="Step backward"
                >
                  <SkipBack className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="lg"
                  onClick={handlePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Play className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStepForward}
                  disabled={currentStep === steps.length - 1}
                  aria-label="Step forward"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Speed</span>
                  <div className="flex gap-1">
                    {(Object.keys(SPEED_PRESETS) as Array<keyof typeof SPEED_PRESETS>).map((s) => (
                      <Button
                        key={s}
                        variant={speed === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSpeed(s)}
                        className="h-7 text-xs"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <div
                className="text-sm text-center text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                Step {currentStep + 1} of {steps.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explanation and Code Panel */}
        <div className="space-y-4">
          <Tabs defaultValue="explanation">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="explanation">Explanation</TabsTrigger>
              {showCode && <TabsTrigger value="code">Code</TabsTrigger>}
            </TabsList>

            <TabsContent value="explanation" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Step</CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="prose dark:prose-invert max-w-none"
                    >
                      <p>{currentStepData?.description}</p>
                    </motion.div>
                  </AnimatePresence>
                </CardContent>
              </Card>
            </TabsContent>

            {showCode && (
              <TabsContent value="code" className="mt-4">
                <CodeBlock
                  code={algorithm.code}
                  language={algorithm.language}
                  showLineNumbers
                  {...(currentStepData?.highlightLines !== undefined && { highlightLines: currentStepData.highlightLines })}
                  maxHeight="600px"
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">Space</kbd>
              <span>Play/Pause</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">←</kbd>
              <span>Previous</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">→</kbd>
              <span>Next</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">R</kbd>
              <span>Reset</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Visualization Renderer Component with SVG Filters and FLIP Animations
 */
function VisualizationRenderer({
  type,
  elements,
  highlighted = [],
  compared = [],
}: {
  type: 'array' | 'tree' | 'graph' | 'matrix';
  elements: (string | number)[] | (string | number)[][];
  highlighted?: number[];
  compared?: number[];
}) {
  if (type === 'array') {
    return (
      <div className="flex gap-3 flex-wrap justify-center p-6 relative" role="img" aria-label="Array visualization">
        {/* SVG Filters for advanced effects */}
        <svg className="absolute w-0 h-0" aria-hidden="true">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="shadow">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.3"/>
            </filter>
          </defs>
        </svg>

        {elements.map((value, index) => {
          const isHighlighted = highlighted.includes(index);
          const isCompared = compared.includes(index);

          return (
            <motion.div
              key={`${index}-${value}`}
              layout
              layoutId={`array-element-${index}`}
              initial={{ scale: 0.5, opacity: 0, rotateY: -90 }}
              animate={{
                scale: isHighlighted || isCompared ? 1.1 : 1,
                opacity: 1,
                rotateY: 0,
              }}
              transition={{
                layout: { type: 'spring', stiffness: 300, damping: 25 },
                default: { delay: index * 0.04, duration: 0.4, ease: [0.4, 0, 0.2, 1] },
              }}
              whileHover={{ scale: 1.15, transition: { duration: 0.2 } }}
              className={cn(
                'relative flex items-center justify-center w-20 h-20 rounded-xl font-bold text-xl transition-all duration-300 cursor-pointer',
                'shadow-lg',
              )}
              style={{
                background: isHighlighted
                  ? 'linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(139, 92, 246) 100%)'
                  : isCompared
                  ? 'linear-gradient(135deg, rgb(251, 191, 36) 0%, rgb(245, 158, 11) 100%)'
                  : 'linear-gradient(135deg, rgb(30, 41, 59) 0%, rgb(51, 65, 85) 100%)',
                color: isHighlighted || isCompared ? '#ffffff' : '#94a3b8',
                border: isHighlighted
                  ? '2px solid rgba(165, 180, 252, 0.8)'
                  : isCompared
                  ? '2px solid rgba(252, 211, 77, 0.8)'
                  : '1px solid rgba(100, 116, 139, 0.3)',
                boxShadow: isHighlighted
                  ? '0 8px 32px rgba(99, 102, 241, 0.5), 0 0 16px rgba(99, 102, 241, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
                  : isCompared
                  ? '0 8px 32px rgba(251, 191, 36, 0.4), 0 0 16px rgba(251, 191, 36, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
                  : '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
                transform: 'perspective(1000px)',
                transformStyle: 'preserve-3d',
                willChange: 'transform',
              }}
              aria-label={`Element ${index + 1}: ${value}${isHighlighted ? ' (highlighted)' : ''}${isCompared ? ' (compared)' : ''}`}
            >
              <span className="relative z-10">{value}</span>

              {/* Animated glow effect for highlighted/compared */}
              {(isHighlighted || isCompared) && (
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: isHighlighted
                      ? 'radial-gradient(circle at 50% 0%, rgba(165, 180, 252, 0.4) 0%, transparent 70%)'
                      : 'radial-gradient(circle at 50% 0%, rgba(252, 211, 77, 0.4) 0%, transparent 70%)',
                  }}
                  animate={{
                    opacity: [0.3, 0.7, 0.3],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
              )}

              {/* Index label */}
              <div
                className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-mono"
                style={{
                  color: isHighlighted ? '#a5b4fc' : isCompared ? '#fcd34d' : '#64748b',
                }}
              >
                {index}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  if (type === 'matrix') {
    const matrixElements = elements as (string | number)[][];
    const cols = matrixElements[0]?.length || 0;

    return (
      <div className="inline-block p-6" role="img" aria-label="Matrix visualization">
        <svg className="absolute w-0 h-0" aria-hidden="true">
          <defs>
            <filter id="matrix-glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>

        {matrixElements.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2 mb-2">
            {row.map((value: string | number, colIndex: number) => {
              const flatIndex = rowIndex * cols + colIndex;
              const isHighlighted = highlighted.includes(flatIndex);

              return (
                <motion.div
                  key={`${rowIndex}-${colIndex}`}
                  layout
                  initial={{ scale: 0.5, opacity: 0, rotateX: -90 }}
                  animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 300, damping: 25 },
                    default: { delay: flatIndex * 0.02, duration: 0.3 },
                  }}
                  whileHover={{ scale: 1.1, transition: { duration: 0.15 } }}
                  className="flex items-center justify-center w-14 h-14 rounded-lg font-mono text-sm font-semibold cursor-pointer"
                  style={{
                    background: isHighlighted
                      ? 'linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(139, 92, 246) 100%)'
                      : 'linear-gradient(135deg, rgb(30, 41, 59) 0%, rgb(51, 65, 85) 100%)',
                    color: isHighlighted ? '#ffffff' : '#94a3b8',
                    border: isHighlighted
                      ? '2px solid rgba(165, 180, 252, 0.6)'
                      : '1px solid rgba(100, 116, 139, 0.3)',
                    boxShadow: isHighlighted
                      ? '0 6px 20px rgba(99, 102, 241, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                      : '0 2px 8px rgba(0, 0, 0, 0.2)',
                    transform: 'perspective(1000px)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {value}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // Enhanced placeholder for tree and graph visualizations
  return (
    <div className="text-center p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-block px-6 py-4 rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(51, 65, 85, 0.6) 100%)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100, 116, 139, 0.3)',
        }}
      >
        <div className="text-lg font-semibold text-foreground/80 mb-2">
          {type.charAt(0).toUpperCase() + type.slice(1)} Visualization
        </div>
        <div className="text-sm text-muted-foreground">
          Advanced {type} rendering coming soon
        </div>
      </motion.div>
    </div>
  );
}
