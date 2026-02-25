/**
 * Type-Safe WASM Wrapper for MPFR Arbitrary Precision Arithmetic
 *
 * Provides a modern, ergonomic TypeScript API over the raw WASM bindings
 * with automatic memory management, error handling, and fallback support.
 *
 * @module @nextcalc/math-engine/wasm/wrapper
 */

import type { MPFRModule } from './loader';

/**
 * Precision modes for MPFR calculations
 */
export type PrecisionMode =
  | 'standard'    // 128 bits (~38 decimal digits)
  | 'high'        // 256 bits (~77 decimal digits)
  | 'ultra'       // 512 bits (~154 decimal digits)
  | 'extreme';    // 1024 bits (~308 decimal digits)

/**
 * Rounding modes (MPFR supports multiple, we expose most common)
 */
export type RoundingMode =
  | 'nearest'     // Round to nearest, ties to even (MPFR_RNDN)
  | 'zero'        // Round toward zero (MPFR_RNDZ)
  | 'up'          // Round toward +∞ (MPFR_RNDU)
  | 'down';       // Round toward -∞ (MPFR_RNDD)

/**
 * Configuration for WASM wrapper
 */
export interface WASMConfig {
  precision?: PrecisionMode | number;
  rounding?: RoundingMode;
  autoCleanup?: boolean;  // Auto-free on scope exit
  enableLogging?: boolean; // Log operations for debugging
}

/**
 * Error thrown when WASM operations fail
 */
export class WASMArithmeticError extends Error {
  override readonly name = 'WASMArithmeticError';
  override readonly cause?: unknown;

  constructor(
    message: string,
    public readonly operation: string,
    cause?: unknown
  ) {
    super(`WASM ${operation}: ${message}`);
    this.cause = cause;
  }
}

/**
 * Get precision in bits from mode
 */
function getPrecisionBits(mode: PrecisionMode | number): number {
  if (typeof mode === 'number') return mode;

  const precisionMap: Record<PrecisionMode, number> = {
    standard: 128,
    high: 256,
    ultra: 512,
    extreme: 1024,
  };

  return precisionMap[mode];
}

/**
 * Enhanced MPFR Number with automatic memory management
 */
export class HighPrecisionNumber {
  private ctx: number;
  private freed = false;

  constructor(
    private readonly module: MPFRModule,
    value?: string | number | bigint
  ) {
    if (value !== undefined) {
      const str = String(value);
      const strPtr = this.allocString(str);
      try {
        this.ctx = this.module._mpfr_from_string(strPtr, 10);
      } finally {
        this.module._free(strPtr);
      }
    } else {
      this.ctx = this.module._mpfr_init_default();
    }
  }

  /**
   * Get internal context pointer (for advanced usage)
   */
  get _contextPtr(): number {
    this.assertNotFreed();
    return this.ctx;
  }

  /**
   * Allocate string in WASM memory
   */
  private allocString(str: string): number {
    const bytes = this.module.lengthBytesUTF8(str) + 1;
    const ptr = this.module._malloc(bytes);
    if (ptr === 0) {
      throw new WASMArithmeticError('Memory allocation failed', 'allocString');
    }
    this.module.stringToUTF8(str, ptr, bytes);
    return ptr;
  }

  /**
   * Assert number hasn't been freed
   */
  private assertNotFreed(): void {
    if (this.freed) {
      throw new WASMArithmeticError(
        'Cannot operate on freed number',
        'assertNotFreed'
      );
    }
  }

  /**
   * Create new number from context pointer (internal)
   */
  private static fromContext(
    module: MPFRModule,
    ctx: number
  ): HighPrecisionNumber {
    const num = Object.create(HighPrecisionNumber.prototype);
    num.module = module;
    num.ctx = ctx;
    num.freed = false;
    return num;
  }

  /**
   * Convert to string representation
   * @param base - Number base (2-62, default 10)
   * @param digits - Significant digits (0 = all, default 0)
   */
  toString(base = 10, digits = 0): string {
    this.assertNotFreed();

    if (base < 2 || base > 62) {
      throw new WASMArithmeticError(
        `Invalid base ${base}, must be 2-62`,
        'toString'
      );
    }

    const strPtr = this.module._mpfr_to_string(this.ctx, base, digits);
    if (strPtr === 0) {
      throw new WASMArithmeticError('String conversion failed', 'toString');
    }

    try {
      return this.module.UTF8ToString(strPtr);
    } finally {
      this.module._free(strPtr);
    }
  }

  /**
   * Convert to JavaScript number (may lose precision)
   * @returns IEEE 754 double precision number
   */
  toNumber(): number {
    return parseFloat(this.toString(10, 17));
  }

