/**
 * Worksheet Store
 *
 * Zustand 5.0.11 store for the Jupyter-like worksheet/notebook interface.
 * Manages cells, variable scope across cells, auto-save, and export.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { generateId } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Discriminated union for cell kind */
export type CellKind = 'math' | 'text' | 'plot';

/** Evaluation state for math/plot cells */
export type EvalStatus = 'idle' | 'pending' | 'success' | 'error';

/** A single variable binding produced by a math cell */
export interface VariableBinding {
  name: string;
  value: number | bigint | string;
}

/** Base cell fields shared across all cell kinds */
interface BaseCellFields {
  readonly id: string;
  readonly createdAt: number;
  updatedAt: number;
}

/** Math computation cell */
export interface MathCell extends BaseCellFields {
  kind: 'math';
  /** Raw expression the user typed */
  input: string;
  /** Stringified numeric result */
  result: string | null;
  /** LaTeX representation of the expression */
  latex: string | null;
  /** Variable assignments produced by this cell (e.g. "x = 5") */
  variables: VariableBinding[];
  status: EvalStatus;
  errorMessage: string | null;
}

/** Rich text / markdown cell */
export interface TextCell extends BaseCellFields {
  kind: 'text';
  /** Raw markdown content */
  content: string;
}

/** Inline 2D plot cell */
export interface PlotCell extends BaseCellFields {
  kind: 'plot';
  /** Comma-separated function expressions, e.g. "sin(x), cos(x)" */
  expressions: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  status: EvalStatus;
  errorMessage: string | null;
}

export type WorksheetCell = MathCell | TextCell | PlotCell;

