/**
 * LevelIcon — the volumetric crystal avatar for levels 1–101.
 *
 * Renders the shared scene from `@/lib/level-icons` (the same scene the static
 * `/icons/levels/*.svg` avatar files are generated from), so the live icon in
 * the navigation/profile and the stored avatar files are always identical.
 *
 *  L1-10    Novice        stone gem
 *  L11-20   Apprentice    + caustic core, light veins
 *  L21-30   Journeyman    + dispersion, refraction lines
 *  L31-40   Adept         + inner refraction star
 *  L41-50   Expert        + 3D orbit ring
 *  L51-60   Master        + satellite shards
 *  L61-70   Grandmaster   + halo with light orbs
 *  L71-80   Legend        + crown spikes, light rays
 *  L81-90   Mythic        + plasma flames, embers
 *  L91-100  Transcendent  prismatic, animated rainbow dispersion
 *  L101     Architect     admin-only (prismatic-crown | cosmic-nexus | phoenix-crystal)
 */

import { createElement, type ReactElement, useId } from 'react';
import {
  buildLevelIconScene,
  clampLevel,
  fmt,
  type Icon101Variant,
  type SceneNode,
} from '@/lib/level-icons';

export type { Icon101Variant };

interface LevelIconProps {
  level: number;
  size?: number;
  className?: string;
  /** Only for level 101: which special variant to render */
  variant101?: Icon101Variant;
}

/**
 * Render a scene node as React elements. Keys are scene paths — the scene is
 * static, so they are stable. Numbers go through the same `fmt` as the file
 * serializer, so the inline markup is byte-for-byte the static file's.
 */
function renderNode(node: SceneNode, path: string): ReactElement {
  const props: Record<string, unknown> = { key: path };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (value === undefined) continue;
    props[name === 'class' ? 'className' : name] = typeof value === 'number' ? fmt(value) : value;
  }
  if (node.text !== undefined) return createElement(node.tag, props, node.text);
  const children: ReactElement[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child) children.push(renderNode(child, `${path}.${i}`));
  }
  return createElement(node.tag, props, ...children);
}

export function LevelIcon({
  level,
  size = 48,
  className,
  variant101 = 'prismatic-crown',
}: LevelIconProps) {
  const clampedLevel = clampLevel(level);
  // Per-instance prefix: two icons of the same level in one document must not share
  // gradient/animation ids (a hidden earlier copy would otherwise blank the visible one).
  // useId is SSR/CSR-stable; strip its `«»`/`:` delimiters so the ids stay valid in
  // url(#…) references and CSS selectors.
  const instance = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const scene = buildLevelIconScene(clampedLevel, {
    idPrefix: `li${clampedLevel}-${instance}-`,
    variant101,
    size,
  });

  return (
    <span className={className} role="img" aria-label={`Level ${clampedLevel} icon`}>
      {renderNode({ ...scene, attrs: { ...scene.attrs, 'aria-hidden': 'true' } }, 'svg')}
    </span>
  );
}
