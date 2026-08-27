/**
 * Reusable effect builders layered around the gem: blooms, 3D orbit rings,
 * light orbs, sparkles, rays, crystal shards, crown spikes, plasma flames and
 * the CSS animation stylesheet (hue cycling / twinkle, reduced-motion aware).
 */

import { facetLight, oklch, pointsAttr, polar, starPoints } from './geometry';
import { CENTER, LIGHT_ANGLE } from './palette';
import { el, fmt, type SceneNode } from './serialize';

export interface Layered {
  readonly defs: readonly SceneNode[];
  readonly body: readonly SceneNode[];
}

/** Soft radial bloom (behind the gem). */
export function bloom(
  id: string,
  cx: number,
  cy: number,
  r: number,
  hue: number,
  chroma: number,
  alpha: number,
  lightness = 0.78,
): Layered {
  return {
    defs: [
      el('radialGradient', { id }, [
        el('stop', { offset: '0%', stopColor: oklch(lightness, chroma, hue, alpha) }),
        el('stop', { offset: '55%', stopColor: oklch(lightness, chroma, hue, alpha * 0.35) }),
        el('stop', { offset: '100%', stopColor: oklch(lightness, chroma, hue, 0) }),
      ]),
    ],
    body: [el('circle', { cx, cy, r, fill: `url(#${id})` })],
  };
}

/** Point on a tilted ellipse at parameter angle `tDeg` (0 = +x before tilt). */
export function ellipsePoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tiltDeg: number,
  tDeg: number,
): readonly [number, number] {
  const t = (tDeg * Math.PI) / 180;
  const p = (tiltDeg * Math.PI) / 180;
  const x = rx * Math.cos(t);
  const y = ry * Math.sin(t);
  return [cx + x * Math.cos(p) - y * Math.sin(p), cy + x * Math.sin(p) + y * Math.cos(p)];
}

/**
 * A tilted orbit ring drawn in two halves so the gem sits INSIDE it:
 * `back` goes behind the gem, `front` (the lower half) on top of it.
 */
export function orbitRing(
  id: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tiltDeg: number,
  hue: number,
  chroma: number,
  width: number,
): { readonly defs: readonly SceneNode[]; readonly back: SceneNode; readonly front: SceneNode } {
  const [sx, sy] = ellipsePoint(cx, cy, rx, ry, tiltDeg, 0);
  const [ex, ey] = ellipsePoint(cx, cy, rx, ry, tiltDeg, 180);
  const frontPath = `M ${fmt(sx)} ${fmt(sy)} A ${fmt(rx)} ${fmt(ry)} ${fmt(tiltDeg)} 0 1 ${fmt(ex)} ${fmt(ey)}`;
  const backPath = `M ${fmt(ex)} ${fmt(ey)} A ${fmt(rx)} ${fmt(ry)} ${fmt(tiltDeg)} 0 1 ${fmt(sx)} ${fmt(sy)}`;
  return {
    defs: [
      el('linearGradient', { id, x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.82, chroma * 0.7, hue, 0.35) }),
        el('stop', { offset: '50%', stopColor: oklch(0.95, chroma * 0.35, hue, 0.95) }),
        el('stop', { offset: '100%', stopColor: oklch(0.82, chroma * 0.7, hue, 0.35) }),
      ]),
    ],
    back: el('path', {
      d: backPath,
      fill: 'none',
      stroke: oklch(0.8, chroma * 0.6, hue, 0.3),
      strokeWidth: width * 0.8,
      strokeLinecap: 'round',
    }),
    front: el('path', {
      d: frontPath,
      fill: 'none',
      stroke: `url(#${id})`,
      strokeWidth: width,
      strokeLinecap: 'round',
    }),
  };
}

