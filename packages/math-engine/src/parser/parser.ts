/**
 * Expression parser using Math.js with type-safe AST conversion
 */

import { type MathNode, parse as mathJSParse } from 'mathjs';
import type {
  ConstantNode,
  ExpressionNode,
  FunctionNode,
  MathFunction,
  Operator,
  OperatorNode,
  RelationalNode,
  RelationalOperator,
  SymbolNode,
  UnaryOperator,
  UnaryOperatorNode,
} from './ast';
import {
  createConstantNode,
  createFunctionNode,
  createOperatorNode,
  createRelationalNode,
  createSymbolNode,
  createUnaryOperatorNode,
  isRelationalNode,
  NodeType,
} from './ast';

/**
 * Structural interfaces that match the shapes Math.js nodes expose at runtime.
 * Using `interface extends MathNode` lets TypeScript verify the intersection without
 * a double-cast (no `as unknown as`).
 */
interface MathJSConstantNode extends MathNode {
  value: unknown;
}

interface MathJSSymbolNode extends MathNode {
  name: string;
}

interface MathJSOperatorNode extends MathNode {
  op: string;
  fn?: string;
  args?: MathNode[];
}

interface MathJSFunctionNode extends MathNode {
  fn?: { name: string };
  name?: string;
  args: MathNode[];
}

interface MathJSParenthesisNode extends MathNode {
  content: MathNode;
}

/**
 * Math.js chained-comparison node (`1 < x < 2`).
 * Shape verified against the installed mathjs 15.2: `conditionals` holds the
 * function names ('smaller', 'larger', ...) and `params` the n+1 operands.
 */
interface MathJSRelationalNode extends MathNode {
  conditionals: string[];
  params: MathNode[];
}

/**
 * Parse a mathematical expression string into a type-safe AST
 * @param expression - Mathematical expression as string (e.g., "2 + 3 * sin(x)")
 * @returns Type-safe ExpressionNode AST
 * @throws ParseError if expression is invalid
 */
export function parse(expression: string): ExpressionNode {
  try {
    const mathJSNode = mathJSParse(expression);
    return convertMathJSNode(mathJSNode);
  } catch (error) {
    throw new ParseError(`Failed to parse expression: ${expression}`, error);
  }
}

/**
 * Convert Math.js node to our type-safe AST
 */
function convertMathJSNode(node: MathNode): ExpressionNode {
  switch (node.type) {
    case 'ConstantNode':
      return convertConstantNode(node);
    case 'SymbolNode':
      return convertSymbolNode(node);
    case 'OperatorNode':
      return convertOperatorNode(node);
    case 'FunctionNode':
      return convertFunctionNode(node);
    case 'ParenthesisNode':
      // Flatten parentheses - just return the inner content
      return convertMathJSNode((node as MathJSParenthesisNode).content);
    default:
      throw new ParseError(`Unsupported node type: ${node.type}`);
  }
}

function convertConstantNode(node: MathNode): ConstantNode {
  const value = (node as MathJSConstantNode).value;

  // Handle different value types
  if (typeof value === 'number' || typeof value === 'bigint') {
    return createConstantNode(value);
  }

  // Handle special constants (pi, e, etc.)
  if (typeof value === 'string') {
    return createConstantNode(value);
  }

  // Handle complex numbers, fractions, etc.
  if (value && typeof value === 'object') {
    // For now, convert to string representation
    return createConstantNode(String(value));
  }

  return createConstantNode(String(value));
}

function convertSymbolNode(node: MathNode): SymbolNode {
  return createSymbolNode((node as MathJSSymbolNode).name);
}

/**
 * Maps Math.js relational operator spellings to our RelationalOperator union.
 * mathjs parses `==` (fn `equal`); a lone `=` is normalized to `==` upstream
 * by {@link normalizeRelationSyntax} before it ever reaches Math.js.
 */
const MATHJS_RELATIONAL_OPS: Readonly<Record<string, RelationalOperator>> = {
  '==': '=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
};

