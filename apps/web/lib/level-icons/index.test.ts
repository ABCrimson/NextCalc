import { describe, expect, it } from 'vitest';
import {
  buildLevelIconScene,
  ICON_SIZE,
  LEVEL_101_VARIANTS,
  LEVEL_ICON_FILES,
  levelIconSvg,
} from './index';
import type { SceneNode } from './serialize';

function walk(node: SceneNode, visit: (n: SceneNode) => void): void {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

function collectIds(root: SceneNode): string[] {
  const ids: string[] = [];
  walk(root, (n) => {
    const id = n.attrs['id'];
    if (typeof id === 'string') ids.push(id);
  });
  return ids;
}

const ALL_LEVELS = Array.from({ length: 101 }, (_, i) => i + 1);

describe('buildLevelIconScene', () => {
  it('renders a 64×64 root <svg> for every level 1–101', () => {
    for (const level of ALL_LEVELS) {
      const scene = buildLevelIconScene(level);
      expect(scene.tag).toBe('svg');
      expect(scene.attrs['viewBox']).toBe(`0 0 ${ICON_SIZE} ${ICON_SIZE}`);
      expect(scene.attrs['xmlns']).toBe('http://www.w3.org/2000/svg');
    }
  });

  it('never emits NaN, Infinity, or undefined-valued numeric attributes', () => {
    for (const level of ALL_LEVELS) {
      walk(buildLevelIconScene(level), (n) => {
        for (const [key, value] of Object.entries(n.attrs)) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value), `${key} on <${n.tag}> at level ${level}`).toBe(true);
          } else if (typeof value === 'string') {
            expect(value, `${key} on <${n.tag}> at level ${level}`).not.toMatch(
              /NaN|Infinity|undefined/,
            );
          }
        }
      });
    }
  });

  it('prefixes every id with the given idPrefix and keeps ids unique within a scene', () => {
    for (const level of [1, 17, 42, 66, 83, 95, 101]) {
      const ids = collectIds(buildLevelIconScene(level, { idPrefix: `li${level}-` }));
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(id.startsWith(`li${level}-`)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('references only ids that are defined in the same scene (no dangling url(#…))', () => {
    for (const level of ALL_LEVELS) {
      const scene = buildLevelIconScene(level, { idPrefix: 'p-' });
      const defined = new Set(collectIds(scene));
      walk(scene, (n) => {
        for (const value of Object.values(n.attrs)) {
          if (typeof value !== 'string') continue;
          for (const match of value.matchAll(/url\(#([^)]+)\)/g)) {
            expect(defined.has(match[1] ?? ''), `dangling ${match[0]} at level ${level}`).toBe(
              true,
            );
          }
        }
      });
    }
  });

  it('differs between consecutive levels (every level is a distinct icon)', () => {
    for (let level = 1; level < 101; level++) {
      expect(levelIconSvg(level)).not.toBe(levelIconSvg(level + 1));
    }
  });

  it('clamps out-of-range levels into 1–101', () => {
    expect(levelIconSvg(0)).toBe(levelIconSvg(1));
    expect(levelIconSvg(-5)).toBe(levelIconSvg(1));
    expect(levelIconSvg(500)).toBe(levelIconSvg(101));
  });

  it('renders the three distinct level-101 variants', () => {
    const svgs = LEVEL_101_VARIANTS.map((v) => levelIconSvg(101, { variant101: v }));
    expect(new Set(svgs).size).toBe(3);
  });

  it('uses CSS animation (not SMIL) so prefers-reduced-motion can disable it, only on animated tiers', () => {
    const animated = levelIconSvg(95);
    expect(animated).toContain('@keyframes');
    expect(animated).toContain('prefers-reduced-motion');
    expect(animated).not.toContain('<animate');
    expect(levelIconSvg(5)).not.toContain('@keyframes');
  });
});

describe('levelIconSvg', () => {
  it('returns standalone SVG markup', () => {
    const svg = levelIconSvg(42);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('uses oklch() colors exclusively (no hex / rgb / hsl literals)', () => {
    for (const level of ALL_LEVELS) {
      const svg = levelIconSvg(level);
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^"]*\))/); // no hex colors (url(#id) refs excluded)
      expect(svg).not.toMatch(/\b(rgb|hsl)a?\(/);
      expect(svg).toContain('oklch(');
    }
  });
});

describe('LEVEL_ICON_FILES', () => {
  it('lists the 103 runtime avatar files with their exact public paths', () => {
    expect(LEVEL_ICON_FILES).toHaveLength(103);
    expect(LEVEL_ICON_FILES[0]).toEqual({ file: 'level-001.svg', level: 1, variant101: undefined });
    expect(LEVEL_ICON_FILES[99]).toEqual({
      file: 'level-100.svg',
      level: 100,
      variant101: undefined,
    });
    expect(LEVEL_ICON_FILES.slice(100).map((f) => f.file)).toEqual([
      'level-101.svg',
      'level-101-cosmic-nexus.svg',
      'level-101-phoenix-crystal.svg',
    ]);
  });
});
