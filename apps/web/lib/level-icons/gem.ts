/**
 * The volumetric glass gem — the primitive every tier is built from.
 *
 * A front-facing cut gem: an n-gon silhouette, a smaller n-gon "table" in the
 * middle, and n trapezoid "crown" facets joining them. Each crown facet is lit
 * by its outward angle against a fixed upper-left light (Lambert), the table
 * carries a light→dark gradient plus a bright caustic core, a shade overlay
 * deepens the lower-right, a specular streak sits on the lit side, and a
 * gradient rim-light traces the silhouette. Everything is OKLCH.
 */

import {
  facetLight,
  lerp,
  oklch,
  type Point,
  pointsAttr,
  polar,
  polygonVertices,
  ringFacets,
} from './geometry';
import { LIGHT_ANGLE } from './palette';
import { el, type SceneNode } from './serialize';

export interface GemOptions {
  /** Unique-within-scene id base (already carrying the scene prefix). */
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  /** Outer (silhouette) radius. */
  readonly r: number;
  readonly hue: number;
  readonly chroma: number;
  readonly lightness: number;
  /** Lightness spread between the lit and shadowed crown facets. */
  readonly spread: number;
  /** Silhouette sides (default 6). */
  readonly sides?: number;
  /** First-vertex angle (default -90 = pointy top). */
  readonly rotation?: number;
  /** Table radius as a fraction of `r` (default 0.5). */
  readonly tableRatio?: number;
  /** Accent hue for dispersion on alternating facets. */
  readonly hue2?: number;
  /** 0–1 how strongly alternating facets take on `hue2` (default 0). */
  readonly dispersion?: number;
  /**
   * Degrees of hue swept continuously across the crown facets (facet i gets
   * `hue + i / sides * hueSweep`). Overrides `dispersion` — used for prismatic gems.
   */
  readonly hueSweep?: number;
  /** 0–1 strength of the inner caustic glow (default 0.6). */
  readonly core?: number;
  /** 0–1 strength of the specular streak (default 1). */
  readonly specular?: number;
  /** Rim-light stroke width (default 1.1). */
  readonly rimWidth?: number;
  /** Draw the thin facet edge lines (default true). */
  readonly facetEdges?: boolean;
  /** Overall opacity of the gem group (default 1). */
  readonly opacity?: number;
  /**
   * Per-stop hues for the table gradient (top-left → bottom-right). Defaults to
   * `hue` for all three. Used for prismatic/rainbow tables.
   */
  readonly tableHues?: readonly [number, number, number];
  /** Give the three table-gradient stops ids (`${id}-ts0..2`) so CSS can animate them. */
  readonly animatedTable?: boolean;
}

/** Ids of the table-gradient stops when `animatedTable` is set. */
export function gemTableStopIds(id: string): readonly [string, string, string] {
  return [`${id}-ts0`, `${id}-ts1`, `${id}-ts2`];
}

export interface GemParts {
  readonly defs: readonly SceneNode[];
  readonly body: readonly SceneNode[];
}

/** Fill color of a crown facet at the given outward angle. */
export function facetColor(
  angle: number,
  hue: number,
  chroma: number,
  lightness: number,
  spread: number,
): string {
  const lt = facetLight(angle, LIGHT_ANGLE);
  // Lit facets go lighter and slightly desaturated (toward white), shadow facets
  // deeper and more saturated — the way real glass reads.
  return oklch(lightness + (lt - 0.5) * spread, chroma * (1.12 - 0.38 * lt), hue);
}

