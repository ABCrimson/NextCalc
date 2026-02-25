# MPFR/GMP WebAssembly Module

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

## Output

The build produces two files in `packages/math-engine/src/wasm/`:
- `mpfr.wasm` - The WebAssembly binary (target: < 2MB)
- `mpfr.js` - JavaScript loader and glue code

## Usage

```typescript
import { getWASMManager } from '@nextcalc/math-engine/wasm/loader';

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
import { getWASMManager } from '@nextcalc/math-engine/wasm/loader';

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

The build script uses these Emscripten flags:

- `-s WASM=1` - Generate WebAssembly
- `-s MODULARIZE=1` - Export as ES6 module
- `-s EXPORT_ES6=1` - Use ES6 import/export
- `-s ALLOW_MEMORY_GROWTH=1` - Dynamic memory allocation
- `-s INITIAL_MEMORY=16MB` - Initial heap size
- `-s MAXIMUM_MEMORY=2GB` - Maximum heap size
- `-O3` - Maximum optimization
- `-lmpfr -lgmp` - Link MPFR and GMP libraries

## Testing

```bash
cd packages/math-engine
pnpm test wasm
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
