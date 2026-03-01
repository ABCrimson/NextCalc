'use client';

/**
 * WorksheetEditor — Jupyter-like notebook editor for NextCalc Pro.
 *
 * Architecture:
 *   - Reads from useWorksheetStore (Zustand + Immer + localStorage persist)
 *   - Renders a vertical list of WorksheetCell components with Framer Motion
 *     layout animations (AnimatePresence handles mount/unmount)
 *   - Toolbar: title editing, add-cell buttons, export JSON, reset
 *   - Variables sidebar: shows all bindings accumulated so far
 *
 * Keyboard shortcuts:
 *   - Shift+Enter inside any math cell  → evaluate cell
 *   - Escape inside any text area       → blur
 *
 * Auto-save:
 *   - Zustand persist middleware serialises to localStorage automatically
 *     under the key "worksheet-storage" after every mutation.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlignLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  Plus,
  RotateCcw,
  Save,
  TrendingUp,
  Upload,
  Variable,
} from 'lucide-react';
import { type ChangeEvent, type ReactNode, useCallback, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type CellKind,
  type MathCell,
  useWorksheetActions,
  useWorksheetCells,
  useWorksheetTitle,
  type WorksheetCell,
} from '@/lib/stores/worksheet-store';
import { cn } from '@/lib/utils';
import { WorksheetCell as CellComponent } from './cell';
import { CollabBar } from './collab-bar';

// ---------------------------------------------------------------------------
// Toolbar — title + global actions
// ---------------------------------------------------------------------------
interface ToolbarProps {
  titleInputId: string;
}

function Toolbar({ titleInputId }: ToolbarProps) {
  const title = useWorksheetTitle();
  const { setTitle, resetWorksheet, exportAsJSON, importFromJSON } = useWorksheetActions();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const json = exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '-').toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [exportAsJSON, title]);

  const handleImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === 'string') {
          importFromJSON(text);
        }
      };
      reader.readAsText(file);
      // Reset so re-importing the same file works
      e.target.value = '';
    },
    [importFromJSON],
  );

  const handleReset = useCallback(() => {
    if (
      window.confirm(
        'Reset worksheet? This will permanently delete all cells and cannot be undone.',
      )
    ) {
      resetWorksheet();
    }
  }, [resetWorksheet]);

  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 rounded-xl border border-border/40 bg-card/40 backdrop-blur-md px-4 py-3 shadow-sm">
      {/* Title */}
      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <Input
            id={titleInputId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false);
            }}
            className="text-xl font-bold h-10 border-primary/60 bg-transparent"
            aria-label="Worksheet title"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className={cn(
              'text-xl font-bold text-left truncate max-w-full',
              'hover:text-primary transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded',
            )}
            aria-label={`Worksheet title: ${title}. Click to edit.`}
          >
            {title}
          </button>
        )}
      </div>

      {/* Action buttons */}
      <nav className="flex items-center gap-2 flex-wrap" aria-label="Worksheet actions">
        {/* Auto-save indicator */}
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground/70 mr-2">
          <Save className="h-3 w-3" aria-hidden="true" />
          Auto-saved
        </span>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs h-8"
          onClick={handleExport}
          aria-label="Export worksheet as JSON"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs h-8"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Import worksheet from JSON file"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Import</span>
        </Button>
        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={handleImport}
          aria-hidden="true"
          tabIndex={-1}
        />

        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs h-8 hover:text-destructive hover:bg-destructive/10"
          onClick={handleReset}
          aria-label="Reset worksheet — clears all cells"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Reset</span>
        </Button>

        {/* Collaboration controls — separator then CollabBar */}
        <div className="h-4 w-px bg-border/50 mx-1 hidden sm:block" aria-hidden="true" />
        <CollabBar />
      </nav>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Add-cell button strip — appears between/after cells
// ---------------------------------------------------------------------------
interface AddCellStripProps {
  afterId?: string;
  label: string;
}

function AddCellStrip({ afterId, label }: AddCellStripProps) {
  const { addCell } = useWorksheetActions();

  const kinds: Array<{ kind: CellKind; icon: ReactNode; label: string }> = [
    {
      kind: 'math',
      icon: <Code2 className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Add math cell',
    },
    {
      kind: 'text',
      icon: <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Add text cell',
    },
    {
      kind: 'plot',
      icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Add plot cell',
    },
  ];

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 py-1.5',
        'opacity-0 focus-within:opacity-100 hover:opacity-100 transition-opacity duration-200',
      )}
      role="group"
      aria-label={label}
    >
      <div className="h-px flex-1 bg-border/40" />
      {kinds.map(({ kind, icon, label: kindLabel }) => (
        <Button
          key={kind}
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => addCell(kind, afterId)}
          aria-label={`${kindLabel}${afterId ? ' after current cell' : ''}`}
        >
          {icon}
          <span className="hidden sm:inline capitalize">{kind}</span>
        </Button>
      ))}
      <div className="h-px flex-1 bg-border/40" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variables sidebar — shows accumulated bindings
