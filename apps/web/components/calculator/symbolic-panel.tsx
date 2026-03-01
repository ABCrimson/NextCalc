'use client';

import { evaluate } from '@nextcalc/math-engine';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, ChevronUp, Copy, Info, ListOrdered } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';
import type { AnalysisFunction } from '@/components/plots/PlotAnalysisPanel';
import dynamic from 'next/dynamic';

const PlotAnalysisPanel = dynamic(
  () => import('@/components/plots/PlotAnalysisPanel').then((m) => ({ default: m.PlotAnalysisPanel })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" /> },
);
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathRenderer } from '@/components/ui/math-renderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ============================================================================
// STEP DISPLAY TYPES — mirrors the solver-panel pattern
// ============================================================================

/** Category badge color mapping (same palette as SolverPanel) */
type StepCategoryStyle = {
  readonly bg: string;
  readonly text: string;
  readonly border: string;
  readonly label: string;
};

/**
 * A rendered solution step ready for display.
 * The `latex` field is what gets passed to MathRenderer.
 */
interface RenderedStep {
  readonly stepNumber: number;
  readonly description: string;
  readonly explanation: string;
  readonly operation: string;
  readonly category: string;
  readonly latex: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Step category → visual style mapping — identical to SolverPanel */
const CATEGORY_STYLES: Readonly<Record<string, StepCategoryStyle>> = {
  Identification: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    label: 'Identify',
  },
  Simplification: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    label: 'Simplify',
  },
  Differentiation: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500/30',
    label: 'Differentiate',
  },
  Integration: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    label: 'Integrate',
  },
  Rearrangement: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    label: 'Rearrange',
  },
  Isolation: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-500/30',
    label: 'Isolate',
  },
  Factorization: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-500/30',
    label: 'Factor',
  },
  Formula: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/30',
    label: 'Formula',
  },
  Substitution: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500/30',
    label: 'Substitute',
  },
  Expansion: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500/30',
    label: 'Expand',
  },
  Identity: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    label: 'Identity',
  },
  FinalAnswer: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/30',
    label: 'Answer',
  },
  Evaluation: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-500/30',
    label: 'Evaluate',
  },
} satisfies Record<string, StepCategoryStyle>;

const DEFAULT_CATEGORY_STYLE: StepCategoryStyle = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
  border: 'border-border',
  label: 'Step',
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Step category badge */
function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_CATEGORY_STYLE;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
        style.bg,
        style.text,
        style.border,
      )}
    >
      {style.label}
    </span>
  );
}

interface StepCardProps {
  step: RenderedStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isFinal: boolean;
}

/**
 * Collapsible step card with Framer Motion expand animation.
 * Keyboard accessible: Enter/Space to toggle.
 */
