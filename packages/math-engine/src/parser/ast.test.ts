/**
 * Unit tests for AST builders, type guards, and visitor pattern
 */

import { describe, expect, it } from 'vitest';
import {
  type ASTVisitor,
  type ConstantNode,
  createConstantNode,
  createFunctionNode,
  createOperatorNode,
  createSymbolNode,
  createUnaryOperatorNode,
  type FunctionNode,
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isSymbolNode,
  isUnaryOperatorNode,
  NodeType,
  type OperatorNode,
  type SymbolNode,
  type UnaryOperatorNode,
  visit,
} from './ast';

// ===========================================================================
// BUILDER FUNCTIONS
// ===========================================================================

describe('AST Builders', () => {
  describe('createConstantNode', () => {
    it('creates a numeric constant node', () => {
      const node = createConstantNode(42);
      expect(node.type).toBe(NodeType.ConstantNode);
      expect(node.value).toBe(42);
    });

    it('creates a zero constant node', () => {
      const node = createConstantNode(0);
      expect(node.value).toBe(0);
    });

    it('creates a negative constant node', () => {
      const node = createConstantNode(-3.14);
      expect(node.value).toBe(-3.14);
    });

    it('creates a bigint constant node', () => {
      const node = createConstantNode(BigInt(9007199254740993));
      expect(node.value).toBe(BigInt(9007199254740993));
    });

    it('creates a string constant node', () => {
      const node = createConstantNode('hello');
      expect(node.value).toBe('hello');
    });

    it('has correct brand', () => {
      const node = createConstantNode(1);
      expect(node._brand).toBe('ExpressionNode');
    });
  });

  describe('createSymbolNode', () => {
    it('creates a symbol node for x', () => {
      const node = createSymbolNode('x');
      expect(node.type).toBe(NodeType.SymbolNode);
      expect(node.name).toBe('x');
    });

    it('creates a symbol node for multi-character name', () => {
      const node = createSymbolNode('theta');
      expect(node.name).toBe('theta');
    });
  });

  describe('createOperatorNode', () => {
    it('creates addition node', () => {
      const left = createConstantNode(2);
      const right = createConstantNode(3);
      const node = createOperatorNode('+', 'add', [left, right]);
      expect(node.type).toBe(NodeType.OperatorNode);
      expect(node.op).toBe('+');
      expect(node.fn).toBe('add');
      expect(node.args).toHaveLength(2);
      expect(node.args[0]).toBe(left);
      expect(node.args[1]).toBe(right);
    });

    it('creates all operator types', () => {
      const a = createConstantNode(1);
      const b = createConstantNode(2);
      for (const op of ['+', '-', '*', '/', '^', '%'] as const) {
        const node = createOperatorNode(op, op, [a, b]);
        expect(node.op).toBe(op);
      }
    });
  });

  describe('createUnaryOperatorNode', () => {
    it('creates unary minus node', () => {
      const arg = createSymbolNode('x');
      const node = createUnaryOperatorNode('-', 'unaryMinus', [arg]);
      expect(node.type).toBe(NodeType.UnaryOperatorNode);
      expect(node.op).toBe('-');
      expect(node.args).toHaveLength(1);
      expect(node.args[0]).toBe(arg);
    });

    it('creates unary plus node', () => {
      const arg = createConstantNode(5);
      const node = createUnaryOperatorNode('+', 'unaryPlus', [arg]);
      expect(node.op).toBe('+');
    });
  });

  describe('createFunctionNode', () => {
    it('creates sin function node', () => {
      const arg = createSymbolNode('x');
      const node = createFunctionNode('sin', [arg]);
      expect(node.type).toBe(NodeType.FunctionNode);
      expect(node.fn).toBe('sin');
      expect(node.args).toHaveLength(1);
    });

    it('creates function node with constant argument', () => {
      const arg = createConstantNode(0);
      const node = createFunctionNode('exp', [arg]);
      expect(node.fn).toBe('exp');
    });
  });
});

// ===========================================================================
// TYPE GUARDS
// ===========================================================================

describe('AST Type Guards', () => {
  const constNode = createConstantNode(42);
  const symNode = createSymbolNode('x');
  const opNode = createOperatorNode('+', 'add', [constNode, symNode]);
  const unaryNode = createUnaryOperatorNode('-', 'unaryMinus', [symNode]);
  const fnNode = createFunctionNode('sin', [symNode]);

  describe('isConstantNode', () => {
    it('returns true for constant node', () => {
      expect(isConstantNode(constNode)).toBe(true);
    });

    it('returns false for other node types', () => {
      expect(isConstantNode(symNode)).toBe(false);
      expect(isConstantNode(opNode)).toBe(false);
      expect(isConstantNode(unaryNode)).toBe(false);
      expect(isConstantNode(fnNode)).toBe(false);
    });
  });

  describe('isSymbolNode', () => {
    it('returns true for symbol node', () => {
      expect(isSymbolNode(symNode)).toBe(true);
    });

    it('returns false for other node types', () => {
      expect(isSymbolNode(constNode)).toBe(false);
      expect(isSymbolNode(opNode)).toBe(false);
    });
  });

  describe('isOperatorNode', () => {
    it('returns true for operator node', () => {
      expect(isOperatorNode(opNode)).toBe(true);
    });

    it('returns false for unary operator node', () => {
      expect(isOperatorNode(unaryNode)).toBe(false);
    });

    it('returns false for other node types', () => {
      expect(isOperatorNode(constNode)).toBe(false);
      expect(isOperatorNode(fnNode)).toBe(false);
    });
  });

  describe('isUnaryOperatorNode', () => {
    it('returns true for unary operator node', () => {
      expect(isUnaryOperatorNode(unaryNode)).toBe(true);
    });

    it('returns false for binary operator node', () => {
      expect(isUnaryOperatorNode(opNode)).toBe(false);
    });
  });

  describe('isFunctionNode', () => {
    it('returns true for function node', () => {
      expect(isFunctionNode(fnNode)).toBe(true);
    });

    it('returns false for other node types', () => {
      expect(isFunctionNode(constNode)).toBe(false);
      expect(isFunctionNode(opNode)).toBe(false);
    });
  });
});

