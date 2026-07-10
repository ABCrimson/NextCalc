/**
 * Typed access to the `info.cacheControl` API added to GraphQLResolveInfo
 * at runtime by `ApolloServerPluginCacheControl` (registered in server.ts).
 *
 * @apollo/server does not re-export public types for this augmented `info`
 * field — the shape lives in `@apollo/cache-control-types`, a transitive
 * dependency that pnpm's strict linking does not expose to this workspace
 * package. This narrow structural type mirrors that package's
 * `ResolveInfoCacheControl.setCacheHint` shape exactly, so resolvers can set
 * hints without an `any` cast.
 *
 * @see https://www.apollographql.com/docs/apollo-server/performance/caching
 */

import type { GraphQLResolveInfo } from 'graphql';

export type CacheScope = 'PUBLIC' | 'PRIVATE';

export interface CacheHint {
  maxAge?: number;
  scope?: CacheScope;
}

interface ResolveInfoWithCacheControl {
  cacheControl?: {
    setCacheHint: (hint: CacheHint) => void;
  };
}

/**
 * Set a cache hint on the current field.
 * No-ops safely when `info` is omitted (e.g. unit tests that call
 * resolvers directly without the 4th GraphQL argument) or when the
 * cache-control plugin isn't active.
 */
export function setCacheHint(info: GraphQLResolveInfo | undefined, hint: CacheHint): void {
  (
    info as (GraphQLResolveInfo & ResolveInfoWithCacheControl) | undefined
  )?.cacheControl?.setCacheHint(hint);
}
