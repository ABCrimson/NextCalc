'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Filter, Grid3x3, Heart, List, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DifficultyBadge, type DifficultyLevel } from '@/components/ui/difficulty-badge';
import { Input } from '@/components/ui/input';
import { ProgressRing } from '@/components/ui/progress-ring';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllTopics, type MathTopic, TopicTag, TopicTagGroup } from '@/components/ui/topic-tag';
import { cn, debounce, fuzzyMatch } from '@/lib/utils';
import type { Problem, ProblemSortBy, SortDirection } from '@/types/problems';

/**
 * ProblemBrowser Component
 *
 * Comprehensive problem browsing interface with filtering, search, and pagination.
 *
 * @example
 * ```tsx
 * <ProblemBrowser
 *   problems={problems}
 *   onProblemSelect={(problem) => router.push(`/problems/${problem.id}`)}
 * />
 * ```
 *
 * Features:
 * - Filterable by topic, difficulty, and status
 * - Search with fuzzy matching
 * - Grid/List view toggle
 * - Pagination with customizable page size
 * - Favorites/bookmarks system
 * - Progress indicators
 * - Sort by multiple criteria
 * - Responsive design
 * - Smooth animations
 *
 * Accessibility:
 * - Keyboard navigation for all controls
 * - ARIA labels and landmarks
 * - Focus management
 * - Screen reader announcements for filter changes
 */

export interface ProblemBrowserProps {
  /** Array of problems to display */
  problems: Problem[];

  /** Callback when a problem is selected */
  onProblemSelect: (problem: Problem) => void;

  /** Callback when favorite status changes */
  onToggleFavorite?: (problemId: string) => void;

  /** Initial view mode */
  initialViewMode?: 'grid' | 'list';

  /** Items per page */
  itemsPerPage?: number;

  /** Show favorites filter */
  showFavorites?: boolean;

  /** Additional CSS classes */
  className?: string;
}

