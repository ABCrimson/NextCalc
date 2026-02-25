/**
 * MPFR/GMP wrapper for WebAssembly
 * Provides arbitrary precision arithmetic via WASM
 */

#include <mpfr.h>
#include <gmp.h>
#include <emscripten/emscripten.h>
#include <string>
#include <cstring>

// Default precision (bits) - adjustable at runtime
static mpfr_prec_t default_precision = 256;

// Context management
struct MPFRContext {
  mpfr_t value;
  mpfr_prec_t precision;
};

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialize MPFR with default precision
 */
EMSCRIPTEN_KEEPALIVE
void* mpfr_init_default() {
  MPFRContext* ctx = new MPFRContext();
  ctx->precision = default_precision;
  mpfr_init2(ctx->value, ctx->precision);
  return ctx;
}

/**
 * Set precision for all subsequent operations
 */
EMSCRIPTEN_KEEPALIVE
void mpfr_set_default_precision(mpfr_prec_t prec) {
  default_precision = prec;
}

/**
 * Create MPFR number from string
 */
EMSCRIPTEN_KEEPALIVE
void* mpfr_from_string(const char* str, int base) {
  MPFRContext* ctx = new MPFRContext();
  ctx->precision = default_precision;
  mpfr_init2(ctx->value, ctx->precision);
  mpfr_set_str(ctx->value, str, base, MPFR_RNDN);
  return ctx;
}

/**
 * Convert MPFR number to string
 */
EMSCRIPTEN_KEEPALIVE
char* mpfr_to_string(void* ptr, int base, size_t n_digits) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  mpfr_exp_t exp;
  char* str = mpfr_get_str(nullptr, &exp, base, n_digits, ctx->value, MPFR_RNDN);

  // Format with exponent
  std::string result;
  if (str[0] == '-') {
    result = "-";
    result += str + 1;
  } else {
    result = str;
  }

  if (exp != 0) {
    result += "e" + std::to_string(exp);
  }

  // Allocate persistent memory for return
  char* output = static_cast<char*>(malloc(result.length() + 1));
  strcpy(output, result.c_str());

  mpfr_free_str(str);
  return output;
}

/**
 * Free MPFR context
 */
EMSCRIPTEN_KEEPALIVE
void mpfr_free_context(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  mpfr_clear(ctx->value);
  delete ctx;
}

// Arithmetic operations

EMSCRIPTEN_KEEPALIVE
void* mpfr_add(void* a_ptr, void* b_ptr) {
  MPFRContext* a = static_cast<MPFRContext*>(a_ptr);
  MPFRContext* b = static_cast<MPFRContext*>(b_ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_add(result->value, a->value, b->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_sub(void* a_ptr, void* b_ptr) {
  MPFRContext* a = static_cast<MPFRContext*>(a_ptr);
  MPFRContext* b = static_cast<MPFRContext*>(b_ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_sub(result->value, a->value, b->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_mul(void* a_ptr, void* b_ptr) {
  MPFRContext* a = static_cast<MPFRContext*>(a_ptr);
  MPFRContext* b = static_cast<MPFRContext*>(b_ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_mul(result->value, a->value, b->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_div(void* a_ptr, void* b_ptr) {
  MPFRContext* a = static_cast<MPFRContext*>(a_ptr);
  MPFRContext* b = static_cast<MPFRContext*>(b_ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_div(result->value, a->value, b->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_pow(void* base_ptr, void* exp_ptr) {
  MPFRContext* base = static_cast<MPFRContext*>(base_ptr);
  MPFRContext* exp = static_cast<MPFRContext*>(exp_ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_pow(result->value, base->value, exp->value, MPFR_RNDN);
  return result;
}

// Transcendental functions

EMSCRIPTEN_KEEPALIVE
void* mpfr_sin(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_sin(result->value, ctx->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_cos(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_cos(result->value, ctx->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_tan(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_tan(result->value, ctx->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_exp(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_exp(result->value, ctx->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_log(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_log(result->value, ctx->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_sqrt(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_sqrt(result->value, ctx->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_abs(void* ptr) {
  MPFRContext* ctx = static_cast<MPFRContext*>(ptr);
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_abs(result->value, ctx->value, MPFR_RNDN);
  return result;
}

// Constants

EMSCRIPTEN_KEEPALIVE
void* mpfr_const_pi() {
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  mpfr_const_pi(result->value, MPFR_RNDN);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void* mpfr_const_e() {
  MPFRContext* result = new MPFRContext();
  result->precision = default_precision;
  mpfr_init2(result->value, result->precision);
  // e = exp(1)
  mpfr_set_ui(result->value, 1, MPFR_RNDN);
  mpfr_exp(result->value, result->value, MPFR_RNDN);
  return result;
}

#ifdef __cplusplus
}
#endif
