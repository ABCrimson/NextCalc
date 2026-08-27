import { describe, expect, it } from 'vitest';
import { facetLight, oklch, polar, polygonPoints, ringFacets } from './geometry';

describe('polar', () => {
  it('converts polar coordinates (degrees, SVG y-down) to cartesian', () => {
    expect(polar(10, 10, 5, 0)).toEqual([15, 10]);
    const [x, y] = polar(0, 0, 1, 90);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });
});

describe('polygonPoints', () => {
  it('returns n vertices starting at the top (-90°) as an SVG points string', () => {
    const pts = polygonPoints(32, 32, 10, 6);
    const pairs = pts.split(' ').map((p) => p.split(',').map(Number));
    expect(pairs).toHaveLength(6);
    expect(pairs[0]?.[0]).toBeCloseTo(32);
    expect(pairs[0]?.[1]).toBeCloseTo(22);
  });
});

describe('oklch', () => {
  it('formats an oklch() color string, clamping lightness and chroma into gamut-safe ranges', () => {
    expect(oklch(0.5, 0.1, 30)).toBe('oklch(0.5 0.1 30)');
    expect(oklch(1.4, -1, 390)).toBe('oklch(1 0 30)');
  });
  it('appends alpha when provided', () => {
    expect(oklch(0.5, 0.1, 30, 0.25)).toBe('oklch(0.5 0.1 30 / 0.25)');
  });
  it('rounds to 3 decimals for lightness/chroma and 1 for hue', () => {
    expect(oklch(0.55555, 0.12345, 123.456)).toBe('oklch(0.556 0.123 123.5)');
  });
});

describe('facetLight', () => {
  it('is 1 for a facet facing the light and 0 for a facet facing away', () => {
    expect(facetLight(-120, -120)).toBeCloseTo(1);
    expect(facetLight(60, -120)).toBeCloseTo(0);
  });
  it('is 0.5 for a facet perpendicular to the light', () => {
    expect(facetLight(-30, -120)).toBeCloseTo(0.5);
  });
});

describe('ringFacets', () => {
  it('builds n trapezoid crown facets between an outer and inner regular polygon', () => {
    const facets = ringFacets(32, 32, 20, 10, 6);
    expect(facets).toHaveLength(6);
    for (const facet of facets) {
      expect(facet.points.split(' ')).toHaveLength(4);
      expect(facet.angle).toBeGreaterThanOrEqual(-90);
      expect(facet.angle).toBeLessThan(270);
    }
    // Facet centered at -60° (between the top and upper-right vertices).
    expect(facets[0]?.angle).toBeCloseTo(-60);
  });
});
