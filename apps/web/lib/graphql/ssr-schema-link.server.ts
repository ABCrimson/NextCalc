/**
 * SSR Terminating Link — In-Process GraphQL Execution
 *
 * Why this exists: during streaming SSR, useSuspenseQuery executes queries
 * before any HTML reaches the browser. Fetching our own /api/graphql over
 * HTTP is both wasteful (a network round-trip back into the same process)
 * and fragile: without explicit configuration, the only origin the server
 * knows for itself on Vercel is VERCEL_URL — the *deployment-specific*
 * `*.vercel.app` URL, which sits behind Deployment Protection (Vercel
 * Authentication) and answers anonymous server-to-server POSTs with an
 * HTTP 401 "Protected deployment" challenge instead of GraphQL JSON.
 * Apollo surfaced that as a network error, errorPolicy 'all' nulled the
 * data, and every SSR'd page streamed its "not found" branch — an
 * SEO-breaking defect that never reproduced in the browser (the browser
 * fetches same-origin with the public domain and simply re-ran the query).
 *
 * The architectural fix: terminate the SSR link chain with a SchemaLink
 * that executes operations directly against the same executable schema the
 * /api/graphql route handler serves. No HTTP, no origin resolution, no
 * deployment-protection trap.
 *
 * Auth semantics: the context is ANONYMOUS (user: null) — identical to the
 * previous behavior, since the HTTP self-fetch never forwarded cookies
 * either. SSR renders the public view; the browser re-runs auth-sensitive
 * operations with session cookies after hydration.
 *
 * Bundling: this module must never reach the browser (it pulls in Prisma
 * and the whole @nextcalc/api server graph). client.ts imports it through
 * the package.json `imports` entry `#graphql/ssr-schema-link`, whose
 * `browser` condition deterministically resolves to
 * ssr-schema-link.browser.ts in browser bundles (webpack and Turbopack
 * both honor package.json `imports` conditions).
 */

import { SchemaLink } from '@apollo/client/link/schema';
import { createDataLoaders, type GraphQLContext, schema } from '@nextcalc/api/server';
import { prisma } from '@/lib/prisma';

/**
 * Create the SSR terminating link.
 *
 * The context is built per operation (SchemaLink calls the function for
 * every operation), so each execution gets fresh DataLoaders — loader
 * caches must never leak across operations or requests. The shape matches
 * the in-process context built by app/api/graphql/stream/route.ts.
 */
export function createSsrSchemaLink(): SchemaLink {
  return new SchemaLink({
    schema,
    context: (): GraphQLContext => ({
      user: null,
      prisma,
      loaders: createDataLoaders(prisma),
      req: { headers: {} },
    }),
  });
}
