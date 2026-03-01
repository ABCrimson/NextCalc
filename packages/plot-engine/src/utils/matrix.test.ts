/**
 * Tests for matrix utilities
 * @module utils/matrix.test
 */

import { describe, expect, it } from 'vitest';
import { identity, multiply, ortho, rotationZ, scaling, translation } from './matrix';

describe('Matrix Utilities', () => {
  describe('identity', () => {
    it('should create an identity matrix', () => {
      const mat = identity();
      expect(mat[0]).toBe(1);
      expect(mat[5]).toBe(1);
      expect(mat[10]).toBe(1);
      expect(mat[15]).toBe(1);
      expect(mat[1]).toBe(0);
      expect(mat[4]).toBe(0);
    });
  });

  describe('multiply', () => {
    it('should multiply two matrices', () => {
      const a = identity();
      const b = translation(1, 2, 3);
      const result = multiply(a, b);

      expect(result[12]).toBe(1); // translation x
      expect(result[13]).toBe(2); // translation y
      expect(result[14]).toBe(3); // translation z
    });

    it('should be non-commutative', () => {
      const a = translation(1, 0, 0);
      const b = scaling(2, 2, 2);

      const ab = multiply(a, b);
      const ba = multiply(b, a);

      expect(ab).not.toEqual(ba);
    });
  });

  describe('translation', () => {
    it('should create a translation matrix', () => {
      const mat = translation(5, 10, 15);
      expect(mat[12]).toBe(5);
      expect(mat[13]).toBe(10);
      expect(mat[14]).toBe(15);
    });
  });

  describe('scaling', () => {
    it('should create a scaling matrix', () => {
      const mat = scaling(2, 3, 4);
      expect(mat[0]).toBe(2);
      expect(mat[5]).toBe(3);
      expect(mat[10]).toBe(4);
    });
  });

  describe('rotationZ', () => {
    it('should create a rotation matrix around Z', () => {
      const mat = rotationZ(Math.PI / 2); // 90 degrees
      expect(mat[0]).toBeCloseTo(0, 5);
      expect(mat[1]).toBeCloseTo(1, 5);
      expect(mat[4]).toBeCloseTo(-1, 5);
      expect(mat[5]).toBeCloseTo(0, 5);
    });
  });

  describe('ortho', () => {
    it('should create an orthographic projection matrix', () => {
      const mat = ortho(-1, 1, -1, 1, -1, 1);
      expect(mat[0]).toBe(1);
      expect(mat[5]).toBe(1);
      // Z scale is -1 for standard NDC coordinates (near-far gives negative divisor)
      expect(mat[10]).toBe(-1);
    });
  });
});