function StepCard({ step, index, isExpanded, onToggle, isFinal }: StepCardProps) {
  const headerId = useId();
  const bodyId = useId();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      className={cn(
        'rounded-lg border overflow-hidden',
        isFinal ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
    >
      {/* Step header — clickable toggle */}
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={bodyId}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'transition-colors duration-150',
          isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20',
        )}
      >
        {/* Step number bubble */}
        <span
          className={cn(
            'flex-none mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0',
            isFinal ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {step.stepNumber}
        </span>

        {/* Step description + category */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {step.description}
            </span>
            <CategoryBadge category={step.category} />
          </div>
          {/* LaTeX preview — always visible */}
          <div className="mt-1.5 overflow-x-auto" aria-label={`Step ${step.stepNumber} expression`}>
            <MathRenderer expression={step.latex} displayMode={false} className="text-base" />
          </div>
        </div>

        {/* Expand/collapse chevron */}
        <span className="flex-none mt-0.5 text-muted-foreground" aria-hidden="true">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expandable explanation body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={bodyId}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/60">
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                {step.explanation}
              </p>
              {/* Display-mode math for expanded state */}
              <div
                className="mt-3 rounded-md bg-muted/50 px-4 py-3 overflow-x-auto"
                aria-label={`Step ${step.stepNumber} expression, display mode`}
              >
                <MathRenderer expression={step.latex} displayMode={true} className="text-base" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground/70 font-mono">
                Operation: {step.operation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// STEPS PANEL SUB-COMPONENT
// ============================================================================

interface StepsPanelProps {
  steps: ReadonlyArray<RenderedStep>;
  finalLatex: string;
  timeMs: number;
  copiedSteps: boolean;
  onCopyFinal: () => Promise<void>;
}

/**
 * Renders the full step-by-step breakdown with expand/collapse controls,
 * animated step cards, and a final-answer callout.
 */
function StepsPanel({ steps, finalLatex, timeMs, copiedSteps, onCopyFinal }: StepsPanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<number>>(
    new Set(steps.length > 0 ? [steps[steps.length - 1]!.stepNumber] : []),
  );

  const toggleStep = useCallback((stepNumber: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSteps(new Set(steps.map((s) => s.stepNumber)));
  }, [steps]);

  const collapseAll = useCallback(() => {
    setExpandedSteps(new Set());
  }, []);

  const allExpanded = expandedSteps.size === steps.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
      role="region"
      aria-label="Step-by-step solution"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Solution — {steps.length} step{steps.length !== 1 ? 's' : ''}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Computed in {timeMs.toFixed(1)} ms</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={allExpanded ? collapseAll : expandAll}
          className="text-xs h-7"
          aria-label={allExpanded ? 'Collapse all steps' : 'Expand all steps'}
        >
          {allExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" />
              Collapse all
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" />
              Expand all
            </>
          )}
        </Button>
      </div>

      {/* Step list */}
      <ol className="list-none" aria-label={`${steps.length} solution steps`}>
        <AnimatePresence mode="popLayout">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <li key={step.stepNumber}>
                <StepCard
                  step={step}
                  index={idx}
                  isExpanded={expandedSteps.has(step.stepNumber)}
                  onToggle={() => toggleStep(step.stepNumber)}
                  isFinal={isLast}
                />
                {/* Animated arrow connector between steps */}
                {!isLast && (
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                    className="flex items-center justify-center h-6 select-none"
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-0">
                      <div className="w-px h-3 bg-border" />
                      <svg
                        width="8"
                        height="5"
                        viewBox="0 0 8 5"
                        fill="none"
                        className="text-border"
                      >
                        <path d="M0 0L4 5L8 0" fill="currentColor" />
                      </svg>
                    </div>
                  </motion.div>
                )}
              </li>
            );
          })}
        </AnimatePresence>
      </ol>

      {/* Final answer callout */}
      <div
        className="rounded-xl border border-primary/30 bg-primary/5 p-4"
        role="region"
        aria-label="Final answer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Final Answer
            </p>
            <div className="overflow-x-auto">
              <MathRenderer
                expression={finalLatex}
                displayMode={true}
                className="text-lg"
                ariaLabel={`Final answer: ${finalLatex}`}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyFinal}
            aria-label="Copy final answer to clipboard"
            className="flex-none h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copiedSteps ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// HELPERS — convert raw SolutionStep data to RenderedStep
// ============================================================================

/**
 * Typed view over an AST node object — used to convert `from`/`to` nodes
 * to a displayable LaTeX string without importing the full AST module.
 */
interface AstNodeShape {
  readonly type: string;
  readonly value?: number | bigint | string;
  readonly name?: string;
  readonly op?: string;
  readonly fn?: string;
  readonly args?: readonly unknown[];
}

function toAstShape(node: unknown): AstNodeShape | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as AstNodeShape;
  if (typeof n.type !== 'string') return null;
  return n;
}

function needsParens(node: unknown): boolean {
  const n = toAstShape(node);
  if (!n || n.type !== 'OperatorNode') return false;
  const op = String(n.op ?? '');
  return op === '+' || op === '-';
}

