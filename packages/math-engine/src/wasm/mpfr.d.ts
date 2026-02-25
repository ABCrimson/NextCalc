/**
 * Type declarations for MPFR WASM module
 * The actual module will be compiled from C++ sources
 */

import type { MPFRModule } from './loader';

declare function createMPFRModule(): Promise<MPFRModule>;

export default createMPFRModule;