/** A glowing light orb (halo + hot core). */
export function orb(
  cx: number,
  cy: number,
  r: number,
  hue: number,
  chroma: number,
  alpha = 1,
): SceneNode {
  return el('g', {}, [
    el('circle', { cx, cy, r: r * 2.2, fill: oklch(0.8, chroma, hue, 0.22 * alpha) }),
    el('circle', { cx, cy, r, fill: oklch(0.9, chroma * 0.7, hue, 0.95 * alpha) }),
    el('circle', { cx, cy, r: r * 0.45, fill: oklch(1, 0, hue, 0.9 * alpha) }),
  ]);
}

/** Four-point sparkle (concave star). */
export function sparkle(
  cx: number,
  cy: number,
  r: number,
  color: string,
  attrs: Readonly<Record<string, string | number>> = {},
): SceneNode {
  return el('polygon', { points: starPoints(cx, cy, r, r * 0.28, 4), fill: color, ...attrs });
}

/**
 * Soft tapered light rays: thin triangles from `r1` (width `w`) to `r2` (point),
 * each fading out along its length via its own user-space gradient.
 */
export function lightRays(
  id: string,
  cx: number,
  cy: number,
  count: number,
  r1: number,
  r2: number,
  w: number,
  hue: number,
  hueStep: number,
  chroma: number,
  alpha: number,
  offsetDeg = 0,
): Layered {
  const defs: SceneNode[] = [];
  const body: SceneNode[] = [];
  for (let i = 0; i < count; i++) {
    const a = offsetDeg + (i * 360) / count;
    const h = hue + i * hueStep;
    const [bx, by] = polar(cx, cy, r1, a);
    const [tx, ty] = polar(cx, cy, r2, a);
    const [lx, ly] = polar(bx, by, w / 2, a - 90);
    const [rx, ry] = polar(bx, by, w / 2, a + 90);
    const gid = `${id}-${i}`;
    defs.push(
      el(
        'linearGradient',
        { id: gid, gradientUnits: 'userSpaceOnUse', x1: bx, y1: by, x2: tx, y2: ty },
        [
          el('stop', { offset: '0%', stopColor: oklch(0.84, chroma * 1.25, h, alpha) }),
          el('stop', { offset: '100%', stopColor: oklch(0.84, chroma * 1.25, h, 0) }),
        ],
      ),
    );
    body.push(
      el('polygon', {
        points: pointsAttr([
          [lx, ly],
          [tx, ty],
          [rx, ry],
        ]),
        fill: `url(#${gid})`,
      }),
    );
  }
  return { defs, body };
}

/** A small elongated crystal shard (two lit faces + ridge + rim). */
export function shard(
  cx: number,
  cy: number,
  len: number,
  wid: number,
  rotDeg: number,
  hue: number,
  chroma: number,
  lightness: number,
  opacity = 1,
): SceneNode {
  const tip = polar(cx, cy, len, rotDeg - 90);
  const tail = polar(cx, cy, len * 0.8, rotDeg + 90);
  const left = polar(cx, cy, wid, rotDeg + 180);
  const right = polar(cx, cy, wid, rotDeg);
  const ltL = facetLight(rotDeg + 180, LIGHT_ANGLE);
  const ltR = facetLight(rotDeg, LIGHT_ANGLE);
  const attrs = opacity < 1 ? { opacity } : {};
  return el('g', attrs, [
    el('polygon', {
      points: pointsAttr([tip, left, tail]),
      fill: oklch(lightness + (ltL - 0.5) * 0.3, chroma * (1.1 - 0.35 * ltL), hue),
    }),
    el('polygon', {
      points: pointsAttr([tip, right, tail]),
      fill: oklch(lightness + (ltR - 0.5) * 0.3, chroma * (1.1 - 0.35 * ltR), hue),
    }),
    el('line', {
      x1: tip[0],
      y1: tip[1],
      x2: tail[0],
      y2: tail[1],
      stroke: oklch(0.96, chroma * 0.2, hue, 0.55),
      strokeWidth: 0.35,
    }),
    el('polygon', {
      points: pointsAttr([tip, right, tail, left]),
      fill: 'none',
      stroke: oklch(0.92, chroma * 0.3, hue, 0.6),
      strokeWidth: 0.5,
      strokeLinejoin: 'round',
    }),
  ]);
}

