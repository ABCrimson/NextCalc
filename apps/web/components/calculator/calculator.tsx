'use client';

import { useTransition, useOptimistic, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useCalculatorState,
  useCalculatorDispatch,
  useCalculatorAngleMode,
  useCalculatorMemory,
} from '@/lib/stores/calculator-store';
import { Display } from './display';
import { Keyboard } from './keyboard';
import { History } from './history';
import { ShortcutsModal } from './shortcuts-modal';
import { Button } from '@/components/ui/button';
import { BarChart3, Sigma } from 'lucide-react';
import type { CalculatorAction } from '@nextcalc/types';
import { parseShareParams } from '@/lib/share';

export function Calculator() {
  // React 19.3.0: useTransition for non-blocking state updates
  const [isPending, startTransition] = useTransition();

  // Performance-optimized selectors (prevents unnecessary re-renders)
  const state = useCalculatorState();
  const dispatch = useCalculatorDispatch();
  const angleMode = useCalculatorAngleMode();
  const memory = useCalculatorMemory();

  // React 19.3.0: useOptimistic for instant feedback before async calculation completes
  const [optimisticResult, setOptimisticResult] = useOptimistic(
    state.result,
    (_currentResult, newResult: string | number | null) => newResult
  );

  // -------------------------------------------------------------------------
  // URL share param restoration
  //
  // On first mount, read `?expr=`, `?result=`, `?mode=`, `?angle=` (or the
  // opaque `?share=` blob) from the URL and pre-populate the calculator store.
  //
  // `useSearchParams` is safe here because this component is always wrapped
  // in <Suspense> by page.tsx — required by Next.js 16+ App Router.
  // -------------------------------------------------------------------------
  const searchParams = useSearchParams();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    // Only restore once per mount (guard against React 19 Strict Mode double-invoke)
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const parsed = parseShareParams(new URLSearchParams(searchParams.toString()));
    if (parsed.format === 'none') return;

    const { data } = parsed;

    // Restore mode before loading the expression so the engine uses it.
    // TypeScript narrows data.mode to ShareMode ('exact' | 'approximate') which
    // is structurally identical to the SET_MODE payload — no cast needed.
    if (data.mode !== undefined) {
      const mode = data.mode; // narrowed to 'exact' | 'approximate'
      startTransition(() => {
        dispatch({ type: 'SET_MODE', payload: mode });
      });
    }

    // Restore angle mode — ShareAngleMode ('deg' | 'rad') === AngleMode.
    if (data.angle !== undefined) {
      const angle = data.angle; // narrowed to 'deg' | 'rad'
      startTransition(() => {
        dispatch({ type: 'SET_ANGLE_MODE', payload: angle });
      });
    }

    // If a pre-computed result was shared, restore it via LOAD_HISTORY so the
    // display shows the expression + result without re-evaluating.
    if (data.result !== undefined) {
      const sharedResult = data.result; // narrowed to string
      startTransition(() => {
        dispatch({
          type: 'LOAD_HISTORY',
          payload: {
            id: 'shared',
            expression: data.expression,
            result: sharedResult,
            timestamp: Date.now(),
          },
        });
      });
      return;
    }

    // Otherwise just restore the expression so the user can interact with it
    if (data.expression) {
      startTransition(() => {
        for (const char of data.expression) {
          dispatch({ type: 'BUTTON_CLICK', payload: char });
        }
      });
    }
  // Run only on mount — searchParams identity is stable in the App Router
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = (action: CalculatorAction) => {
    // Wrap all state updates in startTransition (React 19.3.0 best practice)
    startTransition(() => {
      // Show immediate optimistic feedback for evaluation
      if (action.type === 'EVALUATE' || (action.type === 'KEY_PRESS' && action.payload === 'Enter')) {
        setOptimisticResult('Calculating...');
      }

      dispatch(action);
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <Display
        expression={state.current}
        result={optimisticResult}
        isPending={isPending}
        mode={state.mode}
        angle={state.angleMode}
      />
      <Keyboard
        onInput={handleInput}
        disabled={isPending}
        angleMode={angleMode}
        memory={memory}
      />

      {/* Quick Actions */}
      <div className="flex gap-3 justify-center">
        <Link href="/plot" className="flex-1 max-w-xs">
          <Button
            variant="outline"
            className="w-full bg-gradient-to-r from-blue-600/10 to-indigo-600/10 hover:from-blue-600/20 hover:to-indigo-600/20 border-blue-500/30 hover:border-blue-500/50 transition-all"
            size="lg"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            <span className="font-semibold">Plot Functions</span>
          </Button>
        </Link>

        <Link href="/symbolic" className="flex-1 max-w-xs">
          <Button
            variant="outline"
            className="w-full bg-gradient-to-r from-purple-600/10 to-pink-600/10 hover:from-purple-600/20 hover:to-pink-600/20 border-purple-500/30 hover:border-purple-500/50 transition-all"
            size="lg"
          >
            <Sigma className="h-5 w-5 mr-2" />
            <span className="font-semibold">Symbolic Math</span>
          </Button>
        </Link>
      </div>

      <History
        entries={state.history}
        onSelect={(entry) => {
          startTransition(() => {
            dispatch({ type: 'LOAD_HISTORY', payload: entry });
          });
        }}
      />

      {/* Keyboard shortcuts modal — floating ? button + global hotkey */}
      <ShortcutsModal />
    </div>
  );
}
