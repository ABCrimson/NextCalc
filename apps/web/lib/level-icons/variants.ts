/**
 * Level 101 — the admin-only Architect tier, three selectable variants:
 *   prismatic-crown  a twelve-spike gold crown around a rainbow-cycling gem
 *   cosmic-nexus     an octagonal violet gem inside a swirling galaxy portal
 *   phoenix-crystal  a gem rising on flame wings, embers drifting upward
 */

import { animationStyle, bloom, embers, flames, orbitRing, sparkle, spikes } from './effects';
import { gem, gemTableStopIds } from './gem';
import { oklch, polar, starPoints } from './geometry';
import { CENTER as C } from './palette';
import { el, fmt } from './serialize';
import type { IdFn, TierScene } from './tiers';

export const LEVEL_101_VARIANTS = ['prismatic-crown', 'cosmic-nexus', 'phoenix-crystal'] as const;
export type Icon101Variant = (typeof LEVEL_101_VARIANTS)[number];

function prismaticCrown(id: IdFn): TierScene {
  const gold = 75;
  const bl = bloom(id('bl'), C, C, 31.5, gold, 0.14, 0.55, 0.86);
  const crown = spikes(C, C, 17.5, 12, 7.5, 62, 2.2, 0.17, 0.8, -90);
  const gemId = id('g');
  const g = gem({
    id: gemId,
    cx: C,
    cy: C,
    r: 17.5,
    hue: 45,
    hueSweep: 360,
    chroma: 0.25,
    lightness: 0.68,
    spread: 0.34,
    core: 1,
    tableHues: [45, 165, 285],
    animatedTable: true,
  });
  const star = el('polygon', {
    points: starPoints(C, C, 6.2, 2.6, 6),
    fill: oklch(1, 0.02, 60, 0.75),
  });
  const sparkIds = Array.from({ length: 12 }, (_, i) => id(`sp${i}`));
  const sparks = sparkIds.map((sid, i) => {
    const [x, y] = polar(C, C, 28.5, i * 30 + 15);
    return sparkle(x, y, i % 3 === 0 ? 2 : 1.4, oklch(0.97, 0.12, i * 30, 0.95), { id: sid });
  });
  const [ts0, ts1, ts2] = gemTableStopIds(gemId);
  const style = animationStyle({
    prefix: id(''),
    hueCycle: {
      durationSec: 10,
      stops: [
        { id: ts0, lightness: 0.86, chroma: 0.16, hue: 45 },
        { id: ts1, lightness: 0.7, chroma: 0.21, hue: 165 },
        { id: ts2, lightness: 0.59, chroma: 0.22, hue: 285 },
      ],
    },
    twinkle: { ids: sparkIds, durationSec: 2.6 },
  });
  return {
    defs: [...bl.defs, ...g.defs],
    body: [...bl.body, ...crown, ...g.body, star, ...sparks],
    style,
  };
}

function cosmicNexus(id: IdFn): TierScene {
  const galaxyId = id('gal');
  const galaxy = {
    defs: [
      el('radialGradient', { id: galaxyId }, [
        el('stop', { offset: '0%', stopColor: oklch(0.7, 0.25, 300, 0.7) }),
        el('stop', { offset: '45%', stopColor: oklch(0.5, 0.24, 285, 0.38) }),
        el('stop', { offset: '100%', stopColor: oklch(0.3, 0.14, 264, 0) }),
      ]),
    ],
    body: [el('circle', { cx: C, cy: C, r: 31, fill: `url(#${galaxyId})` })],
  };
  // Swirl arms — three bold quadratic sweeps from the core outward (readable at 28px).
  const arms = Array.from({ length: 3 }, (_, i) => {
    const a0 = i * 120 + 20;
    const [x0, y0] = polar(C, C, 9, a0);
    const [xc, yc] = polar(C, C, 19, a0 + 45);
    const [x1, y1] = polar(C, C, 28.5, a0 + 85);
    return el('path', {
      d: `M ${fmt(x0)} ${fmt(y0)} Q ${fmt(xc)} ${fmt(yc)} ${fmt(x1)} ${fmt(y1)}`,
      fill: 'none',
      stroke: oklch(0.9, 0.14, 290 + i * 20, 0.8),
      strokeWidth: 1.5,
      strokeLinecap: 'round',
    });
  });
  // Portal ring threading the gem (back half behind, front half on top).
  const ring = orbitRing(id('rg'), C, C, 27.5, 10, -28, 305, 0.2, 1.5);
  const starIds = Array.from({ length: 12 }, (_, i) => id(`st${i}`));
  const starField = starIds.map((sid, i) => {
    const a = i * 30 + 11 + (i % 3) * 7;
    const d = 20 + ((i * 5.3) % 8.5);
    const [x, y] = polar(C, C, d, a);
    return el('circle', {
      id: sid,
      cx: x,
      cy: y,
      r: 0.9 + (i % 3) * 0.35,
      fill: oklch(0.98, 0.03, 280, 0.95),
    });
  });
  const gemId = id('g');
  const g = gem({
    id: gemId,
    cx: C,
    cy: C,
    r: 17,
    sides: 8,
    rotation: -67.5,
    hue: 292,
    hue2: 335,
    dispersion: 0.8,
    chroma: 0.26,
    lightness: 0.62,
    spread: 0.34,
    core: 1,
    rimWidth: 1.5,
    tableHues: [284, 310, 340],
    animatedTable: true,
  });
  const core8 = el('polygon', {
    points: starPoints(C, C, 6.5, 2.4, 8),
    fill: oklch(0.98, 0.03, 280, 0.7),
  });
  const [ts0, ts1, ts2] = gemTableStopIds(gemId);
  const style = animationStyle({
    prefix: id(''),
    hueCycle: {
      durationSec: 14,
      stops: [
        { id: ts0, lightness: 0.76, chroma: 0.21, hue: 284 },
        { id: ts1, lightness: 0.6, chroma: 0.27, hue: 310 },
        { id: ts2, lightness: 0.49, chroma: 0.29, hue: 340 },
      ],
    },
    twinkle: { ids: starIds, durationSec: 3.2 },
  });
  return {
    defs: [...galaxy.defs, ...ring.defs, ...g.defs],
    body: [...galaxy.body, ...arms, ...starField, ring.back, ...g.body, core8, ring.front],
    style,
  };
}

