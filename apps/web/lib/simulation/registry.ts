/**
 * Simulation Registry — the single source of truth for the worksheet
 * "simulation" cell kind.
 *
 * Describes, for each simulation kind:
 *   - which parameter sliders to render (key, symbol, range, step, default)
 *   - which presets are available
 *   - i18n label keys (relative to the `worksheet.simulation` namespace)
 *
 * Everything in here is plain serializable data (numbers/strings) plus pure
 * CPU-fallback functions for the direction field — NO GPU state. Worksheet
 * cells persist only `{ sim, preset, params }` from this registry's domain.
 *
 * @module lib/simulation/registry
 */

import type { FieldEquationType } from '@/app/[locale]/solver/ode/GpuDirectionField';
import { INITIAL_CONDITION_TYPES } from './initial-conditions';

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

export const SIMULATION_KINDS = [
  'pde-heat',
  'pde-wave',
  'pde-laplace',
  'lorenz',
  'direction-field',
] as const;

export type SimulationKind = (typeof SIMULATION_KINDS)[number];

/** Runtime guard for deserialized cell data (DB/JSON may carry unknown kinds). */
export function isSimulationKind(value: string): value is SimulationKind {
  return (SIMULATION_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Spec for a single parameter slider row. */
export interface SimParamSpec {
  /** Key inside SimulationCell.params */
  readonly key: string;
  /** Short mathematical symbol shown in the row badge (language-neutral) */
  readonly symbol: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  /** i18n key under `worksheet.simulation.params.*` */
  readonly labelKey: string;
}

export interface SimRegistryEntry {
  /** i18n key under `worksheet.simulation.*` */
  readonly labelKey: string;
  readonly params: readonly SimParamSpec[];
  readonly presets: readonly string[];
}

/** Per-preset configuration for the direction-field simulation. */
export interface DirectionFieldPreset {
  readonly equationType: FieldEquationType;
  readonly params: readonly SimParamSpec[];
  /** Square domain bounds for the field */
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  /** CPU fallbacks mirroring the WGSL evalSystem cases in GpuDirectionField */
  readonly f: (x: number, y: number, params: Readonly<Record<string, number>>) => number;
  readonly g: (x: number, y: number, params: Readonly<Record<string, number>>) => number;
}

// ---------------------------------------------------------------------------
// Direction-field presets (mirror GpuDirectionField.tsx WGSL evalSystem)
// ---------------------------------------------------------------------------

export const DIRECTION_FIELD_PRESETS: Record<string, DirectionFieldPreset> = {
  'lotka-volterra': {
    equationType: 'lotka-volterra',
    params: [
      {
        key: 'param0',
        symbol: 'a',
        min: 0.1,
        max: 3,
        step: 0.05,
        default: 1.5,
        labelKey: 'preyGrowth',
      },
      {
        key: 'param1',
        symbol: 'b',
        min: 0.1,
        max: 3,
        step: 0.05,
        default: 1.0,
        labelKey: 'predatorDeath',
      },
    ],
    xMin: 0,
    xMax: 4,
    yMin: 0,
    yMax: 4,
    // dx/dt = a*x - x*y,  dy/dt = x*y - b*y
    f: (x, y, p) => (p['param0'] ?? 1.5) * x - x * y,
    g: (x, y, p) => x * y - (p['param1'] ?? 1.0) * y,
  },
  'van-der-pol': {
    equationType: 'van-der-pol',
    params: [
      { key: 'param0', symbol: 'μ', min: 0.1, max: 4, step: 0.05, default: 1, labelKey: 'mu' },
    ],
    xMin: -4,
    xMax: 4,
    yMin: -4,
    yMax: 4,
    // dx/dt = y,  dy/dt = mu*(1 - x^2)*y - x
    f: (_x, y) => y,
    g: (x, y, p) => (p['param0'] ?? 1) * (1 - x * x) * y - x,
  },
  'stable-spiral': {
    equationType: 'stable-spiral',
    params: [
      {
        key: 'param0',
        symbol: 'α',
        min: 0.01,
        max: 1,
        step: 0.01,
        default: 0.1,
        labelKey: 'spiralDamping',
      },
    ],
    xMin: -3,
    xMax: 3,
    yMin: -3,
    yMax: 3,
    // dx/dt = -alpha*x - y,  dy/dt = x - alpha*y
    f: (x, y, p) => -(p['param0'] ?? 0.1) * x - y,
    g: (x, y, p) => x - (p['param0'] ?? 0.1) * y,
  },
  pendulum: {
    equationType: 'pendulum',
    params: [
      { key: 'param0', symbol: 'γ', min: 0, max: 1, step: 0.01, default: 0.1, labelKey: 'damping' },
    ],
    xMin: -6,
    xMax: 6,
    yMin: -4,
    yMax: 4,
    // dx/dt = y,  dy/dt = -sin(x) - gamma*y
    f: (_x, y) => y,
    g: (x, y, p) => -Math.sin(x) - (p['param0'] ?? 0.1) * y,
  },
};

const DIRECTION_FIELD_PRESET_NAMES = Object.keys(DIRECTION_FIELD_PRESETS);
const DEFAULT_DIRECTION_FIELD_PRESET = 'van-der-pol';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SIM_REGISTRY: Record<SimulationKind, SimRegistryEntry> = {
  'pde-heat': {
    labelKey: 'heat',
    params: [
      {
        key: 'alpha',
        symbol: 'α',
        min: 0.01,
        max: 0.25,
        step: 0.005,
        default: 0.1,
        labelKey: 'alpha',
      },
    ],
    presets: INITIAL_CONDITION_TYPES,
  },
  'pde-wave': {
    labelKey: 'wave',
    params: [
      { key: 'c', symbol: 'c', min: 0.1, max: 2, step: 0.05, default: 1, labelKey: 'waveSpeed' },
    ],
    presets: INITIAL_CONDITION_TYPES,
  },
  'pde-laplace': {
    labelKey: 'laplace',
    params: [
      {
        key: 'alpha',
        symbol: 'α',
        min: 0.05,
        max: 0.25,
        step: 0.005,
        default: 0.1,
        labelKey: 'relaxation',
      },
    ],
    // Laplace relaxation is most interesting from localized boundary-ish sources
    presets: ['center', 'ring', 'corners', 'cross', 'random'],
  },
  lorenz: {
    labelKey: 'lorenz',
    params: [
      { key: 'sigma', symbol: 'σ', min: 0, max: 30, step: 0.1, default: 10, labelKey: 'sigma' },
      { key: 'rho', symbol: 'ρ', min: 0, max: 60, step: 0.1, default: 28, labelKey: 'rho' },
      { key: 'beta', symbol: 'β', min: 0, max: 10, step: 0.01, default: 8 / 3, labelKey: 'beta' },
      {
        key: 'steps',
        symbol: 'n',
        min: 500,
        max: 5000,
        step: 100,
        default: 2000,
        labelKey: 'steps',
      },
    ],
    presets: ['classic'],
  },
  'direction-field': {
    labelKey: 'directionField',
    // Default preset's params — use getSimParams(kind, preset) for the live set
    params: DIRECTION_FIELD_PRESETS[DEFAULT_DIRECTION_FIELD_PRESET]?.params ?? [],
    presets: DIRECTION_FIELD_PRESET_NAMES,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The parameter slider specs for a kind, taking the active preset into
 * account (direction-field presets each carry their own param specs).
 */
export function getSimParams(kind: SimulationKind, preset: string): readonly SimParamSpec[] {
  if (kind === 'direction-field') {
    return DIRECTION_FIELD_PRESETS[preset]?.params ?? SIM_REGISTRY[kind].params;
  }
  return SIM_REGISTRY[kind].params;
}

/** Default preset name for a kind. */
export function DEFAULT_PRESET(kind: SimulationKind): string {
  if (kind === 'direction-field') return DEFAULT_DIRECTION_FIELD_PRESET;
  return SIM_REGISTRY[kind].presets[0] ?? '';
}

/**
 * Default `params` map for a kind (and optional preset), used by
 * `createSimulationCell()` and when switching sim kind/preset.
 */
export function DEFAULT_PARAMS(kind: SimulationKind, preset?: string): Record<string, number> {
  const specs = getSimParams(kind, preset ?? DEFAULT_PRESET(kind));
  const params: Record<string, number> = {};
  for (const spec of specs) {
    params[spec.key] = spec.default;
  }
  return params;
}
