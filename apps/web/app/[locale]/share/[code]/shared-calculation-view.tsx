'use client';

/**
 * SharedCalculationView — Client component for rendering a shared calculation
 *
 * Displays the LaTeX expression via KaTeX, shows the result, and provides
 * an "Open in Calculator" button that loads the expression into the calculator.
 */

import { m } from 'framer-motion';
import { Calculator, Check, Copy, Share2, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LaTeXRenderer } from '@/components/math/latex-renderer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { createPermalinkUrl } from '@/lib/share';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SharedCalculationData {
  id: string;
  shortCode: string;
  latex: string;
  expression: string;
  title: string | null;
  description: string | null;
  result: string | null;
  createdAt: string;
  expiresAt: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface SharedCalculationViewProps {
  readonly shared: SharedCalculationData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SharedCalculationView({ shared }: SharedCalculationViewProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the reset timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      const url = createPermalinkUrl(shared.shortCode);
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');

      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setCopyStatus('idle');
        resetTimerRef.current = null;
      }, 2500);
    } catch {
      // Clipboard access denied — silently ignore
    }
  }, [shared.shortCode]);

  const formattedDate = new Date(shared.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build the calculator URL with the expression pre-loaded
  const calculatorParams = new URLSearchParams();
  calculatorParams.set('expr', shared.expression);
  if (shared.result) {
    calculatorParams.set('result', shared.result);
  }
  const calculatorUrl = `/?${calculatorParams.toString()}`;

  return (
    <main className="min-h-screen py-12 px-4 relative overflow-hidden">
      {/* Mesh gradient background */}
      <div
        className="fixed inset-0 -z-10 animate-mesh"
        style={{
          background: `
            radial-gradient(at 30% 20%, oklch(0.55 0.27 264 / 0.08) 0%, transparent 50%),
            radial-gradient(at 70% 80%, oklch(0.58 0.22 300 / 0.06) 0%, transparent 50%)
          `,
        }}
      />
      <div className="fixed inset-0 -z-10 noise pointer-events-none" />

      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <m.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Share2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-primary">Shared Calculation</span>
          </div>
          {shared.title && <h1 className="text-3xl font-bold text-foreground">{shared.title}</h1>}
          {shared.description && (
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto">{shared.description}</p>
          )}
        </m.div>

        {/* Main calculation card */}
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card className="p-8 glass-heavy noise rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-white/5">
            {/* LaTeX display */}
            <div className="mb-6">
              <div
                className="overflow-x-auto py-4 flex justify-center"
                role="math"
                aria-label={`Math expression: ${shared.expression}`}
              >
                <LaTeXRenderer expression={shared.latex} displayMode={true} className="text-2xl" />
              </div>
            </div>

            {/* Result */}
            {shared.result && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-3">
                  <span className="text-2xl text-muted-foreground">=</span>
                  <span className="text-4xl font-bold font-mono bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                    {shared.result}
                  </span>
                </div>
              </div>
            )}

            {/* Plain expression */}
            <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 mb-6">
              <p className="text-xs text-muted-foreground/70 mb-1 font-medium">Expression</p>
              <p className="text-sm font-mono text-foreground select-all break-all">
                {shared.expression}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={calculatorUrl} className="flex-1">
                <Button
                  className={cn(
                    'w-full bg-gradient-to-r from-primary via-calculator-operator to-calculator-equals',
                    'hover:opacity-90 transition-opacity shadow-lg shadow-primary/25',
                  )}
                  size="lg"
                >
                  <Calculator className="h-5 w-5 mr-2" aria-hidden="true" />
                  Open in Calculator
                </Button>
              </Link>

              <Button
                variant="outline"
                size="lg"
                onClick={handleCopyLink}
                className="flex-shrink-0"
              >
                {copyStatus === 'copied' ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-calculator-equals" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </Card>
        </m.div>

        {/* Meta info */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6 flex items-center justify-between text-xs text-muted-foreground px-1"
        >
          <div className="flex items-center gap-2">
            {shared.user && (
              <>
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Shared by {shared.user.name || 'Anonymous'}</span>
              </>
            )}
          </div>
          <span>{formattedDate}</span>
        </m.div>

        {/* Back to calculator link */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 text-center"
        >
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-border hover:decoration-foreground"
          >
            Back to NextCalc Pro
          </Link>
        </m.div>
      </div>
    </main>
  );
}
