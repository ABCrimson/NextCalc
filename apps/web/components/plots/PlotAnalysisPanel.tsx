'use client';

/**
 * Analysis panel shown below 2D plots.
 *
 * Computes numerically:
 *  - X-intercepts  (where f(x) ≈ 0) via bisection
 *  - Y-intercepts  (f(0) if x=0 is in domain)
 *  - Local minima and maxima (first-derivative sign changes + second-derivative test)
 *  - Inflection points (second-derivative sign changes)
 *  - Vertical asymptotes (where |f(x)| → ∞ with sign change detection)
 *  - Horizontal asymptotes (limits at ±∞ of the viewport)
 *  - Pairwise intersections between multiple functions
 *
 * Uses bisection-based root finding throughout; all work is done inside a
 * single `useMemo` so the panel is reactive to viewport and function changes.
 *
 * @module components/plots/PlotAnalysisPanel
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  Crosshair,
  GitCommitHorizontal,
  MoveHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AnalysisFunction {
  fn: (x: number) => number;
  label?: string;
  color: string;
}

export interface PlotAnalysisPanelProps {
  functions: AnalysisFunction[];
  viewport: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  /** Number of initial uniform samples for root / extrema detection */
  samples?: number;
  className?: string;
}

interface FoundPoint {
  x: number;
  y: number;
  label: string;
}

interface AsymptoteInfo {
  /** 'vertical' | 'horizontal-left' | 'horizontal-right' */
  kind: 'vertical' | 'horizontal-left' | 'horizontal-right';
  /** x value for vertical, y value for horizontal */
  value: number;
  label: string;
}

interface FunctionAnalysis {
  label: string;
  color: string;
  xIntercepts: FoundPoint[];
  yIntercept: FoundPoint | null;
  localMinima: FoundPoint[];
  localMaxima: FoundPoint[];
  inflectionPoints: FoundPoint[];
  asymptotes: AsymptoteInfo[];
}

interface IntersectionPoint {
  x: number;
  y: number;
  labels: [string, string];
  colors: [string, string];
}

// --------------------------------------------------------------------------
// Numerical helpers
// --------------------------------------------------------------------------

const EPSILON = 1e-10;

/**
 * Bisection root finder.  Finds x in [a, b] such that f(x) ≈ 0.
 * Returns null if f(a) and f(b) do not bracket a root.
 */
