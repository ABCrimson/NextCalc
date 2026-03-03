/**
 * LevelIcon — Programmatic crystal SVG from level number
 *
 * Generates unique crystal icons for levels 1-101 using OKLCH color
 * progression and 10 visual tiers with increasing geometric complexity:
 *
 *  L1-10:   Simple hexagonal crystal
 *  L11-20:  Hexagonal with inner facet + gradient
 *  L21-30:  Multi-faceted, 2 colors, subtle glow
 *  L31-40:  Faceted with inner star, 3 colors
 *  L41-50:  Complex facets + glow ring
 *  L51-60:  Crystal cluster + shimmer
 *  L61-70:  Floating crystal + orbit particles
 *  L71-80:  Crown crystal + light rays
 *  L81-90:  Flame-crystal fusion + particles
 *  L91-100: Full prismatic crystal + rainbow animation
 *  L101:    Special admin-only variant (3 themes available)
 */

import { getLevelColor, getLevelHue } from './level-utils';

// ============================================================================
// TYPES
// ============================================================================

export type Icon101Variant = 'prismatic-crown' | 'cosmic-nexus' | 'phoenix-crystal';

interface LevelIconProps {
  level: number;
  size?: number;
  className?: string;
  /** Only for level 101: which special variant to render */
  variant101?: Icon101Variant;
}

// ============================================================================
// HELPERS
// ============================================================================

const DEG = Math.PI / 180;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = angleDeg * DEG;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function hexPoints(cx: number, cy: number, r: number, rotateOffset = -90): string {
  return Array.from({ length: 6 }, (_, i) => {
    const [x, y] = polarToXY(cx, cy, r, rotateOffset + i * 60);
    return `${x},${y}`;
  }).join(' ');
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number, points: number, rotateOffset = -90): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = rotateOffset + (i * 360) / (points * 2);
    const [x, y] = polarToXY(cx, cy, r, angle);
    return `${x},${y}`;
  }).join(' ');
}

/** Unique ID prefix per level to avoid SVG def collisions */
function uid(level: number, suffix: string) {
  return `li${level}-${suffix}`;
}

// ============================================================================
// TIER RENDERERS
// ============================================================================

/** T1: Simple hexagonal crystal (L1-10) */
function Tier1({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const color = getLevelColor(level);
  const c = size / 2;
  const r = size * 0.38;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g1')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.65 0.18 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.45 0.14 ${hue})`} />
        </linearGradient>
      </defs>
      <polygon
        points={hexPoints(c, c, r)}
        fill={`url(#${uid(level, 'g1')})`}
        stroke={color}
        strokeWidth={size * 0.03}
      />
      {/* Center facet line */}
      <line x1={c} y1={c - r * 0.5} x2={c} y2={c + r * 0.5} stroke={`oklch(0.8 0.1 ${hue})`} strokeWidth={size * 0.015} opacity={0.5} />
    </svg>
  );
}

/** T2: Hexagonal with inner facet + gradient (L11-20) */
function Tier2({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const color = getLevelColor(level);
  const c = size / 2;
  const r = size * 0.38;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g2o')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.60 0.20 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.42 0.16 ${hue})`} />
        </linearGradient>
        <linearGradient id={uid(level, 'g2i')} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`oklch(0.72 0.22 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.55 0.18 ${hue})`} />
        </linearGradient>
      </defs>
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g2o')})`} stroke={color} strokeWidth={size * 0.03} />
      <polygon points={hexPoints(c, c, r * 0.55)} fill={`url(#${uid(level, 'g2i')})`} opacity={0.7} />
    </svg>
  );
}

