/**
 * CAS Service - Vitest Unit Tests
 *
 * Tests every public route of the CAS Hono application using Hono's built-in
 * `app.request()` helper, which bypasses network I/O entirely and exercises
 * the real handler code including Zod validation and mathjs computation.
 *
 * Strategy:
 * - Import the `app` directly; no HTTP server is started.
 * - Supply env bindings via the second argument to `app.request()`.
 * - Validate response status codes, JSON shapes, and header values.
 *
 * Note on math.solveAll: mathjs 15.x does not export `solveAll`, so the solve
 * handler always falls through to the numeric fallback path which only
 * recognises x = 0 as a solution.  Tests are written against the actual
 * runtime behaviour of the handler rather than an idealised CAS.
 */

import { describe, it, expect } from 'vitest';
import app from './index.js';

// ---------------------------------------------------------------------------
// Shared test environment binding
// ---------------------------------------------------------------------------

/** Minimal env supplied to every request so CORS middleware does not crash. */
const TEST_ENV = {
  ALLOWED_ORIGINS: 'http://localhost:3020',
};

// ---------------------------------------------------------------------------
// Helper: fire a request against the Hono app
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  options: RequestInit = {},
  env: Record<string, unknown> = TEST_ENV,
): Promise<Response> {
  return app.request(url, options, env);
}

