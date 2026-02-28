/**
 * User Settings Store
 *
 * Zustand 5.0.11 store for user preferences that need to be reactive across
 * components (e.g. the calculator display reads `thousandsSeparator` to format
 * results). Persisted to localStorage under "nextcalc-user-settings".
 *
 * Settings that are display-only (username, theme) remain in the settings
 * page's local state. This store is for preferences consumed by other
 * components at render time.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSettingsState {
  /** Format numeric results with locale-appropriate thousands separators. */
  readonly thousandsSeparator: boolean;
}

interface UserSettingsActions {
  setThousandsSeparator: (enabled: boolean) => void;
}

type UserSettingsStore = UserSettingsState & UserSettingsActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<UserSettingsStore>()(
  devtools(
    persist(
      (set) => ({
        thousandsSeparator: false,

        setThousandsSeparator: (enabled: boolean) => {
          set({ thousandsSeparator: enabled }, false, 'setThousandsSeparator');
        },
      }),
      {
        name: 'nextcalc-user-settings-store',
      },
    ),
    {
      name: 'settings-store',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector hooks (prevents unnecessary re-renders)
// ---------------------------------------------------------------------------

export const useThousandsSeparator = (): boolean => useSettingsStore((s) => s.thousandsSeparator);

export const useSetThousandsSeparator = (): ((enabled: boolean) => void) =>
  useSettingsStore((s) => s.setThousandsSeparator);

// ---------------------------------------------------------------------------
// Formatting utility
// ---------------------------------------------------------------------------

/**
 * Format a calculator result string with locale-appropriate thousands
 * separators when enabled.
 *
 * Handles:
 * - Plain integers: "1000000" -> "1,000,000"
 * - Decimals: "1234567.89" -> "1,234,567.89"
 * - Negative numbers: "-1234567" -> "-1,234,567"
 * - Scientific notation: returned as-is (e.g. "1.23e+10")
 * - Non-numeric strings ("Error", "Calculating...", symbolic results): returned as-is
 *
 * Uses `Intl.NumberFormat` for locale-appropriate grouping (commas in en-US,
 * dots in de-DE, spaces in fr-FR, etc.).
 */
export function formatResultWithSeparators(
  value: string | number | null,
  enabled: boolean,
  locale?: string,
): string {
  if (value === null) return '';
  const str = String(value);

  if (!enabled) return str;

  // Don't format non-result strings
  if (str === 'Error' || str === 'Calculating...' || str === '') {
    return str;
  }

  // Don't format if the string contains non-numeric content (symbolic results,
  // expressions with variables, etc.) but allow leading minus, digits, decimal point.
  // Also skip scientific notation — Intl.NumberFormat handles it but may lose precision.
  if (/[eE]/.test(str)) return str;

  // Try to parse as a finite number
  const num = Number(str);
  if (!Number.isFinite(num)) return str;

  // Use Intl.NumberFormat for locale-aware grouping.
  // maximumFractionDigits: 20 preserves decimal precision without truncation.
  try {
    const resolvedLocale =
      locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const formatter = new Intl.NumberFormat(resolvedLocale, {
      useGrouping: true,
      maximumFractionDigits: 20,
    });
    return formatter.format(num);
  } catch {
    // If Intl fails for any reason, fall back to the raw string
    return str;
  }
}
