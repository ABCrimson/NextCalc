/**
 * Apollo Client Provider for Next.js App Router
 *
 * Wraps the application with ApolloNextAppProvider from
 * @apollo/client-integration-nextjs (v0.14.4).
 *
 * This provider:
 * - Creates a new ApolloClient per browser tab via makeClient factory
 * - Handles SSR hydration automatically
 * - Makes useQuery/useMutation/useSuspenseQuery available in Client Components
 */

'use client';

import { ApolloNextAppProvider } from '@apollo/client-integration-nextjs';
import { makeClient } from '@/lib/graphql/client';

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
	return (
		<ApolloNextAppProvider makeClient={makeClient}>
			{children}
		</ApolloNextAppProvider>
	);
}
