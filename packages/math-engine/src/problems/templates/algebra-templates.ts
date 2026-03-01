/**
 * Algebra Problem Templates
 *
 * Templates for generating algebraic problems:
 * - Linear equations
 * - Quadratic equations
 * - Systems of equations
 * - Polynomial operations
 * - Rational expressions
 * - Inequalities
 * - Absolute value equations
 * - Radical equations
 */

import { createTemplate, narrow, type ProblemTemplate } from './template-engine';

/**
 * Linear equation: ax + b = c
 */
export const linearEquationTemplate = createTemplate({
  id: 'linear-equation-basic',
  category: 'algebra',
  subcategory: 'linear-equations',
  difficulty: 1,
  template: 'Solve for $x$: ${{a}}x + {{b}} = {{c}}$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 10 },
    { name: 'b', type: 'integer', min: -20, max: 20 },
    { name: 'c', type: 'integer', min: -20, max: 20 },
  ],
  solution: (params) => {
    const { a, b, c } = narrow<{ a: number; b: number; c: number }>(params);
    const x = (c - b) / a;

    return {
      answer: `x = ${x}`,
      steps: [
        {
          description: 'Subtract {{b}} from both sides',
          expression: `${a}x = ${c - b}`,
          explanation: `${c} - ${b} = ${c - b}`,
        },
        {
          description: 'Divide both sides by {{a}}',
          expression: `x = ${x}`,
          explanation: `${c - b} / ${a} = ${x}`,
        },
      ],
    };
  },
  hints: [
    () => 'Isolate the variable term by moving the constant to the other side',
    (params) => `Subtract ${Number(params['b'])} from both sides`,
    (params) => `Then divide both sides by ${Number(params['a'])}`,
  ],
  commonMistakes: [
    (params, answer) => {
      const p = narrow<{ a: number; b: number; c: number }>(params);
      const wrongAnswer = (p.c + p.b) / p.a;
      if (answer === String(wrongAnswer)) {
        return {
          incorrectAnswer: String(wrongAnswer),
          explanation: 'You added instead of subtracted',
          correction: `Remember to subtract ${p.b}, not add it`,
        };
      }
      return null;
    },
  ],
  tags: ['linear', 'equations', 'solving'],
  prerequisites: ['arithmetic', 'variables'],
  learningObjectives: ['Solve linear equations', 'Apply inverse operations'],
});

/**
 * Quadratic equation: ax² + bx + c = 0
 */
