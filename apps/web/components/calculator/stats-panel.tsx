'use client';

import { AlertCircle, BarChart3, Check, Copy, Sparkles, TrendingUp, X } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Branded type for validated dataset
 */
type ValidatedDataset = number[] & { readonly __brand: unique symbol };

/**
 * Branded type for regression quality levels
 */
type RegressionQuality = 'excellent' | 'good' | 'moderate' | 'poor';

/**
 * Descriptive statistics result
 */
interface DescriptiveStats {
  mean: number;
  median: number;
  mode: number[];
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
  count: number;
}

/**
 * Regression analysis result with quality indicator
 */
interface RegressionResult {
  type: 'linear' | 'polynomial' | 'exponential';
  equation: string;
  coefficients: string[];
  r2: number;
  quality: RegressionQuality;
  correlation?: number;
}

/**
 * Example datasets for quick testing
 */
const EXAMPLE_DATASETS = {
  normal: {
    name: 'Normal Distribution',
    data: [23, 25, 22, 28, 30, 26, 24, 27, 29, 25, 26, 24, 28, 23, 27],
  },
  bimodal: {
    name: 'Bimodal Distribution',
    data: [10, 11, 10, 12, 11, 10, 30, 31, 30, 32, 31, 30],
  },
  linear: {
    name: 'Linear Relationship',
    x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    y: [2.1, 4.2, 5.8, 8.1, 9.9, 12.2, 14.1, 15.8, 18.2, 20.1],
  },
} as const;

/**
 * Parse comma or space-separated numbers from string
 */
