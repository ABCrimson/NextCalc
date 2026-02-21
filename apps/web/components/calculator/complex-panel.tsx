'use client';

import { Complex } from '@nextcalc/math-engine/complex';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowLeftRight, Check, Copy, RefreshCw, Zap } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathRenderer } from '@/components/ui/math-renderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input mode for entering a complex number.
 * - rectangular: a + bi form
 * - polar: r∠θ form (θ in degrees)
 */
type InputMode = 'rectangular' | 'polar';

/**
 * Binary operation supported by the calculator.
 */
type BinaryOp = 'add' | 'subtract' | 'multiply' | 'divide' | 'power';

/**
 * Unary operation supported by the calculator.
 */
type UnaryOp =
  | 'conjugate'
  | 'modulus'
  | 'argument'
  | 'sqrt'
  | 'exp'
  | 'ln'
  | 'sin'
  | 'cos'
  | 'negate';

/**
 * A single complex number in parsed form.
 */
interface ComplexValue {
  real: number;
  imag: number;
}

/**
 * Result package holding both the Complex instance and multiple representations.
 */
interface ComplexResult {
  value: Complex;
  rectangular: string;
  polar: string;
  exponential: string;
  latex: {
    rectangular: string;
    polar: string;
    exponential: string;
  };
}

/**
 * A history entry for previous operations.
 */
