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
export { getWASMManager, getHighPrecision, MPFRWASMManager, MPFRNumber, type MPFRModule } from './loader';

// Enhanced wrapper with better API
export {
  HighPrecisionNumber,
  HighPrecisionScope,
  HighPrecisionManager,
  createHighPrecision,
  WASMArithmeticError,
  type PrecisionMode,
  type RoundingMode,
  type WASMConfig,
} from './wrapper';

// Mock implementation for development/fallback
export {
  MockHighPrecisionNumber,
  MockWASMManager,
  createMockWASM,
  type MockMPFRModule,
} from './mock';