function parseNumbers(input: string): number[] {
  return input
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Parse multi-line numbers (one per line)
 */
function parseMultilineNumbers(input: string): number[] {
  return input
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Validate dataset and return branded type
 */
function validateDataset(data: number[]): ValidatedDataset | null {
  if (data.length === 0) return null;
  if (data.some((n) => !Number.isFinite(n))) return null;
  return data as ValidatedDataset;
}

/**
 * Determine regression quality from R² value
 */
function getRegressionQuality(r2: number): RegressionQuality {
  if (r2 > 0.9) return 'excellent';
  if (r2 > 0.7) return 'good';
  if (r2 > 0.5) return 'moderate';
  return 'poor';
}

/**
 * Format number to 4 decimal places
 */
function formatNumber(n: number): string {
  return n.toFixed(4);
}

/**
 * Copy to clipboard with feedback
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * StatCard component for displaying individual statistics.
 * Uses glass-morphism treatment with semantic color tokens.
 */
interface StatCardProps {
  label: string;
  value: string | number;
  /** Optional accent color variant for visual grouping */
  accent?: 'primary' | 'emerald' | 'violet' | 'amber';
  onCopy?: () => void;
  copied?: boolean;
}

function StatCard({ label, value, accent, onCopy, copied }: StatCardProps) {
  const accentBar = {
    primary: 'bg-[oklch(0.65_0.22_264)]',
    emerald: 'bg-[oklch(0.65_0.18_155)]',
    violet: 'bg-[oklch(0.63_0.20_300)]',
    amber: 'bg-[oklch(0.78_0.18_80)]',
  } satisfies Record<NonNullable<StatCardProps['accent']>, string>;

  return (
    <div
      className={cn(
        'group relative flex items-center justify-between p-3 rounded-xl',
        'border border-border',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60',
        'backdrop-blur-md',
        'shadow-[0_2px_8px_0_rgba(0,0,0,0.08)]',
        'hover:shadow-[0_4px_16px_0_rgba(0,0,0,0.12)]',
        'hover:border-primary/30',
        'transition-all duration-300',
      )}
    >
      {/* Left accent strip */}
      {accent && (
        <div
          className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-full', accentBar[accent])}
          aria-hidden="true"
        />
      )}
      <div className={cn('flex-1', accent && 'pl-2.5')}>
        <p className="text-xs text-muted-foreground mb-1 font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="text-lg font-mono font-semibold text-foreground">{value}</p>
      </div>
      {onCopy && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 ml-2 shrink-0',
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            'transition-opacity duration-200',
            'hover:bg-primary/10',
          )}
          onClick={onCopy}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-4 w-4 text-[oklch(0.65_0.18_155)]" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * Box plot visualization using SVG with OKLCH palette colors.
 * Keyboard accessible via role="img" and aria-label.
 */
interface BoxPlotProps {
  stats: Pick<DescriptiveStats, 'min' | 'max' | 'q1' | 'q2' | 'q3' | 'iqr'>;
  width?: number;
  height?: number;
}

interface HoveredStat {
  label: string;
  value: number;
  x: number;
  y: number;
}

function BoxPlot({ stats, width = 400, height = 110 }: BoxPlotProps) {
  const { min, max, q1, q2, q3, iqr } = stats;
  const [hoveredStat, setHoveredStat] = useState<HoveredStat | null>(null);

  const range = max - min;
  const padding = 50;
  const plotWidth = width - 2 * padding;
  const midY = height / 2 - 8;

  const scale = (value: number) => {
    if (range === 0) return padding + plotWidth / 2;
    return padding + ((value - min) / range) * plotWidth;
  };

  const handleMouseEnter = (label: string, value: number) => (e: MouseEvent) => {
    setHoveredStat({ label, value, x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: MouseEvent) => {
    setHoveredStat((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  };

  const handleMouseLeave = () => {
    setHoveredStat(null);
  };

  // OKLCH palette values as stroke/fill references
  const colorPrimary = 'oklch(0.65 0.22 264)';
  const colorEmerald = 'oklch(0.65 0.18 155)';
  const colorViolet = 'oklch(0.63 0.20 300)';

  // Invisible hit-target width for thin lines
  const hitTargetWidth = 14;

  return (
    <>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto max-w-full"
        role="img"
        aria-label={`Box plot: min ${formatNumber(min)}, Q1 ${formatNumber(q1)}, median ${formatNumber(q2)}, Q3 ${formatNumber(q3)}, max ${formatNumber(max)}`}
      >
        <title>Box Plot Visualization</title>
        <defs>
          <linearGradient id="boxFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorPrimary} stopOpacity="0.15" />
            <stop offset="50%" stopColor={colorViolet} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colorPrimary} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Left whisker line (min to Q1) */}
        <line
          x1={scale(min)}
          y1={midY}
          x2={scale(q1)}
          y2={midY}
          stroke={colorEmerald}
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />

        {/* Right whisker line (Q3 to max) */}
        <line
          x1={scale(q3)}
          y1={midY}
          x2={scale(max)}
          y2={midY}
          stroke={colorEmerald}
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />

        {/* IQR box with gradient fill */}
        <rect
          x={scale(q1)}
          y={midY - 18}
          width={scale(q3) - scale(q1)}
          height={36}
          fill="url(#boxFill)"
          stroke={colorPrimary}
          strokeWidth="2"
          rx="5"
          ry="5"
        />
        {/* Invisible hit target for box body (IQR hover) */}
        <rect
          x={scale(q1)}
          y={midY - 18}
          width={scale(q3) - scale(q1)}
          height={36}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={handleMouseEnter('IQR', iqr)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Median line */}
        <line
          x1={scale(q2)}
          y1={midY - 18}
          x2={scale(q2)}
          y2={midY + 18}
          stroke={colorEmerald}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Invisible hit target for median */}
        <line
          x1={scale(q2)}
          y1={midY - 18}
          x2={scale(q2)}
          y2={midY + 18}
          stroke="transparent"
          strokeWidth={hitTargetWidth}
          className="cursor-pointer"
          onMouseEnter={handleMouseEnter('Median (Q2)', q2)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Min whisker cap — vertical bar perpendicular to the horizontal whisker */}
        <line
          x1={scale(min)}
          y1={midY - 15}
          x2={scale(min)}
          y2={midY + 15}
          stroke={colorEmerald}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Invisible hit target for min cap */}
        <line
          x1={scale(min)}
          y1={midY - 15}
          x2={scale(min)}
          y2={midY + 15}
          stroke="transparent"
          strokeWidth={hitTargetWidth}
          className="cursor-pointer"
          onMouseEnter={handleMouseEnter('Min', min)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Max whisker cap — vertical bar perpendicular to the horizontal whisker */}
        <line
          x1={scale(max)}
          y1={midY - 15}
          x2={scale(max)}
          y2={midY + 15}
          stroke={colorEmerald}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Invisible hit target for max cap */}
        <line
          x1={scale(max)}
          y1={midY - 15}
          x2={scale(max)}
          y2={midY + 15}
          stroke="transparent"
          strokeWidth={hitTargetWidth}
          className="cursor-pointer"
          onMouseEnter={handleMouseEnter('Max', max)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Q1 edge — invisible hit target on left edge of box */}
        <line
          x1={scale(q1)}
          y1={midY - 18}
          x2={scale(q1)}
          y2={midY + 18}
          stroke="transparent"
          strokeWidth={hitTargetWidth}
          className="cursor-pointer"
          onMouseEnter={handleMouseEnter('Q1 (25th percentile)', q1)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Q3 edge — invisible hit target on right edge of box */}
        <line
          x1={scale(q3)}
          y1={midY - 18}
          x2={scale(q3)}
          y2={midY + 18}
          stroke="transparent"
          strokeWidth={hitTargetWidth}
          className="cursor-pointer"
          onMouseEnter={handleMouseEnter('Q3 (75th percentile)', q3)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Labels rendered with CSS class for theme-aware text */}
        <text
          x={scale(min)}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          className="fill-muted-foreground font-mono"
        >
          {formatNumber(min)}
        </text>
        <text
          x={scale(q1)}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          className="fill-muted-foreground font-mono"
        >
          Q1
        </text>
        <text
          x={scale(q2)}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          fill={colorEmerald}
          className="font-mono font-semibold"
        >
          Q2
        </text>
        <text
          x={scale(q3)}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          className="fill-muted-foreground font-mono"
        >
          Q3
        </text>
        <text
          x={scale(max)}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          className="fill-muted-foreground font-mono"
        >
          {formatNumber(max)}
        </text>
      </svg>

      {/* Hover tooltip (rendered outside SVG for proper positioning) */}
      {hoveredStat && (
        <div
          className="fixed bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-sm shadow-lg pointer-events-none z-50"
          style={{ left: hoveredStat.x + 12, top: hoveredStat.y - 10 }}
        >
          <span className="font-medium">{hoveredStat.label}:</span> {hoveredStat.value.toFixed(4)}
        </div>
      )}
    </>
  );
}

/**
 * R² Quality Indicator Badge.
 * Uses OKLCH-based semantic tokens instead of raw Tailwind gray/color classes.
 */
interface R2BadgeProps {
  r2: number;
  quality: RegressionQuality;
}

function R2Badge({ r2, quality }: R2BadgeProps) {
  /**
   * Each quality level maps to an OKLCH-derived inline style so the badge
   * respects the design system palette without leaking raw color utility classes.
   */
  const qualityStyles = {
    excellent: {
      background: 'oklch(0.65 0.18 155 / 0.12)',
      border: 'oklch(0.65 0.18 155 / 0.35)',
      color: 'oklch(0.50 0.18 155)',
    },
    good: {
      background: 'oklch(0.65 0.22 264 / 0.12)',
      border: 'oklch(0.65 0.22 264 / 0.35)',
      color: 'oklch(0.50 0.22 264)',
    },
    moderate: {
      background: 'oklch(0.78 0.18 80 / 0.12)',
      border: 'oklch(0.78 0.18 80 / 0.35)',
      color: 'oklch(0.60 0.18 80)',
    },
    poor: {
      background: 'oklch(0.60 0.20 25 / 0.12)',
      border: 'oklch(0.60 0.20 25 / 0.35)',
      color: 'oklch(0.50 0.20 25)',
    },
  } satisfies Record<RegressionQuality, { background: string; border: string; color: string }>;

  const style = qualityStyles[quality];

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border"
      style={{
        background: style.background,
        borderColor: style.border,
        color: style.color,
      }}
      aria-label={`R-squared value ${formatNumber(r2)}, quality: ${quality}`}
    >
      <span>R&sup2; = {formatNumber(r2)}</span>
      <span className="capitalize opacity-80">({quality})</span>
    </div>
  );
}

/**
 * Section divider with gradient accent line matching the app's design language.
 */
function SectionDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Glass panel wrapper for result sections.
 */
interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  /** Accent color for the top border highlight */
  accent?: 'primary' | 'emerald' | 'violet';
}

