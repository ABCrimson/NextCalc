'use client';

/**
 * Polar Analysis Panel
 *
 * Shown below polar plots. Computes numerically:
 *  - Curve type classification (rose, cardioid, limacon, spiral, lemniscate, circle, etc.)
 *  - Symmetry detection (x-axis, y-axis, origin)
 *  - Number of petals / loops
 *  - Maximum radius
 *  - Enclosed area via numerical integration: A = (1/2) * integral(r^2, theta, 0, 2*pi)
 *
 * @module components/plots/PolarAnalysisPanel
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Compass,
  FlipHorizontal,
  Flower2,
  Maximize2,
  Radar,
  Shapes,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface PolarAnalysisFunction {
  fn: (theta: number) => number;
  label?: string;
  color: string;
  expression?: string;
}

export interface PolarAnalysisPanelProps {
  functions: PolarAnalysisFunction[];
  /** Number of uniform samples for numerical analysis */
  samples?: number;
  className?: string;
}

interface SymmetryInfo {
  xAxis: boolean;
  yAxis: boolean;
  origin: boolean;
}

interface PolarAnalysisResult {
  label: string;
  color: string;
  curveType: string;
  symmetry: SymmetryInfo;
  petalCount: number;
  maxRadius: number;
  enclosedArea: number;
  expression: string;
}

// --------------------------------------------------------------------------
// Numerical helpers
// --------------------------------------------------------------------------

const SYMMETRY_TOLERANCE = 0.05;

/**
 * Check symmetry about x-axis: f(theta) === f(-theta)
 * In polar, x-axis symmetry means r(theta) = r(-theta).
 */
function checkXAxisSymmetry(fn: (theta: number) => number, samples: number): boolean {
  let totalDiff = 0;
  let totalMag = 0;

  for (let i = 1; i <= samples; i++) {
    const theta = (i / samples) * 2 * Math.PI;
    const r1 = fn(theta);
    const r2 = fn(-theta);

    if (!isFinite(r1) || !isFinite(r2)) continue;

    totalDiff += Math.abs(r1 - r2);
    totalMag += Math.abs(r1) + Math.abs(r2);
  }

  if (totalMag < 1e-10) return true;
  return totalDiff / totalMag < SYMMETRY_TOLERANCE;
}

/**
 * Check symmetry about y-axis: f(pi - theta) === f(theta)
 */
function checkYAxisSymmetry(fn: (theta: number) => number, samples: number): boolean {
  let totalDiff = 0;
  let totalMag = 0;

  for (let i = 1; i <= samples; i++) {
    const theta = (i / samples) * 2 * Math.PI;
    const r1 = fn(theta);
    const r2 = fn(Math.PI - theta);

    if (!isFinite(r1) || !isFinite(r2)) continue;

    totalDiff += Math.abs(r1 - r2);
    totalMag += Math.abs(r1) + Math.abs(r2);
  }

  if (totalMag < 1e-10) return true;
  return totalDiff / totalMag < SYMMETRY_TOLERANCE;
}

/**
 * Check symmetry about origin: f(theta + pi) === f(theta)
 * or equivalently f(theta + pi) === -f(theta) (point symmetry through origin).
 */
function checkOriginSymmetry(fn: (theta: number) => number, samples: number): boolean {
  let totalDiffSame = 0;
  let totalDiffNeg = 0;
  let totalMag = 0;

  for (let i = 1; i <= samples; i++) {
    const theta = (i / samples) * 2 * Math.PI;
    const r1 = fn(theta);
    const r2 = fn(theta + Math.PI);

    if (!isFinite(r1) || !isFinite(r2)) continue;

    totalDiffSame += Math.abs(r1 - r2);
    totalDiffNeg += Math.abs(r1 + r2);
    totalMag += Math.abs(r1) + Math.abs(r2);
  }

  if (totalMag < 1e-10) return true;
  // Origin symmetric if f(theta+pi) = f(theta) OR f(theta+pi) = -f(theta)
  return (
    totalDiffSame / totalMag < SYMMETRY_TOLERANCE || totalDiffNeg / totalMag < SYMMETRY_TOLERANCE
  );
}

