/**
 * i18n coverage for the StepTrace-driven solver panel.
 *
 * Guards against future drift between the math-engine's trace rule ids and
 * the web layer's translations: every displayable ruleId, every limitTab
 * key, and every stepCategories key must exist with a non-empty value in
 * ALL 8 locale files. A missing key renders literally as
 * `solver.stepRules.<ruleId>.title` in the UI, or (for stepRules) silently
 * falls back to the engine's English text — either way, catch it here
 * instead of in production.
 */
import { DISPLAY_RULES } from '@nextcalc/math-engine';
import { describe, expect, it } from 'vitest';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import ja from '@/messages/ja.json';
import ru from '@/messages/ru.json';
import uk from '@/messages/uk.json';
import zh from '@/messages/zh.json';

const LOCALES = { en, de, es, fr, ja, ru, uk, zh } as const;
type LocaleCode = keyof typeof LOCALES;
const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

/**
 * Snapshot of `solver.stepCategories.*` keys, camelCased per
 * `CategoryBadge`'s `labelKey` construction in
 * apps/web/components/calculator/solver-panel.tsx (source of truth:
 * the `CATEGORY_STYLES` map in that file).
 */
const STEP_CATEGORY_KEYS = [
  'identification',
  'simplification',
  'differentiation',
  'integration',
  'rearrangement',
  'isolation',
  'factorization',
  'formula',
  'substitution',
  'expansion',
  'identity',
  'finalAnswer',
  'evaluation',
  'limit',
] as const;

/** `solver.limitTab.*` keys referenced by t() calls in solver-panel.tsx. */
const LIMIT_TAB_KEYS = [
  'label',
  'shortLabel',
  'approach',
  'pointPlaceholder',
  'direction',
  'directionBoth',
  'directionLeft',
  'directionRight',
  'invalidPoint',
] as const;

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Walk a dot-separated path through a nested object, mirroring next-intl's
 * own `resolvePath` (use-intl splits every translation key on "." and
 * descends one nested object per segment — see
 * `useTranslations('solver')(\`stepRules.${ruleId}.title\`)` in
 * solver-panel.tsx). A ruleId like "equation.classify.linear" therefore
 * requires `stepRules.equation.classify.linear`, NOT a flat key containing
 * literal dots.
 */
function resolveDotPath(root: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, root);
}

describe('solver i18n coverage — stepRules', () => {
  // DISPLAY_RULES is the exact whitelist curateTrace() keeps (RULE_IDS minus
  // internal bookkeeping rules) — every id in it is user-visible and must
  // resolve to a translation in every locale.
  const ruleIds = [...DISPLAY_RULES].sort();

  it('DISPLAY_RULES is non-empty (sanity check against a stale import)', () => {
    expect(ruleIds.length).toBeGreaterThan(40);
  });

  it.each(ruleIds)('has title + detail for every locale: %s', (ruleId) => {
    for (const locale of LOCALE_CODES) {
      const messages = LOCALES[locale];
      const entry = resolveDotPath(messages.solver, `stepRules.${ruleId}`) as
        | { title?: unknown; detail?: unknown }
        | undefined;

      expect(entry, `${locale}: solver.stepRules.${ruleId} is missing`).toBeDefined();
      expect(
        nonEmptyString(entry?.title),
        `${locale}: solver.stepRules.${ruleId}.title is missing or empty`,
      ).toBe(true);
      expect(
        nonEmptyString(entry?.detail),
        `${locale}: solver.stepRules.${ruleId}.detail is missing or empty`,
      ).toBe(true);
    }
  });
});

describe('solver i18n coverage — limitTab', () => {
  it.each(LIMIT_TAB_KEYS)('has a translation for every locale: limitTab.%s', (key) => {
    for (const locale of LOCALE_CODES) {
      const messages = LOCALES[locale];
      const limitTab = (messages.solver as unknown as { limitTab?: Record<string, unknown> })
        .limitTab;
      expect(
        nonEmptyString(limitTab?.[key]),
        `${locale}: solver.limitTab.${key} is missing or empty`,
      ).toBe(true);
    }
  });
});

describe('solver i18n coverage — stepCategories', () => {
  it.each(STEP_CATEGORY_KEYS)('has a translation for every locale: stepCategories.%s', (key) => {
    for (const locale of LOCALE_CODES) {
      const messages = LOCALES[locale];
      const stepCategories = (
        messages.solver as unknown as { stepCategories?: Record<string, unknown> }
      ).stepCategories;
      expect(
        nonEmptyString(stepCategories?.[key]),
        `${locale}: solver.stepCategories.${key} is missing or empty`,
      ).toBe(true);
    }
  });
});
