'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring/error-tracking';

interface RootGlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root Global Error Boundary Component
 *
 * This is the outermost error boundary that catches errors in the root layout
 * and any errors not caught by lower-level error boundaries.
 *
 * Key differences from [locale]/global-error.tsx:
 * - Operates at the root level (app/global-error.tsx)
 * - Catches errors in root layout.tsx (metadata, RootLayout component)
 * - Catches errors that bubble up from [locale] segment
 * - Must include <html> and <body> tags (wraps everything)
 *
 * Sentry Integration:
 * - Automatically captures errors when Sentry SDK is initialized
 * - Works alongside sentry.client.config.ts and instrumentation.ts
 * - Reports to Sentry with 'fatal' severity level
 *
 * Error Flow:
 * 1. Error in root layout → caught here (root global-error.tsx)
 * 2. Error in [locale] segment → caught by [locale]/global-error.tsx
 * 3. Error in nested routes → caught by route-level error.tsx
 *
 * Features:
 * - Minimal inline styles (no external CSS to fail)
 * - Self-contained, no dependencies on layout or theme
 * - Semantic color tokens applied where possible
 * - Error digest and stack trace for debugging
 * - Reload button with user-friendly messaging
 */
export default function RootGlobalError({ error, reset }: RootGlobalErrorProps) {
  useEffect(() => {
    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Root global error boundary caught:', error);
    }

    // Capture error with Sentry and error tracking service
    // 'fatal' severity indicates this is a critical, unrecoverable error
    captureError(error, {
      component: 'RootGlobalErrorBoundary',
      level: 'fatal',
      ...(error.digest ? { digest: error.digest } : {}),
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    });
  }, [error]);

  // Determine display message based on environment
  const displayMessage =
    process.env.NODE_ENV === 'development'
      ? error.message || 'A critical error occurred'
      : 'A critical error has occurred. Please refresh the page or contact support if the problem persists.';

  return (
    <html lang="en">
      <head>
        <title>Critical Error - NextCalc</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#09090b',
            color: '#fafafa',
          }}
        >
          <div
            style={{
              maxWidth: '32rem',
              width: '100%',
            }}
          >
            {/* Error Card */}
            <div
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '0.5rem',
                padding: '2rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Error Icon */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    borderRadius: '9999px',
                  }}
                >
                  <AlertTriangle
                    style={{
                      height: '3rem',
                      width: '3rem',
                      color: '#dc2626',
                    }}
                  />
                </div>
              </div>

              {/* Error Title */}
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  margin: '0 0 1rem 0',
                }}
              >
                Critical Application Error
              </h1>

              {/* Error Description */}
              <p
                style={{
                  color: '#a1a1aa',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  margin: '0 0 1.5rem 0',
                  lineHeight: '1.5',
                }}
              >
                {displayMessage}
              </p>

              {/* Development Stack Trace */}
              {process.env.NODE_ENV === 'development' && error.stack && (
                <details
                  style={{
                    marginBottom: '1.5rem',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#a1a1aa',
                      marginBottom: '0.5rem',
                      padding: '0.5rem 0',
                      userSelect: 'none',
                    }}
                  >
                    View stack trace
                  </summary>
                  <pre
                    style={{
                      fontSize: '0.75rem',
                      backgroundColor: '#18181b',
                      padding: '1rem',
                      borderRadius: '0.375rem',
                      overflowX: 'auto',
                      maxHeight: '12rem',
                      overflowY: 'auto',
                      border: '1px solid #27272a',
                      margin: '0.5rem 0 0 0',
                      color: '#93c5fd',
                      lineHeight: '1.4',
                    }}
                  >
                    <code>{error.stack}</code>
                  </pre>
                </details>
              )}

              {/* Error Digest */}
              {error.digest && (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: '#71717a',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                    margin: '0 0 1.5rem 0',
                  }}
                >
                  Error ID: {error.digest}
                </p>
              )}

              {/* Reload Button */}
              <button
                onClick={reset}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                <RefreshCw style={{ height: '1rem', width: '1rem' }} />
                Reload Application
              </button>
            </div>

            {/* Development Help */}
            {process.env.NODE_ENV === 'development' && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '0.5rem',
                }}
              >
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#93c5fd',
                    margin: '0',
                    lineHeight: '1.5',
                  }}
                >
                  <strong>Development Mode:</strong> This root error boundary caught a critical
                  error in the application. Check the browser console and stack trace above for
                  details.
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