function phoenixCrystal(id: IdFn): TierScene {
  const fl = flames(id('fl'), C, C + 15, 28, 0.27, 7, 7, 1.08);
  const bl = bloom(id('bl'), C, C + 2, 29, 45, 0.18, 0.45, 0.82);
  const wingId = id('wg');
  const wingDefs = [
    el('linearGradient', { id: wingId, x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, [
      el('stop', { offset: '0%', stopColor: oklch(0.88, 0.17, 70, 0.9) }),
      el('stop', { offset: '55%', stopColor: oklch(0.74, 0.25, 40, 0.8) }),
      el('stop', { offset: '100%', stopColor: oklch(0.6, 0.27, 22, 0.55) }),
    ]),
  ];
  // One wing, mirrored. Outer feather silhouette + brighter inner feather.
  // Wing tips stay inside r≈30 of the centre so the 40px circle-crop never cuts them.
  const outerWing = 'M 30 30 C 23 16 11 12 6 16 C 11 20 14 23 16 30 C 19 27 24 26 30 36 Z';
  const innerWing = 'M 30 32 C 25 23 17 21 12 22 C 16 25 18.5 27.5 19.5 33 C 22 30 26 30 30 37 Z';
  const wings = [
    el('g', {}, [
      el('path', { d: outerWing, fill: `url(#${wingId})` }),
      el('path', { d: innerWing, fill: oklch(0.95, 0.1, 70, 0.5) }),
    ]),
    el('g', { transform: `translate(${C * 2} 0) scale(-1 1)` }, [
      el('path', { d: outerWing, fill: `url(#${wingId})` }),
      el('path', { d: innerWing, fill: oklch(0.95, 0.1, 70, 0.5) }),
    ]),
  ];
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C + 6,
    r: 15,
    hue: 38,
    hue2: 70,
    dispersion: 0.6,
    chroma: 0.24,
    lightness: 0.72,
    spread: 0.3,
    core: 1,
  });
  const star = el('polygon', {
    points: starPoints(C, C + 6, 5.4, 2.2, 6),
    fill: oklch(1, 0.02, 60, 0.7),
  });
  const emberIds = Array.from({ length: 12 }, (_, i) => id(`em${i}`));
  const em = embers(C, C - 4, 12, 30, 0.24, 7, 14, 26, (i) => ({ id: emberIds[i] ?? '' }));
  const style = animationStyle({ prefix: id(''), twinkle: { ids: emberIds, durationSec: 2.2 } });
  return {
    defs: [...fl.defs, ...bl.defs, ...wingDefs, ...g.defs],
    body: [...fl.body, ...bl.body, ...wings, ...g.body, star, ...em],
    style,
  };
}

export function buildVariant101(variant: Icon101Variant, id: IdFn): TierScene {
  switch (variant) {
    case 'cosmic-nexus':
      return cosmicNexus(id);
    case 'phoenix-crystal':
      return phoenixCrystal(id);
    default:
      return prismaticCrown(id);
  }
}

export function isIcon101Variant(value: string): value is Icon101Variant {
  return (LEVEL_101_VARIANTS as readonly string[]).includes(value);
}
