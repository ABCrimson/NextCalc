/**
 * Relation utilities — compiled scalar fields and classification helpers for
 * relational expressions (equations and inequalities in x and y).
 *
 * A relation `lhs (op) rhs` is analysed through its signed field
 * `F(x, y) = lhs − rhs`:
 *  - `F = 0`  is the boundary curve (marching-squares isocontour)
 *  - `F > 0`  is the "inside" of `>` / `>=` relations
 *  - `F < 0`  is the "inside" of `<` / `<=` relations
 *
 * @module parser/relation
 */

import type { ExpressionNode, RelationalNode, RelationalOperator, SymbolNode } from './ast';
import { createOperatorNode, isSymbolNode } from './ast';
import { evaluate } from './evaluator';
import { extractVariables } from './parser';

/**
 * Compiles a relation into a scalar-field closure `F(x, y) = lhs − rhs`.
 *
 * The subtraction AST is built once; each call evaluates it with the given
 * point (plus any fixed extra variables such as slider parameters) and maps
 * evaluation failure (undefined symbols, domain errors) to NaN so samplers
 * can treat such points as holes instead of crashing.
 */
export function compileRelationField(
  rel: RelationalNode,
  extraVariables?: Record<string, number>,
): (x: number, y: number) => number {
  const [lhs, rhs] = rel.args;
  const diffAst = createOperatorNode('-', 'subtract', [lhs, rhs]);

  // One shared bindings object, mutated per call — avoids allocating a fresh
  // variables record for every grid point (fields are evaluated ~65k times
  // per 256² sampling pass). x/y are written after the spread so they always
  // win over any accidental x/y keys in extraVariables.
  const bindings: Record<string, number> = { ...extraVariables, x: 0, y: 0 };

  return (x: number, y: number): number => {
    bindings['x'] = x;
    bindings['y'] = y;
    const result = evaluate(diffAst, { variables: bindings });
    if (!result.success) return Number.NaN;
    const value = Number(result.value);
    return Number.isFinite(value) ? value : Number.NaN;
  };
}

/**
 * Sign convention of a relation's "inside" region for `F = lhs − rhs`:
 *  - `+1` for `>` / `>=` (inside is F > 0)
 *  - `−1` for `<` / `<=` (inside is F < 0)
 *  - `0`  for `=` (a pure boundary — no region)
 */
export function relationDirection(op: RelationalOperator): -1 | 0 | 1 {
  switch (op) {
    case '>':
    case '>=':
      return 1;
    case '<':
    case '<=':
      return -1;
    case '=':
      return 0;
  }
}

/**
 * Strict inequalities (`<`, `>`) exclude their boundary — rendered dashed.
 */
export function isStrictRelation(op: RelationalOperator): boolean {
  return op === '<' || op === '>';
}

function isYSymbol(node: ExpressionNode): node is SymbolNode {
  return isSymbolNode(node) && node.name === 'y';
}

function sideExcludesY(node: ExpressionNode): boolean {
  return !extractVariables(node).has('y');
}

/**
 * True when a relation is an explicit `y = f(x)` in disguise — op `=`, one
 * side exactly the symbol `y`, and the other side free of `y` (both orders:
 * `y = x^2` and `x^2 = y`). Such relations can take the ordinary Cartesian
 * fast path instead of implicit-field sampling.
 */
export function isExplicitYRelation(rel: RelationalNode): boolean {
  if (rel.op !== '=') return false;
  const [lhs, rhs] = rel.args;
  return (isYSymbol(lhs) && sideExcludesY(rhs)) || (isYSymbol(rhs) && sideExcludesY(lhs));
}

/**
 * For an {@link isExplicitYRelation} relation, returns the `f(x)` side.
 * Throws if the relation is not an explicit y-relation.
 */
export function explicitSideOf(rel: RelationalNode): ExpressionNode {
  const [lhs, rhs] = rel.args;
  if (isYSymbol(lhs) && sideExcludesY(rhs)) return rhs;
  if (isYSymbol(rhs) && sideExcludesY(lhs)) return lhs;
  throw new Error('explicitSideOf: relation is not an explicit y = f(x) equation');
}
