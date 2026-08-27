/**
 * NextCalc Pro favicon concepts — five alternatives, one renderer.
 *
 * Every concept is a 512×512 scene on the brand squircle (superellipse), in
 * OKLCH only, built with the same scene/serializer as the level icons (the
 * "Prism Core" concept literally reuses the volumetric gem primitive). The
 * chosen concept becomes `public/icon.svg` and is rasterized (by Chromium, the
 * only renderer that speaks OKLCH) into the ICO/PNG/apple/maskable suite by
 * `scripts/generate-favicons.ts`.
 */

import { bloom, sparkle } from '../level-icons/effects';
import { gem } from '../level-icons/gem';
import { oklch, polygonPoints, starPoints } from '../level-icons/geometry';
import { el, fmt, type SceneNode, serializeSvg } from '../level-icons/serialize';

export const FAVICON_SIZE = 512;
const S = FAVICON_SIZE;
const C = S / 2;

export const FAVICON_IDS = [
  'prism-core',
  'sigma-pulse',
  'n-cut',
  'operator-spark',
  'equals-portal',
] as const;
export type FaviconId = (typeof FAVICON_IDS)[number];

export interface FaviconConcept {
  readonly id: FaviconId;
  readonly name: string;
  readonly tagline: string;
  /** Brand hue used for `theme-color` / manifest colors. */
  readonly themeHue: number;
}

export const FAVICON_CONCEPTS: readonly FaviconConcept[] = [
  {
    id: 'prism-core',
    name: 'Prism Core',
    tagline: 'The volumetric crystal from the level system, lit from within — brand continuity.',
    themeHue: 266,
  },
  {
    id: 'sigma-pulse',
    name: 'Sigma Pulse',
    tagline: 'A ∑ drawn in light over an aurora field, with a live pulse at its vertex.',
    themeHue: 230,
  },
  {
    id: 'n-cut',
    name: 'N-Cut',
    tagline: 'A monolithic N whose diagonal is an equals sign — the monogram as an equation.',
    themeHue: 290,
  },
  {
    id: 'operator-spark',
    name: 'Operator Spark',
    tagline: 'Plus and times fused into a spark, orbited by a gold ring — calculation as light.',
    themeHue: 280,
  },
  {
    id: 'equals-portal',
    name: 'Equals Portal',
    tagline: 'Two glass slabs in perspective, light leaking between them — the result bar.',
    themeHue: 250,
  },
];

export function isFaviconId(value: string): value is FaviconId {
  return (FAVICON_IDS as readonly string[]).includes(value);
}

export function faviconFileName(id: string): string {
  const index = (FAVICON_IDS as readonly string[]).indexOf(id);
  return `favicon-${index + 1}-${id}.svg`;
}

export interface FaviconOptions {
  /** Square, unmasked rendering (apple-touch-icon / maskable PNGs). */
  readonly fullBleed?: boolean;
  readonly idPrefix?: string;
}

interface Layered {
  readonly defs: readonly SceneNode[];
  readonly body: readonly SceneNode[];
}

/** Superellipse (|x|^n + |y|^n = 1) — the iOS-style squircle. */
export function squirclePath(cx: number, cy: number, r: number, n = 4.6, steps = 128): string {
  const e = 2 / n;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const x = cx + r * Math.sign(ct) * Math.abs(ct) ** e;
    const y = cy + r * Math.sign(st) * Math.abs(st) ** e;
    pts.push(`${i === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`);
  }
  return `${pts.join(' ')} Z`;
}

function glowFilter(id: string, blur: number): SceneNode {
  return el('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, [
    el('feGaussianBlur', { stdDeviation: blur }),
  ]);
}

// ─── Concepts ──────────────────────────────────────────────────────────────

