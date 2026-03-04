/**
 * RS3-Style Level System — XP formula, tiers, colors
 *
 * Uses an adapted RuneScape 3 XP curve where each level requires
 * exponentially more XP than the last. Level 92 is roughly half
 * the XP needed for level 99, making the final stretch a true grind.
 *
 * 100 levels for regular users; level 101 is admin-only.
 */

// ============================================================================
// XP FORMULA
// ============================================================================

/**
 * Total XP required to reach a given level.
 *
 * Adapted from RuneScape 3:
 *   XP(L) = floor( sum_{i=1}^{L-1} floor(i + 300 * 2^(i/7)) / 4 )
 *
 * Milestones: L10≈1.1K, L25≈8.7K, L50≈101K, L75≈1.2M, L92≈6.5M, L99≈13M, L100≈14.4M
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * 2 ** (i / 7));
  }
  return Math.floor(total / 4);
}

/** Pre-computed table for fast lookup (levels 1-101). */
const XP_TABLE: number[] = Array.from({ length: 102 }, (_, i) => xpForLevel(i));

/** Fast XP lookup using pre-computed table. */
export function xpForLevelCached(level: number): number {
  if (level < 0) return 0;
  if (level >= XP_TABLE.length) return XP_TABLE[XP_TABLE.length - 1]!;
  return XP_TABLE[level]!;
}

/** Derive level from total XP. */
export function levelFromXp(xp: number): number {
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]!) return i;
  }
  return 1;
}

/** Progress fraction (0-1) toward the next level. */
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp);
  if (level >= 100) return 1;
  const currentThreshold = xpForLevelCached(level);
  const nextThreshold = xpForLevelCached(level + 1);
  const range = nextThreshold - currentThreshold;
  if (range <= 0) return 1;
  return Math.min((xp - currentThreshold) / range, 1);
}

// ============================================================================
// TIER SYSTEM — 10 tiers + 1 admin-only
// ============================================================================

export interface LevelTier {
  name: string;
  minLevel: number;
  maxLevel: number;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  {
    name: 'Novice',
    minLevel: 1,
    maxLevel: 10,
    color: 'gray',
    bgClass: 'bg-zinc-500/15',
    textClass: 'text-zinc-400',
    borderClass: 'border-zinc-500/30',
  },
  {
    name: 'Apprentice',
    minLevel: 11,
    maxLevel: 20,
    color: 'green',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
  },
  {
    name: 'Journeyman',
    minLevel: 21,
    maxLevel: 30,
    color: 'blue',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
  },
  {
    name: 'Adept',
    minLevel: 31,
    maxLevel: 40,
    color: 'indigo',
    bgClass: 'bg-indigo-500/15',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30',
  },
  {
    name: 'Expert',
    minLevel: 41,
    maxLevel: 50,
    color: 'purple',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
  },
  {
    name: 'Master',
    minLevel: 51,
    maxLevel: 60,
    color: 'violet',
    bgClass: 'bg-violet-500/15',
    textClass: 'text-violet-400',
    borderClass: 'border-violet-500/30',
  },
  {
    name: 'Grandmaster',
    minLevel: 61,
    maxLevel: 70,
    color: 'amber',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
  },
  {
    name: 'Legend',
    minLevel: 71,
    maxLevel: 80,
    color: 'orange',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
  },
  {
    name: 'Mythic',
    minLevel: 81,
    maxLevel: 90,
    color: 'red',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
  },
  {
    name: 'Transcendent',
    minLevel: 91,
    maxLevel: 100,
    color: 'rainbow',
    bgClass: 'bg-fuchsia-500/15',
    textClass: 'text-fuchsia-400',
    borderClass: 'border-fuchsia-500/30',
  },
  {
    name: 'Architect',
    minLevel: 101,
    maxLevel: 101,
    color: 'special',
    bgClass: 'bg-amber-400/20',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-400/40',
  },
];

/** Get the tier for a given level. */
export function getLevelTier(level: number): LevelTier {
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (level >= LEVEL_TIERS[i]!.minLevel) return LEVEL_TIERS[i]!;
  }
  return LEVEL_TIERS[0]!;
}

// ============================================================================
// OKLCH COLOR PROGRESSION
// ============================================================================

/**
 * Returns an OKLCH hue value (0-360) for a level, cycling through
 * the full spectrum so each tier has a distinct hue band.
 *
 * L1-10:   0-36   (gray → warm gray)
 * L11-20:  140-160 (green)
 * L21-30:  220-240 (blue)
 * L31-40:  255-270 (indigo)
 * L41-50:  280-300 (purple)
 * L51-60:  295-310 (violet)
 * L61-70:  55-75   (amber)
 * L71-80:  40-55   (orange)
 * L81-90:  15-30   (red)
 * L91-100: full sweep (rainbow)
 * L101:    45 (golden)
 */
export function getLevelHue(level: number): number {
  if (level >= 101) return 45;
  if (level >= 91) return ((level - 91) / 10) * 360; // rainbow sweep
  if (level >= 81) return 15 + ((level - 81) / 10) * 15;
  if (level >= 71) return 40 + ((level - 71) / 10) * 15;
  if (level >= 61) return 55 + ((level - 61) / 10) * 20;
  if (level >= 51) return 295 + ((level - 51) / 10) * 15;
  if (level >= 41) return 280 + ((level - 41) / 10) * 20;
  if (level >= 31) return 255 + ((level - 31) / 10) * 15;
  if (level >= 21) return 220 + ((level - 21) / 10) * 20;
  if (level >= 11) return 140 + ((level - 11) / 10) * 20;
  return (level / 10) * 36;
}

/**
 * Returns a full OKLCH color string for a level.
 * Lightness and chroma increase with level for a more vivid look.
 */
export function getLevelColor(level: number): string {
  const hue = getLevelHue(level);
  const t = Math.min(level / 100, 1);
  const lightness = 0.55 + t * 0.15; // 0.55 → 0.70
  const chroma = 0.12 + t * 0.16; // 0.12 → 0.28
  return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${hue.toFixed(1)})`;
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

/** Format XP with commas. */
export function formatXp(xp: number): string {
  return xp.toLocaleString('en-US');
}

/** Short format: 1.2K, 3.4M, etc. */
export function formatXpShort(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return String(xp);
}