/**
 * Count petals/loops by detecting zero crossings of r(theta).
 * Each pair of zero crossings (positive excursion) counts as one petal.
 * Also detects loops where r goes negative (those are separate loops).
 */
function countPetals(fn: (theta: number) => number, samples: number): number {
  const step = (2 * Math.PI) / samples;
  let signChanges = 0;
  let lastSign = 0;

  for (let i = 0; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);

    if (!isFinite(r)) continue;

    const sign = Math.sign(r);
    if (sign !== 0 && sign !== lastSign && lastSign !== 0) {
      signChanges++;
    }
    if (sign !== 0) {
      lastSign = sign;
    }
  }

  // Each petal is bounded by two zero crossings, so petals = signChanges / 2
  // For functions that never cross zero, we count distinct positive "lobes"
  if (signChanges === 0) {
    return countDistinctLobes(fn, samples);
  }

  return Math.round(signChanges / 2);
}

/**
 * For functions that stay positive (like cardioids, limacons without inner loop),
 * count the number of distinct radial maxima as "lobes".
 */
function countDistinctLobes(fn: (theta: number) => number, samples: number): number {
  const step = (2 * Math.PI) / samples;
  let lobes = 0;
  let wasDecreasing = false;

  let prevR = fn(0);

  for (let i = 1; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);
    if (!isFinite(r) || !isFinite(prevR)) {
      prevR = r;
      continue;
    }

    const isDecreasing = r < prevR;
    // Detect a transition from increasing to decreasing = a local max = a lobe peak
    if (isDecreasing && !wasDecreasing && i > 1) {
      lobes++;
    }
    wasDecreasing = isDecreasing;
    prevR = r;
  }

  return lobes;
}

/**
 * Compute enclosed area using numerical integration: A = (1/2) * integral(r^2 dtheta, 0, 2*pi)
 * Uses the trapezoidal rule.
 */
function computeArea(fn: (theta: number) => number, samples: number): number {
  const step = (2 * Math.PI) / samples;
  let area = 0;

  for (let i = 0; i < samples; i++) {
    const theta = i * step;
    const r = fn(theta);

    if (!isFinite(r)) continue;

    area += r * r * step;
  }

  return Math.abs(area) / 2;
}

/**
 * Find max |r| over [0, 2*pi].
 */
function computeMaxRadius(fn: (theta: number) => number, samples: number): number {
  const step = (2 * Math.PI) / samples;
  let maxR = 0;

  for (let i = 0; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);

    if (isFinite(r)) {
      maxR = Math.max(maxR, Math.abs(r));
    }
  }

  return maxR;
}

/**
 * Classify the polar curve type by analyzing its shape and expression.
 */
function classifyCurve(
  fn: (theta: number) => number,
  petalCount: number,
  _maxR: number,
  symmetry: SymmetryInfo,
  expression: string,
  samples: number,
): string {
  const expr = expression.toLowerCase().replace(/\s/g, '');

  // Check if it's a constant (circle)
  const step = (2 * Math.PI) / samples;
  let isConstant = true;
  const firstR = fn(0);
  for (let i = 1; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);
    if (isFinite(r) && Math.abs(r - firstR) > 0.01 * Math.max(1, Math.abs(firstR))) {
      isConstant = false;
      break;
    }
  }
  if (isConstant && isFinite(firstR)) return 'Circle';

  // Check for spiral: r increases or decreases monotonically with theta
  if (isSpiral(fn, samples)) return 'Spiral';

  // Check for lemniscate pattern: r^2 = a*cos(2*theta) or r^2 = a*sin(2*theta)
  if (expr.includes('sqrt') && (expr.includes('cos(2') || expr.includes('sin(2'))) {
    return 'Lemniscate';
  }

  // Rose curves: r = a*cos(n*theta) or r = a*sin(n*theta)
  // Characterized by having multiple symmetric petals with zero crossings
  if (petalCount >= 3 && (symmetry.xAxis || symmetry.yAxis || symmetry.origin)) {
    return `Rose (${petalCount} petals)`;
  }

  // Cardioid: r = a(1 + cos(theta)) or r = a(1 + sin(theta))
  // Has exactly one cusp (r touches zero once) and one lobe
  if (isCardioid(fn, samples)) return 'Cardioid';

  // Limacon with inner loop: r = a + b*cos(theta) where |b| > |a|
  // Has an inner loop (r goes negative)
  if (hasInnerLoop(fn, samples) && petalCount <= 2) return 'Limacon (inner loop)';

  // Dimpled limacon: r = a + b*cos(theta) where |a| > |b| but close
  // No inner loop, but has a dimple
  if (petalCount <= 2 && isDimpled(fn, samples)) return 'Limacon (dimpled)';

  // Convex limacon: r = a + b*cos(theta) where |a| >> |b|
  if (petalCount <= 2 && !isConstant) return 'Limacon (convex)';

  // Rose with offset (e.g., r = 2 + sin(3*theta))
  if (petalCount >= 3) return `Rose-like (${petalCount} lobes)`;

  // Generic fallback
  if (petalCount === 2) return 'Two-lobed curve';
  return 'Polar curve';
}

