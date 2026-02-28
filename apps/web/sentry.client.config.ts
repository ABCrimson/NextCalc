/**
 * Sentry Client-Side Configuration Stub
 *
 * This file is loaded by the Sentry Next.js SDK plugin on the client side.
 * It only initialises Sentry when NEXT_PUBLIC_SENTRY_DSN is set, so the
 * SDK is never bundled into the client when no DSN is configured.
 *
 * To activate:
 * 1. Install @sentry/nextjs: pnpm add @sentry/nextjs
 * 2. Set NEXT_PUBLIC_SENTRY_DSN in your environment
 * 3. Wrap next.config.ts with withSentryConfig()
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

const SENTRY_CLIENT_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (SENTRY_CLIENT_DSN) {
	// Dynamic import via Function() to avoid TypeScript module resolution errors
	// when @sentry/nextjs is not installed.
	(Function('return import("@sentry/nextjs")')() as Promise<Record<string, unknown>>)
		.then((Sentry: Record<string, unknown>) => {
			const init = Sentry['init'] as (config: Record<string, unknown>) => void;
			init({
				dsn: SENTRY_CLIENT_DSN,

				// Performance Monitoring
				tracesSampleRate: parseFloat(
					process.env['NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1',
				),

				// Session Replay (optional, increase in production as needed)
				replaysSessionSampleRate: 0.0,
				replaysOnErrorSampleRate: 1.0,

				// Environment
				environment: process.env['NODE_ENV'] ?? 'development',
			});
		})
		.catch(() => {
			// @sentry/nextjs not installed - this stub is a no-op
		});
}
