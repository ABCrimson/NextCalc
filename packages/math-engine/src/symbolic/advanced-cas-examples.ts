/**
 * Usage Examples for Advanced CAS Features
 *
 * Demonstrates the capabilities of limits, series, and advanced simplification.
 * These examples can be used for documentation, testing, and as a reference
 * for integrating the CAS features into NextCalc Pro.
 */

import {
  createConstantNode,
  createFunctionNode,
  createOperatorNode,
  createSymbolNode,
} from '../parser/ast';
import { limit } from './limits';
import { getKnownSeries, maclaurinSeries, taylorSeries } from './series';
import { simplifyAdvanced } from './simplify-advanced';

// ============================================================================
// LIMITS EXAMPLES
// ============================================================================

/**
 * Example 1: Basic limit with direct substitution
 * lim (x→2) x² + 3x + 1 = 11
 */
export function exampleLimitDirect() {
  // Build: x² + 3x + 1
  const expr = createOperatorNode('+', 'add', [
    createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
      createOperatorNode('*', 'multiply', [createConstantNode(3), createSymbolNode('x')]),
    ]),
    createConstantNode(1),
  ]);

  const result = limit(expr, 'x', { point: 2 });

  return {
    description: 'lim (x→2) x² + 3x + 1',
    result: result.value, // Should be 11
    method: result.method,
    exists: result.exists,
  };
}

/**
 * Example 2: Famous limit - sin(x)/x as x approaches 0
 * lim (x→0) sin(x)/x = 1
 */
export function exampleLimitSinXOverX() {
  const expr = createOperatorNode('/', 'divide', [
    createFunctionNode('sin', [createSymbolNode('x')]),
    createSymbolNode('x'),
  ]);

  const result = limit(expr, 'x', {
    point: 0,
    includeSteps: true,
  });

  return {
    description: 'lim (x→0) sin(x)/x',
    result: result.value, // Should be 1
    method: result.method,
    steps: result.steps,
  };
}

/**
 * Example 3: L'Hôpital's rule application
 * lim (x→0) (1 - cos(x)) / x²
 */
export function exampleLimitLHopital() {
  const expr = createOperatorNode('/', 'divide', [
    createOperatorNode('-', 'subtract', [
      createConstantNode(1),
      createFunctionNode('cos', [createSymbolNode('x')]),
    ]),
    createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
  ]);

  const result = limit(expr, 'x', {
    point: 0,
    maxLhopitalIterations: 3,
    includeSteps: true,
  });

  return {
    description: 'lim (x→0) (1 - cos(x)) / x²',
    result: result.value, // Should be 0.5
    method: result.method,
    indeterminateForm: result.indeterminateForm,
  };
}

/**
 * Example 4: Limit at infinity
 * lim (x→∞) (1 + 1/x)^x = e
 */
export function exampleLimitAtInfinity() {
  const expr = createOperatorNode('^', 'pow', [
    createOperatorNode('+', 'add', [
      createConstantNode(1),
      createOperatorNode('/', 'divide', [createConstantNode(1), createSymbolNode('x')]),
    ]),
    createSymbolNode('x'),
  ]);

  const result = limit(expr, 'x', { point: 'infinity' });

  return {
    description: 'lim (x→∞) (1 + 1/x)^x',
    result: result.value, // Should be ≈ 2.71828 (e)
    method: result.method,
  };
}

/**
 * Example 5: One-sided limits
 * lim (x→0⁺) 1/x = ∞
 */
export function exampleLimitOneSided() {
  const expr = createOperatorNode('/', 'divide', [createConstantNode(1), createSymbolNode('x')]);

  const leftLimit = limit(expr, 'x', {
    point: 0,
    direction: 'left',
  });

  const rightLimit = limit(expr, 'x', {
    point: 0,
    direction: 'right',
  });

  return {
    description: 'One-sided limits of 1/x at x=0',
    leftLimit: leftLimit.value, // Should be -∞
    rightLimit: rightLimit.value, // Should be ∞
    limitExists: leftLimit.value === rightLimit.value,
  };
}

// ============================================================================
// SERIES EXPANSION EXAMPLES
// ============================================================================

/**
 * Example 6: Maclaurin series of sin(x)
 * sin(x) = x - x³/6 + x⁵/120 - x⁷/5040 + ...
 */
