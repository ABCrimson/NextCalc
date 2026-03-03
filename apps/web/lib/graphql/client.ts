/**
 * Apollo Client 4.2.0-alpha.0 — Client Component Factory
 *
 * Creates an ApolloClient instance for use in Next.js Client Components.
 * Uses the @apollo/client-integration-nextjs patched ApolloClient/InMemoryCache
 * for proper SSR hydration in the Next.js App Router.
 *
 * AC4 modern features used:
 * - CombinedGraphQLErrors for unified error discrimination
 * - ErrorLink class (AC4 class-based links)
 * - from() for type-safe link composition
 * - InMemoryCache typePolicies with offset-based pagination
 */

'use client';

import {
  ApolloLink,
  CombinedGraphQLErrors,
  from,
  HttpLink,
  Observable,
  split,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { ApolloClient, InMemoryCache } from '@apollo/client-integration-nextjs';
import { print } from 'graphql';
import { createClient } from 'graphql-sse';

/**
 * Merge function for offset-based paginated lists.
 * Appends new nodes to existing ones based on offset args.
 */
function offsetPaginationMerge(
  existing: { nodes: unknown[]; pageInfo: unknown } | undefined,
  incoming: { nodes: unknown[]; pageInfo: unknown },
  { args }: { args: Record<string, unknown> | null },
) {
  const offset = (args?.['offset'] as number) ?? 0;

  if (!existing || offset === 0) {
    return incoming;
  }

  const mergedNodes = [...existing.nodes];
  for (let i = 0; i < incoming.nodes.length; i++) {
    mergedNodes[offset + i] = incoming.nodes[i];
  }

  return {
    ...incoming,
    nodes: mergedNodes,
  };
}

/**
 * Create Apollo Client instance for Client Components.
 *
 * Called by ApolloNextAppProvider's makeClient prop.
 * Returns a new instance per browser tab (no singleton needed —
 * the integration package handles SSR deduplication).
 */
export function makeClient() {
  const httpLink = new HttpLink({
    uri: '/api/graphql',
    fetchOptions: { cache: 'no-store' },
  });

  // Auth link: forward session cookie to GraphQL endpoint.
  // Since the GraphQL API is same-origin (/api/graphql), cookies
  // are sent automatically by the browser. This link adds explicit
  // Authorization header when a token is available in localStorage.
  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        'x-apollo-client': '4.2.0-alpha.0',
      },
    };
  });

  // Operations that gracefully fall back to mock data — silence network errors
  const MOCK_FALLBACK_OPS = new Set([
    'ForumPosts',
    'ForumPost',
    'CreateForumPost',
    'ToggleUpvote',
    'CreateComment',
    'DeleteComment',
    'UserProfile',
    'ShareCalculation',
    'SharedCalculation',
  ]);

  // AC4 ErrorLink: uses CombinedGraphQLErrors.is() for type-safe
  // unified error discrimination (replaces AC3's separate graphqlErrors/networkError)
  const errorLink = new ErrorLink(({ error, operation }) => {
    if (CombinedGraphQLErrors.is(error)) {
      for (const gqlError of error.errors) {
        const code = gqlError.extensions?.['code'];
        console.error(`[GraphQL Error] ${operation.operationName}: ${gqlError.message}`, {
          code,
          path: gqlError.path,
        });

        // Handle auth errors: redirect to sign-in
        if (code === 'UNAUTHENTICATED' && typeof window !== 'undefined') {
          // Don't redirect for `me` query — it's expected to return null
          if (operation.operationName !== 'Me') {
            window.location.href = '/auth/signin';
          }
        }
      }
    } else {
      // Network or unknown error — suppress for mock-fallback operations
      if (!MOCK_FALLBACK_OPS.has(operation.operationName ?? '')) {
        console.error(`[Network Error] ${operation.operationName}:`, error.message);
      }
    }
  });

  // SSE link for GraphQL subscriptions (graphql-sse 2.6.0)
  const sseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/graphql/stream`
      : '/api/graphql/stream';

  const sseClient = createClient({
    url: sseUrl,
    singleConnection: true,
  });

  // Wrap graphql-sse client in an Apollo Link.
  // graphql-sse ExecutionResult uses Record<string, unknown> while Apollo's
  // FormattedExecutionResult uses Record<string, any>. Cast through
  // ApolloLink.Result to bridge the two under exactOptionalPropertyTypes.
  const sseLink = new ApolloLink((operation) => {
    return new Observable((observer) => {
      const { query, variables } = operation;
      const dispose = sseClient.subscribe(
        {
          query: print(query),
          ...(variables ? { variables } : {}),
        },
        {
          next: (value) => observer.next(value as unknown as ApolloLink.Result),
          error: (err) => observer.error(err instanceof Error ? err : new Error(String(err))),
          complete: () => observer.complete(),
        },
      );
      return () => dispose();
    });
  });

  // Split: subscriptions -> SSE, everything else -> HTTP
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    sseLink,
    from([errorLink, authLink, httpLink]),
  );

  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            worksheets: {
              keyArgs: ['visibility', 'userId', 'folderId', 'searchQuery'],
              merge: offsetPaginationMerge,
            },
            publicWorksheets: {
              keyArgs: ['searchQuery'],
              merge: offsetPaginationMerge,
            },
            forumPosts: {
              keyArgs: ['tags', 'searchQuery'],
              merge: offsetPaginationMerge,
            },
          },
        },
        User: { keyFields: ['id'] },
        Worksheet: { keyFields: ['id'] },
        Folder: { keyFields: ['id'] },
        ForumPost: { keyFields: ['id'] },
        Comment: { keyFields: ['id'] },
        SharedCalculation: { keyFields: ['id'] },
      },
    }),
    link: splitLink,
    defaultOptions: {
      watchQuery: {
        // AC4: errorPolicy 'all' returns both partial data and errors
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
  });
}