  /**
   * Convert to BigInt (truncates decimal part)
   */
  toBigInt(): bigint {
    const str = this.toString(10, 0);
    const parts = str.split('.');
    const firstPart = parts[0];
    if (!firstPart) {
      throw new WASMArithmeticError('Invalid number format', 'toBigInt');
    }
    return BigInt(firstPart);
  }

  /**
   * Check if number is integer
   */
  isInteger(): boolean {
    const str = this.toString(10, 0);
    return !str.includes('.') && !str.includes('e');
  }

  /**
   * Check if number is zero
   */
  isZero(): boolean {
    const str = this.toString(10, 1);
    return str === '0' || str === '-0';
  }

  /**
   * Get sign (-1, 0, or 1)
   */
  sign(): number {
    const str = this.toString(10, 1);
    if (str === '0' || str === '-0') return 0;
    return str.startsWith('-') ? -1 : 1;
  }

  // ============ Arithmetic Operations ============

  /**
   * Addition: this + other
   */
  add(other: HighPrecisionNumber): HighPrecisionNumber {
    this.assertNotFreed();
    other.assertNotFreed();

    const result = this.module._mpfr_add(this.ctx, other.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Subtraction: this - other
   */
  subtract(other: HighPrecisionNumber): HighPrecisionNumber {
    this.assertNotFreed();
    other.assertNotFreed();

    const result = this.module._mpfr_sub(this.ctx, other.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Multiplication: this * other
   */
  multiply(other: HighPrecisionNumber): HighPrecisionNumber {
    this.assertNotFreed();
    other.assertNotFreed();

    const result = this.module._mpfr_mul(this.ctx, other.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Division: this / other
   */
  divide(other: HighPrecisionNumber): HighPrecisionNumber {
    this.assertNotFreed();
    other.assertNotFreed();

    if (other.isZero()) {
      throw new WASMArithmeticError('Division by zero', 'divide');
    }

    const result = this.module._mpfr_div(this.ctx, other.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Exponentiation: this ^ exponent
   */
  pow(exponent: HighPrecisionNumber): HighPrecisionNumber {
    this.assertNotFreed();
    exponent.assertNotFreed();

    const result = this.module._mpfr_pow(this.ctx, exponent.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Negation: -this
   */
  negate(): HighPrecisionNumber {
    this.assertNotFreed();

    const zero = new HighPrecisionNumber(this.module, 0);
    try {
      return zero.subtract(this);
    } finally {
      zero.free();
    }
  }

  /**
   * Absolute value: |this|
   */
  abs(): HighPrecisionNumber {
    this.assertNotFreed();

    const result = this.module._mpfr_abs(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  // ============ Transcendental Functions ============

  /**
   * Sine: sin(this)
   */
  sin(): HighPrecisionNumber {
    this.assertNotFreed();

    const result = this.module._mpfr_sin(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Cosine: cos(this)
   */
  cos(): HighPrecisionNumber {
    this.assertNotFreed();

    const result = this.module._mpfr_cos(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Tangent: tan(this)
   */
  tan(): HighPrecisionNumber {
    this.assertNotFreed();

    const result = this.module._mpfr_tan(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Natural exponential: e^this
   */
  exp(): HighPrecisionNumber {
    this.assertNotFreed();

    const result = this.module._mpfr_exp(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Natural logarithm: ln(this)
   */
  log(): HighPrecisionNumber {
    this.assertNotFreed();

    if (this.sign() <= 0) {
      throw new WASMArithmeticError(
        'Logarithm of non-positive number',
        'log'
      );
    }

    const result = this.module._mpfr_log(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  /**
   * Square root: √this
   */
  sqrt(): HighPrecisionNumber {
    this.assertNotFreed();

    if (this.sign() < 0) {
      throw new WASMArithmeticError(
        'Square root of negative number',
        'sqrt'
      );
    }

    const result = this.module._mpfr_sqrt(this.ctx);
    return HighPrecisionNumber.fromContext(this.module, result);
  }

  // ============ Comparison Operations ============

  /**
   * Equality check (exact comparison)
   */
  equals(other: HighPrecisionNumber): boolean {
    return this.toString() === other.toString();
  }

  /**
   * Less than comparison
   */
  lessThan(other: HighPrecisionNumber): boolean {
    const diff = this.subtract(other);
    try {
      return diff.sign() < 0;
    } finally {
      diff.free();
    }
  }

  /**
   * Greater than comparison
   */
  greaterThan(other: HighPrecisionNumber): boolean {
    const diff = this.subtract(other);
    try {
      return diff.sign() > 0;
    } finally {
      diff.free();
    }
  }

  /**
   * Less than or equal comparison
   */
  lessThanOrEqual(other: HighPrecisionNumber): boolean {
    return !this.greaterThan(other);
  }

  /**
   * Greater than or equal comparison
   */
  greaterThanOrEqual(other: HighPrecisionNumber): boolean {
    return !this.lessThan(other);
  }

  // ============ Memory Management ============

  /**
   * Free WASM memory
   * Must be called when number is no longer needed to prevent memory leaks
   */
  free(): void {
    if (!this.freed && this.ctx !== 0) {
      this.module._mpfr_free_context(this.ctx);
      this.ctx = 0;
      this.freed = true;
    }
  }

  /**
   * Clone this number (creates new WASM allocation)
   */
  clone(): HighPrecisionNumber {
    this.assertNotFreed();
    return new HighPrecisionNumber(this.module, this.toString());
  }
}

/**
 * Resource manager for automatic cleanup
 */
export class HighPrecisionScope {
  private resources: HighPrecisionNumber[] = [];

  constructor(private readonly module: MPFRModule) {}

  /**
   * Track a number for automatic cleanup
   */
  track<T extends HighPrecisionNumber>(num: T): T {
    this.resources.push(num);
    return num;
  }

  /**
   * Create and track a new number
   */
  create(value?: string | number | bigint): HighPrecisionNumber {
    const num = new HighPrecisionNumber(this.module, value);
    return this.track(num);
  }

  /**
   * Clean up all tracked resources
   */
  cleanup(): void {
    for (const resource of this.resources) {
      resource.free();
    }
    this.resources = [];
  }

  /**
   * Execute function with automatic cleanup
   */
  static async run<T>(
    module: MPFRModule,
    fn: (scope: HighPrecisionScope) => T | Promise<T>
  ): Promise<T> {
    const scope = new HighPrecisionScope(module);
    try {
      return await fn(scope);
    } finally {
      scope.cleanup();
    }
  }
}

/**
 * High-level WASM manager with convenience methods
 */
export class HighPrecisionManager {
  private module: MPFRModule | null = null;
  private currentPrecision: number = 256; // Default: high precision

  constructor(private config: WASMConfig = {}) {
    const precision = config.precision ?? 'high';
    this.currentPrecision = getPrecisionBits(precision);
  }

  /**
   * Initialize WASM module (must be called before use)
   */
  async initialize(module: MPFRModule): Promise<void> {
    this.module = module;
    await this.setPrecision(this.config.precision ?? 'high');
  }

  /**
   * Set precision for all subsequent operations
   */
  async setPrecision(mode: PrecisionMode | number): Promise<void> {
    if (!this.module) {
      throw new WASMArithmeticError('Module not initialized', 'setPrecision');
    }

    const bits = getPrecisionBits(mode as PrecisionMode | number);
    this.currentPrecision = bits;
    this.module._mpfr_set_default_precision(bits);

    if (this.config.enableLogging) {
      console.log(`[WASM] Precision set to ${bits} bits`);
    }
  }

  /**
   * Get current precision in bits
   */
  getPrecision(): number {
    return this.currentPrecision;
  }

  /**
   * Create new high-precision number
   */
  create(value?: string | number | bigint): HighPrecisionNumber {
    if (!this.module) {
      throw new WASMArithmeticError('Module not initialized', 'create');
    }

    return new HighPrecisionNumber(this.module, value);
  }

  /**
   * Create mathematical constant π
   */
  pi(): HighPrecisionNumber {
    if (!this.module) {
      throw new WASMArithmeticError('Module not initialized', 'pi');
    }

    const ctx = this.module._mpfr_const_pi();
    return HighPrecisionNumber['fromContext'](this.module, ctx);
  }

  /**
   * Create mathematical constant e
   */
  e(): HighPrecisionNumber {
    if (!this.module) {
      throw new WASMArithmeticError('Module not initialized', 'e');
    }

    const ctx = this.module._mpfr_const_e();
    return HighPrecisionNumber['fromContext'](this.module, ctx);
  }

  /**
   * Create scope for automatic memory management
   */
  scope(): HighPrecisionScope {
    if (!this.module) {
      throw new WASMArithmeticError('Module not initialized', 'scope');
    }

    return new HighPrecisionScope(this.module);
  }

  /**
   * Execute computation with automatic cleanup
   */
  async compute<T>(
    fn: (scope: HighPrecisionScope) => T | Promise<T>
  ): Promise<T> {
    if (!this.module) {
      throw new WASMArithmeticError('Module not initialized', 'compute');
    }

    return HighPrecisionScope.run(this.module, fn);
  }
}

/**
 * Create high-precision manager with configuration
 */
export function createHighPrecision(config?: WASMConfig): HighPrecisionManager {
  return new HighPrecisionManager(config);
}
