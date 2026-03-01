/**
 * Mock WASM Module for Development and Testing
 *
 * Provides a JavaScript-based fallback implementation using BigInt
 * when the actual WASM module is unavailable. Useful for:
 * - Development without WASM compilation
 * - Testing environments
 * - Graceful degradation
 *
 * @module @nextcalc/math-engine/wasm/mock
 */

/**
 * Mock precision using fixed-point arithmetic with BigInt
 * Stores numbers as: value * 10^DECIMAL_PLACES
 */
const DECIMAL_PLACES = 50; // Simulated precision
const SCALE = BigInt(10) ** BigInt(DECIMAL_PLACES);

/**
 * Helper: Convert number/string to scaled BigInt
 */
function toScaledBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value * SCALE;
  }

  const str = String(value);

  // Handle scientific notation
  if (str.includes('e') || str.includes('E')) {
    const num = Number(str);
    return toScaledBigInt(num.toFixed(DECIMAL_PLACES));
  }

  // Split into integer and decimal parts
  const [intPart, decPart = ''] = str.split('.');
  const paddedDec = decPart.padEnd(DECIMAL_PLACES, '0').slice(0, DECIMAL_PLACES);

  const intValue = BigInt(intPart || '0');
  const decValue = BigInt(paddedDec);

  return intValue * SCALE + decValue;
}

/**
 * Helper: Convert scaled BigInt to string
 */
function fromScaledBigInt(value: bigint, digits = 0): string {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;

  const intPart = absValue / SCALE;
  const decPart = absValue % SCALE;

  let result = intPart.toString();

  if (decPart > 0n || digits > 0) {
    const decStr = decPart.toString().padStart(DECIMAL_PLACES, '0');
    const trimmed = digits > 0 ? decStr.slice(0, digits) : decStr.replace(/0+$/, '');

    if (trimmed.length > 0) {
      result += '.' + trimmed;
    }
  }

  return isNegative ? '-' + result : result;
}

/**
 * Mock high-precision number using BigInt
 */
export class MockHighPrecisionNumber {
  private value: bigint;

  constructor(value?: string | number | bigint) {
    this.value = value !== undefined ? toScaledBigInt(value) : 0n;
  }

  /**
   * Convert to string
   */
  toString(base = 10, digits = 0): string {
    if (base !== 10) {
      console.warn('[Mock WASM] Non-decimal bases not fully supported, using decimal');
    }
    return fromScaledBigInt(this.value, digits);
  }

  /**
   * Convert to JavaScript number (may lose precision)
   */
  toNumber(): number {
    return parseFloat(this.toString(10, 17));
  }

  /**
   * Convert to BigInt (truncates decimal)
   */
  toBigInt(): bigint {
    return this.value / SCALE;
  }

  /**
   * Check if integer
   */
  isInteger(): boolean {
    return this.value % SCALE === 0n;
  }

  /**
   * Check if zero
   */
  isZero(): boolean {
    return this.value === 0n;
  }

  /**
   * Get sign
   */
  sign(): number {
    if (this.value === 0n) return 0;
    return this.value > 0n ? 1 : -1;
  }

  // ============ Arithmetic Operations ============

  /**
   * Addition
   */
  add(other: MockHighPrecisionNumber): MockHighPrecisionNumber {
    const result = new MockHighPrecisionNumber();
    result.value = this.value + other.value;
    return result;
  }

  /**
   * Subtraction
   */
  subtract(other: MockHighPrecisionNumber): MockHighPrecisionNumber {
    const result = new MockHighPrecisionNumber();
    result.value = this.value - other.value;
    return result;
  }

  /**
   * Multiplication
   */
  multiply(other: MockHighPrecisionNumber): MockHighPrecisionNumber {
    const result = new MockHighPrecisionNumber();
    // Scale down to prevent overflow: (a * b) / SCALE
    result.value = (this.value * other.value) / SCALE;
    return result;
  }

  /**
   * Division
   */
  divide(other: MockHighPrecisionNumber): MockHighPrecisionNumber {
    if (other.value === 0n) {
      throw new Error('Division by zero');
    }

    const result = new MockHighPrecisionNumber();
    // Scale up before division: (a * SCALE) / b
    result.value = (this.value * SCALE) / other.value;
    return result;
  }

