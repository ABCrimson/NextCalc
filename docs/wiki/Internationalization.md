# Internationalization (i18n)

NextCalc Pro supports 8 languages via `next-intl` with the Next.js App Router.

## Supported Locales

| Code | Language | Status |
|:-----|:---------|:-------|
| `en` | English | Complete (1200+ keys) |
| `ru` | Russian | Complete |
| `es` | Spanish | Complete |
| `uk` | Ukrainian | Complete |
| `de` | German | Complete |
| `fr` | French | Complete |
| `ja` | Japanese | Complete |
| `zh` | Chinese (Simplified) | Complete |

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

### Middleware

`apps/web/middleware.ts` detects the user's preferred locale and redirects accordingly.

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
  "calculator": {
    "title": "Scientific Calculator",
    "history": "History",
    "clear": "Clear"
  },
  "plot": {
    "title": "Function Plotter",
    "xAxis": "X Axis",
    "yAxis": "Y Axis"
  }
}
```

## Adding a New Language

1. Create `apps/web/messages/{code}.json` (copy structure from `en.json`)
2. Translate all 1200+ keys
3. Add the locale code to `apps/web/i18n/config.ts`
4. Test: `pnpm dev` and navigate to `/{code}/`

## Key Namespaces

| Namespace | Keys | Description |
|:----------|:-----|:------------|
| `common` | ~50 | Shared UI labels (Submit, Cancel, etc.) |
| `nav` | ~20 | Navigation links |
| `calculator` | ~30 | Calculator UI |
| `plot` | ~40 | Plotting interface |
| `algorithms` | ~100 | Algorithm pages |
| `settings` | ~30 | Settings page |
| `auth` | ~10 | Authentication UI |
| `forum` | ~40 | Forum interface |