/** Convert an AST node to a compact LaTeX string */
function astNodeToLatex(node: unknown): string {
  const n = toAstShape(node);
  if (!n) return String(node ?? '');

  if (n.type === 'ConstantNode') {
    const v = n.value;
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    return String(v ?? '');
  }

  if (n.type === 'SymbolNode') {
    return String(n.name ?? '');
  }

  if (n.type === 'OperatorNode') {
    const args = n.args ?? [];
    const left = astNodeToLatex(args[0]);
    const right = astNodeToLatex(args[1]);
    const op = String(n.op ?? '');

    switch (op) {
      case '+':
        return `${left} + ${right}`;
      case '-':
        return `${left} - ${right}`;
      case '*': {
        const l = needsParens(args[0]) ? `\\left(${left}\\right)` : left;
        const r = needsParens(args[1]) ? `\\left(${right}\\right)` : right;
        return `${l} \\cdot ${r}`;
      }
      case '/':
        return `\\frac{${left}}{${right}}`;
      case '^': {
        const base = needsParens(args[0]) ? `\\left(${left}\\right)` : left;
        return `${base}^{${right}}`;
      }
      default:
        return `${left} ${op} ${right}`;
    }
  }

  if (n.type === 'UnaryOperatorNode') {
    const args = n.args ?? [];
    const operand = astNodeToLatex(args[0]);
    return `-${needsParens(args[0]) ? `\\left(${operand}\\right)` : operand}`;
  }

  if (n.type === 'FunctionNode') {
    const fn = String(n.fn ?? '');
    const args = (n.args ?? []).map(astNodeToLatex);
    switch (fn) {
      case 'sin':
        return `\\sin\\left(${args[0]}\\right)`;
      case 'cos':
        return `\\cos\\left(${args[0]}\\right)`;
      case 'tan':
        return `\\tan\\left(${args[0]}\\right)`;
      case 'asin':
        return `\\arcsin\\left(${args[0]}\\right)`;
      case 'acos':
        return `\\arccos\\left(${args[0]}\\right)`;
      case 'atan':
        return `\\arctan\\left(${args[0]}\\right)`;
      case 'sinh':
        return `\\sinh\\left(${args[0]}\\right)`;
      case 'cosh':
        return `\\cosh\\left(${args[0]}\\right)`;
      case 'tanh':
        return `\\tanh\\left(${args[0]}\\right)`;
      case 'sqrt':
        return `\\sqrt{${args[0]}}`;
      case 'exp':
        return `e^{${args[0]}}`;
      case 'log':
      case 'ln':
        return `\\ln\\left(${args[0]}\\right)`;
      case 'log10':
        return `\\log_{10}\\left(${args[0]}\\right)`;
      case 'log2':
        return `\\log_{2}\\left(${args[0]}\\right)`;
      case 'abs':
        return `\\left|${args[0]}\\right|`;
      default:
        return `\\operatorname{${fn}}\\left(${args.join(', ')}\\right)`;
    }
  }

  return '?';
}

/**
 * Convert a raw SolutionStep (from step-solver) into a RenderedStep suitable
 * for display. Uses the `latex` field when present, otherwise synthesizes one
 * from the `to` AST node.
 */