  /**
   * Exponentiation (limited to integer exponents)
   */
  pow(exponent: MockHighPrecisionNumber): MockHighPrecisionNumber {
    const exp = Number(exponent.toBigInt());

    if (!Number.isInteger(exp)) {
      console.warn('[Mock WASM] Non-integer exponents use approximate calculation');
      return this._powApprox(exponent.toNumber());
    }

    if (exp === 0) {
      return new MockHighPrecisionNumber(1);
    }

    if (exp < 0) {
      const one = new MockHighPrecisionNumber(1);
      const positive = this.pow(new MockHighPrecisionNumber(-exp));
      return one.divide(positive);
    }

    const result = new MockHighPrecisionNumber();
    result.value = SCALE; // Start with 1

    for (let i = 0; i < exp; i++) {
      result.value = (result.value * this.value) / SCALE;
    }

    return result;
  }

  /**
   * Approximate power for non-integer exponents
   */
  private _powApprox(exp: number): MockHighPrecisionNumber {
    const num = this.toNumber();
    const result = num ** exp;
    return new MockHighPrecisionNumber(result);
  }

  /**
   * Negation
   */
  negate(): MockHighPrecisionNumber {
    const result = new MockHighPrecisionNumber();
    result.value = -this.value;
    return result;
  }

  /**
   * Absolute value
   */
  abs(): MockHighPrecisionNumber {
    const result = new MockHighPrecisionNumber();
    result.value = this.value < 0n ? -this.value : this.value;
    return result;
  }

  // ============ Transcendental Functions (Approximate) ============

  /**
   * Sine (Taylor series approximation)
   */
  sin(): MockHighPrecisionNumber {
    const num = this.toNumber();
    return new MockHighPrecisionNumber(Math.sin(num));
  }

  /**
   * Cosine (Taylor series approximation)
   */
  cos(): MockHighPrecisionNumber {
    const num = this.toNumber();
    return new MockHighPrecisionNumber(Math.cos(num));
  }

  /**
   * Tangent
   */
  tan(): MockHighPrecisionNumber {
    const num = this.toNumber();
    return new MockHighPrecisionNumber(Math.tan(num));
  }

  /**
   * Natural exponential
   */
  exp(): MockHighPrecisionNumber {
    const num = this.toNumber();
    return new MockHighPrecisionNumber(Math.exp(num));
  }

  /**
   * Natural logarithm
   */
  log(): MockHighPrecisionNumber {
    if (this.value <= 0n) {
      throw new Error('Logarithm of non-positive number');
    }

    const num = this.toNumber();
    return new MockHighPrecisionNumber(Math.log(num));
  }

  /**
   * Square root
   */
  sqrt(): MockHighPrecisionNumber {
    if (this.value < 0n) {
      throw new Error('Square root of negative number');
    }

    const num = this.toNumber();
    return new MockHighPrecisionNumber(Math.sqrt(num));
  }

  // ============ Comparison Operations ============

  equals(other: MockHighPrecisionNumber): boolean {
    return this.value === other.value;
  }

  lessThan(other: MockHighPrecisionNumber): boolean {
    return this.value < other.value;
  }

  greaterThan(other: MockHighPrecisionNumber): boolean {
    return this.value > other.value;
  }

  lessThanOrEqual(other: MockHighPrecisionNumber): boolean {
    return this.value <= other.value;
  }

  greaterThanOrEqual(other: MockHighPrecisionNumber): boolean {
    return this.value >= other.value;
  }

  // ============ Memory Management (no-op for mock) ============

  free(): void {
    // No-op: JavaScript GC handles this
  }

  clone(): MockHighPrecisionNumber {
    const result = new MockHighPrecisionNumber();
    result.value = this.value;
    return result;
  }
}

/**
 * Mock WASM module interface
 */
export interface MockMPFRModule {
  // Memory management (no-op)
  _malloc(size: number): number;
  _free(ptr: number): void;

  // Context management
  _mpfr_init_default(): number;
  _mpfr_free_context(ctx: number): void;
  _mpfr_set_default_precision(prec: number): void;

  // String conversion
  _mpfr_from_string(str: number, base: number): number;
  _mpfr_to_string(ctx: number, base: number, n_digits: number): number;

  // Arithmetic operations
  _mpfr_add(a: number, b: number): number;
  _mpfr_sub(a: number, b: number): number;
  _mpfr_mul(a: number, b: number): number;
  _mpfr_div(a: number, b: number): number;
  _mpfr_pow(base: number, exp: number): number;

