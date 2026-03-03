/**
 * NextCalc Pro - Export Service
 *
 * A Cloudflare Worker providing LaTeX expression export functionality:
 * - PDF export with customizable formatting
 * - PNG export for raster images
 * - SVG export for vector graphics
 *
 * Uses R2 for file storage and serves signed URLs for downloads.
 *
 * @author NextCalc Pro Team
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';

import { exportToPdf, type PdfExportRequest, validateLatexSyntax } from './handlers/pdf.js';
import { exportToPng, getRecommendedDpi, type PngExportRequest } from './handlers/png.js';
import { exportToSvg, type SvgExportRequest } from './handlers/svg.js';
import type { R2Bucket } from './utils/r2.js';

/**
 * Cloudflare Worker environment bindings
 */
type Bindings = {
  EXPORTS_PUBLIC: R2Bucket;
  EXPORTS_PRIVATE: R2Bucket;
  ALLOWED_ORIGINS: string;
  SIGNED_URL_EXPIRY: string;
  MAX_FILE_SIZE: string;
};

/**
 * Initialize Hono application with type-safe bindings
 */
const app = new Hono<{ Bindings: Bindings }>();

/**
 * Middleware configuration
 */

// CORS configuration
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

// Request logging
app.use('*', logger());

/**
 * Global error handler
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  return c.json(
    {
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    },
    500,
  );
});

/**
 * Health check endpoint
 *
 * @route GET /health
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'export-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root endpoint - API information
 *
 * @route GET /
 */
app.get('/', (c) => {
  return c.json({
    name: 'NextCalc Pro - Export Service',
    version: '1.0.0',
    description: 'LaTeX expression export service (PDF, PNG, SVG)',
    endpoints: {
      pdf: 'POST /export/pdf - Export to PDF',
      png: 'POST /export/png - Export to PNG',
      svg: 'POST /export/svg - Export to SVG',
      health: 'GET /health - Health check',
    },
    documentation: 'https://docs.nextcalc.pro/api/export',
  });
});

/**
 * Export LaTeX expression to PDF
 *
 * @route POST /export/pdf
 * @body {latex: string, userId?: string, options?: PdfExportOptions}
 * @returns PDF download URL
 *
 * @example
 * POST /export/pdf
 * {
 *   "latex": "E = mc^2",
 *   "options": {
 *     "pageSize": "a4",
 *     "fontSize": 14,
 *     "title": "Einstein's Mass-Energy Equivalence"
 *   }
 * }
 */
app.post('/export/pdf', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const schema = z.object({
      latex: z.string().min(1).max(10000),
      userId: z.string().optional(),
      options: z
        .object({
          pageSize: z.enum(['letter', 'a4', 'legal']).optional(),
          margin: z.number().min(0).max(2).optional(),
          fontSize: z.number().min(8).max(24).optional(),
          title: z.string().max(200).optional(),
          includeMetadata: z.boolean().optional(),
        })
        .optional(),
    });

    const validated = schema.parse(body) as PdfExportRequest;

    // Validate LaTeX syntax
    if (!validateLatexSyntax(validated.latex)) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Invalid LaTeX syntax',
            code: 'INVALID_LATEX',
          },
        },
        400,
      );
    }

    // Determine which bucket to use
    const bucket = validated.userId ? c.env.EXPORTS_PRIVATE : c.env.EXPORTS_PUBLIC;

    const maxFileSize = parseInt(c.env.MAX_FILE_SIZE || '5242880', 10);

    // Export to PDF
    const result = await exportToPdf(validated, bucket, maxFileSize);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: error.issues,
          },
        },
        400,
      );
    }

    console.error('Error in /export/pdf:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to export PDF',
          code: 'EXPORT_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Export LaTeX expression to PNG
 *
 * @route POST /export/png
 * @body {latex: string, userId?: string, options?: PngExportOptions}
 * @returns PNG download URL
 *
 * @example
 * POST /export/png
 * {
 *   "latex": "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
 *   "options": {
 *     "width": 1200,
 *     "height": 400,
 *     "dpi": 144,
 *     "transparent": true
 *   }
 * }
 */
app.post('/export/png', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const schema = z.object({
      latex: z.string().min(1).max(10000),
      userId: z.string().optional(),
      options: z
        .object({
          width: z.number().min(100).max(4000).optional(),
          height: z.number().min(50).max(2000).optional(),
          dpi: z.number().min(72).max(600).optional(),
          backgroundColor: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/)
            .optional(),
          transparent: z.boolean().optional(),
        })
        .optional(),
    });

    const validated = schema.parse(body) as PngExportRequest;

    // Validate LaTeX syntax
    if (!validateLatexSyntax(validated.latex)) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Invalid LaTeX syntax',
            code: 'INVALID_LATEX',
          },
        },
        400,
      );
    }

    // Determine which bucket to use
    const bucket = validated.userId ? c.env.EXPORTS_PRIVATE : c.env.EXPORTS_PUBLIC;

    const maxFileSize = parseInt(c.env.MAX_FILE_SIZE || '5242880', 10);

    // Export to PNG
    const result = await exportToPng(validated, bucket, maxFileSize);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: error.issues,
          },
        },
        400,
      );
    }

    console.error('Error in /export/png:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to export PNG',
          code: 'EXPORT_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Export LaTeX expression to SVG
 *
 * @route POST /export/svg
 * @body {latex: string, userId?: string, options?: SvgExportOptions}
 * @returns SVG download URL
 *
 * @example
 * POST /export/svg
 * {
 *   "latex": "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
 *   "options": {
 *     "fontSize": 24,
 *     "color": "#2563eb",
 *     "inline": false
 *   }
 * }
 */
app.post('/export/svg', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const schema = z.object({
      latex: z.string().min(1).max(10000),
      userId: z.string().optional(),
      options: z
        .object({
          fontSize: z.number().min(8).max(72).optional(),
          color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/)
            .optional(),
          backgroundColor: z.string().optional(),
          inline: z.boolean().optional(),
        })
        .optional(),
    });

    const validated = schema.parse(body) as SvgExportRequest;

    // Validate LaTeX syntax
    if (!validateLatexSyntax(validated.latex)) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Invalid LaTeX syntax',
            code: 'INVALID_LATEX',
          },
        },
        400,
      );
    }

    // Determine which bucket to use
    const bucket = validated.userId ? c.env.EXPORTS_PRIVATE : c.env.EXPORTS_PUBLIC;

    const maxFileSize = parseInt(c.env.MAX_FILE_SIZE || '5242880', 10);

    // Export to SVG
    const result = await exportToSvg(validated, bucket, maxFileSize);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: error.issues,
          },
        },
        400,
      );
    }

    console.error('Error in /export/svg:', error);
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to export SVG',
          code: 'EXPORT_ERROR',
        },
      },
      500,
    );
  }
});

/**
 * Get recommended DPI for different use cases
 *
 * @route GET /export/dpi/:useCase
 */
app.get('/export/dpi/:useCase', (c) => {
  const useCase = c.req.param('useCase') as 'web' | 'print' | 'retina' | 'presentation';

  if (!['web', 'print', 'retina', 'presentation'].includes(useCase)) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Invalid use case',
          code: 'INVALID_USE_CASE',
        },
      },
      400,
    );
  }

  const dpi = getRecommendedDpi(useCase);

  return c.json({
    success: true,
    data: {
      useCase,
      recommendedDpi: dpi,
    },
  });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        message: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: c.req.path,
      },
    },
    404,
  );
});

/**
 * Export the Hono app
 */
export default app;