function toRenderedStep(step: {
  stepNumber: number;
  description: string;
  explanation: string;
  operation: string;
  category: string;
  latex?: string;
  to: unknown;
}): RenderedStep {
  const latex = step.latex ?? astNodeToLatex(step.to);
  return {
    stepNumber: step.stepNumber,
    description: step.description,
    explanation: step.explanation,
    operation: step.operation,
    category: step.category,
    latex,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Symbolic Mathematics Panel
 *
 * Provides UI for symbolic differentiation and integration.
 * After a successful operation the user can toggle "Show Steps" to view
 * an animated, collapsible step-by-step breakdown powered by the math
 * engine's `solveWithSteps()`. The quick-result view is always the default.
 *
 * After differentiation, shows an "Analysis: Intercepts & Critical Points"
 * panel for both the original function and its derivative.
 *
 * Accessibility:
 * - ARIA labels for all inputs and interactive regions
 * - Keyboard navigable (Tab / Enter / Space / arrow keys)
 * - Screen-reader friendly with aria-live regions
 * - Error announcements via aria-live="assertive"
 * - Step cards fully keyboard operable
 *
 * @example
 * <SymbolicPanel />
 */
export function SymbolicPanel() {
  const [expression, setExpression] = useState('x^2 + sin(x)');
  const [variable, setVariable] = useState('x');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeOperation, setActiveOperation] = useState<'differentiate' | 'integrate' | null>(
    null,
  );

  // Step-by-step state
  const [steps, setSteps] = useState<ReadonlyArray<RenderedStep>>([]);
  const [showSteps, setShowSteps] = useState(false);
  const [stepsTimeMs, setStepsTimeMs] = useState(0);
  const [copiedSteps, setCopiedSteps] = useState(false);
  const [finalLatex, setFinalLatex] = useState('');

  const resetStepState = () => {
    setSteps([]);
    setShowSteps(false);
    setFinalLatex('');
    setStepsTimeMs(0);
    setCopiedSteps(false);
  };

  const handleDifferentiate = async () => {
    setIsCalculating(true);
    setError(null);
    setResult(null);
    setActiveOperation(null);
    resetStepState();

    try {
      const { differentiate, astToString, solveWithSteps, ProblemType } = await import(
        '@nextcalc/math-engine/symbolic'
      );
      const { parse } = await import('@nextcalc/math-engine/parser');

      // Quick result (existing behaviour)
      const ast = parse(expression);
      const derivative = differentiate(ast, variable);
      const resultStr = astToString(derivative);
      setResult(resultStr);
      setActiveOperation('differentiate');

      // Step-by-step solution
      const t0 = performance.now();
      const solution = solveWithSteps(expression, ProblemType.Derivative);
      const elapsed = performance.now() - t0;

      const rendered = solution.steps.map((s) => toRenderedStep(s));
      setSteps(rendered);
      setStepsTimeMs(elapsed);

      // Build final latex from result string
      setFinalLatex(`\\frac{d}{d${variable}}\\left[${expression}\\right] = ${resultStr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to differentiate expression');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleIntegrate = async () => {
    setIsCalculating(true);
    setError(null);
    setResult(null);
    setActiveOperation(null);
    resetStepState();

    try {
      const { integrate, astToString, solveWithSteps, ProblemType } = await import(
        '@nextcalc/math-engine/symbolic'
      );
      const { parse } = await import('@nextcalc/math-engine/parser');

      // Quick result (existing behaviour)
      const ast = parse(expression);
      const integral = integrate(ast, variable);
      const resultStr = astToString(integral) + ' + C';
      setResult(resultStr);
      setActiveOperation('integrate');

      // Step-by-step solution
      const t0 = performance.now();
      const solution = solveWithSteps(expression, ProblemType.Integral);
      const elapsed = performance.now() - t0;

      const rendered = solution.steps.map((s) => toRenderedStep(s));
      setSteps(rendered);
      setStepsTimeMs(elapsed);

      // Build final latex from result string
      setFinalLatex(`\\int ${expression} \\, d${variable} = ${resultStr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to integrate expression');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCopyFinal = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(finalLatex);
      setCopiedSteps(true);
      setTimeout(() => setCopiedSteps(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }, [finalLatex]);

  const diffExamples = [
    { expr: 'x^2', label: 'Polynomial' },
    { expr: 'sin(x)', label: 'Trigonometric' },
    { expr: 'exp(x)', label: 'Exponential' },
    { expr: 'ln(x)', label: 'Logarithmic' },
    { expr: 'x^2 * sin(x)', label: 'Product rule' },
    { expr: 'sin(x) / x', label: 'Quotient rule' },
    { expr: 'atan(x^2)', label: 'Chain rule' },
    { expr: 'x^3 * exp(x)', label: 'Poly × Exp' },
    { expr: 'ln(x) * cos(x)', label: 'Log × Trig' },
    { expr: 'sqrt(x^2 + 1)', label: 'Radical chain' },
  ];

  const intExamples = [
    { expr: 'x^2', label: 'Power rule' },
    { expr: 'sin(x)', label: 'Trigonometric' },
    { expr: 'exp(x)', label: 'Exponential' },
    { expr: 'ln(x)', label: 'Logarithmic' },
    { expr: 'x * sin(x)', label: 'IBP: x·sin' },
    { expr: 'sin(x) / x', label: 'Sine Integral' },
    { expr: 'cos(x) / x', label: 'Cosine Integral' },
    { expr: 'x^2 * exp(x)', label: 'IBP: x²·eˣ' },
    { expr: 'x * ln(x)', label: 'IBP: x·ln' },
    { expr: 'asin(x)', label: 'Inverse trig' },
  ];

  // -------------------------------------------------------------------------
  // Analysis panel — build AnalysisFunction array for the original function
  // and its derivative when differentiation has been performed.
  // -------------------------------------------------------------------------

  const analysisFunctions = useMemo<AnalysisFunction[]>(() => {
    if (activeOperation !== 'differentiate' || !result || variable !== 'x') return [];

    const fns: AnalysisFunction[] = [];

    const origExpr = expression.trim();
    if (origExpr) {
      fns.push({
        fn: (x: number) => {
          const r = evaluate(origExpr, { variables: { x } });
          return r.success ? Number(r.value) : NaN;
        },
        label: `f(x) = ${origExpr}`,
        color: '#60a5fa', // blue-400
      });
    }

    const derivExpr = result.trim();
    if (derivExpr) {
      fns.push({
        fn: (x: number) => {
          const r = evaluate(derivExpr, { variables: { x } });
          return r.success ? Number(r.value) : NaN;
        },
        label: `f'(x) = ${derivExpr}`,
        color: '#f472b6', // pink-400
      });
    }

    return fns;
  }, [activeOperation, result, expression, variable]);

  const analysisViewport = { xMin: -6, xMax: 6, yMin: -10, yMax: 10 };

  // -------------------------------------------------------------------------
  // Shared: "Show Steps" toggle button + steps panel
  // -------------------------------------------------------------------------
  const hasSteps = steps.length > 0;

  const stepsToggleButton = hasSteps && (
    <Button
      variant={showSteps ? 'secondary' : 'outline'}
      size="sm"
      onClick={() => setShowSteps((v) => !v)}
      aria-expanded={showSteps}
      aria-controls="symbolic-steps-panel"
      className="gap-2"
    >
      <ListOrdered className="h-4 w-4" aria-hidden="true" />
      {showSteps ? 'Hide Steps' : 'Show Steps'}
    </Button>
  );

  const stepsSection = hasSteps && (
    <AnimatePresence initial={false}>
      {showSteps && (
        <motion.div
          id="symbolic-steps-panel"
          key="steps"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="pt-2">
            <StepsPanel
              steps={steps}
              finalLatex={finalLatex}
              timeMs={stepsTimeMs}
              copiedSteps={copiedSteps}
              onCopyFinal={handleCopyFinal}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Card className="p-6">
      <Tabs defaultValue="differentiate" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="differentiate">Differentiate (d/d{variable})</TabsTrigger>
          <TabsTrigger value="integrate">Integrate (&int;d{variable})</TabsTrigger>
        </TabsList>

        {/* ================================================================
            DIFFERENTIATE TAB
        ================================================================ */}
        <TabsContent value="differentiate" className="space-y-6">
          {/* Info banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Symbolic differentiation with chain, product, and quotient rules. After computing, the
              analysis panel below will show intercepts and critical points.
            </AlertDescription>
          </Alert>

          {/* Input section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="expression" className="text-base">
                Function f({variable})
              </Label>
              <Input
                id="expression"
                value={expression}
                onChange={(e) => {
                  setExpression(e.target.value);
                  setActiveOperation(null);
                  resetStepState();
                }}
                placeholder="x^2 + sin(x)"
                className="font-mono mt-2"
                aria-describedby="expression-help"
              />
              <p id="expression-help" className="text-xs text-muted-foreground mt-1">
                Enter a mathematical expression using x, +, -, *, /, ^, sin, cos, tan, exp, ln, sqrt
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="variable" className="text-base">
                With respect to
              </Label>
              <Input
                id="variable"
                value={variable}
                onChange={(e) => {
                  setVariable(e.target.value);
                  setActiveOperation(null);
                  resetStepState();
                }}
                placeholder="x"
                className="w-20 font-mono"
                maxLength={1}
              />
            </div>

            <Button
              onClick={handleDifferentiate}
              className="w-full"
              disabled={isCalculating || !expression.trim()}
              aria-label={`Calculate derivative of ${expression} with respect to ${variable}`}
            >
              {isCalculating ? 'Calculating...' : `Calculate d/d${variable}`}
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Quick result display + Show Steps toggle */}
          {result && !error && (
            <div className="space-y-3">
              <div
                className="p-6 bg-muted rounded-lg space-y-3"
                role="region"
                aria-label="Calculation result"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-muted-foreground font-semibold">Result:</div>
                  {stepsToggleButton}
                </div>
                <div className="text-xl font-mono break-all">{result}</div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  d/d{variable} [{expression}] = {result}
                </div>
              </div>

              {stepsSection}
            </div>
          )}

          {/* Critical points analysis */}
          {analysisFunctions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Analysis computed over x &isin; [&minus;6, 6]. Scroll into range and re-compute if
                your function lives on a different domain.
              </p>
              <PlotAnalysisPanel
                functions={analysisFunctions}
                viewport={analysisViewport}
                samples={500}
              />
            </div>
          )}

          {/* Example expressions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Example Expressions:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {diffExamples.map((example) => (
                <Button
                  key={example.expr}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpression(example.expr);
                    setActiveOperation(null);
                    resetStepState();
                  }}
                  className="justify-start font-mono text-xs"
                  title={example.label}
                >
                  <span className="truncate">{example.expr}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Help section */}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold hover:text-primary">
              Supported Functions
            </summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>
                <strong>Trigonometric:</strong> sin(x), cos(x), tan(x), sec(x), csc(x), cot(x)
              </p>
              <p>
                <strong>Inverse Trig:</strong> asin(x), acos(x), atan(x), asec(x), acsc(x), acot(x)
              </p>
              <p>
                <strong>Hyperbolic:</strong> sinh(x), cosh(x), tanh(x)
              </p>
              <p>
                <strong>Exponential:</strong> exp(x), 2^x, 10^x
              </p>
              <p>
                <strong>Logarithmic:</strong> ln(x), log(x), log10(x)
              </p>
              <p>
                <strong>Other:</strong> sqrt(x), abs(x), x^n
              </p>
              <p>
                <strong>Operations:</strong> +, -, *, /, ^, ()
              </p>
            </div>
          </details>
        </TabsContent>

        {/* ================================================================
            INTEGRATE TAB
        ================================================================ */}
        <TabsContent value="integrate" className="space-y-6">
          {/* Info banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Symbolic integration supports power rule, exponential, logarithmic, trigonometric, and
              integration by parts. Special functions Si(x) and Ci(x) are returned for sin(x)/x and
              cos(x)/x respectively. Complex expressions will suggest numerical integration.
            </AlertDescription>
          </Alert>

          {/* Input section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="expression-int" className="text-base">
                Integrand f({variable})
              </Label>
              <Input
                id="expression-int"
                value={expression}
                onChange={(e) => {
                  setExpression(e.target.value);
                  setActiveOperation(null);
                  resetStepState();
                }}
                placeholder="x^2 + sin(x)"
                className="font-mono mt-2"
                aria-describedby="expression-int-help"
              />
              <p id="expression-int-help" className="text-xs text-muted-foreground mt-1">
                Enter a mathematical expression to integrate
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="variable-int" className="text-base">
                With respect to
              </Label>
              <Input
                id="variable-int"
                value={variable}
                onChange={(e) => {
                  setVariable(e.target.value);
                  setActiveOperation(null);
                  resetStepState();
                }}
                placeholder="x"
                className="w-20 font-mono"
                maxLength={1}
              />
            </div>

            <Button
              onClick={handleIntegrate}
              className="w-full"
              disabled={isCalculating || !expression.trim()}
              aria-label={`Calculate integral of ${expression} with respect to ${variable}`}
            >
              {isCalculating ? 'Calculating...' : `Calculate \u222b d${variable}`}
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Quick result display + Show Steps toggle */}
          {result && !error && (
            <div className="space-y-3">
              <div
                className="p-6 bg-muted rounded-lg space-y-3"
                role="region"
                aria-label="Integration result"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-muted-foreground font-semibold">Result:</div>
                  {stepsToggleButton}
                </div>
                <div className="text-xl font-mono break-all">{result}</div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  &int; [{expression}] d{variable} = {result}
                </div>
              </div>

              {stepsSection}
            </div>
          )}

          {/* Example expressions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Example Integrands:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {intExamples.map((example) => (
                <Button
                  key={example.expr}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpression(example.expr);
                    setActiveOperation(null);
                    resetStepState();
                  }}
                  className="justify-start font-mono text-xs"
                  title={example.label}
                >
                  <span className="truncate">{example.expr}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Help section */}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold hover:text-primary">
              Supported Functions
            </summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>
                <strong>Trigonometric:</strong> sin(x), cos(x), tan(x), sec(x), csc(x), cot(x)
              </p>
              <p>
                <strong>Inverse Trig:</strong> asin(x), acos(x), atan(x), asec(x), acsc(x), acot(x)
              </p>
              <p>
                <strong>Hyperbolic:</strong> sinh(x), cosh(x), tanh(x)
              </p>
              <p>
                <strong>Exponential:</strong> exp(x), 2^x, 10^x, a^x
              </p>
              <p>
                <strong>Logarithmic:</strong> ln(x), log(x), log10(x), log2(x)
              </p>
              <p>
                <strong>Power:</strong> x^n (n &ne; -1)
              </p>
              <p className="text-xs italic pt-2 border-t">
                Note: Complex expressions may suggest numerical integration. Division and chain rule
                patterns have limited support.
              </p>
            </div>
          </details>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
