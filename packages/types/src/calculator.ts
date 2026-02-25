/**
 * Calculator state and actions
 */

/** Whether trigonometric functions interpret angles as degrees or radians. */
export type AngleMode = 'deg' | 'rad';

/** Whether the calculator returns exact symbolic results or numeric approximations. */
export type ComputeMode = 'exact' | 'approximate';

// Calculator state
export interface CalculatorState {
  readonly current: string;
  readonly result: number | string | null;
  readonly history: readonly HistoryEntry[];
  readonly mode: 'exact' | 'approximate';
  /** Current angle mode for trig functions. Defaults to 'deg'. */
  readonly angleMode: AngleMode;
  /** Stored memory value. Null means the memory register is empty. */
  readonly memory: number | null;
}

export interface HistoryEntry {
  readonly id: string;
  readonly expression: string;
  readonly result: number | string;
  readonly timestamp: number;
}

// Calculator actions (discriminated union)
export type CalculatorAction =
  | { readonly type: 'KEY_PRESS'; readonly payload: string }
  | { readonly type: 'BUTTON_CLICK'; readonly payload: string }
  | { readonly type: 'CLEAR' }
  | { readonly type: 'EVALUATE' }
  | { readonly type: 'SET_MODE'; readonly payload: 'exact' | 'approximate' }
  | { readonly type: 'SET_ANGLE_MODE'; readonly payload: AngleMode }
  | { readonly type: 'MEMORY_ADD' }
  | { readonly type: 'MEMORY_RECALL' }
  | { readonly type: 'MEMORY_CLEAR' }
  | { readonly type: 'LOAD_HISTORY'; readonly payload: HistoryEntry };