function bisect(f: (x: number) => number, a: number, b: number, maxIter = 40): number | null {
  let fa = f(a);
  let fb = f(b);

  if (!isFinite(fa) || !isFinite(fb)) return null;
  if (fa * fb > 0) return null; // no sign change

  for (let i = 0; i < maxIter; i++) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (!isFinite(fm)) return null;
    if (Math.abs(fm) < EPSILON || (b - a) / 2 < EPSILON) return mid;
    if (fa * fm < 0) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Finds all roots of f in [xMin, xMax] by scanning with `samples` uniform
 * intervals and applying bisection where sign changes are detected.
 */
function findRoots(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  samples: number,
): number[] {
  const roots: number[] = [];
  const step = (xMax - xMin) / samples;
  let prevX = xMin;
  let prevY = f(xMin);

  for (let i = 1; i <= samples; i++) {
    const x = xMin + i * step;
    const y = f(x);

    if (isFinite(prevY) && isFinite(y) && prevY * y < 0) {
      const root = bisect(f, prevX, x);
      if (root !== null) {
        // Deduplicate roots that are very close together
        const isDuplicate = roots.some((r) => Math.abs(r - root) < step * 0.5);
        if (!isDuplicate) {
          roots.push(root);
        }
      }
    }

    prevX = x;
    prevY = y;
  }

  return roots;
}

/**
 * Finds local extrema of f in [xMin, xMax] by detecting sign changes in the
 * numerical first derivative (central differences) and classifying via the
 * second derivative.
 */
function findExtrema(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  samples: number,
): { minima: number[]; maxima: number[] } {
  const h = (xMax - xMin) / (samples * 10); // finer grid for derivative
  const minima: number[] = [];
  const maxima: number[] = [];

  const deriv = (x: number) => (f(x + h) - f(x - h)) / (2 * h);

  const step = (xMax - xMin) / samples;
  let prevX = xMin + h;
  let prevD = deriv(prevX);

  for (let i = 1; i <= samples; i++) {
    const x = xMin + i * step;
    const d = deriv(x);

    if (isFinite(prevD) && isFinite(d) && prevD * d < 0) {
      const root = bisect(deriv, prevX, x);
      if (root !== null) {
        const isDuplicate =
          minima.some((r) => Math.abs(r - root) < step * 0.5) ||
          maxima.some((r) => Math.abs(r - root) < step * 0.5);

        if (!isDuplicate) {
          // Second derivative sign to classify
          const d2 = (deriv(root + h) - deriv(root - h)) / (2 * h);
          if (isFinite(d2)) {
            if (d2 > 0) minima.push(root);
            else maxima.push(root);
          }
        }
      }
    }

    prevX = x;
    prevD = d;
  }

  return { minima, maxima };
}

/**
 * Finds inflection points of f by detecting sign changes in the numerical
 * second derivative.  An inflection point is where f''(x) changes sign.
 */
function findInflectionPoints(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  samples: number,
): number[] {
  const h = (xMax - xMin) / (samples * 10);
  const step = (xMax - xMin) / samples;
  const inflections: number[] = [];

  // Second derivative via central differences
  const d2 = (x: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

  let prevX = xMin + 2 * h;
  let prevD2 = d2(prevX);

  for (let i = 1; i <= samples; i++) {
    const x = xMin + i * step;
    const dd = d2(x);

    if (isFinite(prevD2) && isFinite(dd) && prevD2 * dd < 0) {
      const root = bisect(d2, prevX, x);
      if (root !== null) {
        const isDuplicate = inflections.some((r) => Math.abs(r - root) < step * 0.5);
        if (!isDuplicate) {
          // Confirm f''(x) actually changes sign (not just a touching zero)
          const leftD2 = d2(root - step * 0.1);
          const rightD2 = d2(root + step * 0.1);
          if (isFinite(leftD2) && isFinite(rightD2) && leftD2 * rightD2 < 0) {
            inflections.push(root);
          }
        }
      }
    }

    prevX = x;
    prevD2 = dd;
  }

  return inflections;
}

/**
 * Detects vertical asymptotes by looking for x values where the function
 * transitions between finite and infinite values (or very large values with
 * a sign change, suggesting a pole).
 *
 * Returns x-coordinates of suspected vertical asymptotes within [xMin, xMax].
 */
function findVerticalAsymptotes(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  samples: number,
): number[] {
  const LARGE = 1e6;
  const step = (xMax - xMin) / samples;
  const asymptotes: number[] = [];

  for (let i = 0; i < samples; i++) {
    const x0 = xMin + i * step;
    const x1 = xMin + (i + 1) * step;
    const y0 = f(x0);
    const y1 = f(x1);

    // Detect: one side finite, other infinite — or magnitude blows up with sign change
    const bothFinite = isFinite(y0) && isFinite(y1);
    const oneBlow = (isFinite(y0) && !isFinite(y1)) || (!isFinite(y0) && isFinite(y1));
    const largeMagnitudeSignChange =
      bothFinite && Math.abs(y0) > LARGE && Math.abs(y1) > LARGE && y0 * y1 < 0;

    if (oneBlow || largeMagnitudeSignChange) {
      // Binary search for the discontinuity location
      let lo = x0;
      let hi = x1;
      for (let iter = 0; iter < 30; iter++) {
        const mid = (lo + hi) / 2;
        const ym = f(mid);
        if (!isFinite(ym) || Math.abs(ym) > LARGE) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      const xAsym = (lo + hi) / 2;
      const isDuplicate = asymptotes.some((a) => Math.abs(a - xAsym) < step);
      if (!isDuplicate) {
        asymptotes.push(xAsym);
      }
    }
  }

  return asymptotes;
}

/**
 * Detects horizontal asymptotes by sampling the function near the viewport
 * edges. Returns `{ left, right }` as y values (or null if not detectable).
 *
 * Uses the outermost 5% of the viewport on each side to estimate the limit.
 */
function detectHorizontalAsymptotes(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
): { left: number | null; right: number | null } {
  const CHECK_POINTS = 10;
  const THRESHOLD = 0.05; // convergence tolerance — values within 5% of each other

  // Evaluate near the left edge
  const leftVals: number[] = [];
  for (let i = 1; i <= CHECK_POINTS; i++) {
    const x = xMin + (xMax - xMin) * 0.005 * i;
    const y = f(x);
    if (isFinite(y)) leftVals.push(y);
  }

  // Evaluate near the right edge
  const rightVals: number[] = [];
  for (let i = 1; i <= CHECK_POINTS; i++) {
    const x = xMax - (xMax - xMin) * 0.005 * i;
    const y = f(x);
    if (isFinite(y)) rightVals.push(y);
  }

  const isConverging = (vals: number[]): number | null => {
    if (vals.length < 3) return null;
    const last = vals[vals.length - 1]!;
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread < Math.abs(last) * THRESHOLD + 0.01) return last;
    return null;
  };

  return {
    left: isConverging(leftVals),
    right: isConverging(rightVals),
  };
}

/**
 * Formats a number to a compact readable string (5 significant figures,
 * strips trailing zeros).
 */
function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) < 1e-4 && n !== 0) return n.toExponential(3);
  return parseFloat(n.toPrecision(5)).toString();
}

