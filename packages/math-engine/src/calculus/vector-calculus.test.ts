/**
 * Vector Calculus Tests
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import {
  gradient,
  divergence,
  curl,
  laplacian,
  directionalDerivative,
  lineIntegral,
  isConservativeField,
  dotProduct,
  crossProduct,
  magnitude,
  normalize,
  type Vector3D,
} from './vector-calculus';

describe('Vector Calculus', () => {
  describe('gradient', () => {
    it('should compute gradient of f = x² + y² + z²', () => {
      const expr = parse('x^2 + y^2 + z^2');
      const point: Vector3D = { x: 1, y: 2, z: 3 };
      const grad = gradient(expr, point);

      // ∇f = (2x, 2y, 2z) at (1,2,3) = (2, 4, 6)
      expect(grad.x).toBeCloseTo(2, 5);
      expect(grad.y).toBeCloseTo(4, 5);
      expect(grad.z).toBeCloseTo(6, 5);
    });

    it('should compute gradient at origin', () => {
      const expr = parse('x*y + y*z + z*x');
      const point: Vector3D = { x: 0, y: 0, z: 0 };
      const grad = gradient(expr, point);

      // At origin, all partials are 0
      expect(grad.x).toBeCloseTo(0, 5);
      expect(grad.y).toBeCloseTo(0, 5);
      expect(grad.z).toBeCloseTo(0, 5);
    });
  });

  describe('divergence', () => {
    it('should compute divergence of F = (x, y, z)', () => {
      const field = [parse('x'), parse('y'), parse('z')] as const;
      const point: Vector3D = { x: 1, y: 2, z: 3 };
      const div = divergence(field, point);

      // ∂x/∂x + ∂y/∂y + ∂z/∂z = 1 + 1 + 1 = 3
      expect(div).toBeCloseTo(3, 5);
    });

    it('should compute zero divergence for rotation field', () => {
      const field = [parse('-y'), parse('x'), parse('0')] as const;
      const point: Vector3D = { x: 1, y: 1, z: 0 };
      const div = divergence(field, point);

      // Rotation field has zero divergence
      expect(div).toBeCloseTo(0, 5);
    });
  });

  describe('curl', () => {
    it('should compute curl of rotation field F = (-y, x, 0)', () => {
      const field = [parse('-y'), parse('x'), parse('0')] as const;
      const point: Vector3D = { x: 1, y: 1, z: 0 };
      const curlF = curl(field, point);

      // Curl should be (0, 0, 2) - rotation about z-axis
      expect(curlF.x).toBeCloseTo(0, 5);
      expect(curlF.y).toBeCloseTo(0, 5);
      expect(curlF.z).toBeCloseTo(2, 5);
    });

    it('should compute zero curl for gradient field', () => {
      // F = ∇(x² + y²) = (2x, 2y, 0)
      const field = [parse('2*x'), parse('2*y'), parse('0')] as const;
      const point: Vector3D = { x: 1, y: 1, z: 0 };
      const curlF = curl(field, point);

      // Gradient fields have zero curl
      expect(curlF.x).toBeCloseTo(0, 3);
      expect(curlF.y).toBeCloseTo(0, 3);
      expect(curlF.z).toBeCloseTo(0, 3);
    });
  });

  describe('laplacian', () => {
    it('should compute Laplacian of f = x² + y² + z²', () => {
      const expr = parse('x^2 + y^2 + z^2');
      const point: Vector3D = { x: 1, y: 2, z: 3 };
      const lap = laplacian(expr, point);

      // ∂²f/∂x² + ∂²f/∂y² + ∂²f/∂z² = 2 + 2 + 2 = 6
      expect(lap).toBeCloseTo(6, 3);
    });
  });

  describe('directionalDerivative', () => {
    it('should compute directional derivative in direction (1, 0, 0)', () => {
      const expr = parse('x^2 + y^2');
      const point: Vector3D = { x: 1, y: 0, z: 0 };
      const direction: Vector3D = { x: 1, y: 0, z: 0 };
      const Duf = directionalDerivative(expr, point, direction);

      // ∇f = (2x, 2y, 0) at (1,0,0) = (2, 0, 0)
      // D_u f = (2, 0, 0) · (1, 0, 0) = 2
      expect(Duf).toBeCloseTo(2, 5);
    });

    it('should normalize direction vector automatically', () => {
      const expr = parse('x + y');
      const point: Vector3D = { x: 0, y: 0, z: 0 };
      const direction: Vector3D = { x: 2, y: 2, z: 0 }; // Not unit vector

      const Duf = directionalDerivative(expr, point, direction);

      // ∇f = (1, 1, 0), normalized direction = (1/√2, 1/√2, 0)
      // D_u f = 1 * 1/√2 + 1 * 1/√2 = √2
      expect(Duf).toBeCloseTo(Math.SQRT2, 3);
    });
  });

  describe('lineIntegral', () => {
    it('should compute line integral along straight line', () => {
      // F = (1, 0, 0), curve from (0,0,0) to (1,0,0)
      const field = [parse('1'), parse('0'), parse('0')] as const;
      const curve = [parse('t'), parse('0'), parse('0')] as const;

      const result = lineIntegral(field, curve, { tRange: [0, 1] });

      // ∫ F · dr = ∫₀¹ (1, 0, 0) · (1, 0, 0) dt = 1
      expect(result).toBeCloseTo(1, 2);
    });
  });

  describe('isConservativeField', () => {
    it('should identify gradient field as conservative', () => {
      // F = (2x, 2y, 0) = ∇(x² + y²)
      const field = [parse('2*x'), parse('2*y'), parse('0')] as const;

      const result = isConservativeField(field);
      expect(result).toBe(true);
    });

    it('should identify rotation field as non-conservative', () => {
      // F = (-y, x, 0) has non-zero curl
      const field = [parse('-y'), parse('x'), parse('0')] as const;

      const result = isConservativeField(field);
      expect(result).toBe(false);
    });
  });

  describe('Vector Utilities', () => {
    it('should compute dot product', () => {
      const a: Vector3D = { x: 1, y: 2, z: 3 };
      const b: Vector3D = { x: 4, y: 5, z: 6 };

      const result = dotProduct(a, b);
      // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(result).toBe(32);
    });

    it('should compute cross product', () => {
      const a: Vector3D = { x: 1, y: 0, z: 0 };
      const b: Vector3D = { x: 0, y: 1, z: 0 };

      const result = crossProduct(a, b);
      // i × j = k
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(1);
    });

    it('should compute vector magnitude', () => {
      const v: Vector3D = { x: 3, y: 4, z: 0 };

      const result = magnitude(v);
      // √(9 + 16) = 5
      expect(result).toBe(5);
    });

    it('should normalize vector', () => {
      const v: Vector3D = { x: 3, y: 4, z: 0 };

      const result = normalize(v);
      expect(result.x).toBeCloseTo(0.6, 5);
      expect(result.y).toBeCloseTo(0.8, 5);
      expect(result.z).toBe(0);

      // Check that result is unit vector
      expect(magnitude(result)).toBeCloseTo(1, 10);
    });
  });
});