/** T3: Multi-faceted, 2 colors, subtle glow (L21-30) */
function Tier3({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const hue2 = (hue + 30) % 360;
  const c = size / 2;
  const r = size * 0.40;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={uid(level, 'glow')}>
          <stop offset="0%" stopColor={`oklch(0.70 0.25 ${hue})`} stopOpacity={0.4} />
          <stop offset="100%" stopColor={`oklch(0.70 0.25 ${hue})`} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={uid(level, 'g3')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.62 0.22 ${hue})`} />
          <stop offset="50%" stopColor={`oklch(0.55 0.20 ${hue2})`} />
          <stop offset="100%" stopColor={`oklch(0.45 0.16 ${hue})`} />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={r * 1.3} fill={`url(#${uid(level, 'glow')})`} />
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g3')})`} stroke={`oklch(0.65 0.20 ${hue})`} strokeWidth={size * 0.025} />
      <polygon points={hexPoints(c, c, r * 0.5, -60)} fill={`oklch(0.75 0.18 ${hue2})`} opacity={0.35} />
      {/* Facet lines */}
      {[0, 60, 120].map((angle) => {
        const [x1, y1] = polarToXY(c, c, r * 0.15, angle - 90);
        const [x2, y2] = polarToXY(c, c, r * 0.95, angle - 90);
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`oklch(0.80 0.12 ${hue})`} strokeWidth={size * 0.012} opacity={0.3} />;
      })}
    </svg>
  );
}

/** T4: Faceted with inner star, 3 colors (L31-40) */
function Tier4({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const hue2 = (hue + 25) % 360;
  const hue3 = (hue + 50) % 360;
  const c = size / 2;
  const r = size * 0.40;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g4')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.60 0.24 ${hue})`} />
          <stop offset="50%" stopColor={`oklch(0.52 0.20 ${hue2})`} />
          <stop offset="100%" stopColor={`oklch(0.45 0.18 ${hue3})`} />
        </linearGradient>
      </defs>
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g4')})`} stroke={`oklch(0.65 0.22 ${hue})`} strokeWidth={size * 0.025} />
      <polygon points={starPoints(c, c, r * 0.45, r * 0.22, 6)} fill={`oklch(0.75 0.20 ${hue2})`} opacity={0.5} />
      <polygon points={hexPoints(c, c, r * 0.3)} fill={`oklch(0.80 0.15 ${hue3})`} opacity={0.4} />
    </svg>
  );
}