export function ProblemBrowser({
  problems,
  onProblemSelect,
  onToggleFavorite,
  initialViewMode = 'grid',
  itemsPerPage = 12,
  showFavorites = true,
  className,
}: ProblemBrowserProps) {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<MathTopic[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyLevel[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<ProblemSortBy>('recent');
  const [sortDirection] = useState<SortDirection>('desc');

  // Debounced search
  const handleSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearchQuery(query);
        setCurrentPage(1); // Reset to first page on search
      }, 300),
    [],
  );

  // Filter and sort problems
  const filteredProblems = useMemo(() => {
    let filtered = [...problems];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (problem) =>
          fuzzyMatch(problem.title, searchQuery) || fuzzyMatch(problem.description, searchQuery),
      );
    }

    // Apply topic filter
    if (selectedTopics.length > 0) {
      filtered = filtered.filter((problem) =>
        problem.topics.some((topic) => selectedTopics.includes(topic)),
      );
    }

    // Apply difficulty filter
    if (selectedDifficulties.length > 0) {
      filtered = filtered.filter((problem) => selectedDifficulties.includes(problem.difficulty));
    }

    // Apply favorites filter
    if (showOnlyFavorites) {
      filtered = filtered.filter((problem) => problem.isFavorite);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'difficulty': {
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3, master: 4 };
          comparison = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
          break;
        }
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'recent':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'popular':
          comparison = (a.attempts || 0) - (b.attempts || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [
    problems,
    searchQuery,
    selectedTopics,
    selectedDifficulties,
    showOnlyFavorites,
    sortBy,
    sortDirection,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const toggleTopic = (topic: MathTopic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
    handleFilterChange();
  };

  const toggleDifficulty = (difficulty: DifficultyLevel) => {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty) ? prev.filter((d) => d !== difficulty) : [...prev, difficulty],
    );
    handleFilterChange();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTopics([]);
    setSelectedDifficulties([]);
    setShowOnlyFavorites(false);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedTopics.length > 0 ||
    selectedDifficulties.length > 0 ||
    showOnlyFavorites;

  return (
    <div className={cn('space-y-6', className)} role="region" aria-label="Problem browser">
      {/* Search and View Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search problems..."
            className="pl-10"
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search problems"
          />
        </div>

        <div className="flex items-center gap-2">
          {showFavorites && (
            <Button
              variant={showOnlyFavorites ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setShowOnlyFavorites(!showOnlyFavorites);
                handleFilterChange();
              }}
              aria-label={showOnlyFavorites ? 'Show all problems' : 'Show only favorites'}
              aria-pressed={showOnlyFavorites}
            >
              <Heart
                className={cn('h-4 w-4', showOnlyFavorites && 'fill-current')}
                aria-hidden="true"
              />
              <span className="ml-2 hidden sm:inline">Favorites</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? (
              <List className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Grid3x3 className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
              Clear all
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Topic Filter */}
          <Select value="" onValueChange={(value) => toggleTopic(value as MathTopic)}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by topic">
              <SelectValue placeholder="Filter by topic" />
            </SelectTrigger>
            <SelectContent>
              {getAllTopics().map((topic) => (
                <SelectItem key={topic} value={topic}>
                  {topic.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Difficulty Filter */}
          <Select value="" onValueChange={(value) => toggleDifficulty(value as DifficultyLevel)}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by difficulty">
              <SelectValue placeholder="Filter by difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="master">Master</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as ProblemSortBy)}>
            <SelectTrigger className="w-[180px]" aria-label="Sort problems">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="difficulty">Difficulty</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Active filters">
            {selectedTopics.map((topic) => (
              <TopicTag key={topic} topic={topic} removable onRemove={() => toggleTopic(topic)} />
            ))}
            {selectedDifficulties.map((difficulty) => (
              <DifficultyBadge key={difficulty} level={difficulty} className="cursor-pointer" />
            ))}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
        Showing {paginatedProblems.length} of {filteredProblems.length} problems
      </div>

      {/* Problem Grid/List */}
      <AnimatePresence mode="wait">
        {paginatedProblems.length === 0 ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground">No problems found matching your filters.</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key={`${viewMode}-${currentPage}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'grid gap-4',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1',
            )}
          >
            {paginatedProblems.map((problem, index) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                viewMode={viewMode}
                onClick={() => onProblemSelect(problem)}
                {...(onToggleFavorite !== undefined && { onToggleFavorite })}
                index={index}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2"
          role="navigation"
          aria-label="Pagination"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                // Show first, last, current, and neighbors
                return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
              })
              .map((page, index, array) => {
                // Add ellipsis
                const prevPage = array[index - 1];
                const showEllipsis = index > 0 && prevPage !== undefined && page - prevPage > 1;

                return (
                  <div key={page} className="flex items-center gap-1">
                    {showEllipsis && <span className="px-2">...</span>}
                    <Button
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </Button>
                  </div>
                );
              })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Problem Card Component
 */
function ProblemCard({
  problem,
  viewMode,
  onClick,
  onToggleFavorite,
  index,
}: {
  problem: Problem;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onToggleFavorite?: (problemId: string) => void;
  index: number;
}) {
  const successRate = problem.successRate || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card
        className={cn(
          'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
          viewMode === 'list' && 'flex',
        )}
        onClick={onClick}
        role="article"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`${problem.title} - ${problem.difficulty} difficulty`}
      >
        <CardHeader className={cn(viewMode === 'list' && 'flex-1')}>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2">{problem.title}</CardTitle>
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(problem.id);
                }}
                aria-label={problem.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={cn(
                    'h-4 w-4 transition-colors',
                    problem.isFavorite && 'fill-red-500 text-red-500',
                  )}
                  aria-hidden="true"
                />
              </Button>
            )}
          </div>

          <CardDescription className="line-clamp-2">{problem.description}</CardDescription>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <DifficultyBadge level={problem.difficulty} />
            {problem.status && (
              <Badge variant={problem.status === 'completed' ? 'default' : 'secondary'}>
                {problem.status}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn('space-y-3', viewMode === 'list' && 'flex items-center gap-4')}>
          <TopicTagGroup topics={problem.topics.slice(0, 3)} size="sm" />

          {problem.successRate !== undefined && (
            <div className="flex items-center gap-3">
              <ProgressRing value={successRate} size={50} strokeWidth={4} showValue />
              <div className="text-xs text-muted-foreground">
                <div>Success Rate</div>
                {problem.attempts && <div>{problem.attempts} attempts</div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
