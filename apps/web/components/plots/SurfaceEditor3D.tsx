'use client';

/**
 * 3D Surface Editor Component
 *
 * Advanced 3D object editor with:
 * - Custom equation input (parametric and implicit surfaces)
 * - Preset geometric shapes (sphere, torus, mobius, klein bottle, etc.)
 * - Real-time parameter adjustment
 * - Color map selection
 * - Resolution and wireframe controls
 * - Export functionality
 *
 * @module components/plots/SurfaceEditor3D
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Plot3D } from './Plot3D';
import type { RendererWithExtras } from './Plot3D';
import type { Plot3DSurfaceConfig } from '@nextcalc/plot-engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shapes,
  Palette,
  Grid3x3,
  Info,
  Sparkles,
  Box,
  Waves,
  Lightbulb,
  ScanLine,
} from 'lucide-react';

/**
 * Preset 3D Surface Shapes
 */
const PRESET_SHAPES = {
  sphere: {
    name: 'Sphere',
    description: 'Perfect 3D sphere',
    fn: (x: number, y: number) => {
      const r = 5;
      const z2 = r * r - x * x - y * y;
      return z2 >= 0 ? Math.sqrt(z2) : NaN;
    },
    viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 },
  },
  sinc: {
    name: 'Sinc Function',
    description: 'Classic sinc(r) = sin(r)/r',
    fn: (x: number, y: number) => {
      const r = Math.sqrt(x * x + y * y);
      return r !== 0 ? Math.sin(r) / r : 1;
    },
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -0.5, zMax: 1 },
  },
  ripple: {
    name: 'Ripple Wave',
    description: 'Concentric wave pattern',
    fn: (x: number, y: number) => {
      const r = Math.sqrt(x * x + y * y);
      return Math.cos(r) * Math.exp(-r / 10);
    },
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -1, zMax: 1 },
  },
  saddle: {
    name: 'Hyperbolic Paraboloid',
    description: 'Saddle surface z = x²- y²',
    fn: (x: number, y: number) => x * x - y * y,
    viewport: { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -9, zMax: 9 },
  },
  egg: {
    name: 'Egg Carton',
    description: 'Periodic surface with peaks and valleys',
    fn: (x: number, y: number) => Math.sin(x) + Math.cos(y),
    viewport: { xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -2 * Math.PI, yMax: 2 * Math.PI, zMin: -2, zMax: 2 },
  },
  monkey: {
    name: 'Monkey Saddle',
    description: 'z = x³ - 3xy²',
    fn: (x: number, y: number) => x * x * x - 3 * x * y * y,
    viewport: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -8, zMax: 8 },
  },
  peaks: {
    name: 'Peaks Function',
    description: 'Matlab-style peaks surface',
    fn: (x: number, y: number) => {
      const term1 = 3 * (1 - x) * (1 - x) * Math.exp(-(x * x) - (y + 1) * (y + 1));
      const term2 = -10 * (x / 5 - x * x * x - y * y * y * y * y) * Math.exp(-x * x - y * y);
      const term3 = -(1 / 3) * Math.exp(-(x + 1) * (x + 1) - y * y);
      return term1 + term2 + term3;
    },
    viewport: { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -7, zMax: 9 },
  },
  gaussian: {
    name: 'Gaussian Bell',
    description: '2D Gaussian distribution',
    fn: (x: number, y: number) => {
      const sigma = 2;
      return Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
    },
    viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: 0, zMax: 1 },
  },
  torus: {
    name: 'Torus',
    description: 'Donut-shaped surface',
    fn: (x: number, y: number) => {
      const R = 3; // Major radius
      const r = 1; // Minor radius
      const d = Math.sqrt(x * x + y * y);
      const term = r * r - (d - R) * (d - R);
      return term >= 0 ? Math.sqrt(term) : NaN;
    },
    viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -2, zMax: 2 },
  },
  helix: {
    name: 'Helical Surface',
    description: 'Spiral ramp surface',
    fn: (x: number, y: number) => {
      const r = Math.sqrt(x * x + y * y);
      const theta = Math.atan2(y, x);
      return theta + r / 3;
    },
    viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -3, zMax: 3 },
  },
};