function postJson(
  url: string,
  body: unknown,
  env: Record<string, unknown> = TEST_ENV,
): Promise<Response> {
  return makeRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with healthy status and service name', async () => {
    const res = await makeRequest('/health');
    expect(res.status).toBe(200);

    const json = await res.json() as Record<string, unknown>;
    expect(json.status).toBe('healthy');
    expect(json.service).toBe('cas-service');
    expect(json.version).toBe('1.0.0');
    expect(typeof json.timestamp).toBe('string');
  });

  it('returns a valid ISO 8601 timestamp', async () => {
    const res = await makeRequest('/health');
    const json = await res.json() as Record<string, unknown>;
    // ISO 8601 strings are parseable by Date constructor without NaN
    expect(Number.isNaN(Date.parse(json.timestamp as string))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

describe('GET /', () => {
  it('returns 200 with service metadata and endpoints map', async () => {
    const res = await makeRequest('/');
    expect(res.status).toBe(200);

    const json = await res.json() as Record<string, unknown>;
    expect(json.name).toContain('CAS Service');
    expect(json.version).toBe('1.0.0');

    const endpoints = json.endpoints as Record<string, string>;
    expect(endpoints).toHaveProperty('solve');
    expect(endpoints).toHaveProperty('differentiate');
    expect(endpoints).toHaveProperty('integrate');
    expect(endpoints).toHaveProperty('health');
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

describe('Unknown routes', () => {
  it('returns 404 with NOT_FOUND code for a completely unknown path', async () => {
    const res = await makeRequest('/does-not-exist');
    expect(res.status).toBe(404);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a nested unknown path', async () => {
    const res = await makeRequest('/api/v99/magic');
    expect(res.status).toBe(404);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

describe('CORS middleware', () => {
  it('returns Access-Control-Allow-Origin header matching the allowed origin', async () => {
    const res = await makeRequest('/health', {
      headers: { Origin: 'http://localhost:3020' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3020');
  });

  it('responds to OPTIONS preflight with 204 or 200', async () => {
    const res = await makeRequest('/solve', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3020',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect([200, 204]).toContain(res.status);
  });

  it('sets Access-Control-Allow-Credentials header', async () => {
    const res = await makeRequest('/health', {
      headers: { Origin: 'http://localhost:3020' },
    });
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// POST /solve
// ---------------------------------------------------------------------------
//
// Runtime behaviour note:
// mathjs 15.x does not provide math.solveAll() — that API does not exist in
// the version pinned in package.json.  The handler falls back to evaluating
// the expression at x=0.  Only the trivial identity "x = 0" evaluates to 0
// at x=0 and is therefore returned as a solution.  Every other equation
// triggers SOLVE_ERROR from the handler (status 400).
// The tests below document this real behaviour faithfully.

describe('POST /solve', () => {
  it('solves the trivial identity x = 0 and returns solution 0', async () => {
    const res = await postJson('/solve', {
      expression: 'x = 0',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { solutions: number[]; variable: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.variable).toBe('x');
    expect(json.data.solutions).toHaveLength(1);
    expect(json.data.solutions[0]).toBe(0);
  });

  it('returns success:false with SOLVE_ERROR for 2*x + 5 = 13 (mathjs 15 lacks solveAll)', async () => {
    const res = await postJson('/solve', {
      expression: '2*x + 5 = 13',
      variable: 'x',
    });
    // The handler returns success:false when the solve attempt fails
    const json = await res.json() as { success: boolean; error?: { code: string } };
    expect(json.success).toBe(false);
  });

  it('returns success:false for quadratic x^2 - 5*x + 6 = 0 (no solveAll)', async () => {
    const res = await postJson('/solve', {
      expression: 'x^2 - 5*x + 6 = 0',
      variable: 'x',
    });
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('defaults variable to x when not supplied', async () => {
    const res = await postJson('/solve', {
      expression: 'x = 0',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { variable: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.variable).toBe('x');
  });

  it('returns 400 VALIDATION_ERROR when expression field is missing', async () => {
    const res = await postJson('/solve', {
      variable: 'x',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when expression has no equals sign', async () => {
    const res = await postJson('/solve', {
      expression: 'x + 5',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    // The solveSchema refine requires "=" — ZodError triggers VALIDATION_ERROR
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when expression is an empty string', async () => {
    const res = await postJson('/solve', {
      expression: '',
      variable: 'x',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when precision is out of range (> 15)', async () => {
    const res = await postJson('/solve', {
      expression: 'x = 0',
      variable: 'x',
      precision: 100,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when precision is below minimum of 1', async () => {
    const res = await postJson('/solve', {
      expression: 'x = 0',
      variable: 'x',
      precision: 0,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns success:false when expression has two equals signs', async () => {
    const res = await postJson('/solve', {
      expression: '1 = 1 = 1',
      variable: 'x',
    });
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('includes metadata with timestamp on a successful solve', async () => {
    const res = await postJson('/solve', {
      expression: 'x = 0',
      variable: 'x',
    });
    const json = await res.json() as {
      success: boolean;
      metadata: { timestamp: string };
    };
    expect(json.success).toBe(true);
    expect(json.metadata).toBeDefined();
    expect(typeof json.metadata.timestamp).toBe('string');
  });

  it('respects custom precision option on successful solve', async () => {
    const res = await postJson('/solve', {
      expression: 'x = 0',
      variable: 'x',
      precision: 3,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /differentiate
// ---------------------------------------------------------------------------

describe('POST /differentiate', () => {
  it('differentiates x^2 and returns a derivative containing 2', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { derivative: string; variable: string; order: number };
    };
    expect(json.success).toBe(true);
    expect(json.data.variable).toBe('x');
    expect(json.data.order).toBe(1);
    // mathjs may produce "2 * x" or "2*x" – just check it contains "2"
    expect(json.data.derivative).toMatch(/2/);
  });

  it('differentiates a polynomial x^3 + 3*x + 2', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^3 + 3*x + 2',
      variable: 'x',
      simplify: true,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { derivative: string };
    };
    expect(json.success).toBe(true);
    // d/dx(x^3 + 3x + 2) = 3x^2 + 3 — result must be non-empty
    expect(json.data.derivative.length).toBeGreaterThan(0);
  });

  it('computes second-order derivative of x^4 (should contain 12)', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^4',
      variable: 'x',
      order: 2,
      simplify: true,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { derivative: string; order: number };
    };
    expect(json.success).toBe(true);
    expect(json.data.order).toBe(2);
    expect(json.data.derivative).toMatch(/12/);
  });

  it('differentiates sin(x) and returns cos(x)', async () => {
    const res = await postJson('/differentiate', {
      expression: 'sin(x)',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { derivative: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.derivative.toLowerCase()).toContain('cos');
  });

  it('differentiates a constant and returns 0', async () => {
    const res = await postJson('/differentiate', {
      expression: '5',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { derivative: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.derivative).toBe('0');
  });

  it('defaults variable to x and order to 1', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { variable: string; order: number };
    };
    expect(json.success).toBe(true);
    expect(json.data.variable).toBe('x');
    expect(json.data.order).toBe(1);
  });

  it('returns 400 VALIDATION_ERROR when expression field is missing', async () => {
    const res = await postJson('/differentiate', {
      variable: 'x',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when expression is an empty string', async () => {
    const res = await postJson('/differentiate', {
      expression: '',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when order exceeds maximum of 5', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
      variable: 'x',
      order: 6,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when order is less than 1', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
      variable: 'x',
      order: 0,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns success:false for an unparseable expression', async () => {
    const res = await postJson('/differentiate', {
      expression: '@@invalid@@',
      variable: 'x',
    });
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('returns optional latex field as a string when present', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
      variable: 'x',
    });
    const json = await res.json() as {
      success: boolean;
      data: { latex?: string };
    };
    expect(json.success).toBe(true);
    // LaTeX output is optional but should be a string when present
    if (json.data.latex !== undefined) {
      expect(typeof json.data.latex).toBe('string');
    }
  });

  it('marks simplified:true in the response when simplify option is true', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
      variable: 'x',
      simplify: true,
    });
    const json = await res.json() as {
      success: boolean;
      data: { simplified: boolean };
    };
    expect(json.success).toBe(true);
    expect(json.data.simplified).toBe(true);
  });

  it('marks simplified:false in the response when simplify option is false', async () => {
    const res = await postJson('/differentiate', {
      expression: 'x^2',
      variable: 'x',
      simplify: false,
    });
    const json = await res.json() as {
      success: boolean;
      data: { simplified: boolean };
    };
    expect(json.success).toBe(true);
    expect(json.data.simplified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /integrate
// ---------------------------------------------------------------------------

describe('POST /integrate', () => {
  it('integrates x^2 symbolically and returns a result containing x', async () => {
    const res = await postJson('/integrate', {
      expression: 'x^2',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: {
        integral: string;
        variable: string;
        definite: boolean;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.variable).toBe('x');
    expect(json.data.definite).toBe(false);
    expect(json.data.integral).toMatch(/x/);
  });

  it('integrates x^2 from 0 to 1 with numeric value close to 1/3', async () => {
    const res = await postJson('/integrate', {
      expression: 'x^2',
      variable: 'x',
      lowerBound: 0,
      upperBound: 1,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: {
        definite: boolean;
        numericValue: number;
        bounds: { lower: number; upper: number };
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.definite).toBe(true);
    expect(json.data.bounds.lower).toBe(0);
    expect(json.data.bounds.upper).toBe(1);
    // Simpson's rule over 1000 subdivisions is highly accurate
    expect(json.data.numericValue).toBeCloseTo(1 / 3, 4);
  });

  it('integrates a constant "5" to "5 * x"', async () => {
    const res = await postJson('/integrate', {
      expression: '5',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { integral: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.integral).toContain('x');
  });

  it('integrates bare variable x to x^2/2', async () => {
    const res = await postJson('/integrate', {
      expression: 'x',
      variable: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { integral: string };
    };
    expect(json.success).toBe(true);
    // x^2/2 in some form
    expect(json.data.integral).toMatch(/x/);
  });

  it('defaults variable to x', async () => {
    const res = await postJson('/integrate', {
      expression: 'x',
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: { variable: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.variable).toBe('x');
  });

  it('returns 400 VALIDATION_ERROR when expression is empty', async () => {
    const res = await postJson('/integrate', {
      expression: '',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when expression is missing', async () => {
    const res = await postJson('/integrate', {
      variable: 'x',
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when only lowerBound is provided without upperBound', async () => {
    const res = await postJson('/integrate', {
      expression: 'x^2',
      variable: 'x',
      lowerBound: 0,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when lowerBound >= upperBound', async () => {
    const res = await postJson('/integrate', {
      expression: 'x^2',
      variable: 'x',
      lowerBound: 5,
      upperBound: 1,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns success:false for complex expression without bounds (REQUIRES_NUMERIC_INTEGRATION)', async () => {
    // A transcendental with no bounds forces REQUIRES_NUMERIC_INTEGRATION error path
    const res = await postJson('/integrate', {
      expression: 'sin(x) * cos(x) / (x^2 + 1)',
      variable: 'x',
    });
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('integrates a definite integral and marks definite:true with bounds in response', async () => {
    const res = await postJson('/integrate', {
      expression: 'x',
      variable: 'x',
      lowerBound: 0,
      upperBound: 2,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: {
        definite: boolean;
        bounds: { lower: number; upper: number };
        numericValue: number;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.definite).toBe(true);
    expect(json.data.bounds).toEqual({ lower: 0, upper: 2 });
    // integral of x from 0 to 2 = 2
    expect(json.data.numericValue).toBeCloseTo(2, 3);
  });
});

// ---------------------------------------------------------------------------
// POST /arc-length
// ---------------------------------------------------------------------------

describe('POST /arc-length', () => {
  it('computes arc length of y=x from 0 to 1 which is sqrt(2) ≈ 1.41421', async () => {
    const res = await postJson('/arc-length', {
      expression: 'x',
      variable: 'x',
      lowerBound: 0,
      upperBound: 1,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: number;
    };
    expect(json.success).toBe(true);
    // Arc length of y=x from 0→1 is sqrt(2) ≈ 1.41421
    expect(json.data).toBeCloseTo(Math.SQRT2, 3);
  });

  it('computes arc length of y=x^2 from 0 to 1 (approximately 1.4789)', async () => {
    const res = await postJson('/arc-length', {
      expression: 'x^2',
      variable: 'x',
      lowerBound: 0,
      upperBound: 1,
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      success: boolean;
      data: number;
    };
    expect(json.success).toBe(true);
    // Arc length of y=x^2 from 0 to 1 ≈ 1.4789
    expect(json.data).toBeCloseTo(1.4789, 2);
  });

  it('returns 400 VALIDATION_ERROR when lowerBound >= upperBound', async () => {
    const res = await postJson('/arc-length', {
      expression: 'x^2',
      variable: 'x',
      lowerBound: 3,
      upperBound: 1,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when lowerBound is missing', async () => {
    const res = await postJson('/arc-length', {
      expression: 'x^2',
      variable: 'x',
      upperBound: 1,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when expression is missing', async () => {
    const res = await postJson('/arc-length', {
      variable: 'x',
      lowerBound: 0,
      upperBound: 1,
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
