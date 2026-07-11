/**
 * Unit tests for arbitrary-model tilde regression (Levenberg-Marquardt)
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildCannedModel, fitModel, parseTildeModel } from './fit';
import { linearRegression } from './regression';

/** Asserts a fit succeeded and narrows the type. */
function expectOk(
  result: ReturnType<typeof fitModel>,
): Extract<ReturnType<typeof fitModel>, { ok: true }> {
  if (!result.ok) {
    throw new Error(`Expected successful fit, got ${result.status}: ${result.message}`);
  }
  return result;
}

describe('parseTildeModel', () => {
  const columns = ['x1', 'y1'];

  it('parses a model with parameters and regressors', () => {
    const parsed = parseTildeModel('y1 ~ a*exp(b*x1)', columns);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.dependent).toBe('y1');
      expect(parsed.parameters).toEqual(['a', 'b']);
      expect(parsed.regressors).toEqual(['x1']);
      expect(parsed.rhsText).toBe('a*exp(b*x1)');
    }
  });

  it('rejects input without a tilde', () => {
    const parsed = parseTildeModel('y1 = a*x1', columns);
    expect(parsed).toMatchObject({ ok: false, code: 'no-tilde' });
  });

  it('rejects input with multiple tildes', () => {
    const parsed = parseTildeModel('y1 ~ a ~ b', columns);
    expect(parsed).toMatchObject({ ok: false, code: 'multiple-tildes' });
  });

  it('rejects a dependent that is not a data column', () => {
    const parsed = parseTildeModel('z ~ a*x1', columns);
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-dependent' });
  });

  it('rejects a dependent that is an expression', () => {
    const parsed = parseTildeModel('2*y1 ~ a*x1', columns);
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-dependent' });
  });

  it('rejects an unparseable right-hand side', () => {
    const parsed = parseTildeModel('y1 ~ a*(x1', columns);
    expect(parsed).toMatchObject({ ok: false, code: 'parse-error' });
  });

  it('rejects a model with no free parameters', () => {
    const parsed = parseTildeModel('y1 ~ x1', columns);
    expect(parsed).toMatchObject({ ok: false, code: 'no-parameters' });
  });

  it('does not treat built-in constants as parameters', () => {
    const parsed = parseTildeModel('y1 ~ a*sin(pi*x1) + b*e', columns);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.parameters).toEqual(['a', 'b']);
    }
  });
});

describe('buildCannedModel', () => {
  it('emits the exact model string for each family', () => {
    expect(buildCannedModel('linear', 'x1', 'y1')).toBe('y1 ~ m*x1 + b');
    expect(buildCannedModel('quadratic', 'x1', 'y1')).toBe('y1 ~ a*x1^2 + b*x1 + c');
    expect(buildCannedModel('exponential', 'x1', 'y1')).toBe('y1 ~ a*exp(b*x1)');
    expect(buildCannedModel('logarithmic', 'x1', 'y1')).toBe('y1 ~ a + b*ln(x1)');
    expect(buildCannedModel('logistic', 'x1', 'y1')).toBe('y1 ~ L/(1 + exp(-k*(x1 - x0)))');
    expect(buildCannedModel('sinusoidal', 'x1', 'y1')).toBe('y1 ~ a*sin(b*x1 + c) + d');
  });
});

