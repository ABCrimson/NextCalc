import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatResultWithSeparators,
  useSettingsStore,
} from '@/lib/stores/settings-store';

describe('settings-store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ thousandsSeparator: false });
  });

  afterEach(() => {
    useSettingsStore.setState({ thousandsSeparator: false });
  });

  describe('thousandsSeparator', () => {
    it('defaults to false', () => {
      expect(useSettingsStore.getState().thousandsSeparator).toBe(false);
    });

    it('can be enabled', () => {
      useSettingsStore.getState().setThousandsSeparator(true);
      expect(useSettingsStore.getState().thousandsSeparator).toBe(true);
    });

    it('can be toggled back to false', () => {
      useSettingsStore.getState().setThousandsSeparator(true);
      useSettingsStore.getState().setThousandsSeparator(false);
      expect(useSettingsStore.getState().thousandsSeparator).toBe(false);
    });
  });
});

describe('formatResultWithSeparators', () => {
  it('returns empty string for null', () => {
    expect(formatResultWithSeparators(null, true)).toBe('');
  });

  it('returns raw string when disabled', () => {
    expect(formatResultWithSeparators('1000000', false)).toBe('1000000');
  });

  it('passes through "Error" unchanged', () => {
    expect(formatResultWithSeparators('Error', true)).toBe('Error');
  });

  it('passes through "Calculating..." unchanged', () => {
    expect(formatResultWithSeparators('Calculating...', true)).toBe('Calculating...');
  });

  it('passes through empty string unchanged', () => {
    expect(formatResultWithSeparators('', true)).toBe('');
  });

  it('passes through scientific notation unchanged', () => {
    expect(formatResultWithSeparators('1.23e+10', true)).toBe('1.23e+10');
    expect(formatResultWithSeparators('5E-3', true)).toBe('5E-3');
  });

  it('passes through non-numeric strings unchanged', () => {
    expect(formatResultWithSeparators('Infinity', true)).toBe('Infinity');
    expect(formatResultWithSeparators('NaN', true)).toBe('NaN');
  });

  it('formats integers with en-US locale', () => {
    const result = formatResultWithSeparators('1000000', true, 'en-US');
    expect(result).toBe('1,000,000');
  });

  it('formats decimals with en-US locale', () => {
    const result = formatResultWithSeparators('1234567.89', true, 'en-US');
    expect(result).toBe('1,234,567.89');
  });

  it('formats negative numbers with en-US locale', () => {
    const result = formatResultWithSeparators('-1234567', true, 'en-US');
    expect(result).toBe('-1,234,567');
  });

  it('formats with de-DE locale (dot grouping)', () => {
    const result = formatResultWithSeparators('1000000', true, 'de-DE');
    expect(result).toBe('1.000.000');
  });

  it('handles number type input', () => {
    const result = formatResultWithSeparators(1234567, true, 'en-US');
    expect(result).toBe('1,234,567');
  });

  it('handles small numbers without grouping', () => {
    const result = formatResultWithSeparators('42', true, 'en-US');
    expect(result).toBe('42');
  });

  it('handles zero', () => {
    const result = formatResultWithSeparators('0', true, 'en-US');
    expect(result).toBe('0');
  });
});
