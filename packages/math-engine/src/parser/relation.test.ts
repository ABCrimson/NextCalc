/**
 * Tests for relational expression parsing and compiled scalar fields
 */

import { describe, expect, it } from 'vitest';
import { isRelationalNode, NodeType, type RelationalOperator } from './ast';
import { evaluate } from './evaluator';
import {
  extractVariables,
  isRelationalExpression,
  normalizeRelationSyntax,
  ParseError,
  parseRelationSystem,
} from './parser';
import {
  compileRelationField,
  explicitSideOf,
  isExplicitYRelation,
  isStrictRelation,
  relationDirection,
} from './relation';

describe('normalizeRelationSyntax', () => {
  it('rewrites unicode comparison operators', () => {
    expect(normalizeRelationSyntax('x ≤ 2')).toBe('x <= 2');
    expect(normalizeRelationSyntax('x ≥ 2')).toBe('x >= 2');
  });

  it('rewrites a lone = to ==', () => {
    expect(normalizeRelationSyntax('y = x^2')).toBe('y == x^2');
    expect(normalizeRelationSyntax('e=mc^2')).toBe('e==mc^2');
  });

  it('does not touch <=, >=, ==, !=', () => {
    expect(normalizeRelationSyntax('x <= 2')).toBe('x <= 2');
    expect(normalizeRelationSyntax('x >= 2')).toBe('x >= 2');
    expect(normalizeRelationSyntax('x == 2')).toBe('x == 2');
    expect(normalizeRelationSyntax('x != 2')).toBe('x != 2');
  });
});

describe('isRelationalExpression', () => {
  it.each([
    'x^2+y^2=25',
    'y<2*x+1',
    'x>=1',
    '1<x<2',
    'x ≤ y',
    'x ≥ y',
  ])('detects %s as relational', (expr) => {
    expect(isRelationalExpression(expr)).toBe(true);
  });

  it.each(['sin(x)', 'x^2 + 1', '2*pi'])('detects %s as non-relational', (expr) => {
    expect(isRelationalExpression(expr)).toBe(false);
  });
});

describe('parseRelationSystem', () => {
  it('parses an equation into a single = RelationalNode with lhs/rhs ASTs', () => {
    const rels = parseRelationSystem('x^2+y^2=25');
    expect(rels).toHaveLength(1);
    const rel = rels[0]!;
    expect(isRelationalNode(rel)).toBe(true);
    expect(rel.op).toBe('=');
    expect(rel.args[0].type).toBe(NodeType.OperatorNode);
    expect(rel.args[1].type).toBe(NodeType.ConstantNode);
  });

  it('parses a strict inequality', () => {
    const rels = parseRelationSystem('y<2*x+1');
    expect(rels).toHaveLength(1);
    expect(rels[0]!.op).toBe('<');
  });

  it('normalizes unicode operators', () => {
    expect(parseRelationSystem('y ≤ x')[0]!.op).toBe('<=');
    expect(parseRelationSystem('y ≥ x')[0]!.op).toBe('>=');
  });

  it('decomposes chained comparisons into consecutive pairs', () => {
    const rels = parseRelationSystem('1<x<2');
    expect(rels).toHaveLength(2);
    expect(rels[0]!.op).toBe('<');
    expect(rels[0]!.args[0].type).toBe(NodeType.ConstantNode);
    expect(rels[0]!.args[1]).toMatchObject({ type: NodeType.SymbolNode, name: 'x' });
    expect(rels[1]!.op).toBe('<');
    expect(rels[1]!.args[0]).toMatchObject({ type: NodeType.SymbolNode, name: 'x' });
    expect(rels[1]!.args[1].type).toBe(NodeType.ConstantNode);
  });

  it('throws ParseError for !=', () => {
    expect(() => parseRelationSystem('x!=y')).toThrow(ParseError);
  });

  it('throws ParseError for non-relational expressions', () => {
    expect(() => parseRelationSystem('sin(x)')).toThrow(ParseError);
  });

  it('parses y=x^2 (lone = normalized before mathjs)', () => {
    const rels = parseRelationSystem('y=x^2');
    expect(rels).toHaveLength(1);
    expect(rels[0]!.op).toBe('=');
  });

  it('does not affect plain evaluation', () => {
    const result = evaluate('2+2');
    expect(result.success && result.value).toBe(4);
  });
});

