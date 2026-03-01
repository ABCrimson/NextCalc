/**
 * WASM module for arbitrary precision arithmetic
 *
 * This module provides access to MPFR/GMP compiled to WebAssembly
 * for high-precision mathematical operations.
 *
 * Note: Requires the WASM module to be built first.
 * Run: pnpm run build:wasm
 *
 * See WASM_SETUP.md for detailed setup instructions.
 */

// Original WASM bindings
export {
  getHighPrecision,
  getWASMManager,
  type MPFRModule,
  MPFRNumber,
  MPFRWASMManager,
} from './loader';
// Mock implementation for development/fallback
export {
  createMockWASM,
  MockHighPrecisionNumber,
  type MockMPFRModule,
  MockWASMManager,
} from './mock';
// Enhanced wrapper with better API
export {
  createHighPrecision,
  HighPrecisionManager,
  HighPrecisionNumber,
  HighPrecisionScope,
  type PrecisionMode,
  type RoundingMode,
  WASMArithmeticError,
  type WASMConfig,
} from './wrapper';
