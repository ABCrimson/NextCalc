'use client';

/**
 * Next.js 16 App Router Not Found Page
 *
 * Custom 404 page shown when a route doesn't exist.
 * Features beautiful dark theme consistent with NextCalc Pro design.
 *
 * Features:
 * - Animated 404 text
 * - Helpful navigation links
 * - Gradient accents
 * - Full accessibility support
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/not-found
 */

import { Calculator, Home, TrendingUp, Variable } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Localized labels for the 404 page. `t` is `null` until the content renders
 * on the client, in which case every label falls back to an empty string so
 * the prerendered shell is structurally identical to the hydrated UI.
 */
function getLabels(t: ReturnType<typeof useTranslations> | null) {
  const tr = (key: string) => (t ? t(key as Parameters<NonNullable<typeof t>>[0]) : '');
  return {
    code: tr('error.notFound.code'),
    title: tr('error.notFound.title'),
    description: tr('error.notFound.description'),
    helpfulLinks: tr('error.notFound.helpfulLinks'),
    home: tr('error.notFound.home'),
    plotFunctions: tr('error.notFound.plotFunctions'),
    symbolicMath: tr('error.notFound.symbolicMath'),
    calculator: tr('error.notFound.calculator'),
    goBack: tr('error.notFound.goBack'),
  };
}

/**
 * Visual layout for the 404 page. Receives already-resolved `labels` so it can
 * render both the server prerender (empty labels) and the hydrated client
 * (translated labels) without ever calling a next-intl API itself.
 */
function NotFoundLayout({
  labels,
  onGoBack,
}: {
  labels: ReturnType<typeof getLabels>;
  onGoBack: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-linear-to-br/oklab from-background via-background/95 to-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 size-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-20 size-96 bg-calculator-operator/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <Card className="max-w-2xl w-full p-8 md:p-12 bg-card/95 backdrop-blur-md border-border shadow-2xl">
        <div className="text-center space-y-8">
          {/* Large 404 */}
          <div className="space-y-4">
            <h1 className="text-9xl font-bold bg-linear-to-r/oklab from-primary via-calculator-operator to-calculator-equals bg-clip-text text-transparent">
              {labels.code}
            </h1>
            <div className="h-1 w-32 mx-auto bg-linear-to-r/oklab from-primary via-calculator-operator to-calculator-equals rounded-full" />
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">{labels.title}</h2>
            <p className="text-muted-foreground text-lg">{labels.description}</p>
          </div>

          {/* Suggested Actions */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground/70 font-medium">{labels.helpfulLinks}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-linear-to-br/oklab from-blue-900/30 to-blue-800/30 border-blue-500/40 hover:border-blue-400/70 hover:bg-blue-900/50 transition-all"
                  size="lg"
                >
                  <Home className="size-5 mr-2" />
                  <span>{labels.home}</span>
                </Button>
              </Link>

              <Link href="/plot" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-linear-to-br/oklab from-purple-900/30 to-purple-800/30 border-purple-500/40 hover:border-purple-400/70 hover:bg-purple-900/50 transition-all"
                  size="lg"
                >
                  <TrendingUp className="size-5 mr-2" />
                  <span>{labels.plotFunctions}</span>
                </Button>
              </Link>

              <Link href="/symbolic" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-linear-to-br/oklab from-emerald-900/30 to-emerald-800/30 border-emerald-500/40 hover:border-emerald-400/70 hover:bg-emerald-900/50 transition-all"
                  size="lg"
                >
                  <Variable className="size-5 mr-2" />
                  <span>{labels.symbolicMath}</span>
                </Button>
              </Link>

              <Link href="/" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-linear-to-br/oklab from-rose-900/30 to-rose-800/30 border-rose-500/40 hover:border-rose-400/70 hover:bg-rose-900/50 transition-all"
                  size="lg"
                >
                  <Calculator className="size-5 mr-2" />
                  <span>{labels.calculator}</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Back Button */}
          <div className="pt-4">
            <Button
              onClick={onGoBack}
              className="bg-linear-to-r/oklab from-primary via-calculator-operator to-calculator-equals hover:opacity-90 transition-opacity"
              size="lg"
            >
              {labels.goBack}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Client-only content: calls `useTranslations()` and renders the fully
 * localized layout. Mounted only after hydration (see `NotFound`), so this
 * next-intl API never runs during the prerender pass.
 */
function NotFoundContent() {
  const t = useTranslations();
  const router = useRouter();
  return <NotFoundLayout labels={getLabels(t)} onGoBack={() => router.back()} />;
}

/**
 * Not Found page.
 *
 * The global `/_not-found` route is prerendered by Next.js for unmatched paths
 * *without* a resolved `[locale]` segment, so the locale layout's
 * `setRequestLocale` never pins a static locale for it and no
 * `NextIntlClientProvider` wraps it. Invoking `useTranslations()` during that
 * render makes next-intl resolve the locale from the incoming request —
 * request-time data that, under `cacheComponents`, taints the prerender with
 * "uncached or runtime data during prerendering".
 *
 * To keep the page prerenderable as a static shell, the next-intl-dependent
 * `NotFoundContent` is only mounted on the client (after the first effect
 * runs). The server prerender emits a deterministic, locale-neutral shell —
 * identical layout, icons, links, and the same gradient/animation styling, just
 * with empty text — and the real, correctly-localized text streams in on
 * hydration. The interactive behavior (all links, the back button) is
 * unchanged; only the initial prerendered text differs and it is replaced on
 * mount.
 */
export default function NotFound() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Static shell rendered during prerender / before hydration: identical
    // structure with empty labels and no next-intl/router access.
    return <NotFoundLayout labels={getLabels(null)} onGoBack={() => {}} />;
  }

  return <NotFoundContent />;
}
