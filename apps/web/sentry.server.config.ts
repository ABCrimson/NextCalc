/**
 * Sentry Server-Side Configuration Stub
 *
 * This file is loaded by the Sentry Next.js SDK plugin on the server side.
 * It only initialises Sentry when SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is
 * set, keeping the server bundle lean when Sentry is not configured.
 *
 * Note: The instrumentation.ts file also attempts to initialise Sentry on
 * the server. This file exists for compatibility with the withSentryConfig()
 * wrapper in next.config.ts which expects both client and server configs.
 *
 * To activate:
 * 1. Install @sentry/nextjs: pnpm add @sentry/nextjs
 * 2. Set SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) in your environment
 * 3. Wrap next.config.ts with withSentryConfig()
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

const SENTRY_SERVER_DSN = process.env['SENTRY_DSN'] ?? process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (SENTRY_SERVER_DSN) {
  // Dynamic import via Function() to avoid TypeScript module resolution errors
  // when @sentry/nextjs is not installed.
  (Function('return import("@sentry/nextjs")')() as Promise<Record<string, unknown>>)
    .then((Sentry: Record<string, unknown>) => {
      const init = Sentry['init'] as (config: Record<string, unknown>) => void;
      init({
        dsn: SENTRY_SERVER_DSN,

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),

        // Environment
        environment: process.env['NODE_ENV'] ?? 'development',

        // Enable profiling for server-side code (optional)
        // profilesSampleRate: 0.1,
      });
    })
    .catch(() => {
      // @sentry/nextjs not installed - this stub is a no-op
    });
}
