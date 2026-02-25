/**
 * Calculation Resolvers
 *
 * Handles calculation operations and history management.
 * Uses mathjs for expression evaluation.
 */

import type { GraphQLContext } from '../../lib/context';
import { requireAuth } from '../../lib/context';
import { redisHealthCheck } from '../../lib/cache';
import { evaluate, format } from 'mathjs';

const performCalculation = (
  expression: string,
  variables?: Record<string, unknown>,
  precision = 16
): { result: string; formatted: string } => {
  try {
    const scope = variables ? { ...variables } : {};
    const raw = evaluate(expression, scope);
    const result = typeof raw === 'object' && raw !== null
      ? format(raw, { precision })
      : String(raw);
    return { result, formatted: result };
  } catch (error) {
    throw new Error(
      `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const calculationResolvers = {
  Query: {
    /**
     * Perform a calculation
     */
    calculate: async (
      _parent: unknown,
      args: {
        input: {
          expression: string;
          variables?: Record<string, unknown>;
          precision?: number;
        };
      },
      _context: GraphQLContext
    ) => {
      const { result, formatted } = performCalculation(
        args.input.expression,
        args.input.variables,
        args.input.precision
      );

      return {
        input: args.input.expression,
        result,
        formatted,
        variables: args.input.variables || {},
        timestamp: new Date(),
      };
    },

    /**
     * Get calculation history for authenticated user
     */
    calculationHistory: async (
      _parent: unknown,
      args: {
        limit?: number;
        offset?: number;
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      const limit = Math.min(args.limit ?? 50, 200);
      const offset = args.offset ?? 0;

      const rows = await context.prisma.calculationHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          userId: true,
          expression: true,
          result: true,
          mode: true,
          latex: true,
          createdAt: true,
        },
      });

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        expression: row.expression,
        result: row.result,
        variables: {},
        timestamp: row.createdAt,
      }));
    },

    /**
     * Health check endpoint
     */
    health: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Check database connection
      const dbStart = Date.now();
      let dbStatus = 'healthy';
      let dbLatency: number | undefined;
      let dbError: string | undefined;

      try {
        await context.prisma.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - dbStart;
      } catch (error) {
        dbStatus = 'unhealthy';
        dbError = error instanceof Error ? error.message : 'Unknown error';
      }

      // Check Redis connection
      const redisHealth = await redisHealthCheck();

      return {
        status: dbStatus === 'healthy' && redisHealth.status === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date(),
        database: {
          status: dbStatus,
          latency: dbLatency,
          error: dbError,
        },
        redis: redisHealth,
        version: process.env['npm_package_version'] || '0.1.0',
      };
    },
  },

  Mutation: {
    /**
     * Save calculation to history
     *
     * Evaluates the expression server-side, then persists the entry to the
     * CalculationHistory table so it appears in the user's history across
     * sessions and devices.
     */
    saveCalculation: async (
      _parent: unknown,
      args: {
        input: {
          expression: string;
          variables?: Record<string, unknown>;
          precision?: number;
          mode?: string;
          latex?: string;
        };
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      // Evaluate expression server-side so the stored result is authoritative.
      const { result } = performCalculation(
        args.input.expression,
        args.input.variables,
        args.input.precision
      );

      const mode = args.input.mode ?? 'approximate';

      const row = await context.prisma.calculationHistory.create({
        data: {
          userId: user.id,
          expression: args.input.expression,
          result,
          mode,
          ...(args.input.latex ? { latex: args.input.latex } : {}),
        },
        select: {
          id: true,
          userId: true,
          expression: true,
          result: true,
          mode: true,
          latex: true,
          createdAt: true,
        },
      });

      return {
        id: row.id,
        userId: row.userId,
        expression: row.expression,
        result: row.result,
        variables: args.input.variables ?? {},
        timestamp: row.createdAt,
      };
    },

    /**
     * Clear all calculation history for the authenticated user.
     */
    clearCalculationHistory: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      await context.prisma.calculationHistory.deleteMany({
        where: { userId: user.id },
      });

      return true;
    },
  },
};
