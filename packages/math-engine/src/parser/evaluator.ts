/**
 * AST evaluator for mathematical expressions
 * Supports both exact (symbolic) and approximate (numeric) evaluation
 */

import { simplify as symbolicSimplify } from '../symbolic/simplify';
import type {
  ASTVisitor,
  ConstantNode,
  ExpressionNode,
  FunctionNode,
  OperatorNode,
  SymbolNode,
  UnaryOperatorNode,
} from './ast';
import { visit } from './ast';
import { parse } from './parser';

/**
 * Evaluation context with variable bindings
 */
export interface EvaluationContext {
  readonly variables?: Record<string, number | bigint>;
  readonly precision?: number; // Decimal places for rounding (default: Infinity for exact)
  readonly mode?: 'exact' | 'approximate'; // Evaluation mode
}

/**
 * Evaluation result
 */
export type EvaluationResult =
  | { success: true; value: number | bigint | string }
  | { success: false; error: EvaluationError };

/**
 * Evaluate an AST or expression string
 * @param expression - AST node or expression string
 * @param context - Evaluation context with variable bindings
 * @returns Evaluation result
 */
export function evaluate(
  expression: ExpressionNode | string,
  context: EvaluationContext = {},
): EvaluationResult {
  try {
    // Parse string expressions to AST first, then evaluate using our custom evaluator
    // This ensures all our custom functions (like ln) are supported
    const ast = typeof expression === 'string' ? parse(expression) : expression;
    const value = evaluateAST(ast, context);

    return { success: true, value };
  } catch (error) {
    return {
      success: false,
      error: new EvaluationError('Evaluation failed', error),
    };
  }
}

/**
 * Evaluate an AST node using visitor pattern
 */
function evaluateAST(node: ExpressionNode, context: EvaluationContext): number | bigint | string {
  const evaluator = new ASTEvaluator(context);
  return visit(node, evaluator);
}

/**
 * AST evaluator visitor implementation
 */
class ASTEvaluator implements ASTVisitor<number | bigint | string> {
  constructor(private context: EvaluationContext) {}

  visitConstant(node: ConstantNode): number | bigint | string {
    return node.value;
  }

  visitSymbol(node: SymbolNode): number | bigint | string {
    const name = node.name;

    // Check variable bindings
    if (this.context.variables?.[name] !== undefined) {
      return this.context.variables[name];
    }

    // Check built-in constants
    switch (name) {
      case 'pi':
      case 'π':
        return Math.PI;
      case 'e':
        return Math.E;
      case 'tau':
      case 'τ':
        return 2 * Math.PI;
      default:
        throw new EvaluationError(`Undefined symbol: ${name}`);
    }
  }

  visitOperator(node: OperatorNode): number | bigint | string {
    const [left, right] = node.args;
    const leftValue = visit(left, this);
    const rightValue = visit(right, this);

    // Convert to numbers for arithmetic
    const l = Number(leftValue);
    const r = Number(rightValue);

    switch (node.op) {
      case '+':
        return l + r;
      case '-':
        return l - r;
      case '*':
        return l * r;
      case '/':
        if (r === 0) {
          throw new EvaluationError('Division by zero');
        }
        return l / r;
      case '^':
        return l ** r;
      case '%':
        return l % r;
      default:
        throw new EvaluationError(`Unknown operator: ${node.op}`);
    }
  }

  visitUnaryOperator(node: UnaryOperatorNode): number | bigint | string {
    const [arg] = node.args;
    const argValue = visit(arg, this);

    // Convert to number for arithmetic
    const val = Number(argValue);

    switch (node.op) {
      case '-':
        return -val;
      case '+':
        return val;
      default:
        throw new EvaluationError(`Unknown unary operator: ${node.op}`);
    }
  }

  visitFunction(node: FunctionNode): number | bigint | string {
    const args = node.args.map((arg: ExpressionNode) => Number(visit(arg, this)));
    const a = args[0]!; // All math functions require at least one argument

    switch (node.fn) {
      // Trigonometric
      case 'sin':
        return Math.sin(a);
      case 'cos':
        return Math.cos(a);
      case 'tan':
        return Math.tan(a);
      case 'sec':
        return 1 / Math.cos(a);
      case 'csc':
        return 1 / Math.sin(a);
      case 'cot':
        return 1 / Math.tan(a);
      case 'asin':
        return Math.asin(a);
      case 'acos':
        return Math.acos(a);
      case 'atan':
        return Math.atan(a);
      case 'asec':
        return Math.acos(1 / a);
      case 'acsc':
        return Math.asin(1 / a);
      case 'acot':
        return Math.PI / 2 - Math.atan(a);

      // Hyperbolic
      case 'sinh':
        return Math.sinh(a);
      case 'cosh':
        return Math.cosh(a);
      case 'tanh':
        return Math.tanh(a);

      // Exponential and logarithmic
      case 'sqrt':
        return Math.sqrt(a);
      case 'cbrt':
        return Math.cbrt(a);
      case 'exp':
        return Math.exp(a);
      case 'log':
      case 'ln':
        return Math.log(a);
      case 'log10':
        return Math.log10(a);
      case 'log2':
        return Math.log2(a);

      // Rounding and utility
      case 'abs':
        return Math.abs(a);
      case 'ceil':
        return Math.ceil(a);
      case 'floor':
        return Math.floor(a);
      case 'round':
        return Math.round(a);

      // Factorial
      case 'factorial':
        return factorial(a);

      default:
        throw new EvaluationError(`Unknown function: ${node.fn}`);
    }
  }
}

/**
 * Factorial implementation
 */
const FACT_TABLE: number[] = [1, 1];

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new EvaluationError('Factorial requires non-negative integer');
  }

  if (n > 170) {
    throw new EvaluationError('Factorial overflow: n must be \u2264 170 for number type');
  }

  while (FACT_TABLE.length <= n) {
    FACT_TABLE.push(FACT_TABLE[FACT_TABLE.length - 1]! * FACT_TABLE.length);
  }

  return FACT_TABLE[n]!;
}

/**
 * Custom error class for evaluation errors
 */
export class EvaluationError extends Error {
  constructor(
    message: string,
    public override cause?: unknown,
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Simplify an expression (basic algebraic simplification)
 * Uses the full symbolic simplification engine
 */
export function simplify(expression: ExpressionNode | string): ExpressionNode {
  // Parse string expressions first
  const ast = typeof expression === 'string' ? parse(expression) : expression;

  // Apply symbolic simplification
  return symbolicSimplify(ast);
}
