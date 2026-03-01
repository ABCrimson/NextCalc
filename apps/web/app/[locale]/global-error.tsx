'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring/error-tracking';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary Component
 *
 * This is the root error boundary that catches errors in the root layout.
 * Must be a Client Component and must include <html> and <body> tags.
 *
 * Use cases:
 * - Catastrophic errors in root layout
 * - Critical application failures
 * - Layout-level exceptions
 *
 * Features:
 * - Minimal UI (no external dependencies)
 * - Self-contained styling
 * - Error tracking in production
 * - Always displays, even if CSS fails to load
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Global error boundary caught:', error);
    }

    // Send to error tracking service (fatal level for global errors)
    captureError(error, {
      component: 'GlobalErrorBoundary',
      level: 'fatal',
      ...(error.digest ? { digest: error.digest } : {}),
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
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
                }}
              >
                {process.env.NODE_ENV === 'development'
                  ? error.message || 'A critical error occurred in the root layout'
                  : 'A critical error has occurred. Please refresh the page or contact support if the problem persists.'}
              </p>

              {/* Development Stack Trace */}
              {process.env.NODE_ENV === 'development' && error.stack && (
                <details style={{ marginBottom: '1.5rem' }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#a1a1aa',
                      marginBottom: '0.5rem',
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
                  }}
                >
                  Error ID: {error.digest}
                </p>
              )}

              {/* Retry Button */}
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
                <p style={{ fontSize: '0.875rem', color: '#93c5fd' }}>
                  <strong>Development Mode:</strong> This global error boundary caught an error in
                  the root layout. Check the browser console and stack trace above for details.
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
