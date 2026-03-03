#!/usr/bin/env tsx
/**
 * Generate Level Icons — 101 unique SVG files
 *
 * Outputs optimized SVG files to public/icons/levels/level-001.svg … level-101.svg
 *
 * Usage:
 *   npx tsx apps/web/scripts/generate-level-icons.ts
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// PORT OF level-utils.ts FUNCTIONS (standalone — no import needed)
// ============================================================================

function getLevelHue(level: number): number {
  if (level >= 101) return 45;
  if (level >= 91) return ((level - 91) / 10) * 360;
  if (level >= 81) return 15 + ((level - 81) / 10) * 15;
  if (level >= 71) return 40 + ((level - 71) / 10) * 15;
  if (level >= 61) return 55 + ((level - 61) / 10) * 20;
  if (level >= 51) return 295 + ((level - 51) / 10) * 15;
  if (level >= 41) return 280 + ((level - 41) / 10) * 20;
  if (level >= 31) return 255 + ((level - 31) / 10) * 15;
  if (level >= 21) return 220 + ((level - 21) / 10) * 20;
  if (level >= 11) return 140 + ((level - 11) / 10) * 20;
  return (level / 10) * 36;
}

// ============================================================================
// SVG HELPERS
// ============================================================================

const DEG = Math.PI / 180;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.cos(deg * DEG), cy + r * Math.sin(deg * DEG)];
}

function hexPts(cx: number, cy: number, r: number, off = -90): string {
  return Array.from({ length: 6 }, (_, i) => {
    const [x, y] = polar(cx, cy, r, off + i * 60);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function starPts(cx: number, cy: number, oR: number, iR: number, n: number, off = -90): string {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? oR : iR;
    const a = off + (i * 360) / (n * 2);
    const [x, y] = polar(cx, cy, r, a);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

// ============================================================================
// TIER SVG GENERATORS
// ============================================================================

const S = 64; // SVG size
const C = S / 2; // center

function tier1(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.38;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="oklch(0.65 0.18 ${h.toFixed(1)})"/>
    <stop offset="100%" stop-color="oklch(0.45 0.14 ${h.toFixed(1)})"/>
  </linearGradient></defs>
  <polygon points="${hexPts(C, C, r)}" fill="url(#g)" stroke="oklch(0.60 0.16 ${h.toFixed(1)})" stroke-width="1.5"/>
  <line x1="${C}" y1="${(C - r * 0.5).toFixed(2)}" x2="${C}" y2="${(C + r * 0.5).toFixed(2)}" stroke="oklch(0.8 0.1 ${h.toFixed(1)})" stroke-width="0.8" opacity="0.5"/>
</svg>`;
}

function tier2(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.38;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="go" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.60 0.20 ${h.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.42 0.16 ${h.toFixed(1)})"/>
    </linearGradient>
    <linearGradient id="gi" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="oklch(0.72 0.22 ${h.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.55 0.18 ${h.toFixed(1)})"/>
    </linearGradient>
  </defs>
  <polygon points="${hexPts(C, C, r)}" fill="url(#go)" stroke="oklch(0.58 0.18 ${h.toFixed(1)})" stroke-width="1.5"/>
  <polygon points="${hexPts(C, C, r * 0.55)}" fill="url(#gi)" opacity="0.7"/>
</svg>`;
}

function tier3(level: number): string {
  const h = getLevelHue(level);
  const h2 = (h + 30) % 360;
  const r = S * 0.40;
  const lines = [0, 60, 120].map(a => {
    const [x1, y1] = polar(C, C, r * 0.15, a - 90);
    const [x2, y2] = polar(C, C, r * 0.95, a - 90);
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="oklch(0.80 0.12 ${h.toFixed(1)})" stroke-width="0.7" opacity="0.3"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow"><stop offset="0%" stop-color="oklch(0.70 0.25 ${h.toFixed(1)})" stop-opacity="0.4"/><stop offset="100%" stop-color="oklch(0.70 0.25 ${h.toFixed(1)})" stop-opacity="0"/></radialGradient>
    <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.62 0.22 ${h.toFixed(1)})"/><stop offset="50%" stop-color="oklch(0.55 0.20 ${h2.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.45 0.16 ${h.toFixed(1)})"/>
    </linearGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(r * 1.3).toFixed(2)}" fill="url(#glow)"/>
  <polygon points="${hexPts(C, C, r)}" fill="url(#g3)" stroke="oklch(0.65 0.20 ${h.toFixed(1)})" stroke-width="1.5"/>
  <polygon points="${hexPts(C, C, r * 0.5, -60)}" fill="oklch(0.75 0.18 ${h2.toFixed(1)})" opacity="0.35"/>
  ${lines}
</svg>`;
}

function tier4(level: number): string {
  const h = getLevelHue(level);
  const h2 = (h + 25) % 360;
  const h3 = (h + 50) % 360;
  const r = S * 0.40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="oklch(0.60 0.24 ${h.toFixed(1)})"/><stop offset="50%" stop-color="oklch(0.52 0.20 ${h2.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.45 0.18 ${h3.toFixed(1)})"/>
  </linearGradient></defs>
  <polygon points="${hexPts(C, C, r)}" fill="url(#g4)" stroke="oklch(0.65 0.22 ${h.toFixed(1)})" stroke-width="1.5"/>
  <polygon points="${starPts(C, C, r * 0.45, r * 0.22, 6)}" fill="oklch(0.75 0.20 ${h2.toFixed(1)})" opacity="0.5"/>
  <polygon points="${hexPts(C, C, r * 0.3)}" fill="oklch(0.80 0.15 ${h3.toFixed(1)})" opacity="0.4"/>
</svg>`;
}

function tier5(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.38;
  const facets = [0, 120, 240].map(a => {
    const [px, py] = polar(C, C, r * 0.75, a - 90);
    return `<polygon points="${hexPts(px, py, r * 0.2, a)}" fill="oklch(0.75 0.18 ${h.toFixed(1)})" opacity="0.3"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="ring"><stop offset="60%" stop-color="transparent"/><stop offset="80%" stop-color="oklch(0.65 0.25 ${h.toFixed(1)} / 0.3)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.62 0.26 ${h.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.42 0.20 ${((h + 40) % 360).toFixed(1)})"/>
    </linearGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(r * 1.35).toFixed(2)}" fill="url(#ring)"/>
  <polygon points="${hexPts(C, C, r)}" fill="url(#g5)" stroke="oklch(0.70 0.22 ${h.toFixed(1)})" stroke-width="1.5"/>
  ${facets}
  <polygon points="${starPts(C, C, r * 0.35, r * 0.18, 6)}" fill="oklch(0.80 0.22 ${h.toFixed(1)})" opacity="0.45"/>
</svg>`;
}

function tier6(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.32;
  const sats = [0, 120, 240].map(a => {
    const [sx, sy] = polar(C, C, r * 1.1, a - 90);
    return `<polygon points="${hexPts(sx, sy, r * 0.35, a)}" fill="oklch(0.55 0.20 ${((h + a / 3) % 360).toFixed(1)})" opacity="0.6"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.65 0.26 ${h.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.45 0.22 ${((h + 30) % 360).toFixed(1)})"/>
    </linearGradient>
    <radialGradient id="sh"><stop offset="0%" stop-color="oklch(0.90 0.10 ${h.toFixed(1)})" stop-opacity="0.6"/><stop offset="100%" stop-color="oklch(0.90 0.10 ${h.toFixed(1)})" stop-opacity="0"/></radialGradient>
  </defs>
  ${sats}
  <polygon points="${hexPts(C, C, r)}" fill="url(#g6)" stroke="oklch(0.70 0.24 ${h.toFixed(1)})" stroke-width="1.5"/>
  <circle cx="${(C - r * 0.2).toFixed(2)}" cy="${(C - r * 0.3).toFixed(2)}" r="${(r * 0.25).toFixed(2)}" fill="url(#sh)"/>
</svg>`;
}

function tier7(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.30;
  const orbs = [0, 72, 144, 216, 288].map(a => {
    const [px, py] = polar(C, C, r * 1.25, a);
    return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="1.2" fill="oklch(0.80 0.22 ${((h + a) % 360).toFixed(1)})" opacity="0.7"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.68 0.28 ${h.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.48 0.22 ${((h + 35) % 360).toFixed(1)})"/>
    </linearGradient>
    <radialGradient id="aura7"><stop offset="0%" stop-color="oklch(0.72 0.25 ${h.toFixed(1)})" stop-opacity="0.3"/><stop offset="100%" stop-color="oklch(0.72 0.25 ${h.toFixed(1)})" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(r * 1.6).toFixed(2)}" fill="url(#aura7)"/>
  <circle cx="${C}" cy="${C}" r="${(r * 1.25).toFixed(2)}" fill="none" stroke="oklch(0.60 0.15 ${h.toFixed(1)})" stroke-width="0.5" stroke-dasharray="2 4" opacity="0.4"/>
  ${orbs}
  <polygon points="${hexPts(C, C, r)}" fill="url(#g7)" stroke="oklch(0.72 0.26 ${h.toFixed(1)})" stroke-width="1.5"/>
  <polygon points="${starPts(C, C, r * 0.4, r * 0.2, 6)}" fill="oklch(0.82 0.20 ${h.toFixed(1)})" opacity="0.4"/>
</svg>`;
}

function tier8(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.30;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45;
    const [x1, y1] = polar(C, C, r * 0.5, a);
    const [x2, y2] = polar(C, C, r * 1.6, a);
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="oklch(0.80 0.20 ${((h + i * 15) % 360).toFixed(1)})" stroke-width="0.8" opacity="0.25"/>`;
  }).join('\n  ');
  const crowns = [0, 60, 120, 180, 240, 300].map(a => {
    const [, ] = polar(C, C, r, a - 90);
    const [tx, ty] = polar(C, C, r * 1.3, a - 90);
    const [lx, ly] = polar(C, C, r, a - 90 - 12);
    const [rx, ry] = polar(C, C, r, a - 90 + 12);
    return `<polygon points="${lx.toFixed(2)},${ly.toFixed(2)} ${tx.toFixed(2)},${ty.toFixed(2)} ${rx.toFixed(2)},${ry.toFixed(2)}" fill="oklch(0.75 0.22 ${((h + a / 4) % 360).toFixed(1)})" opacity="0.5"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs><linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="oklch(0.70 0.28 ${h.toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.48 0.24 ${((h + 20) % 360).toFixed(1)})"/>
  </linearGradient></defs>
  ${rays}
  <polygon points="${hexPts(C, C, r)}" fill="url(#g8)" stroke="oklch(0.75 0.26 ${h.toFixed(1)})" stroke-width="1.5"/>
  ${crowns}
  <polygon points="${starPts(C, C, r * 0.35, r * 0.18, 6)}" fill="oklch(0.85 0.18 ${h.toFixed(1)})" opacity="0.5"/>
</svg>`;
}

function tier9(level: number): string {
  const h = getLevelHue(level);
  const r = S * 0.30;
  const particles = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 + (level * 7);
    const d = r * (1.0 + (i % 3) * 0.25);
    const [px, py] = polar(C, C, d, a);
    const pr = 0.6 + (i % 2) * 0.4;
    return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${pr}" fill="oklch(0.85 0.22 ${((h + i * 20) % 360).toFixed(1)})" opacity="${(0.5 + (i % 3) * 0.15).toFixed(2)}"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="g9" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="oklch(0.55 0.30 ${h.toFixed(1)})"/><stop offset="50%" stop-color="oklch(0.65 0.28 ${((h + 15) % 360).toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.72 0.25 ${((h + 30) % 360).toFixed(1)})"/>
    </linearGradient>
    <radialGradient id="fl"><stop offset="0%" stop-color="oklch(0.80 0.25 ${((h + 30) % 360).toFixed(1)})" stop-opacity="0.5"/><stop offset="60%" stop-color="oklch(0.65 0.28 ${h.toFixed(1)})" stop-opacity="0.2"/><stop offset="100%" stop-color="oklch(0.65 0.28 ${h.toFixed(1)})" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="${C}" cy="${(C - r * 0.2).toFixed(2)}" rx="${(r * 1.4).toFixed(2)}" ry="${(r * 1.7).toFixed(2)}" fill="url(#fl)"/>
  ${particles}
  <polygon points="${hexPts(C, C, r)}" fill="url(#g9)" stroke="oklch(0.72 0.28 ${h.toFixed(1)})" stroke-width="1.5"/>
  <polygon points="${starPts(C, C, r * 0.45, r * 0.2, 8)}" fill="oklch(0.80 0.24 ${((h + 15) % 360).toFixed(1)})" opacity="0.4"/>
</svg>`;
}

function tier10(level: number): string {
  const r = S * 0.32;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30;
    const [x1, y1] = polar(C, C, r * 0.6, a);
    const [x2, y2] = polar(C, C, r * 1.5, a);
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="oklch(0.80 0.25 ${((i * 30) % 360).toFixed(1)})" stroke-width="0.6" opacity="0.2"/>`;
  }).join('\n  ');
  const sparkles = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 + 22.5;
    const [px, py] = polar(C, C, r * 1.15, a);
    return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.9" fill="oklch(0.90 0.20 ${((i * 45) % 360).toFixed(1)})" opacity="0.6"/>`;
  }).join('\n  ');
  // Static rainbow - cycle hue based on level offset
  const hOff = ((level - 91) / 10) * 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="rb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.70 0.30 ${hOff.toFixed(1)})"/><stop offset="50%" stop-color="oklch(0.60 0.28 ${((hOff + 180) % 360).toFixed(1)})"/><stop offset="100%" stop-color="oklch(0.50 0.26 ${((hOff + 300) % 360).toFixed(1)})"/>
    </linearGradient>
    <radialGradient id="pglow"><stop offset="0%" stop-color="oklch(0.85 0.20 60)" stop-opacity="0.5"/><stop offset="100%" stop-color="oklch(0.85 0.20 60)" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(r * 1.6).toFixed(2)}" fill="url(#pglow)"/>
  ${rays}
  <polygon points="${hexPts(C, C, r)}" fill="url(#rb)" stroke="oklch(0.75 0.25 60)" stroke-width="1.5"/>
  <polygon points="${starPts(C, C, r * 0.5, r * 0.25, 6)}" fill="oklch(0.85 0.15 60)" opacity="0.4"/>
  ${sparkles}
</svg>`;
}

function icon101(variant: 'prismatic-crown' | 'cosmic-nexus' | 'phoenix-crystal'): string {
  const r = S * 0.28;
  if (variant === 'prismatic-crown') {
    const sparkles = Array.from({ length: 12 }, (_, i) => {
      const [px, py] = polar(C, C, r * 1.6, i * 30);
      return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.7" fill="oklch(0.92 0.22 ${((i * 30) % 360).toFixed(1)})" opacity="0.7"/>`;
    }).join('\n  ');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.78 0.30 45)"/><stop offset="100%" stop-color="oklch(0.55 0.28 200)"/>
    </linearGradient>
    <radialGradient id="ca"><stop offset="0%" stop-color="oklch(0.85 0.25 45)" stop-opacity="0.6"/><stop offset="100%" stop-color="oklch(0.85 0.25 45)" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(r * 2).toFixed(2)}" fill="url(#ca)"/>
  <polygon points="${starPts(C, C, r * 1.4, r * 0.9, 12)}" fill="url(#cg)" stroke="oklch(0.80 0.25 45)" stroke-width="1"/>
  <polygon points="${hexPts(C, C, r * 0.7)}" fill="oklch(0.88 0.18 45 / 0.6)"/>
  <polygon points="${starPts(C, C, r * 0.4, r * 0.2, 6)}" fill="oklch(0.92 0.12 45 / 0.5)"/>
  ${sparkles}
</svg>`;
  }
  if (variant === 'cosmic-nexus') {
    const rr = S * 0.30;
    const spirals = Array.from({ length: 6 }, (_, i) => {
      const a = i * 60;
      const [x1, y1] = polar(C, C, rr * 0.3, a);
      const [x2, y2] = polar(C, C, rr * 1.2, a + 30);
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="oklch(0.75 0.22 ${((264 + i * 30) % 360).toFixed(1)})" stroke-width="0.6" opacity="0.3"/>`;
    }).join('\n  ');
    const stars = Array.from({ length: 16 }, (_, i) => {
      const a = i * 22.5 + 11;
      const d = rr * (0.8 + (i % 3) * 0.35);
      const [px, py] = polar(C, C, d, a);
      return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.5" fill="oklch(0.95 0.05 264)" opacity="${(0.4 + (i % 4) * 0.15).toFixed(2)}"/>`;
    }).join('\n  ');
    const octPts = Array.from({ length: 8 }, (_, i) => {
      const [x, y] = polar(C, C, rr, -90 + i * 45);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="gal"><stop offset="0%" stop-color="oklch(0.80 0.28 264)" stop-opacity="0.7"/><stop offset="40%" stop-color="oklch(0.55 0.30 300)" stop-opacity="0.4"/><stop offset="100%" stop-color="oklch(0.30 0.15 264)" stop-opacity="0"/></radialGradient>
    <linearGradient id="nf" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="oklch(0.72 0.28 264)"/><stop offset="100%" stop-color="oklch(0.50 0.26 300)"/>
    </linearGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(rr * 1.5).toFixed(2)}" fill="url(#gal)"/>
  ${spirals}
  <polygon points="${octPts}" fill="url(#nf)" stroke="oklch(0.75 0.25 264)" stroke-width="1.2"/>
  <polygon points="${starPts(C, C, rr * 0.35, rr * 0.15, 8)}" fill="oklch(0.88 0.20 264 / 0.6)"/>
  ${stars}
</svg>`;
  }
  // phoenix-crystal
  const rp = S * 0.25;
  const particles = Array.from({ length: 10 }, (_, i) => {
    const x = C + (i - 5) * rp * 0.25;
    const y = C - rp * 0.5 - i * rp * 0.18;
    const pr = 0.5 + (i % 3) * 0.3;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${pr}" fill="oklch(0.88 0.22 ${(30 + i * 5).toFixed(1)})" opacity="${(0.4 + (i % 2) * 0.2).toFixed(2)}"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="pg" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="oklch(0.55 0.30 25)"/><stop offset="40%" stop-color="oklch(0.70 0.28 40)"/><stop offset="70%" stop-color="oklch(0.78 0.25 55)"/><stop offset="100%" stop-color="oklch(0.85 0.20 70)"/>
    </linearGradient>
    <radialGradient id="pfl"><stop offset="0%" stop-color="oklch(0.85 0.28 55)" stop-opacity="0.6"/><stop offset="60%" stop-color="oklch(0.70 0.30 30)" stop-opacity="0.2"/><stop offset="100%" stop-color="oklch(0.55 0.25 15)" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="${C}" cy="${(C - rp * 0.3).toFixed(2)}" rx="${(rp * 1.8).toFixed(2)}" ry="${(rp * 2.2).toFixed(2)}" fill="url(#pfl)"/>
  <path d="M ${C} ${(C - rp * 0.6).toFixed(2)} L ${(C - rp * 1.5).toFixed(2)} ${(C - rp * 0.2).toFixed(2)} L ${(C - rp * 0.7).toFixed(2)} ${(C + rp * 0.3).toFixed(2)} Z" fill="oklch(0.72 0.28 40 / 0.5)"/>
  <path d="M ${C} ${(C - rp * 0.6).toFixed(2)} L ${(C + rp * 1.5).toFixed(2)} ${(C - rp * 0.2).toFixed(2)} L ${(C + rp * 0.7).toFixed(2)} ${(C + rp * 0.3).toFixed(2)} Z" fill="oklch(0.72 0.28 40 / 0.5)"/>
  <polygon points="${hexPts(C, C + rp * 0.2, rp * 0.8)}" fill="url(#pg)" stroke="oklch(0.75 0.25 45)" stroke-width="1.2"/>
  <polygon points="${starPts(C, C + rp * 0.2, rp * 0.35, rp * 0.18, 6)}" fill="oklch(0.88 0.18 55 / 0.5)"/>
  ${particles}
</svg>`;
}

// ============================================================================
// MAIN
// ============================================================================

function generateSvg(level: number): string {
  if (level >= 101) return icon101('prismatic-crown');
  if (level >= 91) return tier10(level);
  if (level >= 81) return tier9(level);
  if (level >= 71) return tier8(level);
  if (level >= 61) return tier7(level);
  if (level >= 51) return tier6(level);
  if (level >= 41) return tier5(level);
  if (level >= 31) return tier4(level);
  if (level >= 21) return tier3(level);
  if (level >= 11) return tier2(level);
  return tier1(level);
}

const outDir = join(__dirname, '..', 'public', 'icons', 'levels');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// Generate levels 1-101
for (let level = 1; level <= 101; level++) {
  const svg = generateSvg(level);
  const filename = `level-${String(level).padStart(3, '0')}.svg`;
  writeFileSync(join(outDir, filename), svg, 'utf-8');
}

// Also generate the two alternate 101 variants
writeFileSync(join(outDir, 'level-101-cosmic-nexus.svg'), icon101('cosmic-nexus'), 'utf-8');
writeFileSync(join(outDir, 'level-101-phoenix-crystal.svg'), icon101('phoenix-crystal'), 'utf-8');

console.log(`Generated 101 level icons + 2 alternate L101 variants in ${outDir}`);