/**
 * Detect if the curve is a spiral (r monotonically increases or decreases).
 */
function isSpiral(fn: (theta: number) => number, samples: number): boolean {
  const step = (2 * Math.PI) / samples;
  let increasing = 0;
  let decreasing = 0;
  let prevR = fn(0);

  for (let i = 1; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);
    if (!isFinite(r) || !isFinite(prevR)) {
      prevR = r;
      continue;
    }

    if (r > prevR + 0.001) increasing++;
    else if (r < prevR - 0.001) decreasing++;
    prevR = r;
  }

  const total = increasing + decreasing;
  if (total === 0) return false;
  // Spiral if predominantly one direction (>85% increasing or decreasing)
  return increasing / total > 0.85 || decreasing / total > 0.85;
}

/**
 * Detect if curve is a cardioid: touches r=0 exactly once and has a single lobe.
 */
function isCardioid(fn: (theta: number) => number, samples: number): boolean {
  const step = (2 * Math.PI) / samples;
  let nearZeroCount = 0;
  let minR = Infinity;

  for (let i = 0; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);
    if (!isFinite(r)) continue;

    if (Math.abs(r) < 0.05) nearZeroCount++;
    minR = Math.min(minR, Math.abs(r));
  }

  // Cardioid touches zero (or very close) at one angular region
  return minR < 0.1 && nearZeroCount > 0 && nearZeroCount < samples * 0.1;
}

/**
 * Detect if the function has an inner loop (r goes negative).
 */
function hasInnerLoop(fn: (theta: number) => number, samples: number): boolean {
  const step = (2 * Math.PI) / samples;
  let negativeCount = 0;

  for (let i = 0; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);
    if (isFinite(r) && r < -0.01) negativeCount++;
  }

  return negativeCount > samples * 0.05;
}

/**
 * Detect if the curve is dimpled (has a local minimum that doesn't reach zero).
 */
function isDimpled(fn: (theta: number) => number, samples: number): boolean {
  const step = (2 * Math.PI) / samples;
  let minR = Infinity;
  let maxR = 0;

  for (let i = 0; i <= samples; i++) {
    const theta = i * step;
    const r = fn(theta);
    if (!isFinite(r)) continue;
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  }

  // Dimpled if min is positive but close to zero relative to max
  return minR > 0 && minR < maxR * 0.4;
}

/**
 * Formats a number to a compact readable string.
 */
function fmt(n: number, decimals = 4): string {
  if (!isFinite(n)) return '--';
  if (Math.abs(n) < 1e-10) return '0';
  if (Math.abs(n) < 1e-3 && n !== 0) return n.toExponential(3);
  return parseFloat(n.toFixed(decimals)).toString();
}

// --------------------------------------------------------------------------
// Analysis hook
// --------------------------------------------------------------------------

