'use client';

/**
 * VariableSliders — Desmos-style interactive parameter sliders for 2D plots.
 *
 * Automatically detects free parameters in one or more math expressions (any
 * identifier that is not a known axis variable, math constant, or built-in
 * function name) and renders a compact slider row for each one.
 *
 * Features:
 *  - Per-slider min/max editing via inline click-to-edit number inputs
 *  - Step size auto-chosen from range (1/200 of span, clamped to 4 d.p.)
 *  - Real-time value display (4 significant figures)
 *  - Keyboard navigation (arrow keys, Home/End)
 *  - Fully ARIA-labelled range inputs for screen readers
 *  - Framer Motion entrance animation
 *  - Zero `any` — strict TypeScript throughout
 *
 * @module components/plot/variable-sliders
 */

import { extractVariables } from '@nextcalc/math-engine';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Identifiers that should never appear as slider parameters.
 * Covers: axis variables, math constants, and every built-in function name
 * that the math-engine parser recognises as a FunctionNode (not a SymbolNode).
 * `extractVariables` already skips FunctionNode names, but constants like
 * "pi", "e", "i" and "tau" appear as SymbolNodes and need explicit exclusion.
 */
const EXCLUDED_NAMES = new Set([
  // Axis / parameter variables
  'x',
  'y',
  'z',
  't',
  'theta',
  'u',
  'v',
  'r',
  'n',
  // Mathematical constants
  'pi',
  'e',
  'i',
  'tau',
  'inf',
  'infinity',
  'nan',
  // Greek forms commonly typed by users
  'π',
  'τ',
]);

const DEFAULT_MIN = -10;
const DEFAULT_MAX = 10;
const DEFAULT_VALUE = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SliderConfig {
  /** Current slider value */
  value: number;
  /** Range minimum */
  min: number;
  /** Range maximum */
  max: number;
}

/** Map from parameter name to its current slider configuration. */
export type SliderValues = Record<string, SliderConfig>;

export interface VariableSlidersProps {
  /**
   * One or more expression strings to scan for free parameters.
   * When multiple expressions are provided (e.g. x(t) and y(t)) the union of
   * their free parameters is displayed.
   */
  expressions: string[];
  /**
   * Called every time any slider value changes, with the full map of
   * { paramName -> value } suitable for passing to `evaluate()`.
   */
  onChange: (values: Record<string, number>) => void;
  /** Optional extra class names applied to the container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round a step to at most 4 decimal places to avoid floating-point noise. */
function niceStep(min: number, max: number): number {
  const span = Math.abs(max - min) || 1;
  const raw = span / 200;
  // Clamp to 4 decimal places
  return Math.max(0.0001, parseFloat(raw.toFixed(4)));
}

/** Format a value for display: up to 4 significant figures, no trailing zeros. */
function formatValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return parseFloat(v.toPrecision(4)).toString();
}

/** Parse a free-text number input; return `fallback` if invalid. */
function parseNumber(raw: string, fallback: number): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Given a set of expressions, extract all free parameter names (identifiers
 * that are not in the excluded set and not empty).
 */
function detectParameters(expressions: string[]): string[] {
  const seen = new Set<string>();
  for (const expr of expressions) {
    if (!expr.trim()) continue;
    try {
      const vars = extractVariables(expr);
      for (const v of vars) {
        if (!EXCLUDED_NAMES.has(v)) {
          seen.add(v);
        }
      }
    } catch {
      // Invalid / incomplete expression — ignore and continue
    }
  }
  return Array.from(seen).sort();
}

// ---------------------------------------------------------------------------
// Sub-component: inline editable min/max label
// ---------------------------------------------------------------------------

interface EditableBoundProps {
  value: number;
  label: string;
  onChange: (next: number) => void;
}

