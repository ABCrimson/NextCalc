/**
 * Apollo Client 4.2.0-alpha.0 — React Server Component Client
 *
 * Registered client for use in Server Components and Server Actions.
 * Uses registerApolloClient from @apollo/client-integration-nextjs
 * to provide getClient(), query(), and PreloadQuery for RSC usage.
 *
 * Important: RSC queries are NOT updated in the browser when cache changes.
 * Use Client Component hooks (useQuery/useSuspenseQuery) for dynamic data.
 * Reserve RSC queries for static or initial page data.
 */

import { HttpLink } from '@apollo/client';
import {
	registerApolloClient,
	ApolloClient,
	InMemoryCache,
} from '@apollo/client-integration-nextjs';
import { headers } from 'next/headers';

function getAbsoluteUrl() {
	// In server context, we need an absolute URL
	const baseUrl =
		process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
	return `${baseUrl}/api/graphql`;
}

export const { getClient, query, PreloadQuery } = registerApolloClient(
	async () => {
		// Forward cookies from the incoming request to the GraphQL endpoint
		// so that NextAuth session cookies are available for authentication
		const requestHeaders = await headers();
		const cookie = requestHeaders.get('cookie') || '';

		const httpLink = new HttpLink({
			uri: getAbsoluteUrl(),
			headers: {
				cookie,
				'x-apollo-client': 'rsc',
			},
			fetchOptions: { cache: 'no-store' },
		});

		return new ApolloClient({
			cache: new InMemoryCache(),
			link: httpLink,
		});
	},
);
