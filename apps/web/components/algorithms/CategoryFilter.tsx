'use client';

import { Search, X } from 'lucide-react';
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

const categories: { value: AlgorithmCategory; label: string; color: string }[] = [
  { value: 'machine-learning', label: 'Machine Learning', color: 'bg-blue-500' },
  { value: 'cryptography', label: 'Cryptography', color: 'bg-purple-500' },
  { value: 'quantum', label: 'Quantum Computing', color: 'bg-emerald-500' },
  { value: 'graph-theory', label: 'Graph Theory', color: 'bg-amber-500' },
  { value: 'signal-processing', label: 'Signal Processing', color: 'bg-cyan-500' },
  { value: 'game-theory', label: 'Game Theory', color: 'bg-rose-500' },
  { value: 'dynamical-systems', label: 'Dynamical Systems', color: 'bg-indigo-500' },
  { value: 'numerical-analysis', label: 'Numerical Analysis', color: 'bg-orange-500' },
];

const difficulties: { value: DifficultyLevel; label: string; color: string }[] = [
  { value: 'beginner', label: 'Beginner', color: 'bg-green-500' },
  { value: 'intermediate', label: 'Intermediate', color: 'bg-blue-500' },
  { value: 'advanced', label: 'Advanced', color: 'bg-orange-500' },
  { value: 'expert', label: 'Expert', color: 'bg-red-500' },
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
        <h3 className="text-lg font-semibold">Filter Algorithms</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm px-2 py-1"
            aria-label="Clear all filters"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Label htmlFor="algorithm-search" className="text-sm font-medium mb-2 block">
          Search
        </Label>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="algorithm-search"
            type="text"
            placeholder="Search algorithms..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            aria-label="Search algorithms by name or description"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-3 block">Categories</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.value);
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
                aria-label={`Filter by ${category.label}`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty filters */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Difficulty</Label>
        <div className="flex flex-wrap gap-2">
          {difficulties.map((difficulty) => {
            const isSelected = selectedDifficulties.includes(difficulty.value);
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
                aria-label={`Filter by ${difficulty.label} difficulty`}
              >
                {difficulty.label}
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
                {selectedCategories.length + selectedDifficulties.length} filter
                {selectedCategories.length + selectedDifficulties.length !== 1 ? 's' : ''} active
              </span>
            )}
            {searchQuery && (
              <span>
                {selectedCategories.length + selectedDifficulties.length > 0 && ' • '}
                Searching for "{searchQuery}"
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
