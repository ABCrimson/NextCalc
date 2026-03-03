'use client';

/**
 * Annotation overlay for 2D plots.
 *
 * Renders text labels and arrow annotations as absolutely positioned HTML
 * elements over the WebGL canvas, matching the pattern established by
 * AxisLabels.tsx.  Positions are recomputed from math-space coordinates on
 * every viewport change so the annotations track pan and zoom correctly.
 *
 * Arrow annotations are drawn with an SVG element that covers the full
 * overlay area so lines can span any two pixel positions.
 *
 * @module components/plots/Annotations
 */

import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** A text label anchored to a math-space point. */
export interface TextAnnotation {
  readonly kind: 'text';
  readonly id: string;
  /** Math-space anchor point. */
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly color?: string;
}

/** An arrow drawn from math-space point A to math-space point B. */
export interface ArrowAnnotation {
  readonly kind: 'arrow';
  readonly id: string;
  /** Arrow tail (math-space). */
  readonly x1: number;
  readonly y1: number;
  /** Arrow head (math-space). */
  readonly x2: number;
  readonly y2: number;
  /** Optional label shown near the midpoint. */
  readonly text?: string;
  readonly color?: string;
}

export type Annotation = TextAnnotation | ArrowAnnotation;

export interface AnnotationsProps {
  annotations: readonly Annotation[];
  viewport: Viewport;
  /** CSS pixel width of the canvas area. */
  width: number;
  /** CSS pixel height of the canvas area. */
  height: number;
  /** ID of the currently selected annotation (for edit/delete UI). */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Coordinate conversion helpers
// ---------------------------------------------------------------------------

function mathToPixelX(x: number, viewport: Viewport, width: number): number {
  return ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * width;
}

function mathToPixelY(y: number, viewport: Viewport, height: number): number {
  // Math Y increases upward; screen Y increases downward.
  return height - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * height;
}

// ---------------------------------------------------------------------------
// Arrow SVG marker helpers
// ---------------------------------------------------------------------------

/** Returns the SVG path string for an arrowhead at (x2,y2) pointing in the
 *  direction (dx, dy).  The arrowhead is a small filled triangle. */
function arrowheadPath(x1: number, y1: number, x2: number, y2: number, size = 10): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return '';
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  // Two base points of the triangle, perpendicular to the shaft.
  const px = -uy;
  const py = ux;
  const base = 0.45; // half-width ratio
  return [
    `M ${x2} ${y2}`,
    `L ${x2 - ux * size + px * size * base} ${y2 - uy * size + py * size * base}`,
    `L ${x2 - ux * size - px * size * base} ${y2 - uy * size - py * size * base}`,
    'Z',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const labelVariants = {
  hidden: { opacity: 0, scale: 0.75, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.75,
    y: -4,
    transition: { duration: 0.15 },
  },
};

const arrowVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DeleteButtonProps {
  onDelete: () => void;
  label: string;
}

function DeleteButton({ onDelete, label }: DeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="
        absolute -top-2.5 -right-2.5
        w-5 h-5 flex items-center justify-center
        rounded-full bg-red-600 border border-red-400
        text-white shadow-md
        hover:bg-red-500 transition-colors duration-150
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
      "
      aria-label={`Delete annotation: ${label}`}
    >
      <X className="w-3 h-3" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Annotations({
  annotations,
  viewport,
  width,
  height,
  selectedId,
  onSelect,
  onDelete,
}: AnnotationsProps) {
  // Stable unique prefix for SVG marker IDs so multiple plot instances on the
  // same page don't share marker elements.
  const instanceId = useId();

  const handleOverlayClick = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  // Precompute pixel positions for every annotation so the JSX stays clean.
  const positioned = useMemo(() => {
    return annotations.map((ann) => {
      if (ann.kind === 'text') {
        return {
          ...ann,
          px: mathToPixelX(ann.x, viewport, width),
          py: mathToPixelY(ann.y, viewport, height),
        } as TextAnnotation & { px: number; py: number };
      }
      // arrow
      return {
        ...ann,
        px1: mathToPixelX(ann.x1, viewport, width),
        py1: mathToPixelY(ann.y1, viewport, height),
        px2: mathToPixelX(ann.x2, viewport, width),
        py2: mathToPixelY(ann.y2, viewport, height),
      } as ArrowAnnotation & { px1: number; py1: number; px2: number; py2: number };
    });
  }, [annotations, viewport, width, height]);

  const textItems = positioned.filter(
    (a): a is TextAnnotation & { px: number; py: number } => a.kind === 'text',
  );

  const arrowItems = positioned.filter(
    (a): a is ArrowAnnotation & { px1: number; py1: number; px2: number; py2: number } =>
      a.kind === 'arrow',
  );

  return (
    // pointer-events-none on the root so we don't block WebGL interactions;
    // individual interactive elements opt back in with pointer-events-auto.
    <div
      className="absolute inset-0 select-none"
      style={{ width, height, pointerEvents: 'none' }}
      onClick={handleOverlayClick}
      role="presentation"
      aria-label="Plot annotations overlay"
    >
      {/* ------------------------------------------------------------------ */}
      {/* SVG layer — draws arrow shafts and arrowheads                       */}
      {/* ------------------------------------------------------------------ */}
      <svg
        className="absolute inset-0 overflow-visible"
        width={width}
        height={height}
        aria-hidden="true"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          {arrowItems.map((ann) => {
            const markerId = `${instanceId}-arrow-${ann.id}`;
            const color = ann.color ?? '#06b6d4';
            return (
              <marker
                key={markerId}
                id={markerId}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={color} />
              </marker>
            );
          })}
        </defs>

        <AnimatePresence>
          {arrowItems.map((ann) => {
            const markerId = `${instanceId}-arrow-${ann.id}`;
            const color = ann.color ?? '#06b6d4';
            const isSelected = ann.id === selectedId;
            // Shorten the line slightly so the shaft doesn't overlap the arrowhead polygon.
            const len = Math.hypot(ann.px2 - ann.px1, ann.py2 - ann.py1);
            const shortenBy = len > 14 ? 12 : 0;
            const ux = len > 0 ? (ann.px2 - ann.px1) / len : 0;
            const uy = len > 0 ? (ann.py2 - ann.py1) / len : 0;
            const x2adj = ann.px2 - ux * shortenBy;
            const y2adj = ann.py2 - uy * shortenBy;

            // Midpoint for the optional mid-label.
            const midX = (ann.px1 + ann.px2) / 2;
            const midY = (ann.py1 + ann.py2) / 2;

            return (
              <m.g
                key={ann.id}
                variants={arrowVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Invisible wide hit area for click selection */}
                <line
                  x1={ann.px1}
                  y1={ann.py1}
                  x2={ann.px2}
                  y2={ann.py2}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(isSelected ? null : ann.id);
                  }}
                  role="button"
                  aria-label={ann.text ? `Arrow annotation: ${ann.text}` : 'Arrow annotation'}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onSelect(isSelected ? null : ann.id);
                    }
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.stopPropagation();
                      onDelete(ann.id);
                    }
                  }}
                />

                {/* Visible shaft */}
                <line
                  x1={ann.px1}
                  y1={ann.py1}
                  x2={x2adj}
                  y2={y2adj}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.75}
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                  style={{ pointerEvents: 'none' }}
                  opacity={isSelected ? 1 : 0.85}
                />

                {/* Tail dot */}
                <circle
                  cx={ann.px1}
                  cy={ann.py1}
                  r={3}
                  fill={color}
                  opacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={ann.px1}
                    cy={ann.py1}
                    r={6}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    opacity={0.6}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Arrowhead path (extra visual cue when selected) */}
                {isSelected && (
                  <path
                    d={arrowheadPath(ann.px1, ann.py1, ann.px2, ann.py2, 10)}
                    fill={color}
                    opacity={0.5}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Midpoint label */}
                {ann.text && (
                  <text
                    x={midX}
                    y={midY - 8}
                    textAnchor="middle"
                    dominantBaseline="auto"
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                    fill={color}
                    stroke="var(--color-background)"
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {ann.text}
                  </text>
                )}

                {/* Delete button for selected arrow — rendered as a foreignObject */}
                {isSelected && (
                  <foreignObject
                    x={ann.px1 - 12}
                    y={ann.py1 - 24}
                    width={24}
                    height={24}
                    style={{ pointerEvents: 'auto', overflow: 'visible' }}
                  >
                    <DeleteButton onDelete={() => onDelete(ann.id)} label={ann.text ?? 'arrow'} />
                  </foreignObject>
                )}
              </m.g>
            );
          })}
        </AnimatePresence>
      </svg>

      {/* ------------------------------------------------------------------ */}
      {/* Text label layer                                                    */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {textItems.map((ann) => {
          const isSelected = ann.id === selectedId;
          const color = ann.color ?? '#06b6d4';

          return (
            <m.div
              key={ann.id}
              variants={labelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={[
                'absolute group',
                'flex items-center gap-1',
                'px-2 py-1 rounded-md',
                'text-xs font-mono font-medium',
                'border shadow-md',
                'transition-all duration-150',
                'cursor-pointer',
                isSelected ? 'ring-2 ring-offset-1 ring-offset-background z-20' : 'z-10 hover:z-20',
              ].join(' ')}
              style={{
                left: `${ann.px}px`,
                top: `${ann.py}px`,
                transform: 'translate(-50%, -120%) translateZ(0)',
                willChange: 'transform, opacity',
                pointerEvents: 'auto',
                backgroundColor: 'color-mix(in oklch, var(--color-background) 88%, transparent)',
                borderColor: isSelected
                  ? color
                  : 'color-mix(in oklch, var(--color-border) 80%, transparent)',
                color,
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}60, 0 4px 12px rgba(0,0,0,0.4)`
                  : '0 2px 8px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : ann.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onSelect(isSelected ? null : ann.id);
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.stopPropagation();
                  onDelete(ann.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={`Text annotation at (${ann.x.toFixed(2)}, ${ann.y.toFixed(2)}): ${ann.text}`}
            >
              {/* Small anchor dot connecting label to its math point */}
              <span
                className="absolute bottom-0 left-1/2 w-1.5 h-1.5 rounded-full"
                style={{
                  transform: 'translate(-50%, 200%)',
                  backgroundColor: color,
                  boxShadow: `0 0 4px ${color}`,
                }}
                aria-hidden="true"
              />

              <span>{ann.text}</span>

              {/* Coordinates hint */}
              <span className="text-[9px] opacity-60 tabular-nums" aria-hidden="true">
                ({ann.x.toFixed(1)}, {ann.y.toFixed(1)})
              </span>

              {/* Delete button — always visible when selected, hover on others */}
              {isSelected && <DeleteButton onDelete={() => onDelete(ann.id)} label={ann.text} />}
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
