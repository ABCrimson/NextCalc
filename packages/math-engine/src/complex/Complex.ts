/**
 * Complex Number Class
 *
 * Immutable implementation of complex numbers with comprehensive mathematical operations.
 * Supports arithmetic, trigonometric, exponential, and logarithmic functions.
 *
 * All operations return new Complex instances, preserving immutability.
 *
 * @module complex
 */

/**
 * Immutable complex number class.
 *
 * Represents a complex number in the form a + bi where:
 * - a is the real part
 * - b is the imaginary part
 * - i is the imaginary unit (i² = -1)
 *
 * @example
 * const z1 = new Complex(3, 4);
 * const z2 = Complex.fromPolar(5, Math.PI / 2);
 * const sum = z1.add(z2);
 * console.log(sum.toString()); // "3+9i"
 */
export class Complex {
  /** Real part of the complex number */
  public readonly real: number;

  /** Imaginary part of the complex number */
  public readonly imag: number;

  /**
   * Creates a new complex number.
   *
   * @param real - Real part
   * @param imag - Imaginary part
   * @throws {Error} If either part is NaN or Infinity
   */
  constructor(real: number, imag: number) {
    if (!Number.isFinite(real) || !Number.isFinite(imag)) {
      throw new Error('Complex: Real and imaginary parts must be finite numbers');
    }

    this.real = real;
    this.imag = imag;
  }

