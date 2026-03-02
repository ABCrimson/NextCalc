/**
 * Input validation schemas for CAS service endpoints
 * Uses Zod for runtime type validation and type inference
 */

import { z } from 'zod';

/**
 * Schema for algebraic equation solving requests
 * Supports equations like "2x + 5 = 13" or systems of equations
 */
export const solveSchema = z.object({
  expression: z
    .string()
    .min(1, 'Expression cannot be empty')
    .max(1000, 'Expression too long (max 1000 characters)')
    .refine((expr) => expr.includes('='), 'Expression must be an equation (contain =)'),
  variable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Variable must be a valid identifier')
    .optional()
    .default('x'),
  precision: z.number().int().min(1).max(15).optional().default(10),
});

/**
 * Schema for symbolic differentiation requests
 * Supports single-variable differentiation with optional order
 */
export const differentiateSchema = z.object({
  expression: z
    .string()
    .min(1, 'Expression cannot be empty')
    .max(1000, 'Expression too long (max 1000 characters)'),
  variable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Variable must be a valid identifier')
    .optional()
    .default('x'),
  order: z
    .number()
    .int()
    .min(1, 'Order must be at least 1')
    .max(5, 'Order cannot exceed 5')
    .optional()
    .default(1),
  simplify: z.boolean().optional().default(true),
});

/**
 * Schema for symbolic integration requests
 * Supports definite and indefinite integrals
 */
export const integrateSchema = z
  .object({
    expression: z
      .string()
      .min(1, 'Expression cannot be empty')
      .max(1000, 'Expression too long (max 1000 characters)'),
    variable: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Variable must be a valid identifier')
      .optional()
      .default('x'),
    lowerBound: z.number().finite().optional(),
    upperBound: z.number().finite().optional(),
    simplify: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      // If one bound is provided, both must be provided
      const hasLower = data.lowerBound !== undefined;
      const hasUpper = data.upperBound !== undefined;
      return hasLower === hasUpper;
    },
    {
      message: 'Both lowerBound and upperBound must be provided for definite integrals',
    },
  )
  .refine(
    (data) => {
      // Lower bound must be less than upper bound
      if (data.lowerBound !== undefined && data.upperBound !== undefined) {
        return data.lowerBound < data.upperBound;
      }
      return true;
    },
    {
      message: 'lowerBound must be less than upperBound',
    },
  );

/**
 * Type inference from Zod schemas for TypeScript
 */
export type SolveRequest = z.infer<typeof solveSchema>;
export type DifferentiateRequest = z.infer<typeof differentiateSchema>;
export type IntegrateRequest = z.infer<typeof integrateSchema>;

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  metadata?: {
    executionTime?: number;
    timestamp: string;
  };
}

/**
 * Validates request body against a Zod schema
 * @param data - Raw request data to validate
 * @param schema - Zod schema to validate against
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 */
export function validateRequest<T>(data: unknown, schema: z.ZodSchema<T>): T {
  return schema.parse(data);
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(data: T, executionTime?: number): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      ...(executionTime !== undefined ? { executionTime } : {}),
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string,
  code: string,
  details?: unknown,
): ApiResponse<never> {
  return {
    success: false,
    error: {
      message,
      code,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}