function prismCore(p: string): Layered {
  const bl = bloom(`${p}bl`, C, C - 10, 232, 270, 0.2, 0.5, 0.7);
  const g = gem({
    id: `${p}g`,
    cx: 32,
    cy: 31,
    r: 20,
    hue: 266,
    hue2: 302,
    dispersion: 0.55,
    chroma: 0.22,
    lightness: 0.6,
    spread: 0.34,
    core: 1,
    specular: 1,
    rimWidth: 1.1,
  });
  const haloPts = polygonPoints(C, C - 8, 168, 6); // hexagonal halo behind the gem
  return {
    defs: [
      el('radialGradient', { id: `${p}a1`, cx: '12%', cy: '10%', r: '70%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.5, 0.2, 310, 0.45) }),
        el('stop', { offset: '100%', stopColor: oklch(0.5, 0.2, 310, 0) }),
      ]),
      el('radialGradient', { id: `${p}a2`, cx: '90%', cy: '92%', r: '70%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.55, 0.16, 215, 0.4) }),
        el('stop', { offset: '100%', stopColor: oklch(0.55, 0.16, 215, 0) }),
      ]),
      ...bl.defs,
      glowFilter(`${p}glow`, 18),
      ...g.defs,
    ],
    body: [
      el('rect', { x: 0, y: 0, width: S, height: S, fill: `url(#${p}a1)` }),
      el('rect', { x: 0, y: 0, width: S, height: S, fill: `url(#${p}a2)` }),
      ...bl.body,
      el('polygon', {
        points: haloPts,
        fill: oklch(0.7, 0.2, 272, 0.55),
        filter: `url(#${p}glow)`,
      }),
      el('g', { transform: 'scale(8)' }, g.body),
      el('polygon', { points: starPoints(C, C - 8, 44, 19, 6), fill: oklch(1, 0.01, 270, 0.72) }),
      // Both sparkles stay inside the maskable safe zone (r ≤ 204.8 from centre).
      sparkle(382, 130, 15, oklch(1, 0, 0, 0.95)),
      sparkle(120, 330, 11, oklch(1, 0, 0, 0.8)),
    ],
  };
}

function sigmaPulse(p: string): Layered {
  const stroke = `${p}sg`;
  const sigma = 'M 354 128 L 166 128 L 272 256 L 166 384 L 354 384';
  return {
    defs: [
      el('radialGradient', { id: `${p}a1`, cx: '18%', cy: '14%', r: '72%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.55, 0.22, 300, 0.6) }),
        el('stop', { offset: '100%', stopColor: oklch(0.55, 0.22, 300, 0) }),
      ]),
      el('radialGradient', { id: `${p}a2`, cx: '86%', cy: '90%', r: '72%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.62, 0.17, 205, 0.55) }),
        el('stop', { offset: '100%', stopColor: oklch(0.62, 0.17, 205, 0) }),
      ]),
      el('linearGradient', { id: stroke, x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.97, 0.03, 200) }),
        el('stop', { offset: '55%', stopColor: oklch(0.86, 0.12, 230) }),
        el('stop', { offset: '100%', stopColor: oklch(0.78, 0.18, 300) }),
      ]),
      glowFilter(`${p}glow`, 16),
      glowFilter(`${p}glow2`, 8),
    ],
    body: [
      el('rect', { x: 0, y: 0, width: S, height: S, fill: `url(#${p}a1)` }),
      el('rect', { x: 0, y: 0, width: S, height: S, fill: `url(#${p}a2)` }),
      el('path', {
        d: sigma,
        fill: 'none',
        stroke: oklch(0.78, 0.18, 215, 0.75),
        strokeWidth: 58,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter: `url(#${p}glow)`,
      }),
      el('path', {
        d: sigma,
        fill: 'none',
        stroke: `url(#${stroke})`,
        strokeWidth: 54,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      el('circle', {
        cx: 272,
        cy: 256,
        r: 40,
        fill: 'none',
        stroke: oklch(0.95, 0.08, 200, 0.55),
        strokeWidth: 6,
        filter: `url(#${p}glow2)`,
      }),
      el('circle', { cx: 272, cy: 256, r: 23, fill: oklch(1, 0, 0) }),
    ],
  };
}

