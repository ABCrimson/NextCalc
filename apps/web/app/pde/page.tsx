'use client';

/**
 * Elite PDE Solver Visualization Page
 *
 * Features:
 * - GPU-accelerated heatmap rendering at 60fps
 * - Glass-morphism UI with smooth animations
 * - Interactive time scrubbing and playback controls
 * - Real-time performance monitoring
 * - Multiple initial condition presets
 * - Support for Heat and Wave equations
 * - Click to inspect exact values
 * - Smooth time interpolation
 *
 * @module app/pde/page
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, Radio, Play, Pause, RotateCcw, Zap, Settings, Info, Sparkles } from 'lucide-react';
import { WebGPUHeatmap } from '@/components/plots/webgpu-heatmap';

type EquationType = 'heat' | 'wave';
type InitialConditionType = 'center' | 'line' | 'corners' | 'ring' | 'cross' | 'gaussian' | 'random' | 'doubleGaussian' | 'sawtooth' | 'squarePulse' | 'sinc';

// ============================================================================
// HIGH-PERFORMANCE PDE SOLVERS FOR REAL-TIME VISUALIZATION
// ============================================================================

/**
 * 2D Heat Equation Solver using explicit finite difference method
 * ∂u/∂t = α * (∂²u/∂x² + ∂²u/∂y²)
 *
 * Stability condition: α·dt/(dx²) ≤ 0.25 for 2D
 */
function solveHeatPDE2D(
  initial: number[][],
  dx: number,
  dt: number,
  alpha: number,
  numSteps: number
): number[][][] {
  const nx = initial.length;
  const ny = initial[0]?.length ?? 0;
  const r = alpha * dt / (dx * dx);

  // Clamp to stability limit
  const effectiveR = Math.min(r, 0.24);
  if (r > 0.25) {
    console.warn(`Heat equation stability: r=${r.toFixed(4)}, clamped to ${effectiveR.toFixed(4)}`);
  }

  const results: number[][][] = [initial.map(row => [...row])];
  let current = initial.map(row => [...row]);

  for (let step = 0; step < numSteps; step++) {
    const next: number[][] = Array(nx).fill(0).map(() => Array(ny).fill(0));

    // Update interior points using explicit FTCS scheme
    for (let i = 1; i < nx - 1; i++) {
      for (let j = 1; j < ny - 1; j++) {
        const laplacian =
          (current[i + 1]?.[j] ?? 0) + (current[i - 1]?.[j] ?? 0) +
          (current[i]?.[j + 1] ?? 0) + (current[i]?.[j - 1] ?? 0) - 4 * (current[i]?.[j] ?? 0);
        next[i]![j] = (current[i]?.[j] ?? 0) + effectiveR * laplacian;
      }
    }

    // Dirichlet boundary conditions (fixed at 0)
    for (let i = 0; i < nx; i++) {
      next[i]![0] = 0;
      next[i]![ny - 1] = 0;
    }
    for (let j = 0; j < ny; j++) {
      next[0]![j] = 0;
      next[nx - 1]![j] = 0;
    }

    current = next;
    results.push(current.map(row => [...row]));
  }

  return results;
}

/**
 * 2D Wave Equation Solver
 * ∂²u/∂t² = c² * (∂²u/∂x² + ∂²u/∂y²)
 *
 * Stability condition: c·dt/dx ≤ 1/√2 for 2D (CFL condition)
 */
