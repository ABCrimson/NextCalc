'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AlgorithmCategory, DifficultyLevel } from './AlgorithmCard';

export interface CategoryFilterProps {
  /** Selected categories */
  selectedCategories: AlgorithmCategory[];
  /** Selected difficulty levels */
  selectedDifficulties: DifficultyLevel[];
  /** Search query */
  searchQuery: string;
  /** Callback when categories change */
  onCategoriesChange: (categories: AlgorithmCategory[]) => void;
  /** Callback when difficulties change */
  onDifficultiesChange: (difficulties: DifficultyLevel[]) => void;
  /** Callback when search changes */
  onSearchChange: (query: string) => void;
  /** Additional CSS classes */
  className?: string;
}

const categoryItems: { value: AlgorithmCategory; key: string; color: string }[] = [
  { value: 'machine-learning', key: 'machineLearning', color: 'bg-blue-500' },
  { value: 'cryptography', key: 'cryptography', color: 'bg-purple-500' },
  { value: 'quantum', key: 'quantumComputing', color: 'bg-emerald-500' },
  { value: 'graph-theory', key: 'graphTheory', color: 'bg-amber-500' },
  { value: 'signal-processing', key: 'signalProcessing', color: 'bg-cyan-500' },
  { value: 'game-theory', key: 'gameTheory', color: 'bg-rose-500' },
  { value: 'dynamical-systems', key: 'dynamicalSystems', color: 'bg-indigo-500' },
  { value: 'numerical-analysis', key: 'numericalAnalysis', color: 'bg-orange-500' },
];

const difficultyItems: { value: DifficultyLevel; key: string; color: string }[] = [
  { value: 'beginner', key: 'beginner', color: 'bg-green-500' },
  { value: 'intermediate', key: 'intermediate', color: 'bg-blue-500' },
  { value: 'advanced', key: 'advanced', color: 'bg-orange-500' },
  { value: 'expert', key: 'expert', color: 'bg-red-500' },
];

/**
 * CategoryFilter Component
 *
 * Provides filtering controls for algorithm search and discovery.
 * Includes category filters, difficulty filters, and text search.
 *
 * Accessibility:
 * - Semantic form elements
 * - Label associations
 * - Keyboard navigable
 * - Focus indicators
 * - ARIA labels for screen readers
 * - Clear visual state for selections
 *
 * @example
 * ```tsx
 * const [categories, setCategories] = useState<AlgorithmCategory[]>([]);
 * const [difficulties, setDifficulties] = useState<DifficultyLevel[]>([]);
 * const [search, setSearch] = useState('');
 *
 * <CategoryFilter
 *   selectedCategories={categories}
 *   selectedDifficulties={difficulties}
 *   searchQuery={search}
 *   onCategoriesChange={setCategories}
 *   onDifficultiesChange={setDifficulties}
 *   onSearchChange={setSearch}
 * />
 * ```
 */
export function CategoryFilter({
  selectedCategories,
  selectedDifficulties,
  searchQuery,
  onCategoriesChange,
  onDifficultiesChange,
  onSearchChange,
  className,
}: CategoryFilterProps) {
  const t = useTranslations('algorithms');
  const toggleCategory = (category: AlgorithmCategory) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  const toggleDifficulty = (difficulty: DifficultyLevel) => {
    if (selectedDifficulties.includes(difficulty)) {
      onDifficultiesChange(selectedDifficulties.filter((d) => d !== difficulty));
    } else {
      onDifficultiesChange([...selectedDifficulties, difficulty]);
    }
  };

  const clearAll = () => {
    onCategoriesChange([]);
    onDifficultiesChange([]);
    onSearchChange('');
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedDifficulties.length > 0 ||
    searchQuery.length > 0;

  return (
    <div
      className={cn(
        'p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm',
        className
      )}
    >
      {/* Header with clear button */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">{t('filter.title')}</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm px-2 py-1"
            aria-label={t('clearAllFilters')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t('filter.clearAll')}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Label htmlFor="algorithm-search" className="text-sm font-medium mb-2 block">
          {t('filter.search')}
        </Label>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="algorithm-search"
            type="text"
            placeholder={t('filter.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            aria-label={t('filter.searchAriaLabel')}
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-3 block">{t('filter.categories')}</Label>
        <div className="flex flex-wrap gap-2">
          {categoryItems.map((category) => {
            const isSelected = selectedCategories.includes(category.value);
            const label = t(`category.${category.key}`);
            return (
              <button
                key={category.value}
                onClick={() => toggleCategory(category.value)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  'border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isSelected
                    ? `${category.color} text-white border-transparent shadow-md`
                    : 'bg-background text-foreground border-border hover:border-foreground/50'
                )}
                aria-pressed={isSelected}
                aria-label={label}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty filters */}
      <div>
        <Label className="text-sm font-medium mb-3 block">{t('filter.difficulty')}</Label>
        <div className="flex flex-wrap gap-2">
          {difficultyItems.map((difficulty) => {
            const isSelected = selectedDifficulties.includes(difficulty.value);
            const label = t(`difficulty.${difficulty.key}`);
            return (
              <button
                key={difficulty.value}
                onClick={() => toggleDifficulty(difficulty.value)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  'border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isSelected
                    ? `${difficulty.color} text-white border-transparent shadow-md`
                    : 'bg-background text-foreground border-border hover:border-foreground/50'
                )}
                aria-pressed={isSelected}
                aria-label={label}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filters count */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {selectedCategories.length + selectedDifficulties.length > 0 && (
              <span>
                {selectedCategories.length + selectedDifficulties.length !== 1
                  ? t('filter.filtersActivePlural', { count: selectedCategories.length + selectedDifficulties.length })
                  : t('filter.filtersActive', { count: selectedCategories.length + selectedDifficulties.length })}
              </span>
            )}
            {searchQuery && (
              <span>
                {selectedCategories.length + selectedDifficulties.length > 0 && ' • '}
                {t('filter.searchingFor', { query: searchQuery })}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
