import { describe, expect, it } from 'vitest';
import { buildLevelIconScene, LEVEL_101_VARIANTS, levelIconFileName, levelIconSvg } from './index';
import { CENTER, tierIndex, tierProgress } from './palette';
import type { SceneNode } from './serialize';
import { TIER_BUILDERS } from './tiers';

const REPRESENTATIVE_LEVELS = [1, 11, 21, 31, 41, 51, 61, 71, 81, 91];

function walk(node: SceneNode, visit: (n: SceneNode) => void): void {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

/** Multiset of tags in a scene — a cheap structural fingerprint of the composition. */
function fingerprint(level: number, variant101?: (typeof LEVEL_101_VARIANTS)[number]): string {
  const counts = new Map<string, number>();
  walk(buildLevelIconScene(level, variant101 ? { variant101 } : {}), (n) => {
    counts.set(n.tag, (counts.get(n.tag) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, n]) => `${tag}:${n}`)
    .join(' ');
}

describe('tier plumbing', () => {
  it('has exactly ten tier builders for levels 1–100', () => {
    expect(TIER_BUILDERS).toHaveLength(10);
  });

  it('maps level boundaries to the right tier', () => {
    expect(tierIndex(1)).toBe(1);
    expect(tierIndex(10)).toBe(1);
    expect(tierIndex(11)).toBe(2);
    expect(tierIndex(20)).toBe(2);
    expect(tierIndex(21)).toBe(3);
    expect(tierIndex(90)).toBe(9);
    expect(tierIndex(91)).toBe(10);
    expect(tierIndex(100)).toBe(10);
    expect(tierIndex(101)).toBe(11);
  });

  it('tierProgress runs 0 → 1 across a tier and is 1 for the Architect level', () => {
    expect(tierProgress(11)).toBe(0);
    expect(tierProgress(20)).toBe(1);
    expect(tierProgress(100)).toBe(1);
    expect(tierProgress(101)).toBe(1);
  });

  it('names files: padded levels, plain level-101.svg for the default variant, suffixed otherwise', () => {
    expect(levelIconFileName(7)).toBe('level-007.svg');
    expect(levelIconFileName(100)).toBe('level-100.svg');
    expect(levelIconFileName(101)).toBe('level-101.svg');
    expect(levelIconFileName(101, 'prismatic-crown')).toBe('level-101.svg');
    expect(levelIconFileName(101, 'cosmic-nexus')).toBe('level-101-cosmic-nexus.svg');
    expect(levelIconFileName(101, 'phoenix-crystal')).toBe('level-101-phoenix-crystal.svg');
  });
});

describe('tier compositions', () => {
  it('every tier has a distinct structural fingerprint (no two tiers share a composition)', () => {
    const prints = REPRESENTATIVE_LEVELS.map((l) => fingerprint(l));
    expect(new Set(prints).size).toBe(prints.length);
  });

  it('the three Architect variants are structurally distinct from each other and from tier 10', () => {
    const prints = LEVEL_101_VARIANTS.map((v) => fingerprint(101, v));
    expect(new Set(prints).size).toBe(3);
    for (const p of prints) expect(p).not.toBe(fingerprint(91));
  });

  it('levels inside a tier share the tier composition (same fingerprint, different colors)', () => {
    for (const start of REPRESENTATIVE_LEVELS) {
      const a = fingerprint(start);
      for (let l = start + 1; l < start + 10; l++) expect(fingerprint(l), `L${l}`).toBe(a);
    }
  });

  it('carries the tier signature elements', () => {
    expect(levelIconSvg(45)).toContain('<path'); // T5 orbit ring
    expect(levelIconSvg(75)).toContain('url(#ry-0)'); // T8 light rays
    expect(levelIconSvg(85)).toContain('url(#fl-0)'); // T9 flames
    expect(levelIconSvg(95)).toContain('@keyframes'); // T10 animation
  });
});

describe('circle-crop safety (40px rounded avatars)', () => {
  const MAX_R = 31;

  function maxCircleRadius(
    level: number,
    variant101?: (typeof LEVEL_101_VARIANTS)[number],
  ): number {
    let worst = 0;
    walk(buildLevelIconScene(level, variant101 ? { variant101 } : {}), (n) => {
      if (n.tag !== 'circle') return;
      const cx = Number(n.attrs['cx']);
      const cy = Number(n.attrs['cy']);
      const r = Number(n.attrs['r']);
      const fill = String(n.attrs['fill'] ?? '');
      if (fill.startsWith('url(')) return; // glows/blooms may bleed
      worst = Math.max(worst, Math.hypot(cx - CENTER, cy - CENTER) + r);
    });
    return worst;
  }

  it('keeps every solid particle/orb within r ≤ 31 for all levels and variants', () => {
    for (let level = 1; level <= 100; level++) {
      expect(maxCircleRadius(level), `L${level}`).toBeLessThanOrEqual(MAX_R);
    }
    for (const v of LEVEL_101_VARIANTS) {
      expect(maxCircleRadius(101, v), v).toBeLessThanOrEqual(MAX_R);
    }
  });

  it('keeps the Phoenix wing silhouette (including control points) within r ≤ 31', () => {
    walk(buildLevelIconScene(101, { variant101: 'phoenix-crystal' }), (n) => {
      if (n.tag !== 'path') return;
      const d = String(n.attrs['d'] ?? '');
      if (!d.includes('C')) return;
      const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = nums[i] ?? 0;
        const y = nums[i + 1] ?? 0;
        expect(Math.hypot(x - CENTER, y - CENTER), `(${x},${y}) in ${d}`).toBeLessThanOrEqual(
          MAX_R,
        );
      }
    });
  });
});
