'use client';

import { m } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from '@/i18n/navigation';
import { captureError } from '@/lib/monitoring/error-tracking';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary caught:', error);
      console.error('Stack trace:', error.stack);
    }

    // Send to error tracking service (works in both dev and production)
    captureError(error, {
      component: 'ErrorBoundary',
      level: 'error',
      ...(error.digest ? { digest: error.digest } : {}),
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-background/95 to-background">
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-md p-8 bg-card/95 border-border shadow-2xl">
          <div className="text-center space-y-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="rounded-full bg-red-500/20 p-4">
                <svg
                  className="w-12 h-12 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Error icon"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('error.title' as Parameters<typeof t>[0])}
              </h2>
              <p className="text-muted-foreground">
                {t('error.description' as Parameters<typeof t>[0])}
              </p>
            </div>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && (
              <Card className="p-4 bg-background/50 border-border text-left">
                <p className="text-sm font-mono text-red-400 break-all mb-2">{error.message}</p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground/80">
                      {t('error.viewStackTrace' as Parameters<typeof t>[0])}
                    </summary>
                    <pre className="text-xs text-muted-foreground/70 mt-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {error.stack}
                    </pre>
                  </details>
                )}
                {error.digest && (
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {t('error.errorId' as Parameters<typeof t>[0], { id: error.digest })}
                  </p>
                )}
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <Button
                onClick={reset}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {t('error.tryAgain' as Parameters<typeof t>[0])}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="border-border text-foreground/80 hover:bg-muted/50"
              >
                {t('error.goHome' as Parameters<typeof t>[0])}
              </Button>
            </div>
          </div>
        </Card>
      </m.div>
    </div>
  );
}
