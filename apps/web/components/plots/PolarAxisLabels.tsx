'use client';

/**
 * Modernized polar axis labels overlay component for 2D polar plots
 * Features: GPU-accelerated transforms, adaptive label density, smooth animations, enhanced typography
 * Accessibility: WCAG AAA contrast, semantic HTML, proper ARIA labels
 * @module components/plots/PolarAxisLabels
 */

import { m } from 'framer-motion';
import { useMemo } from 'react';

export interface PolarAxisLabelsProps {
  rRange: {
    min: number;
    max: number;
  };
  width: number;
  height: number;
  showDegrees?: boolean; // Show degrees instead of radians
  radialSteps?: number; // Number of radial circles
  angularSteps?: number; // Number of angular divisions
}

/**
 * Calculates adaptive angular step based on viewport size
 * Prevents overcrowding of angular labels
 */
function calculateAdaptiveAngularSteps(radius: number): number {
  const minLabelSpacing = 50; // Minimum pixels between labels
  const circumference = 2 * Math.PI * radius;
  const maxLabels = Math.floor(circumference / minLabelSpacing);

  // Round to common divisions: 4, 8, 12, 16, 24
  const commonSteps = [4, 8, 12, 16, 24, 32];
  return commonSteps.find((step) => step <= maxLabels) || 8;
}

// Animation variants for smooth appearance
const centerPointVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
      delay: 0.1,
    },
  },
};

const radialLabelVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.2 + i * 0.05,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
};

const angularLabelVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.3 + i * 0.03,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
};

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1,
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

/**
 * Modernized Polar Axis Labels Component
 * Displays radial circles and angular divisions with beautiful animations and accessibility
 */
