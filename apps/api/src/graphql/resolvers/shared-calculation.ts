/**
 * Shared Calculation Resolvers
 *
 * Handles creating and retrieving shared calculations via short URL codes.
 * Anonymous sharing is permitted (no auth required for the mutation).
 */

import crypto from 'node:crypto';
import type { GraphQLContext } from '../../lib/context';
import { ValidationError } from '../../lib/errors';
import { validate, shareCalculationSchema } from '../../lib/validation';

/**
 * Generate a cryptographically random 8-character alphanumeric code.
 * Uses a URL-safe alphabet (a-z, A-Z, 0-9) for clean short URLs.
 */
function generateShortCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[(bytes[i] ?? 0) % alphabet.length];
  }
  return code;
}

/**
 * Generate a unique short code with collision retry.
 * Retries up to `maxAttempts` times if a collision is detected.
 */
async function generateUniqueShortCode(
  prisma: GraphQLContext['prisma'],
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateShortCode();
    const existing = await prisma.sharedCalculation.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new ValidationError(
    'Failed to generate a unique share code. Please try again.',
  );
}

export const sharedCalculationResolvers = {
  Query: {
    /**
     * Look up a shared calculation by its short code.
     * Returns null if not found or if the share has expired.
     */
    sharedCalculation: async (
      _parent: unknown,
      args: { shortCode: string },
      context: GraphQLContext,
    ) => {
      const shortCode = args.shortCode.trim();
      if (shortCode.length === 0 || shortCode.length > 8) {
        return null;
      }

      const shared = await context.prisma.sharedCalculation.findUnique({
        where: { shortCode },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      if (!shared) return null;

      // Check expiry
      if (shared.expiresAt && shared.expiresAt < new Date()) {
        return null;
      }

      return shared;
    },
  },

  Mutation: {
    /**
     * Create a shared calculation.
     * Authentication is optional — anonymous shares are allowed.
     * When the user is signed in, the share is linked to their account.
     */
    shareCalculation: async (
      _parent: unknown,
      args: {
        latex: string;
        expression: string;
        title?: string;
        description?: string;
        result?: string;
      },
      context: GraphQLContext,
    ) => {
      const input = validate(shareCalculationSchema, {
        latex: args.latex,
        expression: args.expression,
        ...(args.title ? { title: args.title } : {}),
        ...(args.description ? { description: args.description } : {}),
        ...(args.result ? { result: args.result } : {}),
      });

      const shortCode = await generateUniqueShortCode(context.prisma);

      const shared = await context.prisma.sharedCalculation.create({
        data: {
          shortCode,
          latex: input.latex,
          expression: input.expression,
          ...(input.title ? { title: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.result ? { result: input.result } : {}),
          ...(context.user ? { userId: context.user.id } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      return shared;
    },
  },
};
