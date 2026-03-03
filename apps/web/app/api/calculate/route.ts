/**
 * Next.js 16 Route Handler for Calculator API
 * Provides REST API endpoint for calculations
 */

import { evaluate } from '@nextcalc/math-engine';
import type { ComputeMode } from '@nextcalc/types';
import { type NextRequest, NextResponse } from 'next/server';

interface CalculateRequest {
  expression: string;
  mode?: ComputeMode;
  variables?: Record<string, number>;
}

interface CalculateResponse {
  success: boolean;
  result?: string | number;
  error?: string;
  metadata?: {
    evaluatedAt: string;
    mode: ComputeMode;
    executionTime: number;
  };
}

/**
 * POST /api/calculate
 * Evaluates a mathematical expression
 */
export async function POST(request: NextRequest): Promise<NextResponse<CalculateResponse>> {
  const startTime = performance.now();

  try {
    // Parse request body
    const body: CalculateRequest = await request.json();
    const { expression, mode = 'approximate', variables = {} } = body;

    // Validate input
    if (!expression || typeof expression !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing expression',
        },
        { status: 400 },
      );
    }

    // Validate expression length
    if (expression.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Expression too long (max 1000 characters)',
        },
        { status: 400 },
      );
    }

    // Evaluate expression
    const evalResult = evaluate(expression, { mode, variables });
    const executionTime = performance.now() - startTime;

    // Handle evaluation result
    if (!evalResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: evalResult.error.message,
          metadata: {
            evaluatedAt: new Date().toISOString(),
            mode,
            executionTime,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result:
          typeof evalResult.value === 'bigint' ? evalResult.value.toString() : evalResult.value,
        metadata: {
          evaluatedAt: new Date().toISOString(),
          mode,
          executionTime,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    const executionTime = performance.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
        metadata: {
          evaluatedAt: new Date().toISOString(),
          mode: 'approximate',
          executionTime,
        },
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/calculate?expression=2+2&mode=approximate
 * Alternative GET endpoint for simple calculations
 */
export async function GET(request: NextRequest): Promise<NextResponse<CalculateResponse>> {
  const startTime = performance.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const expression = searchParams.get('expression');
    const mode = (searchParams.get('mode') as ComputeMode) || 'approximate';

    if (!expression) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing expression parameter',
        },
        { status: 400 },
      );
    }

    const evalResult = evaluate(expression, { mode, variables: {} });
    const executionTime = performance.now() - startTime;

    // Handle evaluation result
    if (!evalResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: evalResult.error.message,
          metadata: {
            evaluatedAt: new Date().toISOString(),
            mode,
            executionTime,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result:
          typeof evalResult.value === 'bigint' ? evalResult.value.toString() : evalResult.value,
        metadata: {
          evaluatedAt: new Date().toISOString(),
          mode,
          executionTime,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600', // Cache GET requests for 1 hour
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    const executionTime = performance.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
        metadata: {
          evaluatedAt: new Date().toISOString(),
          mode: 'approximate',
          executionTime,
        },
      },
      { status: 500 },
    );
  }
}
