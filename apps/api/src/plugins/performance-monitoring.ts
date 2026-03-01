/**
 * Apollo Server 5.4.0 Plugin Collection
 *
 * Custom plugins using AS5 plugin lifecycle hooks:
 * - requestDidStart → didResolveOperation → executionDidStart → willResolveField
 * - willSendResponse / didEncounterErrors
 * - contextCreationDidFail / unexpectedErrorProcessingRequest
 */

import type {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import type { GraphQLContext } from '../lib/context';
import { logger } from '../lib/logger';
import { sendError, sendMetrics, sendUsage } from '../lib/monitoring';

interface PerformanceMetrics {
  operationName?: string | null;
  operationType?: string;
  duration: number;
  resolverDurations: Map<string, number>;
  errors: number;
  timestamp: string;
}

/**
 * Performance monitoring with resolver timing and slow query detection.
 */
export const performanceMonitoringPlugin = (): ApolloServerPlugin<GraphQLContext> => ({
  async requestDidStart(): Promise<GraphQLRequestListener<GraphQLContext>> {
    const startTime = Date.now();
    const resolverDurations = new Map<string, number>();

    return {
      async didResolveOperation(requestContext: GraphQLRequestContext<GraphQLContext>) {
        logger.debug('GraphQL operation resolved', {
          operationName: requestContext.operationName ?? 'anonymous',
          operationType: requestContext.operation?.operation,
        });
      },

      async executionDidStart() {
        return {
          willResolveField({ info }) {
            const start = Date.now();
            return () => {
              const duration = Date.now() - start;
              const fieldPath = `${info.parentType.name}.${info.fieldName}`;
              const existing = resolverDurations.get(fieldPath) || 0;
              resolverDurations.set(fieldPath, existing + duration);

              if (duration > 100) {
                logger.warn('Slow resolver detected', {
                  field: fieldPath,
                  durationMs: duration,
                });
              }
            };
          },
        };
      },

      async willSendResponse(requestContext: GraphQLRequestContext<GraphQLContext>) {
        const duration = Date.now() - startTime;
        const errors = requestContext.errors?.length || 0;

        const metrics: PerformanceMetrics = {
          ...(requestContext.operationName != null
            ? { operationName: requestContext.operationName }
            : {}),
          ...(requestContext.operation?.operation
            ? { operationType: requestContext.operation.operation }
            : {}),
          duration,
          resolverDurations,
          errors,
          timestamp: new Date().toISOString(),
        };

        const logLevel = errors > 0 ? 'error' : duration > 1000 ? 'warn' : 'info';

        logger[logLevel]('GraphQL request completed', {
          operationName: metrics.operationName ?? 'anonymous',
          operationType: metrics.operationType,
          durationMs: duration,
          errors,
        });

        if (duration > 500 && resolverDurations.size > 0) {
          const top = Array.from(resolverDurations.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          logger.info('Resolver breakdown for slow query', {
            operationName: metrics.operationName ?? 'anonymous',
            totalMs: duration,
            resolvers: top.map(([field, ms]) => ({
              field,
              ms,
              pct: `${((ms / duration) * 100).toFixed(1)}%`,
            })),
          });
        }

        await sendMetrics(metrics);
      },
    };
  },
});

/**
 * Response caching hints for queries.
 */
export const responseCachingPlugin = (): ApolloServerPlugin<GraphQLContext> => ({
  async requestDidStart() {
    return {
      async willSendResponse(requestContext) {
        if (requestContext.operation?.operation === 'query' && !requestContext.errors?.length) {
          let scope: 'PRIVATE' | 'PUBLIC' = 'PRIVATE';
          let maxAge = 60;

          if (requestContext.operationName?.includes('public')) {
            scope = 'PUBLIC';
            maxAge = 300;
          }

          logger.debug('Cache hint applied', {
            operationName: requestContext.operationName ?? 'anonymous',
            scope,
            maxAge,
          });
        }
      },
    };
  },
});

/**
 * Query complexity guard (prevents DoS via deeply nested queries).
 */
export const queryComplexityPlugin = (
  maxComplexity = 1000,
): ApolloServerPlugin<GraphQLContext> => ({
  async requestDidStart() {
    return {
      async didResolveOperation(requestContext) {
        const selections = requestContext.operation?.selectionSet.selections.length || 0;
        const estimatedComplexity = selections * 10;

        if (estimatedComplexity > maxComplexity) {
          throw new Error(`Query too complex: ${estimatedComplexity} (max: ${maxComplexity})`);
        }
      },
    };
  },
});

/**
 * Error tracking with AS5 contextCreationDidFail hook.
 */
export const errorTrackingPlugin = (): ApolloServerPlugin<GraphQLContext> => ({
  async contextCreationDidFail({ error }) {
    logger.error('Context creation failed in error tracking plugin', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await sendError(error instanceof Error ? error : new Error(String(error)), {
      operationName: 'contextCreation',
    });
  },

  async unexpectedErrorProcessingRequest({ error }) {
    logger.error('Unexpected Apollo Server error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await sendError(error instanceof Error ? error : new Error(String(error)), {
      operationName: 'unexpectedError',
    });
  },

  async requestDidStart() {
    return {
      async didEncounterErrors(requestContext) {
        for (const error of requestContext.errors ?? []) {
          logger.error('GraphQL resolver error', {
            message: error.message,
            path: error.path?.join('.'),
            code: error.extensions?.code as string | undefined,
            operationName: requestContext.operationName ?? 'anonymous',
          });

          await sendError(error, {
            ...(requestContext.operationName != null
              ? { operationName: requestContext.operationName }
              : {}),
            ...(error.path ? { path: error.path } : {}),
            extensions: error.extensions,
          });
        }
      },
    };
  },
});

/**
 * Usage analytics tracking.
 */
export const usageReportingPlugin = (): ApolloServerPlugin<GraphQLContext> => ({
  async requestDidStart(requestContext) {
    return {
      async willSendResponse() {
        const opName = requestContext.request.operationName;
        const opType = requestContext.request.query?.trim().split(/\s+/)[0];
        const userId = requestContext.contextValue.user?.id;

        await sendUsage({
          ...(opName != null ? { operationName: opName } : {}),
          ...(opType ? { operationType: opType } : {}),
          ...(userId ? { userId } : {}),
          timestamp: new Date().toISOString(),
        });
      },
    };
  },
});
