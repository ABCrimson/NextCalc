/**
 * Type-safe Abstract Syntax Tree for mathematical expressions
 * Uses branded types for compile-time safety
 */

// Branded type for expression nodes
export type ExpressionNode = {
  readonly _brand: 'ExpressionNode';
  readonly type: NodeType;
  readonly value?: unknown;
  readonly args?: readonly ExpressionNode[];
  readonly name?: string;
};

export enum NodeType {
  // Literals
  ConstantNode = 'ConstantNode',
  SymbolNode = 'SymbolNode',

  // Operations
  OperatorNode = 'OperatorNode',
  UnaryOperatorNode = 'UnaryOperatorNode',
  FunctionNode = 'FunctionNode',

  // Structural
  ParenthesisNode = 'ParenthesisNode',
  AccessorNode = 'AccessorNode',
}

// Type guards for runtime type checking
export function isConstantNode(node: ExpressionNode): node is ConstantNode {
  return node.type === NodeType.ConstantNode;
}

export function isSymbolNode(node: ExpressionNode): node is SymbolNode {
  return node.type === NodeType.SymbolNode;
}

export function isOperatorNode(node: ExpressionNode): node is OperatorNode {
  return node.type === NodeType.OperatorNode;
}

export function isUnaryOperatorNode(node: ExpressionNode): node is UnaryOperatorNode {
  return node.type === NodeType.UnaryOperatorNode;
}

export function isFunctionNode(node: ExpressionNode): node is FunctionNode {
  return node.type === NodeType.FunctionNode;
}

// Specific node types
export interface ConstantNode extends ExpressionNode {
  readonly type: NodeType.ConstantNode;
  readonly value: number | bigint | string;
}

export interface SymbolNode extends ExpressionNode {
  readonly type: NodeType.SymbolNode;
  readonly name: string;
}

export interface OperatorNode extends ExpressionNode {
  readonly type: NodeType.OperatorNode;
  readonly op: Operator;
  readonly fn: string;
  readonly args: readonly [ExpressionNode, ExpressionNode];
}

export interface UnaryOperatorNode extends ExpressionNode {
  readonly type: NodeType.UnaryOperatorNode;
  readonly op: UnaryOperator;
  readonly fn: string;
  readonly args: readonly [ExpressionNode];
}

export interface FunctionNode extends ExpressionNode {
  readonly type: NodeType.FunctionNode;
  readonly fn: MathFunction;
  readonly args: readonly ExpressionNode[];
}

// Supported binary operators
export type Operator = '+' | '-' | '*' | '/' | '^' | '%';

// Supported unary operators
export type UnaryOperator = '-' | '+';

// Supported mathematical functions
export type MathFunction =
  | 'sin'
  | 'cos'
  | 'tan'
  | 'sec'
  | 'csc'
  | 'cot'
  | 'asin'
  | 'acos'
  | 'atan'
  | 'asec'
  | 'acsc'
  | 'acot'
  | 'sinh'
  | 'cosh'
  | 'tanh'
  | 'sqrt'
  | 'cbrt'
  | 'exp'
  | 'log'
  | 'ln'
  | 'log10'
  | 'log2'
  | 'abs'
  | 'ceil'
  | 'floor'
  | 'round'
  | 'factorial'
  /** Sine Integral: Si(x) = ∫₀ˣ sin(t)/t dt */
  | 'Si'
  /** Cosine Integral: Ci(x) = −∫ₓ^∞ cos(t)/t dt */
  | 'Ci'
  /** Error Function: erf(x) = (2/√π) ∫₀ˣ exp(−t²) dt */
  | 'erf'
  /** Logarithmic Integral: li(x) = ∫₀ˣ 1/ln(t) dt */
  | 'li';

// AST builder functions (smart constructors)
export function createConstantNode(value: number | bigint | string): ConstantNode {
  return {
    _brand: 'ExpressionNode',
    type: NodeType.ConstantNode,
    value,
  } as ConstantNode;
}

export function createSymbolNode(name: string): SymbolNode {
  return {
    _brand: 'ExpressionNode',
    type: NodeType.SymbolNode,
    name,
  } as SymbolNode;
}

export function createOperatorNode(
  op: Operator,
  fn: string,
  args: readonly [ExpressionNode, ExpressionNode],
): OperatorNode {
  return {
    _brand: 'ExpressionNode',
    type: NodeType.OperatorNode,
    op,
    fn,
    args,
  } as OperatorNode;
}

export function createUnaryOperatorNode(
  op: UnaryOperator,
  fn: string,
  args: readonly [ExpressionNode],
): UnaryOperatorNode {
  return {
    _brand: 'ExpressionNode',
    type: NodeType.UnaryOperatorNode,
    op,
    fn,
    args,
  } as UnaryOperatorNode;
}

export function createFunctionNode(
  fn: MathFunction,
  args: readonly ExpressionNode[],
): FunctionNode {
  return {
    _brand: 'ExpressionNode',
    type: NodeType.FunctionNode,
    fn,
    args,
  } as FunctionNode;
}

// Visitor pattern for AST traversal
export interface ASTVisitor<T> {
  visitConstant(node: ConstantNode): T;
  visitSymbol(node: SymbolNode): T;
  visitOperator(node: OperatorNode): T;
  visitUnaryOperator(node: UnaryOperatorNode): T;
  visitFunction(node: FunctionNode): T;
}

export function visit<T>(node: ExpressionNode, visitor: ASTVisitor<T>): T {
  switch (node.type) {
    case NodeType.ConstantNode:
      return visitor.visitConstant(node as ConstantNode);
    case NodeType.SymbolNode:
      return visitor.visitSymbol(node as SymbolNode);
    case NodeType.OperatorNode:
      return visitor.visitOperator(node as OperatorNode);
    case NodeType.UnaryOperatorNode:
      return visitor.visitUnaryOperator(node as UnaryOperatorNode);
    case NodeType.FunctionNode:
      return visitor.visitFunction(node as FunctionNode);
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
