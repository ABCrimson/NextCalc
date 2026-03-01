/**
 * Calculus Problem Templates
 *
 * Templates for generating calculus problems:
 * - Derivatives (power rule, product rule, chain rule)
 * - Integrals (u-substitution, by parts)
 * - Limits
 * - Optimization
 * - Related rates
 * - Area and volume
 */

import { createTemplate, narrow, type ProblemTemplate } from './template-engine';

/**
 * Power rule derivative
 */
export const derivativePowerRuleTemplate = createTemplate({
  id: 'derivative-power-rule',
  category: 'calculus',
  subcategory: 'derivatives',
  difficulty: 2,
  template: 'Find the derivative: $f(x) = {{a}}x^{{{n}}}$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 10 },
    { name: 'n', type: 'integer', min: 2, max: 6 },
  ],
  solution: (params) => {
    const { a, n } = narrow<{ a: number; n: number }>(params);
    const coeff = a * n;

    return {
      answer: `f'(x) = ${coeff}x^{${n - 1}}`,
      steps: [
        {
          description: 'Apply power rule: $\\frac{d}{dx}[x^n] = nx^{n-1}$',
          expression: `f'(x) = ${a} \\cdot ${n}x^{${n - 1}}`,
        },
        {
          description: 'Simplify',
          expression: `f'(x) = ${coeff}x^{${n - 1}}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the power rule: bring down the exponent and reduce by 1',
    (params) => `Multiply ${Number(params['a'])} by the exponent ${Number(params['n'])}`,
  ],
  commonMistakes: [
    (params, answer) => {
      const p = narrow<{ a: number; n: number }>(params);
      const wrong = `${p.a}x^{${p.n - 1}}`;
      if (answer.includes(wrong)) {
        return {
          incorrectAnswer: wrong,
          explanation: 'You forgot to multiply by the exponent',
          correction: 'Remember: $\\frac{d}{dx}[ax^n] = a \\cdot n \\cdot x^{n-1}$',
        };
      }
      return null;
    },
  ],
  tags: ['derivatives', 'power-rule', 'calculus'],
  prerequisites: ['exponents', 'functions'],
  learningObjectives: ['Apply power rule for derivatives'],
});

/**
 * Product rule derivative
 */
export const derivativeProductRuleTemplate = createTemplate({
  id: 'derivative-product-rule',
  category: 'calculus',
  subcategory: 'derivatives',
  difficulty: 3,
  template: 'Find the derivative: $f(x) = ({{a}}x + {{b}})({{c}}x + {{d}})$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 5 },
    { name: 'b', type: 'integer', min: 1, max: 10 },
    { name: 'c', type: 'integer', min: 1, max: 5 },
    { name: 'd', type: 'integer', min: 1, max: 10 },
  ],
  solution: (params) => {
    const { a, b, c, d } = narrow<{ a: number; b: number; c: number; d: number }>(params);

    return {
      answer: `f'(x) = ${a}(${c}x + ${d}) + ${c}(${a}x + ${b})`,
      steps: [
        {
          description: "Apply product rule: $(uv)' = u'v + uv'$",
          expression: `f'(x) = (${a}x + ${b})' \\cdot (${c}x + ${d}) + (${a}x + ${b}) \\cdot (${c}x + ${d})'`,
        },
        {
          description: 'Find derivatives',
          expression: `f'(x) = ${a}(${c}x + ${d}) + ${c}(${a}x + ${b})`,
        },
        {
          description: 'Expand and simplify',
          expression: `f'(x) = ${a * c + a * c}x + ${a * d + c * b}`,
        },
      ],
    };
  },
  hints: [
    () => "Use the product rule: $(uv)' = u'v + uv'$",
    () => 'Take the derivative of each factor separately',
  ],
  commonMistakes: [],
  tags: ['derivatives', 'product-rule'],
  prerequisites: ['derivatives', 'power-rule'],
  learningObjectives: ['Apply product rule'],
});

/**
 * Chain rule derivative
 */
export const derivativeChainRuleTemplate = createTemplate({
  id: 'derivative-chain-rule',
  category: 'calculus',
  subcategory: 'derivatives',
  difficulty: 3,
  template: 'Find the derivative: $f(x) = ({{a}}x + {{b}})^{{{n}}}$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 5 },
    { name: 'b', type: 'integer', min: 1, max: 10 },
    { name: 'n', type: 'integer', min: 2, max: 4 },
  ],
  solution: (params) => {
    const { a, b, n } = narrow<{ a: number; b: number; n: number }>(params);
    const coeff = n * a;

    return {
      answer: `f'(x) = ${coeff}(${a}x + ${b})^{${n - 1}}`,
      steps: [
        {
          description: "Apply chain rule: $(f(g(x)))' = f'(g(x)) \\cdot g'(x)$",
          expression: `f'(x) = ${n}(${a}x + ${b})^{${n - 1}} \\cdot ${a}`,
        },
        {
          description: 'Simplify',
          expression: `f'(x) = ${coeff}(${a}x + ${b})^{${n - 1}}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the chain rule for composite functions',
    () => 'Differentiate the outer function, then multiply by derivative of inner',
  ],
  commonMistakes: [],
  tags: ['derivatives', 'chain-rule'],
  prerequisites: ['derivatives', 'power-rule'],
  learningObjectives: ['Apply chain rule'],
});

/**
 * Basic integration (power rule)
 */
export const integralPowerRuleTemplate = createTemplate({
  id: 'integral-power-rule',
  category: 'calculus',
  subcategory: 'integrals',
  difficulty: 2,
  template: 'Evaluate the integral: $\\int {{a}}x^{{{n}}} \\, dx$',
  parameters: [
    { name: 'a', type: 'integer', min: 1, max: 10 },
    { name: 'n', type: 'integer', min: 1, max: 5 },
  ],
  solution: (params) => {
    const { a, n } = narrow<{ a: number; n: number }>(params);
    const newN = n + 1;

    return {
      answer: `\\frac{${a}}{${newN}}x^{${newN}} + C`,
      steps: [
        {
          description: 'Apply power rule for integration',
          expression: `\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C`,
        },
        {
          description: 'Substitute values',
          expression: `${a} \\cdot \\frac{x^{${newN}}}{${newN}} + C`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the power rule: add 1 to exponent, divide by new exponent',
    () => "Don't forget the constant of integration +C",
  ],
  commonMistakes: [
    (_params, answer) => {
      if (!answer.includes('C') && !answer.includes('+')) {
        return {
          incorrectAnswer: answer,
          explanation: 'Missing constant of integration',
          correction: 'Always add +C for indefinite integrals',
        };
      }
      return null;
    },
  ],
  tags: ['integrals', 'power-rule', 'antiderivatives'],
  prerequisites: ['derivatives', 'exponents'],
  learningObjectives: ['Apply power rule for integration'],
});

/**
 * Definite integral
 */
export const definiteIntegralTemplate = createTemplate({
  id: 'definite-integral-basic',
  category: 'calculus',
  subcategory: 'integrals',
  difficulty: 3,
  template: 'Evaluate: $\\int_{{{a}}}^{{{b}}} {{c}}x^{{{n}}} \\, dx$',
  parameters: [
    { name: 'a', type: 'integer', min: 0, max: 3 },
    { name: 'b', type: 'integer', min: 4, max: 10 },
    { name: 'c', type: 'integer', min: 1, max: 5 },
    { name: 'n', type: 'integer', min: 1, max: 3 },
  ],
  solution: (params) => {
    const { a, b, c, n } = narrow<{ a: number; b: number; c: number; n: number }>(params);
    const newN = n + 1;
    const upperValue = (c * b ** newN) / newN;
    const lowerValue = (c * a ** newN) / newN;
    const result = upperValue - lowerValue;

    return {
      answer: `${result}`,
      steps: [
        {
          description: 'Find antiderivative',
          expression: `F(x) = \\frac{${c}x^{${newN}}}{${newN}}`,
        },
        {
          description: 'Apply FTC: $F(b) - F(a)$',
          expression: `F(${b}) - F(${a}) = ${upperValue} - ${lowerValue}`,
        },
        {
          description: 'Simplify',
          expression: `${result}`,
        },
      ],
    };
  },
  hints: [
    () => 'First find the antiderivative',
    () => 'Then apply Fundamental Theorem of Calculus',
    () => 'Evaluate at upper bound minus lower bound',
  ],
  commonMistakes: [],
  tags: ['integrals', 'definite-integrals', 'ftc'],
  prerequisites: ['integrals', 'ftc'],
  learningObjectives: ['Evaluate definite integrals', 'Apply FTC'],
});

/**
 * Limit evaluation
 */
export const limitBasicTemplate = createTemplate({
  id: 'limit-basic',
  category: 'calculus',
  subcategory: 'limits',
  difficulty: 2,
  template: 'Evaluate: $\\lim_{x \\to {{a}}} ({{b}}x + {{c}})$',
  parameters: [
    { name: 'a', type: 'integer', min: -5, max: 5 },
    { name: 'b', type: 'integer', min: 1, max: 5 },
    { name: 'c', type: 'integer', min: -10, max: 10 },
  ],
  solution: (params) => {
    const { a, b, c } = narrow<{ a: number; b: number; c: number }>(params);
    const result = b * a + c;

    return {
      answer: `${result}`,
      steps: [
        {
          description: 'Direct substitution (continuous function)',
          expression: `${b}(${a}) + ${c} = ${result}`,
        },
      ],
    };
  },
  hints: [() => 'For continuous functions, use direct substitution'],
  commonMistakes: [],
  tags: ['limits', 'continuity'],
  prerequisites: ['functions', 'continuity'],
  learningObjectives: ['Evaluate limits by substitution'],
});

/**
 * Export all calculus templates
 */
export const calculusTemplates: ProblemTemplate[] = [
  derivativePowerRuleTemplate,
  derivativeProductRuleTemplate,
  derivativeChainRuleTemplate,
  integralPowerRuleTemplate,
  definiteIntegralTemplate,
  limitBasicTemplate,
];
