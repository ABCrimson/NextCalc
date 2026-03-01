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
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const loadMessages = messageImports[locale as keyof typeof messageImports] ?? messageImports.en;
  const messages = (await loadMessages()).default;

  return {
    locale,
    messages,
  };
});
