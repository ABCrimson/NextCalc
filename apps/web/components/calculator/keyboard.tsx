'use client';

import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { CalculatorAction, AngleMode } from '@nextcalc/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyboardProps {
  onInput: (action: CalculatorAction) => void;
  disabled?: boolean;
  /** Current angle mode shown on the DEG/RAD toggle. */
  angleMode?: AngleMode;
  /** Current memory value — used to show M indicator. */
  memory?: number | null;
}

/**
 * Canonical label for every button we render.
 * Discriminated on `kind` so each category gets its own styling and dispatch.
 */
type ButtonKind =
  | 'digit'
  | 'operator'
  | 'equals'
  | 'clear'
  | 'scientific'
  | 'memory'
  | 'angle-toggle';

interface CalcButton {
  /** Visible label on the key face. */
  readonly label: string;
  /** Accessible name override (defaults to label when omitted). */
  readonly ariaLabel?: string;
  readonly kind: ButtonKind;
  /**
   * The string payload sent as BUTTON_CLICK.
   * For special actions (angle toggle, memory ops) this is ignored — the
   * click handler dispatches the right action type instead.
   */
  readonly payload?: string;
}

// ---------------------------------------------------------------------------
// Layout definition
// ---------------------------------------------------------------------------

/**
 * Row 1: angle mode toggle + memory controls.
 * These sit above the scientific functions to make their special nature clear.
 */
const UTILITY_ROW: readonly CalcButton[] = [
  { label: 'DEG',  ariaLabel: 'Toggle angle mode: currently degrees',   kind: 'angle-toggle' },
  { label: 'M+',   ariaLabel: 'Memory add: add result to memory',        kind: 'memory' },
  { label: 'MR',   ariaLabel: 'Memory recall: insert stored value',      kind: 'memory' },
  { label: 'MC',   ariaLabel: 'Memory clear: erase stored value',        kind: 'memory' },
  { label: '(',    kind: 'scientific', payload: '(' },
  { label: ')',    kind: 'scientific', payload: ')' },
] as const;

/**
 * Row 2: scientific functions that produce a function call token such as
 * "sin(" which the math engine can parse.
 */
const SCIENTIFIC_ROW: readonly CalcButton[] = [
  { label: 'sin',  ariaLabel: 'sine',                  kind: 'scientific', payload: 'sin(' },
  { label: 'cos',  ariaLabel: 'cosine',                kind: 'scientific', payload: 'cos(' },
  { label: 'tan',  ariaLabel: 'tangent',               kind: 'scientific', payload: 'tan(' },
  { label: 'log',  ariaLabel: 'base-10 logarithm',     kind: 'scientific', payload: 'log(' },
  { label: 'ln',   ariaLabel: 'natural logarithm',     kind: 'scientific', payload: 'ln(' },
  { label: 'exp',  ariaLabel: 'exponential e to the x', kind: 'scientific', payload: 'exp(' },
  { label: '√',    ariaLabel: 'square root',           kind: 'scientific', payload: 'sqrt(' },
  { label: 'x²',   ariaLabel: 'square',                kind: 'scientific', payload: '^2' },
  { label: '|x|',  ariaLabel: 'absolute value',        kind: 'scientific', payload: 'abs(' },
  { label: 'n!',   ariaLabel: 'factorial',             kind: 'scientific', payload: '!' },
  { label: 'nCr',  ariaLabel: 'combinations n choose r', kind: 'scientific', payload: 'nCr(' },
  { label: 'mod',  ariaLabel: 'modulo',                kind: 'scientific', payload: '%' },
] as const;

/**
 * Rows 3-7: the standard numeric / operator grid (5 columns, same as before).
 */
