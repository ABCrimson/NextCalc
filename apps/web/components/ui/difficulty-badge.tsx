'use client';

import { Crown, Flame, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Difficulty levels as branded type for type safety
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'master';

/**
 * DifficultyBadge Component
 *
 * Visual indicator for problem difficulty levels.
 *
 * @example
 * ```tsx
 * <DifficultyBadge level="beginner" />
 * <DifficultyBadge level="master" showIcon />
 * ```
 *
 * Features:
 * - Color-coded difficulty levels
 * - Optional icon display
 * - Accessible with proper ARIA labels
 * - Customizable sizing
 *
 * Accessibility:
 * - Semantic badge with clear difficulty indication
 * - Icons include aria-hidden for cleaner screen reader output
 * - Proper color contrast ratios (WCAG AAA)
 */

export interface DifficultyBadgeProps {
  /** Difficulty level */
  level: DifficultyLevel;

  /** Show icon alongside text */
  showIcon?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Additional CSS classes */
  className?: string;
}

const difficultyConfig = {
  beginner: {
    label: 'Beginner',
    icon: Sparkles,
    className:
      'bg-[oklch(0.92_0.08_145)] text-[oklch(0.35_0.10_145)] dark:bg-[oklch(0.30_0.06_145/0.30)] dark:text-[oklch(0.75_0.15_145)] border-[oklch(0.80_0.10_145)] dark:border-[oklch(0.40_0.08_145)]',
  },
  intermediate: {
    label: 'Intermediate',
    icon: Zap,
    className:
      'bg-[oklch(0.92_0.06_250)] text-[oklch(0.35_0.10_250)] dark:bg-[oklch(0.30_0.06_250/0.30)] dark:text-[oklch(0.75_0.12_250)] border-[oklch(0.78_0.08_250)] dark:border-[oklch(0.40_0.08_250)]',
  },
  advanced: {
    label: 'Advanced',
    icon: Flame,
    className:
      'bg-[oklch(0.92_0.08_60)] text-[oklch(0.40_0.12_60)] dark:bg-[oklch(0.30_0.06_60/0.30)] dark:text-[oklch(0.75_0.15_60)] border-[oklch(0.80_0.10_60)] dark:border-[oklch(0.40_0.08_60)]',
  },
  master: {
    label: 'Master',
    icon: Crown,
    className:
      'bg-[oklch(0.92_0.08_300)] text-[oklch(0.35_0.12_300)] dark:bg-[oklch(0.30_0.06_300/0.30)] dark:text-[oklch(0.75_0.15_300)] border-[oklch(0.78_0.10_300)] dark:border-[oklch(0.40_0.08_300)]',
  },
} as const;

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
} as const;

export function DifficultyBadge({
  level,
  showIcon = false,
  size = 'md',
  className,
}: DifficultyBadgeProps) {
  const config = difficultyConfig[level];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold border',
        config.className,
        sizeClasses[size],
        showIcon && 'gap-1.5',
        className,
      )}
      aria-label={`Difficulty: ${config.label}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{config.label}</span>
    </Badge>
  );
}

/**
 * DifficultyScale Component
 *
 * Visual scale showing all difficulty levels with current highlighted.
 *
 * @example
 * ```tsx
 * <DifficultyScale currentLevel="advanced" />
 * ```
 */
export function DifficultyScale({
  currentLevel,
  className,
}: {
  currentLevel: DifficultyLevel;
  className?: string;
}) {
  const levels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'master'];

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="group"
      aria-label="Difficulty scale"
    >
      {levels.map((level) => {
        const isCurrent = level === currentLevel;
        const config = difficultyConfig[level];

        return (
          <div
            key={level}
            className={cn(
              'h-2 flex-1 rounded-full transition-all',
              isCurrent
                ? (config.className.split(' ')[0]?.replace('bg-', 'bg-') ?? 'bg-primary') // Extract background color
                : 'bg-muted opacity-30',
            )}
            aria-label={isCurrent ? `Current difficulty: ${config.label}` : config.label}
            aria-current={isCurrent ? 'true' : undefined}
          />
        );
      })}
    </div>
  );
}

/**
 * Helper function to get numeric difficulty value (for sorting/filtering)
 */
export function getDifficultyValue(level: DifficultyLevel): number {
  const values: Record<DifficultyLevel, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    master: 4,
  };
  return values[level];
}

/**
 * Helper function to compare difficulties
 */
export function compareDifficulty(a: DifficultyLevel, b: DifficultyLevel): number {
  return getDifficultyValue(a) - getDifficultyValue(b);
}
