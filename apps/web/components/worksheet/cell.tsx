'use client';

/**
 * WorksheetCell — individual cell for the Jupyter-like worksheet.
 *
 * Supports three cell kinds:
 *   - math   : expression input + KaTeX result + variable assignment
 *   - text   : markdown textarea (rendered with parseMarkdown from math-engine)
 *   - plot   : inline 2D WebGL plot with expression input + viewport controls
 *
 * Accessibility:
 *   - Each cell is a labelled region with role="region"
 *   - Keyboard shortcuts: Shift+Enter = evaluate, Escape = blur textarea
 *   - All icon-only buttons have aria-label
 *   - Focus ring: focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
 *   - Drag handle is keyboard-operable via moveCellUp / moveCellDown buttons
 *
 * Animations:
 *   - Cell mount/unmount: Framer Motion layout animations
 *   - Result reveal: opacity + translateY spring
 *   - Respects prefers-reduced-motion via Framer Motion's built-in support
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useTransition,
  memo,
  type ComponentType,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Play,
  GripVertical,
  Code2,
  AlignLeft,
  TrendingUp,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MathRenderer } from '@/components/ui/math-renderer';
import { cn } from '@/lib/utils';
import {
  useWorksheetActions,
  type WorksheetCell as WorksheetCellType,
  type MathCell,
  type TextCell,
  type PlotCell,
  type VariableBinding,
} from '@/lib/stores/worksheet-store';
import { localActiveCellRef, useRemotePeers } from '@/lib/stores/collab-store';
import { evaluate as evaluateExpr } from '@nextcalc/math-engine';

// ---------------------------------------------------------------------------
// Dynamic import for Plot2D to avoid SSR issues with WebGL
// ---------------------------------------------------------------------------
const Plot2D = dynamic(
  () => import('@/components/plots/Plot2D').then((m) => ({ default: m.Plot2D })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
        Loading plot renderer...
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Helpers: expression -> LaTeX conversion
// ---------------------------------------------------------------------------
function toLatex(expr: string): string {
  return expr
    .replace(/\*\*/g, '^')
    .replace(/\*/g, ' \\cdot ')
    .replace(/\//g, ' \\div ')
    .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/cbrt\(([^)]+)\)/g, '\\sqrt[3]{$1}')
    .replace(/\bpi\b/g, '\\pi')
    .replace(/\be\b/g, 'e')
    .replace(/sin\(([^)]+)\)/g, '\\sin($1)')
    .replace(/cos\(([^)]+)\)/g, '\\cos($1)')
    .replace(/tan\(([^)]+)\)/g, '\\tan($1)')
    .replace(/ln\(([^)]+)\)/g, '\\ln($1)')
    .replace(/log\(([^)]+)\)/g, '\\log($1)')
    .replace(/exp\(([^)]+)\)/g, 'e^{$1}')
    .replace(/abs\(([^)]+)\)/g, '|$1|');
}

/**
 * Try to parse "name = expr" and return { name, rhs } or null.
 */
function parseAssignment(input: string): { name: string; rhs: string } | null {
  const match = /^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(input.trim());
  if (!match) return null;
  // Avoid treating "==" as assignment
  if (input.includes('==')) return null;
  return { name: match[1] ?? '', rhs: match[2] ?? '' };
}

// ---------------------------------------------------------------------------
// Cell kind badge
// ---------------------------------------------------------------------------
const kindMeta = {
  math: { icon: Code2, label: 'Math', color: 'text-blue-400' },
  text: { icon: AlignLeft, label: 'Text', color: 'text-emerald-400' },
  plot: { icon: TrendingUp, label: 'Plot', color: 'text-purple-400' },
} as const satisfies Record<
  string,
  { icon: ComponentType<{ className?: string }>; label: string; color: string }
