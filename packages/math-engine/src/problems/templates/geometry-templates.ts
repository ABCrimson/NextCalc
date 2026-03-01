/**
 * Geometry Problem Templates
 *
 * Templates for generating geometry problems:
 * - Triangle problems
 * - Circle problems
 * - Volume calculations
 * - Surface area
 * - Coordinate geometry
 */

import { createTemplate, narrow, type ProblemTemplate } from './template-engine';

/**
 * Pythagorean theorem
 */
export const pythagoreanTemplate = createTemplate({
  id: 'pythagorean-theorem',
  category: 'geometry',
  subcategory: 'triangles',
  difficulty: 1,
  template:
    'A right triangle has legs of length {{a}} and {{b}}. Find the length of the hypotenuse.',
  parameters: [
    { name: 'a', type: 'integer', min: 3, max: 12 },
    { name: 'b', type: 'integer', min: 4, max: 12 },
  ],
  solution: (params) => {
    const { a, b } = narrow<{ a: number; b: number }>(params);
    const c = Math.sqrt(a * a + b * b);

    return {
      answer: `c = ${c}`,
      steps: [
        {
          description: 'Apply Pythagorean theorem: $c^2 = a^2 + b^2$',
          expression: `c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${a * a + b * b}`,
        },
        {
          description: 'Take square root',
          expression: `c = \\sqrt{${a * a + b * b}} = ${c}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the Pythagorean theorem: $a^2 + b^2 = c^2$',
    () => 'Square both legs and add them',
    () => 'Take the square root of the sum',
  ],
  commonMistakes: [],
  tags: ['pythagorean', 'right-triangles', 'geometry'],
  prerequisites: ['squares', 'square-roots'],
  learningObjectives: ['Apply Pythagorean theorem'],
});

/**
 * Circle area
 */
export const circleAreaTemplate = createTemplate({
  id: 'circle-area',
  category: 'geometry',
  subcategory: 'circles',
  difficulty: 1,
  template: 'Find the area of a circle with radius {{r}}.',
  parameters: [{ name: 'r', type: 'integer', min: 1, max: 10 }],
  solution: (params) => {
    const { r } = narrow<{ r: number }>(params);
    const area = Math.PI * r * r;

    return {
      answer: `A = ${r * r}\\pi \\approx ${area.toFixed(2)}`,
      steps: [
        {
          description: 'Apply formula: $A = \\pi r^2$',
          expression: `A = \\pi \\cdot ${r}^2 = ${r * r}\\pi`,
        },
      ],
    };
  },
  hints: [() => 'Use the formula $A = \\pi r^2$'],
  commonMistakes: [
    (params, answer) => {
      const wrongArea = 2 * Math.PI * Number(params['r']);
      if (Math.abs(parseFloat(answer) - wrongArea) < 0.1) {
        return {
          incorrectAnswer: answer,
          explanation: 'You used the circumference formula instead of area',
          correction: 'Area is $\\pi r^2$, circumference is $2\\pi r$',
        };
      }
      return null;
    },
  ],
  tags: ['circles', 'area', 'geometry'],
  prerequisites: ['pi', 'exponents'],
  learningObjectives: ['Calculate circle area'],
});

/**
 * Volume of a cylinder
 */
export const cylinderVolumeTemplate = createTemplate({
  id: 'cylinder-volume',
  category: 'geometry',
  subcategory: 'volume',
  difficulty: 2,
  template: 'Find the volume of a cylinder with radius {{r}} and height {{h}}.',
  parameters: [
    { name: 'r', type: 'integer', min: 1, max: 10 },
    { name: 'h', type: 'integer', min: 1, max: 15 },
  ],
  solution: (params) => {
    const { r, h } = narrow<{ r: number; h: number }>(params);
    const volume = Math.PI * r * r * h;

    return {
      answer: `V = ${r * r * h}\\pi \\approx ${volume.toFixed(2)}`,
      steps: [
        {
          description: 'Apply formula: $V = \\pi r^2 h$',
          expression: `V = \\pi \\cdot ${r}^2 \\cdot ${h} = ${r * r * h}\\pi`,
        },
      ],
    };
  },
  hints: [() => 'Use the formula $V = \\pi r^2 h$'],
  commonMistakes: [],
  tags: ['cylinders', 'volume', '3d-geometry'],
  prerequisites: ['circles', 'area', 'volume'],
  learningObjectives: ['Calculate cylinder volume'],
});

/**
 * Distance formula
 */
export const distanceFormulaTemplate = createTemplate({
  id: 'distance-formula',
  category: 'geometry',
  subcategory: 'coordinate-geometry',
  difficulty: 2,
  template: 'Find the distance between points $({{x1}}, {{y1}})$ and $({{x2}}, {{y2}})$.',
  parameters: [
    { name: 'x1', type: 'integer', min: -5, max: 5 },
    { name: 'y1', type: 'integer', min: -5, max: 5 },
    { name: 'x2', type: 'integer', min: -5, max: 5 },
    { name: 'y2', type: 'integer', min: -5, max: 5 },
  ],
  solution: (params) => {
    const { x1, y1, x2, y2 } = narrow<{ x1: number; y1: number; x2: number; y2: number }>(params);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return {
      answer: `d = ${distance.toFixed(2)}`,
      steps: [
        {
          description: 'Apply distance formula',
          expression: `d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}`,
        },
        {
          description: 'Substitute values',
          expression: `d = \\sqrt{(${x2} - ${x1})^2 + (${y2} - ${y1})^2}`,
        },
        {
          description: 'Simplify',
          expression: `d = \\sqrt{${dx}^2 + ${dy}^2} = \\sqrt{${dx * dx + dy * dy}} = ${distance.toFixed(2)}`,
        },
      ],
    };
  },
  hints: [
    () => 'Use the distance formula: $d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$',
    () => "It's like the Pythagorean theorem!",
  ],
  commonMistakes: [],
  tags: ['distance', 'coordinate-geometry'],
  prerequisites: ['pythagorean-theorem', 'coordinates'],
  learningObjectives: ['Apply distance formula'],
});

/**
 * Export all geometry templates
 */
export const geometryTemplates: ProblemTemplate[] = [
  pythagoreanTemplate,
  circleAreaTemplate,
  cylinderVolumeTemplate,
  distanceFormulaTemplate,
];
