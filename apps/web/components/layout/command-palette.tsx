'use client';

/**
 * Command Palette
 *
 * A full-featured command palette for NextCalc Pro, opened via Ctrl+K / Cmd+K.
 * Supports fuzzy search across pages, calculator actions, and recent calculations.
 *
 * Features:
 * - Ctrl+K / Cmd+K global keyboard shortcut to open
 * - Fuzzy search with character-level match highlighting
 * - Keyboard navigation (ArrowUp/ArrowDown, Enter, Escape)
 * - Section headers: Pages, Actions, Recent
 * - Framer Motion animations respecting prefers-reduced-motion
 * - WCAG 2.2 AAA accessible (aria-activedescendant, combobox role, live regions)
 *
 * Keyboard Shortcuts:
 * - Ctrl+K / Cmd+K  Open the palette
 * - ArrowUp          Move to previous item
 * - ArrowDown        Move to next item
 * - Enter           Activate selected item
 * - Escape          Close the palette
 *
 * @example
 * ```tsx
 * // Mount once in the root layout (inside a Client Component boundary)
 * <CommandPalette />
 * ```
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { type Variants, motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Calculator,
  TrendingUp,
  Variable,
  Grid3x3,
  Square,
  Ruler,
  Sparkles,
  Activity,
  Trophy,
  Wind,
  Flame,
  Network,
  Brain,
  BarChart2,
  BookOpen,
  PenTool,
  FileQuestion,
  MessageSquare,
  Search,
  X,
  Trash2,
  FlipHorizontal,
  Clock,
  Zap,
  Box,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalculatorHistory, useCalculatorDispatch } from '@/lib/stores/calculator-store';
import type { HistoryEntry } from '@nextcalc/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Discriminated union of all command item kinds. */
type CommandItemKind =
  | { kind: 'page'; href: string }
  | { kind: 'action'; action: () => void }
  | { kind: 'recent'; entry: HistoryEntry };

/** A single searchable command entry. */
interface CommandItem {
  /** Stable unique identifier used for aria-activedescendant and keys. */
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: 'pages' | 'actions' | 'recent';
  /** Keywords beyond the label/description that improve fuzzy ranking. */
  keywords: readonly string[];
  data: CommandItemKind;
}

/** A matched command item with character-level match spans. */
interface MatchedItem {
  item: CommandItem;
  /** Indices in `item.label` that matched the query characters. */
  matchIndices: readonly number[];
  /** Lower score = better match (fewer gaps). */
  score: number;
}

// ---------------------------------------------------------------------------
// Static command data
// ---------------------------------------------------------------------------