/** Faceted crown spikes on every vertex of the gem silhouette. */
export function spikes(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  len: number,
  hue: number,
  hueStep: number,
  chroma: number,
  lightness: number,
  rotation = -90,
): SceneNode[] {
  const halfBase = 360 / sides / 4;
  return Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i * 360) / sides;
    const h = hue + i * hueStep;
    const tip = polar(cx, cy, r + len, a);
    const base = polar(cx, cy, r * 0.84, a);
    const bl = polar(cx, cy, r * 0.98, a - halfBase);
    const br = polar(cx, cy, r * 0.98, a + halfBase);
    const ltL = facetLight(a - 45, LIGHT_ANGLE);
    const ltR = facetLight(a + 45, LIGHT_ANGLE);
    return el('g', {}, [
      el('polygon', {
        points: pointsAttr([tip, bl, base]),
        fill: oklch(lightness + (ltL - 0.5) * 0.32, chroma, h),
      }),
      el('polygon', {
        points: pointsAttr([tip, base, br]),
        fill: oklch(lightness + (ltR - 0.5) * 0.32, chroma, h),
      }),
      el('polygon', {
        points: pointsAttr([tip, bl, base, br]),
        fill: 'none',
        stroke: oklch(0.95, chroma * 0.25, h, 0.6),
        strokeWidth: 0.45,
        strokeLinejoin: 'round',
      }),
    ]);
  });
}

/** Plasma flames rising behind the gem (T9 / Phoenix). Deterministic per seed. */
export function flames(
  id: string,
  cx: number,
  baseY: number,
  hue: number,
  chroma: number,
  seed: number,
  count = 5,
  scale = 1,
): Layered {
  const defs: SceneNode[] = [];
  const body: SceneNode[] = [];
  for (let i = 0; i < count; i++) {
    const k = (i + seed * 0.37) % count;
    const spreadX = (i - (count - 1) / 2) * 5.4 * scale;
    const h = (19 + ((k * 7.3 + seed * 1.7) % 9)) * scale;
    const w = (5.5 + ((k * 3.1) % 3)) * scale;
    const lean = ((k * 2.9 + seed) % 5) - 2.5;
    const bx = cx + spreadX;
    const tipX = bx + lean;
    const tipY = baseY - h;
    const gid = `${id}-${i}`;
    const hueTop = hue + 34;
    defs.push(
      el('linearGradient', { id: gid, x1: '0%', y1: '100%', x2: '0%', y2: '0%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.62, chroma, hue, 0.1) }),
        el('stop', { offset: '45%', stopColor: oklch(0.72, chroma, hue + 14, 0.5) }),
        el('stop', { offset: '100%', stopColor: oklch(0.9, chroma * 0.75, hueTop, 0.85) }),
      ]),
    );
    const tongue = (cxF: number, wF: number, hF: number, tx: number, ty: number) =>
      [
        `M ${fmt(cxF - wF)} ${fmt(baseY)}`,
        `C ${fmt(cxF - wF * 1.2)} ${fmt(baseY - hF * 0.5)} ${fmt(tx - wF * 0.18)} ${fmt(ty + hF * 0.16)} ${fmt(tx)} ${fmt(ty)}`,
        `C ${fmt(tx + wF * 0.18)} ${fmt(ty + hF * 0.16)} ${fmt(cxF + wF * 1.2)} ${fmt(baseY - hF * 0.5)} ${fmt(cxF + wF)} ${fmt(baseY)}`,
        'Z',
      ].join(' ');
    body.push(el('path', { d: tongue(bx, w, h, tipX, tipY), fill: `url(#${gid})` }));
    // Inner, hotter tongue for depth.
    const innerH = h * 0.62;
    body.push(
      el('path', {
        d: tongue(bx, w * 0.5, innerH, bx + lean * 0.6, baseY - innerH),
        fill: oklch(0.92, chroma * 0.7, hueTop + 10, 0.55),
      }),
    );
  }
  return { defs, body };
}

