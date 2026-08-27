/**
 * Level icons — single source of truth for the 1–101 crystal avatars.
 *
 * `buildLevelIconScene()` returns a framework-free scene tree; the React
 * `LevelIcon` component renders it live, and `scripts/generate-level-icons.ts`
 * serializes it to the static `/icons/levels/*.svg` files that production
 * `User.image` rows reference. Both outputs are therefore pixel-identical.
 */

import { ICON_SIZE, levelPalette, tierIndex } from './palette';
import { el, type SceneNode, serializeSvg } from './serialize';
import { TIER_BUILDERS, type TierScene } from './tiers';
import { buildVariant101, type Icon101Variant, LEVEL_101_VARIANTS } from './variants';

export { ICON_SIZE } from './palette';
export { fmt, type SceneNode, serializeSvg } from './serialize';
export { type Icon101Variant, isIcon101Variant, LEVEL_101_VARIANTS } from './variants';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 101;

export interface LevelIconOptions {
  /** Prefix for every id in the scene (required when several icons share a document). */
  readonly idPrefix?: string;
  /** Which Architect (L101) variant to render. Ignored below 101. */
  readonly variant101?: Icon101Variant;
  /** Rendered width/height (the viewBox is always 64×64). */
  readonly size?: number;
}

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(level)));
}

function buildTierScene(level: number, variant: Icon101Variant, idPrefix: string): TierScene {
  const id = (name: string) => `${idPrefix}${name}`;
  if (level >= MAX_LEVEL) return buildVariant101(variant, id);
  const builder = TIER_BUILDERS[tierIndex(level) - 1];
  if (!builder) throw new Error(`No tier builder for level ${level}`);
  return builder(level, levelPalette(level), id);
}

/** Build the scene tree for a level icon. */
export function buildLevelIconScene(level: number, options: LevelIconOptions = {}): SceneNode {
  const lvl = clampLevel(level);
  const variant = options.variant101 ?? 'prismatic-crown';
  const scene = buildTierScene(lvl, variant, options.idPrefix ?? '');
  const size = options.size ?? ICON_SIZE;
  const children: SceneNode[] = [];
  if (scene.style) children.push(scene.style);
  if (scene.defs.length > 0) children.push(el('defs', {}, scene.defs));
  children.push(...scene.body);
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: `0 0 ${ICON_SIZE} ${ICON_SIZE}`,
    },
    children,
  );
}

/** Standalone SVG markup for a level icon. */
export function levelIconSvg(level: number, options: LevelIconOptions = {}): string {
  return serializeSvg(buildLevelIconScene(level, options));
}

export interface LevelIconFile {
  readonly file: string;
  readonly level: number;
  readonly variant101: Icon101Variant | undefined;
}

/** Public path filename for a level (or Architect variant). */
export function levelIconFileName(level: number, variant101?: Icon101Variant): string {
  const lvl = clampLevel(level);
  if (lvl >= MAX_LEVEL && variant101 && variant101 !== 'prismatic-crown') {
    return `level-101-${variant101}.svg`;
  }
  return `level-${String(lvl).padStart(3, '0')}.svg`;
}

/** The 103 runtime avatar files (levels 1–100 + the three Architect variants). */
export const LEVEL_ICON_FILES: readonly LevelIconFile[] = [
  ...Array.from({ length: MAX_LEVEL - 1 }, (_, i): LevelIconFile => {
    const level = i + 1;
    return { file: levelIconFileName(level), level, variant101: undefined };
  }),
  ...LEVEL_101_VARIANTS.map(
    (variant101): LevelIconFile => ({
      file: levelIconFileName(MAX_LEVEL, variant101),
      level: MAX_LEVEL,
      variant101,
    }),
  ),
];
