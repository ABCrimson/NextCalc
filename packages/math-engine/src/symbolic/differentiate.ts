/**
 * Symbolic differentiation engine
 * Implements automatic differentiation using AST transformation
 */

import type {
  ExpressionNode,
  ConstantNode,
  SymbolNode,
  OperatorNode,
  FunctionNode,
} from '../parser/ast';
import {
  createConstantNode,
  createOperatorNode,
  createFunctionNode,
} from '../parser/ast';

/**
 * Differentiate an expression with respect to a variable
 * @param expr - Expression AST to differentiate
 * @param variable - Variable to differentiate with respect to (default: 'x')
 * @returns Derivative as AST
 */
export function differentiate(expr: ExpressionNode, variable = 'x'): ExpressionNode {
  switch (expr.type) {
    case 'ConstantNode':
      return differentiateConstant();

    case 'SymbolNode':
      return differentiateSymbol(expr as SymbolNode, variable);

    case 'OperatorNode':
      return differentiateOperator(expr as OperatorNode, variable);

    case 'FunctionNode':
      return differentiateFunction(expr as FunctionNode, variable);

    default:
      throw new Error(`Cannot differentiate node type: ${expr.type}`);
  }
}

/**
 * d/dx(c) = 0
 */
function differentiateConstant(): ConstantNode {
  return createConstantNode(0);
}

/**
 * d/dx(x) = 1, d/dx(y) = 0
 */
function differentiateSymbol(node: SymbolNode, variable: string): ConstantNode {
  return createConstantNode(node.name === variable ? 1 : 0);
}

/**
 * Differentiate operator nodes using standard rules
 */
function differentiateOperator(node: OperatorNode, variable: string): ExpressionNode {
  const [left, right] = node.args;
  const leftPrime = differentiate(left, variable);
  const rightPrime = differentiate(right, variable);

  switch (node.op) {
    case '+':
    case '-':
      // (f ± g)' = f' ± g'
      return createOperatorNode(node.op, node.fn, [leftPrime, rightPrime]);

    case '*':
      // Product rule: (f * g)' = f' * g + f * g'
      return createOperatorNode(
        '+',
        'add',
        [
          createOperatorNode('*', 'multiply', [leftPrime, right]),
          createOperatorNode('*', 'multiply', [left, rightPrime]),
        ]
      );

    case '/':
      // Quotient rule: (f / g)' = (f' * g - f * g') / g²
      return createOperatorNode(
        '/',
        'divide',
        [
          createOperatorNode(
            '-',
            'subtract',
            [
              createOperatorNode('*', 'multiply', [leftPrime, right]),
              createOperatorNode('*', 'multiply', [left, rightPrime]),
            ]
          ),
          createOperatorNode('^', 'pow', [right, createConstantNode(2)]),
        ]
      );

    case '^':
      // Power rule: (f ^ g)' has multiple cases

      // Special case 1: f^n where n is constant
      if (right.type === 'ConstantNode') {
        const n = (right as ConstantNode).value;
        if (typeof n === 'number') {
          // (f^n)' = n * f^(n-1) * f'
          return createOperatorNode(
            '*',
            'multiply',
            [
              createOperatorNode(
                '*',
                'multiply',
                [
                  createConstantNode(n),
                  createOperatorNode('^', 'pow', [left, createConstantNode(n - 1)]),
                ]
              ),
              leftPrime,
            ]
          );
        }
      }

      // Special case 2: a^f where a is constant (exponential with constant base)
      if (left.type === 'ConstantNode') {
        const a = (left as ConstantNode).value;
        if (typeof a === 'number' && a > 0) {
          // (a^f)' = a^f * ln(a) * f'
          return createOperatorNode(
            '*',
            'multiply',
            [
              createOperatorNode(
                '*',
                'multiply',
                [
                  node, // a^f
                  createFunctionNode('log', [createConstantNode(a)]), // ln(a)
                ]
              ),
              rightPrime, // f'
            ]
          );
        }
      }

      // General case: (f^g)' = f^g * (g' * ln(f) + g * f'/f)
      // This is complex, for now just handle the special cases above
      throw new Error('Differentiation of general variable exponents not yet implemented');

    default:
      throw new Error(`Unknown operator: ${node.op}`);
  }
}

