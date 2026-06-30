'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Mathematical topics as branded type
 */
export type MathTopic =
  | 'calculus'
  | 'algebra'
  | 'geometry'
  | 'topology'
  | 'number-theory'
  | 'combinatorics'
  | 'linear-algebra'
  | 'differential-equations'
  | 'complex-analysis'
  | 'probability'
  | 'statistics'
  | 'logic'
  | 'set-theory'
  | 'graph-theory';

/**
 * TopicTag Component
 *
 * Colored tag for mathematical topics with optional remove functionality.
 *
 * @example
 * ```tsx
 * <TopicTag topic="calculus" />
 * <TopicTag topic="algebra" removable onRemove={() => {}} />
 * ```
 *
 * Features:
 * - Color-coded topics
 * - Optional remove button
 * - Hover effects
 * - Accessible with keyboard support
 *
 * Accessibility:
 * - Keyboard accessible remove button
 * - Clear ARIA labels
 * - Proper focus management
 */

export interface TopicTagProps {
  /** Mathematical topic */
  topic: MathTopic;

  /** Enable remove button */
  removable?: boolean;

  /** Callback when remove button clicked */
  onRemove?: () => void;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Additional CSS classes */
  className?: string;
}

// Colors are driven by semantic oklch category tokens defined in globals.css
// (--color-topic-{name}-{bg,fg,border}). The tokens carry their own
// [data-theme='dark'] overrides, so no dark: variants are needed here and the
// values are identical to the previous Tailwind-palette utilities.
const topicConfig: Record<MathTopic, { label: string; color: string }> = {
  calculus: {
    label: 'Calculus',
    color: 'bg-topic-calculus-bg text-topic-calculus-fg border-topic-calculus-border',
  },
  algebra: {
    label: 'Algebra',
    color: 'bg-topic-algebra-bg text-topic-algebra-fg border-topic-algebra-border',
  },
  geometry: {
    label: 'Geometry',
    color: 'bg-topic-geometry-bg text-topic-geometry-fg border-topic-geometry-border',
  },
  topology: {
    label: 'Topology',
    color: 'bg-topic-topology-bg text-topic-topology-fg border-topic-topology-border',
  },
  'number-theory': {
    label: 'Number Theory',
    color:
      'bg-topic-number-theory-bg text-topic-number-theory-fg border-topic-number-theory-border',
  },
  combinatorics: {
    label: 'Combinatorics',
    color:
      'bg-topic-combinatorics-bg text-topic-combinatorics-fg border-topic-combinatorics-border',
  },
  'linear-algebra': {
    label: 'Linear Algebra',
    color:
      'bg-topic-linear-algebra-bg text-topic-linear-algebra-fg border-topic-linear-algebra-border',
  },
  'differential-equations': {
    label: 'Differential Equations',
    color:
      'bg-topic-differential-equations-bg text-topic-differential-equations-fg border-topic-differential-equations-border',
  },
  'complex-analysis': {
    label: 'Complex Analysis',
    color:
      'bg-topic-complex-analysis-bg text-topic-complex-analysis-fg border-topic-complex-analysis-border',
  },
  probability: {
    label: 'Probability',
    color: 'bg-topic-probability-bg text-topic-probability-fg border-topic-probability-border',
  },
  statistics: {
    label: 'Statistics',
    color: 'bg-topic-statistics-bg text-topic-statistics-fg border-topic-statistics-border',
  },
  logic: {
    label: 'Logic',
    color: 'bg-topic-logic-bg text-topic-logic-fg border-topic-logic-border',
  },
  'set-theory': {
    label: 'Set Theory',
    color: 'bg-topic-set-theory-bg text-topic-set-theory-fg border-topic-set-theory-border',
  },
  'graph-theory': {
    label: 'Graph Theory',
    color: 'bg-topic-graph-theory-bg text-topic-graph-theory-fg border-topic-graph-theory-border',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
} as const;

export function TopicTag({
  topic,
  removable = false,
  onRemove,
  size = 'md',
  className,
}: TopicTagProps) {
  const config = topicConfig[topic];

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium border',
        config.color,
        sizeClasses[size],
        removable && 'pr-1 gap-1',
        className,
      )}
    >
      <span>{config.label}</span>
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
          aria-label={`Remove ${config.label} tag`}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </Badge>
  );
}

/**
 * TopicTagGroup Component
 *
 * Group of topic tags with wrapping and spacing.
 *
 * @example
 * ```tsx
 * <TopicTagGroup
 *   topics={['calculus', 'algebra']}
 *   onRemove={(topic) => console.log('Remove', topic)}
 * />
 * ```
 */
export function TopicTagGroup({
  topics,
  removable = false,
  onRemove,
  size = 'md',
  className,
}: {
  topics: MathTopic[];
  removable?: boolean;
  onRemove?: (topic: MathTopic) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <fieldset
      className={cn('flex flex-wrap gap-2 border-0 p-0 m-0', className)}
      aria-label="Topic tags"
    >
      {topics.map((topic) => (
        <TopicTag
          key={topic}
          topic={topic}
          removable={removable}
          onRemove={() => onRemove?.(topic)}
          size={size}
        />
      ))}
    </fieldset>
  );
}

/**
 * Get all available topics
 */
export function getAllTopics(): MathTopic[] {
  return Object.keys(topicConfig) as MathTopic[];
}

/**
 * Get topic display label
 */
export function getTopicLabel(topic: MathTopic): string {
  return topicConfig[topic].label;
}
