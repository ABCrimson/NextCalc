/**
 * Tier compositions for levels 1–100 (Novice → Transcendent).
 *
 * Each tier layers more light around the same volumetric gem:
 *   T1 Novice        stone gem, faint bloom
 *   T2 Apprentice    + bright caustic core, light veins
 *   T3 Journeyman    + dispersion (two hues), refraction lines
 *   T4 Adept         + inner refraction star, sparkle
 *   T5 Expert        + 3D orbit ring threading the gem
 *   T6 Master        + satellite crystal shards
 *   T7 Grandmaster   + halo with orbiting light orbs
 *   T8 Legend        + faceted crown spikes + light rays
 *   T9 Mythic        + plasma flames + rising embers
 *   T10 Transcendent prismatic gem, animated rainbow dispersion, twinkling sparkles
 */

import {
  animationStyle,
  bloom,
  ellipsePoint,
  embers,
  flames,
  lightRays,
  orb,
  orbitRing,
  shard,
  sparkle,
  spikes,
} from './effects';
import { gem, gemTableStopIds } from './gem';
import { oklch, polar, starPoints } from './geometry';
import { CENTER as C, type LevelPalette } from './palette';
import { el, type SceneNode } from './serialize';

export interface TierScene {
  readonly defs: readonly SceneNode[];
  readonly body: readonly SceneNode[];
  readonly style?: SceneNode;
}

/** `id('x')` returns the scene-prefixed id for `x`. */
export type IdFn = (name: string) => string;

export type TierBuilder = (level: number, p: LevelPalette, id: IdFn) => TierScene;

/** Inner refraction star drawn on the table. */
function innerStar(
  id: string,
  r: number,
  points: number,
  hue: number,
  chroma: number,
  alpha: number,
): { readonly def: SceneNode; readonly node: SceneNode } {
  return {
    def: el('radialGradient', { id }, [
      el('stop', { offset: '0%', stopColor: oklch(0.99, chroma * 0.15, hue, alpha) }),
      el('stop', { offset: '60%', stopColor: oklch(0.9, chroma * 0.5, hue, alpha * 0.6) }),
      el('stop', { offset: '100%', stopColor: oklch(0.85, chroma * 0.6, hue, 0) }),
    ]),
    node: el('polygon', { points: starPoints(C, C, r, r * 0.42, points), fill: `url(#${id})` }),
  };
}

const tier1: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 30, p.hue, 0.04, 0.16);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    core: 0.45,
    specular: 0.9,
  });
  return { defs: [...bl.defs, ...g.defs], body: [...bl.body, ...g.body] };
};

const tier2: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 30, p.hue, 0.1, 0.22);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    tableRatio: 0.52,
    core: 0.8,
  });
  // Light veins — two bright internal refractions crossing the table.
  const veins = [0, 1].map((i) => {
    const off = (i - 0.5) * 3.2;
    const [x1, y1] = polar(C + off, C + off, p.radius * 0.42, 150);
    const [x2, y2] = polar(C + off, C + off, p.radius * 0.42, -30);
    return el('line', {
      x1,
      y1,
      x2,
      y2,
      stroke: oklch(0.97, p.chroma * 0.2, p.hue, 0.32),
      strokeWidth: 0.55,
      strokeLinecap: 'round',
    });
  });
  return { defs: [...bl.defs, ...g.defs], body: [...bl.body, ...g.body, ...veins] };
};

const tier3: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 31, p.hue, 0.14, 0.3);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue2,
    dispersion: 0.9,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    core: 0.75,
  });
  // Refraction lines: light splitting from the core toward three vertices.
  const lines = [-90, 30, 150].map((a) => {
    const [x1, y1] = polar(C, C, p.radius * 0.12, a);
    const [x2, y2] = polar(C, C, p.radius * 0.94, a);
    return el('line', {
      x1,
      y1,
      x2,
      y2,
      stroke: oklch(0.96, p.chroma * 0.3, p.hue2, 0.62),
      strokeWidth: 0.9,
      strokeLinecap: 'round',
    });
  });
  return { defs: [...bl.defs, ...g.defs], body: [...bl.body, ...g.body, ...lines] };
};