function GlassPanel({ children, className, accent = 'primary' }: GlassPanelProps) {
  const accentGradient = {
    primary:
      'from-[oklch(0.65_0.22_264/0.6)] via-[oklch(0.63_0.20_300/0.4)] to-[oklch(0.65_0.22_264/0.6)]',
    emerald:
      'from-[oklch(0.65_0.18_155/0.6)] via-[oklch(0.65_0.22_264/0.4)] to-[oklch(0.65_0.18_155/0.6)]',
    violet:
      'from-[oklch(0.63_0.20_300/0.6)] via-[oklch(0.65_0.18_155/0.4)] to-[oklch(0.63_0.20_300/0.6)]',
  } satisfies Record<NonNullable<GlassPanelProps['accent']>, string>;

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden',
        'border border-border',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60',
        'backdrop-blur-md',
        'shadow-[0_8px_32px_0_rgba(0,0,0,0.10)]',
        className,
      )}
    >
      {/* Top accent line */}
      <div
        className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r', accentGradient[accent])}
        aria-hidden="true"
      />
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * Main Statistics Panel Component
 */
export function StatsPanel() {
  const [isPending, startTransition] = useTransition();

  // Single dataset state
  const [inputMode, setInputMode] = useState<'manual' | 'paste'>('manual');
  const [dataInput, setDataInput] = useState('');
  const [data, setData] = useState<number[]>([]);

  // Regression state
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [xData, setXData] = useState<number[]>([]);
  const [yData, setYData] = useState<number[]>([]);
  const [regressionType, setRegressionType] = useState<'linear' | 'polynomial' | 'exponential'>(
    'linear',
  );
  const [polynomialDegree, setPolynomialDegree] = useState(2);
  const [predictionInput, setPredictionInput] = useState('');
  const [predictionResult, setPredictionResult] = useState<number | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [copiedStats, setCopiedStats] = useState<Set<string>>(new Set());
  const [useSampleStats, setUseSampleStats] = useState(true);

  // Dynamic imports for math-engine
  const [statsModule, setStatsModule] = useState<
    typeof import('@nextcalc/math-engine/stats') | null
  >(null);

  // Load stats module on mount
  useEffect(() => {
    import('@nextcalc/math-engine/stats')
      .then((module) => setStatsModule(module))
      .catch((err) => {
        console.error('Failed to load stats module:', err);
        setError('Failed to load statistics module');
      });
  }, []);

  /**
   * Calculate descriptive statistics
   */
  const descriptiveStats = useMemo<DescriptiveStats | null>(() => {
    if (!statsModule || data.length === 0) return null;

    try {
      const rangeResult = statsModule.range(data);
      const quartilesResult = statsModule.quartiles(data);

      return {
        mean: statsModule.mean(data),
        median: statsModule.median(data),
        mode: statsModule.mode(data),
        stdDev: statsModule.stdDev(data, useSampleStats),
        variance: statsModule.variance(data, useSampleStats),
        min: rangeResult.min,
        max: rangeResult.max,
        range: rangeResult.range,
        q1: quartilesResult.q1,
        q2: quartilesResult.q2,
        q3: quartilesResult.q3,
        iqr: quartilesResult.iqr,
        count: data.length,
      };
    } catch (err) {
      console.error('Statistics calculation error:', err);
      return null;
    }
  }, [statsModule, data, useSampleStats]);

  /**
   * Calculate regression analysis
   */
  const regressionResult = useMemo<RegressionResult | null>(() => {
    if (!statsModule || xData.length === 0 || yData.length === 0) return null;

    if (xData.length !== yData.length) {
      setError('X and Y data must have the same length');
      return null;
    }

    try {
      let equation = '';
      let coeffs: string[] = [];
      let r2 = 0;

      if (regressionType === 'linear') {
        const linear = statsModule.linearRegression(xData, yData);
        equation = `y = ${formatNumber(linear.slope)}x + ${formatNumber(linear.intercept)}`;
        coeffs = [
          `Slope: ${formatNumber(linear.slope)}`,
          `Intercept: ${formatNumber(linear.intercept)}`,
        ];
        r2 = linear.r2;
      } else if (regressionType === 'polynomial') {
        const poly = statsModule.polynomialRegression(xData, yData, polynomialDegree);
        const terms = poly.coefficients
          .map((c: number, i: number) => {
            if (i === 0) return formatNumber(c);
            if (i === 1) return `${formatNumber(c)}x`;
            return `${formatNumber(c)}x^${i}`;
          })
          .reverse();
        equation = `y = ${terms.join(' + ')}`;
        coeffs = poly.coefficients.map((c: number, i: number) => `a${i}: ${formatNumber(c)}`);
        r2 = poly.r2;
      } else if (regressionType === 'exponential') {
        const exp = statsModule.exponentialRegression(xData, yData);
        equation = `y = ${formatNumber(exp.a)} * e^(${formatNumber(exp.b)}x)`;
        coeffs = [`a: ${formatNumber(exp.a)}`, `b: ${formatNumber(exp.b)}`];
        r2 = exp.r2;
      }

      const correlation = statsModule.correlation(xData, yData);

      return {
        type: regressionType,
        equation,
        coefficients: coeffs,
        r2,
        quality: getRegressionQuality(r2),
        correlation,
      };
    } catch (err) {
      setError(`Regression error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, [statsModule, xData, yData, regressionType, polynomialDegree]);

  /**
   * Handle data input processing
   */
  const handleProcessData = () => {
    startTransition(() => {
      setError(null);
      const parsed =
        inputMode === 'manual' ? parseNumbers(dataInput) : parseMultilineNumbers(dataInput);

      const validated = validateDataset(parsed);
      if (!validated) {
        setError('Invalid data: Please enter valid numbers');
        return;
      }

      setData(parsed);
    });
  };

  /**
   * Handle regression data processing
   */
  const handleProcessRegressionData = () => {
    startTransition(() => {
      setError(null);
      const parsedX = parseNumbers(xInput);
      const parsedY = parseNumbers(yInput);

      if (parsedX.length === 0 || parsedY.length === 0) {
        setError('Please enter valid X and Y data');
        return;
      }

      if (parsedX.length !== parsedY.length) {
        setError(
          `Data length mismatch: X has ${parsedX.length} values, Y has ${parsedY.length} values`,
        );
        return;
      }

      const validatedX = validateDataset(parsedX);
      const validatedY = validateDataset(parsedY);

      if (!validatedX || !validatedY) {
        setError('Invalid data: Please enter valid numbers');
        return;
      }

      setXData(parsedX);
      setYData(parsedY);
    });
  };

  /**
   * Handle prediction
   */
  const handlePredict = () => {
    if (!statsModule || !regressionResult) return;

    const xValue = parseFloat(predictionInput);
    if (Number.isNaN(xValue)) {
      setError('Invalid prediction input');
      return;
    }

    try {
      let regression: Parameters<typeof statsModule.predict>[0] | undefined;
      if (regressionType === 'linear') {
        regression = statsModule.linearRegression(xData, yData);
      } else if (regressionType === 'polynomial') {
        regression = statsModule.polynomialRegression(xData, yData, polynomialDegree);
      } else if (regressionType === 'exponential') {
        regression = statsModule.exponentialRegression(xData, yData);
      }

      const predicted = statsModule.predict(regression!, xValue);
      setPredictionResult(typeof predicted === 'number' ? predicted : (predicted[0] ?? null));
      setError(null);
    } catch (err) {
      setError(`Prediction error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /**
   * Load example dataset
   */
  const loadExample = (exampleKey: keyof typeof EXAMPLE_DATASETS) => {
    const example = EXAMPLE_DATASETS[exampleKey];
    if ('data' in example) {
      setDataInput(example.data.join(', '));
      setData([...example.data]);
    } else {
      setXInput(example.x.join(', '));
      setYInput(example.y.join(', '));
      setXData([...example.x]);
      setYData([...example.y]);
    }
    setError(null);
  };

  /**
   * Copy individual stat
   */
  const handleCopyStat = async (label: string, value: string) => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopiedStats((prev) => new Set(prev).add(label));
      setTimeout(() => {
        setCopiedStats((prev) => {
          const next = new Set(prev);
          next.delete(label);
          return next;
        });
      }, 2000);
    }
  };

  /**
   * Copy all statistics
   */
  const handleCopyAllStats = async () => {
    if (!descriptiveStats) return;

    const text = `
Statistical Analysis Results
============================
Count: ${descriptiveStats.count}
Mean: ${formatNumber(descriptiveStats.mean)}
Median: ${formatNumber(descriptiveStats.median)}
Mode: ${descriptiveStats.mode.length > 0 ? descriptiveStats.mode.map(formatNumber).join(', ') : 'None'}
Std Dev: ${formatNumber(descriptiveStats.stdDev)} (${useSampleStats ? 'sample' : 'population'})
Variance: ${formatNumber(descriptiveStats.variance)} (${useSampleStats ? 'sample' : 'population'})
Min: ${formatNumber(descriptiveStats.min)}
Max: ${formatNumber(descriptiveStats.max)}
Range: ${formatNumber(descriptiveStats.range)}
Q1: ${formatNumber(descriptiveStats.q1)}
Q2 (Median): ${formatNumber(descriptiveStats.q2)}
Q3: ${formatNumber(descriptiveStats.q3)}
IQR: ${formatNumber(descriptiveStats.iqr)}
    `.trim();

    await copyToClipboard(text);
  };

  /**
   * Clear all data
   */
  const handleClear = () => {
    setDataInput('');
    setData([]);
    setError(null);
  };

  const handleClearRegression = () => {
    setXInput('');
    setYInput('');
    setXData([]);
    setYData([]);
    setPredictionInput('');
    setPredictionResult(null);
    setError(null);
  };

  if (!statsModule) {
    return (
      <Card className="w-full max-w-4xl bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.10)]">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-8">
            <div
              className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <span className="text-sm font-medium">Loading statistics module&hellip;</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'w-full max-w-4xl',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60',
        'backdrop-blur-md',
        'border border-border',
        'shadow-[0_8px_32px_0_rgba(0,0,0,0.10)]',
        'relative overflow-hidden',
      )}
    >
      {/* Top gradient accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        aria-hidden="true"
      />

      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          {/* Icon container with primary accent */}
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: 'oklch(0.65 0.22 264 / 0.12)',
              border: '1px solid oklch(0.65 0.22 264 / 0.25)',
            }}
            aria-hidden="true"
          >
            <BarChart3 className="h-6 w-6" style={{ color: 'oklch(0.65 0.22 264)' }} />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-foreground">
              Statistical Analysis
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Descriptive statistics and regression analysis for your data
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pb-8">
        {/* Error Display */}
        {error && (
          <Alert
            variant="destructive"
            className="flex items-start gap-2 border-destructive/40 bg-destructive/8"
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1 text-destructive text-sm">{error}</div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:bg-destructive/15 text-destructive"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Alert>
        )}

        {/* ── Data Input Section ─────────────────────────────────────── */}
        <section aria-labelledby="data-input-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="data-input-heading" className="text-base font-semibold text-foreground">
              Input Data
            </h2>
            {data.length > 0 && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: 'oklch(0.65 0.22 264 / 0.10)',
                  color: 'oklch(0.65 0.22 264)',
                  border: '1px solid oklch(0.65 0.22 264 / 0.25)',
                }}
              >
                {data.length} values
              </span>
            )}
          </div>

          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'manual' | 'paste')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="paste">Paste Data</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-2 mt-3">
              <Input
                placeholder="Enter comma or space-separated values: 1, 2, 3, 4, 5"
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleProcessData();
                  }
                }}
                aria-label="Manual data entry"
              />
            </TabsContent>

            <TabsContent value="paste" className="space-y-2 mt-3">
              <Textarea
                placeholder="Paste data (one value per line)"
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                className="min-h-[120px] font-mono"
                aria-label="Paste data entry"
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleProcessData}
              disabled={isPending || !dataInput.trim()}
              className="flex-1 sm:flex-none"
            >
              {isPending ? 'Processing\u2026' : 'Calculate Statistics'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExample('normal')}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Normal
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExample('bimodal')}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Bimodal
            </Button>

            {data.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClear} className="ml-auto">
                Clear
              </Button>
            )}
          </div>
        </section>

        {/* ── Descriptive Statistics Display ─────────────────────────── */}
        {descriptiveStats && (
          <section aria-labelledby="descriptive-stats-heading" className="space-y-4">
            <SectionDivider />

            <div className="flex items-center justify-between pt-1">
              <h2 id="descriptive-stats-heading" className="text-lg font-semibold text-foreground">
                Descriptive Statistics
              </h2>
              <label
                htmlFor="sample-toggle"
                className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none"
              >
                <input
                  id="sample-toggle"
                  type="checkbox"
                  checked={useSampleStats}
                  onChange={(e) => setUseSampleStats(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Sample statistics
              </label>
            </div>

            {/* Central tendency group */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 pl-1">
                Central Tendency
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <StatCard
                  label="Count"
                  value={descriptiveStats.count}
                  accent="primary"
                  onCopy={() => handleCopyStat('Count', descriptiveStats.count.toString())}
                  copied={copiedStats.has('Count')}
                />
                <StatCard
                  label="Mean"
                  value={formatNumber(descriptiveStats.mean)}
                  accent="primary"
                  onCopy={() => handleCopyStat('Mean', formatNumber(descriptiveStats.mean))}
                  copied={copiedStats.has('Mean')}
                />
                <StatCard
                  label="Median"
                  value={formatNumber(descriptiveStats.median)}
                  accent="primary"
                  onCopy={() => handleCopyStat('Median', formatNumber(descriptiveStats.median))}
                  copied={copiedStats.has('Median')}
                />
                <StatCard
                  label="Mode"
                  value={
                    descriptiveStats.mode.length > 0
                      ? descriptiveStats.mode.map(formatNumber).join(', ')
                      : 'None'
                  }
                  accent="primary"
                  onCopy={() =>
                    handleCopyStat(
                      'Mode',
                      descriptiveStats.mode.length > 0
                        ? descriptiveStats.mode.map(formatNumber).join(', ')
                        : 'None',
                    )
                  }
                  copied={copiedStats.has('Mode')}
                />
              </div>
            </div>

            {/* Spread group */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 pl-1">
                Spread &amp; Dispersion
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <StatCard
                  label={`Std Dev (${useSampleStats ? 'sample' : 'population'})`}
                  value={formatNumber(descriptiveStats.stdDev)}
                  accent="violet"
                  onCopy={() => handleCopyStat('Std Dev', formatNumber(descriptiveStats.stdDev))}
                  copied={copiedStats.has('Std Dev')}
                />
                <StatCard
                  label={`Variance (${useSampleStats ? 'sample' : 'population'})`}
                  value={formatNumber(descriptiveStats.variance)}
                  accent="violet"
                  onCopy={() => handleCopyStat('Variance', formatNumber(descriptiveStats.variance))}
                  copied={copiedStats.has('Variance')}
                />
                <StatCard
                  label="Range"
                  value={formatNumber(descriptiveStats.range)}
                  accent="violet"
                  onCopy={() => handleCopyStat('Range', formatNumber(descriptiveStats.range))}
                  copied={copiedStats.has('Range')}
                />
              </div>
            </div>

            {/* Quartiles group */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 pl-1">
                Range &amp; Quartiles
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <StatCard
                  label="Minimum"
                  value={formatNumber(descriptiveStats.min)}
                  accent="emerald"
                  onCopy={() => handleCopyStat('Minimum', formatNumber(descriptiveStats.min))}
                  copied={copiedStats.has('Minimum')}
                />
                <StatCard
                  label="Maximum"
                  value={formatNumber(descriptiveStats.max)}
                  accent="emerald"
                  onCopy={() => handleCopyStat('Maximum', formatNumber(descriptiveStats.max))}
                  copied={copiedStats.has('Maximum')}
                />
                <StatCard
                  label="Q1 (25th percentile)"
                  value={formatNumber(descriptiveStats.q1)}
                  accent="amber"
                  onCopy={() => handleCopyStat('Q1', formatNumber(descriptiveStats.q1))}
                  copied={copiedStats.has('Q1')}
                />
                <StatCard
                  label="Q2 (50th percentile)"
                  value={formatNumber(descriptiveStats.q2)}
                  accent="amber"
                  onCopy={() => handleCopyStat('Q2', formatNumber(descriptiveStats.q2))}
                  copied={copiedStats.has('Q2')}
                />
                <StatCard
                  label="Q3 (75th percentile)"
                  value={formatNumber(descriptiveStats.q3)}
                  accent="amber"
                  onCopy={() => handleCopyStat('Q3', formatNumber(descriptiveStats.q3))}
                  copied={copiedStats.has('Q3')}
                />
                <StatCard
                  label="IQR"
                  value={formatNumber(descriptiveStats.iqr)}
                  accent="amber"
                  onCopy={() => handleCopyStat('IQR', formatNumber(descriptiveStats.iqr))}
                  copied={copiedStats.has('IQR')}
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleCopyAllStats}
              className="w-full gap-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy All Statistics
            </Button>

            {/* Box Plot */}
            <GlassPanel accent="primary" className="mt-2">
              <h3 className="text-sm font-semibold text-foreground text-center mb-4">
                Box Plot Visualization
              </h3>
              <div className="overflow-x-auto">
                <BoxPlot stats={descriptiveStats} width={560} height={110} />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Displays distribution quartiles, median, and data range
              </p>
            </GlassPanel>
          </section>
        )}

        {/* ── Regression Analysis Section ────────────────────────────── */}
        <section aria-labelledby="regression-heading" className="space-y-4">
          <SectionDivider />

          <div className="flex items-center gap-2.5 pt-1">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'oklch(0.63 0.20 300 / 0.12)',
                border: '1px solid oklch(0.63 0.20 300 / 0.25)',
              }}
              aria-hidden="true"
            >
              <TrendingUp className="h-4 w-4" style={{ color: 'oklch(0.63 0.20 300)' }} />
            </div>
            <h2 id="regression-heading" className="text-lg font-semibold text-foreground">
              Regression Analysis
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="x-values" className="text-sm font-medium text-foreground">
                X Values
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  (independent)
                </span>
              </Label>
              <Input
                id="x-values"
                placeholder="1, 2, 3, 4, 5"
                value={xInput}
                onChange={(e) => setXInput(e.target.value)}
                aria-label="X values input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="y-values" className="text-sm font-medium text-foreground">
                Y Values
                <span className="ml-1 text-xs text-muted-foreground font-normal">(dependent)</span>
              </Label>
              <Input
                id="y-values"
                placeholder="2, 4, 6, 8, 10"
                value={yInput}
                onChange={(e) => setYInput(e.target.value)}
                aria-label="Y values input"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="regression-type" className="text-sm font-medium text-foreground">
                Regression Type
              </Label>
              <Select
                value={regressionType}
                onValueChange={(v) =>
                  setRegressionType(v as 'linear' | 'polynomial' | 'exponential')
                }
              >
                <SelectTrigger id="regression-type" aria-label="Select regression type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear (y = mx + b)</SelectItem>
                  <SelectItem value="polynomial">Polynomial</SelectItem>
                  <SelectItem value="exponential">Exponential (y = ae^(bx))</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {regressionType === 'polynomial' && (
              <div className="w-32 space-y-2">
                <Label htmlFor="poly-degree" className="text-sm font-medium text-foreground">
                  Degree
                </Label>
                <Select
                  value={polynomialDegree.toString()}
                  onValueChange={(v) => setPolynomialDegree(parseInt(v, 10))}
                >
                  <SelectTrigger id="poly-degree" aria-label="Select polynomial degree">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleProcessRegressionData}
              disabled={isPending || !xInput.trim() || !yInput.trim()}
              className="flex-1 sm:flex-none"
            >
              {isPending ? 'Processing\u2026' : 'Calculate Regression'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExample('linear')}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Linear Example
            </Button>

            {(xData.length > 0 || yData.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearRegression}
                className="ml-auto"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Regression Results */}
          {regressionResult && (
            <GlassPanel accent="violet" className="mt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Regression Results</h3>
                <R2Badge r2={regressionResult.r2} quality={regressionResult.quality} />
              </div>

              <div className="space-y-4">
                {/* Equation display */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Equation
                  </p>
                  <div
                    className="font-mono text-base text-foreground px-4 py-3 rounded-lg"
                    style={{
                      background: 'oklch(0.63 0.20 300 / 0.08)',
                      border: '1px solid oklch(0.63 0.20 300 / 0.20)',
                    }}
                    aria-label={`Regression equation: ${regressionResult.equation}`}
                  >
                    {regressionResult.equation}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Coefficients
                    </p>
                    <div className="space-y-1">
                      {regressionResult.coefficients.map((coeff, i) => (
                        <p key={i} className="text-sm font-mono text-foreground">
                          {coeff}
                        </p>
                      ))}
                    </div>
                  </div>

                  {regressionResult.correlation !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        Correlation (r)
                      </p>
                      <p className="text-xl font-mono font-semibold text-foreground">
                        {formatNumber(regressionResult.correlation)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Prediction Tool */}
              <div
                className="mt-4 pt-4 space-y-3"
                style={{
                  borderTop: '1px solid oklch(0.63 0.20 300 / 0.20)',
                }}
              >
                <h4 className="font-semibold text-sm text-foreground">Prediction Tool</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter X value to predict Y"
                    value={predictionInput}
                    onChange={(e) => setPredictionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePredict();
                      }
                    }}
                    className="flex-1"
                    aria-label="Prediction X value input"
                  />
                  <Button onClick={handlePredict} disabled={!predictionInput.trim()}>
                    Predict Y
                  </Button>
                </div>

                {predictionResult !== null && (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{
                      background: 'oklch(0.65 0.22 264 / 0.10)',
                      border: '1px solid oklch(0.65 0.22 264 / 0.25)',
                    }}
                    role="status"
                    aria-live="polite"
                    aria-label={`Predicted Y value: ${formatNumber(predictionResult)}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Predicted Y value
                    </p>
                    <p
                      className="text-2xl font-mono font-bold"
                      style={{ color: 'oklch(0.65 0.22 264)' }}
                    >
                      {formatNumber(predictionResult)}
                    </p>
                  </div>
                )}
              </div>
            </GlassPanel>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