describe('fitModel — parameter recovery', () => {
  it('recovers an exact linear fit y = 2x + 1', () => {
    const x1 = [0, 1, 2, 3, 4, 5];
    const y1 = x1.map((x) => 2 * x + 1);
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b'));
    expect(fit.parameters['m']).toBeCloseTo(2, 8);
    expect(fit.parameters['b']).toBeCloseTo(1, 8);
    expect(fit.r2).toBeCloseTo(1, 8);
    expect(fit.status).toBe('converged');
  });

  it('recovers a quadratic y = 0.5x² − 3x + 2', () => {
    const x1 = [-3, -2, -1, 0, 1, 2, 3, 4];
    const y1 = x1.map((x) => 0.5 * x ** 2 - 3 * x + 2);
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ a*x1^2 + b*x1 + c'));
    expect(fit.parameters['a']).toBeCloseTo(0.5, 6);
    expect(fit.parameters['b']).toBeCloseTo(-3, 6);
    expect(fit.parameters['c']).toBeCloseTo(2, 6);
    expect(fit.status).toBe('converged');
  });

  it('recovers an exponential y = 3·e^(0.5x)', () => {
    const x1 = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const y1 = x1.map((x) => 3 * Math.exp(0.5 * x));
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ a*exp(b*x1)'));
    expect(fit.parameters['a']).toBeCloseTo(3, 6);
    expect(fit.parameters['b']).toBeCloseTo(0.5, 6);
    expect(fit.r2).toBeCloseTo(1, 8);
    expect(fit.status).toBe('converged');
  });

  it('recovers a logarithmic y = 1.5 + 2·ln(x)', () => {
    const x1 = [0.5, 1, 2, 3, 5, 8, 13];
    const y1 = x1.map((x) => 1.5 + 2 * Math.log(x));
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ a + b*ln(x1)'));
    expect(fit.parameters['a']).toBeCloseTo(1.5, 6);
    expect(fit.parameters['b']).toBeCloseTo(2, 6);
    expect(fit.status).toBe('converged');
  });

  it('recovers a logistic L=10, k=1.2, x0=2', () => {
    const x1 = Array.from({ length: 25 }, (_, i) => -4 + i * 0.5);
    const y1 = x1.map((x) => 10 / (1 + Math.exp(-1.2 * (x - 2))));
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ L/(1 + exp(-k*(x1 - x0)))'));
    expect(fit.parameters['L']).toBeCloseTo(10, 4);
    expect(fit.parameters['k']).toBeCloseTo(1.2, 4);
    expect(fit.parameters['x0']).toBeCloseTo(2, 4);
    expect(fit.status).toBe('converged');
  });

  it('recovers a sinusoid when given an initial guess', () => {
    const x1 = Array.from({ length: 40 }, (_, i) => i * 0.25);
    const y1 = x1.map((x) => 2.5 * Math.sin(1.5 * x + 0.4) + 1);
    const fit = expectOk(
      fitModel({ x1, y1 }, 'y1 ~ a*sin(b*x1 + c) + d', {
        initialGuess: { a: 2, b: 1.4, c: 0.5, d: 0.8 },
      }),
    );
    expect(fit.parameters['a']).toBeCloseTo(2.5, 4);
    expect(fit.parameters['b']).toBeCloseTo(1.5, 4);
    expect(fit.parameters['c']).toBeCloseTo(0.4, 4);
    expect(fit.parameters['d']).toBeCloseTo(1, 4);
    expect(fit.status).toBe('converged');
  });

  it('matches linearRegression on the same data', () => {
    const x1 = [1, 2, 3, 4, 5, 6];
    const y1 = [2.1, 3.9, 6.2, 7.8, 10.1, 11.7];
    const reference = linearRegression(x1, y1);
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b'));
    expect(fit.parameters['m']).toBeCloseTo(reference.slope, 6);
    expect(fit.parameters['b']).toBeCloseTo(reference.intercept, 6);
    expect(fit.r2).toBeCloseTo(reference.r2, 6);
  });
});