/** T5: Complex facets + glow ring (L41-50) */
function Tier5({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const c = size / 2;
  const r = size * 0.38;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={uid(level, 'ring')}>
          <stop offset="60%" stopColor="transparent" />
          <stop offset="80%" stopColor={`oklch(0.65 0.25 ${hue} / 0.3)`} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={uid(level, 'g5')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.62 0.26 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.42 0.20 ${(hue + 40) % 360})`} />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={r * 1.35} fill={`url(#${uid(level, 'ring')})`} />
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g5')})`} stroke={`oklch(0.70 0.22 ${hue})`} strokeWidth={size * 0.025} />
      {/* Inner facets */}
      {[0, 120, 240].map((angle) => {
        const [px, py] = polarToXY(c, c, r * 0.75, angle - 90);
        return <polygon key={angle} points={hexPoints(px, py, r * 0.2, angle)} fill={`oklch(0.75 0.18 ${hue})`} opacity={0.3} />;
      })}
      <polygon points={starPoints(c, c, r * 0.35, r * 0.18, 6)} fill={`oklch(0.80 0.22 ${hue})`} opacity={0.45} />
    </svg>
  );
}

/** T6: Crystal cluster + shimmer (L51-60) */
function Tier6({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const c = size / 2;
  const r = size * 0.32;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g6')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.65 0.26 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.45 0.22 ${(hue + 30) % 360})`} />
        </linearGradient>
        <radialGradient id={uid(level, 'shimmer')}>
          <stop offset="0%" stopColor={`oklch(0.90 0.10 ${hue})`} stopOpacity={0.6} />
          <stop offset="100%" stopColor={`oklch(0.90 0.10 ${hue})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Satellite crystals */}
      {[0, 120, 240].map((angle) => {
        const [sx, sy] = polarToXY(c, c, r * 1.1, angle - 90);
        return (
          <polygon
            key={angle}
            points={hexPoints(sx, sy, r * 0.35, angle)}
            fill={`oklch(0.55 0.20 ${(hue + angle / 3) % 360})`}
            opacity={0.6}
          />
        );
      })}
      {/* Main crystal */}
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g6')})`} stroke={`oklch(0.70 0.24 ${hue})`} strokeWidth={size * 0.025} />
      {/* Shimmer */}
      <circle cx={c - r * 0.2} cy={c - r * 0.3} r={r * 0.25} fill={`url(#${uid(level, 'shimmer')})`} />
    </svg>
  );
}

/** T7: Floating crystal + orbit particles (L61-70) */
function Tier7({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const c = size / 2;
  const r = size * 0.30;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g7')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.68 0.28 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.48 0.22 ${(hue + 35) % 360})`} />
        </linearGradient>
        <radialGradient id={uid(level, 'aura7')}>
          <stop offset="0%" stopColor={`oklch(0.72 0.25 ${hue})`} stopOpacity={0.3} />
          <stop offset="100%" stopColor={`oklch(0.72 0.25 ${hue})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Aura */}
      <circle cx={c} cy={c} r={r * 1.6} fill={`url(#${uid(level, 'aura7')})`} />
      {/* Orbit ring */}
      <circle cx={c} cy={c} r={r * 1.25} fill="none" stroke={`oklch(0.60 0.15 ${hue})`} strokeWidth={size * 0.008} strokeDasharray={`${size * 0.03} ${size * 0.06}`} opacity={0.4} />
      {/* Orbit particles */}
      {[0, 72, 144, 216, 288].map((angle) => {
        const [px, py] = polarToXY(c, c, r * 1.25, angle);
        return <circle key={angle} cx={px} cy={py} r={size * 0.02} fill={`oklch(0.80 0.22 ${(hue + angle) % 360})`} opacity={0.7} />;
      })}
      {/* Main crystal */}
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g7')})`} stroke={`oklch(0.72 0.26 ${hue})`} strokeWidth={size * 0.025} />
      <polygon points={starPoints(c, c, r * 0.4, r * 0.2, 6)} fill={`oklch(0.82 0.20 ${hue})`} opacity={0.4} />
    </svg>
  );
}

/** T8: Crown crystal + light rays (L71-80) */
function Tier8({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const c = size / 2;
  const r = size * 0.30;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g8')} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.70 0.28 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.48 0.24 ${(hue + 20) % 360})`} />
        </linearGradient>
      </defs>
      {/* Light rays */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = i * 45;
        const [x1, y1] = polarToXY(c, c, r * 0.5, angle);
        const [x2, y2] = polarToXY(c, c, r * 1.6, angle);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={`oklch(0.80 0.20 ${(hue + i * 15) % 360})`}
            strokeWidth={size * 0.015} opacity={0.25}
          />
        );
      })}
      {/* Main crystal */}
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g8')})`} stroke={`oklch(0.75 0.26 ${hue})`} strokeWidth={size * 0.03} />
      {/* Crown points */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const [bx, by] = polarToXY(c, c, r, angle - 90);
        const [tx, ty] = polarToXY(c, c, r * 1.3, angle - 90);
        const [lx, ly] = polarToXY(c, c, r, angle - 90 - 12);
        const [rx, ry] = polarToXY(c, c, r, angle - 90 + 12);
        return <polygon key={angle} points={`${lx},${ly} ${tx},${ty} ${rx},${ry}`} fill={`oklch(0.75 0.22 ${(hue + angle / 4) % 360})`} opacity={0.5} />;
      })}
      <polygon points={starPoints(c, c, r * 0.35, r * 0.18, 6)} fill={`oklch(0.85 0.18 ${hue})`} opacity={0.5} />
    </svg>
  );
}

/** T9: Flame-crystal fusion + particles (L81-90) */
function Tier9({ level, size }: { level: number; size: number }) {
  const hue = getLevelHue(level);
  const c = size / 2;
  const r = size * 0.30;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uid(level, 'g9')} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`oklch(0.55 0.30 ${hue})`} />
          <stop offset="50%" stopColor={`oklch(0.65 0.28 ${(hue + 15) % 360})`} />
          <stop offset="100%" stopColor={`oklch(0.72 0.25 ${(hue + 30) % 360})`} />
        </linearGradient>
        <radialGradient id={uid(level, 'flame')}>
          <stop offset="0%" stopColor={`oklch(0.80 0.25 ${(hue + 30) % 360})`} stopOpacity={0.5} />
          <stop offset="60%" stopColor={`oklch(0.65 0.28 ${hue})`} stopOpacity={0.2} />
          <stop offset="100%" stopColor={`oklch(0.65 0.28 ${hue})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Flame aura */}
      <ellipse cx={c} cy={c - r * 0.2} rx={r * 1.4} ry={r * 1.7} fill={`url(#${uid(level, 'flame')})`} />
      {/* Particles */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * 30 + (level * 7);
        const dist = r * (1.0 + (i % 3) * 0.25);
        const [px, py] = polarToXY(c, c, dist, angle);
        const pr = size * (0.01 + (i % 2) * 0.008);
        return <circle key={i} cx={px} cy={py} r={pr} fill={`oklch(0.85 0.22 ${(hue + i * 20) % 360})`} opacity={0.5 + (i % 3) * 0.15} />;
      })}
      {/* Main crystal */}
      <polygon points={hexPoints(c, c, r)} fill={`url(#${uid(level, 'g9')})`} stroke={`oklch(0.72 0.28 ${hue})`} strokeWidth={size * 0.03} />
      <polygon points={starPoints(c, c, r * 0.45, r * 0.2, 8)} fill={`oklch(0.80 0.24 ${(hue + 15) % 360})`} opacity={0.4} />
    </svg>
  );
}