>;

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------
function StatusIcon({ status, errorMessage }: { status: string; errorMessage: string | null }) {
  if (status === 'pending') {
    return (
      <Loader2
        className="h-4 w-4 animate-spin text-muted-foreground"
        aria-label="Evaluating"
      />
    );
  }
  if (status === 'success') {
    return (
      <CheckCircle2
        className="h-4 w-4 text-emerald-500"
        aria-label="Success"
      />
    );
  }
  if (status === 'error') {
    return (
      <AlertCircle
        className="h-4 w-4 text-destructive"
        aria-label={`Error: ${errorMessage ?? 'Unknown error'}`}
      />
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Math Cell
// ---------------------------------------------------------------------------
interface MathCellContentProps {
  cell: MathCell;
  cellIndex: number;
  getVariablesUpTo: (id: string) => Record<string, number | bigint | string>;
}

function MathCellContent({ cell, cellIndex, getVariablesUpTo }: MathCellContentProps) {
  const { updateMathInput, setMathPending, setMathResult, setMathError } =
    useWorksheetActions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [cell.input]);

  const runEvaluation = useCallback(async () => {
    const input = cell.input.trim();
    if (!input) return;

    setMathPending(cell.id);

    // Build variable scope from all cells above this one
    const scope = getVariablesUpTo(cell.id);
    const variableScope: Record<string, number | bigint | string> = { ...scope };

    startTransition(async () => {
      try {
        let resultValue: number | bigint | string;
        let resultStr: string;
        const newBindings: VariableBinding[] = [];

        const assignment = parseAssignment(input);

        if (assignment) {
          // Evaluate the RHS in current scope
          const evalResult = evaluateExpr(assignment.rhs, {
            variables: Object.fromEntries(
              Object.entries(variableScope).filter(
                ([, v]) => typeof v === 'number' || typeof v === 'bigint'
              ) as Array<[string, number | bigint]>
            ),
          });

          if (!evalResult.success) {
            setMathError(cell.id, evalResult.error.message);
            return;
          }

          resultValue = evalResult.value;
          resultStr = String(resultValue);
          newBindings.push({ name: assignment.name, value: resultValue });
        } else {
          const evalResult = evaluateExpr(input, {
            variables: Object.fromEntries(
              Object.entries(variableScope).filter(
                ([, v]) => typeof v === 'number' || typeof v === 'bigint'
              ) as Array<[string, number | bigint]>
            ),
          });

          if (!evalResult.success) {
            setMathError(cell.id, evalResult.error.message);
            return;
          }

          resultValue = evalResult.value;
          resultStr = String(resultValue);
        }

        const latex = toLatex(input);
        setMathResult(cell.id, resultStr, latex, newBindings);
      } catch (err) {
        setMathError(
          cell.id,
          err instanceof Error ? err.message : 'Evaluation failed'
        );
      }
    });
  }, [cell.id, cell.input, getVariablesUpTo, setMathError, setMathPending, setMathResult]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        void runEvaluation();
      }
      if (e.key === 'Escape') {
        textareaRef.current?.blur();
      }
    },
    [runEvaluation]
  );

  const cellLabel = `Math cell ${cellIndex + 1}`;

  return (
    <div className="space-y-3">
      {/* Input area */}
      <div className="relative">
        <label htmlFor={`math-input-${cell.id}`} className="sr-only">
          {cellLabel} — enter a mathematical expression (Shift+Enter to evaluate)
        </label>
        <Textarea
          id={`math-input-${cell.id}`}
          ref={textareaRef}
          value={cell.input}
          onChange={(e) => updateMathInput(cell.id, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter expression, e.g. 2 + 3, x = 5, sin(pi/2)"
          className={cn(
            'font-mono text-sm resize-none overflow-hidden min-h-[2.75rem] leading-relaxed transition-colors',
            'bg-muted/30 border-border/50 hover:border-border focus-visible:border-primary/60',
          )}
          aria-label={`${cellLabel} input`}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        <kbd className="absolute bottom-2 right-2 hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/60 pointer-events-none select-none">
          <span className="font-sans">Shift</span>
          <span>+</span>
          <span>Enter</span>
        </kbd>
      </div>

      {/* Run button */}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void runEvaluation()}
        disabled={isPending || cell.status === 'pending' || !cell.input.trim()}
        className="gap-2 h-8 text-xs font-medium"
        aria-label={`Run cell ${cellIndex + 1}`}
      >
        {isPending || cell.status === 'pending' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Run
      </Button>

      {/* Result display */}
      <AnimatePresence mode="wait">
        {cell.status === 'success' && cell.result !== null && (
          <motion.div
            key={`result-${cell.result}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2"
            role="status"
            aria-label={`Result: ${cell.result}`}
            aria-live="polite"
          >
            {/* LaTeX */}
            {cell.latex && cell.input.trim() && (
              <div className="text-sm text-muted-foreground overflow-x-auto">
                <MathRenderer
                  expression={toLatex(cell.input)}
                  displayMode={false}
                  ariaLabel={`Expression: ${cell.input}`}
                />
              </div>
            )}

            {/* Numeric result */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">=</span>
              <span className="font-mono font-semibold text-emerald-400 text-sm break-all">
                {cell.result}
              </span>
            </div>

            {/* Variable assignment badges */}
            {cell.variables.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cell.variables.map((v) => (
                  <span
                    key={v.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/20 text-xs text-blue-300 font-mono"
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground">=</span>
                    <span>{String(v.value)}</span>
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {cell.status === 'error' && cell.errorMessage && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-sm text-destructive font-mono">{cell.errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text Cell
// ---------------------------------------------------------------------------
interface TextCellContentProps {
  cell: TextCell;
  cellIndex: number;
}

function TextCellContent({ cell, cellIndex }: TextCellContentProps) {
  const { updateTextContent } = useWorksheetActions();
  const [isEditing, setIsEditing] = useState(cell.content === '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !isEditing) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [cell.content, isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const cellLabel = `Text cell ${cellIndex + 1}`;

  return (
    <div>
      {isEditing ? (
        <div className="space-y-2">
          <label htmlFor={`text-input-${cell.id}`} className="sr-only">
            {cellLabel} — enter markdown text (Escape to preview)
          </label>
          <Textarea
            id={`text-input-${cell.id}`}
            ref={textareaRef}
            value={cell.content}
            onChange={(e) => updateTextContent(cell.id, e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            placeholder="Write notes in Markdown... (Escape to preview)"
            className={cn(
              'min-h-[5rem] resize-none overflow-hidden text-sm leading-relaxed transition-colors',
              'bg-muted/20 border-border/40 hover:border-border focus-visible:border-emerald-500/60',
            )}
            aria-label={`${cellLabel} — markdown editor`}
          />
          <p className="text-xs text-muted-foreground">
            Markdown supported. Press Escape or click outside to preview.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            'w-full text-left rounded-lg p-3 min-h-[3rem] transition-all duration-200',
            'hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            cell.content ? '' : 'text-muted-foreground/50 italic',
          )}
          onClick={() => setIsEditing(true)}
          aria-label={`${cellLabel} — click to edit`}
        >
          {cell.content ? (
            <MarkdownPreview markdown={cell.content} />
          ) : (
            <span className="text-sm">Click to add notes...</span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Simple markdown preview — handles the most common markdown constructs
 * without pulling in a heavy library. Uses the math-engine renderMarkdown
 * utility for full fidelity when available.
 */
function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');

  return (
    <div className="prose prose-sm prose-invert max-w-none text-foreground space-y-1">
      {lines.map((line, i) => {
        // Headings
        const h3Match = /^###\s+(.+)$/.exec(line);
        if (h3Match) {
          return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{h3Match[1]}</h3>;
        }
        const h2Match = /^##\s+(.+)$/.exec(line);
        if (h2Match) {
          return <h2 key={i} className="text-lg font-semibold mt-4 mb-1">{h2Match[1]}</h2>;
        }
        const h1Match = /^#\s+(.+)$/.exec(line);
        if (h1Match) {
          return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{h1Match[1]}</h1>;
        }

        // Horizontal rule
        if (/^---+$/.test(line)) {
          return <hr key={i} className="border-border/50 my-2" />;
        }

        // Unordered list
        const ulMatch = /^[-*+]\s+(.+)$/.exec(line);
        if (ulMatch) {
          return (
            <li key={i} className="list-disc list-inside text-sm text-muted-foreground ml-2">
              <InlineMarkdown text={ulMatch[1] ?? ''} />
            </li>
          );
        }

        // Ordered list
        const olMatch = /^\d+\.\s+(.+)$/.exec(line);
        if (olMatch) {
          return (
            <li key={i} className="list-decimal list-inside text-sm text-muted-foreground ml-2">
              <InlineMarkdown text={olMatch[1] ?? ''} />
            </li>
          );
        }

        // Blockquote
        const bqMatch = /^>\s*(.*)$/.exec(line);
        if (bqMatch) {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground text-sm"
            >
              {bqMatch[1]}
            </blockquote>
          );
        }

        // Empty line
        if (line.trim() === '') {
          return <br key={i} />;
        }

        // Paragraph
        return (
          <p key={i} className="text-sm text-foreground leading-relaxed">
            <InlineMarkdown text={line} />
          </p>
        );
      })}
    </div>
  );
}

/** Renders inline markdown: bold, italic, code, inline math */
function InlineMarkdown({ text }: { text: string }) {
  // Process segments: inline code, bold, italic, math
  const segments: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code: `code`
    const codeMatch = /^(.*?)`([^`]+)`(.*)$/s.exec(remaining);
    // Bold: **text**
    const boldMatch = /^(.*?)\*\*([^*]+)\*\*(.*)$/s.exec(remaining);
    // Italic: *text*
    const italicMatch = /^(.*?)\*([^*]+)\*(.*)$/s.exec(remaining);
    // Inline math: $expr$
    const mathMatch = /^(.*?)\$([^$]+)\$(.*)$/s.exec(remaining);

    // Find which match comes first (earliest prefix length)
    const candidates: Array<{ prefix: string; content: string; suffix: string; type: string }> = [];

    if (codeMatch) candidates.push({ prefix: codeMatch[1] ?? '', content: codeMatch[2] ?? '', suffix: codeMatch[3] ?? '', type: 'code' });
    if (boldMatch) candidates.push({ prefix: boldMatch[1] ?? '', content: boldMatch[2] ?? '', suffix: boldMatch[3] ?? '', type: 'bold' });
    if (italicMatch) candidates.push({ prefix: italicMatch[1] ?? '', content: italicMatch[2] ?? '', suffix: italicMatch[3] ?? '', type: 'italic' });
    if (mathMatch) candidates.push({ prefix: mathMatch[1] ?? '', content: mathMatch[2] ?? '', suffix: mathMatch[3] ?? '', type: 'math' });

    if (candidates.length === 0) {
      segments.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Pick the candidate with the shortest prefix (earliest in string)
    const best = candidates.reduce((a, b) => (a.prefix.length <= b.prefix.length ? a : b));

    if (best.prefix) {
      segments.push(<span key={key++}>{best.prefix}</span>);
    }

    if (best.type === 'code') {
      segments.push(
        <code key={key++} className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
          {best.content}
        </code>
      );
    } else if (best.type === 'bold') {
      segments.push(<strong key={key++} className="font-semibold">{best.content}</strong>);
    } else if (best.type === 'italic') {
      segments.push(<em key={key++} className="italic">{best.content}</em>);
    } else if (best.type === 'math') {
      segments.push(
        <MathRenderer
          key={key++}
          expression={best.content}
          displayMode={false}
          ariaLabel={`Inline math: ${best.content}`}
        />
      );
    }

    remaining = best.suffix;
  }

  return <>{segments}</>;
}

// ---------------------------------------------------------------------------
// Plot Cell
// ---------------------------------------------------------------------------
interface PlotCellContentProps {
  cell: PlotCell;
  cellIndex: number;
}

function PlotCellContent({ cell, cellIndex }: PlotCellContentProps) {
  const { updatePlotExpressions, updatePlotViewport } = useWorksheetActions();
  const [showViewport, setShowViewport] = useState(false);

  // Build Plot2DCartesianConfig from expression strings.
  // Each expression is evaluated at runtime using the math engine.
  const plotConfig = useMemo(() => {
    const exprs = cell.expressions
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed'];

    const functions = exprs.map((expr, i) => ({
      fn: (x: number) => {
        const result = evaluateExpr(expr, { variables: { x } });
        return result.success ? Number(result.value) : NaN;
      },
      label: expr,
      style: {
        line: {
          width: 2,
          color: colors[i % colors.length] ?? '#2563eb',
        },
      },
    }));

    const viewport = {
      xMin: cell.xMin,
      xMax: cell.xMax,
      yMin: cell.yMin,
      yMax: cell.yMax,
    };

    return {
      type: '2d-cartesian' as const,
      functions,
      viewport,
      xAxis: {
        label: 'x',
        min: cell.xMin,
        max: cell.xMax,
        scale: 'linear' as const,
        grid: { enabled: true, majorStep: (cell.xMax - cell.xMin) / 10, color: '#e5e7eb', opacity: 0.4 },
        ticks: { enabled: true, format: (v: number) => v.toFixed(1) },
      },
      yAxis: {
        label: 'y',
        min: cell.yMin,
        max: cell.yMax,
        scale: 'linear' as const,
        grid: { enabled: true, majorStep: (cell.yMax - cell.yMin) / 10, color: '#e5e7eb', opacity: 0.4 },
        ticks: { enabled: true, format: (v: number) => v.toFixed(1) },
      },
    };
  }, [cell.expressions, cell.xMin, cell.xMax, cell.yMin, cell.yMax]);

  const cellLabel = `Plot cell ${cellIndex + 1}`;

  return (
    <div className="space-y-3">
      {/* Expression input */}
      <div>
        <label htmlFor={`plot-expr-${cell.id}`} className="text-xs font-medium text-muted-foreground mb-1 block">
          Functions (comma-separated)
        </label>
        <Input
          id={`plot-expr-${cell.id}`}
          value={cell.expressions}
          onChange={(e) => updatePlotExpressions(cell.id, e.target.value)}
          placeholder="sin(x), cos(x), x^2/10"
          className="font-mono text-sm"
          aria-label={`${cellLabel} — function expressions`}
        />
      </div>

      {/* Viewport controls (collapsible) */}
      <div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
          onClick={() => setShowViewport((v) => !v)}
          aria-expanded={showViewport}
          aria-controls={`plot-viewport-${cell.id}`}
        >
          <span>{showViewport ? '▾' : '▸'}</span>
          Viewport settings
        </button>

        {showViewport && (
          <div
            id={`plot-viewport-${cell.id}`}
            className="grid grid-cols-2 gap-2 mt-2"
          >
            {(
              [
                ['xMin', 'X Min', cell.xMin],
                ['xMax', 'X Max', cell.xMax],
                ['yMin', 'Y Min', cell.yMin],
                ['yMax', 'Y Max', cell.yMax],
              ] as Array<[keyof { xMin: number; xMax: number; yMin: number; yMax: number }, string, number]>
            ).map(([field, label, value]) => (
              <div key={field}>
                <label
                  htmlFor={`plot-${field}-${cell.id}`}
                  className="text-xs text-muted-foreground block mb-1"
                >
                  {label}
                </label>
                <Input
                  id={`plot-${field}-${cell.id}`}
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updatePlotViewport(cell.id, {
                      xMin: field === 'xMin' ? v : cell.xMin,
                      xMax: field === 'xMax' ? v : cell.xMax,
                      yMin: field === 'yMin' ? v : cell.yMin,
                      yMax: field === 'yMax' ? v : cell.yMax,
                    });
                  }}
                  className="h-8 text-xs font-mono"
                  aria-label={`${label} for ${cellLabel}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2D Plot canvas */}
      <div
        className="relative rounded-xl overflow-hidden border border-border/40 bg-background"
        aria-label={`${cellLabel} — plot of ${cell.expressions}`}
      >
        <Plot2D
          config={plotConfig}
          width={800}
          height={340}
          className="w-full h-auto"
          enableInteractions
          onViewportChange={(vp) => updatePlotViewport(cell.id, vp)}
        />
        {cell.status === 'error' && cell.errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {cell.errorMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell container — wraps all cell kinds with chrome (header, controls)
// ---------------------------------------------------------------------------
export interface WorksheetCellProps {
  cell: WorksheetCellType;
  cellIndex: number;
  totalCells: number;
  isFirst: boolean;
  isLast: boolean;
  getVariablesUpTo: (id: string) => Record<string, number | bigint | string>;
}

export const WorksheetCell = memo(function WorksheetCell({
  cell,
  cellIndex,
  totalCells,
  isFirst,
  isLast,
  getVariablesUpTo,
}: WorksheetCellProps) {
  const { deleteCell, moveCellUp, moveCellDown } = useWorksheetActions();
  const meta = kindMeta[cell.kind];
  const Icon = meta.icon;

  const cellLabel = `${meta.label} cell ${cellIndex + 1} of ${totalCells}`;

  // Remote collaborator presence on this cell
  const remotePeers = useRemotePeers();
  const editingPeers = remotePeers.filter((p) => p.activeCellId === cell.id);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'group relative rounded-xl border bg-card text-card-foreground shadow-sm',
        'transition-shadow duration-200 hover:shadow-md hover:shadow-primary/5',
        // When a remote peer is editing, override border colour via inline style below
        editingPeers.length > 0 ? 'border-transparent' : 'border-border/60 hover:border-border',
      )}
      {...(editingPeers.length > 0 && editingPeers[0]
        ? { style: { border: `1.5px solid ${editingPeers[0].color}80` } }
        : {})}
      aria-label={cellLabel}
      role="region"
      onFocusCapture={() => {
        localActiveCellRef.current = cell.id;
      }}
      onBlurCapture={() => {
        // Only clear if focus leaves this cell entirely
        if (localActiveCellRef.current === cell.id) {
          localActiveCellRef.current = null;
        }
      }}
    >
      {/* Remote collaborator editing indicator — shown above the header */}
      <AnimatePresence>
        {editingPeers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden rounded-t-xl"
            aria-live="polite"
          >
            <div
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs"
              style={{
                borderTop: `2px solid ${editingPeers[0]?.color ?? '#60a5fa'}`,
                backgroundColor: `${editingPeers[0]?.color ?? '#60a5fa'}10`,
              }}
            >
              {editingPeers.map((peer) => (
                <span
                  key={peer.id}
                  className="inline-flex items-center gap-1"
                  aria-label={`${peer.name} is editing this cell`}
                >
                  <span
                    className="flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-bold text-background"
                    style={{ backgroundColor: peer.color }}
                    aria-hidden="true"
                  >
                    {peer.name.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ color: peer.color }}>{peer.name}</span>
                </span>
              ))}
              <span className="text-muted-foreground/70 ml-0.5">editing…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cell header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          {/* Drag handle (visual only; keyboard reorder via buttons) */}
          <GripVertical
            className="h-4 w-4 text-muted-foreground/40 cursor-grab select-none"
            aria-hidden="true"
          />
          <Icon className={cn('h-3.5 w-3.5', meta.color)} aria-hidden="true" />
          <span className={cn('text-xs font-medium', meta.color)}>
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground/50 font-mono">
            [{cellIndex + 1}]
          </span>
        </div>

        {/* Controls */}
        <div
          className={cn(
            'flex items-center gap-1 transition-opacity duration-150',
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
          role="toolbar"
          aria-label={`Controls for ${cellLabel}`}
        >
          {/* Status indicator for evaluable cells */}
          {'status' in cell && (
            <span className="mr-1">
              <StatusIcon
                status={cell.status}
                errorMessage={'errorMessage' in cell ? cell.errorMessage : null}
              />
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => moveCellUp(cell.id)}
            disabled={isFirst}
            aria-label={`Move ${cellLabel} up`}
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => moveCellDown(cell.id)}
            disabled={isLast}
            aria-label={`Move ${cellLabel} down`}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
            onClick={() => deleteCell(cell.id)}
            disabled={totalCells <= 1}
            aria-label={`Delete ${cellLabel}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Cell body */}
      <div className="p-4">
        {cell.kind === 'math' && (
          <MathCellContent
            cell={cell}
            cellIndex={cellIndex}
            getVariablesUpTo={getVariablesUpTo}
          />
        )}
        {cell.kind === 'text' && (
          <TextCellContent cell={cell} cellIndex={cellIndex} />
        )}
        {cell.kind === 'plot' && (
          <PlotCellContent cell={cell} cellIndex={cellIndex} />
        )}
      </div>
    </motion.article>
  );
});