// ===========================================================================
// VISITOR PATTERN
// ===========================================================================

describe('AST Visitor Pattern', () => {
  it('visits constant node', () => {
    const node = createConstantNode(42);
    const visitor: ASTVisitor<string> = {
      visitConstant: (n: ConstantNode) => `const(${n.value})`,
      visitSymbol: (n: SymbolNode) => `sym(${n.name})`,
      visitOperator: (n: OperatorNode) => `op(${n.op})`,
      visitUnaryOperator: (n: UnaryOperatorNode) => `unary(${n.op})`,
      visitFunction: (n: FunctionNode) => `fn(${n.fn})`,
    };

    expect(visit(node, visitor)).toBe('const(42)');
  });

  it('visits symbol node', () => {
    const node = createSymbolNode('x');
    const visitor: ASTVisitor<string> = {
      visitConstant: () => '',
      visitSymbol: (n: SymbolNode) => n.name,
      visitOperator: () => '',
      visitUnaryOperator: () => '',
      visitFunction: () => '',
    };

    expect(visit(node, visitor)).toBe('x');
  });

  it('visits operator node', () => {
    const node = createOperatorNode('+', 'add', [createConstantNode(1), createConstantNode(2)]);

    const visitor: ASTVisitor<number> = {
      visitConstant: (n: ConstantNode) => Number(n.value),
      visitSymbol: () => 0,
      visitOperator: (n: OperatorNode) => {
        const l = visit(n.args[0], visitor);
        const r = visit(n.args[1], visitor);
        return l + r;
      },
      visitUnaryOperator: () => 0,
      visitFunction: () => 0,
    };

    expect(visit(node, visitor)).toBe(3);
  });

  it('visits recursive tree structure', () => {
    // Build: (2 + 3) * 4
    const sum = createOperatorNode('+', 'add', [createConstantNode(2), createConstantNode(3)]);
    const product = createOperatorNode('*', 'multiply', [sum, createConstantNode(4)]);

    const evaluator: ASTVisitor<number> = {
      visitConstant: (n: ConstantNode) => Number(n.value),
      visitSymbol: () => 0,
      visitOperator: (n: OperatorNode) => {
        const l = visit(n.args[0], evaluator);
        const r = visit(n.args[1], evaluator);
        switch (n.op) {
          case '+':
            return l + r;
          case '*':
            return l * r;
          default:
            return 0;
        }
      },
      visitUnaryOperator: (n: UnaryOperatorNode) => {
        const val = visit(n.args[0], evaluator);
        return n.op === '-' ? -val : val;
      },
      visitFunction: () => 0,
    };

    expect(visit(product, evaluator)).toBe(20);
  });

  it('visits unary operator node', () => {
    const node = createUnaryOperatorNode('-', 'unaryMinus', [createConstantNode(7)]);

    const evaluator: ASTVisitor<number> = {
      visitConstant: (n: ConstantNode) => Number(n.value),
      visitSymbol: () => 0,
      visitOperator: () => 0,
      visitUnaryOperator: (n: UnaryOperatorNode) => -visit(n.args[0], evaluator),
      visitFunction: () => 0,
    };

    expect(visit(node, evaluator)).toBe(-7);
  });

  it('visits function node', () => {
    const node = createFunctionNode('sqrt', [createConstantNode(9)]);

    const evaluator: ASTVisitor<number> = {
      visitConstant: (n: ConstantNode) => Number(n.value),
      visitSymbol: () => 0,
      visitOperator: () => 0,
      visitUnaryOperator: () => 0,
      visitFunction: (n: FunctionNode) => {
        const arg = visit(n.args[0]!, evaluator);
        if (n.fn === 'sqrt') return Math.sqrt(arg);
        return 0;
      },
    };

    expect(visit(node, evaluator)).toBe(3);
  });
});

// ===========================================================================
// AST TREE CONSTRUCTION
// ===========================================================================

describe('AST Tree Construction', () => {
  it('builds and traverses: sin(x^2 + 1)', () => {
    const xSquared = createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]);
    const xSquaredPlusOne = createOperatorNode('+', 'add', [xSquared, createConstantNode(1)]);
    const sinExpr = createFunctionNode('sin', [xSquaredPlusOne]);

    expect(isFunctionNode(sinExpr)).toBe(true);
    expect(sinExpr.fn).toBe('sin');

    const innerAdd = sinExpr.args[0]!;
    expect(isOperatorNode(innerAdd)).toBe(true);
    if (isOperatorNode(innerAdd)) {
      expect(innerAdd.op).toBe('+');
      const innerPow = innerAdd.args[0];
      expect(isOperatorNode(innerPow)).toBe(true);
      if (isOperatorNode(innerPow)) {
        expect(innerPow.op).toBe('^');
      }
    }
  });

  it('builds and verifies: -(2 * x)', () => {
    const twoTimesX = createOperatorNode('*', 'multiply', [
      createConstantNode(2),
      createSymbolNode('x'),
    ]);
    const negated = createUnaryOperatorNode('-', 'unaryMinus', [twoTimesX]);

    expect(isUnaryOperatorNode(negated)).toBe(true);
    expect(negated.op).toBe('-');

    const inner = negated.args[0];
    expect(isOperatorNode(inner)).toBe(true);
  });
});
