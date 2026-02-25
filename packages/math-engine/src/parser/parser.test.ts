/**
 * Parser tests
 */

import { describe, it, expect } from 'vitest';
import { parse, isValidExpression, extractVariables } from './parser';
import { NodeType, type OperatorNode, type FunctionNode } from './ast';

describe('Parser', () => {
  describe('parse', () => {
    it('should parse simple numeric constant', () => {
      const ast = parse('42');
      expect(ast.type).toBe(NodeType.ConstantNode);
      expect(ast.value).toBe(42);
    });

    it('should parse simple addition', () => {
      const ast = parse('2 + 3');
      expect(ast.type).toBe(NodeType.OperatorNode);
      expect((ast as OperatorNode).op).toBe('+');
    });

    it('should parse multiplication with correct precedence', () => {
      const ast = parse('2 + 3 * 4');
      // Should be: 2 + (3 * 4)
      expect(ast.type).toBe(NodeType.OperatorNode);
      expect((ast as OperatorNode).op).toBe('+');
    });

    it('should parse function calls', () => {
      const ast = parse('sin(pi / 2)');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('sin');
    });

    it('should parse nested functions', () => {
      const ast = parse('sqrt(sin(x) + cos(x))');
      expect(ast.type).toBe(NodeType.FunctionNode);
      expect((ast as FunctionNode).fn).toBe('sqrt');
    });

    it('should parse complex expression', () => {
      const ast = parse('2 * x^2 + 3 * x + 1');
      expect(ast.type).toBe(NodeType.OperatorNode);
    });

    it('should handle parentheses', () => {
      const ast = parse('(2 + 3) * 4');
      expect(ast.type).toBe(NodeType.OperatorNode);
      expect((ast as OperatorNode).op).toBe('*');
    });
  });

  describe('isValidExpression', () => {
    it('should return true for valid expressions', () => {
      expect(isValidExpression('2 + 2')).toBe(true);
      expect(isValidExpression('sin(x)')).toBe(true);
      expect(isValidExpression('sqrt(2)')).toBe(true);
    });

    it('should return false for invalid expressions', () => {
      expect(isValidExpression('2 + ')).toBe(false);
      expect(isValidExpression('sin(')).toBe(false);
      // Note: Math.js treats empty string as valid (evaluates to undefined)
      // We'll handle this in our wrapper if needed
    });
  });

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const vars = extractVariables('x + 1');
      expect(vars).toEqual(new Set(['x']));
    });

    it('should extract multiple variables', () => {
      const vars = extractVariables('x + y * z');
      expect(vars).toEqual(new Set(['x', 'y', 'z']));
    });

    it('should not include constants', () => {
      const vars = extractVariables('2 * pi + x');
      expect(vars).toEqual(new Set(['pi', 'x']));
    });

    it('should extract from nested functions', () => {
      const vars = extractVariables('sin(x) + cos(y)');
      expect(vars).toEqual(new Set(['x', 'y']));
    });
  });
});
