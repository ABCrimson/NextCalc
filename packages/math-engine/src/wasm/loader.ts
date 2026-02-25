/**
 * WASM module loader for MPFR arbitrary precision arithmetic
 * Provides TypeScript bindings for the C++ WASM module
 */

/**
 * WASM Module Interface
 */
export interface MPFRModule {
  // Memory management
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
 * MPFR Number wrapper providing high-level API
 */
export class MPFRNumber {
  private ctx: number;

  constructor(
    private module: MPFRModule,
    value?: string | number
  ) {
    if (value !== undefined) {
      const str = String(value);
      const strPtr = this.allocString(str);
      this.ctx = this.module._mpfr_from_string(strPtr, 10);
      this.module._free(strPtr);
    } else {
      this.ctx = this.module._mpfr_init_default();
    }
  }

  /**
   * Allocate string in WASM memory
   */
  private allocString(str: string): number {
    const bytes = this.module.lengthBytesUTF8(str) + 1;
    const ptr = this.module._malloc(bytes);
    this.module.stringToUTF8(str, ptr, bytes);
    return ptr;
  }

  /**
   * Convert to string representation
   */
  toString(base = 10, digits = 50): string {
    const strPtr = this.module._mpfr_to_string(this.ctx, base, digits);
    const result = this.module.UTF8ToString(strPtr);
    this.module._free(strPtr);
    return result;
  }

  /**
   * Convert to JavaScript number (may lose precision)
   */
  toNumber(): number {
    return parseFloat(this.toString(10, 17));
  }

  /**
   * Arithmetic operations
   */
  add(other: MPFRNumber): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_add(this.ctx, other.ctx);
    return result;
  }

  subtract(other: MPFRNumber): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_sub(this.ctx, other.ctx);
    return result;
  }

  multiply(other: MPFRNumber): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_mul(this.ctx, other.ctx);
    return result;
  }

  divide(other: MPFRNumber): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_div(this.ctx, other.ctx);
    return result;
  }

  pow(exponent: MPFRNumber): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_pow(this.ctx, exponent.ctx);
    return result;
  }

  /**
   * Transcendental functions
   */
  sin(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_sin(this.ctx);
    return result;
  }

  cos(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_cos(this.ctx);
    return result;
  }

  tan(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_tan(this.ctx);
    return result;
  }

  exp(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_exp(this.ctx);
    return result;
  }

  log(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_log(this.ctx);
    return result;
  }

  sqrt(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_sqrt(this.ctx);
    return result;
  }

  abs(): MPFRNumber {
    const result = new MPFRNumber(this.module);
    this.module._mpfr_free_context(result.ctx);
    result.ctx = this.module._mpfr_abs(this.ctx);
    return result;
  }

  /**
   * Free WASM memory
   */
  free(): void {
    if (this.ctx) {
      this.module._mpfr_free_context(this.ctx);
      this.ctx = 0;
    }
  }
}

/**
 * WASM Module Manager
 */
export class MPFRWASMManager {
  private module: MPFRModule | null = null;
  private initPromise: Promise<MPFRModule> | null = null;

  /**
   * Initialize WASM module
   */
  async initialize(): Promise<MPFRModule> {
    if (this.module) {
      return this.module;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadModule();
    this.module = await this.initPromise;
    return this.module;
  }

  /**
   * Load WASM module
   */
  private async loadModule(): Promise<MPFRModule> {
    try {
      // Dynamic import of WASM module
      // In production, this would load the compiled mpfr.js
      const createMPFRModule = (await import('./mpfr.js')).default;
      const module = await createMPFRModule();
      return module as MPFRModule;
    } catch (error) {
      throw new Error(
        `Failed to load MPFR WASM module: ${error instanceof Error ? error.message : String(error)}\n` +
        'Make sure the WASM module is compiled by running: cd src/wasm/native && ./build.sh'
      );
    }
  }

  /**
   * Set precision for all subsequent operations
   * @param bits - Precision in bits (default: 256)
   */
  async setPrecision(bits: number): Promise<void> {
    const module = await this.initialize();
    module._mpfr_set_default_precision(bits);
  }

  /**
   * Create MPFR number from value
   */
  async createNumber(value: string | number): Promise<MPFRNumber> {
    const module = await this.initialize();
    return new MPFRNumber(module, value);
  }

  /**
   * Create constant π
   */
  async createPi(): Promise<MPFRNumber> {
    const module = await this.initialize();
    const result = new MPFRNumber(module);
    module._mpfr_free_context(result['ctx']);
    result['ctx'] = module._mpfr_const_pi();
    return result;
  }

  /**
   * Create constant e
   */
  async createE(): Promise<MPFRNumber> {
    const module = await this.initialize();
    const result = new MPFRNumber(module);
    module._mpfr_free_context(result['ctx']);
    result['ctx'] = module._mpfr_const_e();
    return result;
  }
}

// Singleton instance
let wasmManager: MPFRWASMManager | null = null;

/**
 * Get global WASM manager instance
 */
export function getWASMManager(): MPFRWASMManager {
  if (!wasmManager) {
    wasmManager = new MPFRWASMManager();
  }
  return wasmManager;
}
