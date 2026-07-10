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

export interface AvatarIconEntry {
  /** Same-origin public path stored in `User.image`. */
  readonly path: string;
  /** Level the icon represents (1–101). */
  readonly level: number;
  /** Display label — the level number, or the named level-101 variant. */
  readonly label: string;
}

/** The three special level-101 variants (see `LevelIcon` / scripts/generate-level-icons.ts). */
const LEVEL_101_VARIANTS = [
  { file: 'level-101.svg', label: 'Prismatic Crown' },
  { file: 'level-101-cosmic-nexus.svg', label: 'Cosmic Nexus' },
  { file: 'level-101-phoenix-crystal.svg', label: 'Phoenix Crystal' },
] as const;

/** All 103 selectable icons: levels 1–100 plus the three level-101 variants. */
export const AVATAR_ICONS: readonly AvatarIconEntry[] = [
  ...Array.from({ length: 100 }, (_, i): AvatarIconEntry => {
    const level = i + 1;
    return {
      path: `/icons/levels/level-${String(level).padStart(3, '0')}.svg`,
      level,
      label: String(level),
    };
  }),
  ...LEVEL_101_VARIANTS.map(
    ({ file, label }): AvatarIconEntry => ({
      path: `/icons/levels/${file}`,
      level: 101,
      label,
    }),
  ),
];

/** Whitelisted `User.image` values, in catalog order. */
export const AVATAR_ICON_PATHS: readonly string[] = AVATAR_ICONS.map((icon) => icon.path);

const AVATAR_ICON_PATH_SET: ReadonlySet<string> = new Set(AVATAR_ICON_PATHS);

/** Exact-match whitelist membership check — no normalization, no prefixes. */
export function isAvatarIconPath(p: string): boolean {
  return AVATAR_ICON_PATH_SET.has(p);
}
