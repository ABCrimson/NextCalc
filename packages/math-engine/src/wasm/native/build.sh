#!/bin/bash
# Build script for MPFR/GMP WASM module
# Requires: Emscripten SDK installed and activated

set -e

echo "Building MPFR/GMP WASM module..."

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found. Please install Emscripten SDK."
    echo ""
    echo "Installation instructions:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    echo ""
    exit 1
fi

# Configuration
BUILD_DIR="./build"
OUTPUT_DIR="../"
SOURCE_FILE="mpfr_wrapper.cpp"
OUTPUT_NAME="mpfr"

# Create build directory
mkdir -p "$BUILD_DIR"

# Compile with Emscripten
emcc "$SOURCE_FILE" \
  -o "$OUTPUT_DIR/$OUTPUT_NAME.js" \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16MB \
  -s MAXIMUM_MEMORY=2GB \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME="createMPFRModule" \
  -s ENVIRONMENT='web,worker' \
  -s FILESYSTEM=0 \
  -O3 \
  -lmpfr \
  -lgmp \
  --no-entry

# Check output size
WASM_SIZE=$(du -h "$OUTPUT_DIR/$OUTPUT_NAME.wasm" | cut -f1)
echo "✅ Build successful!"
echo "   Output: $OUTPUT_DIR/$OUTPUT_NAME.wasm ($WASM_SIZE)"
echo "   JavaScript: $OUTPUT_DIR/$OUTPUT_NAME.js"

# Verify size constraint (< 2MB)
SIZE_BYTES=$(stat -f%z "$OUTPUT_DIR/$OUTPUT_NAME.wasm" 2>/dev/null || stat -c%s "$OUTPUT_DIR/$OUTPUT_NAME.wasm")
MAX_SIZE=$((2 * 1024 * 1024))

if [ "$SIZE_BYTES" -gt "$MAX_SIZE" ]; then
    echo "⚠️  Warning: WASM binary exceeds 2MB target size"
else
    echo "✅ Size constraint met (< 2MB)"
fi

echo ""
echo "Next steps:"
echo "  1. Test the WASM module with npm test"
echo "  2. Integrate with Web Worker in apps/web/lib/workers/compute.worker.ts"
