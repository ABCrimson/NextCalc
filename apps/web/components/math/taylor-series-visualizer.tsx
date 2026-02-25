'use client';

/**
 * Taylor Series Visualizer
 *
 * Interactive visualization showing Taylor/Maclaurin series approximations.
 *
 * Architecture:
 * - All Taylor coefficient computation is done via dynamic import of
 *   @nextcalc/math-engine/symbolic (getKnownSeries + taylorSeries).
 * - For custom function input, we evaluate the polynomial directly using
 *   math.js (also dynamically imported) so that the parser is not bundled
 *   into the initial chunk.
 * - The 2D plot is rendered on an SVG element — no canvas/WebGL dependency.
 * - Framer Motion handles term-addition animation.
 * - KaTeX rendering is delegated to the shared MathRenderer component.
 *
 * Conventions:
 * - React 19.3: named imports, ref as prop, no forwardRef
 * - Semantic color tokens throughout
 * - Zero `as any` in production code
 * - TypeScript 6.0 strict + exactOptionalPropertyTypes
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, SkipBack, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MathRenderer } from '@/components/ui/math-renderer';
import { cn } from '@/lib/utils';
import { PlotAnalysisPanel } from '@/components/plots/PlotAnalysisPanel';
import type { AnalysisFunction } from '@/components/plots/PlotAnalysisPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single evaluated Taylor term: its numerical coefficient and the power of
 * (x - a) to which it belongs. Allows the plot engine to evaluate the partial
 * sum without needing the full AST at runtime.
 */
export interface TaylorTerm {
  /** 0-indexed term number */
  readonly index: number;
  /** Coefficient = f^(n)(a) / n! */
  readonly coefficient: number;
  /** Power of (x - a): n */
  readonly power: number;
  /** Human-readable LaTeX for this single term */
  readonly termLatex: string;
}

export interface TaylorComputationResult {
  readonly terms: ReadonlyArray<TaylorTerm>;
  /** Full polynomial LaTeX up to the current term count */
  readonly polynomialLatex: string;
  /** Radius of convergence (Infinity or a number) */
  readonly radiusOfConvergence: number;
  /** Error message if computation failed */
  readonly error?: string;
}