function convertOperatorNode(node: MathNode): OperatorNode | UnaryOperatorNode | RelationalNode {
  const mathJSNode = node as MathJSOperatorNode;

  // Relational operators become first-class RelationalNodes
  const relationalOp = MATHJS_RELATIONAL_OPS[mathJSNode.op];
  if (relationalOp !== undefined) {
    const relArgs = mathJSNode.args;
    if (relArgs?.length !== 2) {
      throw new ParseError(`Relational operator ${mathJSNode.op} must have exactly 2 arguments`);
    }
    return createRelationalNode(relationalOp, [
      convertMathJSNode(relArgs[0]!),
      convertMathJSNode(relArgs[1]!),
    ]);
  }
  if (mathJSNode.op === '!=') {
    throw new ParseError('The != operator is not supported in relations');
  }

  const op = mathJSNode.op as Operator;
  const fn = mathJSNode.fn || operatorToFunction(op);

  const args = mathJSNode.args;
  if (!args || args.length === 0) {
    throw new ParseError(`Operator ${op} must have at least 1 argument`);
  }

  // Handle unary operators (e.g., -x, +x)
  if (args.length === 1) {
    const unaryOp = op as UnaryOperator;
    const convertedArgs = [convertMathJSNode(args[0]!)] as const;
    return createUnaryOperatorNode(unaryOp, fn, convertedArgs);
  }

  // Handle binary operators (e.g., x + y, x * y)
  if (args.length === 2) {
    const convertedArgs = [convertMathJSNode(args[0]!), convertMathJSNode(args[1]!)] as const;
    return createOperatorNode(op, fn, convertedArgs);
  }

  throw new ParseError(`Operator ${op} has ${args.length} arguments, expected 1 or 2`);
}

function convertFunctionNode(node: MathNode): FunctionNode {
  const mathJSNode = node as MathJSFunctionNode;
  const fn = mathJSNode.fn?.name || mathJSNode.name;

  if (!fn || !isMathFunction(fn)) {
    throw new ParseError(`Unknown function: ${fn}`);
  }

  const args = mathJSNode.args.map((arg: MathNode) => convertMathJSNode(arg));

  return createFunctionNode(fn, args);
}

/**
 * Convert operator symbol to function name
 */
function operatorToFunction(op: Operator): string {
  switch (op) {
    case '+':
      return 'add';
    case '-':
      return 'subtract';
    case '*':
      return 'multiply';
    case '/':
      return 'divide';
    case '^':
      return 'pow';
    case '%':
      return 'mod';
    default:
      throw new ParseError(`Unknown operator: ${op}`);
  }
}

/**
 * Valid math function names as a module-level Set for O(1) lookup
 * without allocating a new array on every call.
 */
const VALID_MATH_FUNCTIONS: ReadonlySet<string> = new Set<MathFunction>([
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'asin',
  'acos',
  'atan',
  'asec',
  'acsc',
  'acot',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'exp',
  'log',
  'ln',
  'log10',
  'log2',
  'abs',
  'ceil',
  'floor',
  'round',
  'factorial',
  'Si',
  'Ci',
  'erf',
  'li',
]);

/**
 * Type guard for math functions
 */
function isMathFunction(name: string): name is MathFunction {
  return VALID_MATH_FUNCTIONS.has(name);
}

/**
 * Custom error class for parsing errors
 */
export class ParseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ParseError';
  }
}

/**
 * Utility function to validate expression syntax without full parsing
 * @param expression - Expression string to validate
 * @returns true if valid, false otherwise
 */
