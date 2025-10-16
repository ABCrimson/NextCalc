/**
 * Calculator state and actions
 */

// Calculator state
export interface CalculatorState {
  readonly current: string;
  readonly result: number | string | null;
  readonly history: readonly HistoryEntry[];
  readonly mode: 'exact' | 'approximate';
}

export interface HistoryEntry {
  readonly id: string;
  readonly expression: string;
  readonly result: number | string;
  readonly timestamp: Date;
}

// Calculator actions (discriminated union)
export type CalculatorAction =
  | { readonly type: 'KEY_PRESS'; readonly payload: string }
  | { readonly type: 'BUTTON_CLICK'; readonly payload: string }
  | { readonly type: 'CLEAR' }
  | { readonly type: 'EVALUATE' }
  | { readonly type: 'SET_MODE'; readonly payload: 'exact' | 'approximate' }
  | { readonly type: 'LOAD_HISTORY'; readonly payload: HistoryEntry };
