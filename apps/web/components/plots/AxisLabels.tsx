'use client';

/**
 * Modernized axis labels overlay component for 2D plots
 * Features: Better typography, fade-in animations, WCAG AAA contrast, GPU-accelerated transforms
 * Accessibility: High contrast ratios, semantic HTML, adaptive label density
 * Fix 2: Adaptive tick calculation always derives from the current viewport range
 *   so labels rescale correctly after pan/zoom rather than using a fixed step.
 * @module components/plots/AxisLabels
 */

import { motion } from 'framer-motion';
import { useMemo } from 'react';

export interface AxisLabelsProps {
  viewport: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  width: number;
  height: number;
  xAxisConfig?: {
    label?: string;
    /**
     * majorStep is used only as a hint for the initial viewport. Once the user
     * pans or zooms, the adaptive algorithm takes over to prevent overcrowding.
     */
    majorStep?: number;
    format?: (v: number) => string;
  };
  yAxisConfig?: {
    label?: string;
    majorStep?: number;
    format?: (v: number) => string;
  };
}

/**
 * Converts viewport coordinates to pixel coordinates
 */
function viewportToPixel(value: number, min: number, max: number, pixelSize: number): number {
  return ((value - min) / (max - min)) * pixelSize;
}

/**
 * Calculates optimal label density based on zoom level.
 * Always derives from the current range so that zooming in/out produces
 * proportionally denser/sparser ticks.
 * The static majorStep hint is ignored once the range diverges from it.
 */
function calculateAdaptiveStep(
  range: number,
  pixelSize: number,
  minPixelsBetweenLabels = 60,
): number {
  const maxLabels = Math.max(1, Math.floor(pixelSize / minPixelsBetweenLabels));
  const rawStep = range / maxLabels;

  // Round to nearest "nice" number (1, 2, 5 × power-of-10)
  if (rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  let niceStep: number;
  if (normalized <= 1) niceStep = 1;
  else if (normalized <= 2) niceStep = 2;
  else if (normalized <= 5) niceStep = 5;
  else niceStep = 10;

  return niceStep * magnitude;
}

// Animation variants for smooth fade-in
const labelVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.02,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
};

const axisLabelVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

/**
 * Modernized Axis Labels Component
 * Renders high-quality, accessible labels with smooth animations.
 * Tick values are derived entirely from the live viewport so they are always
 * correct after pan and zoom operations.
 */