/**
 * Differentiate function nodes using chain rule
 */
function differentiateFunction(node: FunctionNode, variable: string): ExpressionNode {
  const arg = node.args[0];
  if (!arg) {
    throw new Error('Function must have at least one argument');
  }
  const argPrime = differentiate(arg, variable);

  switch (node.fn) {
    case 'sin':
      // sin'(f) = cos(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [createFunctionNode('cos', [arg]), argPrime]
      );

    case 'cos':
      // cos'(f) = -sin(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [createConstantNode(-1), createFunctionNode('sin', [arg])]
          ),
          argPrime,
        ]
      );

    case 'tan':
      // tan'(f) = sec²(f) * f' = 1/cos²(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '^',
                'pow',
                [createFunctionNode('cos', [arg]), createConstantNode(2)]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'exp':
      // exp'(f) = exp(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [createFunctionNode('exp', [arg]), argPrime]
      );

    case 'log':
    case 'ln':
      // log'(f) = ln'(f) = (1/f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [createOperatorNode('/', 'divide', [createConstantNode(1), arg]), argPrime]
      );

    case 'log10':
      // log10'(f) = 1/(f*ln(10)) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '*',
                'multiply',
                [arg, createFunctionNode('log', [createConstantNode(10)])]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'log2':
      // log2'(f) = 1/(f*ln(2)) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '*',
                'multiply',
                [arg, createFunctionNode('log', [createConstantNode(2)])]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'sqrt':
      // sqrt'(f) = 1/(2*sqrt(f)) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '*',
                'multiply',
                [createConstantNode(2), createFunctionNode('sqrt', [arg])]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'abs':
      // abs'(f) = f/abs(f) * f' = sign(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode('/', 'divide', [arg, createFunctionNode('abs', [arg])]),
          argPrime,
        ]
      );

    // Additional trigonometric functions
    case 'sec':
      // sec'(f) = sec(f)*tan(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [createFunctionNode('sec', [arg]), createFunctionNode('tan', [arg])]
          ),
          argPrime,
        ]
      );

    case 'csc':
      // csc'(f) = -csc(f)*cot(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [
              createConstantNode(-1),
              createOperatorNode(
                '*',
                'multiply',
                [createFunctionNode('csc', [arg]), createFunctionNode('cot', [arg])]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'cot':
      // cot'(f) = -csc²(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [
              createConstantNode(-1),
              createOperatorNode(
                '^',
                'pow',
                [createFunctionNode('csc', [arg]), createConstantNode(2)]
              ),
            ]
          ),
          argPrime,
        ]
      );

    // Inverse trigonometric functions
    case 'asin':
      // asin'(f) = 1/sqrt(1-f²) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createFunctionNode('sqrt', [
                createOperatorNode(
                  '-',
                  'subtract',
                  [createConstantNode(1), createOperatorNode('^', 'pow', [arg, createConstantNode(2)])]
                ),
              ]),
            ]
          ),
          argPrime,
        ]
      );

    case 'acos':
      // acos'(f) = -1/sqrt(1-f²) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [
              createConstantNode(-1),
              createOperatorNode(
                '/',
                'divide',
                [
                  createConstantNode(1),
                  createFunctionNode('sqrt', [
                    createOperatorNode(
                      '-',
                      'subtract',
                      [createConstantNode(1), createOperatorNode('^', 'pow', [arg, createConstantNode(2)])]
                    ),
                  ]),
                ]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'atan':
      // atan'(f) = 1/(1+f²) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '+',
                'add',
                [createConstantNode(1), createOperatorNode('^', 'pow', [arg, createConstantNode(2)])]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'asec':
      // asec'(f) = 1/(|f|*sqrt(f²-1)) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '*',
                'multiply',
                [
                  createFunctionNode('abs', [arg]),
                  createFunctionNode('sqrt', [
                    createOperatorNode(
                      '-',
                      'subtract',
                      [createOperatorNode('^', 'pow', [arg, createConstantNode(2)]), createConstantNode(1)]
                    ),
                  ]),
                ]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'acsc':
      // acsc'(f) = -1/(|f|*sqrt(f²-1)) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [
              createConstantNode(-1),
              createOperatorNode(
                '/',
                'divide',
                [
                  createConstantNode(1),
                  createOperatorNode(
                    '*',
                    'multiply',
                    [
                      createFunctionNode('abs', [arg]),
                      createFunctionNode('sqrt', [
                        createOperatorNode(
                          '-',
                          'subtract',
                          [createOperatorNode('^', 'pow', [arg, createConstantNode(2)]), createConstantNode(1)]
                        ),
                      ]),
                    ]
                  ),
                ]
              ),
            ]
          ),
          argPrime,
        ]
      );

    case 'acot':
      // acot'(f) = -1/(1+f²) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '*',
            'multiply',
            [
              createConstantNode(-1),
              createOperatorNode(
                '/',
                'divide',
                [
                  createConstantNode(1),
                  createOperatorNode(
                    '+',
                    'add',
                    [createConstantNode(1), createOperatorNode('^', 'pow', [arg, createConstantNode(2)])]
                  ),
                ]
              ),
            ]
          ),
          argPrime,
        ]
      );

    // Hyperbolic functions
    case 'sinh':
      // sinh'(f) = cosh(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [createFunctionNode('cosh', [arg]), argPrime]
      );

    case 'cosh':
      // cosh'(f) = sinh(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [createFunctionNode('sinh', [arg]), argPrime]
      );

    case 'tanh':
      // tanh'(f) = sech²(f) * f' = 1/cosh²(f) * f'
      return createOperatorNode(
        '*',
        'multiply',
        [
          createOperatorNode(
            '/',
            'divide',
            [
              createConstantNode(1),
              createOperatorNode(
                '^',
                'pow',
                [createFunctionNode('cosh', [arg]), createConstantNode(2)]
              ),
            ]
          ),
          argPrime,
        ]
      );

    default:
      throw new Error(`Differentiation of function ${node.fn} not implemented`);
  }
}