/** Serialisable worksheet document (for JSON export / localStorage) */
export interface WorksheetDocument {
  readonly id: string;
  title: string;
  cells: WorksheetCell[];
  readonly createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface WorksheetStore {
  worksheet: WorksheetDocument;

  // Cell CRUD
  addCell: (kind: CellKind, afterId?: string) => string;
  deleteCell: (id: string) => void;
  moveCellUp: (id: string) => void;
  moveCellDown: (id: string) => void;

  // Cell content mutations
  updateMathInput: (id: string, input: string) => void;
  updateTextContent: (id: string, content: string) => void;
  updatePlotExpressions: (id: string, expressions: string) => void;
  updatePlotViewport: (
    id: string,
    viewport: { xMin: number; xMax: number; yMin: number; yMax: number }
  ) => void;

  // Evaluation (called by components, not by the store itself)
  setMathResult: (
    id: string,
    result: string,
    latex: string,
    variables: VariableBinding[]
  ) => void;
  setMathError: (id: string, message: string) => void;
  setMathPending: (id: string) => void;
  setPlotStatus: (id: string, status: EvalStatus, errorMessage?: string) => void;

  // Worksheet meta
  setTitle: (title: string) => void;
  resetWorksheet: () => void;

  // Derived
  getVariablesUpTo: (cellId: string) => Record<string, number | bigint | string>;

  // Export
  exportAsJSON: () => string;
  importFromJSON: (json: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMathCell(): MathCell {
  const now = Date.now();
  return {
    id: generateId(),
    kind: 'math',
    input: '',
    result: null,
    latex: null,
    variables: [],
    status: 'idle',
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createTextCell(): TextCell {
  const now = Date.now();
  return {
    id: generateId(),
    kind: 'text',
    content: '',
    createdAt: now,
    updatedAt: now,
  };
}

function createPlotCell(): PlotCell {
  const now = Date.now();
  return {
    id: generateId(),
    kind: 'plot',
    expressions: 'sin(x)',
    xMin: -10,
    xMax: 10,
    yMin: -5,
    yMax: 5,
    status: 'idle',
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeCell(kind: CellKind): WorksheetCell {
  if (kind === 'text') return createTextCell();
  if (kind === 'plot') return createPlotCell();
  return createMathCell();
}

function createWorksheet(): WorksheetDocument {
  const now = Date.now();
  const firstCell = createMathCell();
  return {
    id: generateId(),
    title: 'Untitled Worksheet',
    cells: [firstCell],
    createdAt: now,
    updatedAt: now,
  };
}

function touchWorksheet(ws: WorksheetDocument): void {
  ws.updatedAt = Date.now();
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorksheetStore = create<WorksheetStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        worksheet: createWorksheet(),

        // ---------------------------------------------------------------
        // Cell CRUD
        // ---------------------------------------------------------------
        addCell: (kind, afterId) => {
          const cell = makeCell(kind);
          set((draft) => {
            const cells = draft.worksheet.cells;
            if (afterId === undefined) {
              cells.push(cell);
            } else {
              const idx = cells.findIndex((c) => c.id === afterId);
              if (idx === -1) {
                cells.push(cell);
              } else {
                cells.splice(idx + 1, 0, cell);
              }
            }
            touchWorksheet(draft.worksheet);
          });
          return cell.id;
        },

        deleteCell: (id) => {
          set((draft) => {
            const cells = draft.worksheet.cells;
            // Always keep at least one cell
            if (cells.length <= 1) return;
            const idx = cells.findIndex((c) => c.id === id);
            if (idx !== -1) {
              cells.splice(idx, 1);
            }
            touchWorksheet(draft.worksheet);
          });
        },

        moveCellUp: (id) => {
          set((draft) => {
            const cells = draft.worksheet.cells;
            const idx = cells.findIndex((c) => c.id === id);
            if (idx <= 0) return;
            const [cell] = cells.splice(idx, 1);
            // cell is guaranteed to exist since idx >= 0 and we just spliced it
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            cells.splice(idx - 1, 0, cell!);
            touchWorksheet(draft.worksheet);
          });
        },

        moveCellDown: (id) => {
          set((draft) => {
            const cells = draft.worksheet.cells;
            const idx = cells.findIndex((c) => c.id === id);
            if (idx === -1 || idx >= cells.length - 1) return;
            const [cell] = cells.splice(idx, 1);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            cells.splice(idx + 1, 0, cell!);
            touchWorksheet(draft.worksheet);
          });
        },

        // ---------------------------------------------------------------
        // Content mutations
        // ---------------------------------------------------------------
        updateMathInput: (id, input) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'math') return;
            cell.input = input;
            // Reset result when input changes
            cell.status = 'idle';
            cell.result = null;
            cell.latex = null;
            cell.variables = [];
            cell.errorMessage = null;
            cell.updatedAt = Date.now();
            touchWorksheet(draft.worksheet);
          });
        },

        updateTextContent: (id, content) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'text') return;
            cell.content = content;
            cell.updatedAt = Date.now();
            touchWorksheet(draft.worksheet);
          });
        },

        updatePlotExpressions: (id, expressions) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'plot') return;
            cell.expressions = expressions;
            cell.status = 'idle';
            cell.errorMessage = null;
            cell.updatedAt = Date.now();
            touchWorksheet(draft.worksheet);
          });
        },

        updatePlotViewport: (id, viewport) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'plot') return;
            cell.xMin = viewport.xMin;
            cell.xMax = viewport.xMax;
            cell.yMin = viewport.yMin;
            cell.yMax = viewport.yMax;
            cell.updatedAt = Date.now();
            touchWorksheet(draft.worksheet);
          });
        },

        // ---------------------------------------------------------------
        // Evaluation state (set by components after async evaluation)
        // ---------------------------------------------------------------
        setMathPending: (id) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'math') return;
            cell.status = 'pending';
            cell.errorMessage = null;
          });
        },

        setMathResult: (id, result, latex, variables) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'math') return;
            cell.result = result;
            cell.latex = latex;
            cell.variables = variables;
            cell.status = 'success';
            cell.errorMessage = null;
            cell.updatedAt = Date.now();
            touchWorksheet(draft.worksheet);
          });
        },

        setMathError: (id, message) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'math') return;
            cell.status = 'error';
            cell.errorMessage = message;
            cell.result = null;
            cell.latex = null;
            cell.variables = [];
            cell.updatedAt = Date.now();
            touchWorksheet(draft.worksheet);
          });
        },

        setPlotStatus: (id, status, errorMessage) => {
          set((draft) => {
            const cell = draft.worksheet.cells.find((c) => c.id === id);
            if (!cell || cell.kind !== 'plot') return;
            cell.status = status;
            cell.errorMessage = errorMessage ?? null;
          });
        },

        // ---------------------------------------------------------------
        // Worksheet meta
        // ---------------------------------------------------------------
        setTitle: (title) => {
          set((draft) => {
            draft.worksheet.title = title;
            touchWorksheet(draft.worksheet);
          });
        },

        resetWorksheet: () => {
          set((draft) => {
            draft.worksheet = createWorksheet();
          });
        },

        // ---------------------------------------------------------------
        // Variable scope: collect variables from all math cells before `cellId`
        // ---------------------------------------------------------------
        getVariablesUpTo: (cellId) => {
          const cells = get().worksheet.cells;
          const scope: Record<string, number | bigint | string> = {};
          for (const cell of cells) {
            if (cell.id === cellId) break;
            if (cell.kind === 'math' && cell.status === 'success') {
              for (const binding of cell.variables) {
                scope[binding.name] = binding.value;
              }
            }
          }
          return scope;
        },

        // ---------------------------------------------------------------
        // Export / Import
        // ---------------------------------------------------------------
        exportAsJSON: () => {
          return JSON.stringify(get().worksheet, null, 2);
        },

        importFromJSON: (json) => {
          try {
            const parsed = JSON.parse(json) as WorksheetDocument;
            // Minimal validation
            if (
              typeof parsed.id === 'string' &&
              typeof parsed.title === 'string' &&
              Array.isArray(parsed.cells)
            ) {
              set((draft) => {
                draft.worksheet = parsed;
              });
            }
          } catch {
            // Silently ignore invalid JSON; UI should show an error independently
          }
        },
      })),
      {
        name: 'worksheet-storage',
        // Persist the whole worksheet document
        partialize: (store) => ({ worksheet: store.worksheet }),
      }
    ),
    {
      name: 'worksheet-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ---------------------------------------------------------------------------
// Selector hooks for performance-optimised subscriptions
// ---------------------------------------------------------------------------

export const useWorksheet = () =>
  useWorksheetStore((s) => s.worksheet);

export const useWorksheetCells = () =>
  useWorksheetStore((s) => s.worksheet.cells);

export const useWorksheetTitle = () =>
  useWorksheetStore((s) => s.worksheet.title);

export const useWorksheetCell = (id: string) =>
  useWorksheetStore((s) => s.worksheet.cells.find((c) => c.id === id));

export const useWorksheetActions = () =>
  useWorksheetStore(useShallow((s) => ({
    addCell: s.addCell,
    deleteCell: s.deleteCell,
    moveCellUp: s.moveCellUp,
    moveCellDown: s.moveCellDown,
    updateMathInput: s.updateMathInput,
    updateTextContent: s.updateTextContent,
    updatePlotExpressions: s.updatePlotExpressions,
    updatePlotViewport: s.updatePlotViewport,
    setMathResult: s.setMathResult,
    setMathError: s.setMathError,
    setMathPending: s.setMathPending,
    setPlotStatus: s.setPlotStatus,
    setTitle: s.setTitle,
    resetWorksheet: s.resetWorksheet,
    getVariablesUpTo: s.getVariablesUpTo,
    exportAsJSON: s.exportAsJSON,
    importFromJSON: s.importFromJSON,
  })));
