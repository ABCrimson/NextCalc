'use client';

import { Clock, Layers, Calendar, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { AlgorithmCategory, DifficultyLevel } from './AlgorithmCard';

export interface AlgorithmMetadataProps {
  /** Algorithm category */
  category: AlgorithmCategory;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** Time complexity */
  timeComplexity: string;
  /** Space complexity */
  spaceComplexity: string;
  /** Year introduced/published */
  yearIntroduced?: number;
  /** Tags for filtering and search */
  tags?: string[];
  /** Additional CSS classes */
  className?: string;
}

const categoryKeyMap: Record<AlgorithmCategory, string> = {
  'machine-learning': 'machineLearning',
  cryptography: 'cryptography',
  quantum: 'quantumComputing',
  'graph-theory': 'graphTheory',
  'signal-processing': 'signalProcessing',
  'game-theory': 'gameTheory',
  'dynamical-systems': 'dynamicalSystems',
  'numerical-analysis': 'numericalAnalysis',
};

const difficultyKeyMap: Record<DifficultyLevel, string> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
  expert: 'expert',
};

const difficultyColors: Record<DifficultyLevel, string> = {
  beginner: 'bg-green-500/20 text-green-300 border-green-500/30',
  intermediate: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  advanced: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  expert: 'bg-red-500/20 text-red-300 border-red-500/30',
};

/**
 * AlgorithmMetadata Component
 *
 * Displays comprehensive metadata for an algorithm including
 * category, difficulty, complexity, year, and tags.
 *
 * Accessibility:
 * - Semantic list structure
 * - Icon labels for screen readers
 * - Proper color contrast
 * - Descriptive aria-labels
 *
 * @example
 * ```tsx
 * <AlgorithmMetadata
 *   category="machine-learning"
 *   difficulty="intermediate"
 *   timeComplexity="O(n²d)"
 *   spaceComplexity="O(n²)"
 *   yearIntroduced={2017}
 *   tags={['attention', 'neural networks', 'NLP']}
 * />
 * ```
 */
export function AlgorithmMetadata({
  category,
  difficulty,
  timeComplexity,
  spaceComplexity,
  yearIntroduced,
  tags,
  className,
}: AlgorithmMetadataProps) {
  const t = useTranslations('algorithms');

  return (
    <div
      className={cn(
        'p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm',
        className
      )}
    >
      <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{t('page.algorithmInfo')}</h3>

      <dl className="space-y-3 sm:space-y-4">
        {/* Category */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm sm:min-w-[100px]">
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
            <span>{t('page.category')}</span>
          </dt>
          <dd className="font-medium text-sm sm:text-base pl-5 sm:pl-0 min-w-0 break-words">{t(`category.${categoryKeyMap[category]}`)}</dd>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm sm:min-w-[100px]">
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
            <span>{t('page.difficulty')}</span>
          </dt>
          <dd className="pl-5 sm:pl-0 min-w-0">
            <span
              className={cn(
                'inline-block px-3 py-1 text-sm font-medium rounded-md border',
                difficultyColors[difficulty]
              )}
            >
              {t(`difficulty.${difficultyKeyMap[difficulty]}`)}
            </span>
          </dd>
        </div>

        {/* Time Complexity */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm sm:min-w-[100px]">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
            <span>{t('page.timeComplexity')}</span>
          </dt>
          <dd className="font-mono text-xs sm:text-sm bg-muted/20 px-2 py-1 rounded border border-border inline-block ml-5 sm:ml-0 max-w-full overflow-x-auto whitespace-nowrap">
            {timeComplexity}
          </dd>
        </div>

        {/* Space Complexity */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm sm:min-w-[100px]">
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
            <span>{t('page.spaceComplexity')}</span>
          </dt>
          <dd className="font-mono text-xs sm:text-sm bg-muted/20 px-2 py-1 rounded border border-border inline-block ml-5 sm:ml-0 max-w-full overflow-x-auto whitespace-nowrap">
            {spaceComplexity}
          </dd>
        </div>

        {/* Year Introduced */}
        {yearIntroduced && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm sm:min-w-[100px]">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
              <span>{t('page.yearIntroduced')}</span>
            </dt>
            <dd className="font-medium text-sm sm:text-base pl-5 sm:pl-0">{yearIntroduced}</dd>
          </div>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm sm:min-w-[100px] shrink-0">
              <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
              <span>{t('page.tags')}</span>
            </dt>
            <dd className="flex flex-wrap gap-1.5 sm:gap-2 pl-5 sm:pl-0">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-md"
                >
                  {tag}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
