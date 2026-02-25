#!/bin/bash
# MPFR/GMP WASM Build Script for NextCalc Pro
#
# This script compiles the MPFR arbitrary precision library to WebAssembly
# using Emscripten toolchain with optimal settings for production.
#
# Prerequisites:
#   - Emscripten SDK (emsdk) installed and activated
#   - MPFR and GMP libraries built for WASM
#
# Usage:
#   ./wasm-build.sh [debug|release]
#
# See WASM_SETUP.md for detailed setup instructions.

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILD_MODE="${1:-release}"
SOURCE_DIR="./src/wasm/native"
OUTPUT_DIR="./src/wasm/compiled"
SOURCE_FILE="$SOURCE_DIR/mpfr_wrapper.cpp"
OUTPUT_BASE="$OUTPUT_DIR/mpfr"

# Build flags
COMMON_FLAGS=(
  -s MODULARIZE=1
  -s EXPORT_ES6=1
  -s EXPORT_NAME="createMPFRModule"
  -s ALLOW_MEMORY_GROWTH=1
  -s INITIAL_MEMORY=16777216        # 16MB
  -s MAXIMUM_MEMORY=2147483648      # 2GB
  -s STACK_SIZE=5242880             # 5MB
  -s ENVIRONMENT='web,worker'
  -s FILESYSTEM=0
  -s TEXTDECODER=2
  -s ABORTING_MALLOC=0
  --no-entry
)

# Exported WASM functions
EXPORTED_FUNCTIONS='[
  "_mpfr_init_default",
  "_mpfr_free_context",
  "_mpfr_set_default_precision",
  "_mpfr_from_string",
  "_mpfr_to_string",
  "_mpfr_add",
  "_mpfr_sub",
  "_mpfr_mul",
  "_mpfr_div",
  "_mpfr_pow",
  "_mpfr_sin",
  "_mpfr_cos",
  "_mpfr_tan",
  "_mpfr_exp",
  "_mpfr_log",
  "_mpfr_sqrt",
  "_mpfr_abs",
  "_mpfr_const_pi",
  "_mpfr_const_e",
  "_malloc",
  "_free"
]'

# Exported JavaScript runtime methods
EXPORTED_RUNTIME='[
  "ccall",
  "cwrap",
  "UTF8ToString",
  "stringToUTF8",
  "lengthBytesUTF8",
  "getValue",
  "setValue"
]'

