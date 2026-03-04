import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraphQLError } from 'graphql';
import {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ConflictError,
  PaymentRequiredError,
  ServiceUnavailableError,
  isGraphQLError,
  sanitizeError,
} from '../../lib/errors';

// ---------------------------------------------------------------------------
// AuthenticationError
// ---------------------------------------------------------------------------

describe('AuthenticationError', () => {
  it('has UNAUTHENTICATED code and 401 status', () => {
    const error = new AuthenticationError();

    expect(error.extensions.code).toBe('UNAUTHENTICATED');
    expect(error.extensions.statusCode).toBe(401);
  });

  it('uses the default message', () => {
    const error = new AuthenticationError();
    expect(error.message).toBe('Authentication required');
  });

  it('accepts a custom message', () => {
    const error = new AuthenticationError('Token expired');
    expect(error.message).toBe('Token expired');
  });

  it('accepts an optional field parameter', () => {
    const error = new AuthenticationError('Bad token', 'authorization');
    expect(error.extensions.field).toBe('authorization');
  });

  it('omits the field extension when not provided', () => {
    const error = new AuthenticationError();
    expect(error.extensions.field).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ForbiddenError
// ---------------------------------------------------------------------------

describe('ForbiddenError', () => {
  it('has FORBIDDEN code and 403 status', () => {
    const error = new ForbiddenError();

    expect(error.extensions.code).toBe('FORBIDDEN');
    expect(error.extensions.statusCode).toBe(403);
  });

  it('uses the default message', () => {
    const error = new ForbiddenError();
    expect(error.message).toBe('You do not have permission to perform this action');
  });

  it('accepts a custom message', () => {
    const error = new ForbiddenError('Admin only');
    expect(error.message).toBe('Admin only');
  });

  it('accepts an optional field parameter', () => {
    const error = new ForbiddenError('Not allowed', 'role');
    expect(error.extensions.field).toBe('role');
  });
});

// ---------------------------------------------------------------------------
// NotFoundError
// ---------------------------------------------------------------------------

describe('NotFoundError', () => {
  it('has NOT_FOUND code and 404 status', () => {
    const error = new NotFoundError('User');

    expect(error.extensions.code).toBe('NOT_FOUND');
    expect(error.extensions.statusCode).toBe(404);
  });

  it('generates a message with just the resource name', () => {
    const error = new NotFoundError('Worksheet');
    expect(error.message).toBe('Worksheet not found');
  });

  it('interpolates resource and identifier into the message', () => {
    const error = new NotFoundError('User', 'user-42');
    expect(error.message).toBe('User with identifier "user-42" not found');
  });

  it('includes resource in extensions', () => {
    const error = new NotFoundError('ForumPost', 'post-1');
    expect(error.extensions.resource).toBe('ForumPost');
  });

  it('includes identifier in extensions when provided', () => {
    const error = new NotFoundError('ForumPost', 'post-1');
    expect(error.extensions.identifier).toBe('post-1');
  });

  it('omits identifier from extensions when not provided', () => {
    const error = new NotFoundError('Folder');
    expect(error.extensions.identifier).toBeUndefined();
  });

  it('accepts an optional field parameter', () => {
    const error = new NotFoundError('User', 'u-1', 'userId');
    expect(error.extensions.field).toBe('userId');
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

describe('ValidationError', () => {
  it('has BAD_USER_INPUT code and 400 status', () => {
    const error = new ValidationError('Invalid input');

    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(error.extensions.statusCode).toBe(400);
  });

  it('uses the provided message', () => {
    const error = new ValidationError('Email is required');
    expect(error.message).toBe('Email is required');
  });

  it('accepts a field parameter', () => {
    const error = new ValidationError('Too short', 'username');
    expect(error.extensions.field).toBe('username');
  });

  it('accepts validationErrors record', () => {
    const validationErrors = {
      email: ['Invalid format', 'Already taken'],
      password: ['Too short'],
    };
    const error = new ValidationError('Validation failed', undefined, validationErrors);
    expect(error.extensions.validationErrors).toEqual(validationErrors);
  });

  it('omits validationErrors from extensions when not provided', () => {
    const error = new ValidationError('Bad input');
    expect(error.extensions.validationErrors).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RateLimitError
// ---------------------------------------------------------------------------

describe('RateLimitError', () => {
  it('has RATE_LIMIT_EXCEEDED code and 429 status', () => {
    const error = new RateLimitError(60);

    expect(error.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.extensions.statusCode).toBe(429);
  });

  it('uses the default message', () => {
    const error = new RateLimitError(30);
    expect(error.message).toBe('Rate limit exceeded');
  });

  it('accepts a custom message', () => {
    const error = new RateLimitError(10, 'Slow down');
    expect(error.message).toBe('Slow down');
  });

  it('includes retryAfter in extensions', () => {
    const error = new RateLimitError(120);
    expect(error.extensions.retryAfter).toBe(120);
  });

  it('includes retryAt ISO timestamp in extensions', () => {
    const now = new Date('2026-03-04T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const error = new RateLimitError(60);
    expect(error.extensions.retryAt).toBe('2026-03-04T12:01:00.000Z');

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// InternalServerError
// ---------------------------------------------------------------------------

describe('InternalServerError', () => {
  it('has INTERNAL_SERVER_ERROR code and 500 status', () => {
    const error = new InternalServerError();

    expect(error.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    expect(error.extensions.statusCode).toBe(500);
  });

  it('uses the default message', () => {
    const error = new InternalServerError();
    expect(error.message).toBe('An internal server error occurred');
  });

  it('accepts a custom message', () => {
    const error = new InternalServerError('Database connection lost');
    expect(error.message).toBe('Database connection lost');
  });

  it('accepts an optional field parameter', () => {
    const error = new InternalServerError('Failure', undefined, 'query');
    expect(error.extensions.field).toBe('query');
  });
});

// ---------------------------------------------------------------------------
// ConflictError
// ---------------------------------------------------------------------------

describe('ConflictError', () => {
  it('has CONFLICT code and 409 status', () => {
    const error = new ConflictError('Duplicate entry');

    expect(error.extensions.code).toBe('CONFLICT');
    expect(error.extensions.statusCode).toBe(409);
  });

  it('uses the provided message', () => {
    const error = new ConflictError('Username already taken');
    expect(error.message).toBe('Username already taken');
  });

  it('accepts an optional field parameter', () => {
    const error = new ConflictError('Conflict', 'email');
    expect(error.extensions.field).toBe('email');
  });

  it('includes conflictingResource in extensions when provided', () => {
    const error = new ConflictError('Duplicate', undefined, 'User');
    expect(error.extensions.conflictingResource).toBe('User');
  });
});

// ---------------------------------------------------------------------------
// PaymentRequiredError
// ---------------------------------------------------------------------------

describe('PaymentRequiredError', () => {
  it('has PAYMENT_REQUIRED code and 402 status', () => {
    const error = new PaymentRequiredError();

    expect(error.extensions.code).toBe('PAYMENT_REQUIRED');
    expect(error.extensions.statusCode).toBe(402);
  });

  it('uses the default message', () => {
    const error = new PaymentRequiredError();
    expect(error.message).toBe('This feature requires a premium subscription');
  });

  it('accepts a custom message', () => {
    const error = new PaymentRequiredError('Upgrade required');
    expect(error.message).toBe('Upgrade required');
  });

  it('includes requiredPlan in extensions when provided', () => {
    const error = new PaymentRequiredError('Upgrade needed', 'pro');
    expect(error.extensions.requiredPlan).toBe('pro');
  });
});

// ---------------------------------------------------------------------------
// ServiceUnavailableError
// ---------------------------------------------------------------------------

describe('ServiceUnavailableError', () => {
  it('has SERVICE_UNAVAILABLE code and 503 status', () => {
    const error = new ServiceUnavailableError('Redis');

    expect(error.extensions.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.extensions.statusCode).toBe(503);
  });

  it('interpolates the service name into the default message', () => {
    const error = new ServiceUnavailableError('Redis');
    expect(error.message).toBe('Redis is temporarily unavailable');
  });

  it('accepts a custom message', () => {
    const error = new ServiceUnavailableError('Redis', undefined, 'Cache is down');
    expect(error.message).toBe('Cache is down');
  });

  it('includes service name in extensions', () => {
    const error = new ServiceUnavailableError('Prisma');
    expect(error.extensions.service).toBe('Prisma');
  });

  it('includes retryAfter and retryAt when provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T12:00:00.000Z'));

    const error = new ServiceUnavailableError('CAS', 30);
    expect(error.extensions.retryAfter).toBe(30);
    expect(error.extensions.retryAt).toBe('2026-03-04T12:00:30.000Z');

    vi.useRealTimers();
  });

  it('omits retryAfter and retryAt when not provided', () => {
    const error = new ServiceUnavailableError('Redis');
    expect(error.extensions.retryAfter).toBeUndefined();
    expect(error.extensions.retryAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isGraphQLError
// ---------------------------------------------------------------------------

describe('isGraphQLError', () => {
  it('returns true for AuthenticationError', () => {
    expect(isGraphQLError(new AuthenticationError())).toBe(true);
  });

  it('returns true for ForbiddenError', () => {
    expect(isGraphQLError(new ForbiddenError())).toBe(true);
  });

  it('returns true for NotFoundError', () => {
    expect(isGraphQLError(new NotFoundError('X'))).toBe(true);
  });

  it('returns true for ValidationError', () => {
    expect(isGraphQLError(new ValidationError('bad'))).toBe(true);
  });

  it('returns true for RateLimitError', () => {
    expect(isGraphQLError(new RateLimitError(60))).toBe(true);
  });

  it('returns true for InternalServerError', () => {
    expect(isGraphQLError(new InternalServerError())).toBe(true);
  });

  it('returns true for ConflictError', () => {
    expect(isGraphQLError(new ConflictError('dup'))).toBe(true);
  });

  it('returns true for PaymentRequiredError', () => {
    expect(isGraphQLError(new PaymentRequiredError())).toBe(true);
  });

  it('returns true for ServiceUnavailableError', () => {
    expect(isGraphQLError(new ServiceUnavailableError('svc'))).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isGraphQLError(new Error('boom'))).toBe(false);
  });

  it('returns false for a plain GraphQLError (not BaseGraphQLError)', () => {
    expect(isGraphQLError(new GraphQLError('generic'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGraphQLError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGraphQLError(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isGraphQLError('UNAUTHENTICATED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeError
// ---------------------------------------------------------------------------

describe('sanitizeError', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('masks INTERNAL_SERVER_ERROR in production with generic message', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const original = new GraphQLError('Secret DB details leaked', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    const sanitized = sanitizeError(original);

    expect(sanitized.message).toBe('An internal server error occurred');
    expect(sanitized.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    // Original sensitive message should not be present
    expect(sanitized.message).not.toContain('Secret');
  });

  it('masks errors with no code in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const original = new GraphQLError('Unexpected failure');
    const sanitized = sanitizeError(original);

    expect(sanitized.message).toBe('An internal server error occurred');
  });

  it('passes through non-internal errors in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const original = new ValidationError('Email is invalid', 'email');
    const sanitized = sanitizeError(original);

    expect(sanitized).toBe(original);
    expect(sanitized.message).toBe('Email is invalid');
  });

  it('passes through INTERNAL_SERVER_ERROR in development (no masking)', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const original = new GraphQLError('Detailed DB error info', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    const sanitized = sanitizeError(original);

    expect(sanitized).toBe(original);
    expect(sanitized.message).toBe('Detailed DB error info');
  });

  it('passes through all errors in test environment', () => {
    vi.stubEnv('NODE_ENV', 'test');

    const original = new GraphQLError('Some error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    const sanitized = sanitizeError(original);

    expect(sanitized).toBe(original);
  });

  it('passes through custom error classes unmodified in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const errors = [
      new AuthenticationError(),
      new ForbiddenError(),
      new NotFoundError('User'),
      new RateLimitError(60),
      new ConflictError('Duplicate'),
      new PaymentRequiredError(),
      new ServiceUnavailableError('Redis'),
    ];

    for (const error of errors) {
      expect(sanitizeError(error)).toBe(error);
    }
  });
});

// ---------------------------------------------------------------------------
// Common BaseGraphQLError behavior
// ---------------------------------------------------------------------------

describe('BaseGraphQLError common behavior', () => {
  it('includes a timestamp in extensions', () => {
    const error = new AuthenticationError();
    expect(error.extensions.timestamp).toBeDefined();
    expect(typeof error.extensions.timestamp).toBe('string');
    // Should be a valid ISO date string
    expect(new Date(error.extensions.timestamp as string).toISOString()).toBe(
      error.extensions.timestamp,
    );
  });

  it('all error classes extend GraphQLError', () => {
    const errors = [
      new AuthenticationError(),
      new ForbiddenError(),
      new NotFoundError('X'),
      new ValidationError('bad'),
      new RateLimitError(1),
      new InternalServerError(),
      new ConflictError('dup'),
      new PaymentRequiredError(),
      new ServiceUnavailableError('svc'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(GraphQLError);
    }
  });
});