/** T10: Full prismatic crystal + rainbow animation (L91-100) */
function Tier10({ level, size }: { level: number; size: number }) {
  const c = size / 2;
  const r = size * 0.32;
  const animId = uid(level, 'rainbow');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={animId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.70 0.30 0)">
            <animate attributeName="stop-color" values="oklch(0.70 0.30 0);oklch(0.70 0.30 60);oklch(0.70 0.30 120);oklch(0.70 0.30 180);oklch(0.70 0.30 240);oklch(0.70 0.30 300);oklch(0.70 0.30 360)" dur="4s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor="oklch(0.60 0.28 180)">
            <animate attributeName="stop-color" values="oklch(0.60 0.28 180);oklch(0.60 0.28 240);oklch(0.60 0.28 300);oklch(0.60 0.28 0);oklch(0.60 0.28 60);oklch(0.60 0.28 120);oklch(0.60 0.28 180)" dur="4s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="oklch(0.50 0.26 300)">
            <animate attributeName="stop-color" values="oklch(0.50 0.26 300);oklch(0.50 0.26 0);oklch(0.50 0.26 60);oklch(0.50 0.26 120);oklch(0.50 0.26 180);oklch(0.50 0.26 240);oklch(0.50 0.26 300)" dur="4s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <radialGradient id={uid(level, 'prism-glow')}>
          <stop offset="0%" stopColor="oklch(0.85 0.20 60)" stopOpacity={0.5} />
          <stop offset="100%" stopColor="oklch(0.85 0.20 60)" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Prismatic glow */}
      <circle cx={c} cy={c} r={r * 1.6} fill={`url(#${uid(level, 'prism-glow')})`} />
      {/* Light rays */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * 30;
        const [x1, y1] = polarToXY(c, c, r * 0.6, angle);
        const [x2, y2] = polarToXY(c, c, r * 1.5, angle);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={`oklch(0.80 0.25 ${(i * 30) % 360})`}
            strokeWidth={size * 0.01} opacity={0.2}
          />
        );
      })}
      {/* Main crystal */}
      <polygon points={hexPoints(c, c, r)} fill={`url(#${animId})`} stroke="oklch(0.75 0.25 60)" strokeWidth={size * 0.03} />
      {/* Inner star */}
      <polygon points={starPoints(c, c, r * 0.5, r * 0.25, 6)} fill="oklch(0.85 0.15 60)" opacity={0.4} />
      {/* Sparkle particles */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = i * 45 + 22.5;
        const dist = r * 1.15;
        const [px, py] = polarToXY(c, c, dist, angle);
        return <circle key={i} cx={px} cy={py} r={size * 0.015} fill={`oklch(0.90 0.20 ${(i * 45) % 360})`} opacity={0.6} />;
      })}
    </svg>
  );
}

// ============================================================================
// LEVEL 101 SPECIAL VARIANTS
// ============================================================================

