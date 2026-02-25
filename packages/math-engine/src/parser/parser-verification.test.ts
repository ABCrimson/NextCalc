/**
 * Verification tests for the fixed parser - Part 1 of 3
 * Tests all expressions mentioned in the requirements
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import { evaluate } from './evaluator';
import { NodeType, type OperatorNode, type FunctionNode, type UnaryOperatorNode } from './ast';

describe('Parser Verification - All Required Expressions', () => {
  describe('Critical failing expressions (now fixed)', () => {
    it('should parse exp(-x^2)', () => {
      const ast = parse('exp(-x^2)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('exp');

      // Verify it evaluates correctly
      const result = evaluate('exp(-x^2)', { variables: { x: 0 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1); // exp(-0^2) = exp(0) = 1
      }
    });

    it('should parse sin(x)*cos(x)*exp(-x/10)', () => {
      const ast = parse('sin(x)*cos(x)*exp(-x/10)');
      expect(ast.type).toBe(NodeType.OperatorNode);
      expect((ast as OperatorNode).op).toBe('*');

      // Verify it evaluates correctly
      const result = evaluate('sin(x)*cos(x)*exp(-x/10)', { variables: { x: 0 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(0); // sin(0)*cos(0)*exp(0) = 0*1*1 = 0
      }
    });

    it('should handle unary minus: -x', () => {
      const ast = parse('-x');
      expect(ast.type).toBe(NodeType.UnaryOperatorNode);
      expect((ast as UnaryOperatorNode).op).toBe('-');

      // Verify it evaluates correctly
      const result = evaluate('-x', { variables: { x: 5 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(-5);
      }
    });

    it('should parse 1/x^2', () => {
      const ast = parse('1/x^2');
      expect(ast.type).toBe(NodeType.OperatorNode);
      expect((ast as OperatorNode).op).toBe('/');

      // Verify it evaluates correctly
      const result = evaluate('1/x^2', { variables: { x: 2 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(0.25); // 1/4
      }
    });
  });

  describe('Mathematical functions support', () => {
    it('should parse and evaluate exp(x)', () => {
      const ast = parse('exp(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('exp');

      const result = evaluate('exp(x)', { variables: { x: 1 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(Math.E);
      }
    });

    it('should parse and evaluate sin(x)', () => {
      const ast = parse('sin(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('sin');

      const result = evaluate('sin(x)', { variables: { x: Math.PI / 2 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1);
      }
    });

    it('should parse and evaluate cos(x)', () => {
      const ast = parse('cos(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('cos');

      const result = evaluate('cos(x)', { variables: { x: 0 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1);
      }
    });

    it('should parse and evaluate tan(x)', () => {
      const ast = parse('tan(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('tan');
    });

    it('should parse and evaluate log(x)', () => {
      const ast = parse('log(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('log');

      const result = evaluate('log(x)', { variables: { x: Math.E } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1);
      }
    });

    it('should parse and evaluate ln(x)', () => {
      const ast = parse('ln(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('ln');

      const result = evaluate('ln(x)', { variables: { x: Math.E } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1);
      }
    });

    it('should parse and evaluate abs(x)', () => {
      const ast = parse('abs(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('abs');

      const result = evaluate('abs(x)', { variables: { x: -5 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(5);
      }
    });

    it('should parse and evaluate sqrt(x)', () => {
      const ast = parse('sqrt(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('sqrt');

      const result = evaluate('sqrt(x)', { variables: { x: 16 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(4);
      }
    });
  });

  describe('Complex unary minus scenarios', () => {
    it('should handle -5', () => {
      const ast = parse('-5');
      expect(ast.type).toBe(NodeType.UnaryOperatorNode);

      const result = evaluate('-5', {});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(-5);
      }
    });

    it('should handle 1 + -x', () => {
      const ast = parse('1 + -x');
      expect(ast.type).toBe(NodeType.OperatorNode);

      const result = evaluate('1 + -x', { variables: { x: 3 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(-2); // 1 + (-3) = -2
      }
    });

    it('should handle -x^2', () => {
      const ast = parse('-x^2');
      expect(ast.type).toBe(NodeType.UnaryOperatorNode);

      const result = evaluate('-x^2', { variables: { x: 3 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(-9); // -(3^2) = -9
      }
    });

    it('should handle exp(-x^2 + 1)', () => {
      const ast = parse('exp(-x^2 + 1)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('exp');

      const result = evaluate('exp(-x^2 + 1)', { variables: { x: 0 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(Math.E); // exp(-0 + 1) = exp(1) = e
      }
    });

    it('should handle multiple unary minus: --x', () => {
      const ast = parse('--x');
      expect(ast.type).toBe(NodeType.UnaryOperatorNode);

      const result = evaluate('--x', { variables: { x: 5 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(5); // -(-5) = 5
      }
    });
  });

  describe('Edge cases and complex expressions', () => {
    it('should handle nested functions with unary minus', () => {
      const ast = parse('sin(-x)');
      expect(ast.type).toBe(NodeType.FunctionNode);

      const result = evaluate('sin(-x)', { variables: { x: Math.PI / 2 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(-1);
      }
    });

    it('should handle multiple trig functions', () => {
      const ast = parse('sin(x) + cos(x) + tan(x)');
      expect(ast.type).toBe(NodeType.OperatorNode);

      const result = evaluate('sin(x) + cos(x) + tan(x)', { variables: { x: 0 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1); // 0 + 1 + 0 = 1
      }
    });

    it('should handle exp in denominators', () => {
      const ast = parse('1/exp(x)');
      expect(ast.type).toBe(NodeType.OperatorNode);

      const result = evaluate('1/exp(x)', { variables: { x: 0 } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeCloseTo(1); // 1/exp(0) = 1/1 = 1
      }
    });

    it('should handle complex nested expressions', () => {
      const ast = parse('exp(-x^2 / 2) * sqrt(2 * pi)');
      expect(ast).toBeDefined();

      const result = evaluate('exp(-x^2 / 2) * sqrt(2 * pi)', { variables: { x: 0, pi: Math.PI } });
      expect(result.success).toBe(true);
      if (result.success) {
        // Gaussian at x=0: exp(0) * sqrt(2π) = sqrt(2π)
        expect(result.value).toBeCloseTo(Math.sqrt(2 * Math.PI));
      }
    });
  });
});
