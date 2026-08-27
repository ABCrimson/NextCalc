/**
 * Geometry + OKLCH color helpers shared by every level-icon tier.
 *
 * Angles are in degrees, SVG convention (0° = +x, 90° = +y / down), so the
 * top of a shape is at -90°.
 */

const DEG = Math.PI / 180;

export type Point = readonly [x: number, y: number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function polar(cx: number, cy: number, r: number, deg: number): Point {
  return [cx + r * Math.cos(deg * DEG), cy + r * Math.sin(deg * DEG)];
}

function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

/** Serialize a point list as an SVG `points` attribute. */
export function pointsAttr(points: readonly Point[]): string {
  return points.map(([x, y]) => `${round2(x)},${round2(y)}`).join(' ');
}

/** Vertices of a regular n-gon, first vertex at `offsetDeg` (default: top). */
export function polygonVertices(
  cx: number,
  cy: number,
  r: number,
  n: number,
  offsetDeg = -90,
): Point[] {
  return Array.from({ length: n }, (_, i) => polar(cx, cy, r, offsetDeg + (i * 360) / n));
}

export function polygonPoints(
  cx: number,
  cy: number,
  r: number,
  n: number,
  offsetDeg = -90,
): string {
  return pointsAttr(polygonVertices(cx, cy, r, n, offsetDeg));
}

/** Star polygon alternating outer/inner radius. */
export function starPoints(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  n: number,
  offsetDeg = -90,
): string {
  const pts = Array.from({ length: n * 2 }, (_, i) =>
    polar(cx, cy, i % 2 === 0 ? outerR : innerR, offsetDeg + (i * 360) / (n * 2)),
  );
  return pointsAttr(pts);
}

/**
 * OKLCH color string. Lightness is clamped to [0,1], chroma to [0,0.37]
 * (the practical P3 ceiling), hue normalized to [0,360).
 */
export function oklch(l: number, c: number, h: number, alpha?: number): string {
  const L = Math.round(clamp(l, 0, 1) * 1000) / 1000;
  const C = Math.round(clamp(c, 0, 0.37) * 1000) / 1000;
  const H = Math.round((((h % 360) + 360) % 360) * 10) / 10;
  const base = `oklch(${L} ${C} ${H}`;
  if (alpha === undefined) return `${base})`;
  return `${base} / ${Math.round(clamp(alpha, 0, 1) * 1000) / 1000})`;
}

/**
 * Lambert-style facet brightness in [0,1]: 1 when the facet's outward
 * direction points at the light, 0 when it points directly away.
 */
export function facetLight(facetAngleDeg: number, lightAngleDeg: number): number {
  return 0.5 + 0.5 * Math.cos((facetAngleDeg - lightAngleDeg) * DEG);
}

export interface Facet {
  /** SVG points of the trapezoid. */
  readonly points: string;
  /** Outward direction of the facet (degrees, SVG convention). */
  readonly angle: number;
}

/**
 * The n "crown" facets of a front-facing gem: trapezoids joining the outer
 * silhouette polygon (radius `outerR`) to the table polygon (radius `innerR`).
 */
export function ringFacets(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  n: number,
  offsetDeg = -90,
): Facet[] {
  const outer = polygonVertices(cx, cy, outerR, n, offsetDeg);
  const inner = polygonVertices(cx, cy, innerR, n, offsetDeg);
  return Array.from({ length: n }, (_, i) => {
    const j = (i + 1) % n;
    const o1 = outer[i] as Point;
    const o2 = outer[j] as Point;
    const i2 = inner[j] as Point;
    const i1 = inner[i] as Point;
    const step = 360 / n;
    const angle = offsetDeg + i * step + step / 2;
    return { points: pointsAttr([o1, o2, i2, i1]), angle };
  });
}