/**
 * Simplify a derivative expression (basic algebraic simplification)
 */
export function simplifyDerivative(expr: ExpressionNode): ExpressionNode {
  switch (expr.type) {
    case 'ConstantNode':
    case 'SymbolNode':
      return expr;

    case 'OperatorNode': {
      const node = expr as OperatorNode;
      const [left, right] = node.args;
      const leftSimp = simplifyDerivative(left);
      const rightSimp = simplifyDerivative(right);

      // 0 + x = x
      if (
        node.op === '+' &&
        leftSimp.type === 'ConstantNode' &&
        (leftSimp as ConstantNode).value === 0
      ) {
        return rightSimp;
      }

      // x + 0 = x
      if (
        node.op === '+' &&
        rightSimp.type === 'ConstantNode' &&
        (rightSimp as ConstantNode).value === 0
      ) {
        return leftSimp;
      }

      // 0 * x = 0
      if (
        node.op === '*' &&
        leftSimp.type === 'ConstantNode' &&
        (leftSimp as ConstantNode).value === 0
      ) {
        return createConstantNode(0);
      }

      // x * 0 = 0
      if (
        node.op === '*' &&
        rightSimp.type === 'ConstantNode' &&
        (rightSimp as ConstantNode).value === 0
      ) {
        return createConstantNode(0);
      }

      // 1 * x = x
      if (
        node.op === '*' &&
        leftSimp.type === 'ConstantNode' &&
        (leftSimp as ConstantNode).value === 1
      ) {
        return rightSimp;
      }

      // x * 1 = x
      if (
        node.op === '*' &&
        rightSimp.type === 'ConstantNode' &&
        (rightSimp as ConstantNode).value === 1
      ) {
        return leftSimp;
      }

      return createOperatorNode(node.op, node.fn, [leftSimp, rightSimp]);
    }

    case 'FunctionNode': {
      const node = expr as FunctionNode;
      const argsSimp = node.args.map(simplifyDerivative);
      return createFunctionNode(node.fn, argsSimp);
    }

    default:
      return expr;
  }
}
