/**
 * Calculator Store
 *
 * State management using:
 * - Zustand 5.0.11 for state management
 * - Immer 11.1.4 for immutable state updates
 *
 * @see https://zustand.pmnd.rs/
 * @see https://immerjs.github.io/immer/
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { WritableDraft } from 'immer';
import type { CalculatorState, CalculatorAction, HistoryEntry } from '@nextcalc/types';
import { getComputeManager } from '@/lib/workers/compute-manager';

// ---------------------------------------------------------------------------
// GraphQL mutation (inline to avoid an Apollo hard-dependency in the store)
// ---------------------------------------------------------------------------

const SAVE_CALCULATION_MUTATION = `
  mutation SaveCalculation($input: CalculationInput!) {
    saveCalculation(input: $input) {
      id
      expression
      result
      timestamp
    }
  }
`;

/**
 * Persist a completed calculation to the database via the GraphQL API.
 *
 * Fire-and-forget: failures are silently swallowed so that a network or auth
 * error never disrupts the local calculator UX. The local in-memory history
 * entry is always committed first, before this function is called.
 *
 * Only executed in browser environments. Unauthenticated users receive a
 * GraphQL UNAUTHENTICATED error which is silently ignored — local history
 * continues to work for all users.
 */
async function persistCalculation(
  expression: string,
  mode: CalculatorState['mode'],
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationName: 'SaveCalculation',
        query: SAVE_CALCULATION_MUTATION,
        variables: { input: { expression, mode } },
      }),
    });
  } catch {
    // Network unavailable or server error — silently ignore.
  }
}

interface CalculatorStore {
  state: CalculatorState;
  dispatch: (action: CalculatorAction) => void;
}

const initialState: CalculatorState = {
  current: '',
  result: null,
  history: [],
  mode: 'approximate',
  angleMode: 'deg',
  memory: null,
};

/**
 * Apply all CalculatorState fields onto an Immer WritableDraft.
 * Using explicit property assignment satisfies exactOptionalPropertyTypes
 * because we never pass `undefined` to a required field.
 */
function applyToImmerDraft(
  draft: WritableDraft<CalculatorStore>,
  next: CalculatorState,
): void {
  draft.state.current = next.current;
  draft.state.result = next.result;
  // Spread the readonly tuple into a mutable array for Immer
  draft.state.history = [...next.history];
  draft.state.mode = next.mode;
  draft.state.angleMode = next.angleMode;
  draft.state.memory = next.memory;
}

async function calculateNextState(
  state: CalculatorState,
  action: CalculatorAction,
  updateState: (state: CalculatorState) => void,
): Promise<CalculatorState> {
  switch (action.type) {
    case 'KEY_PRESS':
    case 'BUTTON_CLICK': {
      const key = action.payload;

      if (key === 'Enter' || key === '=') {
        // Show "Calculating..." state immediately
        updateState({ ...state, result: 'Calculating...' });
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
      // Show "Calculating..." state immediately
      updateState({ ...state, result: 'Calculating...' });
      return evaluateExpression(state);

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'SET_ANGLE_MODE':
      return { ...state, angleMode: action.payload };

    case 'MEMORY_ADD': {
      // Parse the current result (or current expression value) and add to memory.
      const currentNumeric =
        state.result !== null && state.result !== 'Error'
          ? Number(state.result)
          : Number(state.current);
      const addend = Number.isFinite(currentNumeric) ? currentNumeric : 0;
      const existing = state.memory ?? 0;
      return { ...state, memory: existing + addend };
    }

    case 'MEMORY_RECALL':
      // Append the memory value to the current expression string.
      if (state.memory === null) return state;
      return { ...state, current: state.current + String(state.memory) };

    case 'MEMORY_CLEAR':
      return { ...state, memory: null };

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

/**
 * Preprocess expression before sending to the evaluator.
 * Converts postfix `!` notation (e.g. `5!`, `(2+3)!`) to `factorial()` calls
 * that the math-engine parser understands.
 */
function preprocessExpression(expr: string): string {
  let result = expr;
  // Convert (expr)! → factorial(expr)
  result = result.replace(/\(([^)]+)\)!/g, 'factorial($1)');
  // Convert number! → factorial(number)
  result = result.replace(/(\d+)!/g, 'factorial($1)');
  return result;
}

async function evaluateExpression(state: CalculatorState): Promise<CalculatorState> {
  try {
    const expression = preprocessExpression(state.current);
    // Use compute worker for evaluation (non-blocking)
    const computeManager = getComputeManager();
    const result = await computeManager.evaluate(expression, {
      mode: state.mode,
    });

    const resultStr = typeof result === 'bigint' ? result.toString() : String(result);

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      expression: state.current,
      result: resultStr,
      timestamp: Date.now(),
    };

    // Persist to the database asynchronously — fire-and-forget.
    // This does not block the local state update and silently swallows any
    // network or auth errors so the calculator always responds immediately.
    void persistCalculation(state.current, state.mode);

    return {
      ...state,
      result: typeof result === 'bigint' ? result.toString() : result,
      history: [entry, ...state.history].slice(0, 100), // Keep last 100
    };
  } catch (_error) {
    return {
      ...state,
      result: 'Error',
    };
  }
}

/**
 * Calculator Store
 *
 * Zustand 5.0.11 with Immer 11.1.4 middleware for cleaner state updates.
 * Immer 11.1 provides improved TypeScript types and auto-enabled features.
 */
export const useCalculatorStore = create<CalculatorStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        state: initialState,
        dispatch: async (action) => {
          // Get current state
          const currentState = get().state;

          // Calculate next state (handles async operations properly)
          const nextState = await calculateNextState(
            currentState,
            action,
            (intermediateState) =>
              set((draft) => {
                // Immer 11 allows direct mutation with improved type inference
                applyToImmerDraft(draft, intermediateState);
              }),
          );

          // Update to final state using Immer
          set((draft) => {
            applyToImmerDraft(draft, nextState);
          });
        },
      })),
      {
        name: 'calculator-storage',
        partialize: (store) => ({
          history: store.state.history,
          angleMode: store.state.angleMode,
          memory: store.state.memory,
        }),
      },
    ),
    {
      name: 'calculator-store',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// Performance-optimized selector hooks (prevents unnecessary re-renders)
export const useCalculatorState = (): CalculatorState =>
  useCalculatorStore((store) => store.state);
export const useCalculatorDispatch = () => useCalculatorStore((store) => store.dispatch);
export const useCalculatorExpression = () => useCalculatorStore((store) => store.state.current);
export const useCalculatorResult = () => useCalculatorStore((store) => store.state.result);
export const useCalculatorHistory = () => useCalculatorStore((store) => store.state.history);
export const useCalculatorMode = () => useCalculatorStore((store) => store.state.mode);
export const useCalculatorAngleMode = () => useCalculatorStore((store) => store.state.angleMode);
export const useCalculatorMemory = () => useCalculatorStore((store) => store.state.memory);

// Reset function for testing - resets store to initial state
export const resetCalculatorStore = () => {
  useCalculatorStore.setState({ state: initialState });
};