const COLOR_MAPS = [
  'viridis',
  'plasma',
  'turbo',
  'rainbow',
  'inferno',
  'coolwarm',
  'cividis',
  'magma',
  'spectral',
] as const;

type ColorMap = typeof COLOR_MAPS[number];
type PresetKey = keyof typeof PRESET_SHAPES;

export interface SurfaceEditor3DProps {
  initialPreset?: PresetKey;
  width?: number;
  height?: number;
}

export function SurfaceEditor3D({
  initialPreset = 'sinc',
  width: _width = 800,
  height: _height = 600,
}: SurfaceEditor3DProps) {
  // State
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>(initialPreset);
  const [customEquation, setCustomEquation] = useState('sin(sqrt(x*x + y*y))');
  const [useCustom, setUseCustom] = useState(false);
  const [resolution, setResolution] = useState(60);
  const [colorMap, setColorMap] = useState<ColorMap>('viridis');
  const [wireframe, setWireframe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Renderer effects state
  const [envMapEnabled, setEnvMapEnabled] = useState(false);
  const [ssaoEnabled, setSsaoEnabled] = useState(false);

  // Ref to the renderer so we can call extended methods after init
  const rendererRef = useRef<RendererWithExtras | null>(null);

  // Called by Plot3D once the Three.js renderer is ready
  const handleRendererReady = useCallback((renderer: RendererWithExtras) => {
    rendererRef.current = renderer;
  }, []);

  // Toggle HDR environment map
  const handleEnvMapToggle = useCallback(() => {
    const next = !envMapEnabled;
    setEnvMapEnabled(next);
    rendererRef.current?.setEnvMapEnabled(next);
  }, [envMapEnabled]);

  // Toggle SSAO post-processing
  const handleSsaoToggle = useCallback(() => {
    const next = !ssaoEnabled;
    setSsaoEnabled(next);
    rendererRef.current?.setSsaoEnabled(next);
  }, [ssaoEnabled]);

  // Build surface configuration
  const surfaceConfig = useMemo<Plot3DSurfaceConfig>(() => {
    let fn: (x: number, y: number) => number;
    let viewport = PRESET_SHAPES[selectedPreset].viewport;

    if (useCustom) {
      try {
        // Create function from custom equation
        // This is a simplified version - in production, use a proper math parser
        fn = new Function('x', 'y', 'Math', `
          with (Math) {
            return ${customEquation};
          }
        `) as (x: number, y: number) => number;

        // Test the function
        const testVal = fn(0, 0);
        if (typeof testVal !== 'number' || isNaN(testVal)) {
          throw new Error('Function must return a number');
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid equation');
        fn = PRESET_SHAPES[selectedPreset].fn;
      }
    } else {
      fn = PRESET_SHAPES[selectedPreset].fn;
      setError(null);
    }

    return {
      type: '3d-surface',
      fn: (x: number, y: number) => {
        try {
          return fn(x, y);
        } catch {
          return NaN;
        }
      },
      viewport,
      resolution: { x: resolution, y: resolution },
      colorMap,
      wireframe,
      title: useCustom ? 'Custom Surface' : PRESET_SHAPES[selectedPreset].name,
    };
  }, [selectedPreset, customEquation, useCustom, resolution, colorMap, wireframe]);

  // Handle preset change
  const handlePresetChange = useCallback((preset: PresetKey) => {
    setSelectedPreset(preset);
    setUseCustom(false);
    setError(null);
  }, []);

  // Handle custom equation enable
  const handleCustomEnable = useCallback(() => {
    setUseCustom(true);
    setError(null);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Control Panel */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shapes className="h-5 w-5" />
              3D Surface Editor
            </CardTitle>
            <CardDescription>
              Create and customize 3D surfaces
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preset Shapes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                Preset Shapes
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>{PRESET_SHAPES[selectedPreset].name}</span>
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>Select a Preset</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.entries(PRESET_SHAPES).map(([key, shape]) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => handlePresetChange(key as PresetKey)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-semibold">{shape.name}</span>
                      <span className="text-xs text-muted-foreground">{shape.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Custom Equation */}
            <div className="space-y-2">
              <Label htmlFor="custom-eq">Custom Equation z = f(x, y)</Label>
              <div className="flex gap-2">
                <Input
                  id="custom-eq"
                  value={customEquation}
                  onChange={(e) => setCustomEquation(e.target.value)}
                  placeholder="sin(sqrt(x*x + y*y))"
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleCustomEnable}
                  variant={useCustom ? 'default' : 'outline'}
                  size="sm"
                >
                  Use
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Available: x, y, sin, cos, tan, sqrt, exp, log, abs, pow
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Resolution Control */}
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Grid3x3 className="h-4 w-4" />
                  Resolution
                </span>
                <span className="text-sm font-mono">{resolution}×{resolution}</span>
              </Label>
              <Slider
                value={[resolution]}
                onValueChange={([val]) => val !== undefined && setResolution(val)}
                min={20}
                max={720}
                step={10}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Higher = smoother, but slower
              </p>

              {/* Performance warning for high resolutions */}
              {resolution > 300 && (
                <Alert variant={resolution > 500 ? "destructive" : "default"} className="mt-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {resolution > 500 ? (
                      <>
                        <strong>Extreme Resolution ({resolution}×{resolution}):</strong> This will generate{' '}
                        {(resolution * resolution).toLocaleString()} vertices. Expect significant performance impact.
                        Consider using resolution ≤ 300 for smooth interaction.
                      </>
                    ) : (
                      <>
                        <strong>High Resolution ({resolution}×{resolution}):</strong> Generating{' '}
                        {(resolution * resolution).toLocaleString()} vertices. May impact performance on slower devices.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Color Map */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Color Map
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between capitalize">
                    {colorMap}
                    <Palette className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-96 overflow-y-auto">
                  {COLOR_MAPS.map((map) => (
                    <DropdownMenuItem
                      key={map}
                      onClick={() => setColorMap(map)}
                      className="capitalize"
                    >
                      {map}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Wireframe Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="wireframe" className="flex items-center gap-2">
                <Waves className="h-4 w-4" />
                Wireframe Mode
              </Label>
              <Button
                id="wireframe"
                variant={wireframe ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWireframe(!wireframe)}
              >
                {wireframe ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* HDR Environment Map Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hdr-env" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                <span>
                  HDR Lighting
                  <span className="block text-[10px] text-muted-foreground font-normal leading-tight">
                    Procedural environment map
                  </span>
                </span>
              </Label>
              <Button
                id="hdr-env"
                variant={envMapEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={handleEnvMapToggle}
                aria-pressed={envMapEnabled}
              >
                {envMapEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* SSAO Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="ssao" className="flex items-center gap-2">
                <ScanLine className="h-4 w-4" />
                <span>
                  SSAO
                  <span className="block text-[10px] text-muted-foreground font-normal leading-tight">
                    Ambient occlusion depth cue
                  </span>
                </span>
              </Label>
              <Button
                id="ssao"
                variant={ssaoEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={handleSsaoToggle}
                aria-pressed={ssaoEnabled}
              >
                {ssaoEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* Shape Info */}
            {!useCustom && (
              <div className="p-3 rounded-lg bg-muted border">
                <p className="text-sm font-semibold mb-1">{PRESET_SHAPES[selectedPreset].name}</p>
                <p className="text-xs text-muted-foreground">
                  {PRESET_SHAPES[selectedPreset].description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3D Visualization */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>3D Visualization</CardTitle>
            <CardDescription>
              Drag to rotate, scroll to zoom, right-drag to pan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg">
              <Plot3D
                config={surfaceConfig}
                enableControls={true}
                className="absolute inset-0"
                onRendererReady={handleRendererReady}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