export function exampleSeriesSin() {
  const result = getKnownSeries('sin', 'x', { terms: 5 });

  return {
    description: 'Maclaurin series of sin(x)',
    terms: result!.terms,
    polynomial: result!.polynomial,
    radiusOfConvergence: result!.radiusOfConvergence,
    latex: result!.latex,
  };
}

/**
 * Example 7: Maclaurin series of e^x
 * e^x = 1 + x + x²/2! + x³/3! + x⁴/4! + ...
 */
export function exampleSeriesExp() {
  const result = getKnownSeries('exp', 'x', { terms: 6 });

  return {
    description: 'Maclaurin series of e^x',
    terms: result!.terms,
    polynomial: result!.polynomial,
    radiusOfConvergence: result!.radiusOfConvergence,
  };
}

/**
 * Example 8: Taylor series around a specific point
 * Expand sin(x) around x = π/2
 */
export function exampleSeriesTaylor() {
  const expr = createFunctionNode('sin', [createSymbolNode('x')]);

  const result = taylorSeries(expr, 'x', {
    center: Math.PI / 2,
    terms: 4,
    includeSteps: true,
  });

  return {
    description: 'Taylor series of sin(x) around x = π/2',
    terms: result.terms,
    polynomial: result.polynomial,
    steps: result.steps,
  };
}

/**
 * Example 9: Series with remainder term
 * Shows the error estimation capabilities
 */
export function exampleSeriesWithRemainder() {
  const expr = createFunctionNode('exp', [createSymbolNode('x')]);

  const result = maclaurinSeries(expr, 'x', {
    terms: 5,
    includeRemainder: true,
    includeSteps: true,
  });

  return {
    description: 'e^x series with remainder term',
    terms: result.terms,
    polynomial: result.polynomial,
    remainder: result.remainder,
  };
}

/**
 * Example 10: Polynomial series expansion
 * Even polynomials should be exact
 */
export function exampleSeriesPolynomial() {
  // Build: x² + 2x + 1 = (x+1)²
  const expr = createOperatorNode('+', 'add', [
    createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
      createOperatorNode('*', 'multiply', [createConstantNode(2), createSymbolNode('x')]),
    ]),
    createConstantNode(1),
  ]);

  const result = maclaurinSeries(expr, 'x', { terms: 5 });

  return {
    description: 'Series expansion of x² + 2x + 1',
    terms: result.terms,
    polynomial: result.polynomial,
  };
}

// ============================================================================
// ADVANCED SIMPLIFICATION EXAMPLES
// ============================================================================

/**
 * Example 11: Pythagorean identity
 * sin²(x) + cos²(x) = 1
 */
export function exampleSimplifyPythagorean() {
  const expr = createOperatorNode('+', 'add', [
    createOperatorNode('^', 'pow', [
      createFunctionNode('sin', [createSymbolNode('x')]),
      createConstantNode(2),
    ]),
    createOperatorNode('^', 'pow', [
      createFunctionNode('cos', [createSymbolNode('x')]),
      createConstantNode(2),
    ]),
  ]);

  const result = simplifyAdvanced(expr);

  return {
    description: 'sin²(x) + cos²(x)',
    simplified: result, // Should be constant 1
    wasSimplified: result.type === 'ConstantNode',
  };
}

/**
 * Example 12: Logarithm product rule
 * log(x*y) = log(x) + log(y)
 */
export function exampleSimplifyLogProduct() {
  const expr = createFunctionNode('log', [
    createOperatorNode('*', 'multiply', [createSymbolNode('x'), createSymbolNode('y')]),
  ]);

  const result = simplifyAdvanced(expr);

  return {
    description: 'log(x*y)',
    simplified: result, // Should be log(x) + log(y)
    wasExpanded: result.type === 'OperatorNode',
  };
}

/**
 * Example 13: Logarithm power rule
 * log(x^n) = n*log(x)
 */
export function exampleSimplifyLogPower() {
  const expr = createFunctionNode('log', [
    createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(3)]),
  ]);

  const result = simplifyAdvanced(expr);

  return {
    description: 'log(x³)',
    simplified: result, // Should be 3*log(x)
  };
}

/**
 * Example 14: Exponential inverse
 * exp(ln(x)) = x
 */
export function exampleSimplifyExpLn() {
  const expr = createFunctionNode('exp', [createFunctionNode('ln', [createSymbolNode('x')])]);

  const result = simplifyAdvanced(expr);

  return {
    description: 'exp(ln(x))',
    simplified: result, // Should be x
    isSymbol: result.type === 'SymbolNode',
  };
}

