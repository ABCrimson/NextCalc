/**
 * NextCalc Pro - Computer Algebra System (CAS) Microservice
 *
 * A Cloudflare Worker providing symbolic mathematics operations:
 * - Equation solving (linear, quadratic, polynomial)
 * - Symbolic differentiation (single and higher-order)
 * - Symbolic and numeric integration
 *
 * Built with Hono framework and mathjs for edge computing performance.
 *
 * @author NextCalc Pro Team
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { differentiateMathExpression } from './handlers/differentiate.js';
import { computeArcLength, integrateMathExpression } from './handlers/integrate.js';
import { solveMathExpression } from './handlers/solve.js';
import {
  arcLengthSchema,
  createErrorResponse,
  differentiateSchema,
  integrateSchema,
  solveSchema,
  validateRequest,
} from './utils/validators.js';

/**
 * Cloudflare Worker environment bindings
 */
type Bindings = {
  ALLOWED_ORIGINS: string;
};

/**
 * Initialize Hono application with type-safe bindings
 */
const app = new Hono<{ Bindings: Bindings }>();

/**
 * Middleware configuration
 */

// CORS configuration - allows frontend to access API
app.use('/*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') ?? [];

  const origin = c.req.header('Origin') || '';
  const corsMiddleware = cors({
    origin: allowedOrigins.includes(origin) ? origin : '',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
    credentials: true,
  });

  return corsMiddleware(c, next);
});

// Request logging for observability
app.use('*', logger());

/**
 * Global error handler
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  return c.json(
    createErrorResponse('Internal server error', 'INTERNAL_ERROR', { message: err.message }),
    500,
  );
});

/**
 * Health check endpoint
 * Used for monitoring and load balancer health checks
 *
 * @route GET /health
 * @returns 200 OK with service status
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'cas-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root endpoint - API information
 *
 * @route GET /
 * @returns Service metadata and available endpoints
 */
app.get('/', (c) => {
  return c.json({
    name: 'NextCalc Pro - CAS Service',
    version: '1.0.0',
    description: 'Computer Algebra System microservice for symbolic mathematics',
    endpoints: {
      solve: 'POST /solve - Solve algebraic equations',
      differentiate: 'POST /differentiate - Compute derivatives',
      integrate: 'POST /integrate - Compute integrals',
      arcLength: 'POST /arc-length - Compute curve arc length',
      health: 'GET /health - Health check',
    },
    documentation: 'https://docs.nextcalc.pro/api/cas',
  });
});

/**
 * Solve algebraic equations
 *
 * @route POST /solve
 * @body {expression: string, variable?: string, precision?: number}
 * @returns Solutions to the equation
 *
 * @example
 * POST /solve
 * {
 *   "expression": "2x + 5 = 13",
 *   "variable": "x",
 *   "precision": 10
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "solutions": [4],
 *     "expression": "2x + 5 = 13",
 *     "variable": "x",
 *     "solutionType": "numeric"
 *   }
 * }
 */
app.post('/solve', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request body
    const validatedRequest = validateRequest(body, solveSchema);

    // Solve equation
    const result = await solveMathExpression(validatedRequest);

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        createErrorResponse('Validation error', 'VALIDATION_ERROR', { errors: error.issues }),
        400,
      );
    }

    console.error('Error in /solve:', error);
    return c.json(createErrorResponse('Failed to process solve request', 'SOLVE_ERROR'), 500);
  }
});

/**
 * Compute symbolic derivatives
 *
 * @route POST /differentiate
 * @body {expression: string, variable?: string, order?: number, simplify?: boolean}
 * @returns Derivative of the expression
 *
 * @example
 * POST /differentiate
 * {
 *   "expression": "x^2 + 3x + 2",
 *   "variable": "x",
 *   "order": 1,
 *   "simplify": true
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "derivative": "2 * x + 3",
 *     "originalExpression": "x^2 + 3x + 2",
 *     "variable": "x",
 *     "order": 1,
 *     "simplified": true,
 *     "latex": "2x+3"
 *   }
 * }
 */
app.post('/differentiate', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request body
    const validatedRequest = validateRequest(body, differentiateSchema);

    // Compute derivative
    const result = await differentiateMathExpression(validatedRequest);

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        createErrorResponse('Validation error', 'VALIDATION_ERROR', { errors: error.issues }),
        400,
      );
    }

    console.error('Error in /differentiate:', error);
    return c.json(
      createErrorResponse('Failed to process differentiate request', 'DIFFERENTIATE_ERROR'),
      500,
    );
  }
});

/**
 * Compute symbolic or numeric integrals
 *
 * @route POST /integrate
 * @body {expression: string, variable?: string, lowerBound?: number, upperBound?: number, simplify?: boolean}
 * @returns Integral of the expression
 *
 * @example
 * POST /integrate
 * {
 *   "expression": "x^2",
 *   "variable": "x",
 *   "lowerBound": 0,
 *   "upperBound": 1,
 *   "simplify": true
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "integral": "x^3/3",
 *     "originalExpression": "x^2",
 *     "variable": "x",
 *     "definite": true,
 *     "bounds": {"lower": 0, "upper": 1},
 *     "numericValue": 0.333333,
 *     "simplified": true
 *   }
 * }
 */
app.post('/integrate', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request body
    const validatedRequest = validateRequest(body, integrateSchema);

    // Compute integral
    const result = await integrateMathExpression(validatedRequest);

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        createErrorResponse('Validation error', 'VALIDATION_ERROR', { errors: error.issues }),
        400,
      );
    }

    console.error('Error in /integrate:', error);
    return c.json(
      createErrorResponse('Failed to process integrate request', 'INTEGRATE_ERROR'),
      500,
    );
  }
});

/**
 * Compute arc length of a curve
 *
 * @route POST /arc-length
 * @body {expression: string, variable?: string, lowerBound: number, upperBound: number}
 * @returns Arc length value
 *
 * @example
 * POST /arc-length
 * {
 *   "expression": "x^2",
 *   "variable": "x",
 *   "lowerBound": 0,
 *   "upperBound": 1
 * }
 */
app.post('/arc-length', async (c) => {
  try {
    const body = await c.req.json();

    const validatedRequest = validateRequest(body, arcLengthSchema);

    // Compute arc length
    const result = await computeArcLength(
      validatedRequest.expression,
      validatedRequest.variable,
      validatedRequest.lowerBound,
      validatedRequest.upperBound,
    );

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        createErrorResponse('Validation error', 'VALIDATION_ERROR', { errors: error.issues }),
        400,
      );
    }

    console.error('Error in /arc-length:', error);
    return c.json(
      createErrorResponse('Failed to process arc-length request', 'ARC_LENGTH_ERROR'),
      500,
    );
  }
});

/**
 * 404 handler for unknown routes
 */
app.notFound((c) => {
  return c.json(createErrorResponse('Endpoint not found', 'NOT_FOUND', { path: c.req.path }), 404);
});

/**
 * Export the Hono app as default for Cloudflare Workers
 */
export default app;
