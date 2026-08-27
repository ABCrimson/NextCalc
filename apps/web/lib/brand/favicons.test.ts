import { describe, expect, it } from 'vitest';
import {
  buildFaviconScene,
  FAVICON_CONCEPTS,
  FAVICON_SIZE,
  faviconFileName,
  faviconSvg,
} from './favicons';

describe('favicon concepts', () => {
  it('defines exactly five named concepts', () => {
    expect(FAVICON_CONCEPTS).toHaveLength(5);
    expect(new Set(FAVICON_CONCEPTS.map((c) => c.id)).size).toBe(5);
    for (const c of FAVICON_CONCEPTS) {
      expect(c.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.tagline.length).toBeGreaterThan(10);
    }
  });

  it('renders a 512×512 standalone SVG for every concept', () => {
    for (const c of FAVICON_CONCEPTS) {
      const svg = faviconSvg(c.id);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).toContain(`viewBox="0 0 ${FAVICON_SIZE} ${FAVICON_SIZE}"`);
      expect(svg.endsWith('</svg>')).toBe(true);
    }
  });

  it('uses OKLCH colors exclusively', () => {
    for (const c of FAVICON_CONCEPTS) {
      const svg = faviconSvg(c.id);
      expect(svg).toContain('oklch(');
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^"]*\))/);
      expect(svg).not.toMatch(/\b(rgb|hsl)a?\(/);
    }
  });

  it('adapts to the light color scheme via an embedded media query', () => {
    for (const c of FAVICON_CONCEPTS) {
      expect(faviconSvg(c.id)).toContain('prefers-color-scheme: light');
    }
  });

  it('keeps ids unique and every url(#…) reference resolvable', () => {
    for (const c of FAVICON_CONCEPTS) {
      const svg = faviconSvg(c.id);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(m[1]);
    }
  });

  it('can render full-bleed (square, no rounded mask) for apple-touch / maskable rasters', () => {
    for (const c of FAVICON_CONCEPTS) {
      const masked = faviconSvg(c.id);
      const bleed = faviconSvg(c.id, { fullBleed: true });
      expect(bleed).not.toBe(masked);
      expect(bleed).toContain(`<rect x="0" y="0" width="${FAVICON_SIZE}" height="${FAVICON_SIZE}"`);
    }
  });

  it('exposes the concept scene as a node tree', () => {
    const scene = buildFaviconScene('prism-core');
    expect(scene.tag).toBe('svg');
    expect(scene.children.length).toBeGreaterThan(1);
  });

  it('names files by concept index and id', () => {
    expect(faviconFileName(FAVICON_CONCEPTS[0]?.id ?? '')).toBe('favicon-1-prism-core.svg');
  });
});
