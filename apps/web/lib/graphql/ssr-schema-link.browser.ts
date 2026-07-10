/**
 * Browser stand-in for ssr-schema-link.server.ts.
 *
 * Resolved via the `browser` condition of the `#graphql/ssr-schema-link`
 * entry in package.json `imports`, so the server module — and its Prisma /
 * @nextcalc/api dependency graph — never enters the client bundle.
 *
 * makeClient only calls createSsrSchemaLink when `typeof window ===
 * 'undefined'`, so this function is unreachable in the browser; it exists
 * purely to give the browser bundle a resolvable, dependency-free module.
 */

import type { ApolloLink } from '@apollo/client';

export function createSsrSchemaLink(): ApolloLink {
  throw new Error('createSsrSchemaLink is server-only — browser clients terminate with HttpLink.');
}