function EditableBound({ value, label, onChange }: EditableBoundProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
  }, [value]);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const next = parseNumber(draft, value);
    onChange(next);
    setEditing(false);
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') setEditing(false);
    },
    [commit],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={label}
        className={[
          'w-14 h-5 px-1 text-[10px] font-mono text-center rounded',
          'bg-muted border border-border text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        ].join(' ')}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      aria-label={`Edit ${label} (currently ${value})`}
      title={`Click to edit ${label}`}
      className={[
        'w-14 h-5 px-1 text-[10px] font-mono text-center rounded cursor-pointer',
        'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        'transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      ].join(' ')}
    >
      {formatValue(value)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single slider row
// ---------------------------------------------------------------------------

interface SliderRowProps {
  name: string;
  config: SliderConfig;
  onValueChange: (name: string, value: number) => void;
  onMinChange: (name: string, min: number) => void;
  onMaxChange: (name: string, max: number) => void;
}

function SliderRow({ name, config, onValueChange, onMinChange, onMaxChange }: SliderRowProps) {
  const { value, min, max } = config;
  const step = niceStep(min, max);

  // Clamp current value to [min, max] when bounds change
  const clampedValue = Math.min(max, Math.max(min, value));

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(name, parseFloat(e.target.value));
    },
    [name, onValueChange],
  );

  const handleMinChange = useCallback(
    (next: number) => {
      // Ensure min < max
      if (next >= max) return;
      onMinChange(name, next);
    },
    [name, max, onMinChange],
  );

  const handleMaxChange = useCallback(
    (next: number) => {
      if (next <= min) return;
      onMaxChange(name, next);
    },
    [name, min, onMaxChange],
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2 min-w-0"
    >
      {/* Parameter name badge */}
      <span
        className={[
          'flex-shrink-0 w-6 h-6 flex items-center justify-center',
          'rounded bg-gradient-to-br from-cyan-500/20 to-blue-500/20',
          'border border-cyan-500/30',
          'text-xs font-bold font-mono text-cyan-300',
        ].join(' ')}
        aria-hidden="true"
      >
        {name}
      </span>

      {/* Min bound (click to edit) */}
      <EditableBound value={min} label={`minimum for ${name}`} onChange={handleMinChange} />

      {/* The range slider */}
      <div className="relative flex-1 min-w-0 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clampedValue}
          onChange={handleChange}
          aria-label={`Parameter ${name}, current value ${formatValue(clampedValue)}, range ${min} to ${max}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={clampedValue}
          aria-valuetext={formatValue(clampedValue)}
          className={[
            'w-full h-1.5 cursor-pointer appearance-none rounded-full',
            // Track styling via CSS custom properties injected below
            'bg-gradient-to-r from-cyan-500/40 to-blue-500/40',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-gradient-to-br',
            '[&::-webkit-slider-thumb]:from-cyan-400 [&::-webkit-slider-thumb]:to-blue-400',
            '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-cyan-300/50',
            '[&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(6,182,212,0.6)]',
            '[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-125',
            '[&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-gradient-to-br',
            '[&::-moz-range-thumb]:from-cyan-400 [&::-moz-range-thumb]:to-blue-400',
            '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-cyan-300/50',
            '[&::-moz-range-thumb]:cursor-grab',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          ].join(' ')}
        />
      </div>

      {/* Max bound (click to edit) */}
      <EditableBound value={max} label={`maximum for ${name}`} onChange={handleMaxChange} />

      {/* Current value readout */}
      <span
        className="flex-shrink-0 w-14 text-right text-xs font-mono font-semibold text-foreground tabular-nums"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`${name} equals ${formatValue(clampedValue)}`}
      >
        {formatValue(clampedValue)}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * VariableSliders renders a compact panel of interactive range sliders for
 * every free parameter detected in the provided math expressions.
 *
 * The panel is hidden when no free parameters are found (e.g. pure x-only
 * expressions), so it is safe to mount unconditionally on the plot page.
 *
 * Usage:
 * ```tsx
 * const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
 *
 * // In evaluate call:
 * evaluate(expression, { variables: { x, ...sliderValues } })
 *
 * <VariableSliders
 *   expressions={[fn.expression]}
 *   onChange={setSliderValues}
 * />
 * ```
 */
export function VariableSliders({ expressions, onChange, className = '' }: VariableSlidersProps) {
  // Detect free parameter names from all expressions
  const paramNames = useMemo(() => detectParameters(expressions), [expressions]);

  // Slider configuration map: paramName -> { value, min, max }
  const [sliders, setSliders] = useState<SliderValues>(() => {
    const init: SliderValues = {};
    for (const name of paramNames) {
      init[name] = { value: DEFAULT_VALUE, min: DEFAULT_MIN, max: DEFAULT_MAX };
    }
    return init;
  });

  // Collapsed state for the panel
  const [collapsed, setCollapsed] = useState(false);

  // When detected parameter list changes:
  //  - Add entries for newly appeared parameters
  //  - Remove entries for parameters that vanished
  useEffect(() => {
    setSliders((prev) => {
      const next: SliderValues = {};
      for (const name of paramNames) {
        next[name] = prev[name] ?? { value: DEFAULT_VALUE, min: DEFAULT_MIN, max: DEFAULT_MAX };
      }
      // Check if anything actually changed to avoid infinite loops
      const prevKeys = Object.keys(prev).sort().join(',');
      const nextKeys = Object.keys(next).sort().join(',');
      if (prevKeys === nextKeys) {
        return prev;
      }
      return next;
    });
  }, [paramNames]);

  // Fire onChange whenever any slider changes
  useEffect(() => {
    const values: Record<string, number> = {};
    for (const [name, cfg] of Object.entries(sliders)) {
      values[name] = cfg.value;
    }
    onChange(values);
  }, [sliders, onChange]);

  const handleValueChange = useCallback((name: string, value: number) => {
    setSliders((prev) => {
      const existing = prev[name];
      if (!existing) return prev;
      return { ...prev, [name]: { ...existing, value } };
    });
  }, []);

  const handleMinChange = useCallback((name: string, min: number) => {
    setSliders((prev) => {
      const existing = prev[name];
      if (!existing) return prev;
      return { ...prev, [name]: { ...existing, min } };
    });
  }, []);

  const handleMaxChange = useCallback((name: string, max: number) => {
    setSliders((prev) => {
      const existing = prev[name];
      if (!existing) return prev;
      return { ...prev, [name]: { ...existing, max } };
    });
  }, []);

  // Don't render anything when there are no free parameters
  if (paramNames.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={[
        'relative rounded-xl overflow-hidden',
        'bg-gradient-to-br from-background/60 via-card/50 to-background/60',
        'backdrop-blur-md border border-border',
        'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
        className,
      ].join(' ')}
      role="region"
      aria-label="Variable parameter sliders"
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative">
        {/* Header row */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={[
            'w-full flex items-center justify-between px-4 py-2.5',
            'text-left hover:bg-white/5 transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          ].join(' ')}
          aria-expanded={!collapsed}
          aria-controls="variable-sliders-body"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-foreground">Parameters</span>
            <span
              className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold"
              aria-label={`${paramNames.length} parameter${paramNames.length === 1 ? '' : 's'} detected`}
            >
              {paramNames.length}
            </span>
          </div>
          <span className="text-muted-foreground" aria-hidden="true">
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {/* Slider body */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              id="variable-sliders-body"
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 space-y-2.5">
                {/* Column header labels */}
                <div className="flex items-center gap-2 pb-1">
                  <span className="flex-shrink-0 w-6" aria-hidden="true" />
                  <span className="w-14 text-[9px] font-semibold text-muted-foreground text-center uppercase tracking-wide">
                    min
                  </span>
                  <span className="flex-1 text-[9px] font-semibold text-muted-foreground text-center uppercase tracking-wide">
                    drag to adjust
                  </span>
                  <span className="w-14 text-[9px] font-semibold text-muted-foreground text-center uppercase tracking-wide">
                    max
                  </span>
                  <span className="w-14 text-[9px] font-semibold text-muted-foreground text-right uppercase tracking-wide">
                    value
                  </span>
                </div>

                <AnimatePresence>
                  {paramNames.map((name) => {
                    const cfg = sliders[name];
                    if (!cfg) return null;
                    return (
                      <SliderRow
                        key={name}
                        name={name}
                        config={cfg}
                        onValueChange={handleValueChange}
                        onMinChange={handleMinChange}
                        onMaxChange={handleMaxChange}
                      />
                    );
                  })}
                </AnimatePresence>

                {/* Hint text */}
                <p className="text-[10px] text-muted-foreground/60 pt-0.5">
                  Click the min/max labels to edit the range.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