// --------------------------------------------------------------------------
// Main analysis hook
// --------------------------------------------------------------------------

function useAnalysis(
  functions: AnalysisFunction[],
  viewport: PlotAnalysisPanelProps['viewport'],
  samples: number,
): { fnAnalyses: FunctionAnalysis[]; intersections: IntersectionPoint[] } {
  return useMemo(() => {
    const { xMin, xMax } = viewport;

    const fnAnalyses: FunctionAnalysis[] = functions.map(({ fn, label, color }) => {
      const lbl = label ?? 'f(x)';

      // X-intercepts
      const xRoots = findRoots(fn, xMin, xMax, samples);
      const xIntercepts: FoundPoint[] = xRoots.map((x) => ({
        x,
        y: 0,
        label: `(${fmt(x)}, 0)`,
      }));

      // Y-intercept: f(0) if 0 is in domain
      let yIntercept: FoundPoint | null = null;
      if (xMin <= 0 && 0 <= xMax) {
        const y0 = fn(0);
        if (isFinite(y0)) {
          yIntercept = { x: 0, y: y0, label: `(0, ${fmt(y0)})` };
        }
      }

      // Extrema
      const { minima, maxima } = findExtrema(fn, xMin, xMax, samples);
      const localMinima: FoundPoint[] = minima.map((x) => {
        const y = fn(x);
        return { x, y, label: `(${fmt(x)}, ${fmt(y)})` };
      });
      const localMaxima: FoundPoint[] = maxima.map((x) => {
        const y = fn(x);
        return { x, y, label: `(${fmt(x)}, ${fmt(y)})` };
      });

      // Inflection points
      const inflectionXs = findInflectionPoints(fn, xMin, xMax, samples);
      const inflectionPoints: FoundPoint[] = inflectionXs.map((x) => {
        const y = fn(x);
        return { x, y, label: `(${fmt(x)}, ${fmt(y)})` };
      });

      // Asymptotes
      const verticalAsymptoteXs = findVerticalAsymptotes(fn, xMin, xMax, samples);
      const { left: hLeft, right: hRight } = detectHorizontalAsymptotes(fn, xMin, xMax);

      const asymptotes: AsymptoteInfo[] = [];
      for (const x of verticalAsymptoteXs) {
        asymptotes.push({
          kind: 'vertical',
          value: x,
          label: `x = ${fmt(x)}`,
        });
      }
      if (hLeft !== null) {
        asymptotes.push({
          kind: 'horizontal-left',
          value: hLeft,
          label: `y → ${fmt(hLeft)} as x → xMin`,
        });
      }
      if (hRight !== null) {
        asymptotes.push({
          kind: 'horizontal-right',
          value: hRight,
          label: `y → ${fmt(hRight)} as x → xMax`,
        });
      }

      // Deduplicate horizontal asymptotes that converge to the same value
      const deduplicatedAsymptotes = asymptotes.filter((a, idx, arr) => {
        if (a.kind === 'horizontal-left' || a.kind === 'horizontal-right') {
          // Keep only if no earlier horizontal asymptote has the same approximate y value
          return !arr
            .slice(0, idx)
            .some(
              (b) =>
                (b.kind === 'horizontal-left' || b.kind === 'horizontal-right') &&
                Math.abs(b.value - a.value) < 0.05,
            );
        }
        return true;
      });

      return {
        label: lbl,
        color,
        xIntercepts,
        yIntercept,
        localMinima,
        localMaxima,
        inflectionPoints,
        asymptotes: deduplicatedAsymptotes,
      };
    });

    // Pairwise intersections
    const intersections: IntersectionPoint[] = [];
    for (let i = 0; i < functions.length - 1; i++) {
      for (let j = i + 1; j < functions.length; j++) {
        const fi = functions[i]!;
        const fj = functions[j]!;
        const diff = (x: number) => fi.fn(x) - fj.fn(x);
        const roots = findRoots(diff, xMin, xMax, samples);
        for (const x of roots) {
          const y = fi.fn(x);
          if (!isFinite(y)) continue;
          const isDuplicate = intersections.some(
            (pt) => Math.abs(pt.x - x) < (xMax - xMin) / samples,
          );
          if (!isDuplicate) {
            intersections.push({
              x,
              y,
              labels: [fi.label ?? 'f', fj.label ?? 'g'],
              colors: [fi.color, fj.color],
            });
          }
        }
      }
    }

    return { fnAnalyses, intersections };
  }, [functions, viewport, samples]);
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function PointBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="
        inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono
        bg-background/60 border border-border
        text-foreground/90
      "
      style={{ borderLeftColor: color, borderLeftWidth: 2 }}
    >
      {label}
    </span>
  );
}

