import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  DEFAULT_PRESET,
  DIRECTION_FIELD_PRESETS,
  getSimParams,
  isSimulationKind,
  SIM_REGISTRY,
  SIMULATION_KINDS,
} from '@/lib/simulation/registry';
import en from '@/messages/en.json';

/** Resolve a dotted key path against the (typed) en.json import at runtime. */
function hasStringAt(obj: unknown, path: readonly string[]): boolean {
  let cur: unknown = obj;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null || !(key in cur)) return false;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string';
}

/**
 * Extract the string param keys a direction-field f/g closure reads via
 * `p['paramN']` — used to assert presets never read an undeclared param key.
 */
function referencedParamKeys(fn: (...args: never[]) => number): string[] {
  const matches = fn.toString().matchAll(/p\[['"](\w+)['"]\]/g);
  return [...matches].map((m) => m[1] as string);
}

describe('SIM_REGISTRY', () => {
  it('declares exactly the kinds in SIMULATION_KINDS', () => {
    expect(Object.keys(SIM_REGISTRY).sort()).toEqual([...SIMULATION_KINDS].sort());
  });

  describe.each(SIMULATION_KINDS)('%s', (kind) => {
    it('has a label key that resolves in en.json under worksheet.simulation', () => {
      const entry = SIM_REGISTRY[kind];
      expect(hasStringAt(en, ['worksheet', 'simulation', entry.labelKey])).toBe(true);
    });

    it('declares at least one parameter spec', () => {
      expect(SIM_REGISTRY[kind].params.length).toBeGreaterThan(0);
    });

    it('every param spec satisfies min <= default <= max and min < max', () => {
      for (const spec of SIM_REGISTRY[kind].params) {
        expect(spec.min).toBeLessThan(spec.max);
        expect(spec.min).toBeLessThanOrEqual(spec.default);
        expect(spec.default).toBeLessThanOrEqual(spec.max);
      }
    });

    it('every param spec has a label key that resolves under worksheet.simulation.params', () => {
      for (const spec of SIM_REGISTRY[kind].params) {
        expect(hasStringAt(en, ['worksheet', 'simulation', 'params', spec.labelKey])).toBe(true);
      }
    });

    it('declares at least one preset, each with a resolvable label key', () => {
      const presets = SIM_REGISTRY[kind].presets;
      expect(presets.length).toBeGreaterThan(0);
      for (const preset of presets) {
        expect(hasStringAt(en, ['worksheet', 'simulation', 'presets', preset])).toBe(true);
      }
    });

    it('DEFAULT_PARAMS produces exactly the declared keys, each within [min, max]', () => {
      const preset = DEFAULT_PRESET(kind);
      const specs = getSimParams(kind, preset);
      const params = DEFAULT_PARAMS(kind, preset);

      expect(Object.keys(params).sort()).toEqual(specs.map((s) => s.key).sort());
      for (const spec of specs) {
        const value = params[spec.key];
        expect(value).toBeGreaterThanOrEqual(spec.min);
        expect(value).toBeLessThanOrEqual(spec.max);
      }
    });
  });

  describe('direction-field presets', () => {
    it('every preset name declared on the kind maps to a DIRECTION_FIELD_PRESETS entry', () => {
      for (const preset of SIM_REGISTRY['direction-field'].presets) {
        expect(DIRECTION_FIELD_PRESETS[preset]).toBeDefined();
      }
    });

    it('every preset param spec satisfies min <= default <= max', () => {
      for (const preset of Object.values(DIRECTION_FIELD_PRESETS)) {
        expect(preset.params.length).toBeGreaterThan(0);
        for (const spec of preset.params) {
          expect(spec.min).toBeLessThan(spec.max);
          expect(spec.min).toBeLessThanOrEqual(spec.default);
          expect(spec.default).toBeLessThanOrEqual(spec.max);
        }
      }
    });

    it('every preset declares a non-degenerate domain', () => {
      for (const preset of Object.values(DIRECTION_FIELD_PRESETS)) {
        expect(preset.xMin).toBeLessThan(preset.xMax);
        expect(preset.yMin).toBeLessThan(preset.yMax);
      }
    });

    it('f/g only ever read param keys declared on that preset', () => {
      for (const [name, preset] of Object.entries(DIRECTION_FIELD_PRESETS)) {
        const declared = new Set(preset.params.map((s) => s.key));
        const used = new Set([...referencedParamKeys(preset.f), ...referencedParamKeys(preset.g)]);
        for (const key of used) {
          expect(declared.has(key), `${name} references undeclared param "${key}"`).toBe(true);
        }
      }
    });

    it('f/g return finite numbers for default params at the domain midpoint', () => {
      for (const preset of Object.values(DIRECTION_FIELD_PRESETS)) {
        const params: Record<string, number> = {};
        for (const spec of preset.params) params[spec.key] = spec.default;
        const midX = (preset.xMin + preset.xMax) / 2;
        const midY = (preset.yMin + preset.yMax) / 2;
        expect(Number.isFinite(preset.f(midX, midY, params))).toBe(true);
        expect(Number.isFinite(preset.g(midX, midY, params))).toBe(true);
      }
    });

    it('getSimParams returns the active preset params, not the registry default entry', () => {
      const pendulumParams = getSimParams('direction-field', 'pendulum');
      expect(pendulumParams).toBe(DIRECTION_FIELD_PRESETS['pendulum']?.params);
      expect(pendulumParams).not.toBe(SIM_REGISTRY['direction-field'].params);
    });

    it('falls back to the registry default params for an unrecognized preset name', () => {
      const params = getSimParams('direction-field', 'not-a-real-preset');
      expect(params).toBe(SIM_REGISTRY['direction-field'].params);
    });
  });

  describe('isSimulationKind', () => {
    it('accepts every declared kind', () => {
      for (const kind of SIMULATION_KINDS) {
        expect(isSimulationKind(kind)).toBe(true);
      }
    });

    it('rejects strings that are not declared kinds', () => {
      expect(isSimulationKind('not-a-kind')).toBe(false);
      expect(isSimulationKind('')).toBe(false);
    });
  });

  describe('DEFAULT_PRESET', () => {
    it('returns van-der-pol for direction-field', () => {
      expect(DEFAULT_PRESET('direction-field')).toBe('van-der-pol');
    });

    it('returns the first registry preset for non-direction-field kinds', () => {
      expect(DEFAULT_PRESET('lorenz')).toBe(SIM_REGISTRY['lorenz'].presets[0]);
      expect(DEFAULT_PRESET('pde-heat')).toBe(SIM_REGISTRY['pde-heat'].presets[0]);
    });
  });
});