/** Function presets available in the UI */
export interface FunctionPreset {
  readonly id: string;
  readonly label: string;
  /** Display label with unicode math */
  readonly displayLabel: string;
  readonly expression: string;
  /** mathjs expression for the true function (used for plotting) */
  readonly trueExpr: string;
  /** Default center point */
  readonly defaultCenter: number;
  /** Color for the original function curve */
  readonly color: string;
  /** Radius of convergence description */
  readonly convergence: string;
  /** Short description shown in the preset chip tooltip */
  readonly description: string;
  /** Series formula as text */
  readonly seriesText: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ordered gradient colors for successive Taylor approximation layers.
 * Index 0 = first approximation, ascending = higher order.
 * Progression: blue -> indigo -> violet -> purple -> fuchsia -> pink -> rose
 */
const APPROXIMATION_COLORS: ReadonlyArray<string> = [
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#c026d3', // fuchsia-600
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#14b8a6', // teal-500
] as const;

const FUNCTION_PRESETS: ReadonlyArray<FunctionPreset> = [
  {
    id: 'sin',
    label: 'sin(x)',
    displayLabel: 'sin(x)',
    expression: 'sin(x)',
    trueExpr: 'sin(x)',
    defaultCenter: 0,
    color: '#60a5fa',
    convergence: 'R = ∞',
    description: 'Sine function — infinite radius of convergence',
    seriesText: 'x − x³/3! + x⁵/5! − ⋯',
  },
  {
    id: 'cos',
    label: 'cos(x)',
    displayLabel: 'cos(x)',
    expression: 'cos(x)',
    trueExpr: 'cos(x)',
    defaultCenter: 0,
    color: '#34d399',
    convergence: 'R = ∞',
    description: 'Cosine function — infinite radius of convergence',
    seriesText: '1 − x²/2! + x⁴/4! − ⋯',
  },
  {
    id: 'exp',
    label: 'eˣ',
    displayLabel: 'eˣ',
    expression: 'exp(x)',
    trueExpr: 'exp(x)',
    defaultCenter: 0,
    color: '#fb923c',
    convergence: 'R = ∞',
    description: 'Natural exponential — infinite radius of convergence',
    seriesText: '1 + x + x²/2! + x³/3! + ⋯',
  },
  {
    id: 'ln',
    label: 'ln(1+x)',
    displayLabel: 'ln(1+x)',
    expression: 'ln(x)',
    trueExpr: 'log(x + 1)',
    defaultCenter: 0,
    color: '#c084fc',
    convergence: 'R = 1',
    description: 'Natural logarithm — converges for |x| < 1',
    seriesText: 'x − x²/2 + x³/3 − ⋯',
  },
  {
    id: 'arctan',
    label: 'arctan(x)',
    displayLabel: 'arctan(x)',
    expression: 'atan(x)',
    trueExpr: 'atan(x)',
    defaultCenter: 0,
    color: '#f472b6',
    convergence: 'R = 1',
    description: 'Arctangent — converges for |x| ≤ 1',
    seriesText: 'x − x³/3 + x⁵/5 − ⋯',
  },
  {
    id: 'geometric',
    label: '1/(1−x)',
    displayLabel: '1/(1−x)',
    expression: '1/(1-x)',
    trueExpr: '1/(1 - x)',
    defaultCenter: 0,
    color: '#fbbf24',
    convergence: 'R = 1',
    description: 'Geometric series — converges for |x| < 1',
    seriesText: '1 + x + x² + x³ + ⋯',
  },
  {
    id: 'sinh',
    label: 'sinh(x)',
    displayLabel: 'sinh(x)',
    expression: 'sinh(x)',
    trueExpr: 'sinh(x)',
    defaultCenter: 0,
    color: '#f472b6',
    convergence: 'R = ∞',
    description: 'Hyperbolic sine — infinite radius of convergence',
    seriesText: 'x + x³/3! + x⁵/5! + ⋯',
  },
  {
    id: 'cosh',
    label: 'cosh(x)',
    displayLabel: 'cosh(x)',
    expression: 'cosh(x)',
    trueExpr: 'cosh(x)',
    defaultCenter: 0,
    color: '#facc15',
    convergence: 'R = ∞',
    description: 'Hyperbolic cosine — infinite radius of convergence',
    seriesText: '1 + x²/2! + x⁴/4! + ⋯',
  },
  {
    id: 'sqrt',
    label: '√(1+x)',
    displayLabel: '√(1+x)',
    expression: 'sqrt(1+x)',
    trueExpr: 'sqrt(1 + x)',
    defaultCenter: 0,
    color: '#4ade80',
    convergence: 'R = 1',
    description: 'Square root — binomial series for n=1/2, converges for |x| < 1',
    seriesText: '1 + x/2 − x²/8 + x³/16 − ⋯',
  },
  {
    id: 'tan',
    label: 'tan(x)',
    displayLabel: 'tan(x)',
    expression: 'tan(x)',
    trueExpr: 'tan(x)',
    defaultCenter: 0,
    color: '#22d3ee',
    convergence: 'R = π/2',
    description: 'Tangent — converges for |x| < π/2',
    seriesText: 'x + x³/3 + 2x⁵/15 + ⋯',
  },
  {
    id: 'binomial',
    label: '(1+x)²',
    displayLabel: '(1+x)²',
    expression: '(1+x)^2',
    trueExpr: '(1 + x)^2',
    defaultCenter: 0,
    color: '#a78bfa',
    convergence: 'R = ∞',
    description: 'Binomial with n=2 — finite polynomial (exact after 3 terms)',
    seriesText: '1 + 2x + x²',
  },
] as const;

const MAX_TERMS = 12;
const PLOT_POINTS = 500;
const ANIMATION_INTERVAL_MS = 700;

// ---------------------------------------------------------------------------
// Pure math helpers (no imports needed)
// ---------------------------------------------------------------------------

function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Evaluate a partial Taylor sum at a given x.
 * P(x) = sum_n  coefficient_n * (x - center)^power_n
 */
function evaluateTaylorPartialSum(
  terms: ReadonlyArray<TaylorTerm>,
  termCount: number,
  x: number,
  center: number
): number {
  let sum = 0;
  const limit = Math.min(termCount, terms.length);
  for (let i = 0; i < limit; i++) {
    const t = terms[i];
    if (!t) continue;
    sum += t.coefficient * Math.pow(x - center, t.power);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Coefficient computation for known functions
// ---------------------------------------------------------------------------

/**
 * Compute Taylor coefficients analytically for the preset functions.
 * This avoids importing the heavy symbolic engine for the common cases.
 */
function computePresetCoefficients(
  presetId: string,
  center: number,
  numTerms: number
): ReadonlyArray<TaylorTerm> {
  const terms: TaylorTerm[] = [];

  if (center !== 0 && presetId !== 'custom') {
    return [];
  }

  switch (presetId) {
    case 'sin': {
      for (let n = 0; n < numTerms; n++) {
        const power = 2 * n + 1;
        const sign = n % 2 === 0 ? 1 : -1;
        const coeff = sign / factorial(power);
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    case 'cos': {
      for (let n = 0; n < numTerms; n++) {
        const power = 2 * n;
        const sign = n % 2 === 0 ? 1 : -1;
        const coeff = sign / factorial(power);
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    case 'exp': {
      for (let n = 0; n < numTerms; n++) {
        const coeff = 1 / factorial(n);
        terms.push({ index: n, coefficient: coeff, power: n, termLatex: buildTermLatex(coeff, n, 'x', 0) });
      }
      break;
    }
    case 'ln': {
      for (let n = 0; n < numTerms; n++) {
        const k = n + 1;
        const sign = n % 2 === 0 ? 1 : -1;
        const coeff = sign / k;
        terms.push({ index: n, coefficient: coeff, power: k, termLatex: buildTermLatex(coeff, k, 'x', 0) });
      }
      break;
    }
    case 'arctan': {
      // arctan(x) = x - x^3/3 + x^5/5 - ... (only odd powers)
      for (let n = 0; n < numTerms; n++) {
        const power = 2 * n + 1;
        const sign = n % 2 === 0 ? 1 : -1;
        const coeff = sign / power;
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    case 'geometric': {
      // 1/(1-x) = 1 + x + x^2 + x^3 + ...
      for (let n = 0; n < numTerms; n++) {
        terms.push({ index: n, coefficient: 1, power: n, termLatex: buildTermLatex(1, n, 'x', 0) });
      }
      break;
    }
    case 'sinh': {
      for (let n = 0; n < numTerms; n++) {
        const power = 2 * n + 1;
        const coeff = 1 / factorial(power);
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    case 'cosh': {
      for (let n = 0; n < numTerms; n++) {
        const power = 2 * n;
        const coeff = 1 / factorial(power);
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    case 'sqrt': {
      // (1+x)^(1/2): binomial series coefficients = C(1/2, n)
      // C(1/2, 0)=1, C(1/2, 1)=1/2, C(1/2, 2)=-1/8, C(1/2, 3)=1/16, ...
      const binomialHalf = (n: number): number => {
        if (n === 0) return 1;
        let result = 1;
        for (let k = 0; k < n; k++) {
          result *= (0.5 - k);
        }
        return result / factorial(n);
      };
      for (let n = 0; n < numTerms; n++) {
        const coeff = binomialHalf(n);
        terms.push({ index: n, coefficient: coeff, power: n, termLatex: buildTermLatex(coeff, n, 'x', 0) });
      }
      break;
    }
    case 'tan': {
      const tanCoeffs: ReadonlyArray<readonly [number, number]> = [
        [1, 1],
        [1 / 3, 3],
        [2 / 15, 5],
        [17 / 315, 7],
        [62 / 2835, 9],
      ] as const;
      for (let n = 0; n < Math.min(numTerms, tanCoeffs.length); n++) {
        const entry = tanCoeffs[n];
        if (!entry) continue;
        const [coeff, power] = entry;
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    case 'binomial': {
      // (1+x)^2 = 1 + 2x + x^2 — exact finite polynomial
      const binomCoeffs: ReadonlyArray<readonly [number, number]> = [
        [1, 0],
        [2, 1],
        [1, 2],
      ] as const;
      for (let n = 0; n < Math.min(numTerms, binomCoeffs.length); n++) {
        const entry = binomCoeffs[n];
        if (!entry) continue;
        const [coeff, power] = entry;
        terms.push({ index: n, coefficient: coeff, power, termLatex: buildTermLatex(coeff, power, 'x', 0) });
      }
      break;
    }
    default:
      break;
  }

  return terms;
}

/**
 * Build a human-readable LaTeX string for a single Taylor term.
 */
function buildTermLatex(coeff: number, power: number, variable: string, center: number): string {
  if (coeff === 0) return '0';

  const sign = coeff < 0 ? '-' : '+';
  const abs = Math.abs(coeff);

  let coeffStr: string;
  const fracResult = toFraction(abs);
  if (fracResult !== null) {
    const [num, den] = fracResult;
    if (den === 1) {
      coeffStr = num === 1 && power !== 0 ? '' : String(num);
    } else {
      coeffStr = `\\frac{${num}}{${den}}`;
    }
  } else {
    coeffStr = abs.toPrecision(4);
  }

  let xPart: string;
  const varPart = center === 0 ? variable : `(${variable}-${center})`;
  if (power === 0) {
    xPart = '';
    if (coeffStr === '') coeffStr = '1';
  } else if (power === 1) {
    xPart = varPart;
  } else {
    xPart = `${varPart}^{${power}}`;
  }

  return `${sign}${coeffStr}${xPart}`;
}

/**
 * Attempt to express a positive number as a simplified integer fraction.
 */
function toFraction(value: number): readonly [number, number] | null {
  if (Number.isInteger(value)) return [value, 1] as const;

  const candidates = [1, 2, 3, 4, 6, 8, 15, 16, 24, 120, 315, 720, 2835, 5040, 40320, 362880, 3628800];
  for (const den of candidates) {
    const num = Math.round(value * den);
    if (Math.abs(num / den - value) < 1e-10) {
      const g = gcd(Math.abs(num), den);
      return [num / g, den / g] as const;
    }
  }
  return null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// ---------------------------------------------------------------------------
// Build full polynomial LaTeX from a list of terms
// ---------------------------------------------------------------------------

function buildPolynomialLatex(terms: ReadonlyArray<TaylorTerm>, termCount: number): string {
  const limit = Math.min(termCount, terms.length);
  if (limit === 0) return '0';

  const parts: string[] = [];
  for (let i = 0; i < limit; i++) {
    const t = terms[i];
    if (!t) continue;
    parts.push(t.termLatex);
  }

  if (parts.length === 0) return '0';

  let result = parts.join('\\,');
  if (result.startsWith('+')) result = result.slice(1);
  if (termCount < MAX_TERMS) result += ' + \\cdots';
  return result;
}

// ---------------------------------------------------------------------------
// SVG Plot — Enhanced with multi-order display, grid, legend, axis labels
// ---------------------------------------------------------------------------

interface PlotBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface PlotDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

function worldToSvg(
  x: number,
  y: number,
  bounds: PlotBounds,
  dims: PlotDimensions
): readonly [number, number] {
  const { xMin, xMax, yMin, yMax } = bounds;
  const plotW = dims.width - dims.paddingLeft - dims.paddingRight;
  const plotH = dims.height - dims.paddingTop - dims.paddingBottom;
  const sx = dims.paddingLeft + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = dims.paddingTop + ((yMax - y) / (yMax - yMin)) * plotH;
  return [sx, sy] as const;
}

function buildPolylinePath(
  fn: (x: number) => number,
  bounds: PlotBounds,
  dims: PlotDimensions,
  clampY = true
): string {
  const { xMin, xMax } = bounds;
  const step = (xMax - xMin) / PLOT_POINTS;
  const parts: string[] = [];
  let pen = 'M';

  for (let i = 0; i <= PLOT_POINTS; i++) {
    const x = xMin + i * step;
    const y = fn(x);

    if (!isFinite(y)) {
      pen = 'M';
      continue;
    }

    const clampedY = clampY ? Math.max(bounds.yMin * 1.5, Math.min(bounds.yMax * 1.5, y)) : y;
    if (clampedY < bounds.yMin || clampedY > bounds.yMax) {
      pen = 'M';
      continue;
    }

    const [sx, sy] = worldToSvg(x, clampedY, bounds, dims);
    parts.push(`${pen}${sx.toFixed(2)},${sy.toFixed(2)}`);
    pen = 'L';
  }

  return parts.join(' ');
}

/**
 * Compute nice tick values for an axis range.
 */
function computeTicks(min: number, max: number, targetCount = 8): number[] {
  const span = max - min;
  const rawStep = span / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceFactor = 1;
  if (normalized >= 5) niceFactor = 5;
  else if (normalized >= 2) niceFactor = 2;
  const step = niceFactor * magnitude;

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 0.01; v += step) {
    const rounded = Math.round(v / step) * step;
    if (rounded >= min && rounded <= max) ticks.push(rounded);
  }
  return ticks;
}

interface TaylorPlotProps {
  terms: ReadonlyArray<TaylorTerm>;
  visibleTerms: number;
  center: number;
  trueExprEval: ((x: number) => number) | null;
  preset: FunctionPreset;
  xRange: readonly [number, number];
  /** When true, show all intermediate approximations (ghosted lower orders) */
  showAllOrders: boolean;
}

function TaylorPlot({
  terms,
  visibleTerms,
  center,
  trueExprEval,
  preset,
  xRange,
  showAllOrders,
}: TaylorPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const dims: PlotDimensions = {
    width: 720,
    height: 440,
    paddingLeft: 54,
    paddingRight: 24,
    paddingTop: 24,
    paddingBottom: 48,
  };

  const [xMin, xMax] = xRange;

  // Compute sensible y range
  const yBounds = (() => {
    let yLo = -5;
    let yHi = 5;
    const step = (xMax - xMin) / 100;
    for (let i = 0; i <= 100; i++) {
      const x = xMin + i * step;
      if (trueExprEval) {
        const y = trueExprEval(x);
        if (isFinite(y)) { yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); }
      }
      if (terms.length > 0) {
        const y = evaluateTaylorPartialSum(terms, visibleTerms, x, center);
        if (isFinite(y)) { yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); }
      }
    }
    const span = Math.max(1, yHi - yLo);
    yLo = Math.max(-25, yLo - span * 0.15);
    yHi = Math.min(25, yHi + span * 0.15);
    return { yMin: yLo, yMax: yHi };
  })();

  const bounds: PlotBounds = { xMin, xMax, ...yBounds };

  // Ticks
  const xTicks = computeTicks(xMin, xMax, 8);
  const yTicks = computeTicks(yBounds.yMin, yBounds.yMax, 6);

  // Axis positions
  const [axisX0, axisY0] = worldToSvg(xMin, 0, bounds, dims);
  const [axisX1] = worldToSvg(xMax, 0, bounds, dims);
  // Clamp y-axis origin to plot area
  const clampedAxisY = Math.max(dims.paddingTop, Math.min(dims.height - dims.paddingBottom, axisY0));
  const [axisXc] = worldToSvg(0, 0, bounds, dims);
  const clampedAxisX = Math.max(dims.paddingLeft, Math.min(dims.width - dims.paddingRight, axisXc));
  const [, yAxisTop] = worldToSvg(0, yBounds.yMax, bounds, dims);
  const [, yAxisBot] = worldToSvg(0, yBounds.yMin, bounds, dims);

  // True function path
  const truePath = trueExprEval ? buildPolylinePath(trueExprEval, bounds, dims) : '';

  // Build paths for each visible order (for "show all orders" mode)
  const orderPaths: Array<{ termCount: number; path: string; color: string }> = [];
  if (showAllOrders && terms.length > 0) {
    for (let tc = 1; tc <= visibleTerms; tc++) {
      const color = APPROXIMATION_COLORS[(tc - 1) % APPROXIMATION_COLORS.length] ?? '#f97316';
      orderPaths.push({
        termCount: tc,
        path: buildPolylinePath((x) => evaluateTaylorPartialSum(terms, tc, x, center), bounds, dims),
        color,
      });
    }
  }

  // Current approximation path (for single-order mode)
  const currentApproxColor = APPROXIMATION_COLORS[(visibleTerms - 1) % APPROXIMATION_COLORS.length] ?? '#f97316';
  const approxPath =
    !showAllOrders && terms.length > 0
      ? buildPolylinePath((x) => evaluateTaylorPartialSum(terms, visibleTerms, x, center), bounds, dims)
      : '';

  // Center point marker
  const [cx, cy] = worldToSvg(center, trueExprEval ? trueExprEval(center) : 0, bounds, dims);

  // Legend items
  const legendItems: Array<{ color: string; label: string; dashed: boolean }> = [];
  legendItems.push({ color: preset.color, label: preset.label, dashed: false });
  if (showAllOrders) {
    // Show a compact range entry
    if (visibleTerms >= 1) {
      legendItems.push({
        color: APPROXIMATION_COLORS[0] ?? '#3b82f6',
        label: `T₁(x)`,
        dashed: true,
      });
      if (visibleTerms > 1) {
        legendItems.push({
          color: APPROXIMATION_COLORS[(visibleTerms - 1) % APPROXIMATION_COLORS.length] ?? '#f97316',
          label: `T${visibleTerms}(x)`,
          dashed: true,
        });
      }
    }
  } else {
    legendItems.push({ color: currentApproxColor, label: `T${visibleTerms}(x)`, dashed: true });
  }

  const legendH = legendItems.length * 20 + 16;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        className="w-full h-auto rounded-xl border border-border/60"
        style={{ background: 'oklch(0.11 0.02 250)' }}
        aria-label={`Taylor series approximation plot for ${preset.label}`}
        role="img"
      >
        {/* Definitions for gradients and filters */}
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="plot-clip">
            <rect
              x={dims.paddingLeft}
              y={dims.paddingTop}
              width={dims.width - dims.paddingLeft - dims.paddingRight}
              height={dims.height - dims.paddingTop - dims.paddingBottom}
            />
          </clipPath>
        </defs>

        {/* Plot background with subtle gradient */}
        <rect
          x={dims.paddingLeft}
          y={dims.paddingTop}
          width={dims.width - dims.paddingLeft - dims.paddingRight}
          height={dims.height - dims.paddingTop - dims.paddingBottom}
          fill="oklch(0.13 0.02 250)"
          rx="4"
        />

        {/* Vertical grid lines */}
        <g clipPath="url(#plot-clip)">
          {xTicks.map((t) => {
            const [sx] = worldToSvg(t, 0, bounds, dims);
            const isOrigin = Math.abs(t) < 0.001;
            return (
              <line
                key={`vg-${t}`}
                x1={sx}
                y1={dims.paddingTop}
                x2={sx}
                y2={dims.height - dims.paddingBottom}
                stroke={isOrigin ? 'oklch(0.55 0.02 250)' : 'oklch(0.25 0.02 250)'}
                strokeWidth={isOrigin ? 1 : 0.5}
              />
            );
          })}

          {/* Horizontal grid lines */}
          {yTicks.map((t) => {
            const [, sy] = worldToSvg(0, t, bounds, dims);
            const isOrigin = Math.abs(t) < 0.001;
            return (
              <line
                key={`hg-${t}`}
                x1={dims.paddingLeft}
                y1={sy}
                x2={dims.width - dims.paddingRight}
                y2={sy}
                stroke={isOrigin ? 'oklch(0.55 0.02 250)' : 'oklch(0.25 0.02 250)'}
                strokeWidth={isOrigin ? 1 : 0.5}
              />
            );
          })}

          {/* X axis */}
          <line
            x1={axisX0}
            y1={clampedAxisY}
            x2={axisX1}
            y2={clampedAxisY}
            stroke="oklch(0.60 0.02 250)"
            strokeWidth="1.5"
          />

          {/* Y axis */}
          <line
            x1={clampedAxisX}
            y1={yAxisTop}
            x2={clampedAxisX}
            y2={yAxisBot}
            stroke="oklch(0.60 0.02 250)"
            strokeWidth="1.5"
          />

          {/* Ghost order paths (show-all-orders mode) */}
          {showAllOrders && orderPaths.map(({ termCount, path, color }, idx) => {
            const isLatest = termCount === visibleTerms;
            const opacity = isLatest ? 0.95 : 0.28 + (idx / Math.max(orderPaths.length - 1, 1)) * 0.35;
            return path ? (
              <motion.path
                key={`order-${termCount}`}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={isLatest ? 2.5 : 1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isLatest ? undefined : '4 3'}
                opacity={opacity}
                initial={{ opacity: 0 }}
                animate={{ opacity }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                filter={isLatest ? 'url(#glow)' : undefined}
              />
            ) : null;
          })}

          {/* Single approximation path (step-by-step mode) */}
          <AnimatePresence mode="sync">
            {approxPath && !showAllOrders && (
              <motion.path
                key={`approx-${visibleTerms}`}
                d={approxPath}
                fill="none"
                stroke={currentApproxColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="7 3"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: 0.95, pathLength: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                filter="url(#glow)"
              />
            )}
          </AnimatePresence>

          {/* True function curve — always on top, thickest */}
          {truePath && (
            <path
              d={truePath}
              fill="none"
              stroke={preset.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
              filter="url(#glow)"
            />
          )}

          {/* Expansion center marker */}
          {isFinite(cy) && cy > dims.paddingTop && cy < dims.height - dims.paddingBottom && (
            <g>
              <circle cx={cx} cy={cy} r="8" fill={preset.color} opacity="0.15" />
              <circle cx={cx} cy={cy} r="4.5" fill={preset.color} stroke="oklch(0.95 0 0)" strokeWidth="1.5" opacity="0.95" />
            </g>
          )}
        </g>

        {/* X-axis tick labels */}
        {xTicks.filter((t) => Math.abs(t) > 0.001).map((t) => {
          const [sx] = worldToSvg(t, 0, bounds, dims);
          return (
            <g key={`xt-${t}`}>
              <line
                x1={sx}
                y1={clampedAxisY - 4}
                x2={sx}
                y2={clampedAxisY + 4}
                stroke="oklch(0.50 0.02 250)"
                strokeWidth="1"
              />
              <text
                x={sx}
                y={dims.height - dims.paddingBottom + 18}
                textAnchor="middle"
                fontSize="10"
                fill="oklch(0.55 0.015 250)"
                fontFamily="ui-monospace, monospace"
              >
                {t % 1 === 0 ? t : t.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Y-axis tick labels */}
        {yTicks.filter((t) => Math.abs(t) > 0.001).map((t) => {
          const [, sy] = worldToSvg(0, t, bounds, dims);
          return (
            <g key={`yt-${t}`}>
              <line
                x1={clampedAxisX - 4}
                y1={sy}
                x2={clampedAxisX + 4}
                y2={sy}
                stroke="oklch(0.50 0.02 250)"
                strokeWidth="1"
              />
              <text
                x={dims.paddingLeft - 8}
                y={sy + 4}
                textAnchor="end"
                fontSize="10"
                fill="oklch(0.55 0.015 250)"
                fontFamily="ui-monospace, monospace"
              >
                {t % 1 === 0 ? t : t.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text
          x={(dims.paddingLeft + dims.width - dims.paddingRight) / 2}
          y={dims.height - 4}
          textAnchor="middle"
          fontSize="11"
          fill="oklch(0.50 0.015 250)"
          fontFamily="ui-monospace, monospace"
          fontStyle="italic"
        >
          x
        </text>
        <text
          x={12}
          y={(dims.paddingTop + dims.height - dims.paddingBottom) / 2}
          textAnchor="middle"
          fontSize="11"
          fill="oklch(0.50 0.015 250)"
          fontFamily="ui-monospace, monospace"
          fontStyle="italic"
          transform={`rotate(-90, 12, ${(dims.paddingTop + dims.height - dims.paddingBottom) / 2})`}
        >
          y
        </text>

        {/* Legend panel */}
        <g transform={`translate(${dims.paddingLeft + 8}, ${dims.paddingTop + 8})`}>
          <rect
            width="148"
            height={legendH}
            rx="6"
            fill="oklch(0.11 0.02 250 / 0.88)"
            stroke="oklch(0.28 0.02 250)"
            strokeWidth="0.5"
          />
          {legendItems.map((item, i) => {
            const yOff = 14 + i * 20;
            return (
              <g key={item.label}>
                {item.dashed ? (
                  <line
                    x1="8"
                    y1={yOff}
                    x2="30"
                    y2={yOff}
                    stroke={item.color}
                    strokeWidth="2"
                    strokeDasharray="5 2.5"
                  />
                ) : (
                  <line x1="8" y1={yOff} x2="30" y2={yOff} stroke={item.color} strokeWidth="2.5" />
                )}
                <text x="36" y={yOff + 4} fontSize="10.5" fill={item.color} fontFamily="ui-monospace, monospace">
                  {item.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset chip component
// ---------------------------------------------------------------------------

interface PresetChipProps {
  preset: FunctionPreset;
  isSelected: boolean;
  onClick: () => void;
}

function PresetChip({ preset, isSelected, onClick }: PresetChipProps) {
  const selectedStyle = isSelected
    ? {
        background: `linear-gradient(135deg, ${preset.color}22, ${preset.color}11)`,
        borderColor: `${preset.color}60`,
        borderWidth: '1px',
        borderStyle: 'solid' as const,
        color: preset.color,
        boxShadow: `0 0 12px 0 ${preset.color}28`,
      }
    : {};
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      aria-pressed={isSelected}
      title={preset.description}
      className={cn(
        'relative rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'font-mono select-none',
        isSelected
          ? 'text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground border border-border/60 bg-background/40 hover:bg-accent/50'
      )}
      style={selectedStyle}
    >
      {isSelected && (
        <motion.span
          layoutId="preset-indicator"
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${preset.color}18, ${preset.color}08)`,
            border: `1px solid ${preset.color}50`,
          }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
        />
      )}
      <span className="relative z-10">{preset.displayLabel}</span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Error display panel
// ---------------------------------------------------------------------------

interface ErrorPanelProps {
  terms: ReadonlyArray<TaylorTerm>;
  visibleTerms: number;
  center: number;
  trueExprEval: ((x: number) => number) | null;
  xRange: readonly [number, number];
}

function ErrorPanel({ terms, visibleTerms, center, trueExprEval, xRange }: ErrorPanelProps) {
  if (!trueExprEval || terms.length === 0) return null;

  const [xMin, xMax] = xRange;
  const samplePoints = 8;
  const step = (xMax - xMin) / (samplePoints + 1);

  const rows: Array<{ x: number; true: number; approx: number; error: number }> = [];
  for (let i = 1; i <= samplePoints; i++) {
    const x = xMin + i * step;
    const trueVal = trueExprEval(x);
    const approxVal = evaluateTaylorPartialSum(terms, visibleTerms, x, center);
    if (!isFinite(trueVal) || !isFinite(approxVal)) continue;
    rows.push({ x, true: trueVal, approx: approxVal, error: Math.abs(trueVal - approxVal) });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-muted-foreground">x</th>
            <th className="text-right p-2 text-muted-foreground">f(x)</th>
            <th className="text-right p-2 text-muted-foreground">T_n(x)</th>
            <th className="text-right p-2 text-muted-foreground">|error|</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.x} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="p-2 text-foreground">{row.x.toFixed(3)}</td>
              <td className="p-2 text-right text-foreground">{row.true.toFixed(6)}</td>
              <td className="p-2 text-right" style={{ color: APPROXIMATION_COLORS[(visibleTerms - 1) % APPROXIMATION_COLORS.length] }}>
                {row.approx.toFixed(6)}
              </td>
              <td
                className={cn(
                  'p-2 text-right',
                  row.error < 1e-4 ? 'text-green-400' : row.error < 1e-2 ? 'text-yellow-400' : 'text-red-400'
                )}
              >
                {row.error < 1e-10 ? '< 1e-10' : row.error.toExponential(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Term list panel
// ---------------------------------------------------------------------------

interface TermListProps {
  terms: ReadonlyArray<TaylorTerm>;
  visibleTerms: number;
  variable: string;
}

function TermList({ terms, visibleTerms, variable }: TermListProps) {
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {terms.slice(0, Math.min(visibleTerms, terms.length)).map((term, i) => {
          const termColor = APPROXIMATION_COLORS[i % APPROXIMATION_COLORS.length] ?? '#f97316';
          const isNewest = i === visibleTerms - 1;
          const termStyle = isNewest
            ? {
                background: `linear-gradient(135deg, ${termColor}14, ${termColor}06)`,
                borderColor: `${termColor}40`,
              }
            : {};
          return (
            <motion.div
              key={term.index}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-all',
                isNewest ? 'border-border/60' : 'bg-muted/20 border-border/30'
              )}
              style={termStyle}
            >
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-xs"
                style={isNewest ? { borderColor: `${termColor}60`, color: termColor } : undefined}
              >
                n={term.power}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">
                  f^({term.power})({variable === 'x' ? '0' : 'a'}) / {term.power}! = {term.coefficient.toPrecision(5)}
                </div>
                <MathRenderer
                  expression={term.termLatex.replace(/^[+]/, '')}
                  displayMode={false}
                  className="text-sm"
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glass card wrapper that applies the glass-morphism style
// ---------------------------------------------------------------------------

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md',
        className
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TaylorSeriesVisualizer() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('sin');
  const [center, setCenter] = useState<number>(0);
  const [numTerms, setNumTerms] = useState<number>(5);
  const [visibleTerms, setVisibleTerms] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showAllOrders, setShowAllOrders] = useState<boolean>(false);
  const [xRangeInput, setXRangeInput] = useState<readonly [number, number]>([-4 * Math.PI, 4 * Math.PI]);

  const [computedTerms, setComputedTerms] = useState<ReadonlyArray<TaylorTerm>>([]);
  const [radiusOfConvergence, setRadiusOfConvergence] = useState<number>(Infinity);
  const [trueExprEval, setTrueExprEval] = useState<((x: number) => number) | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState<boolean>(false);

  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedPreset = FUNCTION_PRESETS.find((p) => p.id === selectedPresetId) ?? FUNCTION_PRESETS[0]!;

  // ---------------------------------------------------------------------------
  // Build the true-function evaluator from mathjs
  // ---------------------------------------------------------------------------

  const buildTrueEval = useCallback(async (trueExpr: string) => {
    try {
      const { compile } = await import('mathjs');
      const compiled = compile(trueExpr);
      const fn = (x: number): number => {
        try {
          const result: unknown = compiled.evaluate({ x });
          return typeof result === 'number' ? result : Number.NaN;
        } catch {
          return Number.NaN;
        }
      };
      setTrueExprEval(() => fn);
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : 'Failed to build evaluator');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Compute Taylor coefficients
  // ---------------------------------------------------------------------------

  const computeCoefficients = useCallback(async () => {
    setIsComputing(true);
    setComputeError(null);

    try {
      const preset = FUNCTION_PRESETS.find((p) => p.id === selectedPresetId) ?? FUNCTION_PRESETS[0]!;
      await buildTrueEval(preset.trueExpr);

      const precomputed = computePresetCoefficients(selectedPresetId, center, numTerms);

      if (precomputed.length > 0 && center === 0) {
        setComputedTerms(precomputed);

        const roc: Record<string, number> = {
          sin: Infinity,
          cos: Infinity,
          exp: Infinity,
          ln: 1,
          arctan: 1,
          geometric: 1,
          tan: Math.PI / 2,
          sinh: Infinity,
          cosh: Infinity,
          sqrt: 1,
          binomial: Infinity,
        };
        setRadiusOfConvergence(roc[selectedPresetId] ?? Infinity);
      } else {
        const [{ parse }, { taylorSeries, getKnownSeries }] = await Promise.all([
          import('@nextcalc/math-engine/parser'),
          import('@nextcalc/math-engine/symbolic'),
        ]);

        const exprStr = preset.expression;
        const ast = parse(exprStr);

        const funcName = preset.id;
        const known = getKnownSeries(funcName, 'x', { center, terms: numTerms });
        const seriesResult = known ?? taylorSeries(ast, 'x', {
          center,
          terms: numTerms,
          includeRemainder: false,
          simplifyTerms: true,
        });

        const { evaluate } = await import('@nextcalc/math-engine/parser');
        const engineTerms: TaylorTerm[] = seriesResult.terms.map((astTerm, idx) => {
          let coeff = 0;
          let power = 0;
          try {
            const result = evaluate(astTerm, { variables: { x: center + 1 } });
            if (result.success && typeof result.value === 'number') coeff = result.value;
          } catch {
            // leave coeff at 0
          }
          power = idx;
          return {
            index: idx,
            coefficient: coeff,
            power,
            termLatex: buildTermLatex(coeff, power, 'x', center),
          };
        });

        setComputedTerms(engineTerms);
        setRadiusOfConvergence(seriesResult.radiusOfConvergence ?? Infinity);
      }

      setVisibleTerms(1);
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : 'Computation failed');
    } finally {
      setIsComputing(false);
    }
  }, [selectedPresetId, center, numTerms, buildTrueEval]);

  // Compute whenever parameters change
  useEffect(() => {
    void computeCoefficients();
  }, [computeCoefficients]);

  // Adjust xRange when preset changes
  useEffect(() => {
    switch (selectedPresetId) {
      case 'sin':
      case 'cos':
      case 'tan':
      case 'sinh':
      case 'cosh':
        setXRangeInput([-4 * Math.PI, 4 * Math.PI]);
        break;
      case 'exp':
        setXRangeInput([-3, 4]);
        break;
      case 'ln':
      case 'arctan':
      case 'geometric':
      case 'sqrt':
        setXRangeInput([-0.95, 2.5]);
        break;
      case 'binomial':
        setXRangeInput([-3, 3]);
        break;
      default:
        setXRangeInput([-4, 4]);
    }
  }, [selectedPresetId]);

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = setInterval(() => {
        setVisibleTerms((prev) => {
          const maxVisible = Math.min(numTerms, computedTerms.length);
          if (prev >= maxVisible) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, ANIMATION_INTERVAL_MS);
    } else if (animationRef.current) {
      clearInterval(animationRef.current);
    }
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isPlaying, numTerms, computedTerms.length]);

  const handleReset = () => {
    setIsPlaying(false);
    setVisibleTerms(1);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setVisibleTerms((v) => Math.max(1, v - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setVisibleTerms((v) => Math.min(Math.min(numTerms, computedTerms.length), v + 1));
  };

  const maxVisible = Math.min(numTerms, computedTerms.length);

  // ---------------------------------------------------------------------------
  // Analysis functions for the PlotAnalysisPanel
  // ---------------------------------------------------------------------------

  // Build AnalysisFunction descriptors reactively so the panel updates when
  // visibleTerms or the preset changes.
  const analysisFunctions = useMemo<AnalysisFunction[]>(() => {
    const fns: AnalysisFunction[] = [];

    // True function
    if (trueExprEval) {
      fns.push({
        fn: trueExprEval,
        label: selectedPreset.label,
        color: selectedPreset.color,
      });
    }

    // Current Taylor approximation (only if at least 1 term available)
    if (computedTerms.length > 0 && visibleTerms > 0) {
      const approxColor =
        APPROXIMATION_COLORS[(visibleTerms - 1) % APPROXIMATION_COLORS.length] ?? '#f97316';
      fns.push({
        fn: (x: number) => evaluateTaylorPartialSum(computedTerms, visibleTerms, x, center),
        label: `T\u2080 \u2026 T${visibleTerms}(x)`,
        color: approxColor,
      });
    }

    return fns;
  }, [trueExprEval, computedTerms, visibleTerms, center, selectedPreset]);

  // Viewport for the analysis panel: match the plot's x-range with a symmetric
  // y-range that covers most common function outputs without exploding.
  const [xRangeMin, xRangeMax] = xRangeInput;
  const analysisViewport = useMemo(() => ({
    xMin: xRangeMin,
    xMax: xRangeMax,
    yMin: -25,
    yMax: 25,
  }), [xRangeMin, xRangeMax]);

  const rocDisplay =
    radiusOfConvergence === Infinity
      ? '\\infty'
      : radiusOfConvergence === Math.PI / 2
      ? '\\frac{\\pi}{2}'
      : String(radiusOfConvergence);

  const currentApproxColor =
    APPROXIMATION_COLORS[(visibleTerms - 1) % APPROXIMATION_COLORS.length] ?? '#f97316';

  return (
    <div className="space-y-5">
      {/* Preset chips row */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary/70" aria-hidden />
          <span className="text-sm font-medium text-muted-foreground">Function Presets</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Function preset selection">
          {FUNCTION_PRESETS.map((preset) => (
            <PresetChip
              key={preset.id}
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              onClick={() => {
                setSelectedPresetId(preset.id);
                setCenter(preset.defaultCenter);
                setIsPlaying(false);
                setVisibleTerms(1);
              }}
            />
          ))}
        </div>
        {/* Description line for selected preset */}
        <AnimatePresence mode="wait">
          <motion.p
            key={selectedPreset.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-3 text-xs text-muted-foreground font-mono"
          >
            <span style={{ color: selectedPreset.color }}>{selectedPreset.displayLabel}</span>
            {' '}&mdash;{' '}
            {selectedPreset.seriesText}
            <span className="ml-2 text-muted-foreground/60">({selectedPreset.convergence})</span>
          </motion.p>
        </AnimatePresence>
      </GlassCard>

      {/* Controls row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Expansion parameters */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-medium mb-4">Expansion Parameters</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <label htmlFor="center-slider">Expansion point a</label>
                <span className="font-mono text-foreground">{center}</span>
              </div>
              <Slider
                id="center-slider"
                min={-4}
                max={4}
                step={0.5}
                value={[center]}
                onValueChange={([v]) => {
                  if (v !== undefined) {
                    setCenter(v);
                    setIsPlaying(false);
                    setVisibleTerms(1);
                  }
                }}
                aria-label="Expansion center point"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>-4</span>
                <span>0 (Maclaurin)</span>
                <span>4</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <label htmlFor="terms-slider">Max terms (N)</label>
                <span className="font-mono text-foreground">{numTerms}</span>
              </div>
              <Slider
                id="terms-slider"
                min={1}
                max={MAX_TERMS}
                step={1}
                value={[numTerms]}
                onValueChange={([v]) => {
                  if (v !== undefined) {
                    setNumTerms(v);
                    setVisibleTerms((prev) => Math.min(prev, v));
                  }
                }}
                aria-label="Number of Taylor terms"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>{MAX_TERMS}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Series info */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-medium mb-4">Series Info</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Type</div>
              <Badge variant="outline" className="font-mono text-xs">
                {center === 0 ? 'Maclaurin Series' : `Taylor at a=${center}`}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Radius of convergence</div>
              <div className="flex items-center gap-2">
                <MathRenderer expression={`R = ${rocDisplay}`} displayMode={false} className="text-sm" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Terms shown / computed</div>
              <Badge
                variant="secondary"
                className="font-mono text-xs"
                style={{ color: currentApproxColor, borderColor: `${currentApproxColor}40` }}
              >
                {visibleTerms} / {maxVisible}
              </Badge>
            </div>
            {computeError && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{computeError}</div>
            )}
            {isComputing && <div className="text-xs text-muted-foreground">Computing...</div>}
          </div>
        </GlassCard>

        {/* Display mode toggle */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-medium mb-4">Visualization Mode</h3>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAllOrders(false)}
              aria-pressed={!showAllOrders}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all duration-200',
                !showAllOrders
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 bg-background/30 text-muted-foreground hover:text-foreground hover:bg-accent/40'
              )}
            >
              <div className="font-medium">Step-by-step</div>
              <div className="text-xs text-muted-foreground mt-0.5">Show current order only</div>
            </button>
            <button
              type="button"
              onClick={() => setShowAllOrders(true)}
              aria-pressed={showAllOrders}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all duration-200',
                showAllOrders
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 bg-background/30 text-muted-foreground hover:text-foreground hover:bg-accent/40'
              )}
            >
              <div className="font-medium">All orders overlay</div>
              <div className="text-xs text-muted-foreground mt-0.5">Gradient blue → pink per order</div>
            </button>
          </div>
        </GlassCard>
      </div>

      {/* Main plot area */}
      <GlassCard>
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">Approximation Plot</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span style={{ color: selectedPreset.color }}>{selectedPreset.label}</span>
                {' '}vs{' '}
                <span style={{ color: currentApproxColor }}>T_{visibleTerms}(x)</span>
                {' — '}{visibleTerms} term{visibleTerms !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                aria-label="Reset to first term"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleStepBack}
                disabled={visibleTerms <= 1}
                aria-label="Previous term"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant={isPlaying ? 'default' : 'outline'}
                size="icon"
                onClick={() => setIsPlaying((p) => !p)}
                disabled={visibleTerms >= maxVisible && !isPlaying}
                aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleStepForward}
                disabled={visibleTerms >= maxVisible}
                aria-label="Next term"
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              <div className="w-32">
                <Slider
                  min={1}
                  max={maxVisible || 1}
                  step={1}
                  value={[visibleTerms]}
                  onValueChange={([v]) => {
                    if (v !== undefined) {
                      setIsPlaying(false);
                      setVisibleTerms(v);
                    }
                  }}
                  aria-label="Visible terms slider"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5">
          <TaylorPlot
            terms={computedTerms}
            visibleTerms={visibleTerms}
            center={center}
            trueExprEval={trueExprEval}
            preset={selectedPreset}
            xRange={xRangeInput}
            showAllOrders={showAllOrders}
          />
        </div>
      </GlassCard>

      {/* Polynomial formula */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <ChevronRight className="h-4 w-4" />
          Taylor Polynomial T_{visibleTerms}(x)
        </h3>
        <div className="p-4 bg-muted/20 rounded-lg overflow-x-auto border border-border/40">
          <MathRenderer
            expression={buildPolynomialLatex(computedTerms, visibleTerms)}
            displayMode={true}
            className="text-base"
            ariaLabel={`Taylor polynomial with ${visibleTerms} terms`}
          />
        </div>

        {visibleTerms < numTerms && (
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Lagrange remainder: </span>
            <MathRenderer
              expression={`R_{${visibleTerms}}(x) = \\frac{f^{(${visibleTerms + 1})}(\\xi)}{${visibleTerms + 1}!}(x - ${center})^{${visibleTerms + 1}}`}
              displayMode={false}
            />
            <span className="ml-2">for some \u03be between {center} and x.</span>
          </div>
        )}
      </GlassCard>

      {/* Bottom row: terms list + error table */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="text-sm font-medium mb-1">
            Terms Added ({visibleTerms} of {maxVisible})
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Each term = f^(n)(a)/n! &middot; (x-a)^n</p>
          <TermList terms={computedTerms} visibleTerms={visibleTerms} variable="x" />
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-sm font-medium mb-1">Approximation Error</h3>
          <p className="text-xs text-muted-foreground mb-4">|f(x) - T_n(x)| at sample points</p>
          <ErrorPanel
            terms={computedTerms}
            visibleTerms={visibleTerms}
            center={center}
            trueExprEval={trueExprEval}
            xRange={xRangeInput}
          />
        </GlassCard>
      </div>

      {/* Intercepts & Critical Points analysis for the true function and the
          current Taylor polynomial. Updates automatically as visibleTerms
          changes. Only shown when at least the true function is available. */}
      {analysisFunctions.length > 0 && (
        <PlotAnalysisPanel
          functions={analysisFunctions}
          viewport={analysisViewport}
          samples={400}
        />
      )}
    </div>
  );
}
