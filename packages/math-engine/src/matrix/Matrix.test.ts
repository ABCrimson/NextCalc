/**
 * Tests for Matrix class
 */

import { describe, expect, it } from 'vitest';
import { det, inv, Matrix, matrix, transpose } from './Matrix';

describe('Matrix', () => {
  describe('constructor', () => {
    it('creates matrix from 2D array', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      expect(m.rows).toBe(2);
      expect(m.cols).toBe(2);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(4);
    });

    it('creates zero matrix from dimensions', () => {
      const m = new Matrix(3, 4);
      expect(m.rows).toBe(3);
      expect(m.cols).toBe(4);
      expect(m.get(0, 0)).toBe(0);
      expect(m.get(2, 3)).toBe(0);
    });

    it('throws on empty matrix', () => {
      expect(() => new Matrix([])).toThrow('Matrix cannot be empty');
    });

    it('throws on ragged array', () => {
      expect(() => new Matrix([[1, 2], [3]])).toThrow('All rows must have the same length');
    });
  });

  describe('get and set', () => {
    it('gets values correctly', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(0, 1)).toBe(2);
      expect(m.get(1, 0)).toBe(3);
      expect(m.get(1, 1)).toBe(4);
    });

    it('sets values immutably', () => {
      const m1 = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const m2 = m1.set(0, 0, 10);

      expect(m1.get(0, 0)).toBe(1); // Original unchanged
      expect(m2.get(0, 0)).toBe(10); // New matrix changed
    });

    it('throws on out of bounds access', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      expect(() => m.get(5, 0)).toThrow('Index out of bounds');
      expect(() => m.set(0, 5, 1)).toThrow('Index out of bounds');
    });
  });

  describe('add', () => {
    it('adds matrices of same dimensions', () => {
      const a = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const b = new Matrix([
        [5, 6],
        [7, 8],
      ]);
      const c = a.add(b);

      expect(c.get(0, 0)).toBe(6);
      expect(c.get(0, 1)).toBe(8);
      expect(c.get(1, 0)).toBe(10);
      expect(c.get(1, 1)).toBe(12);
    });

    it('throws on dimension mismatch', () => {
      const a = new Matrix([[1, 2]]);
      const b = new Matrix([[1], [2]]);
      expect(() => a.add(b)).toThrow('Cannot add matrices with different dimensions');
    });
  });

  describe('subtract', () => {
    it('subtracts matrices', () => {
      const a = new Matrix([
        [5, 6],
        [7, 8],
      ]);
      const b = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const c = a.subtract(b);

      expect(c.get(0, 0)).toBe(4);
      expect(c.get(1, 1)).toBe(4);
    });
  });

  describe('scale', () => {
    it('scales matrix by scalar', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const scaled = m.scale(2);

      expect(scaled.get(0, 0)).toBe(2);
      expect(scaled.get(1, 1)).toBe(8);
    });
  });

  describe('multiply', () => {
    it('multiplies matrices correctly', () => {
      const a = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const b = new Matrix([
        [5, 6],
        [7, 8],
      ]);
      const c = a.multiply(b);

      // [1 2] [5 6]   [1*5+2*7  1*6+2*8]   [19 22]
      // [3 4] [7 8] = [3*5+4*7  3*6+4*8] = [43 50]
      expect(c.get(0, 0)).toBe(19);
      expect(c.get(0, 1)).toBe(22);
      expect(c.get(1, 0)).toBe(43);
      expect(c.get(1, 1)).toBe(50);
    });

    it('multiplies non-square matrices', () => {
      const a = new Matrix([[1, 2, 3]]); // 1x3
      const b = new Matrix([[4], [5], [6]]); // 3x1
      const c = a.multiply(b); // 1x1

      expect(c.rows).toBe(1);
      expect(c.cols).toBe(1);
      expect(c.get(0, 0)).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('throws on incompatible dimensions', () => {
      const a = new Matrix([[1, 2]]);
      const b = new Matrix([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
      expect(() => a.multiply(b)).toThrow('Cannot multiply');
    });
  });

  describe('transpose', () => {
    it('transposes square matrix', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const t = m.transpose();

      expect(t.get(0, 0)).toBe(1);
      expect(t.get(0, 1)).toBe(3);
      expect(t.get(1, 0)).toBe(2);
      expect(t.get(1, 1)).toBe(4);
    });

    it('transposes rectangular matrix', () => {
      const m = new Matrix([
        [1, 2, 3],
        [4, 5, 6],
      ]); // 2x3
      const t = m.transpose(); // 3x2

      expect(t.rows).toBe(3);
      expect(t.cols).toBe(2);
      expect(t.get(0, 0)).toBe(1);
      expect(t.get(2, 1)).toBe(6);
    });
  });

  describe('determinant', () => {
    it('calculates determinant of 1x1 matrix', () => {
      const m = new Matrix([[5]]);
      expect(m.determinant()).toBe(5);
    });

    it('calculates determinant of 2x2 matrix', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      expect(m.determinant()).toBe(-2); // 1*4 - 2*3
    });

    it('calculates determinant of 3x3 matrix', () => {
      const m = new Matrix([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);
      expect(m.determinant()).toBeCloseTo(0, 5); // Singular matrix
    });

    it('calculates determinant of identity matrix', () => {
      const m = Matrix.identity(4);
      expect(m.determinant()).toBeCloseTo(1, 10);
    });

    it('throws for non-square matrix', () => {
      const m = new Matrix([[1, 2, 3]]);
      expect(() => m.determinant()).toThrow('Determinant only defined for square matrices');
    });
  });

  describe('inverse', () => {
    it('calculates inverse of 2x2 matrix', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const mInv = m.inverse();
      const identity = m.multiply(mInv);

      // Should be identity matrix (with rounding)
      expect(identity.get(0, 0)).toBeCloseTo(1, 10);
      expect(identity.get(1, 1)).toBeCloseTo(1, 10);
      expect(identity.get(0, 1)).toBeCloseTo(0, 10);
      expect(identity.get(1, 0)).toBeCloseTo(0, 10);
    });

    it('calculates inverse of 3x3 matrix', () => {
      const m = new Matrix([
        [2, -1, 0],
        [-1, 2, -1],
        [0, -1, 2],
      ]);
      const mInv = m.inverse();
      const identity = m.multiply(mInv);

      expect(identity.get(0, 0)).toBeCloseTo(1, 8);
      expect(identity.get(1, 1)).toBeCloseTo(1, 8);
      expect(identity.get(2, 2)).toBeCloseTo(1, 8);
    });

    it('throws for singular matrix', () => {
      const m = new Matrix([
        [1, 2],
        [2, 4],
      ]); // Determinant = 0
      expect(() => m.inverse()).toThrow('Matrix is singular');
    });

    it('throws for non-square matrix', () => {
      const m = new Matrix([[1, 2, 3]]);
      expect(() => m.inverse()).toThrow('Inverse only defined for square matrices');
    });
  });

  describe('static factory methods', () => {
    it('creates identity matrix', () => {
      const I = Matrix.identity(3);
      expect(I.get(0, 0)).toBe(1);
      expect(I.get(1, 1)).toBe(1);
      expect(I.get(2, 2)).toBe(1);
      expect(I.get(0, 1)).toBe(0);
    });

    it('creates zero matrix', () => {
      const Z = Matrix.zeros(2, 3);
      expect(Z.rows).toBe(2);
      expect(Z.cols).toBe(3);
      expect(Z.get(0, 0)).toBe(0);
      expect(Z.get(1, 2)).toBe(0);
    });

    it('creates ones matrix', () => {
      const O = Matrix.ones(2, 2);
      expect(O.get(0, 0)).toBe(1);
      expect(O.get(1, 1)).toBe(1);
    });

    it('creates random matrix', () => {
      const R = Matrix.random(3, 3, 0, 1);
      expect(R.rows).toBe(3);
      expect(R.cols).toBe(3);

      // Check all values are in range [0, 1]
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const val = R.get(i, j);
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('convenience functions', () => {
    it('matrix() creates Matrix', () => {
      const m = matrix([
        [1, 2],
        [3, 4],
      ]);
      expect(m).toBeInstanceOf(Matrix);
      expect(m.rows).toBe(2);
    });

    it('det() calculates determinant', () => {
      const m = matrix([
        [1, 2],
        [3, 4],
      ]);
      expect(det(m)).toBe(-2);
    });

    it('inv() calculates inverse', () => {
      const m = matrix([
        [1, 2],
        [3, 4],
      ]);
      const mInv = inv(m);
      expect(mInv).toBeInstanceOf(Matrix);
    });

    it('transpose() transposes matrix', () => {
      const m = matrix([
        [1, 2],
        [3, 4],
      ]);
      const t = transpose(m);
      expect(t.get(0, 1)).toBe(3);
    });
  });

  describe('utility methods', () => {
    it('toArray() returns 2D array', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const arr = m.toArray();
      expect(arr).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it('equals() compares matrices', () => {
      const m1 = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const m2 = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const m3 = new Matrix([
        [1, 2],
        [3, 5],
      ]);

      expect(m1.equals(m2)).toBe(true);
      expect(m1.equals(m3)).toBe(false);
    });

    it('toLatex() generates LaTeX string', () => {
      const m = new Matrix([
        [1, 2],
        [3, 4],
      ]);
      const latex = m.toLatex();
      expect(latex).toContain('\\begin{bmatrix}');
      expect(latex).toContain('\\end{bmatrix}');
    });
  });
});
