'use client';

/**
 * PDE 3D Solver Studio - Client Component
 *
 * Interactive 3D PDE solver with three visualization modes:
 * - Isosurface via Marching Cubes
 * - Orthogonal slice planes with colormap textures
 * - Additive-blended point cloud
 *
 * Supports Heat equation (FTCS) and Wave equation (Verlet) solvers.
 *
 * @module app/pde/3d/pde-3d-client
 */

import { motion, useReducedMotion } from 'framer-motion';
import {
  Box,
  Flame,
  Layers,
  Pause,
  Play,
  Radio,
  RotateCcw,
  SkipForward,
  Sparkles,
  Timer,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RenderMode } from '@/components/plots/PDE3DRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COLORMAP_NAMES, type ColormapName } from '@/lib/solvers/colormaps';
import {
  createInitialCondition3D,
  type InitialCondition3D,
  stepHeat3D,
} from '@/lib/solvers/heat3d';
import { stepWave3D } from '@/lib/solvers/wave3d';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Lazy-load the Three.js renderer (no SSR)
// ---------------------------------------------------------------------------

const PDE3DRenderer = dynamic(
  () =>
    import('@/components/plots/PDE3DRenderer').then((m) => ({
      default: m.PDE3DRenderer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading 3D renderer...</p>
        </div>
      </div>
    ),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EquationType = 'heat' | 'wave';

// ---------------------------------------------------------------------------
// Floating orb for atmospheric background
// ---------------------------------------------------------------------------

function FloatingOrb({
  className,
  gradient,
  delay = 0,
}: {
  className: string;
  gradient: string;
  delay?: number;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      className={cn('absolute rounded-full blur-3xl pointer-events-none', className)}
      style={{ background: gradient }}
      {...(prefersReduced
        ? {}
        : {
            animate: {
              x: [0, 30, -20, 0],
              y: [0, -25, 15, 0],
              scale: [1, 1.05, 0.95, 1],
            },
            transition: {
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            },
          })}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function PDE3DClient() {
  // -- Equation settings --
  const [equationType, setEquationType] = useState<EquationType>('heat');
  const [gridSize, setGridSize] = useState(64);
  const [alpha, setAlpha] = useState(0.15); // heat diffusivity
  const [waveC, setWaveC] = useState(1.0); // wave speed
  const [initialCondition, setInitialCondition] = useState<InitialCondition3D>('gaussian');

  // -- Render settings --
  const [renderMode, setRenderMode] = useState<RenderMode>('isosurface');
  const [isovalue, setIsovalue] = useState(0.3);
  const [slicePositions, setSlicePositions] = useState<[number, number, number]>([0.5, 0.5, 0.5]);
  const [colormap, setColormap] = useState<ColormapName>('viridis');

  // -- Simulation state --
  const [playing, setPlaying] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [msPerStep, setMsPerStep] = useState(0);

  // -- Scalar field buffers --
  const fieldRef = useRef<Float32Array>(new Float32Array(0));
  const prevFieldRef = useRef<Float32Array>(new Float32Array(0));
  const [displayField, setDisplayField] = useState<Float32Array>(new Float32Array(0));

  const animRef = useRef<number>(0);
  const playingRef = useRef(false);

  // Keep playingRef in sync
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // -- Computed dt for stability --
  const dx = 1.0;
  const dt = useMemo(() => {
    if (equationType === 'heat') {
      // For stability: alpha * dt / dx^2 <= 1/6
      // We pick r = 0.15 to be safe
      return (0.15 * dx * dx) / Math.max(alpha, 0.001);
    }
    // For CFL: c * dt / dx <= 1/sqrt(3)
    // Pick r = 0.55 (r^2 ~ 0.30)
    return (0.55 * dx) / Math.max(waveC, 0.001);
  }, [equationType, alpha, waveC]);

  // -------------------------------------------------------------------
  // Initialize / reset simulation
  // -------------------------------------------------------------------
  const resetSimulation = useCallback(() => {
    setPlaying(false);
    setStepCount(0);
    setMsPerStep(0);

    const ic = createInitialCondition3D(initialCondition, gridSize);
    fieldRef.current = ic;
    prevFieldRef.current = new Float32Array(ic); // copy for wave eq
    setDisplayField(new Float32Array(ic));
  }, [initialCondition, gridSize]);

  // Initialize on mount and when deps change
  useEffect(() => {
    resetSimulation();
  }, [resetSimulation]);

  // -------------------------------------------------------------------
  // Step simulation forward
  // -------------------------------------------------------------------
  const stepSimulation = useCallback(() => {
    const t0 = performance.now();

    if (equationType === 'heat') {
      const next = stepHeat3D(fieldRef.current, gridSize, alpha, dt, dx);
      fieldRef.current = next;
    } else {
      const next = stepWave3D(prevFieldRef.current, fieldRef.current, gridSize, waveC, dt, dx);
      prevFieldRef.current = fieldRef.current;
      fieldRef.current = next;
    }

    const elapsed = performance.now() - t0;
    setMsPerStep(elapsed);
    setStepCount((c) => c + 1);
    setDisplayField(new Float32Array(fieldRef.current));
  }, [equationType, gridSize, alpha, waveC, dt]);

  // -------------------------------------------------------------------
  // Animation loop
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!playing) return;

    let lastTime = 0;
    const targetInterval = 33; // ~30 fps stepping

    const loop = (time: number) => {
      if (!playingRef.current) return;

      if (time - lastTime >= targetInterval) {
        stepSimulation();
        lastTime = time;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, stepSimulation]);

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------
  const handleSliceChange = useCallback((axis: 0 | 1 | 2, value: number) => {
    setSlicePositions((prev) => {
      const next: [number, number, number] = [...prev];
      next[axis] = value;
      return next;
    });
  }, []);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* ---- Animated background ---- */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <FloatingOrb
          className="-top-40 -right-40 w-[700px] h-[700px]"
          gradient="radial-gradient(circle, oklch(0.55 0.28 280 / 0.10) 0%, oklch(0.55 0.28 280 / 0.04) 50%, transparent 100%)"
        />
        <FloatingOrb
          className="-bottom-60 -left-40 w-[800px] h-[800px]"
          gradient="radial-gradient(circle, oklch(0.50 0.25 240 / 0.08) 0%, oklch(0.50 0.25 240 / 0.03) 50%, transparent 100%)"
          delay={5}
        />
        <FloatingOrb
          className="top-1/3 right-1/4 w-[500px] h-[500px]"
          gradient="radial-gradient(circle, oklch(0.58 0.22 200 / 0.06) 0%, transparent 70%)"
          delay={10}
        />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* ---- Content ---- */}
      <div className="relative z-10 container mx-auto max-w-[1600px] py-8 px-4">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
              <Box className="w-7 h-7 text-violet-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                PDE Solver 3D
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Three-dimensional PDE solver with isosurface, slice, and point cloud visualization
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="gap-1 backdrop-blur-sm bg-muted/50 border-border">
              <Box className="w-3 h-3 text-violet-400" aria-hidden="true" />
              {gridSize}^3 Grid
            </Badge>
            <Badge variant="outline" className="backdrop-blur-sm bg-muted/50 border-border">
              Step {stepCount}
            </Badge>
            {msPerStep > 0 && (
              <Badge
                variant="outline"
                className="gap-1 backdrop-blur-sm bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              >
                <Timer className="w-3 h-3" aria-hidden="true" />
                {msPerStep.toFixed(1)} ms/step
              </Badge>
            )}
          </div>
        </header>

        {/* Main layout: sidebar + canvas */}
        <div className="grid gap-6 md:grid-cols-[340px_1fr]">
          {/* ---- Left sidebar ---- */}
          <div className="space-y-4 order-2 md:order-1">
            {/* Equation selector */}
            <Card className="backdrop-blur-xl bg-card/40 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" aria-hidden="true" />
                  Equation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={equationType}
                  onValueChange={(v) => setEquationType(v as EquationType)}
                >
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                    <TabsTrigger value="heat" className="gap-1.5">
                      <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                      Heat
                    </TabsTrigger>
                    <TabsTrigger value="wave" className="gap-1.5">
                      <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                      Wave
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground font-mono">
                  {equationType === 'heat'
                    ? 'du/dt = a * nabla^2(u)'
                    : 'd2u/dt2 = c^2 * nabla^2(u)'}
                </p>
              </CardContent>
            </Card>

            {/* Grid & parameter controls */}
            <Card className="backdrop-blur-xl bg-card/40 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Grid size */}
                <div className="space-y-2">
                  <Label className="text-xs">
                    Grid Size: {gridSize} ({gridSize}^3 = {(gridSize ** 3).toLocaleString()} cells)
                  </Label>
                  <Slider
                    min={32}
                    max={128}
                    step={8}
                    value={[gridSize]}
                    onValueChange={([v]) => {
                      if (v !== undefined) setGridSize(v);
                    }}
                    className="py-1"
                  />
                </div>

                {/* Alpha or c */}
                {equationType === 'heat' ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Diffusivity (alpha): {alpha.toFixed(2)}</Label>
                    <Slider
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      value={[alpha]}
                      onValueChange={([v]) => {
                        if (v !== undefined) setAlpha(v);
                      }}
                      className="py-1"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs">Wave Speed (c): {waveC.toFixed(2)}</Label>
                    <Slider
                      min={0.1}
                      max={2.0}
                      step={0.05}
                      value={[waveC]}
                      onValueChange={([v]) => {
                        if (v !== undefined) setWaveC(v);
                      }}
                      className="py-1"
                    />
                  </div>
                )}

                {/* dt display */}
                <p className="text-xs text-muted-foreground">
                  dt = {dt.toFixed(4)} (auto-computed for stability)
                </p>

                {/* Initial condition */}
                <div className="space-y-2">
                  <Label className="text-xs">Initial Condition</Label>
                  <Select
                    value={initialCondition}
                    onValueChange={(v) => setInitialCondition(v as InitialCondition3D)}
                  >
                    <SelectTrigger className="bg-muted/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gaussian">Gaussian Blob</SelectItem>
                      <SelectItem value="randomHotspots">Random Hotspots</SelectItem>
                      <SelectItem value="planeWave">Plane Wave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Render mode controls */}
            <Card className="backdrop-blur-xl bg-card/40 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Visualization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Render mode */}
                <Tabs value={renderMode} onValueChange={(v) => setRenderMode(v as RenderMode)}>
                  <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                    <TabsTrigger value="isosurface" className="text-xs gap-1">
                      <Box className="w-3 h-3" aria-hidden="true" />
                      Iso
                    </TabsTrigger>
                    <TabsTrigger value="slices" className="text-xs gap-1">
                      <Layers className="w-3 h-3" aria-hidden="true" />
                      Slices
                    </TabsTrigger>
                    <TabsTrigger value="pointcloud" className="text-xs gap-1">
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      Points
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Isovalue slider (isosurface mode) */}
                {renderMode === 'isosurface' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Isovalue: {isovalue.toFixed(2)}</Label>
                    <Slider
                      min={0.01}
                      max={1.0}
                      step={0.01}
                      value={[isovalue]}
                      onValueChange={([v]) => {
                        if (v !== undefined) setIsovalue(v);
                      }}
                      className="py-1"
                    />
                  </div>
                )}

                {/* Slice position sliders (slices mode) */}
                {renderMode === 'slices' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">X Slice: {slicePositions[0].toFixed(2)}</Label>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[slicePositions[0]]}
                        onValueChange={([v]) => {
                          if (v !== undefined) handleSliceChange(0, v);
                        }}
                        className="py-1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Y Slice: {slicePositions[1].toFixed(2)}</Label>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[slicePositions[1]]}
                        onValueChange={([v]) => {
                          if (v !== undefined) handleSliceChange(1, v);
                        }}
                        className="py-1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Z Slice: {slicePositions[2].toFixed(2)}</Label>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[slicePositions[2]]}
                        onValueChange={([v]) => {
                          if (v !== undefined) handleSliceChange(2, v);
                        }}
                        className="py-1"
                      />
                    </div>
                  </div>
                )}

                {/* Colormap */}
                <div className="space-y-2">
                  <Label className="text-xs">Colormap</Label>
                  <Select value={colormap} onValueChange={(v) => setColormap(v as ColormapName)}>
                    <SelectTrigger className="bg-muted/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORMAP_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name.charAt(0).toUpperCase() + name.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Playback controls */}
            <Card className="backdrop-blur-xl bg-card/40 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Playback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 backdrop-blur-sm bg-muted/50 border-border/50 hover:bg-muted/70"
                    onClick={() => setPlaying(!playing)}
                  >
                    {playing ? (
                      <>
                        <Pause className="w-4 h-4 mr-1.5" aria-hidden="true" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1.5" aria-hidden="true" />
                        Play
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="backdrop-blur-sm bg-muted/50 border-border/50 hover:bg-muted/70"
                    onClick={stepSimulation}
                    aria-label="Step forward"
                    disabled={playing}
                  >
                    <SkipForward className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="backdrop-blur-sm bg-muted/50 border-border/50 hover:bg-muted/70"
                    onClick={resetSimulation}
                    aria-label="Reset simulation"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Steps: {stepCount}</span>
                  {msPerStep > 0 && <span>{msPerStep.toFixed(1)} ms/step</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---- Center: 3D Canvas ---- */}
          <div className="order-1 md:order-2">
            <Card className="backdrop-blur-xl bg-card/40 border-border/50 h-full">
              <CardContent className="p-2 sm:p-4 h-full min-h-[500px] sm:min-h-[600px]">
                <PDE3DRenderer
                  scalarField={displayField}
                  gridSize={gridSize}
                  renderMode={renderMode}
                  isovalue={isovalue}
                  slicePositions={slicePositions}
                  colormap={colormap}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
