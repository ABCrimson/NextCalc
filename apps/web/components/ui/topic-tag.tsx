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

const topicConfig: Record<MathTopic, { label: string; color: string }> = {
  calculus: {
    label: 'Calculus',
    color:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700',
  },
  algebra: {
    label: 'Algebra',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700',
  },
  geometry: {
    label: 'Geometry',
    color:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700',
  },
  topology: {
    label: 'Topology',
    color:
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400 border-pink-300 dark:border-pink-700',
  },
  'number-theory': {
    label: 'Number Theory',
    color:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700',
  },
  combinatorics: {
    label: 'Combinatorics',
    color:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700',
  },
  'linear-algebra': {
    label: 'Linear Algebra',
    color:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700',
  },
  'differential-equations': {
    label: 'Differential Equations',
    color:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700',
  },
  'complex-analysis': {
    label: 'Complex Analysis',
    color:
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-300 dark:border-cyan-700',
  },
  probability: {
    label: 'Probability',
    color:
      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-300 dark:border-teal-700',
  },
  statistics: {
    label: 'Statistics',
    color:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700',
  },
  logic: {
    label: 'Logic',
    color:
      'bg-muted/50 text-muted-foreground dark:bg-background/30 dark:text-muted-foreground border-border dark:border-border',
  },
  'set-theory': {
    label: 'Set Theory',
    color:
      'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-violet-300 dark:border-violet-700',
  },
  'graph-theory': {
    label: 'Graph Theory',
    color:
      'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 border-fuchsia-300 dark:border-fuchsia-700',
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
          <X className="h-3 w-3" aria-hidden="true" />
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
    <div className={cn('flex flex-wrap gap-2', className)} role="group" aria-label="Topic tags">
      {topics.map((topic) => (
        <TopicTag
          key={topic}
          topic={topic}
          removable={removable}
          onRemove={() => onRemove?.(topic)}
          size={size}
        />
      ))}
    </div>
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
