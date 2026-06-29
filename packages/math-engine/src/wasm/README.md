# MPFR/GMP WebAssembly Module

> **Status: scaffolding only** — no compiled WASM artifacts are built yet. When the module is unavailable, `getHighPrecision()` **throws** rather than silently degrading precision; the pure-JS mock (`createMockWASM` in `src/wasm/mock.ts`) is only used by tests/dev, not substituted into production. The MPFR/Emscripten build described below is the target, not the current state.

This directory contains the WebAssembly module for arbitrary precision arithmetic using MPFR (Multiple Precision Floating-Point Reliable Library) and GMP (GNU Multiple Precision Arithmetic Library).

## Prerequisites

### Windows

1. **Install Emscripten SDK:**
   ```bash
   # Clone the Emscripten SDK
   git clone https://github.com/emscripten-core/emsdk.git C:\emsdk
   cd C:\emsdk

   # Install latest version
   emsdk install latest

   # Activate for current user
   emsdk activate latest

   # Add to PATH (run in each new terminal, or add to system PATH)
   emsdk_env.bat
   ```

2. **Install MPFR and GMP:**

   The easiest way is to use the Emscripten ports system:
   ```bash
   # The build script will automatically use Emscripten ports
   # No manual installation needed
   ```

### macOS

```bash
# Install Emscripten via Homebrew
brew install emscripten

# MPFR/GMP will be available via Emscripten ports
```

### Linux

```bash
# Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# MPFR/GMP will be available via Emscripten ports
```

## Building

Once Emscripten is installed:

```bash
cd packages/math-engine/src/wasm/native

# Make build script executable (Unix-like systems)
chmod +x build.sh

# Run build
./build.sh
```

On Windows, use Git Bash or WSL to run the build script.

Alternatively, run the build via the package scripts:

```bash
# Runs src/wasm/native/build.sh directly (requires Emscripten on PATH)
pnpm --filter @nextcalc/math-engine build:wasm

# Hermetic build inside the Emscripten SDK Docker image (Dockerfile.wasm),
# emitting mpfr.js + mpfr.wasm into src/wasm/compiled/
pnpm --filter @nextcalc/math-engine wasm:docker
```

## Output

The build produces two files in `packages/math-engine/src/wasm/`:
- `mpfr.wasm` - The WebAssembly binary (target: < 2MB)
- `mpfr.js` - JavaScript loader and glue code

## Usage

```typescript
import { getWASMManager } from '@nextcalc/math-engine/wasm';

// Initialize WASM module
const manager = getWASMManager();
await manager.initialize();

// Set precision (256 bits = ~77 decimal digits)
await manager.setPrecision(256);

// Create numbers
const a = await manager.createNumber('1.23456789012345678901234567890');
const b = await manager.createNumber('9.87654321098765432109876543210');

// Perform operations
const sum = a.add(b);
console.log(sum.toString()); // High precision result

// Transcendental functions
const pi = await manager.createPi();
const sin_pi_4 = pi.divide(await manager.createNumber('4')).sin();
console.log(sin_pi_4.toString()); // Should be sqrt(2)/2

// Clean up
a.free();
b.free();
sum.free();
pi.free();
sin_pi_4.free();
```

## Integration with Compute Worker

The WASM module is designed to run in a Web Worker:

```typescript
// apps/web/lib/workers/compute.worker.ts
import { getWASMManager } from '@nextcalc/math-engine/wasm';

const manager = getWASMManager();

self.onmessage = async (event) => {
  await manager.initialize();

  // Use WASM for high-precision calculations
  const result = await manager.createNumber(event.data.value);
  // ... perform operations

  self.postMessage({ result: result.toString() });
};
```

## Performance

- **Precision:** Configurable (default: 256 bits = ~77 decimal digits)
- **Binary size target:** < 2MB
- **Typical operations:** < 10ms for 256-bit precision
- **Transcendental functions:** < 50ms for 256-bit precision

## Architecture

```
┌─────────────────────────────────────────┐
│          TypeScript Layer               │
│  (loader.ts - High-level API)           │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          WASM Module (mpfr.js)          │
│  (JavaScript glue code)                 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│        C++ Wrapper (mpfr_wrapper.cpp)   │
│  - Memory management                    │
│  - Type conversions                     │
│  - Function exports                     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│            MPFR/GMP Libraries           │
│  - Arbitrary precision arithmetic       │
│  - Transcendental functions             │
└─────────────────────────────────────────┘
```

## Build Configuration

See `native/build.sh` for the authoritative `emcc` invocation. As of this writing it passes:

- `-s WASM=1` - Generate WebAssembly
- `-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue"]'` - Runtime helpers exposed on the module
- `-s ALLOW_MEMORY_GROWTH=1` - Dynamic memory allocation
- `-s INITIAL_MEMORY=16MB` - Initial heap size
- `-s MAXIMUM_MEMORY=2GB` - Maximum heap size
- `-s MODULARIZE=1` - Export as a module factory
- `-s EXPORT_ES6=1` - Use ES6 import/export
- `-s EXPORT_NAME="createMPFRModule"` - Name of the exported module factory
- `-s ENVIRONMENT='web,worker'` - Target browser and Web Worker environments only
- `-s FILESYSTEM=0` - Drop the Emscripten filesystem shim
- `-O3` - Maximum optimization
- `-lmpfr -lgmp` - Link MPFR and GMP libraries
- `--no-entry` - Build as a library with no `main()`

## Testing

There are no WASM-specific test files yet. Once the module is built and tests
exist, run the package suite from `packages/math-engine`:

```bash
cd packages/math-engine
pnpm test
```

## Troubleshooting

### Build fails with "emcc: command not found"

**Solution:** Make sure Emscripten is installed and activated:
```bash
# Windows
C:\emsdk\emsdk_env.bat

# macOS/Linux
source ~/emsdk/emsdk_env.sh
```

### WASM module fails to load

**Solution:** Check browser console for specific error. Common issues:
1. WASM file not found - verify build completed successfully
2. CORS errors - make sure WASM is served with correct MIME type
3. Memory errors - increase `INITIAL_MEMORY` in build script

### Incorrect results

**Solution:**
1. Verify precision is set correctly: `await manager.setPrecision(256)`
2. Check for rounding mode (default: MPFR_RNDN - round to nearest)
3. Ensure proper memory cleanup with `.free()` calls

## Further Reading

- [MPFR Documentation](https://www.mpfr.org/mpfr-current/mpfr.html)
- [GMP Documentation](https://gmplib.org/manual/)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [WebAssembly Documentation](https://webassembly.org/)