const PAGE_COMMANDS = [
  {
    id: 'page-calculator',
    label: 'Calculator',
    description: 'Scientific calculator with history',
    icon: Calculator,
    keywords: ['calc', 'math', 'home', 'compute'],
    href: '/',
  },
  {
    id: 'page-plot',
    label: 'Plot',
    description: '2D and 3D function plotting',
    icon: TrendingUp,
    keywords: ['graph', 'chart', 'function', 'visualize'],
    href: '/plot',
  },
  {
    id: 'page-symbolic',
    label: 'Symbolic',
    description: 'Differentiation and integration',
    icon: Variable,
    keywords: ['differentiate', 'integrate', 'derive', 'calculus', 'algebra'],
    href: '/symbolic',
  },
  {
    id: 'page-matrix',
    label: 'Matrix',
    description: 'Linear algebra operations',
    icon: Grid3x3,
    keywords: ['linear', 'algebra', 'determinant', 'eigenvalue', 'vector'],
    href: '/matrix',
  },
  {
    id: 'page-solver',
    label: 'Solver',
    description: 'Equation solving',
    icon: Square,
    keywords: ['equation', 'roots', 'zeros', 'quadratic'],
    href: '/solver',
  },
  {
    id: 'page-units',
    label: 'Units',
    description: 'Unit conversion',
    icon: Ruler,
    keywords: ['convert', 'measurement', 'metric', 'imperial', 'length', 'mass'],
    href: '/units',
  },
  {
    id: 'page-stats',
    label: 'Stats',
    description: 'Statistical analysis and distributions',
    icon: BarChart2,
    keywords: ['statistics', 'probability', 'distribution', 'mean', 'variance'],
    href: '/stats',
  },
  {
    id: 'page-algorithms',
    label: 'Algorithms',
    description: 'Algorithm hub and categories',
    icon: Sparkles,
    keywords: ['algorithm', 'overview', 'hub'],
    href: '/algorithms',
  },
  {
    id: 'page-fourier',
    label: 'Fourier',
    description: 'FFT and frequency analysis',
    icon: Activity,
    keywords: ['fft', 'frequency', 'signal', 'transform', 'spectrum'],
    href: '/fourier',
  },
  {
    id: 'page-game-theory',
    label: 'Game Theory',
    description: 'Nash equilibrium and strategic games',
    icon: Trophy,
    keywords: ['nash', 'equilibrium', 'strategy', 'payoff', 'prisoner'],
    href: '/game-theory',
  },
  {
    id: 'page-chaos',
    label: 'Chaos',
    description: 'Lorenz attractors and chaos theory',
    icon: Wind,
    keywords: ['lorenz', 'attractor', 'fractal', 'bifurcation', 'butterfly'],
    href: '/chaos',
  },
  {
    id: 'page-pde',
    label: 'PDE',
    description: 'Partial differential equations',
    icon: Flame,
    keywords: ['differential', 'partial', 'heat', 'wave', 'laplace'],
    href: '/pde',
  },
  {
    id: 'page-pde-3d',
    label: 'PDE Solver 3D',
    description: '3D PDE solver with isosurface, slices, and point cloud',
    icon: Box,
    keywords: ['pde', '3d', 'heat', 'wave', 'isosurface', 'marching', 'cubes', 'voxel', 'three'],
    href: '/pde/3d',
  },
  {
    id: 'page-ode',
    label: 'ODE Solver',
    description: 'Ordinary differential equations with phase plane',
    icon: Activity,
    keywords: ['ode', 'ordinary', 'differential', 'euler', 'runge-kutta', 'rk4', 'phase', 'plane', 'direction', 'field', 'trajectory', 'lotka', 'volterra', 'pendulum', 'harmonic'],
    href: '/solver/ode',
  },
  {
    id: 'page-graphs',
    label: 'Graphs',
    description: 'Graph algorithms and visualizations',
    icon: Network,
    keywords: ['dijkstra', 'bfs', 'dfs', 'shortest', 'path', 'node', 'edge'],
    href: '/graphs-full',
  },
  {
    id: 'page-ml',
    label: 'ML Algorithms',
    description: 'Machine learning visualizations',
    icon: Brain,
    keywords: ['machine learning', 'neural', 'clustering', 'regression', 'kmeans'],
    href: '/ml-algorithms',
  },
  {
    id: 'page-learn',
    label: 'Learn',
    description: 'Interactive math learning',
    icon: BookOpen,
    keywords: ['tutorial', 'education', 'course', 'lesson', 'study'],
    href: '/learn',
  },
  {
    id: 'page-practice',
    label: 'Practice',
    description: 'Practice math problems',
    icon: PenTool,
    keywords: ['exercise', 'quiz', 'drill', 'exam', 'test'],
    href: '/practice',
  },
  {
    id: 'page-problems',
    label: 'Problems',
    description: 'Browse math problem sets',
    icon: FileQuestion,
    keywords: ['problem set', 'challenge', 'difficulty', 'browse'],
    href: '/problems',
  },
  {
    id: 'page-forum',
    label: 'Forum',
    description: 'Community discussions and Q&A',
    icon: MessageSquare,
    keywords: ['forum', 'community', 'discuss', 'question', 'answer', 'post', 'thread'],
    href: '/forum',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: readonly string[];
  href: string;
}>;

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

/**
 * Scores a string against a query using a character-sequential fuzzy algorithm.
 * Returns null if no match, otherwise { score, matchIndices }.
 * Lower score = better match (fewer character gaps between matches).
 */
function fuzzyScore(
  text: string,
  query: string,
): { score: number; matchIndices: number[] } | null {
  if (query.length === 0) return { score: 0, matchIndices: [] };

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const matchIndices: number[] = [];

  let qi = 0;
  let lastMatchIndex = -1;
  let gapPenalty = 0;

  for (let ti = 0; ti < textLower.length && qi < queryLower.length; ti++) {
    if (textLower[ti] === queryLower[qi]) {
      matchIndices.push(ti);
      // Penalize gaps between consecutive matches
      if (lastMatchIndex !== -1) {
        gapPenalty += ti - lastMatchIndex - 1;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }

  if (qi < queryLower.length) return null;

  // Bonus for matching at start of string or after a space
  let startBonus = 0;
  if (matchIndices[0] === 0) startBonus = -10;
  else if (matchIndices[0] !== undefined && text[matchIndices[0] - 1] === ' ') startBonus = -5;

  return {
    score: gapPenalty + startBonus + matchIndices[0]! * 0.1,
    matchIndices,
  };
}

/**
 * Searches text and keywords. Returns the best score across all fields,
 * using match indices from the label only (for display highlighting).
 */
function scoreItem(
  item: CommandItem,
  query: string,
): { score: number; matchIndices: number[] } | null {
  const labelResult = fuzzyScore(item.label, query);
  const descResult = fuzzyScore(item.description, query);
  const keywordResults = item.keywords.map((k) => fuzzyScore(k, query));

  const allResults = [
    labelResult,
    ...(descResult ? [{ ...descResult, score: descResult.score + 5 }] : []),
    ...keywordResults.flatMap((r) => (r ? [{ ...r, score: r.score + 3 }] : [])),
  ].filter((r): r is { score: number; matchIndices: number[] } => r !== null);

  if (allResults.length === 0) return null;

  // Return the best (lowest) score; use label match indices when available
  const best = allResults.reduce((a, b) => (a.score <= b.score ? a : b));
  return {
    score: best.score,
    matchIndices: labelResult?.matchIndices ?? [],
  };
}

// ---------------------------------------------------------------------------
// Highlighted label renderer
// ---------------------------------------------------------------------------

/**
 * Renders the label text with matched characters wrapped in a highlight span.
 * Purely a display utility — no interactive elements.
 */
function HighlightedLabel({
  label,
  matchIndices,
}: {
  label: string;
  matchIndices: readonly number[];
}) {
  if (matchIndices.length === 0) {
    return <span>{label}</span>;
  }

  const indexSet = new Set(matchIndices);
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let current = { text: '', highlighted: false };

  for (let i = 0; i < label.length; i++) {
    const char = label[i]!;
    const shouldHighlight = indexSet.has(i);
    if (shouldHighlight !== current.highlighted) {
      if (current.text) parts.push(current);
      current = { text: char, highlighted: shouldHighlight };
    } else {
      current.text += char;
    }
  }
  if (current.text) parts.push(current);

  return (
    <span>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark
            key={i}
            className="bg-transparent text-primary font-semibold not-italic"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

const SECTION_LABELS = {
  pages: 'Pages',
  actions: 'Actions',
  recent: 'Recent',
} as const satisfies Record<CommandItem['section'], string>;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** Props for CommandPalette - stateless trigger surface kept minimal. */
interface CommandPaletteProps {
  /** Additional class names for the trigger button rendered inside the nav. */
  className?: string;
}

/**
 * CommandPalette
 *
 * Self-contained: registers the global Ctrl+K shortcut internally.
 * Mount once at the root layout level.
 */
export function CommandPalette({ className }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const router = useRouter();
  const history = useCalculatorHistory();
  const dispatch = useCalculatorDispatch();
  const prefersReducedMotion = useReducedMotion();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Build action commands (defined inside component for dispatch closure)
  // ---------------------------------------------------------------------------

  const ACTION_COMMANDS = useMemo<
    ReadonlyArray<{
      id: string;
      label: string;
      description: string;
      icon: LucideIcon;
      keywords: readonly string[];
      action: () => void;
    }>
  >(
    () => [
      {
        id: 'action-clear',
        label: 'Clear Calculator',
        description: 'Reset the current expression and result',
        icon: Trash2,
        keywords: ['reset', 'wipe', 'erase', 'ac', 'all clear'],
        action: () => dispatch({ type: 'CLEAR' }),
      },
      {
        id: 'action-mode-exact',
        label: 'Switch to Exact Mode',
        description: 'Compute results in exact symbolic form',
        icon: FlipHorizontal,
        keywords: ['exact', 'symbolic', 'fraction', 'rational'],
        action: () => dispatch({ type: 'SET_MODE', payload: 'exact' }),
      },
      {
        id: 'action-mode-approximate',
        label: 'Switch to Approximate Mode',
        description: 'Compute results as decimal approximations',
        icon: Zap,
        keywords: ['decimal', 'float', 'numeric', 'approximate'],
        action: () => dispatch({ type: 'SET_MODE', payload: 'approximate' }),
      },
    ],
    [dispatch],
  );

  // ---------------------------------------------------------------------------
  // Build flat item list
  // ---------------------------------------------------------------------------

  const allItems = useMemo<CommandItem[]>(() => {
    const pages: CommandItem[] = PAGE_COMMANDS.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      icon: p.icon,
      section: 'pages' as const,
      keywords: p.keywords,
      data: { kind: 'page', href: p.href },
    }));

    const actions: CommandItem[] = ACTION_COMMANDS.map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      icon: a.icon,
      section: 'actions' as const,
      keywords: a.keywords,
      data: { kind: 'action', action: a.action },
    }));

    const recent: CommandItem[] = history.slice(0, 8).map((entry) => ({
      id: `recent-${entry.id}`,
      label: entry.expression,
      description: `= ${entry.result}`,
      icon: Clock,
      section: 'recent' as const,
      keywords: [String(entry.result)],
      data: { kind: 'recent', entry },
    }));

    return [...pages, ...actions, ...recent];
  }, [history, ACTION_COMMANDS]);

  // ---------------------------------------------------------------------------
  // Filtered + scored results
  // ---------------------------------------------------------------------------

  const filteredItems = useMemo<MatchedItem[]>(() => {
    const q = query.trim();

    if (q.length === 0) {
      // Show all items ungrouped when no query, limited to avoid overwhelming
      return allItems.map((item) => ({ item, matchIndices: [], score: 0 }));
    }

    return allItems
      .flatMap((item): MatchedItem[] => {
        const result = scoreItem(item, q);
        if (!result) return [];
        return [{ item, matchIndices: result.matchIndices, score: result.score }];
      })
      .sort((a, b) => a.score - b.score);
  }, [allItems, query]);

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, openPalette, closePalette]);

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      // rAF ensures the AnimatePresence has mounted the element
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  // Reset activeIndex when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [filteredItems.length]);

  // ---------------------------------------------------------------------------
  // Item activation
  // ---------------------------------------------------------------------------

  const activateItem = useCallback(
    (matched: MatchedItem) => {
      const { data } = matched.item;
      closePalette();

      if (data.kind === 'page') {
        router.push(data.href);
      } else if (data.kind === 'action') {
        data.action();
      } else if (data.kind === 'recent') {
        dispatch({ type: 'LOAD_HISTORY', payload: data.entry });
        router.push('/');
      }
    },
    [closePalette, router, dispatch],
  );

  // ---------------------------------------------------------------------------
  // Keyboard navigation inside the palette
  // ---------------------------------------------------------------------------

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) =>
            filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) =>
            filteredItems.length === 0
              ? 0
              : (prev - 1 + filteredItems.length) % filteredItems.length,
          );
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const matched = filteredItems[activeIndex];
          if (matched) activateItem(matched);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          closePalette();
          break;
        }
        case 'Tab': {
          // Allow Tab to navigate, prevent closing
          e.preventDefault();
          if (e.shiftKey) {
            setActiveIndex((prev) =>
              filteredItems.length === 0
                ? 0
                : (prev - 1 + filteredItems.length) % filteredItems.length,
            );
          } else {
            setActiveIndex((prev) =>
              filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length,
            );
          }
          break;
        }
      }
    },
    [activeIndex, filteredItems, activateItem, closePalette],
  );

  // ---------------------------------------------------------------------------
  // Scroll active item into view
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ---------------------------------------------------------------------------
  // Grouped rendering
  // ---------------------------------------------------------------------------

  const groupedItems = useMemo(() => {
    const groups: Map<CommandItem['section'], MatchedItem[]> = new Map();
    const sectionOrder: CommandItem['section'][] = ['pages', 'actions', 'recent'];

    for (const section of sectionOrder) {
      const items = filteredItems.filter((m) => m.item.section === section);
      if (items.length > 0) groups.set(section, items);
    }

    return groups;
  }, [filteredItems]);

  // ---------------------------------------------------------------------------
  // Derived ARIA id for active descendant
  // ---------------------------------------------------------------------------

  const activeItemId =
    filteredItems[activeIndex] != null
      ? `cmd-item-${filteredItems[activeIndex]!.item.id}`
      : undefined;

  // ---------------------------------------------------------------------------
  // Animation variants
  // ---------------------------------------------------------------------------

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const dialogVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, scale: 0.96, y: -8 },
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
        },
        exit: {
          opacity: 0,
          scale: 0.97,
          y: -4,
          transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
        },
      };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Trigger button — surfaced inside the Navigation bar via props.className */}
      <button
        type="button"
        onClick={openPalette}
        className={cn(
          'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'text-sm text-muted-foreground bg-muted/50 border border-border/50',
          'hover:bg-accent/60 hover:text-foreground hover:border-border',
          'transition-all duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          className,
        )}
        aria-label="Open command palette (Ctrl+K)"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search...</span>
        <kbd
          className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          aria-hidden="true"
        >
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      {/* Portal overlay + dialog */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cmd-backdrop"
              className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              aria-hidden="true"
              onClick={closePalette}
            />

            {/* Dialog */}
            <motion.div
              key="cmd-dialog"
              ref={containerRef}
              className="fixed left-1/2 top-[15vh] z-[101] w-full max-w-xl -translate-x-1/2"
              variants={dialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              <div
                className={cn(
                  'overflow-hidden rounded-xl border border-border/60',
                  'glass-heavy shadow-2xl shadow-background/40',
                )}
              >
                {/* Search input */}
                <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                  <Search
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={filteredItems.length > 0}
                    aria-controls="cmd-listbox"
                    {...(activeItemId ? { 'aria-activedescendant': activeItemId } : {})}
                    aria-label="Search commands, pages, and recent calculations"
                    value={query}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setQuery(e.target.value);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search commands..."
                    className={cn(
                      'flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
                      'focus:outline-none focus-visible:outline-none',
                      'caret-primary',
                    )}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  {query.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded',
                        'text-muted-foreground hover:text-foreground',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        'transition-colors duration-150',
                      )}
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closePalette}
                    className={cn(
                      'flex h-6 items-center rounded border border-border/70 bg-muted/50 px-1.5',
                      'font-mono text-[10px] text-muted-foreground',
                      'hover:bg-accent hover:text-foreground',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      'transition-colors duration-150',
                    )}
                    aria-label="Close command palette (Escape)"
                  >
                    Esc
                  </button>
                </div>

                {/* Results list */}
                <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain">
                  {filteredItems.length === 0 && query.trim().length > 0 ? (
                    <div
                      className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center"
                      role="status"
                      aria-live="polite"
                    >
                      <Search
                        className="h-8 w-8 text-muted-foreground/40"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-muted-foreground">
                        No results for{' '}
                        <span className="font-medium text-foreground">
                          &ldquo;{query}&rdquo;
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <ul
                      id="cmd-listbox"
                      ref={listRef}
                      role="listbox"
                      aria-label="Commands"
                      className="py-2"
                    >
                      {Array.from(groupedItems.entries()).map(([section, items]) => {
                        return (
                          <li key={section} role="presentation">
                            {/* Section header */}
                            <div
                              className="px-4 pb-1 pt-3 first:pt-1"
                              role="presentation"
                            >
                              <span
                                className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
                                aria-hidden="true"
                              >
                                {SECTION_LABELS[section]}
                              </span>
                            </div>

                            {/* Section items */}
                            <ul role="presentation">
                              {items.map((matched) => {
                                // Resolve the flat index for keyboard navigation
                                const flatIndex = filteredItems.indexOf(matched);
                                const isActive = flatIndex === activeIndex;
                                const itemId = `cmd-item-${matched.item.id}`;
                                const Icon = matched.item.icon;

                                return (
                                  <li
                                    key={matched.item.id}
                                    id={itemId}
                                    role="option"
                                    aria-selected={isActive}
                                    data-active={isActive ? 'true' : undefined}
                                    className={cn(
                                      'group mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
                                      'transition-colors duration-100',
                                      isActive
                                        ? 'bg-primary/10 text-foreground'
                                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    )}
                                    onClick={() => activateItem(matched)}
                                    onMouseEnter={() => setActiveIndex(flatIndex)}
                                  >
                                    {/* Icon */}
                                    <span
                                      className={cn(
                                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                                        'transition-colors duration-100',
                                        isActive
                                          ? 'border-primary/30 bg-primary/10 text-primary'
                                          : 'border-border/50 bg-muted/50 text-muted-foreground group-hover:border-border group-hover:text-foreground',
                                      )}
                                      aria-hidden="true"
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                    </span>

                                    {/* Label + description */}
                                    <span className="flex min-w-0 flex-1 flex-col">
                                      <span className="truncate text-sm font-medium leading-snug text-foreground">
                                        <HighlightedLabel
                                          label={matched.item.label}
                                          matchIndices={matched.matchIndices}
                                        />
                                      </span>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {matched.item.description}
                                      </span>
                                    </span>

                                    {/* Active indicator */}
                                    {isActive && (
                                      <kbd
                                        className="hidden shrink-0 rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex"
                                        aria-hidden="true"
                                      >
                                        Enter
                                      </kbd>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Footer hint */}
                <div
                  className="flex items-center justify-between border-t border-border/30 px-4 py-2"
                  aria-hidden="true"
                >
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-border/50 bg-muted/40 px-1 font-mono text-[9px]">
                        ↑
                      </kbd>
                      <kbd className="rounded border border-border/50 bg-muted/40 px-1 font-mono text-[9px]">
                        ↓
                      </kbd>
                      Navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-border/50 bg-muted/40 px-1 font-mono text-[9px]">
                        Enter
                      </kbd>
                      Select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-border/50 bg-muted/40 px-1 font-mono text-[9px]">
                        Esc
                      </kbd>
                      Close
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/40">
                    {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Screen reader live region for result count */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {open && query.trim().length > 0
          ? `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''} for ${query}`
          : null}
      </div>
    </>
  );
}