describe('compileRelationField', () => {
  it('computes F = lhs - rhs for a circle', () => {
    const [rel] = parseRelationSystem('x^2+y^2=25');
    const f = compileRelationField(rel!);
    expect(f(5, 0)).toBe(0);
    expect(f(0, 0)).toBe(-25);
    expect(f(6, 0)).toBe(11);
  });

  it('yields NaN (not a throw) for undefined symbols', () => {
    const [rel] = parseRelationSystem('x + q = y');
    const f = compileRelationField(rel!);
    expect(f(1, 1)).toBeNaN();
  });

  it('binds extra variables (slider parameters)', () => {
    const [rel] = parseRelationSystem('x^2 + y^2 = a');
    const f = compileRelationField(rel!, { a: 9 });
    expect(f(3, 0)).toBe(0);
    expect(f(0, 0)).toBe(-9);
  });

  it('lets x/y win over accidental x/y keys in extraVariables', () => {
    const [rel] = parseRelationSystem('x = y');
    const f = compileRelationField(rel!, { x: 100, y: 200 });
    expect(f(1, 1)).toBe(0);
  });

  it('maps non-finite values to NaN', () => {
    const [rel] = parseRelationSystem('1/x = y');
    const f = compileRelationField(rel!);
    // Division by zero throws inside the evaluator -> NaN
    expect(f(0, 1)).toBeNaN();
    expect(f(1, 1)).toBe(0);
  });
});

describe('relationDirection / isStrictRelation', () => {
  const table: Array<[RelationalOperator, -1 | 0 | 1, boolean]> = [
    ['=', 0, false],
    ['<', -1, true],
    ['<=', -1, false],
    ['>', 1, true],
    ['>=', 1, false],
  ];

  it.each(table)('%s -> direction %i, strict %s', (op, dir, strict) => {
    expect(relationDirection(op)).toBe(dir);
    expect(isStrictRelation(op)).toBe(strict);
  });
});

describe('isExplicitYRelation / explicitSideOf', () => {
  it('is true for y=x^2 and x^2=y', () => {
    expect(isExplicitYRelation(parseRelationSystem('y=x^2')[0]!)).toBe(true);
    expect(isExplicitYRelation(parseRelationSystem('x^2=y')[0]!)).toBe(true);
  });

  it('is false for y^2=x, x^2+y^2=25, and inequalities', () => {
    expect(isExplicitYRelation(parseRelationSystem('y^2=x')[0]!)).toBe(false);
    expect(isExplicitYRelation(parseRelationSystem('x^2+y^2=25')[0]!)).toBe(false);
    expect(isExplicitYRelation(parseRelationSystem('y<x^2')[0]!)).toBe(false);
  });

  it('is false when the other side also contains y', () => {
    expect(isExplicitYRelation(parseRelationSystem('y=y+x')[0]!)).toBe(false);
  });

  it('explicitSideOf returns the f(x) side for both orders', () => {
    const side1 = explicitSideOf(parseRelationSystem('y=x^2')[0]!);
    const side2 = explicitSideOf(parseRelationSystem('x^2=y')[0]!);
    expect(evaluate(side1, { variables: { x: 3 } })).toMatchObject({ success: true, value: 9 });
    expect(evaluate(side2, { variables: { x: 3 } })).toMatchObject({ success: true, value: 9 });
  });

  it('explicitSideOf throws for non-explicit relations', () => {
    expect(() => explicitSideOf(parseRelationSystem('x^2+y^2=25')[0]!)).toThrow();
  });
});

describe('evaluator visitRelational', () => {
  it('returns 1/0 for comparisons', () => {
    expect(evaluate('1 < 2')).toMatchObject({ success: true, value: 1 });
    expect(evaluate('2 < 1')).toMatchObject({ success: true, value: 0 });
    expect(evaluate('2 <= 2')).toMatchObject({ success: true, value: 1 });
    expect(evaluate('3 > 2')).toMatchObject({ success: true, value: 1 });
    expect(evaluate('2 >= 3')).toMatchObject({ success: true, value: 0 });
  });

  it('compares = with relative tolerance, not ===', () => {
    expect(evaluate('0.1 + 0.2 == 0.3')).toMatchObject({ success: true, value: 1 });
    expect(evaluate('1 == 2')).toMatchObject({ success: true, value: 0 });
  });
});

describe('extractVariables with relations', () => {
  it('extracts variables across both sides', () => {
    expect(extractVariables('x^2+y^2<a')).toEqual(new Set(['x', 'y', 'a']));
  });

  it('extracts variables from chained comparisons', () => {
    expect(extractVariables('1<x<b')).toEqual(new Set(['x', 'b']));
  });

  it('still works for plain expressions', () => {
    expect(extractVariables('sin(x) + c')).toEqual(new Set(['x', 'c']));
  });
});