export function isValidExpression(expression: string): boolean {
  try {
    parse(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Matches a lone `=` that is not part of `==`, `<=`, `>=`, or `!=`.
 * Lookbehind excludes a preceding comparison char; lookahead excludes `==`.
 */
const LONE_EQUALS = /(?<![<>=!])=(?!=)/g;

/**
 * Normalizes user-facing relation syntax into what Math.js can parse:
 *  - Unicode `≤` / `≥` become `<=` / `>=`
 *  - A lone `=` (mathematical equality) becomes `==` — Math.js would
 *    otherwise parse `y = x^2` as an AssignmentNode and reject `x^2 = y`.
 */
export function normalizeRelationSyntax(expression: string): string {
  return expression.replaceAll('≤', '<=').replaceAll('≥', '>=').replace(LONE_EQUALS, '==');
}

/**
 * Quick check whether an expression contains relational syntax
 * (`=`, `==`, `<`, `<=`, `>`, `>=`, `≤`, `≥`) and should be routed through
 * {@link parseRelationSystem} instead of {@link parse}.
 * Comparison characters have no other meaning in math expressions, so a
 * simple character-class scan is sufficient.
 */
export function isRelationalExpression(expression: string): boolean {
  return /[<>=≤≥]/.test(expression);
}

/**
 * Parses an expression containing relational operators into one or more
 * {@link RelationalNode}s.
 *
 *  - A binary relation (`x^2+y^2=25`, `y<2*x+1`) yields a single node.
 *  - A chained comparison (`1<x<2`) decomposes into consecutive-pair
 *    relations (`[1<x, x<2]`).
 *  - Anything without a top-level relation throws {@link ParseError}.
 */
export function parseRelationSystem(expression: string): RelationalNode[] {
  const normalized = normalizeRelationSyntax(expression);

  let mathJSNode: MathNode;
  try {
    mathJSNode = mathJSParse(normalized);
  } catch (error) {
    throw new ParseError(`Failed to parse relation: ${expression}`, error);
  }

  // Chained comparison — mathjs's own RelationalNode ({conditionals, params})
  if (mathJSNode.type === 'RelationalNode') {
    const chained = mathJSNode as MathJSRelationalNode;
    const relations: RelationalNode[] = [];
    for (let i = 0; i < chained.conditionals.length; i++) {
      const op = CHAINED_CONDITIONAL_OPS[chained.conditionals[i]!];
      if (op === undefined) {
        throw new ParseError(`Unsupported chained comparison operator: ${chained.conditionals[i]}`);
      }
      relations.push(
        createRelationalNode(op, [
          convertMathJSNode(chained.params[i]!),
          convertMathJSNode(chained.params[i + 1]!),
        ]),
      );
    }
    return relations;
  }

  const converted = (() => {
    try {
      return convertMathJSNode(mathJSNode);
    } catch (error) {
      if (error instanceof ParseError) throw error;
      throw new ParseError(`Failed to parse relation: ${expression}`, error);
    }
  })();

  if (!isRelationalNode(converted)) {
    throw new ParseError(`Expression is not a relation: ${expression}`);
  }
  return [converted];
}

/**
 * Math.js chained-comparison conditional names → our RelationalOperator.
 */
const CHAINED_CONDITIONAL_OPS: Readonly<Record<string, RelationalOperator>> = {
  equal: '=',
  smaller: '<',
  smallerEq: '<=',
  larger: '>',
  largerEq: '>=',
};

/**
 * Built-in mathematical constants that are not variables
 */
const BUILTIN_CONSTANTS: ReadonlySet<string> = new Set([
  'pi',
  'π',
  'e',
  'tau',
  'τ',
  'i',
  'phi',
  'φ',
]);

/**
 * Extract all variable names from an expression
 * @param expression - Expression string or parsed AST
 * @returns Set of variable names (excludes built-in constants like pi, e, tau)
 */
export function extractVariables(expression: string | ExpressionNode): Set<string> {
  const variables = new Set<string>();

  function traverse(node: ExpressionNode): void {
    if (node.type === NodeType.SymbolNode && node.name && !BUILTIN_CONSTANTS.has(node.name)) {
      variables.add(node.name);
    } else if (node.args) {
      node.args.forEach(traverse);
    }
  }

  // Relational strings ('x^2+y^2<25', '1<x<2') decompose into RelationalNodes,
  // whose `args` make the same traversal work unchanged.
  const roots: readonly ExpressionNode[] =
    typeof expression === 'string'
      ? isRelationalExpression(expression)
        ? parseRelationSystem(expression)
        : [parse(expression)]
      : [expression];

  for (const root of roots) {
    traverse(root);
  }
  return variables;
}
