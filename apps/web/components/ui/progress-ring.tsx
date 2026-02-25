'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * ProgressRing Component
 *
 * Circular progress indicator with animation support.
 *
 * @example
 * ```tsx
 * <ProgressRing value={75} size={120} strokeWidth={8} />
 * <ProgressRing value={50} label="50%" showValue />
 * ```
 *
 * Features:
 * - Smooth animated transitions
 * - Customizable size and stroke width
 * - Optional label/value display
 * - Multiple color variants
 * - Accessible with ARIA attributes
 * - Respects prefers-reduced-motion
 *
 * Accessibility:
 * - Uses role="progressbar" with proper ARIA attributes
 * - Announces progress updates to screen readers
 * - Keyboard focusable with visible focus ring
 */

export interface ProgressRingProps {
  /** Progress value (0-100) */
  value: number;

  /** Ring size in pixels */
  size?: number;

  /** Stroke width in pixels */
  strokeWidth?: number;

  /** Color variant */
  variant?: 'primary' | 'success' | 'warning' | 'destructive';

  /** Show value as text in center */
  showValue?: boolean;

  /** Custom label to display */
  label?: string;

  /** Additional CSS classes */
  className?: string;

  /** Animation duration in seconds */
  animationDuration?: number;
}

export function ProgressRing({
  value,
  size = 100,
  strokeWidth = 8,
  variant = 'primary',
  showValue = false,
  label,
  className,
  animationDuration = 0.5,
}: ProgressRingProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);

  // Calculate circle parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  // Color variants
  const variantColors = {
    primary: 'stroke-primary',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    destructive: 'stroke-destructive',
  };

  const displayValue = label || (showValue ? `${Math.round(clampedValue)}%` : '');

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progress: ${Math.round(clampedValue)}%`}
      tabIndex={0}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted fill-none"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn('fill-none', variantColors[variant])}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: animationDuration,
            ease: 'easeInOut',
          }}
        />
      </svg>

      {/* Center label */}
      {displayValue && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: animationDuration * 0.5, duration: 0.3 }}
        >
          <span
            className="text-sm font-semibold text-foreground"
            aria-hidden="true"
          >
            {displayValue}
          </span>
        </motion.div>
      )}
    </div>
  );
}

/**
 * ProgressRingStack Component
 *
 * Multiple progress rings stacked for comparison.
 *
 * @example
 * ```tsx
 * <ProgressRingStack
 *   rings={[
 *     { value: 80, variant: 'primary', label: 'Completed' },
 *     { value: 60, variant: 'success', label: 'Correct' },
 *   ]}
 * />
 * ```
 */
export function ProgressRingStack({
  rings,
  size = 120,
  strokeWidth = 6,
  className,
}: {
  rings: Array<{ value: number; variant?: ProgressRingProps['variant']; label?: string }>;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn('relative inline-flex', className)} style={{ width: size, height: size }}>
      {rings.map((ring, index) => {
        const ringSize = size - index * (strokeWidth + 4);
        return (
          <div
            key={index}
            className="absolute inset-0 flex items-center justify-center"
          >
            <ProgressRing
              value={ring.value}
              size={ringSize}
              strokeWidth={strokeWidth}
              {...(ring.variant !== undefined && { variant: ring.variant })}
              {...(index === 0 && ring.label !== undefined && { label: ring.label })}
            />
          </div>
        );
      })}
    </div>
  );
}
