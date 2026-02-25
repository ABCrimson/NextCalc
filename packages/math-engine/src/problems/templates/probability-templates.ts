/**
 * Probability and Statistics Problem Templates
 *
 * Templates for generating probability problems:
 * - Basic probability
 * - Combinatorics (permutations, combinations)
 * - Conditional probability
 * - Expected value
 */

import { createTemplate, type ProblemTemplate, narrow } from './template-engine.js';

/**
 * Basic probability
 */
export const basicProbabilityTemplate = createTemplate({
  id: 'probability-basic',
  category: 'probability',
  subcategory: 'basic-probability',
  difficulty: 1,
  template:
    'A bag contains {{red}} red balls and {{blue}} blue balls. What is the probability of drawing a red ball?',
  parameters: [
    { name: 'red', type: 'integer', min: 1, max: 10 },
    { name: 'blue', type: 'integer', min: 1, max: 10 },
  ],
  solution: params => {
    const { red, blue } = narrow<{ red: number; blue: number }>(params);
    const total = red + blue;
    const prob = red / total;

    return {
      answer: `P(\\text{red}) = \\frac{${red}}{${total}}${prob !== Math.floor(prob) ? ` \\approx ${prob.toFixed(3)}` : ''}`,
      steps: [
        {
          description: 'Count favorable outcomes',
          expression: `${red} \\text{ red balls}`,
        },
        {
          description: 'Count total outcomes',
          expression: `${total} \\text{ total balls}`,
        },
        {
          description: 'Calculate probability',
          expression: `P(\\text{red}) = \\frac{${red}}{${total}}`,
        },
      ],
    };
  },
  hints: [
    () => 'Probability = favorable outcomes / total outcomes',
    params => `Favorable: ${Number(params['red'])} red balls`,
    params => `Total: ${Number(params['red']) + Number(params['blue'])} balls`,
  ],
  commonMistakes: [],
  tags: ['probability', 'basic'],
  prerequisites: ['fractions', 'counting'],
  learningObjectives: ['Calculate basic probability'],
});

/**
 * Combinations
 */
export const combinationsTemplate = createTemplate({
  id: 'combinations-basic',
  category: 'probability',
  subcategory: 'combinatorics',
  difficulty: 2,
  template: 'How many ways can you choose {{r}} items from {{n}} items?',
  parameters: [
    { name: 'n', type: 'integer', min: 5, max: 10 },
    {
      name: 'r',
      type: 'integer',
      min: 2,
      max: 5,
      constraint: function (r) {
        return r <= (this as unknown as Record<string, number>)['n']!;
      },
    },
  ],
  solution: params => {
    const { n, r } = narrow<{ n: number; r: number }>(params);
    const result = combinations(n, r);

    return {
      answer: `C(${n}, ${r}) = ${result}`,
      steps: [
        {
          description: 'Apply combination formula',
          expression: `C(n, r) = \\frac{n!}{r!(n-r)!}`,
        },
        {
          description: 'Substitute values',
          expression: `C(${n}, ${r}) = \\frac{${n}!}{${r}! \\cdot ${n - r}!}`,
        },
        {
          description: 'Calculate',
          expression: `C(${n}, ${r}) = ${result}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the combination formula: $C(n,r) = \\frac{n!}{r!(n-r)!}$',
    () => 'Order does not matter for combinations',
  ],
  commonMistakes: [
    (params, answer) => {
      const p = narrow<{ n: number; r: number }>(params);
      const permResult = factorial(p.n) / factorial(p.n - p.r);
      if (answer === String(permResult)) {
        return {
          incorrectAnswer: String(permResult),
          explanation: 'You calculated permutations instead of combinations',
          correction: 'Combinations divide by r! because order doesn\'t matter',
        };
      }
      return null;
    },
  ],
  tags: ['combinations', 'combinatorics'],
  prerequisites: ['factorials'],
  learningObjectives: ['Calculate combinations'],
});

/**
 * Permutations
 */
export const permutationsTemplate = createTemplate({
  id: 'permutations-basic',
  category: 'probability',
  subcategory: 'combinatorics',
  difficulty: 2,
  template: 'How many ways can you arrange {{r}} items from {{n}} items?',
  parameters: [
    { name: 'n', type: 'integer', min: 5, max: 10 },
    {
      name: 'r',
      type: 'integer',
      min: 2,
      max: 5,
      constraint: function (r) {
        return r <= (this as unknown as Record<string, number>)['n']!;
      },
    },
  ],
  solution: params => {
    const { n, r } = narrow<{ n: number; r: number }>(params);
    const result = permutations(n, r);

    return {
      answer: `P(${n}, ${r}) = ${result}`,
      steps: [
        {
          description: 'Apply permutation formula',
          expression: `P(n, r) = \\frac{n!}{(n-r)!}`,
        },
        {
          description: 'Substitute values',
          expression: `P(${n}, ${r}) = \\frac{${n}!}{${n - r}!}`,
        },
        {
          description: 'Calculate',
          expression: `P(${n}, ${r}) = ${result}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the permutation formula: $P(n,r) = \\frac{n!}{(n-r)!}$',
    () => 'Order matters for permutations',
  ],
  commonMistakes: [],
  tags: ['permutations', 'combinatorics'],
  prerequisites: ['factorials'],
  learningObjectives: ['Calculate permutations'],
});

/**
 * Helper: Factorial
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Helper: Combinations
 */
function combinations(n: number, r: number): number {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

/**
 * Helper: Permutations
 */
function permutations(n: number, r: number): number {
  return factorial(n) / factorial(n - r);
}

/**
 * Export all probability templates
 */
export const probabilityTemplates: ProblemTemplate[] = [
  basicProbabilityTemplate,
  combinationsTemplate,
  permutationsTemplate,
];
