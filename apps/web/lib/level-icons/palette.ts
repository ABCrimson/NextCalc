/**
 * Per-tier color + scale parameters for the level icons.
 *
 * Hue comes from the single source of truth (`getLevelHue`), so the icons,
 * badges and XP bars always agree. Chroma and lightness escalate with tier so
 * the progression reads stone → emerald → sapphire → amethyst → gold → ember →
 * ruby → prism, and every level inside a tier still gets its own hue.
 */

import { getLevelHue } from '../../components/profile/level-utils';
import { clamp, lerp } from './geometry';

export const ICON_SIZE = 64;
export const CENTER = ICON_SIZE / 2;

/** Light direction for every gem (upper-left), SVG degrees. */
export const LIGHT_ANGLE = -125;

export interface TierStyle {
  /** 1-based tier index (1 = Novice … 10 = Transcendent, 11 = Architect). */
  readonly tier: number;
  /** Base lightness of the gem body. */
  readonly lightness: number;
  /** Base chroma of the gem body. */
  readonly chroma: number;
  /** Lightness spread between the lit and shadowed crown facets. */
  readonly spread: number;
  /** Outer radius of the main gem. */
  readonly radius: number;
}

const TIER_STYLES: readonly TierStyle[] = [
  { tier: 1, lightness: 0.54, chroma: 0.02, spread: 0.3, radius: 25 },
  { tier: 2, lightness: 0.57, chroma: 0.13, spread: 0.31, radius: 25 },
  { tier: 3, lightness: 0.58, chroma: 0.17, spread: 0.31, radius: 24 },
  { tier: 4, lightness: 0.59, chroma: 0.2, spread: 0.32, radius: 24 },
  { tier: 5, lightness: 0.6, chroma: 0.22, spread: 0.32, radius: 21 },
  { tier: 6, lightness: 0.61, chroma: 0.24, spread: 0.33, radius: 19 },
  { tier: 7, lightness: 0.64, chroma: 0.23, spread: 0.33, radius: 19 },
  { tier: 8, lightness: 0.65, chroma: 0.25, spread: 0.34, radius: 19 },
  { tier: 9, lightness: 0.62, chroma: 0.27, spread: 0.34, radius: 20 },
  { tier: 10, lightness: 0.66, chroma: 0.28, spread: 0.34, radius: 20 },
  { tier: 11, lightness: 0.72, chroma: 0.2, spread: 0.34, radius: 19 },
];

export function tierIndex(level: number): number {
  if (level >= 101) return 11;
  return Math.floor((level - 1) / 10) + 1;
}

export function tierStyle(level: number): TierStyle {
  return TIER_STYLES[tierIndex(level) - 1] ?? (TIER_STYLES[0] as TierStyle);
}

/** 0 → 1 position of the level inside its ten-level tier. */
export function tierProgress(level: number): number {
  if (level >= 101) return 1;
  return clamp(((level - 1) % 10) / 9, 0, 1);
}

export interface LevelPalette {
  readonly hue: number;
  /** Complementary-ish accent hue for dispersion / refraction effects. */
  readonly hue2: number;
  readonly lightness: number;
  readonly chroma: number;
  readonly spread: number;
  readonly radius: number;
  readonly tier: number;
  readonly t: number;
}

export function levelPalette(level: number): LevelPalette {
  const style = tierStyle(level);
  const t = tierProgress(level);
  const hue = getLevelHue(level);
  return {
    hue,
    hue2: (hue + 32) % 360,
    lightness: style.lightness + lerp(0, 0.03, t),
    chroma: style.chroma + lerp(0, 0.02, t),
    spread: style.spread,
    radius: style.radius,
    tier: style.tier,
    t,
  };
}
