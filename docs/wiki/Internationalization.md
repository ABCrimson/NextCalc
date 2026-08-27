# Internationalization (i18n)

NextCalc Pro supports 8 languages via `next-intl` with the Next.js App Router.

## Supported Locales

| Code | Language | Status |
|:-----|:---------|:-------|
| `en` | English | Complete (1,609 keys, source of truth) |
| `ru` | Russian | Mostly complete (1,577 keys) |
| `es` | Spanish | Mostly complete (1,577 keys) |
| `uk` | Ukrainian | Mostly complete (1,577 keys) |
| `de` | German | Mostly complete (1,577 keys) |
| `fr` | French | Mostly complete (1,606 keys) |
| `ja` | Japanese | Mostly complete (1,606 keys) |
| `zh` | Chinese (Simplified) | Mostly complete (1,606 keys) |

> Non-English locales retain some English fallbacks: `fr`/`ja`/`zh` hold 1,606 keys and `de`/`es`/`ru`/`uk` hold 1,577 keys, versus 1,609 in `en`.

## File Structure

```
apps/web/messages/
  en.json    # English (source of truth)
  ru.json
  es.json
  uk.json
  de.json
  fr.json
  ja.json
  zh.json
```

## How It Works

### Routing

All pages are under `app/[locale]/`, so URLs look like:
- `/en/plot` -- English plot page
- `/ru/matrix` -- Russian matrix page
- `/ja/algorithms` -- Japanese algorithms page

### Proxy

`apps/web/proxy.ts` (Next.js 16 renamed `middleware` to `proxy`) detects the user's preferred locale and redirects accordingly.

### Using Translations

```tsx
import { useTranslations } from 'next-intl';

export default function MyPage() {
  const t = useTranslations('myNamespace');
  return <h1>{t('title')}</h1>;
}
```

### Translation Key Structure

Keys are nested by namespace:

```json
{
  "calc": {
    "title": "Scientific Calculator",
    "history": "History",
    "clear": "Clear"
  },
  "plots": {
    "title": "Function Plotter",
    "xAxis": "X Axis",
    "yAxis": "Y Axis"
  }
}
```

## Adding a New Language

1. Create `apps/web/messages/{code}.json` (copy structure from `en.json`)
2. Translate all 1,609 keys
3. Add the locale code to `apps/web/i18n/routing.ts` (locales are defined via `defineRouting`)
4. Register the locale in the `messageImports` map in `apps/web/i18n/request.ts` (e.g. `{code}: () => import('../messages/{code}.json')`) -- otherwise its messages won't load
5. Test: `pnpm dev` and navigate to `/{code}/`

## Key Namespaces

A sample of the 37 namespaces in `en.json`:

| Namespace | Keys | Description |
|:----------|:-----|:------------|
| `common` | 50 | Shared UI labels (Submit, Cancel, etc.) |
| `nav` | 58 | Navigation links |
| `calc` | 56 | Calculator UI |
| `plots` | 120 | Plotting interface (incl. relations, regression, sliders) |
| `algorithms` | 132 | Algorithm pages |
| `settings` | 70 | Settings page |
| `auth` | 30 | Authentication UI |
| `forum` | 63 | Forum interface |
