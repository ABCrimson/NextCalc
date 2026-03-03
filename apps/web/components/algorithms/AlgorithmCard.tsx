'use client';

import { m } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Difficulty level for algorithms
 * Used for filtering and visual indicators
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Algorithm category
 * Determines color scheme and icon
 */
export type AlgorithmCategory =
  | 'machine-learning'
  | 'cryptography'
  | 'quantum'
  | 'graph-theory'
  | 'signal-processing'
  | 'game-theory'
  | 'dynamical-systems'
  | 'numerical-analysis';

export interface AlgorithmCardProps {
  /** Algorithm name */
  title: string;
  /** Brief description (1-2 sentences) */
  description: string;
  /** Category for color coding */
  category: AlgorithmCategory;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** Link to algorithm page */
  href: string;
  /** Icon component */
  icon: LucideIcon;
  /** Time complexity (optional) */
  timeComplexity?: string;
  /** Whether the card is currently disabled */
  disabled?: boolean;
}

const categoryStyles: Record<
  AlgorithmCategory,
  {
    gradient: string;
    border: string;
    shadow: string;
    text: string;
    iconBg: string;
  }
> = {
  'machine-learning': {
    gradient: 'from-blue-950/40 to-blue-900/40',
    border: 'border-blue-500/40 hover:border-blue-400/70',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]',
    text: 'text-blue-200',
    iconBg: 'bg-blue-500/10',
  },
  cryptography: {
    gradient: 'from-purple-950/40 to-purple-900/40',
    border: 'border-purple-500/40 hover:border-purple-400/70',
    shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.35)]',
    text: 'text-purple-200',
    iconBg: 'bg-purple-500/10',
  },
  quantum: {
    gradient: 'from-emerald-950/40 to-emerald-900/40',
    border: 'border-emerald-500/40 hover:border-emerald-400/70',
    shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)]',
    text: 'text-emerald-200',
    iconBg: 'bg-emerald-500/10',
  },
  'graph-theory': {
    gradient: 'from-amber-950/40 to-amber-900/40',
    border: 'border-amber-500/40 hover:border-amber-400/70',
    shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)]',
    text: 'text-amber-200',
    iconBg: 'bg-amber-500/10',
  },
  'signal-processing': {
    gradient: 'from-cyan-950/40 to-cyan-900/40',
    border: 'border-cyan-500/40 hover:border-cyan-400/70',
    shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.35)]',
    text: 'text-cyan-200',
    iconBg: 'bg-cyan-500/10',
  },
  'game-theory': {
    gradient: 'from-rose-950/40 to-rose-900/40',
    border: 'border-rose-500/40 hover:border-rose-400/70',
    shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:shadow-[0_0_25px_rgba(244,63,94,0.35)]',
    text: 'text-rose-200',
    iconBg: 'bg-rose-500/10',
  },
  'dynamical-systems': {
    gradient: 'from-indigo-950/40 to-indigo-900/40',
    border: 'border-indigo-500/40 hover:border-indigo-400/70',
    shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.35)]',
    text: 'text-indigo-200',
    iconBg: 'bg-indigo-500/10',
  },
  'numerical-analysis': {
    gradient: 'from-orange-950/40 to-orange-900/40',
    border: 'border-orange-500/40 hover:border-orange-400/70',
    shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.35)]',
    text: 'text-orange-200',
    iconBg: 'bg-orange-500/10',
  },
};

const difficultyColors: Record<DifficultyLevel, string> = {
  beginner: 'bg-green-500/20 text-green-300 border-green-500/30',
  intermediate: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  advanced: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  expert: 'bg-red-500/20 text-red-300 border-red-500/30',
};

/**
 * AlgorithmCard Component
 *
 * Displays a preview card for an algorithm with category-specific styling.
 * Includes hover effects, difficulty badge, and optional complexity info.
 *
 * Accessibility:
 * - Semantic link with descriptive text
 * - Keyboard navigable
 * - Focus indicators
 * - ARIA labels for screen readers
 * - Reduced motion support
 *
 * @example
 * ```tsx
 * <AlgorithmCard
 *   title="Transformer Attention"
 *   description="Visualize how transformers process sequences"
 *   category="machine-learning"
 *   difficulty="intermediate"
 *   href="/algorithms/transformers"
 *   icon={Brain}
 *   timeComplexity="O(n²)"
 * />
 * ```
 */
const difficultyKeyMap: Record<DifficultyLevel, string> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
  expert: 'expert',
};

export function AlgorithmCard({
  title,
  description,
  category,
  difficulty,
  href,
  icon: Icon,
  timeComplexity,
  disabled = false,
}: AlgorithmCardProps) {
  const t = useTranslations('algorithms');
  const styles = categoryStyles[category];

  const cardContent = (
    <m.div
      className={cn(
        'group relative p-6 rounded-xl border transition-all duration-300 overflow-hidden',
        `bg-gradient-to-br ${styles.gradient}`,
        styles.border,
        styles.shadow,
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
      whileHover={disabled ? {} : { y: -4 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hover overlay */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300',
          `bg-gradient-to-br ${styles.gradient}`,
          !disabled && 'group-hover:opacity-100',
        )}
      />

      {/* Content */}
      <div className="relative flex flex-col h-full">
        {/* Header with icon and badges */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn('p-3 rounded-lg', styles.iconBg)} aria-hidden="true">
            <Icon className={cn('h-6 w-6', styles.text)} />
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0 min-w-0">
            {/* Difficulty badge */}
            <span
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-md border whitespace-nowrap',
                difficultyColors[difficulty],
              )}
              aria-label={`${t('page.difficulty')}: ${t(`difficulty.${difficultyKeyMap[difficulty]}`)}`}
            >
              {t(`difficulty.${difficultyKeyMap[difficulty]}`)}
            </span>

            {/* Time complexity badge */}
            {timeComplexity && (
              <span
                className="px-2 py-1 text-xs font-mono bg-muted/20 text-foreground/80 rounded-md border border-border whitespace-nowrap"
                aria-label={`Time complexity: ${timeComplexity}`}
              >
                {timeComplexity}
              </span>
            )}
          </div>
        </div>

        {/* Title and description */}
        <div className="flex-1">
          <h3 className={cn('text-xl font-semibold mb-2', styles.text)}>{title}</h3>
          <p className="text-sm text-foreground/80 leading-relaxed">{description}</p>
        </div>

        {/* Explore link */}
        <div
          className={cn(
            'flex items-center gap-2 mt-4 text-sm font-medium',
            styles.text,
            'group-hover:translate-x-2 transition-transform duration-300',
          )}
        >
          <span>{t('card.explore')}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </div>

        {/* Disabled overlay */}
        {disabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
            <span className="text-sm font-medium text-foreground/80">{t('card.comingSoon')}</span>
          </div>
        )}
      </div>
    </m.div>
  );

  if (disabled) {
    return (
      <Link
        href={href}
        aria-disabled="true"
        tabIndex={-1}
        role="link"
        className="block pointer-events-none rounded-xl"
        aria-label={`${title} - ${difficulty} level ${category.replace('-', ' ')} algorithm (coming soon)`}
        onClick={(e) => e.preventDefault()}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl"
      aria-label={`Explore ${title} - ${difficulty} level ${category.replace('-', ' ')} algorithm`}
    >
      {cardContent}
    </Link>
  );
}
