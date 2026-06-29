/**
 * Client-Side Instrumentation (Next.js 15.3+/16 file convention)
 *
 * Replaces the deprecated `sentry.client.config.ts`, which emits a deprecation
 * warning and — critically — no longer runs under Turbopack (our `dev` script
 * uses `next dev --turbopack`). Next.js loads this module once on the client
 * before the app boots.
 *
 * @sentry/nextjs stays code-split out of DSN-less builds: it is dynamically
 * imported only when NEXT_PUBLIC_SENTRY_DSN is set.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import { configureErrorTracking, createSentryErrorTracking } from '@/lib/monitoring/error-tracking';

const SENTRY_CLIENT_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'];

// Resolves to the loaded Sentry module when a DSN is configured; null otherwise.
// onRouterTransitionStart forwards through this once it settles.
let sentryReady: Promise<typeof import('@sentry/nextjs')> | null = null;

if (SENTRY_CLIENT_DSN) {
  sentryReady = import('@sentry/nextjs');
  sentryReady
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_CLIENT_DSN,

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env['NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),

        // Session Replay (increase session sampling in production as needed)
        replaysSessionSampleRate: 0.0,
        replaysOnErrorSampleRate: 1.0,

        // Environment
        environment: process.env['NODE_ENV'] ?? 'development',
      });

      // Route manual captureError/captureMessage/setUser/addBreadcrumb calls to
      // Sentry instead of only the console.
      configureErrorTracking(createSentryErrorTracking(Sentry));
    })
    .catch((error) => {
      console.warn('[sentry] client init failed:', error);
    });
}

/**
 * Next.js calls this at the start of every client-side route transition. We
 * forward it to Sentry so navigations join the active trace (pageload →
 * navigation continuity). It is a no-op when Sentry is disabled. The forward is
 * a microtask late only on the very first navigation before the DSN-gated SDK
 * has loaded — negligible, and the trade keeps Sentry code-split.
 */
export function onRouterTransitionStart(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>
): void {
  void sentryReady?.then((Sentry) => Sentry.captureRouterTransitionStart(...args));
}