export function gem(o: GemOptions): GemParts {
  const sides = o.sides ?? 6;
  const rotation = o.rotation ?? -90;
  const tableRatio = o.tableRatio ?? 0.5;
  const dispersion = o.dispersion ?? 0;
  const core = o.core ?? 0.6;
  const specular = o.specular ?? 1;
  const rimWidth = o.rimWidth ?? 1.1;
  const facetEdges = o.facetEdges ?? true;
  const { cx, cy, r, hue, chroma: c, lightness: L, spread } = o;
  const hue2 = o.hue2 ?? hue;
  const innerR = r * tableRatio;

  const outer = polygonVertices(cx, cy, r, sides, rotation);
  const inner = polygonVertices(cx, cy, innerR, sides, rotation);
  const outerPts = pointsAttr(outer);
  const innerPts = pointsAttr(inner);

  const ids = {
    table: `${o.id}-tab`,
    core: `${o.id}-core`,
    shade: `${o.id}-shd`,
    rim: `${o.id}-rim`,
    spec: `${o.id}-spc`,
  };

  const [th0, th1, th2] = o.tableHues ?? [hue, hue, hue];
  const stopIds = o.animatedTable ? gemTableStopIds(o.id) : undefined;
  const stopId = (i: 0 | 1 | 2) => (stopIds ? { id: stopIds[i] } : {});

  const defs: SceneNode[] = [
    el('linearGradient', { id: ids.table, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, [
      el('stop', { ...stopId(0), offset: '0%', stopColor: oklch(L + 0.14, c * 0.8, th0) }),
      el('stop', { ...stopId(1), offset: '55%', stopColor: oklch(L - 0.02, c * 1.05, th1) }),
      el('stop', { ...stopId(2), offset: '100%', stopColor: oklch(L - 0.13, c * 1.1, th2) }),
    ]),
    el('radialGradient', { id: ids.core, cx: '44%', cy: '42%', r: '62%' }, [
      el('stop', { offset: '0%', stopColor: oklch(L + 0.34, c * 0.3, hue, 0.95 * core) }),
      el('stop', { offset: '42%', stopColor: oklch(L + 0.14, c * 0.85, hue, 0.4 * core) }),
      el('stop', { offset: '100%', stopColor: oklch(L + 0.1, c, hue, 0) }),
    ]),
    el('linearGradient', { id: ids.shade, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, [
      el('stop', { offset: '0%', stopColor: oklch(1, 0, hue, 0.18) }),
      el('stop', { offset: '40%', stopColor: oklch(1, 0, hue, 0) }),
      el('stop', { offset: '100%', stopColor: oklch(0.08, c * 0.2, hue, 0.5) }),
    ]),
    el('linearGradient', { id: ids.rim, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, [
      el('stop', { offset: '0%', stopColor: oklch(0.98, c * 0.15, hue, 0.95) }),
      el('stop', { offset: '50%', stopColor: oklch(L + 0.22, c * 0.6, hue, 0.5) }),
      el('stop', { offset: '100%', stopColor: oklch(L - 0.2, c * 0.6, hue, 0.55) }),
    ]),
    el('radialGradient', { id: ids.spec, cx: '50%', cy: '50%', r: '50%' }, [
      el('stop', { offset: '0%', stopColor: oklch(1, 0, hue, 0.9 * specular) }),
      el('stop', { offset: '55%', stopColor: oklch(1, 0, hue, 0.25 * specular) }),
      el('stop', { offset: '100%', stopColor: oklch(1, 0, hue, 0) }),
    ]),
  ];

  const facets = ringFacets(cx, cy, r, innerR, sides, rotation).map((facet, i) => {
    const facetHue =
      o.hueSweep !== undefined
        ? hue + (i / sides) * o.hueSweep
        : i % 2 === 1
          ? lerp(hue, hue2, dispersion)
          : hue;
    return el('polygon', {
      points: facet.points,
      fill: facetColor(facet.angle, facetHue, c, L, spread),
    });
  });

  const edgeColor = oklch(Math.min(1, L + 0.3), c * 0.4, hue, 0.38);
  const edges: SceneNode[] = facetEdges
    ? [
        ...outer.map((op, i) => {
          const ip = inner[i] as Point;
          return el('line', {
            x1: op[0],
            y1: op[1],
            x2: ip[0],
            y2: ip[1],
            stroke: edgeColor,
            strokeWidth: 0.35,
          });
        }),
        el('polygon', {
          points: innerPts,
          fill: 'none',
          stroke: oklch(Math.min(1, L + 0.28), c * 0.5, hue, 0.5),
          strokeWidth: 0.4,
        }),
      ]
    : [];

  // Specular streak on the lit side of the table.
  const [sx, sy] = polar(cx, cy, r * 0.4, -118);
  const spec =
    specular > 0
      ? [
          el('ellipse', {
            cx: sx,
            cy: sy,
            rx: r * 0.3,
            ry: r * 0.11,
            transform: `rotate(-38 ${sx} ${sy})`,
            fill: `url(#${ids.spec})`,
          }),
        ]
      : [];

  const coreNode =
    core > 0 ? [el('circle', { cx, cy, r: innerR * 0.98, fill: `url(#${ids.core})` })] : [];

  const groupAttrs = o.opacity !== undefined && o.opacity < 1 ? { opacity: o.opacity } : {};

  const body: SceneNode[] = [
    el('g', groupAttrs, [
      ...facets,
      el('polygon', { points: innerPts, fill: `url(#${ids.table})` }),
      ...coreNode,
      el('polygon', { points: outerPts, fill: `url(#${ids.shade})` }),
      ...edges,
      ...spec,
      el('polygon', {
        points: outerPts,
        fill: 'none',
        stroke: `url(#${ids.rim})`,
        strokeWidth: rimWidth,
        strokeLinejoin: 'round',
      }),
    ]),
  ];

  return { defs, body };
}