function usePolarAnalysis(
  functions: PolarAnalysisFunction[],
  samples: number,
): PolarAnalysisResult[] {
  return useMemo(() => {
    return functions.map(({ fn, label, color, expression }) => {
      const lbl = label ?? 'r(theta)';
      const expr = expression ?? '';

      const symmetry: SymmetryInfo = {
        xAxis: checkXAxisSymmetry(fn, samples),
        yAxis: checkYAxisSymmetry(fn, samples),
        origin: checkOriginSymmetry(fn, samples),
      };

      const petalCount = countPetals(fn, samples);
      const maxRadius = computeMaxRadius(fn, samples);
      const enclosedArea = computeArea(fn, samples);
      const curveType = classifyCurve(fn, petalCount, maxRadius, symmetry, expr, samples);

      return {
        label: lbl,
        color,
        curveType,
        symmetry,
        petalCount,
        maxRadius,
        enclosedArea,
        expression: expr,
      };
    });
  }, [functions, samples]);
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function AnalysisRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="shrink-0" style={{ color }}>
        {icon}
      </span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto text-foreground font-medium">{value}</span>
    </div>
  );
}

function SymmetryBadges({ symmetry, color }: { symmetry: SymmetryInfo; color: string }) {
  const badges: { label: string; active: boolean }[] = [
    { label: 'x-axis', active: symmetry.xAxis },
    { label: 'y-axis', active: symmetry.yAxis },
    { label: 'Origin', active: symmetry.origin },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={[
            'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium',
            'border transition-colors duration-150',
            badge.active
              ? 'bg-purple-950/50 border-purple-500/40 text-purple-200'
              : 'bg-background/40 border-border text-muted-foreground/60',
          ].join(' ')}
          style={badge.active ? { borderLeftColor: color, borderLeftWidth: 2 } : undefined}
        >
          {badge.active && (
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
          )}
          {badge.label}
        </span>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

export function PolarAnalysisPanel({
  functions,
  samples = 1000,
  className = '',
}: PolarAnalysisPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const analyses = usePolarAnalysis(functions, samples);

  if (analyses.length === 0) return null;

  return (
    <div
      className={[
        'rounded-xl overflow-hidden',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60',
        'backdrop-blur-md border border-border',
        'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
        className,
      ].join(' ')}
      aria-label="Polar analysis panel"
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
        aria-controls="polar-analysis-panel-body"
      >
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-purple-400" />
          <span>Polar Analysis</span>
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
            id="polar-analysis-panel-body"
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
              {analyses.map((analysis) => (
                <Card key={analysis.label} className="bg-card/50 backdrop-blur-sm border-border">
                  <CardContent className="p-4 space-y-3">
                    {/* Function header with color swatch */}
                    <div className="flex items-center gap-2 mb-1">
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

                    <div className="space-y-2">
                      {/* Curve Type */}
                      <AnalysisRow
                        icon={<Shapes className="h-3 w-3" />}
                        label="Curve Type"
                        value={analysis.curveType}
                        color={analysis.color}
                      />

                      {/* Symmetry */}
                      <div className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 mt-0.5" style={{ color: analysis.color }}>
                          <FlipHorizontal className="h-3 w-3" />
                        </span>
                        <span className="text-muted-foreground shrink-0">Symmetry</span>
                        <div className="ml-auto">
                          <SymmetryBadges symmetry={analysis.symmetry} color={analysis.color} />
                        </div>
                      </div>

                      {/* Petals / Loops */}
                      <AnalysisRow
                        icon={<Flower2 className="h-3 w-3" />}
                        label="Petals / Loops"
                        value={analysis.petalCount > 0 ? String(analysis.petalCount) : 'N/A'}
                        color={analysis.color}
                      />

                      {/* Max Radius */}
                      <AnalysisRow
                        icon={<Maximize2 className="h-3 w-3" />}
                        label="Max Radius"
                        value={fmt(analysis.maxRadius)}
                        color={analysis.color}
                      />

                      {/* Enclosed Area */}
                      <AnalysisRow
                        icon={<Radar className="h-3 w-3" />}
                        label="Enclosed Area"
                        value={fmt(analysis.enclosedArea)}
                        color={analysis.color}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Numerical note */}
              <p className="text-[10px] text-muted-foreground/60 border-t border-border/30 pt-2">
                Values computed numerically over [0, 2pi]. Area via trapezoidal rule: A = (1/2)
                integral(r^2 dtheta).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
