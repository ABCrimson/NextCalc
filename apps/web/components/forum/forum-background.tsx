/**
 * Forum Background
 *
 * Shared background used across all forum pages: three large, soft
 * "aurora" blobs that drift in position and hue, a fine noise wash that
 * exists purely to break up gradient banding, and a subtle dot grid for
 * depth.
 *
 * The aurora drift is pure CSS — `translate`/`scale`/the oklch() hue
 * channel are animated via @property-typed custom properties (see
 * `.forum-aurora-{1,2,3}` and `@keyframes aurora-drift-{1,2,3}` in
 * globals.css), each on an independent, non-synchronized period
 * (40s / 60s / 90s) so the motion reads as organic rather than a
 * mechanical loop. Everything animated is compositor/paint-cheap
 * (no canvas, no JS rAF) and `prefers-reduced-motion` is handled
 * entirely in CSS: the animation is removed and each custom property
 * settles at its registered `initial-value`, which is the same
 * balanced, centered composition the drift moves around — so reduced
 * motion still looks intentional, not "stuck mid-animation".
 *
 * No hooks are used, so this stays a plain (server-renderable)
 * component even though every current call site renders it from a
 * Client Component.
 */

import { cn } from '@/lib/utils';

function AuroraBlob({ className, index }: { className: string; index: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        'absolute rounded-full blur-3xl pointer-events-none',
        `forum-aurora-${index}`,
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function ForumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <AuroraBlob index={1} className="-top-40 -right-40 size-[700px]" />
      <AuroraBlob index={2} className="-bottom-60 -left-40 size-[800px]" />
      <AuroraBlob index={3} className="top-1/3 right-1/4 size-[500px]" />

      {/* Noise wash — exists only to defeat gradient banding, not to read
          as a texture. `mix-blend-soft-light` keeps the turbulence from
          ever hard-compositing bright/dark specks onto the page, and
          opacity is themed lighter in dark mode where the same speckle
          reads far more harshly against a near-black ground. Explicit
          backgroundSize/backgroundRepeat matter: this SVG has a viewBox
          but no intrinsic width/height, so an unset background-size
          stretches the 256x256 turbulence tile to cover the *entire*
          background area (the whole viewport, since this div is
          fixed inset-0) — that stretch is what turned fine grain into
          the large blotchy patches being reported, not the noise
          opacity itself. */}
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-[0.05] dark:opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, oklch(0.80 0.02 264) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
}