export function AxisLabels({ viewport, width, height, xAxisConfig, yAxisConfig }: AxisLabelsProps) {
  const xTicks = useMemo(() => {
    const range = viewport.xMax - viewport.xMin;
    // Always calculate from the current viewport range — do not hard-code the
    // hint from xAxisConfig.majorStep, because after zooming the range changes.
    const step = calculateAdaptiveStep(range, width);
    const ticks: Array<{ value: number; label: string; position: number }> = [];

    const start = Math.ceil(viewport.xMin / step) * step;
    for (let x = start; x <= viewport.xMax + 1e-10; x += step) {
      const rounded = Math.round(x / step) * step; // avoid float drift
      const position = viewportToPixel(rounded, viewport.xMin, viewport.xMax, width);
      const label = xAxisConfig?.format
        ? xAxisConfig.format(rounded)
        : rounded.toPrecision(4).replace(/\.?0+$/, '');
      ticks.push({ value: rounded, label, position });
    }

    return ticks;
  }, [viewport.xMin, viewport.xMax, width, xAxisConfig]);

  const yTicks = useMemo(() => {
    const range = viewport.yMax - viewport.yMin;
    const step = calculateAdaptiveStep(range, height, 40);
    const ticks: Array<{ value: number; label: string; position: number }> = [];

    const start = Math.ceil(viewport.yMin / step) * step;
    for (let y = start; y <= viewport.yMax + 1e-10; y += step) {
      const rounded = Math.round(y / step) * step;
      // Invert Y axis for screen coordinates
      const position = height - viewportToPixel(rounded, viewport.yMin, viewport.yMax, height);
      const label = yAxisConfig?.format
        ? yAxisConfig.format(rounded)
        : rounded.toPrecision(4).replace(/\.?0+$/, '');
      ticks.push({ value: rounded, label, position });
    }

    return ticks;
  }, [viewport.yMin, viewport.yMax, height, yAxisConfig]);

  // Find where axes cross (0,0)
  const xAxisY = useMemo(() => {
    if (viewport.yMin <= 0 && viewport.yMax >= 0) {
      return height - viewportToPixel(0, viewport.yMin, viewport.yMax, height);
    }
    return height; // Bottom of viewport
  }, [viewport.yMin, viewport.yMax, height]);

  const yAxisX = useMemo(() => {
    if (viewport.xMin <= 0 && viewport.xMax >= 0) {
      return viewportToPixel(0, viewport.xMin, viewport.xMax, width);
    }
    return 0; // Left of viewport
  }, [viewport.xMin, viewport.xMax, width]);

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ width, height }}
      role="img"
      aria-label="Coordinate axis labels"
    >
      {/* X-axis tick labels with staggered fade-in animation */}
      {xTicks.map((tick, i) => (
        <motion.div
          key={`x-${tick.value}`}
          custom={i}
          variants={labelVariants}
          initial="hidden"
          animate="visible"
          className="
            absolute text-xs font-mono text-foreground
            bg-background/80 backdrop-blur-sm
            px-2 py-0.5 rounded
            border border-cyan-500/30
            shadow-[0_2px_8px_0_rgba(6,182,212,0.15)]
          "
          style={{
            left: `${tick.position}px`,
            top: `${Math.min(xAxisY + 4, height - 20)}px`,
            // GPU-accelerated transform for smooth animations
            transform: 'translateX(-50%) translateZ(0)',
            willChange: 'transform, opacity',
          }}
          aria-label={`x equals ${tick.label}`}
        >
          <span className="text-cyan-300 font-medium">{tick.label}</span>
        </motion.div>
      ))}

      {/* Y-axis tick labels with staggered fade-in animation */}
      {yTicks.map((tick, i) => (
        <motion.div
          key={`y-${tick.value}`}
          custom={i}
          variants={labelVariants}
          initial="hidden"
          animate="visible"
          className="
            absolute text-xs font-mono text-foreground
            bg-background/80 backdrop-blur-sm
            px-2 py-0.5 rounded
            border border-cyan-500/30
            shadow-[0_2px_8px_0_rgba(6,182,212,0.15)]
          "
          style={{
            left: `${Math.max(yAxisX + 4, 4)}px`,
            top: `${tick.position}px`,
            // GPU-accelerated transform for smooth animations
            transform: 'translateY(-50%) translateZ(0)',
            willChange: 'transform, opacity',
          }}
          aria-label={`y equals ${tick.label}`}
        >
          <span className="text-cyan-300 font-medium">{tick.label}</span>
        </motion.div>
      ))}

      {/* X-axis label with enhanced styling */}
      {xAxisConfig?.label && (
        <motion.div
          variants={axisLabelVariants}
          initial="hidden"
          animate="visible"
          className="
            absolute text-sm font-semibold
            text-cyan-100 bg-gradient-to-br from-background/90 to-card/90
            backdrop-blur-md px-3 py-1.5 rounded-lg
            border border-cyan-500/40
            shadow-[0_4px_16px_0_rgba(6,182,212,0.2)]
          "
          style={{
            left: `${width - 50}px`,
            top: `${Math.min(xAxisY + 4, height - 45)}px`,
            transform: 'translateZ(0)',
            willChange: 'transform, opacity',
          }}
          aria-label={`X axis represents ${xAxisConfig.label}`}
        >
          <span className="tracking-wide">{xAxisConfig.label}</span>
        </motion.div>
      )}

      {/* Y-axis label with enhanced styling */}
      {yAxisConfig?.label && (
        <motion.div
          variants={axisLabelVariants}
          initial="hidden"
          animate="visible"
          className="
            absolute text-sm font-semibold
            text-cyan-100 bg-gradient-to-br from-background/90 to-card/90
            backdrop-blur-md px-3 py-1.5 rounded-lg
            border border-cyan-500/40
            shadow-[0_4px_16px_0_rgba(6,182,212,0.2)]
          "
          style={{
            left: `${Math.max(yAxisX + 4, 4)}px`,
            top: '10px',
            transform: 'translateZ(0)',
            willChange: 'transform, opacity',
          }}
          aria-label={`Y axis represents ${yAxisConfig.label}`}
        >
          <span className="tracking-wide">{yAxisConfig.label}</span>
        </motion.div>
      )}
    </div>
  );
}