const tier4: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 31, p.hue, 0.16, 0.32);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue2,
    dispersion: 0.5,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    tableRatio: 0.48,
    core: 0.85,
  });
  const star = innerStar(id('st'), p.radius * 0.36, 6, p.hue2, p.chroma, 0.7);
  const [sx, sy] = polar(C, C, p.radius * 0.78, -128);
  const spark = sparkle(sx, sy, 2.4, oklch(1, 0, p.hue, 0.9));
  return {
    defs: [...bl.defs, ...g.defs, star.def],
    body: [...bl.body, ...g.body, star.node, spark],
  };
};

const tier5: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 31, p.hue, 0.18, 0.36);
  const ring = orbitRing(id('rg'), C, C, 29, 8.5, -22, p.hue2, p.chroma, 1.3);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue2,
    dispersion: 0.55,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    tableRatio: 0.48,
    core: 0.85,
  });
  const star = innerStar(id('st'), p.radius * 0.34, 6, p.hue2, p.chroma, 0.55);
  const sparks = [52, 128].map((t, i) => {
    const [x, y] = ellipsePoint(C, C, 29, 8.5, -22, t);
    return sparkle(x, y, i === 0 ? 2.6 : 2, oklch(1, 0, p.hue, 0.95));
  });
  return {
    defs: [...bl.defs, ...ring.defs, ...g.defs, star.def],
    body: [...bl.body, ring.back, ...g.body, star.node, ring.front, ...sparks],
  };
};

const tier6: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 31, p.hue, 0.18, 0.4);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue2,
    dispersion: 0.6,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    core: 0.9,
  });
  const star = innerStar(id('st'), p.radius * 0.34, 6, p.hue2, p.chroma, 0.5);
  const shardAt = (
    angle: number,
    dist: number,
    len: number,
    wid: number,
    hueOff: number,
    opacity = 1,
  ) => {
    const [x, y] = polar(C, C, dist, angle);
    return shard(x, y, len, wid, angle + 90, p.hue + hueOff, p.chroma, p.lightness + 0.02, opacity);
  };
  const back = [shardAt(-148, 23, 7.5, 3.1, 12, 0.92), shardAt(-22, 23.5, 6.5, 2.7, 24, 0.92)];
  const front = [shardAt(104, 23, 8, 3.3, 0)];
  const shimmer = [
    [-70, 27.5, 1.6],
    [150, 28, 1.3],
    [20, 28.5, 1.1],
  ].map(([a, d, r]) => {
    const [x, y] = polar(C, C, d ?? 0, a ?? 0);
    return sparkle(x, y, r ?? 1, oklch(1, 0, p.hue, 0.85));
  });
  return {
    defs: [...bl.defs, ...g.defs, star.def],
    body: [...bl.body, ...back, ...g.body, star.node, ...front, ...shimmer],
  };
};

const tier7: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 31.5, p.hue, 0.18, 0.45);
  const halo = el('circle', {
    cx: C,
    cy: C,
    r: 26.5,
    fill: 'none',
    stroke: oklch(0.84, p.chroma * 0.6, p.hue, 0.5),
    strokeWidth: 0.9,
  });
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue2,
    dispersion: 0.45,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    core: 0.95,
  });
  const star = innerStar(id('st'), p.radius * 0.36, 6, p.hue2, p.chroma, 0.55);
  const orbs = Array.from({ length: 5 }, (_, i) => {
    const a = -90 + i * 72 + p.t * 36;
    const [x, y] = polar(C, C, 26.5, a);
    return orb(x, y, 1.9, p.hue - 10 + i * 7, p.chroma);
  });
  return {
    defs: [...bl.defs, ...g.defs, star.def],
    body: [...bl.body, halo, ...g.body, star.node, ...orbs],
  };
};