interface HistoryEntry {
  id: number;
  operation: string;
  result: ComplexResult;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Precision helpers
// ---------------------------------------------------------------------------

const PRECISION = 6;

function roundToPrecision(n: number): number {
  return Number(n.toPrecision(PRECISION));
}

function fmt(n: number): string {
  const rounded = roundToPrecision(n);
  if (Math.abs(rounded) !== 0 && Math.abs(rounded) >= 1e-4 && Math.abs(rounded) < 1e7) {
    return parseFloat(rounded.toFixed(PRECISION)).toString();
  }
  return rounded.toPrecision(PRECISION).replace(/\.?0+e/, 'e');
}

function toRectangular(z: Complex): string {
  const r = fmt(z.real);
  const i = fmt(z.imag);
  if (z.isZero()) return '0';
  if (z.isReal()) return r;
  if (z.isImaginary()) {
    if (z.imag === 1) return 'i';
    if (z.imag === -1) return '-i';
    return `${i}i`;
  }
  const sign = z.imag >= 0 ? '+' : '-';
  const absImag = Math.abs(z.imag);
  const imagPart = absImag === 1 ? 'i' : `${fmt(absImag)}i`;
  return `${r} ${sign} ${imagPart}`;
}

function toPolar(z: Complex): string {
  const r = fmt(z.magnitude);
  const thetaDeg = fmt((z.argument * 180) / Math.PI);
  return `${r} \u2220 ${thetaDeg}\u00b0`;
}

function toExponential(z: Complex): string {
  const r = fmt(z.magnitude);
  const thetaRad = fmt(z.argument);
  return `${r}\u00b7e^(i\u00b7${thetaRad})`;
}

function toLatexRectangular(z: Complex): string {
  if (z.isZero()) return '0';
  const rRounded = roundToPrecision(z.real);
  const iRounded = roundToPrecision(z.imag);
  if (z.isReal()) return `${rRounded}`;
  if (z.isImaginary()) {
    if (iRounded === 1) return 'i';
    if (iRounded === -1) return '-i';
    return `${iRounded}i`;
  }
  const sign = iRounded >= 0 ? '+' : '-';
  const absImag = Math.abs(iRounded);
  const imagPart = absImag === 1 ? 'i' : `${absImag}i`;
  return `${rRounded} ${sign} ${imagPart}`;
}

function toLatexPolar(z: Complex): string {
  const r = roundToPrecision(z.magnitude);
  const thetaDeg = roundToPrecision((z.argument * 180) / Math.PI);
  return `${r} \\angle ${thetaDeg}^\\circ`;
}

function toLatexExponential(z: Complex): string {
  const r = roundToPrecision(z.magnitude);
  const thetaRad = roundToPrecision(z.argument);
  return `${r} \\cdot e^{i \\cdot ${thetaRad}}`;
}

function buildResult(z: Complex): ComplexResult {
  return {
    value: z,
    rectangular: toRectangular(z),
    polar: toPolar(z),
    exponential: toExponential(z),
    latex: {
      rectangular: toLatexRectangular(z),
      polar: toLatexPolar(z),
      exponential: toLatexExponential(z),
    },
  };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseRectangular(input: string): ComplexValue | null {
  const s = input.trim().replace(/\s/g, '');
  if (s === '') return null;

  const pureImag = s.match(/^([+-]?\d*\.?\d*)?i$/);
  if (pureImag) {
    const coeff = pureImag[1];
    if (coeff === '' || coeff === undefined || coeff === '+') return { real: 0, imag: 1 };
    if (coeff === '-') return { real: 0, imag: -1 };
    const n = parseFloat(coeff);
    if (Number.isNaN(n)) return null;
    return { real: 0, imag: n };
  }

  const pureReal = s.match(/^[+-]?\d+\.?\d*$/);
  if (pureReal) {
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    return { real: n, imag: 0 };
  }

  const match = s.match(/^([+-]?\d*\.?\d*(?:e[+-]?\d+)?)([+-]\d*\.?\d*(?:e[+-]?\d+)?)i$/);
  if (match) {
    const realStr = match[1] ?? '';
    const imagStr = match[2] ?? '';
    const real = parseFloat(realStr);
    let imag: number;
    if (imagStr === '+' || imagStr === '') imag = 1;
    else if (imagStr === '-') imag = -1;
    else imag = parseFloat(imagStr);
    if (Number.isNaN(real) || Number.isNaN(imag)) return null;
    return { real, imag };
  }

  return null;
}

function parsePolar(rStr: string, thetaStr: string): ComplexValue | null {
  const r = parseFloat(rStr.trim());
  const theta = parseFloat(thetaStr.trim());
  if (Number.isNaN(r) || Number.isNaN(theta) || r < 0) return null;
  const thetaRad = (theta * Math.PI) / 180;
  return {
    real: r * Math.cos(thetaRad),
    imag: r * Math.sin(thetaRad),
  };
}

function toComplex(cv: ComplexValue): Complex | null {
  try {
    return new Complex(cv.real, cv.imag);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OKLCH color palette for complex number points
// ---------------------------------------------------------------------------

/** Vivid OKLCH colors keyed to semantic roles */
const POINT_COLORS = {
  z1: 'oklch(0.70 0.22 264)',       // Blue — real-axis association
  z2: 'oklch(0.72 0.20 300)',       // Purple — imaginary-axis association
  result: 'oklch(0.72 0.20 155)',   // Emerald — result/magnitude association
  unaryInput: 'oklch(0.70 0.22 264)',
  unaryResult: 'oklch(0.72 0.20 155)',
} as const;

/** Glow / fill versions at reduced opacity */
const POINT_GLOW = {
  z1: 'oklch(0.70 0.22 264 / 0.35)',
  z2: 'oklch(0.72 0.20 300 / 0.35)',
  result: 'oklch(0.72 0.20 155 / 0.35)',
  unaryInput: 'oklch(0.70 0.22 264 / 0.35)',
  unaryResult: 'oklch(0.72 0.20 155 / 0.35)',
} as const;

// ---------------------------------------------------------------------------
// Argand Diagram — massively upgraded SVG visualization
// ---------------------------------------------------------------------------

interface ArgandPoint {
  z: Complex;
  label: string;
  color: string;
  glowColor: string;
}

interface ArgandDiagramProps {
  points: ArgandPoint[];
  width?: number;
  height?: number;
}

/**
 * Premium SVG Argand diagram with:
 * - OKLCH gradient fills, glow effects, animated transitions
 * - Quadrant shading, radial grid lines
 * - Per-point tooltips on hover
 * - Projection lines with gradient fade
 * - Animated entry for each point
 */
function ArgandDiagram({ points, width = 420, height = 340 }: ArgandDiagramProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const padding = { top: 36, right: 48, bottom: 36, left: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allReals = points.map((p) => p.z.real);
  const allImags = points.map((p) => p.z.imag);
  const rawMax = Math.max(1, ...allReals.map(Math.abs), ...allImags.map(Math.abs));
  // Round up to a nice tick value so the grid looks clean
  const tickStep = rawMax <= 1 ? 1 : rawMax <= 3 ? 1 : rawMax <= 6 ? 2 : rawMax <= 12 ? 3 : 5;
  const maxAbs = Math.ceil(rawMax / tickStep) * tickStep;

  const scaleX = innerW / 2 / (maxAbs * 1.15);
  const scaleY = innerH / 2 / (maxAbs * 1.15);
  const scale = Math.min(scaleX, scaleY);

  const cx = padding.left + innerW / 2;
  const cy = padding.top + innerH / 2;

  const toSvgX = (re: number) => cx + re * scale;
  const toSvgY = (im: number) => cy - im * scale;

  // Ticks: from -maxAbs to +maxAbs in steps
  const tickCount = Math.round(maxAbs / tickStep);
  const ticks: number[] = [];
  for (let t = -tickCount; t <= tickCount; t++) {
    ticks.push(t * tickStep);
  }

  // Radius for radial (unit circle or maxAbs circle) in SVG pixels
  const unitR = 1 * scale;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto select-none overflow-visible"
      role="img"
      aria-label="Argand diagram showing complex numbers on the complex plane"
      style={{ fontFamily: 'var(--font-mono, monospace)' }}
    >
      <defs>
        {/* Background for the plot area */}
        <radialGradient id="argand-bg" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="oklch(0.22 0.025 264)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.14 0.015 250)" stopOpacity="0.0" />
        </radialGradient>

        {/* Quadrant gradient fills */}
        <radialGradient id="quad-fill" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="oklch(0.65 0.22 264)" stopOpacity="0.04" />
          <stop offset="100%" stopColor="oklch(0.65 0.22 264)" stopOpacity="0" />
        </radialGradient>

        {/* Per-point glow gradients */}
        {points.map((p) => (
          <radialGradient
            key={`glow-${p.label}`}
            id={`glow-${p.label}`}
            cx="50%" cy="50%" r="50%"
          >
            <stop offset="0%" stopColor={p.color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0" />
          </radialGradient>
        ))}

        {/* Arrow marker defs — one per point color */}
        {points.map((p) => (
          <marker
            key={`arrow-${p.label}`}
            id={`arrow-${p.label}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={p.color} fillOpacity="0.9" />
          </marker>
        ))}

        {/* Clip the plot region */}
        <clipPath id="plot-clip">
          <rect
            x={padding.left}
            y={padding.top}
            width={innerW}
            height={innerH}
            rx="6"
          />
        </clipPath>
      </defs>

      {/* Plot area background */}
      <rect
        x={padding.left}
        y={padding.top}
        width={innerW}
        height={innerH}
        rx="6"
        fill="url(#argand-bg)"
        stroke="oklch(0.65 0.22 264 / 0.15)"
        strokeWidth="1"
      />

      {/* Radial background glow at origin */}
      <circle
        cx={cx}
        cy={cy}
        r={Math.min(innerW, innerH) * 0.45}
        fill="url(#quad-fill)"
      />

      {/* Unit circle — subtle guide */}
      {unitR > 8 && (
        <circle
          cx={cx}
          cy={cy}
          r={unitR}
          fill="none"
          stroke="oklch(0.65 0.22 264 / 0.12)"
          strokeWidth="1"
          strokeDasharray="4 4"
          clipPath="url(#plot-clip)"
        />
      )}

      {/* Grid lines — major */}
      {ticks.map((t) => (
        <g key={`grid-${t}`} clipPath="url(#plot-clip)">
          {/* Vertical */}
          <line
            x1={toSvgX(t)}
            y1={padding.top}
            x2={toSvgX(t)}
            y2={padding.top + innerH}
            stroke={t === 0 ? 'oklch(0.75 0.10 264 / 0.55)' : 'oklch(0.65 0.05 264 / 0.20)'}
            strokeWidth={t === 0 ? 1.5 : 1}
          />
          {/* Horizontal */}
          <line
            x1={padding.left}
            y1={toSvgY(t)}
            x2={padding.left + innerW}
            y2={toSvgY(t)}
            stroke={t === 0 ? 'oklch(0.75 0.10 264 / 0.55)' : 'oklch(0.65 0.05 264 / 0.20)'}
            strokeWidth={t === 0 ? 1.5 : 1}
          />
        </g>
      ))}

      {/* Sub-grid (half-steps when tickStep > 1) */}
      {tickStep > 1 &&
        Array.from({ length: tickCount * 2 }, (_, i) => i - tickCount + 0.5).map((t) => (
          <g key={`subgrid-${t}`} clipPath="url(#plot-clip)">
            <line
              x1={toSvgX(t * tickStep)}
              y1={padding.top}
              x2={toSvgX(t * tickStep)}
              y2={padding.top + innerH}
              stroke="oklch(0.65 0.05 264 / 0.08)"
              strokeWidth="0.5"
            />
            <line
              x1={padding.left}
              y1={toSvgY(t * tickStep)}
              x2={padding.left + innerW}
              y2={toSvgY(t * tickStep)}
              stroke="oklch(0.65 0.05 264 / 0.08)"
              strokeWidth="0.5"
            />
          </g>
        ))}

      {/* Axis arrow heads */}
      <polygon
        points={`${padding.left + innerW + 7},${cy} ${padding.left + innerW},${cy - 5} ${padding.left + innerW},${cy + 5}`}
        fill="oklch(0.75 0.10 264 / 0.7)"
      />
      <polygon
        points={`${cx},${padding.top - 7} ${cx - 5},${padding.top} ${cx + 5},${padding.top}`}
        fill="oklch(0.75 0.10 264 / 0.7)"
      />

      {/* Axis labels */}
      <text
        x={padding.left + innerW + 10}
        y={cy + 4}
        fontSize="11"
        fill="oklch(0.80 0.15 264)"
        fontWeight="600"
      >
        Re
      </text>
      <text
        x={cx + 6}
        y={padding.top - 10}
        fontSize="11"
        fill="oklch(0.80 0.15 264)"
        fontWeight="600"
      >
        Im
      </text>

      {/* Tick labels — real axis */}
      {ticks
        .filter((t) => t !== 0 && Math.abs(toSvgX(t) - cx) > 10)
        .map((t) => (
          <text
            key={`re-${t}`}
            x={toSvgX(t)}
            y={cy + 16}
            textAnchor="middle"
            fontSize="9"
            fill="oklch(0.65 0.08 264)"
          >
            {t}
          </text>
        ))}

      {/* Tick marks — real axis */}
      {ticks
        .filter((t) => t !== 0)
        .map((t) => (
          <line
            key={`re-tick-${t}`}
            x1={toSvgX(t)}
            y1={cy - 3}
            x2={toSvgX(t)}
            y2={cy + 3}
            stroke="oklch(0.65 0.08 264 / 0.5)"
            strokeWidth="1"
          />
        ))}

      {/* Tick labels — imaginary axis */}
      {ticks
        .filter((t) => t !== 0 && Math.abs(toSvgY(t) - cy) > 10)
        .map((t) => (
          <text
            key={`im-${t}`}
            x={cx - 6}
            y={toSvgY(t) + 3.5}
            textAnchor="end"
            fontSize="9"
            fill="oklch(0.65 0.08 264)"
          >
            {t}i
          </text>
        ))}

      {/* Tick marks — imaginary axis */}
      {ticks
        .filter((t) => t !== 0)
        .map((t) => (
          <line
            key={`im-tick-${t}`}
            x1={cx - 3}
            y1={toSvgY(t)}
            x2={cx + 3}
            y2={toSvgY(t)}
            stroke="oklch(0.65 0.08 264 / 0.5)"
            strokeWidth="1"
          />
        ))}

      {/* Origin dot */}
      <circle cx={cx} cy={cy} r="3" fill="oklch(0.80 0.10 264)" fillOpacity="0.6" />
      <text x={cx + 5} y={cy + 13} fontSize="8" fill="oklch(0.60 0.06 264)">
        O
      </text>

      {/* Complex number vectors + points */}
      {points.map((p) => {
        const px = toSvgX(p.z.real);
        const py = toSvgY(p.z.imag);
        const dx = px - cx;
        const dy = py - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const isHovered = hoveredPoint === p.label;

        // Shorten line a bit so arrowhead tip is at the point
        const arrowShorten = 10;
        const lineEndX = len > arrowShorten ? px - (dx / len) * arrowShorten : px;
        const lineEndY = len > arrowShorten ? py - (dy / len) * arrowShorten : py;

        return (
          <g key={p.label}>
            {/* Glow bloom behind point */}
            {isHovered && (
              <circle
                cx={px}
                cy={py}
                r={20}
                fill={`url(#glow-${p.label})`}
              />
            )}

            {/* Projection lines with gradient fade */}
            <line
              x1={px}
              y1={cy}
              x2={px}
              y2={py}
              stroke={p.color}
              strokeWidth={isHovered ? 1.5 : 1}
              strokeOpacity={isHovered ? 0.55 : 0.30}
              strokeDasharray="4 4"
            />
            <line
              x1={cx}
              y1={py}
              x2={px}
              y2={py}
              stroke={p.color}
              strokeWidth={isHovered ? 1.5 : 1}
              strokeOpacity={isHovered ? 0.55 : 0.30}
              strokeDasharray="4 4"
            />

            {/* Projection endpoint dots on axes */}
            {len > 2 && (
              <>
                <circle
                  cx={px}
                  cy={cy}
                  r="2.5"
                  fill={p.color}
                  fillOpacity="0.5"
                />
                <circle
                  cx={cx}
                  cy={py}
                  r="2.5"
                  fill={p.color}
                  fillOpacity="0.5"
                />
              </>
            )}

            {/* Vector line with arrow marker */}
            {len > 4 && (
              <line
                x1={cx}
                y1={cy}
                x2={lineEndX}
                y2={lineEndY}
                stroke={p.color}
                strokeWidth={isHovered ? 2.5 : 2}
                strokeOpacity="0.90"
                markerEnd={`url(#arrow-${p.label})`}
                style={{ transition: 'stroke-width 0.15s ease' }}
              />
            )}

            {/* Point dot with inner glow ring */}
            <circle
              cx={px}
              cy={py}
              r={isHovered ? 8 : 6}
              fill={p.glowColor}
              style={{ transition: 'r 0.15s ease' }}
            />
            <circle
              cx={px}
              cy={py}
              r={isHovered ? 5 : 4.5}
              fill={p.color}
              stroke="oklch(0.14 0.015 250)"
              strokeWidth="1.5"
              style={{ transition: 'r 0.15s ease' }}
              onMouseEnter={() => setHoveredPoint(p.label)}
              onMouseLeave={() => setHoveredPoint(null)}
              className="cursor-pointer"
            />

            {/* Label */}
            <text
              x={px + 9}
              y={py - 8}
              fontSize="11"
              fill={p.color}
              fontWeight="700"
              style={{ textShadow: `0 0 6px ${p.color}` }}
            >
              {p.label}
            </text>

            {/* Hover tooltip */}
            {isHovered && (
              <g>
                <rect
                  x={px + 12}
                  y={py + 4}
                  width={100}
                  height={30}
                  rx="5"
                  fill="oklch(0.16 0.025 250)"
                  stroke={p.color}
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
                <text x={px + 18} y={py + 17} fontSize="9" fill={p.color} fontWeight="600">
                  Re: {fmt(p.z.real)}
                </text>
                <text x={px + 18} y={py + 29} fontSize="9" fill={p.color} fontWeight="600">
                  Im: {fmt(p.z.imag)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ResultDisplay component — enhanced with OKLCH colors
// ---------------------------------------------------------------------------

interface ResultDisplayProps {
  result: ComplexResult;
}

function ResultDisplay({ result }: ResultDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard write not available in all contexts
    }
  }, []);

  const rows: Array<{
    label: string;
    text: string;
    latex: string;
    key: string;
    accent: string;
    hue: string;
  }> = [
    {
      label: 'Rectangular',
      text: result.rectangular,
      latex: result.latex.rectangular,
      key: 'rect',
      accent: '264',
      hue: 'blue',
    },
    {
      label: 'Polar',
      text: result.polar,
      latex: result.latex.polar,
      key: 'polar',
      accent: '300',
      hue: 'purple',
    },
    {
      label: 'Exponential',
      text: result.exponential,
      latex: result.latex.exponential,
      key: 'exp',
      accent: '155',
      hue: 'emerald',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-3"
    >
      {rows.map((row, idx) => (
        <motion.div
          key={row.key}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.06, duration: 0.3 }}
          className="group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200"
          style={{
            background: `linear-gradient(135deg, oklch(0.18 0.025 ${row.accent} / 0.3), oklch(0.14 0.015 250 / 0.5))`,
            borderColor: `oklch(0.60 0.18 ${row.accent} / 0.25)`,
          }}
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-semibold mb-1 uppercase tracking-wide"
              style={{ color: `oklch(0.72 0.15 ${row.accent})` }}
            >
              {row.label}
            </p>
            <div className="text-sm font-mono overflow-x-auto">
              <MathRenderer expression={row.latex} displayMode={false} />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 transition-all duration-150"
            style={copied === row.key
              ? { color: 'oklch(0.72 0.20 155)', background: 'oklch(0.65 0.18 155 / 0.12)' }
              : undefined}
            onClick={() => handleCopy(row.text, row.key)}
            aria-label={`Copy ${row.label} form`}
          >
            {copied === row.key ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </motion.div>
      ))}

      {/* Modulus and Argument chips */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.3 }}
        className="grid grid-cols-2 gap-3 pt-1"
      >
        <div
          className="p-3 rounded-xl border"
          style={{
            background: 'linear-gradient(135deg, oklch(0.18 0.025 155 / 0.3), oklch(0.14 0.015 250 / 0.4))',
            borderColor: 'oklch(0.65 0.18 155 / 0.3)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'oklch(0.72 0.15 155)' }}>
            Modulus |z|
          </p>
          <p
            className="text-base font-mono font-bold"
            style={{ color: 'oklch(0.85 0.15 155)' }}
          >
            {fmt(result.value.magnitude)}
          </p>
        </div>
        <div
          className="p-3 rounded-xl border"
          style={{
            background: 'linear-gradient(135deg, oklch(0.18 0.025 30 / 0.3), oklch(0.14 0.015 250 / 0.4))',
            borderColor: 'oklch(0.65 0.18 30 / 0.3)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'oklch(0.72 0.15 30)' }}>
            Argument arg(z)
          </p>
          <p
            className="text-base font-mono font-bold"
            style={{ color: 'oklch(0.85 0.15 30)' }}
          >
            {fmt((result.value.argument * 180) / Math.PI)}&deg;
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ArgandDiagramCard — wraps the diagram with premium styling
// ---------------------------------------------------------------------------

interface ArgandDiagramCardProps {
  points: ArgandPoint[];
}

function ArgandDiagramCard({ points }: ArgandDiagramCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="relative rounded-2xl border overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, oklch(0.16 0.03 264 / 0.6), oklch(0.14 0.02 250 / 0.7))',
        borderColor: 'oklch(0.65 0.22 264 / 0.2)',
        boxShadow: '0 0 30px oklch(0.55 0.27 264 / 0.12), inset 0 1px 0 oklch(0.80 0.10 264 / 0.08)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'oklch(0.65 0.22 264 / 0.15)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: 'oklch(0.65 0.22 264)', boxShadow: '0 0 6px oklch(0.65 0.22 264 / 0.8)' }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: 'oklch(0.82 0.15 264)' }}
          >
            Argand Diagram
          </h3>
        </div>
        <span className="text-xs" style={{ color: 'oklch(0.55 0.06 264)' }}>
          Complex Plane
        </span>
      </div>

      {/* SVG plot */}
      <div className="relative p-2">
        <ArgandDiagram points={points} width={420} height={320} />
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap justify-center gap-4 px-4 py-3 border-t"
        style={{ borderColor: 'oklch(0.65 0.22 264 / 0.12)' }}
      >
        {points.map((p) => (
          <span
            key={p.label}
            className="flex items-center gap-1.5 text-xs font-mono"
            style={{ color: 'oklch(0.70 0.06 264)' }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: p.color, boxShadow: `0 0 5px ${p.glowColor}` }}
              aria-hidden="true"
            />
            <span style={{ color: p.color, fontWeight: 700 }}>{p.label}:</span>
            {toRectangular(p.z)}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ComplexInput component — unchanged logic, improved visual treatment
// ---------------------------------------------------------------------------

interface ComplexInputProps {
  label: string;
  id: string;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  rectValue: string;
  onRectChange: (v: string) => void;
  polarR: string;
  onPolarRChange: (v: string) => void;
  polarTheta: string;
  onPolarThetaChange: (v: string) => void;
  parsed: Complex | null;
  error: string | null;
  /** OKLCH hue for accent coloring (0-360) */
  accentHue?: string;
}

function ComplexInput({
  label,
  id,
  mode,
  onModeChange,
  rectValue,
  onRectChange,
  polarR,
  onPolarRChange,
  polarTheta,
  onPolarThetaChange,
  parsed,
  error,
  accentHue = '264',
}: ComplexInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="text-sm font-bold"
          style={{ color: `oklch(0.82 0.18 ${accentHue})` }}
        >
          {label}
        </Label>
        <div className="flex items-center gap-0.5 text-xs rounded-lg overflow-hidden border"
          style={{ borderColor: `oklch(0.60 0.18 ${accentHue} / 0.25)` }}>
          {(['rectangular', 'polar'] as InputMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className="px-2.5 py-1 transition-all duration-150"
              style={
                mode === m
                  ? {
                      background: `oklch(0.60 0.18 ${accentHue} / 0.20)`,
                      color: `oklch(0.82 0.18 ${accentHue})`,
                      fontWeight: 700,
                    }
                  : {
                      color: 'oklch(0.55 0.02 250)',
                    }
              }
              aria-pressed={mode === m}
            >
              {m === 'rectangular' ? 'a+bi' : 'r\u2220\u03b8'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'rectangular' ? (
        <div>
          <Input
            id={id}
            value={rectValue}
            onChange={(e) => onRectChange(e.target.value)}
            placeholder="e.g. 3+4i or -2-i"
            className={cn(
              'font-mono',
              error && 'border-destructive focus-visible:outline-destructive',
            )}
            style={
              !error && parsed
                ? { borderColor: `oklch(0.60 0.18 ${accentHue} / 0.4)` }
                : undefined
            }
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            aria-invalid={!!error}
          />
          <p id={`${id}-hint`} className="text-xs text-muted-foreground mt-1">
            Format: a+bi, a-bi, 3i, -2.5+1.5i
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Input
            id={`${id}-r`}
            value={polarR}
            onChange={(e) => onPolarRChange(e.target.value)}
            placeholder="r (magnitude)"
            className="font-mono"
            aria-label={`${label} magnitude`}
            type="number"
            min="0"
            step="any"
          />
          <Input
            id={`${id}-theta`}
            value={polarTheta}
            onChange={(e) => onPolarThetaChange(e.target.value)}
            placeholder="θ in degrees"
            className="font-mono"
            aria-label={`${label} angle in degrees`}
            type="number"
            step="any"
          />
          <p className="col-span-2 text-xs text-muted-foreground -mt-1">
            r ∠ θ° (magnitude and angle in degrees)
          </p>
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {parsed && !error && (
        <p className="text-xs font-mono" style={{ color: `oklch(0.68 0.12 ${accentHue})` }}>
          = {toRectangular(parsed)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick examples
// ---------------------------------------------------------------------------

interface QuickExample {
  label: string;
  description: string;
  z1: string;
  z2: string;
  op: BinaryOp;
}

const QUICK_EXAMPLES: QuickExample[] = [
  { label: 'Multiply', description: '(3+4i)(1-2i)', z1: '3+4i', z2: '1-2i', op: 'multiply' },
  { label: 'Divide', description: '(1+i)/(1-i)', z1: '1+i', z2: '1-i', op: 'divide' },
  { label: 'Add', description: '(2+3i)+(4-i)', z1: '2+3i', z2: '4-i', op: 'add' },
  { label: 'Power', description: 'i^4', z1: 'i', z2: '4', op: 'power' },
];

const UNARY_EXAMPLES: Array<{ label: string; z: string; op: UnaryOp }> = [
  { label: 'Conjugate of 3+4i', z: '3+4i', op: 'conjugate' },
  { label: '|3+4i| = 5', z: '3+4i', op: 'modulus' },
  { label: 'sqrt(-1) = i', z: '-1', op: 'sqrt' },
  { label: 'e^(i\u03c0) = -1', z: '0+3.14159i', op: 'exp' },
];

// ---------------------------------------------------------------------------
// Operation label maps
// ---------------------------------------------------------------------------

const BINARY_OP_LABELS: Record<BinaryOp, string> = {
  add: '+',
  subtract: '\u2212',
  multiply: '\u00d7',
  divide: '\u00f7',
  power: '^',
};

const UNARY_OP_LABELS: Record<UnaryOp, string> = {
  conjugate: 'Conjugate z\u0305',
  modulus: 'Modulus |z|',
  argument: 'Argument arg(z)',
  sqrt: 'Square Root \u221az',
  exp: 'Exponential e^z',
  ln: 'Natural Log ln(z)',
  sin: 'Sine sin(z)',
  cos: 'Cosine cos(z)',
  negate: 'Negate \u2212z',
};

// ---------------------------------------------------------------------------
// Main ComplexPanel
// ---------------------------------------------------------------------------

/**
 * Complex Number Calculator Panel
 *
 * Provides:
 * - Binary operations on two complex numbers (add, subtract, multiply, divide, power)
 * - Unary operations on one complex number
 * - Premium Argand diagram with OKLCH colors, glow, and hover tooltips
 * - Results in rectangular, polar, and exponential forms with KaTeX
 * - Operation history
 */
export function ComplexPanel() {
  // -------------------------------------------------------------------------
  // Binary operation state
  // -------------------------------------------------------------------------
  const [z1Mode, setZ1Mode] = useState<InputMode>('rectangular');
  const [z1Rect, setZ1Rect] = useState('3+4i');
  const [z1PolarR, setZ1PolarR] = useState('5');
  const [z1PolarTheta, setZ1PolarTheta] = useState('53.13');

  const [z2Mode, setZ2Mode] = useState<InputMode>('rectangular');
  const [z2Rect, setZ2Rect] = useState('1-2i');
  const [z2PolarR, setZ2PolarR] = useState('2.236');
  const [z2PolarTheta, setZ2PolarTheta] = useState('-63.43');

  const [binaryOp, setBinaryOp] = useState<BinaryOp>('multiply');
  const [binaryResult, setBinaryResult] = useState<ComplexResult | null>(null);
  const [binaryError, setBinaryError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Unary operation state
  // -------------------------------------------------------------------------
  const [uzRect, setUzRect] = useState('3+4i');
  const [uzMode, setUzMode] = useState<InputMode>('rectangular');
  const [uzPolarR, setUzPolarR] = useState('5');
  const [uzPolarTheta, setUzPolarTheta] = useState('53.13');
  const [unaryOp, setUnaryOp] = useState<UnaryOp>('conjugate');
  const [unaryResult, setUnaryResult] = useState<ComplexResult | null>(null);
  const [unaryError, setUnaryError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyId = useRef(0);

  // -------------------------------------------------------------------------
  // Parse helpers
  // -------------------------------------------------------------------------

  const parseZ1 = useCallback((): Complex | null => {
    if (z1Mode === 'rectangular') {
      const cv = parseRectangular(z1Rect);
      return cv ? toComplex(cv) : null;
    }
    const cv = parsePolar(z1PolarR, z1PolarTheta);
    return cv ? toComplex(cv) : null;
  }, [z1Mode, z1Rect, z1PolarR, z1PolarTheta]);

  const parseZ2 = useCallback((): Complex | null => {
    if (z2Mode === 'rectangular') {
      const cv = parseRectangular(z2Rect);
      return cv ? toComplex(cv) : null;
    }
    const cv = parsePolar(z2PolarR, z2PolarTheta);
    return cv ? toComplex(cv) : null;
  }, [z2Mode, z2Rect, z2PolarR, z2PolarTheta]);

  const parseUZ = useCallback((): Complex | null => {
    if (uzMode === 'rectangular') {
      const cv = parseRectangular(uzRect);
      return cv ? toComplex(cv) : null;
    }
    const cv = parsePolar(uzPolarR, uzPolarTheta);
    return cv ? toComplex(cv) : null;
  }, [uzMode, uzRect, uzPolarR, uzPolarTheta]);

  const parsedZ1 = useMemo(() => parseZ1(), [parseZ1]);
  const parsedZ2 = useMemo(() => parseZ2(), [parseZ2]);
  const parsedUZ = useMemo(() => parseUZ(), [parseUZ]);

  const z1Error = useMemo(() => {
    if (z1Mode === 'rectangular' && z1Rect.trim() !== '' && !parsedZ1)
      return 'Invalid complex number';
    if (z1Mode === 'polar' && (z1PolarR.trim() !== '' || z1PolarTheta.trim() !== '') && !parsedZ1)
      return 'Invalid polar form';
    return null;
  }, [z1Mode, z1Rect, z1PolarR, z1PolarTheta, parsedZ1]);

  const z2Error = useMemo(() => {
    if (z2Mode === 'rectangular' && z2Rect.trim() !== '' && !parsedZ2)
      return 'Invalid complex number';
    if (z2Mode === 'polar' && (z2PolarR.trim() !== '' || z2PolarTheta.trim() !== '') && !parsedZ2)
      return 'Invalid polar form';
    return null;
  }, [z2Mode, z2Rect, z2PolarR, z2PolarTheta, parsedZ2]);

  const uzError = useMemo(() => {
    if (uzMode === 'rectangular' && uzRect.trim() !== '' && !parsedUZ)
      return 'Invalid complex number';
    if (uzMode === 'polar' && (uzPolarR.trim() !== '' || uzPolarTheta.trim() !== '') && !parsedUZ)
      return 'Invalid polar form';
    return null;
  }, [uzMode, uzRect, uzPolarR, uzPolarTheta, parsedUZ]);

  // -------------------------------------------------------------------------
  // Mode sync
  // -------------------------------------------------------------------------

  const handleZ1ModeChange = useCallback(
    (newMode: InputMode) => {
      if (parsedZ1) {
        if (newMode === 'polar') {
          setZ1PolarR(fmt(parsedZ1.magnitude));
          setZ1PolarTheta(fmt((parsedZ1.argument * 180) / Math.PI));
        } else {
          setZ1Rect(toRectangular(parsedZ1));
        }
      }
      setZ1Mode(newMode);
    },
    [parsedZ1],
  );

  const handleZ2ModeChange = useCallback(
    (newMode: InputMode) => {
      if (parsedZ2) {
        if (newMode === 'polar') {
          setZ2PolarR(fmt(parsedZ2.magnitude));
          setZ2PolarTheta(fmt((parsedZ2.argument * 180) / Math.PI));
        } else {
          setZ2Rect(toRectangular(parsedZ2));
        }
      }
      setZ2Mode(newMode);
    },
    [parsedZ2],
  );

  const handleUZModeChange = useCallback(
    (newMode: InputMode) => {
      if (parsedUZ) {
        if (newMode === 'polar') {
          setUzPolarR(fmt(parsedUZ.magnitude));
          setUzPolarTheta(fmt((parsedUZ.argument * 180) / Math.PI));
        } else {
          setUzRect(toRectangular(parsedUZ));
        }
      }
      setUzMode(newMode);
    },
    [parsedUZ],
  );

  // -------------------------------------------------------------------------
  // Binary calculation
  // -------------------------------------------------------------------------

  const handleBinaryCalculate = useCallback(() => {
    setBinaryError(null);
    setBinaryResult(null);

    const z1 = parseZ1();
    const z2 = parseZ2();

    if (!z1) { setBinaryError('Invalid value for z\u2081'); return; }
    if (!z2) { setBinaryError('Invalid value for z\u2082'); return; }

    try {
      let resultZ: Complex;
      switch (binaryOp) {
        case 'add': resultZ = z1.add(z2); break;
        case 'subtract': resultZ = z1.subtract(z2); break;
        case 'multiply': resultZ = z1.multiply(z2); break;
        case 'divide': resultZ = z1.divide(z2); break;
        case 'power': {
          if (z2.isReal() && Number.isInteger(z2.real)) {
            resultZ = z1.pow(z2.real);
          } else {
            const lnZ1 = z1.ln();
            const exponent = z2.multiply(lnZ1);
            resultZ = exponent.exp();
          }
          break;
        }
      }

      const res = buildResult(resultZ);
      setBinaryResult(res);

      const opSymbol = BINARY_OP_LABELS[binaryOp];
      const entry: HistoryEntry = {
        id: ++historyId.current,
        operation: `(${toRectangular(z1)}) ${opSymbol} (${toRectangular(z2)})`,
        result: res,
        timestamp: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));
    } catch (err) {
      setBinaryError(err instanceof Error ? err.message : 'Calculation error');
    }
  }, [parseZ1, parseZ2, binaryOp]);

  // -------------------------------------------------------------------------
  // Unary calculation
  // -------------------------------------------------------------------------

  const handleUnaryCalculate = useCallback(() => {
    setUnaryError(null);
    setUnaryResult(null);

    const z = parseUZ();
    if (!z) { setUnaryError('Invalid complex number'); return; }

    try {
      let resultZ: Complex;
      switch (unaryOp) {
        case 'conjugate': resultZ = z.conjugate; break;
        case 'modulus': resultZ = new Complex(z.magnitude, 0); break;
        case 'argument': resultZ = new Complex(z.argument, 0); break;
        case 'sqrt': resultZ = z.sqrt(); break;
        case 'exp': resultZ = z.exp(); break;
        case 'ln': resultZ = z.ln(); break;
        case 'sin': resultZ = z.sin(); break;
        case 'cos': resultZ = z.cos(); break;
        case 'negate': resultZ = z.negate(); break;
      }

      const res = buildResult(resultZ);
      setUnaryResult(res);

      const entry: HistoryEntry = {
        id: ++historyId.current,
        operation: `${UNARY_OP_LABELS[unaryOp]}(${toRectangular(z)})`,
        result: res,
        timestamp: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));
    } catch (err) {
      setUnaryError(err instanceof Error ? err.message : 'Calculation error');
    }
  }, [parseUZ, unaryOp]);

  // -------------------------------------------------------------------------
  // Argand diagram data — with typed OKLCH colors
  // -------------------------------------------------------------------------

  const argandPoints = useMemo((): ArgandPoint[] => {
    const pts: ArgandPoint[] = [];
    if (parsedZ1)
      pts.push({ z: parsedZ1, label: 'z\u2081', color: POINT_COLORS.z1, glowColor: POINT_GLOW.z1 });
    if (parsedZ2)
      pts.push({ z: parsedZ2, label: 'z\u2082', color: POINT_COLORS.z2, glowColor: POINT_GLOW.z2 });
    if (binaryResult)
      pts.push({ z: binaryResult.value, label: 'Result', color: POINT_COLORS.result, glowColor: POINT_GLOW.result });
    return pts;
  }, [parsedZ1, parsedZ2, binaryResult]);

  const unaryArgandPoints = useMemo((): ArgandPoint[] => {
    const pts: ArgandPoint[] = [];
    if (parsedUZ)
      pts.push({ z: parsedUZ, label: 'z', color: POINT_COLORS.unaryInput, glowColor: POINT_GLOW.unaryInput });
    if (unaryResult)
      pts.push({ z: unaryResult.value, label: 'Result', color: POINT_COLORS.unaryResult, glowColor: POINT_GLOW.unaryResult });
    return pts;
  }, [parsedUZ, unaryResult]);

  // -------------------------------------------------------------------------
  // Load quick examples
  // -------------------------------------------------------------------------

  const loadBinaryExample = useCallback((ex: QuickExample) => {
    setZ1Mode('rectangular');
    setZ1Rect(ex.z1);
    setZ2Mode('rectangular');
    setZ2Rect(ex.z2);
    setBinaryOp(ex.op);
    setBinaryResult(null);
    setBinaryError(null);
  }, []);

  const loadUnaryExample = useCallback((ex: { z: string; op: UnaryOp }) => {
    setUzMode('rectangular');
    setUzRect(ex.z);
    setUnaryOp(ex.op);
    setUnaryResult(null);
    setUnaryError(null);
  }, []);

  const swapOperands = useCallback(() => {
    const tmpMode = z1Mode;
    const tmpRect = z1Rect;
    const tmpR = z1PolarR;
    const tmpTheta = z1PolarTheta;

    setZ1Mode(z2Mode);
    setZ1Rect(z2Rect);
    setZ1PolarR(z2PolarR);
    setZ1PolarTheta(z2PolarTheta);

    setZ2Mode(tmpMode);
    setZ2Rect(tmpRect);
    setZ2PolarR(tmpR);
    setZ2PolarTheta(tmpTheta);

    setBinaryResult(null);
    setBinaryError(null);
  }, [z1Mode, z1Rect, z1PolarR, z1PolarTheta, z2Mode, z2Rect, z2PolarR, z2PolarTheta]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full rounded-2xl border overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, oklch(0.18 0.025 264 / 0.55), oklch(0.15 0.018 250 / 0.70))',
        borderColor: 'oklch(0.65 0.22 264 / 0.20)',
        boxShadow:
          '0 0 40px oklch(0.55 0.27 264 / 0.10), 0 1px 0 oklch(0.80 0.10 264 / 0.06) inset',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: 'oklch(0.65 0.22 264 / 0.15)' }}
      >
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.25), oklch(0.58 0.22 300 / 0.25))',
            border: '1px solid oklch(0.65 0.22 264 / 0.30)',
          }}
        >
          <span
            className="text-2xl font-mono leading-none"
            style={{ color: 'oklch(0.82 0.18 264)' }}
            aria-hidden="true"
          >
            &#x2102;
          </span>
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'oklch(0.90 0.10 264)' }}>
            Complex Number Calculator
          </h2>
          <p className="text-xs text-muted-foreground">
            Perform arithmetic and functions on complex numbers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-5">
        <Tabs defaultValue="binary">
          <TabsList
            className="grid w-full grid-cols-3 mb-6 p-1 rounded-xl"
            style={{
              background: 'oklch(0.12 0.02 250 / 0.6)',
              border: '1px solid oklch(0.65 0.22 264 / 0.15)',
            }}
          >
            {(['binary', 'unary', 'history'] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-lg text-sm transition-all duration-200 data-[state=active]:shadow-sm"
                style={{}}
              >
                {tab === 'binary'
                  ? 'Binary Operations'
                  : tab === 'unary'
                  ? 'Unary Functions'
                  : 'History'}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ---------------------------------------------------------------- */}
          {/* Binary Tab                                                        */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="binary" className="space-y-6">
            {/* Quick examples row */}
            <div className="flex flex-wrap gap-2">
              {QUICK_EXAMPLES.map((ex) => (
                <button
                  key={ex.description}
                  type="button"
                  onClick={() => loadBinaryExample(ex)}
                  className="px-3 py-1 rounded-lg text-xs font-mono border transition-all duration-150 hover:scale-105"
                  style={{
                    background: 'oklch(0.65 0.22 264 / 0.08)',
                    borderColor: 'oklch(0.65 0.22 264 / 0.25)',
                    color: 'oklch(0.78 0.15 264)',
                  }}
                >
                  {ex.description}
                </button>
              ))}
            </div>

            {/* Inputs grid */}
            <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.16 0.03 264 / 0.4), oklch(0.14 0.02 250 / 0.3))',
                  borderColor: 'oklch(0.65 0.22 264 / 0.20)',
                }}
              >
                <ComplexInput
                  label="z₁"
                  id="z1"
                  mode={z1Mode}
                  onModeChange={handleZ1ModeChange}
                  rectValue={z1Rect}
                  onRectChange={(v) => { setZ1Rect(v); setBinaryResult(null); }}
                  polarR={z1PolarR}
                  onPolarRChange={(v) => { setZ1PolarR(v); setBinaryResult(null); }}
                  polarTheta={z1PolarTheta}
                  onPolarThetaChange={(v) => { setZ1PolarTheta(v); setBinaryResult(null); }}
                  parsed={parsedZ1}
                  error={z1Error}
                  accentHue="264"
                />
              </div>

              {/* Operation selector */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex flex-col gap-1.5">
                  {(['add', 'subtract', 'multiply', 'divide', 'power'] as BinaryOp[]).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => { setBinaryOp(op); setBinaryResult(null); }}
                      className="w-10 h-10 rounded-lg text-lg font-bold transition-all duration-150 border"
                      style={
                        binaryOp === op
                          ? {
                              background: 'linear-gradient(135deg, oklch(0.55 0.27 264 / 0.25), oklch(0.58 0.22 300 / 0.20))',
                              borderColor: 'oklch(0.65 0.22 264 / 0.60)',
                              color: 'oklch(0.85 0.18 264)',
                              boxShadow: '0 0 12px oklch(0.65 0.22 264 / 0.3)',
                            }
                          : {
                              background: 'oklch(0.18 0.02 250 / 0.4)',
                              borderColor: 'oklch(0.40 0.02 250 / 0.4)',
                              color: 'oklch(0.55 0.02 250)',
                            }
                      }
                      aria-label={op}
                      aria-pressed={binaryOp === op}
                    >
                      {BINARY_OP_LABELS[op]}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mt-1 text-muted-foreground hover:text-foreground"
                  onClick={swapOperands}
                  aria-label="Swap z1 and z2"
                  title="Swap operands"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>

              <div
                className="p-4 rounded-xl border"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.16 0.03 300 / 0.4), oklch(0.14 0.02 250 / 0.3))',
                  borderColor: 'oklch(0.63 0.20 300 / 0.20)',
                }}
              >
                <ComplexInput
                  label="z₂"
                  id="z2"
                  mode={z2Mode}
                  onModeChange={handleZ2ModeChange}
                  rectValue={z2Rect}
                  onRectChange={(v) => { setZ2Rect(v); setBinaryResult(null); }}
                  polarR={z2PolarR}
                  onPolarRChange={(v) => { setZ2PolarR(v); setBinaryResult(null); }}
                  polarTheta={z2PolarTheta}
                  onPolarThetaChange={(v) => { setZ2PolarTheta(v); setBinaryResult(null); }}
                  parsed={parsedZ2}
                  error={z2Error}
                  accentHue="300"
                />
              </div>
            </div>

            {/* Calculate button */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border hover:scale-[1.01] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
              style={{
                background: parsedZ1 && parsedZ2
                  ? 'linear-gradient(135deg, oklch(0.55 0.27 264), oklch(0.58 0.22 300))'
                  : 'oklch(0.25 0.02 250)',
                borderColor: parsedZ1 && parsedZ2
                  ? 'oklch(0.65 0.22 264 / 0.5)'
                  : 'oklch(0.35 0.02 250)',
                color: parsedZ1 && parsedZ2 ? 'oklch(1.0 0 0)' : 'oklch(0.45 0.02 250)',
                boxShadow: parsedZ1 && parsedZ2
                  ? '0 0 20px oklch(0.55 0.27 264 / 0.35)'
                  : 'none',
              }}
              onClick={handleBinaryCalculate}
              disabled={!parsedZ1 || !parsedZ2}
            >
              <Zap className="h-4 w-4" />
              Calculate z₁ {BINARY_OP_LABELS[binaryOp]} z₂
            </button>

            {/* Error */}
            <AnimatePresence>
              {binaryError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{binaryError}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {binaryResult && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-5"
                >
                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: 'oklch(0.14 0.02 250 / 0.5)',
                      borderColor: 'oklch(0.65 0.22 264 / 0.15)',
                    }}
                  >
                    <h3
                      className="text-xs font-semibold mb-3 uppercase tracking-wider"
                      style={{ color: 'oklch(0.68 0.10 264)' }}
                    >
                      Result
                    </h3>
                    <ResultDisplay result={binaryResult} />
                  </div>
                  <ArgandDiagramCard points={argandPoints} />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* Unary Tab                                                          */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="unary" className="space-y-6">
            {/* Quick examples */}
            <div className="flex flex-wrap gap-2">
              {UNARY_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => loadUnaryExample(ex)}
                  className="px-3 py-1 rounded-lg text-xs font-mono border transition-all duration-150 hover:scale-105"
                  style={{
                    background: 'oklch(0.58 0.22 300 / 0.08)',
                    borderColor: 'oklch(0.63 0.20 300 / 0.25)',
                    color: 'oklch(0.78 0.15 300)',
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div
              className="p-4 rounded-xl border"
              style={{
                background: 'linear-gradient(135deg, oklch(0.16 0.03 264 / 0.4), oklch(0.14 0.02 250 / 0.3))',
                borderColor: 'oklch(0.65 0.22 264 / 0.20)',
              }}
            >
              <ComplexInput
                label="z"
                id="uz"
                mode={uzMode}
                onModeChange={handleUZModeChange}
                rectValue={uzRect}
                onRectChange={(v) => { setUzRect(v); setUnaryResult(null); }}
                polarR={uzPolarR}
                onPolarRChange={(v) => { setUzPolarR(v); setUnaryResult(null); }}
                polarTheta={uzPolarTheta}
                onPolarThetaChange={(v) => { setUzPolarTheta(v); setUnaryResult(null); }}
                parsed={parsedUZ}
                error={uzError}
                accentHue="264"
              />
            </div>

            {/* Operation selector */}
            <div>
              <Label className="text-sm font-semibold mb-2 block text-muted-foreground">
                Operation
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(UNARY_OP_LABELS) as UnaryOp[]).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => { setUnaryOp(op); setUnaryResult(null); }}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 border text-left"
                    style={
                      unaryOp === op
                        ? {
                            background: 'linear-gradient(135deg, oklch(0.58 0.22 300 / 0.25), oklch(0.55 0.27 264 / 0.20))',
                            borderColor: 'oklch(0.63 0.20 300 / 0.55)',
                            color: 'oklch(0.85 0.16 300)',
                            boxShadow: '0 0 10px oklch(0.63 0.20 300 / 0.25)',
                          }
                        : {
                            background: 'oklch(0.18 0.02 250 / 0.4)',
                            borderColor: 'oklch(0.35 0.02 250 / 0.4)',
                            color: 'oklch(0.55 0.02 250)',
                          }
                    }
                    aria-pressed={unaryOp === op}
                  >
                    {UNARY_OP_LABELS[op]}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculate button */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border hover:scale-[1.01] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
              style={{
                background: parsedUZ
                  ? 'linear-gradient(135deg, oklch(0.58 0.22 300), oklch(0.55 0.27 264))'
                  : 'oklch(0.25 0.02 250)',
                borderColor: parsedUZ
                  ? 'oklch(0.63 0.20 300 / 0.5)'
                  : 'oklch(0.35 0.02 250)',
                color: parsedUZ ? 'oklch(1.0 0 0)' : 'oklch(0.45 0.02 250)',
                boxShadow: parsedUZ
                  ? '0 0 20px oklch(0.58 0.22 300 / 0.35)'
                  : 'none',
              }}
              onClick={handleUnaryCalculate}
              disabled={!parsedUZ}
            >
              <Zap className="h-4 w-4" />
              Calculate {UNARY_OP_LABELS[unaryOp]}
            </button>

            {/* Error */}
            <AnimatePresence>
              {unaryError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{unaryError}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {unaryResult && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-5"
                >
                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: 'oklch(0.14 0.02 250 / 0.5)',
                      borderColor: 'oklch(0.63 0.20 300 / 0.15)',
                    }}
                  >
                    <h3
                      className="text-xs font-semibold mb-3 uppercase tracking-wider"
                      style={{ color: 'oklch(0.68 0.10 300)' }}
                    >
                      Result
                    </h3>
                    <ResultDisplay result={unaryResult} />
                  </div>
                  <ArgandDiagramCard points={unaryArgandPoints} />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* History Tab                                                        */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="history" className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: 'oklch(0.65 0.22 264 / 0.08)',
                    border: '1px solid oklch(0.65 0.22 264 / 0.15)',
                  }}
                >
                  <span
                    className="text-3xl font-mono"
                    style={{ color: 'oklch(0.55 0.10 264)' }}
                    aria-hidden="true"
                  >
                    &#x2102;
                  </span>
                </div>
                <p className="text-sm">No calculations yet.</p>
                <p className="text-xs mt-1">Perform operations in the Binary or Unary tabs.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center py-1">
                  <p className="text-sm text-muted-foreground">
                    {history.length} calculation{history.length !== 1 ? 's' : ''}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistory([])}
                    className="text-xs text-muted-foreground gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {history.map((entry, idx) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.02 }}
                      className="rounded-xl border p-3 transition-colors duration-150"
                      style={{
                        background: 'linear-gradient(135deg, oklch(0.16 0.025 264 / 0.3), oklch(0.14 0.015 250 / 0.4))',
                        borderColor: 'oklch(0.65 0.22 264 / 0.15)',
                      }}
                    >
                      <p className="text-xs font-mono text-muted-foreground mb-1.5 truncate">
                        {entry.operation}
                      </p>
                      <p
                        className="text-sm font-mono font-bold"
                        style={{ color: 'oklch(0.85 0.15 264)' }}
                      >
                        = {entry.result.rectangular}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Polar: {entry.result.polar}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Reference card */}
        <details
          className="text-sm rounded-xl border mt-4 overflow-hidden"
          style={{
            background: 'oklch(0.14 0.018 250 / 0.5)',
            borderColor: 'oklch(0.65 0.22 264 / 0.15)',
          }}
        >
          <summary
            className="cursor-pointer font-semibold px-4 py-3 transition-colors hover:text-primary select-none"
            style={{ color: 'oklch(0.78 0.12 264)' }}
          >
            Complex Number Reference
          </summary>
          <div
            className="px-4 pb-4 space-y-3 border-t pt-3"
            style={{ borderColor: 'oklch(0.65 0.22 264 / 0.12)' }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  hue: '264',
                  title: 'Forms',
                  items: [
                    'Rectangular: a + bi',
                    'Polar: r\u2220\u03b8 (r=|z|, \u03b8=arg z)',
                    'Exponential: r\u00b7e^(i\u03b8)',
                  ],
                },
                {
                  hue: '300',
                  title: 'Key Identities',
                  items: [
                    'i\u00b2 = \u22121',
                    'e^(i\u03c0) = \u22121 (Euler)',
                    '|z| = \u221a(a\u00b2+b\u00b2)',
                    'z\u00b7\u03b6 = |z||\u03b6|\u2220(\u03b8+\u03c6)',
                  ],
                },
                {
                  hue: '155',
                  title: 'Arithmetic Rules',
                  items: [
                    'Add: real and imag parts separately',
                    'Multiply: FOIL then use i\u00b2=\u22121',
                    'Divide: multiply by conjugate of denominator',
                  ],
                },
                {
                  hue: '30',
                  title: 'Conjugate & Modulus',
                  items: [
                    '\u03b6 of a+bi = a\u2212bi',
                    'z\u00b7\u03b6 = |z|\u00b2',
                    'arg(z) \u2208 (\u2212\u03c0, \u03c0]',
                  ],
                },
              ].map(({ hue, title, items }) => (
                <div key={title}>
                  <p
                    className="font-semibold mb-1 text-xs"
                    style={{ color: `oklch(0.78 0.15 ${hue})` }}
                  >
                    {title}
                  </p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-1.5">
                        <span
                          className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                          style={{ background: `oklch(0.65 0.15 ${hue} / 0.7)` }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </motion.div>
  );
}