/** Rising ember particles. Deterministic per seed. */
export function embers(
  cx: number,
  cy: number,
  count: number,
  hue: number,
  chroma: number,
  seed: number,
  spreadX = 22,
  height = 26,
  extra: (i: number) => Readonly<Record<string, string | number>> = () => ({}),
): SceneNode[] {
  return Array.from({ length: count }, (_, i) => {
    const u = ((i * 7.31 + seed * 3.7) % 10) / 10;
    const v = ((i * 4.17 + seed * 1.3) % 10) / 10;
    const r = 0.55 + ((i * 3) % 4) * 0.22;
    // Keep every ember inside the 40px circle-crop safe radius (31 from the 64-box centre).
    let x = cx + (u - 0.5) * spreadX * 2;
    let y = cy - v * height;
    const d = Math.hypot(x - CENTER, y - CENTER);
    const maxD = 30.9 - r;
    if (d > maxD) {
      x = CENTER + ((x - CENTER) * maxD) / d;
      y = CENTER + ((y - CENTER) * maxD) / d;
    }
    return el('circle', {
      cx: x,
      cy: y,
      r,
      fill: oklch(0.9, chroma * 0.8, hue + v * 30, 0.55 + v * 0.4),
      ...extra(i),
    });
  });
}

export interface HueCycleStop {
  /** Element id (already prefixed) whose `stop-color` cycles. */
  readonly id: string;
  readonly lightness: number;
  readonly chroma: number;
  /** Starting hue; the animation sweeps +360° from here. */
  readonly hue: number;
}

export interface AnimationSpec {
  /** Unique prefix for keyframe names. */
  readonly prefix: string;
  readonly hueCycle?: { readonly stops: readonly HueCycleStop[]; readonly durationSec: number };
  readonly twinkle?: { readonly ids: readonly string[]; readonly durationSec: number };
}

/**
 * CSS animations inside the SVG (work in `<img>` and inline alike) instead of
 * SMIL, so `prefers-reduced-motion` can switch them off.
 */
export function animationStyle(spec: AnimationSpec): SceneNode {
  const rules: string[] = [];
  const animatedIds: string[] = [];
  const cycle = spec.hueCycle;
  if (cycle) {
    cycle.stops.forEach((stop, i) => {
      const name = `${spec.prefix}hue${i}`;
      const frames = Array.from({ length: 7 }, (_, k) => {
        const pct = Math.round((k / 6) * 1000) / 10;
        return `${pct}%{stop-color:${oklch(stop.lightness, stop.chroma, stop.hue + k * 60)}}`;
      }).join('');
      rules.push(`@keyframes ${name}{${frames}}`);
      rules.push(`#${stop.id}{animation:${name} ${cycle.durationSec}s linear infinite}`);
      animatedIds.push(`#${stop.id}`);
    });
  }
  const twinkle = spec.twinkle;
  if (twinkle) {
    const name = `${spec.prefix}tw`;
    rules.push(`@keyframes ${name}{0%,100%{opacity:.25}50%{opacity:1}}`);
    twinkle.ids.forEach((id, i) => {
      const delay = -((i * 0.37) % twinkle.durationSec);
      rules.push(
        `#${id}{animation:${name} ${twinkle.durationSec}s ease-in-out ${fmt(delay)}s infinite}`,
      );
      animatedIds.push(`#${id}`);
    });
  }
  if (animatedIds.length > 0) {
    rules.push(`@media (prefers-reduced-motion:reduce){${animatedIds.join(',')}{animation:none}}`);
  }
  return el('style', {}, rules.join(''));
}