export const quadraticEquationTemplate = createTemplate({
  id: 'quadratic-equation-basic',
  category: 'algebra',
  subcategory: 'quadratic-equations',
  difficulty: 3,
  template: 'Solve for $x$ using the quadratic formula: ${{a}}x^2 + {{b}}x + {{c}} = 0$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 5 },
    { name: 'b', type: 'integer', min: -10, max: 10 },
    {
      name: 'c',
      type: 'integer',
      min: -10,
      max: 10,
      constraint: function (c) {
        // Ensure real solutions (discriminant >= 0)
        const params = this as unknown as Record<string, number>;
        const b = params['b']!;
        const a = params['a']!;
        const discriminant = b * b - 4 * a * c;
        return discriminant >= 0;
      },
    },
  ],
  solution: (params) => {
    const { a, b, c } = narrow<{ a: number; b: number; c: number }>(params);
    const discriminant = b * b - 4 * a * c;
    const sqrtDisc = Math.sqrt(discriminant);

    const x1 = (-b + sqrtDisc) / (2 * a);
    const x2 = (-b - sqrtDisc) / (2 * a);

    return {
      answer: `x = ${x1} or x = ${x2}`,
      steps: [
        {
          description: 'Identify coefficients',
          expression: `a = ${a}, b = ${b}, c = ${c}`,
        },
        {
          description: 'Calculate discriminant',
          expression: `\\Delta = b^2 - 4ac = ${b}^2 - 4(${a})(${c}) = ${discriminant}`,
        },
        {
          description: 'Apply quadratic formula',
          expression: `x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${-b} \\pm \\sqrt{${discriminant}}}{${2 * a}}`,
        },
        {
          description: 'Simplify',
          expression: `x = ${x1} \\text{ or } x = ${x2}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$',
    () => 'First calculate the discriminant $b^2 - 4ac$',
    () => 'Then substitute into the formula',
  ],
  commonMistakes: [
    (params, answer) => {
      // Forgot the ± sign
      const p = narrow<{ a: number; b: number }>(params);
      const wrongX = -p.b / (2 * p.a);
      if (answer.includes(String(wrongX)) && !answer.includes('or')) {
        return {
          incorrectAnswer: `x = ${wrongX}`,
          explanation: 'You forgot the ± in the quadratic formula',
          correction: 'Remember there are typically two solutions',
        };
      }
      return null;
    },
  ],
  tags: ['quadratic', 'equations', 'formula'],
  prerequisites: ['algebra', 'square-roots'],
  learningObjectives: ['Apply quadratic formula', 'Calculate discriminant'],
});

/**
 * System of linear equations (2x2)
 */
export const systemLinearTemplate = createTemplate({
  id: 'system-linear-2x2',
  category: 'algebra',
  subcategory: 'systems',
  difficulty: 2,
  template:
    'Solve the system of equations:\n$$\\begin{cases}{{a1}}x + {{b1}}y = {{c1}}\\\\{{a2}}x + {{b2}}y = {{c2}}\\end{cases}$$',
  parameters: [
    { name: 'a1', type: 'integer', min: 1, max: 5 },
    { name: 'b1', type: 'integer', min: 1, max: 5 },
    { name: 'c1', type: 'integer', min: 1, max: 20 },
    { name: 'a2', type: 'integer', min: 1, max: 5 },
    { name: 'b2', type: 'integer', min: 1, max: 5 },
    {
      name: 'c2',
      type: 'integer',
      min: 1,
      max: 20,
      constraint: function (_c2) {
        // Ensure unique solution (determinant != 0)
        const params = this as unknown as Record<string, number>;
        const det = params['a1']! * params['b2']! - params['a2']! * params['b1']!;
        return det !== 0;
      },
    },
  ],
  solution: (params) => {
    const { a1, b1, c1, a2, b2, c2 } = narrow<{
      a1: number;
      b1: number;
      c1: number;
      a2: number;
      b2: number;
      c2: number;
    }>(params);

    // Cramer's rule
    const det = a1 * b2 - a2 * b1;
    const x = (c1 * b2 - c2 * b1) / det;
    const y = (a1 * c2 - a2 * c1) / det;

    return {
      answer: `x = ${x}, y = ${y}`,
      steps: [
        {
          description: 'Calculate determinant',
          expression: `D = ${a1} \\cdot ${b2} - ${a2} \\cdot ${b1} = ${det}`,
        },
        {
          description: "Apply Cramer's rule for x",
          expression: `x = \\frac{${c1} \\cdot ${b2} - ${c2} \\cdot ${b1}}{${det}} = ${x}`,
        },
        {
          description: "Apply Cramer's rule for y",
          expression: `y = \\frac{${a1} \\cdot ${c2} - ${a2} \\cdot ${c1}}{${det}} = ${y}`,
        },
      ],
    };
  },
  hints: [
    () => 'You can use substitution or elimination method',
    () => 'Try multiplying one equation to eliminate a variable',
    () => "Or use Cramer's rule with determinants",
  ],
  commonMistakes: [],
  tags: ['systems', 'linear-equations', 'simultaneous'],
  prerequisites: ['linear-equations', 'substitution'],
  learningObjectives: ['Solve systems of equations', "Apply Cramer's rule"],
});

/**
 * Polynomial factorization
 */
export const factorizationTemplate = createTemplate({
  id: 'polynomial-factorization',
  category: 'algebra',
  subcategory: 'polynomials',
  difficulty: 2,
  template: 'Factor completely: $x^2 + {{b}}x + {{c}}$',
  parameters: [
    {
      name: 'b',
      type: 'integer',
      min: -10,
      max: 10,
      constraint: (b) => b !== 0,
    },
    {
      name: 'c',
      type: 'integer',
      min: -20,
      max: 20,
      constraint: function (c) {
        // Ensure it factors nicely
        const params = this as unknown as Record<string, number>;
        const b = params['b'];

        // Find factors of c that add to b
        for (let i = -20; i <= 20; i++) {
          if (c % i === 0) {
            const j = c / i;
            if (i + j === b) {
              return true;
            }
          }
        }
        return false;
      },
    },
  ],
  solution: (params) => {
    const { b, c } = narrow<{ b: number; c: number }>(params);

    // Find factors
    let p = 0,
      q = 0;
    for (let i = -20; i <= 20; i++) {
      if (c % i === 0) {
        const j = c / i;
        if (i + j === b) {
          p = i;
          q = j;
          break;
        }
      }
    }

    return {
      answer: `(x + ${p})(x + ${q})`,
      steps: [
        {
          description: 'Find two numbers that multiply to {{c}} and add to {{b}}',
          expression: `${p} \\times ${q} = ${c}, ${p} + ${q} = ${b}`,
        },
        {
          description: 'Factor as product',
          expression: `(x + ${p})(x + ${q})`,
        },
      ],
    };
  },
  hints: [
    (params) => `Find two numbers that multiply to ${Number(params['c'])}`,
    (params) => `and add to ${Number(params['b'])}`,
    () => 'Write the factors as (x + p)(x + q)',
  ],
  commonMistakes: [],
  tags: ['factoring', 'polynomials', 'quadratics'],
  prerequisites: ['polynomials', 'multiplication'],
  learningObjectives: ['Factor quadratic expressions'],
});

/**
 * Linear inequality
 */
export const linearInequalityTemplate = createTemplate({
  id: 'linear-inequality',
  category: 'algebra',
  subcategory: 'inequalities',
  difficulty: 2,
  template: 'Solve for $x$: ${{a}}x + {{b}} {{op}} {{c}}$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 10 },
    { name: 'b', type: 'integer', min: -20, max: 20 },
    { name: 'c', type: 'integer', min: -20, max: 20 },
    { name: 'op', type: 'choice', choices: ['<', '>', '\\leq', '\\geq'] },
  ],
  solution: (params) => {
    const { a, b, c, op } = narrow<{ a: number; b: number; c: number; op: string }>(params);
    const x = (c - b) / a;

    // Flip inequality if dividing by negative
    const finalOp = a > 0 ? op : flipInequality(op);

    return {
      answer: `x ${finalOp} ${x}`,
      steps: [
        {
          description: 'Subtract {{b}} from both sides',
          expression: `${a}x ${op} ${c - b}`,
        },
        {
          description: `Divide both sides by ${a}${a < 0 ? ' (flip inequality)' : ''}`,
          expression: `x ${finalOp} ${x}`,
        },
      ],
    };
  },
  hints: [
    () => 'Treat it like an equation, but remember...',
    (params) =>
      Number(params['a']) < 0
        ? 'When dividing by a negative, flip the inequality sign!'
        : 'Keep the inequality sign the same when dividing by positive',
  ],
  commonMistakes: [
    (params, answer) => {
      const p = narrow<{ a: number; op: string }>(params);
      if (p.a < 0 && answer.includes(p.op)) {
        return {
          incorrectAnswer: answer,
          explanation: 'You forgot to flip the inequality when dividing by a negative',
          correction: 'Always flip the inequality when multiplying/dividing by negative',
        };
      }
      return null;
    },
  ],
  tags: ['inequalities', 'linear', 'solving'],
  prerequisites: ['linear-equations'],
  learningObjectives: ['Solve linear inequalities', 'Handle sign flipping'],
});

/**
 * Absolute value equation
 */
export const absoluteValueTemplate = createTemplate({
  id: 'absolute-value-equation',
  category: 'algebra',
  subcategory: 'absolute-value',
  difficulty: 3,
  template: 'Solve for $x$: $|x + {{a}}| = {{b}}$',
  parameters: [
    { name: 'a', type: 'integer', min: -10, max: 10 },
    { name: 'b', type: 'integer', min: 1, max: 20 },
  ],
  solution: (params) => {
    const { a, b } = narrow<{ a: number; b: number }>(params);
    const x1 = b - a;
    const x2 = -b - a;

    return {
      answer: `x = ${x1} or x = ${x2}`,
      steps: [
        {
          description: 'Set up two cases',
          expression: `x + ${a} = ${b} \\text{ or } x + ${a} = ${-b}`,
        },
        {
          description: 'Solve first case',
          expression: `x = ${x1}`,
        },
        {
          description: 'Solve second case',
          expression: `x = ${x2}`,
        },
      ],
    };
  },
  hints: [
    () => 'Absolute value equations have two cases: positive and negative',
    (params) => `Case 1: x + ${Number(params['a'])} = ${Number(params['b'])}`,
    (params) => `Case 2: x + ${Number(params['a'])} = ${-Number(params['b'])}`,
  ],
  commonMistakes: [
    (params, answer) => {
      const p = narrow<{ a: number; b: number }>(params);
      const x1 = p.b - p.a;
      if (answer === String(x1) && !answer.includes('or')) {
        return {
          incorrectAnswer: String(x1),
          explanation: 'You only found one solution',
          correction: 'Absolute value equations typically have two solutions',
        };
      }
      return null;
    },
  ],
  tags: ['absolute-value', 'equations'],
  prerequisites: ['absolute-value-concept', 'linear-equations'],
  learningObjectives: ['Solve absolute value equations', 'Handle multiple cases'],
});

/**
 * Radical equation
 */
export const radicalEquationTemplate = createTemplate({
  id: 'radical-equation-square',
  category: 'algebra',
  subcategory: 'radicals',
  difficulty: 3,
  template: 'Solve for $x$: $\\sqrt{x + {{a}}} = {{b}}$',
  parameters: [
    { name: 'a', type: 'integer', min: 0, max: 20 },
    { name: 'b', type: 'integer', min: 1, max: 10 },
  ],
  solution: (params) => {
    const { a, b } = narrow<{ a: number; b: number }>(params);
    const x = b * b - a;

    return {
      answer: `x = ${x}`,
      steps: [
        {
          description: 'Square both sides',
          expression: `x + ${a} = ${b}^2 = ${b * b}`,
        },
        {
          description: 'Solve for x',
          expression: `x = ${x}`,
        },
        {
          description: 'Check: $\\sqrt{${x} + ${a}} = \\sqrt{${x + a}} = ${b}$ ✓',
          expression: 'Solution is valid',
        },
      ],
    };
  },
  hints: [
    () => 'Square both sides to eliminate the square root',
    () => 'Remember to check your answer in the original equation',
    () => 'Squaring can introduce extraneous solutions',
  ],
  commonMistakes: [],
  tags: ['radicals', 'equations', 'square-roots'],
  prerequisites: ['radicals', 'exponents'],
  learningObjectives: ['Solve radical equations', 'Check for extraneous solutions'],
});

/**
 * Rational expression simplification
 */
export const rationalSimplificationTemplate = createTemplate({
  id: 'rational-simplification',
  category: 'algebra',
  subcategory: 'rational-expressions',
  difficulty: 3,
  template: 'Simplify: $\\frac{{{a}}x + {{b}}}{{{c}}x + {{d}}}$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 10 },
    { name: 'b', type: 'integer', min: 1, max: 10 },
    { name: 'c', type: 'integer', min: 1, max: 10 },
    { name: 'd', type: 'integer', min: 1, max: 10 },
  ],
  solution: (params) => {
    const { a, b, c, d } = narrow<{ a: number; b: number; c: number; d: number }>(params);

    // Check if they have a common factor
    const gcdNum = gcd(a, b);
    const gcdDen = gcd(c, d);
    const commonGcd = gcd(gcdNum, gcdDen);

    if (commonGcd > 1) {
      return {
        answer: `\\frac{${a / commonGcd}x + ${b / commonGcd}}{${c / commonGcd}x + ${d / commonGcd}}`,
        steps: [
          {
            description: `Factor out common factor ${commonGcd}`,
            expression: `\\frac{${commonGcd}(${a / commonGcd}x + ${b / commonGcd})}{${commonGcd}(${c / commonGcd}x + ${d / commonGcd})}`,
          },
          {
            description: 'Cancel common factor',
            expression: `\\frac{${a / commonGcd}x + ${b / commonGcd}}{${c / commonGcd}x + ${d / commonGcd}}`,
          },
        ],
      };
    }

    return {
      answer: `\\frac{${a}x + ${b}}{${c}x + ${d}}`,
      steps: [
        {
          description: 'Already in simplest form',
          expression: `\\frac{${a}x + ${b}}{${c}x + ${d}}`,
        },
      ],
    };
  },
  hints: [
    () => 'Look for common factors in numerator and denominator',
    () => 'Factor out the greatest common factor',
    () => 'Cancel common factors',
  ],
  commonMistakes: [],
  tags: ['rational-expressions', 'simplification', 'fractions'],
  prerequisites: ['fractions', 'factoring'],
  learningObjectives: ['Simplify rational expressions', 'Find common factors'],
});

/**
 * Helper function: GCD
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);

  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }

  return a;
}

/**
 * Helper function: Flip inequality
 */
function flipInequality(op: string): string {
  switch (op) {
    case '<':
      return '>';
    case '>':
      return '<';
    case '\\leq':
      return '\\geq';
    case '\\geq':
      return '\\leq';
    default:
      return op;
  }
}

/**
 * Export all algebra templates
 */
export const algebraTemplates: ProblemTemplate[] = [
  linearEquationTemplate,
  quadraticEquationTemplate,
  systemLinearTemplate,
  factorizationTemplate,
  linearInequalityTemplate,
  absoluteValueTemplate,
  radicalEquationTemplate,
  rationalSimplificationTemplate,
];
