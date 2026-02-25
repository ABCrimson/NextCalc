/**
 * Unit tests for Complex number class
 */

import { describe, it, expect } from 'vitest';
import { Complex, Re, Im, abs, arg, conj } from './Complex';

describe('Complex Numbers', () => {
  describe('constructor', () => {
    it('creates complex number with real and imaginary parts', () => {
      const z = new Complex(3, 4);
      expect(z.real).toBe(3);
      expect(z.imag).toBe(4);
    });

    it('creates purely real number', () => {
      const z = new Complex(5, 0);
      expect(z.real).toBe(5);
      expect(z.imag).toBe(0);
    });

    it('creates purely imaginary number', () => {
      const z = new Complex(0, 3);
      expect(z.real).toBe(0);
      expect(z.imag).toBe(3);
    });

    it('throws on NaN', () => {
      expect(() => new Complex(NaN, 0)).toThrow();
      expect(() => new Complex(0, NaN)).toThrow();
    });

    it('throws on Infinity', () => {
      expect(() => new Complex(Infinity, 0)).toThrow();
      expect(() => new Complex(0, Infinity)).toThrow();
    });
  });

  describe('fromPolar', () => {
    it('creates complex number from polar coordinates', () => {
      const z = Complex.fromPolar(5, 0);
      expect(z.real).toBeCloseTo(5, 10);
      expect(z.imag).toBeCloseTo(0, 10);
    });

    it('creates complex number at 90 degrees', () => {
      const z = Complex.fromPolar(1, Math.PI / 2);
      expect(z.real).toBeCloseTo(0, 10);
      expect(z.imag).toBeCloseTo(1, 10);
    });

    it('creates complex number at 180 degrees', () => {
      const z = Complex.fromPolar(1, Math.PI);
      expect(z.real).toBeCloseTo(-1, 10);
      expect(z.imag).toBeCloseTo(0, 10);
    });

    it('throws on negative magnitude', () => {
      expect(() => Complex.fromPolar(-5, 0)).toThrow();
    });

    it('throws on invalid inputs', () => {
      expect(() => Complex.fromPolar(NaN, 0)).toThrow();
      expect(() => Complex.fromPolar(1, Infinity)).toThrow();
    });
  });

  describe('constants', () => {
    it('has imaginary unit i', () => {
      expect(Complex.i.real).toBe(0);
      expect(Complex.i.imag).toBe(1);
    });

    it('has zero', () => {
      expect(Complex.zero.real).toBe(0);
      expect(Complex.zero.imag).toBe(0);
    });

    it('has one', () => {
      expect(Complex.one.real).toBe(1);
      expect(Complex.one.imag).toBe(0);
    });
  });

  describe('magnitude', () => {
    it('calculates magnitude of complex number', () => {
      const z = new Complex(3, 4);
      expect(z.magnitude).toBeCloseTo(5, 10);
    });

    it('calculates magnitude of real number', () => {
      const z = new Complex(5, 0);
      expect(z.magnitude).toBe(5);
    });

    it('calculates magnitude of imaginary number', () => {
      const z = new Complex(0, 3);
      expect(z.magnitude).toBe(3);
    });

    it('calculates magnitude of zero', () => {
      expect(Complex.zero.magnitude).toBe(0);
    });
  });

  describe('argument', () => {
    it('calculates argument of positive real number', () => {
      const z = new Complex(5, 0);
      expect(z.argument).toBeCloseTo(0, 10);
    });

    it('calculates argument of negative real number', () => {
      const z = new Complex(-5, 0);
      expect(Math.abs(z.argument)).toBeCloseTo(Math.PI, 10);
    });

    it('calculates argument of imaginary unit', () => {
      const z = Complex.i;
      expect(z.argument).toBeCloseTo(Math.PI / 2, 10);
    });

    it('calculates argument of complex number', () => {
      const z = new Complex(1, 1);
      expect(z.argument).toBeCloseTo(Math.PI / 4, 10);
    });
  });

  describe('conjugate', () => {
    it('calculates conjugate', () => {
      const z = new Complex(3, 4);
      const conj = z.conjugate;
      expect(conj.real).toBe(3);
      expect(conj.imag).toBe(-4);
    });

    it('conjugate of real number is itself', () => {
      const z = new Complex(5, 0);
      const conj = z.conjugate;
      expect(conj.real).toBe(5);
      expect(Math.abs(conj.imag)).toBe(0); // Handle -0 vs +0
    });

    it('conjugate of conjugate is original', () => {
      const z = new Complex(3, 4);
      const conjConj = z.conjugate.conjugate;
      expect(conjConj.equals(z)).toBe(true);
    });
  });

  describe('add', () => {
    it('adds two complex numbers', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(1, 2);
      const sum = z1.add(z2);
      expect(sum.real).toBe(4);
      expect(sum.imag).toBe(6);
    });

    it('adds real numbers', () => {
      const z1 = new Complex(3, 0);
      const z2 = new Complex(2, 0);
      const sum = z1.add(z2);
      expect(sum.real).toBe(5);
      expect(sum.imag).toBe(0);
    });

    it('is commutative', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(1, 2);
      expect(z1.add(z2).equals(z2.add(z1))).toBe(true);
    });
  });

  describe('subtract', () => {
    it('subtracts two complex numbers', () => {
      const z1 = new Complex(5, 7);
      const z2 = new Complex(2, 3);
      const diff = z1.subtract(z2);
      expect(diff.real).toBe(3);
      expect(diff.imag).toBe(4);
    });

    it('subtracts from zero', () => {
      const z = new Complex(3, 4);
      const result = Complex.zero.subtract(z);
      expect(result.real).toBe(-3);
      expect(result.imag).toBe(-4);
    });
  });

  describe('multiply', () => {
    it('multiplies two complex numbers', () => {
      const z1 = new Complex(3, 2);
      const z2 = new Complex(1, 7);
      const product = z1.multiply(z2);
      // (3 + 2i)(1 + 7i) = 3 + 21i + 2i + 14i² = 3 + 23i - 14 = -11 + 23i
      expect(product.real).toBe(-11);
      expect(product.imag).toBe(23);
    });

    it('multiplies by i', () => {
      const z = new Complex(3, 4);
      const product = z.multiply(Complex.i);
      expect(product.real).toBe(-4);
      expect(product.imag).toBe(3);
    });

    it('i squared equals -1', () => {
      const result = Complex.i.multiply(Complex.i);
      expect(result.real).toBeCloseTo(-1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('is commutative', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(1, 2);
      expect(z1.multiply(z2).equals(z2.multiply(z1))).toBe(true);
    });
  });

  describe('divide', () => {
    it('divides two complex numbers', () => {
      const z1 = new Complex(3, 2);
      const z2 = new Complex(4, -3);
      const quotient = z1.divide(z2);
      // (3 + 2i) / (4 - 3i) = (3 + 2i)(4 + 3i) / 25 = (6 + 17i) / 25
      expect(quotient.real).toBeCloseTo(0.24, 10);
      expect(quotient.imag).toBeCloseTo(0.68, 10);
    });

    it('divides by real number', () => {
      const z = new Complex(6, 8);
      const divisor = new Complex(2, 0);
      const quotient = z.divide(divisor);
      expect(quotient.real).toBe(3);
      expect(quotient.imag).toBe(4);
    });

    it('division by conjugate norm gives 1', () => {
      const z = new Complex(3, 4);
      const norm = z.magnitude * z.magnitude; // 25
      const quotient = z.multiply(z.conjugate).divide(new Complex(norm, 0));
      expect(quotient.real).toBeCloseTo(1, 10);
      expect(quotient.imag).toBeCloseTo(0, 10);
    });

    it('throws on division by zero', () => {
      const z = new Complex(3, 4);
      expect(() => z.divide(Complex.zero)).toThrow();
    });
  });

  describe('negate', () => {
    it('negates complex number', () => {
      const z = new Complex(3, 4);
      const neg = z.negate();
      expect(neg.real).toBe(-3);
      expect(neg.imag).toBe(-4);
    });

    it('double negation gives original', () => {
      const z = new Complex(3, 4);
      expect(z.negate().negate().equals(z)).toBe(true);
    });
  });

  describe('scale', () => {
    it('scales complex number', () => {
      const z = new Complex(3, 4);
      const scaled = z.scale(2);
      expect(scaled.real).toBe(6);
      expect(scaled.imag).toBe(8);
    });

    it('scales by zero', () => {
      const z = new Complex(3, 4);
      const scaled = z.scale(0);
      expect(scaled.equals(Complex.zero)).toBe(true);
    });

    it('throws on invalid scalar', () => {
      const z = new Complex(3, 4);
      expect(() => z.scale(NaN)).toThrow();
      expect(() => z.scale(Infinity)).toThrow();
    });
  });

  describe('pow', () => {
    it('raises to power 0', () => {
      const z = new Complex(3, 4);
      const result = z.pow(0);
      expect(result.equals(Complex.one)).toBe(true);
    });

    it('raises to power 1', () => {
      const z = new Complex(3, 4);
      const result = z.pow(1);
      expect(result.equals(z)).toBe(true);
    });

    it('raises to power 2', () => {
      const z = new Complex(3, 4);
      const result = z.pow(2);
      // (3 + 4i)² = 9 + 24i + 16i² = -7 + 24i
      expect(result.real).toBeCloseTo(-7, 10);
      expect(result.imag).toBeCloseTo(24, 10);
    });

    it('i to the power 2 equals -1', () => {
      const result = Complex.i.pow(2);
      expect(result.real).toBeCloseTo(-1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('i to the power 4 equals 1', () => {
      const result = Complex.i.pow(4);
      expect(result.real).toBeCloseTo(1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('raises to negative power', () => {
      const z = new Complex(2, 0);
      const result = z.pow(-1);
      expect(result.real).toBeCloseTo(0.5, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('throws on non-integer exponent', () => {
      const z = new Complex(3, 4);
      expect(() => z.pow(1.5)).toThrow();
    });
  });

  describe('sqrt', () => {
    it('calculates square root of positive real', () => {
      const z = new Complex(4, 0);
      const result = z.sqrt();
      expect(result.real).toBeCloseTo(2, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('calculates square root of negative real', () => {
      const z = new Complex(-1, 0);
      const result = z.sqrt();
      expect(result.real).toBeCloseTo(0, 10);
      expect(result.imag).toBeCloseTo(1, 10);
    });

    it('calculates square root of imaginary', () => {
      const z = new Complex(0, 4);
      const result = z.sqrt();
      expect(result.magnitude).toBeCloseTo(2, 10);
    });

    it('square root squared gives original', () => {
      const z = new Complex(3, 4);
      const sqrt = z.sqrt();
      const squared = sqrt.multiply(sqrt);
      expect(squared.equals(z, 1e-10)).toBe(true);
    });
  });

  describe('exp', () => {
    it('calculates exp of zero', () => {
      const result = Complex.zero.exp();
      expect(result.equals(Complex.one, 1e-10)).toBe(true);
    });

    it('calculates exp of real number', () => {
      const z = new Complex(1, 0);
      const result = z.exp();
      expect(result.real).toBeCloseTo(Math.E, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('verifies Euler identity: e^(iπ) = -1', () => {
      const z = new Complex(0, Math.PI);
      const result = z.exp();
      expect(result.real).toBeCloseTo(-1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('calculates exp of imaginary number', () => {
      const z = new Complex(0, Math.PI / 2);
      const result = z.exp();
      expect(result.real).toBeCloseTo(0, 10);
      expect(result.imag).toBeCloseTo(1, 10);
    });
  });

  describe('ln', () => {
    it('calculates ln of positive real', () => {
      const z = new Complex(Math.E, 0);
      const result = z.ln();
      expect(result.real).toBeCloseTo(1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('calculates ln of imaginary unit', () => {
      const result = Complex.i.ln();
      expect(result.real).toBeCloseTo(0, 10);
      expect(result.imag).toBeCloseTo(Math.PI / 2, 10);
    });

    it('ln(exp(z)) = z for real part', () => {
      const z = new Complex(2, 1);
      const result = z.exp().ln();
      expect(result.real).toBeCloseTo(z.real, 10);
    });

    it('throws on ln of zero', () => {
      expect(() => Complex.zero.ln()).toThrow();
    });
  });

  describe('trigonometric functions', () => {
    it('calculates sin of zero', () => {
      const result = Complex.zero.sin();
      expect(result.equals(Complex.zero, 1e-10)).toBe(true);
    });

    it('calculates cos of zero', () => {
      const result = Complex.zero.cos();
      expect(result.equals(Complex.one, 1e-10)).toBe(true);
    });

    it('calculates sin of real number', () => {
      const z = new Complex(Math.PI / 2, 0);
      const result = z.sin();
      expect(result.real).toBeCloseTo(1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('calculates cos of real number', () => {
      const z = new Complex(Math.PI, 0);
      const result = z.cos();
      expect(result.real).toBeCloseTo(-1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });

    it('verifies sin²(z) + cos²(z) = 1', () => {
      const z = new Complex(1, 2);
      const sin = z.sin();
      const cos = z.cos();
      const sum = sin.multiply(sin).add(cos.multiply(cos));
      expect(sum.equals(Complex.one, 1e-10)).toBe(true);
    });

    it('calculates tan', () => {
      const z = new Complex(Math.PI / 4, 0);
      const result = z.tan();
      expect(result.real).toBeCloseTo(1, 10);
      expect(result.imag).toBeCloseTo(0, 10);
    });
  });

  describe('hyperbolic functions', () => {
    it('calculates sinh of zero', () => {
      const result = Complex.zero.sinh();
      expect(result.equals(Complex.zero, 1e-10)).toBe(true);
    });

    it('calculates cosh of zero', () => {
      const result = Complex.zero.cosh();
      expect(result.equals(Complex.one, 1e-10)).toBe(true);
    });

    it('verifies cosh²(z) - sinh²(z) = 1', () => {
      const z = new Complex(1, 2);
      const sinh = z.sinh();
      const cosh = z.cosh();
      const diff = cosh.multiply(cosh).subtract(sinh.multiply(sinh));
      expect(diff.equals(Complex.one, 1e-10)).toBe(true);
    });
  });

  describe('toString', () => {
    it('formats positive imaginary part', () => {
      const z = new Complex(3, 4);
      expect(z.toString()).toBe('3+4i');
    });

    it('formats negative imaginary part', () => {
      const z = new Complex(3, -4);
      expect(z.toString()).toBe('3-4i');
    });

    it('formats purely real', () => {
      const z = new Complex(5, 0);
      expect(z.toString()).toBe('5');
    });

    it('formats purely imaginary', () => {
      const z = new Complex(0, 3);
      expect(z.toString()).toBe('3i');
    });

    it('formats imaginary unit', () => {
      const z = new Complex(0, 1);
      expect(z.toString()).toBe('i');
    });

    it('formats negative imaginary unit', () => {
      const z = new Complex(0, -1);
      expect(z.toString()).toBe('-i');
    });

    it('formats in polar form', () => {
      const z = new Complex(3, 4);
      const str = z.toString('polar');
      expect(str).toContain('∠');
    });
  });

  describe('equals', () => {
    it('compares equal complex numbers', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(3, 4);
      expect(z1.equals(z2)).toBe(true);
    });

    it('compares unequal complex numbers', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(3, 5);
      expect(z1.equals(z2)).toBe(false);
    });

    it('uses tolerance for comparison', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(3.0000001, 4);
      expect(z1.equals(z2, 1e-5)).toBe(true);
    });
  });

  describe('predicates', () => {
    it('detects real numbers', () => {
      expect(new Complex(5, 0).isReal()).toBe(true);
      expect(new Complex(5, 1).isReal()).toBe(false);
    });

    it('detects imaginary numbers', () => {
      expect(new Complex(0, 5).isImaginary()).toBe(true);
      expect(new Complex(1, 5).isImaginary()).toBe(false);
    });

    it('detects zero', () => {
      expect(Complex.zero.isZero()).toBe(true);
      expect(new Complex(0, 0).isZero()).toBe(true);
      expect(new Complex(1, 0).isZero()).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('extracts real part', () => {
      const z = new Complex(3, 4);
      expect(Re(z)).toBe(3);
    });

    it('extracts imaginary part', () => {
      const z = new Complex(3, 4);
      expect(Im(z)).toBe(4);
    });

    it('calculates absolute value', () => {
      const z = new Complex(3, 4);
      expect(abs(z)).toBeCloseTo(5, 10);
    });

    it('calculates argument', () => {
      const z = new Complex(1, 1);
      expect(arg(z)).toBeCloseTo(Math.PI / 4, 10);
    });

    it('calculates conjugate', () => {
      const z = new Complex(3, 4);
      const c = conj(z);
      expect(c.real).toBe(3);
      expect(c.imag).toBe(-4);
    });
  });

  describe('immutability', () => {
    it('operations do not modify original', () => {
      const z1 = new Complex(3, 4);
      const z2 = new Complex(1, 2);

      z1.add(z2);
      expect(z1.real).toBe(3);
      expect(z1.imag).toBe(4);

      z1.multiply(z2);
      expect(z1.real).toBe(3);
      expect(z1.imag).toBe(4);

      z1.pow(2);
      expect(z1.real).toBe(3);
      expect(z1.imag).toBe(4);
    });
  });
});
