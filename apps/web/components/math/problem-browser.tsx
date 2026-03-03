'use client';

import type { MathTopic } from '@nextcalc/math-engine/knowledge';
import type { DifficultyLevel, Problem, ProblemFilter } from '@nextcalc/math-engine/problems';
import { ProblemType } from '@nextcalc/math-engine/problems';
import { AnimatePresence, m } from 'framer-motion';
import {
  Bookmark,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  List,
  Search,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Branded type for view mode
 */
type ViewMode = ('grid' | 'list') & { __brand: 'ViewMode' };

/**
 * Branded type for sort option
 */
type SortOption = ('difficulty' | 'date' | 'popularity' | 'title') & { __brand: 'SortOption' };

/**
 * Props for ProblemBrowser component
 */
export interface ProblemBrowserProps {
  /** Initial problems to display */
  problems: ReadonlyArray<Problem>;
  /** Bookmarked problem IDs */
  bookmarkedIds?: ReadonlyArray<string>;
  /** Callback when a problem is selected */
  onSelectProblem?: (problem: Problem) => void;
  /** Callback when bookmark is toggled */
  onToggleBookmark?: (problemId: string) => void;
  /** User progress data (problem ID -> completion percentage) */
  progress?: ReadonlyMap<string, number>;
  /** Callback when filters change */
  onFilterChange?: (filters: ProblemFilter) => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Difficulty level display configuration
 */
const DIFFICULTY_CONFIG = {
  1: { label: 'Beginner', variant: 'beginner' as const, color: 'from-green-500 to-emerald-500' },
  2: {
    label: 'Intermediate',
    variant: 'intermediate' as const,
    color: 'from-blue-500 to-cyan-500',
  },
  3: { label: 'Advanced', variant: 'advanced' as const, color: 'from-purple-500 to-pink-500' },
  4: { label: 'Expert', variant: 'expert' as const, color: 'from-orange-500 to-red-500' },
  5: { label: 'Research', variant: 'research' as const, color: 'from-red-600 to-rose-600' },
} satisfies Record<DifficultyLevel, { label: string; variant: string; color: string }>;

/**
 * Topic color configuration
 */
const TOPIC_COLORS = {
  Calculus: 'from-blue-600 to-cyan-600',
  Algebra: 'from-purple-600 to-pink-600',
  'Number Theory': 'from-green-600 to-emerald-600',
  Topology: 'from-orange-600 to-red-600',
  Analysis: 'from-indigo-600 to-violet-600',
  Geometry: 'from-teal-600 to-cyan-600',
  'Linear Algebra': 'from-fuchsia-600 to-purple-600',
  'Differential Equations': 'from-amber-600 to-orange-600',
  Statistics: 'from-rose-600 to-pink-600',
} satisfies Partial<Record<MathTopic, string>>;

/**
 * Problem Browser Component
 *
 * A comprehensive interface for browsing, searching, and filtering mathematical problems.
 *
 * Features:
 * - Grid/List view toggle
 * - Advanced filtering (topic, difficulty, type)
 * - Full-text search
 * - Sorting options
 * - Bookmark support
 * - Progress indicators
 * - Responsive design with mobile-first approach
 *
 * Accessibility:
 * - Full keyboard navigation (Tab, Enter, Escape)
 * - ARIA labels and live regions
 * - Screen reader announcements for filter changes
 * - High contrast mode support
 */
export function ProblemBrowser({
  problems,
  bookmarkedIds = [],
  onSelectProblem,
  onToggleBookmark,
  progress = new Map(),
  onFilterChange,
  isLoading = false,
}: ProblemBrowserProps) {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('grid' as ViewMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<Set<MathTopic>>(new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<DifficultyLevel>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<ProblemType>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('difficulty' as SortOption);
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const problemsPerPage = 12;

  // Filter problems based on search and filters
  const filteredProblems = useMemo(() => {
    let filtered = [...problems];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.statement.toLowerCase().includes(query) ||
          p.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Topic filter
    if (selectedTopics.size > 0) {
      filtered = filtered.filter((p) => selectedTopics.has(p.topic));
    }

    // Difficulty filter
    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter((p) => selectedDifficulties.has(p.difficulty));
    }

    // Type filter
    if (selectedTypes.size > 0) {
      filtered = filtered.filter((p) => selectedTypes.has(p.type));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'difficulty':
          return a.difficulty - b.difficulty;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'popularity':
          return b.points - a.points;
        case 'date':
          // For now, sort by ID (newer problems have higher IDs)
          return b.id.localeCompare(a.id);
        default:
          return 0;
      }
    });

    return filtered;
  }, [problems, searchQuery, selectedTopics, selectedDifficulties, selectedTypes, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * problemsPerPage,
    currentPage * problemsPerPage,
  );

  // Reset to first page when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentional triggers to reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTopics, selectedDifficulties, selectedTypes, sortBy]);

  // Notify parent of filter changes
  useEffect(() => {
    if (onFilterChange) {
      const filters: ProblemFilter = {
        ...(selectedTopics.size > 0 ? { topics: Array.from(selectedTopics) } : {}),
        ...(selectedDifficulties.size > 0
          ? {
              difficulty: {
                min: Math.min(...selectedDifficulties),
                max: Math.max(...selectedDifficulties),
              },
            }
          : {}),
        ...(selectedTypes.size > 0 ? { types: Array.from(selectedTypes) } : {}),
        ...(searchQuery ? { query: searchQuery } : {}),
      };
      onFilterChange(filters);
    }
  }, [searchQuery, selectedTopics, selectedDifficulties, selectedTypes, onFilterChange]);

  // Extract unique topics from problems
  const availableTopics = useMemo(
    () => Array.from(new Set(problems.map((p) => p.topic))).sort(),
    [problems],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent, problem: Problem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectProblem?.(problem);
      }
    },
    [onSelectProblem],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6" role="region" aria-label="Problem Browser">
      {/* Filter Sidebar */}
      <aside
        className={cn(
          'lg:w-80 space-y-4 transition-all duration-300',
          showFilters ? 'block' : 'hidden lg:block',
        )}
        aria-label="Filter Controls"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden"
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Topics */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Topics</h3>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {availableTopics.map((topic) => (
                    <label
                      key={topic}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.has(topic)}
                        onChange={(e) => {
                          const newTopics = new Set(selectedTopics);
                          if (e.target.checked) {
                            newTopics.add(topic);
                          } else {
                            newTopics.delete(topic);
                          }
                          setSelectedTopics(newTopics);
                        }}
                        className="rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-label={`Filter by ${topic}`}
                      />
                      <span className="text-sm">{topic}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Separator />

            {/* Difficulty */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Difficulty</h3>
              <div className="space-y-2">
                {Object.entries(DIFFICULTY_CONFIG).map(([level, config]) => (
                  <label
                    key={level}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDifficulties.has(Number(level) as DifficultyLevel)}
                      onChange={(e) => {
                        const newDifficulties = new Set(selectedDifficulties);
                        const diffLevel = Number(level) as DifficultyLevel;
                        if (e.target.checked) {
                          newDifficulties.add(diffLevel);
                        } else {
                          newDifficulties.delete(diffLevel);
                        }
                        setSelectedDifficulties(newDifficulties);
                      }}
                      className="rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-label={`Filter by ${config.label} difficulty`}
                    />
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Problem Type */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Type</h3>
              <div className="space-y-2">
                {Object.values(ProblemType).map((type) => (
                  <label
                    key={type}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(type)}
                      onChange={(e) => {
                        const newTypes = new Set(selectedTypes);
                        if (e.target.checked) {
                          newTypes.add(type);
                        } else {
                          newTypes.delete(type);
                        }
                        setSelectedTypes(newTypes);
                      }}
                      className="rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-label={`Filter by ${type} problems`}
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedTopics(new Set());
                setSelectedDifficulties(new Set());
                setSelectedTypes(new Set());
                setSearchQuery('');
              }}
              disabled={
                selectedTopics.size === 0 &&
                selectedDifficulties.size === 0 &&
                selectedTypes.size === 0 &&
                !searchQuery
              }
            >
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      </aside>

      {/* Main Content */}
      <main className="flex-1 space-y-4" aria-label="Problem List">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search problems"
            />
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid' as ViewMode)}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list' as ViewMode)}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 rounded-md border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Sort problems"
          >
            <option value="difficulty">Sort by Difficulty</option>
            <option value="title">Sort by Title</option>
            <option value="popularity">Sort by Popularity</option>
            <option value="date">Sort by Date</option>
          </select>

          {/* Mobile Filter Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden"
            aria-label={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Showing {paginatedProblems.length} of {filteredProblems.length} problems
        </div>

        {/* Problem Grid/List */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded" />
                      <div className="h-4 bg-muted rounded w-5/6" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : paginatedProblems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  No problems found matching your filters.
                  <br />
                  Try adjusting your search criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            <m.div
              key={viewMode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'grid gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
              )}
            >
              {paginatedProblems.map((problem, index) => {
                const problemProgress = progress.get(problem.id);
                return (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    isBookmarked={bookmarkedIds.includes(problem.id)}
                    {...(problemProgress !== undefined ? { progress: problemProgress } : {})}
                    onSelect={() => onSelectProblem?.(problem)}
                    onToggleBookmark={() => onToggleBookmark?.(problem.id)}
                    onKeyDown={(e) => handleKeyDown(e, problem)}
                    viewMode={viewMode}
                    index={index}
                  />
                );
              })}
            </m.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Problem Card Component
 */
interface ProblemCardProps {
  problem: Problem;
  isBookmarked: boolean;
  progress?: number;
  onSelect: () => void;
  onToggleBookmark: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  viewMode: ViewMode;
  index: number;
}

function ProblemCard({
  problem,
  isBookmarked,
  progress = 0,
  onSelect,
  onToggleBookmark,
  onKeyDown,
  viewMode,
  index,
}: ProblemCardProps) {
  const difficultyConfig = DIFFICULTY_CONFIG[problem.difficulty];
  const topicColor =
    (TOPIC_COLORS as Record<string, string>)[problem.topic] || 'from-muted to-muted/80';

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        className={cn(
          'group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        )}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${problem.title}, ${difficultyConfig.label} difficulty, ${problem.topic}`}
      >
        {/* Gradient border effect */}
        <div
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            'bg-gradient-to-br',
            topicColor,
            'blur-xl -z-10',
          )}
        />

        {/* Progress bar */}
        {progress > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
            <m.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn('h-full bg-gradient-to-r', topicColor)}
            />
          </div>
        )}

        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                {problem.title}
              </CardTitle>
              <CardDescription className="mt-1">
                <Badge variant={difficultyConfig.variant} className="text-xs">
                  {difficultyConfig.label}
                </Badge>
                <span className="mx-2 text-muted-foreground">•</span>
                <span
                  className={cn(
                    'font-medium bg-gradient-to-r bg-clip-text text-transparent',
                    topicColor,
                  )}
                >
                  {problem.topic}
                </span>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              className="shrink-0"
            >
              {isBookmarked ? (
                <Bookmark className="h-4 w-4 fill-current text-primary" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <p
            className={cn(
              'text-sm text-muted-foreground',
              viewMode === 'grid' ? 'line-clamp-3' : 'line-clamp-2',
            )}
          >
            {problem.statement}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-3">
            {problem.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {problem.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{problem.tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1"
              title={`Estimated time: ${problem.estimatedTime} minutes`}
            >
              <Clock className="h-3 w-3" />
              <span>{problem.estimatedTime}m</span>
            </div>
            <div className="flex items-center gap-1" title={`Points: ${problem.points}`}>
              <Trophy className="h-3 w-3" />
              <span>{problem.points}</span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {problem.type}
          </Badge>
        </CardFooter>
      </Card>
    </m.div>
  );
}
