'use client';

import { useCalculatorStore } from '@/lib/stores/calculator-store';
import { Display } from './display';
import { Keyboard } from './keyboard';
import { History } from './history';
import type { CalculatorAction } from '@nextcalc/types';

export function Calculator() {
  const { state, dispatch } = useCalculatorStore();

  const handleInput = (action: CalculatorAction) => {
    dispatch(action);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <Display expression={state.current} result={state.result} />
      <Keyboard onInput={handleInput} />
      <History
        entries={state.history}
        onSelect={(entry) => dispatch({ type: 'LOAD_HISTORY', payload: entry })}
      />
    </div>
  );
}