const tier8: TierBuilder = (_level, p, id) => {
  const bl = bloom(id('bl'), C, C, 31.5, p.hue, 0.18, 0.45);
  const ry = lightRays(id('ry'), C, C, 6, 20, 31, 3.2, p.hue + 10, 5, p.chroma * 0.8, 0.55, 0);
  const sp = spikes(C, C, p.radius, 6, 6.5, p.hue, 4, p.chroma, p.lightness + 0.02);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue2,
    dispersion: 0.5,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    core: 0.95,
  });
  const star = innerStar(id('st'), p.radius * 0.36, 6, p.hue2, p.chroma, 0.6);
  return {
    defs: [...bl.defs, ...ry.defs, ...g.defs, star.def],
    body: [...bl.body, ...ry.body, ...sp, ...g.body, star.node],
  };
};

const tier9: TierBuilder = (level, p, id) => {
  const fl = flames(id('fl'), C, C + 9, p.hue, p.chroma, level, 6, 1.25);
  const bl = bloom(id('bl'), C, C, 30, p.hue + 20, 0.2, 0.42, 0.8);
  const g = gem({
    id: id('g'),
    cx: C,
    cy: C,
    r: p.radius,
    hue: p.hue,
    hue2: p.hue + 30,
    dispersion: 0.45,
    chroma: p.chroma,
    lightness: p.lightness + 0.02,
    spread: p.spread,
    core: 1,
  });
  const star = innerStar(id('st'), p.radius * 0.38, 8, p.hue + 40, p.chroma, 0.5);
  const em = embers(C, C - 2, 9, p.hue, p.chroma, level, 20, 28);
  return {
    defs: [...fl.defs, ...bl.defs, ...g.defs, star.def],
    body: [...fl.body, ...bl.body, ...g.body, star.node, ...em],
  };
};

const tier10: TierBuilder = (level, p, id) => {
  const hue0 = ((level - 91) / 10) * 360;
  const bl = bloom(id('bl'), C, C, 31.5, hue0 + 60, 0.12, 0.5, 0.86);
  const ry = lightRays(id('ry'), C, C, 12, 21, 31, 2.6, hue0, 30, 0.2, 0.5, 15);
  const gemId = id('g');
  const g = gem({
    id: gemId,
    cx: C,
    cy: C,
    r: p.radius,
    hue: hue0,
    hueSweep: 360,
    chroma: p.chroma,
    lightness: p.lightness,
    spread: p.spread,
    core: 0.9,
    tableHues: [hue0, hue0 + 60, hue0 + 120],
    animatedTable: true,
  });
  const star = innerStar(id('st'), p.radius * 0.38, 6, hue0 + 90, 0.1, 0.55);
  const sparkIds = Array.from({ length: 8 }, (_, i) => id(`sp${i}`));
  const sparks = sparkIds.map((sid, i) => {
    const [x, y] = polar(C, C, 26, i * 45 + 22.5);
    return sparkle(x, y, i % 2 === 0 ? 2.2 : 1.6, oklch(0.97, 0.12, hue0 + i * 45, 0.95), {
      id: sid,
    });
  });
  const [ts0, ts1, ts2] = gemTableStopIds(gemId);
  const style = animationStyle({
    prefix: id(''),
    hueCycle: {
      durationSec: 8,
      stops: [
        { id: ts0, lightness: p.lightness + 0.14, chroma: p.chroma * 0.8, hue: hue0 },
        { id: ts1, lightness: p.lightness - 0.02, chroma: p.chroma * 1.05, hue: hue0 + 60 },
        { id: ts2, lightness: p.lightness - 0.13, chroma: p.chroma * 1.1, hue: hue0 + 120 },
      ],
    },
    twinkle: { ids: sparkIds, durationSec: 2.4 },
  });
  return {
    defs: [...bl.defs, ...ry.defs, ...g.defs, star.def],
    body: [...bl.body, ...ry.body, ...g.body, star.node, ...sparks],
    style,
  };
};

export const TIER_BUILDERS: readonly TierBuilder[] = [
  tier1,
  tier2,
  tier3,
  tier4,
  tier5,
  tier6,
  tier7,
  tier8,
  tier9,
  tier10,
];
