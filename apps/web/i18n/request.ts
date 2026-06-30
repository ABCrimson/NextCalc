import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const messageImports = {
  en: () => import('../messages/en.json'),
  ru: () => import('../messages/ru.json'),
  es: () => import('../messages/es.json'),
  uk: () => import('../messages/uk.json'),
  de: () => import('../messages/de.json'),
  fr: () => import('../messages/fr.json'),
  ja: () => import('../messages/ja.json'),
  zh: () => import('../messages/zh.json'),
} as const;

// Messages are static per-build data, so load them through a `use cache`
// boundary. Under `cacheComponents` an uncached async import during render
// counts as runtime data and taints every page's prerender; caching it lets
// the locale layout prerender its static shell.
async function loadLocaleMessages(locale: keyof typeof messageImports) {
  'use cache';
  return (await messageImports[locale]()).default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // hasLocale() narrows to the Locale union without a cast (v4 type guard).
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = await loadLocaleMessages(locale in messageImports ? locale : 'en');

  return {
    locale,
    messages,
    // NOTE: we deliberately do NOT set a global `now`. A per-request
    // `new Date()` here is an unstable value that taints every page's
    // prerender under `cacheComponents`, forcing the whole app dynamic. The
    // only relative times we render live in the forum's *client* components,
    // which mount after a client-side Apollo fetch (never during prerender),
    // so `useFormatter().relativeTime(...)` computes `now` on the client where
    // it is correct and hydration-safe.
  };
});
