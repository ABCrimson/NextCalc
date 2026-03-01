/**
 * Apollo Server 5.4.0 Configuration
 *
 * Production-ready GraphQL server with:
 * - unwrapResolverError for proper error formatting (AS5 best practice)
 * - contextCreationDidFail / unexpectedErrorProcessingRequest plugin hooks
 * - Modern plugin architecture for monitoring and caching
 * - Structured error handling with HTTP status codes
 * - WebSocket subscriptions support (schema ready)
 * - Performance monitoring and query complexity analysis
 */

import { ApolloServer } from '@apollo/server';
import { unwrapResolverError } from '@apollo/server/errors';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLFormattedError } from 'graphql';
import { resolvers } from './graphql/resolvers';
import { typeDefs } from './graphql/schema';
import type { GraphQLContext } from './lib/context';
import { createDataLoaders } from './lib/dataloaders';
import { logger } from './lib/logger';
import {
  errorTrackingPlugin,
  performanceMonitoringPlugin,
  queryComplexityPlugin,
  responseCachingPlugin,
  usageReportingPlugin,
} from './plugins';

/** Executable GraphQL schema with subscriptions support */
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * AS5 formatError using unwrapResolverError
 *
 * unwrapResolverError extracts the original error thrown by the resolver,
 * stripping away Apollo's wrapper. This allows logging the real error
 * while masking internal details in production responses.
 */
const formatError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const originalError = unwrapResolverError(error);

  // Always log errors structurally — in production the level filter handles visibility
  logger.error('GraphQL error in formatError', {
    message: formattedError.message,
    path: formattedError.path?.join('.'),
    code: formattedError.extensions?.code as string | undefined,
    original: originalError instanceof Error ? originalError.message : undefined,
  });

  // In production, mask internal server errors to avoid leaking implementation details
  if (
    !isDevelopment &&
    (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR' ||
      !formattedError.extensions?.code)
  ) {
    return {
      message: 'An internal error occurred',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
  }

  return formattedError;
};

/**
 * Create Apollo Server instance
 */
export function createApolloServer(httpServer?: import('node:http').Server) {
  return new ApolloServer<GraphQLContext>({
    schema,
    introspection: isDevelopment,
    plugins: [
      // Graceful shutdown (production with HTTP server)
      ...(httpServer ? [ApolloServerPluginDrainHttpServer({ httpServer })] : []),

      // Landing page
      isDevelopment
        ? ApolloServerPluginLandingPageLocalDefault({
            embed: true,
            includeCookies: true,
          })
        : ApolloServerPluginLandingPageProductionDefault({
            ...(process.env.APOLLO_GRAPH_REF ? { graphRef: process.env.APOLLO_GRAPH_REF } : {}),
            footer: false,
          }),

      // AS5 error lifecycle hooks
      {
        async contextCreationDidFail({ error }) {
          logger.error('Context creation failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        },
        async unexpectedErrorProcessingRequest({ error }) {
          logger.error('Unexpected Apollo Server error', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        },
      },

      // Custom plugins
      performanceMonitoringPlugin(),
      responseCachingPlugin(),
      queryComplexityPlugin(1000),
      errorTrackingPlugin(),
      usageReportingPlugin(),
    ],
    formatError,
    includeStacktraceInErrorResponses: isDevelopment,
    cache: 'bounded',
    nodeEnv: process.env.NODE_ENV,
  });
}

/** Default server instance for Next.js API routes */
export const server = createApolloServer();

/** Graceful shutdown handler */
export async function shutdownServer() {
  await server.stop();
}

// Handle process termination in production
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    await shutdownServer();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/** Re-exports for SSE/subscription consumers */
export { createDataLoaders };
export type { GraphQLContext };
export { rateLimit } from './lib/cache';
export { RateLimitError } from './lib/errors';