  // Transcendental functions
  _mpfr_sin(ctx: number): number;
  _mpfr_cos(ctx: number): number;
  _mpfr_tan(ctx: number): number;
  _mpfr_exp(ctx: number): number;
  _mpfr_log(ctx: number): number;
  _mpfr_sqrt(ctx: number): number;
  _mpfr_abs(ctx: number): number;

  // Constants
  _mpfr_const_pi(): number;
  _mpfr_const_e(): number;

  // Utility methods
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;
  UTF8ToString(ptr: number): string;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  lengthBytesUTF8(str: string): number;
}

/**
 * Mock module implementation
 */
export class MockWASMManager {
  private contexts = new Map<number, MockHighPrecisionNumber>();
  private nextContextId = 1;

  /**
   * Create mock module
   */
  createModule(): MockMPFRModule {
    return {
      // Memory management (mock)
      _malloc: (_size: number) => _size, // Just return the size as mock pointer
      _free: (_ptr: number) => {},

      // Context management
      _mpfr_init_default: () => {
        const id = this.nextContextId++;
        this.contexts.set(id, new MockHighPrecisionNumber(0));
        return id;
      },

      _mpfr_free_context: (ctx: number) => {
        this.contexts.delete(ctx);
      },

      _mpfr_set_default_precision: (_prec: number) => {
        // Mock implementation - no-op
      },

      // String conversion
      _mpfr_from_string: (str: number, _base: number) => {
        // In mock, str is actually the string value passed directly
        const id = this.nextContextId++;
        const strValue = String(str);
        this.contexts.set(id, new MockHighPrecisionNumber(strValue));
        return id;
      },

      _mpfr_to_string: (ctx: number, _base: number, n_digits: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error(`Invalid context: ${ctx}`);
        return num.toString(10, n_digits) as unknown as number; // Mock returns string directly
      },

      // Arithmetic operations
      _mpfr_add: (a: number, b: number) => {
        const numA = this.contexts.get(a);
        const numB = this.contexts.get(b);
        if (!numA || !numB) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, numA.add(numB));
        return id;
      },

      _mpfr_sub: (a: number, b: number) => {
        const numA = this.contexts.get(a);
        const numB = this.contexts.get(b);
        if (!numA || !numB) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, numA.subtract(numB));
        return id;
      },

      _mpfr_mul: (a: number, b: number) => {
        const numA = this.contexts.get(a);
        const numB = this.contexts.get(b);
        if (!numA || !numB) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, numA.multiply(numB));
        return id;
      },

      _mpfr_div: (a: number, b: number) => {
        const numA = this.contexts.get(a);
        const numB = this.contexts.get(b);
        if (!numA || !numB) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, numA.divide(numB));
        return id;
      },

      _mpfr_pow: (base: number, exp: number) => {
        const numBase = this.contexts.get(base);
        const numExp = this.contexts.get(exp);
        if (!numBase || !numExp) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, numBase.pow(numExp));
        return id;
      },

      // Transcendental functions
      _mpfr_sin: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.sin());
        return id;
      },

      _mpfr_cos: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.cos());
        return id;
      },

      _mpfr_tan: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.tan());
        return id;
      },

      _mpfr_exp: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.exp());
        return id;
      },

      _mpfr_log: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.log());
        return id;
      },

      _mpfr_sqrt: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.sqrt());
        return id;
      },

      _mpfr_abs: (ctx: number) => {
        const num = this.contexts.get(ctx);
        if (!num) throw new Error('Invalid context');

        const id = this.nextContextId++;
        this.contexts.set(id, num.abs());
        return id;
      },

      // Constants
      _mpfr_const_pi: () => {
        const id = this.nextContextId++;
        this.contexts.set(id, new MockHighPrecisionNumber(Math.PI));
        return id;
      },

      _mpfr_const_e: () => {
        const id = this.nextContextId++;
        this.contexts.set(id, new MockHighPrecisionNumber(Math.E));
        return id;
      },

      // Utility methods
      getValue: (_ptr: number, _type: string) => 0,
      setValue: (_ptr: number, _value: number, _type: string) => {},
      UTF8ToString: (ptr: number) => String(ptr),
      stringToUTF8: (_str: string, _outPtr: number, _maxBytes: number) => {},
      lengthBytesUTF8: (str: string) => str.length,
    };
  }
}

/**
 * Create mock WASM module for testing/development
 */
export function createMockWASM(): MockMPFRModule {
  console.warn('[Mock WASM] Using JavaScript fallback (limited precision)');
  const manager = new MockWASMManager();
  return manager.createModule();
}