/** 101A: Prismatic Crystal Crown */
function Icon101PrismaticCrown({ size }: { size: number }) {
  const c = size / 2;
  const r = size * 0.28;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="i101-crown-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.78 0.30 45)">
            <animate attributeName="stop-color" values="oklch(0.78 0.30 45);oklch(0.78 0.30 105);oklch(0.78 0.30 165);oklch(0.78 0.30 225);oklch(0.78 0.30 285);oklch(0.78 0.30 345);oklch(0.78 0.30 45)" dur="6s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="oklch(0.55 0.28 200)">
            <animate attributeName="stop-color" values="oklch(0.55 0.28 200);oklch(0.55 0.28 260);oklch(0.55 0.28 320);oklch(0.55 0.28 20);oklch(0.55 0.28 80);oklch(0.55 0.28 140);oklch(0.55 0.28 200)" dur="6s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <radialGradient id="i101-crown-aura">
          <stop offset="0%" stopColor="oklch(0.85 0.25 45)" stopOpacity={0.6} />
          <stop offset="100%" stopColor="oklch(0.85 0.25 45)" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Aura */}
      <circle cx={c} cy={c} r={r * 2} fill="url(#i101-crown-aura)" />
      {/* 12-point crown */}
      <polygon points={starPoints(c, c, r * 1.4, r * 0.9, 12)} fill="url(#i101-crown-grad)" stroke="oklch(0.80 0.25 45)" strokeWidth={size * 0.02} />
      {/* Inner crystal */}
      <polygon points={hexPoints(c, c, r * 0.7)} fill="oklch(0.88 0.18 45 / 0.6)" />
      <polygon points={starPoints(c, c, r * 0.4, r * 0.2, 6)} fill="oklch(0.92 0.12 45 / 0.5)" />
      {/* Sparkles */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * 30;
        const [px, py] = polarToXY(c, c, r * 1.6, angle);
        return <circle key={i} cx={px} cy={py} r={size * 0.012} fill={`oklch(0.92 0.22 ${(i * 30) % 360})`} opacity={0.7}>
          <animate attributeName="opacity" values="0.3;0.9;0.3" dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
        </circle>;
      })}
    </svg>
  );
}

/** 101B: Cosmic Nexus */
function Icon101CosmicNexus({ size }: { size: number }) {
  const c = size / 2;
  const r = size * 0.30;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="i101-galaxy">
          <stop offset="0%" stopColor="oklch(0.80 0.28 264)" stopOpacity={0.7} />
          <stop offset="40%" stopColor="oklch(0.55 0.30 300)" stopOpacity={0.4} />
          <stop offset="100%" stopColor="oklch(0.30 0.15 264)" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="i101-nexus-frame" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.72 0.28 264)">
            <animate attributeName="stop-color" values="oklch(0.72 0.28 264);oklch(0.72 0.28 324);oklch(0.72 0.28 24);oklch(0.72 0.28 84);oklch(0.72 0.28 144);oklch(0.72 0.28 204);oklch(0.72 0.28 264)" dur="8s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="oklch(0.50 0.26 300)" />
        </linearGradient>
      </defs>
      {/* Galaxy portal */}
      <circle cx={c} cy={c} r={r * 1.5} fill="url(#i101-galaxy)" />
      {/* Spiral arms (static representation) */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = i * 60;
        const [x1, y1] = polarToXY(c, c, r * 0.3, angle);
        const [x2, y2] = polarToXY(c, c, r * 1.2, angle + 30);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`oklch(0.75 0.22 ${(264 + i * 30) % 360})`} strokeWidth={size * 0.01} opacity={0.3} />;
      })}
      {/* Octagonal frame */}
      <polygon
        points={Array.from({ length: 8 }, (_, i) => {
          const [x, y] = polarToXY(c, c, r, -90 + i * 45);
          return `${x},${y}`;
        }).join(' ')}
        fill="url(#i101-nexus-frame)"
        stroke="oklch(0.75 0.25 264)"
        strokeWidth={size * 0.025}
      />
      {/* Central star */}
      <polygon points={starPoints(c, c, r * 0.35, r * 0.15, 8)} fill="oklch(0.88 0.20 264 / 0.6)" />
      {/* Star field */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = i * 22.5 + 11;
        const dist = r * (0.8 + (i % 3) * 0.35);
        const [px, py] = polarToXY(c, c, dist, angle);
        return <circle key={i} cx={px} cy={py} r={size * 0.008} fill="oklch(0.95 0.05 264)" opacity={0.4 + (i % 4) * 0.15}>
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
        </circle>;
      })}
    </svg>
  );
}

