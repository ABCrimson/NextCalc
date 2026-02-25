/**
 * Problem Database
 *
 * Collection of mathematical problems organized by topic and difficulty.
 */

import { MathTopic } from '../knowledge/definitions';
import type { Problem } from './types';
import { DifficultyLevel, ProblemType } from './types';

/**
 * Problem database
 */
export const PROBLEMS: ReadonlyArray<Problem> = [
  // Calculus - Beginner
  {
    id: 'calc-deriv-001',
    title: 'Basic Derivative',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Find the derivative of f(x) = x² + 3x - 5',
    latex: 'f(x) = x^2 + 3x - 5',
    solution: {
      answer: '2x + 3',
      explanation: 'Apply the power rule to each term: d/dx(x²) = 2x, d/dx(3x) = 3, d/dx(-5) = 0',
      steps: [
        {
          stepNumber: 1,
          description: 'Apply power rule to x²',
          expression: 'd/dx(x²) = 2x',
          explanation: 'The power rule states: d/dx(xⁿ) = n·xⁿ⁻¹',
          rule: 'Power Rule',
        },
        {
          stepNumber: 2,
          description: 'Apply power rule to 3x',
          expression: 'd/dx(3x) = 3',
          explanation: '3x = 3x¹, so derivative is 3·1·x⁰ = 3',
          rule: 'Power Rule',
        },
        {
          stepNumber: 3,
          description: 'Derivative of constant',
          expression: 'd/dx(-5) = 0',
          explanation: 'The derivative of any constant is 0',
          rule: 'Constant Rule',
        },
        {
          stepNumber: 4,
          description: 'Combine terms',
          expression: 'f\'(x) = 2x + 3',
          explanation: 'Sum the derivatives of each term',
          rule: 'Sum Rule',
        },
      ],
      insights: [
        'The power rule is one of the most fundamental differentiation rules',
        'Constants disappear when taking derivatives',
        'Differentiation is linear: the derivative of a sum is the sum of derivatives',
      ],
    },
    hints: [
      {
        order: 1,
        text: 'Remember the power rule: d/dx(xⁿ) = n·xⁿ⁻¹',
        reveals: 'formula',
        cost: 5,
      },
      {
        order: 2,
        text: 'Apply the power rule to each term separately',
        reveals: 'approach',
        cost: 10,
      },
      {
        order: 3,
        text: 'For x²: bring down the 2, reduce power by 1 to get 2x',
        reveals: 'technique',
        cost: 15,
      },
    ],
    prerequisites: ['derivative', 'polynomial'],
    related: ['calc-deriv-002', 'calc-deriv-003'],
    tags: ['derivative', 'power-rule', 'polynomial'],
    estimatedTime: 5,
    points: 10,
  },

  {
    id: 'calc-integ-001',
    title: 'Basic Integration',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Find ∫(3x² + 2x) dx',
    latex: '\\int (3x^2 + 2x)\\,dx',
    solution: {
      answer: 'x³ + x² + C',
      explanation: 'Apply the power rule for integration to each term',
      steps: [
        {
          stepNumber: 1,
          description: 'Integrate 3x²',
          expression: '∫3x² dx = x³',
          explanation: 'Increase power by 1, divide by new power: 3x³/3 = x³',
          rule: 'Power Rule for Integration',
        },
        {
          stepNumber: 2,
          description: 'Integrate 2x',
          expression: '∫2x dx = x²',
          explanation: '2x²/2 = x²',
          rule: 'Power Rule for Integration',
        },
        {
          stepNumber: 3,
          description: 'Add constant of integration',
          expression: '∫(3x² + 2x) dx = x³ + x² + C',
          explanation: 'Always add an arbitrary constant C for indefinite integrals',
          rule: 'Constant of Integration',
        },
      ],
      insights: [
        'Integration is the reverse of differentiation',
        'Always add +C for indefinite integrals',
        'The power rule for integration: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C',
      ],
    },
    hints: [
      {
        order: 1,
        text: 'Integration is the opposite of differentiation',
        reveals: 'approach',
        cost: 5,
      },
      {
        order: 2,
        text: 'Use the power rule: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C',
        reveals: 'formula',
        cost: 10,
      },
      {
        order: 3,
        text: 'Don\'t forget the constant of integration +C',
        reveals: 'technique',
        cost: 15,
      },
    ],
    prerequisites: ['integral', 'polynomial', 'derivative'],
    related: ['calc-integ-002'],
    tags: ['integration', 'antiderivative', 'power-rule'],
    estimatedTime: 5,
    points: 10,
  },

  // Algebra - Intermediate
  {
    id: 'alg-quad-001',
    title: 'Quadratic Equation',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Solve: x² - 5x + 6 = 0',
    latex: 'x^2 - 5x + 6 = 0',
    solution: {
      answer: [2, 3],
      explanation: 'Factor the quadratic or use the quadratic formula',
      steps: [
        {
          stepNumber: 1,
          description: 'Identify coefficients',
          expression: 'a=1, b=-5, c=6',
          explanation: 'Standard form: ax² + bx + c = 0',
        },
        {
          stepNumber: 2,
          description: 'Try factoring',
          expression: '(x - 2)(x - 3) = 0',
          explanation: 'Find two numbers that multiply to 6 and add to -5',
          rule: 'Factoring',
        },
        {
          stepNumber: 3,
          description: 'Solve each factor',
          expression: 'x - 2 = 0 or x - 3 = 0',
          explanation: 'Set each factor equal to zero',
          rule: 'Zero Product Property',
        },
        {
          stepNumber: 4,
          description: 'Final answers',
          expression: 'x = 2 or x = 3',
          explanation: 'These are the two solutions',
        },
      ],
      alternativeSolutions: [
        {
          method: 'Quadratic Formula',
          explanation: 'Use x = [-b ± √(b²-4ac)]/(2a) = [5 ± √(25-24)]/2 = [5 ± 1]/2 = 2 or 3',
        },
      ],
      insights: [
        'Factoring is often faster than the quadratic formula when it works',
        'The solutions are where the parabola crosses the x-axis',
        'Always check your solutions by substituting back into the original equation',
      ],
    },
    hints: [
      {
        order: 1,
        text: 'Try to factor the quadratic first',
        reveals: 'approach',
        cost: 5,
      },
      {
        order: 2,
        text: 'Find two numbers that multiply to 6 and add to -5',
        reveals: 'technique',
        cost: 10,
      },
      {
        order: 3,
        text: 'The factors are (x - 2) and (x - 3)',
        reveals: 'partial-solution',
        cost: 20,
      },
    ],
    prerequisites: ['quadratic-formula', 'factorization'],
    related: ['alg-quad-002'],
    tags: ['quadratic', 'factoring', 'equation-solving'],
    estimatedTime: 8,
    points: 20,
  },

  // Number Theory - Advanced
  {
    id: 'numth-prime-001',
    title: 'Prime Factorization',
    topic: MathTopic.NumberTheory,
    difficulty: DifficultyLevel.Advanced,
    type: ProblemType.Computation,
    statement: 'Find the prime factorization of 504',
    solution: {
      answer: '2³ × 3² × 7',
      explanation: 'Repeatedly divide by smallest prime factors',
      steps: [
        {
          stepNumber: 1,
          description: 'Divide by 2',
          expression: '504 = 2 × 252',
          explanation: '504 is even, so divisible by 2',
        },
        {
          stepNumber: 2,
          description: 'Continue dividing by 2',
          expression: '252 = 2 × 126, then 126 = 2 × 63',
          explanation: 'Keep dividing by 2 until you get an odd number',
        },
        {
          stepNumber: 3,
          description: 'Divide by 3',
          expression: '63 = 3 × 21, then 21 = 3 × 7',
          explanation: '63 is divisible by 3 (sum of digits is 9)',
        },
        {
          stepNumber: 4,
          description: 'Final result',
          expression: '504 = 2³ × 3² × 7',
          explanation: 'Collect all prime factors: three 2s, two 3s, and one 7',
          rule: 'Fundamental Theorem of Arithmetic',
        },
      ],
      insights: [
        'Every integer has a unique prime factorization',
        'Start with the smallest prime and work your way up',
        'The sum of digits test helps check divisibility by 3',
      ],
    },
    hints: [
      {
        order: 1,
        text: 'Start by dividing by the smallest prime: 2',
        reveals: 'approach',
        cost: 5,
      },
      {
        order: 2,
        text: '504 = 2 × 252, keep going with 252',
        reveals: 'technique',
        cost: 10,
      },
      {
        order: 3,
        text: 'You\'ll need to divide by 2 three times',
        reveals: 'partial-solution',
        cost: 15,
      },
    ],
    prerequisites: ['prime-number', 'divisibility', 'fundamental-theorem-arithmetic'],
    related: ['numth-prime-002'],
    tags: ['prime', 'factorization', 'number-theory'],
    estimatedTime: 10,
    points: 30,
  },

  // Linear Algebra - Intermediate
  {
    id: 'linalg-matrix-001',
    title: 'Matrix Multiplication',
    topic: MathTopic.LinearAlgebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Compute AB where A = [[1,2], [3,4]] and B = [[5,6], [7,8]]',
    latex: 'A = \\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}, B = \\begin{bmatrix} 5 & 6 \\\\ 7 & 8 \\end{bmatrix}',
    solution: {
      answer: '[[19, 22], [43, 50]]',
      explanation: 'Multiply rows of A by columns of B',
      steps: [
        {
          stepNumber: 1,
          description: 'Entry (1,1)',
          expression: '1×5 + 2×7 = 19',
          explanation: 'First row of A times first column of B',
        },
        {
          stepNumber: 2,
          description: 'Entry (1,2)',
          expression: '1×6 + 2×8 = 22',
          explanation: 'First row of A times second column of B',
        },
        {
          stepNumber: 3,
          description: 'Entry (2,1)',
          expression: '3×5 + 4×7 = 43',
          explanation: 'Second row of A times first column of B',
        },
        {
          stepNumber: 4,
          description: 'Entry (2,2)',
          expression: '3×6 + 4×8 = 50',
          explanation: 'Second row of A times second column of B',
        },
      ],
      insights: [
        'Matrix multiplication is not commutative: AB ≠ BA in general',
        'The (i,j) entry is the dot product of row i and column j',
        'Can only multiply if # columns of A = # rows of B',
      ],
    },
    hints: [
      {
        order: 1,
        text: 'Each entry is a dot product of a row and a column',
        reveals: 'approach',
        cost: 5,
      },
      {
        order: 2,
        text: 'For entry (1,1): multiply 1×5 + 2×7',
        reveals: 'technique',
        cost: 10,
      },
    ],
    prerequisites: ['matrix', 'dot-product'],
    related: ['linalg-matrix-002'],
    tags: ['matrix', 'multiplication', 'linear-algebra'],
    estimatedTime: 10,
    points: 25,
  },

  // Additional Calculus Problems
  {
    id: 'calc-deriv-002',
    title: 'Product Rule',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Find the derivative of f(x) = (2x + 1)(x² - 3)',
    latex: 'f(x) = (2x + 1)(x^2 - 3)',
    solution: {
      answer: '6x² + 2x - 6',
      explanation: 'Apply the product rule: (uv)\' = u\'v + uv\'',
      steps: [
        {
          stepNumber: 1,
          description: 'Identify u and v',
          expression: 'u = 2x + 1, v = x² - 3',
        },
        {
          stepNumber: 2,
          description: 'Find derivatives',
          expression: 'u\' = 2, v\' = 2x',
          rule: 'Power Rule',
        },
        {
          stepNumber: 3,
          description: 'Apply product rule',
          expression: 'f\'(x) = (2)(x² - 3) + (2x + 1)(2x)',
          rule: 'Product Rule',
        },
        {
          stepNumber: 4,
          description: 'Simplify',
          expression: 'f\'(x) = 2x² - 6 + 4x² + 2x = 6x² + 2x - 6',
        },
      ],
      insights: ['Product rule is essential for differentiating products of functions'],
    },
    hints: [
      { order: 1, text: 'Use the product rule: (uv)\' = u\'v + uv\'', reveals: 'formula', cost: 5 },
      { order: 2, text: 'Let u = 2x + 1 and v = x² - 3', reveals: 'approach', cost: 10 },
    ],
    prerequisites: ['derivative', 'power-rule'],
    related: ['calc-deriv-001', 'calc-deriv-003'],
    tags: ['derivative', 'product-rule'],
    estimatedTime: 8,
    points: 20,
  },

  {
    id: 'calc-deriv-003',
    title: 'Chain Rule',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Find the derivative of f(x) = (3x² + 1)⁵',
    latex: 'f(x) = (3x^2 + 1)^5',
    solution: {
      answer: '30x(3x² + 1)⁴',
      explanation: 'Apply the chain rule',
      steps: [
        {
          stepNumber: 1,
          description: 'Identify outer and inner functions',
          expression: 'outer: u⁵, inner: u = 3x² + 1',
        },
        {
          stepNumber: 2,
          description: 'Derivative of outer',
          expression: 'd/du(u⁵) = 5u⁴',
          rule: 'Power Rule',
        },
        {
          stepNumber: 3,
          description: 'Derivative of inner',
          expression: 'd/dx(3x² + 1) = 6x',
          rule: 'Power Rule',
        },
        {
          stepNumber: 4,
          description: 'Apply chain rule',
          expression: 'f\'(x) = 5(3x² + 1)⁴ · 6x = 30x(3x² + 1)⁴',
          rule: 'Chain Rule',
        },
      ],
      insights: ['Chain rule is for composite functions'],
    },
    hints: [
      { order: 1, text: 'Use chain rule: d/dx[f(g(x))] = f\'(g(x)) · g\'(x)', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['derivative', 'power-rule', 'composition'],
    related: ['calc-deriv-001', 'calc-deriv-002'],
    tags: ['derivative', 'chain-rule'],
    estimatedTime: 10,
    points: 20,
  },

  {
    id: 'calc-limit-001',
    title: 'Basic Limit',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Evaluate lim(x→2) (x² + 3x - 1)',
    latex: '\\lim_{x \\to 2} (x^2 + 3x - 1)',
    solution: {
      answer: '9',
      explanation: 'Direct substitution for continuous functions',
      steps: [
        {
          stepNumber: 1,
          description: 'Substitute x = 2',
          expression: '(2)² + 3(2) - 1 = 4 + 6 - 1 = 9',
        },
      ],
      insights: ['For polynomial functions, just substitute the limit point'],
    },
    hints: [
      { order: 1, text: 'Polynomials are continuous everywhere', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['limit', 'continuity'],
    related: ['calc-limit-002'],
    tags: ['limit', 'continuity', 'polynomial'],
    estimatedTime: 3,
    points: 10,
  },

  {
    id: 'calc-limit-002',
    title: 'Limit with Indeterminate Form',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Evaluate lim(x→3) (x² - 9)/(x - 3)',
    latex: '\\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3}',
    solution: {
      answer: '6',
      explanation: 'Factor and cancel before substituting',
      steps: [
        {
          stepNumber: 1,
          description: 'Factor numerator',
          expression: '(x² - 9) = (x - 3)(x + 3)',
          rule: 'Difference of Squares',
        },
        {
          stepNumber: 2,
          description: 'Cancel common factor',
          expression: '(x - 3)(x + 3)/(x - 3) = x + 3',
        },
        {
          stepNumber: 3,
          description: 'Substitute x = 3',
          expression: '3 + 3 = 6',
        },
      ],
      insights: ['Factor to eliminate indeterminate forms'],
    },
    hints: [
      { order: 1, text: 'Factor the numerator', reveals: 'approach', cost: 5 },
      { order: 2, text: 'x² - 9 is a difference of squares', reveals: 'technique', cost: 10 },
    ],
    prerequisites: ['limit', 'factoring'],
    related: ['calc-limit-001'],
    tags: ['limit', 'factoring', 'indeterminate'],
    estimatedTime: 7,
    points: 15,
  },

  // Additional Algebra Problems
  {
    id: 'alg-linear-001',
    title: 'Linear Equation',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Solve for x: 3x + 7 = 22',
    latex: '3x + 7 = 22',
    solution: {
      answer: '5',
      explanation: 'Isolate x by inverse operations',
      steps: [
        {
          stepNumber: 1,
          description: 'Subtract 7 from both sides',
          expression: '3x = 15',
        },
        {
          stepNumber: 2,
          description: 'Divide by 3',
          expression: 'x = 5',
        },
      ],
      insights: ['Use inverse operations to isolate the variable'],
    },
    hints: [
      { order: 1, text: 'Subtract 7 from both sides', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['linear-equations'],
    related: ['alg-linear-002'],
    tags: ['linear', 'equation-solving'],
    estimatedTime: 3,
    points: 10,
  },

  {
    id: 'alg-linear-002',
    title: 'Linear Equation with Fractions',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Solve for x: (2x + 1)/3 = 5',
    latex: '\\frac{2x + 1}{3} = 5',
    solution: {
      answer: '7',
      explanation: 'Multiply both sides by 3, then solve',
      steps: [
        {
          stepNumber: 1,
          description: 'Multiply both sides by 3',
          expression: '2x + 1 = 15',
        },
        {
          stepNumber: 2,
          description: 'Subtract 1',
          expression: '2x = 14',
        },
        {
          stepNumber: 3,
          description: 'Divide by 2',
          expression: 'x = 7',
        },
      ],
      insights: ['Eliminate fractions by multiplying by the denominator'],
    },
    hints: [
      { order: 1, text: 'Multiply both sides by 3 to eliminate the fraction', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['linear-equations', 'fractions'],
    related: ['alg-linear-001'],
    tags: ['linear', 'fractions', 'equation-solving'],
    estimatedTime: 5,
    points: 15,
  },

  {
    id: 'alg-system-001',
    title: 'System of Equations',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Solve the system: 2x + y = 7, x - y = 2',
    latex: '\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}',
    solution: {
      answer: 'x = 3, y = 1',
      explanation: 'Use elimination or substitution',
      steps: [
        {
          stepNumber: 1,
          description: 'Add equations',
          expression: '3x = 9',
          explanation: 'Adding eliminates y',
        },
        {
          stepNumber: 2,
          description: 'Solve for x',
          expression: 'x = 3',
        },
        {
          stepNumber: 3,
          description: 'Substitute into first equation',
          expression: '2(3) + y = 7, so y = 1',
        },
      ],
      insights: ['Elimination works when coefficients can easily cancel'],
    },
    hints: [
      { order: 1, text: 'Try adding the two equations', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['linear-equations', 'systems'],
    related: ['alg-system-002'],
    tags: ['systems', 'elimination'],
    estimatedTime: 7,
    points: 20,
  },

  {
    id: 'alg-poly-001',
    title: 'Polynomial Factoring',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Factor: x² + 7x + 12',
    latex: 'x^2 + 7x + 12',
    solution: {
      answer: '(x + 3)(x + 4)',
      explanation: 'Find two numbers that multiply to 12 and add to 7',
      steps: [
        {
          stepNumber: 1,
          description: 'Find factors of 12',
          expression: '12 = 1×12 = 2×6 = 3×4',
        },
        {
          stepNumber: 2,
          description: 'Find pair that adds to 7',
          expression: '3 + 4 = 7 ✓',
        },
        {
          stepNumber: 3,
          description: 'Write factors',
          expression: '(x + 3)(x + 4)',
        },
      ],
      insights: ['Factoring is the reverse of expanding'],
    },
    hints: [
      { order: 1, text: 'Find two numbers that multiply to 12 and add to 7', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['polynomials', 'factoring'],
    related: ['alg-poly-002'],
    tags: ['polynomials', 'factoring'],
    estimatedTime: 5,
    points: 15,
  },

  {
    id: 'alg-exp-001',
    title: 'Exponent Rules',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Simplify: x³ · x⁴',
    latex: 'x^3 \\cdot x^4',
    solution: {
      answer: 'x⁷',
      explanation: 'Add exponents when multiplying with same base',
      steps: [
        {
          stepNumber: 1,
          description: 'Apply exponent rule',
          expression: 'x³ · x⁴ = x³⁺⁴ = x⁷',
          rule: 'Product of Powers',
        },
      ],
      insights: ['When multiplying powers with the same base, add the exponents'],
    },
    hints: [
      { order: 1, text: 'Use the rule: aᵐ · aⁿ = aᵐ⁺ⁿ', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['exponents'],
    related: ['alg-exp-002'],
    tags: ['exponents', 'simplification'],
    estimatedTime: 3,
    points: 10,
  },

  {
    id: 'alg-rational-001',
    title: 'Simplify Rational Expression',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Simplify: (x² - 4)/(x + 2)',
    latex: '\\frac{x^2 - 4}{x + 2}',
    solution: {
      answer: 'x - 2',
      explanation: 'Factor and cancel',
      steps: [
        {
          stepNumber: 1,
          description: 'Factor numerator',
          expression: 'x² - 4 = (x - 2)(x + 2)',
          rule: 'Difference of Squares',
        },
        {
          stepNumber: 2,
          description: 'Cancel common factor',
          expression: '(x - 2)(x + 2)/(x + 2) = x - 2',
        },
      ],
      insights: ['Always factor before simplifying rational expressions'],
    },
    hints: [
      { order: 1, text: 'Factor the numerator first', reveals: 'approach', cost: 5 },
      { order: 2, text: 'x² - 4 is a difference of squares', reveals: 'technique', cost: 10 },
    ],
    prerequisites: ['factoring', 'rational-expressions'],
    related: ['alg-rational-002'],
    tags: ['rational-expressions', 'factoring'],
    estimatedTime: 6,
    points: 15,
  },

  // Geometry Problems
  {
    id: 'geom-triangle-001',
    title: 'Pythagorean Theorem',
    topic: MathTopic.Geometry,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'A right triangle has legs of length 3 and 4. Find the hypotenuse.',
    latex: 'a = 3, b = 4, c = ?',
    solution: {
      answer: '5',
      explanation: 'Apply Pythagorean theorem',
      steps: [
        {
          stepNumber: 1,
          description: 'Set up equation',
          expression: 'c² = a² + b² = 3² + 4²',
          rule: 'Pythagorean Theorem',
        },
        {
          stepNumber: 2,
          description: 'Calculate',
          expression: 'c² = 9 + 16 = 25',
        },
        {
          stepNumber: 3,
          description: 'Take square root',
          expression: 'c = 5',
        },
      ],
      insights: ['3-4-5 is a Pythagorean triple'],
    },
    hints: [
      { order: 1, text: 'Use a² + b² = c²', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['pythagorean-theorem'],
    related: ['geom-triangle-002'],
    tags: ['geometry', 'pythagorean', 'triangles'],
    estimatedTime: 5,
    points: 10,
  },

  {
    id: 'geom-circle-001',
    title: 'Circle Area',
    topic: MathTopic.Geometry,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Find the area of a circle with radius 5',
    latex: 'r = 5',
    solution: {
      answer: '25π ≈ 78.54',
      explanation: 'Use area formula A = πr²',
      steps: [
        {
          stepNumber: 1,
          description: 'Apply formula',
          expression: 'A = πr² = π(5)² = 25π',
        },
      ],
      insights: ['Circle area grows with the square of the radius'],
    },
    hints: [
      { order: 1, text: 'Use A = πr²', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['circles', 'area'],
    related: ['geom-circle-002'],
    tags: ['geometry', 'circles', 'area'],
    estimatedTime: 3,
    points: 10,
  },

  {
    id: 'geom-volume-001',
    title: 'Volume of Cylinder',
    topic: MathTopic.Geometry,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Find the volume of a cylinder with radius 3 and height 10',
    latex: 'r = 3, h = 10',
    solution: {
      answer: '90π ≈ 282.74',
      explanation: 'Use V = πr²h',
      steps: [
        {
          stepNumber: 1,
          description: 'Apply formula',
          expression: 'V = πr²h = π(3)²(10) = 90π',
        },
      ],
      insights: ['Cylinder volume is base area times height'],
    },
    hints: [
      { order: 1, text: 'Use V = πr²h', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['circles', 'volume'],
    related: ['geom-volume-002'],
    tags: ['geometry', 'volume', 'cylinder'],
    estimatedTime: 5,
    points: 15,
  },

  // Additional Number Theory Problems
  {
    id: 'numth-gcd-001',
    title: 'Greatest Common Divisor',
    topic: MathTopic.NumberTheory,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Find GCD(48, 18)',
    latex: '\\gcd(48, 18)',
    solution: {
      answer: '6',
      explanation: 'Use Euclidean algorithm',
      steps: [
        {
          stepNumber: 1,
          description: 'Divide 48 by 18',
          expression: '48 = 18(2) + 12',
        },
        {
          stepNumber: 2,
          description: 'Divide 18 by 12',
          expression: '18 = 12(1) + 6',
        },
        {
          stepNumber: 3,
          description: 'Divide 12 by 6',
          expression: '12 = 6(2) + 0',
        },
        {
          stepNumber: 4,
          description: 'GCD is last non-zero remainder',
          expression: 'GCD(48, 18) = 6',
        },
      ],
      insights: ['Euclidean algorithm is efficient for finding GCD'],
    },
    hints: [
      { order: 1, text: 'Use the Euclidean algorithm', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['gcd', 'euclidean-algorithm'],
    related: ['numth-gcd-002'],
    tags: ['number-theory', 'gcd'],
    estimatedTime: 8,
    points: 20,
  },

  {
    id: 'numth-mod-001',
    title: 'Modular Arithmetic',
    topic: MathTopic.NumberTheory,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Find 37 mod 5',
    latex: '37 \\bmod 5',
    solution: {
      answer: '2',
      explanation: 'Find remainder when dividing',
      steps: [
        {
          stepNumber: 1,
          description: 'Divide 37 by 5',
          expression: '37 = 5(7) + 2',
        },
        {
          stepNumber: 2,
          description: 'Remainder is answer',
          expression: '37 ≡ 2 (mod 5)',
        },
      ],
      insights: ['Modular arithmetic is about remainders'],
    },
    hints: [
      { order: 1, text: 'Find the remainder when dividing 37 by 5', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['modular-arithmetic'],
    related: ['numth-mod-002'],
    tags: ['number-theory', 'modular-arithmetic'],
    estimatedTime: 4,
    points: 15,
  },

  // Probability and Statistics
  {
    id: 'prob-basic-001',
    title: 'Basic Probability',
    topic: MathTopic.Probability,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'What is the probability of rolling a 4 on a fair six-sided die?',
    solution: {
      answer: '1/6',
      explanation: 'One favorable outcome out of six possible',
      steps: [
        {
          stepNumber: 1,
          description: 'Count favorable outcomes',
          expression: '1 (rolling a 4)',
        },
        {
          stepNumber: 2,
          description: 'Count total outcomes',
          expression: '6 (possible rolls)',
        },
        {
          stepNumber: 3,
          description: 'Calculate probability',
          expression: 'P(4) = 1/6',
        },
      ],
      insights: ['Probability = favorable outcomes / total outcomes'],
    },
    hints: [
      { order: 1, text: 'How many ways can you roll a 4? How many total outcomes?', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['probability'],
    related: ['prob-basic-002'],
    tags: ['probability', 'basic'],
    estimatedTime: 3,
    points: 10,
  },

  {
    id: 'prob-comb-001',
    title: 'Combinations',
    topic: MathTopic.Probability,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'How many ways can you choose 3 items from 5 items?',
    latex: 'C(5, 3) = ?',
    solution: {
      answer: '10',
      explanation: 'Use combination formula',
      steps: [
        {
          stepNumber: 1,
          description: 'Apply formula',
          expression: 'C(n,r) = n!/(r!(n-r)!)',
        },
        {
          stepNumber: 2,
          description: 'Substitute values',
          expression: 'C(5,3) = 5!/(3!2!) = 120/(6·2) = 10',
        },
      ],
      insights: ['Order doesn\'t matter in combinations'],
    },
    hints: [
      { order: 1, text: 'Use C(n,r) = n!/(r!(n-r)!)', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['combinations', 'factorials'],
    related: ['prob-comb-002'],
    tags: ['probability', 'combinations'],
    estimatedTime: 6,
    points: 15,
  },

  {
    id: 'prob-perm-001',
    title: 'Permutations',
    topic: MathTopic.Probability,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'How many ways can you arrange 3 letters from the word "MATH"?',
    latex: 'P(4, 3) = ?',
    solution: {
      answer: '24',
      explanation: 'Use permutation formula',
      steps: [
        {
          stepNumber: 1,
          description: 'Apply formula',
          expression: 'P(n,r) = n!/(n-r)!',
        },
        {
          stepNumber: 2,
          description: 'Substitute values',
          expression: 'P(4,3) = 4!/1! = 24',
        },
      ],
      insights: ['Order matters in permutations'],
    },
    hints: [
      { order: 1, text: 'Use P(n,r) = n!/(n-r)!', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['permutations', 'factorials'],
    related: ['prob-perm-002'],
    tags: ['probability', 'permutations'],
    estimatedTime: 6,
    points: 15,
  },

  // Additional problems to reach 50+ total
  {
    id: 'calc-integ-002',
    title: 'Definite Integral',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Evaluate ∫₀² x² dx',
    latex: '\\int_0^2 x^2\\,dx',
    solution: {
      answer: '8/3',
      explanation: 'Find antiderivative and evaluate at bounds',
      steps: [
        {
          stepNumber: 1,
          description: 'Find antiderivative',
          expression: '∫x² dx = x³/3',
        },
        {
          stepNumber: 2,
          description: 'Evaluate at bounds',
          expression: '[x³/3]₀² = 8/3 - 0 = 8/3',
          rule: 'Fundamental Theorem of Calculus',
        },
      ],
      insights: ['Definite integrals give area under curve'],
    },
    hints: [
      { order: 1, text: 'Find the antiderivative first', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['integration', 'ftc'],
    related: ['calc-integ-001'],
    tags: ['integration', 'definite-integral'],
    estimatedTime: 7,
    points: 20,
  },

  {
    id: 'alg-abs-001',
    title: 'Absolute Value Equation',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Intermediate,
    type: ProblemType.Computation,
    statement: 'Solve: |x - 3| = 5',
    latex: '|x - 3| = 5',
    solution: {
      answer: 'x = 8 or x = -2',
      explanation: 'Split into two cases',
      steps: [
        {
          stepNumber: 1,
          description: 'Case 1: x - 3 = 5',
          expression: 'x = 8',
        },
        {
          stepNumber: 2,
          description: 'Case 2: x - 3 = -5',
          expression: 'x = -2',
        },
      ],
      insights: ['Absolute value equations have two solutions'],
    },
    hints: [
      { order: 1, text: 'Consider both positive and negative cases', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['absolute-value'],
    related: ['alg-abs-002'],
    tags: ['absolute-value', 'equations'],
    estimatedTime: 6,
    points: 15,
  },

  {
    id: 'geom-angle-001',
    title: 'Triangle Angles',
    topic: MathTopic.Geometry,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Two angles of a triangle are 45° and 60°. Find the third angle.',
    solution: {
      answer: '75°',
      explanation: 'Sum of angles in a triangle is 180°',
      steps: [
        {
          stepNumber: 1,
          description: 'Set up equation',
          expression: '45° + 60° + x = 180°',
        },
        {
          stepNumber: 2,
          description: 'Solve for x',
          expression: 'x = 180° - 45° - 60° = 75°',
        },
      ],
      insights: ['Triangle angles always sum to 180°'],
    },
    hints: [
      { order: 1, text: 'The sum of angles in a triangle is 180°', reveals: 'formula', cost: 5 },
    ],
    prerequisites: ['triangles', 'angles'],
    related: ['geom-angle-002'],
    tags: ['geometry', 'triangles', 'angles'],
    estimatedTime: 4,
    points: 10,
  },

  {
    id: 'linalg-vector-001',
    title: 'Vector Addition',
    topic: MathTopic.LinearAlgebra,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Add vectors v = (2, 3) and w = (1, -1)',
    latex: '\\vec{v} = (2, 3), \\vec{w} = (1, -1)',
    solution: {
      answer: '(3, 2)',
      explanation: 'Add corresponding components',
      steps: [
        {
          stepNumber: 1,
          description: 'Add x-components',
          expression: '2 + 1 = 3',
        },
        {
          stepNumber: 2,
          description: 'Add y-components',
          expression: '3 + (-1) = 2',
        },
        {
          stepNumber: 3,
          description: 'Combine',
          expression: 'v + w = (3, 2)',
        },
      ],
      insights: ['Vector addition is component-wise'],
    },
    hints: [
      { order: 1, text: 'Add corresponding components', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['vectors'],
    related: ['linalg-vector-002'],
    tags: ['linear-algebra', 'vectors'],
    estimatedTime: 4,
    points: 10,
  },

  {
    id: 'calc-optim-001',
    title: 'Optimization Problem',
    topic: MathTopic.Calculus,
    difficulty: DifficultyLevel.Advanced,
    type: ProblemType.Computation,
    statement: 'Find the maximum value of f(x) = -x² + 4x + 5',
    latex: 'f(x) = -x^2 + 4x + 5',
    solution: {
      answer: '9 at x = 2',
      explanation: 'Find critical points by setting derivative to zero',
      steps: [
        {
          stepNumber: 1,
          description: 'Find derivative',
          expression: 'f\'(x) = -2x + 4',
        },
        {
          stepNumber: 2,
          description: 'Set derivative to zero',
          expression: '-2x + 4 = 0, x = 2',
        },
        {
          stepNumber: 3,
          description: 'Evaluate at critical point',
          expression: 'f(2) = -(2)² + 4(2) + 5 = 9',
        },
      ],
      insights: ['Parabolas opening downward have a maximum at the vertex'],
    },
    hints: [
      { order: 1, text: 'Find where f\'(x) = 0', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['derivative', 'optimization'],
    related: ['calc-optim-002'],
    tags: ['calculus', 'optimization', 'max-min'],
    estimatedTime: 10,
    points: 30,
  },

  {
    id: 'stats-mean-001',
    title: 'Mean Calculation',
    topic: MathTopic.Probability,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Find the mean of the data set: 4, 7, 9, 10, 5',
    solution: {
      answer: '7',
      explanation: 'Sum values and divide by count',
      steps: [
        {
          stepNumber: 1,
          description: 'Sum values',
          expression: '4 + 7 + 9 + 10 + 5 = 35',
        },
        {
          stepNumber: 2,
          description: 'Count values',
          expression: 'n = 5',
        },
        {
          stepNumber: 3,
          description: 'Calculate mean',
          expression: 'mean = 35/5 = 7',
        },
      ],
      insights: ['Mean is the average value'],
    },
    hints: [
      { order: 1, text: 'Add all values and divide by the number of values', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['statistics', 'mean'],
    related: ['stats-median-001'],
    tags: ['statistics', 'mean', 'average'],
    estimatedTime: 4,
    points: 10,
  },

  {
    id: 'trigBasic-001',
    title: 'Basic Trigonometry',
    topic: MathTopic.Algebra,
    difficulty: DifficultyLevel.Beginner,
    type: ProblemType.Computation,
    statement: 'Find sin(30°)',
    latex: '\\sin(30^\\circ)',
    solution: {
      answer: '1/2',
      explanation: 'Use special angle values',
      steps: [
        {
          stepNumber: 1,
          description: 'Recall special angle',
          expression: 'sin(30°) = 1/2',
        },
      ],
      insights: ['30-60-90 triangles have special ratios'],
    },
    hints: [
      { order: 1, text: '30° is a special angle', reveals: 'approach', cost: 5 },
    ],
    prerequisites: ['trigonometry', 'special-angles'],
    related: ['trig-basic-002'],
    tags: ['trigonometry', 'special-angles'],
    estimatedTime: 3,
    points: 10,
  },
];

/**
 * Get problem by ID
 */
export function getProblem(id: string): Problem | undefined {
  return PROBLEMS.find(p => p.id === id);
}

/**
 * Get problems by topic
 */
export function getProblemsByTopic(topic: MathTopic): ReadonlyArray<Problem> {
  return PROBLEMS.filter(p => p.topic === topic);
}

/**
 * Get problems by difficulty
 */
export function getProblemsByDifficulty(difficulty: DifficultyLevel): ReadonlyArray<Problem> {
  return PROBLEMS.filter(p => p.difficulty === difficulty);
}

/**
 * Search problems
 */
export function searchProblems(query: string): ReadonlyArray<Problem> {
  const lowerQuery = query.toLowerCase();
  return PROBLEMS.filter(
    p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.statement.toLowerCase().includes(lowerQuery) ||
      p.tags.some(tag => tag.includes(lowerQuery))
  );
}

/**
 * Get all problems
 */
export function getAllProblems(): ReadonlyArray<Problem> {
  return PROBLEMS;
}

/**
 * Get problem by ID (alias for getProblem for backward compatibility)
 */
export function getProblemById(id: string): Problem | undefined {
  return getProblem(id);
}

/**
 * Get related problems
 */
export function getRelatedProblems(id: string): ReadonlyArray<Problem> {
  const problem = getProblem(id);
  if (!problem || !problem.related) {
    return [];
  }

  // Get all related problems by ID
  const relatedIds = problem.related;
  return PROBLEMS.filter(p => relatedIds.includes(p.id));
}
