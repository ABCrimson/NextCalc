'use client';

import type { KatexOptions } from 'katex';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * MathRenderer Component
 *
 * Renders mathematical expressions using KaTeX with full accessibility support.
 *
 * @example
 * ```tsx
 * <MathRenderer expression="\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" displayMode />
 * <MathRenderer expression="x^2 + y^2 = r^2" inline />
 * ```
 *
 * Features:
 * - Automatic LaTeX rendering with KaTeX
 * - Display mode (block) and inline mode support
 * - Accessibility: MathML output for screen readers
 * - Error handling with fallback display
 * - Performance: memoized rendering
 * - Proper semantic markup
 *
 * Accessibility:
 * - Generates MathML for screen reader compatibility
 * - Provides text alternative via aria-label
 * - Uses semantic HTML with role="math"
 * - Keyboard accessible (focusable for complex equations)
 */

export interface MathRendererProps {
  /** LaTeX expression to render */
  expression: string;

  /** Display mode (block) vs inline rendering */
  displayMode?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Text alternative for screen readers (auto-generated if not provided) */
  ariaLabel?: string;

  /** Enable error throwing (default: false, shows error message instead) */
  throwOnError?: boolean;

  /** Enable macros for custom LaTeX commands */
  macros?: Record<string, string>;

  /** Trust user input (allows \url, \href, etc.) - USE WITH CAUTION */
  trust?: boolean;
}

export function MathRenderer({
  expression,
  displayMode = false,
  className,
  ariaLabel,
  throwOnError = false,
  macros,
  trust = false,
}: MathRendererProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasRendered = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // Dynamic import to avoid ~280KB in initial bundle
    import('katex').then((katex) => {
      if (cancelled || !containerRef.current) return;

      try {
        const options: KatexOptions = {
          displayMode,
          throwOnError,
          errorColor: 'var(--color-destructive)',
          ...(macros !== undefined && { macros }),
          trust,
          output: 'mathml',
          strict: 'warn',
        };

        katex.default.render(expression, containerRef.current, options);
        hasRendered.current = true;
      } catch (error) {
        if (containerRef.current && !throwOnError) {
          containerRef.current.innerHTML = `
            <span
              class="text-destructive text-sm font-mono"
              role="alert"
              aria-live="polite"
            >
              Math Error: ${error instanceof Error ? error.message : 'Invalid expression'}
            </span>
          `;
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [expression, displayMode, throwOnError, macros, trust]);

  // Generate accessible label from expression if not provided
  const accessibleLabel = ariaLabel || `Mathematical expression: ${expression}`;

  return (
    <span
      ref={containerRef}
      className={cn(
        'math-renderer',
        displayMode && 'block my-4 overflow-x-auto',
        !displayMode && 'inline-block mx-1',
        className,
      )}
      role="math"
      aria-label={accessibleLabel}
      // Make complex equations focusable for keyboard navigation
      tabIndex={displayMode ? 0 : undefined}
    />
  );
}

/**
 * InlineMath Component
 *
 * Convenience wrapper for inline math rendering.
 *
 * @example
 * ```tsx
 * <InlineMath expression="x^2" />
 * ```
 */
export function InlineMath({ expression, ...props }: Omit<MathRendererProps, 'displayMode'>) {
  return <MathRenderer expression={expression} displayMode={false} {...props} />;
}

/**
 * DisplayMath Component
 *
 * Convenience wrapper for display (block) math rendering.
 *
 * @example
 * ```tsx
 * <DisplayMath expression="\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}" />
 * ```
 */
export function DisplayMath({ expression, ...props }: Omit<MathRendererProps, 'displayMode'>) {
  return <MathRenderer expression={expression} displayMode={true} {...props} />;
}

/**
 * Common mathematical expressions and symbols
 */
export const MathSymbols = {
  // Greek letters
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  epsilon: '\\epsilon',
  theta: '\\theta',
  lambda: '\\lambda',
  mu: '\\mu',
  pi: '\\pi',
  sigma: '\\sigma',
  phi: '\\phi',
  omega: '\\omega',

  // Operators
  sum: '\\sum',
  product: '\\prod',
  integral: '\\int',
  limit: '\\lim',
  infinity: '\\infty',

  // Relations
  equals: '=',
  notEquals: '\\neq',
  lessThan: '<',
  greaterThan: '>',
  lessOrEqual: '\\leq',
  greaterOrEqual: '\\geq',
  approximately: '\\approx',

  // Sets
  in: '\\in',
  notIn: '\\notin',
  subset: '\\subset',
  superset: '\\supset',
  union: '\\cup',
  intersection: '\\cap',
  emptySet: '\\emptyset',

  // Logic
  forall: '\\forall',
  exists: '\\exists',
  and: '\\land',
  or: '\\lor',
  not: '\\neg',
  implies: '\\implies',
  iff: '\\iff',
} as const;
