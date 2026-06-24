/**
 * Apollo Client global default-options type registration.
 *
 * Apollo Client 4.2+ synchronizes hook/method return types with the
 * `defaultOptions` you pass to `new ApolloClient(...)`. To use a default
 * `errorPolicy` (or `returnPartialData`) you must register it globally via
 * the `ApolloClient.DeclareDefaultOptions` namespace, otherwise TypeScript
 * errors with the branded "must be declared in
 * ApolloClient.DeclareDefaultOptions before usage" message.
 *
 * Our browser client (lib/graphql/client.ts) sets `errorPolicy: 'all'` on
 * watchQuery / query / mutate so that partial data is returned alongside
 * errors. Declaring it here makes `result.data` correctly typed as
 * `TData | undefined` across all hooks (useQuery, useSuspenseQuery,
 * useMutation, PreloadQuery), matching runtime behavior.
 *
 * See: https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety
 */
import '@apollo/client';

declare module '@apollo/client' {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: 'all';
      }
      interface Query {
        errorPolicy?: 'all';
      }
      interface Mutate {
        errorPolicy?: 'all';
      }
    }
  }
}
