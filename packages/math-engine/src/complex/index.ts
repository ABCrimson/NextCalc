/**
 * Complex Numbers Module
 *
 * Comprehensive complex number arithmetic and functions.
 * Provides an immutable Complex class with full support for:
 * - Basic arithmetic (add, subtract, multiply, divide)
 * - Trigonometric functions (sin, cos, tan)
 * - Hyperbolic functions (sinh, cosh)
 * - Exponential and logarithmic functions
 * - Power and root operations
 * - Polar and Cartesian representations
 *
 * @module complex
 *
 * @example
 * import { Complex, abs, arg } from '@nextcalc/math-engine/complex';
 *
 * const z1 = new Complex(3, 4);
 * const z2 = Complex.fromPolar(5, Math.PI / 4);
 *
 * const sum = z1.add(z2);
 * const product = z1.multiply(z2);
 * const magnitude = abs(z1); // 5
 * const phase = arg(z1); // ~0.927 radians
 */

export { abs, arg, Complex, conj, Im, Re } from './Complex';