function nCut(p: string): Layered {
  const grad = `${p}ng`;
  const clip = `${p}nc`;
  const bars = [
    el('rect', { x: 126, y: 116, width: 92, height: 280, rx: 8 }),
    el('rect', { x: 294, y: 116, width: 92, height: 280, rx: 8 }),
  ];
  // The diagonal is an "=" — two parallel bands, clipped flush to the verticals.
  const diagonal = (offset: number) =>
    el('line', {
      x1: 172 - offset * 0.733,
      y1: 116 + offset * 0.681,
      x2: 340 - offset * 0.733,
      y2: 396 + offset * 0.681,
      strokeWidth: 40,
      strokeLinecap: 'butt',
    });
  const nShape = (attrs: Readonly<Record<string, string | number>>) =>
    el('g', attrs, [
      ...bars,
      el('g', { clipPath: `url(#${clip})`, stroke: attrs['fill'] ?? 'currentColor' }, [
        diagonal(-29),
        diagonal(29),
      ]),
    ]);
  return {
    defs: [
      el('linearGradient', { id: grad, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.74, 0.19, 250) }),
        el('stop', { offset: '55%', stopColor: oklch(0.64, 0.26, 296) }),
        el('stop', { offset: '100%', stopColor: oklch(0.7, 0.25, 338) }),
      ]),
      el('clipPath', { id: clip }, [el('rect', { x: 126, y: 116, width: 260, height: 280 })]),
      glowFilter(`${p}glow`, 20),
    ],
    body: [
      nShape({ fill: oklch(0.62, 0.26, 295, 0.6), filter: `url(#${p}glow)` }),
      nShape({ fill: `url(#${grad})` }),
      el('rect', {
        x: 126,
        y: 116,
        width: 92,
        height: 4,
        rx: 2,
        fill: oklch(1, 0, 0, 0.35),
      }),
      el('rect', {
        x: 294,
        y: 116,
        width: 92,
        height: 4,
        rx: 2,
        fill: oklch(1, 0, 0, 0.35),
      }),
    ],
  };
}

function operatorSpark(p: string): Layered {
  const grad = `${p}sp`;
  return {
    defs: [
      el('radialGradient', { id: grad, cx: '50%', cy: '50%', r: '50%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.99, 0.02, 280) }),
        el('stop', { offset: '38%', stopColor: oklch(0.84, 0.15, 278) }),
        el('stop', { offset: '100%', stopColor: oklch(0.6, 0.25, 288) }),
      ]),
      glowFilter(`${p}glow`, 16),
      glowFilter(`${p}glow2`, 7),
    ],
    body: [
      el('circle', {
        cx: C,
        cy: C,
        r: 132,
        fill: 'none',
        stroke: oklch(0.84, 0.14, 85, 0.85),
        strokeWidth: 11,
        filter: `url(#${p}glow2)`,
      }),
      el('polygon', {
        points: starPoints(C, C, 110, 24, 4, -45),
        fill: oklch(0.86, 0.13, 85, 0.9),
      }),
      el('polygon', {
        points: starPoints(C, C, 184, 50, 4),
        fill: oklch(0.72, 0.22, 282, 0.7),
        filter: `url(#${p}glow)`,
      }),
      el('polygon', { points: starPoints(C, C, 184, 50, 4), fill: `url(#${grad})` }),
      el('circle', { cx: C, cy: C, r: 46, fill: oklch(0.92, 0.06, 280, 0.45) }),
      el('circle', { cx: C, cy: C, r: 24, fill: oklch(1, 0, 0) }),
    ],
  };
}

