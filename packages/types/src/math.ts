/**
 * Core mathematical types for NextCalc Pro
 * Uses TypeScript 5.9.3 features: branded types, discriminated unions
 */

// Branded types for dimensional safety
export type Radians = number & { readonly __brand: 'Radians' };
export type Degrees = number & { readonly __brand: 'Degrees' };
export type Meters = number & { readonly __brand: 'Meters' };
export type Seconds = number & { readonly __brand: 'Seconds' };

// Expression AST
export type ExpressionNode =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'variable'; readonly name: string }
  | { readonly type: 'operator'; readonly op: Operator; readonly args: readonly ExpressionNode[] }
  | { readonly type: 'function'; readonly name: string; readonly args: readonly ExpressionNode[] };

export type Operator = '+' | '-' | '*' | '/' | '^' | '%';

// Math expression
export interface MathExpression {
  readonly type: 'expression';
  readonly ast: ExpressionNode;
  readonly raw: string;
}

// Computation modes
export type ComputeMode = 'exact' | 'approximate';

// Result type (no exceptions)
export type Result<T, E = Error> =
  | { readonly type: 'success'; readonly value: T }
  | { readonly type: 'error'; readonly error: E };

// Unit system
export interface Unit<T extends string = string> {
  readonly symbol: string;
  readonly name: string;
  readonly dimension: T;
  readonly toBase: (value: number) => number;
  readonly fromBase: (value: number) => number;
}

export interface Quantity<T extends string = string> {
  readonly value: number;
  readonly unit: Unit<T>;
  readonly dimension: T;
}

// WASM module interface
export interface MathEngineModule {
  readonly add: (a: string, b: string) => string;
  readonly multiply: (a: string, b: string) => string;
  readonly divide: (a: string, b: string) => string;
  readonly power: (base: string, exp: string) => string;
  readonly sqrt: (value: string) => string;
  readonly sin: (value: string) => string;
  readonly cos: (value: string) => string;
  readonly tan: (value: string) => string;
}

// Web Worker messages
export interface ComputeRequest {
  readonly id: string;
  readonly expression: string;
  readonly mode: ComputeMode;
  readonly precision?: number;
}

export interface ComputeResponse {
  readonly id: string;
  readonly type: 'success' | 'error';
  readonly result?: number | string;
  readonly error?: string;
}
