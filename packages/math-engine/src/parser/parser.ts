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
  SymbolNode,
  UnaryOperator,
  UnaryOperatorNode,
} from './ast';
import {
  NodeType,
  createConstantNode,
  createFunctionNode,
  createOperatorNode,
  createSymbolNode,
  createUnaryOperatorNode,
} from './ast';

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
      return convertMathJSNode((node as unknown as { content: MathNode }).content);
    default:
      throw new ParseError(`Unsupported node type: ${node.type}`);
  }
}

function convertConstantNode(node: MathNode): ConstantNode {
  const value = (node as unknown as { value: unknown }).value;

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
  return createSymbolNode((node as unknown as { name: string }).name);
}

function convertOperatorNode(node: MathNode): OperatorNode | UnaryOperatorNode {
  const mathJSNode = node as unknown as { op: string; fn?: string; args?: MathNode[] };
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
  const mathJSNode = node as unknown as { fn?: { name: string }; name?: string; args: MathNode[] };
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
  constructor(
    message: string,
    public override cause?: unknown,
  ) {
    super(message);
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
 * Extract all variable names from an expression
 * @param expression - Expression string or parsed AST
 * @returns Set of variable names
 */
export function extractVariables(expression: string | ExpressionNode): Set<string> {
  const ast = typeof expression === 'string' ? parse(expression) : expression;
  const variables = new Set<string>();

  function traverse(node: ExpressionNode): void {
    if (node.type === NodeType.SymbolNode && node.name) {
      variables.add(node.name);
    } else if (node.args) {
      node.args.forEach(traverse);
    }
  }

  traverse(ast);
  return variables;
}
