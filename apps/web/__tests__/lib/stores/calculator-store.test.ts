import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the store module
// ---------------------------------------------------------------------------

const mockEvaluate = vi.fn();

vi.mock('@/lib/workers/compute-manager', () => ({
  getComputeManager: () => ({ evaluate: mockEvaluate }),
}));

// Stub global fetch so persistCalculation (fire-and-forget) never hits the network
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({ ok: true }),
);

// ---------------------------------------------------------------------------
// Import the store and selectors AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  resetCalculatorStore,
  useCalculatorAngleMode,
  useCalculatorDispatch,
  useCalculatorExpression,
  useCalculatorHistory,
  useCalculatorMemory,
  useCalculatorMode,
  useCalculatorResult,
  useCalculatorState,
  useCalculatorStore,
} from '@/lib/stores/calculator-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shortcut – get current calculator state slice */
const getState = () => useCalculatorStore.getState().state;

/** Shortcut – dispatch an action (may be async for EVALUATE / Enter) */
const dispatch = (action: Parameters<ReturnType<typeof useCalculatorStore.getState>['dispatch']>[0]) =>
  useCalculatorStore.getState().dispatch(action);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculator-store', () => {
  beforeEach(() => {
    resetCalculatorStore();
    mockEvaluate.mockReset();
    mockEvaluate.mockResolvedValue(42);
    vi.mocked(fetch).mockClear();
  });

  afterEach(() => {
    resetCalculatorStore();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('has empty current expression', () => {
      expect(getState().current).toBe('');
    });

    it('has null result', () => {
      expect(getState().result).toBeNull();
    });

    it('has empty history', () => {
      expect(getState().history).toEqual([]);
    });

    it('defaults to approximate mode', () => {
      expect(getState().mode).toBe('approximate');
    });

    it('defaults to deg angle mode', () => {
      expect(getState().angleMode).toBe('deg');
    });

    it('has null memory', () => {
      expect(getState().memory).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // KEY_PRESS / BUTTON_CLICK — character input
  // -----------------------------------------------------------------------
  describe('KEY_PRESS / BUTTON_CLICK', () => {
    it('appends a normal character via KEY_PRESS', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '5' });
      expect(getState().current).toBe('5');
    });

    it('appends a normal character via BUTTON_CLICK', async () => {
      await dispatch({ type: 'BUTTON_CLICK', payload: '7' });
      expect(getState().current).toBe('7');
    });

    it('builds up a multi-character expression', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '3' });
      await dispatch({ type: 'KEY_PRESS', payload: '+' });
      await dispatch({ type: 'KEY_PRESS', payload: '4' });
      expect(getState().current).toBe('3+4');
    });

    it('Backspace removes the last character', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '1' });
      await dispatch({ type: 'KEY_PRESS', payload: '2' });
      await dispatch({ type: 'KEY_PRESS', payload: '3' });
      await dispatch({ type: 'BUTTON_CLICK', payload: 'Backspace' });
      expect(getState().current).toBe('12');
    });

    it('Backspace on empty string stays empty', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: 'Backspace' });
      expect(getState().current).toBe('');
    });

    it('Escape clears current and result', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '9' });
      // manually set a result so we can verify it clears
      useCalculatorStore.setState({
        state: { ...getState(), current: '9', result: 99 },
      });
      await dispatch({ type: 'KEY_PRESS', payload: 'Escape' });
      expect(getState().current).toBe('');
      expect(getState().result).toBeNull();
    });

    it('Enter triggers evaluation via KEY_PRESS', async () => {
      mockEvaluate.mockResolvedValue(10);
      await dispatch({ type: 'KEY_PRESS', payload: '5' });
      await dispatch({ type: 'KEY_PRESS', payload: '+' });
      await dispatch({ type: 'KEY_PRESS', payload: '5' });
      await dispatch({ type: 'KEY_PRESS', payload: 'Enter' });

      expect(mockEvaluate).toHaveBeenCalledWith('5+5', { mode: 'approximate' });
      expect(getState().result).toBe(10);
      expect(getState().history).toHaveLength(1);
      expect(getState().history[0].expression).toBe('5+5');
      expect(getState().history[0].result).toBe('10');
    });

    it('= triggers evaluation via BUTTON_CLICK', async () => {
      mockEvaluate.mockResolvedValue(7);
      await dispatch({ type: 'BUTTON_CLICK', payload: '3' });
      await dispatch({ type: 'BUTTON_CLICK', payload: '+' });
      await dispatch({ type: 'BUTTON_CLICK', payload: '4' });
      await dispatch({ type: 'BUTTON_CLICK', payload: '=' });

      expect(mockEvaluate).toHaveBeenCalledWith('3+4', { mode: 'approximate' });
      expect(getState().result).toBe(7);
    });
  });

  // -----------------------------------------------------------------------
  // CLEAR
  // -----------------------------------------------------------------------
  describe('CLEAR', () => {
    it('resets current and result', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '9' });
      useCalculatorStore.setState({
        state: { ...getState(), result: 42 },
      });
      await dispatch({ type: 'CLEAR' });

      expect(getState().current).toBe('');
      expect(getState().result).toBeNull();
    });

    it('preserves history, mode, angleMode, and memory after clear', async () => {
      // Set up some state
      useCalculatorStore.setState({
        state: {
          ...getState(),
          current: 'anything',
          result: 99,
          mode: 'exact',
          angleMode: 'rad',
          memory: 7,
          history: [
            { id: 'test-1', expression: '1+1', result: '2', timestamp: 1000 },
          ],
        },
      });

      await dispatch({ type: 'CLEAR' });

      expect(getState().current).toBe('');
      expect(getState().result).toBeNull();
      expect(getState().mode).toBe('exact');
      expect(getState().angleMode).toBe('rad');
      expect(getState().memory).toBe(7);
      expect(getState().history).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // SET_MODE
  // -----------------------------------------------------------------------
  describe('SET_MODE', () => {
    it('sets mode to exact', async () => {
      await dispatch({ type: 'SET_MODE', payload: 'exact' });
      expect(getState().mode).toBe('exact');
    });

    it('sets mode to approximate', async () => {
      await dispatch({ type: 'SET_MODE', payload: 'exact' });
      await dispatch({ type: 'SET_MODE', payload: 'approximate' });
      expect(getState().mode).toBe('approximate');
    });

    it('does not affect other state fields', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '5' });
      await dispatch({ type: 'SET_MODE', payload: 'exact' });
      expect(getState().current).toBe('5');
      expect(getState().result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // SET_ANGLE_MODE
  // -----------------------------------------------------------------------
  describe('SET_ANGLE_MODE', () => {
    it('sets angleMode to rad', async () => {
      await dispatch({ type: 'SET_ANGLE_MODE', payload: 'rad' });
      expect(getState().angleMode).toBe('rad');
    });

    it('sets angleMode back to deg', async () => {
      await dispatch({ type: 'SET_ANGLE_MODE', payload: 'rad' });
      await dispatch({ type: 'SET_ANGLE_MODE', payload: 'deg' });
      expect(getState().angleMode).toBe('deg');
    });

    it('does not affect other state fields', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '3' });
      await dispatch({ type: 'SET_ANGLE_MODE', payload: 'rad' });
      expect(getState().current).toBe('3');
    });
  });

  // -----------------------------------------------------------------------
  // MEMORY_ADD / MEMORY_RECALL / MEMORY_CLEAR
  // -----------------------------------------------------------------------
  describe('MEMORY_ADD / MEMORY_RECALL / MEMORY_CLEAR', () => {
    it('MEMORY_ADD stores the current result in memory', async () => {
      useCalculatorStore.setState({
        state: { ...getState(), result: 42 },
      });
      await dispatch({ type: 'MEMORY_ADD' });
      expect(getState().memory).toBe(42);
    });

    it('MEMORY_ADD adds to existing memory', async () => {
      useCalculatorStore.setState({
        state: { ...getState(), memory: 10, result: 5 },
      });
      await dispatch({ type: 'MEMORY_ADD' });
      expect(getState().memory).toBe(15);
    });

    it('MEMORY_ADD uses current expression when result is null', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '8' });
      await dispatch({ type: 'MEMORY_ADD' });
      expect(getState().memory).toBe(8);
    });

    it('MEMORY_ADD treats non-numeric current as 0', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: 'a' });
      await dispatch({ type: 'MEMORY_ADD' });
      expect(getState().memory).toBe(0);
    });

    it('MEMORY_ADD treats "Error" result as non-numeric and falls back to current', async () => {
      useCalculatorStore.setState({
        state: { ...getState(), current: '7', result: 'Error' },
      });
      await dispatch({ type: 'MEMORY_ADD' });
      expect(getState().memory).toBe(7);
    });

    it('MEMORY_RECALL appends memory value to current expression', async () => {
      useCalculatorStore.setState({
        state: { ...getState(), memory: 25, current: '3+' },
      });
      await dispatch({ type: 'MEMORY_RECALL' });
      expect(getState().current).toBe('3+25');
    });

    it('MEMORY_RECALL does nothing when memory is null', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '5' });
      await dispatch({ type: 'MEMORY_RECALL' });
      expect(getState().current).toBe('5');
    });

    it('MEMORY_CLEAR resets memory to null', async () => {
      useCalculatorStore.setState({
        state: { ...getState(), memory: 100 },
      });
      await dispatch({ type: 'MEMORY_CLEAR' });
      expect(getState().memory).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // LOAD_HISTORY
  // -----------------------------------------------------------------------
  describe('LOAD_HISTORY', () => {
    it('loads a history entry into current and result', async () => {
      const entry = {
        id: 'hist-1',
        expression: '2*3',
        result: '6' as const,
        timestamp: Date.now(),
      };
      await dispatch({ type: 'LOAD_HISTORY', payload: entry });

      expect(getState().current).toBe('2*3');
      expect(getState().result).toBe('6');
    });

    it('loads a numeric result from history', async () => {
      const entry = {
        id: 'hist-2',
        expression: 'sqrt(16)',
        result: '4' as const,
        timestamp: Date.now(),
      };
      await dispatch({ type: 'LOAD_HISTORY', payload: entry });

      expect(getState().current).toBe('sqrt(16)');
      expect(getState().result).toBe('4');
    });
  });

  // -----------------------------------------------------------------------
  // EVALUATE
  // -----------------------------------------------------------------------
  describe('EVALUATE', () => {
    it('evaluates the current expression via the compute manager', async () => {
      mockEvaluate.mockResolvedValue(42);
      useCalculatorStore.setState({
        state: { ...getState(), current: '6*7' },
      });

      await dispatch({ type: 'EVALUATE' });

      expect(mockEvaluate).toHaveBeenCalledWith('6*7', { mode: 'approximate' });
      expect(getState().result).toBe(42);
    });

    it('passes the current mode to the compute manager', async () => {
      mockEvaluate.mockResolvedValue('x^2');
      useCalculatorStore.setState({
        state: { ...getState(), current: 'x*x', mode: 'exact' },
      });

      await dispatch({ type: 'EVALUATE' });

      expect(mockEvaluate).toHaveBeenCalledWith('x*x', { mode: 'exact' });
      expect(getState().result).toBe('x^2');
    });

    it('adds the result to history', async () => {
      mockEvaluate.mockResolvedValue(100);
      useCalculatorStore.setState({
        state: { ...getState(), current: '10^2' },
      });

      await dispatch({ type: 'EVALUATE' });

      const { history } = getState();
      expect(history).toHaveLength(1);
      expect(history[0].expression).toBe('10^2');
      expect(history[0].result).toBe('100');
      expect(history[0].id).toBeTypeOf('string');
      expect(history[0].timestamp).toBeTypeOf('number');
    });

    it('sets result to "Error" when evaluation throws', async () => {
      mockEvaluate.mockRejectedValue(new Error('parse failure'));
      useCalculatorStore.setState({
        state: { ...getState(), current: 'invalid$$' },
      });

      await dispatch({ type: 'EVALUATE' });

      expect(getState().result).toBe('Error');
    });

    it('handles bigint results by converting to string', async () => {
      mockEvaluate.mockResolvedValue(BigInt('9007199254740993'));
      useCalculatorStore.setState({
        state: { ...getState(), current: 'bignum' },
      });

      await dispatch({ type: 'EVALUATE' });

      expect(getState().result).toBe('9007199254740993');
    });

    it('keeps only the last 100 history entries', async () => {
      // Pre-fill history with 100 entries
      const existingHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `old-${i}`,
        expression: `${i}`,
        result: `${i}`,
        timestamp: i,
      }));
      useCalculatorStore.setState({
        state: { ...getState(), current: '101', history: existingHistory },
      });

      mockEvaluate.mockResolvedValue(101);
      await dispatch({ type: 'EVALUATE' });

      const { history } = getState();
      expect(history).toHaveLength(100);
      // The newest entry should be first
      expect(history[0].expression).toBe('101');
      expect(history[0].result).toBe('101');
      // The last entry in the original array (old-99) should have been dropped
      // because slice(0, 100) keeps [new, old-0, ..., old-98]
      expect(history.find((e) => e.id === 'old-99')).toBeUndefined();
      // The first original entry should still be present
      expect(history.find((e) => e.id === 'old-0')).toBeDefined();
    });

    it('calls persistCalculation (fetch) after successful evaluation', async () => {
      mockEvaluate.mockResolvedValue(99);
      useCalculatorStore.setState({
        state: { ...getState(), current: '99' },
      });

      await dispatch({ type: 'EVALUATE' });

      expect(fetch).toHaveBeenCalledWith('/api/graphql', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('preprocesses factorial notation before evaluation', async () => {
      mockEvaluate.mockResolvedValue(120);
      useCalculatorStore.setState({
        state: { ...getState(), current: '5!' },
      });

      await dispatch({ type: 'EVALUATE' });

      expect(mockEvaluate).toHaveBeenCalledWith('factorial(5)', { mode: 'approximate' });
    });
  });

  // -----------------------------------------------------------------------
  // preprocessExpression (tested indirectly through EVALUATE)
  // -----------------------------------------------------------------------
  describe('preprocessExpression', () => {
    it('converts 5! to factorial(5)', async () => {
      mockEvaluate.mockResolvedValue(120);
      useCalculatorStore.setState({
        state: { ...getState(), current: '5!' },
      });
      await dispatch({ type: 'EVALUATE' });
      expect(mockEvaluate).toHaveBeenCalledWith('factorial(5)', { mode: 'approximate' });
    });

    it('converts (2+3)! to factorial(2+3)', async () => {
      mockEvaluate.mockResolvedValue(120);
      useCalculatorStore.setState({
        state: { ...getState(), current: '(2+3)!' },
      });
      await dispatch({ type: 'EVALUATE' });
      expect(mockEvaluate).toHaveBeenCalledWith('factorial(2+3)', { mode: 'approximate' });
    });

    it('converts 10! to factorial(10)', async () => {
      mockEvaluate.mockResolvedValue(3628800);
      useCalculatorStore.setState({
        state: { ...getState(), current: '10!' },
      });
      await dispatch({ type: 'EVALUATE' });
      expect(mockEvaluate).toHaveBeenCalledWith('factorial(10)', { mode: 'approximate' });
    });

    it('leaves expressions without ! unchanged', async () => {
      mockEvaluate.mockResolvedValue(7);
      useCalculatorStore.setState({
        state: { ...getState(), current: '3+4' },
      });
      await dispatch({ type: 'EVALUATE' });
      expect(mockEvaluate).toHaveBeenCalledWith('3+4', { mode: 'approximate' });
    });

    it('handles combined factorial and arithmetic', async () => {
      mockEvaluate.mockResolvedValue(126);
      useCalculatorStore.setState({
        state: { ...getState(), current: '5!+6' },
      });
      await dispatch({ type: 'EVALUATE' });
      expect(mockEvaluate).toHaveBeenCalledWith('factorial(5)+6', { mode: 'approximate' });
    });
  });

  // -----------------------------------------------------------------------
  // resetCalculatorStore
  // -----------------------------------------------------------------------
  describe('resetCalculatorStore', () => {
    it('resets all fields to initial values', async () => {
      // Mutate every field first
      useCalculatorStore.setState({
        state: {
          current: 'dirty',
          result: 999,
          history: [{ id: 'h', expression: 'x', result: '1', timestamp: 0 }],
          mode: 'exact',
          angleMode: 'rad',
          memory: 55,
        },
      });

      resetCalculatorStore();

      const s = getState();
      expect(s.current).toBe('');
      expect(s.result).toBeNull();
      expect(s.history).toEqual([]);
      expect(s.mode).toBe('approximate');
      expect(s.angleMode).toBe('deg');
      expect(s.memory).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Selector hooks — verify they are exported as functions
  // -----------------------------------------------------------------------
  describe('selector hooks', () => {
    it('useCalculatorState is a function', () => {
      expect(useCalculatorState).toBeTypeOf('function');
    });

    it('useCalculatorDispatch is a function', () => {
      expect(useCalculatorDispatch).toBeTypeOf('function');
    });

    it('useCalculatorExpression is a function', () => {
      expect(useCalculatorExpression).toBeTypeOf('function');
    });

    it('useCalculatorResult is a function', () => {
      expect(useCalculatorResult).toBeTypeOf('function');
    });

    it('useCalculatorHistory is a function', () => {
      expect(useCalculatorHistory).toBeTypeOf('function');
    });

    it('useCalculatorMode is a function', () => {
      expect(useCalculatorMode).toBeTypeOf('function');
    });

    it('useCalculatorAngleMode is a function', () => {
      expect(useCalculatorAngleMode).toBeTypeOf('function');
    });

    it('useCalculatorMemory is a function', () => {
      expect(useCalculatorMemory).toBeTypeOf('function');
    });
  });

  // -----------------------------------------------------------------------
  // Unknown action type — should return state unchanged
  // -----------------------------------------------------------------------
  describe('unknown action', () => {
    it('does not modify state for an unknown action type', async () => {
      await dispatch({ type: 'KEY_PRESS', payload: '5' });
      const before = getState();

      // Force an unknown action through the type system
      await dispatch({ type: 'NONEXISTENT' } as never);

      const after = getState();
      expect(after.current).toBe(before.current);
      expect(after.result).toBe(before.result);
    });
  });
});