function SectionRow({
  icon,
  title,
  points,
  color,
  emptyText,
}: {
  icon: React.ReactNode;
  title: string;
  points: FoundPoint[];
  color: string;
  emptyText: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 shrink-0" style={{ color }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground/80 mr-2">{title}:</span>
        {points.length === 0 ? (
          <span className="text-muted-foreground italic">{emptyText}</span>
        ) : (
          <span className="flex flex-wrap gap-1 mt-0.5">
            {points.map((p, i) => (
              <PointBadge key={i} label={p.label} color={color} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function AsymptoteRow({ asymptotes, color }: { asymptotes: AsymptoteInfo[]; color: string }) {
  const verticals = asymptotes.filter((a) => a.kind === 'vertical');
  const horizontals = asymptotes.filter(
    (a) => a.kind === 'horizontal-left' || a.kind === 'horizontal-right',
  );

  if (asymptotes.length === 0) {
    return (
      <div className="flex items-start gap-2 text-xs">
        <span className="mt-0.5 shrink-0" style={{ color }}>
          <MoveHorizontal className="h-3 w-3" />
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground/80 mr-2">Asymptotes:</span>
          <span className="text-muted-foreground italic">none detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {verticals.length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0" style={{ color }}>
            <MoveHorizontal className="h-3 w-3 rotate-90" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground/80 mr-2">Vertical:</span>
            <span className="flex flex-wrap gap-1 mt-0.5">
              {verticals.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-orange-950/40 border border-orange-500/30 text-orange-200"
                  style={{ borderLeftColor: color, borderLeftWidth: 2 }}
                >
                  {a.label}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
      {horizontals.length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0" style={{ color }}>
            <MoveHorizontal className="h-3 w-3" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground/80 mr-2">Horizontal:</span>
            <span className="flex flex-wrap gap-1 mt-0.5">
              {horizontals.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-sky-950/40 border border-sky-500/30 text-sky-200"
                  style={{ borderLeftColor: color, borderLeftWidth: 2 }}
                >
                  y &approx; {fmt(a.value)}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

export function PlotAnalysisPanel({
  functions,
  viewport,
  samples = 400,
  className = '',
}: PlotAnalysisPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { fnAnalyses, intersections } = useAnalysis(functions, viewport, samples);

  const hasAnyData =
    fnAnalyses.some(
      (a) =>
        a.xIntercepts.length > 0 ||
        a.yIntercept ||
        a.localMinima.length > 0 ||
        a.localMaxima.length > 0 ||
        a.inflectionPoints.length > 0 ||
        a.asymptotes.length > 0,
    ) || intersections.length > 0;

  return (
    <div
      className={[
        'rounded-xl overflow-hidden',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60',
        'backdrop-blur-md border border-border',
        'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
        className,
      ].join(' ')}
      aria-label="Function analysis panel"
    >
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="
          w-full flex items-center justify-between gap-2
          px-4 py-3
          text-sm font-semibold text-foreground/90
          hover:bg-white/5 transition-colors duration-150
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
        "
        aria-expanded={isOpen}
        aria-controls="analysis-panel-body"
      >
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-cyan-400" />
          <span>Analysis: Intercepts &amp; Critical Points</span>
          {!hasAnyData && (
            <span className="text-xs text-muted-foreground font-normal">
              (no points in viewport)
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="analysis-panel-body"
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
              {/* Per-function analysis */}
              {fnAnalyses.map((analysis) => (
                <div
                  key={analysis.label}
                  className="space-y-2"
                  aria-label={`Analysis for ${analysis.label}`}
                >
                  {/* Function header with color swatch */}
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full ring-1 ring-white/20"
                      style={{ background: analysis.color }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-xs font-semibold font-mono"
                      style={{ color: analysis.color }}
                    >
                      {analysis.label}
                    </span>
                  </div>

                  <div className="pl-5 space-y-1.5">
                    {/* X-intercepts */}
                    <SectionRow
                      icon={<ArrowDownUp className="h-3 w-3" />}
                      title="X-intercepts"
                      points={analysis.xIntercepts}
                      color={analysis.color}
                      emptyText="none in viewport"
                    />

                    {/* Y-intercept */}
                    <div className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 shrink-0" style={{ color: analysis.color }}>
                        <ArrowDownUp className="h-3 w-3 rotate-90" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground/80 mr-2">Y-intercept:</span>
                        {analysis.yIntercept ? (
                          <PointBadge label={analysis.yIntercept.label} color={analysis.color} />
                        ) : (
                          <span className="text-muted-foreground italic">
                            {viewport.xMin > 0 || viewport.xMax < 0
                              ? 'x=0 not in viewport'
                              : 'undefined at x=0'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Local maxima */}
                    <SectionRow
                      icon={<TrendingUp className="h-3 w-3" />}
                      title="Local maxima"
                      points={analysis.localMaxima}
                      color={analysis.color}
                      emptyText="none in viewport"
                    />

                    {/* Local minima */}
                    <SectionRow
                      icon={<TrendingDown className="h-3 w-3" />}
                      title="Local minima"
                      points={analysis.localMinima}
                      color={analysis.color}
                      emptyText="none in viewport"
                    />

                    {/* Inflection points */}
                    <SectionRow
                      icon={<GitCommitHorizontal className="h-3 w-3" />}
                      title="Inflections"
                      points={analysis.inflectionPoints}
                      color={analysis.color}
                      emptyText="none in viewport"
                    />

                    {/* Asymptotes */}
                    <AsymptoteRow asymptotes={analysis.asymptotes} color={analysis.color} />
                  </div>
                </div>
              ))}

              {/* Pairwise intersections (only when > 1 function) */}
              {functions.length > 1 && (
                <div
                  className="space-y-2 border-t border-border/40 pt-3"
                  aria-label="Intersection points"
                >
                  <div className="flex items-center gap-2">
                    <Crosshair className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-300">Intersections</span>
                  </div>

                  {intersections.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-5">
                      No intersections in viewport
                    </p>
                  ) : (
                    <div className="pl-5 flex flex-wrap gap-1.5">
                      {intersections.map((pt, i) => (
                        <span
                          key={i}
                          className="
                            inline-flex items-center gap-1
                            px-2 py-0.5 rounded-md text-xs font-mono
                            bg-amber-950/40 border border-amber-500/30 text-amber-200
                          "
                          title={`${pt.labels[0]} \u2229 ${pt.labels[1]}`}
                        >
                          {/* Tiny dual color dot */}
                          <span className="flex gap-0.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: pt.colors[0] }}
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: pt.colors[1] }}
                            />
                          </span>
                          ({fmt(pt.x)}, {fmt(pt.y)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Numerical note */}
              <p className="text-[10px] text-muted-foreground/60 border-t border-border/30 pt-2">
                Values computed numerically. Accuracy depends on function smoothness and viewport
                zoom level.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
