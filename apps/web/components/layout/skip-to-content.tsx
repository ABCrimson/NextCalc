'use client';

import { useTranslations } from 'next-intl';

/**
 * Accessibility "skip to main content" link.
 *
 * Rendered as a Client Component on purpose: it reads its label via the client
 * `useTranslations` (served from NextIntlClientProvider's already-loaded
 * messages, so it is still present in the SSR/prerendered HTML for keyboard
 * users). Keeping it OFF the server side lets the locale layout avoid a
 * server-side `getTranslations()` call, whose request-locale read would
 * otherwise be uncached runtime data that taints prerendering under
 * `cacheComponents` for routes without a statically-pinned locale (e.g. the
 * locale-less `/_not-found`).
 */
export function SkipToContent() {
  const t = useTranslations('accessibility');
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-foreground focus-visible:shadow-lg"
    >
      {t('skipToContent')}
    </a>
  );
}
