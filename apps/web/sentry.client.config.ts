/**
 * Sentry Client-Side Configuration
 *
 * Loaded by the Sentry Next.js SDK plugin on the client. @sentry/nextjs is a
 * dependency; it is dynamically imported only when NEXT_PUBLIC_SENTRY_DSN is set,
 * so the SDK is code-split out of DSN-less builds.
 *
 * To activate:
 * 1. Set NEXT_PUBLIC_SENTRY_DSN in your environment
 * 2. Wrap next.config.ts with withSentryConfig()
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

const SENTRY_CLIENT_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (SENTRY_CLIENT_DSN) {
  // Code-split: @sentry/nextjs only loads when a DSN is configured, so it never
  // lands in the client bundle for DSN-less builds.
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_CLIENT_DSN,

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env['NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),

        // Session Replay (optional, increase in production as needed)
        replaysSessionSampleRate: 0.0,
        replaysOnErrorSampleRate: 1.0,

        // Environment
        environment: process.env['NODE_ENV'] ?? 'development',
      });
    })
    .catch((error) => {
      console.warn('[sentry] client init failed:', error);
    });
}
