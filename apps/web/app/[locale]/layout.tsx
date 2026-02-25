import { type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Navigation } from '@/components/layout/navigation';
import { ApolloWrapper } from '@/components/providers/apollo-provider';

/**
 * Generate static params for all supported locales.
 * This enables static rendering for each locale at build time.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Locale-aware layout that wraps all pages under /[locale]/...
 *
 * Responsibilities:
 * - Resolves the locale from the URL segment
 * - Loads translated messages for the current locale
 * - Provides NextIntlClientProvider so useTranslations() works in client components
 * - Wraps children with ApolloWrapper for GraphQL support
 * - Renders the shared Navigation component
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ApolloWrapper>
        <Navigation />
        {children}
      </ApolloWrapper>
    </NextIntlClientProvider>
  );
}
