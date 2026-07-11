'use client';

/**
 * Command Palette (modern-cmdk)
 *
 * Ctrl/Cmd+K command palette built on `modern-cmdk` (the `Command.Dialog`
 * compound components). The library owns the search/filter state machine,
 * fuzzy matching + ranking, keyboard navigation, list virtualization, and
 * WCAG combobox semantics (aria-activedescendant, live regions) — so this file
 * only declares the command data, the trigger button, and the global shortcut.
 *
 * Sections: Pages (static navigation), Actions (calculator dispatch), and
 * Recent (calculator history). Mount once at the root layout level.
 *
 * Keyboard:
 * - Ctrl+K / Cmd+K   Toggle the palette
 * - ArrowUp/Down     Move highlight (looping)
 * - Enter            Activate the highlighted item
 * - Escape           Close
 */

import {
  Activity,
  BarChart2,
  BookOpen,
  Box,
  Brain,
  Calculator,
  Clock,
  FileQuestion,
  Flame,
  FlipHorizontal,
  Grid3x3,
  type LucideIcon,
  MessageSquare,
  Network,
  PenTool,
  Ruler,
  Search,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Trophy,
  Variable,
  Wind,
  Zap,
} from 'lucide-react';
import { Command } from 'modern-cmdk/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCalculatorDispatch, useCalculatorHistory } from '@/lib/stores/calculator-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Static page-navigation commands
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
    id: 'page-gpu-lab',
    label: 'GPU Lab',
    description: 'Public gallery of shared GPU simulations',
    icon: Zap,
    keywords: ['gpu', 'simulation', 'gallery', 'webgpu', 'lab', 'lorenz', 'heatmap', 'worksheet'],
    href: '/gpu-lab',
  },
  {
    id: 'page-ode',
    label: 'ODE Solver',
    description: 'Ordinary differential equations with phase plane',
    icon: Activity,
    keywords: [
      'ode',
      'ordinary',
      'differential',
      'euler',
      'runge-kutta',
      'rk4',
      'phase',
      'plane',
      'direction',
      'field',
      'trajectory',
      'lotka',
      'volterra',
      'pendulum',
      'harmonic',
    ],
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
// Shared class names
// ---------------------------------------------------------------------------

/**
 * Item styling. `modern-cmdk` flags the highlighted item with `[data-active]`
 * and disabled items with `[data-disabled]`; we theme both via arbitrary
 * variants rather than importing the library's default stylesheet.
 */
const ITEM_CLASS = cn(
  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none',
  'text-sm text-foreground transition-colors duration-150',
  '[&[data-active]]:bg-accent/70 [&[data-active]]:text-foreground',
  'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none',
);

/** Group wrapper styling — themes the library's `[data-command-group-heading]`. */
const GROUP_CLASS = cn(
  'mb-1',
  '[&_[data-command-group-heading]]:px-3 [&_[data-command-group-heading]]:pb-1 [&_[data-command-group-heading]]:pt-2',
  '[&_[data-command-group-heading]]:text-[11px] [&_[data-command-group-heading]]:font-semibold',
  '[&_[data-command-group-heading]]:uppercase [&_[data-command-group-heading]]:tracking-wide',
  '[&_[data-command-group-heading]]:text-muted-foreground',
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Props for CommandPalette — a stateless trigger surface kept minimal. */
interface CommandPaletteProps {
  /** Additional class names for the trigger button rendered inside the nav. */
  className?: string;
}

/**
 * CommandPalette
 *
 * Self-contained: registers the global Ctrl+K shortcut internally and renders
 * both the nav trigger button and the modern-cmdk dialog. Mount once at the
 * root layout level.
 */
export function CommandPalette({ className }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  const router = useRouter();
  const history = useCalculatorHistory();
  const dispatch = useCalculatorDispatch();

  // Global keyboard shortcut: Ctrl+K / Cmd+K toggles the palette.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Calculator action commands (depend on the dispatch closure).
  const actions = useMemo(
    () => [
      {
        id: 'action-clear',
        label: 'Clear Calculator',
        description: 'Reset the current expression and result',
        icon: Trash2,
        keywords: ['reset', 'wipe', 'erase', 'ac', 'all clear'],
        run: () => dispatch({ type: 'CLEAR' }),
      },
      {
        id: 'action-mode-exact',
        label: 'Switch to Exact Mode',
        description: 'Compute results in exact symbolic form',
        icon: FlipHorizontal,
        keywords: ['exact', 'symbolic', 'fraction', 'rational'],
        run: () => dispatch({ type: 'SET_MODE', payload: 'exact' }),
      },
      {
        id: 'action-mode-approximate',
        label: 'Switch to Approximate Mode',
        description: 'Compute results as decimal approximations',
        icon: Zap,
        keywords: ['decimal', 'float', 'numeric', 'approximate'],
        run: () => dispatch({ type: 'SET_MODE', payload: 'approximate' }),
      },
    ],
    [dispatch],
  );

  // Most-recent calculator history entries.
  const recent = useMemo(() => history.slice(0, 8), [history]);

  // Run an item's effect, then close the palette.
  const runAndClose = useCallback((effect: () => void) => {
    effect();
    setOpen(false);
  }, []);

  return (
    <>
      {/* Trigger button — surfaced inside the Navigation bar via props.className */}
      <button
        type="button"
        onClick={() => setOpen(true)}
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
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search...</span>
        <kbd
          className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          aria-hidden="true"
          tabIndex={-1}
        >
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      {/* modern-cmdk dialog — Radix-backed (portal, focus trap, overlay). */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        description="Search pages, calculator actions, and recent calculations"
        loop
        overlayClassName="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm"
        contentClassName={cn(
          'fixed left-1/2 top-[15vh] z-[101] w-[92vw] max-w-xl -translate-x-1/2',
          'overflow-hidden rounded-2xl border border-border/60',
          'bg-popover/95 backdrop-blur-xl shadow-2xl shadow-primary/10 ring-1 ring-white/5',
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border/50 px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Command.Input
            placeholder="Search pages, actions, recent…"
            className="w-full bg-transparent py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Results */}
        <Command.List className="max-h-[55vh] overflow-y-auto overflow-x-hidden p-2 scrollbar-thin">
          <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          {/* Pages */}
          <Command.Group heading="Pages" className={GROUP_CLASS}>
            {PAGE_COMMANDS.map((page) => (
              <Command.Item
                key={page.id}
                value={page.label}
                keywords={[...page.keywords, page.description]}
                onSelect={() => runAndClose(() => router.push(page.href))}
                className={ITEM_CLASS}
              >
                <page.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="font-medium">{page.label}</span>
                <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                  {page.description}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          {/* Actions */}
          <Command.Group heading="Actions" className={GROUP_CLASS}>
            {actions.map((action) => (
              <Command.Item
                key={action.id}
                value={action.label}
                keywords={[...action.keywords, action.description]}
                onSelect={() => runAndClose(action.run)}
                className={ITEM_CLASS}
              >
                <action.icon className="size-4 shrink-0 text-violet-400" aria-hidden="true" />
                <span className="font-medium">{action.label}</span>
                <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                  {action.description}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          {/* Recent calculations */}
          {recent.length > 0 && (
            <Command.Group heading="Recent" className={GROUP_CLASS}>
              {recent.map((entry) => (
                <Command.Item
                  key={`recent-${entry.id}`}
                  value={entry.expression}
                  keywords={[String(entry.result)]}
                  onSelect={() =>
                    runAndClose(() => {
                      dispatch({ type: 'LOAD_HISTORY', payload: entry });
                      router.push('/');
                    })
                  }
                  className={ITEM_CLASS}
                >
                  <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate font-mono">{entry.expression}</span>
                  <span className="ml-auto shrink-0 pl-3 font-mono text-xs text-emerald-400">
                    = {entry.result}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
