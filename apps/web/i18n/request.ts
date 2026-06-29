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

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // hasLocale() narrows to the Locale union without a cast (v4 type guard).
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const loadMessages = messageImports[locale] ?? messageImports.en;
  const messages = (await loadMessages()).default;

  return {
    locale,
    messages,
  };
});