/** 101C: Phoenix Crystal */
function Icon101PhoenixCrystal({ size }: { size: number }) {
  const c = size / 2;
  const r = size * 0.25;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="i101-phoenix-grad" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="oklch(0.55 0.30 25)" />
          <stop offset="40%" stopColor="oklch(0.70 0.28 40)" />
          <stop offset="70%" stopColor="oklch(0.78 0.25 55)" />
          <stop offset="100%" stopColor="oklch(0.85 0.20 70)">
            <animate attributeName="stop-color" values="oklch(0.85 0.20 70);oklch(0.88 0.22 50);oklch(0.85 0.20 70)" dur="2s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <radialGradient id="i101-phoenix-flame">
          <stop offset="0%" stopColor="oklch(0.85 0.28 55)" stopOpacity={0.6} />
          <stop offset="60%" stopColor="oklch(0.70 0.30 30)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="oklch(0.55 0.25 15)" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Flame background */}
      <ellipse cx={c} cy={c - r * 0.3} rx={r * 1.8} ry={r * 2.2} fill="url(#i101-phoenix-flame)" />
      {/* Wings (stylized V shapes) */}
      <path
        d={`M ${c} ${c - r * 0.6} L ${c - r * 1.5} ${c - r * 0.2} L ${c - r * 0.7} ${c + r * 0.3} Z`}
        fill="oklch(0.72 0.28 40 / 0.5)"
      />
      <path
        d={`M ${c} ${c - r * 0.6} L ${c + r * 1.5} ${c - r * 0.2} L ${c + r * 0.7} ${c + r * 0.3} Z`}
        fill="oklch(0.72 0.28 40 / 0.5)"
      />
      {/* Crystal base */}
      <polygon points={hexPoints(c, c + r * 0.2, r * 0.8)} fill="url(#i101-phoenix-grad)" stroke="oklch(0.75 0.25 45)" strokeWidth={size * 0.025} />
      {/* Inner star */}
      <polygon points={starPoints(c, c + r * 0.2, r * 0.35, r * 0.18, 6)} fill="oklch(0.88 0.18 55 / 0.5)" />
      {/* Rising particles */}
      {Array.from({ length: 10 }, (_, i) => {
        const x = c + (i - 5) * r * 0.25;
        const y = c - r * 0.5 - i * r * 0.18;
        const pr = size * (0.008 + (i % 3) * 0.005);
        return <circle key={i} cx={x} cy={y} r={pr} fill={`oklch(0.88 0.22 ${30 + i * 5})`} opacity={0.4 + (i % 2) * 0.2}>
          <animate attributeName="opacity" values="0.2;0.7;0.2" dur={`${1 + i * 0.15}s`} repeatCount="indefinite" />
        </circle>;
      })}
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LevelIcon({ level, size = 48, className, variant101 = 'prismatic-crown' }: LevelIconProps) {
  const clampedLevel = Math.max(1, Math.min(level, 101));

  const svgContent = (() => {
    // Level 101: special admin-only variants
    if (clampedLevel >= 101) {
      switch (variant101) {
        case 'cosmic-nexus': return <Icon101CosmicNexus size={size} />;
        case 'phoenix-crystal': return <Icon101PhoenixCrystal size={size} />;
        default: return <Icon101PrismaticCrown size={size} />;
      }
    }
    // Tiers by level range
    if (clampedLevel >= 91) return <Tier10 level={clampedLevel} size={size} />;
    if (clampedLevel >= 81) return <Tier9 level={clampedLevel} size={size} />;
    if (clampedLevel >= 71) return <Tier8 level={clampedLevel} size={size} />;
    if (clampedLevel >= 61) return <Tier7 level={clampedLevel} size={size} />;
    if (clampedLevel >= 51) return <Tier6 level={clampedLevel} size={size} />;
    if (clampedLevel >= 41) return <Tier5 level={clampedLevel} size={size} />;
    if (clampedLevel >= 31) return <Tier4 level={clampedLevel} size={size} />;
    if (clampedLevel >= 21) return <Tier3 level={clampedLevel} size={size} />;
    if (clampedLevel >= 11) return <Tier2 level={clampedLevel} size={size} />;
    return <Tier1 level={clampedLevel} size={size} />;
  })();

  return (
    <span className={className} role="img" aria-label={`Level ${clampedLevel} icon`}>
      {svgContent}
    </span>
  );
}
