'use client';

/**
 * SVG overlay that renders draggable data points (and optional residual
 * segments) on top of Plot2D.
 *
 * The WebGL renderer has no scatter/marker support, so points live in an
 * absolutely-positioned SVG using the exact math→pixel mapping that
 * Annotations.tsx uses; residuals are muted secondary marks per dataviz
 * fundamentals (single shared axis, restrained styling).
 *
 * @module components/plots/regression/DataPointsOverlay
 */

import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

export interface OverlayViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface OverlayPoint {
  x: number;
  y: number;
  /** Index of the source row in the data table. */
  row: number;
}

export interface DataPointsOverlayProps {
  points: readonly OverlayPoint[];
  viewport: OverlayViewport;
  /** Accessible title of the overlay (svg <title>). */
  label: string;
  /** Fill color of the data points. */
  color: string;
  /** Predictor for residual segments (present only for single-regressor fits). */
  residuals?: { predict: (x: number) => number };
  showResiduals: boolean;
  onPointMove: (row: number, x: number, y: number) => void;
  /** Accessible label for a point, e.g. "Data point (2, 4.5)". */
  pointLabel: (x: number, y: number) => string;
}

// Identical mapping to Annotations.tsx (mathToPixelX/mathToPixelY) so points
// land exactly on the WebGL-rendered curve.
function mathToPixelX(x: number, viewport: OverlayViewport, width: number): number {
  return ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * width;
}

function mathToPixelY(y: number, viewport: OverlayViewport, height: number): number {
  // Math Y increases upward; screen Y increases downward.
  return height - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * height;
}

export function DataPointsOverlay({
  points,
  viewport,
  label,
  color,
  residuals,
  showResiduals,
  onPointMove,
  pointLabel,
}: DataPointsOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The row being dragged; a ref because dragging must not re-render per move.
  const dragRowRef = useRef<number | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  if (width === 0 || height === 0) {
    return (
      <svg
        ref={svgRef}
        className="absolute inset-0 size-full touch-none pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  const toMath = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: Number.NaN, y: Number.NaN };
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return {
      x: viewport.xMin + (px / rect.width) * (viewport.xMax - viewport.xMin),
      y: viewport.yMax - (py / rect.height) * (viewport.yMax - viewport.yMin),
    };
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, point: OverlayPoint) => {
    const stepX = (viewport.xMax - viewport.xMin) / 200;
    const stepY = (viewport.yMax - viewport.yMin) / 200;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -stepX;
    else if (event.key === 'ArrowRight') dx = stepX;
    else if (event.key === 'ArrowUp') dy = stepY;
    else if (event.key === 'ArrowDown') dy = -stepY;
    else return;
    event.preventDefault();
    onPointMove(point.row, point.x + dx, point.y + dy);
  };

  return (
    <svg ref={svgRef} className="absolute inset-0 size-full touch-none pointer-events-none">
      <title>{label}</title>
      {/* Residual segments: muted secondary marks from each point to the fitted curve. */}
      {showResiduals &&
        residuals &&
        points.map((point) => {
          const predicted = residuals.predict(point.x);
          if (!Number.isFinite(predicted)) return null;
          const px = mathToPixelX(point.x, viewport, width);
          return (
            <line
              key={`res-${point.row}`}
              x1={px}
              y1={mathToPixelY(point.y, viewport, height)}
              x2={px}
              y2={mathToPixelY(predicted, viewport, height)}
              stroke="var(--color-muted-foreground)"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              strokeLinecap="round"
            />
          );
        })}

      {points.map((point) => {
        const px = mathToPixelX(point.x, viewport, width);
        const py = mathToPixelY(point.y, viewport, height);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG has no native button element; a focusable <g role="button"> is the accessible way to make an SVG point interactive.
          <g
            key={`pt-${point.row}`}
            role="button"
            tabIndex={0}
            aria-label={pointLabel(point.x, point.y)}
            className="pointer-events-auto cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRowRef.current = point.row;
            }}
            onPointerMove={(event) => {
              if (dragRowRef.current !== point.row) return;
              const { x, y } = toMath(event.clientX, event.clientY);
              if (Number.isFinite(x) && Number.isFinite(y)) onPointMove(point.row, x, y);
            }}
            onPointerUp={() => {
              dragRowRef.current = null;
            }}
            onPointerCancel={() => {
              dragRowRef.current = null;
            }}
            onKeyDown={(event) => handleKeyDown(event, point)}
          >
            {/* Invisible finger-sized hit target. */}
            <circle cx={px} cy={py} r={12} fill="transparent" />
            <circle
              cx={px}
              cy={py}
              r={4.5}
              fill={color}
              stroke="var(--color-background)"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
