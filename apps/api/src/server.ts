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
 * stripping away Apollo's wrapper. Error logging is handled by
 * errorTrackingPlugin (didEncounterErrors hook) — formatError only
 * masks internal details in production responses.
 */
const formatError = (
  formattedError: GraphQLFormattedError,
  _error: unknown,
): GraphQLFormattedError => {
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

      // Custom plugins (errorTrackingPlugin handles contextCreationDidFail
      // and unexpectedErrorProcessingRequest — no inline duplicates needed)
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