/**
 * Example 15: Radical simplification
 * √(x²) = |x|
 */
export function exampleSimplifyRadical() {
  const expr = createFunctionNode('sqrt', [
    createOperatorNode('^', 'pow', [createSymbolNode('x'), createConstantNode(2)]),
  ]);

  const result = simplifyAdvanced(expr);

  return {
    description: '√(x²)',
    simplified: result, // Should be |x|
  };
}

/**
 * Example 16: Rationalization
 * 1/√x = √x/x
 */
export function exampleSimplifyRationalize() {
  const expr = createOperatorNode('/', 'divide', [
    createConstantNode(1),
    createFunctionNode('sqrt', [createSymbolNode('x')]),
  ]);

  const result = simplifyAdvanced(expr, { rationalize: true });

  return {
    description: '1/√x (rationalized)',
    simplified: result,
  };
}

/**
 * Example 17: Combined transformations
 * Simplify: sin²(x) + cos²(x) + log(e^2)
 */
export function exampleSimplifyCombined() {
  const expr = createOperatorNode('+', 'add', [
    createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]),
    createFunctionNode('log', [
      createOperatorNode('^', 'pow', [createConstantNode(Math.E), createConstantNode(2)]),
    ]),
  ]);

  const result = simplifyAdvanced(expr, {
    trigIdentities: true,
    logRules: true,
    expRules: true,
  });

  return {
    description: 'sin²(x) + cos²(x) + log(e²)',
    simplified: result, // Should simplify to 1 + 2 = 3
  };
}

// ============================================================================
// COMBINED EXAMPLES: USING MULTIPLE CAS FEATURES
// ============================================================================

/**
 * Example 18: Compute limit using series expansion
 * Sometimes series can help understand limits
 */
export function exampleLimitViaSeries() {
  // lim (x→0) sin(x)/x
  const sinSeries = getKnownSeries('sin', 'x', { terms: 3 });

  // The series is: x - x³/6 + ...
  // Dividing by x gives: 1 - x²/6 + ...
  // As x→0, this approaches 1

  const limitResult = limit(
    createOperatorNode('/', 'divide', [
      createFunctionNode('sin', [createSymbolNode('x')]),
      createSymbolNode('x'),
    ]),
    'x',
    { point: 0 },
  );

  return {
    description: 'Understanding sin(x)/x via series',
    series: sinSeries,
    limit: limitResult.value,
    method: limitResult.method,
  };
}

/**
 * Example 19: Simplify then compute limit
 * Demonstrates pipeline of CAS operations
 */
export function exampleSimplifyThenLimit() {
  // Build: (sin²(x) + cos²(x)) * (x + 1)
  const expr = createOperatorNode('*', 'multiply', [
    createOperatorNode('+', 'add', [
      createOperatorNode('^', 'pow', [
        createFunctionNode('sin', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
      createOperatorNode('^', 'pow', [
        createFunctionNode('cos', [createSymbolNode('x')]),
        createConstantNode(2),
      ]),
    ]),
    createOperatorNode('+', 'add', [createSymbolNode('x'), createConstantNode(1)]),
  ]);

  // First simplify (should become 1 * (x + 1) = x + 1)
  const simplified = simplifyAdvanced(expr);

  // Then compute limit at x = 2 (should be 3)
  const limitResult = limit(simplified, 'x', { point: 2 });

  return {
    description: 'Simplify (sin²x + cos²x)(x+1) then compute limit at x=2',
    original: expr,
    simplified,
    limitValue: limitResult.value, // Should be 3
  };
}

/**
 * Example 20: Full CAS workflow
 * Expand, simplify, differentiate, then compute limit
 */
export function exampleFullCASWorkflow() {
  // 1. Get series expansion
  const series = getKnownSeries('sin', 'x', { terms: 3 });

  // 2. Simplify the series polynomial
  const simplified = simplifyAdvanced(series!.polynomial);

  // 3. Compute limit as x→0
  const limitResult = limit(simplified, 'x', { point: 0 });

  return {
    description: 'Full workflow: series → simplify → limit',
    originalFunction: 'sin(x)',
    seriesTerms: series!.terms.length,
    simplified,
    limitValue: limitResult.value, // sin(0) = 0
  };
}
