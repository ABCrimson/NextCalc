'use client';

import { motion } from 'framer-motion';
import {
  Brain,
  Info,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Target,
  TrendingDown,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ANIMATION_DURATIONS, type AnimationSpeed, type MAMLState, type MAMLTask } from './types';

/**
 * Props for MetaLearningPlayground component
 */
export interface MetaLearningPlaygroundProps {
  /**
   * Initial configuration
   */
  initialConfig?: Partial<MAMLState>;

  /**
   * Whether to show educational explanations
   */
  showExplanations?: boolean;

  /**
   * Animation speed preset
   */
  animationSpeed?: AnimationSpeed;

  /**
   * Callback when meta-training completes
   */
  onTrainingCompleted?: (finalState: MAMLState) => void;

  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Simple linear model: y = w * x + b
 */
interface LinearModel {
  readonly weights: ReadonlyArray<number>;
}

/**
 * Deterministic seeded PRNG (mulberry32) to ensure identical random sequences
 * on server and client, preventing React hydration mismatches.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate synthetic task data
 */
function generateTask(
  taskId: string,
  slope: number,
  intercept: number,
  noise: number = 0.1,
  rng: () => number = Math.random,
): MAMLTask {
  const data = Array.from({ length: 10 }, (_, i) => {
    const x = (i - 5) / 5; // Range [-1, 1]
    const y = slope * x + intercept + (rng() - 0.5) * noise;
    return { x, y };
  });

  return {
    taskId,
    name: `Task ${taskId} (y=${slope.toFixed(1)}x+${intercept.toFixed(1)})`,
    data,
    type: 'regression',
  };
}

/**
 * Compute loss (MSE) for a model on a task
 */
function computeLoss(model: LinearModel, task: MAMLTask): number {
  const [w, b] = model.weights;
  let totalLoss = 0;

  task.data.forEach(({ x, y }) => {
    const prediction = (w ?? 0) * x + (b ?? 0);
    const error = prediction - y;
    totalLoss += error * error;
  });

  return totalLoss / task.data.length;
}

/**
 * Gradient descent step
 */
function gradientStep(model: LinearModel, task: MAMLTask, learningRate: number): LinearModel {
  const [w, b] = model.weights;
  let gradW = 0;
  let gradB = 0;

  // Compute gradients
  task.data.forEach(({ x, y }) => {
    const prediction = (w ?? 0) * x + (b ?? 0);
    const error = prediction - y;
    gradW += 2 * error * x;
    gradB += 2 * error;
  });

  gradW /= task.data.length;
  gradB /= task.data.length;

  // Update weights
  return {
    weights: [(w ?? 0) - learningRate * gradW, (b ?? 0) - learningRate * gradB],
  };
}

/**
 * MAML inner loop: adapt to a specific task
 */
function innerLoop(
  model: LinearModel,
  task: MAMLTask,
  steps: number,
  learningRate: number,
): LinearModel {
  let adapted = model;
  for (let i = 0; i < steps; i++) {
    adapted = gradientStep(adapted, task, learningRate);
  }
  return adapted;
}

/**
 * Build a smooth quadratic-bezier SVG path through an array of {x,y} points
 * that are already in SVG coordinate space.
 */
function buildSmoothPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return p ? `M ${p.x} ${p.y}` : '';
  }

  let d = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cur = points[i];
    const nxt = points[i + 1];
    if (!cur || !nxt) continue;
    const midX = (cur.x + nxt.x) / 2;
    const midY = (cur.y + nxt.y) / 2;
    d += ` Q ${cur.x} ${cur.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  if (last) d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Interactive Meta-Learning Playground Component
 *
 * Visualizes MAML (Model-Agnostic Meta-Learning) algorithm with
 * inner and outer loop optimization.
 *
 * @example
 * ```tsx
 * <MetaLearningPlayground
 *   showExplanations={true}
 *   animationSpeed="normal"
 *   onTrainingCompleted={(state) => console.log('Training done:', state)}
 * />
 * ```
 */
export function MetaLearningPlayground({
  initialConfig,
  showExplanations = true,
  animationSpeed = 'normal',
  onTrainingCompleted,
  className,
}: MetaLearningPlaygroundProps) {
  // State management
  const [mamlState, setMamlState] = useState<MAMLState>(() => {
    // Use a seeded PRNG so server and client produce identical task data,
    // preventing React hydration mismatches.
    const rng = seededRandom(42);

    return {
      metaParameters: [0.5, 0.5], // Initialize with reasonable values
      tasks: [
        // Basic tasks (1-4): Simple linear relationships
        generateTask('1', 2.0, 1.0, 0.1, rng),
        generateTask('2', -1.5, 0.5, 0.1, rng),
        generateTask('3', 1.0, -0.5, 0.1, rng),
        generateTask('4', -2.0, 1.5, 0.1, rng),

        // Intermediate tasks (5-6): Varied slopes and intercepts
        generateTask('5', 3.5, -1.0, 0.1, rng),
        generateTask('6', -2.5, 2.0, 0.1, rng),

        // Advanced tasks (7-8): Steeper slopes and larger offsets
        generateTask('7', 4.5, -2.5, 0.15, rng),
        generateTask('8', -3.8, 2.8, 0.15, rng),

        // Expert tasks (9-10): Extreme values and higher noise
        generateTask('9', 5.5, -3.5, 0.2, rng),
        generateTask('10', -5.0, 4.0, 0.2, rng),
      ],
      innerSteps: 5,
      outerSteps: 10,
      innerLearningRate: 0.01,
      outerLearningRate: 0.01,
      ...initialConfig,
    };
  });

  const [currentOuterStep, setCurrentOuterStep] = useState<number>(0);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [selectedTask, setSelectedTask] = useState<MAMLTask | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // canvasWrapperRef is attached to the element that fills the card content
  // width. ResizeObserver on this element gives us the true CSS layout
  // dimensions at all times — no dependency on clientWidth which can be
  // stale or zero before the first paint.
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasZoom, setCanvasZoom] = useState<number>(1.0);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // Compute current model
  const currentModel = useMemo<LinearModel>(
    () => ({ weights: mamlState.metaParameters }),
    [mamlState.metaParameters],
  );

  // Compute adapted model for selected task
  const adaptedModel = useMemo(() => {
    if (!selectedTask) return null;
    return innerLoop(currentModel, selectedTask, mamlState.innerSteps, mamlState.innerLearningRate);
  }, [selectedTask, currentModel, mamlState.innerSteps, mamlState.innerLearningRate]);

  // Keep canvasDisplaySize in sync with the wrapper's true CSS dimensions.
  // ResizeObserver fires after layout so we always have accurate values
  // before the drawing useEffect runs.
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      let w: number;
      let h: number;
      // contentBoxSize is more accurate than getBoundingClientRect for
      // sub-pixel layout sizes.
      if (entry.contentBoxSize?.[0]) {
        w = entry.contentBoxSize[0].inlineSize;
        h = entry.contentBoxSize[0].blockSize;
      } else {
        const rect = wrapper.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
      }
      setCanvasDisplaySize({ width: Math.round(w), height: Math.round(h) });
    });

    observer.observe(wrapper);

    // Seed immediately in case the element is already sized.
    const rect = wrapper.getBoundingClientRect();
    if (rect.width > 0) {
      setCanvasDisplaySize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }

    return () => observer.disconnect();
  }, []);

  // Run one outer step of MAML
  const runOuterStep = useCallback(() => {
    const model = currentModel;
    let totalGradW = 0;
    let totalGradB = 0;

    // For each task, adapt and compute gradient
    mamlState.tasks.forEach((task) => {
      // Inner loop: adapt to task
      const adapted = innerLoop(model, task, mamlState.innerSteps, mamlState.innerLearningRate);

      // Compute loss gradient after adaptation
      const [w, b] = adapted.weights;
      task.data.forEach(({ x, y }) => {
        const prediction = (w ?? 0) * x + (b ?? 0);
        const error = prediction - y;
        totalGradW += 2 * error * x;
        totalGradB += 2 * error;
      });
    });

    // Average gradients
    totalGradW /= mamlState.tasks.length;
    totalGradB /= mamlState.tasks.length;

    // Outer loop: update meta-parameters
    const [metaW, metaB] = mamlState.metaParameters;
    const newMetaW = (metaW ?? 0) - mamlState.outerLearningRate * totalGradW;
    const newMetaB = (metaB ?? 0) - mamlState.outerLearningRate * totalGradB;

    // Compute average loss across all tasks
    const avgLoss =
      mamlState.tasks.reduce((sum, task) => {
        const adapted = innerLoop(
          { weights: [newMetaW, newMetaB] },
          task,
          mamlState.innerSteps,
          mamlState.innerLearningRate,
        );
        return sum + computeLoss(adapted, task);
      }, 0) / mamlState.tasks.length;

    setMamlState((prev) => ({
      ...prev,
      metaParameters: [newMetaW, newMetaB],
    }));

    setLossHistory((prev) => [...prev, avgLoss]);
    setCurrentOuterStep((prev) => prev + 1);
  }, [currentModel, mamlState]);

  // Train for multiple steps
  const train = useCallback(() => {
    if (isTraining) {
      setIsTraining(false);
      return;
    }

    setIsTraining(true);
    let step = 0;

    const interval = setInterval(() => {
      if (step >= mamlState.outerSteps) {
        setIsTraining(false);
        onTrainingCompleted?.(mamlState);
        clearInterval(interval);
        return;
      }

      runOuterStep();
      step++;
    }, ANIMATION_DURATIONS[animationSpeed]);
  }, [isTraining, mamlState, runOuterStep, onTrainingCompleted, animationSpeed]);

  // Reset
  const reset = useCallback(() => {
    setMamlState((prev) => ({
      ...prev,
      metaParameters: [0.5, 0.5],
    }));
    setCurrentOuterStep(0);
    setLossHistory([]);
    setSelectedTask(null);
    setIsTraining(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Task Adaptation Canvas — high-DPI rendering
  //
  // Resolution strategy:
  //   • canvasDisplaySize is kept in sync with the wrapper's CSS layout size
  //     via ResizeObserver, so we always have the true display dimensions.
  //   • Buffer size = displayWidth * dpr × displayHeight * dpr so every
  //     physical pixel on high-DPI screens gets its own buffer pixel.
  //   • ctx.setTransform(dpr * zoom, …) maps all drawing coordinates to CSS
  //     pixels. Zoom is applied as an additional canvas transform (not CSS
  //     scale) so the DPR calculation is never disturbed by the zoom wrapper.
  //   • stroke widths, font sizes, dash patterns, and radii are all divided by
  //     the zoom factor so they remain visually consistent at any zoom level.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTask) return;

    // Fall back to a sensible default only on the very first render before
    // ResizeObserver has fired.
    const displayWidth = canvasDisplaySize.width > 0 ? canvasDisplaySize.width : 600;
    const displayHeight = canvasDisplaySize.height > 0 ? canvasDisplaySize.height : 320;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clamp DPR to 3 to avoid excessive memory use on 4K displays.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const zoom = canvasZoom;

    const bufW = Math.round(displayWidth * dpr);
    const bufH = Math.round(displayHeight * dpr);

    // Resize the backing buffer only when the dimensions change.
    // Resizing clears the canvas and triggers a GPU texture re-upload.
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW;
      canvas.height = bufH;
    }

    // Base transform: 1 drawing-unit = 1 CSS pixel, plus zoom centred on the
    // canvas middle.
    const offsetX = (displayWidth * (1 - zoom)) / 2;
    const offsetY = (displayHeight * (1 - zoom)) / 2;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, offsetX * dpr, offsetY * dpr);

    // All coordinates below are in CSS-pixel / logical space.
    const W = displayWidth;
    const H = displayHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear the full physical buffer — must temporarily reset the transform.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufW, bufH);
    ctx.restore();

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(12, 10, 32, 0.97)');
    bg.addColorStop(1, 'rgba(20, 16, 50, 0.97)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    const pad = 38;
    const plotW = W - pad * 2;
    const plotH = H - pad * 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(90, 70, 160, 0.22)';
    // Divide by zoom so grid lines stay 1 logical pixel wide at every zoom.
    ctx.lineWidth = 1 / zoom;
    for (let i = 0; i <= 8; i++) {
      const gx = pad + (i / 8) * plotW;
      const gy = pad + (i / 8) * plotH;
      ctx.beginPath();
      ctx.moveTo(gx, pad);
      ctx.lineTo(gx, pad + plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, gy);
      ctx.lineTo(pad + plotW, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Axis lines
    const yZero = pad + plotH * 0.5;
    const xZero = pad + plotW * 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 80, 200, 0.40)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(pad, yZero);
    ctx.lineTo(pad + plotW, yZero);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xZero, pad);
    ctx.lineTo(xZero, pad + plotH);
    ctx.stroke();
    ctx.restore();

    // Helpers: data coords → logical canvas coords
    // x in [-1, 1], y in [-4, 4]
    const toCanvasX = (xv: number) => pad + ((xv + 1) / 2) * plotW;
    const toCanvasY = (yv: number) => pad + plotH - ((yv + 4) / 8) * plotH;

    // Meta-model line (dashed, purple)
    const [mw, mb] = currentModel.weights;
    const metaY1 = (mw ?? 0) * -1.1 + (mb ?? 0);
    const metaY2 = (mw ?? 0) * 1.1 + (mb ?? 0);
    ctx.save();
    ctx.setLineDash([9 / zoom, 7 / zoom]);
    ctx.strokeStyle = '#7c5ce8';
    ctx.lineWidth = 2.5 / zoom;
    ctx.shadowBlur = 8 / zoom;
    ctx.shadowColor = 'rgba(124, 92, 232, 0.60)';
    ctx.beginPath();
    ctx.moveTo(toCanvasX(-1.1), toCanvasY(metaY1));
    ctx.lineTo(toCanvasX(1.1), toCanvasY(metaY2));
    ctx.stroke();
    ctx.restore();

    // Adapted-model line (solid gradient, green → cyan → indigo)
    if (adaptedModel) {
      const [aw, ab] = adaptedModel.weights;
      const acx1 = toCanvasX(-1.1);
      const acy1 = toCanvasY((aw ?? 0) * -1.1 + (ab ?? 0));
      const acx2 = toCanvasX(1.1);
      const acy2 = toCanvasY((aw ?? 0) * 1.1 + (ab ?? 0));
      const lg = ctx.createLinearGradient(acx1, 0, acx2, 0);
      lg.addColorStop(0, '#10b981');
      lg.addColorStop(0.5, '#06b6d4');
      lg.addColorStop(1, '#6366f1');
      ctx.save();
      ctx.strokeStyle = lg;
      ctx.lineWidth = 3.5 / zoom;
      ctx.shadowBlur = 14 / zoom;
      ctx.shadowColor = 'rgba(59, 130, 246, 0.75)';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(acx1, acy1);
      ctx.lineTo(acx2, acy2);
      ctx.stroke();
      ctx.restore();
    }

    // Data points with glow halos
    const ptRadius = 5 / zoom;
    const ptCoreRadius = 2.2 / zoom;
    const ptGlowRadius = 10 / zoom;
    selectedTask.data.forEach(({ x, y }) => {
      const cx = toCanvasX(x);
      const cy = toCanvasY(y);

      // Glow halo
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ptGlowRadius);
      glow.addColorStop(0, 'rgba(59, 130, 246, 0.55)');
      glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, ptGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Blue dot
      ctx.beginPath();
      ctx.arc(cx, cy, ptRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();

      // White core highlight
      ctx.beginPath();
      ctx.arc(cx, cy, ptCoreRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });

    // Axis labels — scale font size inversely with zoom for consistent size.
    const labelFontSize = 11 / zoom;
    ctx.fillStyle = 'rgba(130, 110, 200, 0.80)';
    ctx.font = `bold ${labelFontSize}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('x', W / 2, H - 6 / zoom);
    ctx.save();
    ctx.translate(13 / zoom, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('y', 0, 0);
    ctx.restore();

    // In-canvas legend (top-left of plot area)
    const legX = pad + 6;
    const legY = pad + 10;
    const legLineLen = 22;
    const legTextOffset = 26;
    const legRowGap = 16;
    const legFontSize = 10 / zoom;

    ctx.font = `${legFontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'left';

    // Meta-model swatch
    ctx.save();
    ctx.setLineDash([7 / zoom, 5 / zoom]);
    ctx.strokeStyle = '#7c5ce8';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(legX, legY);
    ctx.lineTo(legX + legLineLen, legY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(180, 160, 240, 0.90)';
    ctx.fillText('Meta-model', legX + legTextOffset, legY + legFontSize * 0.35);

    // Adapted-model swatch
    ctx.save();
    const lg2 = ctx.createLinearGradient(legX, 0, legX + legLineLen, 0);
    lg2.addColorStop(0, '#10b981');
    lg2.addColorStop(1, '#6366f1');
    ctx.strokeStyle = lg2;
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.moveTo(legX, legY + legRowGap);
    ctx.lineTo(legX + legLineLen, legY + legRowGap);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.90)';
    ctx.fillText('Adapted model', legX + legTextOffset, legY + legRowGap + legFontSize * 0.35);
  }, [selectedTask, currentModel, adaptedModel, canvasZoom, canvasDisplaySize]);

  // Statistics
  const statistics = useMemo(() => {
    if (lossHistory.length === 0) {
      return { currentLoss: 0, bestLoss: 0, avgLoss: 0 };
    }

    const current = lossHistory[lossHistory.length - 1] ?? 0;
    const best = Math.min(...lossHistory);
    const avg = lossHistory.reduce((sum, l) => sum + l, 0) / lossHistory.length;

    return { currentLoss: current, bestLoss: best, avgLoss: avg };
  }, [lossHistory]);

  // ---------------------------------------------------------------------------
  // Training Progress SVG data
  //
  // The SVG uses a fixed logical coordinate space (SVG_W × SVG_H) with
  // preserveAspectRatio="xMidYMid meet" so the aspect ratio is always
  // preserved and stroke widths / radii / blur filters remain isotropic.
  // This avoids the blurriness caused by the old preserveAspectRatio="none"
  // which stretched the coordinate system non-uniformly.
  // ---------------------------------------------------------------------------
  const SVG_W = 560;
  const SVG_H = 160;
  const SVG_PAD_X = 12;
  const SVG_PAD_Y = 12;

  const lossChartData = useMemo(() => {
    if (lossHistory.length === 0) return null;

    const maxLoss = Math.max(...lossHistory);
    const minLoss = Math.min(...lossHistory);
    const range = maxLoss - minLoss || 1;

    const plotW = SVG_W - SVG_PAD_X * 2;
    const plotH = SVG_H - SVG_PAD_Y * 2;

    const points = lossHistory.map((loss, i) => ({
      x: SVG_PAD_X + (i / (lossHistory.length - 1 || 1)) * plotW,
      y: SVG_PAD_Y + plotH - ((loss - minLoss) / range) * (plotH * 0.85) - plotH * 0.075,
    }));

    const linePath = buildSmoothPath(points);
    const last = points[points.length - 1];
    const areaPath = last
      ? `${linePath} L ${last.x} ${SVG_PAD_Y + plotH} L ${SVG_PAD_X} ${SVG_PAD_Y + plotH} Z`
      : '';

    return { points, linePath, areaPath };
  }, [lossHistory]);

  return (
    <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                Meta-Learning Playground
              </CardTitle>
              <CardDescription>
                Visualize MAML algorithm with inner and outer loop optimization
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">
                Step {currentOuterStep}/{mamlState.outerSteps}
              </Badge>
              {lossHistory.length > 0 && (
                <Badge variant="outline">Loss: {statistics.currentLoss.toFixed(4)}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualization Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Visualization */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Task Adaptation
                </CardTitle>
                {selectedTask && adaptedModel && (
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      Meta: w={currentModel.weights[0]?.toFixed(2)}, b=
                      {currentModel.weights[1]?.toFixed(2)}
                    </Badge>
                    <Badge variant="default">
                      Adapted: w={adaptedModel.weights[0]?.toFixed(2)}, b=
                      {adaptedModel.weights[1]?.toFixed(2)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedTask ? (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-xl text-muted-foreground"
                  style={{
                    background: 'rgba(12,10,32,0.5)',
                    border: '2px dashed rgba(80,60,160,0.35)',
                  }}
                >
                  <Target className="h-12 w-12 mb-3 opacity-30 text-primary" />
                  <p className="text-sm">Select a task below to visualize model adaptation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Zoom controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setCanvasZoom((z) => Math.max(0.5, z - 0.25))}
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-10 text-center font-mono">
                        {Math.round(canvasZoom * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setCanvasZoom((z) => Math.min(2.0, z + 0.25))}
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setCanvasZoom(1.0)}
                        aria-label="Reset zoom"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[60%]">
                      {selectedTask.name}
                    </div>
                  </div>

                  {/*
                   * Canvas wrapper — this div is measured by ResizeObserver.
                   * The canvas fills the wrapper via CSS (w-full / fixed height).
                   * Zoom is applied inside the canvas drawing code, not via CSS
                   * transform, so clientWidth/ResizeObserver dimensions are never
                   * affected by the zoom level.
                   */}
                  <div
                    ref={canvasWrapperRef}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'rgba(12,10,32,0.60)',
                      border: '1px solid rgba(80,60,160,0.35)',
                      height: 320,
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full block"
                      style={{ display: 'block' }}
                      aria-label={`Task adaptation visualization for ${selectedTask.name}`}
                    />
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-0.5 rounded"
                            style={{ background: '#7c5ce8', opacity: i % 2 === 0 ? 1 : 0 }}
                          />
                        ))}
                      </div>
                      <span>Meta-model (init)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-0.5 rounded"
                        style={{ background: 'linear-gradient(90deg,#10b981,#6366f1)' }}
                      />
                      <span>Adapted ({mamlState.innerSteps} steps)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#3b82f6', border: '1px solid #fff' }}
                      />
                      <span>Data points</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loss History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Training Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossHistory.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="text-muted-foreground">Start training to see loss history</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {/*
                   * Training Progress SVG
                   *
                   * Uses a fixed SVG_W × SVG_H logical coordinate space with
                   * preserveAspectRatio="xMidYMid meet" so the coordinate system
                   * scales uniformly. This ensures:
                   *   • strokeWidth is isotropic (same physical size in X and Y)
                   *   • circle radii are true circles, not ellipses
                   *   • feGaussianBlur stdDeviation is symmetric
                   *   • no sub-pixel distortion at any container width
                   *
                   * All of this was broken with the previous preserveAspectRatio="none"
                   * which stretched the coordinate system non-uniformly.
                   */}
                  <div
                    className="relative rounded-xl overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(12,10,32,0.6) 0%, rgba(20,16,50,0.6) 100%)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(90,70,160,0.3)',
                    }}
                  >
                    <svg
                      className="w-full block"
                      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ display: 'block' }}
                      role="img"
                      aria-label="Loss history chart"
                    >
                      <defs>
                        <linearGradient id="lossAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.50" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
                        </linearGradient>
                        {/*
                         * Glow filter in user-space (userSpaceOnUse) with a
                         * fixed-pixel stdDeviation so the blur is consistent
                         * regardless of the viewBox-to-viewport scale.
                         * 3 viewBox units = visually ~3px at typical sizes.
                         */}
                        <filter
                          id="lineGlow"
                          x="-20%"
                          y="-40%"
                          width="140%"
                          height="180%"
                          colorInterpolationFilters="sRGB"
                        >
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        {/* Subtle grid lines inside the chart */}
                        <line
                          id="hGridLine"
                          x1={SVG_PAD_X}
                          x2={SVG_W - SVG_PAD_X}
                          stroke="rgba(90,70,160,0.20)"
                          strokeWidth="0.75"
                        />
                      </defs>

                      {/* Horizontal grid lines at 25% intervals */}
                      {[0.25, 0.5, 0.75].map((frac) => {
                        const gy = SVG_PAD_Y + (SVG_H - SVG_PAD_Y * 2) * frac;
                        return (
                          <use
                            key={frac}
                            href="#hGridLine"
                            transform={`translate(0, ${gy - SVG_PAD_Y})`}
                          />
                        );
                      })}

                      {lossChartData && (
                        <>
                          {/* Area fill under curve */}
                          <path d={lossChartData.areaPath} fill="url(#lossAreaGradient)" />

                          {/* Glowing loss line */}
                          <path
                            d={lossChartData.linePath}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#lineGlow)"
                          />

                          {/* Data point dots */}
                          {lossChartData.points.map((point, i) => (
                            <motion.circle
                              key={i}
                              cx={point.x}
                              cy={point.y}
                              r="3"
                              fill="#6366f1"
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="0.75"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: i * 0.04, type: 'spring', stiffness: 300 }}
                            >
                              <title>
                                Step {i + 1}: {lossHistory[i]?.toFixed(4)}
                              </title>
                            </motion.circle>
                          ))}
                        </>
                      )}
                    </svg>
                  </div>

                  {/* Statistics with glass-morphism */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Current Loss',
                        value: statistics.currentLoss.toFixed(4),
                        hue: 264,
                        delay: 0.1,
                      },
                      {
                        label: 'Best Loss',
                        value: statistics.bestLoss.toFixed(4),
                        hue: 155,
                        delay: 0.2,
                      },
                      {
                        label: 'Avg Loss',
                        value: statistics.avgLoss.toFixed(4),
                        hue: 250,
                        delay: 0.3,
                      },
                    ].map((s) => (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: s.delay }}
                        className="p-3 rounded-lg space-y-1"
                        style={{
                          background: `hsl(${s.hue},40%,12%,0.5)`,
                          backdropFilter: 'blur(8px)',
                          border: `1px solid hsl(${s.hue},50%,30%,0.4)`,
                        }}
                      >
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                        <div
                          className="text-lg font-mono font-bold"
                          style={{ color: `hsl(${s.hue},65%,68%)` }}
                        >
                          {s.value}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle>Available Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {mamlState.tasks.map((task) => {
                  const isSelected = selectedTask?.taskId === task.taskId;
                  const adapted = innerLoop(
                    currentModel,
                    task,
                    mamlState.innerSteps,
                    mamlState.innerLearningRate,
                  );
                  const loss = computeLoss(adapted, task);

                  return (
                    <Button
                      key={task.taskId}
                      variant={isSelected ? 'default' : 'outline'}
                      className="h-auto py-3 justify-start"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{task.name}</div>
                        <div className="text-xs opacity-70 mt-1">Loss: {loss.toFixed(4)}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="space-y-6">
          {/* Training Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Training</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={train}
                disabled={currentOuterStep >= mamlState.outerSteps}
              >
                {isTraining ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Training
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={runOuterStep}
                disabled={isTraining || currentOuterStep >= mamlState.outerSteps}
              >
                <Zap className="h-4 w-4 mr-2" />
                Single Outer Step
              </Button>

              <Separator />

              <Button variant="outline" className="w-full" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Training
              </Button>
            </CardContent>
          </Card>

          {/* Hyperparameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hyperparameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inner-steps">Inner Steps</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {mamlState.innerSteps}
                  </span>
                </div>
                <Slider
                  id="inner-steps"
                  min={1}
                  max={20}
                  step={1}
                  value={[mamlState.innerSteps]}
                  onValueChange={([value]: number[]) =>
                    setMamlState((prev) => ({ ...prev, innerSteps: value ?? 5 }))
                  }
                  disabled={isTraining}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="outer-steps">Outer Steps</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {mamlState.outerSteps}
                  </span>
                </div>
                <Slider
                  id="outer-steps"
                  min={5}
                  max={50}
                  step={5}
                  value={[mamlState.outerSteps]}
                  onValueChange={([value]: number[]) =>
                    setMamlState((prev) => ({ ...prev, outerSteps: value ?? 10 }))
                  }
                  disabled={isTraining}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inner-lr">Inner Learning Rate</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {mamlState.innerLearningRate.toFixed(3)}
                  </span>
                </div>
                <Slider
                  id="inner-lr"
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  value={[mamlState.innerLearningRate]}
                  onValueChange={([value]: number[]) =>
                    setMamlState((prev) => ({ ...prev, innerLearningRate: value ?? 0.01 }))
                  }
                  disabled={isTraining}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="outer-lr">Outer Learning Rate</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {mamlState.outerLearningRate.toFixed(3)}
                  </span>
                </div>
                <Slider
                  id="outer-lr"
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  value={[mamlState.outerLearningRate]}
                  onValueChange={([value]: number[]) =>
                    setMamlState((prev) => ({ ...prev, outerLearningRate: value ?? 0.01 }))
                  }
                  disabled={isTraining}
                />
              </div>
            </CardContent>
          </Card>

          {/* Meta-Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Meta-Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weight (w):</span>
                <span className="font-mono font-semibold">
                  {currentModel.weights[0]?.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bias (b):</span>
                <span className="font-mono font-semibold">
                  {currentModel.weights[1]?.toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Educational Explanation */}
      {showExplanations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Understanding Meta-Learning (MAML)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="concept">
              <TabsList
                className="grid w-full grid-cols-4 h-auto p-1 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(10,8,28,0.55) 0%, rgba(18,14,42,0.55) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(90,70,180,0.25)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.06)',
                }}
              >
                <TabsTrigger
                  value="concept"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Concept
                </TabsTrigger>
                <TabsTrigger
                  value="algorithm"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Algorithm
                </TabsTrigger>
                <TabsTrigger
                  value="visualization"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Visualization
                </TabsTrigger>
                <TabsTrigger
                  value="tips"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Tips
                </TabsTrigger>
              </TabsList>

              <TabsContent value="concept" className="space-y-3 text-sm">
                <p>
                  <strong>Meta-Learning</strong> (learning to learn) trains a model to quickly adapt
                  to new tasks with minimal data. MAML finds an initialization that's good for
                  fine-tuning.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Inner loop:</strong> Fast adaptation to a specific task
                  </li>
                  <li>
                    <strong>Outer loop:</strong> Update meta-parameters for better initialization
                  </li>
                  <li>Goal: Find parameters that generalize across task distributions</li>
                  <li>Few-shot learning: Learn from few examples</li>
                </ul>
              </TabsContent>

              <TabsContent value="algorithm" className="space-y-3 text-sm font-mono">
                <p>
                  <strong>MAML Algorithm:</strong>
                </p>
                <div className="bg-muted p-4 rounded-lg text-xs space-y-2">
                  <div>1. Initialize meta-parameters θ</div>
                  <div>2. For each task Ti:</div>
                  <div className="ml-4">a. Inner loop: θ'i = θ - α∇L(Ti, θ)</div>
                  <div className="ml-4">b. Compute L(Ti, θ'i)</div>
                  <div>3. Outer loop: θ = θ - β∇Σ L(Ti, θ'i)</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  α = inner learning rate, β = outer learning rate
                </p>
              </TabsContent>

              <TabsContent value="visualization" className="space-y-3 text-sm">
                <p>
                  <strong>What you're seeing:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Dashed line:</strong> Meta-model (shared initialization)
                  </li>
                  <li>
                    <strong>Solid line:</strong> Task-specific adapted model
                  </li>
                  <li>Each task has different slope/intercept (y = wx + b)</li>
                  <li>Meta-parameters should be in the "middle" of all tasks</li>
                  <li>Loss chart shows convergence over outer steps</li>
                </ul>
              </TabsContent>

              <TabsContent value="tips" className="space-y-3 text-sm">
                <p>
                  <strong>Try these experiments:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Increase inner steps to see better task-specific adaptation</li>
                  <li>Adjust learning rates to control convergence speed</li>
                  <li>Watch how meta-parameters move toward "average" task</li>
                  <li>Select different tasks to see adaptation quality</li>
                  <li>Compare meta-model vs. adapted model performance</li>
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
