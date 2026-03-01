/**
 * Custom GraphQL Error Classes
 *
 * Apollo Server v5 enhanced error handling with custom error types.
 * Provides structured, type-safe errors with proper error codes and metadata.
 *
 * @see https://www.apollographql.com/docs/apollo-server/data/errors/
 */

import { GraphQLError, type GraphQLErrorOptions } from 'graphql';
import { logger } from './logger';

/**
 * Base error class for all GraphQL errors
 */
export class BaseGraphQLError extends GraphQLError {
  constructor(
    message: string,
    code: string,
    options?: GraphQLErrorOptions & {
      field?: string;
      statusCode?: number;
      originalError?: Error;
    },
  ) {
    super(message, {
      ...options,
      extensions: {
        code,
        ...(options?.field ? { field: options.field } : {}),
        statusCode: options?.statusCode || 500,
        timestamp: new Date().toISOString(),
        ...options?.extensions,
      },
    });

    if (options?.originalError?.stack) {
      this.stack = options.originalError.stack;
    }
  }
}

/**
 * Authentication required error
 */
export class AuthenticationError extends BaseGraphQLError {
  constructor(message = 'Authentication required', field?: string) {
    super(message, 'UNAUTHENTICATED', {
      ...(field ? { field } : {}),
      statusCode: 401,
    });
  }
}

/**
 * Authorization/permission error
 */
export class ForbiddenError extends BaseGraphQLError {
  constructor(message = 'You do not have permission to perform this action', field?: string) {
    super(message, 'FORBIDDEN', {
      ...(field ? { field } : {}),
      statusCode: 403,
    });
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends BaseGraphQLError {
  constructor(resource: string, identifier?: string, field?: string) {
    const message = identifier
      ? `${resource} with identifier "${identifier}" not found`
      : `${resource} not found`;

    super(message, 'NOT_FOUND', {
      ...(field ? { field } : {}),
      statusCode: 404,
      extensions: {
        resource,
        ...(identifier ? { identifier } : {}),
      },
    });
  }
}

/**
 * Input validation error
 */
export class ValidationError extends BaseGraphQLError {
  constructor(message: string, field?: string, validationErrors?: Record<string, string[]>) {
    super(message, 'BAD_USER_INPUT', {
      ...(field ? { field } : {}),
      statusCode: 400,
      ...(validationErrors ? { extensions: { validationErrors } } : {}),
    });
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends BaseGraphQLError {
  constructor(
    retryAfter: number, // seconds
    message = 'Rate limit exceeded',
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', {
      statusCode: 429,
      extensions: {
        retryAfter,
        retryAt: new Date(Date.now() + retryAfter * 1000).toISOString(),
      },
    });
  }
}

/**
 * Internal server error (use sparingly, log details internally)
 */
export class InternalServerError extends BaseGraphQLError {
  constructor(
    message = 'An internal server error occurred',
    originalError?: Error,
    field?: string,
  ) {
    super(message, 'INTERNAL_SERVER_ERROR', {
      ...(field ? { field } : {}),
      statusCode: 500,
      ...(originalError ? { originalError } : {}),
    });

    // Log the original error for debugging but don't expose details to client
    if (originalError) {
      logger.error('Internal server error details', {
        originalMessage: originalError.message,
        stack: originalError.stack,
      });
    }
  }
}

/**
 * Conflict error (e.g., duplicate resource)
 */
export class ConflictError extends BaseGraphQLError {
  constructor(message: string, field?: string, conflictingResource?: string) {
    super(message, 'CONFLICT', {
      ...(field ? { field } : {}),
      statusCode: 409,
      ...(conflictingResource ? { extensions: { conflictingResource } } : {}),
    });
  }
}

/**
 * Payment required error (for premium features)
 */
export class PaymentRequiredError extends BaseGraphQLError {
  constructor(message = 'This feature requires a premium subscription', requiredPlan?: string) {
    super(message, 'PAYMENT_REQUIRED', {
      statusCode: 402,
      ...(requiredPlan ? { extensions: { requiredPlan } } : {}),
    });
  }
}

/**
 * Service unavailable error (maintenance, third-party API down, etc.)
 */
export class ServiceUnavailableError extends BaseGraphQLError {
  constructor(
    service: string,
    retryAfter?: number,
    message = `${service} is temporarily unavailable`,
  ) {
    super(message, 'SERVICE_UNAVAILABLE', {
      statusCode: 503,
      extensions: {
        service,
        ...(retryAfter != null
          ? {
              retryAfter,
              retryAt: new Date(Date.now() + retryAfter * 1000).toISOString(),
            }
          : {}),
      },
    });
  }
}

/**
 * Helper to check if an error is a custom GraphQL error
 */
export const isGraphQLError = (error: unknown): error is BaseGraphQLError => {
  return error instanceof BaseGraphQLError;
};

/**
 * Helper to sanitize errors for production
 * Removes sensitive information from error messages
 */
export const sanitizeError = (error: GraphQLError): GraphQLError => {
  // In production, mask internal server errors
  if (process.env.NODE_ENV === 'production') {
    if (error.extensions?.code === 'INTERNAL_SERVER_ERROR' || !error.extensions?.code) {
      return new InternalServerError();
    }
  }

  return error;
};