# Helper functions
print_header() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  MPFR/GMP WASM Builder for NextCalc Pro${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

print_error() {
  echo -e "${RED}❌ Error: $1${NC}" >&2
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  Warning: $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

check_prerequisites() {
  print_info "Checking prerequisites..."

  # Check for emcc
  if ! command -v emcc &> /dev/null; then
    print_error "Emscripten (emcc) not found"
    echo ""
    echo "Please install and activate Emscripten SDK:"
    echo ""
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh  # or emsdk_env.bat on Windows"
    echo ""
    echo "For more details, see: WASM_SETUP.md"
    exit 1
  fi

  # Print Emscripten version
  EMCC_VERSION=$(emcc --version | head -n1)
  print_success "Found: $EMCC_VERSION"

  # Check for source file
  if [ ! -f "$SOURCE_FILE" ]; then
    print_error "Source file not found: $SOURCE_FILE"
    exit 1
  fi

  # Check for MPFR/GMP (optional - will fail at link time if missing)
  if ! emcc -lmpfr -lgmp -o /dev/null 2>/dev/null; then
    print_warning "MPFR/GMP libraries may not be available"
    print_info "If build fails, see WASM_SETUP.md for library installation"
  fi

  print_success "Prerequisites check passed"
}

create_output_dir() {
  mkdir -p "$OUTPUT_DIR"
  print_success "Created output directory: $OUTPUT_DIR"
}

build_wasm() {
  print_info "Building WASM module in $BUILD_MODE mode..."

  local flags=("${COMMON_FLAGS[@]}")

  # Add mode-specific flags
  if [ "$BUILD_MODE" = "debug" ]; then
    print_info "Debug mode: Including source maps and assertions"
    flags+=(
      -g4
      -s ASSERTIONS=2
      -s SAFE_HEAP=1
      -s STACK_OVERFLOW_CHECK=2
      -s DEMANGLE_SUPPORT=1
      --source-map-base http://localhost:3000/
    )
  else
    print_info "Release mode: Optimizing for size and speed"
    flags+=(
      -O3
      -flto
      -s ELIMINATE_DUPLICATE_FUNCTIONS=1
      -s AGGRESSIVE_VARIABLE_ELIMINATION=1
    )
  fi

  # Build command
  emcc "$SOURCE_FILE" \
    -o "$OUTPUT_BASE.js" \
    "${flags[@]}" \
    -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
    -s EXPORTED_RUNTIME_METHODS="$EXPORTED_RUNTIME" \
    -lmpfr \
    -lgmp

  if [ $? -eq 0 ]; then
    print_success "Compilation successful"
  else
    print_error "Compilation failed"
    exit 1
  fi
}

verify_output() {
  print_info "Verifying build output..."

  # Check WASM file
  if [ ! -f "$OUTPUT_BASE.wasm" ]; then
    print_error "WASM file not generated: $OUTPUT_BASE.wasm"
    exit 1
  fi

  # Check JS file
  if [ ! -f "$OUTPUT_BASE.js" ]; then
    print_error "JavaScript file not generated: $OUTPUT_BASE.js"
    exit 1
  fi

  # Get file sizes
  WASM_SIZE=$(du -h "$OUTPUT_BASE.wasm" | cut -f1)
  JS_SIZE=$(du -h "$OUTPUT_BASE.js" | cut -f1)

  # Get exact byte sizes for validation
  if [[ "$OSTYPE" == "darwin"* ]]; then
    WASM_BYTES=$(stat -f%z "$OUTPUT_BASE.wasm")
  else
    WASM_BYTES=$(stat -c%s "$OUTPUT_BASE.wasm")
  fi

  print_success "Generated files:"
  echo "   - WASM: $OUTPUT_BASE.wasm ($WASM_SIZE)"
  echo "   - JS:   $OUTPUT_BASE.js ($JS_SIZE)"

  # Validate size constraints
  MAX_SIZE=$((5 * 1024 * 1024))  # 5MB warning threshold

  if [ "$WASM_BYTES" -gt "$MAX_SIZE" ]; then
    print_warning "WASM binary exceeds 5MB ($WASM_SIZE)"
    print_info "Consider optimizing or reducing functionality"
  else
    print_success "WASM size within acceptable limits"
  fi

  # Check for source map (debug mode)
  if [ "$BUILD_MODE" = "debug" ] && [ -f "$OUTPUT_BASE.wasm.map" ]; then
    MAP_SIZE=$(du -h "$OUTPUT_BASE.wasm.map" | cut -f1)
    print_info "Source map: $OUTPUT_BASE.wasm.map ($MAP_SIZE)"
  fi
}

generate_typescript_check() {
  print_info "Generating TypeScript type check..."

  # Create a simple import check to verify types match
  cat > "$OUTPUT_DIR/type-check.ts" << 'EOF'
/**
 * Type check for WASM module
 * This file is auto-generated by wasm-build.sh
 */

import type { MPFRModule } from '../loader';

// This will fail at compile time if the module interface doesn't match
const _typeCheck: MPFRModule = {} as any;

// Verify exported functions exist
_typeCheck._mpfr_init_default;
_typeCheck._mpfr_add;
_typeCheck._mpfr_const_pi;

export {};
EOF

  print_success "Created type check: $OUTPUT_DIR/type-check.ts"
}

print_summary() {
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Build Complete!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Build mode:    $BUILD_MODE"
  echo "Output:        $OUTPUT_DIR/"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo ""
  echo "  1. Run tests:"
  echo "     pnpm test --filter=@nextcalc/math-engine"
  echo ""
  echo "  2. Import in your code:"
  echo "     import { getWASMManager } from '@nextcalc/math-engine/wasm';"
  echo ""
  echo "  3. For debugging, rebuild with:"
  echo "     ./wasm-build.sh debug"
  echo ""
  if [ "$BUILD_MODE" = "debug" ]; then
    echo -e "${YELLOW}Debug mode notes:${NC}"
    echo "  - Source maps enabled for browser debugging"
    echo "  - Assertions and safety checks active"
    echo "  - ~3-5x larger binary size"
    echo "  - DO NOT use in production"
    echo ""
  fi
}

# Main execution
main() {
  print_header
  echo ""

  check_prerequisites
  echo ""

  create_output_dir
  echo ""

  build_wasm
  echo ""

  verify_output
  echo ""

  generate_typescript_check

  print_summary
}

# Run main function
main "$@"
