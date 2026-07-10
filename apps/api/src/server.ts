/**
 * Apollo Server 5.5.1 Configuration
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
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import { resolvers } from './graphql/resolvers';
import { typeDefs } from './graphql/schema';
import type { GraphQLContext } from './lib/context';
import { createDataLoaders } from './lib/dataloaders';
import { sanitizeError } from './lib/errors';
import {
  errorTrackingPlugin,
  performanceMonitoringPlugin,
  queryComplexityPlugin,
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
 * stripping away Apollo's wrapper, so we can tell whether the error was one
 * of our structured BaseGraphQLError subclasses or an arbitrary thrown
 * value. Masking itself is delegated entirely to `sanitizeError` (lib/errors.ts)
 * — the single implementation of "hide internal details in production" —
 * instead of duplicating that logic here. Error logging is handled
 * separately by errorTrackingPlugin (didEncounterErrors hook).
 */
const formatError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const originalError = unwrapResolverError(error);

  // Reconstruct a GraphQLError to run through sanitizeError. When the
  // original error already is one (the common case — BaseGraphQLError
  // subclasses and graphql-js validation/parse errors), reuse it directly
  // so extensions/path/locations are preserved exactly.
  const graphQLError =
    originalError instanceof GraphQLError
      ? originalError
      : new GraphQLError(formattedError.message, { extensions: formattedError.extensions });

  const sanitized = sanitizeError(graphQLError);

  // sanitizeError left the error untouched (dev mode, or a non-internal
  // error code) — return Apollo's fully formatted error unmodified so
  // locations/path stay intact.
  if (sanitized === graphQLError) {
    return formattedError;
  }

  // sanitizeError replaced it with a masked InternalServerError — strip
  // everything but the generic message/code.
  return { message: sanitized.message, extensions: sanitized.extensions };
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
            ...(process.env['APOLLO_GRAPH_REF']
              ? { graphRef: process.env['APOLLO_GRAPH_REF'] }
              : {}),
            footer: false,
          }),

      // Real response cache-hint plugin (AS5). Resolvers set per-field hints
      // via setCacheHint() from lib/cache-control.ts (see e.g.
      // Query.publicWorksheets, Query.forumPosts). defaultMaxAge: 0 means
      // fields without an explicit hint are treated as uncacheable rather
      // than silently cached.
      ApolloServerPluginCacheControl({ defaultMaxAge: 0, calculateHttpHeaders: true }),

      // Custom plugins (errorTrackingPlugin handles contextCreationDidFail
      // and unexpectedErrorProcessingRequest — no inline duplicates needed)
      performanceMonitoringPlugin(),
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

export { rateLimit } from './lib/cache';
export { RateLimitError } from './lib/errors';
export type { GraphQLContext };
/** Re-exports for SSE/subscription consumers */
export { createDataLoaders };
