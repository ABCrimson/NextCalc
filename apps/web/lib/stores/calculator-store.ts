import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CalculatorState, CalculatorAction, HistoryEntry } from '@nextcalc/types';
import { evaluate } from 'mathjs';

interface CalculatorStore {
  state: CalculatorState;
  dispatch: (action: CalculatorAction) => void;
}

const initialState: CalculatorState = {
  current: '',
  result: null,
  history: [],
  mode: 'approximate',
};

function calculateNextState(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case 'KEY_PRESS':
    case 'BUTTON_CLICK': {
      const key = action.payload;

      if (key === 'Enter' || key === '=') {
        return evaluateExpression(state);
      }

      if (key === 'Backspace') {
        return { ...state, current: state.current.slice(0, -1) };
      }

      if (key === 'Escape') {
        return { ...state, current: '', result: null };
      }

      return { ...state, current: state.current + key };
    }

    case 'CLEAR':
      return { ...state, current: '', result: null };

    case 'EVALUATE':
      return evaluateExpression(state);

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'LOAD_HISTORY':
      return {
        ...state,
        current: action.payload.expression,
        result: action.payload.result,
      };

    default:
      return state;
  }
}

function evaluateExpression(state: CalculatorState): CalculatorState {
  try {
    const result = evaluate(state.current);
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      expression: state.current,
      result: String(result),
      timestamp: new Date(),
    };

    return {
      ...state,
      result,
      history: [entry, ...state.history].slice(0, 100), // Keep last 100
    };
  } catch (error) {
    return {
      ...state,
      result: 'Error',
    };
  }
}

export const useCalculatorStore = create<CalculatorStore>()(
  devtools(
    persist(
      (set) => ({
        state: initialState,
        dispatch: (action) => {
          set((store) => ({
            state: calculateNextState(store.state, action),
          }));
        },
      }),
      {
        name: 'calculator-storage',
        partialize: (state) => ({ history: state.state.history }),
      },
    ),
  ),
);
