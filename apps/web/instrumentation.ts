/**
 * Next.js Instrumentation Hook
 *
 * This file is loaded once when the Next.js server starts up. It runs
 * before any route handler or middleware and is the recommended place
 * to initialise observability tooling (OpenTelemetry, Sentry, etc.).
 *
 * The `register()` export is called exactly once per `next start` or
 * `next dev` invocation. It runs in the Node.js runtime only (not in
 * the Edge runtime).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    // ---------------------------------------------------------------
    // Server-side instrumentation (Node.js runtime only)
    // ---------------------------------------------------------------

    const startTime = Date.now();

    // Structured log entry so it is parseable by log aggregation
    const entry = {
      level: 'info',
      message: 'NextCalc server instrumentation registered',
      timestamp: new Date().toISOString(),
      service: 'nextcalc-web',
      runtime: 'nodejs',
      nodeVersion: process.version,
      env: process.env['NODE_ENV'] ?? 'development',
    };
    console.log(JSON.stringify(entry));

    // ---------------------------------------------------------------
    // Sentry SDK — initialise if DSN is configured
    // ---------------------------------------------------------------
    const sentryDsn = process.env['SENTRY_DSN'] ?? process.env['NEXT_PUBLIC_SENTRY_DSN'];
    if (sentryDsn) {
      try {
        // Dynamic import — @sentry/nextjs is not a required dependency.
        // If installed, Sentry will initialise. Otherwise the catch block
        // handles the missing module gracefully.
        const Sentry = await import('@sentry/nextjs');
        Sentry.init({
          dsn: sentryDsn,
          tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
          environment: process.env['NODE_ENV'] ?? 'development',
        });
        console.log(
          JSON.stringify({
            level: 'info',
            message: 'Sentry server SDK initialised',
            timestamp: new Date().toISOString(),
            service: 'nextcalc-web',
          }),
        );
      } catch {
        // @sentry/nextjs not installed — skip silently
        console.log(
          JSON.stringify({
            level: 'debug',
            message: 'Sentry SDK not available, skipping server init',
            timestamp: new Date().toISOString(),
            service: 'nextcalc-web',
          }),
        );
      }
    }

    // ---------------------------------------------------------------
    // OpenTelemetry — placeholder for future integration
    // ---------------------------------------------------------------
    // When ready, add @opentelemetry/sdk-node + auto-instrumentations here.
    // Next.js 16 has built-in OTel support via `experimental.instrumentationHook`.
    // Example:
    //   const { NodeSDK } = await import('@opentelemetry/sdk-node');
    //   const sdk = new NodeSDK({ ... });
    //   sdk.start();

    const bootMs = Date.now() - startTime;
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Server instrumentation complete',
        timestamp: new Date().toISOString(),
        service: 'nextcalc-web',
        bootMs,
      }),
    );
  }

  if (process.env['NEXT_RUNTIME'] === 'edge') {
    // ---------------------------------------------------------------
    // Edge runtime instrumentation (Middleware, Edge API Routes)
    // ---------------------------------------------------------------
    // Edge has limited APIs — keep this lightweight.
    // Sentry's Edge SDK or lightweight custom tracing can go here.
  }
}

/**
 * Called when an error is caught by the Next.js error handling.
 * This runs in both Node.js and Edge runtimes.
 */
export function onRequestError(
  error: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering';
    revalidateReason: 'on-demand' | 'stale' | undefined;
    renderType: 'dynamic' | 'dynamic-resume';
  },
) {
  // Structured error log for server-side request errors
  const logEntry = {
    level: 'error',
    message: 'Next.js request error',
    timestamp: new Date().toISOString(),
    service: 'nextcalc-web',
    error: {
      name: error.name,
      message: error.message,
      digest: error.digest,
      ...(process.env['NODE_ENV'] === 'development' ? { stack: error.stack } : {}),
    },
    request: {
      path: request.path,
      method: request.method,
    },
    context: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  };

  console.error(JSON.stringify(logEntry));
}
