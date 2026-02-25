/**
 * Number Theory Problem Templates
 *
 * Templates for generating number theory problems:
 * - Prime factorization
 * - GCD/LCM
 * - Modular arithmetic
 * - Diophantine equations
 */

import { createTemplate, type ProblemTemplate, narrow } from './template-engine';

/**
 * Prime factorization
 */
export const primeFactorizationTemplate = createTemplate({
  id: 'prime-factorization',
  category: 'number-theory',
  subcategory: 'primes',
  difficulty: 2,
  template: 'Find the prime factorization of {{n}}.',
  parameters: [{ name: 'n', type: 'integer', min: 12, max: 100 }],
  solution: params => {
    const { n } = narrow<{ n: number }>(params);
    const factors = primeFactorize(n);

    return {
      answer: factors.map(([p, e]) => (e > 1 ? `${p}^${e}` : `${p}`)).join(' \\cdot '),
      steps: [
        {
          description: 'Factor {{n}} into primes',
          expression: factors.map(([p, e]) => (e > 1 ? `${p}^${e}` : `${p}`)).join(' \\cdot '),
        },
      ],
    };
  },
  hints: [
    () => 'Start by dividing by the smallest prime (2)',
    () => 'Continue until you reach 1',
  ],
  commonMistakes: [],
  tags: ['primes', 'factorization', 'number-theory'],
  prerequisites: ['primes', 'division'],
  learningObjectives: ['Find prime factorization'],
});

/**
 * GCD calculation
 */
export const gcdTemplate = createTemplate({
  id: 'gcd-euclidean',
  category: 'number-theory',
  subcategory: 'gcd-lcm',
  difficulty: 2,
  template: 'Find the greatest common divisor (GCD) of {{a}} and {{b}}.',
  parameters: [
    { name: 'a', type: 'integer', min: 10, max: 100 },
    { name: 'b', type: 'integer', min: 10, max: 100 },
  ],
  solution: params => {
    const { a, b } = narrow<{ a: number; b: number }>(params);
    const result = gcd(a, b);

    return {
      answer: `\\text{GCD}(${a}, ${b}) = ${result}`,
      steps: [
        {
          description: 'Apply Euclidean algorithm',
          expression: `\\text{GCD}(${a}, ${b}) = ${result}`,
        },
      ],
    };
  },
  hints: [() => 'Use the Euclidean algorithm', () => 'Or find prime factorizations'],
  commonMistakes: [],
  tags: ['gcd', 'euclidean-algorithm'],
  prerequisites: ['division', 'remainders'],
  learningObjectives: ['Calculate GCD'],
});

/**
 * Modular arithmetic
 */
export const modularArithmeticTemplate = createTemplate({
  id: 'modular-arithmetic-basic',
  category: 'number-theory',
  subcategory: 'modular-arithmetic',
  difficulty: 3,
  template: 'Find {{a}} mod {{m}}.',
  parameters: [
    { name: 'a', type: 'integer', min: 10, max: 100 },
    { name: 'm', type: 'integer', min: 3, max: 20 },
  ],
  solution: params => {
    const { a, m } = narrow<{ a: number; m: number }>(params);
    const result = a % m;

    return {
      answer: `${a} \\equiv ${result} \\pmod{${m}}`,
      steps: [
        {
          description: 'Divide and find remainder',
          expression: `${a} = ${Math.floor(a / m)} \\cdot ${m} + ${result}`,
        },
        {
          description: 'Therefore',
          expression: `${a} \\equiv ${result} \\pmod{${m}}`,
        },
      ],
    };
  },
  hints: [() => 'Find the remainder when dividing by the modulus'],
  commonMistakes: [],
  tags: ['modular-arithmetic', 'congruences'],
  prerequisites: ['division', 'remainders'],
  learningObjectives: ['Perform modular arithmetic'],
});

/**
 * Helper: Prime factorization
 */
function primeFactorize(n: number): [number, number][] {
  const factors: [number, number][] = [];
  let d = 2;

  while (d * d <= n) {
    let count = 0;
    while (n % d === 0) {
      count++;
      n /= d;
    }
    if (count > 0) {
      factors.push([d, count]);
    }
    d++;
  }

  if (n > 1) {
    factors.push([n, 1]);
  }

  return factors;
}

/**
 * Helper: GCD
 */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Export all number theory templates
 */
export const numberTheoryTemplates: ProblemTemplate[] = [
  primeFactorizationTemplate,
  gcdTemplate,
  modularArithmeticTemplate,
];
