/**
 * Critical parser tests for missing functionality
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import { NodeType, type OperatorNode, type FunctionNode } from './ast';

describe('Parser - Critical Missing Features', () => {
  describe('exp() function', () => {
    it('should parse exp(x)', () => {
      const ast = parse('exp(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('exp');
    });

    it('should parse exp(-x^2)', () => {
      const ast = parse('exp(-x^2)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('exp');
    });

    it('should parse sin(x)*cos(x)*exp(-x/10)', () => {
      const ast = parse('sin(x)*cos(x)*exp(-x/10)');
      expect(ast.type).toBe(NodeType.OperatorNode);
      // The root should be a multiplication operator
      expect((ast as OperatorNode).op).toBe('*');
    });
  });

  describe('unary minus operator', () => {
    it('should parse -x', () => {
      const ast = parse('-x');
      // Math.js represents -x as unary minus
      expect(ast).toBeDefined();
    });

    it('should parse -5', () => {
      const ast = parse('-5');
      expect(ast).toBeDefined();
    });

    it('should parse 1 + -x', () => {
      const ast = parse('1 + -x');
      expect(ast).toBeDefined();
    });
  });

  describe('other mathematical functions', () => {
    it('should parse log(x)', () => {
      const ast = parse('log(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('log');
    });

    it('should parse ln(x)', () => {
      const ast = parse('ln(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('ln');
    });

    it('should parse abs(x)', () => {
      const ast = parse('abs(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('abs');
    });

    it('should parse sqrt(x)', () => {
      const ast = parse('sqrt(x)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('sqrt');
    });
  });

  describe('complex expressions', () => {
    it('should parse 1/x^2', () => {
      const ast = parse('1/x^2');
      expect(ast.type).toBe(NodeType.OperatorNode);
      expect((ast as OperatorNode).op).toBe('/');
    });

    it('should parse -x^2', () => {
      const ast = parse('-x^2');
      expect(ast).toBeDefined();
    });

    it('should parse exp(-x^2 + 1)', () => {
      const ast = parse('exp(-x^2 + 1)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('exp');
    });
  });
});
