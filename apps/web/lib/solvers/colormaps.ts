/**
 * Colormap Utilities
 *
 * Simple RGB lookup functions for scientific visualization colormaps.
 * Each maps a scalar t in [0, 1] to an [R, G, B] triple in [0, 1].
 *
 * @module lib/solvers/colormaps
 */

export type ColormapName = 'viridis' | 'inferno' | 'plasma' | 'magma' | 'coolwarm';

// ---------------------------------------------------------------------------
// Color stop interpolation helper
// ---------------------------------------------------------------------------

interface ColorStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

function interpolateStops(stops: readonly ColorStop[], t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));

  // Find the two surrounding stops
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1]!.t < clamped) i++;

  if (i >= stops.length - 1) {
    const s = stops[stops.length - 1]!;
    return [s.r, s.g, s.b];
  }

  const s0 = stops[i]!;
  const s1 = stops[i + 1]!;
  const f = s0.t === s1.t ? 0 : (clamped - s0.t) / (s1.t - s0.t);

  return [s0.r + f * (s1.r - s0.r), s0.g + f * (s1.g - s0.g), s0.b + f * (s1.b - s0.b)];
}

// ---------------------------------------------------------------------------
// Colormap definitions (approximated with key stops)
// ---------------------------------------------------------------------------

const VIRIDIS_STOPS: readonly ColorStop[] = [
  { t: 0.0, r: 0.267, g: 0.004, b: 0.329 },
  { t: 0.25, r: 0.282, g: 0.14, b: 0.458 },
  { t: 0.5, r: 0.127, g: 0.566, b: 0.551 },
  { t: 0.75, r: 0.544, g: 0.773, b: 0.249 },
  { t: 1.0, r: 0.993, g: 0.906, b: 0.144 },
];

const INFERNO_STOPS: readonly ColorStop[] = [
  { t: 0.0, r: 0.001, g: 0.0, b: 0.014 },
  { t: 0.25, r: 0.341, g: 0.062, b: 0.429 },
  { t: 0.5, r: 0.735, g: 0.215, b: 0.33 },
  { t: 0.75, r: 0.973, g: 0.539, b: 0.05 },
  { t: 1.0, r: 0.988, g: 1.0, b: 0.644 },
];

const PLASMA_STOPS: readonly ColorStop[] = [
  { t: 0.0, r: 0.05, g: 0.03, b: 0.528 },
  { t: 0.25, r: 0.494, g: 0.012, b: 0.658 },
  { t: 0.5, r: 0.798, g: 0.28, b: 0.47 },
  { t: 0.75, r: 0.973, g: 0.585, b: 0.253 },
  { t: 1.0, r: 0.94, g: 0.975, b: 0.131 },
];

const MAGMA_STOPS: readonly ColorStop[] = [
  { t: 0.0, r: 0.001, g: 0.0, b: 0.014 },
  { t: 0.25, r: 0.32, g: 0.06, b: 0.48 },
  { t: 0.5, r: 0.716, g: 0.215, b: 0.475 },
  { t: 0.75, r: 0.987, g: 0.537, b: 0.382 },
  { t: 1.0, r: 0.987, g: 0.991, b: 0.75 },
];

const COOLWARM_STOPS: readonly ColorStop[] = [
  { t: 0.0, r: 0.23, g: 0.299, b: 0.754 },
  { t: 0.25, r: 0.554, g: 0.662, b: 0.916 },
  { t: 0.5, r: 0.866, g: 0.866, b: 0.866 },
  { t: 0.75, r: 0.916, g: 0.533, b: 0.435 },
  { t: 1.0, r: 0.706, g: 0.016, b: 0.15 },
];

const COLORMAP_REGISTRY: Record<ColormapName, readonly ColorStop[]> = {
  viridis: VIRIDIS_STOPS,
  inferno: INFERNO_STOPS,
  plasma: PLASMA_STOPS,
  magma: MAGMA_STOPS,
  coolwarm: COOLWARM_STOPS,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map a scalar value in [0, 1] to an RGB color using the specified colormap.
 * Returns [r, g, b] where each component is in [0, 1].
 */
export function getColor(t: number, colormap: ColormapName): [number, number, number] {
  const stops = COLORMAP_REGISTRY[colormap];
  return interpolateStops(stops, t);
}

/**
 * List of all available colormap names.
 */
export const COLORMAP_NAMES: readonly ColormapName[] = [
  'viridis',
  'inferno',
  'plasma',
  'magma',
  'coolwarm',
];