// ---------------------------------------------------------------------------
function VariablesSidebar({ cells }: { cells: readonly WorksheetCell[] }) {
  const [expanded, setExpanded] = useState(true);

  // Collect all successful variable bindings in order
  const allBindings: Array<{ name: string; value: string; cellIndex: number }> = [];
  cells.forEach((cell, idx) => {
    if (cell.kind === 'math' && cell.status === 'success') {
      const mathCell = cell as MathCell;
      for (const binding of mathCell.variables) {
        allBindings.push({
          name: binding.name,
          value: String(binding.value),
          cellIndex: idx + 1,
        });
      }
    }
  });

  if (allBindings.length === 0) return null;

  return (
    <aside
      className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-md overflow-hidden shadow-sm"
      aria-label="Worksheet variables"
    >
      <button
        type="button"
        className={cn(
          'flex items-center justify-between w-full px-4 py-3',
          'text-sm font-medium hover:bg-accent/40 transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="variables-list"
      >
        <div className="flex items-center gap-2">
          <Variable className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <span>Variables</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {allBindings.length}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <ul
          id="variables-list"
          className="divide-y divide-border/30"
          aria-label="Variable bindings"
        >
          {allBindings.map((b, i) => (
            <li
              key={`${b.name}-${i}`}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <code className="font-mono font-semibold text-blue-300">{b.name}</code>
                <span className="text-xs text-muted-foreground/60">from cell [{b.cellIndex}]</span>
              </div>
              <code className="font-mono text-emerald-400 text-xs">{b.value}</code>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onAdd }: { onAdd: (kind: CellKind) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold mb-1 text-muted-foreground">Your worksheet is empty</h2>
      <p className="text-sm text-muted-foreground/70 mb-6 max-w-xs">
        Add cells to start computing. Math cells evaluate expressions and share variables with
        subsequent cells.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        {[
          { kind: 'math' as CellKind, icon: Code2, label: 'Math cell', color: 'text-blue-400' },
          {
            kind: 'text' as CellKind,
            icon: AlignLeft,
            label: 'Text cell',
            color: 'text-emerald-400',
          },
          {
            kind: 'plot' as CellKind,
            icon: TrendingUp,
            label: 'Plot cell',
            color: 'text-purple-400',
          },
        ].map(({ kind, icon: Icon, label, color }) => (
          <Button
            key={kind}
            variant="outline"
            className="gap-2"
            onClick={() => onAdd(kind)}
            aria-label={`Add a ${kind} cell`}
          >
            <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main WorksheetEditor component
// ---------------------------------------------------------------------------
export function WorksheetEditor() {
  const cells = useWorksheetCells();
  const { addCell, getVariablesUpTo } = useWorksheetActions();
  const titleInputId = useId();

  // Stable callback to avoid closure capture issues with cell IDs
  const handleGetVariables = useCallback((id: string) => getVariablesUpTo(id), [getVariablesUpTo]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Toolbar titleInputId={titleInputId} />

      <div className="space-y-1">
        {cells.length === 0 ? (
          <EmptyState onAdd={(kind) => addCell(kind)} />
        ) : (
          <>
            {/* Top add-cell strip */}
            <AddCellStrip label="Add cell at the beginning" />

            <AnimatePresence initial={false}>
              {cells.map((cell, index) => (
                <div key={cell.id}>
                  <CellComponent
                    cell={cell}
                    cellIndex={index}
                    totalCells={cells.length}
                    isFirst={index === 0}
                    isLast={index === cells.length - 1}
                    getVariablesUpTo={handleGetVariables}
                  />
                  {/* Add-cell strip after each cell */}
                  <AddCellStrip afterId={cell.id} label={`Add cell after cell ${index + 1}`} />
                </div>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Variables sidebar */}
      {cells.length > 0 && (
        <div className="mt-8">
          <VariablesSidebar cells={cells} />
        </div>
      )}

      {/* Floating add-cell FAB for mobile */}
      <AddCellFAB />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating action button — quick add for mobile
// ---------------------------------------------------------------------------
function AddCellFAB() {
  const { addCell } = useWorksheetActions();
  const [open, setOpen] = useState(false);

  const items: Array<{ kind: CellKind; icon: ReactNode; label: string; color: string }> = [
    {
      kind: 'math',
      icon: <Code2 className="h-4 w-4" aria-hidden="true" />,
      label: 'Add Math',
      color: 'bg-blue-600 hover:bg-blue-500',
    },
    {
      kind: 'text',
      icon: <AlignLeft className="h-4 w-4" aria-hidden="true" />,
      label: 'Add Text',
      color: 'bg-emerald-600 hover:bg-emerald-500',
    },
    {
      kind: 'plot',
      icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
      label: 'Add Plot',
      color: 'bg-purple-600 hover:bg-purple-500',
    },
  ];

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-2 sm:hidden"
      role="group"
      aria-label="Add cell"
    >
      <AnimatePresence>
        {open &&
          items.map(({ kind, icon, label, color }, i) => (
            <motion.div
              key={kind}
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 28 }}
            >
              <button
                type="button"
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-white shadow-lg transition-all duration-200',
                  color,
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
                onClick={() => {
                  addCell(kind);
                  setOpen(false);
                }}
                aria-label={label}
              >
                {icon}
                {label}
              </button>
            </motion.div>
          ))}
      </AnimatePresence>

      <button
        type="button"
        className={cn(
          'flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl',
          'hover:bg-primary/90 active:scale-95 transition-all duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close add-cell menu' : 'Open add-cell menu'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </motion.div>
      </button>
    </div>
  );
}