function solveWavePDE2D(
  initial: number[][],
  initialVelocity: number[][],
  dx: number,
  dt: number,
  c: number,
  numSteps: number
): number[][][] {
  const nx = initial.length;
  const ny = initial[0]?.length ?? 0;
  const r = (c * dt / dx) ** 2;

  // CFL stability check
  const cfl = c * dt / dx;
  const cflLimit = 1.0 / Math.sqrt(2);
  if (cfl > cflLimit) {
    console.warn(`Wave equation CFL: ${cfl.toFixed(4)} > ${cflLimit.toFixed(4)}`);
  }

  const results: number[][][] = [initial.map(row => [...row])];
  let uPrev = initial.map(row => [...row]);
  let uCurr = initial.map(row => [...row]);

  // First time step using initial velocity
  const uNext: number[][] = Array(nx).fill(0).map(() => Array(ny).fill(0));
  for (let i = 1; i < nx - 1; i++) {
    for (let j = 1; j < ny - 1; j++) {
      const laplacian =
        (uCurr[i + 1]?.[j] ?? 0) + (uCurr[i - 1]?.[j] ?? 0) +
        (uCurr[i]?.[j + 1] ?? 0) + (uCurr[i]?.[j - 1] ?? 0) - 4 * (uCurr[i]?.[j] ?? 0);
      uNext[i]![j] = (uCurr[i]?.[j] ?? 0) + dt * (initialVelocity[i]?.[j] ?? 0) + 0.5 * r * laplacian;
    }
  }
  results.push(uNext.map(row => [...row]));

  uPrev = uCurr;
  uCurr = uNext;

  // Subsequent time steps using leapfrog scheme
  for (let step = 1; step < numSteps; step++) {
    const next: number[][] = Array(nx).fill(0).map(() => Array(ny).fill(0));

    for (let i = 1; i < nx - 1; i++) {
      for (let j = 1; j < ny - 1; j++) {
        const laplacian =
          (uCurr[i + 1]?.[j] ?? 0) + (uCurr[i - 1]?.[j] ?? 0) +
          (uCurr[i]?.[j + 1] ?? 0) + (uCurr[i]?.[j - 1] ?? 0) - 4 * (uCurr[i]?.[j] ?? 0);
        next[i]![j] = 2 * (uCurr[i]?.[j] ?? 0) - (uPrev[i]?.[j] ?? 0) + r * laplacian;
      }
    }

    // Dirichlet boundary conditions
    for (let i = 0; i < nx; i++) {
      next[i]![0] = 0;
      next[i]![ny - 1] = 0;
    }
    for (let j = 0; j < ny; j++) {
      next[0]![j] = 0;
      next[nx - 1]![j] = 0;
    }

    uPrev = uCurr;
    uCurr = next;
    results.push(uCurr.map(row => [...row]));
  }

  return results;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PDESolverPage() {
  // Solver state
  const [equationType, setEquationType] = useState<EquationType>('heat');
  const [gridSize, setGridSize] = useState(50);
  const [timeSteps, setTimeSteps] = useState(100);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationData, setSimulationData] = useState<number[][][]>([]);
  const [diffusionCoeff, setDiffusionCoeff] = useState(0.1);
  const [waveSpeed, setWaveSpeed] = useState(1.0);
  const [smoothRendering, setSmoothRendering] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [initialCondition, setInitialCondition] = useState<InitialConditionType>('center');

  // UI state
  const [isComputing, setIsComputing] = useState(false);
  const [computeTime, setComputeTime] = useState(0);

  // Refs
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Generate initial conditions for various scenarios
   */
  const initializeCondition = useCallback((type: InitialConditionType): number[][] => {
    const grid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

    switch (type) {
      case 'center':
        // Hot/high spot in the center
        const center = Math.floor(gridSize / 2);
        for (let i = center - 3; i <= center + 3; i++) {
          for (let j = center - 3; j <= center + 3; j++) {
            if (i >= 0 && i < gridSize && j >= 0 && j < gridSize) {
              const dist = Math.sqrt((i - center) ** 2 + (j - center) ** 2);
              grid[i]![j] = Math.max(0, 100 * (1 - dist / 4));
            }
          }
        }
        break;

      case 'line':
        // Hot line across the middle
        const mid = Math.floor(gridSize / 2);
        for (let j = 0; j < gridSize; j++) {
          grid[mid]![j] = 100;
          if (mid > 0) grid[mid - 1]![j] = 50;
          if (mid < gridSize - 1) grid[mid + 1]![j] = 50;
        }
        break;

      case 'corners':
        // Hot corners
        const cornerSize = 5;
        for (let i = 0; i < cornerSize; i++) {
          for (let j = 0; j < cornerSize; j++) {
            const intensity = 100 * (1 - Math.sqrt(i * i + j * j) / (cornerSize * Math.sqrt(2)));
            grid[i]![j] = Math.max(0, intensity);
            grid[i]![gridSize - 1 - j] = Math.max(0, intensity);
            grid[gridSize - 1 - i]![j] = Math.max(0, intensity);
            grid[gridSize - 1 - i]![gridSize - 1 - j] = Math.max(0, intensity);
          }
        }
        break;

      case 'ring':
        // Ring pattern
        const ringCenter = Math.floor(gridSize / 2);
        const ringRadius = Math.floor(gridSize / 4);
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const dx = i - ringCenter;
            const dy = j - ringCenter;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - ringRadius) < 3) {
              grid[i]![j] = 100 * (1 - Math.abs(dist - ringRadius) / 3);
            }
          }
        }
        break;

      case 'cross':
        // Cross pattern
        const crossMid = Math.floor(gridSize / 2);
        const crossWidth = 3;
        for (let i = 0; i < gridSize; i++) {
          for (let j = crossMid - crossWidth; j <= crossMid + crossWidth; j++) {
            if (j >= 0 && j < gridSize) {
              grid[i]![j] = 100 * (1 - Math.abs(j - crossMid) / crossWidth);
            }
          }
        }
        for (let j = 0; j < gridSize; j++) {
          for (let i = crossMid - crossWidth; i <= crossMid + crossWidth; i++) {
            if (i >= 0 && i < gridSize) {
              grid[i]![j] = Math.max(grid[i]![j] ?? 0, 100 * (1 - Math.abs(i - crossMid) / crossWidth));
            }
          }
        }
        break;

      case 'gaussian':
        // Multiple Gaussian peaks
        const peaks = [
          { x: gridSize / 4, y: gridSize / 4 },
          { x: 3 * gridSize / 4, y: gridSize / 4 },
          { x: gridSize / 2, y: 3 * gridSize / 4 },
        ];
        const sigma = gridSize / 10;
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            let value = 0;
            for (const peak of peaks) {
              const dx = i - peak.x;
              const dy = j - peak.y;
              const r2 = dx * dx + dy * dy;
              value += 100 * Math.exp(-r2 / (2 * sigma * sigma));
            }
            grid[i]![j] = Math.min(100, value);
          }
        }
        break;

      case 'random':
        // Random hot spots
        for (let k = 0; k < 10; k++) {
          const x = Math.floor(Math.random() * (gridSize - 10)) + 5;
          const y = Math.floor(Math.random() * (gridSize - 10)) + 5;
          const size = 3;
          for (let i = x - size; i <= x + size; i++) {
            for (let j = y - size; j <= y + size; j++) {
              if (i >= 0 && i < gridSize && j >= 0 && j < gridSize) {
                const dist = Math.sqrt((i - x) ** 2 + (j - y) ** 2);
                grid[i]![j] = Math.max(grid[i]![j] ?? 0, 100 * (1 - dist / size));
              }
            }
          }
        }
        break;

      case 'doubleGaussian': {
        // Two Gaussian peaks: f(x) = exp(-(x-0.3)^2/0.01) + exp(-(x-0.7)^2/0.01)
        // Applied as separable product f(x)*f(y) for a 2D pattern
        const dgFn = (t: number): number =>
          Math.exp(-((t - 0.3) ** 2) / 0.01) + Math.exp(-((t - 0.7) ** 2) / 0.01);
        for (let i = 0; i < gridSize; i++) {
          const nx = i / (gridSize - 1);
          for (let j = 0; j < gridSize; j++) {
            const ny = j / (gridSize - 1);
            grid[i]![j] = 100 * dgFn(nx) * dgFn(ny);
          }
        }
        break;
      }

      case 'sawtooth': {
        // Sawtooth: f(x) = x - floor(x), with 3 repeats across the domain
        // Applied as separable product for 2D
        const stFn = (t: number): number => {
          const scaled = t * 3;
          return scaled - Math.floor(scaled);
        };
        for (let i = 0; i < gridSize; i++) {
          const nx = i / (gridSize - 1);
          for (let j = 0; j < gridSize; j++) {
            const ny = j / (gridSize - 1);
            grid[i]![j] = 100 * stFn(nx) * stFn(ny);
          }
        }
        break;
      }

      case 'squarePulse': {
        // Square pulse: f(x) = 1 if 0.3 < x < 0.7, else 0
        // Applied as separable product for a 2D box
        const spFn = (t: number): number => (t > 0.3 && t < 0.7) ? 1 : 0;
        for (let i = 0; i < gridSize; i++) {
          const nx = i / (gridSize - 1);
          for (let j = 0; j < gridSize; j++) {
            const ny = j / (gridSize - 1);
            grid[i]![j] = 100 * spFn(nx) * spFn(ny);
          }
        }
        break;
      }

      case 'sinc': {
        // Sinc function: f(x) = sin(t)/t where t = (x-0.5)*20, f(0.5) = 1
        // Applied as separable product for 2D
        const sincFn = (x: number): number => {
          const t = (x - 0.5) * 20;
          return t === 0 ? 1 : Math.sin(t) / t;
        };
        for (let i = 0; i < gridSize; i++) {
          const nx = i / (gridSize - 1);
          for (let j = 0; j < gridSize; j++) {
            const ny = j / (gridSize - 1);
            // sinc can be negative; scale so max is 100, keeping sign for wave equation interest
            grid[i]![j] = 100 * sincFn(nx) * sincFn(ny);
          }
        }
        break;
      }
    }

    return grid;
  }, [gridSize]);

  /**
   * Solve PDE with performance tracking
   */
  const solvePDE = useCallback((initialCondition: number[][]) => {
    setIsComputing(true);
    const startTime = performance.now();

    try {
      const dx = 1.0;
      const dt = 0.01;
      let results: number[][][] = [];

      if (equationType === 'heat') {
        results = solveHeatPDE2D(initialCondition, dx, dt, diffusionCoeff, timeSteps);
      } else {
        const initialVelocity = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
        results = solveWavePDE2D(initialCondition, initialVelocity, dx, dt, waveSpeed, timeSteps);
      }

      setSimulationData(results);
      setCurrentStep(0);

      const endTime = performance.now();
      setComputeTime(endTime - startTime);

    } catch (error) {
      console.error('PDE solver error:', error);
    } finally {
      setIsComputing(false);
    }
  }, [equationType, gridSize, timeSteps, diffusionCoeff, waveSpeed]);

  /**
   * Toggle animation playback
   */
  const toggleAnimation = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  /**
   * Reset to initial frame
   */
  const resetAnimation = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  /**
   * Run simulation on mount and whenever any solver parameter or
   * initial-condition selection changes.  This replaces a previous
   * effect that hard-coded 'center' and only depended on equationType,
   * which left the heatmap blank when other parameters changed.
   */
  useEffect(() => {
    solvePDE(initializeCondition(initialCondition));
  }, [solvePDE, initializeCondition, initialCondition]);

  /**
   * High-performance animation loop
   */
  useEffect(() => {
    if (isPlaying && simulationData.length > 0) {
      let lastUpdateTime = performance.now();
      const targetFrameTime = 1000 / (30 * playbackSpeed); // Adjust based on playback speed

      const animate = (currentTime: number) => {
        if (currentTime - lastUpdateTime >= targetFrameTime) {
          setCurrentStep((prev) => {
            if (prev >= simulationData.length - 1) {
              setIsPlaying(false);
              return prev;
            }
            return prev + 1;
          });
          lastUpdateTime = currentTime;
        }

        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isPlaying, simulationData, playbackSpeed]);

  /**
   * Get current grid for rendering
   */
  const getCurrentGrid = useCallback((): number[][] => {
    if (simulationData.length === 0) {
      return Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    }
    return simulationData[currentStep] ?? simulationData[0] ?? Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
  }, [simulationData, currentStep, gridSize]);

  /**
   * Calculate the global value range across ALL simulation frames.
   *
   * Using a per-frame min/max causes the colormap to rescale every frame,
   * making the animation look static even when values are changing.
   * A fixed global range means the color scale stays consistent and
   * amplitude changes (especially wave decay/propagation) are visually obvious.
   */
  const getValueRange = useCallback((): { min: number; max: number } => {
    if (simulationData.length === 0) return { min: 0, max: 100 };

    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;

    // Sample every frame to find the true global extremes.
    for (const frame of simulationData) {
      for (const row of frame) {
        for (const value of row) {
          if (value < globalMin) globalMin = value;
          if (value > globalMax) globalMax = value;
        }
      }
    }

    if (!Number.isFinite(globalMin)) globalMin = 0;
    if (!Number.isFinite(globalMax)) globalMax = 100;

    // Guarantee a non-zero range so the shader never divides by zero.
    if (globalMin === globalMax) {
      globalMin -= 1;
      globalMax += 1;
    }

    return { min: globalMin, max: globalMax };
  }, [simulationData]);

  const valueRange = getValueRange();

  return (
    <main className="min-h-screen py-12 px-4 bg-gradient-to-br from-background via-background/95 to-background">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                PDE Solver Studio
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                GPU-accelerated partial differential equation visualization
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="gap-1 backdrop-blur-sm bg-muted/50 border-border">
              <Zap className="w-3 h-3 text-yellow-400" />
              WebGPU Accelerated
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              60 FPS Rendering
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              {gridSize}×{gridSize} Grid
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              {timeSteps} Time Steps
            </Badge>
            {computeTime > 0 && (
              <Badge variant="outline" className="gap-1 backdrop-blur-sm bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                <Sparkles className="w-3 h-3" />
                Solved in {computeTime.toFixed(0)}ms
              </Badge>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Control Panel */}
          <div className="space-y-4">
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  Solver Configuration
                </CardTitle>
                <CardDescription>Configure your PDE simulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Equation Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Equation Type</Label>
                  <Tabs value={equationType} onValueChange={(v) => setEquationType(v as EquationType)}>
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                      <TabsTrigger value="heat" className="gap-2">
                        <Flame className="w-4 h-4" />
                        Heat
                      </TabsTrigger>
                      <TabsTrigger value="wave" className="gap-2">
                        <Radio className="w-4 h-4" />
                        Wave
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs text-muted-foreground font-mono">
                    {equationType === 'heat'
                      ? '∂u/∂t = α∇²u (heat diffusion)'
                      : '∂²u/∂t² = c²∇²u (wave propagation)'}
                  </p>
                </div>

                {/* Grid Size */}
                <div className="space-y-2">
                  <Label htmlFor="grid-size" className="text-sm font-medium">
                    Grid Resolution: {gridSize}×{gridSize}
                  </Label>
                  <Slider
                    id="grid-size"
                    min={20}
                    max={100}
                    step={10}
                    value={[gridSize]}
                    onValueChange={([value]) => setGridSize(value ?? 50)}
                    className="py-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    GPU acceleration enables high-resolution simulations
                  </p>
                </div>

                {/* Time Steps */}
                <div className="space-y-2">
                  <Label htmlFor="time-steps" className="text-sm font-medium">
                    Time Steps: {timeSteps}
                  </Label>
                  <Slider
                    id="time-steps"
                    min={50}
                    max={500}
                    step={50}
                    value={[timeSteps]}
                    onValueChange={([value]) => setTimeSteps(value ?? 100)}
                    className="py-2"
                  />
                </div>

                {/* Equation-specific parameters */}
                {equationType === 'heat' ? (
                  <div className="space-y-2">
                    <Label htmlFor="diffusion" className="text-sm font-medium">
                      Diffusion Coefficient α: {diffusionCoeff.toFixed(2)}
                    </Label>
                    <Slider
                      id="diffusion"
                      min={0.01}
                      max={0.3}
                      step={0.01}
                      value={[diffusionCoeff]}
                      onValueChange={([value]) => setDiffusionCoeff(value ?? 0.1)}
                      className="py-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher values = faster heat diffusion
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="wave-speed" className="text-sm font-medium">
                      Wave Speed c: {waveSpeed.toFixed(2)}
                    </Label>
                    <Slider
                      id="wave-speed"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={[waveSpeed]}
                      onValueChange={([value]) => setWaveSpeed(value ?? 1.0)}
                      className="py-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Propagation speed of waves
                    </p>
                  </div>
                )}

                {/* Playback Speed */}
                <div className="space-y-2">
                  <Label htmlFor="playback-speed" className="text-sm font-medium">
                    Playback Speed: {playbackSpeed.toFixed(1)}×
                  </Label>
                  <Slider
                    id="playback-speed"
                    min={0.25}
                    max={4.0}
                    step={0.25}
                    value={[playbackSpeed]}
                    onValueChange={([value]) => setPlaybackSpeed(value ?? 1.0)}
                    className="py-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Initial Conditions */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-sm">Initial Condition Presets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('center')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'center' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Center Spot
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('line')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'line' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Hot Line
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('corners')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'corners' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Corners
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('ring')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'ring' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Ring
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('cross')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'cross' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Cross
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('gaussian')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'gaussian' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Gaussian
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('doubleGaussian')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'doubleGaussian' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Double Gaussian
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('sawtooth')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'sawtooth' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Sawtooth
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('squarePulse')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'squarePulse' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Square Pulse
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setInitialCondition('sinc')}
                    className={`justify-start text-sm h-auto py-2 backdrop-blur-sm border-border hover:bg-muted/50 ${initialCondition === 'sinc' ? 'bg-muted/60 ring-1 ring-primary/40' : 'bg-muted/30'}`}
                    disabled={isComputing}
                  >
                    Sinc Function
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visualization Panel */}
          <Card className="backdrop-blur-md bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Solution Heatmap
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Frame {currentStep + 1} / {simulationData.length || 1}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Heatmap Visualization */}
              <div className="relative bg-gradient-to-br from-background to-card rounded-lg p-2 border border-border flex items-center justify-center min-h-[300px]">
                {isComputing ? (
                  <div className="flex items-center justify-center w-full py-16">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground">Computing PDE solution...</p>
                    </div>
                  </div>
                ) : (
                  <WebGPUHeatmap
                    data={getCurrentGrid()}
                    minValue={valueRange.min}
                    maxValue={valueRange.max}
                    colorMode={equationType}
                    width={600}
                    height={600}
                    smoothing={smoothRendering}
                  />
                )}
              </div>

              {/* Animation Controls */}
              {simulationData.length > 0 && (
                <div className="space-y-4">
                  {/* Play/Pause/Reset */}
                  <div className="flex gap-2">
                    <Button
                      onClick={toggleAnimation}
                      variant="outline"
                      className="flex-1 backdrop-blur-sm bg-muted/50 border-border hover:bg-muted/70"
                      disabled={isComputing}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Play
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={resetAnimation}
                      variant="outline"
                      className="backdrop-blur-sm bg-muted/50 border-border hover:bg-muted/70"
                      disabled={isComputing}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Time Scrubber */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Time Step: {currentStep}</Label>
                    <Slider
                      value={[currentStep]}
                      onValueChange={([value]) => setCurrentStep(value ?? 0)}
                      min={0}
                      max={simulationData.length - 1}
                      step={1}
                      disabled={isPlaying || isComputing}
                      className="py-2"
                    />
                  </div>

                  {/* Rendering Options */}
                  <div className="flex items-center justify-between p-3 rounded-lg backdrop-blur-sm bg-muted/30 border border-border">
                    <Label htmlFor="smooth-rendering" className="text-sm font-medium">
                      Smooth Interpolation
                    </Label>
                    <input
                      id="smooth-rendering"
                      type="checkbox"
                      checked={smoothRendering}
                      onChange={(e) => setSmoothRendering(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-muted text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                  </div>
                </div>
              )}

              {/* Color Scale Legend */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Color Scale</Label>
                <div className="h-8 rounded-lg border border-border" style={{
                  background: equationType === 'heat'
                    // Inferno-inspired: near-black → deep purple → vivid magenta → hot orange → pale yellow
                    ? 'linear-gradient(to right, rgb(0,0,4), rgb(66,3,78), rgb(147,13,125), rgb(230,87,13), rgb(250,165,0), rgb(252,255,164))'
                    // Diverging blue→dark→red: deep blue → near-black → deep red
                    : 'linear-gradient(to right, rgb(4,14,46), rgb(21,68,204), rgb(38,107,166), rgb(10,15,20), rgb(166,31,15), rgb(230,51,10), rgb(153,5,5))',
                }} />
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{valueRange.min.toFixed(2)}</span>
                  <span>{((valueRange.min + valueRange.max) / 2).toFixed(2)}</span>
                  <span>{valueRange.max.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Educational Content */}
        <section className="mt-12 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h2 className="text-2xl font-semibold">About PDEs</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-orange-950/40 to-orange-900/40 border border-orange-500/40 hover:border-orange-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-2 text-orange-300 flex items-center gap-2">
                <Flame className="w-5 h-5" />
                Heat Equation
              </h3>
              <p className="text-sm text-orange-200/80">
                The heat equation describes how temperature distributes over time in a given space.
                It's a parabolic PDE that models diffusion processes - heat naturally flows from
                hot to cold regions until equilibrium is reached.
              </p>
            </div>

            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-blue-950/40 to-blue-900/40 border border-blue-500/40 hover:border-blue-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-2 text-blue-300 flex items-center gap-2">
                <Radio className="w-5 h-5" />
                Wave Equation
              </h3>
              <p className="text-sm text-blue-200/80">
                The wave equation describes oscillations and vibrations. It's a hyperbolic PDE
                that models sound waves, electromagnetic waves, vibrating strings, and water waves.
                Unlike heat, waves propagate without dissipation.
              </p>
            </div>

            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-purple-950/40 to-purple-900/40 border border-purple-500/40 hover:border-purple-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-2 text-purple-300">Finite Difference Method</h3>
              <p className="text-sm text-purple-200/80">
                This numerical technique approximates derivatives using discrete grid points.
                We replace continuous derivatives with difference quotients, converting PDEs
                into systems of algebraic equations that computers can solve efficiently.
              </p>
            </div>

            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-emerald-950/40 to-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400/70 transition-all duration-300 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-2 text-emerald-300">Applications</h3>
              <p className="text-sm text-emerald-200/80">
                PDEs are fundamental to physics and engineering: weather prediction,
                fluid dynamics, quantum mechanics, image processing, financial modeling
                (Black-Scholes), and materials science.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
