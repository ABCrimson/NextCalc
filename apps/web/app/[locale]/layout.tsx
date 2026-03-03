import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Navigation } from '@/components/layout/navigation';
import { ApolloWrapper } from '@/components/providers/apollo-provider';
import { MotionProvider } from '@/components/providers/motion-provider';
import { routing } from '@/i18n/routing';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nextcalc.dev';

/**
 * Locale → og:locale mapping for Open Graph metadata.
 */
const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  es: 'es_ES',
  uk: 'uk_UA',
  de: 'de_DE',
  fr: 'fr_FR',
  ja: 'ja_JP',
  zh: 'zh_CN',
};

/**
 * Generate locale-specific metadata including og:locale.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ogLocale = OG_LOCALE_MAP[locale] ?? 'en_US';
  const alternateLocales = Object.entries(OG_LOCALE_MAP)
    .filter(([k]) => k !== locale)
    .map(([, v]) => v);

  return {
    openGraph: {
      locale: ogLocale,
      alternateLocale: alternateLocales,
      siteName: 'NextCalc Pro',
      url: `${APP_URL}/${locale}`,
    },
  };
}

/**
 * JSON-LD structured data for SEO.
 * Combines Organization, WebApplication, and SoftwareApplication schemas
 * to provide rich search engine understanding of NextCalc Pro.
 */
function getJsonLd(locale: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'NextCalc',
      url: APP_URL,
      logo: `${APP_URL}/icon.svg`,
      description:
        'NextCalc Pro is an advanced scientific calculator platform featuring symbolic math, GPU-accelerated plotting, and WASM-powered precision.',
      sameAs: ['https://github.com/nextcalc'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'NextCalc Pro',
      url: `${APP_URL}/${locale}`,
      applicationCategory: 'EducationalApplication',
      applicationSubCategory: 'Calculator',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern browser with JavaScript and WebGL support',
      inLanguage: locale,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Symbolic math computation',
        'GPU-accelerated 2D/3D plotting',
        'WASM-powered arbitrary precision',
        'Matrix operations and linear algebra',
        'Statistical analysis',
        'Unit conversions',
        'Differential equation solvers',
        'Fourier analysis',
        'Chaos theory simulations',
        'Game theory calculators',
        'LaTeX rendering',
        'Offline-capable PWA',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'NextCalc Pro',
      url: `${APP_URL}/${locale}`,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '150',
        bestRating: '5',
        worstRating: '1',
      },
      author: {
        '@type': 'Organization',
        name: 'NextCalc',
        url: APP_URL,
      },
    },
  ];
}

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
 * - Injects JSON-LD structured data for SEO
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
  const t = await getTranslations('accessibility');
  const jsonLd = getJsonLd(locale);

  return (
    <NextIntlClientProvider messages={messages}>
      {/* JSON-LD structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-foreground focus-visible:shadow-lg"
      >
        {t('skipToContent')}
      </a>
      <MotionProvider>
        <ApolloWrapper>
          <Navigation />
          <main id="main-content" className="vt-main-content">
            {children}
          </main>
        </ApolloWrapper>
      </MotionProvider>
    </NextIntlClientProvider>
  );
}