  /**
   * Creates a complex number from polar coordinates.
   *
   * @param r - Magnitude (radius)
   * @param theta - Angle in radians (argument/phase)
   * @returns Complex number with given polar coordinates
   *
   * @example
   * Complex.fromPolar(1, Math.PI / 2) // 0+1i
   * Complex.fromPolar(5, 0) // 5+0i
   */
  static fromPolar(r: number, theta: number): Complex {
    if (!Number.isFinite(r) || !Number.isFinite(theta)) {
      throw new Error('Complex.fromPolar: r and theta must be finite numbers');
    }

    if (r < 0) {
      throw new Error('Complex.fromPolar: Magnitude must be non-negative');
    }

    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  /** The imaginary unit i (0 + 1i) */
  static readonly i = new Complex(0, 1);

  /** Zero (0 + 0i) */
  static readonly zero = new Complex(0, 0);

  /** One (1 + 0i) */
  static readonly one = new Complex(1, 0);

  /**
   * Gets the magnitude (absolute value, modulus) of the complex number.
   *
   * Magnitude is sqrt(real² + imag²)
   */
  get magnitude(): number {
    return Math.hypot(this.real, this.imag);
  }

  /**
   * Gets the argument (phase, angle) of the complex number in radians.
   *
   * Returns the angle in the range [-π, π].
   */
  get argument(): number {
    return Math.atan2(this.imag, this.real);
  }

  /**
   * Gets the complex conjugate.
   *
   * The conjugate of a + bi is a - bi.
   */
  get conjugate(): Complex {
    return new Complex(this.real, -this.imag);
  }

  /**
   * Adds another complex number to this one.
   *
   * (a + bi) + (c + di) = (a + c) + (b + d)i
   *
   * @param other - Complex number to add
   * @returns Sum as a new Complex instance
   */
  add(other: Complex): Complex {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  /**
   * Subtracts another complex number from this one.
   *
   * (a + bi) - (c + di) = (a - c) + (b - d)i
   *
   * @param other - Complex number to subtract
   * @returns Difference as a new Complex instance
   */
  subtract(other: Complex): Complex {
    return new Complex(this.real - other.real, this.imag - other.imag);
  }

  /**
   * Multiplies this complex number by another.
   *
   * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
   *
   * @param other - Complex number to multiply by
   * @returns Product as a new Complex instance
   */
  multiply(other: Complex): Complex {
    const real = this.real * other.real - this.imag * other.imag;
    const imag = this.real * other.imag + this.imag * other.real;
    return new Complex(real, imag);
  }

  /**
   * Divides this complex number by another.
   *
   * (a + bi) / (c + di) = [(a + bi)(c - di)] / (c² + d²)
   *
   * @param other - Complex number to divide by
   * @returns Quotient as a new Complex instance
   * @throws {Error} If dividing by zero
   */
  divide(other: Complex): Complex {
    const denominator = other.real * other.real + other.imag * other.imag;

    if (denominator === 0) {
      throw new Error('Complex.divide: Division by zero');
    }

    const real = (this.real * other.real + this.imag * other.imag) / denominator;
    const imag = (this.imag * other.real - this.real * other.imag) / denominator;

    return new Complex(real, imag);
  }

  /**
   * Negates this complex number.
   *
   * -(a + bi) = -a - bi
   *
   * @returns Negated complex number
   */
  negate(): Complex {
    return new Complex(-this.real, -this.imag);
  }

  /**
   * Scales this complex number by a real scalar.
   *
   * k(a + bi) = ka + kbi
   *
   * @param scalar - Real number to scale by
   * @returns Scaled complex number
   */
  scale(scalar: number): Complex {
    if (!Number.isFinite(scalar)) {
      throw new Error('Complex.scale: Scalar must be a finite number');
    }

    return new Complex(this.real * scalar, this.imag * scalar);
  }

  /**
   * Raises this complex number to an integer power.
   *
   * Uses repeated multiplication for positive powers and De Moivre's formula
   * for large exponents: z^n = r^n * (cos(nθ) + i*sin(nθ))
   *
   * @param n - Integer exponent
   * @returns This complex number raised to the nth power
   * @throws {Error} If n is not an integer
   *
   * @example
   * new Complex(0, 1).pow(2) // -1+0i (i² = -1)
   * new Complex(1, 1).pow(3) // -2+2i
   */
  pow(n: number): Complex {
    if (!Number.isInteger(n)) {
      throw new Error('Complex.pow: Exponent must be an integer');
    }

    if (n === 0) {
      return Complex.one;
    }

    if (n < 0) {
      return Complex.one.divide(this.pow(-n));
    }

    // For small exponents, use repeated multiplication
    if (n <= 10) {
      let result = Complex.one;
      for (let i = 0; i < n; i++) {
        result = result.multiply(this);
      }
      return result;
    }

    // For large exponents, use De Moivre's formula
    const r = this.magnitude ** n;
    const theta = n * this.argument;
    return Complex.fromPolar(r, theta);
  }

  /**
   * Computes the principal square root of this complex number.
   *
   * For z = a + bi:
   * √z = √r * (cos(θ/2) + i*sin(θ/2))
   * where r = |z| and θ = arg(z)
   *
   * @returns Principal square root
   *
   * @example
   * new Complex(-1, 0).sqrt() // 0+1i (√(-1) = i)
   * new Complex(0, 4).sqrt() // ~1.41+1.41i
   */
  sqrt(): Complex {
    const r = this.magnitude;
    const theta = this.argument;
    return Complex.fromPolar(Math.sqrt(r), theta / 2);
  }

  /**
   * Computes e^z (exponential function).
   *
   * e^(a+bi) = e^a * (cos(b) + i*sin(b))
   *
   * @returns e raised to this complex number
   *
   * @example
   * new Complex(0, Math.PI).exp() // -1+0i (Euler's identity)
   * new Complex(1, 0).exp() // e+0i
   */
  exp(): Complex {
    const expReal = Math.exp(this.real);
    return new Complex(expReal * Math.cos(this.imag), expReal * Math.sin(this.imag));
  }

  /**
   * Computes the natural logarithm (principal branch).
   *
   * ln(z) = ln|z| + i*arg(z)
   * where arg(z) is in the range [-π, π]
   *
   * @returns Natural logarithm of this complex number
   * @throws {Error} If attempting to take logarithm of zero
   *
   * @example
   * new Complex(Math.E, 0).ln() // 1+0i
   * Complex.i.ln() // ~0+1.57i
   */
  ln(): Complex {
    if (this.real === 0 && this.imag === 0) {
      throw new Error('Complex.ln: Cannot take logarithm of zero');
    }

    return new Complex(Math.log(this.magnitude), this.argument);
  }

  /**
   * Computes the sine of this complex number.
   *
   * sin(z) = (e^(iz) - e^(-iz)) / (2i)
   *
   * @returns Sine of this complex number
   */
  sin(): Complex {
    // sin(a + bi) = sin(a)cosh(b) + i*cos(a)sinh(b)
    const sinhImag = Math.sinh(this.imag);
    const coshImag = Math.cosh(this.imag);
    return new Complex(Math.sin(this.real) * coshImag, Math.cos(this.real) * sinhImag);
  }

  /**
   * Computes the cosine of this complex number.
   *
   * cos(z) = (e^(iz) + e^(-iz)) / 2
   *
   * @returns Cosine of this complex number
   */
  cos(): Complex {
    // cos(a + bi) = cos(a)cosh(b) - i*sin(a)sinh(b)
    const sinhImag = Math.sinh(this.imag);
    const coshImag = Math.cosh(this.imag);
    return new Complex(Math.cos(this.real) * coshImag, -Math.sin(this.real) * sinhImag);
  }

  /**
   * Computes the tangent of this complex number.
   *
   * tan(z) = sin(z) / cos(z)
   *
   * @returns Tangent of this complex number
   * @throws {Error} If cosine is zero
   */
  tan(): Complex {
    return this.sin().divide(this.cos());
  }

  /**
   * Computes the hyperbolic sine of this complex number.
   *
   * sinh(z) = (e^z - e^(-z)) / 2
   *
   * @returns Hyperbolic sine of this complex number
   */
  sinh(): Complex {
    // sinh(a + bi) = sinh(a)cos(b) + i*cosh(a)sin(b)
    return new Complex(
      Math.sinh(this.real) * Math.cos(this.imag),
      Math.cosh(this.real) * Math.sin(this.imag),
    );
  }

  /**
   * Computes the hyperbolic cosine of this complex number.
   *
   * cosh(z) = (e^z + e^(-z)) / 2
   *
   * @returns Hyperbolic cosine of this complex number
   */
  cosh(): Complex {
    // cosh(a + bi) = cosh(a)cos(b) + i*sinh(a)sin(b)
    return new Complex(
      Math.cosh(this.real) * Math.cos(this.imag),
      Math.sinh(this.real) * Math.sin(this.imag),
    );
  }

  /**
   * Converts the complex number to a string representation.
   *
   * @param format - Output format: 'cartesian' (a+bi) or 'polar' (r∠θ)
   * @returns String representation
   *
   * @example
   * new Complex(3, 4).toString() // "3+4i"
   * new Complex(3, -4).toString() // "3-4i"
   * new Complex(0, 1).toString() // "i"
   * new Complex(5, 0).toString('polar') // "5∠0"
   */
  toString(format: 'cartesian' | 'polar' = 'cartesian'): string {
    if (format === 'polar') {
      const r = this.magnitude;
      const theta = this.argument;
      return `${r.toPrecision(6)}∠${theta.toPrecision(6)}`;
    }

    // Cartesian format
    if (this.imag === 0) {
      return this.real.toString();
    }

    if (this.real === 0) {
      if (this.imag === 1) return 'i';
      if (this.imag === -1) return '-i';
      return `${this.imag}i`;
    }

    const imagPart = Math.abs(this.imag) === 1 ? 'i' : `${Math.abs(this.imag)}i`;
    const sign = this.imag > 0 ? '+' : '-';

    return `${this.real}${sign}${imagPart}`;
  }

  /**
   * Converts the complex number to LaTeX notation.
   *
   * @returns LaTeX string representation
   *
   * @example
   * new Complex(3, 4).toLatex() // "3+4i"
   * new Complex(1, -1).toLatex() // "1-i"
   */
  toLatex(): string {
    if (this.imag === 0) {
      return this.real.toString();
    }

    if (this.real === 0) {
      if (this.imag === 1) return 'i';
      if (this.imag === -1) return '-i';
      return `${this.imag}i`;
    }

    const imagPart = Math.abs(this.imag) === 1 ? 'i' : `${Math.abs(this.imag)}i`;
    const sign = this.imag > 0 ? '+' : '-';

    return `${this.real}${sign}${imagPart}`;
  }

  /**
   * Checks if this complex number equals another within a tolerance.
   *
   * @param other - Complex number to compare with
   * @param tolerance - Maximum allowed difference (default: 1e-10)
   * @returns True if numbers are equal within tolerance
   *
   * @example
   * new Complex(1, 2).equals(new Complex(1, 2)) // true
   * new Complex(1, 2).equals(new Complex(1.0000001, 2), 1e-5) // true
   */
  equals(other: Complex, tolerance = 1e-10): boolean {
    return (
      Math.abs(this.real - other.real) < tolerance && Math.abs(this.imag - other.imag) < tolerance
    );
  }

  /**
   * Returns true if this is a real number (imaginary part is zero).
   */
  isReal(): boolean {
    return this.imag === 0;
  }

  /**
   * Returns true if this is a purely imaginary number (real part is zero).
   */
  isImaginary(): boolean {
    return this.real === 0;
  }

  /**
   * Returns true if this is zero (both parts are zero).
   */
  isZero(): boolean {
    return this.real === 0 && this.imag === 0;
  }
}

/**
 * Extracts the real part of a complex number.
 *
 * @param z - Complex number
 * @returns Real part
 */
export function Re(z: Complex): number {
  return z.real;
}

/**
 * Extracts the imaginary part of a complex number.
 *
 * @param z - Complex number
 * @returns Imaginary part
 */
export function Im(z: Complex): number {
  return z.imag;
}

/**
 * Computes the magnitude (absolute value) of a complex number.
 *
 * @param z - Complex number
 * @returns Magnitude
 */
export function abs(z: Complex): number {
  return z.magnitude;
}

/**
 * Computes the argument (phase angle) of a complex number.
 *
 * @param z - Complex number
 * @returns Argument in radians [-π, π]
 */
export function arg(z: Complex): number {
  return z.argument;
}

/**
 * Computes the complex conjugate.
 *
 * @param z - Complex number
 * @returns Complex conjugate
 */
export function conj(z: Complex): Complex {
  return z.conjugate;
}