describe('fitModel — hygiene and honest failure', () => {
  it('reports consistent residuals, predictions and rmse', () => {
    const x1 = [1, 2, 3, 4, 5];
    const y1 = [1.9, 4.2, 5.8, 8.1, 9.9];
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b'));
    expect(fit.residuals).toHaveLength(5);
    expect(fit.predicted).toHaveLength(5);
    expect(fit.rmse).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 5; i++) {
      expect((fit.predicted[i] ?? Number.NaN) + (fit.residuals[i] ?? Number.NaN)).toBeCloseTo(
        y1[i] ?? Number.NaN,
        10,
      );
    }
  });

  it('drops non-finite rows and records a structured warning', () => {
    const x1 = [0, 1, 2, Number.NaN, 4, 5];
    const y1 = [1, 3, 5, 7, Number.POSITIVE_INFINITY, 11];
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b'));
    expect(fit.residuals).toHaveLength(4);
    expect(fit.warnings).toContainEqual({ code: 'dropped-rows', count: 2 });
    expect(fit.parameters['m']).toBeCloseTo(2, 6);
    expect(fit.parameters['b']).toBeCloseTo(1, 6);
  });

  it('fails with insufficient-data when rows do not exceed parameters', () => {
    const fit = fitModel({ x1: [1, 2], y1: [2, 4] }, 'y1 ~ m*x1 + b');
    expect(fit).toMatchObject({ ok: false, status: 'insufficient-data' });
  });

  it('fails with invalid-model for unparseable input', () => {
    const fit = fitModel({ x1: [1, 2, 3], y1: [1, 2, 3] }, 'y1 a*x1');
    expect(fit).toMatchObject({ ok: false, status: 'invalid-model' });
  });

  it('fails with diverged when the model is not evaluable at the initial guess', () => {
    // ln(x1) is undefined for negative x — every row fails at any parameter value.
    const fit = fitModel({ x1: [-5, -4, -3, -2], y1: [1, 2, 3, 4] }, 'y1 ~ a + b*ln(x1)');
    expect(fit).toMatchObject({ ok: false, status: 'diverged' });
    if (!fit.ok) {
      expect(fit.message).toContain('row');
    }
  });

  it('never returns ok with non-finite parameters on degenerate data', () => {
    const fit = fitModel({ x1: [5, 5, 5, 5, 5], y1: [1, 2, 3, 4, 5] }, 'y1 ~ m*x1 + b');
    if (fit.ok) {
      for (const value of Object.values(fit.parameters)) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(Number.isFinite(fit.r2)).toBe(true);
      expect(Number.isFinite(fit.rmse)).toBe(true);
    } else {
      expect(fit.status).toBe('singular');
    }
  });

  it('reports zero-variance r2 = 0 with a warning on constant y', () => {
    const fit = expectOk(fitModel({ x1: [1, 2, 3, 4], y1: [7, 7, 7, 7] }, 'y1 ~ m*x1 + b'));
    expect(fit.r2).toBe(0);
    expect(fit.warnings).toContainEqual({ code: 'zero-variance' });
  });

  it('clamps parameters to bounds and records a warning', () => {
    const x1 = [0, 1, 2, 3, 4, 5];
    const y1 = x1.map((x) => 2 * x);
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b', { bounds: { m: { max: 1 } } }));
    expect(fit.parameters['m']).toBeLessThanOrEqual(1);
    expect(fit.warnings).toContainEqual({ code: 'bound-hit', name: 'm' });
  });

  it('predict closure matches predicted[] on training rows', () => {
    const x1 = [0, 1, 2, 3, 4];
    const y1 = x1.map((x) => 3 * Math.exp(0.5 * x));
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ a*exp(b*x1)'));
    x1.forEach((x, i) => {
      expect(fit.predict({ x1: x })).toBeCloseTo(fit.predicted[i] ?? Number.NaN, 10);
    });
  });

  it('predict returns NaN outside the model domain instead of throwing', () => {
    const x1 = [1, 2, 3, 4, 5];
    const y1 = x1.map((x) => 1 + 2 * Math.log(x));
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ a + b*ln(x1)'));
    expect(Number.isNaN(fit.predict({ x1: -1 }))).toBe(true);
  });

  it('reports standard errors when the fit is overdetermined', () => {
    const x1 = [1, 2, 3, 4, 5, 6];
    const y1 = [2.1, 3.9, 6.2, 7.8, 10.1, 11.7];
    const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b'));
    expect(fit.standardErrors).toBeDefined();
    expect(fit.standardErrors?.['m']).toBeGreaterThan(0);
    expect(fit.standardErrors?.['b']).toBeGreaterThan(0);
  });
});

describe('fitModel — property-based linear recovery', () => {
  it('recovers arbitrary slope and intercept from noiseless data', () => {
    const x1 = [-3, -1.5, 0, 1, 2.5, 4, 5.5, 7];
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        (slope, intercept) => {
          const y1 = x1.map((x) => slope * x + intercept);
          const fit = expectOk(fitModel({ x1, y1 }, 'y1 ~ m*x1 + b'));
          expect(fit.parameters['m']).toBeCloseTo(slope, 6);
          expect(fit.parameters['b']).toBeCloseTo(intercept, 6);
        },
      ),
      { numRuns: 50 },
    );
  });
});
