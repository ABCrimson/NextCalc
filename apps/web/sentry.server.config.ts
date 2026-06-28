/**
 * Sentry Server-Side Configuration
 *
 * Loaded by the Sentry Next.js SDK plugin on the server. @sentry/nextjs is a
 * dependency; it is dynamically imported only when SENTRY_DSN (or
 * NEXT_PUBLIC_SENTRY_DSN) is set, keeping the server bundle lean otherwise.
 *
 * Note: instrumentation.ts also initialises Sentry on the server. This file
 * exists for compatibility with the withSentryConfig() wrapper in
 * next.config.ts, which expects both client and server configs.
 *
 * To activate:
 * 1. Set SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) in your environment
 * 2. Wrap next.config.ts with withSentryConfig()
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

const SENTRY_SERVER_DSN = process.env['SENTRY_DSN'] ?? process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (SENTRY_SERVER_DSN) {
  // Code-split: @sentry/nextjs only loads when a DSN is configured.
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_SERVER_DSN,

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),

        // Environment
        environment: process.env['NODE_ENV'] ?? 'development',

        // Enable profiling for server-side code (optional)
        // profilesSampleRate: 0.1,
      });
    })
    .catch((error) => {
      console.warn('[sentry] server init failed:', error);
    });
}