const NUMERIC_ROWS: readonly (readonly CalcButton[])[] = [
  [
    { label: '7',   kind: 'digit',    payload: '7' },
    { label: '8',   kind: 'digit',    payload: '8' },
    { label: '9',   kind: 'digit',    payload: '9' },
    { label: '/',   ariaLabel: 'divide',   kind: 'operator', payload: '/' },
    { label: '^',   ariaLabel: 'power',    kind: 'operator', payload: '^' },
  ],
  [
    { label: '4',   kind: 'digit',    payload: '4' },
    { label: '5',   kind: 'digit',    payload: '5' },
    { label: '6',   kind: 'digit',    payload: '6' },
    { label: '*',   ariaLabel: 'multiply', kind: 'operator', payload: '*' },
    { label: 'π',   ariaLabel: 'pi',       kind: 'scientific', payload: 'pi' },
  ],
  [
    { label: '1',   kind: 'digit',    payload: '1' },
    { label: '2',   kind: 'digit',    payload: '2' },
    { label: '3',   kind: 'digit',    payload: '3' },
    { label: '-',   ariaLabel: 'minus',    kind: 'operator', payload: '-' },
    { label: 'e',   ariaLabel: 'Euler\'s number', kind: 'scientific', payload: 'e' },
  ],
  [
    { label: '0',   kind: 'digit',    payload: '0' },
    { label: '.',   ariaLabel: 'decimal point',   kind: 'digit',    payload: '.' },
    { label: '=',   ariaLabel: 'equals',           kind: 'equals' },
    { label: '+',   ariaLabel: 'plus',             kind: 'operator', payload: '+' },
    { label: 'C',   ariaLabel: 'clear all',        kind: 'clear' },
  ],
] as const;

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const BASE =
  'relative overflow-hidden font-semibold transition-all duration-200 active:scale-95 hover:-translate-y-0.5 rounded-2xl backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function getButtonStyle(kind: ButtonKind, isActiveToggle = false): string {
  switch (kind) {
    case 'equals':
      return `${BASE} bg-gradient-to-br from-calculator-equals to-calculator-equals/80 hover:from-calculator-equals-hover hover:to-calculator-equals-hover/80 text-white shadow-lg shadow-calculator-equals/30 hover:shadow-xl hover:shadow-calculator-equals/50 ring-1 ring-white/10`;

    case 'operator':
      return `${BASE} bg-gradient-to-br from-calculator-operator to-calculator-operator/80 hover:from-calculator-operator-hover hover:to-calculator-operator-hover/80 text-white shadow-lg shadow-calculator-operator/30 hover:shadow-xl hover:shadow-calculator-operator/50 ring-1 ring-white/10`;

    case 'clear':
      return `${BASE} bg-gradient-to-br from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 text-white shadow-lg shadow-destructive/30 hover:shadow-xl hover:shadow-destructive/50 ring-1 ring-white/10`;

    case 'scientific':
      return `${BASE} bg-gradient-to-br from-calculator-special to-calculator-special/80 hover:from-calculator-special-hover hover:to-calculator-special-hover/80 text-white shadow-md shadow-calculator-special/20 hover:shadow-lg hover:shadow-calculator-special/40 ring-1 ring-white/10`;

    case 'memory':
      return `${BASE} bg-gradient-to-br from-violet-600 to-violet-600/80 hover:from-violet-500 hover:to-violet-500/80 text-white shadow-md shadow-violet-600/20 hover:shadow-lg hover:shadow-violet-600/40 ring-1 ring-white/10`;

    case 'angle-toggle':
      return isActiveToggle
        ? `${BASE} bg-gradient-to-br from-amber-500 to-amber-500/80 hover:from-amber-400 hover:to-amber-400/80 text-white shadow-md shadow-amber-500/30 hover:shadow-lg hover:shadow-amber-500/50 ring-1 ring-white/10`
        : `${BASE} bg-gradient-to-br from-amber-700/60 to-amber-700/40 hover:from-amber-600/70 hover:to-amber-600/50 text-white shadow-md ring-1 ring-white/10`;

    default:
      return `${BASE} bg-gradient-to-br from-calculator-button to-calculator-button/90 hover:from-calculator-button-hover hover:to-calculator-button-hover/90 text-foreground shadow-md hover:shadow-lg border border-border/50 hover:border-border/70`;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Keyboard({
  onInput,
  disabled = false,
  angleMode = 'deg',
  memory = null,
}: KeyboardProps) {
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Memoize keyboard event handler to prevent recreation
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      // Don't interfere with normal typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) return;

      const key = event.key;

      if (
        /^[0-9+\-*/().^%]$/.test(key) ||
        key === 'Enter' ||
        key === 'Escape' ||
        key === 'Backspace'
      ) {
        event.preventDefault();
        onInput({ type: 'KEY_PRESS', payload: key });
      }
    },
    [onInput, disabled],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // -------------------------------------------------------------------------
  // Click dispatch logic
  // -------------------------------------------------------------------------

  const handleButtonClick = useCallback(
    (btn: CalcButton) => {
      if (disabled) return;

      switch (btn.kind) {
        case 'equals':
          onInput({ type: 'EVALUATE' });
          return;

        case 'clear':
          onInput({ type: 'CLEAR' });
          return;

        case 'angle-toggle':
          onInput({ type: 'SET_ANGLE_MODE', payload: angleMode === 'deg' ? 'rad' : 'deg' });
          return;

        case 'memory':
          if (btn.label === 'M+') { onInput({ type: 'MEMORY_ADD' });    return; }
          if (btn.label === 'MR') { onInput({ type: 'MEMORY_RECALL' }); return; }
          if (btn.label === 'MC') { onInput({ type: 'MEMORY_CLEAR' });  return; }
          return;

        default:
          onInput({ type: 'BUTTON_CLICK', payload: btn.payload ?? btn.label });
      }
    },
    [disabled, angleMode, onInput],
  );

  // -------------------------------------------------------------------------
  // Shared motion config
  // -------------------------------------------------------------------------

  const sharedTap = disabled ? {} : { scale: 0.95 };
  const sharedHover = disabled ? {} : { scale: 1.05, y: -2 };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderButton = (btn: CalcButton, rowIdx: number, colIdx: number) => {
    const isAngleToggle = btn.kind === 'angle-toggle';
    // For the angle toggle, show the CURRENT mode so users know what is active
    const faceLabel = isAngleToggle ? angleMode.toUpperCase() : btn.label;
    const ariaLabel = isAngleToggle
      ? `Angle mode: ${angleMode === 'deg' ? 'degrees' : 'radians'}. Click to switch.`
      : (btn.ariaLabel ?? btn.label);

    // Memory recall is disabled when nothing is stored
    const isMrDisabled = btn.label === 'MR' && memory === null;
    const isMcDisabled = btn.label === 'MC' && memory === null;
    const isEffectivelyDisabled = disabled || isMrDisabled || isMcDisabled;

    return (
      <motion.button
        key={`${rowIdx}-${colIdx}-${btn.label}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: isEffectivelyDisabled ? 0.4 : 1, scale: 1 }}
        transition={{
          duration: 0.3,
          delay: 0.3 + rowIdx * 0.04 + colIdx * 0.015,
          ease: [0.4, 0, 0.2, 1],
        }}
        whileHover={isEffectivelyDisabled ? {} : sharedHover}
        whileTap={isEffectivelyDisabled ? {} : sharedTap}
        onClick={() => handleButtonClick(btn)}
        disabled={isEffectivelyDisabled}
        tabIndex={isEffectivelyDisabled ? -1 : 0}
        className={`${getButtonStyle(btn.kind, isAngleToggle && angleMode === 'deg')} w-full text-sm ${isEffectivelyDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        aria-label={ariaLabel}
        aria-disabled={isEffectivelyDisabled}
        aria-pressed={isAngleToggle ? true : undefined}
        role="gridcell"
      >
        <span className="relative z-10 leading-none py-2.5 px-1 flex items-center justify-center min-h-[2.25rem]">
          {faceLabel}
        </span>
        {/* Shine sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6 }}
        />
      </motion.button>
    );
  };

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite">
        Scientific calculator keyboard active. Use number keys, operators, and Enter to calculate.
        Press Escape to clear. Memory functions: M plus, M R, M C. Toggle angle mode with the DEG
        or RAD button.
      </div>

      {/* Memory indicator — shows stored value when memory is non-null */}
      {memory !== null && (
        <div
          className="flex items-center gap-1.5 text-xs text-violet-400 font-mono mb-1"
          aria-live="polite"
          aria-label={`Memory contains ${memory}`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-violet-400" aria-hidden="true" />
          M = {memory}
        </div>
      )}

      <motion.div
        ref={keyboardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-2"
        role="grid"
        aria-label="Calculator keyboard"
      >
        {/* ---------------------------------------------------------------- */}
        {/* Row 1: Utility — angle toggle + memory + parentheses              */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${UTILITY_ROW.length}, minmax(0, 1fr))` }}
          role="row"
          aria-label="Utility controls"
        >
          {UTILITY_ROW.map((btn, colIdx) => renderButton(btn, 0, colIdx))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Row 2: Scientific functions (12 buttons, 6 per sub-row)           */}
        {/* ---------------------------------------------------------------- */}
        <div role="row" aria-label="Scientific functions" className="space-y-2">
          <div className="grid grid-cols-6 gap-2">
            {SCIENTIFIC_ROW.slice(0, 6).map((btn, colIdx) =>
              renderButton(btn, 1, colIdx),
            )}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {SCIENTIFIC_ROW.slice(6).map((btn, colIdx) =>
              renderButton(btn, 2, colIdx),
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Divider                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="border-t border-border/30 my-1"
          role="separator"
          aria-hidden="true"
        />

        {/* ---------------------------------------------------------------- */}
        {/* Rows 3–6: Numeric + operator grid (5 columns)                    */}
        {/* ---------------------------------------------------------------- */}
        {NUMERIC_ROWS.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="grid grid-cols-5 gap-2"
            role="row"
          >
            {row.map((btn, colIdx) =>
              renderButton(btn, rowIdx + 3, colIdx),
            )}
          </div>
        ))}
      </motion.div>
    </>
  );
}