function equalsPortal(p: string): Layered {
  const grad = `${p}eq`;
  const persp = `translate(${C} ${C}) skewX(-14) translate(${-C} ${-C})`;
  const slab = (y: number, attrs: Readonly<Record<string, string | number>>) =>
    el('rect', { x: 118, y, width: 276, height: 70, rx: 18, ...attrs });
  return {
    defs: [
      el('linearGradient', { id: grad, x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, [
        el('stop', { offset: '0%', stopColor: oklch(0.96, 0.04, 200) }),
        el('stop', { offset: '50%', stopColor: oklch(0.76, 0.19, 265) }),
        el('stop', { offset: '100%', stopColor: oklch(0.7, 0.24, 322) }),
      ]),
      glowFilter(`${p}glow`, 18),
      glowFilter(`${p}leak`, 22),
    ],
    body: [
      el('ellipse', {
        cx: C,
        cy: C,
        rx: 210,
        ry: 26,
        fill: oklch(0.88, 0.13, 235, 0.85),
        filter: `url(#${p}leak)`,
      }),
      el('rect', {
        x: 40,
        y: C - 2,
        width: S - 80,
        height: 4,
        rx: 2,
        fill: oklch(0.98, 0.03, 220, 0.7),
        filter: `url(#${p}glow)`,
      }),
      el('g', { transform: persp }, [
        slab(166, { fill: oklch(0.75, 0.2, 270, 0.6), filter: `url(#${p}glow)` }),
        slab(276, { fill: oklch(0.75, 0.2, 270, 0.6), filter: `url(#${p}glow)` }),
        slab(166, { fill: `url(#${grad})` }),
        slab(276, { fill: `url(#${grad})` }),
        el('rect', { x: 134, y: 170, width: 244, height: 5, rx: 2.5, fill: oklch(1, 0, 0, 0.45) }),
        el('rect', { x: 134, y: 280, width: 244, height: 5, rx: 2.5, fill: oklch(1, 0, 0, 0.45) }),
      ]),
    ],
  };
}

const BUILDERS: Record<FaviconId, (p: string) => Layered> = {
  'prism-core': prismCore,
  'sigma-pulse': sigmaPulse,
  'n-cut': nCut,
  'operator-spark': operatorSpark,
  'equals-portal': equalsPortal,
};

// ─── Frame + public API ────────────────────────────────────────────────────

export function buildFaviconScene(id: FaviconId, options: FaviconOptions = {}): SceneNode {
  const p = options.idPrefix ?? '';
  const fullBleed = options.fullBleed ?? false;
  const concept = BUILDERS[id](p);
  const bgId = `${p}bg`;
  const vigId = `${p}vig`;
  const clipId = `${p}clip`;
  const squircle = squirclePath(C, C, C);

  const style = el(
    'style',
    {},
    `.ring{stroke:oklch(1 0 0 / 0.14)}@media (prefers-color-scheme: light){.ring{stroke:oklch(0 0 0 / 0.16)}}`,
  );
  const defs = el('defs', {}, [
    el('linearGradient', { id: bgId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, [
      el('stop', { offset: '0%', stopColor: oklch(0.23, 0.035, 272) }),
      el('stop', { offset: '100%', stopColor: oklch(0.12, 0.02, 262) }),
    ]),
    el('radialGradient', { id: vigId, cx: '50%', cy: '42%', r: '62%' }, [
      el('stop', { offset: '0%', stopColor: oklch(0.32, 0.06, 270, 0.55) }),
      el('stop', { offset: '100%', stopColor: oklch(0.32, 0.06, 270, 0) }),
    ]),
    el('clipPath', { id: clipId }, [
      fullBleed ? el('rect', { x: 0, y: 0, width: S, height: S }) : el('path', { d: squircle }),
    ]),
    ...concept.defs,
  ]);

  const children: SceneNode[] = [
    style,
    defs,
    el('g', { clipPath: `url(#${clipId})` }, [
      el('rect', { x: 0, y: 0, width: S, height: S, fill: `url(#${bgId})` }),
      el('rect', { x: 0, y: 0, width: S, height: S, fill: `url(#${vigId})` }),
      ...concept.body,
    ]),
  ];
  if (!fullBleed) {
    // Inner top-edge highlight + adaptive outer ring (see <style>).
    children.push(
      el('path', {
        d: squircle,
        fill: 'none',
        stroke: oklch(1, 0, 0, 0.07),
        strokeWidth: 10,
        clipPath: `url(#${clipId})`,
      }),
      el('path', { d: squircle, fill: 'none', class: 'ring', strokeWidth: 6 }),
    );
  }
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: S,
      height: S,
      viewBox: `0 0 ${S} ${S}`,
    },
    children,
  );
}

export function faviconSvg(id: FaviconId, options: FaviconOptions = {}): string {
  return serializeSvg(buildFaviconScene(id, options));
}
