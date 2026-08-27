/**
 * Avatar icon catalog — the single whitelist for owner avatar icons.
 *
 * The site owner (role ADMIN) may set any of the level icons under
 * `public/icons/levels/` as their avatar; the chosen same-origin path
 * (e.g. `/icons/levels/level-042.svg`) is stored in `User.image`.
 *
 * BOTH the `setAvatarIcon` server action (validation) and the profile
 * picker UI (rendering) import from this file, so the whitelist and the
 * picker can never drift apart. `isAvatarIconPath` is a whitelist check
 * (exact-match membership), not a sanitizer — anything not catalogued
 * here is rejected.
 */

import { type Icon101Variant, LEVEL_ICON_FILES } from '@/lib/level-icons';

export interface AvatarIconEntry {
  /** Same-origin public path stored in `User.image`. */
  readonly path: string;
  /** Level the icon represents (1–101). */
  readonly level: number;
  /** Display label — the level number, or the named level-101 variant. */
  readonly label: string;
}

/** Display labels for the three level-101 Architect variants. */
const LEVEL_101_LABELS: Readonly<Record<Icon101Variant, string>> = {
  'prismatic-crown': 'Prismatic Crown',
  'cosmic-nexus': 'Cosmic Nexus',
  'phoenix-crystal': 'Phoenix Crystal',
};

/**
 * All 103 selectable icons: levels 1–100 plus the three level-101 variants —
 * derived from the icon module's file list so the whitelist can never drift
 * from what `scripts/generate-level-icons.ts` actually writes.
 */
export const AVATAR_ICONS: readonly AvatarIconEntry[] = LEVEL_ICON_FILES.map(
  ({ file, level, variant101 }): AvatarIconEntry => ({
    path: `/icons/levels/${file}`,
    level,
    label: variant101 ? LEVEL_101_LABELS[variant101] : String(level),
  }),
);

/** Whitelisted `User.image` values, in catalog order. */
export const AVATAR_ICON_PATHS: readonly string[] = AVATAR_ICONS.map((icon) => icon.path);

const AVATAR_ICON_PATH_SET: ReadonlySet<string> = new Set(AVATAR_ICON_PATHS);

/** Exact-match whitelist membership check — no normalization, no prefixes. */
export function isAvatarIconPath(p: string): boolean {
  return AVATAR_ICON_PATH_SET.has(p);
}
