'use client';

/**
 * Modernized plot examples and demonstrations
 * Features: Gradient backgrounds, animated patterns, sticky headers, glass-morphism cards
 * Accessibility: WCAG 2.2 AAA compliant with proper semantic structure
 *
 * Fixes applied:
 *  1. Auto-refresh on function change (debounced in Plot2D)
 *  2. Axis labels scale with zoom (live viewport in Plot2D / AxisLabels)
 *  3. Polar zoom via mouse wheel (in Plot2D)
 *  4. Analysis panel below each graph (PlotAnalysisPanel)
 *  5. Redesigned preset chips with gradient hover, category headers, 10 per category
 *
 * @module app/plot/page
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Plot2D,
  PlotContainer,
  FunctionInput,
  SurfaceEditor3D,
  PlotExportToolbar,
  PlotAnalysisPanel,
  PolarAnalysisPanel,
  type FunctionDefinition,
  type AnalysisFunction,
  type PolarAnalysisFunction,
} from '@/components/plots';
import type { Plot2DCartesianConfig, Plot2DPolarConfig, Plot2DParametricConfig } from '@nextcalc/plot-engine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { evaluate } from '@nextcalc/math-engine';
import { Zap, Activity, Layers, Maximize2 } from 'lucide-react';
import { VariableSliders } from '@/components/plot/variable-sliders';

// ---------------------------------------------------------------------------
// Preset data  (Fix 5: 10 per category)
// ---------------------------------------------------------------------------

interface CartesianPreset {
  label: string;
  functions: FunctionDefinition[];
}

interface PolarPreset {
  label: string;
  functions: FunctionDefinition[];
}

interface ParametricPreset {
  label: string;
  xFunctions: FunctionDefinition[];
  yFunctions: FunctionDefinition[];
}

const CARTESIAN_PRESETS: CartesianPreset[] = [
  {
    label: 'sin(x)',
    functions: [
      { id: 'cart-sin', expression: 'sin(x)', label: 'sin(x)', color: '#2563eb', isValid: true },
    ],
  },
  {
    label: 'cos(x)',
    functions: [
      { id: 'cart-cos', expression: 'cos(x)', label: 'cos(x)', color: '#dc2626', isValid: true },
    ],
  },
  {
    label: 'tan(x)',
    functions: [
      { id: 'cart-tan', expression: 'tan(x)', label: 'tan(x)', color: '#ea580c', isValid: true },
    ],
  },
  {
    label: 'x²',
    functions: [
      { id: 'cart-x2', expression: 'x^2', label: 'x²', color: '#059669', isValid: true },
    ],
  },
  {
    label: 'x³',
    functions: [
      { id: 'cart-x3', expression: 'x^3', label: 'x³', color: '#7c3aed', isValid: true },
    ],
  },
  {
    label: 'sqrt(x)',
    functions: [
      { id: 'cart-sqrt', expression: 'sqrt(x)', label: 'sqrt(x)', color: '#0891b2', isValid: true },
    ],
  },
  {
    label: '1/x',
    functions: [
      { id: 'cart-inv', expression: '1/x', label: '1/x', color: '#ec4899', isValid: true },
    ],
  },
  {
    label: 'Gaussian',
    functions: [
      { id: 'cart-gauss', expression: 'exp(-x^2)', label: 'e^(−x²)', color: '#f59e0b', isValid: true },
    ],
  },
  {
    label: 'sinc',
    functions: [
      { id: 'cart-sinc', expression: 'sin(x)/x', label: 'sin(x)/x', color: '#8b5cf6', isValid: true },
    ],
  },
  {
    label: 'abs(x)',
    functions: [
      { id: 'cart-abs', expression: 'abs(x)', label: 'abs(x)', color: '#10b981', isValid: true },
    ],
  },
];

const POLAR_PRESETS: PolarPreset[] = [
  {
    label: 'Rose 3',
    functions: [
      { id: 'pol-rose3', expression: 'cos(3*theta)', label: 'r=cos(3θ)', color: '#8b5cf6', isValid: true },
    ],
  },
  {
    label: 'Cardioid',
    functions: [
      { id: 'pol-cardioid', expression: '1 + cos(theta)', label: 'r=1+cos(θ)', color: '#2563eb', isValid: true },
    ],
  },
  {
    label: 'Spiral',
    functions: [
      { id: 'pol-spiral', expression: 'theta', label: 'r=θ', color: '#059669', isValid: true },
    ],
  },
  {
    label: 'Rose 4',
    functions: [
      { id: 'pol-rose4', expression: 'sin(2*theta)', label: 'r=sin(2θ)', color: '#f59e0b', isValid: true },
    ],
  },
  {
    label: '2cos(θ)',
    functions: [
      { id: 'pol-circle', expression: '2*cos(theta)', label: 'r=2cos(θ)', color: '#dc2626', isValid: true },
    ],
  },
  {
    label: 'Limaçon',
    functions: [
      { id: 'pol-limacon', expression: '1 + 2*sin(theta)', label: 'r=1+2sin(θ)', color: '#ec4899', isValid: true },
    ],
  },
  {
    label: 'Half-rose',
    functions: [
      { id: 'pol-halfrose', expression: 'cos(theta/2)', label: 'r=cos(θ/2)', color: '#ea580c', isValid: true },
    ],
  },
  {
    label: 'sin²(θ)',
    functions: [
      { id: 'pol-sin2', expression: 'sin(theta)^2', label: 'r=sin²(θ)', color: '#0891b2', isValid: true },
    ],
  },
  {
    label: '1/θ',
    functions: [
      { id: 'pol-hyp', expression: '1/theta', label: 'r=1/θ', color: '#7c3aed', isValid: true },
    ],
  },
  {
    label: 'Rose 2+3',
    functions: [
      { id: 'pol-rose23', expression: '2 + sin(3*theta)', label: 'r=2+sin(3θ)', color: '#10b981', isValid: true },
    ],
  },
];

const PARAMETRIC_PRESETS: ParametricPreset[] = [
  {
    label: 'Circle',
    xFunctions: [{ id: 'par-cir-x', expression: 'sin(t)', label: 'x(t)', color: '#2563eb', isValid: true }],
    yFunctions: [{ id: 'par-cir-y', expression: 'cos(t)', label: 'y(t)', color: '#2563eb', isValid: true }],
  },
  {
    label: 'Lissajous',
    xFunctions: [{ id: 'par-lis-x', expression: '2*cos(t)', label: 'x(t)', color: '#8b5cf6', isValid: true }],
    yFunctions: [{ id: 'par-lis-y', expression: 'sin(2*t)', label: 'y(t)', color: '#8b5cf6', isValid: true }],
  },
  {
    label: 'Spiral',
    xFunctions: [{ id: 'par-spi-x', expression: 't*cos(t)', label: 'x(t)', color: '#059669', isValid: true }],
    yFunctions: [{ id: 'par-spi-y', expression: 't*sin(t)', label: 'y(t)', color: '#059669', isValid: true }],
  },
  {
    label: 'Cardioid',
    xFunctions: [{ id: 'par-crd-x', expression: 'cos(t)*(1-cos(t))', label: 'x(t)', color: '#dc2626', isValid: true }],
    yFunctions: [{ id: 'par-crd-y', expression: 'sin(t)*(1-cos(t))', label: 'y(t)', color: '#dc2626', isValid: true }],
  },
  {
    label: 'Astroid',
    xFunctions: [{ id: 'par-ast-x', expression: 'cos(t)^3', label: 'x(t)', color: '#ea580c', isValid: true }],
    yFunctions: [{ id: 'par-ast-y', expression: 'sin(t)^3', label: 'y(t)', color: '#ea580c', isValid: true }],
  },
  {
    label: 'Cycloid',
    xFunctions: [{ id: 'par-cyc-x', expression: 't - sin(t)', label: 'x(t)', color: '#f59e0b', isValid: true }],
    yFunctions: [{ id: 'par-cyc-y', expression: '1 - cos(t)', label: 'y(t)', color: '#f59e0b', isValid: true }],
  },
  {
    label: 'Epitrochoid',
    xFunctions: [{ id: 'par-epi-x', expression: '3*cos(t) - cos(3*t)', label: 'x(t)', color: '#ec4899', isValid: true }],
    yFunctions: [{ id: 'par-epi-y', expression: '3*sin(t) - sin(3*t)', label: 'y(t)', color: '#ec4899', isValid: true }],
  },
  {
    label: 'Hypotrochoid',
    xFunctions: [{ id: 'par-hyp-x', expression: '2*cos(t) + cos(2*t)', label: 'x(t)', color: '#0891b2', isValid: true }],
    yFunctions: [{ id: 'par-hyp-y', expression: '2*sin(t) - sin(2*t)', label: 'y(t)', color: '#0891b2', isValid: true }],
  },
  {
    label: 'Rose',
    xFunctions: [{ id: 'par-ros-x', expression: 'cos(3*t)*cos(t)', label: 'x(t)', color: '#7c3aed', isValid: true }],
    yFunctions: [{ id: 'par-ros-y', expression: 'cos(3*t)*sin(t)', label: 'y(t)', color: '#7c3aed', isValid: true }],
  },
  {
    label: 'Figure-8',
    xFunctions: [{ id: 'par-fig-x', expression: 'sin(t)', label: 'x(t)', color: '#10b981', isValid: true }],
    yFunctions: [{ id: 'par-fig-y', expression: 'sin(t)*cos(t)', label: 'y(t)', color: '#10b981', isValid: true }],
  },
];

// ---------------------------------------------------------------------------
// Fix 5: Redesigned preset chip component
// ---------------------------------------------------------------------------

interface PresetChipProps {
  label: string;
  onClick: () => void;
  accentGradient: string; // Tailwind gradient classes for border/glow on hover
  isActive?: boolean;
}

function PresetChip({ label, onClick, accentGradient, isActive = false }: PresetChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        // Base layout
        'relative px-3 py-1.5 rounded-lg text-xs font-medium',
        'transition-all duration-200 ease-out',
        // Focus ring
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        // Gradient border trick via pseudo-elements is achieved with a wrapper
        // approach: we use box-shadow + border for hover glow instead
        isActive
          ? [
              'text-foreground bg-background/80 border border-transparent',
              'shadow-[0_0_0_1.5px_var(--active-chip-ring),0_0_10px_var(--active-chip-glow)]',
              accentGradient,
            ].join(' ')
          : [
              'text-muted-foreground hover:text-foreground',
              'bg-background/40 hover:bg-background/70',
              'border border-border hover:border-transparent',
              // On hover we create a gradient border by using outline + inner shadow
              'hover:shadow-[0_0_0_1.5px_rgba(139,92,246,0.5),0_0_12px_rgba(139,92,246,0.15)]',
              accentGradient,
            ].join(' '),
      ].join(' ')}
      aria-label={`Load ${label} preset`}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PlotsExamplesPage() {
  const t = useTranslations('plots');
  const [activeTab, setActiveTab] = useState('2d-cartesian');

  // Canvas refs for export — populated by Plot2D's onCanvasReady callback
  const [cartesianCanvas, setCartesianCanvas] = useState<HTMLCanvasElement | null>(null);
  const [polarCanvas, setPolarCanvas] = useState<HTMLCanvasElement | null>(null);
  const [parametricCanvas, setParametricCanvas] = useState<HTMLCanvasElement | null>(null);

  // Live viewport state — updated by the Plot2D pan/zoom events so the
  // analysis panel always reflects the current view.
  const [cartesianViewport, setCartesianViewport] = useState({
    xMin: -2 * Math.PI,
    xMax: 2 * Math.PI,
    yMin: -1.5,
    yMax: 1.5,
  });
  // parametricViewport is tracked for future analysis panel use
  const [_parametricViewport, setParametricViewport] = useState({
    xMin: -4,
    xMax: 4,
    yMin: -4,
    yMax: 4,
  });

  // Stable callbacks so Plot2D's initialization effect sees a consistent reference
  const handleCartesianCanvasReady = useCallback((c: HTMLCanvasElement) => { setCartesianCanvas(c); }, []);
  const handlePolarCanvasReady = useCallback((c: HTMLCanvasElement) => { setPolarCanvas(c); }, []);
  const handleParametricCanvasReady = useCallback((c: HTMLCanvasElement) => { setParametricCanvas(c); }, []);

  // Custom function state
  const [customFunctions, setCustomFunctions] = useState<FunctionDefinition[]>([
    { id: 'default-1', expression: 'sin(x)', label: 'sin(x)', color: '#2563eb', isValid: true },
    { id: 'default-2', expression: 'cos(x)', label: 'cos(x)', color: '#dc2626', isValid: true },
  ]);

  const [polarFunctions, setPolarFunctions] = useState<FunctionDefinition[]>([
    { id: 'polar-1', expression: '2 + sin(5*theta)', label: 'Rose curve', color: '#8b5cf6', isValid: true },
  ]);

  const [parametricFunctionsX, setParametricFunctionsX] = useState<FunctionDefinition[]>([
    { id: 'param-x-1', expression: 'cos(t) * (2 + cos(5 * t))', label: 'x(t)', color: '#059669', isValid: true },
  ]);

  const [parametricFunctionsY, setParametricFunctionsY] = useState<FunctionDefinition[]>([
    { id: 'param-y-1', expression: 'sin(t) * (2 + cos(5 * t))', label: 'y(t)', color: '#059669', isValid: true },
  ]);

  // Slider parameter values for each tab — keyed by parameter name, value is number
  const [cartesianSliderValues, setCartesianSliderValues] = useState<Record<string, number>>({});
  const [polarSliderValues, setPolarSliderValues] = useState<Record<string, number>>({});
  const [parametricSliderValues, setParametricSliderValues] = useState<Record<string, number>>({});

  // Active preset labels for visual indication
  const [activeCartesian, setActiveCartesian] = useState<string | null>(null);
  const [activePolar, setActivePolar] = useState<string | null>(null);
  const [activeParametric, setActiveParametric] = useState<string | null>(null);

  // Preset click handlers
  const handleCartesianPreset = useCallback((preset: CartesianPreset) => {
    setCustomFunctions(preset.functions);
    setActiveCartesian(preset.label);
  }, []);

  const handlePolarPreset = useCallback((preset: PolarPreset) => {
    setPolarFunctions(preset.functions);
    setActivePolar(preset.label);
  }, []);

  const handleParametricPreset = useCallback((preset: ParametricPreset) => {
    setParametricFunctionsX(preset.xFunctions);
    setParametricFunctionsY(preset.yFunctions);
    setActiveParametric(preset.label);
  }, []);

  // Convert custom functions to plot config functions
  const customPlotFunctions = useMemo(() => {
    return customFunctions
      .filter(fn => fn.isValid && fn.expression.trim())
      .map(fn => ({
        fn: (x: number) => {
          const result = evaluate(fn.expression, { variables: { x, ...cartesianSliderValues } });
          return result.success ? Number(result.value) : NaN;
        },
        label: fn.label,
        style: { line: { width: 2, color: fn.color } },
      }));
  }, [customFunctions, cartesianSliderValues]);

  const customPolarPlotFunctions = useMemo(() => {
    return polarFunctions
      .filter(fn => fn.isValid && fn.expression.trim())
      .map(fn => ({
        fn: (theta: number) => {
          const result = evaluate(fn.expression, { variables: { theta, ...polarSliderValues } });
          return result.success ? Number(result.value) : NaN;
        },
        label: fn.label,
        style: { line: { width: 2, color: fn.color } },
      }));
  }, [polarFunctions, polarSliderValues]);

  // Convert parametric functions to plot config
  const customParametricPlotFunctions = useMemo(() => {
    const xFn = parametricFunctionsX[0];
    const yFn = parametricFunctionsY[0];

    if (!xFn || !yFn || !xFn.isValid || !yFn.isValid) {
      return [{
        x: (t: number) => Math.cos(t) * (2 + Math.cos(5 * t)),
        y: (t: number) => Math.sin(t) * (2 + Math.cos(5 * t)),
        label: 'Parametric curve',
        style: { line: { width: 2, color: '#059669' } },
      }];
    }

    return [{
      x: (t: number) => {
        const result = evaluate(xFn.expression, { variables: { t, ...parametricSliderValues } });
        return result.success ? Number(result.value) : NaN;
      },
      y: (t: number) => {
        const result = evaluate(yFn.expression, { variables: { t, ...parametricSliderValues } });
        return result.success ? Number(result.value) : NaN;
      },
      label: xFn.label || 'Parametric curve',
      style: { line: { width: 2, color: xFn.color } },
    }];
  }, [parametricFunctionsX, parametricFunctionsY, parametricSliderValues]);

  // Fix 4: Analysis panel functions — memoised AnalysisFunction arrays
  const cartesianAnalysisFunctions = useMemo<AnalysisFunction[]>(() => {
    return customFunctions
      .filter(fn => fn.isValid && fn.expression.trim())
      .map(fn => ({
        fn: (x: number) => {
          const result = evaluate(fn.expression, { variables: { x, ...cartesianSliderValues } });
          return result.success ? Number(result.value) : NaN;
        },
        label: fn.label,
        color: fn.color,
      }));
  }, [customFunctions, cartesianSliderValues]);

  // Polar analysis functions — memoised PolarAnalysisFunction arrays
  const polarAnalysisFunctions = useMemo<PolarAnalysisFunction[]>(() => {
    return polarFunctions
      .filter(fn => fn.isValid && fn.expression.trim())
      .map(fn => ({
        fn: (theta: number) => {
          const result = evaluate(fn.expression, { variables: { theta, ...polarSliderValues } });
          return result.success ? Number(result.value) : NaN;
        },
        label: fn.label,
        color: fn.color,
        expression: fn.expression,
      }));
  }, [polarFunctions, polarSliderValues]);

  // Configs
  const cartesianConfig: Plot2DCartesianConfig = {
    type: '2d-cartesian',
    functions: customPlotFunctions,
    viewport: {
      xMin: -2 * Math.PI,
      xMax: 2 * Math.PI,
      yMin: -1.5,
      yMax: 1.5,
    },
    xAxis: {
      label: 'x',
      min: -2 * Math.PI,
      max: 2 * Math.PI,
      scale: 'linear',
      grid: { enabled: true, majorStep: Math.PI / 2, color: '#e5e7eb', opacity: 0.5 },
      ticks: {
        enabled: true,
        format: (v) => {
          if (v === 0) return '0';
          if (Math.abs(v - Math.PI) < 0.01) return 'π';
          if (Math.abs(v + Math.PI) < 0.01) return '-π';
          if (Math.abs(v - 2 * Math.PI) < 0.01) return '2π';
          if (Math.abs(v + 2 * Math.PI) < 0.01) return '-2π';
          return v.toFixed(1);
        },
      },
    },
    yAxis: {
      label: 'y',
      min: -1.5,
      max: 1.5,
      scale: 'linear',
      grid: { enabled: true, majorStep: 0.5, color: '#e5e7eb', opacity: 0.5 },
      ticks: { enabled: true, format: (v) => v.toFixed(1) },
    },
    title: 'Cartesian Functions',
    legend: { enabled: true, position: 'top-right' },
  };

  const polarConfig: Plot2DPolarConfig = {
    type: '2d-polar',
    functions: customPolarPlotFunctions,
    thetaRange: { min: 0, max: 2 * Math.PI },
    rRange: { min: 0, max: 3.5 },
    title: 'Polar Plot',
  };

  const parametricConfig: Plot2DParametricConfig = {
    type: '2d-parametric',
    functions: customParametricPlotFunctions,
    tRange: { min: 0, max: 2 * Math.PI },
    viewport: {
      xMin: -4,
      xMax: 4,
      yMin: -4,
      yMax: 4,
    },
    title: 'Parametric Curve',
  };

  // ---------------------------------------------------------------------------
  // Shared rendering helpers
  // ---------------------------------------------------------------------------

  /** Preset chip group with category label + wrap */
  function PresetGroup({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="mb-4">
        <p
          className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"
        >
          <span className="h-px flex-1 bg-border/50" />
          {label}
          <span className="h-px flex-1 bg-border/50" />
        </p>
        <div className="flex flex-wrap gap-1.5">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />
        <motion.div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container mx-auto py-8 px-4 relative">
        {/* Sticky header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-40 mb-8 -mx-4 px-4 py-6 bg-background/60 backdrop-blur-xl border-b border-border/50"
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                    <Layers className="h-6 w-6 text-cyan-400" />
                  </div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                    {t('pageTitle')}
                  </h1>
                </div>
                <p className="text-muted-foreground text-sm md:text-base ml-14">
                  {t('subtitle')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 ml-14 md:ml-0">
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
                  <Zap className="h-3 w-3 mr-1" />
                  {t('badge.fps')}
                </Badge>
                <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10">
                  <Activity className="h-3 w-3 mr-1" />
                  {t('badge.interactive')}
                </Badge>
                <Badge variant="outline" className="border-blue-500/30 text-blue-300 bg-blue-500/10">
                  <Maximize2 className="h-3 w-3 mr-1" />
                  {t('badge.responsive')}
                </Badge>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <TabsList className="mb-8 p-1.5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <TabsTrigger
                value="2d-cartesian"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-cyan-900/50 data-[state=active]:to-blue-900/50 data-[state=active]:text-cyan-100 data-[state=active]:border data-[state=active]:border-cyan-500/50 data-[state=active]:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all duration-200"
              >
                {t('tab.2dCartesian')}
              </TabsTrigger>
              <TabsTrigger
                value="2d-polar"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-900/50 data-[state=active]:to-pink-900/50 data-[state=active]:text-purple-100 data-[state=active]:border data-[state=active]:border-purple-500/50 data-[state=active]:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-200"
              >
                {t('tab.2dPolar')}
              </TabsTrigger>
              <TabsTrigger
                value="2d-parametric"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-900/50 data-[state=active]:to-teal-900/50 data-[state=active]:text-green-100 data-[state=active]:border data-[state=active]:border-green-500/50 data-[state=active]:shadow-[0_0_15px_rgba(5,150,105,0.3)] transition-all duration-200"
              >
                {t('tab.2dParametric')}
              </TabsTrigger>
              <TabsTrigger
                value="3d-surface"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-900/50 data-[state=active]:to-red-900/50 data-[state=active]:text-orange-100 data-[state=active]:border data-[state=active]:border-orange-500/50 data-[state=active]:shadow-[0_0_15px_rgba(251,146,60,0.3)] transition-all duration-200"
              >
                {t('tab.3dSurface')}
              </TabsTrigger>
            </TabsList>
          </motion.div>

          {/* ----------------------------------------------------------------
              2D CARTESIAN TAB
          ---------------------------------------------------------------- */}
          <TabsContent value="2d-cartesian" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  {/* Preset chips card */}
                  <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 pointer-events-none" />
                    <div className="relative">
                      <PresetGroup label="Cartesian Presets">
                        {CARTESIAN_PRESETS.map((preset) => (
                          <PresetChip
                            key={preset.label}
                            label={preset.label}
                            onClick={() => handleCartesianPreset(preset)}
                            accentGradient="hover:shadow-[0_0_0_1.5px_rgba(6,182,212,0.6),0_0_14px_rgba(6,182,212,0.2)]"
                            isActive={activeCartesian === preset.label}
                          />
                        ))}
                      </PresetGroup>
                    </div>
                  </div>

                  {/* Function input card */}
                  <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 pointer-events-none" />
                    <div className="relative">
                      <FunctionInput
                        functions={customFunctions}
                        onChange={(fns) => { setCustomFunctions(fns); setActiveCartesian(null); }}
                        plotType="2d-cartesian"
                        maxFunctions={8}
                      />
                    </div>
                  </div>

                  {/* Variable sliders — shown only when free parameters are detected */}
                  <VariableSliders
                    expressions={customFunctions.map(fn => fn.expression)}
                    onChange={setCartesianSliderValues}
                  />
                </div>
              </div>

              {/* Plot + analysis */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-end mb-2">
                  <PlotExportToolbar canvas={cartesianCanvas} plotConfig={cartesianConfig} label="cartesian" />
                </div>
                <PlotContainer
                  title="2D Cartesian Plot"
                  description="Interactive plot with pan and zoom controls. Drag to pan, scroll to zoom."
                >
                  <div className="w-full aspect-[4/3]">
                    <Plot2D
                      config={cartesianConfig}
                      enableInteractions={true}
                      enableAnnotations={true}
                      onCanvasReady={handleCartesianCanvasReady}
                      onViewportChange={setCartesianViewport}
                    />
                  </div>
                </PlotContainer>

                {/* Fix 4: Analysis panel */}
                {cartesianAnalysisFunctions.length > 0 && (
                  <PlotAnalysisPanel
                    functions={cartesianAnalysisFunctions}
                    viewport={cartesianViewport}
                    samples={500}
                  />
                )}
              </div>
            </motion.div>

            <div className="bg-gradient-to-br from-background/80 to-card/80 p-4 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Example Code</h3>
              <pre className="text-xs bg-background/80 text-foreground/80 p-3 rounded overflow-x-auto border border-border">
                {`import { Plot2D } from '@nextcalc/web/components/plots';

const config = {
  type: '2d-cartesian',
  functions: [
    { fn: (x) => Math.sin(x), label: 'sin(x)' },
    { fn: (x) => Math.cos(x), label: 'cos(x)' },
  ],
  viewport: { xMin: -6.28, xMax: 6.28, yMin: -1.5, yMax: 1.5 },
};

<Plot2D config={config} />`}
              </pre>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------------
              2D POLAR TAB
          ---------------------------------------------------------------- */}
          <TabsContent value="2d-polar" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  {/* Preset chips card */}
                  <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 pointer-events-none" />
                    <div className="relative">
                      <PresetGroup label="Polar Presets">
                        {POLAR_PRESETS.map((preset) => (
                          <PresetChip
                            key={preset.label}
                            label={preset.label}
                            onClick={() => handlePolarPreset(preset)}
                            accentGradient="hover:shadow-[0_0_0_1.5px_rgba(168,85,247,0.6),0_0_14px_rgba(168,85,247,0.2)]"
                            isActive={activePolar === preset.label}
                          />
                        ))}
                      </PresetGroup>
                    </div>
                  </div>

                  {/* Function input card */}
                  <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 pointer-events-none" />
                    <div className="relative">
                      <FunctionInput
                        functions={polarFunctions}
                        onChange={(fns) => { setPolarFunctions(fns); setActivePolar(null); }}
                        plotType="2d-polar"
                        maxFunctions={8}
                      />
                    </div>
                  </div>

                  {/* Variable sliders — shown only when free parameters are detected */}
                  <VariableSliders
                    expressions={polarFunctions.map(fn => fn.expression)}
                    onChange={setPolarSliderValues}
                  />
                </div>
              </div>

              {/* Plot area + analysis */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-end mb-2">
                  <PlotExportToolbar canvas={polarCanvas} plotConfig={polarConfig} label="polar" />
                </div>
                <PlotContainer
                  title="2D Polar Plot"
                  description="Polar coordinate plotting. Scroll to zoom in/out, drag to pan."
                >
                  <div className="w-full aspect-[4/3]">
                    <Plot2D
                      config={polarConfig}
                      enableInteractions={true}
                      onCanvasReady={handlePolarCanvasReady}
                    />
                  </div>
                </PlotContainer>

                {/* Polar analysis panel */}
                {polarAnalysisFunctions.length > 0 && (
                  <PolarAnalysisPanel
                    functions={polarAnalysisFunctions}
                    samples={1000}
                  />
                )}
              </div>
            </motion.div>

            <div className="bg-gradient-to-br from-background/80 to-card/80 p-4 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Example Code</h3>
              <pre className="text-xs bg-background/80 text-foreground/80 p-3 rounded overflow-x-auto border border-border">
                {`const config = {
  type: '2d-polar',
  functions: [
    { fn: (theta) => 2 + Math.sin(5 * theta) },
  ],
  thetaRange: { min: 0, max: 2 * Math.PI },
  rRange: { min: 0, max: 3.5 },
};`}
              </pre>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------------
              2D PARAMETRIC TAB
          ---------------------------------------------------------------- */}
          <TabsContent value="2d-parametric" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-4">
                {/* Preset chips card */}
                <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-green-500/5 to-teal-500/5 pointer-events-none" />
                  <div className="relative">
                    <PresetGroup label="Parametric Presets">
                      {PARAMETRIC_PRESETS.map((preset) => (
                        <PresetChip
                          key={preset.label}
                          label={preset.label}
                          onClick={() => handleParametricPreset(preset)}
                          accentGradient="hover:shadow-[0_0_0_1.5px_rgba(5,150,105,0.6),0_0_14px_rgba(5,150,105,0.2)]"
                          isActive={activeParametric === preset.label}
                        />
                      ))}
                    </PresetGroup>
                  </div>
                </div>

                {/* x(t) */}
                <div className="sticky top-24 space-y-4">
                  <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-green-500/5 to-teal-500/5 pointer-events-none" />
                    <div className="relative">
                      <h3 className="text-sm font-semibold text-green-100 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(5,150,105,0.6)]" />
                        x(t) Function
                      </h3>
                      <FunctionInput
                        functions={parametricFunctionsX}
                        onChange={(fns) => { setParametricFunctionsX(fns); setActiveParametric(null); }}
                        plotType="2d-cartesian"
                        maxFunctions={1}
                      />
                    </div>
                  </div>

                  {/* y(t) */}
                  <div className="relative p-5 rounded-xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-500/5 to-cyan-500/5 pointer-events-none" />
                    <div className="relative">
                      <h3 className="text-sm font-semibold text-teal-100 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                        y(t) Function
                      </h3>
                      <FunctionInput
                        functions={parametricFunctionsY}
                        onChange={(fns) => { setParametricFunctionsY(fns); setActiveParametric(null); }}
                        plotType="2d-cartesian"
                        maxFunctions={1}
                      />
                    </div>
                  </div>

                  {/* Variable sliders — shown only when free parameters are detected */}
                  <VariableSliders
                    expressions={[
                      ...parametricFunctionsX.map(fn => fn.expression),
                      ...parametricFunctionsY.map(fn => fn.expression),
                    ]}
                    onChange={setParametricSliderValues}
                  />
                </div>
              </div>

              {/* Plot + analysis */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-end mb-2">
                  <PlotExportToolbar canvas={parametricCanvas} plotConfig={parametricConfig} label="parametric" />
                </div>
                <PlotContainer
                  title="2D Parametric Curve"
                  description="Parametric equations with separate functions for x(t) and y(t). Use 't' as the variable."
                >
                  <div className="w-full aspect-[4/3]">
                    <Plot2D
                      config={parametricConfig}
                      enableInteractions={true}
                      onCanvasReady={handleParametricCanvasReady}
                      onViewportChange={setParametricViewport}
                    />
                  </div>
                </PlotContainer>

                {/* Analysis panel for x(t) and y(t) component functions */}
                {(parametricFunctionsX[0]?.isValid || parametricFunctionsY[0]?.isValid) && (() => {
                  const xFn = parametricFunctionsX[0];
                  const yFn = parametricFunctionsY[0];
                  const analysisFns: AnalysisFunction[] = [];
                  if (xFn?.isValid && xFn.expression.trim()) {
                    analysisFns.push({
                      fn: (t: number) => {
                        const r = evaluate(xFn.expression, { variables: { t, ...parametricSliderValues } });
                        return r.success ? Number(r.value) : NaN;
                      },
                      label: `x(t): ${xFn.label || xFn.expression}`,
                      color: xFn.color,
                    });
                  }
                  if (yFn?.isValid && yFn.expression.trim()) {
                    analysisFns.push({
                      fn: (t: number) => {
                        const r = evaluate(yFn.expression, { variables: { t, ...parametricSliderValues } });
                        return r.success ? Number(r.value) : NaN;
                      },
                      label: `y(t): ${yFn.label || yFn.expression}`,
                      color: yFn.color,
                    });
                  }
                  return analysisFns.length > 0 ? (
                    <PlotAnalysisPanel
                      functions={analysisFns}
                      viewport={{ xMin: 0, xMax: 2 * Math.PI, yMin: -4, yMax: 4 }}
                      samples={400}
                    />
                  ) : null;
                })()}
              </div>
            </motion.div>

            <div className="bg-gradient-to-br from-background/80 to-card/80 p-4 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Example Code</h3>
              <pre className="text-xs bg-background/80 text-foreground/80 p-3 rounded overflow-x-auto border border-border">
                {`const config = {
  type: '2d-parametric',
  functions: [{
    x: (t) => Math.cos(t) * (2 + Math.cos(5 * t)),
    y: (t) => Math.sin(t) * (2 + Math.cos(5 * t)),
  }],
  tRange: { min: 0, max: 2 * Math.PI },
};`}
              </pre>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------------
              3D SURFACE TAB
          ---------------------------------------------------------------- */}
          <TabsContent value="3d-surface" className="space-y-4">
            <SurfaceEditor3D initialPreset="sinc" width={800} height={600} />

            <div className="relative group p-4 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border shadow-[0_0_15px_rgba(148,163,184,0.15)] hover:shadow-[0_0_25px_rgba(148,163,184,0.25)] transition-all duration-300">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-muted/5 to-muted/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <p className="text-sm text-foreground/80 relative">
                <strong className="text-foreground">Features:</strong> 10 preset shapes (Sphere, Sinc, Ripple, Saddle, Egg Carton, Monkey Saddle, Peaks, Gaussian, Torus, Helix) + Custom equation editor.
              </p>
            </div>

            <div className="bg-gradient-to-br from-background/80 to-card/80 p-4 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Example Code</h3>
              <pre className="text-xs bg-background/80 text-foreground/80 p-3 rounded overflow-x-auto border border-border">
                {`import { SurfaceEditor3D } from '@/components/plots';

<SurfaceEditor3D
  initialPreset="sinc"
  width={800}
  height={600}
/>`}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group relative p-6 rounded-xl overflow-hidden bg-gradient-to-br from-blue-950/40 to-blue-900/40 border border-blue-500/40 hover:border-blue-400/70 shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_35px_rgba(59,130,246,0.4)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/40">
                  <Zap className="h-5 w-5 text-blue-300" />
                </div>
                <h3 className="font-semibold text-blue-300">Performance</h3>
              </div>
              <ul className="text-sm text-blue-200/80 space-y-2">
                {['60fps for 10k+ points (2D)', 'Sub-50ms initialization', 'Low memory footprint', 'GPU-accelerated rendering'].map(t => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group relative p-6 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-950/40 to-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_35px_rgba(16,185,129,0.4)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
                  <Activity className="h-5 w-5 text-emerald-300" />
                </div>
                <h3 className="font-semibold text-emerald-300">Features</h3>
              </div>
              <ul className="text-sm text-emerald-200/80 space-y-2">
                {['Adaptive sampling', 'Interactive controls', 'Export to PNG/SVG/CSV', 'Touch support'].map(t => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group relative p-6 rounded-xl overflow-hidden bg-gradient-to-br from-purple-950/40 to-purple-900/40 border border-purple-500/40 hover:border-purple-400/70 shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_35px_rgba(168,85,247,0.4)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/40">
                  <Layers className="h-5 w-5 text-purple-300" />
                </div>
                <h3 className="font-semibold text-purple-300">Coordinates</h3>
              </div>
              <ul className="text-sm text-purple-200/80 space-y-2">
                {['Cartesian (x, y)', 'Polar (r, θ)', 'Parametric (x(t), y(t))', '3D Surface (x, y, z)'].map(t => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-purple-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