export function PolarAxisLabels({
  rRange,
  width,
  height,
  showDegrees = false,
  radialSteps = 4,
  angularSteps: providedAngularSteps,
}: PolarAxisLabelsProps) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 40; // Leave margin

  // Adaptive angular steps based on viewport size
  const angularSteps = useMemo(
    () => providedAngularSteps || calculateAdaptiveAngularSteps(maxRadius),
    [providedAngularSteps, maxRadius],
  );

  // Calculate radial tick marks (circles)
  const radialTicks = useMemo(() => {
    const ticks: Array<{ radius: number; value: number; label: string }> = [];
    const step = (rRange.max - rRange.min) / radialSteps;

    for (let i = 1; i <= radialSteps; i++) {
      const value = rRange.min + i * step;
      const radius = (value / rRange.max) * maxRadius;
      ticks.push({
        radius,
        value,
        label: value.toFixed(1),
      });
    }

    return ticks;
  }, [rRange.min, rRange.max, radialSteps, maxRadius]);

  // Calculate angular tick marks (rays)
  const angularTicks = useMemo(() => {
    const ticks: Array<{
      angle: number;
      label: string;
      x: number;
      y: number;
      isCardinal: boolean;
    }> = [];

    const angleStep = (2 * Math.PI) / angularSteps;

    for (let i = 0; i < angularSteps; i++) {
      const angle = i * angleStep;
      const labelRadius = maxRadius + 25;

      // Position label outside the plot
      const x = centerX + labelRadius * Math.cos(angle - Math.PI / 2);
      const y = centerY + labelRadius * Math.sin(angle - Math.PI / 2);

      let label: string;
      if (showDegrees) {
        const degrees = (angle * 180) / Math.PI;
        label = `${Math.round(degrees)}°`;
      } else {
        // Format as fractions of π when possible
        const piMultiple = angle / Math.PI;
        if (Math.abs(piMultiple - 0) < 0.01) label = '0';
        else if (Math.abs(piMultiple - 0.5) < 0.01) label = 'π/2';
        else if (Math.abs(piMultiple - 1) < 0.01) label = 'π';
        else if (Math.abs(piMultiple - 1.5) < 0.01) label = '3π/2';
        else if (Math.abs(piMultiple - 0.25) < 0.01) label = 'π/4';
        else if (Math.abs(piMultiple - 0.75) < 0.01) label = '3π/4';
        else if (Math.abs(piMultiple - 1.25) < 0.01) label = '5π/4';
        else if (Math.abs(piMultiple - 1.75) < 0.01) label = '7π/4';
        else label = angle.toFixed(2);
      }

      // Cardinal directions (0°, 90°, 180°, 270°) get special styling
      const isCardinal = i % Math.max(1, angularSteps / 4) === 0;

      ticks.push({ angle, label, x, y, isCardinal });
    }

    return ticks;
  }, [angularSteps, maxRadius, centerX, centerY, showDegrees]);

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ width, height }}
      role="img"
      aria-label="Polar coordinate axis labels"
    >
      {/* Animated center point marker with glow effect */}
      <m.div
        variants={centerPointVariants}
        initial="hidden"
        animate="visible"
        className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
        style={{
          left: `${centerX}px`,
          top: `${centerY}px`,
          // GPU-accelerated transform
          transform: 'translate(-50%, -50%) translateZ(0)',
          willChange: 'transform',
        }}
        aria-label="Polar origin point"
      >
        {/* Pulsing ring effect */}
        <m.div
          className="absolute inset-0 rounded-full bg-cyan-400/30"
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      </m.div>

      {/* Radial circle labels (r values) with staggered animation */}
      {radialTicks.map((tick, i) => (
        <m.div
          key={`r-${tick.value}`}
          custom={i}
          variants={radialLabelVariants}
          initial="hidden"
          animate="visible"
          className="
            absolute text-xs font-mono font-medium
            text-foreground bg-background/80 backdrop-blur-sm
            px-2 py-1 rounded-md
            border border-cyan-500/40
            shadow-[0_2px_8px_0_rgba(6,182,212,0.15)]
          "
          style={{
            left: `${centerX + tick.radius}px`,
            top: `${centerY - 4}px`,
            // GPU-accelerated transform for smooth animations
            transform: 'translateY(-50%) translateZ(0)',
            willChange: 'transform, opacity',
          }}
          aria-label={`Radius equals ${tick.label}`}
        >
          <span className="text-cyan-300">r=</span>
          <span className="text-cyan-100">{tick.label}</span>
        </m.div>
      ))}

      {/* Angular labels (θ values) with staggered animation and adaptive styling */}
      {angularTicks.map((tick, i) => (
        <m.div
          key={`theta-${tick.angle}`}
          custom={i}
          variants={angularLabelVariants}
          initial="hidden"
          animate="visible"
          className={`
            absolute text-xs font-mono px-2 py-1 rounded-md
            backdrop-blur-sm
            shadow-[0_2px_8px_0_rgba(6,182,212,0.15)]
            ${
              tick.isCardinal
                ? 'text-cyan-100 bg-gradient-to-br from-cyan-900/90 to-cyan-800/90 border-2 border-cyan-400/60 font-semibold'
                : 'text-cyan-300/90 bg-background/80 border border-cyan-500/30 font-medium'
            }
          `}
          style={{
            left: `${tick.x}px`,
            top: `${tick.y}px`,
            // GPU-accelerated transform for smooth animations
            transform: 'translate(-50%, -50%) translateZ(0)',
            willChange: 'transform, opacity',
          }}
          aria-label={`Angle ${tick.label}`}
        >
          {tick.label}
        </m.div>
      ))}

      {/* Coordinate system label with enhanced styling */}
      <m.div
        variants={headerVariants}
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
          left: '12px',
          top: '12px',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }}
        aria-label="Polar coordinate system"
      >
        <span className="tracking-wide">Polar (r, θ)</span>
      </m.div>

      {/* Range indicator with enhanced styling */}
      <m.div
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        className="
          absolute text-xs font-medium
          text-foreground/80 bg-background/80 backdrop-blur-sm
          px-3 py-1.5 rounded-lg
          border border-border
          shadow-[0_2px_8px_0_rgba(0,0,0,0.2)]
        "
        style={{
          right: '12px',
          top: '12px',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }}
        aria-label={`Radial range from ${rRange.min.toFixed(1)} to ${rRange.max.toFixed(1)}`}
      >
        <span className="text-cyan-400">r</span> ∈ [{rRange.min.toFixed(1)}, {rRange.max.toFixed(1)}
        ]
      </m.div>
    </div>
  );
}
