import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ru', 'es', 'uk', 'de', 'fr', 'ja', 'zh'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];
